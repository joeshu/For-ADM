# 看剧AI原生片源接入

看剧AI使用独立的 KanjuClient 接入 App 现有的原生影视界面。首页、分类、搜索、详情、选集分页和播放线路都复用 UIKit 页面与系统播放器；App 不打开站点网页容器。

## 接口映射

| 原站接口 | App 行为 |
| --- | --- |
| /v1/runtime/bootstrap | 读取服务端当前开放的分类、筛选项与排序 |
| /v1/feed/home?scope=public | 映射首页栏目及栏目更多入口 |
| /v1/browse/catalog | 分类筛选、搜索、发现页和分页 |
| /v1/catalog/{variant_id}/detail | 影片详情与季度 |
| /v1/catalog/{variant_id}/episodes | 获取该版本完整剧集，并按 App 每页 20 集展示 |
| /v1/playback/resolve/{episode_token}?view=compact | 刷新所选集的播放线路 |
| /v1/playback/resolve-line?view=compact | 用户选择解析线路，或无直连线路时，解析站点返回的临时票据 |

首页栏目保持站点返回的标题和顺序。“更多”只采用服务端提供的 catalog browse 参数，并通过允许列表过滤查询字段。首页影片与分类卡片使用站点选定的 variant ID；超过 App 现有长度上限的目录 ID 通过本地稳定短 ID 映射。

## 签名、TLS 与播放

每个接口请求按公开前端协议生成 HMAC-SHA256 签名，签名内容包含大写请求方法、原始 path 和 query、毫秒时间戳与 16 字节随机 nonce。请求同时附带前端版本头。主域名故障时只对网络错误和服务端 5xx 尝试备用 HTTPS 域名；签名拒绝、权限拒绝和限流不会触发换身份或重复请求。原生 NSURLSession 保持正常证书校验，没有关闭 TLS 验证。

完整剧集 token 与 resolve ticket 仅在内存和当前播放请求中使用；本地保存的 ID 映射不含剧集 token、播放票据、Cookie 或媒体地址。线路列表只呈现服务端提供的公开、零级线路。默认优先直连 m3u8/MP4；解析票据只在用户切换到对应线路时使用，或确实没有直连线路时由智能线路尝试。只向播放器返回 HTTPS 地址，并按原站返回的数据清理媒体请求头中的 Cookie、Authorization 等敏感字段。

播放器会按 App 共用的播放校验流程读取 HLS 清单；页面上的线路切换仍由统一的同集匹配与播放恢复逻辑处理。

## 真实接口复测

2026-11-02 使用最终 KanjuClient 和 App 共用的播放校验器访问正式 HTTPS 接口：运行时开放 6 个分类（含最近更新），首页返回 8 个栏目、96 张卡片；最近更新和电视剧分类各返回 24 条，“流浪地球”搜索返回 11 条；电视剧详情返回 51 集。所选“红牛资源”经 App 的 HLS 清单校验通过。检查只输出集数与校验结果，不记录签名地址、剧集令牌或临时票据。

可在有网络的 Node.js 24 环境运行 NODE_USE_ENV_PROXY=1 npm run probe:kanju 重测（直接网络可用时也可省略 NODE_USE_ENV_PROXY）。HLS 清单可达性不等同于 iPhone 上完整解码和持续播放验收。

## 维护与复测

- Web/kanju-api.mjs：请求签名、域名故障切换、分类、栏目、完整选集与线路映射。
- Web/sites.json：站点域名、协议头与随公开网页发布的签名配置。
- Web/source-clients.mjs：按 provider 将看剧AI路由到专用适配器。
- tests/kanju-api.test.mjs：签名、筛选、栏目分页、长 ID、全集分页、线路票据和权限拒绝回归。
- tools/website-ui-check.mjs：真实应用界面的来源切换、栏目、发现页、详情与选集回归。

接口或客户端版本调整后，应先检查公开运行时的分类和线路响应，再更新协议配置与测试夹具。不要保存短期播放地址，也不要把 TLS 校验错误当成普通线路问题。
