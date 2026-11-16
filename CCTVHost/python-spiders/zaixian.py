# -*- coding: utf-8 -*-
"""
在线 (zxzj.run / 在线之家) — MacCMS 站点爬虫
由 JAR 版 csp_Zxzj 转换而来：原 JAR 后端 www.zxzjys.com 已 301 到 www.zxzj.run。
- 首页/分类：/vodtype/<id>[-<pg>].html，stui-vodlist 结构
- 搜索：/vodsearch/<keyword>-------------.html
- 详情：/voddetail/<id>.html，播放线路为 <h3>线路名</h3> + stui-content__playlist
- 播放：/vodplay/<id>-<from>-<ep>.html，player_aaaa.url 即播放地址
  （播放地址走 ex.zxzja.com:9876 播放服务，本机无法直连验证，需手机实测）
注意：百度网盘/下载类线路不是视频流，已过滤。
"""
import re
import json
import time
import urllib.parse
import requests
from bs4 import BeautifulSoup
from base.spider import Spider


class Spider(Spider):
    name = "在线"
    base_url = "https://www.zxzj.run"
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://www.zxzj.run/",
    }
    timeout = 15

    CLASS_MAP = {
        "1": "电影",
        "2": "美剧",
        "3": "韩剧",
        "4": "日剧",
        "5": "泰剧",
        "6": "动漫",
    }

    # 不是视频流的线路（网盘/下载），详情里过滤掉
    SKIP_LINE_KEYWORDS = ("网盘", "下载", "百度", "迅雷", "磁力")

    def getName(self):
        return "在线"

    def init(self, extend=""):
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def _fetch(self, url):
        try:
            resp = self.session.get(url, timeout=self.timeout)
            resp.encoding = "utf-8"
            if resp.status_code != 200:
                return None
            return resp.text
        except Exception:
            return None

    def _fix_pic(self, url):
        if not url:
            return ""
        if url.startswith("//"):
            return "https:" + url
        if not url.startswith("http"):
            return self.base_url + url
        return url

    def _parse_list(self, html):
        """解析 stui-vodlist 列表页（首页/分类/搜索共用）。"""
        items = []
        if not html:
            return items
        soup = BeautifulSoup(html, "html.parser")
        seen = set()
        for a in soup.select("a.stui-vodlist__thumb"):
            href = a.get("href") or ""
            m = re.search(r"/voddetail/(\d+)\.html", href)
            if not m:
                continue
            vod_id = m.group(1)
            if vod_id in seen:
                continue
            seen.add(vod_id)
            title = (a.get("title") or "").strip()
            if not title:
                continue
            pic = self._fix_pic(a.get("data-original") or a.get("data-src") or "")
            remarks = ""
            box = a.find_parent("div", class_="stui-vodlist__box")
            if box is not None:
                foot = box.select_one(".stui-vodlist__detail .text")
                if foot is not None:
                    remarks = foot.get_text(strip=True)
            items.append({
                "vod_id": vod_id,
                "vod_name": title,
                "vod_pic": pic,
                "vod_remarks": remarks,
            })
        return items

    def homeContent(self, filter=False):
        result = {"class": [], "list": [], "filters": {}}
        for cid, cname in self.CLASS_MAP.items():
            result["class"].append({"type_id": cid, "type_name": cname})
        html = self._fetch(self.base_url + "/")
        result["list"] = self._parse_list(html)[:30]
        return result

    def homeVideoContent(self):
        return self.homeContent()

    def categoryContent(self, tid, pg, filter=False, extend=None):
        pg = int(pg) if str(pg).isdigit() else 1
        result = {"list": [], "page": pg, "pagecount": 1, "limit": 20, "total": 0}
        tid = str(tid)
        if tid not in self.CLASS_MAP:
            return result
        url = "%s/vodtype/%s-%d.html" % (self.base_url, tid, pg)
        html = self._fetch(url)
        result["list"] = self._parse_list(html)
        # 分页：取页面里最大的 vodtype 页码
        pagecount = pg
        if html:
            for m in re.finditer(r"/vodtype/%s-(\d+)\.html" % re.escape(tid), html):
                n = int(m.group(1))
                if n > pagecount:
                    pagecount = n
        result["pagecount"] = pagecount if pagecount > pg else pg + 1
        result["total"] = len(result["list"]) * result["pagecount"]
        return result

    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1
        result = {"list": [], "page": pg, "pagecount": 1, "limit": 20, "total": 0}
        key = (key or "").strip()
        if not key:
            return result
        q = urllib.parse.quote(key)
        if pg <= 1:
            url = "%s/vodsearch/%s-------------.html" % (self.base_url, q)
        else:
            url = "%s/vodsearch/%s----------%d---.html" % (self.base_url, q, pg)
        html = self._fetch(url)
        result["list"] = self._parse_list(html)
        pagecount = pg
        if html:
            for m in re.finditer(r"/vodsearch/%s----------(\d+)---\.html" % re.escape(q), html):
                n = int(m.group(1))
                if n > pagecount:
                    pagecount = n
        result["pagecount"] = pagecount if pagecount > pg else pg + 1
        result["total"] = len(result["list"]) * result["pagecount"]
        return result

    def detailContent(self, ids):
        vod_id = ids[0] if isinstance(ids, list) else ids
        m = re.search(r"(\d+)", str(vod_id))
        if not m:
            return {"list": []}
        vod_id = m.group(1)
        result = {"list": []}
        html = self._fetch("%s/voddetail/%s.html" % (self.base_url, vod_id))
        if not html:
            return result
        soup = BeautifulSoup(html, "html.parser")

        title = ""
        h1 = soup.find("h1")
        if h1 is not None:
            title = h1.get_text(strip=True)
        if not title:
            t = soup.find("title")
            if t is not None:
                title = t.get_text(strip=True).split("-")[0].strip()

        pic = ""
        img = soup.select_one(".stui-content__thumb img, .stui-vodlist__thumb img")
        if img is not None:
            pic = img.get("data-original") or img.get("data-src") or img.get("src") or ""
        pic = self._fix_pic(pic)

        content = ""
        desc = soup.select_one(".detail-content, .detail-sketch, .stui-content__desc")
        if desc is not None:
            content = desc.get_text(strip=True)

        actor = director = type_name = area = year = ""
        for el in soup.select(".data"):
            text = el.get_text(strip=True)
            if text.startswith("主演"):
                actor = text.replace("主演：", "").replace("主演:", "").strip()
            elif text.startswith("导演"):
                director = text.replace("导演：", "").replace("导演:", "").strip()
            elif text.startswith("类型"):
                type_name = text.replace("类型：", "").replace("类型:", "").strip()
            elif text.startswith("地区"):
                area = text.replace("地区：", "").replace("地区:", "").strip()
            elif text.startswith("年份"):
                year = text.replace("年份：", "").replace("年份:", "").strip()
            elif text.startswith("更新"):
                pass

        # 播放线路：<h3>线路名</h3> 后跟 <ul class="stui-content__playlist">
        play_from = []
        play_url = []
        for head in soup.select(".stui-vodlist__head h3"):
            line_name = head.get_text(strip=True)
            if not line_name:
                continue
            if any(k in line_name for k in self.SKIP_LINE_KEYWORDS):
                continue
            # 找到紧随其后的 playlist ul
            ul = None
            parent = head.find_parent("div", class_="stui-vodlist__head")
            if parent is not None:
                sib = parent.find_next_sibling("ul")
                if sib is not None and "stui-content__playlist" in (sib.get("class") or []):
                    ul = sib
            if ul is None:
                continue
            eps = []
            for a in ul.select("a"):
                href = a.get("href") or ""
                ep_name = a.get_text(strip=True)
                if "/vodplay/" not in href or not ep_name:
                    continue
                if not href.startswith("http"):
                    href = self.base_url + href
                eps.append("%s$%s" % (ep_name, href))
            if eps:
                play_from.append(line_name)
                play_url.append("#".join(eps))

        vod = {
            "vod_id": vod_id,
            "vod_name": title,
            "vod_pic": pic,
            "vod_actor": actor,
            "vod_director": director,
            "vod_content": content,
            "vod_area": area,
            "vod_year": year,
            "type_name": type_name,
            "vod_play_from": "$$$".join(play_from),
            "vod_play_url": "$$$".join(play_url),
        }
        result["list"].append(vod)
        return result

    def _extract_player_url(self, html):
        """从播放页提取 player_aaaa.url。"""
        if not html:
            return ""
        idx = html.find("var player_aaaa=")
        if idx < 0:
            return ""
        s = html[idx + len("var player_aaaa="):]
        depth = 0
        in_str = False
        esc = False
        end = -1
        for i, ch in enumerate(s):
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
        if end < 0:
            return ""
        try:
            j = json.loads(s[:end + 1])
        except Exception:
            return ""
        return (j.get("url") or "").strip()

    def playerContent(self, flag, video_id, vip_flags):
        result = {"parse": 0, "url": "", "header": {}}
        url = (video_id or "").strip()
        if not url:
            return result
        if not url.startswith("http"):
            url = self.base_url + url if url.startswith("/") else self.base_url + "/" + url
        # 如果已经是直链播放地址，直接返回
        if "ex.zxzja.com" in url or url.endswith(".m3u8") or url.endswith(".mp4"):
            result["url"] = url
            return result
        html = self._fetch(url)
        play_url = self._extract_player_url(html)
        if play_url:
            result["url"] = play_url
        return result
