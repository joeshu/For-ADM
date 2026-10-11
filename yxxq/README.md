# 影像星球网站去广告

统一订阅已包含本模块。独立版与统一版选择一个启用。

## 核心位置

`/static/js/site-ads.js?v=20260919a` 专门初始化悬浮广告、导航推广、夜间弹窗、广告弹层、曝光统计和手机底部广告。响应仅在 `__MAC_SITE_ADS_READY__` 与 `initFloat`、`initNavAds`、`initAdModal` 四个特征同时存在时替换为无操作正文；HTML 同时删除该脚本入口。

静态广告直接存在于 HTML：导航 `li`、推广卡片 `a`、横幅及播放下方 `div` 使用 `data-ad-slot`。在 maccms、mxpro/home.js、site-ads.js 三个页面特征都存在时删除这些明确标记的完整容器。使用公共标签扫描，不删除 JS 字符串里的伪 HTML，也不按第几个元素删除。

## 范围与保留

覆盖首页、html/play/list/search 页面和站内热门榜路径。65、35 站已取到真实源码；按用户要求，另将发现接口列出的全部 15 个备用地址纳入明确主机清单，35 已存在，合计 16 个主机。新增地址未逐站核验源码或手机播放，沿用三项 HTML、四项 JS 特征校验，缺失时保留原响应。

当前精确主机：

`www.yxxq65.cc`, `www.yxxq35.cc`, `www.yxxq51.cc`, `www.yxxq52.cc`, `www.yxxq53.cc`, `www.yxxq54.cc`, `www.yxxq55.cc`, `www.yxxq56.cc`, `www.yxxq57.cc`, `www.yxxq59.cc`, `www.yxxq61.cc`, `www.yxxq62.cc`, `www.yxxq63.cc`, `www.yxxq64.cc`, `www.yxxq41.cc`, `www.yxxq25.cc`。

发布页 `www.yingxiangxingqiu.cc` 不进入改写，未登记编号及非 www 域名不自动扩展。

保留 `player_aaaa` 全部配置、playerconfig.js、player.js、player-ab-test.js、观看记录、选集、下一集、线路切换、网盘和 site-domain-status-ddys.js。已核验两条播放线路，当前 playerconfig 的 buffer/prestrain 均为空，不修改这些播放器文件。

共享主题 JS 不属于专用广告入口，继续加载。第三方 `svip.qlplayer.cyou` 现由统一订阅中的独立麒麟模块关闭片头和暂停广告入口；影像星球独立版不含解析器规则。保留广告容器，防止播放器对节点的引用报错；不改媒体流或 HLS。

## 验证

以真实首页、详情、两条播放线路和 35 站首页离线改写，核对广告容器删除与播放器脚本、线路链接保留。补充最小回归样例及专用 JS 指纹、未知域名/路径和错误响应保护测试。离线源码检查不能代替 Quantumult X 手机播放实测。

更新统一订阅后刷新远程脚本缓存并重新打开网页。

## 手机详情页补漏

用户提供的 vd61054fb1d39376 详情页以 iPhone UA 获取时，额外存在 MAC_LMGG_SOURCE_MONITOR、MAC_LMGG_COOLDOWN 两段配置和 lmgg-source-monitor.js、lmgg2-after-click.js。后者读取 rawSourceB64，解码后注入 script、临时接管 document.write，并按点击冷却重新注入广告。此前 PC 响应没有此链，导致手机页面漏广告。

现在精确删除两段已确认配置和两个 script/src 入口，专用 JS 响应也在各自四项特征匹配后置为无操作正文，兼容旧 HTML 缓存。仅静态解码检查 Base64 包装，未执行混淆广告。保留域名发现、PWA、观看记录、播放器与线路；不删除全站分析脚本或修改其他属性。覆盖登记的 16 个主机，不改 HLS。用户 URL 的 query 不影响匹配。
