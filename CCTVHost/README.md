# CCTVHost 独立影视源合集

主合集现在包含 37 个 CatVod / TVBox JavaScript 影视源、164 个 Python Spider、2 个 Android JAR（csp_*）影视源（2026-11-15 由用户上传的 3.3.8 TVBox 配置加入：fix250711.jar，jar-bridge 在应用内跑 JVM 执行，ext 由应用内 TVBoxDecodeQiaojiExt 解码；三六零 2 站按用户 2026-11-13 的下架决定未加入，零度 lingdu.py 因 401 拿不到未加入），以及 1 个由 iOS 原生实现的豆瓣片名索引。JS/PY 源使用单独的适配文件；JAR 源共用一个 fix250711.jar（`CCTVHost/jar/fix250711.jar`，md5 54418536dc2a40da4e94437397895d01，应用会校验 md5，不符会报“JAR 的 MD5 与订阅不符”），由应用的 jar-bridge 执行，不当成 iOS 脚本。

## CCTVHost 统一合集导入

在 CCTVHost 中打开「资源 → 添加资源 → TVBox 配置 → 从 URL 导入」，粘贴下面这个**合集 JSON**地址：

```text
https://raw.githubusercontent.com/joeshu/For-ADM/data/CCTVHost/For-ADM.json
```

导入后 CCTVHost 会显示 204 个条目：37 个 CatVod / TVBox JavaScript 源、164 个 Python Spider、2 个 JAR（csp_*）源和豆瓣片名索引。合集只保存索引，不会批量执行脚本；选择一个站点后才下载和检查对应文件。新增 PY 文件放在 `python-spiders/`，需由支持 Python Spider 的 CCTVHost 版本运行。豆瓣索引映射到应用内置的 `csp_DouDou`，负责跨源找片名，本身不提供视频流。iOS 修复版 JS 入口带 `v=3`，会触发八站点脚本更新，并避免将加密 WebP 封面送入图片解码器；优酷·腾讯·芒果三擎聚合已改名重建为 youkutengxunmangguo（新 key 强制 App 重新下载，否则会一直用旧缓存，看不到芒果）；一起看按请求预算终止超时请求，电影猎手会校验 HLS 清单。升级时先移除本地旧合集，再导入同一地址；选择站点后点“导入并打开资源”。文件是 CCTVHost 的 TVBox `sites` 清单格式，不是 Forward/Rex 的 `.fwd` 格式。

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
| `hetun.js` | 河豚4K | HyProto protobuf + RSA/AES 签名；协议已还原，AES/RSA/请求体与 Python 逐字节对过，模拟链路全通；2026-11-13 本机实测配置 + zone 已通（之前裸 IP POST 被挡是暂时的） |
| `xpg.js` | 小苹果 | HyProto protobuf + RSA/AES 签名；与河豚同族，独立公钥/密钥/列表端点；2026-11-13 本机实测：zone 已能到达服务端，但字符串时间戳被拒（1008），改数字时间戳后 RSA 解密失败（100002）——服务端 RSA 公钥已轮换，需新版客户端里的当前公钥才能恢复 |
| `huayi.js` | 华谊 | HyProto（与河豚同族：同密钥、同后端 43.240.158.154:18004）；配置 + zone 本机实测通，模拟链路全通 |
| `bubu.js` | 布布 | SHA-256 签名（web-sign 常量 + 站内 WASM 复现的 protobuf 解码签名）；首页/分类/搜索/详情/解析全链实测通，ZJ4K 线 m3u8 本机 200 |
| `jili.js` | 吉里动漫 | JSON API；全链实测通，播放 m3u8 本机 206（51KB 真清单） |
| `huazi.js` | 花子动漫 | JSON API；首页/分类/详情/解析实测通（解析出带签名的 mp4 地址，本机 403 系 CDN 地区限制）；搜索需验证码，需 iPhone 确认 |
| `ikanbot.js` | 爱看机器人 | 抓站 + /api/getResN（token 推导已破译）；首页/分类/搜索/播放页实测通，两条 m3u8 本机 200；/play/ 后被 Cloudflare 挑战，需 iPhone 实测 |
| `xingchen.js` | 星辰影视 | 抓站；全链实测通，播放 m3u8 本机 200 |
| `fanshe.js` | 番社动漫 | 规则抓站（哆啦A梦专站）；全链实测通，播放 m3u8 本机 206（AES-128 分片） |
| `wangzi.js` | 王子 | AppGet 签名已还原；全链实测通，搜仙逆 17 条、18 线、RY 线 m3u8 本机 200 |
| `juquan99.js` | 剧圈99 | App99 签名已还原（SHA-256，AES 密钥=uuid）；全链实测通，搜仙逆 7 条、9 线、解析出真 MP4 |
| `banri99.js` | 半日99 | App99 同族；全链实测通，搜仙逆 21 条、NBY 解析 m3u8 本机 200 |
| `yiqi.js` | 一起影视 | MD5 签名已还原；全链实测通，12 线里 6 条 m3u8 HEAD 200 |
| `hanquan.js` | 韩圈 | MD5 签名已还原；全链实测通，解析出直链 m3u8（200、33KB 真清单）；搜索本机全空，需手机复测 |
| `xiqu.js` | 戏曲多多 | 所谓 MD5 签名根本不存在（md5 头是固定常量）；全链实测通，播一集 m3u8 本机 200 |
| `weiguan.js` | 围观短剧 | 无请求签名；全链实测通，88 集全免费、播一集 mp4 本机 206 |
| `bashi.js` | 巴士动漫 | key/t 播放页 iframe 现取现用（9 分钟后复用会 403）；全链实测通，播一集 QQ MP4 206 + ftyp 校验 |
| `guluapp.js` | 咕噜（APP） | 原生 ECDH 握手 + HMAC 会话密钥 + AES-GCM protobuf 全套纯 JS 复现；全链实测通，搜仙逆 28 条、详情 230 集；解析站日配额已用完，需手机复测 |
| `hema.js` | 河马短剧 | host 藏在 helper 类里（freevideo.zqqds.cn），AES-CBC 协议已还原；全链实测通，播两集 mp4（206 + ftyp 校验） |
| `m1905.js` | 1905 | 1905电影网官方 JSON 接口 + play-info SHA-1 签名；列表/搜索/详情本机实测通，播放接口本机出口 IP 403（边缘访问控制），签名正确性待用户 iPhone 实测 |

### JAR（Android csp_*）源

2026-11-15 由用户上传的 3.3.8 TVBox 配置加入（fix250711.jar，jar-bridge 执行，ext 应用内解码）。全部标 [需手机测]，待 iPhone 实测。

| JAR 源 | 后端类 | ext |
| --- | --- | --- |
| [需手机测]💡柠檬｜影视（JAR） | `csp_Nmvod` | 92 字符（`7lj763gg…`，应用内解码） |
| [需手机测]客星┃App（JAR） | `csp_Xdai` | 128 字符（`7lj763gg…`，应用内解码） |
### Hawk Python Spider 源

从提供的 Hawk iOS 内部影视与 PY 聚合包中逐个检查了 46 个 Python 文件。下面 9 个在 CCTVHost PythonSpider 兼容运行环境里有可用的首页/详情/分集数据，并至少有一条媒体路线通过清单或媒体探测、分片读取及 FFmpeg 首帧解码。另有影视追剧（`python-spiders/ystj.py`，2026-11-06 加入）通过本地 Spider 接口验证（32/32），直链 m3u8 需用户网络验证。其它脚本的单项运行情况和未收录原因列在验证记录中。单次可播样本不代表该站每个剧集、线路或网络环境都可用；上游域名、签名地址和访问策略会变化。2026-11-13 又从五道者海量 py 聚合接口实测加入 17 个 PY 源（下表新增行；本机只验播放地址可达，最终播放需 iPhone 确认；哔哩直播的两个来源文件内容相同，只收了一个）。2026-11-14 又从 py400.zip 加入 119 个 PY 源（下表新增行；其中 100 个验证通过（71 个本地整条链路验证通过 + 29 个 iPhone 实测通过），名前缀[通过]；17 个 iPhone 实测不通过的已从订阅删除；YouTube、怦然心动 2 站按用户要求剔除；大马猴、野果短剧、可可、可可影视经用户明确解禁加回）。

| Python Spider | 文件 | 本次媒体验证 |
| --- | --- | --- |
| 多多影视 | `python-spiders/duoduo.py` | HLS 清单、分片及 H.264 首帧 |
| 风尚影视 | `python-spiders/fengshang.py` | HLS 清单、分片及 H.264 首帧 |
| 君念影院 | `python-spiders/junnian.py` | HLS 清单、分片及 H.264 首帧 |
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
| 橘汁 | `python-spiders/juzi.py` | 蝴蝶 juziapp（HyProto 签名）；2026-11-13 实测：登录/zone/搜索/详情/解析通，5 条线 4 条本机可播（MP4/m3u8 均为 200，神话蓝光 403），分类当日为空，需 iPhone 确认 |
| [通过]1234影视 | `python-spiders/1234yingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]28短剧 | `python-spiders/28duanju.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]57短剧 | `python-spiders/57duanju.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]618（18+） | `python-spiders/618.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]99影視TV261030 | `python-spiders/99yingshitv261030.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]爱看机器人 | `python-spiders/aikanjiqiren.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]AnimeSex（18+） | `python-spiders/animesex.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]AVGC9（18+） | `python-spiders/avgc9.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]avjoy（18+） | `python-spiders/avjoy.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]白嫖之王（18+） | `python-spiders/baipiaozhiwang.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]八戒影视 | `python-spiders/bajieyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]哔哩直播 | `python-spiders/bilizhibo2.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]B里B里（18+） | `python-spiders/blibli.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]Cam4直播 | `python-spiders/cam4zhibo.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]cat3movie | `python-spiders/cat3movie.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]茶杯狐 | `python-spiders/chabeihu2.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]吃瓜网（18+） | `python-spiders/chiguawang.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]袋鼠影视 | `python-spiders/daishuyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]大马猴 | `python-spiders/damahou.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]电影天堂 | `python-spiders/dianyingtiantang.py` | 2026-11-14 py400深挖：修复版，播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]蝶卡影视 | `python-spiders/diekayingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]短剧大全 | `python-spiders/duanjudaquan.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]独播库 | `python-spiders/duboku.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]多多影视 | `python-spiders/duoduoyingshi.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]多瑙影院 | `python-spiders/duonaoyingyuan.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]E佬苹果 | `python-spiders/elaopingguo.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]eporner大站（18+） | `python-spiders/epornerdazhan.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]饭搭子影视 | `python-spiders/fandaziyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]饭团影视 | `python-spiders/fantuanyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]飞快TV | `python-spiders/feikuaitv.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]getav（18+） | `python-spiders/getav.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]瓜子 | `python-spiders/guazi2.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]瓜子APP | `python-spiders/guaziapp.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]瓜子原生 | `python-spiders/guazi3.py` | 2026-11-15 用户上传的瓜子原生 App 版（RSA PKCS#1 v1.5 解密，需 CCTVHost 1.36+）：整条链路本机验证通过，播放 m3u8 HTTP 200（1080p），5 条线（瓜子专线/蓝光/极速/备线/云播） |
| [通过]果果短剧 | `python-spiders/guoguoduanju.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]哈密瓜 | `python-spiders/hamigua.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]hanime（18+） | `python-spiders/hanime.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]河马短剧 | `python-spiders/hemaduanju.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]河马剧场1 | `python-spiders/hemajuchang.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [需手机测]河马剧场2 | `python-spiders/hemajuchang2.py` | 2026-11-15 用户上传版：首页/分类本机通，搜索空（后端 kuaikaw/kydco 本机连不上），需 iPhone 实测 |
| [需手机测]红果短剧 | `python-spiders/hongguo.py` | 2026-11-15 用户上传的优化版（r6，1.0.5-cctvhost-r6，与仓库内置版字节一致；2026-11-12 本机实测第 28 集 5 档、MP4 200；本次因本机出口连不上红果 API 而未复测，需 iPhone 实测） |
| [需手机测]大师兄原生 | `python-spiders/dsxyuansheng.py` | 2026-11-15 用户上传的大师兄原生 App 版：首页/分类/搜索/详情本机通（5 条线），播放因本机连不上播放代理而超时，需 iPhone 实测 |
| [需手机测]菠菜园 | `python-spiders/bocaiyuan.py` | 2026-11-15 用户上传：首页通，分类/搜索因本机连不上 MacCMS 源而超时，需 iPhone 实测；注意文件内含写死的测试流兜底数据，源站不通时会播出测试片 |
| [需手机测]爱奇艺 | `python-spiders/aiqiyi.py` | 2026-11-15 修复版重测 PARTIAL：首页 37 条、详情《折月亮》24 集本机通；分类 0 条（服务端风控空响应）、搜索 403、播放走第三方解析未验证，需 iPhone 实测搜索/分类/播放 |
| [通过]黄豆短剧（18+） | `python-spiders/huangdouduanju.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]华谊影视 | `python-spiders/huayiyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]蝴蝶影院 | `python-spiders/hudieyingyuan.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]蝴蝶影院（内置去广告）安卓版本 | `python-spiders/hudieyingyuanneizhiquguanggaoanzhuobanben.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]JavDay（18+） | `python-spiders/javday.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]javheo（18+） | `python-spiders/javheo.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]经典老片（18+） | `python-spiders/jingdianlaopian.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]金牌APP | `python-spiders/jinpaiapp.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]金牌APP-华视影院 | `python-spiders/jinpaiapphuashiyingyuan.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]金牌影院 | `python-spiders/jinpaiyingyuan.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]九合一（18+） | `python-spiders/jiuheyi.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]巨婴云播（18+） | `python-spiders/juyingyunbo.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]橘汁视频 | `python-spiders/juzhishipin.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]咖啡直播 | `python-spiders/kafeizhibo.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]开端影视 | `python-spiders/kaiduanyingshi.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]看剧AI | `python-spiders/kanjuai.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]看剧AI19 | `python-spiders/kanjuai19.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]看剧AI2 | `python-spiders/kanjuai2.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]看戏影视 | `python-spiders/kanxiyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]可可 | `python-spiders/keke.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]可可影视 | `python-spiders/kekeyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]krx18（18+） | `python-spiders/krx18.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]麻豆AI（18+） | `python-spiders/madouai.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]埋堆堆 | `python-spiders/maiduidui.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]美不胜收（免翻）（18+） | `python-spiders/meibushengshoumianfan.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]米饭 | `python-spiders/mifan.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]Missav（免翻）（18+） | `python-spiders/missavmianfan.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]missav全分类版（18+） | `python-spiders/missavquanfenleiban.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]魔法影视 | `python-spiders/mofayingshi.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]泥视频 | `python-spiders/nishipin.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]牛牛短剧 | `python-spiders/niuniuduanju.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]农民影视 | `python-spiders/nongminyingshi.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]片吧 | `python-spiders/pianba.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]pinporn续播流（18+） | `python-spiders/pinpornxuboliu.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]pornav（18+） | `python-spiders/pornav.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]麒麟影视 | `python-spiders/qilinyingshi.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]七貓短劇VIP二破解 | `python-spiders/qimaoduanjuviperpojie.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]青牛影视 | `python-spiders/qingniuyingshi.py` | 2026-11-14 py400深挖：修复版，播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]蜻蜓 FM | `python-spiders/qingtingfm.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]少女破处（18+） | `python-spiders/shaonvpochu.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]神秘电影（18+） | `python-spiders/shenmidianying.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]社区（18+） | `python-spiders/shequ.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]视觉影院 | `python-spiders/shijueyingyuan.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]手鸡助手（18+） | `python-spiders/shoujizhushou.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]sweetpornos（18+） | `python-spiders/sweetpornos.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]TMDB多线影视 | `python-spiders/tmdbduoxianyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]trendypornUS（18+） | `python-spiders/trendypornus.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]玩物社区（18+） | `python-spiders/wanwushequ.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]玩物社区_T3v1.5（18+） | `python-spiders/wanwushequt3v15.py` | 2026-11-14 py400深挖：修复版，整条链路验证通过，播放地址本机探通 |
| [通过]悟圣短剧 | `python-spiders/wushengduanju.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]咸鱼影视 | `python-spiders/xianyuyingshi.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]小苹果 | `python-spiders/xiaopingguo.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]喜福短剧 | `python-spiders/xifuduanju.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]星梦Asmr（18+） | `python-spiders/xingmengasmr.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]欣欣影视 | `python-spiders/xinxinyingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [通过]xx9已过验证（18+） | `python-spiders/xx9yiguoyanzheng.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]夜勾心事（18+） | `python-spiders/yegouxinshi.py` | 2026-11-14 py400首轮：整条链路验证通过，播放地址本机探通 |
| [通过]野果短剧 | `python-spiders/yeguoduanju.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]一起刷 | `python-spiders/yiqishua.py` | 2026-11-14 py400深挖：整条链路验证通过，播放地址本机探通 |
| [通过]直播 | `python-spiders/zhibo.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]追剧达人 | `python-spiders/zhuijudaren.py` | 2026-11-14 py400重测：整条链路验证通过，播放地址本机探通 |
| [通过]ZIP0影视 | `python-spiders/zip0yingshi.py` | 2026-11-14 py400深挖：播放地址真实，本机 CDN 被挡，需 iPhone 实测 |
| [需手机测]优酷·腾讯·芒果三擎聚合 | `python-spiders/youkutengxunmangguo.py` | 2026-11-15 用户上传的三合一（优酷+腾讯+芒果）；2026-11-15 修复腾讯跳网页：新增官方 getinfo 直链（parse=0，MP4 直链本机验证通过），VIP/地区受限仍走网页兜底；优酷 UPS 直出 m3u8 本机验证通过；芒果官方 tk2 直链（parse=0）+ 分集只留正片（isIntact=1，过滤第 N 集看点/预告，防播错片）；2026-11-15 再加 MacCMS 同名片源兜底（官源播不了时按片名严格匹配+集号/区间搜豪华/金鹰/光速/极速，校验 #EXTM3U 后才返回，整次解析预算 25 秒；以家人之名 VIP 第 3 集本机验证通过），详情有串剧问题待复核，需 iPhone 实测；2026-11-15 串剧已修（优酷详情不再用 v_getvideo_info，云端线季号感知）；因 App 按 key 缓存旧文件不重新下载，改名重建为 youkutengxunmangguo，旧 youkutengxun 已删 |
| [通过]剧评 | `python-spiders/juping.py` | 2026-11-16 JAR 转 PY（csp_Jpys）：直连后端 m.wxojcopfw.com/mw-movie，无需签名；首页/分类/搜索/详情/播放本机全通（WORKING），m3u8 HTTP 200，仙逆第 1 集可播，需 iPhone 实测；2026-11-16 iPhone 实测通过 |
| [通过]永夜 | `python-spiders/yongye.py` | 2026-11-16 JAR 转 PY（csp_Xdai）：AES 签名+响应解密已还原（http://app1.ystva.com/api.php）；首页/分类/详情/播放本机通，搜索服务端 500（按字节码实现，待服务端恢复），直链 play.phimgood.com 本机 403（Cloudflare 地域屏蔽），需 iPhone 实测播放；2026-11-16 iPhone 实测通过（搜索服务端 500 未验证、播放走直链） |
| [通过]51X（18+） | `python-spiders/51xz.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（51xz.vip） |
| [通过]4K.AI短剧（18+） | `python-spiders/ai4k.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（wyswspqjtr.click） |
| [通过]AI短剧AV（18+） | `python-spiders/aidj.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（aisee10w29.buzz） |
| [通过]AI短剧网（18+） | `python-spiders/aiduanju.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（ai.aiduanjuwang8.cc） |
| [通过]AIHI（18+） | `python-spiders/aihi.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（aihi.cc） |
| [通过]新黄果短剧（18+） | `python-spiders/aimove.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（aimove.click） |
| [通过]AiPorn（18+） | `python-spiders/aipornx.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（aipornx.cc） |
| [通过]AI污短剧（18+） | `python-spiders/aiwu.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（aiwu.ai-wu.cc） |
| [需手机测]AVDB（18+） | `python-spiders/avdb.py` | 2026-11-16 moyi_plugins.zip 实测 PARTIAL：首页/分类/详情/播放本机通，解出带签名直链；探测 403（Cloudflare 校验页，本机出口被拦），需 iPhone 实测（avdbapi.com） |
| [通过]AVHWA（18+） | `python-spiders/avhwa.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（avhwa.com） |
| [通过]AV Today（18+） | `python-spiders/avtoday.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（avtoday.io） |
| [通过]AV研究院（18+） | `python-spiders/avyanjiuyuan.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（avyan2026.lol） |
| [通过]中国X站（18+） | `python-spiders/chinax.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（chinaxmovie.com） |
| [通过]中国X站精选（18+） | `python-spiders/chinaxselecla08.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（chinaxselecla08.xyz） |
| [通过]大奶Ai短剧（18+） | `python-spiders/danai.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（danai88.cc） |
| [通过]顶级AI色库（18+） | `python-spiders/dingjiaseku.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（taoquan26s111.cc） |
| [通过]69短剧（18+） | `python-spiders/dj69.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（69dj05.vip） |
| [通过]91短剧（18+） | `python-spiders/dj91.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（app.91dju.cyou） |
| [通过]短剧窝（18+） | `python-spiders/djwo.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（langwonqyl.forum） |
| [通过]AI小视频（18+） | `python-spiders/ficeforand.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（ficeforand.aicjjc.cc） |
| [通过]妇愁者联盟（18+） | `python-spiders/fuchou.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（kkb1.sixnicefczlm.cc） |
| [通过]看裤X（18+） | `python-spiders/kankux.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（kankux.com） |
| [通过]MemoJav（18+） | `python-spiders/memojav.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（memojav.org） |
| [通过]幻影AI（18+） | `python-spiders/sexaix.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（sexaix.top） |
| [通过]探花AV（18+） | `python-spiders/tanhuavip14.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（tanhuavip14.xyz） |
| [通过]X红颜（18+） | `python-spiders/xhongyan.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（xhongyan.com） |
| [通过]金果短剧（18+） | `python-spiders/jinguo.py` | 2026-11-16 moyi_plugins.zip 实测 WORKING：首页/分类/详情/播放本机全通，直链 HTTP 200（play.jinguoduanju.app）；内容核实为成人站（分类含 NTR/绿帽/后宫），用户确认加入 |

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
