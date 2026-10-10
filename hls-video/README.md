# HLS 视频广告试用版

可选规则：<https://raw.githubusercontent.com/joeshu/For-ADM/master/hls-video/quantumult-x-snippet.conf>

此规则独立于 `universal/quantumult-x-snippet.conf`，可与网页去广告同时启用。将 `[rewrite_local]` 内容加入 Quantumult X 重写，将 `[mitm]` 主机合并到现有列表，启用并信任 HTTPS 解密证书。默认不输出日志、不通知、不请求第三方解析服务、不更换播放来源。停用此规则即可恢复原始播放清单。

## 第一批适配与边界

只匹配 `c数字.rrcdnbf数字.com/video/*.m3u8`。参考 [Yswag 的 cmsAdblock.js](https://github.com/Yswag/for-own-use/blob/main/js/cmsAdblock.js) 中暴风 `/adjump/` 广告路径特征，重新实现解析及完成流程；未复制其少数域名、URL 长度、前缀统计或第三方解析算法。

该特征来自参考脚本，尚未取得当前真实播放清单验证，不能保证资源站仍采用此形式。试用版满足以下条件才修改：

- 已结束的 VOD 清单，TS 分片，存在合法目标时长。
- 整个广告段的分片路径均为 `/adjump/*.ts`，前后都存在 `EXT-X-DISCONTINUITY`，相邻两段全为非广告路径。
- 单个广告段不超过 120 秒，总删除时长不超过原片长 20%，至少保留两个内容分片。

按完整广告段移除，不以短时长、较少数量、不同域名或 URL 字符长度推断广告。保留正常分片的原始 URI、查询参数、顺序与全局标签；移除广告段的进入边界，保留其后的内容边界。目标时长维持原值。

加密（包括显式 IV）、BYTERANGE、fMP4/MAP、直播、低延迟、主播放清单、日期时间等未支持标签全部原样返回，避免错误处理 HLS 状态。未被不连续边界包围的片头/片尾广告暂不删除。视频中已烧录的文字或图像广告无法通过清单修改消除。

## 验证与后续接入

本地测试覆盖明确广告段、正常分片长度变化、混合段、加密、状态标签、主清单、直播、域名边界、异常响应、CRLF 和重复处理。尚未完成手机实际播放、跳转和连续播放验证。

试用时查看当前线路实际请求的 `.m3u8` 域名；网站使用其他资源站时，此规则不会命中。若广告仍在，需要对应广告清单样本来增加资源站策略。分享样本前隐藏鉴权 token、Cookie 等敏感值。

模板清单 `templates.json` 登记主机、接口、广告路径、删除阈值和证据；源码在 `src/clean.js`。同一资源站被多个网站使用时复用一份策略，新资源站取得样本后再接入。生成与检查：

```sh
node scripts/build-hls-clean.mjs
node scripts/build-hls-clean.mjs --check
node --test tests/hls-clean.test.mjs
```

协议参考：[RFC 8216](https://www.rfc-editor.org/rfc/rfc8216)。本实现仅处理上述保守子集，不是完整 HLS 解析器。
