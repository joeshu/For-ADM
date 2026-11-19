# -*- coding: utf-8 -*-
"""
懂片帝 (dongpian17.com) — HMAC-SHA256 签名 API 爬虫
由用户提供的 dongpian.py 1.1.0（CLI 单文件工具）精简而来：去掉 CLI/下载/
交互/终端着色层，只保留签名客户端 + Spider 接口。
- 签名：HMAC-SHA256(secret, METHOD\\npath+query\\ntimestamp(ms)\\nnonce)，请求头
  x-ai-movie-*；secret 与 build 为站点前端公开配置，非账号凭证。
- 首页：/v1/feed/home；分类/搜索：/v1/browse/catalog
- 详情：/v1/catalog/{id}/detail；分集：/v1/catalog/{id}/episodes（分页拉全）
- 播放：/v1/playback/resolve/{token} 取线路，优先 minimum_user_level=0 的
  m3u8 直链，其次 resolve-line 票据解析；永不走网页播放，失败返回 parse=0 空链接。
- build_version：dongpiandi-v2026.11.18.1（站点 2026-11-18 构建）；旧 JS
  适配器 piandi.js（2026.10.04 构建）由本文件取代。
本机验证（2026-11-19）：搜 仙逆 13 条；仙逆 2023 详情 167 集；第 1 集
红牛资源 m3u8 直链已探测可播。
"""
import hashlib
import hmac
import json
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from base.spider import Spider

BASE = "https://dongpian17.com"
SECRET = "8b9a908a05eac640e1ee06f52acaa741bfe4ba9e004eeffdbeb635e532e06666"
CLIENT_NAME = "movie-search-frontend"
CLIENT_VERSION = "1.0.0"
BUILD = "dongpiandi-v2026.11.18.1-core-analytics-96ca156cfffe-web"
PROTOCOL = "2026-07-05.library-v2.playback-v1"
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)
TIMEOUT = 12

KIND_LABELS = {
    "movie": "电影",
    "series": "电视剧",
    "short_drama": "短剧",
    "anime": "动漫",
    "variety": "综艺",
    "documentary": "纪录片",
}

CLASS_MAP = [
    ("all", "全部"),
    ("movie", "电影"),
    ("series", "电视剧"),
    ("anime", "动漫"),
    ("variety", "综艺"),
    ("short_drama", "短剧"),
]


class Spider(Spider):
    name = "懂片帝"
    base_url = BASE
    headers = {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    timeout = TIMEOUT

    def getName(self):
        return "懂片帝"

    def init(self, extend=""):
        self._eps_cache = {}

    # -- 签名与请求 --------------------------------------------------

    def _sign_headers(self, method, target):
        ts = str(int(time.time() * 1000))
        nonce = secrets.token_hex(16)
        msg = "%s\n%s\n%s\n%s" % (method.upper(), target, ts, nonce)
        sig = hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
        return {
            "x-ai-movie-timestamp": ts,
            "x-ai-movie-nonce": nonce,
            "x-ai-movie-signature": sig,
            "x-ai-movie-client-name": CLIENT_NAME,
            "x-ai-movie-client-version": CLIENT_VERSION,
            "x-ai-movie-build-version": BUILD,
            "x-ai-movie-protocol-version": PROTOCOL,
        }

    def _req(self, method, path, params=None, body=None):
        query = ""
        if params:
            clean = [(k, v) for k, v in params.items() if v is not None and v != ""]
            if clean:
                query = "?" + urllib.parse.urlencode(clean, quote_via=urllib.parse.quote)
        target = path + query
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = dict(self.headers)
        headers["Referer"] = BASE + "/"
        headers.update(self._sign_headers(method, target))
        if data is not None:
            headers["Content-Type"] = "application/json"
        last = None
        for _ in range(2):
            req = urllib.request.Request(BASE + target, data=data, headers=headers,
                                         method=method.upper())
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if resp.status != 200:
                        return None
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                last = exc
                if exc.code in (429, 500, 502, 503, 504):
                    time.sleep(0.4)
                    continue
                return None
            except Exception:
                return None
        return None

    def _get(self, path, params=None):
        return self._req("GET", path, params=params)

    def _post(self, path, params=None, body=None):
        return self._req("POST", path, params=params, body=body if body is not None else {})

    # -- 字段映射 ----------------------------------------------------

    def _item(self, it):
        if not isinstance(it, dict):
            return None
        vod_id = it.get("id")
        name = (it.get("title") or "").strip()
        if not vod_id or not name:
            return None
        return {
            "vod_id": str(vod_id),
            "vod_name": name,
            "vod_pic": it.get("poster_url") or it.get("backdrop_url") or "",
            "vod_remarks": it.get("remarks") or it.get("episode_progress_text") or "",
        }

    def _page_result(self, j, pg, limit):
        result = {"list": [], "page": pg, "pagecount": 1, "limit": limit, "total": 0}
        if not isinstance(j, dict):
            return result
        items = []
        for it in j.get("cards") or []:
            v = self._item(it)
            if v:
                items.append(v)
        result["list"] = items
        pag = j.get("pagination") or {}
        total = pag.get("total") or 0
        result["total"] = total
        if total and limit:
            result["pagecount"] = (total + limit - 1) // limit
        elif items:
            result["pagecount"] = pg + 1
        else:
            result["pagecount"] = pg
        return result

    # -- Spider 接口 --------------------------------------------------

    def homeContent(self, filter=False):
        result = {"class": [], "list": [], "filters": {}}
        for tid, tname in CLASS_MAP:
            result["class"].append({"type_id": tid, "type_name": tname})
        j = self._get("/v1/feed/home", {"scope": "public", "mode": "preview",
                                        "sections": 3, "cards": 10})
        if not isinstance(j, dict):
            return result
        items, seen = [], set()
        for sec in j.get("sections") or []:
            for it in sec.get("cards") or []:
                v = self._item(it)
                if v and v["vod_id"] not in seen:
                    seen.add(v["vod_id"])
                    items.append(v)
        result["list"] = items[:30]
        return result

    def homeVideoContent(self):
        return self.homeContent()

    def categoryContent(self, tid, pg, filter=False, extend=None):
        pg = int(pg) if str(pg).isdigit() else 1
        tid = str(tid or "")
        kind = None if tid in ("", "all") else tid
        j = self._get("/v1/browse/catalog",
                      {"kind": kind, "page": pg, "limit": 30, "sort": "heat_desc"})
        return self._page_result(j, pg, 30)

    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1
        result = {"list": [], "page": pg, "pagecount": 1, "limit": 20, "total": 0}
        key = (key or "").strip()
        if not key:
            return result
        j = self._get("/v1/browse/catalog", {"q": key, "page": pg, "limit": 20})
        return self._page_result(j, pg, 20)

    def _all_episodes(self, cid):
        if not hasattr(self, "_eps_cache"):
            self._eps_cache = {}
        if cid in self._eps_cache:
            return self._eps_cache[cid]
        out, offset = [], 0
        for _ in range(40):
            data = self._get("/v1/catalog/%s/episodes" % urllib.parse.quote(cid),
                             {"limit": 48, "offset": offset})
            if not isinstance(data, dict):
                break
            batch = data.get("episodes") or []
            out.extend(batch)
            pag = data.get("episode_pagination") or {}
            if not pag.get("has_more") or not batch:
                break
            offset = pag.get("next_offset", offset + len(batch))
        self._eps_cache[cid] = out
        return out

    def detailContent(self, ids):
        cid = ids[0] if isinstance(ids, list) else ids
        cid = str(cid or "").strip()
        result = {"list": []}
        if not cid:
            return result
        j = self._get("/v1/catalog/%s/detail" % urllib.parse.quote(cid))
        if not isinstance(j, dict) or not j.get("id"):
            return result
        content = j.get("description") or ""
        if content:
            content = re.sub(r"<[^>]+>", "", content).strip()
        eps = []
        for i, ep in enumerate(self._all_episodes(cid)):
            num = ep.get("number") or (i + 1)
            try:
                num = int(num)
            except (TypeError, ValueError):
                num = i + 1
            label = (ep.get("title") or "").strip() or ("第%s集" % num)
            eps.append("%s$dp:%s@%s" % (label, cid, num))
        vod = {
            "vod_id": cid,
            "vod_name": (j.get("title") or "").strip(),
            "vod_pic": j.get("poster_url") or j.get("backdrop_url") or "",
            "vod_actor": "、".join(j.get("actors") or [])[:200],
            "vod_director": "、".join(j.get("directors") or [])[:100],
            "vod_content": content,
            "vod_area": j.get("area") or "",
            "vod_year": str(j.get("year") or ""),
            "type_name": KIND_LABELS.get(j.get("content_kind"), j.get("content_kind") or ""),
            "vod_remarks": j.get("remarks") or j.get("episode_progress_text") or "",
            "vod_play_from": "懂片帝",
            "vod_play_url": "#".join(eps),
        }
        result["list"].append(vod)
        return result

    def _resolve_line(self, line):
        label = line.get("label") or "-"
        if line.get("url_kind") == "m3u8" and not line.get("resolve_required"):
            return line.get("url") or ""
        url = line.get("url") or ""
        if not line.get("resolve_required") and url and not url.startswith("resolve://"):
            return url
        ticket = line.get("resolve_ticket") or url
        if ticket.startswith("resolve://"):
            ticket = ticket[len("resolve://"):]
        if not ticket:
            return ""
        r = self._post("/v1/playback/resolve-line", {"view": "compact"}, {"ticket": ticket})
        if not isinstance(r, dict):
            return ""
        resolved = r.get("line") or {}
        return resolved.get("url") or ""

    def playerContent(self, flag, video_id, vip_flags):
        result = {"parse": 0, "url": "", "header": {}}
        token = (video_id or "").strip().rsplit("$", 1)[-1]
        m = re.match(r"dp:(.+)@(\d+)$", token)
        if not m:
            return result
        cid, num = m.group(1), int(m.group(2))
        ep = None
        for i, e in enumerate(self._all_episodes(cid)):
            n = e.get("number") or (i + 1)
            try:
                n = int(n)
            except (TypeError, ValueError):
                n = i + 1
            if n == num:
                ep = e
                break
        if not ep or not ep.get("token"):
            return result
        r = self._get("/v1/playback/resolve/%s" % urllib.parse.quote(ep["token"]),
                      {"view": "compact"})
        if not isinstance(r, dict):
            return result
        lines = [ln for ln in (r.get("line_options") or [])
                 if isinstance(ln, dict) and (ln.get("minimum_user_level") in (None, 0))]
        if not lines:
            return result
        lines.sort(key=lambda ln: (
            0 if (ln.get("url_kind") == "m3u8" and not ln.get("resolve_required")) else 1,
            0 if ln.get("selected") else 1,
            -(ln.get("preference_weight") or 0),
        ))
        for line in lines:
            try:
                url = self._resolve_line(line)
            except Exception:
                continue
            if url and re.match(r"^https?://", url):
                result["url"] = url
                result["header"] = {"Referer": BASE + "/"}
                return result
        return result
