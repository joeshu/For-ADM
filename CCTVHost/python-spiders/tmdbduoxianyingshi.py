# -*- coding: utf-8 -*-

import sys
import os
import re
import json
import time
import gzip
import ssl
import html as html_lib
import threading
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.append('..')
try:
    from base.spider import Spider as BaseSpider
except ImportError:
    BaseSpider = object

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
      "Mobile/15E148 Safari/604.1")

TMDB_API = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p"
DEFAULT_KEY = "7507cde1025c02b8cf583894e7b30cc4"
TIMEOUT = 15
PAGE_SIZE = 20

SITES = [
    {"name": "魔都资源", "host": "https://www.mdzyapi.com/api.php/provide/vod/", "backup": []},
    {"name": "丫丫资源", "host": "https://api.yyzy-tv.vip/inc/apijson.php", "backup": []},
    {"name": "量子资源", "host": "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/", "backup": ["https://cj.lziapi.com/api.php/provide/vod/"]},
    {"name": "母鸡资源", "host": "https://mujiziyuan00.com/api.php/provide/vod/", "backup": []},
    {"name": "非凡资源", "host": "https://api.ffzyapi.com/api.php/provide/vod/", "backup": ["http://cj.ffzyapi.com/api.php/provide/vod/"]},
    {"name": "360资源", "host": "https://360zy.com/api.php/provide/vod/", "backup": []},
    {"name": "红牛资源", "host": "https://www.hongniuzy3.com/api.php/provide/vod/", "backup": ["https://hongniuzy2.com/api.php/provide/vod/"]},
    {"name": "百度资源", "host": "https://api.apibdzy.com/api.php/provide/vod/", "backup": []},
    {"name": "爱旦资源", "host": "https://lovedan.net/api.php/provide/vod/", "backup": []},
    {"name": "爱奇艺资源", "host": "https://iqiyizyapi.com/api.php/provide/vod/", "backup": []},
    {"name": "最大资源", "host": "http://zuidazy.me/api.php/provide/vod/", "backup": []},
    {"name": "蘑菇资源", "host": "https://www.5o5k.com/api.php/provide/vod/", "backup": []},
    {"name": "星球资源", "host": "http://www.ysxq.cc/api.php/provide/vod/", "backup": []},
    {"name": "极速资源", "host": "https://jszyapi.com/api.php/provide/vod/from/jsm3u8/at/json", "backup": []},
    {"name": "金鹰资源", "host": "https://jinyingzy.com/api.php/provide/vod/", "backup": []},
    {"name": "海豚资源", "host": "https://hhzyapi.com/api.php/provide/vod/", "backup": []},
    {"name": "新浪资源", "host": "https://api.xinlangapi.com/xinlangapi.php/provide/vod/", "backup": []},
    {"name": "暴风资源", "host": "https://bfzyapi.com/api.php/provide/vod/", "backup": []},
    {"name": "猫眼资源", "host": "https://api.maoyanapi.top/api.php/provide/vod/", "backup": []},
    {"name": "U酷资源", "host": "https://api.ukuapi88.com/api.php/provide/vod/", "backup": []},
    {"name": "电影天堂", "host": "http://caiji.dyttzyapi.com/api.php/provide/vod/", "backup": []},
]

OFFLINE_SITES = [
    {"name": "厂长资源", "host": "https://api.changzhang.tv/api.php/provide/vod/", "reason": "域名不通"},
    {"name": "闪电资源", "host": "https://xsd.sdzyapi.com/api.php/provide/vod/", "reason": "返回非JSON"},
    {"name": "索尼资源", "host": "https://suoniapi.com/api.php/provide/vod/", "reason": "禁 wd 搜索"},
    {"name": "牛牛资源", "host": "https://api.niuniuzy.me/api.php/provide/vod/", "reason": "返回非JSON"},
    {"name": "无尽资源", "host": "https://api.wujinapi.me/api.php/provide/vod/", "reason": "HTTP 错误"},
    {"name": "快车资源", "host": "https://caiji.kuaichezy.org/api.php/provide/vod/", "reason": "返回非JSON"},
    {"name": "速播资源", "host": "https://subocaiji.com/api.php/provide/vod/from/subyun/at/json/", "reason": "无m3u8线路"},
    {"name": "茅台资源", "host": "https://caiji.maotaizy.cc/api.php/provide/vod/", "reason": "域名不通"},
    {"name": "樱花资源", "host": "https://m3u8.apiyhzy.com/api.php/provide/vod/", "reason": "HTTP 错误"},
    {"name": "无水印资源", "host": "https://api.wsyzy.net/api.php/provide/vod/", "reason": "返回非JSON"},
    {"name": "天涯资源", "host": "https://tyyszyapi.com/api.php/provide/vod/", "reason": "返回非JSON"},
    {"name": "天空资源", "host": "https://api.tiankongapi.com/api.php/provide/vod/", "reason": "域名失效"},
    {"name": "八戒资源", "host": "https://cj.bajiezy.xyz/api.php/provide/vod/", "reason": "域名失效"},
    {"name": "快看资源", "host": "https://kuaikan-api.com/api.php/provide/vod/", "reason": "域名失效"},
    {"name": "1080资源", "host": "https://api.1080zyku.com/api.php/provide/vod/", "reason": "仅XML无播放地址"},
]

CLASSES = [
    {"type_id": "mv_pop", "type_name": "热门电影"},
    {"type_id": "mv_new", "type_name": "最新电影"},
    {"type_id": "mv_top", "type_name": "高分电影"},
    {"type_id": "mv_g28", "type_name": "动作片"},
    {"type_id": "mv_g35", "type_name": "喜剧片"},
    {"type_id": "mv_g878", "type_name": "科幻片"},
    {"type_id": "mv_g27", "type_name": "恐怖片"},
    {"type_id": "mv_g10749", "type_name": "爱情片"},
    {"type_id": "mv_g16", "type_name": "动画电影"},
    {"type_id": "mv_g9648", "type_name": "悬疑片"},
    {"type_id": "mv_g80", "type_name": "犯罪片"},
    {"type_id": "mv_g18", "type_name": "剧情片"},
    {"type_id": "mv_g10752", "type_name": "战争片"},
    {"type_id": "tv_pop", "type_name": "热门剧集"},
    {"type_id": "tv_new", "type_name": "最新剧集"},
    {"type_id": "tv_top", "type_name": "高分剧集"},
    {"type_id": "tv_cn", "type_name": "国产剧"},
    {"type_id": "tv_jpkr", "type_name": "日韩剧"},
    {"type_id": "tv_us", "type_name": "欧美剧"},
    {"type_id": "tv_g16", "type_name": "动画剧"},
    {"type_id": "tv_g9648", "type_name": "悬疑剧"},
    {"type_id": "tv_g80", "type_name": "犯罪剧"},
]


def _norm(s):
    if not s:
        return ""
    t = html_lib.unescape(str(s)).lower()
    t = t.replace("（", "(").replace("）", ")").replace("：", ":").replace("　", " ")
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)|\【[^】]*\】", "", t)
    t = re.sub(r"第[一二三四五六七八九十\d]+季|season\s*\d+|s\d{1,2}", "", t)
    t = re.sub(r"[^0-9a-z\u4e00-\u9fff]", "", t)
    return t


def _year(s):
    m = re.search(r"(19|20)\d{2}", str(s or ""))
    return int(m.group(0)) if m else 0


class Spider(BaseSpider):
    def __init__(self):
        self.headers = {
            "User-Agent": UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "identity",
        }
        self.playHeaders = {
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        self.key = DEFAULT_KEY
        self.sites = [dict(s) for s in SITES]
        self.imgSize = "w500"
        self.proxy = ""
        self.opener = None
        self._cache = {}
        self._lock = threading.Lock()
        self._last_err = ""
        self._site_state = {}
        self.softWait = 6.0
        self.maxLines = 8
        self.probeLines = True
        self.workers = 6
        self.probeWait = 3.5

    def getName(self):
        return "TMDB多线影视"

    def init(self, extend=""):
        self.headers = {
            "User-Agent": UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "identity",
        }
        self.playHeaders = {
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        self.key = DEFAULT_KEY
        self.sites = [dict(s) for s in SITES]
        self.imgSize = "w500"
        self.proxy = ""
        self._cache = {}
        self._last_err = ""
        self._site_state = {}
        self.softWait = 6.0
        self.maxLines = 8
        self.probeLines = True
        self.workers = 6
        self.probeWait = 3.5
        if isinstance(extend, dict):
            if extend.get("tmdb_key"):
                self.key = str(extend["tmdb_key"]).strip()
            if extend.get("img_size"):
                self.imgSize = str(extend["img_size"]).strip()
            if extend.get("workers"):
                try:
                    self.workers = max(2, int(extend["workers"]))
                except Exception:
                    pass
            if "probe" in extend:
                self.probeLines = bool(extend.get("probe"))
            if extend.get("max_lines"):
                try:
                    self.maxLines = max(1, int(extend["max_lines"]))
                except Exception:
                    pass
            if extend.get("proxy"):
                self.proxy = str(extend["proxy"]).strip().rstrip("/")
            raw = extend.get("sites")
            if isinstance(raw, list) and raw:
                got = []
                for it in raw:
                    if isinstance(it, dict) and it.get("host"):
                        got.append({
                            "name": str(it.get("name") or "采集源"),
                            "host": str(it["host"]).rstrip("/"),
                            "backup": [str(x).rstrip("/") for x in (it.get("backup") or [])],
                            "flag": str(it.get("flag") or "m3u8"),
                        })
                if got:
                    self.sites = got
            elif isinstance(raw, str) and raw.strip():
                got = []
                for line in raw.split(","):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split("|")
                    got.append({
                        "name": parts[1] if len(parts) > 1 else "采集源",
                        "host": parts[0].rstrip("/"),
                        "backup": [],
                        "flag": "m3u8",
                    })
                if got:
                    self.sites = got
        elif extend and str(extend).strip().startswith("http"):
            self.proxy = str(extend).strip().rstrip("/")
        self._init_opener()

    def _init_opener(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        handlers = [urllib.request.HTTPSHandler(context=ctx)]
        p = self.proxy or os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY")
        if p:
            handlers.append(urllib.request.ProxyHandler({"http": p, "https": p}))
        self.opener = urllib.request.build_opener(*handlers)

    def getDependence(self):
        return []

    def _wrap(self, url):
        if self.proxy and url.startswith("http") and "tmdb.org" not in url:
            return self.proxy + "/" + url
        return url

    def _fetch(self, url, timeout=TIMEOUT):
        target = self._wrap(url)
        req = urllib.request.Request(target, headers=self.headers)
        try:
            with self.opener.open(req, timeout=timeout) as r:
                raw = r.read()
                if raw[:2] == b"\x1f\x8b":
                    try:
                        raw = gzip.decompress(raw)
                    except Exception:
                        pass
                return r.status, raw
        except urllib.error.HTTPError as e:
            body = b""
            try:
                body = e.read()[:2000]
            except Exception:
                pass
            self._last_err = "HTTP %s %s" % (e.code, url[:90])
            return e.code, body
        except Exception as e:
            self._last_err = "%s %s" % (type(e).__name__, url[:90])
            return 0, b""

    def _json(self, url, timeout=TIMEOUT):
        code, raw = self._fetch(url, timeout)
        if not raw:
            return None
        try:
            return json.loads(raw.decode("utf-8", "ignore"))
        except Exception:
            self._last_err = "JSON解析失败 %s" % url[:90]
            return None

    def _tmdb(self, path, params=None, timeout=TIMEOUT):
        p = {"api_key": self.key, "language": "zh-CN"}
        if params:
            p.update(params)
        url = TMDB_API + path + "?" + urllib.parse.urlencode(p)
        data = self._json(url, timeout)
        if data is None:
            p["language"] = "en-US"
            url = TMDB_API + path + "?" + urllib.parse.urlencode(p)
            data = self._json(url, timeout)
        return data

    def _img(self, path, size=None):
        if not path:
            return ""
        p = str(path).strip()
        if p.startswith("http"):
            return p
        return "%s/%s%s" % (TMDB_IMG, size or self.imgSize, p)

    def _cached(self, key, ttl, fn):
        now = time.time()
        hit = self._cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
        val = fn()
        if val:
            with self._lock:
                self._cache[key] = (now, val)
        return val

    def _discover(self, tid, page):
        p = {"page": page, "include_adult": "false"}
        kind = "movie" if tid.startswith("mv") else "tv"
        sort = "popularity.desc"
        if tid.endswith("_new"):
            sort = "primary_release_date.desc" if kind == "movie" else "first_air_date.desc"
            p["vote_count.gte"] = "5"
        elif tid.endswith("_top"):
            sort = "vote_average.desc"
            p["vote_count.gte"] = "500" if kind == "movie" else "200"
        elif tid.endswith("_pop"):
            p["vote_count.gte"] = "30" if kind == "movie" else "10"
        elif tid == "tv_cn":
            p["with_origin_country"] = "CN"
            p["vote_count.gte"] = "5"
        elif tid == "tv_jpkr":
            p["with_origin_country"] = "JP|KR"
            p["vote_count.gte"] = "5"
        elif tid == "tv_us":
            p["with_origin_country"] = "US"
            p["vote_count.gte"] = "20"
        else:
            m = re.match(r"^(mv|tv)_g(\d+)$", tid)
            if m:
                p["with_genres"] = m.group(2)
                p["vote_count.gte"] = "20" if kind == "movie" else "5"
        p["sort_by"] = sort
        return self._tmdb("/discover/" + kind, p)

    def _card(self, it, kind):
        if kind == "movie":
            title = it.get("title") or it.get("original_title") or ""
            date = it.get("release_date") or ""
        else:
            title = it.get("name") or it.get("original_name") or ""
            date = it.get("first_air_date") or ""
        vote = it.get("vote_average") or 0
        try:
            vote = round(float(vote), 1)
        except Exception:
            vote = 0
        prefix = "m" if kind == "movie" else "t"
        remark = "⭐%s" % vote if vote else "暂无评分"
        return {
            "vod_id": "%s%s" % (prefix, it.get("id")),
            "vod_name": title,
            "vod_pic": self._img(it.get("poster_path")),
            "vod_remarks": remark,
            "vod_year": date[:4],
            "vod_actor": "",
            "vod_content": (it.get("overview") or "").strip(),
        }

    def homeContent(self, filter=False):
        return {"class": [dict(c) for c in CLASSES], "filters": {}}

    def homeVideoContent(self):
        return self.categoryContent("mv_pop", 1, None, None)

    def categoryContent(self, tid="", page=None, filter=None, ext=None, pg=None, extend=None, **kw):
        if pg is not None:
            page = pg
        tid = (tid or "").strip() or "mv_pop"
        try:
            pn = max(int(page or 1), 1)
        except Exception:
            pn = 1
        try:
            if not re.match(r"^(mv|tv)_[a-z0-9]+$", tid):
                return {"list": [self._diag("未知分类", tid, "")], "page": pn,
                        "pagecount": 1, "limit": PAGE_SIZE, "total": 1}
            data = self._discover(tid, pn)
            if not data or not isinstance(data, dict):
                return {"list": [self._diag("TMDB 无返回", tid, self._last_err)], "page": pn,
                        "pagecount": pn, "limit": PAGE_SIZE, "total": 1}
            kind = "movie" if tid.startswith("mv") else "tv"
            items = [self._card(x, kind) for x in (data.get("results") or [])]
            items = [x for x in items if x["vod_name"]]
            total = int(data.get("total_results") or 0)
            pages = int(data.get("total_pages") or pn)
            if pages > 500:
                pages = 500
            if not items:
                return {"list": [self._diag("该分类无结果", tid, "第%d页" % pn)], "page": pn,
                        "pagecount": pn, "limit": PAGE_SIZE, "total": 1}
            return {"list": items, "page": pn, "pagecount": pages,
                    "limit": PAGE_SIZE, "total": total}
        except Exception as e:
            return {"list": [self._diag("分类异常", tid, str(e)[:60])], "page": pn,
                    "pagecount": pn, "limit": PAGE_SIZE, "total": 1}

    def _diag(self, title, tid, msg):
        return {
            "vod_id": "diag",
            "vod_name": "[诊断] %s" % title,
            "vod_pic": "",
            "vod_remarks": "分类%s | %s" % (tid, msg or "无详情"),
        }

    def _clean_url(self, u):
        u = str(u or "").strip()
        if not u:
            return ""
        if u.startswith("//"):
            u = "https:" + u
        if not u.startswith("http"):
            return ""
        return urllib.parse.quote(u, safe=":/?&=%#@!$'()*+,;~[]")

    def _api(self, prefix, wd):
        base = str(prefix).split("?")[0].rstrip("/")
        q = urllib.parse.quote(str(wd))
        data = self._json("%s?ac=videolist&wd=%s" % (base, q), 7)
        if not isinstance(data, dict):
            data = self._json("%s?ac=detail&wd=%s" % (base, q), 7)
        if not isinstance(data, dict):
            return []
        return data.get("list") or []

    def _site_query(self, site, wd):
        lst = self._api(site["host"], wd)
        if lst:
            return lst
        for h in (site.get("backup") or []):
            if not h:
                continue
            lst = self._api(h, wd)
            if lst:
                return lst
        return []

    def _pick_eps(self, item, site):
        froms = str(item.get("vod_play_from") or "").split("$$$")
        groups = str(item.get("vod_play_url") or "").split("$$$")
        best = ""
        best_score = -1
        for i, f in enumerate(froms):
            if i >= len(groups):
                continue
            g = groups[i]
            eps = [x for x in g.split("#") if "$" in x]
            if not eps:
                continue
            score = len(eps)
            if "m3u8" in f.lower():
                score += 1000
            if score > best_score:
                best_score = score
                best = g
        if not best and groups:
            best = groups[0]
        out = []
        for part in [x for x in best.split("#") if "$" in x]:
            name, _, url = part.partition("$")
            cu = self._clean_url(url)
            if cu:
                out.append((name.strip() or "正片", cu))
        return out

    def _score(self, want, want2, year, item):
        name = str(item.get("vod_name") or "")
        n = _norm(name)
        if not n:
            return -1
        a = _norm(want)
        b = _norm(want2) if want2 else ""
        year2 = _year(item.get("vod_year")) or _year(name) or _year(item.get("vod_pubdate"))
        s = -1
        if a and n == a:
            s = 100
        elif b and n == b:
            s = 95
        elif a and (a in n or n in a) and min(len(a), len(n)) >= 2:
            s = 60
        elif b and (b in n or n in b) and min(len(b), len(n)) >= 2:
            s = 55
        if s < 0:
            return -1
        if year and year2:
            d = abs(year - year2)
            if d == 0:
                s += 30
            elif d == 1:
                s += 12
            elif d <= 2:
                s += 2
            else:
                s -= 25
        elif year and not year2:
            s -= 3
        return s

    def _search_one(self, site, wd, want0, want1, year):
        lst = self._site_query(site, wd)
        scored = []
        for it in lst:
            sc = self._score(want0, want1, year, it)
            if sc >= 40:
                scored.append((sc, it))
        if not scored:
            return None
        scored.sort(key=lambda x: -x[0])
        best = None
        for sc, it in scored[:3]:
            eps = self._pick_eps(it, site)
            if not eps:
                continue
            if best is None or sc > best["score"]:
                best = {"score": sc, "eps": eps, "name": it.get("vod_name")}
        if not best:
            return None
        return {
            "site": site["name"],
            "eps": best["eps"],
            "score": best["score"],
            "title": best["name"],
        }

    def _run_batch(self, batch, wd, want0, want1, year, wait, out, tag):
        if not batch or not wd:
            return []
        ex = ThreadPoolExecutor(max_workers=min(self.workers, max(1, len(batch))))
        futs = {ex.submit(self._search_one, s, wd, want0, want1, year): s for s in batch}
        rest = []
        try:
            for f in as_completed(futs, timeout=wait):
                s = futs[f]
                try:
                    r = f.result()
                except Exception:
                    self._site_state[s["name"]] = "异常"
                    continue
                if r:
                    self._site_state[s["name"]] = tag
                    out.append(r)
                else:
                    self._site_state[s["name"]] = "无匹配"
                if len(out) >= self.maxLines:
                    break
        except Exception:
            pass
        finally:
            for f, s in futs.items():
                if self._site_state.get(s["name"]) not in (tag, "无匹配", "异常"):
                    self._site_state[s["name"]] = "超时"
                    rest.append(s)
            ex.shutdown(wait=False)
        return rest

    def _search_sites(self, wants, year):
        out = []
        if not wants:
            return out
        want0 = wants[0]
        want1 = wants[1] if len(wants) > 1 else ""
        rest = self._run_batch(self.sites, wants[0], want0, want1, year, self.softWait, out, "命中")
        if not out and len(wants) > 1:
            alt = (rest or self.sites)[:12]
            self._run_batch(alt, wants[1], want0, want1, year, 3.0, out, "原名命中")
        rank = {}
        for i, it in enumerate(self.sites):
            rank[it["name"]] = i
        out.sort(key=lambda x: (rank.get(x["site"], 99), -x["score"]))
        return out

    def _pull(self, u, timeout=4, limit=400000):
        try:
            req = urllib.request.Request(u, headers=self.headers)
            with self.opener.open(req, timeout=timeout) as r:
                if r.status not in (200, 206):
                    return r.status, b""
                return r.status, r.read(limit)
        except urllib.error.HTTPError as e:
            return e.code, b""
        except Exception:
            return 0, b""

    def _line_ok(self, h):
        try:
            u = h["eps"][0][1]
            code, raw = self._pull(u, 4, 8192)
            if code != 200 or not raw or b"#EXTM3U" not in raw[:400]:
                return False
            text = raw.decode("utf-8", "ignore")
            segs = [x.strip() for x in text.splitlines() if x.strip() and not x.strip().startswith("#")]
            if not segs:
                return False
            first = urllib.parse.urljoin(u, segs[0])
            c2, raw2 = self._pull(first, 4, 8192)
            if c2 not in (200, 206) or not raw2:
                return False
            if b"#EXTM3U" not in raw2[:400]:
                return True
            t2 = raw2.decode("utf-8", "ignore")
            segs2 = [x.strip() for x in t2.splitlines() if x.strip() and not x.strip().startswith("#")]
            if not segs2:
                return False
            c3, raw3 = self._pull(urllib.parse.urljoin(first, segs2[0]), 2, 2048)
            return c3 in (200, 206) and bool(raw3)
        except Exception:
            return False

    def _reorder(self, hits):
        if not hits or not self.probeLines or len(hits) < 2:
            return hits
        head = hits[:5]
        tail = hits[5:]
        good, bad = [], []
        ex = ThreadPoolExecutor(max_workers=len(head))
        futs = {ex.submit(self._line_ok, h): h for h in head}
        try:
            for f in as_completed(futs, timeout=self.probeWait):
                h = futs[f]
                try:
                    (good if f.result() else bad).append(h)
                except Exception:
                    bad.append(h)
        except Exception:
            pass
        finally:
            for f, h in futs.items():
                if h not in good and h not in bad:
                    bad.append(h)
            ex.shutdown(wait=False)
        if not good:
            return hits
        rank = {}
        for i, it in enumerate(self.sites):
            rank[it["name"]] = i
        good.sort(key=lambda x: (rank.get(x["site"], 99), -x["score"]))
        bad.sort(key=lambda x: (rank.get(x["site"], 99), -x["score"]))
        return (good + tail + bad)[:self.maxLines]

    def detailContent(self, ids):
        raw = ""
        if isinstance(ids, (list, tuple)) and ids:
            raw = str(ids[0])
        elif ids:
            raw = str(ids)
        raw = raw.strip().split("?")[0]
        m = re.match(r"^([mt])(\d+)$", raw)
        if not m:
            return {"list": [{"vod_id": raw or "x", "vod_name": "[诊断] 无法识别的ID",
                              "vod_play_from": "TMDB", "vod_play_url": "",
                              "vod_content": "详情ID应为 m<数字> 或 t<数字>，收到：%s" % raw}]}
        kind = "movie" if m.group(1) == "m" else "tv"
        mid = m.group(2)
        cache_key = "d:%s:%s" % (kind, mid)
        hit = self._cache.get(cache_key)
        if hit and time.time() - hit[0] < 1800:
            return {"list": [hit[1]]}

        info = self._tmdb("/%s/%s" % (kind, mid), {"append_to_response": "credits"})
        if not info or not isinstance(info, dict):
            return {"list": [{"vod_id": raw, "vod_name": "[诊断] TMDB 详情失败",
                              "vod_play_from": "TMDB", "vod_play_url": "",
                              "vod_content": "键 %s | err %s" % (self.key[:6] + "***", self._last_err)}]}

        if kind == "movie":
            title = info.get("title") or info.get("original_title") or ""
            orig = info.get("original_title") or ""
            date = info.get("release_date") or ""
            runtime = info.get("runtime") or 0
            seasons = 0
        else:
            title = info.get("name") or info.get("original_name") or ""
            orig = info.get("original_name") or ""
            date = info.get("first_air_date") or ""
            runtime = (info.get("episode_run_time") or [0])[0] if info.get("episode_run_time") else 0
            seasons = info.get("number_of_seasons") or 0

        year = _year(date)
        overview = (info.get("overview") or "").strip()
        credits = info.get("credits") or {}
        cast = credits.get("cast") or []
        crew = credits.get("crew") or []
        actors = []
        for c in cast[:12]:
            nm = c.get("name") or ""
            role = c.get("character") or ""
            if nm:
                actors.append("%s(%s)" % (nm, role) if role else nm)
        directors = [c.get("name") for c in crew if c.get("job") == "Director" and c.get("name")]
        directors = list(dict.fromkeys(directors))[:3]
        genres = [g.get("name") for g in (info.get("genres") or []) if g.get("name")]
        countries = [c.get("name") for c in (info.get("production_countries") or []) if c.get("name")]
        if not countries:
            countries = [str(x) for x in (info.get("origin_country") or [])]
        langs = [l.get("name") for l in (info.get("spoken_languages") or []) if l.get("name")]
        vote = info.get("vote_average") or 0
        try:
            vote = round(float(vote), 1)
        except Exception:
            vote = 0
        votes = info.get("vote_count") or 0

        wants = [title, orig]
        wants = [w for w in dict.fromkeys([str(x).strip() for x in wants if x]) if w]
        hits = self._search_sites(wants, year)
        hits = self._reorder(hits)

        play_from = []
        play_url = []
        for h in hits:
            eps = h["eps"]
            play_from.append(h["site"])
            play_url.append("#".join("%s$%s" % (n, u) for n, u in eps))

        if not play_from:
            state = " ".join("%s:%s" % (k, v) for k, v in list(self._site_state.items())[:6])
            play_from = ["无可用线路"]
            play_url = ["诊断$%s" % ""]
            remark_note = "采集站均未命中（%s）" % (state or "无响应")
        else:
            remark_note = "⭐%s" % vote if vote else "已匹配"

        content_parts = []
        if overview:
            content_parts.append(overview)
        meta = []
        if genres:
            meta.append("类型：" + "/".join(genres))
        if year:
            meta.append("年份：%d" % year)
        if countries:
            meta.append("地区：" + "/".join(countries[:3]))
        if directors:
            meta.append("导演：" + "/".join(directors))
        if actors:
            meta.append("主演：" + "、".join(actors[:6]))
        if runtime:
            meta.append("片长：%d分钟" % runtime)
        if seasons:
            meta.append("季数：%d" % seasons)
        if votes:
            meta.append("TMDB评分：%s（%d人）" % (vote, votes))
        if hits:
            meta.append("可用线路：" + "、".join("%s(%d集)" % (h["site"], len(h["eps"])) for h in hits))
            meta.append("建议优先尝试：" + hits[0]["site"] + "（已排在其他线路之前）")
        if content_parts or meta:
            content = "\n".join(content_parts + meta)
        else:
            content = "TMDB 无简介"

        vod = {
            "vod_id": raw,
            "vod_name": title or ("TMDB %s" % mid),
            "vod_pic": self._img(info.get("poster_path")) or self._img(info.get("backdrop_path")),
            "vod_bg": self._img(info.get("backdrop_path"), "w1280"),
            "vod_remarks": remark_note,
            "vod_year": str(year) if year else "",
            "vod_area": "/".join(countries[:2]),
            "vod_lang": "/".join(langs[:2]),
            "vod_actor": "、".join(actors),
            "vod_director": "、".join(directors),
            "vod_content": content,
            "vod_play_from": "$$$".join(play_from),
            "vod_play_url": "$$$".join(play_url),
            "vod_duration": str(runtime) if runtime else "",
        }
        if play_from == ["无可用线路"]:
            vod["vod_play_url"] = ""
        with self._lock:
            self._cache[cache_key] = (time.time(), vod)
        return {"list": [vod]}

    def searchContent(self, key="", quick=False, page="1", pg=None, **kw):
        if pg is not None:
            page = pg
        try:
            pn = max(int(page or 1), 1)
        except Exception:
            pn = 1
        kwd = str(key or "").strip()
        if not kwd:
            return {"list": [], "page": pn, "pagecount": pn, "limit": PAGE_SIZE, "total": 0}
        data = self._tmdb("/search/multi", {"query": kwd, "page": pn, "include_adult": "false"})
        if not data or not isinstance(data, dict):
            return {"list": [self._diag("搜索失败", kwd, self._last_err)], "page": pn,
                    "pagecount": pn, "limit": PAGE_SIZE, "total": 1}
        items = []
        for x in (data.get("results") or []):
            mt = x.get("media_type")
            if mt == "movie":
                items.append(self._card(x, "movie"))
            elif mt == "tv":
                items.append(self._card(x, "tv"))
        items = [x for x in items if x["vod_name"]]
        total = int(data.get("total_results") or 0)
        pages = int(data.get("total_pages") or pn)
        if pages > 500:
            pages = 500
        if not items:
            return {"list": [self._diag("搜索无结果", kwd, "TMDB")], "page": pn,
                    "pagecount": pn, "limit": PAGE_SIZE, "total": 1}
        return {"list": items, "page": pn, "pagecount": pages, "limit": PAGE_SIZE, "total": total}

    def playerContent(self, flag="", pid=None, vipFlags=None, id=None, **kw):
        if pid is None:
            pid = id
        url = str(pid or "").strip()
        if not url or not url.startswith("http"):
            return {"parse": 1, "url": url, "header": self.headers, "jx": 1}
        low = url.lower()
        if ".m3u8" in low or ".mp4" in low:
            return {"parse": 0, "url": self._clean_url(url), "header": self.playHeaders, "jx": 0}
        if "/share/" in low:
            real = self._resolve_share(url)
            if real:
                return {"parse": 0, "url": real, "header": self.playHeaders, "jx": 0}
            return {"parse": 1, "url": url, "header": self.playHeaders, "jx": 1}
        return {"parse": 0, "url": self._clean_url(url), "header": self.playHeaders, "jx": 0}

    def _resolve_share(self, url):
        code, raw = self._fetch(url, 12)
        if code != 200 or not raw:
            return ""
        text = raw.decode("utf-8", "ignore")
        m = re.search(r'var\s+main\s*=\s*["\']?([^"\';]{5,200}?\.m3u8[^"\';]*)', text)
        if not m:
            m = re.search(r'["\'](/[^"\']{5,200}?\.m3u8[^"\']*)["\']', text)
        if not m:
            return ""
        p = m.group(1).strip()
        if p.startswith("//"):
            return "https:" + p
        if p.startswith("http"):
            return self._clean_url(p)
        host = urllib.parse.urlsplit(url)
        return self._clean_url("%s://%s%s" % (host.scheme, host.netloc, p if p.startswith("/") else "/" + p))

    def localProxy(self, params):
        return None

    def isVideoFormat(self, url):
        u = str(url or "").lower()
        return ".m3u8" in u or ".mp4" in u

    def manualVideoCheck(self):
        return False

    def destroy(self):
        self._cache = {}
        self.opener = None
        return None


if __name__ == "__main__":
    import urllib.request as _u
    sp = Spider()
    sp.init({})
    t0 = time.time()
    hc = sp.homeContent(False)
    print("分类数:", len(hc["class"]), "|", [c["type_name"] for c in hc["class"]][:6])
    hv = sp.homeVideoContent()
    print("首页条数:", len(hv["list"]), "总页:", hv.get("pagecount"))
    for v in hv["list"][:3]:
        print("  -", v["vod_name"], "|", v["vod_remarks"], "|", v["vod_pic"][:70])
    for tid in ("mv_pop", "tv_pop", "mv_g878", "tv_cn"):
        r = sp.categoryContent(tid, 1, None, None)
        n = len(r["list"])
        first = r["list"][0]["vod_name"] if r["list"] else "-"
        print("分类 %-8s 条数=%d 首条=%s" % (tid, n, first))
    print("\n搜索:", end=" ")
    sr = sp.searchContent("流浪地球", False, "1")
    print(len(sr["list"]), [x["vod_name"] for x in sr["list"][:3]])
    pick = [x for x in sr["list"] if x["vod_id"].startswith("m")]
    if not pick:
        pick = [x for x in hv["list"] if x["vod_id"].startswith("m")]
    tid = pick[0]["vod_id"] if pick else "m550"
    t1 = time.time()
    d = sp.detailContent([tid])["list"][0]
    print("\n详情(%s) %.2fs: %s | %s" % (tid, time.time() - t1, d["vod_name"], d["vod_remarks"]))
    print("  海报:", d["vod_pic"][:80])
    print("  演员:", d["vod_actor"][:80])
    print("  导演:", d["vod_director"][:40])
    print("  线路:", d["vod_play_from"])
    eps = str(d["vod_play_url"]).split("$$$")
    for i, g in enumerate(eps[:3]):
        first_ep = g.split("#")[0] if g else ""
        print("   %d -> %s" % (i, first_ep[:90]))
    if eps and eps[0]:
        pu = sp.playerContent("", eps[0].split("$")[-1], [])
        print("  播放 parse=%s" % pu.get("parse"), pu.get("url", "")[:80])
        code, body = sp._fetch(pu.get("url", ""), 12)
        print("  直链探测:", code, body[:20] if isinstance(body, bytes) else body)
    alive = 0
    for g in eps:
        u = g.split("#")[0].split("$")[-1]
        c, b = sp._fetch(u, 8)
        if c == 200 and isinstance(b, bytes) and b[:7] == b"#EXTM3U":
            alive += 1
    hit = [k for k, v in sp._site_state.items() if v == "命中"]
    print("  线路 %d 条，可播 %d 条，命中站 %d 个" % (len(d["vod_play_from"].split("$$$")), alive, len(hit)))
    print("  站点状态:", sp._site_state)
    print("\n总耗时 %.2fs" % (time.time() - t0))
