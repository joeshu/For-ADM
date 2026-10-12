# 影视站诊断与源码检查

默认关闭日志。诊断只在 Quantumult X 中记录站点、脚本版本、JS 路径、替换组数和下载保护标记，不记录查询参数、响应正文、影片地址或账户数据。

## 手机检查

在 Quantumult X 的任务中添加以下脚本，关闭定时执行，只在需要时手动运行：

- 开启：`https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/debug-on.js`
- 查看最近记录：`https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/debug-report.js`
- 提前关闭：`https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/debug-off.js`

1. 更新统一订阅与 QX 脚本缓存。
2. 手动运行开启脚本；诊断 10 分钟后自动失效。
3. 关闭原网页，重新打开首页或下载页。
4. 在 QX 脚本日志中查找 `[For-ADM]`，或运行查看记录脚本；开启会清除上一轮记录；好好看使用 happ 标记；每站最多保留最近 16 个模块/测试类型的记录。分享记录时包括 `checkedAt`，避免把旧记录当作本次结果。
5. 检查结束后运行关闭脚本，或等待自动失效。

| 字段 | 含义 |
|---|---|
| revision | 实际执行的统一/独立脚本版本 |
| status=modified | 本次响应已改写；仍需确认页面加载并执行该响应 |
| status=unchanged | 响应未修改；可能已清理、源码更新或没有支持的广告指纹 |
| status=response-preserved | 状态码/响应类型不适合改写，已保留 |
| groups / changedGroups / pairs | 源码指纹匹配组数、实际变更组数和替换项数 |
| failedGroups | 指纹匹配但完整替换次数不符合的组数；源码变化时可用于定位 |
| downloadProtection=true | 响应包含下载数据清理 helper；下载页已进入保护路径 |
| probe | true 为带 for_adm_probe 参数的直接 JS 测试；不能代替网站实际分包请求 |
| checkedAt | 本次记录时间，Unix 毫秒 |

没有新记录不能直接认定脚本故障。应检查网页是否走缓存、请求域名与端口是否覆盖、MITM 是否生效，以及其他重写规则是否优先处理。诊断不开启任何全局拦截；未经过脚本的请求无法被脚本报告。

## 源码变化检查

仓库提供手动 GitHub Actions：`KKAPP NCAT and HAPP source audit`。在 Actions 页面选择该工作流并点击 Run workflow。结果在日志与工作流摘要中，不自动修改规则。

本地运行：

```sh
node scripts/audit-media-sites.mjs --out=media-source-audit.json
node scripts/audit-media-sites.mjs --site=kkapp --out=kkapp-audit.json
node scripts/audit-media-sites.mjs --site=ncat --source-dir=/path/to/sources --out=local-audit.json
```

检查入口的版本目录/主 JS 文件名，以及已登记分包每组广告指纹和精确替换次数。报告区分 PASS、CHANGED、UNAVAILABLE、NOT_RUN；部分文件检查或离线检查标记 PARTIAL，不作为完整线上通过。源码变化退出码 1，网络不可验证退出码 2，避免把访问失败当成适配通过。

此检查验证源码适配能力，不能代替手机广告展示与播放验收。不抓取 API、影片、下载文件或 HLS。

现代/legacy 下载规则加入各自独有的函数与数据变量指纹，避免把另一版未匹配误报成当前版失败。任务脚本更新后需更新 QX 任务脚本缓存；可在任务 URL 后加 `?v=20261012-history` 强制请求新版本。

电影猎手接入 `dyls` 记录。`playbackProtection` 表示响应含超时/续播辅助代码；`adCacheProtection` 表示响应含两个已确认广告缓存键的清理代码。两者不能证明浏览器执行成功。电影猎手源码检查运行 `node scripts/audit-dyls-site.mjs`，或手动运行 “Dyls source audit” 工作流。
