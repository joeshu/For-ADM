# 清宁第三方播放器去广告

统一订阅已包含本模块，覆盖 `tv.qingning88.com` 和 `tv.qingning77.com` 的 `/api/publicApi.php` HTML 响应。eboyang 的 vip.html 使用前者，不卡影院 playerconfig 使用后者。两台携带实际播放地址的页面均核验。

当前播放器为 Video.js；已确认的推广入口在错误提示的 click 回调，调用 createSuperLabel 后创建 APP 下载链接并自动点击。仅将带完整推广 URL 和固定元素 ID 的该调用改为无操作表达式，保留错误回调、显示提示、签名播放地址、this.src(url)、this.play()、ended 回调及视频脚本。每个脚本要求四个明确特征和调用恰好一次；不匹配则保留。

无播放地址/错误落地页有两处 APP 下载链接，按完整推广域名删除对应 a 标签。要求已确认的 ds.css、main-v-player-main、ds-video-player-main-sub 页面特征，不删除其他错误文字或帮助链接。HTTP 403/502 保留，主机和接口路径均精确匹配。

不修改签名、鉴权、媒体流或 HLS；未发现可确认的独立片头/暂停广告，不承诺清除后续所有广告。源码离线改写及回归检查通过，手机播放与错误页面交互仍需实测。

统一版与独立版择一启用。更新后合并 MITM 主机并刷新脚本缓存。

真实页面的未加引号 oncontextmenu 属性值含 =，公共 HTML 扫描兼容该值，避免整页保留造成未命中；属性原文不修改，回归样例保留它。
