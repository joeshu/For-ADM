#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import re
import json
import base64
import html as html_lib
import urllib.request
import urllib.parse
from urllib.parse import urlparse, quote, unquote
import http.cookiejar
import gzip
import zlib
import ssl

try:
    from base.spider import Spider as SpiderBase
except ImportError:
    class SpiderBase(object):
        def getCache(self, key): return None
        def setCache(self, key, value): return "fail"
        def delCache(self, key): return "fail"

def format_remarks(brand="蝴蝶影视", meta=""):
    clean_meta = str(meta or "").strip()
    clean_meta = re.sub(r"[\r\n\t]+", " ", clean_meta).strip()
    if clean_meta:
        return "%s | %s" % (brand, clean_meta)
    return brand

_AES_SBOX = (
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
)
_AES_INV_SBOX = [0] * 256
for _i, _v in enumerate(_AES_SBOX):
    _AES_INV_SBOX[_v] = _i
_AES_INV_SBOX = tuple(_AES_INV_SBOX)
_AES_RCON = (0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36)

def _aes_xtime(a):
    return (((a << 1) ^ 0x1b) & 0xff) if (a & 0x80) else ((a << 1) & 0xff)

def _aes_gmul(a, b):
    p = 0
    while b:
        if b & 1:
            p ^= a
        a = _aes_xtime(a)
        b >>= 1
    return p

_AES_M09 = tuple(_aes_gmul(i, 0x09) for i in range(256))
_AES_M0B = tuple(_aes_gmul(i, 0x0b) for i in range(256))
_AES_M0D = tuple(_aes_gmul(i, 0x0d) for i in range(256))
_AES_M0E = tuple(_aes_gmul(i, 0x0e) for i in range(256))

def _aes_expand_key(key):
    ek = list(key)
    for i in range(10):
        t = ek[-4:]
        t = t[1:] + t[:1]
        t = [_AES_SBOX[b] for b in t]
        t[0] ^= _AES_RCON[i]
        for _j in range(4):
            t = [t[k] ^ ek[-16+k] for k in range(4)]
            ek += t
    return [ek[i:i+16] for i in range(0, 176, 16)]

def _aes_decrypt_block(blk, rk):
    s = [a ^ b for a, b in zip(blk, rk[10])]
    for r in range(9, 0, -1):
        s = [s[0],s[13],s[10],s[7],s[4],s[1],s[14],s[11],s[8],s[5],s[2],s[15],s[12],s[9],s[6],s[3]]
        s = [_AES_INV_SBOX[b] for b in s]
        s = [a ^ b for a, b in zip(s, rk[r])]
        o = [0] * 16
        for c in range(4):
            a0, a1, a2, a3 = s[c*4], s[c*4+1], s[c*4+2], s[c*4+3]
            o[c*4]   = _AES_M0E[a0] ^ _AES_M0B[a1] ^ _AES_M0D[a2] ^ _AES_M09[a3]
            o[c*4+1] = _AES_M09[a0] ^ _AES_M0E[a1] ^ _AES_M0B[a2] ^ _AES_M0D[a3]
            o[c*4+2] = _AES_M0D[a0] ^ _AES_M09[a1] ^ _AES_M0E[a2] ^ _AES_M0B[a3]
            o[c*4+3] = _AES_M0B[a0] ^ _AES_M0D[a1] ^ _AES_M09[a2] ^ _AES_M0E[a3]
        s = o
    s = [s[0],s[13],s[10],s[7],s[4],s[1],s[14],s[11],s[8],s[5],s[2],s[15],s[12],s[9],s[6],s[3]]
    s = [_AES_INV_SBOX[b] for b in s]
    return bytes(a ^ b for a, b in zip(s, rk[0]))

class FastAesCbc(object):
    def __init__(self, key, iv):
        self.rk = _aes_expand_key(key)
        self.iv = bytes(iv)

    def decrypt(self, data):
        out = bytearray()
        prev = self.iv
        for i in range(0, len(data) - 15, 16):
            blk = _aes_decrypt_block(data[i:i+16], self.rk)
            out += bytes(a ^ b for a, b in zip(blk, prev))
            prev = data[i:i+16]
        if not out:
            return b""
        pad = out[-1]
        if 1 <= pad <= 16 and bytes(out[-pad:]) == bytes([pad]) * pad:
            del out[-pad:]
        return bytes(out)

class Spider(SpiderBase):
    def __init__(self):
        super(Spider, self).__init__()
        self.siteUrl = "https://cgw666.com"
        self.tgGroup = "https://t.me/tvshare23"
        self.brandActor = "🦋 TG群: @tvshare23"
        self.brandDirector = "🦋 蝴蝶影视"
        self.brandLine = "蝴蝶专线"
        self._ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        self.options = {}

        self.imgKey = b"f5d965df75336270"
        self.imgIv = b"97b60394abc2fbe1"
        self.cipher = FastAesCbc(self.imgKey, self.imgIv)

        self.ctx = ssl.create_default_context()
        self.ctx.check_hostname = False
        self.ctx.verify_mode = ssl.CERT_NONE

        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cj),
            urllib.request.HTTPSHandler(context=self.ctx)
        )

    def init(self, extend=""):
        if isinstance(extend, dict):
            self.options = extend
        elif extend:
            try:
                self.options = json.loads(extend)
            except Exception:
                self.options = {}
        return True

    def getName(self):
        return "吃瓜网"

    def isVideoFormat(self, url):
        low = (url or "").lower()
        return any(k in low for k in (".m3u8", ".mp4", ".flv", ".mkv", ".ts"))

    def manualVideoCheck(self):
        return False

    def destroy(self):
        self.options = {}

    def _fetch(self, target_url, referer=""):
        if not target_url:
            return {"code": 0, "text": "", "bytes": b"", "err": "", "final_url": ""}
        if target_url.startswith("//"):
            target_url = "https:" + target_url
        elif target_url.startswith("/"):
            target_url = self.siteUrl + target_url

        headers = {
            "User-Agent": self._ua,
            "Referer": referer if referer else (self.siteUrl + "/"),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive"
        }

        last_err = ""
        for attempt in range(2):
            try:
                req = urllib.request.Request(target_url, headers=headers)
                with self.opener.open(req, timeout=8) as resp:
                    code = resp.getcode()
                    final_url = resp.geturl()
                    raw = resp.read()
                    enc = getattr(resp, "headers", {}).get("Content-Encoding", "")
                    if raw.startswith(b"\x1f\x8b") or enc == "gzip":
                        raw = gzip.decompress(raw)
                    elif enc == "deflate":
                        try:
                            raw = zlib.decompress(raw)
                        except Exception:
                            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
                    try:
                        text = raw.decode("utf-8")
                    except Exception:
                        text = raw.decode("latin1", errors="ignore")
                    return {"code": code, "text": text, "bytes": raw, "err": "", "final_url": final_url}
            except urllib.error.HTTPError as e:
                last_err = "HTTP %s" % e.code
                if e.code in (451, 403, 429) and attempt == 0:
                    continue
                err_raw = ""
                try:
                    err_raw = e.read().decode("utf-8", errors="ignore")
                except Exception:
                    pass
                return {"code": e.code, "text": err_raw, "bytes": b"", "err": str(e), "final_url": target_url}
            except Exception as e:
                last_err = str(e)
                if attempt == 0:
                    continue
                return {"code": -1, "text": "", "bytes": b"", "err": str(e), "final_url": target_url}

        return {"code": -1, "text": "", "bytes": b"", "err": last_err, "final_url": target_url}

    def _wrap_pic(self, pic_url):
        if not pic_url:
            return ""
        if pic_url.startswith("//"):
            pic_url = "https:" + pic_url
        elif pic_url.startswith("/"):
            pic_url = self.siteUrl + pic_url
        clean_url = pic_url.strip()
        return "http://127.0.0.1:9978/proxy?do=py&type=img&url=%s" % quote(clean_url)

    def homeContent(self, filter):
        classes = [
            {"type_name": "全部最新", "type_id": "root_home"},
            {"type_name": "今日吃瓜", "type_id": "jrxw1"},
            {"type_name": "吃瓜排行榜", "type_id": "mrcg"},
            {"type_name": "热搜吃瓜", "type_id": "rsbl"},
            {"type_name": "每日大赛", "type_id": "ztds"},
            {"type_name": "网红黑料", "type_id": "dycg"},
            {"type_name": "反差校花", "type_id": "xyzt"},
            {"type_name": "海角乱伦", "type_id": "lljj"},
            {"type_name": "必看大瓜", "type_id": "bkrg"},
            {"type_name": "激情偷拍", "type_id": "meiritoupai"},
            {"type_name": "网黄达人", "type_id": "guochanwanghuang"},
            {"type_name": "佳片有约", "type_id": "hwcg"},
            {"type_name": "独家爆料", "type_id": "djbl"},
            {"type_name": "AI剧场", "type_id": "lpzq"},
            {"type_name": "探花视频", "type_id": "tanhuazhuanchang"},
            {"type_name": "撸管精品", "type_id": "lgjp"},
            {"type_name": "动漫乐园", "type_id": "chiyuan"},
            {"type_name": "猎奇吃瓜", "type_id": "lqds"},
            {"type_name": "社会百科", "type_id": "shehuiqiwen"},
            {"type_name": "私密小说", "type_id": "xiaoshuo"},
            {"type_name": "体坛热闻", "type_id": "worldcup"}
        ]
        result = {"class": classes}
        if filter:
            result["filters"] = {}
        return result

    def homeVideoContent(self):
        res = self.categoryContent("root_home", 1, False, {})
        return {"list": res.get("list", [])[:12]}

    def _parse_card_list(self, html_text):
        vod_list = []
        seen_ids = set()

        ad_keywords = ("重金求稿", "变现", "高价收购", "商务合作", "吃瓜导航", "我要投稿", "关于我们", "求瓜")

        banner_map = {}
        banners = re.findall(r"loadBannerDirect\(['\"]([^'\"]+)['\"]\s*,\s*['\"][^'\"]*['\"]\s*,\s*document\.querySelector\(['\"]#post-card-(\d+)['\"]\)", html_text)
        for b_url, aid in banners:
            banner_map[aid] = b_url

        card_patterns = re.findall(r'<a[^>]+href=["\'](?:https?://[^/]+)?/archives/(\d+)/?["\'][^>]*>([\s\S]*?)</a>', html_text)
        for aid, inner in card_patterns:
            if aid in seen_ids or aid == "139553":
                continue

            m_t = re.search(r'<h[234][^>]*>([\s\S]*?)</h[234]>', inner)
            if m_t:
                name = re.sub(r'<[^>]+>', '', m_t.group(1)).strip()
            else:
                raw_txt = re.sub(r'<[^>]+>', ' ', inner).strip()
                name = raw_txt[:50] if raw_txt else ("瓜圈热点 %s" % aid)

            if any(k in name for k in ad_keywords):
                continue

            seen_ids.add(aid)
            pic = banner_map.get(aid, "")

            if not pic:
                m_direct = re.search(r"loadBannerDirect\(['\"]([^'\"]+)['\"]", inner)
                if m_direct:
                    pic = m_direct.group(1)

            if not pic:
                for img_cand in re.findall(r'(?:src|data-src|data-original)=["\']([^"\']+)["\']', inner):
                    if not img_cand.endswith(".svg") and "logo" not in img_cand and "avatar" not in img_cand:
                        pic = img_cand.strip()
                        break

            if not pic:
                m_bg = re.search(r'url\(["\']?([^"\'\)]+)["\']?\)', inner)
                if m_bg:
                    pic = m_bg.group(1).strip()

            vod_list.append({
                "vod_id": aid,
                "vod_name": name,
                "vod_pic": self._wrap_pic(pic),
                "vod_remarks": format_remarks("蝴蝶影视", "现场实录"),
                "style": {"type": "rect", "ratio": 1.78}
            })

        return vod_list

    def categoryContent(self, tid, pg, filter, extend):
        del filter, extend
        page = 1
        try:
            page = int(pg)
        except Exception:
            page = 1

        slug = str(tid).strip("/")

        if slug == "root_home":
            if page > 1:
                target_url = "%s/page/%d/" % (self.siteUrl, page)
            else:
                target_url = "%s/" % self.siteUrl
        else:
            if page > 1:
                target_url = "%s/category/%s/page/%d/" % (self.siteUrl, slug, page)
            else:
                target_url = "%s/category/%s/" % (self.siteUrl, slug)

        res = self._fetch(target_url)
        vod_list = self._parse_card_list(res.get("text", ""))

        pagecount = page + 1 if len(vod_list) >= 10 else page
        if pagecount <= 0:
            pagecount = 1

        return {
            "page": page,
            "pagecount": pagecount,
            "limit": len(vod_list),
            "total": int(page * len(vod_list) + 100) if len(vod_list) >= 10 else len(vod_list),
            "list": vod_list
        }

    def _clean_stream_url(self, raw_url):
        if not raw_url:
            return ""
        clean = raw_url.replace(r"\u0068ttps", "https").replace(r"\u0068ttp", "http")
        clean = clean.replace(r"\/", "/").strip()
        if clean.startswith("//"):
            clean = "https:" + clean
        return clean

    def _extract_episodes_from_html(self, html_content, default_name_prefix="片段"):
        episodes = []
        seen_urls = set()

        dp_configs = re.findall(r'data-config=(["\'])([\s\S]*?)\1', html_content)
        for quote_char, raw_cfg in dp_configs:
            raw_cfg = html_lib.unescape(raw_cfg)
            v_url = ""
            try:
                cfg = json.loads(raw_cfg)
                v_url = cfg.get("video", {}).get("url", "")
            except Exception:
                u_m = re.search(r'["\']url["\']\s*:\s*["\']([^"\']+)["\']', raw_cfg)
                if u_m:
                    v_url = u_m.group(1)

            v_url = self._clean_stream_url(v_url)
            if v_url and v_url not in seen_urls and "logo" not in v_url:
                seen_urls.add(v_url)
                ep_name = "%s %02d" % (default_name_prefix, len(episodes) + 1)
                episodes.append("%s$%s" % (ep_name, v_url))

        if not episodes:
            video_matches = re.findall(r'<video[^>]+>', html_content)
            for v_tag in video_matches:
                m_src = re.search(r'(?:data-hls-src|data-src|src)=["\']([^"\']+)["\']', v_tag)
                if m_src:
                    s_url = self._clean_stream_url(m_src.group(1))
                    if s_url and s_url not in seen_urls:
                        seen_urls.add(s_url)
                        ep_name = "%s %02d" % (default_name_prefix, len(episodes) + 1)
                        episodes.append("%s$%s" % (ep_name, s_url))

        if not episodes:
            stream_matches = re.findall(r'["\'](https?:[\\/]+[^"\'\s]+\.(?:m3u8|mp4)[^"\'\s]*)["\']', html_content)
            for raw_stream in stream_matches:
                c_stream = self._clean_stream_url(raw_stream)
                if c_stream and c_stream not in seen_urls and "logo" not in c_stream:
                    seen_urls.add(c_stream)
                    ep_name = "%s %02d" % (default_name_prefix, len(episodes) + 1)
                    episodes.append("%s$%s" % (ep_name, c_stream))

        return episodes

    def detailContent(self, ids):
        raw_id = ids[0] if isinstance(ids, (list, tuple)) else str(ids)
        aid = raw_id.strip("/")

        target_url = "%s/archives/%s/" % (self.siteUrl, aid)
        res = self._fetch(target_url)
        detail_html = res.get("text", "")

        title = "瓜圈爆料 %s" % aid
        cover = ""
        desc = ""

        m_title = re.search(r'<h1[^>]*>([\s\S]*?)</h1>', detail_html)
        if m_title:
            title = re.sub(r'<[^>]+>', '', m_title.group(1)).strip()

        m_desc = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']', detail_html)
        if m_desc:
            desc = m_desc.group(1).strip()

        banner_d = re.search(r"loadBannerDirect\(['\"]([^'\"]+)['\"]", detail_html)
        if banner_d:
            cover = banner_d.group(1).strip()

        if not cover:
            m_pic = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']*)["\']', detail_html)
            if m_pic:
                cover = m_pic.group(1).strip()

        episodes = self._extract_episodes_from_html(detail_html, default_name_prefix="片段")

        if not episodes:
            content_m = re.search(r'<div[^>]+class=["\'][^"\']*post-content[^"\']*["\'][^>]*>([\s\S]*?)(?:<div[^>]+class=["\'][^"\']*(?:post-footer|post-tags|comments)[^"\']*["\']|</article>)', detail_html)
            post_body = content_m.group(1) if content_m else detail_html

            sub_article_links = re.findall(r'<a[^>]+href=["\'](?:https?://[^/]+)?/archives/(\d+)/?["\'][^>]*>([\s\S]*?)</a>', post_body)
            seen_sub_ids = set()

            for sub_id, link_inner in sub_article_links:
                if sub_id == aid or sub_id in seen_sub_ids or sub_id == "139553":
                    continue
                seen_sub_ids.add(sub_id)

                sub_t = re.sub(r'<[^>]+>', '', link_inner).strip()
                sub_label = re.sub(r'[\$#]', '', sub_t)[:22] if sub_t else ("TOP %02d" % len(seen_sub_ids))

                sub_url = "%s/archives/%s/" % (self.siteUrl, sub_id)
                sub_res = self._fetch(sub_url)
                sub_html = sub_res.get("text", "")

                sub_eps = self._extract_episodes_from_html(sub_html, default_name_prefix=sub_label)
                for ep in sub_eps:
                    ep_parts = ep.split("$")
                    if len(ep_parts) == 2:
                        episodes.append("%s$%s" % (sub_label, ep_parts[1]))
                    else:
                        episodes.append(ep)

                if len(episodes) >= 10:
                    break

        full_desc = (
            "【🔥 官方交流群: %s】\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "🦋 蝴蝶影视专线直连 | 解析到【%d】个现场视频片段 | %s"
        ) % (self.tgGroup, len(episodes), desc)

        play_url = "#".join(episodes) if episodes else ("暂无可用视频流$http://127.0.0.1")

        return {
            "list": [{
                "vod_id": aid,
                "vod_name": title,
                "vod_pic": self._wrap_pic(cover),
                "vod_actor": self.brandActor,
                "vod_director": self.brandDirector,
                "vod_remarks": format_remarks("蝴蝶影视", "共%d个片段" % len(episodes) if len(episodes) > 1 else "正片实录"),
                "vod_content": full_desc,
                "vod_play_from": self.brandLine,
                "vod_play_url": play_url
            }]
        }

    def playerContent(self, flag, id, vipFlags):
        del flag, vipFlags
        raw_url = str(id).strip()
        headers = {
            "User-Agent": self._ua,
            "Referer": self.siteUrl + "/",
            "Origin": self.siteUrl
        }
        return {
            "parse": 0,
            "playUrl": "",
            "url": raw_url,
            "header": headers
        }

    def searchContent(self, key, quick, pg="1"):
        del quick
        page = 1
        try:
            page = int(pg)
        except Exception:
            page = 1

        search_url = "%s/search/%s/" % (self.siteUrl, quote(key))
        if page > 1:
            search_url = "%s/search/%s/page/%d/" % (self.siteUrl, quote(key), page)

        res = self._fetch(search_url)
        vod_list = self._parse_card_list(res.get("text", ""))

        pagecount = page + 1 if len(vod_list) >= 10 else page
        if pagecount <= 0:
            pagecount = 1

        return {
            "page": page,
            "pagecount": pagecount,
            "limit": len(vod_list),
            "total": int(page * len(vod_list) + 100) if len(vod_list) >= 10 else len(vod_list),
            "list": vod_list
        }

    def action(self, action):
        return {"msg": "ok"}

    def liveContent(self):
        return ""

    def localProxy(self, params):
        if isinstance(params, str):
            try:
                params = dict(urllib.parse.parse_qsl(params))
            except Exception:
                params = {}

        url = params.get("url", "")
        if not url:
            return [404, "text/plain; charset=utf-8", "Missing url parameter"]

        real_url = unquote(url)
        fetch_res = self._fetch(real_url, referer=self.siteUrl + "/")
        raw_bytes = fetch_res.get("bytes", b"")

        if not raw_bytes:
            return [fetch_res.get("code", 404), "text/plain; charset=utf-8", "Image fetch failed"]

        if raw_bytes[:3] == b"\xff\xd8\xff":
            return [200, "image/jpeg", raw_bytes]
        if raw_bytes[:4] == b"\x89PNG":
            return [200, "image/png", raw_bytes]

        try:
            decrypted_bytes = self.cipher.decrypt(raw_bytes)
            if decrypted_bytes:
                if decrypted_bytes[:3] == b"\xff\xd8\xff":
                    return [200, "image/jpeg", decrypted_bytes]
                if decrypted_bytes[:4] == b"\x89PNG":
                    return [200, "image/png", decrypted_bytes]
                if decrypted_bytes[:4] == b"RIFF" and b"WEBP" in decrypted_bytes[:16]:
                    return [200, "image/webp", decrypted_bytes]
                return [200, "image/jpeg", decrypted_bytes]
        except Exception:
            pass

        return [200, "image/jpeg", raw_bytes]
