# 追影猫网页广告

已核验首页和 /voddetail/1657047.html。广告直接写入 module-adslist 容器，包含 tf14.huyuetf.net 推广链接。规则移除这些容器，保留外层公告、播放来源和共享 JS。

home.js 是站点功能库，script.js 是混淆主题脚本，index.js 是 UI 库；尚未确认独立广告 JS，不整份清空这些文件。手机 page.html 跳转保留。第三方播放来源和 HLS 不进入规则。离线检查不代替手机实测。
