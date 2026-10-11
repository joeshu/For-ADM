# 一起看影院 eboyang 网页去广告

已合并进统一规则，同时生成独立规则。默认关闭日志，不处理 HLS。统一版与独立版择一启用。

统一规则：<https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/quantumult-x-snippet.conf>

独立规则：<https://raw.githubusercontent.com/joeshu/For-ADM/master/eboyang/quantumult-x-snippet.conf>

## 源码定位

| 位置 | 确认行为 | 处理 |
| --- | --- | --- |
| `/dedg/le1008.js` | Base64 包装的专用广告加载器：底部固定透明网格、body 底部留白、touchend 跳转，按日期/小时拼接外部 HTTP/WebSocket 地址 | 源码包装特征及末尾 le1008 标记同时匹配才置为无副作用注释；HTML 删除对应 script/src 入口 |
| 页面 `a[href]` 指向 `app3.qingning9.com` | 橘子 TV 下载、首页推广横幅、播放页应用推广和 APP 全集链接 | 仅删除该主机的完整链接元素，保留同区域的播放器和站内选集 |

2026-10-11 核验首页、`/bovod/3896.html`、`/bovideo/3896-1-0.html` 与真实广告 JS。静态 Base64 解码确认广告配置、占位层、点击和回退脚本逻辑，没有执行广告代码。广告加载器当前使用 nfesms.gzgnzk.com 和 w8fsd.gzgnzk.com 加日期前缀，但无需为这些动态广告域名新增 MITM。

裸域实测跳转到 www。正式范围为 eboyang.com / www.eboyang.com：首页、index.html、数字 bovod/bovideo/vodlist 页面、search.php/gbook.php 与上述专用 JS。HTML 须同时含“一起看影院”和 `/templets/qiqino5/` 模板标记；不扩到其他站点或整个 dedg/js 目录。

`caonima.js` 为混淆模块，未确认是专用广告，保留。common.js、function.js、play.js、历史记录与其他模板 JS 保留。类名 guanggaokuang 的本站收藏提示也保留，避免凭广告命名误删功能内容。

实际页面验证：移除 le1008 入口和推广链接后，其他所有 script 元素原样保留；播放页 cciframe、now/next 源地址、nextPage、选集内容保留。真实 le1008 响应符合源码特征并被禁用。源变化、相似域名、未知路径、错误响应及媒体路径均有放行检查。

`/js/player/vip.html` 将播放源交给 tv.qingning88.com 的播放器；本次查看的外部播放器使用 Video.js，错误提示点击可推广应用。统一订阅现含独立清宁解析器模块，精确取消其错误提示点击 APP 推广；eboyang 独立版不含该解析器规则。源地址、签名、媒体内容保持原样。源码验证不能替代 iPhone 上播放、切换线路和下一集实测。

更新后刷新 Quantumult X 规则和远程脚本缓存，再重新打开页面。
