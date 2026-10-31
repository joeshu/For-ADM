# Readify 阅读挑战自动化（Quantumult X）

Readify（`readifyapp.voiceclub.cn`）7 天阅读挑战：被动抓取登录态，定时调用官方签到接口。只读请求头、只调签到接口，不修改 App 自身请求与响应，不伪造奖励或会员权益。

## 文件

- `readify-token.js`：`script-request-header`，从 App 请求头保存 `x-token`、`x-user-id`、`x-device-id`，并从 URL 的 `campaignId` 更新活动 id。
- `readify-checkin.js`：`task_local` 定时任务。先查 `streaks/status`，仅在需要时调用 `POST /api/campaigns/streaks`。
- `quantumult-x-snippet.conf`：QX 配置片段，每天 08:15 / 21:15 各跑一次（第二次是补跑，已签到会直接跳过）。
- `tests/run.js`：mock QX 环境的离线回归，`node readify/tests/run.js`。

## 安装

1. 把 `quantumult-x-snippet.conf` 内容合并进现有配置，不要覆盖已有的 `[rewrite_local]`、`[task_local]`、`[mitm]`。
2. 启用重写与 MITM，安装并信任 Quantumult X 根证书。
3. 打开一次 Readify App，进入阅读挑战页刷新，让 `readify-token.js` 抓到登录态（脚本日志出现 `Readify: 登录态已更新 [...]`）。
4. 手动运行一次签到脚本确认通知，之后交给定时任务。

## 稳定性设计

**抓取脚本**

- 整个脚本包在 `try/catch/finally` 里，任何异常都只写一行日志，并且 `$done({})` 必定调用一次，不会让请求头处理悬挂。
- `$prefs` 不存在或写入抛错时降级为只记日志，不中断。
- 只接受形如 JWT 的 `x-token`；收到格式异常的值时保留本地已有的有效 token，避免一次脏请求把可用登录态覆盖掉。
- 值与本地相同就不写 `$prefs`，减少后台写入；日志只输出键名，不输出 token。
- `campaignId` 先 URL 解码再按 `[A-Za-z0-9._-]{1,64}` 校验，非法值直接丢弃，避免把脏 query 带进签到请求。

**签到脚本**

- 单请求 15 秒超时（自建 `Promise` 计时器，不依赖 `$task.fetch` 是否支持 `timeout`），超时按网络失败处理并正常收尾。
- 有界重试：状态查询最多再试 2 次（1.5s、4s 退避），签到最多再试 1 次；只对网络错误、超时、`429`、`5xx` 重试，`401/403` 和其他 4xx 直接结束，不刷接口。
- 签到接口按幂等处理：网络失败后重试最多得到“今日已签到”，不会重复计天。
- 字段宽松解析：`code` 兼容数字/字符串，`canCheckIn`/`streakedToday`/`canClaim` 兼容布尔/0-1/字符串，`data` 缺失不抛异常。
- `canCheckIn=false` 时明确不签，只提示原因；字段缺失时按未签处理，由签到接口给最终结果。
- token 按 JWT `exp` 预检，过期直接通知、不发请求；剩余不足 2 天时在成功通知里附带续期提醒。
- 所有网络/解析/通知异常都有兜底，收尾只执行一次，`$done({})` 只调用一次。
- 最近一次结果写入 `readify_lastRun` / `readify_lastResult`（不含 token），排查时可直接看本地存储。

## 本地存储键

| 键 | 含义 |
| --- | --- |
| `readify_token` | `x-token`（JWT） |
| `readify_userId` | `x-user-id` |
| `readify_deviceId` | `x-device-id`；未抓到时生成并使用一个 UUID |
| `readify_campaignId` | 当前活动 id，默认 `reading-streak-7d-202607` |
| `readify_tokenUpdatedAt` | token 最近一次被更新的时间戳 |
| `readify_lastRun` / `readify_lastResult` | 最近一次运行的摘要，便于排查 |

`readify-checkin.js` 顶部的 `FALLBACK` 留空即可；换机或新装时也可手填。仓库内不保存任何真实 token、用户 id 或设备 id。

## 抓取范围

`[rewrite_local]` 匹配 `^https:\/\/readifyapp\.voiceclub\.cn\/api\/`，该域名下所有 API 请求都会触发一次请求头脚本（只写本地 `$prefs`，无变化不写）。如需更省开销，可收窄为
`^https:\/\/readifyapp\.voiceclub\.cn\/api\/campaigns\/`
但换活动或换接口后可能抓不到新的 `campaignId`。

## 验证

```sh
node readify/tests/run.js
```

覆盖：正常抓取、无变化不写、非 JWT 不覆盖、脏 `campaignId` 丢弃、写 `$prefs` 失败、未签→签到成功、已签跳过、401 不重试、网络错误重试成功、5xx 重试耗尽、请求悬挂超时收尾、token 过期、缺登录态、非法活动 id 回落、`canCheckIn=false`、字符串 `code`/布尔值解析。共 34 项。

以上是离线 mock 验证；QX 真机的后台调度、MITM 生效情况和接口字段仍需实机确认。

## 限制

- 定时依赖 Quantumult X 后台运行，iOS 后台调度不保证准点；漏跑时每天 21:15 的补跑会补上，仍失败可手动运行一次。
- 请求头字段（`x-os`、`x-user-agent`、UA 版本号）取自 3.6.2 实测；App 大版本升级后若接口校验变化，需要按新抓包更新。
- 未验证 App 是否存在设备风控；脚本只做单次签到，不含循环重试或批量账号。
