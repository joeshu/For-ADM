# 麒麟解析器去广告

已加入统一订阅，其他站点调用同一个 `svip.qlplayer.cyou/assets/player.js` 时可复用此模块。独立版与统一版择一启用。

## 精确修改

只改 `assets/player.js` 中两处判断：`if (playerConfig.ads.pre_roll.enabled) {` 和 `if (playerConfig.ads.pause.enabled) {` 改为恒 false。片头广告因此走原有 `resolveVideo()` → `initPlayer(url, type)` 分支，不执行倒计时、素材加载及广告点击绑定；暂停广告不注册 pause/play 广告事件。

修改前要求 init、showPreRoll、showPauseAd、直接解析和初始化五个源码特征全部存在，两处判断均恰好一次；缺失或重复则整组保留原文。错误响应、其他主机或路径保留。

保留整个播放器文件的其余源码，包括广告容器与未执行函数，避免破坏 DOM 引用。HTML、auth.js、security.js、解析 API、videoUrl/apiToken、弹幕、投屏、下一集和媒体流均不修改。没有 HLS 改写。

## 验证边界

抓取真实首页、携带影视地址的解析页和 player.js，确认两个判断及直接播放分支。该次返回的配置中两项广告已经关闭；广告开启场景通过最小运行样例验证直接解析和暂停不注册广告事件，不能当作手机实测。真实 player.js 离线改写后检查只有两处差异、语法有效。

更新订阅后合并新增 MITM 主机并刷新远程脚本缓存，重新打开播放页测试。其他解析器域名须另行核验，不能自动套用。
