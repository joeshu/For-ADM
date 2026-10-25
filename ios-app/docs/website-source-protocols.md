# 新增网站接口调查（2026-10-25）

目标是将一起看、青柠 TV、电影猎手作为三个独立来源接入原生界面。
已完成公开前端源码采集、匿名接口调查和三来源客户端适配，注册到 0.2.23 的原生界面数据引擎。
实际共用客户端工厂、模型和播放解析器的结果见 [端到端检查报告](source-integration-probe.json)：三个来源均通过；尚未进行该版本的 iOS 原生解码验收。
接口成功与实际视频可播放分别记录，不能用 HTTP 200 代替播放验收。

## 可复查的原始资料

- [完整清单与实测响应结构](../research/website-sources/2026-10-25/manifest.json)
- [一起看原版源码](../research/website-sources/2026-10-25/yqk/)
- [青柠 TV 原版源码](../research/website-sources/2026-10-25/qntv/)
- [电影猎手原版源码](../research/website-sources/2026-10-25/dyls/)

每份文件记录原始 URL、字节数和 SHA-256；保留抓到的入口及业务模块原文。
manifest 的 API 响应只保存字段结构和数组长度，不保存账号、Cookie、用户令牌、
请求签名或带签名的媒体 URL。原站公开发布的客户端协议常量仍存在原版 JS 中。
研究资料位于 Web 资源目录之外，不加入 IPA。

重新采集：

```sh
cd ios-app
NODE_USE_ENV_PROXY=1 node tools/research-websites.mjs
```

脚本从入口 HTML 发现当前 JS 文件名，再读取当前 API 地址配置；不依赖本次固定的 bundle 文件名。
源码结构变化、网络失败、业务拒绝均记录为失败，不能被算作成功。
媒体只读取公开播放清单，未下载视频分片，也未进行 AVPlayer 真机播放验证。

## 一起看 / 青柠 TV

| 来源 ID | 实测入口 | API 域名发现位置 |
| --- | --- | --- |
| `yqk` | https://yqk18.app/ | `/js/baseUrlList.js` 的 `baseApiList` |
| `qntv` | https://qntv28.app/ | `/js/baseUrlList.js` 的 `baseApiList` |

两站采用相同接口结构。本次样本影片 ID 相同；独立入口不代表片库互不重叠。
适配时应分别保存站点选择、列表缓存、筛选、收藏、观看记录、线路偏好和会话。

请求为 JSON POST。公共参数为 `appId / reqDomain / deviceInfo / version / requestId / cus1tom / udid`。
`requestId` 每次更新，`udid` 按来源持久化。匿名查询不添加不存在的用户令牌。
请求参数按键排序，非空值按 `key=value&` 拼接，再拼接 `appKey=公开客户端常量`，
计算 MD5 为 `sign`。版本和常量从对应站点入口 JS 提取，不从另一来源猜测。

| 功能 | 路径 | 业务参数 / 主要返回字段 |
| --- | --- | --- |
| 顶部分类 | `/v2/api/home/header` | `data.channeList[]: channelId, channelName` |
| 首页栏目 | `/v2/api/home/body` | `vodTopicList[]: vodTopicId, topicName, vodList` |
| 分类子项 | `/v2/api/channel/childListView` | `channelId` → `childChannelList` |
| 分类栏目 | `/v2/api/channel/topicListView` | `channelId` |
| 分类分页 | `/v2/api/channel/getVodList` | `parentChannelId, childChannelId, nextCount, nextVal` |
| 筛选定义 | `/v1/api/search/getSearchFilter` | `filterList[]: filterName, filterValueList` |
| 搜索分页 | `/v1/api/search/search` | `keyword, nextCount, nextVal` |
| 影视详情 | `/v2/api/vodInfo/index` | `vodId` → `playerList, actorList, directorList` |
| 分集清晰度 | `/v2/api/vodInfo/epDetail` | **`vodEpId`** → `vodResolution, showName, canPlay, defaultSelect` |
| 获取播放地址 | `/v2/api/vodInfo/playUrl` | **`vodResolution, epId`** → `playUrl` |

分类页的真实调用在 `list-2.*.js`，搜索调用在对应 `/search` 路由模块，
播放调用在 `_play_.*.js`，均已归档。
分页首次 `nextVal` 为空，后续使用服务器原样返回的游标和 `hasNext`；不能用页码替代。
两站均实测第一页 12 项、第二页 12 项，第二页 12 项都是新增影片。

影片字段为 `vodId / vodName / coverImg / score / remark / flags / iconList`。
详情线路为 `playerList[]`，分集为其 `epList[]: epId, epName`。
清晰度接口与播放接口使用不同的分集参数名，不能把 `vodId` 当成 `epId`。
仅对 `canPlay === true` 的清晰度请求播放；登录、客户端限制和服务端拒绝应按原样呈现。

## 电影猎手

入口为 https://dyls1.mbxqnb.cn/，API 基址为同源 `/api/v1`。
当前入口通过动态模块加载 `apiClient / newEncryption / homeApi / searchApi / playerService`；已保存这些原版模块。

查询参数包含 `timestamp`。原站将 JSON 参数使用公开 RSA 公钥和 PKCS#1 v1.5 加密，
输出 Base64URL `pack`；`signature` 为对 `pack` 计算的 HMAC-MD5。
长请求沿用原站分块方式：UTF-8 字节按公钥长度减 11 分块，加密后拼接密文再编码。
不能对已编码的 `pack` 再次签名，不能混用其他站点的签名算法。
客户端使用 `X-Client-Version: 3102` 和 `X-Client-Setting`；鉴权头仅在已有真实会话时附加。
采集脚本未登录或新建账号。

| 功能 | 路径 | 参数 / 返回结构 |
| --- | --- | --- |
| 首页 | `/movie/index_recommend` | `data[]: layout, title, list, right` |
| 分类分页 | `/movie/screen/list` | `type_id, page, pageSize`，返回 `list, total, page, pageSize` |
| 搜索 | `/movie/search` | `keyword, page, res_type=by_movie_name` |
| 详情 | `/movie/detail` | `id`，返回 `play_from` 线路数组 |
| 分集 | `/movie_addr/list` | `from_code, movie_id` |
| 解析地址 | `/movie_addr/parse_url` | `type=play, episode_id, from_code, play_url, refresh` |

`sort=time` 和 `res_type=0` 已被真实服务拒绝；不得将其作为默认参数。
`res_type` 还允许 `by_member_name / by_actor_name`，这是服务端错误信息给出的枚举，
本次只对 `by_movie_name` 做成功验证。

影片 ID 是字符串（本次详情样本为 `Lg5BX`），不能应用现有三源的纯数字 ID 校验。
影片卡片为 `id / name / cover / dynamic / type_name / label`；首页 `advert_self` 为广告区块。
线路字段包括 `name / code / total / player_need_to_parse / player_headers / player_user_agent`，
分集为 `episode_id / episode_name / play_url / from_code`。
解析需求和请求头应随线路交给播放器；不能把所有 URL 都直接当成 m3u8。
解析接口的实测状态见 manifest 中 `parserContract.verified`；只有源码确认不算网络验证。

## 接入现有原生 App 时必须处理的差异

1. 现有 `SiteClient` 的 HMAC-SHA1、AES 响应解码和访客会话协议不能直接套用上述网站；需要分别的客户端适配器。
2. 图片使用完整 `coverImg / cover` URL，不能强制拼接现有加密图片分组域名。
3. **一起看的 `channelId=5` 是体育**；现有模型将数字 5 当作成人分类。必须按来源映射分类和成人标记，否则会错误隐藏体育内容。
4. 首页专题、分类筛选、影片 ID、分页游标需要转换到统一模型；收藏和观看记录继续以 `来源 ID + 影片 ID` 隔离。
5. 接口获取播放地址成功不等于可播放。初次调查的三个 m3u8 样本都返回 404，
   见 `mediaSample`；还需验证其他同集线路、有效播放清单和原生播放器实际推进后，才能声称播放通过。

## 0.2.23 适配结果

`Web/source-clients.mjs` 根据来源选择独立适配器；`yqk-api.mjs` 支持一起看及青柠 TV，`dyls-api.mjs` 支持电影猎手。实际检查覆盖首页、分类两页、搜索、更多、详情、选集，以及同集备用线路和媒体传输；最新端到端报告三个来源均成功。电影猎手沿用原网页的 no-referrer 策略，一起看和青柠 TV 样本通过前五条线路内的同集回退取得有效主/子清单。

52 项单测与 `tools/website-ui-check.mjs` 浏览器回归通过；尚未构建和分发本版本 IPA，媒体清单/HEAD 成功不代替 AVPlayer 解码验证。
