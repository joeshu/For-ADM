# 4kvm Quantumult X 去广告

2026-10-10：4kvm.site 是官方地址发布页，当前最新入口为 https://www.4kvms.org/ 。

## 安装

将 quantumult-x-snippet.conf 的 rewrite_local 规则和 mitm hostname 合并到现有配置；启用重写和 MITM，安装并信任 Quantumult X 证书。保留已有 hostname。刷新页面；仍使用旧脚本时清理该站浏览器缓存后重试。

## 已确认的核心位置

- static/js/dist/app.ultra.min.970163a3.js：读取 data-preroll-ad-*，将 this.prerollAdEnabled 设为真，并在 Artplayer plugins 数组中调用 artplayerPluginAds。脚本仅关闭这两个广告开关。
- static/js/artplayer-ads.7b53d681.js：专用前贴片插件，在首次 play / video:playing 时暂停正片，展示广告并倒计时。关闭上游开关后不再创建该插件，不需要阻断播放器脚本。
- HTML 的 .ad-item：首页和播放页横幅。重写移除完整广告 div，并移除 data-preroll-ad-* 属性，阻止广告初始化。

保留 HLS、视频地址、备用线路、选集、弹幕与会员权限。不会伪造会员身份。

## 验证与范围

已用 www.4kvms.org 的真实完整 app JS 和 /play/cgzq7f3tf HTML 验证：改后 JS 语法通过；只修改两个指定广告开关；广告 div 与前贴片属性已移除；视频相关属性保持。尚未在 iPhone Quantumult X 实播验证。其他域名来自官方发布页，未逐个实测其代码版本。

此版处理网站横幅和播放器独立前贴片广告；不处理直接烧录在画面中的广告。未取得可确认的 m3u8 广告分片证据，因此没有添加猜测性分片删除规则。
