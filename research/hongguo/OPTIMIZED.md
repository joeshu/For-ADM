# HGTV Python 公开兼容版 1.0.0

[下载独立脚本](https://raw.githubusercontent.com/joeshu/For-ADM/master/research/hongguo/hgtv_public_optimized.py)。Python 3.8 及以上，仅使用标准库，不需要安装依赖。

这是基于新附件审查后整理的**独立公开兼容版**，原始附件未改动。保留 TVBox 的 `Spider` 方法：`init`、`homeContent`、`homeVideoContent`、`categoryContent`、`detailContent`、`searchContent`、`playerContent`。它使用站点页面和正常网页兼容播放接口，不包含原附件的 App 缓存提取、设备模拟、签名与内容密钥处理，也不保留其本地解密 HTTP 服务。不是原脚本的全部功能替换版。

## 性能与稳定性改动

| 环节 | 新行为 |
| --- | --- |
| 页面加载 | HTML 与解析结果一起缓存 5 分钟；重复打开不再次下载或解析 |
| 并发 | 相同请求合并执行，不同请求可并行；搜索预热和逐集自检最多 3 个工作线程 |
| 内存 | 缓存最多 32 项、16 MiB 估算有效载荷，目录索引最多 2000 部；两者独立，不代表进程总内存上限 |
| HTTP | 每线程独立 Cookie 会话，保留系统代理与 TLS 校验；单次套接字超时 6 秒，最多 2 次尝试，重试预算 18 秒 |
| 重试 | 只重试临时网络或服务错误；403/404 不反复请求；遵守短 `Retry-After`，长等待直接返回错误 |
| 数据读取 | HTML、JSON、媒体探针分别有大小上限；媒体最多读取 64 KiB，服务器忽略 Range 时立即停止 |
| 选集 | 从 SSR 的完整目录读取并保留长整数 ID，核对总集数，检查重复与无效 ID |
| 播放 | 整集与试看片段分开；地址按有效期缓存，预检期间过期则拒绝返回；失败不缓存 |
| 自检 | 空结果、无可用媒体或任一逐集检查失败均返回非零；文件头通过不会被标记为完整播放成功 |

HTTP 预算在连接、每次读取和重试前检查；正在阻塞的底层读取仍受套接字超时约束，因此不是强制的进程级硬截止时间。媒体预检仅检查 MP4 初始化信息，不能保证客户端完成解码。

搜索在首次使用时预热首页和四个分类的第一页，随后在已保留的标题中查找；这是有范围的本地搜索，未命中不表示全站没有该剧。分类翻页由实际站点返回值决定，不再伪造固定总页数。

## 使用

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

2026-11-01，32 项离线测试通过，覆盖请求合并、缓存淘汰、过期地址、网络恢复、异常响应、跳转验证、解析边界、目录完整性与自检退出码。运行方式：

```sh
python3 -m unittest discover -s research/hongguo -p 'test_public_*.py' -v
```

[在线性能记录](optimized-live-check.json)：同一进程重复打开首页，HTTP 请求从 1 次降为额外 0 次，单次测量从约 1.87 秒降到 0.3 毫秒。这是本版冷缓存与热缓存的比较，不是与原脚本的同条件性能对比，也不是所有网络的速度保证。

[逐集地址与文件头检查](optimized-series-audit.json)：《军需处长的账本》完整目录为 46 集；本次 5 集通过初始化检查、41 集返回 403，自检退出 1。第 4 集这次通过，说明站点响应会变化，不能沿用旧审计的固定“三集”结论。上述 5 集也未在本次逐集自检中完整解码或播放到结束。服务器未提供兼容地址的剧集会明确失败；本版没有解决这些剧集的开放范围。

原始新附件 SHA-256：`5d8b2ebd279e22018ec7a01d3029be5e3249d29c23de210317d92c27a7137cf8`（1615 行）。仓库不保存原附件中的设备、密钥或外部缓存数据。本次仅发布 Python 脚本，未变更 iOS App 或构建 IPA。
