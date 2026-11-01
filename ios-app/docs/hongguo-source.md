# 红果短剧接入记录（2026-11-01）

已将红果短剧作为独立来源接入三源影视的现有原生界面、发现页、影视详情和播放器。实时官网只读探针见 [实测报告](hongguo-integration-probe.json)；浏览器模拟回归覆盖来源切换、首页栏目“更多”、发现分类分页和详情选集。

## 研究结论

依据 [hongguoTV 开源研究](https://github.com/N3urda/hongguoTV/blob/main/docs/research/2026-09-21-hongguo-open-source.md)，红果官网 `https://hongguoduanju.com/` 的页面服务端渲染数据并内嵌在 `_ROUTER_DATA`。本接入直接读取官网页面数据，并使用官网播放器正常调用的播放信息接口。

- 首页 `/` 返回 `loaderData.page`，其中 `mBannerList` 与 `homeSections[].video_list` 可映射成首页片卡和更多入口。
- 分类使用 `/category/{slug}?page={n}`；官网当前提供真人剧、漫剧、AI 剧、漫画四类。`selectorList` 给出题材筛选，选中题材时使用官网返回的路径段。
- 详情使用 `/detail?series_id={id}`，可读取剧名、封面、简介、演员、全剧 `vid_list` 和网页当前开放集数 `accessible_episode_cnt`。两者含义不同：例如抽样页面的 SSR 返回 102 个视频 ID、3 个网页即播集。此前把公开 SEO 试看标记当成唯一集数，导致 App 只显示试看集；现在详情按完整 `vid_list` 建立选集，选择后再询问官方播放接口。
- 官网播放器正常调用 `POST /api/video/protected/play-info`，请求只含官网页面使用的 `series_id`、`item_id` 和 `definition`。接口名里的 `protected` 本身不是要求登录的判断依据：匿名请求对抽样剧的开放集返回正常媒体地址，HEAD 为 `video/mp4`；网页未开放的后续集返回 403 `protected_playback_unavailable`。App 保留完整集数并把官网的拒绝原因呈现出来。
- 官网播放器页对后续集提示“前往红果短剧App端免费看全集”。用户确认官方 App 无需登录或观看广告即可播放全剧；但该 App 使用的移动端接口与网页接口不同，本次无法从构建环境验证其请求和媒体格式。因此本适配器只播放网页接口实际返回的媒体，并为其余选集提供官网播放器页跳转，不把网页 403 错误描述成登录或付费限制。
- App 的完整选集保留官网详情返回的全部视频 ID。遇到网页接口 403 时，详情页可打开对应的官网播放器页，让用户从官网进入红果 App；内置播放器不会把官网拒绝的流伪装成可播放资源。
- 官网搜索结果接口要求浏览器安全校验参数，普通原生请求会被拒绝。本 App 不伪造校验值；搜索只在首页和四个分类首屏的公开片目中匹配，因此搜索结果不代表全站完整索引。

## App 内实现

`Web/hongguo-api.mjs` 是独立的官网适配器，负责限制响应体大小、提取并验证 `_ROUTER_DATA`、缓存 SSR 页面、转换分类/筛选/分页/完整选集，并校验官方播放接口返回的媒体主机。`Web/source-clients.mjs` 注册客户端；`Web/sites.json` 添加“红果短剧”；`Web/app.mjs` 为来源配置热播短剧、真人剧、漫剧和 AI 剧发现标签。首页与发现仍复用全 App 影视卡片、增量分页、收藏、观看历史和播放器流程。

没有把研究文档提及的 GPL 项目源码复制进 App；适配器按官网公开页面字段独立编写。红果站点数据只含来源 ID、名称、适配器类型和官网地址。

## 验证与边界

2026-11-01 官网实测：首页 5 个栏目、39 张片卡；四类各返回 24 个分类结果；真人剧第 2 页返回 24 个新结果；爱情题材筛选有结果。抽样详情完整 `vid_list` 有 102 集，官网 SSR 标记网页即播 3 集；第二集播放信息请求和媒体 HEAD 成功，超出网页开放数的下一集由官网返回 403。官方移动端使用的另一套接口本次无法从构建环境验证；报告只描述可复现的官网网页流程。完整数据见 [实测 JSON](hongguo-integration-probe.json)。这验证了目录全量显示和匿名网页播放边界；尚未证明动态资源在每台 iOS 设备上均可由 AVPlayer 解码。

运行验证：

```sh
cd ios-app
npm test
node tools/website-ui-check.mjs
node --use-env-proxy tools/hongguo-integration-probe.mjs
```

搜索只覆盖本地下载到的公开首屏目录；集数按官网当前返回的所有视频 ID 显示，内置播放能力受官网网页接口返回范围限制。网页接口未返回地址时可打开官网播放器页继续进入官方 App。官网若更改 SSR 键名、路径、播放接口或题材 slug，适配器可能需要同步调整。
