# ycblcw / 不卡影院 Quantumult X 去广告

2026-10-10，分析真实首页、/bukadt/260.html、/bukapy/260-1-1.html。

## 已定位并处理

- /dedg/cs13341.js：混淆的广告入口，包含动态加载、透明点击层、触摸/点击跳转和 WebSocket 分发逻辑。HTML 删除其 script 引用，同时该 URL 响应重写为空注释，避免旧缓存 HTML 继续加载它。
- app2.zstv47.com 推广链接：首页/播放页的橘子 TV 横幅、APP全集和推广选集、侧边 APP 下载。仅移除对应域名的推广锚点。
- /static/js/player.js、playerconfig.js、player_aaaa、正片 URL、上下集、普通选集全部保留。

## 安装

合并 quantumult-x-snippet.conf 的规则与 MITM hostname，启用重写和 MITM、安装并信任证书。不要覆盖现有域名列表。清理该站缓存后刷新。

也已加入 universal/ad-clean.js 和 universal/quantumult-x-snippet.conf。独立配置与统一配置二选一，不要对同一响应重复应用。

## 验证和限制

已验证真实首页/详情页/播放页：广告入口和推广链接移除，player_aaaa 配置和普通选集链接完全保持；独立与统一脚本语法通过，每个响应只调用一次 $done；播放器两份核心 JS 原样返回。

首页及播放页实际读取 www.ycblcw.com。m.ycblcw.com / ycblcw.com 已列入规则，但未独立核验所有页面模板。

已读取 playerconfig.js：second 为 0，prestrain 和 buffer 为空。部分线路使用 tv.qingning77.com 的第三方解析页；未确认其广告实现，没有屏蔽解析域名或删除视频分片。此版不能承诺去除所有视频广告，更不处理画面中烧录的广告。尚未在手机 Quantumult X 实播验证。
