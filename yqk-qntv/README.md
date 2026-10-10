# YQK / QNTV Quantumult X 去广告

2026-10-10 读取 yqk18.app 和 qntv28.app 的真实 HTML 与 Nuxt JS。两站是同一套前端，入口分别为 entry.34539261.js、entry.4829802d.js，播放模块分别为 _play_.d854e942.js、_play_.0542690d.js。

## 使用与多域名

将 quantumult-x-snippet.conf 的 rewrite_local 和 hostname 合并到已有配置，启用重写与已信任的 MITM 证书，刷新远程脚本并清除网站缓存。已有统一规则时，更新 universal 版本即可，独立规则与统一规则二选一。

规则允许 yqk + 数字 + .app、qntv + 数字 + .app 及 www 形式，MITM 使用相应前缀通配符。Quantumult X 官方 sample.conf 说明 hostname 支持 * 和 ?：https://github.com/crossutility/Quantumult-X/blob/master/sample.conf 。同名数字域名不等于已确认同一运营者；只有符合已验证源码特征的模块才会修改，其他正文原样通过。已实际下载验证的域名仅 yqk18.app、qntv28.app。不同前缀或顶级域名需要取得源码再接入，不按 IP 推断镜像域名。

## 核心位置与范围

| 核心位置 | 修改 |
| --- | --- |
| entry.*.js 的 startAdList、全局 floatAd | 开屏列表置空，悬浮广告显示条件关闭 |
| entry.*.js 的 useHttp 请求 transform | 保留 JSON 解析与请求结构，在消费广告接口数据前清理 |
| /adInfo/getPageAd | 仅 floatAd、popupAd 置空，保留其他字段 |
| /vodInfo/getVodPauseAd、/adInfo/getTextAd | 专用广告数据置空 |
| /vodInfo/getVodBodyAd、/adInfo/getSearchAd、/adInfo/getUserCenterAd | 专用广告列表清空（包含这些广告位里的高清推广项） |
| /home/body、/home/firstScreen | 仅 adList、focusAdList 清空，保留影视列表 |
| /vodInfo/index、_play_.*.js 的 startAd | 清除播放前广告启用数据，让原有正片播放分支执行 |
| _play_.*.js 暂停、文字、播放页广告 | 消费端补充清理 |

未改播放地址、playerList、线路测速、选集、鉴权、会员限制、弹幕或播放器库。未知编译结构按完整修改组回退。没有实现 m3u8 广告分片识别或视频画面内广告去除，也不保证清理未观察到的广告接口或第三方播放器广告。

## 验证

两站四个完整 bundle 经脚本处理后做模块语法检查；广告数据转换、正片字段保持、未知版本回退、非目标域名回退与 $done 单次调用做本地验证。尚未在手机 Quantumult X 实播，不能据此保证所有线路均能播放。


## v2：API 响应兜底与排查

用户反馈旧规则未见效果，尚无手机命中日志，不能判定具体原因。旧版只重写网页 JS；浏览器复用缓存或入口域名未匹配时，广告清理不会执行。v2 保留 JS 处理，同时对白名单中的 11 个 baseApiList 域名新增广告数据响应重写和 MITM。仅匹配已核对接口；/basic/init 只清空 startAdList 并归零广告时长。播放详情仍只关闭 startAd，其余播放源、鉴权和选集字段保留。新增 [YQK-QNTV v2] 日志区分 API cleaned、unchanged 与 JS patched；脚本地址带 ?v=2 方便获取更新版。API 白名单由用户提供；未取得带实际会话的线上 JSON，本地响应测试使用消费者代码确认的字段样例，不代表手机实播验证。

必须重新更新重写资源及 MITM 域名，单独刷新 JS 不会自动补上 API 域名。若仍无效，查看 Quantumult X 请求记录是否出现 /v2/api/basic/init、/adInfo/getPageAd、/vodInfo/index 的重写命中，再提供实际网页地址和对应脚本日志。无命中表示链路尚未进入脚本，日志 unchanged 则需核对数据结构。接口鉴权失败或非 JSON 正文原样保留。
