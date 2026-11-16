# -*- coding: utf-8 -*-
"""
剧评 (界影视 m.hkybqufgh.com) — API 爬虫
由 JAR 版 csp_Jpys 转换而来。后端直连 https://m.wxojcopfw.com/mw-movie，
全部 GET，无需签名/登录/token（走站内 /api 代理才需要签名，直连不用）。
- 首页：/anonymous/v1/home/all/list（8 区块）
- 分类：/anonymous/video/list?type1=&pageNum=&pageSize=30&sort=1&sortBy=1
- 搜索：/anonymous/video/searchByWord?keyword=&pageNum=&pageSize=20
- 详情：/anonymous/video/detail?id=<vodId>，分集在 episodeList[{nid,name}]
- 播放：/anonymous/v2/video/episode/url?clientType=3&id=&nid=，取 1080 档直链
  （1080/720/480 三档 m3u8，auth_key 现取现用；本机已验证仙逆第1集可播）
"""
import re
import json
import time
import urllib.parse
import requests
from base.spider import Spider


class Spider(Spider):
    name = "剧评"
    base_url = "https://m.wxojcopfw.com/mw-movie"
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    timeout = 15

    CLASS_MAP = {
        "1": "电影",
        "2": "电视剧",
        "3": "综艺",
        "4": "动漫",
        "88": "短剧",
    }

    def getName(self):
        return "剧评"

    def init(self, extend=""):
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def _get(self, path, params=None):
        try:
            resp = self.session.get(self.base_url + path, params=params or {}, timeout=self.timeout)
            if resp.status_code != 200:
                return None
            try:
                return resp.json()
            except Exception:
                return None
        except Exception:
            return None

    def _ok(self, j):
        return isinstance(j, dict) and j.get("code") == 200 and isinstance(j.get("data"), dict)

    def _item(self, it):
        if not isinstance(it, dict):
            return None
        vod_id = it.get("vodId")
        name = (it.get("vodName") or "").strip()
        if not vod_id or not name:
            return None
        return {
            "vod_id": str(vod_id),
            "vod_name": name,
            "vod_pic": it.get("vodPic") or "",
            "vod_remarks": it.get("vodRemarks") or it.get("vodSub") or "",
        }

    def homeContent(self, filter=False):
        result = {"class": [], "list": [], "filters": {}}
        for cid, cname in self.CLASS_MAP.items():
            result["class"].append({"type_id": cid, "type_name": cname})
        j = self._get("/anonymous/v1/home/all/list", {"clientType": 3, "pageNum": 1})
        if not self._ok(j):
            return result
        data = j["data"]
        items = []
        seen = set()
        for key in ("homeNewMoviePageData", "newestTvPageData", "homeBroadcastPageData",
                    "newestVarietyPageData", "newestCartoonPageData", "newestShortTvPageData",
                    "homeManagerPageData", "homeTrailerPageData"):
            block = data.get(key)
            if not isinstance(block, dict):
                continue
            for it in block.get("list") or []:
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
        result = {"list": [], "page": pg, "pagecount": 1, "limit": 30, "total": 0}
        tid = str(tid)
        if tid not in self.CLASS_MAP:
            return result
        j = self._get("/anonymous/video/list", {
            "type1": tid, "pageNum": pg, "pageSize": 30, "sort": 1, "sortBy": 1,
        })
        if not self._ok(j):
            return result
        data = j["data"]
        items = []
        for it in data.get("list") or []:
            v = self._item(it)
            if v:
                items.append(v)
        result["list"] = items
        total = data.get("totalCount") or 0
        total_page = data.get("totalPage") or 0
        result["total"] = total
        result["pagecount"] = total_page if total_page > 0 else (pg + 1 if items else pg)
        return result

    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1
        result = {"list": [], "page": pg, "pagecount": 1, "limit": 20, "total": 0}
        key = (key or "").strip()
        if not key:
            return result
        j = self._get("/anonymous/video/searchByWord", {
            "keyword": key, "pageNum": pg, "pageSize": 20,
        })
        if not isinstance(j, dict) or j.get("code") != 200:
            return result
        data = j.get("data") or {}
        res = data.get("result") or {}
        items = []
        for it in res.get("list") or []:
            v = self._item(it)
            if v:
                items.append(v)
        result["list"] = items
        total = res.get("totalCount") or 0
        total_page = res.get("totalPage") or 0
        result["total"] = total
        result["pagecount"] = total_page if total_page > 0 else (pg + 1 if items else pg)
        return result

    def detailContent(self, ids):
        vod_id = ids[0] if isinstance(ids, list) else ids
        m = re.search(r"(\d+)", str(vod_id))
        if not m:
            return {"list": []}
        vod_id = m.group(1)
        result = {"list": []}
        j = self._get("/anonymous/video/detail", {"id": vod_id})
        if not self._ok(j):
            return result
        d = j["data"]
        title = (d.get("vodName") or "").strip()
        content = d.get("vodContent") or ""
        if content:
            content = re.sub(r"<[^>]+>", "", content).strip()
        eps = []
        for ep in d.get("episodeList") or []:
            nid = ep.get("nid")
            name = (ep.get("name") or "").strip()
            if nid is None or not name:
                continue
            token = "jp:%s@%s" % (vod_id, nid)
            eps.append("%s$%s" % (name, token))
        vod = {
            "vod_id": vod_id,
            "vod_name": title,
            "vod_pic": d.get("vodPic") or "",
            "vod_actor": d.get("vodActor") or "",
            "vod_director": d.get("vodDirector") or "",
            "vod_content": content,
            "vod_area": d.get("vodArea") or "",
            "vod_year": str(d.get("vodYear") or ""),
            "type_name": d.get("typeName") or "",
            "vod_remarks": d.get("vodRemarks") or "",
            "vod_play_from": "界影视",
            "vod_play_url": "#".join(eps),
        }
        result["list"].append(vod)
        return result

    def playerContent(self, flag, video_id, vip_flags):
        result = {"parse": 0, "url": "", "header": {}}
        m = re.match(r"jp:(\d+)@(\d+)", (video_id or "").strip())
        if not m:
            return result
        vod_id, nid = m.group(1), m.group(2)
        j = self._get("/anonymous/v2/video/episode/url", {
            "clientType": 3, "id": vod_id, "nid": nid,
        })
        if not isinstance(j, dict) or j.get("code") != 200:
            return result
        data = j.get("data") or {}
        tiers = data.get("list") or []
        # 优先 1080 蓝光，失败回落 480 标清
        best = None
        fallback = None
        for t in tiers:
            url = (t.get("url") or "").strip()
            if not url:
                continue
            res = t.get("resolution")
            if res == 1080:
                best = url
            elif res == 480:
                fallback = url
            elif best is None:
                best = url
        url = best or fallback
        if url:
            result["url"] = url
        return result
