# 555电影 / wu5mv

合并在统一规则中，也可单独使用本目录 Quantumult X 配置。不要同时启用两份。

依据用户提供的 `5dy4.vip` 首页 HTML 与 CDN JS 源码适配。HTML 删除 `iYmIuMjZyeS5` 编码广告配置、`small-icon-container` 推广网格及 `55kp2.com` / `55dy23.com` 的 `/d1/` 推广链接。JS 仅在指定 CDN 文件和全部源码特征匹配时，将广告配置读取替换为 `null`；保留 jQuery、Swiper、影视轮播、播放历史和其他共用功能。

保留 wu5mv.com / www.wu5mv.com。发布页截图确认 5dy4.vip、555k2.com、555k91.com、55kp8.com、555k58.com；按用户要求，以编号正则扩展 `5dy\d+\.vip`、`55dy\d+\.top`、`(?:555k|55kp)\d+\.com`，均含可选 www。编号变更无需逐一新增；跨域名族和跨后缀不自动覆盖。MITM 对应使用 `5dy*.vip`、`55dy*.top`、`555k*.com`、`55kp*.com` 及 www 前缀，实际重写仍须数字编号与全部模板特征命中。HTML 路由覆盖首页和 `.html` 页面，仍须全部模板特征命中；域名族以外及不匹配源码不改写，普通发布页没有影视模板特征时保留原文。CDN 仅登记一个文件路径，不屏蔽整个 CDN。

首页抓包和 JS 离线校验已完成；当前访问站点返回 502，播放页、第三方解析器广告与手机实际效果尚待验证。不修改 HLS。

## 播放页横幅补充

用户 Safari 播放页捕获确认另一套内联广告：`d693d6351` 配置，`c2f670cd2` / `c2f670cd` 手机横幅容器，以及 `setTimeout(renderContent, 2000)` 延迟渲染。依次删除匹配全部特征的专用内联脚本、配置与容器。保留 `player_aaaa`、`Player555Options` 全部线路、下一集与 `/static/player/videojs10.html` iframe；未检查或修改 iframe 内部广告与媒体流。已验证捕获 DOM 清理及播放信息原样保留，仍须手机刷新页面确认效果。
