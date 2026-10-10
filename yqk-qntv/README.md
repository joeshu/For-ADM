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


## v3：补齐两个广告接口

用户提供的 Quantumult X 日志显示，v2 已清理 /basic/init、/home/firstScreen、/home/body、/getPageAd、/getTextAd、/vodInfo/index 等请求。继续检查前端模块后发现还遗漏 /adInfo/getChatAd 和 /adInfo/getTopicAd：前者作为聊天广告消息插入消息流，后者写入专题页 topicAdList 并插入影视列表。v3 对应将聊天广告数组与 topicAdList 清空，同时保留聊天消息、专题影片列表与播放数据。更新规则中的脚本版本参数为 v=3。

“API cleaned”表示已改写响应字段，不等于所有广告源均已排除；若更新后仍显示，请提供具体页面截图及出现时对应 API 日志。


## v4：清除截图中的 5 个首页推广入口

截图中的快捷图标对应 `/v2/api/home/firstScreen` 的 `hotMudleList`，模板将其交给 `handleAdItem`。其中 `useAdLink` 的 action 1/2/11 会跳转外站，8/10 会进入游戏推广页。v4 从 `hotMudleList` 过滤这五种外链/游戏动作，保留站内路径动作、影视内容和其他首页模块；同时清空 `focusAdList`。规则脚本版本参数升为 `v=4`。


## v5：关闭日志，API 域名改为正则

按用户要求关闭 YQK/QNTV 运行日志，统一引擎也关闭改写日志。API 主机使用 `yz(?:y)?\d{4,6}` 前缀与已提供的 11 个主域名后缀组合匹配，支持日期前缀轮换；不扩大为任意 .com。MITM 对相同后缀使用 `yz*.` 通配符，重写仍限定已适配的广告接口路径。脚本版本参数更新为 `v=5`；先前 README 中的日志排查步骤仅适用于旧版本。
