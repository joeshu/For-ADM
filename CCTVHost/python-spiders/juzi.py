import base64
import hashlib
import threading
import json
import secrets
import re
import string
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5, AES
    from Crypto.Util.Padding import pad
    _CRYPTO_OK = True
    _CRYPTO_ERR = ""
except Exception as _e:
    _CRYPTO_OK = False
    _CRYPTO_ERR = str(_e)

try:
    from base.spider import Spider as _Base
except Exception:
    class _Base(object):
        pass


PUB1_B64 = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr8SzZhjYy+rsya1K09t8d2K50pWFoBkgUqMpKOiW+3IEVKd4eTdvg9RSOjQ82kypL6R9BnsmrS1V8s4PVDwjQbUtYhTPPC9Hz16qY7rpD6m0d2vr09/UpWQ5uOy9PR0QTrsioveZ+DIe9jc3C+zBCu/kZSY/R8stwJoiitki3gwIDAQAB'
NATIVE_K = b'ed5fdsgucxumegqa'
SAFE = b'OC1A06E197EF10CF3F6058CA7A803B5E'
PW_SAFE = b'ZU1DSFFWNENKMDYXVUQRN0ZJDUC4PQ=='
CERT_MD5 = 'f9991e10a743a69d57d77fdd6b7aab42'
CERT_SHA1 = '9a43860b557dd835a2aee42774547bb62c3e3e54'
PKG = 'com.asjdhjhd.mgd.p3'
VC = '3070'
HOST = 'https://juziapp.hzhcbkj.cn'
UA = 'okhttp/3.12.1'

FALLBACK_CLASS = [
    {'type_id': '20', 'type_name': '电影'},
    {'type_id': '21', 'type_name': '剧集'},
    {'type_id': '22', 'type_name': '综艺'},
    {'type_id': '23', 'type_name': '动漫'},
    {'type_id': '24', 'type_name': '短剧'},
    {'type_id': '25', 'type_name': '直播'},
    {'type_id': '26', 'type_name': '漫剧'},
]
SKIP_TIDS = {'27'}

DEAD_PIC_HOSTS = ('pic.findjs.top',)
PIC_APIS = (
    'http://ffzy.tv/api.php/provide/vod/',
    'https://cj.lziapi.com/api.php/provide/vod/',
)
PLACEHOLDER = 'https://img.alicdn.com/tfs/TB1Z0mJmYP7gK4jSZFyXXb7apXa-200-300.png'

BRAND_ACTOR = '🦋 TG群: @tvshare23'
BRAND_DIRECTOR = '🦋 蝴蝶影视'
BRAND_NAME = '蝴蝶影视'


def _varint(n):
    b = b''
    while True:
        x = n & 0x7f
        n >>= 7
        if n:
            b += bytes([x | 0x80])
        else:
            return b + bytes([x])


def _f(num, wire, payload):
    t = _varint((num << 3) | wire)
    if wire == 2:
        return t + _varint(len(payload)) + payload
    return t + payload


def _pb(buf):
    out = []
    i = 0
    n = len(buf)
    while i < n:
        b = buf[i]
        fn, wt = b >> 3, b & 7
        i += 1
        if fn == 0:
            break
        if wt == 0:
            v = 0
            sh = 0
            while i < n:
                x = buf[i]
                i += 1
                v |= (x & 0x7f) << sh
                sh += 7
                if not x & 0x80:
                    break
            out.append((fn, wt, v))
        elif wt == 2:
            ln = 0
            sh = 0
            while i < n:
                x = buf[i]
                i += 1
                ln |= (x & 0x7f) << sh
                sh += 7
                if not x & 0x80:
                    break
            out.append((fn, wt, buf[i:i + ln]))
            i += ln
        elif wt == 5:
            out.append((fn, wt, buf[i:i + 4]))
            i += 4
        elif wt == 1:
            out.append((fn, wt, buf[i:i + 8]))
            i += 8
        else:
            out.append((fn, wt, None))
    return out


def _pick(fields, fn, wire=2, default=None):
    for f_, w_, v_ in fields:
        if f_ == fn and w_ == wire:
            return v_
    return default


def _text(b):
    if not isinstance(b, bytes):
        return ''
    return b.decode('utf-8', 'replace')


def _rnd(k):
    ch = string.ascii_letters + string.digits
    return ''.join(secrets.SystemRandom().sample(ch, k - 1)) + '='


_VIDEO_EXTENSIONS = (
    '.m3u8', '.mp4', '.m4v', '.flv', '.mkv', '.avi', '.ts', '.mov',
    '.mpd', '.m4a', '.wmv',
)


def _is_video_url(value):
    try:
        path = urllib.parse.urlsplit(str(value or '').strip()).path.lower()
        return path.endswith(_VIDEO_EXTENSIONS)
    except (TypeError, ValueError):
        return False


def _is_http_url(value):
    try:
        parsed = urllib.parse.urlsplit(str(value or '').strip())
        return parsed.scheme.lower() in ('http', 'https') and bool(parsed.hostname)
    except (TypeError, ValueError):
        return False


def _norm(s):
    return ''.join(c for c in str(s or '').lower() if c.isalnum())


def _img_from(b):
    cands = []
    try:
        for _f2, w2, v2 in _pb(b):
            if w2 == 2 and isinstance(v2, bytes) and v2.startswith(b'http'):
                cands.append(_text(v2))
    except Exception:
        pass
    if not cands:
        m = re.search(rb'https?://[\x21-\x7e]+', b or b'')
        if m:
            cands.append(_text(m.group(0)))
    if not cands:
        return ''
    https = [c for c in cands if c.startswith('https')]
    return (https or cands)[0]


class Spider(_Base):

    def __init__(self):
        try:
            super(Spider, self).__init__()
        except Exception:
            pass
        self._rsa1 = None
        self._rsa2 = None
        self._token = ''
        self._zone_ok = False
        self._zone_ts = 0
        self._udid = ''
        self._last_err = ''
        self._play_cache = {}
        self._pic_cache = {}
        self._pic_dead = set()
        self._pic_apis = list(PIC_APIS)
        self.brandActor = BRAND_ACTOR
        self.brandDirector = BRAND_DIRECTOR

    def getName(self):
        return BRAND_NAME

    def getDependence(self):
        return []

    def init(self, extend=''):
        self._last_err = ''
        try:
            if isinstance(extend, str) and extend.strip().startswith('{'):
                ext = json.loads(extend)
            elif isinstance(extend, dict):
                ext = extend
            else:
                ext = {}
        except Exception:
            ext = {}
        if ext.get('pic_api'):
            self._pic_apis = [ext['pic_api']] + list(PIC_APIS)
        if not _CRYPTO_OK:
            self._last_err = 'missing pycryptodome: %s' % _CRYPTO_ERR
            return
        self._udid = self._make_udid()
        try:
            self._rsa1 = PKCS1_v1_5.new(RSA.import_key(base64.b64decode(PUB1_B64)))
        except Exception as e:
            self._last_err = 'rsa pubkey fail: %s' % e
            return
        self._login()
        self._zone()

    def _make_udid(self):
        fn = getattr(self, 'getCache', None)
        if callable(fn):
            try:
                v = fn('jz_udid')
                if v:
                    return str(v)
            except Exception:
                pass
        u = secrets.token_hex(8).upper()
        st = getattr(self, 'setCache', None)
        if callable(st):
            try:
                st('jz_udid', u, 365 * 24 * 60 * 60)
            except TypeError:
                try:
                    st('jz_udid', u)
                except Exception:
                    pass
            except Exception:
                pass
        return u

    def _http(self, url, data=None, headers=None, timeout=12):
        hh = {'User-Agent': UA, 'Accept-Encoding': 'identity', 'Connection': 'keep-alive'}
        if headers:
            hh.update(headers)
        req = urllib.request.Request(url, data=data, headers=hh)
        import ssl
        ctx = ssl.create_default_context()
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                return r.getcode(), r.read()
        except urllib.error.HTTPError as e:
            return e.code, (e.read() or b'')
        except Exception as e:
            self._last_err = '%s: %s' % (type(e).__name__, e)
            return -1, b''

    def _login(self):
        try:
            body = json.dumps({'username': 'tv_%s' % self._udid[:10].lower(),
                               'password': hashlib.md5(('tv' + self._udid).encode()).hexdigest(),
                               'udid': self._udid}).encode()
            self._http(HOST + '/api/ex/v3/user/register', body,
                       {'Content-Type': 'application/json'}, timeout=8)
            code, raw = self._http(HOST + '/api/ex/v3/user/login', body,
                                   {'Content-Type': 'application/json'}, timeout=8)
            data = (json.loads(raw or b'{}').get('data') or {})
            self._token = (data.get('token') or (data.get('user') or {}).get('token') or '')
        except Exception:
            self._token = ''

    def _zone(self):
        if not self._rsa1:
            return False
        try:
            ts = int(time.time() * 1000)
            rnd = _rnd(16)
            sign = base64.b64encode(self._rsa1.encrypt((str(ts) + rnd).encode())).decode()
            body = (_f(1, 0, _varint(ts)) + _f(2, 2, sign.encode()) +
                    _f(3, 2, rnd.encode()) + _f(4, 2, rnd.encode()) + _f(5, 2, rnd.encode()))
            P = {'plat': 'android', 'vOs': '16', '_vOsCode': '36', 'vApp': VC,
                 'vName': '3.0.2.4', 'pkg': PKG, 'appName': '%E6%A9%98%E6%B1%81',
                 'udid': self._udid, 'uuid': self._udid, 'chid': '10000',
                 'androidID': self._udid, 'net': '1', 'young': 0, 'tenantId': '*',
                 'v': 1, 'device': 0, 'lang': 'zh', 'country': 'CN', 'cpu': 'arm64-v8a'}
            code, d = self._http(HOST + '/api/v5/find/app/zone', body, {
                'Content-Type': 'application/x-protobuf',
                'Accept': 'application/x-protobuf',
                'Cache-Control': 'no-cache',
                'publicParams': json.dumps(P, separators=(',', ':'))}, timeout=10)
            if code != 200 or not d:
                self._last_err = 'zone HTTP %s' % code
                return False
            top = _pb(d)
            inner = _pick(top, 3, 2)
            if not inner:
                self._last_err = 'zone no pubkey'
                return False
            strs = {fn: v for fn, wt, v in _pb(inner) if wt == 2}
            pem = b''.join(strs[k] for k in (2, 3, 4, 5) if k in strs)
            self._rsa2 = PKCS1_v1_5.new(RSA.import_key(base64.b64decode(pem)))
            self._zone_ok = True
            self._zone_ts = time.time()
            return True
        except Exception as e:
            self._zone_ok = False
            self._last_err = 'zone fail: %s' % e
            return False

    def _hdr(self):
        if not self._zone_ok or (time.time() - self._zone_ts > 1800):
            self._zone()
        ts = int(time.time() * 1000)
        rnd = _rnd(16)
        sig = ''
        if self._rsa2:
            try:
                sig = base64.b64encode(self._rsa2.encrypt((str(ts) + rnd + VC).encode())).decode()
            except Exception:
                sig = ''
        ao = base64.b64encode(AES.new(SAFE, AES.MODE_ECB).encrypt(
            pad((str(ts) + rnd).encode(), 16))).decode()
        J = {'country': 'CN', 'vName': '3.0.2.4', 'cpuId': '', 'young': 0,
             'facturer': 'OnePlus', 'pkg': PKG, 'uuid': self._udid,
             'resolution': '1080x2256', 'mac': '02%3A00%3A00%3A00%3A00%3A00',
             'sig': sig, 'abid': '7470', 'model': 'PJX110', 'plat': 'android',
             'udid': self._udid, 'dpi': '480', 'net': '1', 'lang': 'zh',
             'random_str': rnd, 'brand': 'OnePlus', 'timestamp': ts,
             'density': '3.0', 'appName': '%E6%A9%98%E6%B1%81',
             'cpu': 'arm64-v8a', 'chid': '10000', 'carrier': '%E8%81%94%E9%80%9A',
             'sig2': ao[:8], 'sig3': ao[8:], 'v': 1, 'tenantId': '*',
             '_vOsCode': '36', 'vOs': '16', 'vApp': VC, 'device': 0,
             'androidID': self._udid}
        blob = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode()
        pd_hex = AES.new(NATIVE_K, AES.MODE_CBC, NATIVE_K).encrypt(pad(blob, 16)).hex()
        h = {'User-Agent': UA, 'Accept': 'application/json', 'Cache-Control': 'no-cache',
             'publicParams': json.dumps({'paramsData': pd_hex}, separators=(',', ':'))}
        if self._token:
            h['token'] = self._token
        return h

    def _secure(self, mapkv):
        ts = int(time.time() * 1000)
        rnd8 = _rnd(8)
        plain = (mapkv + str(ts)).encode()
        ct = AES.new(PW_SAFE, AES.MODE_ECB).encrypt(pad(plain, 16))
        b64 = base64.b64encode(ct).decode()
        return (_f(1, 2, (rnd8 + b64[:12]).encode()) +
                _f(2, 2, b64[12:].encode()) +
                _f(3, 2, _rnd(20).encode()) +
                _f(4, 0, _varint(ts)) +
                _f(5, 2, rnd8.encode()))

    def _post(self, path, qs, retry=3, timeout=12):
        last = (0, b'', '')
        for _ in range(retry + 1):
            hh = self._hdr()
            hh['Content-Type'] = 'application/x-protobuf'
            hh['Accept'] = 'application/x-protobuf'
            code, d = self._http(HOST + path, self._secure(qs), hh, timeout=timeout)
            if code != 200 or not d:
                last = (code, b'', 'HTTP %s' % code)
                time.sleep(0.3)
                continue
            top = _pb(d)
            c = _pick(top, 1, 0, 0)
            msg = _text(_pick(top, 2, 2, b''))
            if c == 200:
                return c, _pick(top, 3, 2, b''), ''
            last = (c, b'', msg)
            if c in (100010, 401, 403, 100001, 100002):
                self._zone_ok = False
                self._zone()
                continue
            break
        return last

    def _format_remarks(self, brand=BRAND_NAME, meta=''):
        clean = re.sub(r'[\r\n\t]+', ' ', str(meta or '')).strip()
        if clean:
            return '%s | %s' % (brand, clean)
        return brand

    def _lookup_pic(self, name):
        key = _norm(name)
        if not key:
            return ''
        for api in self._pic_apis:
            if api in self._pic_dead:
                continue
            try:
                u = api + '?ac=detail&wd=' + urllib.parse.quote(name)
                code, raw = self._http(u, timeout=8)
                if code != 200 or not raw:
                    self._pic_dead.add(api)
                    continue
                lst = json.loads(raw.decode('utf-8', 'replace')).get('list') or []
                for it in lst:
                    if _norm(it.get('vod_name')) == key and it.get('vod_pic'):
                        return str(it['vod_pic']).strip()
                for it in lst:
                    if key and key in _norm(it.get('vod_name')) and it.get('vod_pic'):
                        return str(it['vod_pic']).strip()
            except Exception:
                self._pic_dead.add(api)
                continue
        return ''

    def _fill_covers(self, items):
        need = {}
        for it in items:
            pic = (it.get('vod_pic') or '').strip()
            host = urllib.parse.urlparse(pic).netloc.lower()
            if pic.startswith('http') and host not in DEAD_PIC_HOSTS:
                continue
            nm = it.get('vod_name') or ''
            if nm in self._pic_cache:
                it['vod_pic'] = self._pic_cache[nm]
                continue
            need.setdefault(nm, []).append(it)
        if not need:
            return
        result = {}

        def _work(nm):
            result[nm] = self._lookup_pic(nm) or PLACEHOLDER

        names = list(need)
        while names:
            batch, names = names[:4], names[4:]
            ths = []
            for nm in batch:
                t = threading.Thread(target=_work, args=(nm,))
                t.daemon = True
                ths.append(t)
                t.start()
            for t in ths:
                t.join(timeout=15)
        for nm, its in need.items():
            u = result.get(nm) or PLACEHOLDER
            self._pic_cache[nm] = u
            for it in its:
                it['vod_pic'] = u

    def _cover(self, name, pic):
        pic = (pic or '').strip()
        host = urllib.parse.urlparse(pic).netloc.lower()
        if pic.startswith('http') and host not in DEAD_PIC_HOSTS:
            return pic
        if name in self._pic_cache:
            return self._pic_cache[name]
        got = self._lookup_pic(name)
        if not got:
            got = PLACEHOLDER
        self._pic_cache[name] = got
        return got

    def _list(self, qs):
        code, data, msg = self._post('/api/proto/v5/drama/category', qs)
        if code != 200 or not data:
            self._last_err = 'list code=%s msg=%s' % (code, msg or self._last_err)
            return []
        out = []
        for fn, wt, v in _pb(data):
            if fn != 1 or wt != 2:
                continue
            item = {'vod_id': '', 'vod_name': '', 'vod_pic': '', 'vod_remarks': '',
                    'vod_content': '', 'vod_area': ''}
            for f2, w2, v2 in _pb(v):
                if f2 == 3 and w2 == 0:
                    item['vod_id'] = str(v2)
                elif f2 == 5 and w2 == 2:
                    item['vod_name'] = _text(v2)
                elif f2 == 2 and w2 == 2:
                    item['vod_pic'] = _img_from(v2)
                elif f2 == 13 and w2 == 2:
                    item['vod_remarks'] = _text(v2)
                elif f2 == 4 and w2 == 2:
                    item['vod_content'] = re.sub(r'<[^>]+>', '', _text(v2))[:300]
                elif f2 == 1 and w2 == 2:
                    item['vod_area'] = _text(v2)
            if item['vod_id'] and item['vod_name']:
                item['vod_remarks'] = self._format_remarks(BRAND_NAME, item['vod_remarks'])
                out.append(item)
        self._fill_covers(out)
        return out

    def homeContent(self, filter):
        cats = []
        code, raw = self._http(HOST + '/api/v3/drama/getCategory?orderBy=type_id', None,
                               {'Accept': 'application/json'}, timeout=10)
        if code == 200 and raw:
            try:
                for c in (json.loads(raw).get('data') or []):
                    tid = str(c.get('id'))
                    if tid in SKIP_TIDS:
                        continue
                    cats.append({'type_id': tid, 'type_name': c.get('name', '')})
            except Exception:
                cats = []
        if not cats:
            cats = list(FALLBACK_CLASS)
        cats.append({'type_id': 'history', 'type_name': '最近在看'})
        return {'class': cats, 'filters': {}}

    def homeVideoContent(self):
        return {'list': self._list('page=1&pagesize=24')}

    def categoryContent(self, tid, pg, filter, extend):
        tid = str(tid)
        try:
            page = int(pg or 1)
        except Exception:
            page = 1
        if tid == 'history':
            lst = self._history_list()
            return {'list': lst, 'page': 1, 'pagecount': 1, 'limit': len(lst), 'total': len(lst)}
        lst = self._list('page=%d&pagesize=24&typeId1=%s' % (page, tid))
        if not lst:
            card = {
                'vod_id': 'diag',
                'vod_name': '⚠️ 橘汁列表为空',
                'vod_pic': PLACEHOLDER,
                'vod_remarks': self._format_remarks(BRAND_NAME, '点我重试'),
                'vod_content': '[诊断] tid=%s pg=%s %s' % (tid, page, self._last_err or '未知'),
                'vod_tag': 'folder',
            }
            return {'list': [card], 'page': 1, 'pagecount': 1, 'limit': 1, 'total': 1}
        return {'list': lst, 'page': page,
                'pagecount': 999 if len(lst) >= 24 else page,
                'limit': 24, 'total': 99999 if len(lst) >= 24 else len(lst)}

    def _history_list(self):
        out = []
        try:
            code, raw = self._http(HOST + '/api/ex/v3/user/history?username=tv_%s'
                                   % self._udid[:10].lower(), None,
                                   {'Accept': 'application/json'}, timeout=10)
            for it in (json.loads(raw or b'{}').get('data') or []):
                vid = it.get('videoId', '')
                if '|' not in vid:
                    continue
                frm, url = vid.split('|', 1)
                out.append({'vod_id': 'h$%s$%s' % (frm, url),
                            'vod_name': it.get('videoName', ''),
                            'vod_pic': self._cover(it.get('videoName', ''), it.get('videoCover', '')),
                            'vod_remarks': self._format_remarks(
                                BRAND_NAME, '%s·第%s集' % (frm, it.get('videoPart', '')))})
        except Exception:
            pass
        return out

    def detailContent(self, ids):
        if not isinstance(ids, (list, tuple)):
            ids = [ids]
        if not ids:
            return {'list': []}
        return {'list': [self._detail(str(i)) for i in ids]}

    def _detail(self, vid):
        if vid.startswith('h$'):
            _, frm, url = vid.split('$', 2)
            return {'vod_id': vid, 'vod_name': '继续观看', 'vod_pic': PLACEHOLDER,
                    'vod_play_from': frm, 'vod_play_url': '正片$%s' % url,
                    'vod_actor': self.brandActor, 'vod_director': self.brandDirector,
                    'vod_remarks': self._format_remarks(BRAND_NAME, frm),
                    'vod_content': '播放历史·线路:' + frm}
        out = {'vod_id': vid, 'vod_name': vid, 'vod_pic': '', 'vod_content': '',
               'vod_area': '', 'vod_actor': self.brandActor,
               'vod_director': self.brandDirector, 'vod_remarks': ''}
        try:
            code, data, msg = self._post('/api/proto/v5/drama/getDetail', 'id=' + vid, timeout=15)
            if code != 200 or not data:
                out['vod_content'] = '[诊断] 详情失败 code=%s msg=%s' % (code, msg or self._last_err)
                out['vod_pic'] = PLACEHOLDER
                out['vod_play_from'] = '橘汁'
                out['vod_play_url'] = '暂无片源$diag'
                return out
            fields = _pb(data)
            name = _pick(fields, 9, 2)
            if name:
                out['vod_name'] = _text(name)
            pic = _pick(fields, 2, 2)
            if pic:
                out['vod_pic'] = _img_from(pic)
            area = _pick(fields, 1, 2)
            if area:
                out['vod_area'] = _text(area)
            director = _text(_pick(fields, 12, 2, b''))
            content = _pick(fields, 6, 2) or _pick(fields, 7, 2)
            body = re.sub(r'&nbsp;|&amp;', ' ', re.sub(r'<[^>]+>', '', _text(content)))[:600] if content else ''
            body = re.sub(r'[ \t]{2,}', ' ', body).strip()
            mingxi = []
            if director:
                mingxi.append('导演: %s' % director)
            if out['vod_area']:
                mingxi.append('地区: %s' % out['vod_area'])
            out['vod_content'] = ('\n'.join(mingxi) + '\n' + body).strip() if mingxi else body
            lines, lmap = self._episodes(data, vid)
            self._play_cache[vid] = (lines, lmap)
            while len(self._play_cache) > 3:
                self._play_cache.pop(next(iter(self._play_cache)))
            if lines:
                out['vod_play_from'] = '$$$'.join(lines)
                out['vod_play_url'] = '$$$'.join('#'.join(lmap[k]) for k in lines)
                out['vod_remarks'] = self._format_remarks(
                    BRAND_NAME, '%d线·%d集' % (len(lines), len(lmap[lines[0]])))
            else:
                out['vod_play_from'] = '橘汁'
                out['vod_play_url'] = '暂无片源$diag'
                out['vod_content'] += '\n[诊断] 未解析到分集 code=%s' % code
        except Exception as e:
            out['vod_content'] = '[诊断] 详情异常 %s: %s' % (type(e).__name__, e)
            out['vod_play_from'] = '橘汁'
            out['vod_play_url'] = '暂无片源$diag'
        if not out['vod_pic']:
            out['vod_pic'] = self._cover(out['vod_name'], '')
        return out

    def _episodes(self, data, vid=''):
        eps = []
        pos = 0
        n = len(data)
        while True:
            j = data.find(b'\xea\x01', pos)
            if j < 0:
                break
            k = j + 2
            ln = 0
            sh = 0
            while k < n and data[k] & 0x80:
                ln |= (data[k] & 0x7f) << sh
                sh += 7
                k += 1
            if k >= n:
                break
            ln |= (data[k] & 0x7f) << sh
            k += 1
            if ln <= 0 or k + ln > n:
                pos = j + 1
                continue
            entry = data[k:k + ln]
            pos = k + ln
            title = pth = src = src_cn = ''
            for f3, w3, v3 in _pb(entry):
                if w3 != 2:
                    continue
                if f3 in (2, 3):
                    title = _text(v3)
                elif f3 == 4:
                    pth = _text(v3)
                elif f3 == 9:
                    src = _text(v3)
                elif f3 == 10:
                    src_cn = _text(v3)
            if not pth:
                continue
            mm = re.match(r'^第?0*(\d{1,4})[集话期](?:完结)?$', title)
            if mm:
                title = mm.group(1)
            eps.append((title or '正片', pth, src, src_cn))

        lines = {}
        order = []
        for title, pth, src, src_cn in eps:
            line = src_cn or src or '正片'
            if line not in lines:
                lines[line] = []
                order.append(line)
            if _is_video_url(pth):
                ep_url = pth
            else:
                ep_url = base64.b64encode(json.dumps(
                    {'vodPlayFrom': src, 'playUrl': pth, 'vid': vid},
                    separators=(',', ':')).encode()).decode()
            lines[line].append('%s$%s' % (title, ep_url))

        def _rank(nm):
            # Prefer the broadly compatible HD/1080p lines. 4K sources often
            # need more bandwidth and may expose codecs the native player lacks.
            label = str(nm or '').lower()
            if ('4k' in label or '8k' in label or '2160' in label or
                    '4320' in label or '超高清' in label):
                return 2
            if ('1080' in label or '720' in label or '蓝光' in label or '高清' in label):
                return 0
            return 1
        order.sort(key=_rank)
        return order, lines

    def playerContent(self, flag, id, vipFlags=None):
        pid = str(id or '').strip()
        hdr = {'User-Agent': UA, 'Referer': HOST + '/'}
        if _is_http_url(pid):
            return {'parse': 0, 'playUrl': '', 'url': pid, 'header': hdr}
        if pid.startswith('h$'):
            _, frm, url = pid.split('$', 2)
            return {'parse': 0, 'playUrl': '', 'url': url, 'header': hdr}
        if not pid or pid == 'diag':
            return {'parse': 0, 'playUrl': '', 'url': '', 'header': hdr}

        pf = pu = vid = ''
        try:
            jm = json.loads(base64.b64decode(pid))
            pf, pu, vid = jm.get('vodPlayFrom', ''), jm.get('playUrl', ''), str(jm.get('vid', ''))
        except Exception:
            return {'parse': 0, 'playUrl': '', 'url': '', 'header': hdr}

        u = self._resolve(pf, pu)
        if u:
            return {'parse': 0, 'playUrl': '', 'url': u,
                    'header': dict(hdr, Referer=HOST + '/')}

        alt = self._resolve_siblings(vid, pu)
        if alt:
            return {'parse': 0, 'playUrl': '', 'url': alt,
                    'header': dict(hdr, Referer=HOST + '/')}

        if _is_http_url(pu):
            return {'parse': 1, 'playUrl': '', 'url': pu, 'header': hdr}
        return {'parse': 0, 'playUrl': '', 'url': '', 'header': hdr}

    def _resolve(self, pf, pu):
        if not pu:
            return ''
        qs = 'vodPlayFrom=%s&playUrl=%s' % (urllib.parse.quote(pf),
                                            urllib.parse.quote(pu, safe=''))
        for attempt in range(2):
            code, data, msg = self._post('/api/proto/v5/videoUsableUrl', qs, retry=0, timeout=15)
            if code == 200 and data:
                m = re.search(rb'https?://[\x21-\x7e]+', data)
                if m:
                    candidate = m.group(0).decode('utf-8', 'replace')
                    if _is_http_url(candidate):
                        return candidate
                tok = _text(data[2:]).strip().lstrip('\n') if len(data) > 2 else ''
                if attempt == 0 and tok and '://' not in tok and '=' not in tok[:2]:
                    qs = 'vodPlayFrom=%s&playUrl=%s' % (
                        urllib.parse.quote(pf), urllib.parse.quote(tok, safe=''))
                    continue
            if attempt == 0:
                self._zone_ok = False
                self._zone()
            time.sleep(0.2)
        return ''

    def _resolve_siblings(self, vid, pu):
        cache = self._play_cache.get(vid)
        if not cache:
            return ''
        lines, lmap = cache

        def _pl(entry):
            try:
                return json.loads(base64.b64decode(entry.split('$', 1)[-1])).get('playUrl', '')
            except Exception:
                return None

        idx = 0
        for ln in lines:
            hit = False
            for i, entry in enumerate(lmap.get(ln) or []):
                if _pl(entry) == pu:
                    idx, hit = i, True
                    break
            if hit:
                break
        tried = 0
        for ln in lines:
            eps = lmap.get(ln) or []
            if not eps or tried >= 2:
                continue
            entry = eps[idx] if idx < len(eps) else eps[0]
            try:
                jm = json.loads(base64.b64decode(entry.split('$', 1)[-1]))
            except Exception:
                continue
            if jm.get('playUrl') == pu:
                continue
            tried += 1
            u = self._resolve(jm.get('vodPlayFrom', ''), jm.get('playUrl', ''))
            if u:
                return u
        return ''

    def searchContent(self, key, quick=False, pg='1'):
        try:
            page = int(pg or 1)
        except Exception:
            page = 1
        qs = 'page=%d&pagesize=24&searchKeys=%s' % (page, key)
        code, data, msg = self._post('/api/proto/v5/drama/search', qs)
        out = []
        if code == 200 and data:
            for fn, wt, v in _pb(data):
                if fn != 1 or wt != 2:
                    continue
                item = {'vod_id': '', 'vod_name': '', 'vod_pic': '', 'vod_remarks': '',
                        'vod_content': ''}
                for f3, w3, v3 in _pb(v):
                    if f3 == 3 and w3 == 0:
                        item['vod_id'] = str(v3)
                    elif f3 == 5 and w3 == 2:
                        item['vod_name'] = _text(v3)
                    elif f3 == 2 and w3 == 2:
                        item['vod_pic'] = _img_from(v3)
                    elif f3 == 13 and w3 == 2:
                        item['vod_remarks'] = _text(v3)
                    elif f3 == 4 and w3 == 2:
                        item['vod_content'] = re.sub(r'<[^>]+>', '', _text(v3))[:150]
                if item['vod_id'] and item['vod_name']:
                    item['vod_remarks'] = self._format_remarks(BRAND_NAME, item['vod_remarks'])
                    out.append(item)
            self._fill_covers(out)
        return {'list': out, 'page': page,
                'pagecount': 999 if len(out) >= 24 else page,
                'limit': 24, 'total': 99999 if len(out) >= 24 else len(out)}

    def isVideoFormat(self, url):
        try:
            return _is_video_url(url)
        except Exception:
            return False

    def isTextFormat(self, url):
        return False

    def manualVideoCheck(self):
        return False

    def action(self, action):
        return {'msg': 'ok'}

    def liveContent(self, url=''):
        return ''

    def destroy(self):
        self._token = ''
        self._rsa2 = None


if __name__ == '__main__':
    import sys
    import ssl

    def _hr(t):
        print('\n' + '=' * 60 + '\n' + t + '\n' + '=' * 60)

    s = Spider()
    _hr('init')
    t0 = time.time()
    s.init('')
    print('%.2fs token=%s zone=%s err=%s' % (time.time() - t0, 'OK' if s._token else '-',
                                             'OK' if s._zone_ok else '-', s._last_err or '-'))
    if not _CRYPTO_OK:
        print('need pycryptodome')
        sys.exit(1)

    _hr('class')
    cls = s.homeContent(False)['class']
    print('%d 个: %s' % (len(cls), ' / '.join('%s(%s)' % (c['type_name'], c['type_id']) for c in cls)))

    _hr('category')
    for tid, nm in (('20', '电影'), ('21', '剧集'), ('24', '短剧')):
        t = time.time()
        l = s.categoryContent(tid, 1, False, {})['list']
        print('%-4s %-3s %2d 条 %.2fs 首条 %s | %s' % (tid, nm, len(l), time.time() - t,
                                                  l[0]['vod_name'] if l else '-',
                                                  l[0]['vod_remarks'] if l else '-'))

    _hr('cover')
    hit = []
    for pg in (1, 2):
        for it in s.categoryContent('20', pg, False, {})['list']:
            if it['vod_name'] in ('给阿嬷的情书', '功夫女足'):
                hit.append(it)
    for it in hit:
        print('%s -> %s' % (it['vod_name'], it['vod_pic']))
        try:
            ctx = ssl.create_default_context()
            rq = urllib.request.Request(it['vod_pic'], headers={'User-Agent': UA})
            with urllib.request.urlopen(rq, timeout=10, context=ctx) as r:
                b = r.read(16)
            print('   HTTP %s %s %r' % (r.getcode(), (r.headers.get('Content-Type') or '')[:30], b[:6]))
        except Exception as e:
            print('   FAIL %s' % e)

    _hr('detail')
    cast = [x['vod_id'] for x in s.categoryContent('20', 1, False, {})['list'][:2]]
    ds = s.detailContent(cast)['list']
    print('批量 %d 保序 %s' % (len(ds), [d['vod_id'] for d in ds] == cast))
    d = ds[0]
    print('%s | %s | %s' % (d['vod_name'], d['vod_actor'], d['vod_director']))
    print('remarks: %s' % d['vod_remarks'])
    print('content: %s' % d['vod_content'].replace('\n', ' / ')[:110])
    froms = d['vod_play_from'].split('$$$')
    urls = d['vod_play_url'].split('$$$')
    print('线路 %d 条: %s' % (len(froms), ' '.join('%s(%d)' % (f, len(u.split('#')))
                                                for f, u in zip(froms, urls))))

    _hr('play')
    k4 = [i for i, f in enumerate(froms) if '4K' in f]
    for i in (k4[:1] + [0]):
        f = froms[i]
        val = urls[i].split('#')[0].split('$', 1)[-1]
        t = time.time()
        pc = s.playerContent(f, val, [])
        u = pc.get('url', '')
        print('%-14s %.2fs %s' % (f, time.time() - t, u[:95] or '(empty)'))
        if u.startswith('http'):
            try:
                ctx = ssl.create_default_context()
                rq = urllib.request.Request(u, headers={'User-Agent': UA})
                with urllib.request.urlopen(rq, timeout=12, context=ctx) as r:
                    b = r.read(200)
                print('   HTTP %s %s %s' % (r.getcode(), (r.headers.get('Content-Type') or '')[:24],
                                            'm3u8' if b[:7] == b'#EXTM3U' else 'mp4' if b[4:8] == b'ftyp' else '?'))
            except Exception as e:
                print('   FAIL %s' % e)

    _hr('search')
    for kw in ('给阿嬷', '功夫女足'):
        t = time.time()
        r = s.searchContent(kw, False, '1')
        print('搜「%s」%d 条 %.2fs 首条 %s %s' % (kw, len(r['list']), time.time() - t,
                                             r['list'][0]['vod_name'] if r['list'] else '-',
                                             (r['list'][0]['vod_pic'][:60] if r['list'] else '')))
    print('\ndone')
