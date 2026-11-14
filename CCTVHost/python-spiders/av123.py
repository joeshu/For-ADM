# -*- coding: utf-8 -*-
"""
123av.com/cn 爬虫（美化版）
兼容 TVBox / 影视仓 Spider 接口
列表 → 详情提取 embed → /stream?id= 拿 m3u8
"""

import re
import json
from html import unescape
from urllib.parse import quote, urljoin, urlparse

try:
    from base.spider import Spider as BaseSpider
except Exception:
    class BaseSpider:
        pass

try:
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    raise ImportError("请安装: pip install requests")


class Spider(BaseSpider):
    def __init__(self):
        self.host = "https://123av.com"
        self.lang = "/cn"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": self.host + self.lang,
        }
        self.timeout = 18
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        self.session.verify = False

    def getName(self):
        return "123AV"

    def init(self, extend=""):
        pass

    def _get(self, url):
        try:
            r = self.session.get(url, timeout=self.timeout)
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            return r.text
        except Exception as e:
            print(f"[123AV] 请求失败: {url} -> {e}")
            return ""

    def _abs(self, path):
        if not path:
            return ""
        if path.startswith("//"):
            return "https:" + path
        if path.startswith("http"):
            return path
        return urljoin(self.host, path)

    def _clean(self, t):
        if not t:
            return ""
        t = unescape(t)
        t = re.sub(r"\s+", " ", t).strip()
        return t[:120]

    def _parse_list(self, html):
        items = []
        if not html:
            return items
        seen = set()
        # 标题在 a 文本里
        for m in re.finditer(
            r'href="(/cn/v/([^"\?]+))"[^>]*>([^<]{2,150})<',
            html,
        ):
            path, slug, title = m.group(1), m.group(2), self._clean(m.group(3))
            if slug in seen or not title:
                continue
            # 过滤导航噪点
            if title in ("下一页", "上一页", "Next", "Prev") or len(title) < 3:
                continue
            seen.add(slug)
            # 封面：同 slug 的 cover
            pic = ""
            im = re.search(
                rf'(https?://icdn\.123av\.me/[^"\']+{re.escape(slug)}/cover\.(?:jpg|jpeg|webp|png)[^"\']*)',
                html,
                re.I,
            )
            if not im:
                # 在链接附近找
                snip = html[max(0, m.start() - 400): m.start() + 200]
                im = re.search(
                    r'(https?://icdn\.123av\.me/[^"\']+\.(?:jpg|jpeg|webp|png)[^"\']*)',
                    snip,
                    re.I,
                )
            if im:
                pic = im.group(1).replace("&amp;", "&")
            items.append({
                "vod_id": slug,
                "vod_name": title,
                "vod_pic": pic,
                "vod_remarks": "",
            })
        return items

    def homeContent(self, filter):
        classes = [
            {"type_id": "new", "type_name": "🆕 最新上架"},
            {"type_id": "hot", "type_name": "🔥 热门"},
            {"type_id": "recent", "type_name": "🕒 最近更新"},
            {"type_id": "all?sort=today", "type_name": "📅 今日热门"},
            {"type_id": "all?sort=week", "type_name": "📆 本周热门"},
            {"type_id": "all?sort=month", "type_name": "🗓️ 本月热门"},
            {"type_id": "censored", "type_name": "🎌 有码"},
            {"type_id": "uncensored", "type_name": "🔞 无码"},
            {"type_id": "uncensored-leaked", "type_name": "💥 无码流出"},
            # 片商
            {"type_id": "makers/fc2", "type_name": "🏢 FC2"},
            {"type_id": "makers/1pondo", "type_name": "🏢 1pondo"},
            {"type_id": "makers/caribbeancom", "type_name": "🏢 Caribbean"},
            {"type_id": "makers/heyzo", "type_name": "🏢 Heyzo"},
            {"type_id": "makers/10musume", "type_name": "🏢 10musume"},
            {"type_id": "makers/pacopacomama", "type_name": "🏢 Pacopacomama"},
            {"type_id": "makers/tokyo-hot", "type_name": "🏢 TokyoHot"},
            {"type_id": "makers/s-cute", "type_name": "🏢 S-Cute"},
            {"type_id": "makers/xxx-av", "type_name": "🏢 XXX-AV"},
            # 类型
            {"type_id": "genres/beautiful-girl", "type_name": "🌸 美少女"},
            {"type_id": "genres/big-tits", "type_name": "👙 巨乳"},
            {"type_id": "genres/married-womanhousewife", "type_name": "💍 人妻"},
            {"type_id": "genres/amateur", "type_name": "📱 素人"},
            {"type_id": "genres/creampie", "type_name": "💦 中出"},
            {"type_id": "genres/solowork", "type_name": "🎬 单体作品"},
            {"type_id": "genres/slender", "type_name": "👗 苗条"},
            {"type_id": "genres/squirting", "type_name": "🌊 潮吹"},
            {"type_id": "genres/lesbian", "type_name": "💕 百合"},
            {"type_id": "genres/anal", "type_name": "🔥 Anal"},
            {"type_id": "genres/cosplay", "type_name": "🎭 Cosplay"},
            {"type_id": "genres/cuckold-cuckolded-ntr", "type_name": "💔 NTR"},
            {"type_id": "genres/threesome-foursome", "type_name": "👥 多P"},
            {"type_id": "genres/paizuri", "type_name": "🍈 乳交"},
            {"type_id": "genres/cowgirl", "type_name": "🐎 骑乘"},
            {"type_id": "genres/uniform", "type_name": "👔 制服"},
            {"type_id": "genres/school-girl", "type_name": "🏫 女学生"},
        ]
        return {"class": classes, "filters": {}}

    def homeVideoContent(self):
        html = self._get(f"{self.host}{self.lang}/new")
        return {"list": self._parse_list(html)[:36]}

    def categoryContent(self, tid, pg, filter, extend):
        try:
            page = int(pg or 1)
        except Exception:
            page = 1
        tid = str(tid or "new")
        base = f"{self.host}{self.lang}/{tid}"
        if "?" in tid:
            url = f"{self.host}{self.lang}/{tid}&page={page}" if page > 1 else f"{self.host}{self.lang}/{tid}"
        else:
            url = f"{base}?page={page}" if page > 1 else base
        html = self._get(url)
        lst = self._parse_list(html)
        return {
            "list": lst,
            "page": page,
            "pagecount": 999 if len(lst) >= 10 else page,
            "limit": 24,
            "total": 99999 if len(lst) >= 10 else len(lst),
        }

    def detailContent(self, ids):
        if not ids:
            return {"list": []}
        slug = str(ids[0]).strip("/")
        html = self._get(f"{self.host}{self.lang}/v/{slug}")
        if not html:
            return {"list": []}

        name = ""
        t = re.search(r"<title>([^<]+)", html)
        if t:
            name = self._clean(re.split(r"\s*[|\-—]\s*123", t.group(1))[0])
        # 更准确的 h1 / 标题
        h1 = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
        if h1:
            name = self._clean(h1.group(1)) or name

        pic = ""
        im = re.search(
            rf'(https?://icdn\.123av\.me/[^"\']+{re.escape(slug)}/cover\.(?:jpg|jpeg|webp|png)[^"\']*)',
            html,
            re.I,
        )
        if not im:
            im = re.search(r'(https?://icdn\.123av\.me/[^"\']+/cover\.(?:jpg|jpeg|webp|png)[^"\']*)', html, re.I)
        if im:
            pic = im.group(1).replace("&amp;", "&")

        content = ""
        desc = re.search(r'<meta name="description" content="([^"]+)"', html)
        if desc:
            content = self._clean(desc.group(1))[:400]

        # 解析 player(JSON.parse('[...]'))
        plays = []
        pm = re.search(
            r'player\(\s*JSON\.parse\(\s*\'((?:\\.|[^\'\\])*)\'\s*\)',
            html,
        )
        if not pm:
            pm = re.search(
                r'player\(\s*JSON\.parse\(\s*"((?:\\.|[^"\\])*)"\s*\)',
                html,
            )
        episodes = []
        if pm:
            raw = pm.group(1)
            # unicode escape in HTML
            try:
                raw2 = raw.encode("utf-8").decode("unicode_escape")
            except Exception:
                raw2 = raw
            raw2 = raw2.replace("\\/", "/").replace('\\"', '"')
            try:
                episodes = json.loads(raw2)
            except Exception:
                # 再试一次 unescape
                try:
                    episodes = json.loads(unescape(raw2))
                except Exception as e:
                    print(f"[123AV] episodes parse fail: {e}")
                    episodes = []

        if not isinstance(episodes, list):
            episodes = []

        for i, ep in enumerate(episodes):
            if not isinstance(ep, dict):
                continue
            label = str(ep.get("name") or ep.get("number") or (i + 1))
            url = ep.get("url") or ""
            if not url:
                continue
            plays.append(f"线路{label}${slug}@@{url}")

        if not plays:
            plays.append(f"默认${slug}@@")

        # 番号备注
        code = slug.upper().replace("-UNCENSORED-LEAKED", "").replace("-UNCENSORED", "")
        return {"list": [{
            "vod_id": slug,
            "vod_name": name or slug,
            "vod_pic": pic,
            "vod_content": content,
            "vod_actor": "",
            "vod_director": "",
            "vod_area": "日本",
            "vod_year": "",
            "vod_remarks": code,
            "vod_play_from": "123AV",
            "vod_play_url": "#".join(plays),
        }]}

    def searchContent(self, key, quick=False, pg="1"):
        try:
            page = int(pg or 1)
        except Exception:
            page = 1
        q = quote(key.strip())
        url = f"{self.host}{self.lang}/search?keyword={q}"
        if page > 1:
            url += f"&page={page}"
        html = self._get(url)
        lst = self._parse_list(html)
        return {
            "list": lst,
            "page": page,
            "pagecount": 999 if len(lst) >= 10 else page,
            "limit": 24,
            "total": 99999 if len(lst) >= 10 else len(lst),
        }

    def _resolve_embed(self, embed_url):
        """embed 页 → /stream?id=hash → m3u8"""
        if not embed_url:
            return ""
        try:
            # hash 在 /e/XXXX
            m = re.search(r"/e/([A-Za-z0-9_]+)", embed_url)
            if not m:
                return ""
            hash_id = m.group(1)
            parsed = urlparse(embed_url)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            # 带上原 query（poster 等）
            stream_api = f"{origin}/stream?id={hash_id}"
            if parsed.query:
                stream_api = f"{origin}/stream?{parsed.query}&id={hash_id}"
            r = self.session.get(
                stream_api,
                timeout=self.timeout,
                headers={
                    **self.headers,
                    "Accept": "application/json",
                    "Referer": embed_url,
                },
            )
            data = r.json()
            return (data.get("media") or {}).get("stream") or ""
        except Exception as e:
            print(f"[123AV] resolve embed fail: {e}")
            return ""

    def playerContent(self, flag, id, vipFlags=None):
        """
        id: slug@@embed_url  或 纯 slug（再拉详情）
        """
        raw = str(id or "")
        slug, embed = raw, ""
        if "@@" in raw:
            slug, embed = raw.split("@@", 1)

        if not embed:
            # 重新取详情
            det = self.detailContent([slug])
            play = (det.get("list") or [{}])[0].get("vod_play_url") or ""
            if "@@" in play:
                embed = play.split("#")[0].split("@@", 1)[-1]

        m3u8 = self._resolve_embed(embed) if embed else ""
        if not m3u8:
            return {
                "parse": 1,
                "url": f"{self.host}{self.lang}/v/{slug}",
                "header": json.dumps(self.headers, ensure_ascii=False),
            }

        # 取 embed 域名作 Referer
        ref = embed or self.host
        return {
            "parse": 0,
            "url": m3u8,
            "header": json.dumps({
                "User-Agent": self.headers["User-Agent"],
                "Referer": ref,
                "Origin": urlparse(ref).scheme + "://" + urlparse(ref).netloc if "://" in ref else self.host,
            }, ensure_ascii=False),
        }

    def isVideoFormat(self, url):
        return bool(re.search(r"\.(m3u8|mp4)(\?|$)", str(url), re.I))

    def manualVideoCheck(self):
        return False

    def destroy(self):
        pass


if __name__ == "__main__":
    s = Spider()
    print("cats", [c["type_name"] for c in s.homeContent(False)["class"][:8]])
    hv = s.homeVideoContent()
    print("home", len(hv["list"]), hv["list"][0] if hv["list"] else None)
    if hv["list"]:
        slug = hv["list"][0]["vod_id"]
        d = s.detailContent([slug])["list"][0]
        print("detail", d["vod_name"][:50], d["vod_remarks"])
        print("play_url", (d["vod_play_url"] or "")[:80])
        if "@@" in (d["vod_play_url"] or ""):
            pid = d["vod_play_url"].split("#")[0].split("$", 1)[-1]
            pr = s.playerContent("123AV", pid)
            print("m3u8", (pr.get("url") or "")[:100])
