# coding=utf-8
# !/usr/bin/python
# by嗷呜
import json
import random
import re
import sys
import time
from base64 import b64encode, b64decode
from concurrent.futures import ThreadPoolExecutor, as_completed
from pprint import pprint
from urllib.parse import quote, unquote, urlencode

sys.path.append('..')
from base.spider import Spider


class Spider(Spider):

    def init(self, extend=""):
        self.did = self.random_str(32)
        pass

    def getName(self):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass

    rhost = 'https://www.iqiyi.com'

    hhost='https://mesh.if.iqiyi.com'

    dhost='https://miniapp.iqiyi.com'

    headers = {
        'Origin': rhost,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'Referer': f'{rhost}/',
    }

    # 云端直连兜底（MacCMS 同名片源）：jx.xmflv.com 已停服（返回告别页），
    # 爱奇艺官方直链接口又不开放，播放改走云端已校验的 m3u8 直链（parse=0），
    # 不再返回任何网页地址（用户明确不要网页播放）。
    # 顺序即优先级：豪华/金鹰/光速/极速本机实测有真 m3u8，其余仅作备用。
    cloud_m3u8_apis = [
        ("豪华直连", "https://hhzyapi.com/api.php/provide/vod/"),
        ("金鹰直连", "https://jyzyapi.com/api.php/provide/vod/"),
        ("光速直连", "https://api.guangsuapi.com/api.php/provide/vod/"),
        ("极速直连", "https://jszyapi.com/api.php/provide/vod/"),
        ("量子直连", "https://cj.lziapi.com/api.php/provide/vod/"),
        ("暴风直连", "https://bfzyapi.com/api.php/provide/vod/"),
        ("非凡直连", "https://api.ffzy5.tv/api.php/provide/vod/")
    ]

    @staticmethod
    def _cloud_match(vname, title):
        """片名严格匹配（防播错剧）：2=精确相等，1=前缀+短后缀，0=不匹配。"""
        def norm(s):
            s = re.sub(r'[^\w\u4e00-\u9fff]', '', s or '')
            s = re.sub(r'第[一二三四五六七八九十\d]+季', '', s)
            s = re.sub(r'(DVD版|高清版|未删减版|完整版|抢先版|剧场版)$', '', s)
            return s
        a, b = norm(vname), norm(title)
        if not a or not b:
            return 0
        if a == b:
            return 2
        if (a.startswith(b) and len(a) - len(b) <= 3) or (b.startswith(a) and len(b) - len(a) <= 3):
            return 1
        return 0

    @staticmethod
    def _cloud_pick_eps(play_url, ep_num):
        """从 MacCMS vod_play_url 里按集号取候选 m3u8（精确集号 > 区间 > 全集/正片）。"""
        def _match(name):
            name = (name or '').strip()
            if (f'第{ep_num}集' in name or f'第{ep_num}期' in name
                    or f'第{ep_num:02d}集' in name
                    or f'E{ep_num:02d}' in name or f'E{ep_num}' in name):
                return 2
            m = re.search(r'第(\d+)-(\d+)[集期]', name)
            if m and int(m.group(1)) <= ep_num <= int(m.group(2)):
                return 1
            if name in ('全集', '正片', '全集完结', '全集高清'):
                return 1
            return 0
        cands = []
        for group in (play_url or '').split('$$$'):
            for item in group.split('#'):
                if '$' in item:
                    name, url = item.split('$', 1)
                else:
                    name, url = '', item
                url = (url or '').strip()
                if not url.startswith('http'):
                    continue
                score = _match(name)
                if not score:
                    continue
                pref = 1 if '.m3u8' in url else 0
                cands.append((score, pref, url))
        cands.sort(key=lambda c: (c[0], c[1]), reverse=True)
        seen, out = set(), []
        for _, _, url in cands:
            if url not in seen:
                seen.add(url)
                out.append(url)
        return out

    def _cloud_verify_m3u8(self, url, timeout=6):
        """GET 校验是真实 m3u8 清单（以 #EXTM3U 开头）才算可用。只带 UA，不带 Referer。"""
        try:
            rsp = self.fetch(url, headers={'User-Agent': self.headers['User-Agent']}, timeout=timeout)
            text = getattr(rsp, 'text', '') or ''
            return text.lstrip().startswith('#EXTM3U')
        except Exception:
            return False

    def _cloud_fallback_url(self, title, ep_num, deadline=None):
        """按片名+集号在云端 MacCMS 搜同名资源，取对应集数的 m3u8（校验后才返回）。"""
        title = (title or '').strip()
        if not title or not ep_num:
            return None
        if deadline is None:
            deadline = time.time() + 15
        for _label, api_url in self.cloud_m3u8_apis:
            if time.time() > deadline:
                return None
            try:
                rsp = self.fetch(api_url, params={'ac': 'videolist', 'wd': title},
                                 headers=self.headers, timeout=6).json()
            except Exception:
                continue
            best_item, best_score = None, 0
            for item in rsp.get('list') or []:
                score = self._cloud_match(item.get('vod_name') or '', title)
                if score > best_score:
                    best_item, best_score = item, score
                    if score == 2:
                        break
            if not best_item:
                continue
            for url in self._cloud_pick_eps(best_item.get('vod_play_url') or '', ep_num):
                if time.time() > deadline:
                    return None
                if url and self._cloud_verify_m3u8(url):
                    return url
        return None

    @staticmethod
    def _ep_num_from_title(short_title, fallback=1):
        """从“折月亮第12集 / 第3期”里取集号；取不到用列表序号兜底。"""
        m = re.search(r'第(\d+)[集期]', short_title or '')
        if m:
            return int(m.group(1))
        cn = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
              '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
        m = re.search(r'第([一二三四五六七八九十]+)[集期]', short_title or '')
        if m and m.group(1) in cn:
            return cn[m.group(1)]
        return fallback

    def homeContent(self, filter):
        result = {}
        cateManual = {
            "全部": "1009",
            "电影": "1",
            "剧集": "2",
            "综艺": "6",
            "动漫": "4",
            "儿童": "15",
            "微剧": "35",
            "纪录片": "3"
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
        data=self.fetch(f'{self.hhost}/portal/lw/v5/channel/recommend?v=13.014.21150', headers=self.headers).json()
        vlist = []
        for i in data['items']:
            for j in i['video'][0]['data']:
                id = j.get('firstId')
                if id:
                    pu=j.get('prevue',{}).get('page_url') or j.get('page_url').split('?')[0]
                    id = f'{id}@{self.e64(pu)}'
                    vlist.append({
                        'vod_id': id,
                        'vod_name': j.get('display_name'),
                        'vod_pic': j.get('prevue',{}).get('image_url'),
                        'vod_year': j.get('sns_score'),
                        'vod_remarks': j.get('dq_updatestatus') or j.get('rank_prefix')
                    })
        return {'list':vlist}

    def categoryContent(self, tid, pg, filter, extend):
        if pg == "1" or pg == 1:
            self.sid = ''
        new_data = {'mode':'24'}
        for key, value in (extend or {}).items():
            if value:
                key_value_pairs = self.d64(value).split(',')
                for pair in key_value_pairs:
                    k, v = pair.split('=')
                    if k in new_data:
                        new_data[k] += "," + v
                    else:
                        new_data[k] = v
        path=f'/portal/lw/videolib/data?uid=&passport_id=&ret_num=60&version=13.014.21150&device_id={self.did}&channel_id={tid}&page_id={pg}&session={self.sid}&os=&conduit_id=&vip=0&auth&recent_selected_tag=&ad=%5B%7B%22lm%22:%225%22,%22ai%22:%225%22,%22fp%22:%226%22,%22sei%22:%22Sa867aa9d326e2bd8654d8c2a8636055e%22,%22position%22:%22library%22%7D%5D&adExt=%7B%22r%22:%221.2.1-ares6-pure%22%7D&dfp=a12f96215b2f7842a98c082799ca0c3d9236be00946701b106829754d8ece3aaf8&filter={urlencode(new_data)}'
        data=self.fetch(f'{self.hhost}{path}', headers=self.headers).json()
        self.sid = data.get('session') or ''
        videos = []
        for i in (data.get('data') or []):
            id = i.get('firstId') or i.get('tv_id')
            if not id:
                id=i.get('play_url').split(';')[0].split('=')[-1]
            if id and not i.get('h'):
                id=f'{id}@{self.e64(i.get("page_url"))}'
                videos.append({
                    'vod_id': id,
                    'vod_name': i.get('display_name'),
                    'vod_pic': i.get('album_image_url_hover'),
                    'vod_year': i.get('sns_score'),
                    'vod_remarks': i.get('dq_updatestatus') or i.get('pay_mark')
                })
        result = {}
        result['list'] = videos
        result['page'] = pg
        result['pagecount'] = 9999
        result['limit'] = 90
        result['total'] = 999999
        return result

    def detailContent(self, ids):
        ids = ids[0].split('@')
        ids[-1] = self.d64(ids[-1])
        data = self.fetch(f'{self.dhost}/h5/mina/baidu/play/body/v1/{ids[0]}/', headers=self.headers, timeout=10).json()
        _body = data.get('data') if isinstance(data, dict) else None
        if not _body or not isinstance(_body, dict) or not _body.get('playInfo'):
            data = {'data': None}  # force head-endpoint fallback below
        # t=str(int(time.time()*1000))
        # e = 'ad_ext={"r":"1.2.1-ares6-pure"}&ad_param=[{"azt":"730","azd":"1000000000942","lm":1,"position":"related"},{"azt":"731","azd":"1000000000943","lm":1,"position":"recommend"},{"azt":"734","azd":"1000000000910","lm":1,"position":"middlecard"},{"azt":"738","azd":"1000000000911","lm":1,"position":"bottomcard"},{"azt":"612","azd":"1000000000695","lm":2,"position":"recommend_full"},{"azt":"","azd":"1000000000912","lm":1,"position":"rcd_image"}]&app_mode=standard&app_version=13.014.21150&auth_cookie=&conduit_id=&device_id='+self.did+'&entity_id='+ids[0]+'&entity_type=1&filter=&ext=&os=&src=pca_tvg&timestamp=' + t + '&user_id=0&vip_status=0&vip_type=-1&secret_key=howcuteitis'
        # sign=self.md5(e).upper()
        # path=f'/tvg/v2/lw/base_info?entity_id={ids[0]}&device_id={self.did}&auth_cookie&user_id=0&vip_type=-1&vip_status=0&conduit_id&app_version=13.014.21150&ext&app_mode=standard&timestamp={t}&src=pca_tvg&os&ad_param=%5B%7B%22azt%22:%22730%22,%22azd%22:%221000000000942%22,%22lm%22:1,%22position%22:%22related%22%7D,%7B%22azt%22:%22731%22,%22azd%22:%221000000000943%22,%22lm%22:1,%22position%22:%22recommend%22%7D,%7B%22azt%22:%22734%22,%22azd%22:%221000000000910%22,%22lm%22:1,%22position%22:%22middlecard%22%7D,%7B%22azt%22:%22738%22,%22azd%22:%221000000000911%22,%22lm%22:1,%22position%22:%22bottomcard%22%7D,%7B%22azt%22:%22612%22,%22azd%22:%221000000000695%22,%22lm%22:2,%22position%22:%22recommend_full%22%7D,%7B%22azt%22:%22%22,%22azd%22:%221000000000912%22,%22lm%22:1,%22position%22:%22rcd_image%22%7D%5D&ad_ext=%7B%22r%22:%221.2.1-ares6-pure%22%7D&sign={sign}'
        # vdata=self.fetch(f'{self.hhost}{path}', headers=self.headers).json()
        # print(vdata)
        if not data.get('data'):
            v = None
            vod = None
        else:
            v=data['data']['playInfo']
            vod = {
            'vod_name': v.get('albumName'),
            'type_name': v.get('tags'),
            'vod_year': v.get('albumYear'),
            'vod_remarks': v.get('updateStrategy'),
            'vod_actor': v.get('mainActors'),
            'vod_director': v.get('directors'),
            'vod_content': v.get('albumDesc'),
            'vod_play_from': '爱奇艺',
            'vod_play_url': ''
        }
        if data.get('data') and data['data'].get('videoList') and data['data']['videoList'].get('videos'):
            show_title = (v.get('albumName') or '').strip()
            purl = []
            for idx, i in enumerate(data['data']['videoList']['videos']):
                st = i.get('shortTitle') or ''
                ep = self._ep_num_from_title(st, idx + 1)
                purl.append(f'{st}$iqiyi:{ep}@{quote(show_title)}@{i["pageUrl"]}')
            pg=data['data']['videoList'].get('totalPages')
            if pg and pg > 1:
                id = v['albumId']
                pages = list(range(2, pg + 1))
                page_results = {}
                with ThreadPoolExecutor(max_workers=10) as executor:
                    future_to_page = {
                        executor.submit(self.fetch_page_data, page, id, show_title): page
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
                    purl.extend(page_results[page])
            vod['vod_play_url'] = '#'.join(purl)
        else:
            vdata=self.fetch(f'{self.dhost}/h5/mina/baidu/play/head/v1/{ids[0]}/', headers=self.headers, timeout=10).json()
            _head = vdata.get('data') if isinstance(vdata, dict) else None
            v = _head.get('playInfo') if isinstance(_head, dict) else None
            if not v:
                return {'list': [{'vod_name': '暂无数据', 'vod_play_from': '爱奇艺', 'vod_play_url': '', 'vod_content': '爱奇艺接口暂无该节目数据'}]}
            vod = {
                'vod_name': v.get('shortTitle'),
                'type_name': v.get('channelName'),
                'vod_year': v.get('year'),
                'vod_remarks': v.get('focus'),
                'vod_actor': v.get('mainActors'),
                'vod_director': v.get('directors'),
                'vod_content': v.get('desc'),
                'vod_play_from': '爱奇艺',
                'vod_play_url': f'{v.get("shortTitle")}$iqiyi:1@{quote(v.get("shortTitle") or "")}@{ids[-1]}'
            }
        return {'list':[vod]}

    def searchContent(self, key, quick, pg="1"):
        data=self.fetch(f'{self.hhost}/portal/lw/search/homePageV3?key={key}&current_page={pg}&mode=1&source=input&suggest=&version=13.014.21150&pageNum={pg}&pageSize=25&pu=&u={self.did}&scale=150&token=&userVip=0&conduit=&vipType=-1&os=&osShortName=win10&dataType=&appMode=', headers=self.headers).json()
        videos = []
        vdata=data['data']['templates']
        for i in data['data']['templates']:
            if i.get('intentAlbumInfos'):
                vdata=[{'albumInfo': c} for c in i['intentAlbumInfos']]+vdata

        for i in vdata:
            if i.get('albumInfo') and (i['albumInfo'].get('playQipuId','') or i['albumInfo'].get('qipuId')) and i['albumInfo'].get('pageUrl'):
                b=i['albumInfo']
                id=f"{(b.get('playQipuId','') or b.get('qipuId'))}@{self.e64(b.get('pageUrl'))}"
                videos.append({
                    'vod_id': id,
                    'vod_name': b.get('title'),
                    'vod_pic': b.get('img'),
                    'vod_year': (b.get('year',{}) or {}).get('value'),
                    'vod_remarks': b.get('subscriptContent') or b.get('channel') or b.get('vipTips')
                })
        return {'list':videos,'page':pg}

    def playerContent(self, flag, id, vipFlags):
        # 已经是直链 m3u8/MP4：直接播
        if isinstance(id, str) and id.startswith('http') and ('.m3u8' in id or '.mp4' in id):
            return {'jx': 0, 'parse': 0, 'url': id, 'header': ''}
        # iqiyi:{ep}@{title}@{pageUrl}：云端同名片源兜底（parse=0 直链）。
        # jx.xmflv.com 已停服（返回告别页），不再返回任何网页地址。
        budget_end = time.time() + 25
        if isinstance(id, str) and id.startswith('iqiyi:'):
            token = id.split(':', 1)[1]
            parts = token.split('@', 2)
            ep_num, show_title = 0, ''
            if len(parts) >= 2:
                try:
                    ep_num = int(parts[0])
                except Exception:
                    ep_num = 0
                show_title = unquote(parts[1])
            if show_title and ep_num and time.time() < budget_end:
                cloud_url = self._cloud_fallback_url(show_title, ep_num, budget_end)
                if cloud_url:
                    return {'jx': 0, 'parse': 0, 'url': cloud_url,
                            'header': json.dumps({'User-Agent': self.headers['User-Agent']})}
        # 全部失败：返回空直链，App 报无法播放，不弹网页。
        return {'jx': 0, 'parse': 0, 'url': '', 'header': ''}

    def localProxy(self, param):
        pass

    def fetch_page_data(self, page, id, show_title=''):
        try:
            url = f'{self.dhost}/h5/mina/avlist/{page}/{id}/'
            data = self.fetch(url, headers=self.headers).json()
            out = []
            for idx, i in enumerate(data['data']['videoList']['videos']):
                st = i.get('shortTitle') or ''
                ep = self._ep_num_from_title(st, idx + 1)
                out.append(f'{st}$iqiyi:{ep}@{quote(show_title)}@{i["pageUrl"]}')
            return out
        except:
            return []

    def getf(self,body):
        data=self.fetch(f'{self.hhost}/portal/lw/videolib/tag?channel_id={body["type_id"]}&tagAdd=&selected_tag_name=&version=13.014.21150&device={self.did}&uid=', headers=self.headers).json()
        ft = []
        # for i in data[:-1]:
        for i in data:
            try:
                value_array = [{"n": value['text'], "v": self.e64(value['tag_param'])} for value in i['tags'] if
                               value.get('tag_param')]
                ft.append({"key": i['group'], "name": i['group'], "value": value_array})
            except:
                print(i)
        return (body['type_id'], ft)

    def e64(self, text):
        try:
            text_bytes = text.encode('utf-8')
            encoded_bytes = b64encode(text_bytes)
            return encoded_bytes.decode('utf-8')
        except Exception as e:
            print(f"Base64编码错误: {str(e)}")
            return ""

    def d64(self,encoded_text: str):
        try:
            encoded_bytes = encoded_text.encode('utf-8')
            decoded_bytes = b64decode(encoded_bytes)
            return decoded_bytes.decode('utf-8')
        except Exception as e:
            print(f"Base64解码错误: {str(e)}")
            return ""

    def random_str(self,length=16):
        hex_chars = '0123456789abcdef'
        return ''.join(random.choice(hex_chars) for _ in range(length))
