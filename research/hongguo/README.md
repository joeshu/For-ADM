# 用户附件 hgtv_plain.py：全集能力核验

新附件的独立性能优化版本见 [公开兼容版脚本与使用说明](OPTIMIZED.md)。下文保留的是**第一份附件**的研究结果；最新逐集检查见 [optimized-series-audit.json](optimized-series-audit.json)，开放结果并非固定不变。

结论：**这个附件不能确保红果全集可播放，不能用它替换当前 App 后宣称后续集已打通。**

2026-11-01 核验《军需处长的账本》，剧 ID `7690961604636052505`：

| 检查 | 实测结果 | 证据 |
| --- | --- | --- |
| 站点完整目录 | 46 个集 ID | `public-series-audit.json` |
| 附件 `_episodes` 公开取集分支 | 只列出 2 集，均在该剧目录中 | `attachment-public-branch-audit.json` |
| 附件返回的第 1、4 集公开 MP4 | 都是 10.000 秒视频；容器时长 10.080 秒 | `public-media-probe.json` |
| 站点正常兼容接口，逐集核验全部 46 个目录 ID | 3 集返回媒体地址并通过 MP4 初始化检查，43 集返回 403 | `public-series-audit.json` |
| 附件 selftest，注入空目录/空搜索结果 | 仍返回退出码 0 | `attachment-public-branch-audit.json` |

公开资源可能随时间和请求条件变化；某次取得 URL 不代表后续仍可用，也不证明视频为整集。本次第 4 集的公开分支曾未通过预检，后续复测返回了短试看；表中记录的成功也只有 10 秒视频，不是整集修复。

## 已验证与尚未验证

当前 App 0.2.48 已通过站点正常兼容接口播放网页开放集。此前 [iOS 模拟器检查](https://github.com/joeshu/For-ADM/actions/runs/41320848624) 已将上述第 1 集约 108.33 秒的真实整集播放到结束，包含画面和音轨。那是单集完整播放证据，不能扩展成 46 集全部成功。

新的逐集审计只请求正常网页兼容接口，最多读取返回媒体的 64 KiB 初始化数据；不把地址、文件头或 `preview=false` 当作完整播放证明。报告中的 `completePlaybackVerified` / `allEpisodesPlaybackVerified` 均明确为 `false`。无可用地址或初始化检查失败时，来源可用性审计返回非零退出码。本次退出码为 1，与 43 集被拒绝的结果一致。

附件的高清分支另外依赖 App 外部缓存，并含手工内容密钥处理；它不是新安装 App 可独立使用的通用全集接口。本次没有运行这些处理、没有读取 App 缓存、没有启动附件的服务，也没有复制相关实现进入仓库。若要接入网页未开放的剧集，需要可供第三方 App 使用的正式播放接口/SDK 授权；本附件不能替代它们。

## 审查与复现

原附件共 1261 行，SHA-256：

```text
276f26c5e29706a113c9b3fb1f5788cb8b9720e6bbb9547faf63cd9c752ee788
```

[静态审查](hgtv-plain-static-review.md) 保留了取集、公开地址预检及自检出口的行号依据。仓库保存审查工具、文本和去除媒体签名的 JSON；不保存视频、Cookie、App 缓存或内容密钥。

使用 Node 24、Python 3 和 curl，在仓库根目录运行：

```sh
node --use-env-proxy research/hongguo/audit-public-series.mjs --series=7690961604636052505
python3 research/hongguo/check-public-branch.py /path/to/original/hgtv_plain.py
```

第二条命令校验附件哈希，仅提取已审查的公开函数；强制禁用缓存与旧接口分支。空结果自检实验使用本地桩数据，不请求站点。两个命令重跑会更新对应 JSON，实际开放结果可能改变。
