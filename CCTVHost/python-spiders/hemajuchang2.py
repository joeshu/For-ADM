# -*- coding: utf-8 -*-
"""河马剧场游客实验版 · CCTVHost Python Spider。

默认通过 1103 初始化本地游客设备，不发送 sign / alg，不包含旧抓包会话。
此模式只基于 2026-11-03 当前网关行为，不代表已还原 iOS 签名算法。
游客会话保存到同目录 hm_guest_session.json；调用失败不会自动批量重建游客。
仍可通过 hm_app_creds.json 或 init.creds 切换到自有完整四头配置。
"""
import json
import html as html_lib
import sys
import tempfile
import threading
import urllib.error
import os
import re
import ssl
import time
import urllib.parse
import urllib.request
import uuid

try:
    from base.spider import Spider as BaseSpider
except ImportError:
    class BaseSpider(object):
        def init(self, extend=""):
            pass


SITE = "https://www.kuaikaw.cn"
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")
UA_VIDEO = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 Mobile/15E148")

APP_BASE = "https://h3scapi.kydco.cn/api/free-video-ios/portal/"

# 分类（站点 /browse/<id>/<page>；多 id 用 - 连接）
CATS = [
    ("462", "甜宠"),
    ("1102", "古装仙侠"),
    ("1145", "现代言情"),
    ("1170", "青春"),
    ("585", "豪门恩怨"),
    ("417-464", "逆袭"),
    ("439-465", "重生"),
    ("1159", "系统"),
    ("1147", "总裁"),
    ("943", "职场商战"),
]

_ND_RE = re.compile(r"<script\b(?=[^>]*\bid\s*=\s*['\"]__NEXT_DATA__['\"])[^>]*>(.*?)</script\s*>", re.S | re.I)
_SSL = ssl.create_default_context()

# 固定协议头不是已恢复的签名密钥；当前网关要求该字段。
WETRUWTTY = "mhdfiheowjfcslkjfwojo636"
_GUEST_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hm_guest_session.json")
_GUEST_SESSION = None
_GUEST_BOOTSTRAP_ATTEMPTED = False

# 1131 目录模板（取值必须与 App 一致，否则服务端返回空目录）
TPL_1131 = {
    "screenClearType": 3, "supportInterstitialAd": 1, "playSourceL1": "独立场景",
    "isNeedAlias": 0, "excludeInfo": 0, "preview": 1, "bottomStyle": 2,
    "playSourceL2": "独立场景-详情页", "btAdAward": 1, "interacPop": 0,
    "needNextChapter": 0, "resolutionRate": "720P", "bookAlias": "",
    "chapterId": "", "bookId": "", "playSourceL3": "独立场景-详情页",
    "commentType": 2, "drawType": 1, "topComments": 0,
}

# 1139 取址模板
TPL_1139 = {
    "topComments": 0,
    "tierPlaySource": {
        "firstTierPlaySource": "独立场景",
        "thirdTierPlaySource": "独立场景-详情页",
        "secondTierPlaySource": "独立场景-详情页",
    },
    "resolutionRate": "720P", "chapterId": "", "playPercentage": 0,
    "bookId": "", "continuousAd": 0, "commentType": 2, "chapterIds": [],
    "unClockType": "load", "preview": 1,
}

_OVERRIDE_CREDS = None
_HAS_OVERRIDE_CREDS = False
_LAST_ERROR = ""
_LOCK = threading.RLock()
_DETAIL_TTL = 10 * 60 * 1000


def _now_ms():
    return int(time.time() * 1000)


def _timestamp_ms(value):
    try:
        value = float(value)
        return value * 1000 if value < 1e12 else value
    except (TypeError, ValueError):
        return 0


def _safe_message(message):
    # Do not include signed URLs or authentication material in logs/player messages.
    message = re.sub(r"https?://[^\s\"'<>]+", "[URL]", str(message))
    message = re.sub(r"(?i)(datas|sign|wetruwtty)\s*[:=]\s*[^,;\s]+", r"\1=[redacted]", message)
    return re.sub(r"[\r\n]+", " ", message)[:160]


def _error(message):
    global _LAST_ERROR
    _LAST_ERROR = _safe_message(message)
    print("[hmjc] " + _LAST_ERROR, file=sys.stderr, flush=True)


def _complete_creds(value):
    if not isinstance(value, dict):
        return None
    keys = ("datas", "sign", "alg", "wetruwtty")
    if not all(isinstance(value.get(k), str) and value[k].strip() and
               "\r" not in value[k] and "\n" not in value[k] for k in keys):
        return None
    # 自有已签名配置保持原文，避免未来启用验签时改变输入字节。
    return {k: value[k] for k in keys}


def _guest_datas(session):
    """每次构建当前时间与 nonce；不引用任何旧抓包字段。"""
    return {
        "pname": "com.cbn.hmjc", "channelCode": "HMJC_IOS", "mchid": "HMJC_IOS",
        "utdidTmp": session["utdidTmp"], "os": "ios", "version": "3.14.0", "p": "67",
        "timestamp": str(_now_ms()), "nonce": str(uuid.uuid4()).upper(),
        "userId": session.get("userId", ""),
    }


def _guest_headers(session):
    return {"datas": json.dumps(_guest_datas(session), separators=(",", ":")),
            "wetruwtty": WETRUWTTY}


def _valid_guest(value):
    return (isinstance(value, dict) and isinstance(value.get("utdidTmp"), str) and
            bool(value["utdidTmp"].strip()) and str(value.get("userId", "")).isdigit() and
            int(value["userId"]) > 0)


def _ensure_guest():
    """至多初始化一次；持久会话优先，业务失败不会触发新游客创建。"""
    global _GUEST_SESSION, _GUEST_BOOTSTRAP_ATTEMPTED
    with _LOCK:
        if _valid_guest(_GUEST_SESSION):
            return _GUEST_SESSION
        saved = _read_cache(_GUEST_FILE)
        if _valid_guest(saved):
            _GUEST_SESSION = {"utdidTmp": saved["utdidTmp"], "userId": str(saved["userId"]),
                              "t": saved.get("t", 0)}
            return _GUEST_SESSION
        if _GUEST_BOOTSTRAP_ATTEMPTED:
            _error("游客初始化尚未成功；本次进程不会自动重复创建，请检查网关或自有凭据")
            return None
        _GUEST_BOOTSTRAP_ATTEMPTED = True
        session = {"utdidTmp": "I" + uuid.uuid4().hex, "userId": ""}
        result = _send_app("1103", {}, _guest_headers(session))
        if not result:
            return None
        data = _as_dict(result.get("data"))
        top_info = _as_dict(result.get("userInfoVo"))
        nested_info = _as_dict(data.get("userInfoVo"))
        uid = top_info.get("userId") or nested_info.get("userId") or result.get("userId") or data.get("userId")
        if not str(uid or "").isdigit() or int(uid) <= 0:
            _error("1103 未返回有效游客用户 ID；停止后续游客请求")
            return None
        session.update(userId=str(uid), t=_now_ms())
        _GUEST_SESSION = session
        _write_cache(_GUEST_FILE, session)
        return session


def _creds():
    """显式完整四头配置优先，否则使用独立游客会话。"""
    if _HAS_OVERRIDE_CREDS:
        return _complete_creds(_OVERRIDE_CREDS)
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hm_app_creds.json")
    try:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                c = _complete_creds(json.load(f))
            if not c:
                _error("hm_app_creds.json 必须包含完整的 datas/sign/alg/wetruwtty 字符串")
            return c
    except (OSError, ValueError, TypeError):
        _error("hm_app_creds.json 读取失败，请检查文件格式")
        return None
    session = _ensure_guest()
    return _guest_headers(session) if session else None


def _http_text(url, referer=None, timeout=12):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": referer or (SITE + "/"),
    })
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
        return r.read(8 * 1024 * 1024).decode("utf-8", "replace")


def _page_props(html):
    m = _ND_RE.search(html)
    if not m:
        return None
    try:
        j = json.loads(m.group(1))
        props = j.get("props") if isinstance(j, dict) else None
        pp = props.get("pageProps") if isinstance(props, dict) else None
        return pp if isinstance(pp, dict) else None
    except (ValueError, TypeError):
        return None


def _txt(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", "", str(s or ""))).strip()


def _episode_name(s):
    return _txt(s).replace("#", "＃").replace("$", "＄")


def _as_dict(value):
    return value if isinstance(value, dict) else {}


def _as_list(value):
    return value if isinstance(value, list) else []


def _names(value, separator=","):
    values = value if isinstance(value, list) else [value]
    out = []
    for item in values:
        if isinstance(item, dict):
            item = item.get("name") or item.get("tagName") or item.get("title") or ""
        if isinstance(item, (str, int, float)):
            item = _txt(item)
            if item:
                out.append(item)
    return separator.join(out)


def _media_url(value):
    if not isinstance(value, str):
        return ""
    value = html_lib.unescape(value).replace("\\/", "/").replace("\\u0026", "&").strip()
    try:
        parsed = urllib.parse.urlsplit(value)
        if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname:
            return ""
        if not re.search(r"\.(?:mp4|m3u8|flv)$", parsed.path, re.I):
            return ""
        if re.search(r"\.encrypt(?:ed)?\.mp4$", parsed.path, re.I):
            return ""
        return value
    except ValueError:
        return ""


def _url_candidates(value):
    if isinstance(value, str):
        u = _media_url(value)
        return [u] if u else []
    if isinstance(value, list):
        out = []
        for item in value:
            out.extend(_url_candidates(item))
        return list(dict.fromkeys(out))
    if isinstance(value, dict):
        out = []
        for key in ("mp4Url", "mp4", "mp4720p", "vodMp4Url", "url", "playUrl",
                    "m3u8", "m3u8720p", "mp4SwitchUrl", "mp4720pSwitchUrl",
                    "m3u8720pSwitchUrl", "m3u8SwitchUrl"):
            if key in value:
                out.extend(_url_candidates(value[key]))
        if not out:
            for key, item in value.items():
                if "encrypt" not in str(key).lower():
                    out.extend(_url_candidates(item))
        return list(dict.fromkeys(out))
    return []


def _url_expired(url):
    try:
        now = _now_ms()
        parsed = urllib.parse.urlsplit(url)
        for key, value in urllib.parse.parse_qsl(parsed.query):
            if key.lower() in ("expires", "expire", "e") and re.fullmatch(r"\d{10,13}", value):
                if _timestamp_ms(value) <= now + 30000:
                    return True
            if key.lower() == "t" and re.fullmatch(r"[0-9a-fA-F]{8}", value):
                if int(value, 16) * 1000 <= now + 30000:
                    return True
        # cbread CDN signatures place the expiry timestamp after the MD5 path.
        if parsed.hostname and (parsed.hostname == "cbread.cn" or parsed.hostname.endswith(".cbread.cn")):
            match = re.match(r"^/[0-9a-fA-F]{32}/([0-9a-fA-F]{8})/", parsed.path)
            if match and int(match.group(1), 16) * 1000 <= now + 30000:
                return True
    except ValueError:
        return True
    return False


def _probe_video(url, headers=None):
    """读取最多 1 KiB，识别媒体响应；不会下载整个视频。"""
    if not _media_url(url) or _url_expired(url):
        return False
    request_headers = dict(headers or {"User-Agent": UA_VIDEO, "Referer": SITE + "/"})
    request_headers.update({"Range": "bytes=0-1023", "Accept-Encoding": "identity"})
    try:
        req = urllib.request.Request(url, headers=request_headers)
        with urllib.request.urlopen(req, timeout=8, context=_SSL) as r:
            if r.status not in (200, 206):
                return False
            kind = r.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            prefix = r.read(1024)
        if not prefix:
            return False
        text_prefix = prefix.lstrip(b"\xef\xbb\xbf \t\r\n")
        if kind in ("text/html", "application/json", "text/json") or text_prefix[:1] in (b"<", b"{", b"["):
            return False
        hls = text_prefix.startswith(b"#EXTM3U")
        if urllib.parse.urlsplit(url).path.lower().endswith(".m3u8"):
            return hls
        mp4 = len(prefix) >= 8 and prefix[4:8] in (b"ftyp", b"styp", b"moov", b"mdat")
        return hls or mp4 or kind.startswith(("video/", "audio/")) or kind in ("application/octet-stream", "binary/octet-stream")
    except (OSError, ValueError, urllib.error.URLError):
        return False


def _failure(message=None):
    return {"parse": 0, "url": "", "header": {},
            "message": message or _LAST_ERROR or "未取得可播放地址，请检查网络、凭据或当前章节权限"}


def _book_to_vod(b):
    if not isinstance(b, dict):
        return None
    bid = str(b.get("bookId") or "")
    name = _txt(b.get("bookName") or b.get("title") or "")
    if not bid.isdigit() or not name:
        return None
    total = b.get("totalChapterNum") or ""
    status = _txt(b.get("statusDesc") or "")
    remark = " ".join(x for x in (status, (str(total) + "集") if total else "") if x)
    return {
        "vod_id": bid,
        "vod_name": name,
        "vod_pic": b.get("coverWap") or b.get("wapUrl") or b.get("cover") or "",
        "vod_remarks": remark,
    }


def _dedupe(items):
    seen, out = set(), []
    for v in items:
        if not v or v["vod_id"] in seen:
            continue
        seen.add(v["vod_id"])
        out.append(v)
    return out


# ---------------- App 接口 ----------------
def _send_app(ep, body, credentials, timeout=12):
    """单次原始请求；1103 初始化通过此函数避免递归取凭据。"""
    headers = {"Content-Type": "application/json", "Accept": "*/*",
               "Accept-Language": "zh-Hans-CN;q=1.0", **credentials}
    payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    try:
        req = urllib.request.Request(APP_BASE + str(ep), data=payload, method="POST", headers=headers)
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
            d = json.loads(r.read(4 * 1024 * 1024).decode("utf-8", "replace"))
        if isinstance(d, dict) and str(d.get("code")) == "0":
            return d
        if isinstance(d, dict):
            _error("App %s code=%s %s" % (ep, d.get("code"), d.get("msg") or d.get("message") or "接口未返回成功"))
        else:
            _error("App %s 返回格式异常" % ep)
    except urllib.error.HTTPError as e:
        _error("App %s HTTP %d" % (ep, e.code))
    except (OSError, ValueError, urllib.error.URLError) as e:
        _error("App %s 请求失败（%s）" % (ep, type(e).__name__))
    return None


def _app_post(ep, body, tries=1, timeout=12):
    """不凭 code=100 重建游客或反复重试；保留真实失败原因。"""
    credentials = _creds()
    if not credentials:
        return None
    return _send_app(ep, body, credentials, timeout=timeout)


def app_catalog(book_id):
    body = dict(TPL_1131, bookId=str(book_id))
    d = _app_post("1131", body)
    data = _as_dict(d.get("data")) if d else {}
    info = _as_dict(data.get("videoInfo"))
    chapters = _as_list(data.get("chapterList"))
    if not chapters:
        catalog = _app_post("1132", {"bookId": str(book_id)})
        catalog_data = _as_dict(catalog.get("data")) if catalog else {}
        chapters = _as_list(catalog_data.get("chapterList"))
        if not info:
            info = _as_dict(catalog_data.get("videoInfo"))
    return info, chapters


def app_play_urls(book_id, chapter_id):
    body = dict(TPL_1139, bookId=str(book_id), chapterId=str(chapter_id), chapterIds=[str(chapter_id)])
    d = _app_post("1139", body)
    if not d:
        return []
    out = []
    for c in _as_list(_as_dict(d.get("data")).get("chapterInfo")):
        if isinstance(c, dict) and str(c.get("chapterId")) == str(chapter_id):
            out.extend(_url_candidates(_as_dict(c.get("content"))))
    return list(dict.fromkeys(out))


def app_play_url(book_id, chapter_id):
    """兼容旧调用：返回本次接口候选的第一个 URL；播放器另行验证媒体。"""
    urls = app_play_urls(book_id, chapter_id)
    return urls[0] if urls else ""


# ---------------- 直链与目录缓存 ----------------
_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hm_url_cache.json")
_CACHE_MAX = 5000
_CACHE_TTL = 15 * 60 * 1000
_cache = None
_CAT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hm_catalog_cache.json")
_CAT_TTL = 6 * 3600 * 1000
_cat = None


def _read_cache(filename):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            value = json.load(f)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def _write_cache(filename, value):
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=os.path.dirname(filename),
                                         prefix=os.path.basename(filename) + ".", suffix=".tmp", delete=False) as f:
            tmp = f.name
            json.dump(value, f, ensure_ascii=False)
        os.replace(tmp, filename)
    except (OSError, ValueError, TypeError):
        pass
    finally:
        if tmp and os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _cache_load():
    global _cache
    with _LOCK:
        if _cache is None:
            _cache = _read_cache(_CACHE_FILE)
        return _cache


def _cache_delete(bid, cid):
    with _LOCK:
        c = _cache_load()
        if c.pop("%s:%s" % (bid, cid), None) is not None:
            _write_cache(_CACHE_FILE, c)


def _cache_get(bid, cid):
    with _LOCK:
        rec = _cache_load().get("%s:%s" % (bid, cid))
        if not isinstance(rec, dict):
            _cache_delete(bid, cid)  # Legacy strings have no reliable creation time.
            return ""
        age = _now_ms() - _timestamp_ms(rec.get("t"))
        url = _media_url(rec.get("url"))
        if age < -30000 or age >= _CACHE_TTL or not url or _url_expired(url):
            _cache_delete(bid, cid)
            return ""
        return url


def _cache_put(bid, cid, url):
    url = _media_url(url)
    if not url or _url_expired(url):
        return
    with _LOCK:
        c = _cache_load()
        c["%s:%s" % (bid, cid)] = {"url": url, "t": _now_ms()}
        if len(c) > _CACHE_MAX:
            for key in list(c)[:len(c) - _CACHE_MAX]:
                del c[key]
        _write_cache(_CACHE_FILE, c)


def _cat_load():
    global _cat
    with _LOCK:
        if _cat is None:
            _cat = _read_cache(_CAT_FILE)
        return _cat


def _cat_get(bid):
    rec = _cat_load().get(str(bid))
    if not isinstance(rec, dict):
        return None
    age = _now_ms() - _timestamp_ms(rec.get("t"))
    if age < -30000 or age >= _CAT_TTL:
        return None
    info, chapters = _as_dict(rec.get("info")), _as_list(rec.get("chapters"))
    return (info, chapters) if chapters else None


def _cat_put(bid, info, chapters):
    if not isinstance(chapters, list) or not chapters:
        return
    with _LOCK:
        c = _cat_load()
        c[str(bid)] = {"t": _now_ms(), "info": _as_dict(info), "chapters": chapters}
        _write_cache(_CAT_FILE, c)


class Spider(BaseSpider):
    def __init__(self):
        self._detail_cache = {}

    def getName(self):
        return "河马剧场"

    def init(self, extend=""):
        global _OVERRIDE_CREDS, _HAS_OVERRIDE_CREDS
        _OVERRIDE_CREDS = None
        _HAS_OVERRIDE_CREDS = False
        self._detail_cache.clear()
        if isinstance(extend, str) and extend.strip():
            try:
                extend = json.loads(extend)
            except ValueError:
                # An explicit malformed configuration must not silently create a guest.
                _HAS_OVERRIDE_CREDS = True
                _error("init 扩展配置不是有效 JSON；已阻止自动游客初始化")
                return
        if isinstance(extend, dict) and "creds" in extend:
            _HAS_OVERRIDE_CREDS = True
            _OVERRIDE_CREDS = extend["creds"]
            if not _complete_creds(_OVERRIDE_CREDS):
                _error("init.creds 必须包含完整的 datas/sign/alg/wetruwtty 字符串")

    def isVideoFormat(self, url):
        return bool(_media_url(url))

    def manualVideoCheck(self):
        return False

    # ---------------- 首页 ----------------
    def homeContent(self, filter):
        classes = [{"type_id": tid, "type_name": name} for tid, name in CATS]
        try:
            list_ = self.homeVideoContent().get("list") or []
        except Exception:
            list_ = []
        return {"class": classes, "list": list_}

    def homeVideoContent(self):
        list_ = []
        try:
            pp = _page_props(_http_text(SITE + "/"))
            if not pp:
                return {"list": []}
            for b in pp.get("bannerList") or []:
                v = _book_to_vod(b)
                if v:
                    list_.append(v)
            for col in pp.get("seoColumnVos") or []:
                for b in col.get("bookInfos") or []:
                    v = _book_to_vod(b)
                    if v:
                        list_.append(v)
            for col in pp.get("typeThreeList") or []:
                for b in (col.get("bookInfos") or col.get("bookList") or []):
                    v = _book_to_vod(b)
                    if v:
                        list_.append(v)
        except Exception as e:
            _error("首页请求失败（%s）" % type(e).__name__)
        return {"list": _dedupe(list_)}

    # ---------------- 分类 ----------------
    def categoryContent(self, tid, pg, filter, extend):
        page = max(1, int(pg or 1)) if str(pg or "1").isdigit() else 1
        empty = {"list": [], "page": page, "pagecount": page, "limit": 0, "total": 0}
        try:
            pp = _page_props(_http_text("%s/browse/%s/%d" % (SITE, tid, page)))
            if not pp:
                return empty
            books = pp.get("bookList") or []
            list_ = _dedupe([v for v in (_book_to_vod(b) for b in books) if v])
            try:
                pagecount = int(pp.get("pages") or pp.get("totalPages") or page)
            except (TypeError, ValueError):
                pagecount = page
            return {
                "list": list_,
                "page": int(pp.get("page") or page) if str(pp.get("page") or page).isdigit() else page,
                "pagecount": pagecount,
                "limit": len(list_),
                "total": pagecount * max(len(list_), 1),
            }
        except Exception as e:
            _error("分类请求失败（%s）" % type(e).__name__)
            return empty

    # ---------------- 搜索 ----------------
    def searchContent(self, key, quick, pg=1):
        """站点 /search 是纯客户端渲染，降级为抓分类首页后本地匹配。"""
        kw = str(key or "").strip()
        if not kw:
            return {"list": [], "page": 1, "pagecount": 1, "limit": 0, "total": 0}

        pooled = []
        try:
            from concurrent.futures import ThreadPoolExecutor
            def _one(c):
                try:
                    return self.categoryContent(c[0], "1", False, {}).get("list") or []
                except Exception:
                    return []
            with ThreadPoolExecutor(max_workers=8) as ex:
                for part in ex.map(_one, CATS[:8]):
                    pooled.extend(part)
        except Exception:
            for tid, _name in CATS[:8]:
                try:
                    pooled.extend(self.categoryContent(tid, "1", False, {}).get("list") or [])
                except Exception:
                    continue

        hit = [v for v in pooled if kw in v["vod_name"]]
        if not hit and len(kw) > 1:
            chars = list(kw)
            for v in pooled:
                n = sum(1 for ch in chars if ch in v["vod_name"])
                if n * 2 >= len(chars):
                    hit.append(v)

        list_ = _dedupe(hit)
        return {"list": list_, "page": 1, "pagecount": 1,
                "limit": len(list_), "total": len(list_)}

    def searchContentPage(self, key, quick, pg=1):
        return self.searchContent(key, quick, pg)

    # ---------------- 详情 ----------------
    def detailContent(self, ids):
        vod_id = ids[0] if isinstance(ids, (list, tuple)) and ids else ids
        raw = str(vod_id or "").strip()
        m = re.fullmatch(r"\d+", raw) or re.search(r"/(?:drama|episode)/(\d+)(?:[/?#]|$)", raw)
        if not m:
            return {"list": []}
        bid = m.group(1) if m.lastindex else m.group(0)
        cached = self._detail_cache.get(bid)
        if isinstance(cached, dict) and _now_ms() - _timestamp_ms(cached.get("t")) < _DETAIL_TTL:
            return {"list": [cached["vod"]]}
        vod = self._detail_app(bid) or self._detail_web(bid)
        if not vod:
            return {"list": []}
        self._detail_cache[bid] = {"t": _now_ms(), "vod": vod}
        return {"list": [vod]}

    def _detail_app(self, bid):
        hit = _cat_get(bid)
        if hit:
            info, chapters = hit
        else:
            info, chapters = app_catalog(bid)
            if chapters:
                _cat_put(bid, info, chapters)
        if not chapters:
            return None
        info = _as_dict(info)
        eps = []
        for idx, c in enumerate(chapters):
            if not isinstance(c, dict):
                continue
            cid = str(c.get("chapterId") or "")
            if not cid.isdigit():
                continue
            name = _episode_name(c.get("chapterName") or ("第%s集" % (c.get("chapterIndex") or idx + 1)))
            eps.append((name, "app:%s:%s" % (bid, cid)))
        if not eps:
            return None
        return {
            "vod_id": bid,
            "vod_name": _txt(info.get("bookName") or info.get("title") or ""),
            "vod_pic": info.get("coverWap") or info.get("coverCutWap") or "",
            "vod_content": _txt(info.get("introduction") or ""),
            "type_name": _names(info.get("bookTags")),
            "vod_area": "",
            "vod_actor": _names(info.get("protagonist"), ", "),
            "vod_remarks": ("%s集" % info.get("updateNum")) if info.get("updateNum") else "",
            "vod_play_from": "河马短剧",
            "vod_play_url": "#".join("%s$%s" % (n, u) for n, u in eps),
        }

    def _detail_web(self, bid):
        try:
            pp = _page_props(_http_text("%s/drama/%s" % (SITE, bid)))
        except Exception as e:
            _error("详情网页请求失败（%s）" % type(e).__name__)
            return None
        if not pp:
            return None
        info = _as_dict(pp.get("bookInfoVo"))
        eps = []
        for idx, c in enumerate(_as_list(pp.get("chapterList"))):
            if not isinstance(c, dict):
                continue
            cid = str(c.get("chapterId") or "")
            if not cid.isdigit():
                continue
            urls = _url_candidates(_as_dict(c.get("chapterVideoVo")))
            if urls:
                _cache_put(bid, cid, urls[0])
            name = _episode_name(c.get("chapterName") or ("第%s集" % (c.get("chapterIndex") or idx + 1)))
            eps.append((name, "app:%s:%s" % (bid, cid)))
        if not eps:
            return None
        return {
            "vod_id": bid,
            "vod_name": _txt(info.get("title") or info.get("bookName") or ""),
            "vod_pic": info.get("coverWap") or info.get("wapUrl") or "",
            "vod_content": _txt(info.get("introduction") or ""),
            "type_name": _names(info.get("categoryList")),
            "vod_area": info.get("countryName") or "",
            "vod_actor": _names(info.get("performerList"), ", "),
            "vod_remarks": ("%s集" % info.get("totalChapterNum")) if info.get("totalChapterNum") else "",
            "vod_play_from": "河马短剧",
            "vod_play_url": "#".join("%s$%s" % (n, u) for n, u in eps),
        }

    # ---------------- 播放 ----------------
    def playerContent(self, flag, id, vipFlags=None):
        global _LAST_ERROR
        _LAST_ERROR = ""
        raw = str(id or "").strip()
        headers = {"User-Agent": UA_VIDEO, "Referer": SITE + "/"}
        direct = _media_url(raw)
        if direct:
            if _probe_video(direct, headers):
                return {"parse": 0, "url": direct, "header": headers}
            return _failure("直链已失效或未返回媒体内容，请重新打开剧集详情获取最新地址")
        m = re.fullmatch(r"app:(\d+):(\d+)", raw) or re.fullmatch(r"(\d+)@(\d+)", raw)
        if not m:
            return _failure("无法识别播放 ID")
        bid, cid = m.groups()
        cached = _cache_get(bid, cid)
        if cached:
            if _probe_video(cached, headers):
                return {"parse": 0, "url": cached, "header": headers}
            _cache_delete(bid, cid)
        try:
            for u in app_play_urls(bid, cid):
                if _probe_video(u, headers):
                    _cache_put(bid, cid, u)
                    return {"parse": 0, "url": u, "header": headers}
            if not _LAST_ERROR:
                _error("App 未下发该章节可用的媒体地址")
        except Exception as e:
            _error("App 取址失败（%s）" % type(e).__name__)
        return self._play_web(bid, cid, headers)

    def _play_web(self, bid, cid, headers):
        try:
            html = _http_text("%s/episode/%s/%s" % (SITE, bid, cid),
                              referer="%s/drama/%s" % (SITE, bid))
            pp = _page_props(html)
            urls = []
            if pp:
                for c in _as_list(pp.get("chapterList")):
                    if isinstance(c, dict) and str(c.get("chapterId")) == str(cid):
                        urls.extend(_url_candidates(_as_dict(c.get("chapterVideoVo"))))
            # Preserve query signatures and JSON/HTML escaping. Match a complete ID,
            # never a substring of another episode ID.
            decoded = html_lib.unescape(html).replace("\\/", "/").replace("\\u0026", "&")
            for value in re.findall(r"https?://[^\"'\s<>]+", decoded):
                u = _media_url(value)
                if u and re.search(r"(?:^|/)" + re.escape(str(cid)) + r"(?=[_./-]|$)", urllib.parse.urlsplit(u).path):
                    urls.append(u)
            for u in dict.fromkeys(urls):
                if _probe_video(u, headers):
                    _cache_put(bid, cid, u)
                    return {"parse": 0, "url": u, "header": headers}
        except Exception as e:
            _error("网页取址失败（%s）" % type(e).__name__)
        return _failure()

    def localProxy(self, param):
        return [200, "video/MP2T", {}, param]

    def destroy(self):
        global _cache, _cat, _OVERRIDE_CREDS, _HAS_OVERRIDE_CREDS, _LAST_ERROR
        self._detail_cache.clear()
        with _LOCK:
            _cache = None
            _cat = None
        _OVERRIDE_CREDS = None
        _HAS_OVERRIDE_CREDS = False
        _LAST_ERROR = ""
