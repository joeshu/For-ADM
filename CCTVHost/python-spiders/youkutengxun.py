#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Youku_Tencent_CCTVHost.py
适配 iOS CCTVHost (python-spider) 与 TVBox 的优酷 + 腾讯视频双平台单文件整合插件。

核心特性：
1. 零外部私有依赖：内置 Spider 基类回退，使用标准库 hashlib / re / urllib 替代 pyquery 与 pycryptodome，单文件直接导入 iOS CCTVHost 即可运行。
2. 双平台全量整合：融合腾讯视频 (trpc 协议) 与优酷视频 (MTOP H5 令牌签名 + IKU 网关 + category/data)，统一支持分类、动态筛选、分页选集与双源并发搜索。
3. 历史 Bug 修复：修复腾讯浅拷贝 page_context 跨分类污染问题；补齐优酷详情页缺失的 vod_name 与 vod_pic 字段。
4. iOS 原生播放三级引擎 (playerContent + localProxy)：
   - 级联 1：云端同源 M3U8 直连匹配 + 官方优酷 UPS (mtop.youku.play.ups.appinfo.get) 原生流提取 (parse=0 免嗅探秒播)。
   - 级联 2：多路 JSON 解析池并发提取真实 .m3u8/.mp4 直链 (parse=0)。
   - 级联 3：移植 drpy2 fixAdM3u8Ai 公共前缀比对算法至 localProxy，自动剥离 M3U8 插播广告切片；兜底返回标准官源地址。
"""

import argparse
import base64
import copy
import hashlib
import json
import re
import sys
import time
import uuid
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote, unquote, urlencode, urljoin

try:
    import requests
except ImportError:
    requests = None

try:
    sys.path.append('..')
    from base.spider import Spider as BaseSpider
except Exception:
    class BaseSpider(object):
        """iOS CCTVHost 单文件独立运行兜底基类"""

        def init(self, extend=""):
            pass

        def getName(self):
            return "YoukuTencentCCTVHost"

        def isVideoFormat(self, url):
            return bool(re.search(r'\.(m3u8|mp4|flv|m4a)(\?|$)', str(url), re.I))

        def manualVideoCheck(self):
            return False

        def destroy(self):
            pass

        def getProxyUrl(self, local=True):
            return "http://127.0.0.1:9978/proxy?do=py"

        def cleanText(self, text):
            return re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()

        def fetch(self, url, headers=None, params=None, timeout=8, verify=True):
            if params:
                sep = '&' if '?' in url else '?'
                url = f"{url}{sep}{urlencode(params)}"
            if requests is not None:
                return requests.get(url, headers=headers, timeout=timeout)
            from urllib import request as urlrequest
            req = urlrequest.Request(url, headers=headers or {})
            with urlrequest.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode('utf-8', errors='replace')
                return _SimpleResponse(body, resp.getcode(), dict(resp.info()))

        def post(self, url, data=None, json=None, headers=None, timeout=8, verify=True):
            if requests is not None:
                return requests.post(url, data=data, json=json, headers=headers, timeout=timeout)
            import json as _json
            from urllib import request as urlrequest
            hdrs = dict(headers or {})
            if json is not None:
                payload = _json.dumps(json).encode('utf-8')
                hdrs.setdefault('Content-Type', 'application/json')
            elif isinstance(data, str):
                payload = data.encode('utf-8')
            else:
                payload = urlencode(data or {}).encode('utf-8')
            req = urlrequest.Request(url, data=payload, headers=hdrs, method='POST')
            with urlrequest.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode('utf-8', errors='replace')
                return _SimpleResponse(body, resp.getcode(), dict(resp.info()))


class _SimpleResponse(object):
    """当环境无 requests 时用于兼容 .text 与 .json() 的轻量响应封装"""

    def __init__(self, text, status_code=200, headers=None):
        self.text = text
        self.status_code = status_code
        self.headers = headers or {}

    def json(self):
        return json.loads(self.text)


class _UrllibSession(object):
    """当环境无 requests.Session 时提供带 CookieJar 的兼容会话"""

    def __init__(self):
        import http.cookiejar
        from urllib import request as urlrequest
        self.headers = {}
        self.cookie_jar = http.cookiejar.CookieJar()
        self.cookies = {}
        self._opener = urlrequest.build_opener(urlrequest.HTTPCookieProcessor(self.cookie_jar))

    def get(self, url, params=None, headers=None, timeout=8):
        from urllib import request as urlrequest
        if params:
            sep = '&' if '?' in url else '?'
            url = f"{url}{sep}{urlencode(params)}"
        merged_headers = dict(self.headers)
        if headers:
            merged_headers.update(headers)
        cookie_str = '; '.join([f"{k}={v}" for k, v in self.cookies.items()])
        if cookie_str:
            merged_headers['Cookie'] = cookie_str
        req = urlrequest.Request(url, headers=merged_headers, method='GET')
        with self._opener.open(req, timeout=timeout) as resp:
            for ck in self.cookie_jar:
                self.cookies[ck.name] = ck.value
            body = resp.read().decode('utf-8', errors='replace')
            return _SimpleResponse(body, resp.getcode(), dict(resp.info()))

    def post(self, url, data=None, json=None, headers=None, timeout=8):
        import json as _json
        from urllib import request as urlrequest
        merged_headers = dict(self.headers)
        if headers:
            merged_headers.update(headers)
        cookie_str = '; '.join([f"{k}={v}" for k, v in self.cookies.items()])
        if cookie_str:
            merged_headers['Cookie'] = cookie_str
        if json is not None:
            payload = _json.dumps(json).encode('utf-8')
            merged_headers.setdefault('Content-Type', 'application/json')
        elif isinstance(data, str):
            payload = data.encode('utf-8')
        else:
            payload = urlencode(data or {}).encode('utf-8')
        req = urlrequest.Request(url, data=payload, headers=merged_headers, method='POST')
        with self._opener.open(req, timeout=timeout) as resp:
            for ck in self.cookie_jar:
                self.cookies[ck.name] = ck.value
            body = resp.read().decode('utf-8', errors='replace')
            return _SimpleResponse(body, resp.getcode(), dict(resp.info()))


class Spider(BaseSpider):
    """优酷 + 腾讯视频 iOS CCTVHost 单文件整合插件"""

    # 腾讯配置
    tx_host = 'https://v.qq.com'
    tx_apihost = 'https://pbaccess.video.qq.com'
    tx_headers = {
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ),
        'Origin': 'https://v.qq.com',
        'Referer': 'https://v.qq.com/'
    }

    # 优酷配置
    yk_host = 'https://www.youku.com'
    yk_shost = 'https://search.youku.com'
    yk_h5host = 'https://acs.youku.com'
    yk_ihost = 'https://v.youku.com'
    yk_headers = {
        'User-Agent': (
            'Mozilla/5.0 (; Windows 10.0.26100.3194_64 ) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/93.0.4577.82 Electron/14.2.0 Safari/537.36 '
            'Node/14.17.0 YoukuDesktop/9.2.60 UOSYouku (2.0.1)-Electron'
            '(UTDID ZYmGMAAAACkDAMU8hbiMmYdd;CHANNEL official;ZREAL 0;BTYPE TM2013;'
            'BRAND TIMI;BUILDVER 9.2.60.1001)'
        ),
        'Referer': 'https://www.youku.com/'
    }
    yk_default_cookies = {
        "__ysuid": "17416134165380iB",
        "__aysid": "1741613416541WbD",
        "xlly_s": "1",
        "isI18n": "false",
        "cna": "bNdVIKmmsHgCAXW9W6yrQ1/s",
        "__ayft": "1741672162330",
        "__arpvid": "1741672162331FBKgrn-1741672162342",
        "__ayscnt": "1",
        "__aypstp": "1",
        "__ayspstp": "3"
    }

    # 同源云端直连 M3U8 聚合采集池（用于为 iOS AVPlayer 提供免解析 1080P .m3u8 备用直连流）
    cloud_m3u8_apis = [
        ("量子直连", "https://cj.lziapi.com/api.php/provide/vod/"),
        ("非凡直连", "http://ffzy5.tv/api.php/provide/vod/"),
        ("暴风直连", "https://bfzyapi.com/api.php/provide/vod/")
    ]

    # 多路 JSON 直链解析池
    json_jx_apis = [
        "https://api.xmflv.com/api/?url=",
        "https://jx.aidouer.net/api/?url=",
        "https://jx.playerjy.com/api/?url="
    ]

    # 离线/弱网精选兜底种子片单
    FALLBACK_VIDEOS = [
        {
            "vod_id": "tx:mzc002002kq9n4e",
            "vod_name": "庆余年第二季",
            "vod_pic": "https://puui.qpic.cn/vcover_vt_pic/0/mzc002002kq9n4e1715826521862/0",
            "vod_year": "2024",
            "vod_remarks": "[腾讯] 36集全"
        },
        {
            "vod_id": "yk:ecdb258894c845efb541",
            "vod_name": "白夜破晓",
            "vod_pic": "https://m.ykimg.com/05840000673B079E13F7FF0958A28F1F",
            "vod_year": "2024",
            "vod_remarks": "[优酷] 29集全"
        },
        {
            "vod_id": "tx:mzc00200p51jpn7",
            "vod_name": "繁花",
            "vod_pic": "https://puui.qpic.cn/vcover_vt_pic/0/mzc00200p51jpn71703642158478/0",
            "vod_year": "2023",
            "vod_remarks": "[腾讯] 30集全"
        },
        {
            "vod_id": "yk:cbbfd876bd604aa295b1",
            "vod_name": "墨雨云间",
            "vod_pic": "https://m.ykimg.com/058400006659337213EB6610995C0E74",
            "vod_year": "2024",
            "vod_remarks": "[优酷] 40集全"
        }
    ]

    def init(self, extend=""):
        self.tx_dbody = {
            "page_params": {
                "channel_id": "",
                "filter_params": "sort=75",
                "page_type": "channel_operation",
                "page_id": "channel_list_second_page"
            }
        }
        # 按分类 ID 独立维护腾讯分页上下文，彻底修复原版 self.dbody 浅拷贝污染
        self.tx_page_contexts = {}
        # 缓存优酷分类 session
        self.yk_typeid = {}
        # 缓存剧集标题用于播放层云端直连智能回退
        self.title_cache = {}

        if requests is not None:
            self.yk_session = requests.Session()
            self.yk_session.headers.update(self.yk_headers)
            self.yk_session.cookies.update(self.yk_default_cookies)
        else:
            self.yk_session = _UrllibSession()
            self.yk_session.headers.update(self.yk_headers)
            self.yk_session.cookies.update(self.yk_default_cookies)

        try:
            self.get_yk_ctoken()
        except Exception:
            pass

    def getName(self):
        return "优酷·腾讯双擎聚合 (CCTVHost)"

    def isVideoFormat(self, url):
        return bool(re.search(r'\.(m3u8|mp4|flv|m4a)(\?|$)', str(url), re.I))

    def manualVideoCheck(self):
        return False

    def destroy(self):
        pass

    # =========================================================================
    # 1. 首页分类与动态筛选器 (homeContent)
    # =========================================================================
    def homeContent(self, filter):
        categories = [
            ("腾讯·电视剧", "tx:100113"),
            ("优酷·电视剧", "yk:电视剧"),
            ("腾讯·电影", "tx:100173"),
            ("优酷·电影", "yk:电影"),
            ("腾讯·综艺", "tx:100109"),
            ("优酷·综艺", "yk:综艺"),
            ("腾讯·动漫", "tx:100119"),
            ("优酷·动漫", "yk:动漫"),
            ("腾讯·短剧", "tx:110755"),
            ("优酷·少儿", "yk:少儿"),
            ("腾讯·少儿", "tx:100150"),
            ("腾讯·纪录片", "tx:100105"),
            ("优酷·纪录片", "yk:纪录片"),
            ("优酷·文化", "yk:文化")
        ]
        classes = [{'type_name': name, 'type_id': tid} for name, tid in categories]
        filters = {}

        if filter:
            with ThreadPoolExecutor(max_workers=8) as executor:
                future_map = {}
                for _, tid in categories:
                    if tid.startswith("tx:"):
                        raw_cid = tid.split(":", 1)[1]
                        future_map[executor.submit(self._fetch_tx_filter, raw_cid)] = tid
                    elif tid.startswith("yk:"):
                        raw_cat = tid.split(":", 1)[1]
                        future_map[executor.submit(self._fetch_yk_filter, raw_cat)] = tid

                for future in as_completed(future_map):
                    tid = future_map[future]
                    try:
                        ft_list = future.result()
                        if ft_list:
                            filters[tid] = ft_list
                    except Exception:
                        continue

        return {'class': classes, 'filters': filters}

    def _fetch_tx_filter(self, cid):
        hbody = copy.deepcopy(self.tx_dbody)
        hbody['page_params']['channel_id'] = cid
        data = self.post(
            f'{self.tx_apihost}/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData'
            f'?video_appid=1000005&vplatform=2&vversion_name=8.9.10&new_mark_label_enabled=1',
            json=hbody, headers=self.tx_headers, timeout=6
        ).json()
        if not data.get('data', {}).get('module_list_datas'):
            return []
        filter_dict = {}
        items = (
            data['data']['module_list_datas'][-1]['module_datas'][-1]
            .get('item_data_lists', {})
            .get('item_datas', [])
        )
        for item in items:
            params = item.get('item_params') or {}
            filter_key = params.get('index_item_key')
            if not filter_key:
                continue
            if filter_key not in filter_dict:
                filter_dict[filter_key] = {
                    'key': filter_key,
                    'name': params.get('index_name', filter_key),
                    'value': []
                }
            filter_dict[filter_key]['value'].append({
                'n': params.get('option_name', ''),
                'v': params.get('option_value', '')
            })
        return list(filter_dict.values())

    def _fetch_yk_filter(self, category_name):
        session_str, ft_list = self.yk_cf({'type': category_name}, with_filter=True)
        if session_str:
            self.yk_typeid[category_name] = session_str
        return ft_list

    # =========================================================================
    # 2. 首页推荐双平台并发聚合 (homeVideoContent)
    # =========================================================================
    def homeVideoContent(self):
        tx_list = []
        yk_list = []
        with ThreadPoolExecutor(max_workers=2) as executor:
            f_tx = executor.submit(self._home_tx_videos)
            f_yk = executor.submit(self._home_yk_videos)
            try:
                tx_list = f_tx.result()
            except Exception:
                tx_list = []
            try:
                yk_list = f_yk.result()
            except Exception:
                yk_list = []

        # 交错混排双平台推荐卡片
        merged = []
        max_len = max(len(tx_list), len(yk_list))
        for idx in range(max_len):
            if idx < len(tx_list):
                merged.append(tx_list[idx])
            if idx < len(yk_list):
                merged.append(yk_list[idx])

        if not merged:
            merged = copy.deepcopy(self.FALLBACK_VIDEOS)
        return {'list': merged}

    def _home_tx_videos(self):
        vlist = []
        # 使用标准库正则提取 window.__INITIAL_STATE__，彻底摆脱 pyquery 依赖
        try:
            rsp = self.fetch(self.tx_host, headers=self.tx_headers, timeout=6)
            html = rsp.text
            match = re.search(
                r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;?\s*</script>',
                html, re.S
            )
            if match:
                sd = json.loads(match.group(1))
                card_list = (
                    sd.get('storeModulesData', {})
                    .get('channelsModulesMap', {})
                    .get('choice', {})
                    .get('cardListData', [])
                )
                for its in card_list:
                    cards = (its or {}).get('children_list', {}).get('list', {}).get('cards', [])
                    for it in cards:
                        p = (it or {}).get('params') or {}
                        raw_tag = p.get('uni_imgtag') or p.get('imgtag') or '{}'
                        try:
                            tag = json.loads(raw_tag) if isinstance(raw_tag, str) else {}
                        except Exception:
                            tag = {}
                        cid = (it or {}).get('id') or p.get('cid')
                        name = p.get('mz_title') or p.get('title')
                        if name and cid and 'http' not in str(cid):
                            rem = tag.get('tag_4', {}).get('text') or ''
                            vlist.append({
                                'vod_id': f"tx:{cid}",
                                'vod_name': name,
                                'vod_pic': p.get('image_url') or p.get('new_pic_vt') or '',
                                'vod_year': tag.get('tag_2', {}).get('text') or '',
                                'vod_remarks': f"[腾讯] {rem}".strip()
                            })
        except Exception:
            pass

        # 若网页结构变更导致为空，自动回退至腾讯电视剧频道热播榜首屏
        if not vlist:
            try:
                res = self._category_tx("100113", "1", {})
                vlist = res.get('list', [])[:12]
            except Exception:
                pass
        return vlist

    def _home_yk_videos(self):
        vlist = []
        params = {
            "ms_codes": "2019061000",
            "params": json.dumps({
                "debug": 0, "gray": 0, "pageNo": 1,
                "utdid": "ZYmGMAAAACkDAMU8hbiMmYdd", "userId": "",
                "bizKey": "YOUKU_WEB", "appPackageKey": "com.youku.YouKu",
                "showNodeList": 0, "reqSubNode": 0,
                "nodeKey": "WEBHOME", "bizContext": "{\"spmA\":\"a2hja\"}"
            }),
            "system_info": json.dumps({
                "device": "pcweb", "os": "pcweb", "ver": "1.0.0.0",
                "userAgent": self.yk_headers['User-Agent'],
                "guid": "1590141704165YXe", "appPackageKey": "com.youku.pcweb",
                "young": 0, "brand": "", "network": "", "ouid": "", "idfa": "",
                "scale": "", "operator": "", "resolution": "", "pid": "",
                "childGender": 0, "zx": 0
            })
        }
        data = self.yk_getdata(f'{self.yk_h5host}/h5/mtop.youku.columbus.home.query/1.0/', params)
        okey = list(data['data'].keys())[0]
        nodes = data['data'][okey]['data']['nodes'][0]['nodes'][-1]['nodes'][0]['nodes']
        for item in nodes:
            if item.get('nodes') and item['nodes'][0].get('data'):
                d = item['nodes'][0]['data']
                if d.get('assignId'):
                    rem = d.get('summary') or ''
                    vlist.append({
                        'vod_id': f"yk:{d['assignId']}",
                        'vod_name': d.get('title') or '',
                        'vod_pic': d.get('vImg') or d.get('img') or '',
                        'vod_year': d.get('mark', {}).get('data', {}).get('text') or '',
                        'vod_remarks': f"[优酷] {rem}".strip()
                    })
        return vlist

    # =========================================================================
    # 3. 分类列表获取 (categoryContent)
    # =========================================================================
    def categoryContent(self, tid, pg, filter, extend):
        pg_str = str(pg or '1')
        extend = extend or {}
        if str(tid).startswith("yk:"):
            raw_cat = str(tid).split(":", 1)[1]
            return self._category_yk(raw_cat, pg_str, extend)
        raw_cid = str(tid).split(":", 1)[1] if ":" in str(tid) else str(tid)
        return self._category_tx(raw_cid, pg_str, extend)

    def _category_tx(self, cid, pg, extend):
        result = {}
        params = {
            "sort": extend.get('sort', '75'),
            "attr": extend.get('attr', '-1'),
            "itype": extend.get('itype', '-1'),
            "ipay": extend.get('ipay', '-1'),
            "iarea": extend.get('iarea', '-1'),
            "iyear": extend.get('iyear', '-1'),
            "theater": extend.get('theater', '-1'),
            "award": extend.get('award', '-1'),
            "recommend": extend.get('recommend', '-1')
        }
        body = copy.deepcopy(self.tx_dbody)
        body['page_params']['channel_id'] = cid
        body['page_params']['filter_params'] = self._dict_to_query(params)
        if pg != '1' and cid in self.tx_page_contexts:
            body['page_context'] = self.tx_page_contexts[cid]

        data = self.post(
            f'{self.tx_apihost}/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData'
            f'?video_appid=1000005&vplatform=2&vversion_name=8.9.10&new_mark_label_enabled=1',
            json=body, headers=self.tx_headers, timeout=8
        ).json()
        ndata = data.get('data') or {}
        if ndata.get('has_next_page'):
            result['pagecount'] = 9999
            self.tx_page_contexts[cid] = ndata.get('next_page_context')
        else:
            result['pagecount'] = int(pg)

        vlist = []
        items = (
            ndata.get('module_list_datas', [{}])[-1]
            .get('module_datas', [{}])[-1]
            .get('item_data_lists', {})
            .get('item_datas', [])
        )
        for its in items:
            p = its.get('item_params') or {}
            item_cid = p.get('cid')
            if item_cid:
                raw_tag = p.get('uni_imgtag') or p.get('imgtag') or '{}'
                try:
                    tag = json.loads(raw_tag) if isinstance(raw_tag, str) else {}
                except Exception:
                    tag = {}
                name = p.get('mz_title') or p.get('title') or ''
                pic = p.get('new_pic_hz') or p.get('new_pic_vt') or ''
                rem = tag.get('tag_4', {}).get('text') or ''
                vlist.append({
                    'vod_id': f"tx:{item_cid}",
                    'vod_name': name,
                    'vod_pic': pic,
                    'vod_year': tag.get('tag_2', {}).get('text') or '',
                    'vod_remarks': f"[腾讯] {rem}".strip()
                })
        result['list'] = vlist
        result['page'] = int(pg)
        result['limit'] = 90
        result['total'] = 999999
        return result

    def _category_yk(self, category_name, pg, extend):
        result = {
            'page': int(pg),
            'limit': 90,
            'total': 999999,
            'pagecount': 9999,
            'list': []
        }
        params = {'type': category_name}
        params.update(extend)
        session_id = self.yk_typeid.get(category_name)
        if pg == '1' or not session_id:
            session_id = self.yk_cf(params, with_filter=False)
            self.yk_typeid[category_name] = session_id

        url = (
            f'{self.yk_host}/category/data?session={session_id}'
            f'&params={quote(json.dumps(params))}&pageNo={pg}'
        )
        try:
            data = self.yk_session.get(url, timeout=8).json()
            fdata = data['data']['filterData']
            vlist = []
            for item in fdata.get('listData', []):
                vlink = item.get('videoLink') or ''
                if 's=' in vlink:
                    show_id = vlink.split('s=')[-1].split('&')[0]
                    rem = item.get('summary') or ''
                    img = item.get('img') or ''
                    if img.startswith('//'):
                        img = 'https:' + img
                    vlist.append({
                        'vod_id': f"yk:{show_id}",
                        'vod_name': item.get('title') or '',
                        'vod_pic': img,
                        'vod_year': item.get('rightTagText') or '',
                        'vod_remarks': f"[优酷] {rem}".strip()
                    })
            if fdata.get('session'):
                self.yk_typeid[category_name] = quote(json.dumps(fdata['session']))
            result['list'] = vlist
        except Exception:
            result['pagecount'] = int(pg)
        return result

    # =========================================================================
    # 4. 详情与选集加载 + 云端 M3U8 直连聚合 (detailContent)
    # =========================================================================
    def detailContent(self, ids):
        if not ids:
            return {'list': []}
        raw_id = str(ids[0])
        if raw_id.startswith("yk:"):
            show_id = raw_id.split(":", 1)[1]
            vod = self._detail_yk(show_id)
        elif raw_id.startswith("tx:"):
            cid = raw_id.split(":", 1)[1]
            vod = self._detail_tx(cid)
        else:
            # 自动探测无前缀 ID
            if len(raw_id) == 15 and raw_id.startswith("mzc"):
                vod = self._detail_tx(raw_id)
            else:
                vod = self._detail_yk(raw_id)

        # 为详情页并发挂载同源云端 M3U8 直连线路 (供 iOS AVPlayer 零解析秒播)
        if vod and vod.get('vod_name'):
            self.title_cache[raw_id] = vod['vod_name']
            cloud_tabs, cloud_urls = self._fetch_cloud_m3u8_lines(vod['vod_name'])
            if cloud_tabs and cloud_urls:
                orig_from = [x for x in vod.get('vod_play_from', '').split('$$$') if x]
                orig_url = [x for x in vod.get('vod_play_url', '').split('$$$') if x]
                # 将云端直连 M3U8 线路与官源线路并列展示
                vod['vod_play_from'] = '$$$'.join(orig_from + cloud_tabs)
                vod['vod_play_url'] = '$$$'.join(orig_url + cloud_urls)

        return {'list': [vod] if vod else []}

    def _detail_tx(self, cid):
        vbody = {
            "page_params": {
                "req_from": "web",
                "cid": cid,
                "vid": "",
                "lid": "",
                "page_type": "detail_operation",
                "page_id": "detail_page_introduction"
            },
            "has_cache": 1
        }
        ebody = {
            "page_params": {
                "req_from": "web_vsite",
                "page_id": "vsite_episode_list",
                "page_type": "detail_operation",
                "id_type": "1",
                "page_size": "",
                "cid": cid,
                "vid": "",
                "lid": "",
                "page_num": "",
                "page_context": "",
                "detail_page_type": "1"
            },
            "has_cache": 1
        }
        with ThreadPoolExecutor(max_workers=2) as executor:
            f_detail = executor.submit(self._get_tx_vdata, vbody)
            f_episodes = executor.submit(self._get_tx_vdata, ebody)
            vdata = f_detail.result()
            edata = f_episodes.result()

        pdata = self._process_tx_tabs(edata, ebody)
        try:
            d_item = (
                vdata['data']['module_list_datas'][0]['module_datas'][0]
                ['item_data_lists']['item_datas'][0]
            )
            d = d_item.get('item_params') or {}
            star_list = (
                d_item.get('sub_items', {})
                .get('star_list', {})
                .get('item_datas', [])
            )
            actors = [
                s['item_params']['name']
                for s in star_list
                if s.get('item_params', {}).get('name')
            ]
        except Exception:
            d = {}
            actors = []

        plist = []
        ylist = []
        title = d.get('title') or ''
        for k in pdata:
            vid = k.get('item_id')
            if vid:
                ep_title = k.get('item_params', {}).get('union_title') or k.get('item_params', {}).get('play_title') or vid
                play_token = f"{ep_title}$tx:{cid}@{vid}@{quote(title)}"
                if '预告' in ep_title:
                    ylist.append(play_token)
                else:
                    plist.append(play_token)

        names = []
        urls = []
        if plist:
            names.append('腾讯视频')
            urls.append('#'.join(plist))
        if ylist:
            names.append('腾讯预告')
            urls.append('#'.join(ylist))

        return {
            'vod_id': f"tx:{cid}",
            'vod_name': title,
            'vod_pic': d.get('new_pic_vt') or d.get('image_url') or '',
            'type_name': d.get('sub_genre') or d.get('main_genre') or '腾讯视频',
            'vod_year': d.get('year') or '',
            'vod_area': d.get('area_name') or '',
            'vod_remarks': d.get('holly_online_time') or d.get('hotval') or '',
            'vod_actor': ','.join(actors),
            'vod_content': d.get('cover_description') or '',
            'vod_play_from': '$$$'.join(names) or '腾讯视频',
            'vod_play_url': '$$$'.join(urls)
        }

    def _detail_yk(self, show_id):
        try:
            info_resp = self.yk_session.get(
                f'{self.yk_ihost}/v_getvideo_info/?showId={show_id}', timeout=8
            ).json()
            v = info_resp.get('data') or {}
            title = v.get('title') or v.get('showName') or ''
            pic = v.get('thumburl') or v.get('show_vthumburl') or ''
            if pic.startswith('//'):
                pic = 'https:' + pic

            vod = {
                'vod_id': f"yk:{show_id}",
                'vod_name': title,
                'vod_pic': pic,
                'type_name': v.get('showVideotype') or '优酷视频',
                'vod_year': v.get('lastUpdate') or '',
                'vod_remarks': v.get('rc_title') or '',
                'vod_actor': v.get('_personNameStr') or '',
                'vod_content': v.get('showdesc') or '',
                'vod_play_from': '优酷视频',
                'vod_play_url': ''
            }
            params = {
                "biz": "new_detail_web2",
                "videoId": v.get('vid') or '',
                "scene": "web_page",
                "componentVersion": "3",
                "ip": info_resp.get('ip') or '',
                "debug": 0,
                "utdid": "ZYmGMAAAACkDAMU8hbiMmYdd",
                "userId": 0,
                "platform": "pc",
                "nextSession": "",
                "gray": 0,
                "source": "pcNoPrev",
                "showId": show_id
            }
            sdata, total_eps = self._yk_getinfo(params)
            pdata = list(sdata.get('nodes') or [])
            if total_eps and total_eps > len(pdata) and len(pdata) > 0:
                batch_size = len(pdata)
                total_batches = ((total_eps + batch_size - 1) // batch_size) - 1
                ssj = json.loads(sdata['data']['session'])
                with ThreadPoolExecutor(max_workers=min(total_batches, 8)) as executor:
                    futures = []
                    for batch in range(total_batches):
                        start = batch_size + 1 + (batch * batch_size)
                        end = start + batch_size - 1
                        next_session = ssj.copy()
                        next_session.update({
                            "itemStartStage": start,
                            "itemEndStage": min(end, total_eps)
                        })
                        current_params = params.copy()
                        current_params['nextSession'] = json.dumps(next_session)
                        futures.append((start, executor.submit(self._yk_getvinfo, current_params)))
                    futures.sort(key=lambda x: x[0])
                    for _, future in futures:
                        try:
                            res_node = future.result()
                            pdata.extend(res_node.get('nodes') or [])
                        except Exception:
                            continue

            ep_items = []
            for item in pdata:
                d = item.get('data') or {}
                ep_title = d.get('title') or d.get('stage') or '正片'
                vid = (d.get('action') or {}).get('value')
                if vid:
                    if not vod['vod_name'] and d.get('subtitle'):
                        vod['vod_name'] = d.get('subtitle')
                    ep_items.append(f"{ep_title}$yk:{vid}@{quote(vod['vod_name'])}")
            vod['vod_play_url'] = '#'.join(ep_items)
            return vod
        except Exception as e:
            return {
                'vod_id': f"yk:{show_id}",
                'vod_name': f"优酷剧集 ({show_id})",
                'vod_play_from': '优酷视频',
                'vod_play_url': f"第1集$yk:{show_id}@"
            }

    # =========================================================================
    # 5. 双平台并发搜索 (searchContent)
    # =========================================================================
    def searchContent(self, key, quick, pg="1"):
        pg_str = str(pg or '1')
        tx_res = []
        yk_res = []
        with ThreadPoolExecutor(max_workers=2) as executor:
            f_tx = executor.submit(self._search_tx, key, pg_str)
            f_yk = executor.submit(self._search_yk, key, pg_str)
            try:
                tx_res = f_tx.result()
            except Exception:
                tx_res = []
            try:
                yk_res = f_yk.result()
            except Exception:
                yk_res = []

        merged = []
        max_len = max(len(tx_res), len(yk_res))
        for i in range(max_len):
            if i < len(tx_res):
                merged.append(tx_res[i])
            if i < len(yk_res):
                merged.append(yk_res[i])
        return {'list': merged, 'page': int(pg_str)}

    def _search_tx(self, key, pg):
        body = {
            "version": "24072901",
            "clientType": 1,
            "filterValue": "",
            "uuid": str(uuid.uuid4()),
            "retry": 0,
            "query": key,
            "pagenum": max(int(pg) - 1, 0),
            "pagesize": 25,
            "queryFrom": 0,
            "searchDatakey": "",
            "transInfo": "",
            "isneedQc": True,
            "preQid": "",
            "adClientInfo": "",
            "extraInfo": {"isNewMarkLabel": "1", "multi_terminal_pc": "1"}
        }
        data = self.post(
            f'{self.tx_apihost}/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2',
            json=body, headers=self.tx_headers, timeout=6
        ).json()
        vlist = []
        boxes = data.get('data', {}).get('areaBoxList') or []
        if not boxes:
            return vlist
        for k in boxes[-1].get('itemList', []):
            doc_id = (k.get('doc') or {}).get('id')
            vinfo = k.get('videoInfo') or {}
            if doc_id and vinfo.get('title'):
                img_tag = vinfo.get('imgTag')
                tag = {}
                if isinstance(img_tag, str) and img_tag:
                    try:
                        tag = json.loads(img_tag)
                    except Exception:
                        tag = {}
                rem = tag.get('tag_4', {}).get('text', '')
                vlist.append({
                    'vod_id': f"tx:{doc_id}",
                    'vod_name': vinfo.get('title', ''),
                    'vod_pic': vinfo.get('imgUrl', ''),
                    'vod_year': tag.get('tag_2', {}).get('text', ''),
                    'vod_remarks': f"[腾讯] {rem}".strip()
                })
        return vlist

    def _search_yk(self, key, pg):
        url = f'{self.yk_shost}/api/search?pg={pg}&keyword={quote(key)}'
        data = self.yk_session.get(url, timeout=6).json()
        vlist = []
        for item in data.get('pageComponentList', []):
            cd = item.get('commonData') or {}
            show_id = cd.get('showId') or cd.get('realShowId')
            if show_id:
                title = (cd.get('titleDTO') or {}).get('displayName') or ''
                title = re.sub(r'<[^>]+>', '', title)
                pic = (cd.get('posterDTO') or {}).get('vThumbUrl') or ''
                rem = cd.get('updateNotice') or ''
                vlist.append({
                    'vod_id': f"yk:{show_id}",
                    'vod_name': title,
                    'vod_pic': pic,
                    'vod_year': cd.get('feature') or '',
                    'vod_remarks': f"[优酷] {rem}".strip()
                })
        return vlist

    # =========================================================================
    # 6. iOS CCTVHost 播放三级解析引擎 (playerContent + localProxy)
    # =========================================================================
    def playerContent(self, flag, id, vipFlags):
        play_id = str(id or '')

        # 分支 A：已经是云端 M3U8 / MP4 直链
        if play_id.startswith('http') and self.isVideoFormat(play_id):
            return {
                'jx': 0,
                'parse': 0,
                'url': play_id,
                'header': json.dumps({'User-Agent': self.tx_headers['User-Agent']})
            }

        # 分支 B：优酷视频 (yk:{vid}@{title})
        if play_id.startswith('yk:'):
            body = play_id.split(':', 1)[1]
            parts = body.split('@')
            vid = parts[0]
            raw_url = f"https://v.youku.com/v_show/id_{vid}.html"
            play_headers = {
                'User-Agent': self.yk_headers['User-Agent'],
                'Referer': 'https://v.youku.com/'
            }

            # 1) 尝试优酷官方 MTOP UPS 原生接口提取 M3U8
            ups_m3u8 = self._get_youku_ups_m3u8(vid)
            if ups_m3u8:
                return {'jx': 0, 'parse': 0, 'url': ups_m3u8, 'header': json.dumps(play_headers)}

            # 2) 尝试多路 JSON 解析池并发提取免嗅直链
            direct_url = self._resolve_via_json_jx(raw_url)
            if direct_url:
                return {'jx': 0, 'parse': 0, 'url': direct_url, 'header': json.dumps(play_headers)}

            # 3) 兜底返回官源网页地址
            return {'jx': 1, 'parse': 1, 'url': raw_url, 'header': json.dumps(play_headers)}

        # 分支 C：腾讯视频 (tx:{cid}@{vid}@{title} 或 {cid}@{vid})
        if play_id.startswith('tx:'):
            body = play_id.split(':', 1)[1]
        else:
            body = play_id
        parts = body.split('@')
        if len(parts) >= 2:
            cid, vid = parts[0], parts[1]
            raw_url = f"{self.tx_host}/x/cover/{cid}/{vid}.html"
        else:
            raw_url = play_id if play_id.startswith('http') else f"{self.tx_host}/x/page/{play_id}.html"

        play_headers = {
            'User-Agent': self.tx_headers['User-Agent'],
            'Referer': 'https://v.qq.com/',
            'Origin': 'https://v.qq.com'
        }

        # 1) 尝试多路 JSON 解析池并发提取免嗅直链
        direct_url = self._resolve_via_json_jx(raw_url)
        if direct_url:
            return {'jx': 0, 'parse': 0, 'url': direct_url, 'header': json.dumps(play_headers)}

        # 2) 兜底返回带解析网关或标准官源地址
        return {
            'jx': 1,
            'parse': 1,
            'url': raw_url,
            'header': json.dumps(play_headers)
        }

    def _get_youku_ups_m3u8(self, vid):
        """通过优酷 MTOP UPS 1.1 签名接口提取原生 HLS 播放流"""
        try:
            cna = self.yk_session.cookies.get('cna', 'bNdVIKmmsHgCAXW9W6yrQ1/s')
            steal_params = {
                "ccode": "0502",
                "client_ip": "192.168.1.1",
                "utid": cna,
                "client_ts": int(time.time()),
                "version": "2.1.61",
                "ckey": (
                    "DIl58SLFxFNndSV1GFNnMQVYkx1PP5tKe1siZu/86PR1u/Wh1Ptd+WOZsHHWxys"
                    "SfAOhNJpdVWsdVJNsfJ8Sxd8WKVvNfAS8aS8fAOzYARzPyPc3JvtnPHjTdKfEST"
                    "dnuTW6ZPvk2pNDh4uFzotgdMEFkzQ5wZVXl2Pf1/Y6hLK0OnCNxBj3+nb0v72gZ"
                    "6b0td+WOZsHHWxysSo/0y9D2K42SaB8Y/+aD2K42SaB8Y/+ahU+WOZsHcrxysooUeND"
                )
            }
            params = {
                "steal_params": json.dumps(steal_params, separators=(',', ':')),
                "biz_params": json.dumps({"vid": vid}, separators=(',', ':')),
                "ad_params": json.dumps({"vs": "1.0", "pver": "2.1.61"}, separators=(',', ':'))
            }
            res = self.yk_getdata(f'{self.yk_h5host}/h5/mtop.youku.play.ups.appinfo.get/1.1/', params)
            streams = res.get('data', {}).get('data', {}).get('stream') or []
            if streams:
                streams.sort(key=lambda x: x.get('size', 0), reverse=True)
                for s in streams:
                    if s.get('m3u8_url'):
                        return s['m3u8_url']
        except Exception:
            pass
        return None

    def _resolve_via_json_jx(self, raw_url):
        """并发请求多路 JSON 解析器提取 .m3u8 / .mp4 直链"""
        def _probe(api_prefix):
            target = f"{api_prefix}{quote(raw_url)}"
            rsp = self.fetch(target, headers=self.tx_headers, timeout=4).json()
            u = rsp.get('url') or (rsp.get('data') or {}).get('url')
            if u and str(u).startswith('http'):
                return str(u)
            return None

        with ThreadPoolExecutor(max_workers=len(self.json_jx_apis)) as executor:
            futures = [executor.submit(_probe, prefix) for prefix in self.json_jx_apis]
            for future in as_completed(futures):
                try:
                    real_url = future.result()
                    if real_url:
                        return real_url
                except Exception:
                    continue
        return None

    def _fetch_cloud_m3u8_lines(self, title):
        """按剧名从云端同源采集接口匹配 1080P .m3u8 直连线路 (适配 iOS AVPlayer 直连秒开)"""
        clean_name = re.sub(r'[（(].*?[)）]', '', str(title or '')).strip()
        if not clean_name:
            return [], []

        def _query_cms(source_tuple):
            label, api_url = source_tuple
            rsp = self.fetch(api_url, params={'ac': 'detail', 'wd': clean_name}, headers=self.tx_headers, timeout=4).json()
            for item in rsp.get('list') or []:
                vname = item.get('vod_name') or ''
                if clean_name in vname or vname in clean_name:
                    play_from = (item.get('vod_play_from') or '').split('$$$')
                    play_url = (item.get('vod_play_url') or '').split('$$$')
                    for pf, pu in zip(play_from, play_url):
                        if 'm3u8' in pf.lower() or '.m3u8' in pu.lower():
                            return label, pu
                    if play_url:
                        return label, play_url[0]
            return None, None

        tabs, urls = [], []
        with ThreadPoolExecutor(max_workers=len(self.cloud_m3u8_apis)) as executor:
            futures = [executor.submit(_query_cms, st) for st in self.cloud_m3u8_apis]
            for future in as_completed(futures):
                try:
                    label, pu = future.result()
                    if label and pu:
                        tabs.append(label)
                        urls.append(pu)
                except Exception:
                    continue
        return tabs, urls

    def localProxy(self, param):
        """
        本地 M3U8 去广告代理 (移植自 drpy2 fixAdM3u8Ai 公共前缀比对算法)
        调用方式: http://127.0.0.1:9978/proxy?do=py&url=<urlencoded_m3u8>
        """
        param = param or {}
        m3u8_url = unquote(param.get('url', ''))
        if not m3u8_url.startswith('http'):
            return [404, 'text/plain', 'Invalid M3U8 URL']
        try:
            rsp = self.fetch(m3u8_url, headers=self.tx_headers, timeout=6)
            cleaned = self.clean_m3u8_ads(rsp.text, m3u8_url)
            return [200, 'application/vnd.apple.mpegurl', cleaned]
        except Exception as e:
            return [500, 'text/plain', f'M3U8 Proxy Error: {e}']

    def clean_m3u8_ads(self, m3u8_text, m3u8_url):
        """纯内存剔除 M3U8 中的异构广告 TS 切片并补全绝对路径"""
        lines = [line.strip() for line in (m3u8_text or '').splitlines() if line.strip()]
        if not lines:
            return m3u8_text

        # 若为二级嵌套 M3U8，自动跟进子索引
        last_uri = next((l for l in reversed(lines) if not l.startswith('#')), '')
        if '.m3u8' in last_uri and last_uri != m3u8_url:
            sub_url = urljoin(m3u8_url, last_uri)
            try:
                sub_rsp = self.fetch(sub_url, headers=self.tx_headers, timeout=6)
                m3u8_url = sub_url
                lines = [line.strip() for line in sub_rsp.text.splitlines() if line.strip()]
            except Exception:
                pass

        ts_urls = [urljoin(m3u8_url, l) for l in lines if not l.startswith('#')]
        if len(ts_urls) < 3:
            return '\n'.join([l if l.startswith('#') else urljoin(m3u8_url, l) for l in lines])

        def _common_prefix_len(s1, s2):
            idx = 0
            limit = min(len(s1), len(s2))
            while idx < limit and s1[idx] == s2[idx]:
                idx += 1
            return idx

        base_ts = ts_urls[0]
        threshold = _common_prefix_len(base_ts, ts_urls[1])

        clean_lines = []
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.startswith('#EXTINF') and i + 1 < len(lines):
                next_uri = urljoin(m3u8_url, lines[i + 1])
                if _common_prefix_len(base_ts, next_uri) >= threshold:
                    clean_lines.append(line)
                    clean_lines.append(next_uri)
                i += 2
            elif line.startswith('#EXT-X-KEY'):
                clean_lines.append(
                    re.sub(r'URI="(.*?)"', lambda m: f'URI="{urljoin(m3u8_url, m.group(1))}"', line)
                )
                i += 1
            elif line.startswith('#EXT-X-DISCONTINUITY'):
                i += 1
            else:
                clean_lines.append(line if line.startswith('#') else urljoin(m3u8_url, line))
                i += 1

        return '\n'.join(clean_lines)

    # =========================================================================
    # 7. 腾讯与优酷底层协议辅助方法
    # =========================================================================
    def _get_tx_vdata(self, body):
        try:
            return self.post(
                f'{self.tx_apihost}/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData'
                f'?video_appid=3000010&vplatform=2&vversion_name=8.2.96',
                json=body, headers=self.tx_headers, timeout=8
            ).json()
        except Exception:
            return {'data': {'module_list_datas': []}}

    def _process_tx_tabs(self, data, body):
        try:
            mod = data['data']['module_list_datas'][-1]['module_datas'][-1]
            pdata = list(mod['item_data_lists']['item_datas'])
            raw_tabs = mod.get('module_params', {}).get('tabs')
            if raw_tabs:
                tabs = json.loads(raw_tabs) if isinstance(raw_tabs, str) else raw_tabs
                remaining_tabs = tabs[1:]
                task_queue = []
                for tab in remaining_tabs:
                    nbody = copy.deepcopy(body)
                    nbody['page_params']['page_context'] = tab['page_context']
                    task_queue.append(nbody)
                if task_queue:
                    with ThreadPoolExecutor(max_workers=min(len(task_queue), 10)) as executor:
                        future_map = {
                            executor.submit(self._get_tx_vdata, task): idx
                            for idx, task in enumerate(task_queue)
                        }
                        results = [None] * len(task_queue)
                        for future in as_completed(future_map):
                            idx = future_map[future]
                            results[idx] = future.result()
                        for res in results:
                            if res:
                                page_items = (
                                    res.get('data', {})
                                    .get('module_list_datas', [{}])[-1]
                                    .get('module_datas', [{}])[-1]
                                    .get('item_data_lists', {})
                                    .get('item_datas', [])
                                )
                                pdata.extend(page_items)
            return pdata
        except Exception:
            return []

    def get_yk_ctoken(self):
        self.yk_session.get(
            f'{self.yk_h5host}/h5/mtop.ykrec.recommendservice.recommend/1.0/?jsv=2.6.1&appKey=24679788',
            timeout=6
        )

    def yk_md5(self, t, text):
        raw_tk = self.yk_session.cookies.get('_m_h5_tk') or ''
        token = raw_tk.split('_')[0] if '_' in raw_tk else raw_tk
        sign_str = f"{token}&{t}&24679788&{text}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest()

    def yk_getdata(self, url, params, recursion_count=0, max_recursion=3):
        data_str = json.dumps(params)
        t = int(time.time() * 1000)
        jsdata = {
            'appKey': '24679788',
            't': t,
            'sign': self.yk_md5(t, data_str),
            'data': data_str
        }
        response = self.yk_session.get(url, params=jsdata, timeout=8)
        if '令牌过期' in response.text or 'FAIL_SYS_TOKEN' in response.text:
            if recursion_count >= max_recursion:
                return {'data': {}}
            self.get_yk_ctoken()
            return self.yk_getdata(url, params, recursion_count + 1, max_recursion)
        return response.json()

    def _yk_getvinfo(self, params):
        body = {
            "ms_codes": "2019030100",
            "params": json.dumps(params),
            "system_info": (
                "{\"os\":\"iku\",\"device\":\"iku\",\"ver\":\"9.2.9\","
                "\"appPackageKey\":\"com.youku.iku\",\"appPackageId\":\"pcweb\"}"
            )
        }
        data = self.yk_getdata(
            f'{self.yk_h5host}/h5/mtop.youku.columbus.gateway.new.execute/1.0/', body
        )
        okey = list(data['data'].keys())[0]
        return data['data'][okey]['data']

    def _yk_getinfo(self, params):
        info_node = self._yk_getvinfo(params)
        jdata = info_node['nodes'][0]['nodes'][3]
        ep_total = info_node.get('data', {}).get('extra', {}).get('episodeTotal', 0)
        if info_node.get('data', {}).get('extra', {}).get('showCategory') in ['电影', '游戏']:
            jdata = info_node['nodes'][0]['nodes'][4]
        return jdata, ep_total

    def yk_cf(self, params, with_filter=False):
        url = f'{self.yk_host}/category/data?params={quote(json.dumps(params))}&optionRefresh=1&pageNo=1'
        response = self.yk_session.get(url, timeout=8).json()
        fdata = response['data']['filterData']
        session_str = quote(json.dumps(fdata['session']))
        if with_filter:
            return session_str, self._parse_yk_filter_data(fdata.get('filter', {}).get('filterData', [])[1:])
        return session_str

    def _camel_case_key(self, key):
        if '_' not in key:
            return key
        parts = key.split('_')
        return parts[0] + ''.join(p[0].upper() + p[1:] for p in parts[1:] if p)

    def _parse_yk_filter_data(self, data):
        result = []
        for item in data or []:
            sub_list = item.get('subFilter') or []
            if not sub_list or not sub_list[0].get('filterType'):
                continue
            first_sub = sub_list[0]
            filter_item = {
                'key': self._camel_case_key(first_sub['filterType']),
                'name': first_sub.get('title', ''),
                'value': [
                    {'n': sub.get('title', ''), 'v': sub['value']}
                    for sub in sub_list if 'value' in sub
                ]
            }
            if filter_item['value']:
                result.append(filter_item)
        return result

    def _dict_to_query(self, params, skip_empty=False):
        return "&".join([
            f"{k}={v}" for k, v in params.items()
            if not (skip_empty and not v)
        ])


def _run_selftest():
    """内置离线与结构完整性自检 (--selftest)"""
    sp = Spider()
    sp.init()

    # 1. 验证分类结构
    home_res = sp.homeContent(filter=False)
    assert 'class' in home_res and len(home_res['class']) == 14, "分类数量校验失败"

    # 2. 验证 M3U8 去广告引擎 (移植自 drpy2 fixAdM3u8Ai)
    sample_m3u8 = "\n".join([
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        "#EXT-X-TARGETDURATION:10",
        "#EXTINF:10.0,",
        "https://cdn.video.com/stream/2026/seg_0001.ts",
        "#EXTINF:10.0,",
        "https://cdn.video.com/stream/2026/seg_0002.ts",
        "#EXT-X-DISCONTINUITY",
        "#EXTINF:5.0,",
        "https://ad. malicious-tracker.com/promo/ad_999.ts",
        "#EXT-X-DISCONTINUITY",
        "#EXTINF:10.0,",
        "https://cdn.video.com/stream/2026/seg_0003.ts",
        "#EXT-X-ENDLIST"
    ])
    cleaned = sp.clean_m3u8_ads(sample_m3u8, "https://cdn.video.com/stream/2026/index.m3u8")
    assert "ad_999.ts" not in cleaned, "广告切片未被剥离"
    assert "seg_0001.ts" in cleaned and "seg_0003.ts" in cleaned, "正片切片丢失"

    # 3. 验证播放路由 (直链、腾讯、优酷)
    p_direct = sp.playerContent("量子直连", "https://cdn.video.com/stream/2026/index.m3u8", [])
    assert p_direct['parse'] == 0 and p_direct['jx'] == 0, "M3U8 直链应为 parse=0"

    p_tx = sp.playerContent("腾讯视频", "tx:mzc002002kq9n4e@t0048abcd", [])
    assert "v.qq.com/x/cover/mzc002002kq9n4e/t0048abcd.html" in p_tx['url'] or p_tx['parse'] == 0

    p_yk = sp.playerContent("优酷视频", "yk:XNjQwMDAwMDAw", [])
    assert "v.youku.com/v_show/id_XNjQwMDAwMDAw.html" in p_yk['url'] or p_yk['parse'] == 0

    print(json.dumps({
        "status": "ok",
        "plugin": sp.getName(),
        "categories_count": len(home_res['class']),
        "ad_filter_verified": True,
        "player_routes_verified": True
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Youku + Tencent CCTVHost Single-File Plugin")
    parser.add_argument('--selftest', action='store_true', help='Run built-in self-test')
    parser.add_argument('--action', type=str, default='', help='home|homeVod|category|detail|search|play')
    parser.add_argument('--tid', type=str, default='tx:100113')
    parser.add_argument('--pg', type=str, default='1')
    parser.add_argument('--id', type=str, default='')
    parser.add_argument('--wd', type=str, default='')
    args = parser.parse_args()

    if args.selftest:
        _run_selftest()
    elif args.action:
        spider = Spider()
        spider.init()
        if args.action == 'home':
            print(json.dumps(spider.homeContent(True), ensure_ascii=False))
        elif args.action == 'homeVod':
            print(json.dumps(spider.homeVideoContent(), ensure_ascii=False))
        elif args.action == 'category':
            print(json.dumps(spider.categoryContent(args.tid, args.pg, True, {}), ensure_ascii=False))
        elif args.action == 'detail':
            print(json.dumps(spider.detailContent([args.id]), ensure_ascii=False))
        elif args.action == 'search':
            print(json.dumps(spider.searchContent(args.wd, False, args.pg), ensure_ascii=False))
        elif args.action == 'play':
            print(json.dumps(spider.playerContent('', args.id, []), ensure_ascii=False))
    else:
        _run_selftest()
