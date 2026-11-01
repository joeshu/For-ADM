# 红果短剧适配与播放回归记录

红果作为独立来源接入全 App 原生片库、分类、详情、选集、收藏和观看历史。当前内置播放器恢复首次接入时使用的**官网公开试看**；完整选集目录不等于可在本 App 播放全集。

## 已确认的黑屏原因

| 版本/提交 | 实际播放资源 | 验证结果 |
| --- | --- | --- |
| 首次接入 `6b3595c` | 官网 `publicVideoSeo` 声明的 `/video/public/{itemId}/360p.mp4` | 《军需处长的账本》第 1 集：360×640，H.264 + AAC，约 10 秒公开试看，可正常解码 |
| 全集选集改动 `0001bc6` | `/api/video/protected/play-info` 返回的 720P CDN 地址 | 返回 `format: dash`，视频和音频分离，视频含 `encv / sinf / schm(cenc) / tenc`；无法作为普通 MP4 直接交给 AVPlayer |
| 0.2.45–0.2.46 | 对上述地址检查 HTTP 状态、重取地址、增加 MP4 Range 中继 | HTTP 200/206 只能证明字节可读取，不能证明视频能解码；真实 CDN 路径没有 `.mp4` 后缀，中继条件也没有命中 |
| 0.2.47 | 恢复明确发布的公开试看 MP4 | 恢复原生播放器正常请求路径；完整选集保留，试看与全集能力分别说明 |

2026-11-01 下载官网明确发布的第 1 集试看文件，`ffmpeg -xerror` 完整解码通过；`ffprobe -count_frames` 返回 250 个视频帧、430 个音频帧。视频时长 10.000 秒、音频时长 9.985 秒，而页面 `publicVideoSeo.durationSeconds` 是完整集的 108.331 秒，不能用该字段把试看标成完整剧集。调查记录见 [回归报告](hongguo-playback-regression.json)。仓库不保存第三方视频、媒体签名或播放密钥。

## 当前数据与播放方式

依据 [公开研究](https://github.com/N3urda/hongguoTV/blob/main/docs/research/2026-09-21-hongguo-open-source.md)，直接读取 `https://hongguoduanju.com` 官网的 `_ROUTER_DATA`，不依赖第三方片库服务：

- 首页 `/`：`mBannerList`、`homeSections[].video_list`。
- 分类 `/category/{slug}?page={n}`：真人剧、漫剧、AI 剧、漫画；`selectorList` 提供题材，`recommendList` 和 `pagination` 提供分页。
- 详情 `/detail?series_id={id}`：标题、封面、简介、演员、完整 `vid_list`。`accessible_episode_cnt` 只作为官网诊断值，不裁切选集，也不等于公开试看集数。
- 播放 `/player/{seriesId}/{itemId}`：按需读取所选集页面；仅当 `publicVideoSeo.available === true` 且剧 ID、集 ID 都匹配时，使用官网发布的同源 360P MP4。没有公开试看时给出明确说明和该集的官网入口，不拼接猜测其他集的媒体地址。
- 搜索只覆盖已抓取的首页与四个分类首屏公开片目，不代表全站完整索引。

`Web/hongguo-api.mjs` 集中处理字段别名、响应大小限制、解析、重试、有界缓存和来源校验。网络中断、408/425/429/5xx 最多重试两次；4xx 不盲目重试。失败的页面解析不进入缓存，手动刷新清理页面与详情缓存。

## 播放体验

详情和线路明确显示“官网公开试看”，保持全部选集可选择。未提供试看的集显示官网入口，不再先黑屏再尝试相同加密资源的主备地址。试看总是从头播放，避免旧完整视频的进度跳到短片末尾；试看播放进度不覆盖完整剧集进度，也不在结束后自动播放下一集。

用户确认官方 App 可免费观看全集。官方 App 的正常播放流程与网页公开试看不同；目前本项目没有验证可供系统 AVPlayer 使用的官方完整播放接口或 SDK。本版只恢复已验证可播放的公开片段，不宣称已实现全集内置播放，也不处理加密媒体的密钥。

## 验证与维护

```sh
cd ios-app
npm test
node tools/website-ui-check.mjs
node --use-env-proxy tools/hongguo-integration-probe.mjs
```

- 单元回归包含实际形态的无扩展名加密 DASH 数据，确保不会再次当成 MP4 返回给播放器；同时验证试看声明、剧集 ID 匹配、完整集数和未公开集的提示。
- 界面回归覆盖来源切换、更多、筛选、分页、完整选集、旧进度不跳过试看、试看结束不自动跳集和对应集官网入口。
- 官网探针验证 SSR 契约与公开 MP4 的小范围 GET；报告见 [官网探针](hongguo-integration-probe.json)。
- iOS CI 在已有导航/直播检查之后，以 `--hongguo-smoke` 重新启动测试 App，通过真实来源、详情、选集、原生桥接和 AVPlayer 播放上述公开试看。检查 `readyForDisplay`、非零画面尺寸、超过 1 秒的播放进度和原生页面内嵌关系，不能用音频测试文件替换红果视频。诊断 JSON 和截图单独上传，不放入 IPA。
- 每周 `hongguo-source-audit.yml` 检查官网目录和公开试看；官网变更时只修改集中适配层，并同步回归与探针。

今后更换完整播放方式前，必须检查真实媒体的封装、音视频轨道与内容保护，并通过原生画面测试；不能仅凭 URL、扩展名、Content-Type 或 HTTP 成功状态认定可播放。
