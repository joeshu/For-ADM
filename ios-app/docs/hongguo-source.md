# 红果短剧接入与维护

0.2.48 默认使用红果官网正常 HTML 视频播放器调用的**整集兼容接口**，播放官网向当前网页流程开放的完整剧集。公开试看是单独的手选线路，完整选集目录不等于全部集数均已开放。

## 已验证的播放路径

官网真实浏览器播放时会调用 `POST /api/video/protected/fallback-play-info`，JSON 请求体只含 `item_id`。成功响应包含 `main_url`、`url_expire`、`base_resp`，返回可直接交给 AVPlayer 的完整 MP4；它和此前使用的 `/api/video/protected/play-info` 是不同接口，后者返回加密、音视频分离的 DASH。

App 请求格式与官网正常兼容播放器一致。只接收成功响应及官方 `v数字-reading.qznovelvod.com` / `v数字-hgweb.qznovelvod.com` HTTPS 媒体地址，不猜测地址、不修改签名、不处理播放密钥。播放前请求最多 64 KiB 的文件开头，检查 ISO BMFF 初始化结构，并拒绝 `encv` / `enca` 加密样本；长视频的音轨可能位于探针范围之后，不能据此判断它没有音轨。

真实调查见 [整集播放报告](hongguo-full-playback-probe.json)：

- 《军需处长的账本》第 1～3 集返回完整 MP4。
- 第 1 集约 108.33 秒，360×640、H.264 + AAC；完整文件解码通过，得到 2708 个视频帧和 4666 个音频帧。
- 第 4、23、46 集均由同一个官网兼容接口返回 403 `public_fallback_unavailable`。当前内置播放没有打通这些未开放的后续集，保留对应集官网入口；不重试或绕过此拒绝。
- 官网 HTML 的 `accessible_episode_cnt` 用于播放说明，实际能否播放仍逐集询问官网，不用它裁切完整目录或替代服务端判断。

## 数据与界面

直接读取 `https://hongguoduanju.com` 的 `_ROUTER_DATA`：

| 能力 | 官网路径/数据 | App 行为 |
| --- | --- | --- |
| 首页 | `/`，`mBannerList`、`homeSections[].video_list` | 推荐、轮播、栏目更多 |
| 分类 | `/category/{slug}?page={n}`，`selectorList`、`recommendList`、`pagination` | 真人剧、漫剧、AI 剧、漫画、题材、增量分页 |
| 详情 | `/detail?series_id={id}`，`vid_list` | 完整选集、简介、演员、收藏和观看历史 |
| 整集 | `POST /api/video/protected/fallback-play-info` | 官网开放的完整 MP4、续播、自动下一集 |
| 手选试看 | `/player/{seriesId}/{itemId}`，`publicVideoSeo` | 声明匹配剧 ID 和集 ID 时播放官网发布的短片段 |
| 搜索 | 首页与四类首屏片目 | 本地关键词匹配，不代表全站完整索引 |

默认选择整集线路，手选试看不会成为下次的默认线路。整集出现传输错误时只尝试整集资源；不会偷偷降为十秒试看。试看始终从头播放、不覆盖完整剧集进度、不自动跳到下一集。

## 稳定性与验证

`Web/hongguo-api.mjs` 集中处理页面解析和官网播放接口；`Web/mp4-inspection.mjs` 只检查有界的文件初始化元数据。网络错误、408/425/429/5xx 最多重试两次；官网 403/404 给出明确说明。临时错误页面不缓存，页面缓存与详情缓存有界，手动刷新会清除缓存。SSR 契约保存在 `lastDiagnostics`；播放状态、返回字段名和媒体主机保存在 `playbackDiagnostics`，不记录媒体签名、Cookie 或密钥。

```sh
cd ios-app
npm test
node tools/website-ui-check.mjs
node --use-env-proxy tools/hongguo-integration-probe.mjs
```

回归覆盖整集/试看分离、完整选集、明确拒绝、实际无扩展名 URL、MP4 初始化中的加密样本、续播、自动下一集和官网跳转。iOS CI 使用真实来源和选集流程播放上述约 108 秒样片，检查首帧、画面尺寸、有效音轨以及播放到结束；不能用音频测试文件替换实际视频。测试截图和诊断单独上传，不放进 IPA。每周官网探针检查目录、分页、整集接口、试看接口和未开放集的返回结果。

## 历史问题与后续边界

首次接入 `6b3595c` 只播放 `publicVideoSeo` 对应的约 10 秒公开试看。`0001bc6` 补齐目录时把加密 DASH 当成普通 MP4，导致黑屏；0.2.45–0.2.46 的 HTTP 探针和 Range 中继没有解决格式问题。0.2.47 恢复试看，0.2.48 经真实浏览器调用链找到并接入官网整集兼容接口。历史证据见 [回归报告](hongguo-playback-regression.json)。

红果官方 App 的免费全集能力与网页开放范围不同。若后续要在第三方 App 播放网页未开放的集，需要内容方提供可用于该 App 的正式播放接口/授权；更换播放器内核本身不能扩展官网返回的集数。火山引擎的 [官方 iOS 示例](https://github.com/volcengine/VEVodDemo-iOS) 需要 AppID 与绑定 Bundle ID 的 License；[官方加密播放文档](https://docs.volcengine.com/docs/video-on-demand/web-player-private-encrypted-playback?lang=zh) 也要求业务服务端提供相应播放授权。当前未把未验证的 SDK、第三方解密代码或其他 App 的 License 放入安装包。
