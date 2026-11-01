# 红果短剧接入记录（2026-11-01）

已将红果短剧作为独立来源接入三源影视的现有原生界面、发现页、影视详情和播放器。实时官网只读探针见 [实测报告](hongguo-integration-probe.json)；浏览器模拟回归覆盖来源切换、首页栏目“更多”、发现分类分页和详情选集。

## 研究结论

依据 [hongguoTV 开源研究](https://github.com/N3urda/hongguoTV/blob/main/docs/research/2026-09-21-hongguo-open-source.md)，红果官网 `https://hongguoduanju.com/` 的页面服务端渲染数据并内嵌在 `_ROUTER_DATA`。本接入直接读取官网公开 HTML 中的 JSON，不调用未公开的客户端私有接口。

- 首页 `/` 返回 `loaderData.page`，其中 `mBannerList` 与 `homeSections[].video_list` 可映射成首页片卡和更多入口。
- 分类使用 `/category/{slug}?page={n}`；官网当前提供真人剧、漫剧、AI 剧、漫画四类。`selectorList` 给出题材筛选，选中题材时使用官网返回的路径段。
- 详情使用 `/detail?series_id={id}`，可读取剧名、封面、简介、演员、集数和视频 ID 列表。
- 详情集数不代表 App 获得完整播放权限。播放器页的 `publicVideoSeo.available` 是公开试看资源的明确标记；对应媒体位于官网 `/video/public/{itemId}/360p.mp4`。实测公开媒体返回 `video/mp4`，HEAD 为 200。
- 普通播放器数据标记了受保护播放。适配器不会生成签名、请求受保护播放地址或绕开登录/会员授权；只把官网明确公布为公开试看的视频列为可播放选集。
- 官网搜索结果接口要求浏览器安全校验参数，普通原生请求会被拒绝。本 App 不伪造校验值；搜索只在首页和四个分类首屏的公开片目中匹配，因此搜索结果不代表全站完整索引。

## App 内实现

`Web/hongguo-api.mjs` 是独立的官网页面适配器，负责限制响应体大小、提取并验证 `_ROUTER_DATA`、缓存 SSR 页面、转换分类/筛选/分页/详情数据，并检查公开试看标记。`Web/source-clients.mjs` 注册客户端；`Web/sites.json` 添加“红果短剧”；`Web/app.mjs` 为来源配置热播短剧、真人剧、漫剧和 AI 剧发现标签。首页与发现仍复用全 App 影视卡片、增量分页、收藏、观看历史和播放器流程。

没有把研究文档提及的 GPL 项目源码复制进 App；适配器按官网公开页面字段独立编写。红果站点数据只含来源 ID、名称、适配器类型和官网地址。

## 验证与边界

2026-11-01 官网实测：首页 5 个栏目、39 张片卡；四类各返回 24 个分类结果；真人剧第 2 页返回 24 个新结果；爱情题材筛选有结果；当前抽样详情返回 1 个官网公开视频试看，媒体 HEAD 为 200。完整数据见 [实测 JSON](hongguo-integration-probe.json)。这验证了官网接口和公开媒体可达性；尚未证明该动态资源在每台 iOS 设备上均可由 AVPlayer 解码。

运行验证：

```sh
cd ios-app
npm test
node tools/website-ui-check.mjs
node --use-env-proxy tools/hongguo-integration-probe.mjs
```

搜索只覆盖本地下载到的公开首屏目录；公开视频的画质和可用集由官网控制。官网若更改 SSR 键名、路径或题材 slug，适配器可能需要同步调整。
