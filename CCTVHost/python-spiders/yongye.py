# -*- coding: utf-8 -*-
"""
永夜 (Xdai) — API 爬虫
由 JAR 版 csp_Xdai 转换而来。协议由 fix250711.jar 字节码完整还原并实测打通。
- 配置：getapi.txt -> http://app1.ystva.com，API 根 http://app1.ystva.com/api.php
  （注意：后端 HTTPS 不通，必须走明文 HTTP）
- 签名（每请求 6 头）：app-api-verify-sign = Base64(AES-128-CBC(key=QU, iv=UJ,
  明文=unix 秒时间戳）），app-api-verify-time=同一时间戳，app-user-device-id=""，
  app-ui-mode=light, user-agent=okhttp/3.14.9, app-version-code=304
  QU=UJ="A1akVPQmnnE4Fz9Z"（16 字符，ext 第 2/3 段）
- 响应：{"data": "<Base64>"}，AES/CBC/PKCS5Padding 解密（key=QU, iv=UJ）后解析 JSON
- 首页：/getappapi.index/init（type_list + banner_list）
- 分类：/getappapi.index/typeFilterVodList?page=&class=全部&area=全部&lang=全部&sort=最新&type_id=&year=全部
- 搜索：/getappapi.index/searchList（服务端 HTTP 500，暂时不可用）
- 详情：/getappapi.index/vodDetail?vcd_id=，分集在 vod_play_list[].urls[]
- 播放：直链 m3u8/mp4 直接返回 parse=0；非直链调 /getappapi.index/vodParse
  （parse_api/url/token）；从不返回 parse=1 网页
- 直链实测：play.phimgood.com 本机 403（Cloudflare 地域屏蔽，手机应可播），
  fengbao12.com 已 404。本地只能验证到拿到直链 URL。
"""
import re
import json
import time
import base64
import requests
from base.spider import Spider

try:
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import pad, unpad
except ImportError:
    AES = None

QU = "A1akVPQmnnE4Fz9Z"
UJ = "A1akVPQmnnE4Fz9Z"
VERSION_CODE = "304"
OKHTTP_UA = "okhttp/3.14.9"
GETAPI_URL = "https://ysappapi.oss-cn-shenzhen.aliyuncs.com/getapi.txt"
DEFAULT_HOST = "app1.ystva.com"


class Spider(Spider):
    name = "永夜"
    timeout = 15

    def getName(self):
        return "永夜"

    def init(self, extend=""):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": OKHTTP_UA})
        host = DEFAULT_HOST
        try:
            resp = self.session.get(GETAPI_URL, timeout=8)
            if resp.status_code == 200:
                line = (resp.text or "").strip().splitlines()
                if line:
                    h = line[0].strip()
                    h = re.sub(r"^https?://", "", h).strip().rstrip("/")
                    if h:
                        host = h
        except Exception:
            pass
        # 后端 HTTPS 不通，API 必须走明文 HTTP
        self.api_root = "http://" + host + "/api.php"
        self._types = None

    def _sign_headers(self):
        ts = str(int(time.time()))
        sign = ""
        if AES is not None:
            cipher = AES.new(QU.encode(), AES.MODE_CBC, UJ.encode())
            ct = cipher.encrypt(pad(ts.encode(), AES.block_size))
            sign = base64.b64encode(ct).decode()
        return {
            "app-api-verify-sign": sign,
            "app-api-verify-time": ts,
            "app-user-device-id": "",
            "app-ui-mode": "light",
            "user-agent": OKHTTP_UA,
            "app-version-code": VERSION_CODE,
        }

    def _decrypt(self, b64):
        if AES is None:
            return None
        try:
            raw = base64.b64decode(b64)
            cipher = AES.new(QU.encode(), AES.MODE_CBC, UJ.encode())
            return unpad(cipher.decrypt(raw), AES.block_size).decode("utf-8")
        except Exception:
            return None

    def _api(self, path, params=None):
        try:
            resp = self.session.get(self.api_root + path, params=params or {},
                                    headers=self._sign_headers(), timeout=self.timeout)
            if resp.status_code != 200:
                return None
            try:
                j = resp.json()
            except Exception:
                return None
            data = j.get("data")
            if isinstance(data, str):
                dec = self._decrypt(data)
                if dec is None:
                    return None
                try:
                    return json.loads(dec)
                except Exception:
                    return None
            return j
        except Exception:
            return None

    def _item(self, it):
        if not isinstance(it, dict):
            return None
        vod_id = it.get("vod_id")
        name = (it.get("vod_name") or "").strip()
        if not vod_id or not name:
            return None
        return {
            "vod_id": str(vod_id),
            "vod_name": name,
            "vod_pic": it.get("vod_pic") or "",
            "vod_remarks": it.get("vod_remarks") or "",
        }

    def _load_types(self):
        if self._types is not None:
            return self._types
        self._types = []
        d = self._api("/getappapi.index/init")
        if isinstance(d, dict):
            for t in d.get("type_list") or []:
                tid = t.get("type_id")
                tname = (t.get("type_name") or "").strip()
                if tid is not None and tname:
                    self._types.append({"type_id": str(tid), "type_name": tname})
        return self._types

    def homeContent(self, filter=False):
        result = {"class": [], "list": [], "filters": {}}
        for t in self._load_types():
            result["class"].append(t)
        # 首页列表用全部类第 1 页（banner 是广告/指南，不用）
        cat = self.categoryContent("0", 1)
        result["list"] = cat.get("list", [])[:30]
        return result

    def homeVideoContent(self):
        return self.homeContent()

    def categoryContent(self, tid, pg, filter=False, extend=None):
        pg = int(pg) if str(pg).isdigit() else 1
        result = {"list": [], "page": pg, "pagecount": pg, "limit": 30, "total": 0}
        tid = str(tid)
        d = self._api("/getappapi.index/typeFilterVodList", {
            "page": pg, "class": "全部", "area": "全部", "lang": "全部",
            "sort": "最新", "type_id": tid, "year": "全部",
        })
        if not isinstance(d, dict):
            return result
        items = []
        for it in d.get("recommend_list") or []:
            v = self._item(it)
            if v:
                items.append(v)
        result["list"] = items
        result["pagecount"] = pg + 1 if len(items) >= 12 else pg
        return result

    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1
        result = {"list": [], "page": pg, "pagecount": pg, "limit": 20, "total": 0}
        key = (key or "").strip()
        if not key:
            return result
        d = self._api("/getappapi.index/searchList", {
            "page": pg, "type_id": "0", "keywords": key,
        })
        if not isinstance(d, dict):
            return result
        items = []
        for it in d.get("search_list") or []:
            v = self._item(it)
            if v:
                items.append(v)
        result["list"] = items
        result["pagecount"] = pg + 1 if len(items) >= 12 else pg
        return result

    def detailContent(self, ids):
        vod_id = ids[0] if isinstance(ids, list) else ids
        m = re.search(r"(\d+)", str(vod_id))
        if not m:
            return {"list": []}
        vod_id = m.group(1)
        result = {"list": []}
        d = self._api("/getappapi.index/vodDetail", {"vod_id": vod_id})
        if not isinstance(d, dict):
            return result
        v = d.get("vod") or {}
        title = (v.get("vod_name") or "").strip()
        content = v.get("vod_content") or ""
        if content:
            content = re.sub(r"<[^>]+>", "", content).strip()
        play_from = []
        play_url = []
        for src in d.get("vod_play_list") or []:
            pi = src.get("player_info") or {}
            show = (pi.get("show") or "").strip() or "默认源"
            parse = (pi.get("parse") or "").strip()
            urls = src.get("urls") or []
            eps = []
            for u in urls:
                name = (u.get("name") or "").strip()
                url = (u.get("url") or "").strip()
                if not name or not url:
                    continue
                token = (u.get("token") or "").strip()
                ua = (pi.get("user_agent") or "").strip() or OKHTTP_UA
                flag = "%s$%s*qiao*%s*%s*%s" % (name, url, parse, token, ua)
                eps.append(flag)
            if eps:
                play_from.append(show)
                play_url.append("#".join(eps))
        vod = {
            "vod_id": vod_id,
            "vod_name": title,
            "vod_pic": v.get("vod_pic") or "",
            "vod_actor": v.get("vod_actor") or "",
            "vod_director": v.get("vod_director") or "",
            "vod_content": content,
            "vod_area": v.get("vod_area") or "",
            "vod_year": str(v.get("vod_year") or ""),
            "type_name": v.get("type_name") or "",
            "vod_remarks": v.get("vod_remarks") or "",
            "vod_play_from": "$$$".join(play_from),
            "vod_play_url": "$$$".join(play_url),
        }
        result["list"].append(vod)
        return result

    def playerContent(self, flag, video_id, vip_flags):
        result = {"parse": 0, "url": "", "header": {}}
        parts = (video_id or "").split("*")
        if len(parts) < 5:
            return result
        name_url = parts[0]
        parse_api = parts[2]
        token = parts[3]
        ua = parts[4] or OKHTTP_UA
        url = name_url.split(chr(36), 1)[1] if chr(36) in name_url else name_url
        if not url:
            return result
        # 直链直接返回
        if "m3u8" in url or "mp4" in url:
            result["url"] = url
            result["header"] = {"User-Agent": ua}
            return result
        # 非直链：调 vodParse
        try:
            resp = self.session.get(self.api_root + "/getappapi.index/vodParse",
                                    params={"parse_api": parse_api, "url": url, "token": token},
                                    headers=self._sign_headers(), timeout=self.timeout)
            if resp.status_code != 200:
                return result
            body = resp.text or ""
            if "DOCTYPE html" in body:
                return result
            try:
                j = resp.json()
            except Exception:
                return result
            data = j.get("data")
            if isinstance(data, str):
                dec = self._decrypt(data)
                if dec is None:
                    return result
                try:
                    dj = json.loads(dec)
                except Exception:
                    return result
                inner = dj.get("json") or dj
                if isinstance(inner, str):
                    try:
                        inner = json.loads(inner)
                    except Exception:
                        inner = {}
                if isinstance(inner, dict):
                    u = (inner.get("url") or "").strip()
                    if u:
                        result["url"] = u
                        result["header"] = {"User-Agent": ua}
            elif isinstance(data, dict):
                u = (data.get("url") or "").strip()
                if u:
                    result["url"] = u
                    result["header"] = {"User-Agent": ua}
        except Exception:
            pass
        return result
