# 三站更新兼容性离线实验

本目录为离线研究工具，不直接打包进 QX；验证通过的改进另在 `universal/src/` 实现。结论见 [首轮研究](../../universal/MEDIA-RESILIENCE-20261018.md) 与 [第二轮更新模拟](../../universal/MEDIA-RESILIENCE-20261021.md)。

原研究使用的 966 个原版 JS 已保存在 [sources/](sources/README.md)，含更新前后分站、分版本目录及来源和 SHA-256 清单。可直接使用 `sources/before`、`sources/after` 作为下述命令的输入目录。

2026-10-21 又归档 744 个新版 JS，位于 `sources/2026-10-21`。原 `before/after` 数据未覆盖。

## 复现

需要 Node.js 24，依赖仅在本目录安装：

```sh
npm ci --prefix research/media-resilience --ignore-scripts --no-audit --no-fund
node --test research/media-resilience/structural.test.mjs
node research/media-resilience/compare.mjs \
  --before=/path/to/before \
  --after=/path/to/after \
  --out=/path/to/report.json
```

两个源码目录均包含 `kkapp/`、`ncat/`、`happ/`；脚本递归读取其下的 `.js`。旧版需要 `before-sources.json` 中每站 74 个文件，新版完整样本为每站 248 个文件，文件名和 SHA-256 见 `report.json`。旧版 URL 在 `before-sources.json`；新版路径从登记主脚本的动态加载映射发现。报告仅保存元数据和短代码定位，不存放完整站点源码。

比较器从旧版来源清单引用原动作，逐一验证旧源码后，用它们提取词法结构。新版动作清单仅用于事后判断漏掉或多出的候选，未用于构造旧版结构规则。

默认完整分词以避开字符串、注释、模板文本和正则表达式中的伪代码。字面量与操作必须保持一致，混淆标识符允许一致的一对一重命名。缺少片段外变量、出现冲突或重叠时拒绝改写。它不是完整的作用域分析器，也不是可直接发布的广告清理器。

研究没有执行网页业务、验证辅助函数注入、调用 API、抓取媒体或完成手机测试。已核验改写点之外的候选数量只是对照指标，不能作为全面广告覆盖率或未来无误匹配的证明。

## 正式运行时的独立回归

`verify-runtime.mjs` 使用独立的研究匹配器作为改写对照，验证正式运行时的原始源码与模拟改名源码。需要当前已构建脚本，以及接入前的独立脚本基线：

此实验对照对应 2026-10-18 的结构方案，不包含后来新增的 AST 语义改写。对当前脚本运行会出现预期的新增改写差异；当前版本使用下述完整性/语法/幂等性检查与 `ad-media-countdown.test.mjs` 中的真实模块行为测试：

```sh
node research/media-resilience/verify-countdown.mjs --out=/tmp/media-countdown-validation.json
node --test tests/ad-media-countdown.test.mjs
```

```sh
mkdir -p /path/to/baseline
git archive fab5f9a kkapp/ad-clean.js ncat/ad-clean.js happ/ad-clean.js | tar -x -C /path/to/baseline
node research/media-resilience/verify-runtime.mjs \
  --before=/path/to/before --after=/path/to/after \
  --baseline=/path/to/baseline --out=/path/to/runtime-report.json
```

验证不执行网站业务。改名语料仅用于语法与结构兼容性验证，不代表改名后整个网站可以运行。

## 更新模拟（2026-10-21）

`simulate-updates.mjs` 对三站 24 个真实模块施加 13 类变换，比较正式脚本清理结果与已核验结果的完整 AST；同时核验语法、幂等性和拒绝边界。默认使用当前脚本，`--runtime-dir` 可指定已发布基线。

```sh
node --test research/media-resilience/updates.test.mjs
node research/media-resilience/simulate-updates.mjs --out=/tmp/media-update-simulation.json
```

不是所有场景都已支持。报告 `failures` 为空只表示实验执行及保护检查通过；具体兼容范围看 `equivalent/misses`。完整方法、基线复现及后续数据入口方案见第二轮研究。
