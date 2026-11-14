# -*- coding: utf-8 -*-
import sys, re, json, time, base64
import requests, urllib3
from urllib.parse import quote, urljoin, urlencode

try:
    from Crypto.Cipher import AES
    _HAS_AES = True
except ImportError:
    _HAS_AES = False

urllib3.disable_warnings()
sys.path.append('..')
try:
    from base.spider import Spider as BaseSpider
except ImportError:
    class BaseSpider: pass

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
BRAND_ACTOR = "KRX精选女优"
BRAND_DIRECTOR = "KRX工作室"

GK1 = "7bd30d612d2bb1bda34743f8608e68c1"
GK2 = "7bd30d612d2bb1bda34743f8608e68c2"
GK3 = "7bd30d612d2bb1bda34743f8608e68c3"
GK4 = "9bd30d612d2bb1bda34743f8608e68c4"
GIV1 = "v3M9zQ2pX7k1"
GIV2 = "v3M9zQ2pX7k2"
GIV3 = "v3M9zQ2pX7k3"
GIV4 = "z3M9zQ2pX7k4"

DEFAULT_HOST = "https://krx18.com"

GENRES = [
    ("xxx", "XXX"),
    ("eng-sub", "English Sub"),
    ("japan", "Japan"),
    ("china", "China"),
    ("korea", "Korea"),
    ("taiwan", "Taiwan"),
    ("thailand", "Thailand"),
    ("philippines", "Philippines"),
    ("india", "India"),
    ("indonesia", "Indonesia"),
    ("usa", "USA"),
    ("uk", "UK"),
    ("canada", "Canada"),
    ("australia", "Australia"),
    ("france", "France"),
    ("germany", "Germany"),
    ("italy", "Italy"),
    ("spain", "Spain"),
    ("russia", "Russia"),
    ("poland", "Poland"),
    ("denmark", "Denmark"),
    ("belgium", "Belgium"),
    ("netherlands", "Netherlands"),
    ("switzerland", "Switzerland"),
    ("singapore", "Singapore"),
    ("exclusive", "Exclusive"),
    ("sex", "Sex"),
    ("asian", "Asian"),
    ("teen", "Teen"),
    ("petite", "Petite"),
    ("big-boobs", "Big Boobs"),
    ("latina", "Latina"),
    ("cosplay", "Cosplay"),
    ("anal", "Anal"),
    ("threesome", "Threesome"),
    ("blowjob", "Blowjob"),
    ("masturbation", "Masturbation"),
    ("bdsm", "BDSM"),
    ("fetish", "Fetish"),
    ("bwc", "BWC"),
    ("pawg", "PAWG"),
    ("bunnies", "Bunnies"),
]

HDR = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
}


class Spider(BaseSpider):
    def __init__(self):
        self.host = DEFAULT_HOST
        self.proxy = ""
        self.timeout = 25
        self.session = requests.Session()
        self.session.verify = False
        self.session.trust_env = False
        self._err = ""
        self._raw = ""
        self._detail_cache = {}
        self._ttl = 600

    def getName(self):
        return "KRX18"

    def isVideoFormat(self, url):
        return ".m3u8" in url or ".mp4" in url

    def manualVideoCheck(self):
        return False

    def destroy(self):
        try:
            self.session.close()
        except Exception:
            pass

    def init(self, extend=""):
        cfg = {}
        if isinstance(extend, dict):
            cfg = extend
        elif isinstance(extend, str) and extend.strip():
            s = extend.strip()
            if s.startswith("{"):
                try:
                    cfg = json.loads(s)
                except Exception:
                    cfg = {}
        if cfg.get("host"):
            self.host = str(cfg["host"]).strip().rstrip("/")
        if cfg.get("proxy"):
            self.proxy = str(cfg["proxy"]).strip().rstrip("/")
            self.session.proxies.update({"http": self.proxy, "https": self.proxy})
        if cfg.get("timeout"):
            try:
                self.timeout = max(10, int(cfg["timeout"]))
            except Exception:
                pass
        self.session.verify = False

    def _mk(self, url):
        if url.startswith("http"):
            return url
        return self.host + url

    def _get(self, url, referer=""):
        full = self._mk(url)
        h = dict(HDR)
        h["Referer"] = referer or (self.host + "/")
        try:
            r = self.session.get(full, headers=h, timeout=self.timeout, verify=False, allow_redirects=True)
        except Exception as e:
            self._err = "请求异常：%s" % e
            return None
        if r.status_code >= 400:
            self._err = "HTTP %s %s" % (r.status_code, full[:90])
            return None
        txt = r.text or ""
        if len(txt) < 200:
            self._err = "响应过短（%d 字节）" % len(txt)
            return None
        self._raw = txt[:600]
        return txt

    def _getj(self, url, referer=""):
        full = self._mk(url)
        h = dict(HDR)
        h["Referer"] = referer or (self.host + "/")
        try:
            r = self.session.get(full, headers=h, timeout=self.timeout, verify=False, allow_redirects=True)
        except Exception as e:
            self._err = "请求异常：%s" % e
            return None
        if r.status_code >= 400:
            self._err = "HTTP %s" % r.status_code
            return None
        try:
            return r.json()
        except Exception:
            self._err = "响应非 JSON"
            return None

    def _unesc(self, s):
        if not s:
            return ""
        s = s.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
        s = s.replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ")
        s = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), s)
        s = re.sub(r"&#x([0-9a-fA-F]+);", lambda m: chr(int(m.group(1), 16)), s)
        return s.strip()

    def _abs(self, p):
        if not p:
            return ""
        p = self._unesc(p)
        if p.startswith("//"):
            return "https:" + p
        if p.startswith("/"):
            return self.host + p
        return p

    def _pic(self, url):
        u = self._abs(url)
        if not u:
            return ""
        try:
            base = self.getProxyUrl()
            if base:
                return base + "&url=" + quote(u, safe="")
        except Exception:
            pass
        return u

    def localProxy(self, param):
        key = ""
        if isinstance(param, dict):
            key = param.get("url") or param.get("key") or ""
        if not key:
            return [400, "text/plain", "", {}]
        u = str(key)
        if not u.startswith("http"):
            return [400, "text/plain", "", {}]
        try:
            r = self.session.get(u, headers=HDR, timeout=20, verify=False)
        except Exception as e:
            return [500, "text/plain", str(e), {}]
        if r.status_code != 200:
            return [r.status_code, "text/plain", "", {}]
        ct = r.headers.get("Content-Type", "image/jpeg")
        return [200, ct, r.content, {"Content-Type": ct}]

    def _diag(self, msg, extra=""):
        return {
            "vod_id": "diag",
            "vod_name": "【诊断】" + str(msg)[:58],
            "vod_pic": "",
            "vod_remarks": ("点开看原因：" + str(extra)[:60]) if extra else "点开看完整原因",
        }

    def _cards(self, html):
        if not html:
            return []
        starts = []
        for pat in (r'<article[^>]*class="item [^"]*"', r'<div class="item movies[^"]*"', r'<article class="item">'):
            starts = [m.start() for m in re.finditer(pat, html)]
            if starts:
                break
        items = []
        for i in range(len(starts)):
            b = html[starts[i]:starts[i + 1] if i + 1 < len(starts) else starts[i] + 5000]
            a = re.search(r'<a href="(https?://[^"]*/movies/([^"/]+)/)"[^>]*>([^<]{1,200})</a>', b)
            if not a:
                continue
            link, slug, ttl = a.group(1), a.group(2), self._unesc(a.group(3))
            ttl = ttl.strip()
            if not ttl:
                tm = re.search(r'<h3><a[^>]*>([^<]+)</a></h3>', b)
                if tm:
                    ttl = self._unesc(tm.group(1))
            im = re.search(r'<img[^>]+src="([^"]+)"', b)
            pic = im.group(1) if im else ""
            bits = []
            yr = re.search(r'<span>(\d{4})</span>', b)
            if yr:
                bits.append(yr.group(1))
            rt = re.search(r'<div class="rating">([^<]*)</div>', b)
            if rt and rt.group(1).strip() and rt.group(1).strip() != "0":
                bits.append("★" + rt.group(1).strip())
            if 'class="featu"' in b:
                bits.append("精选")
            items.append({
                "vod_id": "/movies/%s/" % slug,
                "vod_name": ttl or slug,
                "vod_pic": self._pic(pic),
                "vod_remarks": " · ".join(bits),
            })
        return items

    def homeContent(self, filter=False):
        classes = [{"type_id": "/movies", "type_name": "最新影片"}]
        for slug, nm in GENRES:
            classes.append({"type_id": "/genre/" + slug, "type_name": nm})
        items = []
        txt = self._get("/movies/")
        if txt:
            items = self._cards(txt)
        if not items:
            items = [self._diag(self._err or "首页无数据", self._raw[:150])]
        return {"class": classes, "filters": {}, "type": "影视", "list": items,
                "page": 1, "pagecount": 1, "limit": len(items), "total": len(items)}

    def homeVideoContent(self):
        txt = self._get("/movies/")
        if not txt:
            return {"list": []}
        return {"list": self._cards(txt)}

    def categoryContent(self, tid, pg="1", filter=None, extend=None, **kwargs):
        page = int(pg) if str(pg).isdigit() else 1
        base = tid.rstrip("/")
        path = base + "/" if page <= 1 else "%s/page/%d/" % (base, page)
        txt = self._get(path)
        if not txt:
            return {"list": [self._diag(self._err or "分类无数据", self._raw[:150])],
                    "page": page, "pagecount": page, "limit": 20, "total": 0}
        items = self._cards(txt)
        if not items:
            return {"list": [self._diag("页面解析不到条目（结构可能变了）", self._raw[:150])],
                    "page": page, "pagecount": page, "limit": 20, "total": 0}
        return {"list": items, "page": page, "pagecount": page + 1,
                "limit": len(items), "total": page * len(items)}

    def _lines(self, post_id, referer):
        out = []
        for n in ("1", "2", "3"):
            j = self._getj("/wp-json/dooplayer/v2/%s/movie/%s" % (post_id, n), referer)
            if not j:
                continue
            eu = j.get("embed_url") or j.get("url") or ""
            if not eu:
                continue
            nm = "线路%s" % n
            if "/play/" not in eu:
                nm += "（嗅探）"
            out.append((nm, eu))
        return out

    def detailContent(self, ids):
        vid = str(ids[0] if isinstance(ids, list) else ids)
        m = re.search(r"(/movies/[^\"'?#]+?/)", vid)
        if m:
            vid = m.group(1)
        if not vid.startswith("/"):
            vid = "/movies/%s/" % vid.strip("/")
        info = self._detail_cache.get(vid)
        if not info or time.time() - info.get("_t", 0) > self._ttl:
            html = self._get(vid)
            if not html:
                return {"list": [{
                    "vod_id": vid, "vod_name": "详情取回失败", "vod_pic": "",
                    "vod_year": "", "vod_area": "", "vod_lang": "",
                    "vod_actor": BRAND_ACTOR, "vod_director": BRAND_DIRECTOR,
                    "vod_remarks": "详情失败",
                    "vod_content": "【诊断】%s\n【响应片段】%s" % (self._err, self._raw[:350]),
                    "vod_play_from": "KRX线路", "vod_play_url": "正片$",
                }]}
            title = ""
            tm = re.search(r"<title>([^<]+)</title>", html)
            if tm:
                title = self._unesc(re.split(r"\s*[|–-]\s*", tm.group(1))[0])
            ogt = re.search(r'property="og:title"[^>]+content="([^"]+)"', html)
            if ogt:
                title = self._unesc(ogt.group(1)) or title
            title = re.sub(r"^\s*(?:Free\s+)?Watch\s+", "", title, flags=re.I)
            title = re.sub(r"\s+Online.*$", "", title, flags=re.I)
            title = re.sub(r"\s+(?:Free|HD|Full)\s*$", "", title, flags=re.I).strip()
            poster = ""
            pm = re.search(r'property="og:image"[^>]+content="([^"]+)"', html) or \
                re.search(r'content="([^"]+)"[^>]+property="og:image"', html)
            if pm:
                poster = pm.group(1)
            desc = ""
            dm = re.search(r'<div class="wp-content"[^>]*>(.*?)</div>', html, re.S)
            if not dm:
                dm = re.search(r'name="description"[^>]+content="([^"]+)"', html)
            if dm:
                g = dm.group(1)
                g = re.sub(r"<br\s*/?>", "\n", g)
                g = re.sub(r"<[^>]+>", "", g)
                desc = self._unesc(g).strip()[:1200]
            year = ""
            ym = re.search(r'"datePublished"\s*:\s*"(\d{4})', html) or \
                re.search(r'/year/(\d{4})/', html)
            if ym:
                year = ym.group(1)
            actors = []
            for am in re.finditer(r'href="[^"]*/actor/([^"/]+)/"[^>]*>([^<]{1,40})</a>', html):
                n = self._unesc(am.group(2))
                if n and n not in actors:
                    actors.append(n)
            for am in re.finditer(r'href="[^"]*/stars/([^"/]+)/"[^>]*>([^<]{1,40})</a>', html):
                n = self._unesc(am.group(2))
                if n and n not in actors:
                    actors.append(n)
            actors = actors[:8]
            genres = []
            for gm in re.finditer(r'href="[^"]*/genre/([^"/]+)/"', html):
                g = gm.group(1)
                if g not in genres:
                    genres.append(g)
            pid = ""
            pim = re.search(r'postid-(\d+)', html)
            if pim:
                pid = pim.group(1)
            if not pid:
                pim = re.search(r"data-post='(\d+)'", html)
                if pim:
                    pid = pim.group(1)
            info = {"title": title, "poster": poster, "desc": desc, "year": year,
                    "actors": actors, "genres": genres[:8], "pid": pid,
                    "path": vid, "_t": time.time()}
            self._detail_cache[vid] = info

        lines = []
        if info.get("pid"):
            lines = self._lines(info["pid"], self.host + info["path"])
        body = []
        if info.get("year"):
            body.append("年份：%s" % info["year"])
        if info.get("genres"):
            body.append("分类：%s" % " / ".join(info["genres"]))
        if info.get("actors"):
            body.append("演员：%s" % " / ".join(info["actors"]))
        if info.get("desc"):
            body.append("简介：%s" % info["desc"])
        if lines:
            body.append("线路：共 %d 条（外部播放器，走嗅探）" % len(lines))
        else:
            body.append("线路：【无】%s" % (self._err or "dooplayer 接口未返回 embed"))
        if lines:
            play_url = "#".join(["%s$%s" % (nm, eu) for nm, eu in lines])
        else:
            play_url = "正片$"
        return {"list": [{
            "vod_id": info["path"],
            "vod_name": info.get("title") or "未命名",
            "vod_pic": self._pic(info.get("poster")),
            "vod_year": info.get("year") or "",
            "vod_area": "",
            "vod_lang": "",
            "vod_actor": " / ".join(info.get("actors") or []) or BRAND_ACTOR,
            "vod_director": BRAND_DIRECTOR,
            "vod_remarks": " / ".join(info.get("genres") or [])[:40],
            "vod_content": "\n".join(body),
            "vod_play_from": "KRX线路",
            "vod_play_url": play_url,
        }]}

    def _gcm_dec(self, key, iv, b64):
        raw = base64.b64decode(b64)
        c = AES.new(key.encode(), AES.MODE_GCM, nonce=iv.encode())
        return c.decrypt_and_verify(raw[:-16], raw[-16:]).decode("utf-8", "ignore")

    def _gcm_enc(self, key, iv, plain):
        c = AES.new(key.encode(), AES.MODE_GCM, nonce=iv.encode())
        ct, tag = c.encrypt_and_digest(plain.encode())
        return base64.b64encode(ct + tag).decode()

    def _play_code(self, embed_url):
        m = re.search(r"/play/([A-Za-z0-9]+)", embed_url or "")
        if m:
            return m.group(1), embed_url
        m = re.search(r"[?&]v=([A-Za-z0-9]+)", embed_url or "")
        if m:
            return m.group(1), embed_url
        return "", embed_url

    def _resolve_m3u8(self, embed_url):
        if not _HAS_AES:
            self._err = "缺少 pycryptodome，无法解出直链"
            return ""
        code, url = self._play_code(embed_url)
        if not code:
            self._err = "取不到播放 code"
            return ""
        if "/play/" not in url:
            self._err = "该线路走 Abyss 加密，本版仅支持 9stream 线路"
            return ""
        html = self._get(url, referer=self.host + "/")
        if not html:
            return ""
        f = re.search(r'idfile_enc\s*=\s*["\']([^"\']+)["\']', html)
        u = re.search(r'idUser_enc\s*=\s*["\']([^"\']+)["\']', html)
        api = ""
        am = re.search(r'DOMAIN_API\s*=\s*["\']([^"\']+)["\']', html)
        if am:
            api = am.group(1)
        if not f or not u:
            self._err = "embed 页拿不到 idfile/idUser"
            return ""
        if not api:
            api = "https://api-play-9str.playkrx18.site/api/getplay"
        try:
            idfile = self._gcm_dec(GK1, GIV1, f.group(1))
            iduser = self._gcm_dec(GK2, GIV2, u.group(1))
        except Exception as e:
            self._err = "id 解密失败：%s" % str(e)[:80]
            return ""
        payload = json.dumps({
            "idfile": idfile,
            "iduser": iduser,
            "domain_play": self.host,
            "unixTimestamp": int(time.time()),
        }, separators=(",", ":"))
        body = urlencode({"data": self._gcm_enc(GK3, GIV3, payload)})
        h = dict(HDR)
        h["Referer"] = url
        h["Origin"] = re.sub(r"^(https?://[^/]+).*$", r"\1", url)
        h["Content-Type"] = "application/x-www-form-urlencoded"
        try:
            r = self.session.post(api, data=body, headers=h, timeout=self.timeout, verify=False)
        except Exception as e:
            self._err = "getplay 请求失败：%s" % str(e)[:80]
            return ""
        if r.status_code != 200:
            self._err = "getplay HTTP %s" % r.status_code
            return ""
        try:
            j = r.json()
        except Exception:
            self._err = "getplay 非 JSON：%s" % (r.text or "")[:90]
            return ""
        if j.get("status") != "success":
            self._err = "getplay 拒绝：%s" % str(j.get("msg") or j)[:90]
            return ""
        enc = j.get("data") or ""
        if not enc:
            self._err = "getplay 返回空 data"
            return ""
        try:
            return self._gcm_dec(GK4, GIV4, enc)
        except Exception as e:
            self._err = "m3u8 解密失败：%s" % str(e)[:80]
            return ""

    def _m3u8_info(self, url):
        h = dict(HDR)
        try:
            r = self.session.get(url, headers=h, timeout=20, verify=False)
        except Exception as e:
            self._err = "m3u8 取回失败：%s" % str(e)[:80]
            return 0, 0.0
        if r.status_code != 200:
            self._err = "m3u8 HTTP %s" % r.status_code
            return 0, 0.0
        t = r.text or ""
        n = len([x for x in t.splitlines() if x.strip() and not x.startswith("#")])
        dur = sum(float(x) for x in re.findall(r"#EXTINF:([\d.]+)", t))
        return n, dur

    def playerContent(self, flag, id, vipFlags=None):
        pid = str(id or "")
        if "$" in pid:
            pid = pid.split("$", 1)[1]
        if not pid or not pid.startswith("http"):
            return {"parse": 0, "url": pid, "header": dict(HDR)}
        cached = self._detail_cache.get("M3U8#" + pid)
        if cached and time.time() - cached[1] < 900:
            return {"parse": 0, "url": cached[0], "header": dict(HDR)}
        m3u8 = self._resolve_m3u8(pid)
        if m3u8:
            self._detail_cache["M3U8#" + pid] = (m3u8, time.time())
            return {"parse": 0, "url": m3u8, "header": dict(HDR)}
        hdr = dict(HDR)
        hdr["Referer"] = pid
        return {"parse": 1, "url": pid, "header": hdr,
                "format": "", "flag": flag, "diagnose": self._err}

    def searchContent(self, key, quick=False, pg="1", **kwargs):
        page = int(pg) if str(pg).isdigit() else 1
        kw = quote(str(key), safe="")
        path = "/?s=" + kw if page <= 1 else "/page/%d/?s=%s" % (page, kw)
        txt = self._get(path)
        if not txt:
            return {"list": [self._diag("搜索失败：%s" % self._err, self._raw[:150])],
                    "page": page, "pagecount": page, "limit": 20, "total": 0}
        items = self._cards(txt)
        if not items:
            return {"list": [self._diag("搜索页解析不到结果", self._raw[:150])],
                    "page": page, "pagecount": page, "limit": 20, "total": 0}
        return {"list": items, "page": page, "pagecount": page + 1,
                "limit": len(items), "total": len(items)}


if __name__ == "__main__":
    s = Spider()
    s.init({})
    s.getProxyUrl = lambda *a, **k: "http://127.0.0.1:9978/proxy?do=py"
    print("站点:", s.host)
    h = s.homeContent(False)
    print("分类数: %d | 首页条数: %d" % (len(h["class"]), len(h["list"])))
    for v in h["list"][:3]:
        print("  -", v["vod_name"][:42], "|", v["vod_id"], "|", v["vod_remarks"][:24])
    if h["list"] and h["list"][0]["vod_id"] != "diag":
        c = s.categoryContent("/genre/japan", "2", False, {})
        print("分类 japan 第2页: %d 条" % len(c["list"]))
        if c["list"]:
            print("  首条:", c["list"][0]["vod_name"][:40])
        d = s.detailContent([h["list"][0]["vod_id"]])
        dv = (d.get("list") or [{}])[0]
        print("详情:", str(dv.get("vod_name"))[:40], "| 年份:", dv.get("vod_year"))
        pu = str(dv.get("vod_play_url"))
        print("  线路数:", pu.count("#") + 1 if pu and pu != "正片$" else 0)
        print("  play_url:", pu[:150])
        if pu and pu != "正片$":
            p = s.playerContent("KRX线路", pu.split("#")[0])
            print("播放 parse=%s" % p.get("parse"))
            print("  url:", str(p.get("url"))[:130])
            if p.get("parse") == 0 and str(p.get("url", "")).startswith("http"):
                n, dur = s._m3u8_info(p["url"])
                print("  分片数:", n, "| 时长:", round(dur, 1), "秒")
            if p.get("diagnose"):
                print("  诊断:", str(p.get("diagnose"))[:150])
    sr = s.searchContent("milf", False, "1")
    print("搜索 milf: %d 条" % len(sr["list"]))
    if sr["list"] and sr["list"][0]["vod_id"] != "diag":
        print("  首条:", sr["list"][0]["vod_name"][:46])
    if s._err:
        print("最后错误:", s._err[:120])
