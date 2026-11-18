# -*- coding: utf-8 -*-
# @Desc    : 开心影院 TVBox Python 爬虫 (kxyy.app 发布页 / www.kxyyN.cc, 苹果CMS V10)
# @Note    : 由用户提供的 kxyytv.py 命令行解析器改写适配 CCTVHost。
#            域名从发布页 kxyy.app 解析 (kxyy1~kxyy9.cc)，逐个测速选最优；
#            全部测不通时回退 kxyy1.cc。只返回直链，永不走网页播放 (parse=1)。
# @dependencies: requests

import re
import json
import time
import urllib.parse
import requests
from concurrent.futures import ThreadPoolExecutor
from base.spider import Spider


class Spider(Spider):

    def getName(self):
        return "开心影院"

    def init(self, extend=""):
        self.ua = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": self.ua,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })
        self.pub_page = "https://kxyy.app/"
        self._domain = None
        self._domain_ts = 0
        self.categories = [
            {"id": "1", "name": "电影"},
            {"id": "2", "name": "电视剧"},
            {"id": "3", "name": "综艺"},
            {"id": "4", "name": "动漫"},
            {"id": "26", "name": "短剧"},
        ]
        self.page_size = 24

    # ---------------- 域名发现 ----------------

    def _candidates(self):
        """从发布页解析候选域名；失败则回退 kxyy1~kxyy9。"""
        cands = []
        try:
            r = self.session.get(self.pub_page, timeout=8)
            if r.status_code == 200:
                found = re.findall(r"https?://www\.kxyy\d+\.cc", r.text, re.I)
                if found:
                    cands = ["https://www.kxyy%d.cc" % n for n in range(1, 10)]
        except Exception:
            pass
        if not cands:
            cands = ["https://www.kxyy%d.cc" % n for n in range(1, 10)]
        return cands

    def _check_domain(self, domain):
        """以搜索接口为准校验域名可用 (部分镜像首页 200 但搜索 API 404)。"""
        try:
            url = domain + "/index.php/ajax/suggest?mid=1&wd=a&limit=1"
            r = self.session.get(url, headers={"Referer": domain + "/"}, timeout=5)
            if r.status_code != 200:
                return False
            return r.json().get("code") == 1
        except Exception:
            return False

    def _domain_get(self):
        """选最快可用域名，进程内缓存 10 分钟；全部不通回退第一个。"""
        now = time.time()
        if self._domain and now - self._domain_ts < 600:
            return self._domain
        cands = self._candidates()
        best = ""
        try:
            with ThreadPoolExecutor(max_workers=6) as ex:
                oks = list(ex.map(self._check_domain, cands))
            for d, ok in zip(cands, oks):
                if ok:
                    best = d
                    break
        except Exception:
            best = ""
        if not best:
            best = cands[0] if cands else "https://www.kxyy1.cc"
        self._domain = best
        self._domain_ts = now
        return best

    # ---------------- 基础请求 ----------------

    def _get(self, url, timeout=12, is_json=False):
        if not url.startswith("http"):
            url = self._domain_get() + url
        try:
            r = self.session.get(url, timeout=timeout, verify=False)
            if r.status_code != 200:
                return None
            if is_json:
                return r.json()
            r.encoding = r.apparent_encoding or "utf-8"
            return r.text
        except Exception:
            return None

    @staticmethod
    def _abs_url(url, domain):
        if not url:
            return ""
        if url.startswith("http"):
            return url
        if url.startswith("//"):
            return "https:" + url
        return domain.rstrip("/") + "/" + url.lstrip("/")

    # ---------------- 列表解析 (vodshow) ----------------

    def _vodshow_url(self, type_id, area="", klass="", year="", by="", page=1):
        def q(v):
            return "" if v in (None, "") else urllib.parse.quote(str(v), safe="")
        seg = [str(type_id), q(area), q(by), q(klass), "", "", "", "",
               str(page), "", "", q(year)]
        return self._domain_get().rstrip("/") + "/vodshow/" + "-".join(seg) + ".html"

    def _parse_vod_list(self, html):
        if not html:
            return []
        items = []
        seen = set()
        pos = [m.start() for m in re.finditer(r'href="/voddetail/(\d+)\.html"', html)]
        pos.append(len(html))
        for k in range(len(pos) - 1):
            seg = html[pos[k]:pos[k + 1]]
            mv = re.search(r'/voddetail/(\d+)\.html', seg)
            if not mv:
                continue
            vid = mv.group(1)
            if vid in seen:
                continue
            nm = re.search(r'card-title[^>]*>([^<]+)<', seg)
            if not nm:
                nm = re.search(r'title="([^"]+)"', seg)
            name = nm.group(1).strip() if nm else ""
            if not name:
                continue
            seen.add(vid)
            body = re.sub(r"<img[^>]*>", "", seg)
            rm = re.search(r"(更新至[^<\s]*|全\s*\d+\s*集|已完结|正片|预告|HD[\u4e00-\u9fa5]*|\d+K)", body)
            remarks = rm.group(1).strip() if rm else ""
            yearv = ""
            dm = re.search(r">(\d{4})-\d{2}-\d{2}<", body)
            if dm:
                yearv = dm.group(1)
            else:
                ym = re.search(r">(20\d{2})<", body)
                if ym:
                    yearv = ym.group(1)
            sm = re.search(r">(\d\.\d)<", body)
            scorev = sm.group(1) if sm else ""
            pic = ""
            im = re.search(r'<img[^>]+(?:data-src|src)="([^"]+)"', seg)
            if im:
                pic = self._abs_url(im.group(1), self._domain_get())
            items.append({
                "vod_id": vid,
                "vod_name": name,
                "vod_pic": pic,
                "vod_remarks": remarks,
                "vod_year": yearv,
                "vod_score": scorev,
                "vod_director": "",
                "vod_actor": "",
                "vod_content": "",
            })
        return items

    def _total_page(self, html, page):
        if not html:
            return page
        pm = re.search(r"共\s*(\d+)\s*页", html)
        if pm:
            return int(pm.group(1))
        maxp = page
        for hm in re.finditer(r'/vodshow/([^"\']+?)\.html', html):
            seg = hm.group(1).split("-")
            if len(seg) >= 9:
                try:
                    n = int(seg[8])
                    if n > maxp:
                        maxp = n
                except ValueError:
                    pass
        return maxp

    # ---------------- 首页 / 分类 ----------------

    def homeContent(self, filter):
        classes = [{"type_id": c["id"], "type_name": c["name"]} for c in self.categories]
        html = self._get(self._vodshow_url(1, page=1))
        videos = self._parse_vod_list(html)[:20] if html else []
        return {"class": classes, "filters": {}, "list": videos}

    def homeVideoContent(self):
        return {"list": []}

    def categoryContent(self, tid, pg, filter, extend):
        tid = str(tid or "1")
        pg = max(1, int(pg or 1))
        html = self._get(self._vodshow_url(tid, page=pg))
        videos = self._parse_vod_list(html) if html else []
        total_page = self._total_page(html, pg) if html else pg
        return {
            "page": pg,
            "pagecount": total_page,
            "limit": self.page_size,
            "total": (total_page - 1) * self.page_size + len(videos),
            "list": videos,
        }

    # ---------------- 搜索 ----------------

    def searchContent(self, key, quick, pg="1"):
        keyword = (key or "").strip()
        pg = max(1, int(pg or 1))
        if not keyword:
            return {"page": 1, "pagecount": 1, "limit": self.page_size, "total": 0, "list": []}
        domain = self._domain_get()
        url = (
            "%s/index.php/ajax/suggest?mid=1&wd=%s&limit=%d&page=%d"
            % (domain, requests.utils.quote(keyword), self.page_size, pg)
        )
        data = self._get(url, is_json=True)
        raw = data.get("list", []) if isinstance(data, dict) else []
        videos = []
        for item in raw:
            vid = str(item.get("id") or "")
            name = (item.get("name") or "").strip()
            if vid and name:
                videos.append({
                    "vod_id": vid,
                    "vod_name": name,
                    "vod_pic": self._abs_url(item.get("pic") or "", domain),
                    "vod_remarks": "",
                    "vod_year": "",
                    "vod_director": "",
                    "vod_actor": "",
                    "vod_content": "",
                })
        total = int(data.get("total", len(videos))) if isinstance(data, dict) else len(videos)
        pagecount = max(1, (total + self.page_size - 1) // self.page_size) if total else 1
        return {
            "page": pg,
            "pagecount": pagecount,
            "limit": self.page_size,
            "total": total,
            "list": videos,
        }

    # ---------------- 详情 ----------------

    def detailContent(self, array):
        if not array:
            return {"list": []}
        vod_id = str(array[0]).strip()
        if not vod_id:
            return {"list": []}
        domain = self._domain_get()
        html = self._get("%s/voddetail/%s.html" % (domain, vod_id))
        if not html:
            return {"list": []}
        title = ""
        m = re.search(r"<title>([^<]+?)(?:在线观看|免费|-)", html)
        if m:
            title = m.group(1).strip()
        pic = ""
        m = re.search(r'property="og:image"\s*content="([^"]+)"', html)
        if m:
            pic = self._abs_url(m.group(1), domain)
        content = ""
        m = re.search(r"剧情简介</h\d>\s*(.*?)</div>", html, re.S)
        if m:
            content = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        if not title:
            return {"list": []}

        tab_names = {}
        for m in re.finditer(r'href="#tabs-home-(\d+)"[^>]*>(.*?)</a>', html, re.S):
            raw = re.sub(r'<[^>]+>', '', m.group(2)).replace('&nbsp;', ' ')
            name = re.sub(r"\s+", " ", raw).strip()
            name = re.sub(r"\s+\d+$", "", name)
            if name:
                tab_names[int(m.group(1))] = name
        sources = {}
        for m in re.finditer(r"/vodplay/(\d+)-(\d+)-(\d+)\.html", html):
            sid, nid = int(m.group(2)), int(m.group(3))
            sources.setdefault(sid, []).append(nid)

        play_from = []
        play_url = []
        for sid in sorted(sources.keys()):
            eps = sorted(sources[sid])
            ep_parts = []
            for nid in eps:
                t = "第%d集" % nid if nid < 100 else "第%04d期" % nid
                ep_parts.append("%s$%s/vodplay/%s-%d-%d.html" % (t, domain, vod_id, sid, nid))
            play_from.append(tab_names.get(sid, "线路%d" % sid))
            play_url.append("#".join(ep_parts))
        vod = {
            "vod_id": vod_id,
            "vod_name": title,
            "vod_pic": pic,
            "vod_remarks": "",
            "vod_year": "",
            "vod_director": "",
            "vod_actor": "",
            "vod_content": content,
            "vod_play_from": "$$$".join(play_from),
            "vod_play_url": "$$$".join(play_url),
        }
        return {"list": [vod]}

    # ---------------- 播放 ----------------

    def playerContent(self, flag, id, vipFlags):
        play_id = str(id or "").strip()
        if not play_id:
            return {"parse": 0, "url": "", "header": {}}
        header = {
            "User-Agent": self.ua,
            "Referer": self._domain_get() + "/",
        }
        # 已经是直链，直接播放
        if re.search(r"\.(m3u8|mp4)(\?|$|#)", play_id, re.I):
            return {"parse": 0, "url": play_id, "header": header, "jx": 0}
        # 播放页：取 player_data 里的 url
        if "/vodplay/" in play_id or play_id.startswith("http"):
            html = self._get(play_id, timeout=15)
            if not html:
                return {"parse": 0, "url": "", "header": {}}
            m = re.search(r"var player_data\s*=\s*(\{.*?\})\s*</script>", html, re.S)
            real_url = ""
            if m:
                try:
                    pd = json.loads(m.group(1))
                except Exception:
                    try:
                        pd = json.loads(m.group(1).rstrip(";"))
                    except Exception:
                        pd = {}
                real_url = (pd.get("url") or "").strip()
            if not real_url:
                m2 = re.search(r'"url"\s*:\s*"([^"]+?\.(?:m3u8|mp4)[^"]*)"', html, re.I)
                if m2:
                    real_url = m2.group(1).replace("\\/", "/")
            if not real_url:
                m3 = re.search(r'(https?://[^\s"\'<>]+\.(?:m3u8|mp4)[^\s"\'<>]*)', html)
                if m3:
                    real_url = m3.group(1).replace("\\/", "/")
            if real_url and re.search(r"\.(m3u8|mp4)(\?|$|#)", real_url, re.I):
                if real_url.startswith("//"):
                    real_url = "https:" + real_url
                return {"parse": 0, "url": real_url, "header": header, "jx": 0}
            # 非直链（解析服务/加密串等）：失败返回空，永不走网页播放
            return {"parse": 0, "url": "", "header": {}}
        return {"parse": 0, "url": "", "header": {}}

    def localProxy(self, params):
        return [200, "video/MP2T", None, ""]
