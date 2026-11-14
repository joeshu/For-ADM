# -*- coding: utf-8 -*-
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request

try:
    from base.spider import Spider as BaseSpider
except Exception:
    class BaseSpider(object):
        pass

# ==================== m3u8 去广告标准件（与 adfree.py 同款） ====================
# 已知广告特征词（来自 Surge/Loon/QX 去广告脚本，持续补充）
# 命中即删，比统计法更精准；没命中则走统计法兜底
DEFAULT_AD_KEYWORDS = (
    r"9622kb|9641kb|10141kb|1000kb|30EjJFTT|W7fqTmbJ|JKyp1S2D|"
    r"5568049a638c79f9|ec5db3bbf268dd34|7e14ee319bf8017d|ac080df0b161b6fb|"
    r"ea6bb8a311db9dd0|1f1d60431202f328|39803bb0fa0ec24b|787de3b9178c4058|"
    r"0916de7dab851cd8|65e7a9371db1b651|Zse0Tpg8|seg_iif|9c08cdc|"
    r"a6b9d4136946ad41|a0fd38|/stream/|/mov/AD/|8jlf67z19|C7bAbClC|"
    r"erlgnf\.com|adjump|/\d{8}/[a-f0-9]{16}/seg_"
)

# 混淆/注入标签，见即删
NOISE_TAGS = ("#DISC-NOISE", "PPVOD-AD-INJECTED")


def _fix_key_uri(ln, playlist_url):
    """KEY 标签的相对 URI 改绝对，绝对的不动。"""
    s = ln.strip()
    if s.startswith("#EXT-X-KEY:"):
        m = re.search(r'URI="([^"]+)"', ln)
        if m and not m.group(1).lower().startswith("http"):
            absu = urllib.parse.urljoin(playlist_url, m.group(1))
            ln = ln.replace('URI="%s"' % m.group(1), 'URI="%s"' % absu)
    return ln


def _is_noise(ln):
    """混淆/注入标签。"""
    u = ln.strip().upper()
    return any(t in u for t in NOISE_TAGS)


def _is_useless_key(ln):
    """METHOD=NONE 的 KEY 标签，无实际作用。"""
    u = ln.strip().upper()
    return u.startswith("#EXT-X-KEY") and "METHOD=NONE" in u


def strip_ad(text, playlist_url, ad_keywords=None):
    """去掉 m3u8 里全部广告分片（片头 + 片中），返回可直接播放的 m3u8 文本。

    :param text: 原始 m3u8 文本
    :param playlist_url: 该 m3u8 的完整 URL（用于相对路径转绝对）
    :param ad_keywords: 可选，已知广告特征词正则；命中即删，没命中走统计法
    :return: 清理后的 m3u8 文本
    """
    original = text  # 最后一道保险：删空则回退原文
    text = (text or "").replace("\r", "")
    lines = text.split("\n")

    kw_re = None
    if ad_keywords or DEFAULT_AD_KEYWORDS:
        try:
            kw_re = re.compile(ad_keywords or DEFAULT_AD_KEYWORDS, re.I)
        except Exception:
            kw_re = None

    # 头部：第一个分片/#EXTINF 之前的所有标签行（EXTM3U/VERSION/KEY 等）必须保留
    # 顺带清掉头部里的混淆标签和无用 KEY
    head_end = len(lines)
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s.startswith("#EXTINF") or (s and not s.startswith("#")):
            head_end = i
            break
    # 注意：KEY 行一律保留（哪怕 METHOD=NONE）。删 KEY 会改变其后保留分片的
    # 解密状态——滴滴实证：正片 AES-128 密钥 URI 里含 "1000kb"，旧代码按广告词
    # 误删正片密钥，导致播放器报"可能是加密内容"而无法播放。
    head = []
    for ln in lines[:head_end]:
        s = ln.strip()
        if not s or _is_noise(ln):
            continue
        head.append(_fix_key_uri(ln, playlist_url))
    body = lines[head_end:]

    # 解析出所有分片：extinf 行号 / uri 行号 / 时长 / 绝对地址
    segs = []
    pending = None  # (extinf_idx, dur)
    for idx, ln in enumerate(body):
        s = ln.strip()
        if s.startswith("#EXTINF"):
            try:
                dur = float(s.split(":", 1)[1].split(",", 1)[0])
            except Exception:
                dur = 0.0
            pending = (idx, dur)
        elif pending is not None and s and not s.startswith("#"):
            eidx, dur = pending
            pending = None
            absu = urllib.parse.urljoin(playlist_url, s)
            segs.append({"dur": dur, "abs": absu,
                         "extinf_idx": eidx, "uri_idx": idx,
                         "kw_hit": bool(kw_re and kw_re.search(absu))})

    def _path(sg):
        return sg["abs"].rsplit("/", 1)[0]

    drop_idx = set()
    dropped = 0

    # 第一步：关键词精准打击（带过匹配保护：命中数 ≥ 一半说明关键词
    # 误伤了正片目录——如滴滴主线路目录本身就叫 1000kb，命中率 100%；
    # 此时放弃关键词结果，交给第二步统计法判断，避免删空回退原文）
    if kw_re:
        kw_hits = [sg for sg in segs if sg["kw_hit"]]
        if segs and len(kw_hits) * 2 < len(segs):
            for sg in kw_hits:
                drop_idx.add(sg["extinf_idx"])
                drop_idx.add(sg["uri_idx"])
                dropped += 1

    # 第二步：统计时长法（关键词没命中时）
    stats_ambiguous = False
    if not drop_idx and segs:
        stat = {}
        for sg in segs:
            k = _path(sg)
            stat[k] = stat.get(k, 0.0) + sg["dur"]
        total = sum(stat.values())
        main_key = max(stat.items(), key=lambda x: x[1])[0]
        ad_dur = total - stat[main_key]
        sorted_durs = sorted(stat.values(), reverse=True)
        if len(sorted_durs) >= 2 and sorted_durs[1] > 0.5 * sorted_durs[0]:
            # 次大目录接近正片规模（如正片跨多目录/多 CDN），布局含糊：
            # 此时按路径删可能误删正片，宁可不删（带广告播总比播坏强）
            stats_ambiguous = True
        elif ad_dur > 0 and ad_dur < total * 0.5:
            for sg in segs:
                if _path(sg) != main_key:
                    drop_idx.add(sg["extinf_idx"])
                    drop_idx.add(sg["uri_idx"])
                    dropped += 1
        # 兜底：没触发按路径删时，只删片头短广告块（布局含糊时也不删）
        if not drop_idx and not stats_ambiguous:
            cut = None
            for i, ln in enumerate(body):
                if ln.strip() == "#EXT-X-DISCONTINUITY":
                    cut = i
                    break
            if cut is not None:
                first_dur = sum(sg["dur"] for sg in segs if sg["uri_idx"] < cut)
                if 0 < first_dur <= 180:
                    for sg in segs:
                        if sg["uri_idx"] < cut:
                            drop_idx.add(sg["extinf_idx"])
                            drop_idx.add(sg["uri_idx"])
                            dropped += 1

    # 重建 body：跳过被删分片；DISCONTINUITY 按保留块重建；
    # 断点间隙里的 KEY/MAP 等标签缓存，等下一个保留分片时跟在 DISC 后面下发；
    # 顺带清混淆标签、无用 KEY、广告专属 KEY
    orig_disc = sum(1 for ln in body if ln.strip() == "#EXT-X-DISCONTINUITY")
    out = []
    need_disc = False
    emitted_seg = False
    pending_tags = []
    for idx, ln in enumerate(body):
        if idx in drop_idx:
            continue
        s = ln.strip()
        if not s or _is_noise(ln):
            continue
        # KEY 行一律保留：密钥状态机必须与原文一致。广告组自带的 KEY 即便残留，
        # 也会在正片 KEY 行出现时被覆盖，不影响正片解密；反之误删正片 KEY（如
        # 滴滴 AES-128 密钥 URI 含 1000kb 被广告词命中）会直接导致无法解密播放。
        if s == "#EXT-X-DISCONTINUITY":
            need_disc = True
            continue
        if s.startswith("#EXTINF"):
            if need_disc and emitted_seg:
                out.append("#EXT-X-DISCONTINUITY")
            for t in pending_tags:
                if not out or out[-1] != t:
                    out.append(t)
            pending_tags = []
            need_disc = False
            out.append(ln)
            continue
        if s.startswith("#"):
            ln = _fix_key_uri(ln, playlist_url)
            if need_disc:
                pending_tags.append(ln)
            else:
                out.append(ln)
            continue
        if s:
            out.append(urllib.parse.urljoin(playlist_url, s))
            emitted_seg = True
            continue
        out.append(ln)
    out.extend(pending_tags)

    text = "\n".join(head + out)
    if dropped:
        # 序列号只跟"首个保留分片之前"有关：MEDIA-SEQUENCE 加首段前删片数；
        # DISCONTINUITY-SEQUENCE 加首段前跨过的断点数（旧代码按总删片数/
        # 总减断点数算是错的，片中广告会把序号算偏）
        retained = [sg for sg in segs if sg["uri_idx"] not in drop_idx]
        if retained:
            first_idx = retained[0]["extinf_idx"]
            leading_dropped = sum(
                1 for sg in segs
                if sg["uri_idx"] in drop_idx and sg["extinf_idx"] < first_idx)
            discs_before = sum(
                1 for ln in body[:first_idx]
                if ln.strip() == "#EXT-X-DISCONTINUITY")

            def _inc_media(m):
                return "#EXT-X-MEDIA-SEQUENCE:%d" % (
                    int(m.group(1)) + leading_dropped)
            text = re.sub(r"#EXT-X-MEDIA-SEQUENCE:(\d+)", _inc_media,
                          text, count=1)

            def _inc_disc(m):
                return "#EXT-X-DISCONTINUITY-SEQUENCE:%d" % (
                    int(m.group(1)) + discs_before)
            text = re.sub(r"#EXT-X-DISCONTINUITY-SEQUENCE:(\d+)", _inc_disc,
                          text, count=1)
    # 最后一道保险：删完没剩分片，回退原文，防播坏
    has_seg = any(ln.strip() and not ln.strip().startswith("#") for ln in out)
    if not has_seg:
        return original
    return text


RECT_178_STYLE = {"type": "rect", "ratio": 1.78}

CLASSES_CACHE = [
    {"type_id": "6", "type_name": "国产精品"},
    {"type_id": "7", "type_name": "华语AV"},
    {"type_id": "8", "type_name": "黑料吃瓜"},
    {"type_id": "22", "type_name": "学生"},
    {"type_id": "23", "type_name": "乱伦"},
    {"type_id": "24", "type_name": "探花"},
    {"type_id": "9", "type_name": "欧美"},
    {"type_id": "10", "type_name": "禁漫"},
    {"type_id": "25", "type_name": "日本无码"},
    {"type_id": "26", "type_name": "日本有码"},
    {"type_id": "27", "type_name": "主播网红"},
    {"type_id": "28", "type_name": "日本素人"},
    {"type_id": "29", "type_name": "AI短剧"}
]

class Spider(BaseSpider):
    API_URL = "https://thzy1.me/api.php/provide/vod/"

    def __init__(self):
        self.ssl_ctx = ssl.create_default_context()
        self.ssl_ctx.check_hostname = False
        self.ssl_ctx.verify_mode = ssl.CERT_NONE

    def init(self, extend=""):
        pass

    def getName(self):
        return "桃花视频去广告"

    def homeContent(self, filter):
        return {
            "class": CLASSES_CACHE,
            "filters": {},
            "style": RECT_178_STYLE
        }

    def homeVideoContent(self):
        return {"list": []}

    def _fetch_json(self, url, timeout=10):
        req_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        }
        req = urllib.request.Request(url, headers=req_headers)
        try:
            with urllib.request.urlopen(req, context=self.ssl_ctx, timeout=timeout) as resp:
                raw = resp.read()
                encoding = resp.headers.get_content_charset() or "utf-8"
                return json.loads(raw.decode(encoding, errors="replace"))
        except Exception:
            return {}

    def _format_remarks(self, raw_remarks):
        raw_remarks = (raw_remarks or "").strip()
        if raw_remarks:
            return "蝴蝶影视 | %s" % raw_remarks
        return "蝴蝶影视"

    def categoryContent(self, tid, pg, filter, extend):
        page_num = int(pg) if str(pg).isdigit() else 1
        url = "%s?ac=detail&t=%s&pg=%d" % (self.API_URL, str(tid), page_num)
        data = self._fetch_json(url)

        cards = []
        raw_list = data.get("list", []) or []
        for item in raw_list:
            cards.append({
                "vod_id": str(item.get("vod_id", "")),
                "vod_name": item.get("vod_name", ""),
                "vod_pic": item.get("vod_pic", ""),
                "vod_remarks": self._format_remarks(item.get("vod_remarks", "")),
                "style": RECT_178_STYLE
            })

        pagecount = int(data.get("pagecount", 1))
        total = int(data.get("total", len(cards)))
        return {
            "page": page_num,
            "pagecount": pagecount,
            "limit": len(cards),
            "total": total,
            "list": cards,
            "style": RECT_178_STYLE
        }

    def detailContent(self, ids):
        vod_id = ids[0] if isinstance(ids, list) and ids else str(ids)
        url = "%s?ac=detail&ids=%s" % (self.API_URL, str(vod_id))
        data = self._fetch_json(url)

        raw_list = data.get("list", []) or []
        if not raw_list:
            return {"list": []}

        item = raw_list[0]
        vod_play_from = item.get("vod_play_from", "")
        vod_play_url = item.get("vod_play_url", "")

        play_flags = []
        play_urls = []
        if vod_play_from and vod_play_url:
            from_list = vod_play_from.split("$$$")
            url_list = vod_play_url.split("$$$")
            for idx in range(len(from_list)):
                line_name = "蝴蝶专线" if idx == 0 else "蝴蝶专线%d" % (idx + 1)
                play_flags.append(line_name)
                current_url_group = url_list[idx] if idx < len(url_list) else ""
                play_urls.append(current_url_group)

        final_play_from = "$$$".join(play_flags) if play_flags else "蝴蝶专线"
        final_play_url = "$$$".join(play_urls) if play_urls else vod_play_url

        raw_blurb = (item.get("vod_blurb", "") or item.get("vod_content", "") or "").strip()
        formatted_content = "【蝴蝶影视】交流TG群: @tvshare23 | 严禁盗卖\n%s" % raw_blurb

        detail = {
            "vod_id": str(item.get("vod_id", vod_id)),
            "vod_name": item.get("vod_name", ""),
            "vod_pic": item.get("vod_pic", ""),
            "type_name": item.get("type_name", ""),
            "vod_year": item.get("vod_year", ""),
            "vod_area": item.get("vod_area", ""),
            "vod_remarks": self._format_remarks(item.get("vod_remarks", "")),
            "vod_actor": "🦋 TG群: @tvshare23",
            "vod_director": "🦋 蝴蝶影视",
            "vod_content": formatted_content,
            "vod_play_from": final_play_from,
            "vod_play_url": final_play_url
        }
        return {"list": [detail]}

    def _proxy_base(self):
        # 代理基址，必须带 ?do=py
        try:
            base = self.getProxyUrl()
            if base:
                return base
        except Exception:
            pass
        return "http://127.0.0.1:9978/proxy?do=py"

    def _proxy_m3u8_url(self, m3u8_url):
        base = self._proxy_base()
        sep = "&" if "?" in base else "?"
        return "%s%stype=adfree&url=%s" % (base, sep, urllib.parse.quote(m3u8_url, safe=""))

    def playerContent(self, flag, id, vipFlags):
        url = id
        # m3u8 走去广告代理（不区分大小写），mp4 直连，其他原样
        if ".m3u8" in (id or "").lower():
            url = self._proxy_m3u8_url(id)
        return {
            "parse": 0,
            "playUrl": "",
            "url": url,
            "header": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        }

    def searchContent(self, key, quick, pg="1"):
        page_num = int(pg) if str(pg).isdigit() else 1
        encoded_key = urllib.parse.quote(key)
        url = "%s?ac=detail&wd=%s&pg=%d" % (self.API_URL, encoded_key, page_num)
        data = self._fetch_json(url)

        cards = []
        raw_list = data.get("list", []) or []
        for item in raw_list:
            cards.append({
                "vod_id": str(item.get("vod_id", "")),
                "vod_name": item.get("vod_name", ""),
                "vod_pic": item.get("vod_pic", ""),
                "vod_remarks": self._format_remarks(item.get("vod_remarks", "")),
                "style": RECT_178_STYLE
            })

        pagecount = int(data.get("pagecount", 1))
        total = int(data.get("total", len(cards)))
        return {
            "page": page_num,
            "pagecount": pagecount,
            "limit": len(cards),
            "total": total,
            "list": cards,
            "style": RECT_178_STYLE
        }

    def action(self, action):
        pass

    def liveContent(self):
        pass

    def _fetch_m3u8(self, url):
        # requests 优先（部分出口代理下 urllib 会 IncompleteRead 截断大清单），urllib 兜底；
        # VOD 清单缺 ENDLIST 视为不完整，换路重试一次
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            import requests as _rq
            for _ in range(2):
                try:
                    r = _rq.get(url, headers=headers, timeout=20)
                    if r.status_code == 200 and r.text:
                        t = r.text
                        if "#EXT-X-ENDLIST" in t or "#EXT-X-STREAM-INF" in t:
                            return t
                        if _ == 0:
                            continue
                        return t
                except Exception:
                    break
        except Exception:
            pass
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, context=self.ssl_ctx, timeout=20) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""
        return ""

    def _pick_sub_m3u8(self, text, base_url):
        # 主列表选最高码率的子 m3u8
        best_url, best_bw = "", -1
        lines = text.split("\n")
        for i, ln in enumerate(lines):
            if "#EXT-X-STREAM-INF" in ln:
                m = re.search(r"BANDWIDTH=(\d+)", ln)
                bw = int(m.group(1)) if m else 0
                if i + 1 < len(lines):
                    sub = lines[i + 1].strip()
                    if sub and not sub.startswith("#"):
                        if bw >= best_bw:
                            best_bw = bw
                            best_url = urllib.parse.urljoin(base_url, sub)
        return best_url

    def localProxy(self, params):
        # 兼容 params 可能是字符串查询串
        if isinstance(params, str):
            params = dict(urllib.parse.parse_qsl(params.lstrip("?&")))
        if not isinstance(params, dict):
            return [404, "text/plain", ""]
        if params.get("type", "") != "adfree":
            return [404, "text/plain", ""]
        m3u8_url = params.get("url", "")
        if not m3u8_url:
            return [404, "text/plain", ""]
        text = self._fetch_m3u8(m3u8_url)
        if not text:
            return [404, "text/plain", ""]
        # 主列表先跟进子列表
        if "#EXT-X-STREAM-INF" in text:
            sub_url = self._pick_sub_m3u8(text, m3u8_url)
            if sub_url:
                sub_text = self._fetch_m3u8(sub_url)
                if sub_text:
                    text = sub_text
                    m3u8_url = sub_url
        cleaned = strip_ad(text, m3u8_url)
        # 本播放器 localProxy 严格 3 元素 [状态码, mime, 内容]
        return [200, "application/vnd.apple.mpegurl", cleaned]

    def manualVideoCheck(self):
        pass

    def isVideoFormat(self, url):
        return False

    def destroy(self):
        pass
