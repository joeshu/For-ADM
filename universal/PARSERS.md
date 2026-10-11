# 第三方解析器排查登记

2026-10-11，范围为当前统一规则已接入站点；只对能取得正常源码并确认广告行为的播放器生成规则。静态检查不代表全部动态线路已覆盖。

| 来源 | 实际调用/配置 | 结论 |
| --- | --- | --- |
| 影像星球 | svip.qlplayer.cyou，playerconfig 的 10 条来源共用 | 已接入麒麟模块，关闭片头/暂停执行入口 |
| eboyang | js/player/vip.html → tv.qingning88.com/api/publicApi.php | 已接入清宁模块，取消错误提示点击 APP 推广 |
| 不卡影院 | static/js/playerconfig.js → tv.qingning77.com/api/publicApi.php | 已接入同一清宁模块 |
| Auete / au1080 | xyun/gyun.html → 同站 go/api/dp.php | 两条已抽查线路使用站内 DPlayer，未发现广告入口，保留播放及 PiP |
| Auete 配置 | js/play.js 的 jxAapi 为 www.huaqi.live | 首页与带 URL 请求均 502；抽查线路并未使用它，待核验，不生成规则 |
| 4kvm | 站内 Artplayer、artplayer-ads 插件 | 已有模块关闭两处开关；新 f257ffc3 构建另检查一致性，无新增第三方播放器主机 |
| 搜剧/看剧 AI | 已核验 global-player-host、movie-card-runtime | 当前源码未发现固定第三方 iframe 解析器主机；动态播放响应须另取样 |
| YQK/QNTV | Nuxt 播放组件、API playerList | 未从当前静态页面取得固定第三方解析器地址；继续保留 playerList，不猜测新主机 |
| 追影猫 | playerconfig 来源为其他影视站，parse 为空 | 这些是跳转影视站，不当作解析器批量拦截 |
| 聚爷爷 | 本次手机请求返回防护/验证页面 | 未取得播放页，暂无法确认解析器 |

## 扩展原则

解析器独立于影视站登记域名和接口路径，可在多个网站间复用。JSON 广告字段、HTML 容器/脚本入口和 JS 特征修改继续复用统一引擎；新域名先核验实际调用和源码。调用签名、URL、鉴权、播放初始化和下一集不得因广告判断误删。异常页、未知结构、缺少特征或替换次数不符保留原响应。

不自动遍历外部影视站或任意编号解析器，不修改 HLS。未来新增解析器需正常页面 HTML、相关 JS 或广告接口样例；注册最小广告移除和播放保留样例后生成、检查、加入订阅。
