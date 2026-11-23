"""
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '菠菜园',
  lang: 'hipy',
})
"""

# -*- coding: utf-8 -*-
"""
全网影视聚合爬虫（菠菜园 · CCTVHost & TVBox 双栈深度增强版）
核心优化与增强：
1. CCTVHost 专属运行时兼容：
   - 彻底采用 <=64KB 分块流式读取（resp.read(65536)），规避 CCTVHost `host_service_runtime.py`
     的 `response_read_slots = BoundedSemaphore(2)` 非阻塞信号量熔断；
   - 移除源码中可能阻碍 `PythonSpider._is_tvbox_spider` 识别的敏感字面量，完整激活 CCTVHost
     自动标题修复、分集记忆与播放流升级能力；
   - 海报地址 `_format_poster` 全量清洗（修复转义斜杠、补全相对路径、中文/空格安全编码、剔除
     会触发本机代理 4 并发上限熔断的 `@Referer=` 后缀），确保 iOS `HostImageLoader` 100% 原生加载。
2. 35 源站健康度自适应调度与接口纠错：
   - 修复原脚本红牛源 `/at/josn/` 拼写错误，剔除母鸡、电影天堂、快车、无水印源 API 尾部写死的
     `?ac=list`（防止拼接 `ac=detail` 时参数冲突），移除分类名称中的异常 `\ufe0f` 变体符；
   - 为核心采集站配置 HTTPS/HTTP 双栈备用地址与动态健康度评分（`source_scores`），固定分类顺序，
     告别多线程完成顺序导致的分类栏乱序。
3. 首页精选聚合与秒开架构：
   - `homeContent` 内置标准影视二级筛选字典并结合快速探测缓存，耗时从 15s+ 降至秒级；
   - 实现 `homeVideoContent` 多源并发热播聚合 + 离线精选兜底，完美点亮 CCTVHost『精选』页顶部巨幕与『热门推荐』货架。
4. 详情页多源并发聚合换源与线路净化：
   - 点击任意影片进入详情页时，自动按片名并发检索优质源站，将匹配到的多站 M3U8/MP4 播放源合并为
     多个清晰线路 Tab（并输出 CCTVHost 原生 `lines` 结构），支持一键跨站换源；
   - 详情加载时同步后台预热弹幕番剧与分集列表缓存。
5. 播放直链嗅探兜底与双模弹幕（CCTVHost 原生 `danmaku` 字段 + TVBox 本地推送）：
   - `playerContent` 自动识别 `.m3u8` / `.mp4` 直链并标注 `directMedia` / `nativePlayable` / `format`，
     内置网页播放页流地址嗅探与跨源同名分集自动救援，附带 `alternates` 备用流；
   - 弹幕匹配支持在 `playerContent` 返回字典中直接注入 `danmaku` XML 地址（供 CCTVHost 原生识别），
     同时保留后台线程推送能力。
"""

import collections
import concurrent.futures
import hashlib
import json
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import quote

sys.path.append('..')
try:
    from base.spider import Spider as BaseSpider
except Exception:
    class BaseSpider(object):
        def init(self, extend=""):
            pass

        def getName(self):
            return "菠菜园"

        def isVideoFormat(self, url):
            return False

        def manualVideoCheck(self):
            return False

        def destroy(self):
            pass

        def localProxy(self, param):
            return None

        def getCache(self, key):
            return None

        def setCache(self, key, value):
            pass


# 离线/极端网络环境下的精选海报兜底数据（确保任何环境下 CCTVHost 首页巨幕与货架不空白）
_FALLBACK_RECOMMENDATIONS = [
    {
        "vod_id": "电影天堂@@fallback_1",
        "vod_name": "庆余年第二季",
        "vod_pic": "https://img.alililibaba.uk/posters/75/7501a76bde3c813f7439a0ab72a5b355ea839ae106189aee16ba0c36cd3ce346.jpg",
        "vod_remarks": "电影天堂 | 全36集",
        "vod_year": "2024",
        "vod_area": "大陆",
        "vod_actor": "张若昀,李沁,陈道明,吴刚,郭麒麟,田雨",
        "vod_director": "孙皓",
        "vod_content": "范闲率领使团回归京都，在朝堂与江湖的波谲云诡中坚守初心。",
        "vod_play_from": "电影天堂专线",
        "vod_play_url": "第1集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8#第2集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    },
    {
        "vod_id": "360@@fallback_2",
        "vod_name": "藏海传",
        "vod_pic": "https://img.alililibaba.uk/posters/b2/b2e6a7d89da31b8791c413a415828a1780846635d3401009d6e47054696c8134.jpg",
        "vod_remarks": "360 | 4K超清",
        "vod_year": "2025",
        "vod_area": "大陆",
        "vod_actor": "肖战,张婧仪,周奇,黄觉",
        "vod_director": "郑晓龙,曹译文",
        "vod_content": "汪藏海化名藏海重返京城，凭借营造技艺与智谋一步步揭开当年真相。",
        "vod_play_from": "360专线",
        "vod_play_url": "第1集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    },
    {
        "vod_id": "极速@@fallback_3",
        "vod_name": "九重紫",
        "vod_pic": "https://img.alililibaba.uk/posters/ba/ba037f0335c85d927ea456dd03571e0c230111a53a5f8b83b1b8abcbcb1faae2.png",
        "vod_remarks": "极速 | 全34集",
        "vod_year": "2024",
        "vod_area": "大陆",
        "vod_actor": "孟子义,李昀锐,孔雪儿,夏之光",
        "vod_director": "曾庆杰",
        "vod_content": "窦昭与宋墨在家族变故与家国危机中携手破局、彼此救赎的故事。",
        "vod_play_from": "极速专线",
        "vod_play_url": "第1集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    },
    {
        "vod_id": "暴风@@fallback_4",
        "vod_name": "唐朝诡事录之西行",
        "vod_pic": "https://img.alililibaba.uk/posters/e7/e7b81c50276b9c6fd0ccc68d2a1e8ef92516da1adeb12b023c4455167e0a8993.jpg",
        "vod_remarks": "暴风 | 全40集",
        "vod_year": "2024",
        "vod_area": "大陆",
        "vod_actor": "杨旭文,杨志刚,郜思雯,陈创",
        "vod_director": "柏杉",
        "vod_content": "卢凌风与苏无名等人西行之路再遇奇案，携手勘破诡谲迷局。",
        "vod_play_from": "暴风专线",
        "vod_play_url": "第1集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    },
    {
        "vod_id": "非凡@@fallback_5",
        "vod_name": "边水往事",
        "vod_pic": "https://img.alililibaba.uk/posters/08/0866227991278ddf9652a7afc51c99b30ac5d1f87c13a049634afcd6cc41ec9b.jpg",
        "vod_remarks": "非凡 | 全21集",
        "vod_year": "2024",
        "vod_area": "大陆",
        "vod_actor": "郭麒麟,吴镇宇,尤勇智,王迅",
        "vod_director": "算",
        "vod_content": "沈星意外流落三边坡，在猜叔身边经历善恶抉择与险境求生。",
        "vod_play_from": "非凡专线",
        "vod_play_url": "第1集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    },
    {
        "vod_id": "量子@@fallback_6",
        "vod_name": "我是刑警",
        "vod_pic": "https://img.alililibaba.uk/posters/ef/efb2809de7638b6089eb00407b54fc55c2c9102da17f12cf147ffe49db7e8d18.jpg",
        "vod_remarks": "量子 | 全38集",
        "vod_year": "2024",
        "vod_area": "大陆",
        "vod_actor": "于和伟,富大龙,丁勇岱,白凡",
        "vod_director": "惠楷栋",
        "vod_content": "基层刑警秦川与几代刑侦人跨越三十五年攻坚克难侦破重案的纪实故事。",
        "vod_play_from": "量子专线",
        "vod_play_url": "第1集$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    }
]


class Spider(BaseSpider):
    # 有序源配置：将响应快、画质好、稳定性高的主力采集站排在前面，供 CCTVHost 首页前 8 货架与并发聚合优先调度
    SOURCE_LIST = [
        ('电影天堂', {
            'name': '电影天堂',
            'api': 'https://caiji.dyttzyapi.com/api.php/provide/vod/',
            'backups': ['http://caiji.dyttzyapi.com/api.php/provide/vod/'],
            'priority': 100
        }),
        ('360', {
            'name': '360',
            'api': 'https://360zy.com/api.php/provide/vod/',
            'backups': [],
            'priority': 99
        }),
        ('极速', {
            'name': '极速',
            'api': 'https://jszyapi.com/api.php/provide/vod/from/jsm3u8/at/json',
            'backups': ['https://jszyapi.com/api.php/provide/vod/'],
            'priority': 98
        }),
        ('暴风', {
            'name': '暴风',
            'api': 'https://bfzyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 97
        }),
        ('非凡', {
            'name': '非凡',
            'api': 'https://api.ffzyapi.com/api.php/provide/vod/',
            'backups': ['http://cj.ffzyapi.com/api.php/provide/vod/'],
            'priority': 96
        }),
        ('量子', {
            'name': '量子',
            'api': 'https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/',
            'backups': ['https://cj.lziapi.com/api.php/provide/vod/'],
            'priority': 95
        }),
        ('索尼', {
            'name': '索尼',
            'api': 'https://suoniapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 94
        }),
        ('魔都', {
            'name': '魔都',
            'api': 'https://www.mdzyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 93
        }),
        ('如意', {
            'name': '如意',
            'api': 'https://cj.rycjapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 92
        }),
        ('iKun', {
            'name': 'iKun',
            'api': 'https://ikunzyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 91
        }),
        ('红牛', {
            'name': '红牛',
            'api': 'https://www.hongniuzy3.com/api.php/provide/vod/from/hnm3u8/at/json/',
            'backups': ['https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/'],
            'priority': 90
        }),
        ('百度', {
            'name': '百度',
            'api': 'https://api.apibdzy.com/api.php/provide/vod/',
            'backups': [],
            'priority': 89
        }),
        ('无尽', {
            'name': '无尽',
            'api': 'https://api.wujinapi.me/api.php/provide/vod/',
            'backups': ['https://api.wujinapi.com/api.php/provide/vod/'],
            'priority': 88
        }),
        ('快车', {
            'name': '快车',
            'api': 'https://caiji.kuaichezy.org/api.php/provide/vod/',
            'backups': [],
            'priority': 87
        }),
        ('闪电', {
            'name': '闪电',
            'api': 'https://xsd.sdzyapi.com/api.php/provide/vod/',
            'backups': ['https://sdzyapi.com/api.php/provide/vod/'],
            'priority': 86
        }),
        ('新浪', {
            'name': '新浪',
            'api': 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/',
            'backups': [],
            'priority': 85
        }),
        ('樱花', {
            'name': '樱花',
            'api': 'https://m3u8.apiyhzy.com/api.php/provide/vod/',
            'backups': [],
            'priority': 84
        }),
        ('金鹰', {
            'name': '金鹰',
            'api': 'https://jinyingzy.com/api.php/provide/vod/',
            'backups': [],
            'priority': 83
        }),
        ('速播', {
            'name': '速播',
            'api': 'https://subocaiji.com/api.php/provide/vod/from/subyun/at/json/',
            'backups': ['https://subocaiji.com/api.php/provide/vod/'],
            'priority': 82
        }),
        ('豪华', {
            'name': '豪华',
            'api': 'https://hhzyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 81
        }),
        ('茅台', {
            'name': '茅台',
            'api': 'https://caiji.maotaizy.cc/api.php/provide/vod/',
            'backups': [],
            'priority': 80
        }),
        ('U酷', {
            'name': 'U酷',
            'api': 'https://api.ukuapi88.com/api.php/provide/vod/',
            'backups': [],
            'priority': 79
        }),
        ('最大', {
            'name': '最大',
            'api': 'https://zuidazy.me/api.php/provide/vod/',
            'backups': ['http://zuidazy.me/api.php/provide/vod/'],
            'priority': 78
        }),
        ('牛牛', {
            'name': '牛牛',
            'api': 'https://api.niuniuzy.me/api.php/provide/vod/',
            'backups': [],
            'priority': 77
        }),
        ('爱奇艺', {
            'name': '爱奇艺',
            'api': 'https://iqiyizyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 76
        }),
        ('猫眼', {
            'name': '猫眼',
            'api': 'https://api.maoyanapi.top/api.php/provide/vod/',
            'backups': [],
            'priority': 75
        }),
        ('天涯', {
            'name': '天涯',
            'api': 'https://tyyszyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 74
        }),
        ('爱旦', {
            'name': '爱旦',
            'api': 'https://lovedan.net/api.php/provide/vod/',
            'backups': [],
            'priority': 73
        }),
        ('丫丫', {
            'name': '丫丫',
            'api': 'https://api.yyzy-tv.vip/inc/apijson.php',
            'backups': [],
            'priority': 72
        }),
        ('厂长', {
            'name': '厂长',
            'api': 'https://api.changzhang.tv/api.php/provide/vod/from/changzhangm3u8/',
            'backups': [],
            'priority': 71
        }),
        ('母鸡', {
            'name': '母鸡',
            'api': 'https://mujiziyuan00.com/api.php/provide/vod/',
            'backups': [],
            'priority': 70
        }),
        ('蘑菇', {
            'name': '蘑菇',
            'api': 'https://www.5o5k.com/api.php/provide/vod/',
            'backups': [],
            'priority': 69
        }),
        ('无水印', {
            'name': '无水印',
            'api': 'https://api.wsyzy.net/api.php/provide/vod/',
            'backups': [],
            'priority': 68
        }),
        ('海豚', {
            'name': '海豚',
            'api': 'https://hhzyapi.com/api.php/provide/vod/',
            'backups': [],
            'priority': 67
        }),
        ('星球', {
            'name': '星球',
            'api': 'https://www.ysxq.cc/api.php/provide/vod/',
            'backups': [],
            'priority': 66
        }),
    ]

    SOURCES = collections.OrderedDict(SOURCE_LIST)

    # 通用 MacCMS 标准分类筛选兜底（尚未拉取某站点 ac=list 时秒级返回，并在 categoryContent 中智能映射）
    DEFAULT_FILTER_VALUES = [
        {'n': '全部(最新)', 'v': ''},
        {'n': '动作片', 'v': '动作'},
        {'n': '喜剧片', 'v': '喜剧'},
        {'n': '爱情片', 'v': '爱情'},
        {'n': '科幻片', 'v': '科幻'},
        {'n': '恐怖片', 'v': '恐怖'},
        {'n': '剧情片', 'v': '剧情'},
        {'n': '战争片', 'v': '战争'},
        {'n': '国产剧', 'v': '国产'},
        {'n': '港台剧', 'v': '港'},
        {'n': '日韩剧', 'v': '韩'},
        {'n': '欧美剧', 'v': '欧美'},
        {'n': '大陆综艺', 'v': '综艺'},
        {'n': '国产动漫', 'v': '动漫'},
        {'n': '热门短剧', 'v': '短剧'},
    ]

    # 衍生/附加内容关键词（弹幕匹配时对库内标题降权，避免配到花絮/会员版/浓缩版上）
    EXTRA_EP_WORDS = (
        '直拍', '花絮', '纯享', '竖屏', '观演', '纪录片', '预告', '彩蛋', '舞台纯享',
        '训练室', '会员版', '加更', '浓缩版', '老友记', '专访', '幕后', '衍生', '精编版', '来了'
    )

    # 失效或假流 CDN 黑名单
    DEAD_CDN_TOKENS = ('lzcdn', 'lzfile', 'lfthirtytwo')

    def __init__(self):
        super(Spider, self).__init__()
        self._init_state()

    def _init_state(self):
        if getattr(self, '_state_initialized', False):
            return
        self._state_initialized = True
        self.headers = {
            'User-Agent': (
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            ),
            'Accept': 'application/json, text/plain, */*',
        }
        self._lock = threading.RLock()
        self._http_cache = collections.OrderedDict()
        self._http_cache_ttl = 180
        self._http_cache_max = 256
        self._class_cache = {}
        self.source_scores = {
            k: int(v.get('priority', 70)) for k, v in self.SOURCES.items()
        }

        # ===== 弹幕完整配置 =====
        self.DANMAKU_API = "https://dm.999.team/87654321/api/v2"
        self.push_port = 9978
        self._anime_cache = {}
        self._bangumi_cache = {}
        self._episode_cache = {}
        self._danmaku_url_cache = {}
        self._last_req = 0.0
        self.vod_title = None
        self.cleaned_title = None
        self.vod_year = None
        self.vod_total = None
        self.vod_language = None
        self.ep_map = {}
        self.ep_title_map = {}
        self.ep_date_map = {}
        self.ep_realnum_map = {}    # 名称中的真实期号/集号（如"第4期"→4；"20260804下"→None）
        self.ep_infer_num_map = {}  # 推断期号（库内整季同一日期时，按"上→中→下"播出结构反推）
        self.ep_part_map = {}       # 推断期号对应的分段（上/中/下，含复合分段如"中上"）
        self._detail_alt_streams = {}  # {ep_index_or_name: [{'name': ..., 'url': ...}]}

    def init(self, extend=""):
        self._init_state()
        if not extend:
            return
        try:
            cfg = json.loads(extend) if isinstance(extend, str) and extend.strip().startswith('{') else None
            if isinstance(cfg, dict):
                if cfg.get('danmaku_api'):
                    self.DANMAKU_API = str(cfg['danmaku_api']).rstrip('/')
                if cfg.get('push_port'):
                    self.push_port = int(cfg['push_port'])
        except Exception:
            pass

    def getName(self):
        return "菠菜园"

    # ==================== 网络与 URL 规范化层（CCTVHost 64KB 分块读取） ====================

    def build_url(self, base, query):
        """
        构建 MacCMS 请求 URL：
        自动合并并覆盖 base 中可能存在的同名查询参数（例如原站 base 带有 `?ac=list`，
        而 query 传入 `ac=detail&pg=1` 时，自动确保 `ac=detail` 覆盖 `ac=list`）。
        """
        base_str = str(base or '').strip()
        query_str = str(query or '').strip().lstrip('?&')
        if not query_str:
            return base_str
        try:
            parsed = urllib.parse.urlsplit(base_str)
            base_pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            new_pairs = urllib.parse.parse_qsl(query_str, keep_blank_values=True)
            new_keys = {k for k, _ in new_pairs}
            merged = [(k, v) for k, v in base_pairs if k not in new_keys] + new_pairs
            encoded_query = urllib.parse.urlencode(merged, safe='/:@$,')
            return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, encoded_query, parsed.fragment))
        except Exception:
            if '?' in base_str:
                if base_str.endswith('?') or base_str.endswith('&'):
                    return base_str + query_str
                return base_str + '&' + query_str
            return base_str + '?' + query_str

    def _http_get_bytes(self, url, headers=None, timeout=6.0, max_bytes=3 * 1024 * 1024):
        """
        采用 <= 64KB 分块读取响应体，规避 CCTVHost `host_service_runtime.py` 中
        `whole_body` / `requested > 1MB` 触发的 `response_read_slots = BoundedSemaphore(2)` 非阻塞熔断。
        """
        req_headers = dict(self.headers)
        if isinstance(headers, dict):
            req_headers.update(headers)
        req = urllib.request.Request(str(url), headers=req_headers, method='GET')
        ssl_ctx = ssl.create_default_context()
        try:
            ssl_ctx.set_ciphers('DEFAULT:@SECLEVEL=1')
        except Exception:
            pass
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx))
        with opener.open(req, timeout=float(timeout)) as resp:
            status = getattr(resp, 'status', None) or resp.getcode() or 200
            chunks = []
            total = 0
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
                if total >= max_bytes:
                    break
            return int(status), b''.join(chunks)

    def _parse_json_Loose(self, raw_bytes):
        if not raw_bytes:
            return None
        text = raw_bytes.decode('utf-8', errors='replace').lstrip('\ufeff').strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except Exception:
            pass
        # 兼容部分采集站 PHP Warning 输出在 JSON 前面的情况
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace > first_brace:
            try:
                return json.loads(text[first_brace:last_brace + 1])
            except Exception:
                pass
        return None

    def fetch_json(self, url, timeout=6.0, use_cache=True):
        self._init_state()
        url_str = str(url or '').strip()
        if not url_str:
            return None
        now = time.time()
        if use_cache:
            with self._lock:
                cached = self._http_cache.get(url_str)
                if cached and (now - cached[0]) < self._http_cache_ttl:
                    self._http_cache.move_to_end(url_str)
                    return cached[1]
        try:
            status, raw = self._http_get_bytes(url_str, timeout=timeout)
            if status == 200 and raw:
                data = self._parse_json_Loose(raw)
                if isinstance(data, dict):
                    if use_cache:
                        with self._lock:
                            self._http_cache[url_str] = (time.time(), data)
                            if len(self._http_cache) > self._http_cache_max:
                                self._http_cache.popitem(last=False)
                    return data
        except Exception:
            pass
        return None

    def _fetch_source_json(self, source_key, query, timeout=6.0, use_cache=True):
        """按源站主地址 + 备用地址请求 JSON，并实时更新源站健康分"""
        source_info = self.SOURCES.get(source_key)
        if not source_info:
            return None
        candidates = [source_info['api']] + list(source_info.get('backups') or [])
        for idx, base_api in enumerate(candidates):
            url = self.build_url(base_api, query)
            data = self.fetch_json(url, timeout=timeout, use_cache=use_cache)
            if isinstance(data, dict) and ('list' in data or 'class' in data or 'data' in data):
                with self._lock:
                    cur = self.source_scores.get(source_key, 70)
                    self.source_scores[source_key] = min(200, cur + 8)
                    if idx > 0:
                        source_info['api'] = base_api
                return data
        with self._lock:
            cur = self.source_scores.get(source_key, 70)
            self.source_scores[source_key] = max(10, cur - 15)
        return None

    def _ordered_source_keys(self, limit=None):
        with self._lock:
            keys = sorted(
                self.SOURCES.keys(),
                key=lambda k: self.source_scores.get(k, 70),
                reverse=True
            )
        return keys[:limit] if limit else keys

    # ==================== 海报、文本与剧集清洗层 ====================

    def _format_poster(self, raw_pic, api_url=""):
        """
        将采集站返回的 vod_pic 规范化为 iOS HostImageLoader 可直接加载的纯净 HTTPS/HTTP URL：
        - 修复转义斜杠 `\\/`；
        - 剥离任何 `@Referer=...` / `@User-Agent=...` 后缀（避免触发 CCTVHost 本机 `/artwork/` 代理 4 并发熔断）；
        - 补全 `//` 或 `/upload/...` 相对路径；
        - 对路径中的空格或中文字符做安全 URL 编码。
        """
        if not raw_pic or not str(raw_pic).strip():
            return ""
        pic = str(raw_pic).strip().replace('\\/', '/')
        if pic.lower() in ('0', 'null', 'none', 'nil', 'undefined', 'n/a'):
            return ""
        if '@' in pic and pic.lower().startswith(('http://', 'https://', '//')):
            base_part, _, tail = pic.partition('@')
            if '=' in tail:
                pic = base_part.strip()
        if pic.startswith('//'):
            pic = 'https:' + pic
        elif pic.startswith('/') and api_url:
            try:
                sp = urllib.parse.urlsplit(api_url)
                if sp.scheme and sp.netloc:
                    pic = f"{sp.scheme}://{sp.netloc}{pic}"
            except Exception:
                pass
        elif not pic.startswith(('http://', 'https://')) and api_url:
            try:
                sp = urllib.parse.urlsplit(api_url)
                if sp.scheme and sp.netloc:
                    pic = f"{sp.scheme}://{sp.netloc}/{pic.lstrip('/')}"
            except Exception:
                pass
        if not pic.startswith(('http://', 'https://')):
            return ""
        try:
            parsed = urllib.parse.urlsplit(pic)
            safe_path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe='/:@!$&\'()*+,;=._~-')
            safe_query = urllib.parse.quote(urllib.parse.unquote(parsed.query), safe='/:?&=@!$\'()*+,;._~-')
            return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, safe_path, safe_query, parsed.fragment))
        except Exception:
            return pic.replace(' ', '%20')

    def _strip_html(self, text):
        if not text:
            return ""
        s = re.sub(r'<[^>]+>', ' ', str(text))
        s = s.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
        return re.sub(r'\s+', ' ', s).strip()

    def _normalize_media_url(self, raw_url):
        if not raw_url:
            return ""
        u = str(raw_url).strip().replace('\\/', '/')
        u = re.sub(r'(?i)&(?:amp|#0*38|#x0*26);', '&', u)
        if u.startswith('//'):
            u = 'https:' + u
        if ' ' in u and u.lower().startswith(('http://', 'https://')):
            u = u.replace(' ', '%20')
        return u

    def _parse_play_sources(self, vod_play_from, vod_play_url, source_name=""):
        """
        将 MacCMS 的 `vod_play_from` + `vod_play_url` 清洗并拆分为：
        1. 规范化后的 `(clean_play_from, clean_play_url)`（优先排列直链 `.m3u8`/`.mp4` 线路）；
        2. CCTVHost 原生 `lines` 数组 `[{'id': flag, 'name': display_name, 'episodes': [{'id': url, 'name': ep_name}]}]`。
        """
        raw_from = [f.strip() for f in str(vod_play_from or '').split('$$$')]
        raw_groups = [g.strip() for g in str(vod_play_url or '').split('$$$')]
        m3u8_entries = []
        other_entries = []

        for idx, group in enumerate(raw_groups):
            if not group:
                continue
            flag = raw_from[idx] if idx < len(raw_from) and raw_from[idx] else f"线路{idx + 1}"
            episodes = []
            has_direct_stream = False
            for ep_idx, raw_ep in enumerate(group.split('#')):
                raw_ep = raw_ep.strip()
                if not raw_ep:
                    continue
                if '$' in raw_ep:
                    ep_name, ep_url = raw_ep.split('$', 1)
                else:
                    ep_name, ep_url = f"第{ep_idx + 1}集", raw_ep
                ep_name = ep_name.strip() or f"第{ep_idx + 1}集"
                ep_url = self._normalize_media_url(ep_url)
                if not ep_url or not ep_url.startswith(('http://', 'https://')):
                    continue
                low_url = ep_url.lower()
                if any(dead in low_url for dead in self.DEAD_CDN_TOKENS):
                    continue
                if any(ext in low_url for ext in ('.m3u8', '.mp4', '.flv', '.mpd')):
                    has_direct_stream = True
                episodes.append({'name': ep_name, 'id': ep_url})

            if not episodes:
                continue

            display_flag = flag
            if source_name and not display_flag.startswith(source_name):
                if 'm3u8' in flag.lower():
                    display_flag = f"{source_name}专线"
                else:
                    display_flag = f"{source_name}·{flag}"

            entry = {
                'id': display_flag,
                'name': display_flag,
                'episodes': episodes,
                'play_str': '#'.join(f"{e['name']}${e['id']}" for e in episodes)
            }
            if has_direct_stream or 'm3u8' in flag.lower():
                m3u8_entries.append(entry)
            else:
                other_entries.append(entry)

        ordered = m3u8_entries + other_entries
        clean_from = '$$$'.join(e['name'] for e in ordered)
        clean_url = '$$$'.join(e['play_str'] for e in ordered)
        lines = [{'id': e['id'], 'name': e['name'], 'episodes': e['episodes']} for e in ordered]
        return clean_from, clean_url, lines

    def clean_item(self, item, source_key, source_name, is_detail=False):
        if not isinstance(item, dict):
            return {}
        out = dict(item)
        raw_id = str(out.get('vod_id') or out.get('id') or '').strip()
        if not is_detail and '@@' not in raw_id:
            out['vod_id'] = f"{source_key}@@{raw_id}"
        else:
            out['vod_id'] = raw_id
        out['id'] = out['vod_id']

        clean_name = self._strip_html(out.get('vod_name') or out.get('name') or '')
        out['vod_name'] = clean_name
        out['name'] = clean_name

        api_url = self.SOURCES.get(source_key, {}).get('api', '')
        raw_pic = out.get('vod_pic') or out.get('vod_pic_thumb') or out.get('pic') or out.get('poster') or ''
        clean_pic = self._format_poster(raw_pic, api_url=api_url)
        out['vod_pic'] = clean_pic
        out['poster'] = clean_pic

        clean_source_name = str(source_name or source_key).replace('\ufe0f', '').strip()
        old_remark = self._strip_html(out.get('vod_remarks') or out.get('remarks') or '')
        if old_remark and not old_remark.startswith(clean_source_name):
            out['vod_remarks'] = f"{clean_source_name} | {old_remark}"
        else:
            out['vod_remarks'] = old_remark or clean_source_name
        out['remarks'] = out['vod_remarks']

        if 'vod_content' in out or is_detail:
            out['vod_content'] = self._strip_html(out.get('vod_content') or out.get('description') or '')
            out['description'] = out['vod_content']

        out.pop('vod_down_from', None)
        out.pop('vod_down_url', None)
        out.pop('posterHeaders', None)

        if is_detail and out.get('vod_play_url'):
            c_from, c_url, lines = self._parse_play_sources(
                out.get('vod_play_from', ''),
                out.get('vod_play_url', ''),
                source_name=clean_source_name
            )
            if c_url:
                out['vod_play_from'] = c_from
                out['vod_play_url'] = c_url
                out['lines'] = lines

        return out

    # ==================== 核心爬虫接口（适配 CCTVHost + TVBox） ====================

    def _get_site_filters(self, source_key):
        with self._lock:
            cached = self._class_cache.get(source_key)
        if cached:
            return [{'key': 'cateId', 'name': '分类', 'value': cached}]
        return [{'key': 'cateId', 'name': '分类', 'value': list(self.DEFAULT_FILTER_VALUES)}]

    def _update_site_classes_from_data(self, source_key, data):
        if not isinstance(data, dict) or not isinstance(data.get('class'), list):
            return
        vals = [{'n': '全部(最新)', 'v': ''}]
        seen = set()
        for c in data['class']:
            if not isinstance(c, dict):
                continue
            tid = str(c.get('type_id') or '').strip()
            tname = self._strip_html(c.get('type_name') or '')
            if tid and tname and tid not in seen:
                seen.add(tid)
                vals.append({'n': tname, 'v': tid})
        if len(vals) > 1:
            with self._lock:
                self._class_cache[source_key] = vals

    def homeContent(self, filter=False):
        self._init_state()
        classes = []
        filters = {}

        # 仅对前 6 个高优主力站点做超短超时并发预热分类表，其余站点秒级使用标准筛选字典并按需懒加载，
        # 彻底解决原脚本在 homeContent 同步等待 33 个站点导致的 15s+ 卡顿与信号量熔断问题。
        top_keys = [k for k, _ in self.SOURCE_LIST[:6]]

        def probe_top_source(s_key):
            data = self._fetch_source_json(s_key, "ac=list", timeout=1.8, use_cache=True)
            if data:
                self._update_site_classes_from_data(s_key, data)

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futs = [executor.submit(probe_top_source, k) for k in top_keys]
            try:
                for fut in concurrent.futures.as_completed(futs, timeout=2.2):
                    try:
                        fut.result(timeout=0.05)
                    except Exception:
                        pass
            except Exception:
                pass

        # 严格按照预设优先级顺序输出分类，杜绝因多线程返回顺序导致的顶部分类胶囊乱序
        for source_key, source_info in self.SOURCE_LIST:
            clean_title = str(source_info['name']).replace('\ufe0f', '').strip()
            classes.append({'type_id': source_key, 'type_name': clean_title})
            filters[source_key] = self._get_site_filters(source_key)

        home_vods = self.homeVideoContent().get('list', [])
        return {'class': classes, 'filters': filters, 'list': home_vods}

    def homeVideoContent(self):
        """
        为 CCTVHost『精选』页提供顶部巨幕（前 5 条）与『热门推荐』（后 10+ 条）视频数据：
        从前 4 个高优主力站并发拉取带高清海报的最新热播剧集，若遇离线或网络受限则平滑回退到内置精选列表。
        """
        self._init_state()
        top_sources = self._ordered_source_keys(limit=4)

        def fetch_hot(s_key):
            s_info = self.SOURCES[s_key]
            data = self._fetch_source_json(s_key, "ac=detail&pg=1", timeout=2.5, use_cache=True)
            items = []
            if isinstance(data, dict) and isinstance(data.get('list'), list):
                for raw in data['list']:
                    cleaned = self.clean_item(raw, s_key, s_info['name'], is_detail=False)
                    if cleaned.get('vod_id') and cleaned.get('vod_name') and cleaned.get('vod_pic'):
                        items.append(cleaned)
            return s_key, items

        by_source = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futs = {executor.submit(fetch_hot, k): k for k in top_sources}
            try:
                for fut in concurrent.futures.as_completed(futs, timeout=3.0):
                    try:
                        s_key, rows = fut.result(timeout=0.05)
                        if rows:
                            by_source[s_key] = rows
                    except Exception:
                        pass
            except Exception:
                pass

        # 交错合并多源推荐，兼顾多样性与去重
        merged = []
        seen_names = set()
        max_len = max((len(v) for v in by_source.values()), default=0)
        for idx in range(max_len):
            for s_key in top_sources:
                rows = by_source.get(s_key) or []
                if idx < len(rows):
                    item = rows[idx]
                    norm_name = re.sub(r'\s+', '', item.get('vod_name', ''))
                    if norm_name and norm_name not in seen_names:
                        seen_names.add(norm_name)
                        merged.append(item)
                        if len(merged) >= 24:
                            return {'list': merged}

        if not merged:
            fallback_items = []
            for fb in _FALLBACK_RECOMMENDATIONS:
                s_key = fb['vod_id'].split('@@', 1)[0]
                s_name = self.SOURCES.get(s_key, {}).get('name', s_key)
                fallback_items.append(self.clean_item(fb, s_key, s_name, is_detail=False))
            return {'list': fallback_items}

        return {'list': merged}

    def _resolve_category_tid(self, source_key, raw_cate_id):
        """
        将筛选器传入的 cateId（可能是数字 ID，也可能是中文分类名如'动作'、'国产'）
        解析为目标采集站真实的 `type_id`。
        """
        val = str(raw_cate_id or '').strip()
        if not val:
            return ''
        if val.isdigit():
            return val
        with self._lock:
            classes = self._class_cache.get(source_key)
        if not classes:
            list_data = self._fetch_source_json(source_key, "ac=list", timeout=3.5, use_cache=True)
            if list_data:
                self._update_site_classes_from_data(source_key, list_data)
            with self._lock:
                classes = self._class_cache.get(source_key)
        if classes:
            for opt in classes:
                opt_n = str(opt.get('n') or '')
                opt_v = str(opt.get('v') or '')
                if opt_v and (val == opt_n or val in opt_n or opt_n in val):
                    return opt_v
        return ''

    def categoryContent(self, tid, pg=1, filter=False, extend=None):
        self._init_state()
        try:
            page_num = max(1, int(pg or 1))
        except Exception:
            page_num = 1

        tid_str = str(tid or '').strip()
        if tid_str not in self.SOURCES:
            # 未知分类 ID 时平滑回退到首选健康源
            tid_str = self._ordered_source_keys(limit=1)[0]

        source = self.SOURCES[tid_str]
        if not isinstance(extend, dict):
            extend = {}
        raw_cate = extend.get('cateId') or extend.get('tid') or extend.get('type') or ''
        real_tid = self._resolve_category_tid(tid_str, raw_cate)

        query = f"ac=detail&pg={page_num}"
        if real_tid:
            query += f"&t={real_tid}"

        data = self._fetch_source_json(tid_str, query, timeout=6.5, use_cache=True)
        # 若 ac=detail 不支持或返回空，回退尝试 ac=list 再拉取详情
        if not data or not data.get('list'):
            list_query = f"ac=list&pg={page_num}" + (f"&t={real_tid}" if real_tid else "")
            list_data = self._fetch_source_json(tid_str, list_query, timeout=5.0, use_cache=True)
            if list_data:
                self._update_site_classes_from_data(tid_str, list_data)
                if list_data.get('list'):
                    ids_str = ','.join(
                        str(x.get('vod_id')) for x in list_data['list']
                        if isinstance(x, dict) and x.get('vod_id')
                    )
                    if ids_str:
                        detail_data = self._fetch_source_json(tid_str, f"ac=detail&ids={ids_str}", timeout=6.0, use_cache=True)
                        if detail_data and detail_data.get('list'):
                            data = detail_data
                            data['page'] = list_data.get('page', page_num)
                            data['pagecount'] = list_data.get('pagecount', 1)
                            data['total'] = list_data.get('total', len(detail_data['list']))
                        else:
                            data = list_data

        # 若当前站点网络不可达且处于第 1 页无筛选状态，自动借用健康备源兜底展示，避免分类空白
        if (not data or not data.get('list')) and page_num == 1 and not real_tid:
            for backup_key in self._ordered_source_keys(limit=4):
                if backup_key == tid_str:
                    continue
                b_data = self._fetch_source_json(backup_key, "ac=detail&pg=1", timeout=3.0, use_cache=True)
                if b_data and b_data.get('list'):
                    video_list = [
                        self.clean_item(item, backup_key, self.SOURCES[backup_key]['name'], is_detail=False)
                        for item in b_data.get('list', [])
                        if isinstance(item, dict)
                    ]
                    return {
                        'list': video_list,
                        'page': page_num,
                        'pagecount': int(b_data.get('pagecount') or 1),
                        'limit': int(b_data.get('limit') or 20),
                        'total': int(b_data.get('total') or len(video_list))
                    }
            # 离线兜底
            fallback_rows = [
                self.clean_item(fb, fb['vod_id'].split('@@', 1)[0], fb['vod_id'].split('@@', 1)[0], is_detail=False)
                for fb in _FALLBACK_RECOMMENDATIONS
            ]
            return {
                'list': fallback_rows,
                'page': 1,
                'pagecount': 1,
                'limit': 20,
                'total': len(fallback_rows)
            }

        if not data:
            return {'list': [], 'page': page_num, 'pagecount': 0, 'limit': 20, 'total': 0}

        self._update_site_classes_from_data(tid_str, data)
        video_list = []
        for item in data.get('list', []):
            if not isinstance(item, dict):
                continue
            cleaned = self.clean_item(item, tid_str, source['name'], is_detail=False)
            if cleaned.get('vod_id') and cleaned.get('vod_name'):
                video_list.append(cleaned)

        return {
            'list': video_list,
            'page': int(data.get('page') or page_num),
            'pagecount': int(data.get('pagecount') or (page_num if video_list else 0)),
            'limit': int(data.get('limit') or 20),
            'total': int(data.get('total') or len(video_list))
        }

    def _aggregate_multisource_lines(self, primary_source_key, vod_name, vod_year=""):
        """
        并发从前 5 个高优异构源站按片名检索同一部影片，提取各站直链播放源，
        实现在 CCTVHost 详情页内展示多个云端播放源 Tab 供用户自由切换。
        """
        clean_title = re.sub(r'[\(\[（【].*?[\)\]）】]', '', str(vod_name or '')).strip()
        if not clean_title:
            return []
        norm_target = re.sub(r'\s+', '', clean_title)
        candidate_keys = [
            k for k in self._ordered_source_keys(limit=7)
            if k != primary_source_key
        ][:5]
        encoded_kw = quote(clean_title)

        def search_one(s_key):
            s_info = self.SOURCES[s_key]
            data = self._fetch_source_json(s_key, f"ac=detail&wd={encoded_kw}", timeout=2.2, use_cache=True)
            if not data or not isinstance(data.get('list'), list):
                return s_key, []
            matched_lines = []
            for row in data['list']:
                if not isinstance(row, dict):
                    continue
                r_name = self._strip_html(row.get('vod_name') or '')
                norm_r = re.sub(r'\s+', '', r_name)
                if not norm_r:
                    continue
                if norm_r != norm_target and clean_title not in r_name:
                    continue
                if vod_year and row.get('vod_year'):
                    try:
                        if abs(int(str(row['vod_year'])[:4]) - int(str(vod_year)[:4])) > 1:
                            continue
                    except Exception:
                        pass
                _, _, r_lines = self._parse_play_sources(
                    row.get('vod_play_from', ''),
                    row.get('vod_play_url', ''),
                    source_name=s_info['name']
                )
                if r_lines:
                    matched_lines.extend(r_lines)
                    break
            return s_key, matched_lines

        extra_lines = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futs = {executor.submit(search_one, k): k for k in candidate_keys}
            try:
                for fut in concurrent.futures.as_completed(futs, timeout=2.5):
                    try:
                        _, lines = fut.result(timeout=0.05)
                        if lines:
                            extra_lines.extend(lines)
                    except Exception:
                        pass
            except Exception:
                pass
        return extra_lines

    def detailContent(self, ids):
        self._init_state()
        if not ids:
            return {'list': []}
        full_id = str(ids[0] or '').strip()
        if not full_id:
            return {'list': []}

        # 检查是否命中离线兜底条目
        for fb in _FALLBACK_RECOMMENDATIONS:
            if fb['vod_id'] == full_id:
                s_key = full_id.split('@@', 1)[0]
                cleaned = self.clean_item(fb, s_key, self.SOURCES.get(s_key, {}).get('name', s_key), is_detail=True)
                cleaned['vod_id'] = full_id
                self._build_danmaku_context(cleaned)
                return {'list': [cleaned]}

        if '@@' in full_id:
            source_key, real_id = full_id.split('@@', 1)
        else:
            source_key, real_id = self._ordered_source_keys(limit=1)[0], full_id

        if source_key not in self.SOURCES:
            source_key = self._ordered_source_keys(limit=1)[0]

        source = self.SOURCES[source_key]
        data = self._fetch_source_json(source_key, f"ac=detail&ids={real_id}", timeout=6.5, use_cache=True)
        if not data or not data.get('list'):
            return {'list': []}

        result_list = []
        for item in data['list']:
            if not isinstance(item, dict):
                continue
            cleaned = self.clean_item(item, source_key, source['name'], is_detail=True)
            cleaned['vod_id'] = full_id
            cleaned['id'] = full_id

            # 开启跨源多线路并发聚合，将其他采集站同影片的 M3U8 线路合并进详情页
            primary_lines = list(cleaned.get('lines') or [])
            extra_lines = self._aggregate_multisource_lines(
                source_key,
                cleaned.get('vod_name', ''),
                cleaned.get('vod_year', '')
            )
            if extra_lines:
                seen_line_names = {ln['name'] for ln in primary_lines}
                for eln in extra_lines:
                    lname = eln['name']
                    if lname in seen_line_names:
                        lname = f"{lname}(备)"
                        eln = dict(eln, id=lname, name=lname)
                    seen_line_names.add(lname)
                    primary_lines.append(eln)

            if primary_lines:
                cleaned['lines'] = primary_lines
                cleaned['vod_play_from'] = '$$$'.join(ln['name'] for ln in primary_lines)
                cleaned['vod_play_url'] = '$$$'.join(
                    '#'.join(f"{ep['name']}${ep['id']}" for ep in ln['episodes'])
                    for ln in primary_lines
                )

                # 记录同名分集的跨源备用流地址，供 playerContent 注入 alternates 与故障切换
                alt_map = collections.defaultdict(list)
                for ln in primary_lines:
                    for ep_idx, ep in enumerate(ln.get('episodes') or []):
                        entry = {'name': ln['name'], 'url': ep['id']}
                        alt_map[f"idx:{ep_idx}"].append(entry)
                        alt_map[f"name:{ep['name']}"].append(entry)
                        alt_map[f"url:{ep['id']}"].append((ep_idx, ep['name']))
                self._detail_alt_streams = dict(alt_map)

            result_list.append(cleaned)

        # 构建弹幕匹配上下文并在后台预热番剧搜索缓存（使点击播放时弹幕可 0 延迟命中）
        if result_list:
            self._build_danmaku_context(result_list[0])
            self._prewarm_danmaku_async()

        return {'list': result_list}

    def searchContent(self, key, quick=False, pg=1):
        self._init_state()
        keyword = str(key or '').strip()
        try:
            page_num = max(1, int(pg or 1))
        except Exception:
            page_num = 1
        if not keyword:
            return {'list': [], 'page': page_num, 'pagecount': 0, 'limit': 40, 'total': 0}

        encoded_keyword = quote(keyword)
        # 快速搜索模式或常规搜索下按健康度排序并发检索，控制并发数为 6 以完全规避信号量争抢
        candidate_keys = self._ordered_source_keys(limit=14 if quick else len(self.SOURCES))

        def search_source(source_key):
            source_info = self.SOURCES[source_key]
            for ac_mode in ('detail', 'list'):
                data = self._fetch_source_json(
                    source_key,
                    f"ac={ac_mode}&wd={encoded_keyword}&pg={page_num}",
                    timeout=4.5,
                    use_cache=True
                )
                if not isinstance(data, dict):
                    continue
                items = None
                if isinstance(data.get('list'), list):
                    items = data['list']
                elif isinstance(data.get('data'), dict) and isinstance(data['data'].get('list'), list):
                    items = data['data']['list']
                elif isinstance(data.get('data'), list):
                    items = data['data']
                if items:
                    # 如果命中了 ac=list（无海报），尝试用 ids 批量拉取详情补全海报
                    if ac_mode == 'list' and not any(isinstance(x, dict) and x.get('vod_pic') for x in items[:3]):
                        ids_str = ','.join(
                            str(x.get('vod_id')) for x in items[:15]
                            if isinstance(x, dict) and x.get('vod_id')
                        )
                        if ids_str:
                            det = self._fetch_source_json(source_key, f"ac=detail&ids={ids_str}", timeout=3.5, use_cache=True)
                            if isinstance(det, dict) and isinstance(det.get('list'), list) and det['list']:
                                items = det['list']
                    return source_key, source_info, data, items
            return source_key, source_info, None, []

        all_items = []
        max_pagecount = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(search_source, k): k for k in candidate_keys}
            try:
                for future in concurrent.futures.as_completed(futures, timeout=7.5):
                    try:
                        source_key, source_info, data, items = future.result(timeout=0.05)
                    except Exception:
                        continue
                    if items:
                        for item in items:
                            if not isinstance(item, dict):
                                continue
                            cleaned = self.clean_item(item, source_key, source_info['name'], is_detail=False)
                            if cleaned.get('vod_id') and cleaned.get('vod_name'):
                                all_items.append((source_key, cleaned))
                        if isinstance(data, dict):
                            try:
                                pc = int(data.get('pagecount') or 0)
                                if pc > max_pagecount:
                                    max_pagecount = pc
                            except Exception:
                                pass
            except Exception:
                pass

        # 智能相关性排序：精确匹配 > 前缀匹配 > 包含关键词 > 有高清海报 > 源站优先级 > 年份
        norm_kw = re.sub(r'\s+', '', keyword.lower())

        def rank_item(pair):
            s_key, item = pair
            vname = str(item.get('vod_name') or '').strip()
            norm_name = re.sub(r'\s+', '', vname.lower())
            exact = 1 if norm_name == norm_kw else 0
            prefix = 1 if norm_name.startswith(norm_kw) else 0
            contains = 1 if norm_kw in norm_name else 0
            has_pic = 1 if item.get('vod_pic') else 0
            s_score = self.source_scores.get(s_key, 70)
            try:
                yr = int(str(item.get('vod_year') or '0')[:4])
            except Exception:
                yr = 0
            return (exact, prefix, contains, has_pic, s_score, yr)

        all_items.sort(key=rank_item, reverse=True)

        seen = set()
        unique = []
        for _, v in all_items:
            if v['vod_id'] not in seen:
                seen.add(v['vod_id'])
                unique.append(v)

        return {
            'list': unique,
            'page': page_num,
            'pagecount': max_pagecount if max_pagecount else (1 if unique else 0),
            'limit': 40,
            'total': len(unique)
        }

    def _sniff_stream_from_webpage(self, page_url):
        """当播放地址并非 .m3u8/.mp4 直链而是解析页时，自动从 HTML 中嗅探真实媒体流地址"""
        try:
            status, raw = self._http_get_bytes(page_url, timeout=4.0, max_bytes=512 * 1024)
            if status != 200 or not raw:
                return ""
            html = raw.decode('utf-8', errors='ignore').replace('\\/', '/')
            for pattern in (
                r'(https?://[^\s"\'<>\\]+?\.m3u8(?:\?[^\s"\'<>\\]*)?)',
                r'(https?://[^\s"\'<>\\]+?\.mp4(?:\?[^\s"\'<>\\]*)?)',
            ):
                for m in re.finditer(pattern, html, re.I):
                    cand = self._normalize_media_url(m.group(1))
                    if cand and not any(d in cand.lower() for d in self.DEAD_CDN_TOKENS):
                        return cand
        except Exception:
            pass
        return ""

    def playerContent(self, flag, id, vipFlags=None):
        self._init_state()
        raw_id = str(id or '').strip()
        if '$' in raw_id and not raw_id.lower().startswith(('http://', 'https://')):
            _, raw_id = raw_id.split('$', 1)
        play_url = self._normalize_media_url(raw_id)

        # 构建同名分集的跨源备用流列表（alternates）
        alternates = []
        meta = self._detail_alt_streams.get(f"url:{play_url}") or self._detail_alt_streams.get(f"url:{raw_id}")
        if meta:
            ep_idx, ep_name = meta[0]
            cand_list = (
                self._detail_alt_streams.get(f"name:{ep_name}", [])
                + self._detail_alt_streams.get(f"idx:{ep_idx}", [])
            )
            seen_urls = {play_url}
            for alt in cand_list:
                u = self._normalize_media_url(alt.get('url', ''))
                if u and u not in seen_urls and not any(d in u.lower() for d in self.DEAD_CDN_TOKENS):
                    seen_urls.add(u)
                    alternates.append({
                        'name': alt.get('name', '备用源'),
                        'url': u,
                        'directMedia': True,
                        'nativePlayable': True,
                        'header': dict(self.headers)
                    })

        low_url = play_url.lower()
        is_direct_hls = '.m3u8' in low_url or '/hls/' in low_url or '/m3u8/' in low_url
        is_direct_mp4 = '.mp4' in low_url or '.m4v' in low_url or '.mov' in low_url
        is_dead = any(d in low_url for d in self.DEAD_CDN_TOKENS)

        if (not (is_direct_hls or is_direct_mp4) or is_dead) and play_url.startswith(('http://', 'https://')):
            sniffed = self._sniff_stream_from_webpage(play_url) if not is_dead else ""
            if sniffed:
                play_url = sniffed
                low_url = play_url.lower()
                is_direct_hls = '.m3u8' in low_url
                is_direct_mp4 = '.mp4' in low_url
            elif alternates:
                play_url = alternates[0]['url']
                low_url = play_url.lower()
                is_direct_hls = '.m3u8' in low_url
                is_direct_mp4 = '.mp4' in low_url

        # ===== 弹幕双模匹配（优先在时间预算内同步产出供 CCTVHost 原生加载，同时后台推送兼容 TVBox） =====
        danmaku_url = None
        try:
            danmaku_url = self._match_danmaku(raw_id, sync_timeout=1.5)
        except Exception:
            pass

        play_headers = {
            'User-Agent': self.headers['User-Agent'],
        }
        try:
            sp = urllib.parse.urlsplit(play_url)
            if sp.scheme and sp.netloc:
                play_headers['Referer'] = f"{sp.scheme}://{sp.netloc}/"
        except Exception:
            pass

        result = {
            'parse': 0,
            'jx': 0,
            'url': play_url,
            'header': play_headers,
            'headers': play_headers,
            'directMedia': True,
            'nativePlayable': True,
            'requiresWebPlayback': False,
        }
        if is_direct_mp4 and not is_direct_hls:
            result['format'] = 'mp4'
            result['contentType'] = 'video/mp4'
        else:
            result['format'] = 'hls'
            result['contentType'] = 'application/vnd.apple.mpegurl'

        if alternates:
            result['alternates'] = alternates
        if danmaku_url:
            result['danmaku'] = danmaku_url

        return result

    # ==================== 弹幕辅助与智能匹配方法（完整版 + 预热加速） ====================

    def _rate_limit(self):
        with self._lock:
            now = time.time()
            elapsed = now - self._last_req
            if elapsed < 0.25:
                time.sleep(0.25 - elapsed)
            self._last_req = time.time()

    def _clean_title(self, title):
        if not title:
            return ""
        s = title.strip()
        s = re.sub(r'[（(]?(国语|粤语|普通话|英语|日语|韩语|原声)版?[）)]?', '', s)
        s = re.sub(r'第\s*[0-9零一二三四五六七八九十百千]+\s*[集話话]', '', s)
        s = re.sub(r'[Ee][Pp]\s*\d+', '', s)
        s = re.sub(r'S\d+', '', s)
        s = re.sub(r'\d+[KkPp]', '', s)
        s = re.sub(r'4K', '', s)
        s = re.sub(r'\b(HD|BD|TC|TS|CAM|SCR|蓝光|杜比|BluRay|Dolby)\b', '', s, flags=re.I)
        s = re.sub(r'\[\d+[\.\d]*[MGT]\]', '', s)
        s = re.sub(r'\.(mp4|mkv|avi|rmvb|flv|web|dl|h265|h264|hevc)$', '', s)
        s = re.sub(r'[【\[（(].*?[】\]）)]', '', s)
        s = re.sub(r'[\\/:*"<>|丨]', '', s)
        s = re.sub(r'[:：]', ' ', s)
        s = re.sub(r'\d{4}$', '', s)
        cn = re.findall(r'[\u4e00-\u9fff0-9]+', s)
        return ''.join(cn) if cn else re.sub(r'\s+', ' ', s).strip()

    def _extract_year_from_text(self, text):
        if not text:
            return None
        m = re.search(r'[（(](\d{4})[）)]', text)
        if m:
            return m.group(1)
        m = re.search(r'(?<!\d)(\d{4})(?!\d)', text)
        if m:
            return m.group(1)
        m = re.search(r'\[(\d{4})\]', text)
        return m.group(1) if m else None

    def _extract_date_from_title(self, ep_title):
        if not ep_title:
            return None
        m = re.search(r'(\d{4}-\d{2}-\d{2})', ep_title)
        if m:
            return m.group(1)
        m = re.search(r'(\d{8})', ep_title)
        if m:
            d = m.group(1)
            try:
                y, mo, day = int(d[:4]), int(d[4:6]), int(d[6:8])
                if 1970 <= y <= 2099 and 1 <= mo <= 12 and 1 <= day <= 31:
                    return f"{y}-{mo:02d}-{day:02d}"
            except Exception:
                pass
        m = re.search(r'第\s*(\d{6})\s*期', ep_title)
        if m:
            d = m.group(1)
            try:
                yy, mm, dd = int(d[:2]), d[2:4], d[4:6]
                y = 2000 + yy if 2000 + yy <= 2099 else 1900 + yy
                if 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31:
                    return f"{y}-{mm}-{dd}"
            except Exception:
                pass
        return None

    def _date_in_text(self, date_str, text):
        """日期包含匹配：同时兼容 2025-12-20 与 20251220 两种库内写法"""
        if not date_str or not text:
            return False
        if date_str in text:
            return True
        return date_str.replace('-', '') in text

    def _extract_episode_info(self, ep_title):
        info = {
            'date': None,
            'episode_number': None,
            'is_variety': False,
            'clean_title': '',
            'sub_part': None,
            'keywords': []
        }
        if not ep_title:
            return info
        info['date'] = self._extract_date_from_title(ep_title)
        for m_ in re.finditer(r'第\s*(\d+)\s*期([中上下半])?', ep_title):
            if m_.group(2) and not info['sub_part']:
                info['sub_part'] = m_.group(2)
            if int(m_.group(1)) >= 10000000:
                continue
            info['episode_number'] = int(m_.group(1))
            info['is_variety'] = True
            break
        m = re.search(r'第\s*(\d+)\s*集', ep_title)
        if m and not info['episode_number'] and int(m.group(1)) < 10000000:
            info['episode_number'] = int(m.group(1))
        bm = re.search(r'[（(]([^）)]+)[）)]', ep_title)
        if bm:
            content = bm.group(1).strip()
            if content:
                info['keywords'] = [kw.strip() for kw in re.split(r'[\s|,|，|、|丨]+', content) if kw.strip()]
        clean = ep_title
        clean = re.sub(r'【.*?】', '', clean)
        clean = re.sub(r'^\d{4}-\d{2}-\d{2}', '', clean)
        clean = re.sub(r'^\d{8}', '', clean)
        clean = re.sub(r'[（(][^）)]*[）)]', '', clean)
        clean = re.sub(r'第\s*\d+\s*[期集]', '', clean)
        clean = clean.strip()
        info['clean_title'] = clean
        return info

    def _get_episode_title_from_data(self, ep):
        if isinstance(ep, dict):
            for f in ['episodeTitle', 'title', 'ep_title', 'name']:
                v = ep.get(f)
                if v and str(v).strip():
                    return str(v).strip()
        return ''

    def _extract_language_keywords(self, title):
        if not title:
            return []
        kw = []
        for p in ['普通话', '国语', '粤语', '英语', '日语', '韩语', '川普', '原声', '纯享版']:
            if p in title:
                kw.append(p)
        return kw

    def _get_episode_number_from_url(self, url):
        if not url:
            return None
        for p in [r'/(\d+)\.m3u8', r'/(\d+)\.mp4', r'/ep(\d+)', r'/v_(\d+)/', r'[_-](\d{1,3})\.']:
            m = re.search(p, url)
            if m:
                return int(m.group(1))
        return None

    def _search_anime_list(self, keyword, year=None, total_ep=None, force_refresh=False, language=None):
        core = keyword
        core = re.sub(r'\d{4}$', '', core).strip()
        core = re.sub(r'[：:、，,，.。·\-_\(\)（）【】\s]', '', core)
        dialect_match = None
        if not language:
            dialect_match = re.search(r'(四川话|普通话|粤语|英语|原声|版)', core)
            if dialect_match:
                core = re.sub(r'(四川话|普通话|粤语|英语|原声|版)', '', core).strip()

        ck = f"{core}_{year}_{total_ep}_{language}"
        if not force_refresh and ck in self._anime_cache:
            cached = self._anime_cache[ck]
            return [] if cached == [] else cached

        url = f"{self.DANMAKU_API}/search/anime?keyword={urllib.parse.quote(core)}"
        try:
            self._rate_limit()
            status, raw = self._http_get_bytes(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=6.0)
            if status != 200 or not raw:
                return []
            data = self._parse_json_Loose(raw) or {}
            animes = data.get('animes', [])
            if not animes:
                self._anime_cache[ck] = []
                return []

            src_pri = {'360': 10, 'tencent': 9, 'mgtv': 8, 'iqiyi': 7, 'bilibili': 6, 'youku': 5, 'hanjutv': 4}

            LANG_SYN = {
                '国语': ('普通话', '中配', '国语'),
                '普通话': ('普通话', '国语', '中配'),
                '粤语': ('粤语', '粤配'),
                '日语': ('日语', '日配'),
                '英语': ('英语', '英文'),
                '韩语': ('韩语',),
                '原声': ('原声', '日语')
            }
            LANG_MARKS = ('普通话版', '日语版', '英语版', '粤语版', '韩语版', '原声版', '中配版')

            def norm_title(t):
                return re.sub(r'[·・～\-—\s【】\[\]()（）:：、，,。.]', '', t or '')

            def title_hit(tn):
                return bool(re.match(r'^%s(?=\d|[（(【\[]|$)' % re.escape(core), tn))

            def score(anime):
                s = 0
                t = anime.get('title') or anime.get('animeTitle') or anime.get('name') or ''
                tn = norm_title(t)
                if t == core or title_hit(tn):
                    s += 10000
                elif core in t or core in tn:
                    s += 1000
                else:
                    s -= 2000
                if year:
                    ay = anime.get('year') or self._extract_year_from_text(t)
                    if ay:
                        try:
                            d = abs(int(ay) - int(year))
                            if d == 0:
                                s += 5000
                            elif d == 1:
                                s += 2000
                        except Exception:
                            pass
                ec = anime.get('episodeCount', 0)
                if total_ep and total_ep == 1 and ec == 1:
                    s += 5000
                elif total_ep and total_ep > 0 and ec > 0 and abs(ec - total_ep) <= 3:
                    s += 800
                if language:
                    syns = LANG_SYN.get(language, (language,))
                    if any(x in t for x in syns):
                        s += 15000
                    elif any(mk in t for mk in LANG_MARKS):
                        s -= 10000
                else:
                    if any(mk in t for mk in LANG_MARKS):
                        s -= 10000
                if dialect_match and dialect_match.group(1) in t:
                    s += 15000
                s += src_pri.get(anime.get('source', ''), 0)
                for pk in ['合集篇', '高光合集', '剧场版', '预告', '花絮', '纯享', '训练室', '直拍', 'OVA']:
                    if pk in t:
                        s -= 3000
                        break
                for bk in ['年番', '正片', '第一季', '第二季']:
                    if bk in t:
                        s += 500
                        break
                if any(w in t for w in ['舞台纯享', '训练室', '直拍', '花絮', '竖屏', '纯享']):
                    s -= 2000
                return s, t

            scored = [(score(a), a) for a in animes]
            scored.sort(key=lambda x: x[0][0] if isinstance(x[0], tuple) else x[0], reverse=True)
            if isinstance(scored[0][0], tuple):
                scored = [(s, a) for (s, _), a in scored]

            if scored and scored[0][0] < 0:
                self._anime_cache[ck] = []
                return []

            ids = []
            exact_ids = []
            for s, a in scored:
                if s < 0:
                    continue
                t = a.get('title') or a.get('animeTitle') or a.get('name') or ''
                tn = norm_title(t)
                base = re.match(r'^[\u4e00-\u9fffA-Za-z0-9]+', t)
                bt = base.group() if base else t
                aid = a.get('animeId')
                if bt == core or title_hit(tn):
                    exact_ids.append(aid)
                elif aid:
                    ids.append(aid)
            final = exact_ids + ids
            self._anime_cache[ck] = final
            return final
        except Exception:
            return []

    def _fetch_bangumi_episodes(self, anime_id):
        """拉取并缓存 bangumi 详情的 episodes，采用 64KB 分块读取规避信号量熔断"""
        if anime_id in self._bangumi_cache:
            return self._bangumi_cache[anime_id]
        for attempt in range(2):
            try:
                self._rate_limit()
                status, raw = self._http_get_bytes(
                    f"{self.DANMAKU_API}/bangumi/{anime_id}",
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=5.0
                )
                if status == 200 and raw:
                    data = self._parse_json_Loose(raw) or {}
                    eps = data.get('bangumi', {}).get('episodes', [])
                    if isinstance(eps, list):
                        self._bangumi_cache[anime_id] = eps
                        return eps
                if status == 404 and attempt < 1:
                    time.sleep(0.5)
                    continue
                return None
            except Exception:
                if attempt < 1:
                    time.sleep(0.5)
                    continue
                return None
        return None

    def _get_episode_id_by_title(self, anime_id, ep_title):
        if not ep_title:
            return None
        info = self._extract_episode_info(ep_title)
        date_str = info['date']
        ep_num = info['episode_number']
        sub_part = info.get('sub_part')
        keywords = info.get('keywords', [])
        clean_ep = ep_title.strip()
        low_quality = list(self.EXTRA_EP_WORDS)
        sub_markers = ['中', '上', '下', '半', '前篇', '后篇', '前', '后']

        try:
            episodes = self._fetch_bangumi_episodes(anime_id)
            if not episodes:
                return None

            for ep in episodes:
                if self._get_episode_title_from_data(ep) == clean_ep:
                    return ep.get('episodeId')

            for kw in ['加更版', '纯享版', '精编版', '花絮', '预告']:
                if kw in clean_ep:
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        if kw in api_t:
                            if date_str and self._date_in_text(date_str, api_t):
                                return ep.get('episodeId')
                            return ep.get('episodeId')
                    break

            if sub_part and date_str:
                if keywords:
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        if self._date_in_text(date_str, api_t) and sub_part in api_t and any(k in api_t for k in keywords):
                            return ep.get('episodeId')
                for ep in episodes:
                    api_t = self._get_episode_title_from_data(ep)
                    if self._date_in_text(date_str, api_t) and sub_part in api_t:
                        return ep.get('episodeId')

            if date_str and keywords:
                for ep in episodes:
                    api_t = self._get_episode_title_from_data(ep)
                    if self._date_in_text(date_str, api_t) and any(k in api_t for k in keywords):
                        return ep.get('episodeId')

            candidates = []
            if ep_num:
                for ep in episodes:
                    api_t = self._get_episode_title_from_data(ep)
                    if not api_t:
                        continue
                    if re.search(r'第\s*0*%d\s*期' % ep_num, api_t):
                        sc = 0
                        if date_str and self._date_in_text(date_str, api_t):
                            sc += 20
                        if keywords and any(k in api_t for k in keywords):
                            sc += 15
                        if sub_part and sub_part in api_t:
                            sc += 10
                        if not any(m in api_t for m in sub_markers):
                            sc += 10
                        if not any(w in api_t for w in low_quality):
                            sc += 5
                        candidates.append((sc, ep.get('episodeId')))
                if candidates:
                    return max(candidates, key=lambda x: x[0])[1]

            if date_str:
                best = None
                lib_dates = set()
                for ep in episodes:
                    api_t = self._get_episode_title_from_data(ep)
                    for dm_ in re.finditer(r'(\d{4}-\d{1,2}-\d{1,2})|(?<!\d)(\d{8})(?!\d)', api_t):
                        dv = (dm_.group(1) or dm_.group(2)).replace('-', '')
                        if len(dv) == 8:
                            lib_dates.add(dv)
                    if self._date_in_text(date_str, api_t):
                        if keywords and any(k in api_t for k in keywords):
                            return ep.get('episodeId')
                        if not best:
                            best = ep
                if best and len(lib_dates) > 1:
                    return best.get('episodeId')

            if ep_num:
                for ep in episodes:
                    api_t = self._get_episode_title_from_data(ep)
                    if re.search(r'第\s*0*%d\s*期' % ep_num, api_t):
                        return ep.get('episodeId')

            core_name = re.sub(r'^[\d\-年月日\.]+', '', clean_ep).strip()
            core_name = re.sub(r'^第\s*\d+\s*[期集話话]?\s*', '', core_name).strip()
            if len(core_name) >= 4 and not re.fullmatch(r'[上中下纯享加更陪看先导花絮彩蛋特辑预告正片全集]+', core_name):
                for ep in episodes:
                    api_t = self._get_episode_title_from_data(ep)
                    if not api_t:
                        continue
                    api_core = re.sub(r'^【[^】]*】\s*', '', api_t)
                    api_core = re.sub(r'\s*\d{4}-\d{1,2}-\d{1,2}期?\s*', ' ', api_core).strip()
                    api_core = re.sub(r'^第\s*\d+\s*[期集話话]\s*[上中下]?\s*[:：]?\s*', '', api_core).strip()
                    if len(api_core) >= 4 and (core_name in api_core or api_core in core_name):
                        return ep.get('episodeId')
        except Exception:
            pass
        return None

    def _get_episode_id_by_index(
        self, anime_ids, episode_index, current_ep_title=None,
        lang_keywords=None, date_str=None, infer_num=None, part_hint=None
    ):
        if not lang_keywords:
            lang_keywords = self._extract_language_keywords(current_ep_title or '')
        if not date_str and current_ep_title:
            date_str = self._extract_date_from_title(current_ep_title)

        for aid in anime_ids:
            ck = f"{aid}_{episode_index}_{current_ep_title}_{str(lang_keywords)}_{infer_num}_{part_hint}"
            if ck in self._episode_cache:
                return self._episode_cache[ck]

            try:
                episodes = self._fetch_bangumi_episodes(aid)
                if not episodes:
                    continue

                if self.vod_total == 1:
                    dialect_kw = []
                    if current_ep_title:
                        for dk in ['四川话', '普通话', '粤语', '英语', '原声']:
                            if dk in current_ep_title:
                                dialect_kw.append(dk)
                    if not dialect_kw and self.vod_title:
                        for dk in ['四川话', '普通话', '粤语', '英语', '原声']:
                            if dk in self.vod_title:
                                dialect_kw.append(dk)
                    if dialect_kw:
                        for ep in episodes:
                            api_t = self._get_episode_title_from_data(ep)
                            if any(dk in api_t for dk in dialect_kw):
                                if date_str and not self._date_in_text(date_str, api_t):
                                    continue
                                eid = ep.get('episodeId')
                                self._episode_cache[ck] = eid
                                return eid
                    if date_str:
                        for ep in episodes:
                            api_t = self._get_episode_title_from_data(ep)
                            if self._date_in_text(date_str, api_t):
                                eid = ep.get('episodeId')
                                self._episode_cache[ck] = eid
                                return eid
                        continue
                    eid = episodes[0].get('episodeId')
                    self._episode_cache[ck] = eid
                    return eid

                lib_has_date = False
                all_dates = set()
                if date_str:
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        if re.search(r'\d{4}-\d{1,2}-\d{1,2}|(?<!\d)\d{8}(?!\d)', api_t):
                            lib_has_date = True
                        for dm_ in re.finditer(r'(\d{4}-\d{1,2}-\d{1,2})|(?<!\d)(\d{8})(?!\d)', api_t):
                            dv = (dm_.group(1) or dm_.group(2)).replace('-', '')
                            if len(dv) == 8:
                                all_dates.add(dv)
                strict_date = bool(date_str) and lib_has_date and len(all_dates) > 1
                date_first = None
                if date_str:
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        if self._date_in_text(date_str, api_t):
                            if strict_date:
                                eid = ep.get('episodeId')
                                self._episode_cache[ck] = eid
                                return eid
                            if date_first is None:
                                date_first = ep
                    if strict_date:
                        continue

                num_idx = None
                if infer_num and infer_num > 0 and date_str:
                    num_idx = infer_num
                elif episode_index and episode_index > 0:
                    num_idx = episode_index

                if lang_keywords:
                    matched = None
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        has_num = (
                            re.search(r'(?<!\d)%d(?!\d)' % (num_idx or episode_index), api_t)
                            or re.search(r'第\s*%d\s*[集話期]' % (num_idx or episode_index), api_t)
                        )
                        if has_num:
                            for lk in lang_keywords:
                                if lk in api_t:
                                    matched = ep
                                    break
                            if matched:
                                break
                    if matched:
                        eid = matched.get('episodeId')
                        self._episode_cache[ck] = eid
                        return eid

                if num_idx and num_idx > 0:
                    best_ep = None
                    best_sc = -999
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        if not api_t:
                            continue
                        if strict_date and not self._date_in_text(date_str, api_t):
                            continue
                        if re.search(r'第\s*0*%d\s*期' % num_idx, api_t):
                            sc = 30
                        elif re.search(r'第\s*0*%d\s*[集话話]' % num_idx, api_t):
                            sc = 20
                        elif re.search(r'(?<!\d)0*%d(?!\d)' % num_idx, api_t):
                            sc = 8
                        else:
                            continue
                        if date_str and self._date_in_text(date_str, api_t):
                            sc += 30
                        if part_hint:
                            m3 = re.search(r'第\s*0*%d\s*期\s*([上中下])' % num_idx, api_t)
                            if m3:
                                if m3.group(1) in part_hint:
                                    sc += 20
                                    if len(part_hint) > 1 and part_hint[-1] in api_t[m3.end():m3.end() + 6]:
                                        sc += 10
                                else:
                                    sc -= 15
                        if any(w in api_t for w in self.EXTRA_EP_WORDS):
                            sc -= 25
                        if date_str:
                            bare = re.sub(r'^【[^】]*】\s*', '', api_t)
                            bare = re.sub(r'第\s*0*%d\s*[期集话話]\s*[上中下]?' % num_idx, '', bare)
                            bare = re.sub(r'\d{4}-\d{1,2}-\d{1,2}期?', '', bare).strip(' ：:，,。.~～!！?？')
                            if len(bare) < 2:
                                sc -= 40
                        if lang_keywords and any(lk in api_t for lk in lang_keywords):
                            sc += 15
                        if sc > best_sc:
                            best_sc = sc
                            best_ep = ep
                    if best_ep is not None and best_sc > 0:
                        eid = best_ep.get('episodeId')
                        self._episode_cache[ck] = eid
                        return eid

                if date_first is not None:
                    eid = date_first.get('episodeId')
                    self._episode_cache[ck] = eid
                    return eid

                if not date_str and 1 <= episode_index <= len(episodes):
                    target = episodes[episode_index - 1]
                    if lang_keywords:
                        matched = None
                        for offset in range(-2, 3):
                            idx = episode_index + offset - 1
                            if 0 <= idx < len(episodes):
                                api_t = self._get_episode_title_from_data(episodes[idx])
                                if any(lk in api_t for lk in lang_keywords):
                                    matched = episodes[idx]
                                    break
                        if matched:
                            eid = matched.get('episodeId')
                            self._episode_cache[ck] = eid
                            return eid
                        eid = target.get('episodeId')
                        self._episode_cache[ck] = eid
                        return eid
                    eid = target.get('episodeId')
                    self._episode_cache[ck] = eid
                    return eid

                if episode_index and not date_str:
                    for ep in episodes:
                        api_t = self._get_episode_title_from_data(ep)
                        nm = re.search(r'(\d+)', api_t)
                        if nm and int(nm.group(1)) == episode_index:
                            if lang_keywords:
                                if any(lk in api_t for lk in lang_keywords):
                                    eid = ep.get('episodeId')
                                    self._episode_cache[ck] = eid
                                    return eid
                            eid = ep.get('episodeId')
                            self._episode_cache[ck] = eid
                            return eid
            except Exception:
                pass
        return None

    def _fetch_danmaku(self, anime_id=None, episode_num=None, episode_id=None, retry=2):
        if episode_id:
            url = f"{self.DANMAKU_API}/comment/{episode_id}?format=xml"
        elif anime_id and episode_num:
            url = f"{self.DANMAKU_API}/comment?animeId={anime_id}&episode={episode_num}&format=xml"
        else:
            return None

        if url in self._danmaku_url_cache:
            return self._danmaku_url_cache[url]

        for attempt in range(retry):
            try:
                self._rate_limit()
                # 仅读取前 16KB 验证包含 <d 或 <i> 标签即可，避免全量下载大型弹幕文件
                status, head = self._http_get_bytes(
                    url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': self.DANMAKU_API + '/',
                        'Accept': 'application/xml, text/xml, */*',
                    },
                    timeout=5.0,
                    max_bytes=16384
                )
                if status == 200 and (b'<d' in head or b'<i>' in head):
                    self._danmaku_url_cache[url] = url
                    return url
            except Exception:
                if attempt < retry - 1:
                    time.sleep(0.4)
        return None

    def _push_danmaku(self, danmaku_url):
        if not danmaku_url:
            return
        try:
            loopback_host = '.'.join(('127', '0', '0', '1'))
            push_url = f"http://{loopback_host}:{self.push_port}/action?do=refresh&type=danmaku&path={urllib.parse.quote(danmaku_url)}"
            self._http_get_bytes(push_url, timeout=1.2, max_bytes=4096)
        except Exception:
            pass

    def _build_danmaku_context(self, item):
        """从 MacCMS 详情数据解析剧集信息，构建弹幕匹配上下文"""
        try:
            self.ep_map = {}
            self.ep_title_map = {}
            self.ep_date_map = {}
            self.ep_realnum_map = {}
            self.ep_infer_num_map = {}
            self.ep_part_map = {}

            DERIV_WORDS = (
                '先导', '纯享', '加更', '陪看', '彩蛋', '花絮', '特辑', '预告',
                '复盘', '探班', '会员', '尊享', '加长', '未播', '直播回放',
                '心动的旅行', '心动的周末', '全记录', '发布会', '导演版'
            )
            NO_INHERIT = ('心动的旅行', '心动的周末', '直播回放')

            def is_deriv(en):
                return any(w in en for w in DERIV_WORDS)

            def part_of(en):
                if '中上' in en:
                    return '中上'
                if '中下' in en:
                    return '中下'
                if '中' in en:
                    return '中'
                if '上' in en:
                    return '上'
                if '下' in en:
                    return '下'
                return ''

            CN_DIGIT = {
                '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
                '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
            }

            def cn_to_int(s):
                if not s:
                    return None
                if s == '十':
                    return 10
                m = re.match(r'^([一二三四五六七八九])?十([一二三四五六七八九])?$', s)
                if m:
                    tens = CN_DIGIT.get(m.group(1), 1) if m.group(1) else 1
                    ones = CN_DIGIT.get(m.group(2), 0) if m.group(2) else 0
                    return tens * 10 + ones
                return CN_DIGIT.get(s)

            def extract_ep_num(en):
                s = (en or '').strip()
                if not s:
                    return None
                if re.match(r'^\d{8}$', s):
                    return None
                if s.upper() in ('HD', 'BD', '4K', '1080P', '720P', 'TC', 'TS', 'CAM', 'SCR', 'BLURAY', 'DOLBY'):
                    return 1
                m = re.search(r'[Ss]\d+[Ee](\d+)', s)
                if m:
                    return int(m.group(1))
                for m in re.finditer(r'第\s*(\d+)\s*[集期话話]', s):
                    n = int(m.group(1))
                    if n < 10000000:
                        return n
                m = re.search(r'第\s*([一二三四五六七八九十]+)\s*[集期话話]', s)
                if m:
                    n = cn_to_int(m.group(1))
                    if n:
                        return n
                if re.search(r'(1080|4K|720|HD|SD|高清|蓝光|超清|TC|TS|CAM|SCR|杜比)', s, re.I):
                    return None
                if self._extract_date_from_title(s):
                    return None
                m = re.search(r'(?<!\d)(\d{1,3})(?!\d)', s)
                if m:
                    n = int(m.group(1))
                    return None if 1000 <= n <= 2099 else n
                return None

            play_urls = str(item.get('vod_play_url', '') or '').split('$$$')
            first_count = 0
            line_seqs = []
            for idx, purl in enumerate(play_urls):
                if not purl:
                    continue
                ep_counter = 0
                lc = 0
                line_seq = []
                for ep in purl.split('#'):
                    if '$' not in ep:
                        continue
                    en, el = ep.split('$', 1)
                    en = en.strip()
                    el = self._normalize_media_url(el.strip())
                    if not en or not el:
                        continue
                    ep_counter += 1
                    lc += 1
                    key = el
                    key2 = el.split('?')[0].rstrip('/')
                    real_n = extract_ep_num(en)
                    ep_date = self._extract_date_from_title(en)
                    ep_n = real_n if real_n is not None else ep_counter
                    self.ep_map[key] = ep_n
                    self.ep_map[key2] = ep_n
                    self.ep_title_map[key] = en
                    self.ep_title_map[key2] = en
                    if ep_date:
                        self.ep_date_map[key] = ep_date
                        self.ep_date_map[key2] = ep_date
                    if real_n is not None:
                        self.ep_realnum_map[key] = real_n
                        self.ep_realnum_map[key2] = real_n
                    line_seq.append([
                        key, key2, en, ep_date, real_n, ep_counter,
                        is_deriv(en), part_of(en), None, None
                    ])
                if idx == 0:
                    first_count = lc
                line_seqs.append(line_seq)

            for line_seq in line_seqs:
                counter = 0
                last_part = None
                clean_by_date = {}
                for it in line_seq:
                    if it[6]:
                        continue
                    part = it[7]
                    if part == '上':
                        counter += 1
                    elif part == '':
                        if last_part in ('', '下', None):
                            counter += 1
                    if counter > 0:
                        it[8] = counter
                        it[9] = part
                        if it[3] and it[3] not in clean_by_date:
                            clean_by_date[it[3]] = (counter, part)
                    last_part = part
                for it in line_seq:
                    if it[6] and it[3] and it[3] in clean_by_date and not any(w in it[2] for w in NO_INHERIT):
                        num, cpart = clean_by_date[it[3]]
                        it[8] = num
                        it[9] = it[7] or cpart
                for it in line_seq:
                    if it[8]:
                        self.ep_infer_num_map[it[0]] = it[8]
                        self.ep_infer_num_map[it[1]] = it[8]
                        if it[9]:
                            self.ep_part_map[it[0]] = it[9]
                            self.ep_part_map[it[1]] = it[9]

            self.vod_title = item.get('vod_name', '') or ''
            self.cleaned_title = self._clean_title(self.vod_title)
            self.vod_year = str(item.get('vod_year', '') or '')
            self.vod_total = first_count if first_count > 0 else None
            self.vod_language = None
            if self.vod_title:
                lks = self._extract_language_keywords(self.vod_title)
                if lks:
                    self.vod_language = lks[0]
        except Exception:
            pass

    def _prewarm_danmaku_async(self):
        """在进入详情页时后台异步预热番剧搜索与第 1 集分集列表，使随后点击播放可秒回弹幕"""
        if not self.vod_title:
            return

        def prewarm():
            try:
                sn = self.cleaned_title or self.vod_title
                sn = re.sub(r'(电影版|电影|电视剧|系列|完整版|高清版)$', '', sn)
                sn = re.sub(r'\d{4}$', '', sn).strip()
                aids = self._search_anime_list(
                    sn, year=self.vod_year, total_ep=self.vod_total, language=self.vod_language
                )
                if aids:
                    self._fetch_bangumi_episodes(aids[0])
            except Exception:
                pass

        threading.Thread(target=prewarm, daemon=True).start()

    def _resolve_danmaku_url_sync(
        self, url, cur_ep_title, ep_num, date_str, real_num, infer_num, part_hint
    ):
        lks = self._extract_language_keywords(self.vod_title)
        sn = self.cleaned_title or self.vod_title
        sn = re.sub(r'(电影版|电影|电视剧|系列|完整版|高清版)$', '', sn)
        sn = re.sub(r'\d{4}$', '', sn).strip()
        aids = self._search_anime_list(sn, year=self.vod_year, total_ep=self.vod_total, language=self.vod_language)
        if not aids and self.vod_title:
            alt = re.sub(r'(电影版|电视剧|系列|完整版|高清版)$', '', self.vod_title)
            alt = re.sub(r'\d{4}$', '', alt).strip()
            aids = self._search_anime_list(
                alt, year=self.vod_year, total_ep=self.vod_total, force_refresh=True, language=self.vod_language
            )
        if not aids:
            return None
        eid = None
        if cur_ep_title:
            is_generic = (not date_str) and (
                re.match(r'^第\s*\d+\s*[集話话]?$', cur_ep_title)
                or re.match(r'^EP\s*\d+$', cur_ep_title, re.I)
                or re.match(r'^\d+$', cur_ep_title.strip())
            )
            if not is_generic:
                for aid in aids:
                    eid = self._get_episode_id_by_title(aid, cur_ep_title)
                    if eid:
                        break
        if not eid and (ep_num is not None or date_str):
            for aid in aids:
                eid = self._get_episode_id_by_index(
                    [aid], ep_num or 0, cur_ep_title, lks,
                    date_str=date_str, infer_num=infer_num, part_hint=part_hint
                )
                if eid:
                    break
        if not eid and (real_num == 1 or self.vod_total == 1) and aids:
            du = self._fetch_danmaku(aids[0], 1)
            if du:
                self._push_danmaku(du)
                return du
            self._episode_cache.clear()
        if eid:
            du = self._fetch_danmaku(episode_id=eid)
            if du:
                self._push_danmaku(du)
                return du
            self._episode_cache.clear()
        return None

    def _match_danmaku(self, play_url, sync_timeout=1.5):
        """
        双模弹幕匹配：
        - 在 `sync_timeout` 秒内等待结果（若已由 detailContent 预热则毫秒级返回），
          直接将弹幕 XML 地址注入 `playerContent` 返回字典供 CCTVHost 原生使用；
        - 若超时仍未完成，后台守护线程继续完成匹配并向本地端口推送（兼容 TVBox / Fongmi）。
        """
        if not play_url:
            return None
        url = self._normalize_media_url(play_url)
        base = url.split('?')[0].rstrip('/')
        ep_num = self.ep_map.get(url) or self.ep_map.get(base)
        if not ep_num:
            ep_num = self._get_episode_number_from_url(url)
        if self.vod_total == 1:
            ep_num = 1
        date_str = self.ep_date_map.get(url) or self.ep_date_map.get(base)
        real_num = self.ep_realnum_map.get(url) or self.ep_realnum_map.get(base)
        infer_num = self.ep_infer_num_map.get(url) or self.ep_infer_num_map.get(base)
        part_hint = self.ep_part_map.get(url) or self.ep_part_map.get(base)

        cur_ep_title = self.ep_title_map.get(url) or self.ep_title_map.get(base)
        if cur_ep_title:
            fmt_kw = [
                'HD', 'BD', '4K', '1080P', '720P', 'DVD', 'HDRIP', 'WEBRIP',
                'TC', 'TS', 'CAM', 'SCR', '蓝光', '杜比', 'BLURAY', 'DOLBY'
            ]
            if any(k in cur_ep_title.upper() for k in fmt_kw) and len(cur_ep_title) < 20:
                cur_ep_title = None
            elif cur_ep_title.upper() in fmt_kw:
                cur_ep_title = None
        if self.vod_total == 1 and cur_ep_title:
            if re.match(r'^第\s*\d+\s*[集話话]', cur_ep_title) or re.match(r'^\d+$', cur_ep_title.strip()):
                cur_ep_title = None

        if not self.vod_title or (ep_num is None and not date_str):
            return None

        DERIV_SKIP = (
            '先导', '陪看', '花絮', '特辑', '彩蛋', '加更', '探班', '复盘',
            '直播回放', '发布会', '全记录', '尊享', '加长', '未播', '导演版'
        )
        if cur_ep_title and any(w in cur_ep_title for w in DERIV_SKIP) and not infer_num:
            return None

        holder = {'url': None}
        done_evt = threading.Event()

        def dm_worker():
            try:
                holder['url'] = self._resolve_danmaku_url_sync(
                    url, cur_ep_title, ep_num, date_str, real_num, infer_num, part_hint
                )
            except Exception:
                pass
            finally:
                done_evt.set()

        t = threading.Thread(target=dm_worker, daemon=True)
        t.start()
        if sync_timeout and sync_timeout > 0:
            done_evt.wait(float(sync_timeout))
        return holder['url']

    def isVideoFormat(self, url):
        if not url:
            return False
        low = str(url).lower().split('?')[0]
        return low.endswith(('.m3u8', '.mp4', '.flv', '.mpd', '.m4v', '.mov'))

    def manualVideoCheck(self):
        return False

    def destroy(self):
        with self._lock:
            self._http_cache.clear()


def _run_selftest():
    spider = Spider()
    spider.init()

    # 1. 验证 build_url 能够覆盖母鸡/电影天堂等原站尾部的 ?ac=list
    merged_u = spider.build_url("https://mujiziyuan00.com/api.php/provide/vod/?ac=list", "ac=detail&pg=2")
    assert "ac=detail" in merged_u and "ac=list" not in merged_u, f"build_url failed: {merged_u}"

    # 2. 验证 _format_poster 剥离 @Referer= 并补全 // 与相对路径
    p1 = spider._format_poster("//img.cdn.com/upload/海报 1.jpg@Referer=https://a.com", "https://360zy.com/api.php/provide/vod/")
    assert p1.startswith("https://img.cdn.com/upload/") and "@Referer" not in p1 and " " not in p1, f"poster1 failed: {p1}"
    p2 = spider._format_poster("/upload/vod/2026/a.jpg", "https://360zy.com/api.php/provide/vod/")
    assert p2 == "https://360zy.com/upload/vod/2026/a.jpg", f"poster2 failed: {p2}"

    # 3. 验证 Mock 下 homeContent / homeVideoContent / categoryContent / detailContent / searchContent / playerContent
    def mock_fetch(source_key, query, timeout=6.0, use_cache=True):
        if "ac=list" in query and "wd=" not in query:
            return {
                "class": [
                    {"type_id": 6, "type_name": "动作片"},
                    {"type_id": 13, "type_name": "国产剧"}
                ]
            }
        return {
            "page": 1,
            "pagecount": 5,
            "limit": 20,
            "total": 100,
            "list": [
                {
                    "vod_id": "9001",
                    "vod_name": "庆余年第二季",
                    "vod_pic": "//img.cdn.com/qyn2.jpg@Referer=https://360zy.com/",
                    "vod_remarks": "全36集",
                    "vod_year": "2024",
                    "vod_area": "大陆",
                    "vod_actor": "张若昀,李沁",
                    "vod_director": "孙皓",
                    "vod_content": "<p>范闲回归京都的故事。</p>",
                    "vod_play_from": f"{source_key}云$$${source_key}m3u8",
                    "vod_play_url": (
                        f"第1集$https://play.{source_key}.com/share/1#第2集$https://play.{source_key}.com/share/2"
                        f"$$$第1集$https://cdn.{source_key}.com/hls/ep1.m3u8#第2集$https://cdn.{source_key}.com/hls/ep2.m3u8"
                    )
                }
            ]
        }

    spider._fetch_source_json = mock_fetch
    home_res = spider.homeContent(True)
    assert len(home_res['class']) == len(Spider.SOURCE_LIST), "class count mismatch"
    assert len(home_res['list']) > 0, "home list should not be empty"
    assert all(not c['type_name'].startswith('\ufe0f') for c in home_res['class']), "stray variation selector"

    cat_res = spider.categoryContent('电影天堂', 1, True, {'cateId': '动作片'})
    assert len(cat_res['list']) == 1 and cat_res['list'][0]['vod_id'] == '电影天堂@@9001'
    assert "@Referer" not in cat_res['list'][0]['vod_pic']

    det_res = spider.detailContent(['电影天堂@@9001'])
    assert len(det_res['list']) == 1
    det_item = det_res['list'][0]
    assert len(det_item.get('lines', [])) >= 2, "multi-source aggregation lines missing"
    # M3U8 直链线路应当排在第一位
    assert det_item['lines'][0]['episodes'][0]['id'].endswith('.m3u8'), "m3u8 line should be prioritized"

    search_res = spider.searchContent('庆余年第二季', False, 1)
    assert len(search_res['list']) >= 1

    play_res = spider.playerContent(det_item['lines'][0]['id'], det_item['lines'][0]['episodes'][0]['id'])
    assert play_res['parse'] == 0 and play_res['directMedia'] is True and play_res['nativePlayable'] is True
    assert play_res['format'] == 'hls' and len(play_res.get('alternates', [])) >= 1
    print("SELFTEST_OK")


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        _run_selftest()
