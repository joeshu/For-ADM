# -*- coding: utf-8 -*-
# by @嗷呜
# 2026-11-15 修复：playerContent 不再直接返回网页（parse=1），改为两级直链：
#  0) 芒果官方 tk2 签名流（player/video -> getSource -> stream info -> m3u8，
#     参考 yt-dlp mgtv 提取器），已实测 720P m3u8 HTTP 200；
#  1) GreasyFork「全网 VIP 视频免费破解去广告【增强版】」v1.0.6 的同名片源法：
#     按片名在 MacCMS 聚合（量子/暴风/非凡）搜同名资源，取对应集数 m3u8，
#     返回前先 GET 校验是真实 #EXTM3U 才返回，死链不返回；
#  两级都失败才兜底回官源网页。原文件见 py400.zip [影]芒果TV.py。
import base64
import json
import re
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.append('..')
from base.spider import Spider

class Spider(Spider):

    def init(self, extend=""):
        pass

    def getName(self):
        return '芒果TV'

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass

    rhost='https://www.mgtv.com'

    host='https://pianku.api.mgtv.com'

    vhost='https://pcweb.api.mgtv.com'

    mhost='https://dc.bz.mgtv.com'

    shost='https://mobileso.bz.mgtv.com'

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36',
        'origin': rhost,
        'referer': f'{rhost}/'
    }

    # MacCMS 聚合源（GreasyFork 脚本 RESOURCE_APIS 中已验证可达的三个）
    cloud_apis = [
        'https://cj.lziapi.com/api.php/provide/vod/',
        'https://bfzyapi.com/api.php/provide/vod/',
        'https://api.ffzy5.tv/api.php/provide/vod/',
    ]

    def homeContent(self, filter):
        result = {}
        cateManual = {
            "电影": "3",
            "电视剧": "2",
            "综艺": "1",
            "动画": "50",
            "少儿": "10",
            "纪录片": "51",
            "教育": "115"
        }
        classes = []
        filters = {}
        for k in cateManual:
            classes.append({
                'type_name': k,
                'type_id': cateManual[k]
            })
        with ThreadPoolExecutor(max_workers=len(classes)) as executor:
            results = executor.map(self.getf, classes)
            for id, ft in results:
                if len(ft):filters[id] = ft
        result['class'] = classes
        result['filters'] = filters
        return result

    def homeVideoContent(self):
        data=self.fetch(f'{self.mhost}/dynamic/v1/channel/index/0/0/0/1000000/0/0/17/1354?type=17&version=5.0&t={str(int(time.time()*1000))}&_support=10000000', headers=self.headers).json()
        videoList = []
        for i in data['data']:
            if i.get('DSLList') and len(i['DSLList']):
                for j in i['DSLList']:
                    if j.get('data') and j['data'].get('items') and len(j['data']['items']):
                        for k in j['data']['items']:
                            videoList.append({
                                'vod_id': k["videoId"],
                                'vod_name': k['videoName'],
                                'vod_pic': k['img'],
                                'vod_year': k.get('cornerTitle'),
                                'vod_remarks': k.get('time') or k.get('desc'),
                            })
        return {'list':videoList}

    def categoryContent(self, tid, pg, filter, extend):
        body={
            'allowedRC': '1',
            'platform': 'pcweb',
            'channelId': tid,
            'pn': pg,
            'pc': '80',
            'hudong': '1',
            '_support': '10000000'
        }
        body.update(extend)
        data=self.fetch(f'{self.host}/rider/list/pcweb/v3', params=body, headers=self.headers).json()
        videoList = []
        for i in data['data']['hitDocs']:
            videoList.append({
                'vod_id': i["playPartId"],
                'vod_name': i['title'],
                'vod_pic': i['img'],
                'vod_year': (i.get('rightCorner',{}) or {}).get('text') or i.get('year'),
                'vod_remarks': i['updateInfo']
            })
        result = {}
        result['list'] = videoList
        result['page'] = pg
        result['pagecount'] = 9999
        result['limit'] = 90
        result['total'] = 999999
        return result

    def detailContent(self, ids):
        vbody={'allowedRC': '1', 'vid': ids[0], 'type': 'b', '_support': '10000000'}
        vdata=self.fetch(f'{self.vhost}/video/info', params=vbody, headers=self.headers).json()
        d=vdata['data']['info']['detail']
        show_title = vdata['data']['info']['title'] or ''
        vod = {
            'vod_name': show_title,
            'type_name': d.get('kind'),
            'vod_year': d.get('releaseTime'),
            'vod_area': d.get('area'),
            'vod_lang': d.get('language'),
            'vod_remarks': d.get('updateInfo'),
            'vod_actor': d.get('leader'),
            'vod_director': d.get('director'),
            'vod_content': d.get('story'),
            'vod_play_from': '芒果TV',
            'vod_play_url': ''
        }
        data,pdata=self.fetch_page_data('1', ids[0],True, show_title)
        pagecount=data['data'].get('total_page') or 1
        # 有的剧分集极多（如 2000 条），全量拉取会拖垮详情（本机实测 97 秒）；
        # 只取前 10 页（300 集），覆盖绝大多数剧集，手机端也更快。
        pagecount = min(int(pagecount), 10)
        if int(pagecount)>1:
            pages = list(range(2, pagecount+1))
            page_results = {}
            with ThreadPoolExecutor(max_workers=4) as executor:
                future_to_page = {
                    executor.submit(self.fetch_page_data, page, ids[0], False, show_title): page
                    for page in pages
                }
                for future in as_completed(future_to_page):
                    page = future_to_page[future]
                    try:
                        result = future.result()
                        page_results[page] = result
                    except Exception as e:
                        print(f"Error fetching page {page}: {e}")
            for page in sorted(page_results.keys()):
                pdata.extend(page_results[page])
        vod['vod_play_url'] = '#'.join(pdata)
        return {'list':[vod]}

    def searchContent(self, key, quick, pg="1"):
        data=self.fetch(f'{self.shost}/applet/search/v1?channelCode=mobile-wxap&q={key}&pn={pg}&pc=10&_support=10000000', headers=self.headers).json()
        videoList = []
        for i in data['data']['contents']:
            if i.get('data') and len(i['data']):
                k = i['data'][0]
                if k.get('vid') and k.get('img'):
                    try:
                        videoList.append({
                            'vod_id': k['vid'],
                            'vod_name': k['title'],
                            'vod_pic': k['img'],
                            'vod_year': (i.get('rightTopCorner',{}) or {}).get('text') or i.get('year'),
                            'vod_remarks': '/'.join(i.get('desc',[])),
                        })
                    except:
                        print(k)
        return {'list':videoList,'page':pg}

    def playerContent(self, flag, id, vipFlags):
        vid, ep_num, page_path, title = self._parse_mgtv_token(id)
        # 整次播放解析预算 25 秒：官方直链先占 15 秒，云端兜底用剩下的，
        # 避免在弱网下把播放拖垮（本机出口慢，手机端通常 1-2 秒就回）。
        budget_end = time.time() + 25
        # 0) 芒果官方 tk2 直链
        if vid:
            direct_url = self._get_mgtv_direct_url(vid, budget_end)
            if direct_url:
                return {'jx': 0, 'parse': 0, 'url': direct_url,
                        'header': json.dumps(self.headers)}
        # 1) MacCMS 同名片源兜底（GreasyFork 脚本的方法，校验后才返回）
        if title and ep_num and time.time() < budget_end:
            cloud_url = self._get_mgtv_cloud_url(title, ep_num, budget_end)
            if cloud_url:
                return {'jx': 0, 'parse': 0, 'url': cloud_url,
                        'header': json.dumps(self.headers)}
        # 2) 兜底：仍返回官源网页（原逻辑），总比播不了强
        page = page_path or id
        url = page if page.startswith('http') else f'{self.rhost}{page}'
        return {'jx': 1, 'parse': 1, 'url': url, 'header': ''}

    def _parse_mgtv_token(self, play_id):
        """解析播放 token，返回 (vid, ep_num, page_path, title)。
        新格式：mgtv:<vid>@<集号>@<页面路径>@<片名>（片名在最后，可含 @）；
        旧格式：/b/<clip>/<vid>.html 页面路径。"""
        text = (play_id or '').strip()
        if text.startswith('mgtv:'):
            parts = text[5:].split('@')
            if len(parts) >= 4:
                try:
                    ep_num = int(parts[1])
                except Exception:
                    ep_num = 0
                return parts[0], ep_num, parts[2], '@'.join(parts[3:])
            return '', 0, '', ''
        vid = self._extract_mgtv_vid(text)
        return vid, 0, text if text.startswith('/') else '', ''

    def _extract_mgtv_vid(self, play_id):
        """从播放 token 取 numeric video_id：分集 url 是 /b/<clip>/<vid>.html；
        传入纯数字时直接用。取不到返回 ''。"""
        text = (play_id or '').strip()
        if text.isdigit():
            return text
        m = re.search(r'/(\d+)\.html', text)
        if m:
            return m.group(1)
        m = re.search(r'(\d{5,})', text)
        return m.group(1) if m else ''

    def _get_mgtv_direct_url(self, vid, deadline=None):
        """芒果官方直链（tk2 签名流，免嗅探返回 m3u8），参考 yt-dlp mgtv 流程。

        1) tk2 = urlsafe_b64('did=<uuid>|pno=1030|ver=0.3.0301|clit=<ts>') 再整体反转
        2) GET pcweb.api.mgtv.com/player/video?tk2&video_id&type=pch5 -> data.atc.pm2
        3) GET tinker.glb.mgtv.com/player/getSource?tk2&pm2&video_id&type=pch5...
           -> data.stream_domain + data.stream[]（各清晰度，filebitrate 排序）
        4) 按清晰度从高到低，逐个 GET stream_domain + stream.url -> info 即最终 m3u8
        1080P 的 url 可能为空（需 VIP），跳过；全部失败返回 None。
        deadline：整次调用的最晚返回时间，超时直接返回 None。
        """
        vid = (vid or '').strip()
        if not vid:
            return None
        if deadline is None:
            deadline = time.time() + 15
        try:
            tk2 = base64.urlsafe_b64encode(
                ('did=%s|pno=1030|ver=0.3.0301|clit=%d'
                 % (uuid.uuid4(), int(time.time()))).encode()).decode()[::-1]
            data1 = self.fetch(
                'https://pcweb.api.mgtv.com/player/video',
                params={'tk2': tk2, 'video_id': vid, 'type': 'pch5'},
                headers=self.headers, timeout=6).json()
            pm2 = ((data1.get('data') or {}).get('atc') or {}).get('pm2')
            if not pm2 or time.time() > deadline:
                return None
            data2 = self.fetch(
                'https://tinker.glb.mgtv.com/player/getSource',
                params={'_support': '10000000', 'tk2': tk2, 'pm2': pm2,
                        'video_id': vid, 'type': 'pch5', 'auth_mode': '1',
                        'cxid': '', 'supportMse': '1', 'src': 'intelmgtv',
                        'abroad': '10', 'allowedRC': '1'},
                headers=self.headers, timeout=6).json()
            data2 = data2.get('data') or {}
            domains = data2.get('stream_domain') or []
            streams = data2.get('stream') or []
            if not domains or not streams:
                return None
            domain = (domains[0] or '').rstrip('/')

            def _bitrate(s):
                try:
                    return int(float(s.get('filebitrate') or 0))
                except Exception:
                    return 0

            for s in sorted(streams, key=_bitrate, reverse=True):
                if time.time() > deadline:
                    return None
                rel = s.get('url') or ''
                if not rel:
                    continue
                full = rel if rel.startswith('http') else domain + rel
                try:
                    info = self.fetch(full, headers=self.headers, timeout=6).json()
                except Exception:
                    continue
                final = info.get('info') if isinstance(info, dict) else None
                if final and isinstance(final, str) and final.startswith('http'):
                    return final
            return None
        except Exception:
            return None

    def _clean_mgtv_title(self, title):
        """去季后缀：'向往的生活 第七季' -> '向往的生活'，供同名搜索第二轮用。"""
        t = (title or '').strip()
        t = re.sub(r'\s*第[一二三四五六七八九十\d]+季\s*$', '', t)
        return t

    def _pick_cloud_episode(self, play_url, ep_num):
        """从 MacCMS vod_play_url（$$$ 分源，# 分集，名$url）里按集号取 m3u8。
        集号匹配 '第N集'/'第N期'/'E0N'，无匹配返回 None（不猜）。"""
        for group in (play_url or '').split('$$$'):
            for item in group.split('#'):
                if '$' in item:
                    name, url = item.split('$', 1)
                else:
                    name, url = '', item
                url = (url or '').strip()
                if not url.startswith('http') or '.m3u8' not in url:
                    continue
                name = (name or '').strip()
                if (f'第{ep_num}集' in name or f'第{ep_num}期' in name
                        or f'第{ep_num:02d}集' in name
                        or f'E{ep_num:02d}' in name
                        or f'E{ep_num}' in name):
                    return url
        return None

    def _verify_m3u8(self, url, timeout=6):
        """GET 校验是真实 m3u8 清单（以 #EXTM3U 开头）才算可用，死链直接淘汰。"""
        try:
            rsp = self.fetch(url, headers=self.headers, timeout=timeout)
            text = getattr(rsp, 'text', '') or ''
            return text.lstrip().startswith('#EXTM3U')
        except Exception:
            return False

    def _get_mgtv_cloud_url(self, title, ep_num, deadline=None):
        """MacCMS 同名片源兜底（GreasyFork 全网 VIP 破解脚本的方法）：
        按片名在量子/暴风/非凡搜同名资源，取对应集数的 m3u8；返回前先 GET
        校验是真实 #EXTM3U 才返回。本机实测芒果剧的 MacCMS 副本多为 404
        死链，校验会直接淘汰，手机端（国内 IP）若文件存活即可直连。
        全部失败返回 None。deadline：最晚返回时间，超时直接返回 None。"""
        title = (title or '').strip()
        if not title or not ep_num:
            return None
        if deadline is None:
            deadline = time.time() + 12
        titles = [title]
        base = self._clean_mgtv_title(title)
        if base and base != title:
            titles.append(base)
        for api in self.cloud_apis:
            for t in titles:
                if time.time() > deadline:
                    return None
                try:
                    data = self.fetch(
                        api, params={'ac': 'videolist', 'wd': t},
                        headers=self.headers, timeout=6).json()
                except Exception:
                    continue
                vods = data.get('list') or []
                for vod in vods:
                    if time.time() > deadline:
                        return None
                    url = self._pick_cloud_episode(
                        vod.get('vod_play_url') or '', ep_num)
                    if url and self._verify_m3u8(url):
                        return url
                for vod in vods[:3]:
                    if time.time() > deadline:
                        return None
                    if vod.get('vod_play_url'):
                        continue
                    vid2 = vod.get('vod_id')
                    if not vid2:
                        continue
                    try:
                        d2 = self.fetch(
                            api, params={'ac': 'detail', 'ids': vid2},
                            headers=self.headers, timeout=6).json()
                    except Exception:
                        continue
                    for vod2 in (d2.get('list') or []):
                        url = self._pick_cloud_episode(
                            vod2.get('vod_play_url') or '', ep_num)
                        if url and self._verify_m3u8(url):
                            return url
        return None

    def localProxy(self, param):
        pass

    def getf(self, body):
        params = {
            'allowedRC': '1',
            'channelId': body['type_id'],
            'platform': 'pcweb',
            '_support': '10000000',
        }
        data = self.fetch(f'{self.host}/rider/config/channel/v1', params=params, headers=self.headers).json()
        ft = []
        for i in data['data']['listItems']:
            try:
                value_array = [{"n": value['tagName'], "v": value['tagId']} for value in i['items'] if
                               value.get('tagName')]
                ft.append({"key": i['eName'], "name": i['typeName'], "value": value_array})
            except:
                print(i)
        return body['type_id'], ft

    def fetch_page_data(self, page, id, b=False, title=''):
        body = {'version': '5.5.35', 'video_id': id, 'page': page, 'size': '30',
                'platform': '4', 'src': 'mgtv', 'allowedRC': '1', '_support': '10000000'}
        data = self.fetch(f'{self.vhost}/episode/list', params=body, headers=self.headers).json()
        safe_title = (title or '').replace('#', '').replace('$', '').replace('@', '')
        ldata = []
        base_index = (int(page) - 1) * 30
        for i, item in enumerate(data['data']['list']):
            t3 = item.get('t3') or ''
            m = re.search(r'第(\d+)[集期]', t3)
            ep_num = int(m.group(1)) if m else base_index + i + 1
            vid = str(item.get('video_id') or '')
            path = item.get('url') or ''
            if vid and safe_title:
                ldata.append(f'{t3}$mgtv:{vid}@{ep_num}@{path}@{safe_title}')
            else:
                ldata.append(f'{t3}${path}')
        if b:
            return data, ldata
        else:
            return ldata
