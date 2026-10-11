# 影像星球网站去广告

统一订阅已包含本模块。独立版与统一版选择一个启用。

## 核心位置

`/static/js/site-ads.js?v=20260919a` 专门初始化悬浮广告、导航推广、夜间弹窗、广告弹层、曝光统计和手机底部广告。响应仅在 `__MAC_SITE_ADS_READY__` 与 `initFloat`、`initNavAds`、`initAdModal` 四个特征同时存在时替换为无操作正文；HTML 同时删除该脚本入口。

静态广告直接存在于 HTML：导航 `li`、推广卡片 `a`、横幅及播放下方 `div` 使用 `data-ad-slot`。在 maccms、mxpro/home.js、site-ads.js 三个页面特征都存在时删除这些明确标记的完整容器。使用公共标签扫描，不删除 JS 字符串里的伪 HTML，也不按第几个元素删除。

## 范围与保留

仅覆盖已取到真实源码的 `www.yxxq65.cc`、`www.yxxq35.cc`，首页、html/play/list/search 页面和站内热门榜路径。发布页 `www.yingxiangxingqiu.cc` 与发现接口列出的其他备用域名不自动加入。

保留 `player_aaaa` 全部配置、playerconfig.js、player.js、player-ab-test.js、观看记录、选集、下一集、线路切换、网盘和 site-domain-status-ddys.js。已核验两条播放线路，当前 playerconfig 的 buffer/prestrain 均为空，不修改这些播放器文件。

共享主题 JS 不属于专用广告入口，继续加载。第三方 `svip.qlplayer.cyou` 解析器尚未核验，本模块不处理其内部广告；不改媒体流或 HLS。

## 验证

以真实首页、详情、两条播放线路和 35 站首页离线改写，核对广告容器删除与播放器脚本、线路链接保留。补充最小回归样例及专用 JS 指纹、未知域名/路径和错误响应保护测试。离线源码检查不能代替 Quantumult X 手机播放实测。

更新统一订阅后刷新远程脚本缓存并重新打开网页。
