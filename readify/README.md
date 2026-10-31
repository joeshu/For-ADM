# Readify 阅读挑战自动化（Quantumult X）

Readify（`readifyapp.voiceclub.cn`）7 天阅读挑战：被动抓取登录态，定时调用官方签到接口。只读请求头与调用签到接口，不修改 App 自身请求与响应，不伪造奖励或会员权益。

## 文件

- `readify-token.js`：`script-request-header`，从 App 请求头保存 `x-token`、`x-user-id`、`x-device-id`，并从 URL 的 `campaignId` 自动更新活动 id。
- `readify-checkin.js`：`task_local` 定时任务。先查 `streaks/status`，仅在 `canCheckIn=true` 且今日未签时调用 `POST /api/campaigns/streaks`。

## 安装

1. 把两个脚本加入 Quantumult X 脚本（远程引用即可，无需本地保存）。
2. 将 `quantumult-x-snippet.conf` 内容合并进现有配置，不要覆盖已有的 `[rewrite_local]`、`[task_local]`、`[mitm]`。
3. 启用重写与 MITM，安装并信任 Quantumult X 根证书。
4. 打开一次 Readify App，进入阅读挑战页刷新，让 `readify-token.js` 抓到登录态（脚本日志出现 `Readify: 登录态已更新`）。
5. 手动运行一次 `readify-checkin.js` 验证通知，再保留定时任务（默认每天 08:15）。

## 抓取范围

`[rewrite_local]` 匹配 `^https:\/\/readifyapp\.voiceclub\.cn\/api\/`，即该域名下所有 API 请求都会触发一次请求头脚本（仅写入本地 `$prefs`，值未变化不重复写）。如需更省开销，可把正则收窄为
`^https:\/\/readifyapp\.voiceclub\.cn\/api\/campaigns\/`
但换活动或换接口后可能抓不到新的 `campaignId`。

## 本地存储键

| 键 | 含义 |
| --- | --- |
| `readify_token` | `x-token`（JWT） |
| `readify_userId` | `x-user-id` |
| `readify_deviceId` | `x-device-id` |
| `readify_campaignId` | 当前活动 id，默认 `reading-streak-7d-202607` |

`readify-checkin.js` 顶部的 `FALLBACK` 留空即可；换机或新装时也可手填。未抓到 `x-device-id` 时脚本会生成一个 UUID 并写入 `readify_deviceId`（App 的设备 id 本身就是随机 UUID，抓取脚本随后会用真实值覆盖）。仓库内不保存任何真实 token、用户 id 或设备 id。

## 行为说明

- Token 过期（按 JWT `exp` 判断）时不发请求，直接通知重新打开 App 抓取。
- `401/403` 视为登录态失效；接口返回 `code != 0` 时原样提示，不重试轰炸。
- `canClaim=true` 只提示“有奖励待领取”，领奖仍需在 App 内操作。
- 活动状态非 `ACTIVE` 时不做任何签到请求。

## 限制

- 定时依赖 Quantumult X 后台运行，iOS 后台调度不保证准点；漏跑当天手动运行一次即可。
- 请求头字段（`x-os`、`x-user-agent`、UA 版本号）取自 3.6.2 实测；App 大版本升级后若接口校验变化，需要按新抓包更新。
- 未验证 App 是否存在设备风控；脚本只做单次签到，不含循环重试或批量账号。
