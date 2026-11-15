# coding = utf-8
#!/usr/bin/python
# CCTVHost 适配说明：本脚本使用 RSA PKCS#1 v1.5 私钥解密接口响应密钥。
# 请在支持 RSA 私钥导入和 PKCS1_v1_5 私钥解密的 CCTVHost 1.36 (510) 或更新版本中运行。
import re
import os
import sys
import ssl
import json
import time
import base64
import hashlib
import random
import threading
import urllib.parse
import urllib.request

_HAS_PYCRYPTO = False
_HAS_CRYPTOGRAPHY = False

try:
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import pad, unpad
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5
    _HAS_PYCRYPTO = True
except ImportError:
    try:
        from Cryptodome.Cipher import AES
        from Cryptodome.Util.Padding import pad, unpad
        from Cryptodome.PublicKey import RSA
        from Cryptodome.Cipher import PKCS1_v1_5
        _HAS_PYCRYPTO = True
    except ImportError:
        try:
            from cryptography.hazmat.primitives.ciphers import (
                Cipher as _CryptoCipher,
                algorithms as _alg,
                modes as _modes,
            )
            from cryptography.hazmat.primitives import serialization as _serialization
            from cryptography.hazmat.primitives.asymmetric import padding as _asym_padding
            _HAS_CRYPTOGRAPHY = True
        except ImportError:
            pass

try:
    from base.spider import Spider
except ImportError:
    class Spider(object):
        def getCache(self, key):
            return None

        def setCache(self, key, value):
            return "fail"

        def delCache(self, key):
            return "fail"

sys.path.append('..')

_STATUS_OK = "OK"
_STATUS_NET_ERR = "NET_ERR"
_STATUS_AUTH_ERR = "AUTH_ERR"
_STATUS_BIZ_EMPTY = "BIZ_EMPTY"


def _pkcs7_pad(data_bytes, block_size=16):
    pad_len = block_size - (len(data_bytes) % block_size)
    return data_bytes + bytes([pad_len] * pad_len)


def _pkcs7_unpad(padded_bytes, block_size=16):
    if not padded_bytes or len(padded_bytes) % block_size != 0:
        raise ValueError("Invalid padded bytes length")
    pad_len = padded_bytes[-1]
    if pad_len < 1 or pad_len > block_size:
        raise ValueError("Invalid PKCS#7 padding")
    if padded_bytes[-pad_len:] != bytes([pad_len] * pad_len):
        raise ValueError("Corrupted PKCS#7 tail")
    return padded_bytes[:-pad_len]


def _asn1_read_length(buf, idx):
    first = buf[idx]
    idx += 1
    if not (first & 0x80):
        return first, idx
    num_bytes = first & 0x7F
    length = int.from_bytes(buf[idx:idx + num_bytes], 'big')
    return length, idx + num_bytes


def _asn1_parse_der_ints(der_bytes):
    ints = []
    idx = 0
    n = len(der_bytes)
    while idx < n:
        tag = der_bytes[idx]
        idx += 1
        length, idx = _asn1_read_length(der_bytes, idx)
        if tag == 0x30 or tag == 0xA0:
            continue
        elif tag == 0x03:
            sub = der_bytes[idx + 1:idx + length]
            ints.extend(_asn1_parse_der_ints(sub))
            idx += length
        elif tag == 0x04:
            sub = der_bytes[idx:idx + length]
            ints.extend(_asn1_parse_der_ints(sub))
            idx += length
        elif tag == 0x02:
            ints.append(int.from_bytes(der_bytes[idx:idx + length], 'big'))
            idx += length
        else:
            idx += length
    return ints


def _pure_rsa_pkcs1_v15_encrypt(msg_bytes, pub_der_b64):
    der = base64.b64decode(pub_der_b64)
    ints = [x for x in _asn1_parse_der_ints(der) if x > 1]
    modulus_n, exp_e = ints[0], ints[1]
    k = (modulus_n.bit_length() + 7) // 8
    ps_len = k - len(msg_bytes) - 3
    if ps_len < 8:
        raise ValueError("Message too long for RSA key size")
    ps = bytearray()
    while len(ps) < ps_len:
        b = os.urandom(1)[0]
        if b != 0:
            ps.append(b)
    em = b'\x00\x02' + bytes(ps) + b'\x00' + msg_bytes
    m_int = int.from_bytes(em, 'big')
    c_int = pow(m_int, exp_e, modulus_n)
    return c_int.to_bytes(k, 'big')


def _pure_rsa_pkcs1_v15_decrypt(cipher_bytes, priv_pem):
    lines = [
        ln.strip() for ln in priv_pem.strip().splitlines()
        if ln.strip() and not ln.strip().startswith('-----')
    ]
    der = base64.b64decode(''.join(lines))
    ints = _asn1_parse_der_ints(der)
    big_ints = [x for x in ints if x > 65537 or x == 65537]
    modulus_n = big_ints[0]
    priv_d = big_ints[2]
    k = (modulus_n.bit_length() + 7) // 8
    c_int = int.from_bytes(cipher_bytes, 'big')
    m_int = pow(c_int, priv_d, modulus_n)
    em = m_int.to_bytes(k, 'big')
    if len(em) < 11 or em[0] != 0x00 or em[1] != 0x02:
        sep = em.find(b'\x00', 2)
        if sep < 0:
            raise ValueError("Invalid PKCS#1 v1.5 padding")
        return em[sep + 1:]
    sep = em.find(b'\x00', 2)
    if sep < 10:
        raise ValueError("Invalid PKCS#1 v1.5 padding")
    return em[sep + 1:]


class Spider(Spider):
    DEFAULT_CLOUD_LINES = [
        ("2", "瓜子专线"),
        ("1", "瓜子蓝光"),
        ("3", "瓜子极速"),
        ("4", "瓜子备线"),
        ("5", "瓜子云播")
    ]

    # 各主分类在 /App/IndexList/indexList 接口中的默认子分类 sub 参数（对齐官方客户端）
    DEFAULT_SUB_MAP = {
        "1": "5",
        "2": "12",
        "3": "22",
        "4": "30"
    }

    def __init__(self):
        super(Spider, self).__init__()
        self.name = "瓜子"
        self.control_urls = [
            'https://api.rqqakqyn.com'
        ]
        self.hosts = [
            'https://api.anctjd.com',
            'https://apinew.uozvr.com',
            'https://sdapi.e2wu4ht.com',
            'https://api.w32z7vtd.com',
            'https://api.6a7nnf7.com',
            'https://api.umygrx3.com',
            'https://api.rmedphk.com',
            'https://api.mxtxqe.com',
            'https://api.sef5w7.com',
            'https://sdapi.u4gdp3.com',
            'https://sdapi.4zu76s.com',
            'https://sdapi.re3k7n.com',
            'https://api.xqe4cxu.com',
            'https://api.syq8gvw.com',
            'https://api.zjypp7x.com',
            'https://apinew.n3yje.icu',
            'https://apinew.8hpt2duq.com',
            'https://apinew.fzmfbdmg.com',
            'https://api.7gmsut2m.com',
            'https://api.gq89em.com'
        ]
        self.host_index = 0
        self.host = self.hosts[self.host_index]
        self.host_scores = {h: 100 - idx for idx, h in enumerate(self.hosts)}

        # AES 固定密钥
        self.AES_KEY = 'OITxa5OqAYjhswxx'
        self.AES_IV = 'rCMNwZASNBKZ8mXV'
        self.SIGN_SALT = '*&zvdvdvddbfikkkumtmdwqppp?|4Y!s!2br'

        # RSA 公钥/私钥
        self.RSA_PUBLIC_KEY = (
            "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUM5+/y8sPsWkd1/RQS64X259E"
            "UwxFXFE5HlA65MqrxnPs0JqoSRojSDy5QhwvROlaD6TwRQHKMY2OAZ6SnQeUJsCh"
            "TEFIR9qUkwrs3/MVUMxjsv6JS6Oe/juclyJGTgVmDhB55EafXsD0SQYVj/QXXsxR"
            "6ewR5E2kL52yAAD4yQIDAQAB"
        )
        self.RSA_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGAe6hKrWLi1zQmjTT1
ozbE4QdFeJGNxubxld6GrFGximxfMsMB6BpJhpcTouAqywAFppiKetUBBbXwYsYU
1wNr648XVmPmCMCy4rY8vdliFnbMUj086DU6Z+/oXBdWU3/b1G0DN3E9wULRSwcK
ZT3wj/cCI1vsCm3gj2R5SqkA9Y0CAwEAAQKBgAJH+4CxV0/zBVcLiBCHvSANm0l7
HetybTh/j2p0Y1sTXro4ALwAaCTUeqdBjWiLSo9lNwDHFyq8zX90+gNxa7c5EqcW
V9FmlVXr8VhfBzcZo1nXeNdXFT7tQ2yah/odtdcx+vRMSGJd1t/5k5bDd9wAvYdI
DblMAg+wiKKZ5KcdAkEA1cCakEN4NexkF5tHPRrR6XOY/XHfkqXxEhMqmNbB9U34
saTJnLWIHC8IXys6Qmzz30TtzCjuOqKRRy+FMM4TdwJBAJQZFPjsGC+RqcG5UvVM
iMPhnwe/bXEehShK86yJK/g/UiKrO87h3aEu5gcJqBygTq3BBBoH2md3pr/W+hUM
WBsCQQChfhTIrdDinKi6lRxrdBnn0Ohjg2cwuqK5zzU9p/N+S9x7Ck8wUI53DKm8
jUJE8WAG7WLj/oCOWEh+ic6NIwTdAkEAj0X8nhx6AXsgCYRql1klbqtVmL8+95KZ
K7PnLWG/IfjQUy3pPGoSaZ7fdquG8bq8oyf5+dzjE/oTXcByS+6XRQJAP/5ciy1b
L3NhUhsaOVy55MHXnPjdcTX0FaLi+ybXZIfIQ2P4rb19mVq1feMbCXhz+L1rG8oa
t5lYKfpe8k83ZA==
-----END RSA PRIVATE KEY-----"""

        self.DEVICE_OLD_KEY = "aLFBMWpxBrIDAD1Si/KVvm41"
        self.FALLBACK_TOKEN = (
            '024212ef0975c5306a1434e113a46463.bc77313e11a248558a6ca244ca980944'
            'ec3421fa480c50e0229ad91f1cb15aea582603202cd71796885c9e5163e500f1'
            'b72f737059aff1ddb8beea47c5a331d6760540345b7f88b2302a0e6e09589f9d'
            'cf3ff9175d8c905f990203f5fc04748008ea7a366571cbf5b09509a873dcfba3'
            'cf1d5590385f5f7ef6e01d1850974aa220eb5178c89e61c24411af9b9a19435e'
            '.06fde789ece48d9b33c5dc857e04e9b5838f08264d928b87237d3476c4484b46'
        )

        self._rsa_pub_key = None
        self._rsa_priv_key = None
        if _HAS_PYCRYPTO:
            try:
                self._rsa_pub_key = RSA.import_key(
                    "-----BEGIN PUBLIC KEY-----\n" + self.RSA_PUBLIC_KEY + "\n-----END PUBLIC KEY-----"
                )
            except Exception:
                pass
            try:
                self._rsa_priv_key = RSA.import_key(self.RSA_PRIVATE_KEY)
            except Exception:
                pass

        # 设备信息与会话状态
        self.deviceId = str(864150060000000 + random.randint(0, 9999))
        self.deviceKey = ''.join(random.choices('0123456789ABCDEF', k=40))
        self.token = ""
        self.token_id = ""
        self.token_updated_at = 0
        self.token_ttl = 1800
        self.registered = False
        self._auth_in_progress = False
        self.play_referer = "http://WJiZxLXA2.com/"
        self.play_referer_loaded = False

        self.header = {
            'User-Agent': 'okhttp/3.12.0',
            'code': 'GZ0055',
            'deviceId': self.deviceId,
            'lang': 'zh_cn',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Version': '2608011',
            'PackageName': 'com.xf4a1daee2.g3520dce0d.f8a8ed889d20260813',
            'Ver': '3.0.5.2',
            'api-ver': '3.0.5.2',
            'Referer': self.host
        }

        self._lock = threading.RLock()
        self.cache = {}
        self.cache_timeout = 300
        self.cache_max_size = 320

        self._restore_auth_cache()
        if not self.token:
            self.init_token()

    def getName(self):
        return self.name

    def init(self, extend=''):
        pass

    # ==================== 宿主缓存与会话管理 ====================

    def _restore_auth_cache(self):
        try:
            raw = self.getCache("guazi_auth_state_v4")
            if raw:
                state = json.loads(raw) if isinstance(raw, str) else raw
                if isinstance(state, dict) and state.get("token"):
                    self.deviceId = state.get("deviceId") or self.deviceId
                    self.deviceKey = state.get("deviceKey") or self.deviceKey
                    self.token = str(state.get("token") or "")
                    self.token_id = str(state.get("token_id") or "")
                    self.registered = bool(state.get("registered", False))
                    self.token_updated_at = float(state.get("updated_at", 0))
                    self.header['deviceId'] = self.deviceId
            good_host = self.getCache("guazi_host_url")
            if good_host and isinstance(good_host, str) and good_host in self.hosts:
                self.host = good_host
                self.host_index = self.hosts.index(good_host)
                self.host_scores[good_host] = 200
        except Exception:
            pass

    def _persist_auth_cache(self):
        try:
            state = {
                "deviceId": self.deviceId,
                "deviceKey": self.deviceKey,
                "token": self.token,
                "token_id": self.token_id,
                "registered": self.registered,
                "updated_at": self.token_updated_at
            }
            self.setCache("guazi_auth_state_v4", json.dumps(state))
            if self.host:
                self.setCache("guazi_host_url", self.host)
        except Exception:
            pass

    def _format_poster(self, raw_url):
        """
        关键修复（解决 CCTVHost 首页与分类卡片海报全部显示胶片占位图标的问题）：
        - 在 CCTVHost 中，若 vod_pic 带有 `@Referer=...` 后缀，host_media_runtime.py 会生成 posterHeaders，
          进而触发 media-service.py (relay_artwork) 将所有图片地址重写为 `http://127.0.0.1:port/artwork/<token>`；
        - 而本机 Python 服务受 `host_service_runtime.py` 的 `_http_workers_per_service = 4` 与
          `response_read_slots = 2` 非阻塞信号量保护，当 HostImageLoader 并发发起 8~14 个图片请求时，
          超出 4 个并发的本机请求会被直接断开连接，连续 3 次即触发 HostImageLoader 对 `127.0.0.1` 域名退避熔断，
          导致整页海报全部失败显示为胶片图标！
        - 移除 `@Referer=` 后缀并返回纯净的 `https://` 海报直链（与内置 webox-guazi.js 完全一致），
          即可让 iOS 原生 HostImageLoader 直接通过 NSURLSession（自带同源 Referer、自签名证书放行与 L2 磁盘缩略图缓存）高速加载海报。
        """
        if not raw_url or not str(raw_url).strip():
            return ""
        pic = str(raw_url).strip().replace('\\/', '/')
        if pic in ('0', 'null', 'None', 'nil'):
            return ""

        # 剥离任何尾部的 @Referer=... 或 @User-Agent=...，避免触发 127.0.0.1/artwork 本机代理限流熔断
        if "@" in pic and pic.lower().startswith(("http://", "https://", "//")):
            base_part, _, tail = pic.partition("@")
            if "=" in tail:
                pic = base_part.strip()

        if pic.startswith("//"):
            pic = "https:" + pic
        elif pic.startswith("/") and not pic.startswith("//"):
            pic = f"{self.host.rstrip('/')}{pic}"
        elif not pic.startswith(("http://", "https://")):
            pic = f"{self.host.rstrip('/')}/{pic.lstrip('/')}"

        try:
            parsed = urllib.parse.urlsplit(pic)
            safe_path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe='/:@!$&\'()*+,;=._~-')
            safe_query = urllib.parse.quote(urllib.parse.unquote(parsed.query), safe='/:?&=@!$\'()*+,;._~-')
            pic = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, safe_path, safe_query, parsed.fragment))
        except Exception:
            pic = pic.replace(" ", "%20")

        return pic

    def _apply_auth(self, result):
        if not isinstance(result, dict):
            raise Exception("认证响应格式无效")
        new_token = (
            result.get('token')
            or result.get('access_token')
            or (result.get('data', {}) if isinstance(result.get('data'), dict) else {}).get('token')
            or ''
        )
        if not new_token:
            raise Exception("认证失败，无 token 返回")
        self.token = str(new_token).strip()
        new_token_id = (
            result.get('app_user_id')
            or result.get('token_id')
            or result.get('user_id')
            or self.token_id
            or ''
        )
        self.token_id = str(new_token_id) if new_token_id is not None else ""
        self.token_updated_at = time.time()
        self._persist_auth_cache()

    def sign_up(self):
        params = {
            "new_key": self.deviceKey,
            "old_key": self.DEVICE_OLD_KEY,
            "phone_type": 1,
            "code": ""
        }
        result = self._auth_request('/App/Authentication/Device/signUp', params)
        self._apply_auth(result)
        self.registered = True

    def sign_in(self):
        params = {
            "new_key": self.deviceKey,
            "old_key": self.DEVICE_OLD_KEY
        }
        result = self._auth_request('/App/Authentication/Device/signIn', params)
        self._apply_auth(result)
        self.registered = True

    def refresh_token(self):
        result = self._auth_request('/App/Authentication/Authenticator/refresh', {})
        self._apply_auth(result)

    def _auth_request(self, path, params):
        for host in self._ordered_hosts():
            status, res = self._send_encrypted_request_ex(params, path, is_auth=True, target_host=host)
            if status == _STATUS_OK and isinstance(res, dict) and (res.get('token') or res.get('access_token')):
                self._record_host_result(host, True)
                return res
            if status == _STATUS_NET_ERR:
                self._record_host_result(host, False)
            else:
                break
        raise Exception(f"认证接口请求失败: {path}")

    def init_token(self, force=False):
        with self._lock:
            if self._auth_in_progress:
                return
            self._auth_in_progress = True
        try:
            if not self.registered or force:
                try:
                    self.sign_up()
                except Exception:
                    self.sign_in()
            else:
                try:
                    self.sign_in()
                except Exception:
                    self.sign_up()
            try:
                self.refresh_token()
            except Exception:
                if not self.token:
                    raise
        except Exception:
            if not self.token:
                self.token = self.FALLBACK_TOKEN
            self.token_updated_at = time.time()
        finally:
            with self._lock:
                self._auth_in_progress = False

    def ensure_token(self, force=False):
        now = time.time()
        token_expired = (now - self.token_updated_at) > self.token_ttl
        if force or not self.token or token_expired:
            self.init_token(force=force)

    # ==================== 网络层（适配 CCTVHost 64KB 分块读取防信号量拒绝） ====================

    def _ordered_hosts(self):
        with self._lock:
            return sorted(self.hosts, key=lambda h: self.host_scores.get(h, 0), reverse=True)

    def _record_host_result(self, host, success):
        with self._lock:
            cur = self.host_scores.get(host, 50)
            if success:
                self.host_scores[host] = min(200, cur + 15)
                if host in self.hosts:
                    self.host_index = self.hosts.index(host)
                    self.host = host
            else:
                self.host_scores[host] = max(0, cur - 25)

    def _do_http_post(self, url, headers, body, timeout=5):
        """
        采用 <= 64KB 分块读取响应体，规避 CCTVHost `host_service_runtime.py` 中
        `whole_body` / `requested > 1MB` 触发的 `response_read_slots (BoundedSemaphore(2))` 并发读取拦截。
        """
        encoded = urllib.parse.urlencode(body).encode('utf-8')
        req = urllib.request.Request(url, data=encoded, headers=headers, method='POST')
        ssl_ctx = ssl._create_unverified_context()
        try:
            ssl_ctx.set_ciphers('DEFAULT:@SECLEVEL=1')
        except Exception:
            pass
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx))
        with opener.open(req, timeout=timeout) as resp:
            status = getattr(resp, 'status', None) or resp.getcode() or 200
            chunks = []
            total = 0
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
                if total > 4 * 1024 * 1024:
                    break
            raw_text = b''.join(chunks).decode('utf-8', errors='replace')

            class _SimpleResp(object):
                def __init__(self, status_code, text):
                    self.status_code = status_code
                    self.text = text

                def json(self):
                    return json.loads(self.text)

            return _SimpleResp(status, raw_text)

    def _send_encrypted_request_ex(self, data, path, is_auth=False, target_host=None):
        try:
            if not is_auth:
                self.ensure_token(force=False)

            host_to_use = (target_host or self.host).rstrip('/')
            payload = dict(data) if isinstance(data, dict) else data
            if isinstance(payload, dict):
                if 'token' in payload:
                    payload['token'] = self.token
                if 'token_id' in payload:
                    payload['token_id'] = self.token_id

            # 使用 ensure_ascii=True 生成与官方 JS 客户端 apiJsonStringify 完全一致的 \uXXXX 转义 JSON
            json_params = json.dumps(payload, ensure_ascii=True, separators=(',', ':'))
            encrypted = self.aes_encrypt(json_params, self.AES_KEY, self.AES_IV)
            if not encrypted:
                return _STATUS_BIZ_EMPTY, None
            request_key = encrypted.upper()

            key_json = json.dumps({"iv": self.AES_IV, "key": self.AES_KEY}, separators=(',', ':'))
            keys = self.rsa_encrypt(key_json, self.RSA_PUBLIC_KEY)
            if not keys:
                return _STATUS_BIZ_EMPTY, None

            t = str(int(time.time()))
            tok_id = self.token_id or ""
            sign_str = (
                f"token_id={tok_id},token={self.token},phone_type=1,"
                f"request_key={request_key},app_id=1,time={t},keys={keys}{self.SIGN_SALT}"
            )
            signature = self.get_md5(sign_str)

            body = {
                'token': self.token,
                'token_id': tok_id,
                'phone_type': '1',
                'time': t,
                'phone_model': 'xiaomi-25031',
                'keys': keys,
                'request_key': request_key,
                'signature': signature,
                'app_id': '1',
                'ad_version': '1'
            }

            req_headers = dict(self.header)
            req_headers['Referer'] = host_to_use
            url = f"{host_to_use}{path}"

            try:
                response = self._do_http_post(url, headers=req_headers, body=body, timeout=5)
            except Exception:
                return _STATUS_NET_ERR, None

            if response is None:
                return _STATUS_NET_ERR, None

            status_code = getattr(response, 'status_code', 0)
            if status_code != 200:
                if status_code in (401, 403) and not is_auth:
                    return _STATUS_AUTH_ERR, None
                return _STATUS_NET_ERR, None

            try:
                resp_json = response.json()
            except Exception:
                return _STATUS_NET_ERR, None

            if not isinstance(resp_json, dict):
                return _STATUS_BIZ_EMPTY, None

            code = resp_json.get('code', 200)
            if code is not None and int(code) != 200:
                msg = str(resp_json.get('msg') or resp_json.get('message') or '').lower()
                if (int(code) in (401, 403, 1001, 1002, -1) or 'token' in msg or '登录' in msg) and not is_auth:
                    return _STATUS_AUTH_ERR, None
                return _STATUS_BIZ_EMPTY, None

            data_section = resp_json.get('data')
            if not data_section:
                return _STATUS_BIZ_EMPTY, None

            if isinstance(data_section, dict) and 'response_key' in data_section:
                encrypted_response = data_section.get('response_key', '')
                encrypted_keys = data_section.get('keys', '')
                if not encrypted_response:
                    return _STATUS_BIZ_EMPTY, None
                resp_key = self.AES_KEY
                resp_iv = self.AES_IV
                if encrypted_keys:
                    decrypted_keys_json = self.rsa_decrypt(encrypted_keys, self.RSA_PRIVATE_KEY)
                    if decrypted_keys_json:
                        try:
                            key_info = json.loads(decrypted_keys_json)
                            resp_key = key_info.get('key') or resp_key
                            resp_iv = key_info.get('iv') or resp_iv
                        except Exception:
                            pass
                decrypted_data = self.aes_decrypt(encrypted_response, resp_key, resp_iv)
                return (_STATUS_OK, json.loads(decrypted_data)) if decrypted_data else (_STATUS_BIZ_EMPTY, None)

            if isinstance(data_section, dict):
                return _STATUS_OK, data_section
            return _STATUS_BIZ_EMPTY, None
        except Exception:
            return _STATUS_NET_ERR, None

    def _send_encrypted_request(self, data, path, is_auth=False):
        status, payload = self._send_encrypted_request_ex(data, path, is_auth=is_auth, target_host=self.host)
        return payload if status == _STATUS_OK else None

    def _make_cache_key(self, path, data):
        if isinstance(data, dict):
            clean = {
                k: v for k, v in data.items()
                if k not in ('mobile_time', 'time', 'nt', '_client_ts', 'rand', 'token', 'token_id')
            }
            norm = json.dumps(clean, sort_keys=True, ensure_ascii=False)
        else:
            norm = str(data)
        digest = hashlib.md5(norm.encode('utf-8')).hexdigest()
        return f"{path}_{digest}"

    def _prune_cache(self):
        with self._lock:
            if len(self.cache) <= self.cache_max_size:
                return
            now = time.time()
            expired = [k for k, (_, ts) in self.cache.items() if now - ts >= self.cache_timeout]
            for k in expired:
                self.cache.pop(k, None)
            if len(self.cache) > self.cache_max_size:
                oldest = sorted(self.cache.items(), key=lambda kv: kv[1][1])[:len(self.cache) - self.cache_max_size]
                for k, _ in oldest:
                    self.cache.pop(k, None)

    def get_data(self, data, path, use_cache=True):
        try:
            cache_key = self._make_cache_key(path, data) if use_cache else None
            if use_cache and cache_key:
                with self._lock:
                    if cache_key in self.cache:
                        cached_data, timestamp = self.cache[cache_key]
                        if time.time() - timestamp < self.cache_timeout:
                            return cached_data

            auth_refreshed = False
            for host in self._ordered_hosts():
                status, result = self._send_encrypted_request_ex(data, path, is_auth=False, target_host=host)

                if status == _STATUS_AUTH_ERR and not auth_refreshed:
                    auth_refreshed = True
                    try:
                        self.ensure_token(force=True)
                    except Exception:
                        pass
                    status, result = self._send_encrypted_request_ex(data, path, is_auth=False, target_host=host)

                if status == _STATUS_OK and result is not None:
                    self._record_host_result(host, True)
                    if use_cache and cache_key:
                        with self._lock:
                            self._prune_cache()
                            self.cache[cache_key] = (result, time.time())
                    return result

                if status == _STATUS_BIZ_EMPTY:
                    self._record_host_result(host, True)
                    return None

                self._record_host_result(host, False)

            return None
        except Exception:
            return None

    def get_cached_data(self, cache_key, data, path):
        return self.get_data(data, path, use_cache=True)

    # ==================== 加解密工具方法 ====================

    def aes_encrypt(self, text, key, iv):
        try:
            key_bytes = key.encode('utf-8')
            iv_bytes = iv.encode('utf-8')
            raw_bytes = text.encode('utf-8')
            if _HAS_PYCRYPTO:
                cipher = AES.new(key_bytes, AES.MODE_CBC, iv_bytes)
                encrypted = cipher.encrypt(pad(raw_bytes, AES.block_size))
                return encrypted.hex().upper()
            if _HAS_CRYPTOGRAPHY:
                padded = _pkcs7_pad(raw_bytes, 16)
                encryptor = _CryptoCipher(_alg.AES(key_bytes), _modes.CBC(iv_bytes)).encryptor()
                encrypted = encryptor.update(padded) + encryptor.finalize()
                return encrypted.hex().upper()
            return ""
        except Exception:
            return ""

    def aes_decrypt(self, text, key, iv):
        try:
            key_bytes = key.encode('utf-8')
            iv_bytes = iv.encode('utf-8')
            raw_text = text.strip()
            try:
                encrypted_bytes = bytes.fromhex(raw_text)
            except ValueError:
                encrypted_bytes = base64.b64decode(raw_text)
            if _HAS_PYCRYPTO:
                cipher = AES.new(key_bytes, AES.MODE_CBC, iv_bytes)
                decrypted = unpad(cipher.decrypt(encrypted_bytes), AES.block_size)
                return decrypted.decode('utf-8')
            if _HAS_CRYPTOGRAPHY:
                decryptor = _CryptoCipher(_alg.AES(key_bytes), _modes.CBC(iv_bytes)).decryptor()
                padded = decryptor.update(encrypted_bytes) + decryptor.finalize()
                return _pkcs7_unpad(padded, 16).decode('utf-8')
            return ""
        except Exception:
            return ""

    def rsa_encrypt(self, text, public_key_str):
        try:
            msg_bytes = text.encode('utf-8')
            if _HAS_PYCRYPTO:
                key = self._rsa_pub_key or RSA.import_key(
                    "-----BEGIN PUBLIC KEY-----\n" + public_key_str + "\n-----END PUBLIC KEY-----"
                )
                cipher = PKCS1_v1_5.new(key)
                encrypted = cipher.encrypt(msg_bytes)
                return base64.b64encode(encrypted).decode('utf-8')
            if _HAS_CRYPTOGRAPHY:
                pem = ("-----BEGIN PUBLIC KEY-----\n" + public_key_str + "\n-----END PUBLIC KEY-----").encode('utf-8')
                pub_key = _serialization.load_pem_public_key(pem)
                encrypted = pub_key.encrypt(msg_bytes, _asym_padding.PKCS1v15())
                return base64.b64encode(encrypted).decode('utf-8')
            encrypted = _pure_rsa_pkcs1_v15_encrypt(msg_bytes, public_key_str)
            return base64.b64encode(encrypted).decode('utf-8')
        except Exception:
            try:
                encrypted = _pure_rsa_pkcs1_v15_encrypt(text.encode('utf-8'), public_key_str)
                return base64.b64encode(encrypted).decode('utf-8')
            except Exception:
                return ""

    def rsa_decrypt(self, encrypted_data, private_key_str):
        try:
            encrypted_bytes = base64.b64decode(encrypted_data)
            if _HAS_PYCRYPTO:
                rsa_key = self._rsa_priv_key or RSA.import_key(private_key_str)
                cipher = PKCS1_v1_5.new(rsa_key)
                decrypted = cipher.decrypt(encrypted_bytes, None)
                if decrypted:
                    return decrypted.decode('utf-8')
            if _HAS_CRYPTOGRAPHY:
                priv_key = _serialization.load_pem_private_key(private_key_str.encode('utf-8'), password=None)
                decrypted = priv_key.decrypt(encrypted_bytes, _asym_padding.PKCS1v15())
                return decrypted.decode('utf-8')
            decrypted = _pure_rsa_pkcs1_v15_decrypt(encrypted_bytes, private_key_str)
            return decrypted.decode('utf-8') if decrypted else ""
        except Exception:
            try:
                encrypted_bytes = base64.b64decode(encrypted_data)
                decrypted = _pure_rsa_pkcs1_v15_decrypt(encrypted_bytes, private_key_str)
                return decrypted.decode('utf-8') if decrypted else ""
            except Exception:
                return ""

    def get_md5(self, text):
        return hashlib.md5(text.encode('utf-8')).hexdigest().upper()

    # ==================== 数据清洗与通用条目构建 ====================

    def _extract_vod_id(self, item_or_id):
        if isinstance(item_or_id, dict):
            raw = (
                item_or_id.get('vod_id')
                or item_or_id.get('d_id')
                or item_or_id.get('vod_d_id')
                or item_or_id.get('target_id')
                or item_or_id.get('id')
                or ''
            )
        else:
            raw = item_or_id
        s = urllib.parse.unquote(str(raw or '').strip())
        for sep in ('/', '|'):
            if sep in s:
                s = s.split(sep)[0].strip()
        return s

    def _extract_poster_field(self, item):
        if not isinstance(item, dict):
            return ""
        for k in (
            'vod_pic',
            'd_pic',
            'vod_pic_thumb',
            'vod_pic_slide',
            'pic',
            'pic_url',
            'cover',
            'thumb',
            'img',
            'image'
        ):
            val = item.get(k)
            if val and str(val).strip() not in ('', '0', 'null', 'None'):
                return str(val).strip()
        return ""

    def _format_remarks(self, item, rank_index=None):
        if not isinstance(item, dict):
            return ""
        new_cont = str(
            item.get('new_continue')
            or item.get('vod_remarks')
            or item.get('d_remarks')
            or item.get('remarks')
            or ''
        ).strip()
        vod_continu = item.get('vod_continu', item.get('d_continu', 0))
        try:
            continu_int = int(vod_continu)
        except Exception:
            continu_int = 0

        score = str(
            item.get('vod_score') or item.get('vod_scroe') or item.get('d_score') or ''
        ).strip()

        if new_cont and new_cont not in ('0', 'null', 'None'):
            base_remark = new_cont
        elif continu_int > 0:
            base_remark = f"更新至{continu_int}集"
        elif score and score not in ('0', '0.0'):
            base_remark = f"⭐{score}"
        else:
            base_remark = "电影"

        if rank_index is not None:
            prefix = f"TOP{rank_index}"
            if score and score not in ('0', '0.0') and f"⭐{score}" not in base_remark:
                return f"{prefix} · ⭐{score} · {base_remark}"
            return f"{prefix} · {base_remark}"
        return base_remark

    def _build_vod_card(self, item, rank_index=None):
        if not isinstance(item, dict):
            return None
        if item.get('is_ad') or item.get('ad_url') or item.get('type') == 'ad':
            return None
        vod_id = self._extract_vod_id(item)
        vod_name = str(
            item.get('vod_name') or item.get('d_name') or item.get('title') or item.get('name') or ''
        ).strip()
        if not vod_id or not vod_name:
            return None
        raw_pic = self._extract_poster_field(item)
        pic = self._format_poster(raw_pic)
        remarks = self._format_remarks(item, rank_index=rank_index)
        return {
            "vod_id": str(vod_id),
            "vod_name": vod_name,
            "vod_pic": pic,
            "vod_bg": pic,
            "vod_remarks": remarks
        }

    def _fetch_hot_recommend_videos(self, page=1):
        """
        构建首页『精选 / 热门推荐』片单：
        1. 第 1 页优先调用瓜子官方首页推荐接口 `/App/IndexList/index` (`{"ns": "", "nt": time, "pid": "1"}`)
           提取 `list[1..n]` 各推荐模块影片（仅 1 次请求）；
        2. 若为空或翻页，则调用官方全站热门接口 `/App/IndexList/indexList` (`tid="0", sort="d_hits"`) 兜底。
        """
        pg_int = max(1, int(page))
        hot_cache_key = f"__hot_recommend_v4_p{pg_int}"
        with self._lock:
            if hot_cache_key in self.cache:
                cached_list, ts = self.cache[hot_cache_key]
                if time.time() - ts < self.cache_timeout and cached_list:
                    return list(cached_list)

        videos = []
        seen_ids = set()

        # 1. 官方首页模块接口 /App/IndexList/index（单次请求拿齐轮播与热门推荐）
        if pg_int == 1:
            idx_data = self.get_data(
                {"ns": "", "nt": int(time.time()), "pid": "1"},
                '/App/IndexList/index',
                use_cache=True
            )
            if isinstance(idx_data, dict) and isinstance(idx_data.get('list'), list):
                sections = idx_data['list']
                # sections[0] 通常为公告/轮播区，sections[1:] 为各热门专题模块
                start_sec = 1 if len(sections) > 1 else 0
                for sec in sections[start_sec:]:
                    if isinstance(sec, dict) and isinstance(sec.get('list'), list):
                        for item in sec['list']:
                            card = self._build_vod_card(item)
                            if card and card['vod_id'] not in seen_ids:
                                seen_ids.add(card['vod_id'])
                                videos.append(card)
                    elif isinstance(sec, dict):
                        card = self._build_vod_card(sec)
                        if card and card['vod_id'] not in seen_ids:
                            seen_ids.add(card['vod_id'])
                            videos.append(card)

        # 2. 官方全站最热列表 /App/IndexList/indexList (tid='0' 或 '2'/'1', sort='d_hits')
        if len(videos) < 15:
            for cand_tid in ("0", "2", "1"):
                body = {
                    "area": "0",
                    "year": "0",
                    "pageSize": "30",
                    "sort": "d_hits",
                    "page": str(pg_int),
                    "tid": cand_tid
                }
                data = self.get_data(body, '/App/IndexList/indexList', use_cache=True)
                if isinstance(data, dict) and isinstance(data.get('list'), list):
                    for item in data['list']:
                        card = self._build_vod_card(item)
                        if card and card['vod_id'] not in seen_ids:
                            seen_ids.add(card['vod_id'])
                            videos.append(card)
                    if len(videos) >= 24:
                        break

        if videos:
            with self._lock:
                self.cache[hot_cache_key] = (list(videos), time.time())
        return videos

    def _fetch_ranking_videos(self, page=1, extend=None):
        """
        构建『热播排行榜』专属分类：
        单次请求 `/App/IndexList/indexList` 榜单接口，避免多线程触发宿主 `response_read_slots` 并发限制。
        """
        ext = extend if isinstance(extend, dict) else {}
        board = str(ext.get('board', '0')).strip()
        if board == 'all':
            board = '0'
        rank_sort = str(ext.get('sort', 'd_hits')).strip()
        area = str(ext.get('area', '0')).strip()
        year = str(ext.get('year', '0')).strip()
        pg_int = max(1, int(page))
        pg_str = str(pg_int)

        raw_items = []
        seen_ids = set()

        # 优先请求目标榜单 tid（全站总榜 tid='0'，若服务端不支持 tid='0' 自动回退至剧集榜 tid='2'）
        candidate_tids = [board] if board != '0' else ['0', '2']
        for t_id in candidate_tids:
            body = {
                "area": area,
                "year": year,
                "pageSize": "30",
                "sort": rank_sort,
                "page": pg_str,
                "tid": t_id
            }
            data = self.get_data(body, '/App/IndexList/indexList', use_cache=True)
            if isinstance(data, dict) and isinstance(data.get('list'), list) and data['list']:
                for it in data['list']:
                    vid = self._extract_vod_id(it)
                    if vid and vid not in seen_ids:
                        seen_ids.add(vid)
                        raw_items.append(it)
                if raw_items:
                    break

        videos = []
        offset = (pg_int - 1) * 30
        for i, item in enumerate(raw_items):
            card = self._build_vod_card(item, rank_index=offset + i + 1)
            if card:
                videos.append(card)
        return videos

    def _load_category_page_core(self, tid, pg, ext):
        videos = []
        tid_str = str(tid or '').strip()
        pg_int = max(1, int(pg))

        if tid_str.lower() in ('rank', 'ranking', 'top', '排行榜', '热播排行榜'):
            return self._fetch_ranking_videos(page=pg_int, extend=ext)

        if tid_str.lower() in ('hot', 'recommend', '推荐', '热门推荐'):
            if ext.get('area', '0') == '0' and ext.get('year', '0') == '0' and 'sort' not in ext and 'tid' not in ext:
                return self._fetch_hot_recommend_videos(page=pg_int)
            tid_str = str(ext.get('tid', '0')).strip()
            if tid_str == 'hot':
                tid_str = '0'

        default_sort = "d_hits" if tid_str == "0" else "d_id"
        body = {
            "area": str(ext.get('area', '0')),
            "year": str(ext.get('year', '0')),
            "pageSize": "30",
            "sort": str(ext.get('sort', default_sort)),
            "page": str(pg_int),
            "tid": tid_str
        }
        sub_val = str(ext.get('sub') or ext.get('type') or ext.get('class') or '').strip()
        if sub_val and sub_val != '0':
            body['sub'] = sub_val

        data = self.get_data(body, '/App/IndexList/indexList', use_cache=True)
        if isinstance(data, dict) and isinstance(data.get('list'), list):
            for item in data['list']:
                card = self._build_vod_card(item)
                if card:
                    videos.append(card)
        return videos

    # ==================== Spider 标准接口实现 ====================

    def homeContent(self, filter):
        """
        注意：CCTVHost 的 MediaBrowserViewController 会自动在顶部分类栏首项插入『精选』，
        并在『精选』页自动用 homeContent/homeVideoContent 的返回列表渲染顶部轮播与『| 热门推荐』货架。
        因此 classes 不再重复放置同名『热门推荐』，避免在『精选』页下方出现两个重复的『| 热门推荐』货架。
        """
        result = {}
        classes = [
            {"type_name": "电影", "type_id": "1"},
            {"type_name": "电视剧", "type_id": "2"},
            {"type_name": "动漫", "type_id": "4"},
            {"type_name": "综艺", "type_id": "3"},
            {"type_name": "短剧", "type_id": "64"},
            {"type_name": "漫剧", "type_id": "74"},
            {"type_name": "热播排行榜", "type_id": "rank"}
        ]
        result['class'] = classes

        year_values = [{"n": "全部", "v": "0"}] + [
            {"n": str(y), "v": str(y)} for y in range(2026, 2004, -1)
        ] + [{"n": "更早", "v": "2004"}]

        area_values = [
            {"n": "全部", "v": "0"}, {"n": "大陆", "v": "大陆"}, {"n": "香港", "v": "香港"},
            {"n": "台湾", "v": "台湾"}, {"n": "美国", "v": "美国"}, {"n": "韩国", "v": "韩国"},
            {"n": "日本", "v": "日本"}, {"n": "英国", "v": "英国"}, {"n": "法国", "v": "法国"},
            {"n": "泰国", "v": "泰国"}, {"n": "印度", "v": "印度"}, {"n": "其他", "v": "其他"}
        ]

        sub_filters = {
            "1": {"key": "sub", "name": "类型", "value": [
                {"n": "全部", "v": "0"}, {"n": "动作片", "v": "5"}, {"n": "悬疑片", "v": "29"},
                {"n": "喜剧片", "v": "6"}, {"n": "爱情片", "v": "7"}, {"n": "科幻片", "v": "8"},
                {"n": "恐怖片", "v": "9"}, {"n": "剧情片", "v": "10"}, {"n": "战争片", "v": "11"},
                {"n": "动画片", "v": "36"}, {"n": "纪录片", "v": "20"}, {"n": "犯罪片", "v": "61"}
            ]},
            "2": {"key": "sub", "name": "类型", "value": [
                {"n": "全部", "v": "0"}, {"n": "国产剧", "v": "12"}, {"n": "香港剧", "v": "13"},
                {"n": "台湾剧", "v": "14"}, {"n": "欧美剧", "v": "15"}, {"n": "日本剧", "v": "16"},
                {"n": "韩国剧", "v": "17"}, {"n": "海外剧", "v": "18"}, {"n": "泰国剧", "v": "19"}
            ]},
            "3": {"key": "sub", "name": "类型", "value": [
                {"n": "全部", "v": "0"}, {"n": "大陆综艺", "v": "22"}, {"n": "港台综艺", "v": "23"},
                {"n": "日韩综艺", "v": "24"}, {"n": "欧美综艺", "v": "25"}
            ]},
            "4": {"key": "sub", "name": "类型", "value": [
                {"n": "全部", "v": "0"}, {"n": "中国动漫", "v": "30"}, {"n": "日本动漫", "v": "31"},
                {"n": "欧美动漫", "v": "33"}
            ]}
        }

        filters = {}
        for cate in classes:
            tid = cate['type_id']
            if tid == "rank":
                filters[tid] = [
                    {"key": "board", "name": "榜单", "value": [
                        {"n": "全站总榜", "v": "0"},
                        {"n": "剧集热播榜", "v": "2"},
                        {"n": "电影热映榜", "v": "1"},
                        {"n": "短剧飙升榜", "v": "64"},
                        {"n": "动漫人气榜", "v": "4"},
                        {"n": "综艺口碑榜", "v": "3"}
                    ]},
                    {"key": "sort", "name": "维度", "value": [
                        {"n": "热度榜", "v": "d_hits"},
                        {"n": "高分榜", "v": "d_score"},
                        {"n": "新片榜", "v": "d_id"}
                    ]},
                    {"key": "area", "name": "地区", "value": area_values},
                    {"key": "year", "name": "年份", "value": year_values}
                ]
            else:
                cate_f = []
                if tid in sub_filters:
                    cate_f.append(sub_filters[tid])
                cate_f.extend([
                    {"key": "area", "name": "地区", "value": area_values},
                    {"key": "year", "name": "年份", "value": year_values},
                    {"key": "sort", "name": "排序", "value": [
                        {"n": "最新", "v": "d_id"},
                        {"n": "最热", "v": "d_hits"},
                        {"n": "推荐", "v": "d_score"}
                    ]}
                ])
                filters[tid] = cate_f
        result['filters'] = filters

        try:
            result['list'] = self._fetch_hot_recommend_videos(page=1)
        except Exception:
            result['list'] = []
        return result

    def homeVideoContent(self):
        try:
            videos = self._fetch_hot_recommend_videos(page=1)
            return {'list': videos}
        except Exception:
            return {'list': []}

    def categoryContent(self, tid, pg, filter, extend):
        videos = []
        try:
            ext = extend if isinstance(extend, dict) else {}
            videos = self._load_category_page_core(tid, pg, ext)
        except Exception:
            pass
        return {'list': videos, 'page': int(pg), 'pagecount': 9999, 'limit': 30, 'total': 999999}

    # ==================== 详情页多云端线路与多播放源 Tab 构建 ====================

    def _resolution_rank(self, res_key):
        s = str(res_key or '').upper().strip()
        if s.isdigit():
            return int(s)
        if '8K' in s or '4320' in s:
            return 4320
        if '4K' in s or '3840' in s or '2160' in s or 'UHD' in s:
            return 2160
        if '2K' in s or '1440' in s or 'QHD' in s:
            return 1440
        if '1080' in s or 'FHD' in s or '蓝光' in s or '超清' in s:
            return 1080
        if '720' in s or 'HD' in s or '高清' in s:
            return 720
        if '540' in s:
            return 540
        if '480' in s or 'SD' in s or '标清' in s:
            return 480
        if '360' in s or '流畅' in s:
            return 360
        if '240' in s:
            return 240
        nums = re.findall(r'\d+', s)
        return int(nums[0]) if nums else 100

    def _order_variants_by_mode(self, play_variants, prefer_mode="auto"):
        high_to_low = sorted(
            play_variants,
            key=lambda x: self._resolution_rank(x.get('res', '')),
            reverse=True
        )
        if prefer_mode in ("auto", "uhd") or len(high_to_low) <= 1:
            return high_to_low

        if prefer_mode == "fast":
            fast_tier = [v for v in high_to_low if self._resolution_rank(v.get('res', '')) <= 720]
            high_tier = [v for v in high_to_low if self._resolution_rank(v.get('res', '')) > 720]
            if fast_tier:
                fast_sorted = sorted(fast_tier, key=lambda x: self._resolution_rank(x.get('res', '')))
                return fast_sorted + high_tier
            return high_to_low

        if prefer_mode == "hd":
            mid_tier = [v for v in high_to_low if 480 <= self._resolution_rank(v.get('res', '')) <= 720]
            rest_tier = [v for v in high_to_low if v not in mid_tier]
            return mid_tier + rest_tier

        return high_to_low

    def _encode_episode_payload(self, play_variants, prefer_mode="auto", cloud_id="2"):
        ordered_variants = self._order_variants_by_mode(play_variants, prefer_mode=prefer_mode)
        best_param = ordered_variants[0].get('param', '') or ordered_variants[0].get('url', '')
        res_list = [str(v.get('res', '')) for v in ordered_variants if v.get('res') is not None]
        envelope = {
            "cloud_id": str(cloud_id),
            "mode": str(prefer_mode),
            "variants": ordered_variants
        }
        compact_json = json.dumps(envelope, ensure_ascii=False, separators=(',', ':'))
        b64_payload = base64.urlsafe_b64encode(compact_json.encode('utf-8')).decode('utf-8')
        return f"{best_param}||{'@'.join(res_list)}||{b64_payload}"

    def _extract_raw_episode_items(self, jdata, default_vod_name):
        if not isinstance(jdata, dict):
            return []
        ep_items = jdata.get('list')
        if not isinstance(ep_items, list) or not ep_items:
            return []

        extracted = []
        total_eps = len(ep_items)
        for index, item in enumerate(ep_items):
            if not isinstance(item, dict):
                continue
            primary_variants = []
            backup_variants = []
            play_field = item.get('play')

            if isinstance(play_field, dict):
                for res_key, val in play_field.items():
                    if isinstance(val, dict):
                        param = str(val.get('param') or '').strip()
                        direct_url = str(val.get('url') or val.get('vurl') or '').strip()
                        if not param and not direct_url:
                            continue
                        entry_obj = {'res': str(res_key), 'param': param, 'url': direct_url}
                        # 对齐 catpaw/reference/sources.js: show_type == '2' 为受限档位，优先使用非 '2' 档位
                        if str(val.get('show_type') or '') == '2':
                            backup_variants.append(entry_obj)
                        else:
                            primary_variants.append(entry_obj)
                    elif isinstance(val, str) and val.strip():
                        primary_variants.append({
                            'res': str(res_key),
                            'param': val.strip() if '=' in val and not val.startswith('http') else '',
                            'url': val.strip() if val.startswith('http') else ''
                        })
            elif isinstance(play_field, list):
                for entry in play_field:
                    if isinstance(entry, dict):
                        res_key = str(
                            entry.get('resolution') or entry.get('res') or entry.get('name') or '1080'
                        )
                        param = str(entry.get('param') or '').strip()
                        direct_url = str(entry.get('url') or entry.get('vurl') or '').strip()
                        if param or direct_url:
                            primary_variants.append({
                                'res': res_key,
                                'param': param,
                                'url': direct_url
                            })

            play_variants = primary_variants if primary_variants else backup_variants

            if not play_variants:
                top_param = str(item.get('param') or '').strip()
                top_url = str(item.get('url') or item.get('vurl') or item.get('play_url') or '').strip()
                if top_param or top_url:
                    play_variants.append({
                        'res': str(item.get('resolution') or '1080'),
                        'param': top_param,
                        'url': top_url
                    })

            if not play_variants:
                continue

            raw_ep_name = str(
                item.get('title')
                or item.get('vurl_name')
                or item.get('name')
                or item.get('episode_name')
                or ''
            ).strip()
            if raw_ep_name and raw_ep_name not in ('0', 'null', 'None'):
                play_name = raw_ep_name.replace('$', ' ').replace('#', ' ')
            else:
                play_name = (
                    (default_vod_name or '正片')
                    if total_eps == 1
                    else f"第{index + 1}集"
                )

            extracted.append((play_name, play_variants))
        return extracted

    def _extract_candidate_clouds(self, qdata, vod_info):
        clouds = []
        seen = set()
        default_name_map = dict(self.DEFAULT_CLOUD_LINES)

        def _add_cloud(cid, cname=""):
            cid_str = str(cid or '').strip()
            if not cid_str or cid_str in seen:
                return
            seen.add(cid_str)
            clean_name = str(cname or '').strip()
            if not clean_name:
                clean_name = default_name_map.get(cid_str, f"瓜子线路{cid_str}")
            clouds.append((cid_str, clean_name))

        if isinstance(qdata, dict):
            for key in ('cloudList', 'cloud_list', 'vurl_cloud', 'playList', 'play_list'):
                arr = qdata.get(key)
                if isinstance(arr, list):
                    for c in arr:
                        if isinstance(c, dict):
                            cid = (
                                c.get('vurl_cloud_id')
                                or c.get('cloud_id')
                                or c.get('id')
                            )
                            cname = (
                                c.get('vurl_cloud_name')
                                or c.get('cloud_name')
                                or c.get('name')
                                or ''
                            )
                            _add_cloud(cid, cname)

        if isinstance(vod_info, dict):
            main_cid = vod_info.get('vurl_cloud_id')
            if main_cid:
                _add_cloud(main_cid, default_name_map.get(str(main_cid).strip(), "瓜子专线"))

        for fallback_cid, fallback_name in self.DEFAULT_CLOUD_LINES:
            _add_cloud(fallback_cid, fallback_name)

        return clouds

    def _mode_for_line_name(self, cname, cid):
        name = str(cname or '')
        if '极速' in name or '流畅' in name or str(cid) == '3':
            return 'fast'
        if '蓝光' in name or str(cid) == '1':
            return 'uhd'
        if '备线' in name or '超清' in name or str(cid) == '4':
            return 'hd'
        return 'auto'

    def detailContent(self, ids):
        try:
            if isinstance(ids, (list, tuple)):
                if not ids:
                    return {'list': []}
                raw_id = ids[0]
            else:
                raw_id = ids

            vod_id = self._extract_vod_id(raw_id)
            if not vod_id:
                return {'list': []}

            t = str(int(time.time()))
            body_info = {
                "token_id": self.token_id,
                "vod_id": vod_id,
                "mobile_time": t,
                "token": self.token
            }

            # 1. 请求影片详情与主云端线路 Vurl/show（注意：Vurl/show 自身也常返回 vodInfo）
            qdata = self.get_data(body_info, '/App/IndexPlay/playInfo')
            jdata_main = self.get_data({"vurl_cloud_id": "2", "vod_d_id": vod_id}, '/App/Resource/Vurl/show')

            vod = {}
            for src_obj in (qdata, jdata_main):
                if isinstance(src_obj, dict):
                    if isinstance(src_obj.get('vodInfo'), dict) and src_obj['vodInfo']:
                        vod = src_obj['vodInfo']
                        break
                    elif isinstance(src_obj.get('vod_info'), dict) and src_obj['vod_info']:
                        vod = src_obj['vod_info']
                        break
                    elif src_obj.get('vod_name') or src_obj.get('d_name'):
                        vod = src_obj
                        break

            cloud_responses = {"2": jdata_main}
            candidate_clouds = self._extract_candidate_clouds(qdata, vod)

            # 若 cloud_id="2" 无选集，或者 playInfo 显式声明了多条云端线路，依次探测备用云端线路
            main_eps = self._extract_raw_episode_items(jdata_main, "")
            has_any_eps = bool(main_eps)

            explicit_cids = set()
            if isinstance(qdata, dict):
                for k in ('cloudList', 'cloud_list', 'vurl_cloud'):
                    if isinstance(qdata.get(k), list):
                        for item_c in qdata[k]:
                            if isinstance(item_c, dict):
                                c_val = item_c.get('vurl_cloud_id') or item_c.get('cloud_id') or item_c.get('id')
                                if c_val:
                                    explicit_cids.add(str(c_val).strip())

            for cid, _ in candidate_clouds:
                if cid in cloud_responses:
                    continue
                if not has_any_eps or cid in explicit_cids:
                    cloud_responses[cid] = self.get_data(
                        {"vurl_cloud_id": cid, "vod_d_id": vod_id},
                        '/App/Resource/Vurl/show'
                    )
                    if not vod and isinstance(cloud_responses[cid], dict):
                        vod_cand = cloud_responses[cid].get('vodInfo') or cloud_responses[cid].get('vod_info')
                        if isinstance(vod_cand, dict) and vod_cand:
                            vod = vod_cand
                    if self._extract_raw_episode_items(cloud_responses[cid], ""):
                        has_any_eps = True

            if not vod and not has_any_eps:
                return {'list': []}

            vod_name = str(vod.get('vod_name') or vod.get('d_name') or f'影视 #{vod_id}').strip()
            raw_detail_pic = (
                self._extract_poster_field(vod)
                or self._extract_poster_field(qdata)
                or self._extract_poster_field(jdata_main)
            )
            pic = self._format_poster(raw_detail_pic)

            play_from_list = []
            play_url_groups = []
            first_valid_raw_eps = None
            first_valid_cid = "2"

            for cid, cname in candidate_clouds:
                jdata = cloud_responses.get(cid)
                raw_eps = self._extract_raw_episode_items(jdata, vod_name)
                if not raw_eps:
                    continue
                if first_valid_raw_eps is None:
                    first_valid_raw_eps = raw_eps
                    first_valid_cid = cid

                prefer_mode = self._mode_for_line_name(cname, cid)
                eps_encoded = [
                    f"{ep_name}${self._encode_episode_payload(variants, prefer_mode=prefer_mode, cloud_id=cid)}"
                    for ep_name, variants in raw_eps
                ]
                if eps_encoded:
                    line_label = cname if cname not in play_from_list else f"{cname}_{cid}"
                    play_from_list.append(line_label)
                    play_url_groups.append("#".join(eps_encoded))

            if not play_url_groups and isinstance(qdata, dict):
                raw_inline = self._extract_raw_episode_items(qdata, vod_name)
                if raw_inline:
                    first_valid_raw_eps = raw_inline
                    first_valid_cid = "0"
                    eps_inline = [
                        f"{ep_name}${self._encode_episode_payload(variants, prefer_mode='auto', cloud_id='0')}"
                        for ep_name, variants in raw_inline
                    ]
                    play_from_list.append("瓜子专线")
                    play_url_groups.append("#".join(eps_inline))

            # 派生『瓜子专线』『瓜子蓝光』『瓜子极速』多播放源 Tab 供详情页手动切换
            if first_valid_raw_eps:
                supplementary_tabs = [
                    ("瓜子专线", "auto"),
                    ("瓜子蓝光", "uhd"),
                    ("瓜子极速", "fast"),
                ]
                for tab_name, tab_mode in supplementary_tabs:
                    if tab_name not in play_from_list:
                        tab_eps = [
                            f"{ep_name}${self._encode_episode_payload(variants, prefer_mode=tab_mode, cloud_id=first_valid_cid)}"
                            for ep_name, variants in first_valid_raw_eps
                        ]
                        play_from_list.append(tab_name)
                        play_url_groups.append("#".join(tab_eps))

            video_detail = {
                "vod_id": str(vod_id),
                "vod_name": vod_name,
                "vod_pic": pic,
                "vod_bg": pic,
                "vod_background": pic,
                "vod_year": str(vod.get('vod_year') or vod.get('d_year') or ''),
                "vod_area": str(vod.get('vod_area') or vod.get('d_area') or ''),
                "vod_actor": str(vod.get('vod_actor') or vod.get('d_actor') or ''),
                "vod_director": str(vod.get('vod_director') or vod.get('d_director') or ''),
                "vod_remarks": self._format_remarks(vod),
                "vod_content": str(
                    vod.get('vod_use_content') or vod.get('vod_content') or vod.get('d_content') or ''
                ).strip(),
                "vod_play_from": "$$$".join(play_from_list) if play_from_list else "瓜子专线",
                "vod_play_url": "$$$".join(play_url_groups)
            }
            return {'list': [video_detail]}
        except Exception:
            return {'list': []}

    # ==================== 搜索与智能相关性排序优化 ====================

    def _score_search_item(self, item, keyword, orig_idx):
        title = str(
            item.get('vod_name') or item.get('d_name') or item.get('title') or item.get('name') or ''
        ).strip()
        title_l = title.lower()
        kw_l = keyword.lower()

        if title_l == kw_l:
            match_tier = 4
        elif title_l.startswith(kw_l):
            match_tier = 3
        elif kw_l in title_l:
            match_tier = 2
        else:
            tokens = [t for t in re.split(r'\s+', kw_l) if t]
            hit_count = sum(1 for t in tokens if t in title_l)
            match_tier = 1 if hit_count > 0 else 0

        try:
            year_val = int(re.findall(r'\d{4}', str(item.get('vod_year') or item.get('d_year') or '0'))[0])
        except Exception:
            year_val = 0

        try:
            score_val = float(item.get('vod_score') or item.get('vod_scroe') or item.get('d_score') or 0)
        except Exception:
            score_val = 0.0

        try:
            hits_val = float(item.get('vod_hits') or item.get('d_hits') or 0)
        except Exception:
            hits_val = 0.0

        len_penalty = -abs(len(title_l) - len(kw_l))
        return (match_tier, len_penalty, year_val, score_val, hits_val, -orig_idx)

    def searchContent(self, key, quick, pg=1):
        videos = []
        try:
            keyword = str(key or '').strip()
            if not keyword:
                return {'list': [], 'page': int(pg), 'pagecount': 1, 'limit': 30, 'total': 0}

            body = {
                "keywords": keyword,
                "ns": "",
                "nt": int(time.time()),
                "order_val": "1",
                "page": str(pg)
            }
            data = self.get_data(body, '/App/Index/findMoreVod', use_cache=True)

            raw_items = []
            seen_ids = set()
            if isinstance(data, dict) and isinstance(data.get('list'), list):
                for idx, item in enumerate(data['list']):
                    if not isinstance(item, dict):
                        continue
                    vid = self._extract_vod_id(item)
                    if not vid or vid in seen_ids:
                        continue
                    seen_ids.add(vid)
                    raw_items.append((idx, item))

            raw_items.sort(
                key=lambda pair: self._score_search_item(pair[1], keyword, pair[0]),
                reverse=True
            )

            for _, item in raw_items:
                card = self._build_vod_card(item)
                if card:
                    videos.append(card)
        except Exception:
            pass
        return {'list': videos, 'page': int(pg), 'pagecount': 9999, 'limit': 30, 'total': 999999}

    # ==================== 播放解析（对齐 CCTVHost playback 契约，零签名破坏） ====================

    def _parse_param_dict(self, param_str):
        params = {}
        raw = str(param_str or '').strip()
        if not raw:
            return params
        if raw.startswith('{') and raw.endswith('}'):
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    return {str(k): str(v) for k, v in obj.items()}
            except Exception:
                pass
        for pair in raw.split('&'):
            if '=' in pair:
                k, v = pair.split('=', 1)
                if k and k not in ('__proto__', 'prototype', 'constructor'):
                    params[k.strip()] = v.strip()
        return params

    def _clean_stream_url(self, raw_url):
        """
        关键修复：不再向带签名的流地址强行拼接 `&format=.m3u8`！
        正如 CCTVHost `host_media_runtime.py` 第 727~732 行注释所指出：
        向带签名的 URL 追加 `&format=.m3u8` 会破坏源站 CDN 签名导致 403 无法播放；
        正确做法是保持签名 URL 原样，并在返回字典中显式声明 `directMedia: True` 与 `format: 'hls'/'mp4'`。
        """
        play_url = str(raw_url or '').strip().replace('\\/', '/')
        if not play_url:
            return ""
        if play_url.startswith("//"):
            play_url = "https:" + play_url
        return play_url

    def _detect_media_format(self, play_url):
        low = str(play_url or '').lower()
        path_low = urllib.parse.urlsplit(low).path if low else ''
        if '.mp4' in path_low or '.m4v' in path_low or 'type=mp4' in low or 'ext=mp4' in low:
            return 'mp4', 'video/mp4'
        if '.flv' in path_low or 'type=flv' in low:
            return 'flv', 'video/x-flv'
        return 'hls', 'application/vnd.apple.mpegurl'

    def _ensure_play_referer(self):
        if self.play_referer_loaded:
            return self.play_referer
        self.play_referer_loaded = True
        try:
            uinfo = self.get_data({}, '/App/UserInfo/getUserInfo', use_cache=True)
            if isinstance(uinfo, dict):
                ref = str(uinfo.get('playRef') or '').strip()
                if ref.lower().startswith(('http://', 'https://')):
                    self.play_referer = ref
        except Exception:
            pass
        return self.play_referer

    def _build_play_response(self, raw_url, extra_data=None):
        clean_url = self._clean_stream_url(raw_url)
        if not clean_url:
            return {"parse": 0, "playUrl": "", "url": ""}
        media_fmt, mime_type = self._detect_media_format(clean_url)
        play_headers = {
            "User-Agent": "Lavf/57.83.100",
            "Referer": self.play_referer or "http://WJiZxLXA2.com/"
        }
        if isinstance(extra_data, dict):
            if isinstance(extra_data.get('header'), dict):
                play_headers.update(extra_data['header'])
            elif extra_data.get('referer'):
                play_headers['Referer'] = str(extra_data['referer'])
            if extra_data.get('ua') or extra_data.get('user_agent'):
                play_headers['User-Agent'] = str(extra_data.get('ua') or extra_data.get('user_agent'))
        return {
            "parse": 0,
            "jx": 0,
            "playUrl": "",
            "url": clean_url,
            "header": play_headers,
            "headers": play_headers,
            "format": media_fmt,
            "contentType": mime_type,
            "directMedia": True,
            "nativePlayable": True,
            "requiresWebPlayback": False
        }

    def _query_show_one(self, req_params):
        """
        请求 `/App/Resource/VurlDetail/showOne` 解析真实流地址：
        1. 先按 webox-guazi.js 标准方式传递原始 param + resolution；
        2. 若返回为空，自动按 catpaw 新版协议补齐 vod_id (由 vod_d_id 转换)、mobile_time、rand、type='play' 二次尝试。
        """
        data = self.get_data(req_params, '/App/Resource/VurlDetail/showOne', use_cache=False)
        if isinstance(data, dict) and (data.get('url') or data.get('play_url') or data.get('vurl')):
            return data

        enriched = dict(req_params)
        if 'vod_d_id' in enriched and 'vod_id' not in enriched:
            enriched['vod_id'] = enriched.pop('vod_d_id')
        enriched['_client_ts'] = str(int(time.time() * 1000000))
        enriched['mobile_time'] = str(int(time.time()))
        enriched['rand'] = str(random.randint(100000, 2147483647))
        enriched['type'] = 'play'
        return self.get_data(enriched, '/App/Resource/VurlDetail/showOne', use_cache=False)

    def playerContent(self, flag, id, vipFlags):
        try:
            raw_id = str(id or '').strip()
            if not raw_id:
                return {"parse": 0, "playUrl": "", "url": ""}

            if raw_id.startswith(('http://', 'https://')) and '||' not in raw_id:
                return self._build_play_response(raw_id)

            flag_str = str(flag or '').strip()
            flag_mode = self._mode_for_line_name(flag_str, "")

            parts = raw_id.split('||')
            candidate_requests = []

            if len(parts) >= 3 and parts[2]:
                try:
                    padded = parts[2] + '=' * (-len(parts[2]) % 4)
                    decoded = base64.urlsafe_b64decode(padded.encode('utf-8')).decode('utf-8')
                    payload_obj = json.loads(decoded)
                    if isinstance(payload_obj, dict):
                        variants = payload_obj.get('variants', [])
                        prefer_mode = payload_obj.get('mode') or flag_mode
                    elif isinstance(payload_obj, list):
                        variants = payload_obj
                        prefer_mode = flag_mode
                    else:
                        variants = []
                        prefer_mode = flag_mode

                    if isinstance(variants, list) and variants:
                        ordered = self._order_variants_by_mode(variants, prefer_mode=prefer_mode)
                        for v in ordered:
                            if not isinstance(v, dict):
                                continue
                            v_url = str(v.get('url') or '').strip()
                            v_param = str(v.get('param') or '').strip()
                            v_res = str(v.get('res') or '').strip()
                            if v_url.startswith(('http://', 'https://')):
                                candidate_requests.append({'direct_url': v_url})
                            if v_param:
                                p_dict = self._parse_param_dict(v_param)
                                if v_res:
                                    p_dict['resolution'] = v_res
                                candidate_requests.append({'params': p_dict})
                except Exception:
                    pass

            if not candidate_requests and len(parts) >= 1:
                param_str = parts[0]
                resolutions = parts[1].split('@') if len(parts) > 1 and parts[1] else []
                resolutions.sort(key=self._resolution_rank, reverse=(flag_mode != 'fast'))
                base_params = self._parse_param_dict(param_str)
                if resolutions:
                    for res in resolutions:
                        req_p = dict(base_params)
                        req_p['resolution'] = res
                        candidate_requests.append({'params': req_p})
                elif base_params:
                    candidate_requests.append({'params': base_params})

            for cand in candidate_requests:
                if 'direct_url' in cand and cand['direct_url']:
                    return self._build_play_response(cand['direct_url'])
                req_params = cand.get('params')
                if not req_params:
                    continue
                data = self._query_show_one(req_params)
                if isinstance(data, dict):
                    raw_play_url = (
                        data.get('url')
                        or data.get('play_url')
                        or data.get('vurl')
                        or ''
                    )
                    if raw_play_url and str(raw_play_url).strip().startswith(('http://', 'https://', '//')):
                        return self._build_play_response(raw_play_url, extra_data=data)

            return {"parse": 0, "playUrl": "", "url": ""}
        except Exception:
            return {"parse": 0, "playUrl": "", "url": ""}

    def isVideoFormat(self, url):
        if not url:
            return False
        u = str(url).lower()
        video_formats = ('.m3u8', '.mp4', '.avi', '.mkv', '.flv', '.ts')
        return any(fmt in u for fmt in video_formats)

    def manualVideoCheck(self):
        return False

    def localProxy(self, params):
        return None


def _run_selftest():
    spider = Spider.__new__(Spider)
    super(Spider, spider).__init__()
    spider.name = "瓜子"
    spider.hosts = ['https://api.anctjd.com', 'https://apinew.uozvr.com']
    spider.host_index = 0
    spider.host = spider.hosts[0]
    spider.host_scores = {h: 100 - idx for idx, h in enumerate(spider.hosts)}
    spider.AES_KEY = 'OITxa5OqAYjhswxx'
    spider.AES_IV = 'rCMNwZASNBKZ8mXV'
    spider.SIGN_SALT = '*&zvdvdvddbfikkkumtmdwqppp?|4Y!s!2br'
    spider.RSA_PUBLIC_KEY = (
        "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUM5+/y8sPsWkd1/RQS64X259E"
        "UwxFXFE5HlA65MqrxnPs0JqoSRojSDy5QhwvROlaD6TwRQHKMY2OAZ6SnQeUJsCh"
        "TEFIR9qUkwrs3/MVUMxjsv6JS6Oe/juclyJGTgVmDhB55EafXsD0SQYVj/QXXsxR"
        "6ewR5E2kL52yAAD4yQIDAQAB"
    )
    spider._rsa_pub_key = None
    spider._rsa_priv_key = None
    spider._lock = threading.RLock()
    spider.token = "test_token"
    spider.token_id = "1001"
    spider.token_updated_at = time.time()
    spider.token_ttl = 1800
    spider.play_referer = "http://WJiZxLXA2.com/"
    spider.play_referer_loaded = True
    spider.header = {'User-Agent': 'okhttp/3.12.0', 'Referer': spider.host}
    spider.cache = {}
    spider.cache_timeout = 300
    spider.cache_max_size = 320

    # 1. 验证海报直链绝不附加 @Referer=（防止触发 CCTVHost 127.0.0.1/artwork 代理 4 线程限流导致裂图）
    p1 = spider._format_poster(r"https:\/\/img.example.com\/upload\/vod\/海报 01.jpg@Referer=https://apinew.uozvr.com/")
    assert p1 == "https://img.example.com/upload/vod/%E6%B5%B7%E6%8A%A5%2001.jpg", f"海报不应包含 @Referer: {p1}"
    p2 = spider._format_poster("//img.example.com/upload/vod/cover.png")
    assert p2 == "https://img.example.com/upload/vod/cover.png", p2

    # 2. 验证 show_type == '2' 过滤与签名流地址原样保留（不追加 &format=.m3u8）
    mock_jdata = {
        "vodInfo": {"vod_name": "龙套千王", "vod_pic": "//img.example.com/ltqw.jpg"},
        "list": [
            {
                "title": "正片",
                "play": {
                    "1080": {"param": "vod_d_id=99&vurl_id=bad1080&resolution=1080", "show_type": "2"},
                    "720": {"param": "vod_d_id=99&vurl_id=good720&resolution=720", "show_type": "1"},
                    "360": {"param": "vod_d_id=99&vurl_id=good360&resolution=360", "show_type": "1"}
                }
            }
        ]
    }

    def _mock_get_data(params, path, use_cache=True):
        if path == '/App/IndexList/index':
            return {
                "list": [
                    {"list": [{"vod_id": "ad1", "vod_name": "轮播广告", "is_ad": 1}]},
                    {
                        "list": [
                            {"vod_id": "101", "vod_name": "龙套千王", "vod_pic": "//img.example.com/1.jpg", "new_continue": "高清"},
                            {"vod_id": "102", "vod_name": "六十岁，先了恩怨再...", "vod_pic": "//img.example.com/2.jpg", "vod_continu": 84},
                            {"vod_id": "103", "vod_name": "三十岁，你好", "vod_pic": "//img.example.com/3.jpg", "vod_continu": 30}
                        ]
                    }
                ]
            }
        if path == '/App/Resource/Vurl/show':
            return mock_jdata if str(params.get('vurl_cloud_id')) == '2' else None
        if path == '/App/IndexPlay/playInfo':
            return {"vodInfo": mock_jdata["vodInfo"]}
        if path == '/App/Resource/VurlDetail/showOne':
            if params.get('vurl_id') == 'good720':
                return {"url": "https://cdn.example.com/stream/signed_playlist?token=abc123"}
        return None

    spider.get_data = _mock_get_data
    home_res = spider.homeContent(True)
    assert len(home_res['list']) == 3
    assert all('@' not in item['vod_pic'] for item in home_res['list'])

    detail_res = spider.detailContent(["101"])
    ep_id = detail_res['list'][0]['vod_play_url'].split('$$$')[0].split('$', 1)[1]
    play_res = spider.playerContent("瓜子专线", ep_id, [])
    assert play_res['url'] == "https://cdn.example.com/stream/signed_playlist?token=abc123", "签名流地址不应被篡改"
    assert play_res['directMedia'] is True and play_res['nativePlayable'] is True
    print("SELFTEST_OK")


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        _run_selftest()
# --- System Signature ---
#‍​​‌‌​​​‌​​‌‌​​‌​​​‌‌​​​‌​​‌‌‌​​‌​​‌‌​‌​​​​‌‌​​‌‌​​‌‌​​‌​​​‌‌‌​​‌​​‌‌‌​​​​​‌‌​‌‌‌‍
