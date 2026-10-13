# HLS 视频切片去广告

Quantumult X：<https://raw.githubusercontent.com/joeshu/For-ADM/master/hls-video/quantumult-x-snippet.conf>

Surge：<https://raw.githubusercontent.com/joeshu/For-ADM/master/hls-video/surge.sgmodule>

Loon：<https://raw.githubusercontent.com/joeshu/For-ADM/master/hls-video/loon.plugin>

本模块独立于网页去广告订阅，可并用。QX 将模块加入重写订阅，合并其 MITM 主机并启用已信任的 HTTPS 解密证书；更新后刷新脚本缓存、退出原播放页再重新打开。原网页统一订阅地址不变。Surge/Loon 配置已经生成，尚未在这两个客户端实机验证。

## 已实现的两类策略

| 策略 | 匹配范围 | 行为 |
| --- | --- | --- |
| 暴风原有试用策略 | c数字.rrcdnbf数字.com/video/*.m3u8 | 未加密 VOD/TS 中前后由不连续边界包围的完整 /adjump/ 段；最多 120 秒、20%，至少保留两个内容分片 |
| CK 明文插入段 | ckzy3.com/日期/影片ID/码率kb/hls/*.m3u8 | 日期/16位哈希/seg_五位编号.jpg 的明文段，后面须由不连续边界进入已登记 CDN 的 AES-128 正片；支持片头和中途完整插入段，最多每段 120 秒、总时长 20% |

CK 的正片域名限 cklunlicaiji.com 与 ckzy3.com，正片路径必须为 /日期/影片ID/码率kb/hls/分片.jpg 或 .ts。不能凭 jpg 后缀、短时长、不同域名、1000kb 或 /stream/ 判断广告。加密的同形路径、混合段、未封闭广告段、超预算和未知内容路径保持原始清单。

## 实现与教程的差异

研究来源：[蝴蝶影视 M3U8 教程](https://paste.liumingye.cn/26475)。独立实现了分片状态快照与按完整段过滤，没有复制原文的全局关键词替换。

- METHOD=NONE 是有效的明文状态，按需保留，支持 AES → 明文和密钥轮换。
- 保留正片 URI 的字节、查询参数、顺序和对应 EXTINF；不请求、解密或改写媒体分片、Key 文件。
- 删除片头时推进 MEDIA-SEQUENCE；删除中途片段后，若 AES-128 原先依赖隐式 IV，给受影响正片补写按原媒体序号计算的显式 IV。相对密钥 URI 保持原样。
- 不强制把不连续边界压成一个。保持每个保留分片原有的不连续序号；必要时连续输出多个 DISCONTINUITY，随后恢复正确密钥状态。
- 需要新属性时提高协议版本下限；CRLF 与末尾换行保留。无命中时整个响应原样返回。
- 直播、主清单、SAMPLE-AES/DRM、MAP/fMP4、BYTERANGE、低延迟、日期时间及未知标签暂不处理；HTTP 206、错误响应和 HTML/JSON 响应不改写。

不增加 DIRECT 分流，不改换播放线路。本实现只适用于已核验结构的单清单 VOD；有独立音轨/字幕或其他 rendition 时需要配套核验，不能据此保证跨 rendition 同步。视频中已烧录的广告不能由播放列表清理消除。

## 真实清单回放结果

2026-10-13 获取教程提供的公开 M3U8，未下载媒体分片或密钥。1704 个分片中，5 个明文插入段共 30 个分片被删除；其余 1674 个分片的 URI 顺序、时长、AES 密钥/IV 状态及不连续序号保留。原文里的广告哈希已变动，但本策略结合命名、明文状态、相邻 AES 正片与边界仍能命中。详见 [回放证据](evidence/paste26475-replay-20261013.json)。

这证明清单重写与状态保持通过，尚未验证 iPhone 实际解码、切线和连续播放。未承诺其他资源域名自动生效。

## 诊断

Quantumult X 复用统一订阅的三个手动任务 debug-on.js、debug-report.js、debug-off.js，开启后持续 10 分钟，新增 hls-video 记录。刷新三个任务的脚本缓存后，查看覆盖数量为 18（17 个网页/App 适配单元与一个可选 HLS 模块）。记录只含策略、主机、路径、删除分片数/时长与保留原因，不含响应正文、密钥 URI 或签名查询参数。

## 本地检查

```sh
node scripts/build-hls-clean.mjs
node scripts/build-hls-clean.mjs --check
node --test tests/hls-*.test.mjs
node scripts/check-ad-clean.mjs
```

模板在 templates.json；原保守子集在 src/clean.js，状态快照解析器在 src/stateful.js。新资源域名须取得完整 M3U8 与广告/正片证据后登记策略。协议依据：[RFC 8216](https://www.rfc-editor.org/rfc/rfc8216)，重点为 4.3.2.4、4.3.3.2、4.3.3.3 与 5.2。
