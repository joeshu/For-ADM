# -*- coding: utf-8 -*-
"""HGTV public/website-compatible TVBox source, Python 3.8+, stdlib only.

Standalone public edition, not a patch for the attachment's protected-media
pipeline. No device impersonation, signatures, App-cache extraction, content
keys or decryption. Website-denied episodes stay denied. Preview is explicit.
"""
import argparse
import copy
import email.utils
import http.cookiejar
import json
import math
import random
import re
import socket
import ssl
import struct
import sys
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qs, urlencode
from urllib.request import Request, build_opener, HTTPCookieProcessor, HTTPRedirectHandler

VERSION = '1.0.1-public'
ORIGIN = 'https://hongguoduanju.com'
COMPAT_PATH = '/api/video/protected/fallback-play-info'
UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

class SourceError(Exception):
    def __init__(self, message, status=0):
        super().__init__(message)
        self.status = status

class _Flight:
    def __init__(self):
        self.event = threading.Event()
        self.value = None
        self.error = None

class BoundedCache:
    def __init__(self, max_items=32, max_bytes=16 * 1024 * 1024, clock=time.monotonic):
        self.max_items, self.max_bytes, self.clock = max_items, max_bytes, clock
        self.entries, self.flights = OrderedDict(), {}
        self.bytes = 0
        self.lock = threading.RLock()
        self.hits = self.misses = self.shared = 0

    def _purge(self):
        now = self.clock()
        for key, (_, expiry, weight) in list(self.entries.items()):
            if expiry <= now:
                self.entries.pop(key)
                self.bytes -= weight

    def load(self, key, loader, ttl=300, wait_timeout=25):
        with self.lock:
            self._purge()
            if key in self.entries:
                self.hits += 1
                value, expiry, weight = self.entries[key]
                self.entries.move_to_end(key)
                return value
            flight = self.flights.get(key)
            owner = flight is None
            if owner:
                flight = self.flights[key] = _Flight()
                self.misses += 1
            else:
                self.shared += 1
        if not owner:
            if not flight.event.wait(wait_timeout):
                raise SourceError('等待相同请求超时，请重试')
            if flight.error:
                raise SourceError(str(flight.error), getattr(flight.error, 'status', 0))
            return flight.value
        try:
            value = loader()
            weight = getattr(value, 'weight', None)
            if weight is None:
                weight = len(json.dumps(value, ensure_ascii=False).encode('utf-8'))
            ttl = ttl(value) if callable(ttl) else ttl
            flight.value = value
            with self.lock:
                self._purge()
                if weight <= self.max_bytes and ttl > 0:
                    previous = self.entries.pop(key, None)
                    if previous:
                        self.bytes -= previous[2]
                    self.entries[key] = (value, self.clock() + ttl, weight)
                    self.bytes += weight
                    while len(self.entries) > self.max_items or self.bytes > self.max_bytes:
                        _, (_, _, removed) = self.entries.popitem(last=False)
                        self.bytes -= removed
            return value
        except Exception as error:
            flight.error = error
            raise
        finally:
            with self.lock:
                self.flights.pop(key, None)
            flight.event.set()

class _Page:
    def __init__(self, html, router, weight):
        self.html, self.router, self.weight = html, router, weight

class _CheckedRedirect(HTTPRedirectHandler):
    def __init__(self, check):
        self.check = check
    def redirect_request(self, request, fp, code, message, headers, newurl):
        if getattr(request, '_bounded_probe', False):
            # urllib otherwise drains the redirect body outside our read limit.
            if fp is not None: fp.close()
            raise SourceError('视频分段检查不接受重定向，请重新获取播放地址')
        method = request.get_method()
        if code in (301, 302, 303) and method == 'POST':
            method = 'GET'
        self.check(newurl, method)
        return super().redirect_request(request, fp, code, message, headers, newurl)

class PublicHTTP:
    def __init__(self, cache=None, timeout=6, retry_budget=18, attempts=2):
        self.cache = cache or BoundedCache()
        self.timeout, self.retry_budget, self.attempts = timeout, retry_budget, attempts
        self.local = threading.local()
        self.count_lock = threading.Lock()
        self.request_count = 0

    def _opener(self):
        if not hasattr(self.local, 'opener'):
            # Thread-local opener/cookie jar: ordinary cookies persist without
            # sharing mutable session state between simultaneous catalogue calls.
            self.local.opener = build_opener(_CheckedRedirect(self._check), HTTPCookieProcessor(http.cookiejar.CookieJar()))
        return self.local.opener

    @staticmethod
    def permitted(url, method):
        u = urlsplit(url)
        if u.scheme != 'https' or u.username or u.password or u.port:
            return False
        if u.netloc == 'hongguoduanju.com':
            if method == 'POST':
                return u.path == COMPAT_PATH and not u.query
            return method == 'GET' and (u.path in ('/', '/detail') or bool(re.fullmatch(r'/category/[a-z0-9/-]{1,180}|/player/[0-9/]{1,60}|/video/public/[0-9]{1,24}/360p\.mp4', u.path)))
        return method == 'GET' and bool(re.fullmatch(r'v[0-9]+-(?:reading|hgweb)\.qznovelvod\.com', u.netloc, re.I))

    def _once(self, url, method, headers, payload, limit, require_range, deadline):
        self._check(url, method)
        request = Request(url, data=payload, headers=headers, method=method)
        request._bounded_probe = require_range
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SourceError('请求预算已用完')
        with self.count_lock:
            self.request_count += 1
        with self._opener().open(request, timeout=min(self.timeout, remaining)) as response:
            self._check(response.geturl(), method)
            status = response.getcode()
            response_headers = {key.lower(): value for key, value in response.headers.items()}
            # Abort before reading if the server ignored Range. This prevents a
            # nominal header probe from downloading the complete media file.
            if require_range and status != 206:
                raise SourceError('服务器没有提供分段读取', status)
            size = response_headers.get('content-length')
            if size and size.isdigit() and int(size) > limit:
                raise SourceError('响应超过大小限制')
            chunks, total = [], 0
            reader = getattr(response, 'read1', None) or response.read
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise SourceError('响应读取超时')
                transport_socket = getattr(getattr(getattr(response, 'fp', None), 'raw', None), '_sock', None)
                if transport_socket is not None:
                    transport_socket.settimeout(min(self.timeout, remaining))
                read_limit = limit - total if require_range else limit + 1 - total
                block = reader(min(65536, read_limit))
                if not block:
                    break
                total += len(block)
                if total > limit:
                    raise SourceError('响应超过大小限制')
                chunks.append(block)
                if require_range and total == limit:
                    break
            return status, response_headers, b''.join(chunks)

    def _check(self, url, method):
        try:
            valid = self.permitted(url, method)
        except (ValueError, TypeError, AttributeError):
            valid = False
        if not valid:
            raise SourceError('不支持的公开资源地址')

    def request(self, url, method='GET', headers=None, payload=None, limit=3500000, require_range=False, deadline=None):
        self._check(url, method)
        fields = {'User-Agent': UA_WEB, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Accept': '*/*', 'Accept-Encoding': 'identity'}
        fields.update(headers or {})
        # A probe shares one deadline and byte budget across all its ranges.
        # Retrying a partially read range would spend that byte budget twice.
        attempts = 1 if require_range and deadline is not None else self.attempts
        deadline = min(deadline, time.monotonic() + self.retry_budget) if deadline is not None else time.monotonic() + self.retry_budget
        last = None
        for attempt in range(attempts):
            wait = 0.2 * (2 ** attempt) + random.random() * 0.05
            try:
                return self._once(url, method, fields, payload, limit, require_range, deadline)
            except HTTPError as error:
                status = error.code
                retry_after = error.headers.get('Retry-After', '')
                error.close()
                last = SourceError('站点返回 HTTP %d' % status, status)
                if status not in (408, 425, 429) and status < 500:
                    raise last
                if retry_after:
                    try:
                        wait = max(0, float(retry_after))
                    except ValueError:
                        try:
                            wait = max(0, email.utils.parsedate_to_datetime(retry_after).timestamp() - time.time())
                        except Exception:
                            raise last
                    if wait > 2:
                        raise last
            except (ssl.SSLError, SourceError):
                raise
            except (URLError, socket.timeout, OSError) as error:
                if isinstance(getattr(error, 'reason', None), ssl.SSLError):
                    raise SourceError('TLS 证书校验失败')
                last = SourceError('网络连接失败，请稍后重试')
            if attempt + 1 >= attempts or time.monotonic() + wait >= deadline:
                break
            time.sleep(wait)
        raise last or SourceError('请求失败')

    def _page(self, path):
        if not isinstance(path, str) or not path.startswith('/') or path.startswith('//'):
            raise SourceError('页面路径无效')
        def fetch_page():
            _, _, raw = self.request(ORIGIN + path, headers={'Accept': 'text/html,application/xhtml+xml'})
            try:
                html = raw.decode('utf-8')
            except UnicodeDecodeError:
                raise SourceError('页面不是有效 UTF-8')
            router = parse_router_data(html)
            validate_page(router, path)
            return _Page(html, router, len(raw) + len(json.dumps(router, ensure_ascii=False).encode('utf-8')))
        return self.cache.load(('page', path), fetch_page, 30 if path.startswith('/player/') else 300)

    def page(self, path):
        return self._page(path).html

    def router(self, path):
        return self._page(path).router

    def compat(self, sid, vid):
        referer = ORIGIN + ('/player/%s/%s' % (sid, vid) if sid else '/')
        try:
            _, _, raw = self.request(ORIGIN + COMPAT_PATH, method='POST', headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': ORIGIN, 'Referer': referer}, payload=json.dumps({'item_id': vid}).encode(), limit=256000)
        except SourceError as error:
            if error.status in (403, 404):
                raise SourceError('站点未提供本集的整集兼容播放；可使用官方 App', error.status)
            raise
        try:
            data = json.loads(raw.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            raise SourceError('播放接口返回无效 JSON')
        if not isinstance(data, dict) or not isinstance(data.get('base_resp'), dict) or str(data['base_resp'].get('StatusCode')) != '0':
            raise SourceError('播放接口结构变化或返回失败')
        url = data.get('main_url')
        self._check(url or '', 'GET')
        if urlsplit(url).hostname == 'hongguoduanju.com' or data.get('format') == 'dash' or data.get('encrypted') or data.get('audio'):
            raise SourceError('没有返回系统播放器可用的兼容媒体')
        expiry = data.get('url_expire')
        try:
            expiry = float(expiry)
            if not math.isfinite(expiry): expiry = None
            elif expiry > 1e12: expiry /= 1000
        except (ValueError, TypeError):
            expiry = None
        if expiry is not None and expiry <= time.time() + 3:
            raise SourceError('播放地址已过期或临近过期，请重试')
        return url, referer, expiry

    def _probe_range(self, url, headers, start, end, deadline, expected_total=None):
        if time.monotonic() >= deadline:
            raise SourceError('视频初始化检查超时')
        fields = {key: value for key, value in (headers or {}).items() if key.lower() != 'range'}
        fields['Range'] = 'bytes=%d-%d' % (start, end)
        status, response_headers, body = self.request(url, headers=fields, limit=end - start + 1, require_range=True, deadline=deadline)
        match = re.fullmatch(r'bytes ([0-9]{1,20})-([0-9]{1,20})/([0-9]{1,20})', response_headers.get('content-range', ''), re.I)
        if status != 206 or not match:
            raise SourceError('无效的分段响应')
        actual_start, actual_end, total = (int(value) for value in match.groups())
        if not (actual_start == start <= actual_end < total and actual_end == min(end, total - 1) and len(body) == actual_end - start + 1):
            raise SourceError('分段正文长度或范围不匹配')
        if expected_total is not None and total != expected_total:
            raise SourceError('视频在分段检查期间发生变化')
        content_type = response_headers.get('content-type', '').lower()
        encoding = response_headers.get('content-encoding', '').lower()
        if 'text/' in content_type or 'json' in content_type or 'xml' in content_type or encoding not in ('', 'identity'):
            raise SourceError('返回的是网页或压缩响应，而非原始视频字节')
        if time.monotonic() >= deadline:
            raise SourceError('视频初始化检查超时')
        return body, total

    def probe(self, url, headers=None):
        deadline, byte_limit = time.monotonic() + 20, 1024 * 1024
        prefix, total = self._probe_range(url, headers, 0, 65535, deadline)
        windows, transferred, requests = [(0, prefix)], len(prefix), 1

        def read_at(start, length, read_ahead=False):
            nonlocal transferred, requests
            if start + length > total:
                raise SourceError('MP4 初始化信息不完整，无法确认视频轨')
            pieces, at = [], start
            while at < start + length:
                if time.monotonic() >= deadline:
                    raise SourceError('视频初始化检查超时')
                window = next(((offset, data) for offset, data in windows if offset <= at < offset + len(data)), None)
                if window:
                    offset, data = window
                    count = min(start + length - at, offset + len(data) - at)
                    pieces.append(data[at - offset:at - offset + count])
                    at += count
                    continue
                needed = start + length - at
                count = min(max(needed, 65536) if read_ahead else needed, total - at, byte_limit - transferred)
                if requests >= 4 or count < needed:
                    raise SourceError('MP4 初始化信息不完整：已达到元数据检查预算')
                data, _ = self._probe_range(url, headers, at, at + count - 1, deadline, total)
                windows.append((at, data))
                transferred += len(data)
                requests += 1
            return b''.join(pieces)

        # Follow top-level box sizes; never search media payload for box names.
        at, ftyp, moov = 0, None, None
        for _ in range(512):
            if at >= total:
                break
            head = read_at(at, 8, True)
            size, kind = struct.unpack('>I4s', head)
            header_size = 8
            if size == 1:
                size = struct.unpack_from('>Q', read_at(at, 16), 8)[0]
                header_size = 16
            elif size == 0:
                size = total - at
            if size < header_size or at + size > total:
                raise SourceError('MP4 初始化信息不完整：文件结构或长度无效')
            if kind in (b'ftyp', b'moov'):
                if size > byte_limit:
                    raise SourceError('MP4 初始化信息不完整：元数据超过检查预算')
                box = read_at(at, size)
                # A zero-sized terminal box was read to the known file end.
                if head[:4] == b'\0\0\0\0':
                    box = struct.pack('>I', size) + box[4:]
                if kind == b'ftyp': ftyp = box
                else: moov = box
            at += size
            if ftyp is not None and moov is not None:
                break
        if ftyp is None:
            raise SourceError('媒体不是有效的 MP4 文件')
        if moov is None:
            raise SourceError('MP4 初始化信息不完整：没有取得完整 moov')
        # Only complete metadata boxes are joined, never disjoint media bytes.
        info = inspect_mp4(ftyp + moov)
        if not info['mp4'] or not info['initialization_complete']:
            raise SourceError('MP4 初始化信息不完整，无法确认视频轨')
        if info['encrypted']:
            raise SourceError('媒体包含加密样本，无法直接播放')
        if not info['has_video']:
            raise SourceError('MP4 没有具有非零画面尺寸的视频轨，可能仅含音频')
        if time.monotonic() >= deadline:
            raise SourceError('视频初始化检查超时')
        return info


def inspect_mp4(data):
    if not isinstance(data, bytes) or len(data) > 1024 * 1024:
        raise SourceError('无效的媒体探针大小')
    result = {'mp4': False, 'encrypted': False, 'duration': None, 'tracks': [],
              'initialization_complete': False, 'has_video': None,
              'codecs': [], 'dimensions': [], 'encryption_known': False}
    result['video_codecs'], result['video_dimensions'] = result['codecs'], result['dimensions']
    budget = [2048]

    def boxes(start, end):
        nodes, at = [], start
        while at < end:
            budget[0] -= 1
            if budget[0] < 0 or at + 8 > end:
                raise ValueError('incomplete box or metadata budget exhausted')
            size, kind = struct.unpack_from('>I4s', data, at)
            header = 8
            if size == 1:
                if at + 16 > end: raise ValueError('incomplete extended box')
                size, header = struct.unpack_from('>Q', data, at + 8)[0], 16
            if size < header or at + size > end:
                raise ValueError('invalid or incomplete child box')
            nodes.append((kind, at + header, at + size))
            at += size
        return nodes

    def one(nodes, kind, required=True):
        found = [node for node in nodes if node[0] == kind]
        if len(found) > 1 or (required and not found):
            raise ValueError('missing or duplicate initialization box')
        return found[0] if found else None

    def movie_header(node):
        _, start, end = node
        if start + 4 > end: raise ValueError('incomplete movie header')
        version = data[start]
        if version == 0 and start + 20 <= end:
            scale, duration = struct.unpack_from('>II', data, start + 12)
        elif version == 1 and start + 32 <= end:
            scale = struct.unpack_from('>I', data, start + 20)[0]
            duration = struct.unpack_from('>Q', data, start + 24)[0]
        else:
            raise ValueError('unsupported or incomplete movie header')
        if not scale: raise ValueError('invalid movie timescale')
        return duration / scale

    def track(node):
        _, start, end = node
        mdia = one(boxes(start, end), b'mdia')
        children = boxes(mdia[1], mdia[2])
        hdlr = one(children, b'hdlr')
        if hdlr[1] + 24 > hdlr[2]: raise ValueError('incomplete media handler')
        handler = data[hdlr[1] + 8:hdlr[1] + 12]
        minf = one(children, b'minf', handler in (b'vide', b'soun'))
        if minf is None: return [], [], [], False
        stbl = one(boxes(minf[1], minf[2]), b'stbl', handler in (b'vide', b'soun'))
        if stbl is None: return [], [], [], False
        stsd = one(boxes(stbl[1], stbl[2]), b'stsd', handler in (b'vide', b'soun'))
        if stsd is None: return [], [], [], False
        start, end = stsd[1:]
        if start + 8 > end or data[start] != 0:
            raise ValueError('incomplete or unsupported sample description')
        count = struct.unpack_from('>I', data, start + 4)[0]
        entries = boxes(start + 8, end)
        if len(entries) != count: raise ValueError('sample description count mismatch')
        tracks, codecs, dimensions, encrypted = [], [], [], False
        for kind, payload, stop in entries:
            if payload + 8 > stop: raise ValueError('incomplete sample entry')
            codec = kind.decode('ascii', 'replace')
            tracks.append(codec)
            encrypted |= kind in (b'encv', b'enca')
            if handler == b'vide':
                if kind not in (b'avc1', b'avc2', b'avc3', b'avc4', b'hvc1', b'hev1', b'av01', b'vp08', b'vp09', b'mp4v', b's263', b'jpeg', b'encv'):
                    raise ValueError('unsupported visual sample entry')
                if payload + 78 > stop: raise ValueError('incomplete visual sample entry')
                width, height = struct.unpack_from('>HH', data, payload + 24)
                codecs.append(codec)
                if width and height:
                    dimensions.append({'width': width, 'height': height})
        return tracks, codecs, dimensions, encrypted

    at, moov_seen = 0, False
    while at + 8 <= len(data):
        size, kind = struct.unpack_from('>I4s', data, at)
        header = 8
        if size == 1:
            if at + 16 > len(data): break
            size, header = struct.unpack_from('>Q', data, at + 8)[0], 16
        # A bare prefix cannot establish the end of a zero-sized box.
        if size < header or at + size > len(data): break
        if kind == b'ftyp' and size >= header + 8:
            result['mp4'] = True
        elif kind == b'moov':
            if moov_seen:
                result['initialization_complete'] = result['encryption_known'] = False
                result['has_video'] = None
                break
            moov_seen = True
            try:
                nodes = boxes(at + header, at + size)
                duration = movie_header(one(nodes, b'mvhd'))
                tracks, codecs, dimensions, encrypted = [], [], [], False
                for node in nodes:
                    if node[0] != b'trak': continue
                    descriptions, video_codecs, sizes, protected = track(node)
                    tracks.extend(descriptions)
                    codecs.extend(video_codecs)
                    dimensions.extend(sizes)
                    encrypted |= protected
                result.update(duration=duration, tracks=tracks, codecs=codecs, dimensions=dimensions,
                              video_codecs=codecs, video_dimensions=dimensions, encrypted=encrypted,
                              initialization_complete=True, encryption_known=True, has_video=bool(dimensions))
            except (ValueError, struct.error):
                result['has_video'] = None
        at += size
    return result


def validate_page(router, path):
    data = router['loaderData']
    u = urlsplit(path)
    if path == '/':
        payload = data.get('page')
        valid = isinstance(payload, dict) and any(isinstance(payload.get(key), list) for key in ('mBannerList', 'bannerList', 'banner_list', 'homeSections', 'home_sections', 'sections'))
    elif u.path.startswith('/category/'):
        payload = data.get('category_$')
        valid = isinstance(payload, dict) and any(isinstance(payload.get(key), list) for key in ('recommendList', 'video_list', 'videoList', 'list'))
    elif u.path == '/detail':
        payload = data.get('detail_page') or data.get('detail_$')
        item = (payload.get('seriesDetail') or payload.get('series_detail')) if isinstance(payload, dict) else None
        expected = parse_qs(u.query).get('series_id', [''])[0]
        valid = isinstance(item, dict) and str(item.get('series_id') or item.get('seriesId')) == expected and bool(item.get('vid_list') or item.get('video_list') or item.get('videoList') or item.get('episodes'))
    else:
        payload = next((value for key, value in data.items() if 'player' in key and isinstance(value, dict) and 'publicVideoSeo' in value), None)
        valid = isinstance(payload, dict)
    if not valid or payload.get('isSuccess') is False:
        raise SourceError('页面结构变化或站点暂未返回有效数据')


# Bounded SSR parsing. Playback sources below are unresolved directory entries;
# the presence of an episode ID alone says nothing about media availability.
MAX_HTML_BYTES = 3_500_000
MAX_ROUTER_BYTES = 2_500_000
MAX_JSON_DEPTH = 128
MAX_PAGES = 10_000
_ID_RE = re.compile(r"[0-9]{1,24}\Z")
_SLUG_RE = re.compile(r"[a-z0-9-]{1,80}\Z", re.ASCII)
_ASSIGN_RE = re.compile(r"(?:(?:window|globalThis)\s*\.\s*)?_ROUTER_DATA\s*=")
_CATEGORIES = (
    ("real-drama", "真人短剧"),
    ("comic-drama", "漫剧"),
    ("ai-drama", "AI 短剧"),
    ("comic", "漫画"),
)


class CatalogError(ValueError):
    """The requested path, SSR data, or public catalogue shape is invalid."""


class _Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.scripts = []
        self._parts = None

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self._parts = []

    def handle_data(self, data):
        if self._parts is not None:
            self._parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._parts is not None:
            self.scripts.append("".join(self._parts))
            self._parts = None


def _assignment_start(script):
    """Find a real assignment token, ignoring JS strings and comments."""
    index, length = 0, len(script)
    while index < length:
        char = script[index]
        if char in "\"'`":
            quote = char
            index += 1
            while index < length:
                if script[index] == "\\":
                    index += 2
                elif script[index] == quote:
                    index += 1
                    break
                else:
                    index += 1
            continue
        if script.startswith("//", index):
            newline = script.find("\n", index + 2)
            index = length if newline < 0 else newline + 1
            continue
        if script.startswith("/*", index):
            end = script.find("*/", index + 2)
            index = length if end < 0 else end + 2
            continue
        previous = script[index - 1] if index else ""
        if char in "wg_" and not (previous and (previous.isalnum() or previous in "_.$")):
            match = _ASSIGN_RE.match(script, index)
            if match:
                start = match.end()
                while start < length and script[start].isspace():
                    start += 1
                if start >= length or script[start] != "{":
                    raise CatalogError("_ROUTER_DATA must be a literal JSON object")
                return start
        index += 1
    return None


def _json_object(script, start):
    stack, in_string, escaped = [], False, False
    for index in range(start, min(len(script), start + MAX_ROUTER_BYTES + 1)):
        if index - start >= MAX_ROUTER_BYTES:
            raise CatalogError("router JSON exceeds its size limit")
        char = script[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char in "{[":
            stack.append(char)
            if len(stack) > MAX_JSON_DEPTH:
                raise CatalogError("router JSON exceeds its nesting limit")
        elif char in "}]":
            expected = "{" if char == "}" else "["
            if not stack or stack.pop() != expected:
                raise CatalogError("router JSON has mismatched brackets")
            if not stack:
                value = script[start:index + 1]
                if len(value.encode("utf-8")) > MAX_ROUTER_BYTES:
                    raise CatalogError("router JSON exceeds its size limit")
                tail = script[index + 1:].lstrip()
                if tail and not tail.startswith((";", "//", "/*")):
                    raise CatalogError("router assignment is not plain JSON")
                return value
    raise CatalogError("router JSON is incomplete")


def _reject_constant(value):
    raise CatalogError("non-finite JSON number: " + value)


def _bounded_int(value):
    if len(value.lstrip("-")) > 64:
        raise CatalogError("JSON integer exceeds its digit limit")
    return int(value)


def _finite_float(value):
    if len(value) > 128:
        raise CatalogError("JSON number exceeds its digit limit")
    number = float(value)
    if not math.isfinite(number):
        raise CatalogError("JSON number exceeds finite range")
    return number


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise CatalogError("duplicate JSON object key")
        result[key] = value
    return result


def parse_router_data(html):
    """Extract a size/depth-bounded literal _ROUTER_DATA object without eval."""
    if isinstance(html, bytes):
        if len(html) > MAX_HTML_BYTES:
            raise CatalogError("HTML exceeds its size limit")
        try:
            html = html.decode("utf-8")
        except UnicodeDecodeError as error:
            raise CatalogError("HTML is not UTF-8") from error
    if not isinstance(html, str) or len(html) > MAX_HTML_BYTES:
        raise CatalogError("HTML must be bounded text")
    try:
        if len(html.encode("utf-8")) > MAX_HTML_BYTES:
            raise CatalogError("HTML exceeds its size limit")
        parser = _Scripts()
        parser.feed(html)
        parser.close()
        for script in parser.scripts:
            start = _assignment_start(script)
            if start is None:
                continue
            router = json.loads(_json_object(script, start),
                                parse_constant=_reject_constant,
                                parse_int=_bounded_int,
                                parse_float=_finite_float,
                                object_pairs_hook=_unique_object)
            if not isinstance(router, dict) or not isinstance(router.get("loaderData"), dict):
                raise CatalogError("router data has no loaderData object")
            return router
    except CatalogError:
        raise
    except (UnicodeError, RecursionError, ValueError) as error:
        raise CatalogError("invalid router JSON") from error
    raise CatalogError("HTML contains no literal _ROUTER_DATA assignment")


def _array(data, *keys):
    for key in keys:
        if isinstance(data.get(key), list):
            return data[key]
    return []


def _identifier(value):
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        return ""
    text = str(value)
    return text if _ID_RE.fullmatch(text) else ""


def _text(value, limit=500):
    return value.strip()[:limit] if isinstance(value, str) else ""


def _natural(value, maximum=1_000_000):
    text = _identifier(value)
    if not text:
        return None
    number = int(text)
    return number if number <= maximum else None


def _first(data, *keys):
    for key in keys:
        if data.get(key) is not None:
            return data[key]
    return None


def _image(value):
    if not isinstance(value, str) or len(value) > 4096 or any(ord(char) < 33 for char in value):
        return ""
    try:
        url = urlsplit(value)
        if url.scheme == "https" and url.hostname and not url.username and not url.password:
            _ = url.port
            return value
    except ValueError:
        pass
    return ""


def _movie(row):
    if not isinstance(row, dict):
        return None
    series_id = _identifier(_first(row, "series_id", "seriesId", "id"))
    title = _text(_first(row, "series_name", "seriesName", "series_title", "title"))
    if not series_id or not title:
        return None
    return {"id": series_id, "title": title,
            "cover": _image(_first(row, "series_cover", "cover", "image", "cover_url")),
            "count": _natural(_first(row, "episode_cnt", "episodeCount", "episode_count"))}


def _movies(rows):
    unique = OrderedDict()
    for row in rows:
        item = _movie(row)
        if item is not None:
            unique[item["id"]] = item
    return list(unique.values())


def _page_number(value):
    number = _natural(value, MAX_PAGES)
    if number is None or number < 1:
        raise CatalogError("page must be an integer from 1 to %d" % MAX_PAGES)
    return number


class Catalog:
    """Public SSR directory plus a bounded, explicitly local search index."""

    def __init__(self, http, max_catalog=2000, search_page_size=24):
        if not callable(getattr(http, "page", None)):
            raise TypeError("http.page(path) is required")
        self.http = http
        self.max_catalog = _natural(max_catalog, 100_000)
        self.search_page_size = _natural(search_page_size, 1000)
        if not self.max_catalog or not self.search_page_size:
            raise ValueError("catalog and page sizes must be positive bounded integers")
        self._catalog = OrderedDict()
        self._paths = OrderedDict()
        self._evictions = 0
        self._paths_trimmed = False
        self._lock = threading.RLock()

    def _route(self, path, kind):
        loader = (self.http.router(path) if callable(getattr(self.http, "router", None)) else parse_router_data(self.http.page(path)))["loaderData"]
        keys = {"home": ("page",), "category": ("category_$",),
                "detail": ("detail_page", "detail_$")}[kind]
        for key in keys:
            data = loader.get(key)
            if isinstance(data, dict):
                if data.get("isSuccess") is False:
                    raise CatalogError("site returned an unsuccessful %s page" % kind)
                return data
        raise CatalogError("site %s loader structure has changed" % kind)

    def _remember(self, path, items):
        with self._lock:
            self._paths[path] = None
            self._paths.move_to_end(path)
            while len(self._paths) > 64:
                self._paths.popitem(last=False)
                self._paths_trimmed = True
            for item in items:
                self._catalog[item["id"]] = dict(item)
                self._catalog.move_to_end(item["id"])
                while len(self._catalog) > self.max_catalog:
                    self._catalog.popitem(last=False)
                    self._evictions += 1

    def categories(self):
        return [{"id": slug, "title": title} for slug, title in _CATEGORIES]

    def home(self):
        data = self._route("/", "home")
        if not any(isinstance(data.get(key), list) for key in
                   ("mBannerList", "bannerList", "banner_list", "homeSections", "home_sections", "sections")):
            raise CatalogError("site home catalogue structure has changed")
        sections = []
        banners = _movies(_array(data, "mBannerList", "bannerList", "banner_list"))
        if banners:
            sections.append({"title": "红果精选短剧", "items": banners})
        for section in _array(data, "homeSections", "home_sections", "sections"):
            if not isinstance(section, dict):
                continue
            items = _movies(_array(section, "video_list", "videoList", "list"))
            if items:
                sections.append({"title": _text(_first(section, "tab_name", "tabName", "title")) or "红果短剧",
                                 "items": items})
        unique = OrderedDict((item["id"], item) for section in sections for item in section["items"])
        items = list(unique.values())
        self._remember("/", items)
        return {"items": items, "sections": sections}

    def category(self, slug, page=1, topic=None):
        page = _page_number(page)
        if not isinstance(slug, str):
            raise CatalogError("category must be a known slug")
        parts = slug.split("/")
        if len(parts) > 2 or parts[0] not in dict(_CATEGORIES):
            raise CatalogError("unknown category")
        if len(parts) == 2:
            if topic is not None:
                raise CatalogError("topic was supplied twice")
            topic = parts[1]
        if topic is not None and (not isinstance(topic, str) or not _SLUG_RE.fullmatch(topic)):
            raise CatalogError("invalid category topic")
        category_slug = parts[0] + (("/" + topic) if topic else "")
        path = "/category/" + category_slug + "?" + urlencode({"page": page})
        data = self._route(path, "category")
        if not any(isinstance(data.get(key), list) for key in ("recommendList", "video_list", "videoList", "list")):
            raise CatalogError("site category catalogue structure has changed")
        items = _movies(_array(data, "recommendList", "video_list", "videoList", "list"))
        pagination = data.get("pagination") or data.get("page_info") or {}
        pagination = pagination if isinstance(pagination, dict) else {}
        total = _natural(_first(pagination, "total", "totalCount", "total_count"), 100_000_000)
        pages = _natural(_first(pagination, "totalPages", "total_pages", "pageCount", "page_count"), MAX_PAGES)
        page_size = _natural(_first(pagination, "pageSize", "page_size")) or _natural(data.get("pageSize"))
        if not pages and total is not None and page_size:
            pages = min(MAX_PAGES, max(1, math.ceil(total / page_size)))
        selectors = []
        for index, row in enumerate(_array(data, "selectorList", "selector_list", "selectors"), 1):
            if not isinstance(row, dict):
                continue
            options = OrderedDict()
            for option in _array(row, "items", "list"):
                if not isinstance(option, dict):
                    continue
                option_id = _first(option, "selector_item_id", "selectorItemId", "id")
                option_id = str(option_id) if isinstance(option_id, int) and not isinstance(option_id, bool) else option_id
                title = _text(_first(option, "show_name", "showName", "name", "title"))
                if isinstance(option_id, str) and _SLUG_RE.fullmatch(option_id) and title:
                    options[option_id] = {"id": option_id, "title": title,
                                          "path": parts[0] + "/" + option_id}
            if options:
                selectors.append({"id": _text(_first(row, "selector_id", "selectorId", "id")) or str(index),
                                  "title": _text(_first(row, "show_name", "showName", "name", "title")) or "题材",
                                  "items": list(options.values())})
        self._remember(path, items)
        return {"items": items, "page": page, "pagecount": pages or page,
                "total": total, "pagination_known": bool(pages), "selectors": selectors}

    def detail(self, series_id):
        series_id = _identifier(series_id)
        if not series_id:
            raise CatalogError("invalid series ID")
        path = "/detail?" + urlencode({"series_id": series_id})
        data = self._route(path, "detail")
        series = data.get("seriesDetail") or data.get("series_detail")
        if not isinstance(series, dict):
            raise CatalogError("site detail catalogue structure has changed")
        movie = _movie(series)
        if movie is None or movie["id"] != series_id:
            raise CatalogError("detail series ID or title does not match the request")
        episodes, seen, invalid, duplicates = [], set(), 0, 0
        for item in _array(series, "vid_list", "video_list", "videoList", "episodes"):
            raw_id = _first(item, "vid", "video_id", "videoId", "item_id", "id") if isinstance(item, dict) else item
            video_id = _identifier(raw_id)
            if not video_id:
                invalid += 1
                continue
            if video_id in seen:
                duplicates += 1
                continue
            seen.add(video_id)
            number = len(episodes) + 1
            title = _text(_first(item, "title", "name")) if isinstance(item, dict) else ""
            episodes.append({"id": video_id, "title": title or "第%d集" % number, "number": number})
        if not episodes:
            raise CatalogError("detail contains no valid episode IDs")
        expected = movie["count"]
        complete = None if expected is None else expected == len(episodes) and not invalid and not duplicates
        sources = {kind: [{**episode, "preview": preview, "availability": "unresolved"}
                          for episode in episodes]
                   for kind, preview in (("full", False), ("preview", True))}
        self._remember(path, [movie])
        return {**movie, "episodes": episodes, "episode_count": len(episodes),
                "catalog_complete": complete, "invalid_episode_entries": invalid,
                "duplicate_episode_entries": duplicates, "sources": sources,
                "source_names": {"full": "官网完整播放", "preview": "官网公开试看"},
                "playback_verified": False,
                "description": _text(_first(series, "series_intro", "seriesIntro", "description"), 20_000)}

    def search(self, keyword, page=1):
        """Search retained titles only. This method never performs HTTP requests."""
        page = _page_number(page)
        query = _text(keyword, 200).casefold()
        with self._lock:
            matches = [dict(item) for item in self._catalog.values()
                       if query and query in item["title"].casefold()]
            scope = {"catalog_size": len(self._catalog), "max_catalog_items": self.max_catalog,
                     "eviction_events": self._evictions, "recent_paths": list(self._paths),
                     "recent_paths_limited": self._paths_trimmed}
        total = len(matches)
        offset = (page - 1) * self.search_page_size
        return {"items": matches[offset:offset + self.search_page_size], "page": page,
                "pagecount": max(1, math.ceil(total / self.search_page_size)), "total": total,
                "scope": "local_catalog",
                "scope_description": "仅搜索本次实例已抓取并保留的目录标题，非全站搜索；未命中不表示全站无结果。",
                **scope}


_SHARED_HTTP = PublicHTTP()

def _label(value):
    return re.sub(r'[$#\r\n]+', ' ', str(value or ''))[:160].strip()

def _card(item):
    return {'vod_id': item['id'], 'vod_name': item['title'], 'vod_pic': item['cover'], 'vod_remarks': ('全%d集' % item['count']) if item.get('count') else ''}

class Spider:
    def __init__(self, http=None):
        self.http = http or _SHARED_HTTP
        self.catalog = Catalog(self.http)
        self.cache = self.http.cache
        self.extend = ''
        self._warm_key = object()

    def init(self, extend=''):
        self.extend = extend or ''

    def homeContent(self, filter=False):
        return {'class': [{'type_id': item['id'], 'type_name': item['title']} for item in self.catalog.categories()], 'filters': {}}

    def homeVideoContent(self):
        try:
            return {'list': [_card(item) for item in self.catalog.home()['items']]}
        except Exception as error:
            return {'list': [], 'msg': str(error)}

    def categoryContent(self, tid, pg, filter=False, extend=None):
        try:
            topic = (extend or {}).get('topic') if isinstance(extend, dict) else None
            data = self.catalog.category(str(tid), pg, topic)
            return {'list': [_card(item) for item in data['items']], 'page': data['page'], 'pagecount': data['pagecount'], 'limit': 24, 'total': data['total'] if data['total'] is not None else len(data['items']), 'total_known': data['total'] is not None, 'pagination_known': data['pagination_known'], 'selectors': data['selectors']}
        except Exception as error:
            return {'list': [], 'page': 1, 'pagecount': 1, 'limit': 24, 'total': 0, 'msg': str(error)}

    def detailContent(self, ids):
        try:
            sid = ids[0] if isinstance(ids, (list, tuple)) and ids else ids
            if isinstance(sid, (list, tuple)) or not _identifier(sid):
                raise SourceError('影片 ID 无效')
            data = self.catalog.detail(sid)
            entries = '#'.join('%s$%s~%s' % (_label(episode['title']), data['id'], episode['id']) for episode in data['episodes'])
            movie = _card(data)
            movie.update({'vod_content': data['description'], 'vod_play_from': '官网完整播放$$$公开试看（片段）', 'vod_play_url': entries + '$$$' + entries, 'catalog_complete': data['catalog_complete'], 'episode_count': data['episode_count'], 'playback_verified': False})
            return {'list': [movie]}
        except Exception as error:
            return {'list': [], 'msg': str(error)}

    def _warm_search(self):
        def warm():
            failures = []
            with ThreadPoolExecutor(max_workers=3) as pool:
                calls = [pool.submit(self.catalog.home)] + [pool.submit(self.catalog.category, item['id'], 1) for item in self.catalog.categories()]
                for call in calls:
                    try: call.result()
                    except Exception as error: failures.append(str(error))
            if failures:
                raise SourceError('部分公开目录暂未加载；本地搜索结果可能不完整')
            return True
        self.cache.load(('search-warm', self._warm_key), warm, 300, wait_timeout=45)

    def searchContent(self, key, quick=False, pg='1'):
        try:
            page = _page_number(pg)
            if not isinstance(key, str) or len(key) > 200:
                raise SourceError('搜索词无效或过长')
            warning = ''
            if key.strip():
                try: self._warm_search()
                except SourceError as error: warning = str(error)
            data = self.catalog.search(key, page)
            result = {'list': [_card(item) for item in data['items']], 'page': data['page'], 'pagecount': data['pagecount'], 'limit': 24, 'total': data['total'], 'scope': data['scope'], 'msg': data['scope_description']}
            if warning: result['msg'] = warning + '；' + result['msg']
            return result
        except Exception as error:
            return {'list': [], 'page': 1, 'pagecount': 1, 'total': 0, 'msg': str(error)}

    def playerContent(self, flag, id, vipFlags=None):
        preview = '试看' in str(flag) or 'preview' in str(flag).lower()
        empty = {'parse': 0, 'playUrl': '', 'url': '', 'header': {}, 'format': 'video/mp4', 'preview': preview, 'playback_verified': False}
        try:
            parts = str(id or '').strip().split('~')
            if len(parts) == 1:
                sid, vid = '', parts[0]
            elif len(parts) == 2:
                sid, vid = parts
                if not _identifier(sid): raise SourceError('剧 ID 无效')
            else:
                raise SourceError('选集 ID 无效')
            if not _identifier(vid): raise SourceError('选集 ID 无效')
            def resolve_public():
                if preview:
                    url, referer, expiry = ORIGIN + '/video/public/' + vid + '/360p.mp4', ORIGIN + '/', None
                else:
                    url, referer, expiry = self.http.compat(sid, vid)
                playback_headers = {'User-Agent': UA_WEB, 'Referer': referer, 'Accept': '*/*', 'Accept-Encoding': 'identity'}
                info = self.http.probe(url, playback_headers)
                if expiry is not None and expiry <= time.time() + 2:
                    raise SourceError('播放地址在预检期间过期，请重试')
                return dict(empty, url=url, header=playback_headers, expires_at=expiry, duration=info['duration'],
                            initialization_complete=info.get('initialization_complete', False),
                            video_codecs=info.get('video_codecs', []),
                            video_dimensions=info.get('video_dimensions', []),
                            verification='mp4-video-initialization-only',
                            msg='公开试看片段，非整集' if preview else '官网兼容播放；已检查视频轨初始化，未验证客户端完整解码/播放')
            ttl = lambda result: 10 if preview else max(0, min(10, result['expires_at'] - time.time() - 2)) if result.get('expires_at') else 0
            # Resolution can use an 18s API budget plus a 20s media probe. A
            # concurrent caller must not time out before that owner can finish.
            return copy.deepcopy(self.cache.load(('play', preview, sid, vid), resolve_public, ttl, wait_timeout=45))
        except Exception as error:
            return dict(empty, msg=str(error), status=getattr(error, 'status', 0))


def _cli(argv=None):
    parser = argparse.ArgumentParser(description='HGTV 公开/官网兼容版；不包含受保护媒体处理')
    subs = parser.add_subparsers(dest='command')
    test = subs.add_parser('selftest', help='检查目录和地址/文件头，不代表完整解码')
    test.add_argument('--series', default='7690961604636052505')
    test.add_argument('--all', action='store_true', help='逐集检查；任一集不可用就返回非零')
    detail_cmd = subs.add_parser('detail')
    detail_cmd.add_argument('series')
    search_cmd = subs.add_parser('search')
    search_cmd.add_argument('keyword')
    search_cmd.add_argument('--page', default='1')
    play_cmd = subs.add_parser('play')
    play_cmd.add_argument('episode', help='视频 ID 或 剧ID~视频ID')
    play_cmd.add_argument('--preview', action='store_true')
    args = parser.parse_args(argv)
    sp = Spider()
    command = args.command or 'selftest'
    if command == 'search':
        data = sp.searchContent(args.keyword, pg=args.page)
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 1 if not data['list'] else 0
    if command == 'detail':
        data = sp.detailContent([args.series])
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0 if data['list'] else 1
    if command == 'play':
        data = sp.playerContent('preview' if args.preview else 'full', args.episode)
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0 if data['url'] else 1
    sid = getattr(args, 'series', '7690961604636052505')
    result = {'version': VERSION, 'scope': '目录、地址和 MP4 初始化；不代表完整播放或全集播放验证', 'full_playback_verified': False, 'all_episodes_playback_verified': False}
    try:
        data = sp.catalog.detail(sid)
        targets = data['episodes'] if getattr(args, 'all', False) else data['episodes'][:1]
        if len(targets) > 500:
            raise SourceError('单次自检最多检查 500 集，请按需逐集使用 play')
        def inspect_episode(episode):
            r = sp.playerContent('full', data['id'] + '~' + episode['id'])
            return {'episode': episode['number'], 'available': bool(r['url']), 'duration': r.get('duration'),
                    'initialization_complete': r.get('initialization_complete', False),
                    'video_codecs': r.get('video_codecs', []), 'video_dimensions': r.get('video_dimensions', []),
                    'message': r.get('msg'), 'status': r.get('status', 200)}
        if getattr(args, 'all', False):
            with ThreadPoolExecutor(max_workers=3) as pool:
                rows = list(pool.map(inspect_episode, targets))
        else:
            rows = [inspect_episode(episode) for episode in targets]
        result.update(catalogue_count=data['episode_count'], catalogue_complete=data['catalog_complete'], checked_count=len(rows), episodes=rows)
        passed = bool(rows) and data['catalog_complete'] is not False and all(row['available'] for row in rows)
    except Exception as error:
        result['error'], passed = str(error), False
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(_cli())
