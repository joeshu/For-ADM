# CCTVHost 独立影视源合集

主合集现在包含 19 个 CatVod / TVBox JavaScript 影视源、28 个 Python Spider（其中 9 个 Hawk 源已做运行与取流验证，影视追剧于 2026-11-06 加入并通过本地接口验证，2026-11-13 又加入 17 个经五道者聚合实测可用的 PY 源，同日又加入 8 个经初忆 TVBox 配置实测可用的 JS 源和 1 个签名已还原的片帝源，晚间又加入 2 个 HyProto 签名源（河豚/小苹果，协议已还原、加密自检全过，本机 POST 被挡待 iPhone 实测）），以及 1 个由 iOS 原生实现的豆瓣片名索引。每个独立影视源都使用单独的适配文件；电视盒子 Python/Java 插件包中的 Android JAR 不会被当成 iOS 脚本执行。

## CCTVHost 统一合集导入

在 CCTVHost 中打开「资源 → 添加资源 → TVBox 配置 → 从 URL 导入」，粘贴下面这个**合集 JSON**地址：

```text
https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/For-ADM.json
```

导入后 CCTVHost 会显示 48 个条目：19 个 CatVod / TVBox JavaScript 源、28 个 Python Spider 和豆瓣片名索引。合集只保存索引，不会批量执行脚本；选择一个站点后才下载和检查对应文件。新增 PY 文件放在 `python-spiders/`，需由支持 Python Spider 的 CCTVHost 版本运行。豆瓣索引映射到应用内置的 `csp_DouDou`，负责跨源找片名，本身不提供视频流。iOS 修复版 JS 入口带 `v=3`，会触发八站点脚本更新，并避免将加密 WebP 封面送入图片解码器；一起看按请求预算终止超时请求，电影猎手会校验 HLS 清单。升级时先移除本地旧合集，再导入同一地址；选择站点后点“导入并打开资源”。文件是 CCTVHost 的 TVBox `sites` 清单格式，不是 Forward/Rex 的 `.fwd` 格式。

Forward/Rex 用户可使用 [For-ADM.fwd](For-ADM.fwd) 订阅 `widget/` 中的旧版 Widget 资源解析器。它们与 TVBox JSON 里的完整影视源脚本分开，避免 CCTVHost 将完整站点错误识别成只支持搜索的资源解析器。

| CatVod / TVBox 脚本 | 来源 | 实现方式 |
| --- | --- | --- |
| `kkapp.js` | 可可影视 | 原站签名接口、访客会话和播放 API |
| `ncat.js` | 网飞猫 | 独立 appId、源站和会话命名空间 |
| `happ.js` | 好好看 | 独立 appId、源站和会话命名空间 |
| `yqk.js` | 一起看 | CCTVHost 原生站点组件，独立 API 配置 |
| `qntv.js` | 青柠 TV | 与一起看分开的站点组件、appId 和会话 |
| `dyls.js` | 电影猎手 | 原站 RSA/HMAC 请求协议、公开解析接口和原站媒体请求头 |
| `souju.js` | 搜剧 AI | 独立访客会话、签名接口和分集播放线路 |
| `kanju.js` | 看剧 AI | 独立公开目录接口和授权线路解析 |
| `tegou.js` | 特狗影视 | MacCMS；首页/分类/搜索/详情实测通，播放 m3u8 本机 451，需 iPhone 实测 |
| `fdzy.js` | 饭搭子影视 | MacCMS；首页/分类/搜索/详情实测通，播放地址本机 403，需 iPhone 实测 |
| `rejutv.js` | 热剧TV | MacCMS；首页/分类/搜索/详情实测通，播放 m3u8 本机 404，需 iPhone 实测 |
| `nongmin.js` | 农民影视 | MacCMS；首页/分类/详情实测通，搜索模板缺失；西瓜线路 m3u8 本机 200 |
| `yingxiang.js` | 映像星球 | MacCMS；首页/分类/搜索/详情实测通，播放地址本机 403/404，需 iPhone 实测 |
| `jianpian.js` | 荐片 | JSON API；首页/分类/搜索/详情实测通，播放 m3u8 本机连不上，需 iPhone 实测 |
| `sikv4k.js` | 4K影视 | 浏览型；播放地址由站内 WASM 签名生成，未复现，适配器不提供播放地址 |
| `luoxue.js` | 洛雪TV | TMDB 推荐浏览型；播放需原站解析流程，适配器不提供播放地址 |
| `piandi.js` | 懂片帝 | HMAC-SHA256 签名（与看剧 AI 同族）；首页/分类/搜索/详情/解析全链实测通，官方线路 m3u8 本机 200 |
| `hetun.js` | 河豚4K | HyProto protobuf + RSA/AES 签名；协议已还原，AES/RSA/请求体与 Python 逐字节对过，模拟链路全通；本机 POST 到裸 IP 后端被挡，zone 未验证，需 iPhone 实测 |
| `xpg.js` | 小苹果 | HyProto protobuf + RSA/AES 签名；与河豚同族，独立公钥/密钥/列表端点；本机 POST 被挡，zone 未验证，需 iPhone 实测 |

### Hawk Python Spider 源

从提供的 Hawk iOS 内部影视与 PY 聚合包中逐个检查了 46 个 Python 文件。下面 9 个在 CCTVHost PythonSpider 兼容运行环境里有可用的首页/详情/分集数据，并至少有一条媒体路线通过清单或媒体探测、分片读取及 FFmpeg 首帧解码。另有影视追剧（`python-spiders/ystj.py`，2026-11-06 加入）通过本地 Spider 接口验证（32/32），直链 m3u8 需用户网络验证。其它脚本的单项运行情况和未收录原因列在验证记录中。单次可播样本不代表该站每个剧集、线路或网络环境都可用；上游域名、签名地址和访问策略会变化。2026-11-13 又从五道者海量 py 聚合接口实测加入 17 个 PY 源（下表新增行；本机只验播放地址可达，最终播放需 iPhone 确认；哔哩直播的两个来源文件内容相同，只收了一个）。

| Python Spider | 文件 | 本次媒体验证 |
| --- | --- | --- |
| 多多影视 | `python-spiders/duoduo.py` | HLS 清单、分片及 H.264 首帧 |
| 风尚影视 | `python-spiders/fengshang.py` | HLS 清单、分片及 H.264 首帧 |
| 君念影院 | `python-spiders/junnian.py` | HLS 清单、分片及 H.264 首帧 |
| 好好看 | `python-spiders/haokankan.py` | HLS 清单、分片及 H.264 首帧 |
| 茶杯狐 | `python-spiders/chabeihu.py` | HLS 清单、分片及 H.264 首帧 |
| 嘀嗒影视 | `python-spiders/dida.py` | 媒体分片及 H.264 首帧（上游使用非标准 `.image` 地址） |
| 豆花影视 | `python-spiders/douhua.py` | HLS 清单、分片及 H.264 首帧 |
| 麒麟影视 | `python-spiders/qilin.py` | HLS 清单、分片及 H.264 首帧 |
| 努努影院 | `python-spiders/nunu.py` | HLS 清单、分片及 H.264 首帧 |
| 影视追剧 | `python-spiders/ystj.py` | 本地 Spider 接口 32/32；直链 m3u8 需用户网络验证 |
| 大师兄影音 | `python-spiders/dsxys8.py` | 本地 Spider 接口验证通过；网站被 Cloudflare 挡住，本机 0 项，需 iPhone 实测 |
| 爱瓜TV | `python-spiders/aigua.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |
| 布布追剧 | `python-spiders/bubuzhuiju.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |
| 短剧 | `python-spiders/shortfilm.py` | 2026-11-13 五道者聚合实测：整条链通，播放 mp4 HTTP 200 |
| 七星短剧 | `python-spiders/qixing.py` | 2026-11-13 五道者聚合实测：整条链通，播放 mp4 HTTP 200 |
| 七猫短剧 | `python-spiders/qimao.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |
| 世界听书 | `python-spiders/shijietingshu.py` | 2026-11-13 五道者聚合实测：整条链通，播放 mp4 HTTP 200（听书） |
| 剧下饭 | `python-spiders/juxiafan.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |
| 咕噜 | `python-spiders/gulu.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |
| 哔哩直播 | `python-spiders/bilizhibo.py` | 2026-11-13 五道者聚合实测：整条链通，直播流 HTTP 200 |
| 多多1920 | `python-spiders/duoduo1920.py` | 2026-11-13 五道者聚合实测：整条链通，解析地址返回 JSON HTTP 200 |
| 央库云 | `python-spiders/yangkuyun.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200（央视） |
| 央视 | `python-spiders/yangshi.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200（央视） |
| 央视影视 | `python-spiders/yangshiyingshi.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200（央视） |
| 妙看 | `python-spiders/miaokan.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |
| 影探4K | `python-spiders/yingtan4k.py` | 2026-11-13 五道者聚合实测：整条链通，视频流 HTTP 200 |
| 星芽短剧 | `python-spiders/xingya.py` | 2026-11-13 五道者聚合实测：整条链通，播放 mp4 HTTP 200 |
| 瓜子影视 | `python-spiders/guazi.py` | 2026-11-13 五道者聚合实测：整条链通，播放 m3u8 HTTP 200 |

详细范围、未收录脚本和限制见 [Hawk PY 验证记录](Hawk-PY-VALIDATION.md)。

`kkapp.js`、`ncat.js` 和 `happ.js` 由 `generic-site.template.js` 生成到 `widget/`，TVBox 主脚本由适配器构建生成。三源会先用短超时探测同组图片镜像，只选择返回普通 `image/*` 且无 `Encrypted: 1` 标记的镜像；没有明文镜像时不伪装密文封面为可显示图片。修改通用请求逻辑后执行：

```sh
cd ios-app
npm run build:cctvhost
npm run test:cctvhost
```

`widget/` 子目录保留 Forward/Rex 兼容的旧版 Widget 解析脚本。TVBox 主脚本由这些原始适配器生成，并附带 CCTVHost 的 CatVod 接口层；更新源站适配时先修改 `widget/` 对应原文件，再运行构建命令生成主合集脚本。测试会模拟 CCTVHost 的首页、分类、搜索、详情和播放调用，并验证导入识别协议、播放线路和站点隔离。

脚本只使用各站点公开接口返回的数据和播放地址；站点账号、付费或地区权限仍由源站控制。返回的临时播放地址可能因接口版本、网络环境和具体片源而变化。

Python 播放验证运行在 Linux CPython 的 CCTVHost 兼容运行时，并用 FFmpeg 对样本视频解码出首帧；尚未在 iPhone 真机对这些上游站点逐个做 AVPlayer 验收。HTTP/HLS 可访问不代表该站所有内容都能播放。
