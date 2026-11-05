# -*- coding: utf-8 -*-
"""
影视追剧 (ystj) — TVBox Spider + CLI 二合一

逆向来源：影视追剧_1.0.ipa
  - 后端 base : http://47.238.86.127:8101/     (ThinkPHP 6/8, nginx)
  - 请求头    : Accept: application/json, User-Agent: yingshiZhJu/1.0 (iPhone; iOS 16.6)
  - 本地 token: NSUserDefaults key = "QuanQuanju__usertoken"/"QuanQuanju__user"
  - 接口（7 个，app 里硬编码）:
        YingshiMyZhHtR/gaoqingVods     高清剧集列表（vod_* 字段，苹果CMS 结构）
        YingshiMyZhHtR/gaoqingType     高清分类
        YingshiMyZhHtR/jumiTuijian     剧迷推荐
        YingshiMyZhHtR/jumiColls       剧迷合集
        YingshiMyZhHtR/hanFVoDsl       韩风剧集
        YingshiMyZhHtR/yingShocu       影视输出
        YingshiMyZhHtR/hanfengKSou     韩风搜索
  - 数据模型字段: vod_id vod_name vod_pic vod_class vod_content vod_play_url vod_remarks
                  vod_director vod_actor vod_year vod_score；user_id/vip_level/...

实测（2026-11-05）：上述 7 个接口当前全部返回
    HTTP 500  {"code":2,"message":"页面错误！请稍后再试～"}
即 app 自身后端已失效（控制器存在但内部异常）。本脚本因此把「源」做成可插拔：
  src=app    → 原 app 协议（恢复后直接可用，保留为后备）
  src=dytt / wujin / lziapi / ffzy → 苹果CMS 通用采集源（同结构 vod_* 字段，现在可用）

播放地址形态（vod_play_url，$$$ 分多线路、# 分集、$ 分集名与地址）：
  - 直链 m3u8：形如 .../index.m3u8，AVPlayer 可直接播（第 2 组 lzm3u8 / wujin 全组）。
  - share 播放页：形如 .../share/<hash> 或 .../index.html，无扩展名，需抓页面取
    var main="...m3u8" 或页面内 .m3u8 链接（见 resolve_play_url）。
  - 实测（2026-11-06）：视频 CDN（v.lzcdn31.com / vip.dytt-tvs.com / v5.ppqrrs.com /
    vip.ffzy-play9.com）对本机出口 IP 做地域拦截（dytt 明确返回 "The region has been
    denied"），因此本机无法直接验证直链/share 页是否可达；但 4 个采集源 API 本身
    （cj.lziapi.com 等）均正常返回数据。直链 m3u8 在用户设备（国内住宅 IP）上应可
    正常播放；share 页解析失败时本脚本返回 None/空，绝不把原 share 页地址交给播放器。

两种用法：
  1) TVBox / cctvhost 蜘蛛：Spider 类（见文件末尾），由 For-ADM.json 注册后加载。
     homeContent→分类、categoryContent→列表、detailContent→详情+分集、
     searchContent→搜索、playerContent→解析出真实播放地址。
     默认源 lziapi；init(extend) 可传源名（dytt/wujin/lziapi/ffzy/app）切换。
  2) CLI：python3 ystj.py --src lziapi list / cats / search 关键词 / ep <id> /
     play <id> [集号] / dump <id> / probe / sources / repl
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

# TVBox 蜘蛛宿主提供 base.spider；独立运行/本地测试时 fallback 为空基类。
sys.path.append("..")
try:
    from base.spider import Spider
except Exception:  # noqa: BLE001 - 宿主外运行是预期场景
    class Spider:  # noqa: D101 - 兼容空基类
        pass

UA = "yingshiZhJu/1.0 (iPhone; iOS 16.6)"
BROWSER_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
              "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
              "Mobile/15E148 Safari/604.1")
CFG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ystj_sources.json")

# 超时（秒）与缓存：API/播放页均收紧到 10 秒；列表/详情 120 秒内去重。
API_TIMEOUT = 10
PAGE_TIMEOUT = 10
CACHE_TTL = 120
# 原生可直播的扩展名（AVPlayer/CicadaPlayer 均可处理 m3u8；其余为 AVPlayer 直播格式）。
DIRECT_MEDIA_EXTS = (".m3u8", ".mp4", ".m4v", ".mov", ".ts", ".mp3", ".m4a")

# ---------------------------------------------------------------- 源配置
DEFAULT_SOURCES = {
    "app": {
        # 原 app 后端，路径直接用 app 里硬编码的控制器/方法
        "type": "app",
        "base": "http://47.238.86.127:8101/",
        "list": "YingshiMyZhHtR/gaoqingVods",
        "cats": "YingshiMyZhHtR/gaoqingType",
        "search": "YingshiMyZhHtR/hanfengKSou",
        "detail": "YingshiMyZhHtR/gaoqingVods",
        "params": {"type": "type_id", "page": "page", "wd": "wd", "id": "id"},
    },
    "dytt": {
        "type": "cms",
        "base": "https://caiji.dyttzyapi.com/api.php/provide/vod/",
        "params": {},
    },
    "wujin": {
        "type": "cms",
        "base": "https://api.wujinapi.me/api.php/provide/vod/",
        "params": {},
    },
    "lziapi": {
        "type": "cms",
        "base": "https://cj.lziapi.com/api.php/provide/vod/",
        "params": {},
    },
    "ffzy": {
        "type": "cms",
        "base": "https://api.ffzyapi.com/api.php/provide/vod/",
        "params": {},
    },
}
DEFAULT_SRC = "lziapi"


def load_sources():
    if os.path.exists(CFG_PATH):
        try:
            with open(CFG_PATH, encoding="utf-8") as f:
                d = json.load(f)
            for k, v in DEFAULT_SOURCES.items():
                d.setdefault(k, v)
            return d
        except Exception:
            pass
    return dict(DEFAULT_SOURCES)


# ---------------------------------------------------------------- HTTP
def http_json(url, retries=1, timeout=API_TIMEOUT):
    """GET 后解析 JSON。空响应/非 JSON/持续失败时抛 RuntimeError。

    注意：HTTP 500 也可能带 JSON body（如 app 后端 {"code":2,...}），因此错误
    响应体里若有合法 JSON 也照常返回，由调用方按 code 判断。
    """
    last = None
    for _ in range(retries + 1):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
        except Exception as e:  # HTTPError 也可能带 JSON body
            last = e
            body = b""
            try:
                body = e.read() or b""
            except Exception:
                body = b""
            if body:
                try:
                    return json.loads(body.decode("utf-8", "replace"))
                except Exception:
                    pass
            continue
        if not raw:
            last = RuntimeError("空响应")
            continue
        try:
            return json.loads(raw.decode("utf-8", "replace"))
        except Exception as e:
            last = e
            continue
    raise RuntimeError(f"请求失败: {url} -> {last}")


def http_text(url, headers, timeout=PAGE_TIMEOUT):
    """GET 后返回 (status, 文本)。网络失败/HTTP 错误返回 (None/状态码, '')，不抛错。"""
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except Exception as e:
        code = getattr(e, "code", None)
        body = ""
        try:
            body = (e.read() or b"").decode("utf-8", "replace")
        except Exception:
            body = ""
        return code, body


# ---------------------------------------------------------------- 各源适配
class Source:
    def __init__(self, name, cfg):
        self.name = name
        self.cfg = cfg
        self.kind = cfg.get("type", "cms")
        self._cache = {}  # url -> (ts, resp)

    # -- 通用请求（带 120 秒去重缓存）
    def _get(self, path_key, query=None):
        base = self.cfg["base"]
        if self.kind == "app":
            url = base.rstrip("/") + "/" + self.cfg[path_key].lstrip("/")
            if query:
                url += "?" + urllib.parse.urlencode(query)
        else:
            q = {"ac": "list"} if path_key == "list" else {"ac": "detail"}
            q.update(query or {})
            url = base + "?" + urllib.parse.urlencode(q)
        now = time.time()
        hit = self._cache.get(url)
        if hit and now - hit[0] < CACHE_TTL:
            return hit[1]
        resp = http_json(url)
        self._cache[url] = (now, resp)
        return resp

    def clear_cache(self):
        self._cache.clear()

    # -- 列表
    def vod_list(self, type_id=0, page=1, wd=None):
        pk = "search" if wd else "list"
        p = self.cfg.get("params") or {}
        q = {}
        q[p.get("page", "page")] = page
        if type_id:
            q[p.get("type", "type_id")] = type_id
        if wd:
            q[p.get("wd", "wd")] = wd
        if self.kind == "cms" and wd:
            q["ac"] = "list"
        return self._get(pk, q)

    # -- 详情（拿 vod_play_url）
    def detail(self, vod_id):
        p = self.cfg.get("params") or {}
        if self.kind == "app":
            q = {p.get("id", "id"): vod_id}
            return self._get("detail", q)
        q = {"ids": vod_id}
        return self._get("detail", q)

    # -- 分类
    def cats(self):
        if self.kind == "app":
            return self._get("cats") if "cats" in self.cfg else {"list": []}
        d = self._get("list", {"ac": "list"})
        seen = {}
        for v in normalize_list(d):
            tid = v.get("type_id")
            name = v.get("type_name")
            if tid is not None and name and tid not in seen:
                seen[tid] = name
        if seen:
            return {"list": [{"type_id": k, "type_name": v} for k, v in seen.items()]}
        # 兜底：class 接口
        base = self.cfg["base"]
        return http_json(base + "?ac=class")


# ---------------------------------------------------------------- 数据整理
def normalize_list(resp):
    """
    兼容三种返回：
      1) {"code":1,"list":[...]}           苹果CMS / app
      2) {"data":[...]}  {"data":{"list":[...]}}
      3) 直接数组
    非法/空输入返回 []，不抛错。
    """
    if isinstance(resp, list):
        return resp
    if not isinstance(resp, dict):
        return []
    if isinstance(resp.get("list"), list):
        return resp["list"]
    d = resp.get("data")
    if isinstance(d, list):
        return d
    if isinstance(d, dict) and isinstance(d.get("list"), list):
        return d["list"]
    for v in resp.values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v
    return []


def is_direct_media(url):
    """是否为原生可直接播的地址（直链 m3u8/mp4/…）。无扩展名播放页返回 False。"""
    if not url:
        return False
    path = urllib.parse.urlsplit(str(url)).path.lower()
    return path.endswith(DIRECT_MEDIA_EXTS)


def classify_url(url):
    """'direct' 直链可播 / 'page' 需解析的播放页。"""
    return "direct" if is_direct_media(url) else "page"


def parse_play_url(vod_play_url):
    """
    vod_play_url 形如：
      第1集$https://x/a.m3u8#第2集$https://x/b.m3u8
    多源时用 $$$ 分隔：
      源1第1集$url...# ...
    异常格式容错：空输入/非字符串返回 []；缺 $ 时名默认为「第N集」；
    空片段跳过；每集带 group（线路序号）与 kind（direct/page）。
    """
    if not vod_play_url:
        return []
    groups = str(vod_play_url).split("$$$")
    out = []
    for gi, g in enumerate(groups):
        if not g.strip():
            continue
        for item in g.split("#"):
            item = item.strip()
            if not item:
                continue
            if "$" in item:
                name, url = item.split("$", 1)
            else:
                name, url = f"第{len(out) + 1}集", item
            name = (name or "").strip() or f"第{len(out) + 1}集"
            url = (url or "").strip()
            if not url:
                continue
            out.append({"group": gi, "name": name, "url": url,
                        "kind": classify_url(url)})
    return out


def group_episodes(eps):
    """把 parse_play_url 的结果按 group 分组，返回 [(group, [ep, ...]), ...]。"""
    groups = {}
    for e in eps:
        groups.setdefault(e["group"], []).append(e)
    return [(g, groups[g]) for g in sorted(groups)]


def reorder_groups_for_play(eps, play_from):
    """分集线路重排：直链线路在前，播放页线路在后（默认先播直链，避免黑屏）。

    返回 (vod_play_from, vod_play_url)：线路名改为「直链」「播放页」，与重排后的
    线路一一对应；若某线路内直链与播放页混杂，按首集定性。
    """
    groups = group_episodes(eps)
    if not groups:
        return play_from or "", ""
    names = (str(play_from).split("$$$") if play_from else [])
    labeled = []
    for gi, (g, items) in enumerate(groups):
        direct = classify_url(items[0]["url"]) == "direct"
        orig = names[g] if g < len(names) and names[g] else ""
        label = "直链" if direct else "播放页"
        # 保留源站原线路名作后缀，便于辨认（如 直链·lzm3u8）
        if orig and orig not in ("直链", "播放页"):
            label = f"{label}·{orig}"
        labeled.append((0 if direct else 1, label, items))
    labeled.sort(key=lambda t: t[0])
    play_from_out = "$$$".join(t[1] for t in labeled)
    play_url_out = "$$$".join(
        "#".join(f"{e['name']}${e['url']}" for e in t[2]) for t in labeled
    )
    return play_from_out, play_url_out


def show_vod(vod, idx=None):
    line = "[{idx}] {name}  ({remarks}, {year}, 评分{score})  id={vid}".format(
        idx=idx if idx is not None else "-",
        name=vod.get("vod_name", "?"),
        remarks=vod.get("vod_remarks", "") or "-",
        year=vod.get("vod_year", "") or "-",
        score=vod.get("vod_score", "") or "-",
        vid=vod.get("vod_id", "?"),
    )
    print(line)


# ---------------------------------------------------------------- 播放地址解析
def resolve_play_url(url):
    """
    集地址有两种形态：
      1) 直链 m3u8        -> 原样返回
      2) 播放页(share/…  含 var main="/path/index.m3u8?sign=…")  -> 抓页面取出真实 m3u8
    解析失败返回 None（绝不静默返回原播放页地址去播——那会让播放器黑屏）。
    抓页策略：先 app UA，再浏览器 UA + Referer（源站 base）；任一成功即返回。
    """
    if not url:
        return None
    if is_direct_media(url):
        return url
    base = None
    try:
        base = urllib.parse.urlsplit(url)
    except Exception:
        return None
    attempts = [
        {"User-Agent": UA},
        {"User-Agent": BROWSER_UA, "Referer": f"{base.scheme}://{base.netloc}/"},
    ]
    for headers in attempts:
        status, html = http_text(url, headers, timeout=PAGE_TIMEOUT)
        if status != 200 or not html:
            continue
        cand = None
        m = re.search(r'var\s+main\s*=\s*"([^"]+)"', html)
        if m:
            cand = m.group(1)
        if not cand:
            m2 = re.search(r"https?://[^\s\"'<>\\]+\.m3u8[^\s\"'<>\\]*", html)
            if m2:
                cand = m2.group(0)
        if not cand:
            continue
        if cand.startswith("//"):
            cand = "https:" + cand
        elif cand.startswith("/"):
            cand = f"{base.scheme}://{base.netloc}{cand}"
        elif not cand.startswith("http"):
            cand = urllib.parse.urljoin(url, cand)
        return cand
    return None


def pick_variant(url, quality="auto"):
    """
    多码率 m3u8（master playlist）按带宽挑档位，低配机器/单核 CPU 用 low。
      quality: auto(中档) | low | mid | high
    返回选中的子 m3u8 绝对地址；非 master 列表原样返回。
    """
    if quality in (None, "", "none"):
        return url
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=PAGE_TIMEOUT) as r:
            txt = r.read().decode("utf-8", "replace")
    except Exception:
        return url
    if "#EXT-X-STREAM-INF" not in txt:
        return url

    lines = [l.strip() for l in txt.splitlines()]
    variants = []
    for i, l in enumerate(lines):
        if not l.startswith("#EXT-X-STREAM-INF"):
            continue
        bw = re.search(r"BANDWIDTH=(\d+)", l)
        res = re.search(r"RESOLUTION=(\d+)x(\d+)", l)
        uri = None
        for j in range(i + 1, len(lines)):
            if lines[j] and not lines[j].startswith("#"):
                uri = lines[j]
                break
        if uri:
            variants.append({
                "bw": int(bw.group(1)) if bw else 0,
                "res": f"{res.group(1)}x{res.group(2)}" if res else "?",
                "uri": uri,
            })
    if not variants:
        return url
    variants.sort(key=lambda v: v["bw"])
    idx = {"low": 0, "high": len(variants) - 1,
           "mid": len(variants) // 2, "auto": len(variants) // 2}.get(quality, len(variants) // 2)
    v = variants[max(0, min(idx, len(variants) - 1))]
    base = url if url.endswith("/") else url.rsplit("/", 1)[0] + "/"
    target = v["uri"] if v["uri"].startswith("http") else base + v["uri"].lstrip("/")
    print(f"  档位[{quality}] -> {v['res']} {v['bw']//1000}kbps")
    return target


def find_player():
    for exe in ("mpv", "ffplay", "vlc"):
        p = shutil.which(exe)
        if p:
            return exe, p
    return None, None


def play(url, player=None, hw=False, quality=None):
    if quality:
        url = pick_variant(url, quality)
    exe, path = find_player()
    if player:
        exe = player
    if not exe:
        print("没找到 mpv/ffplay/vlc，直接给你链接自己播：\n" + url)
        return
    if exe == "mpv":
        cmd = [path, url]
        if hw:
            cmd.insert(1, "--hwdec=auto")
    elif exe == "ffplay":
        cmd = [path, "-autoexit", "-loglevel", "warning", "-window_title", "ystj"]
        if hw:
            cmd += ["-hwaccel", "auto"]
        cmd.append(url)
    else:
        cmd = [path, url]
    print(f"▶ 用 {exe} 播放: {url}")
    subprocess.call(cmd)


def download(url, out_path):
    ff = shutil.which("ffmpeg")
    if not ff:
        print("没找到 ffmpeg，无法下载")
        return
    print(f"⬇ 下载 {url} -> {out_path}")
    subprocess.call([ff, "-y", "-loglevel", "warning", "-stats", "-i", url, "-c", "copy", out_path])


# ---------------------------------------------------------------- 交互式播放器
def repl(src, hw=False, quality=None):
    print(f"当前源: {src.name}  ({src.cfg.get('base')})")
    print("命令: 直接输入关键词搜索 | :l 最新 | :c 分类 | :q 退出")
    while True:
        try:
            line = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not line:
            continue
        if line in (":q", "q", "quit", "exit"):
            return
        try:
            if line == ":l":
                lst = normalize_list(src.vod_list(page=1))
            elif line == ":c":
                for c in normalize_list(src.cats()):
                    print(f"{c.get('type_id'):>5}  {c.get('type_name') or c.get('name')}")
                continue
            else:
                lst = normalize_list(src.vod_list(wd=line, page=1))
        except Exception as e:
            print("请求失败:", e)
            continue
        if not lst:
            print("没有结果")
            continue
        for i, v in enumerate(lst, 1):
            show_vod(v, i)
        sel = input("选择编号(回车返回): ").strip()
        if not sel.isdigit() or not (1 <= int(sel) <= len(lst)):
            continue
        vod = lst[int(sel) - 1]
        try:
            d = src.detail(vod.get("vod_id"))
            dl = normalize_list(d)
            detail = dl[0] if dl else (d.get("data") if isinstance(d, dict) else {})
            if not isinstance(detail, dict):
                detail = vod
        except Exception as e:
            print("取详情失败:", e)
            continue
        eps = parse_play_url(detail.get("vod_play_url") or vod.get("vod_play_url"))
        print(f"《{detail.get('vod_name') or vod.get('vod_name')}》 共 {len(eps)} 集")
        for i, e in enumerate(eps, 1):
            tag = "直链" if e["kind"] == "direct" else "需解析"
            print(f"  {i:>3}. [{e['name']}][{tag}]{'' if e['group'] == 0 else ' 线路' + str(e['group'] + 1)}  {e['url'][:80]}")
        cur = 1
        while True:
            cmd = input(f"集号 1-{len(eps)} (p 上一集 / n 下一集 / 回车默认 {cur} / q 返回): ").strip().lower()
            if cmd == "q":
                break
            if cmd == "n":
                cur = min(len(eps), cur + 1)
            elif cmd == "p":
                cur = max(1, cur - 1)
            elif cmd.isdigit():
                cur = int(cmd)
                if not (1 <= cur <= len(eps)):
                    print("超范围")
                    continue
            real = resolve_play_url(eps[cur - 1]["url"])
            if real is None:
                print(f"[{cur}] 该集播放页解析失败（可能已失效或被地域拦截），请换直链线路")
                continue
            print(f"[{cur}] {real}")
            play(real, None, hw, quality)
            cur += 1
            if cur > len(eps):
                cur = len(eps)


# ---------------------------------------------------------------- TVBox 蜘蛛
class YstjSpider(Spider):
    """影视追剧 Spider：4 个苹果CMS 采集源（默认 lziapi），原 app 后端为后备。

    注册方式（For-ADM.json）：
      {"key": "joeshu.hawk.ystj", "name": "影视追剧（PY）",
       "api": "https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/python-spiders/ystj.py",
       "type": "script"}
    切换源：init(extend) 传源名（dytt/wujin/lziapi/ffzy/app），或 JSON {"src": "dytt"}。
    """

    def __init__(self):
        self._sources = load_sources()
        self.src_name = DEFAULT_SRC
        self.src = Source(DEFAULT_SRC, self._sources[DEFAULT_SRC])

    def init(self, extend=""):
        self.__init__()
        name = ""
        if extend:
            try:
                d = json.loads(extend)
                if isinstance(d, dict):
                    name = str(d.get("src") or d.get("source") or "")
            except Exception:
                name = str(extend).strip()
        if name in self._sources:
            self.src_name = name
            self.src = Source(name, self._sources[name])

    def _norm(self, v):
        return {
            "vod_id": v.get("vod_id"),
            "vod_name": v.get("vod_name"),
            "vod_pic": v.get("vod_pic") or v.get("vod_pic_thumb"),
            "vod_remarks": v.get("vod_remarks"),
            "vod_year": v.get("vod_year"),
            "vod_area": v.get("vod_area"),
            "vod_actor": v.get("vod_actor"),
            "vod_director": v.get("vod_director"),
            "vod_content": v.get("vod_content"),
            "type_name": v.get("type_name"),
        }

    def _page_info(self, raw, pg):
        try:
            pg = int(pg)
        except Exception:
            pg = 1
        if not isinstance(raw, dict):
            return {"page": pg, "pagecount": 9999, "limit": 20, "total": 9999}
        def _int(key, default):
            try:
                return int(raw.get(key))
            except Exception:
                return default
        return {
            "page": pg,
            "pagecount": _int("pagecount", 9999),
            "limit": _int("limit", 20),
            "total": _int("total", 9999),
        }

    def homeContent(self, filter=False):
        # 一次请求同时拿分类与最新列表（cats 本就是从列表去重得到，避免重复请求）。
        raw = self.src.vod_list(page=1)
        vids = [self._norm(v) for v in normalize_list(raw)]
        cats, seen = [], set()
        for v in normalize_list(raw):
            tid, name = v.get("type_id"), v.get("type_name")
            if tid is not None and name and str(tid) not in seen:
                seen.add(str(tid))
                cats.append({"type_id": str(tid), "type_name": name})
        return {"class": cats, "list": vids}

    def homeVideoContent(self):
        raw = self.src.vod_list(page=1)
        return {"list": [self._norm(v) for v in normalize_list(raw)]}

    def categoryContent(self, tid, pg=1, filter=False, extend=""):
        try:
            type_id = int(tid)
        except Exception:
            type_id = 0
        raw = self.src.vod_list(type_id=type_id, page=pg)
        out = {"list": [self._norm(v) for v in normalize_list(raw)]}
        out.update(self._page_info(raw, pg))
        return out

    def detailContent(self, ids):
        if not ids:
            return {"list": []}
        raw = self.src.detail(ids[0])
        dl = normalize_list(raw)
        vod = dl[0] if dl else {}
        if not isinstance(vod, dict) or not vod:
            return {"list": []}
        eps = parse_play_url(vod.get("vod_play_url"))
        play_from, play_url = reorder_groups_for_play(eps, vod.get("vod_play_from"))
        v = self._norm(vod)
        v.update({
            "vod_play_from": play_from,
            "vod_play_url": play_url,
            "vod_play_note": vod.get("vod_play_note") or "",
        })
        return {"list": [v]}

    def searchContent(self, key, quick=False, pg="1"):
        try:
            page = int(pg)
        except Exception:
            page = 1
        raw = self.src.vod_list(wd=key, page=page)
        out = {"list": [self._norm(v) for v in normalize_list(raw)]}
        out.update(self._page_info(raw, page))
        return out

    def playerContent(self, flag, id, vipFlags=None):
        """返回真实播放地址。直链直接返回；播放页先解析成 m3u8 再返回。

        解析失败返回 {}（空 = 明确失败），绝不返回原 share 页地址——播放器
        拿到无扩展名地址会黑屏或误走 WebView。
        """
        if not id:
            return {}
        real = resolve_play_url(id)
        if not real:
            return {}
        return {"parse": 0, "url": real}

    def destroy(self):
        pass


# TVBox 宿主按类名 Spider 加载；本地 import 时也以 Spider 为名暴露。
Spider = YstjSpider


# ---------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description="影视追剧资源提取 / Python 播放器")
    ap.add_argument("--src", default=DEFAULT_SRC, help="源: " + "/".join(DEFAULT_SOURCES))
    ap.add_argument("--sources", action="store_true", help="列出所有源")
    ap.add_argument("cmd", nargs="?", default="list",
                    choices=["list", "cats", "search", "ep", "play", "dump", "detail", "probe", "sources", "repl"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--page", type=int, default=1)
    ap.add_argument("--type", type=int, default=0, help="type_id")
    ap.add_argument("--player", default=None)
    ap.add_argument("--hw", action="store_true", help="启用硬件解码（ffplay -hwaccel auto / mpv --hwdec=auto）")
    ap.add_argument("--quality", default=None, choices=["low", "mid", "high", "auto"],
                    help="多码率档位，低配/单核用 low")
    a = ap.parse_args()

    srcs = load_sources()
    if a.cmd == "sources":
        for k, v in srcs.items():
            print(f"{k:8s} {v.get('type'):4s} {v.get('base')}")
        return

    if a.src not in srcs:
        print("未知源:", a.src, "可选:", ", ".join(srcs))
        return
    src = Source(a.src, srcs[a.src])

    if a.cmd == "repl":
        repl(src, a.hw, a.quality)
        return

    if a.cmd == "probe":
        try:
            r = src.vod_list(type_id=1, page=1)
            lst = normalize_list(r)
            print(f"[{a.src}] OK  返回 {len(lst)} 条  原始响应头字段={list(r)[:5] if isinstance(r, dict) else type(r)}")
            if lst:
                show_vod(lst[0])
        except Exception as e:
            print(f"[{a.src}] 失败: {e}")
        return

    if a.cmd == "cats":
        r = src.cats()
        for c in normalize_list(r):
            print(f"{c.get('type_id'):>5}  {c.get('type_name') or c.get('name')}")
        return

    if a.cmd in ("list", "search"):
        wd = a.args[0] if a.args else None
        if a.cmd == "search" and not wd:
            print("用法: search 关键词")
            return
        r = src.vod_list(type_id=a.type, page=a.page, wd=wd)
        lst = normalize_list(r)
        if not lst:
            print("没有数据。原始响应:", json.dumps(r, ensure_ascii=False)[:300])
            return
        for i, v in enumerate(lst, 1):
            show_vod(v, i)
        return

    if a.cmd in ("ep", "detail", "dump", "play"):
        if not a.args:
            print("用法: ep|dump|play <vod_id> [集号]")
            return
        vid = a.args[0]
        r = src.detail(vid)
        lst = normalize_list(r)
        vod = lst[0] if lst else (r.get("data") if isinstance(r, dict) else None)
        if not isinstance(vod, dict):
            print("未取到详情:", json.dumps(r, ensure_ascii=False)[:300])
            return
        eps = parse_play_url(vod.get("vod_play_url"))
        print(f"《{vod.get('vod_name')}》 {vod.get('vod_remarks') or ''}  共 {len(eps)} 集")
        for i, e in enumerate(eps, 1):
            tag = "直链" if e["kind"] == "direct" else "需解析"
            print(f"  {i:>3}. [{e['name']}][{tag}]{'' if e['group'] == 0 else ' 线路' + str(e['group'] + 1)}  {e['url'][:90]}")
        if a.cmd == "dump":
            out = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"vod_{vid}.m3u")
            with open(out, "w", encoding="utf-8") as f:
                f.write("#EXTM3U\n")
                for e in eps:
                    real = resolve_play_url(e["url"])
                    if real is None:
                        print(f"  跳过无法解析的集: {e['name']} {e['url'][:60]}")
                        continue
                    f.write(f"#EXTINF:-1,{vod.get('vod_name', '')} {e['name']}\n{real}\n")
            print("已导出:", out)
        if a.cmd == "play":
            if not eps:
                print("没有可播地址")
                return
            n = int(a.args[1]) if len(a.args) > 1 else 1
            if not (1 <= n <= len(eps)):
                print(f"集号超范围 1..{len(eps)}")
                return
            real = resolve_play_url(eps[n - 1]["url"])
            if real is None:
                print("该集播放页解析失败（可能已失效或被地域拦截），请换直链线路")
                return
            if real != eps[n - 1]["url"]:
                print("解析出真实地址:", real)
            play(real, a.player, a.hw, a.quality)
        return


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
    except RuntimeError as e:
        print("网络/接口错误:", e)
        print("提示: 换个源试试（--src lziapi / dytt / ffzy），或检查该源是否限制了 wd 搜索")
