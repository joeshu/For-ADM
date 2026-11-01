# HGTV Python 公开兼容版 1.0.2

[下载带版本名的独立脚本 hgtv_public_1_0_2.py](https://raw.githubusercontent.com/joeshu/For-ADM/master/research/hongguo/downloads/hgtv_public_1_0_2.py)。Python 3.8 及以上，仅使用标准库，不需要安装依赖。版本归档与已测试的 `dc88cfd` 源码逐字节相同，校验信息见 [下载清单](downloads/hgtv_public_1_0_2.json)；主脚本仍在 `hgtv_public_optimized.py` 维护。

这是基于新附件审查后整理的**独立公开兼容版**，原始附件未改动。保留 TVBox 的 `Spider` 方法：`init`、`homeContent`、`homeVideoContent`、`categoryContent`、`detailContent`、`searchContent`、`playerContent`。它使用站点页面和正常网页兼容播放接口，不包含原附件的 App 缓存提取、设备模拟、签名与内容密钥处理，也不保留其本地解密 HTTP 服务。不是原脚本的全部功能替换版。

## 性能与稳定性改动

| 环节 | 新行为 |
| --- | --- |
| 页面加载 | HTML 与解析结果一起缓存 5 分钟；重复打开不再次下载或解析 |
| 并发 | 相同请求合并执行，不同请求可并行；搜索预热和逐集自检最多 3 个工作线程 |
| 内存 | 缓存最多 32 项、16 MiB 估算有效载荷，目录索引最多 2000 部；两者独立，不代表进程总内存上限 |
| HTTP | 每线程独立 Cookie 会话，保留系统代理与 TLS 校验；单次套接字超时 6 秒，最多 2 次尝试，重试预算 18 秒 |
| 重试 | 只重试临时网络或服务错误；403/404 不反复请求；遵守短 `Retry-After`，长等待直接返回错误 |
| 数据读取 | HTML、JSON、媒体探针分别有大小上限；媒体先读 64 KiB，必要时按 MP4 box 尺寸定位元数据，合计最多 1 MiB、4 次请求，服务器忽略 Range 时立即停止 |
| 选集 | 从 SSR 的完整目录读取并保留长整数 ID，核对总集数，检查重复与无效 ID |
| 播放 | 整集与试看片段分开；要求完整视频轨初始化及有效尺寸，显式返回 MP4 MIME；地址按有效期缓存，预检期间过期则拒绝返回，失败不缓存 |
| 自检 | 空结果、无可用媒体或任一逐集检查失败均返回非零；文件头通过不会被标记为完整播放成功 |

HTTP 预算在连接、每次读取和重试前检查；正在阻塞的底层读取仍受套接字超时约束，因此不是强制的进程级硬截止时间。媒体预检仅检查 MP4 初始化信息，不能保证客户端完成解码。

## 1.0.1 播放检查修正

上一版只确认 `ftyp`，会把只有音频、截断元数据或尚未取得视频轨的 MP4 当作通过预检。本版要求完整 `moov`，按轨道核对 `hdlr=vide`、编码与非零宽高；支持 `moov` 位于首段之后或 `mdat` 之后，按 box 长度跳过视频数据读取元数据，不整片下载。跨 Range 请求的资源总长度改变时会失败。所有探针请求共享 20 秒预算，不足以完成检查则明确失败。为控制累计读取预算，媒体探针不自动重试或跟随重定向；遇到这些情况需要重新解析。整集解析的同键等待预算增至 45 秒，覆盖 API 与媒体检查预算，避免并发调用先行超时。

播放结果增加 `format: "video/mp4"`，预检与播放器均使用 `Accept-Encoding: identity`；返回值还包含 `video_codecs`、`video_dimensions` 和 `initialization_complete`。未给 CDN URL 追加扩展名，未强制客户端的硬解/软解设置。

`format` 的消费方式已核对 [FongMi Result](https://github.com/FongMi/TV/blob/8626650ebcbc0d028e16d859e826fcf439720f3a/app/src/main/java/com/fongmi/android/tv/bean/Result.java#L95)、[PlaySpec](https://github.com/FongMi/TV/blob/8626650ebcbc0d028e16d859e826fcf439720f3a/app/src/main/java/com/fongmi/android/tv/player/media/PlaySpec.java#L64) 和 [MediaItemFactory](https://github.com/FongMi/TV/blob/8626650ebcbc0d028e16d859e826fcf439720f3a/app/src/main/java/com/fongmi/android/tv/player/media/MediaItemFactory.java#L70)。其他分支可能忽略该字段，缺少此字段也不能单独解释所有黑屏问题。

[真实媒体解码记录](playback-decode-check.json)：2026-11-01 使用正常兼容接口下载《军需处长的账本》第 1、4、6 集，经 FFmpeg 完整解码到结束，分别得到 2708、3585、3369 帧；均为 360×640 H.264 + AAC，无解码错误。它证明这三个样本包含可解码视频，不代表已复现或验证用户客户端的黑屏修复。站点拒绝提供地址的剧集仍会明确失败。

## 1.0.2 CCTVHost 空地址诊断

用户提供的 74 行 CCTVHost 日志中，27 次播放请求均为 `missing_or_empty_address` / `no_media`，脚本提示相同。旧提示合并了接口 HTTP 403 和 404，日志没有剧集 ID、源版本或原始状态，不能判断是哪一集、哪一种响应；没有这些失败已进入视频解码的证据。详情见[聚合分析](cctvhost-log-analysis.json)，未保存原始用户日志或会话关联 ID。

已按 [CCTVHost 公开提交](https://github.com/joeshu/yqk-forward-widget/commit/0bb6418d0d322918e76cca41e56f44ae3acf1302) 核对：`sid~vid` 原样传入 `playerContent`，空结果在 `host_media_runtime.py:518–520` 取 `error/message/msg` 后统一包装为 `NO_MEDIA`；脚本返回的 `status/retryable` 不在这一分支消费。因此更新 MIME 或解码参数不能使这个空结果成为可播放媒体。

本版分别记录 `provider_http_forbidden`、`provider_http_not_found`，并区分 `resolve_api` 与 `media_probe`。结果增加源版本与剧集 ID；`msg` 同时带上关键上下文，让当前宿主直接显示。`[HGTV]` JSON stderr 日志记录启动、播放开始、成功和失败，不记录媒体 URL、请求头、Cookie 或响应正文。并发等待者也保留原错误状态和阶段。

同一公开第 1 集的有限会话对照中，新实例直接请求、浏览首页后请求、浏览播放页后请求、换工作线程后请求均返回 200。这只说明当前云端出口下没有复现普通 Cookie 会话问题，不代表用户设备出口或其他集也成功。

另两次云端复测取得了官网兼容 URL，但媒体预检分别遇到网络错误与 HTTP 503；强制预检将这些地址全部丢弃。本版仅在**正常整集兼容接口已成功，且媒体预检遇到明确可重试的网络/超时/408/425/429/5xx 错误**时保留地址，交给客户端播放器继续请求。结果标为 `verification: "compatibility-api-only"`、`initialization_complete: false`，附 `preflight_code/status/failure_stage`，不缓存；没有声称视频轨已验证。接口拒绝、媒体 403/404、明确无视频、加密或结构错误以及预览猜测 URL 均不走这一分支。自检遇到此类未完成初始化检查的结果仍退出 1，不能用“有 URL”冒充检查通过。

本版未更换取流接口，增加了临时预检容错与诊断，**未证明用户日志中的播放失败已修复**。接口未返回地址时仍不能播放；下一次用户日志会自动标明实际剧集与状态，不再靠猜测定位。

搜索在首次使用时预热首页和四个分类的第一页，随后在已保留的标题中查找；这是有范围的本地搜索，未命中不表示全站没有该剧。分类翻页由实际站点返回值决定，不再伪造固定总页数。

## 使用

CCTVHost 0.22.1 的本地文件导入不会按同名覆盖旧资源，文件名中的 `(1)` 也不是版本号。更新时先停止旧资源，确认状态已停止，再从“导入影视包 · JS / Python / ZIP”导入上述带版本名的文件，明确打开新条目。可通过查看或导出代码确认 `VERSION = '1.0.2-public'`。只启动一次并等到资源就绪，再打开影视页面；目录刷新或清响应缓存不会重新执行 Python 模块。若已有会话一直待清理，应先完全关闭并重开 App。

新日志应在初始化时包含 `[HGTV]` / `hgtv_init` 和 `source_version: "1.0.2-public"`；失败提示也会带版本、阶段和集 ID。若仍是旧版“站点未提供本集的整集兼容播放；可使用官方 App”，应先核对实际导入文件和当前运行资源。

在支持 Python 源的 TVBox 客户端中把脚本 URL 配为 Python 源，例如：

```json
{
  "sites": [
    {
      "key": "hgtv_public",
      "name": "红果公开兼容",
      "type": 3,
      "api": "https://raw.githubusercontent.com/joeshu/For-ADM/master/research/hongguo/hgtv_public_optimized.py",
      "searchable": 1,
      "quickSearch": 0,
      "filterable": 0
    }
  ]
}
```

客户端必须实际支持此类 Python `Spider`；以上配置未在每一种 TVBox 分支上验证。现有配置中替换 URL 时，应保留该客户端自己的 Python 加载约定。

本地命令：

```sh
# 默认只检查目录和第 1 集地址/文件头
python3 hgtv_public_optimized.py selftest

# 检查已知目录的每一集；有失败就退出 1，不承诺全集播放
python3 hgtv_public_optimized.py selftest --all --series 7690961604636052505

python3 hgtv_public_optimized.py detail 7690961604636052505
python3 hgtv_public_optimized.py search 军需
python3 hgtv_public_optimized.py play '7690961604636052505~7690963410778868761'
```

`play` 命令输出播放器需要的临时 URL 和请求头，应一起使用。临时 URL 不适合写死在配置或公开日志中。`--preview` 明确请求短试看，不会自动冒充整集。

## 验证结果与范围

2026-11-01，1.0.2 共 55 项离线测试通过，覆盖请求合并、缓存淘汰、过期地址、网络恢复、异常响应、跳转验证、解析边界、目录完整性、自检退出码、视频轨、分段元数据、临时预检失败容错、错误阶段与诊断脱敏检查。运行方式：

```sh
python3 -m unittest discover -s research/hongguo -p 'test_public_*.py' -v
```

[在线性能记录](optimized-live-check.json)：同一进程重复打开首页，HTTP 请求从 1 次降为额外 0 次，单次测量从约 1.87 秒降到 0.3 毫秒。这是本版冷缓存与热缓存的比较，不是与原脚本的同条件性能对比，也不是所有网络的速度保证。

[逐集地址与文件头检查](optimized-series-audit.json)：《军需处长的账本》完整目录为 46 集；本次 5 集通过初始化检查、41 集返回 403，自检退出 1。第 4 集这次通过，说明站点响应会变化，不能沿用旧审计的固定“三集”结论。上述 5 集也未在本次逐集自检中完整解码或播放到结束。服务器未提供兼容地址的剧集会明确失败；本版没有解决这些剧集的开放范围。

原始新附件 SHA-256：`5d8b2ebd279e22018ec7a01d3029be5e3249d29c23de210317d92c27a7137cf8`（1615 行）。仓库不保存原附件中的设备、密钥或外部缓存数据。本次仅发布 Python 脚本，未变更 iOS App 或构建 IPA。
