# 更新前后的原版 JS 归档

这些文件来自前述公开站点的原始 JS 响应，保留获取时的完整字节；没有执行 For-ADM 清理、格式化、变量改名或重新压缩。

| 阶段 | 站点 | 版本 | 文件数 | 目录 |
| --- | --- | --- | --- | --- |
| 更新前 | 可可影视 | 2.5.14 | 74 | [before/kkapp/2.5.14/js](before/kkapp/2.5.14/js) |
| 更新后 | 可可影视 | 2.5.15 | 248 | [after/kkapp/2.5.15/js](after/kkapp/2.5.15/js) |
| 更新前 | 网飞猫 | 2.5.29 | 74 | [before/ncat/2.5.29/js](before/ncat/2.5.29/js) |
| 更新后 | 网飞猫 | 2.5.30 | 248 | [after/ncat/2.5.30/js](after/ncat/2.5.30/js) |
| 更新前 | 好好看 | 2.5.22 | 74 | [before/happ/2.5.22/js](before/happ/2.5.22/js) |
| 更新后 | 好好看 | 2.5.23 | 248 | [after/happ/2.5.23/js](after/happ/2.5.23/js) |
| 2026-10-21 采样 | 可可影视 | 2.5.16 | 248 | [2026-10-21/kkapp/2.5.16/js](2026-10-21/kkapp/2.5.16/js) |
| 2026-10-21 采样 | 网飞猫 | 2.5.31 | 248 | [2026-10-21/ncat/2.5.31/js](2026-10-21/ncat/2.5.31/js) |
| 2026-10-21 采样 | 好好看 | 2.5.24 | 248 | [2026-10-21/happ/2.5.24/js](2026-10-21/happ/2.5.24/js) |

共 1,710 个文件，91,749,057 字节。原研究的 `before/after` 目录保持不变；新增日期目录保存后续采样。更新前保存的是原研究核验的相关模块；更新后及新增采样保存主脚本与动态加载映射中的全部模块。均不含 HTML 单独引入的 vendor 第三方库，不代表整个网站的所有资源。

[manifest.json](manifest.json) 为每个文件记录来源请求 URL、版本、字节数、SHA-256 和原始本地保存时间。没有保存当时的 HTTP 响应头或重定向链，`savedLocallyAt` 不代表服务器的 Last-Modified 时间。

本次复制时逐一核对既有研究清单的 SHA-256。`.gitattributes` 禁用 JS 换行转换，保持 Git 中保存的原始字节。不要直接格式化或清理这些归档文件；分析产生的新文件应另存。

## 校验与分析

在仓库根目录校验全部原始文件：

```sh
node scripts/verify-media-archive.mjs
```

该校验已加入仓库的一键检查流程，仅验证完整性，不执行归档 JS。

复现版本结构研究：

```sh
npm ci --prefix research/media-resilience --ignore-scripts --no-audit --no-fund
node research/media-resilience/compare.mjs \
  --before=research/media-resilience/sources/before \
  --after=research/media-resilience/sources/after \
  --out=/tmp/media-comparison.json
```

相同文件名或哈希后缀不保证源码相同，比较时应同时使用站点、版本和 SHA-256。
