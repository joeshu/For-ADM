# 专用广告分支剔除（2026-10-21）

本轮将“确认只负责广告的分支可以剔除”落实为两类 AST 后备处理。它在历史精确规则及词法结构规则之后执行，不删除 webpack 模块、导出、函数参数或公用依赖。

## 已实现的边界

| 专用逻辑 | 核验条件 | 处理 |
| --- | --- | --- |
| 广告存在判断 | 一个 ID 参数；两个局部绑定分别取得 store 和 `appAdvertisements`；最终只检查集合、ID 长度及 `some(item.id == id)`；无额外语句 | 保留原 store 调用，移除广告集合读取和遍历，返回 `false` |
| `getAdvertiseById` | 确认的静态属性名；一个 ID 参数；只有 ID 空值判断、`this.appAdvertisements` 读取及纯 ID 比较的 `find`；无结果时返回 `undefined` | 保留方法及签名，将函数体替换为 `return void 0` |

两类处理都要求实际 webpack 注册、对应站点的 `appName`，以及 `FLOATING_WINDOW`、`VOD_START` 和专用广告查询方法特征。品牌验证读取 AST 字面量，支持等价的 Unicode 转义。识别不绑定变量名、文件哈希或 `P` 等 store 导出别名；允许已核验的合并/拆分声明、点/括号属性、箭头/普通函数表达式及传统/现代写法。

仅凭名字包含 `ad` 或源码出现广告字段，不会删除函数。额外的认证调用、资源调用、状态写入、动态属性、可选读取、异步函数、改换集合方法、回调副作用或变量遮蔽，都会使相应新规则保持源码。

## 共享初始化必须留下

```js
// 结构已经完整核验，但不能证明 getStore 只承担广告职责。
function exists(id) {
  const store = imported.getStore();
  const ads = store.appAdvertisements;
  return !!(ads && ads.length > 0 && id && id.length > 0)
    && ads.some(item => item.id == id);
}

// 新后备的输出：停止广告读取，同时保留原调用及其错误传播。
function exists(id) {
  imported.getStore();
  return false;
}
```

实际替换复制原初始化调用表达式，不改变它的命名空间、导出别名、参数或调用绑定方式。原调用抛错时，清理后的函数仍抛出同一错误。不会把包含账户/资源职责的公共函数整体置空。

历史已核验精确/结构规则继续保持原行为；上面的“保留调用”是新后备在遇到未知构建形式时的保守策略，不代表重写了已有规则。

启动广告配置与下载广告继续使用已发布的专用逻辑：空广告 Promise 保留请求返回契约，下载分支复位可见状态/倒计时并清理原广告定时器，真实资源及失败回调保留。本轮未新增公共 HTTP 层改写，也未删除公共计时器或播放器函数。

## 解析成本与原子性

完整分词结束后，结构阶段只检查**尚未被已提交替换覆盖的静态广告集合读取**。对象属性定义和简单赋值不算集合读取；点属性已经按既有规则归一化。扫描能确认没有剩余读取时，跳过新增广告 AST 工作；仍有未知分支时才继续分析。扫描不完整时不提供“已无读取”的提示。

这项提示仅用于避免不必要的解析，不用于认定某个函数可以删除，也不关闭启动/下载语义处理。测试覆盖“已清理函数与未知新函数同时存在”，不能因为前者已命中就跳过后者。

语义阶段仍采用 2 MiB、600 ms 软预算及 500,000 遍历步数限制。冲突、重叠、预算或解析失败时，整组新语义改写不提交，新增计数归零，保留先前精确/词法阶段的结果。诊断新增 `semanticAdFunctions`，仅记录完成替换的专用广告函数数，不记录函数名、正文或参数。

## 验证方法

- 对三站各现代/legacy 主脚本，共六份真实原版源码，单独验证两种专用函数的识别及返回行为。
- 每份主脚本分别模拟框架别名改变、声明拆分及组合构建变化，共 18 个新后备行为案例。检查广告集合不再读取、判断始终为 `false`、共享初始化恰好执行一次且原错误仍传播。
- 确认原始 `fetchInitFromSign`、`setNetdisks` 实现保持原样；原有真实下载成功、登录失败、磁力/网盘/账户及启动消费者测试继续回归。
- 对额外认证/资源调用、状态写入、命名空间自引用、动态键、回调变量遮蔽、异步、错误品牌、伪 webpack 标记及预算耗尽进行保留测试。

更新模拟报告见 [ad-branch-simulation-20261021.json](../research/media-resilience/ad-branch-simulation-20261021.json)。其中 `adPredicateContract.disabled` 表示通过完整输出形状验证的广告判断空结果，`sharedInitializationPreserved` 验证保留了原初始化调用；实际执行行为由上述隔离测试负责。

本轮 240 个更新模拟案例完成，实验执行、语法、幂等性及 36 个拒绝边界检查均通过。主脚本的 48 个构建变换案例中，广告判断契约全部为已切断；其中 18 个通过新增后备切断，并确认保留共享初始化调用。其余由既有规则完成。

上一轮完整 AST 等价指标不会把“额外保留共享初始化调用”算作与旧版完全相同，不能用它单独判定本轮后备失效。报告仍保留原 `equivalent/misses`，并另列广告判断契约，避免通过忽略函数调用来提高数字。视图中的 `pI` 等渲染导出别名仍是独立待研究的问题，未放宽为任意函数调用。

全部 1,710 份归档原版 JS 的清理输出与 `80d4f6d` 逐字一致（忽略缓存修订号）；语法、重复处理稳定性及 1,842 次受保护字面量检查均通过。见 [历史源码验证汇总](audits/media-ad-branches-validation-20261021.json)。原始归档文件未修改。

完整仓库回归 791 项及研究工具 2 项测试全部通过。以上为源码与隔离行为验证，本轮未完成手机验收。

## 复现

```sh
node --test tests/ad-media-ad-branches.test.mjs tests/ad-media-structural.test.mjs
node research/media-resilience/simulate-updates.mjs --out=/tmp/ad-branch-simulation.json
mkdir -p /tmp/for-adm-ad-branch-baseline
git archive 80d4f6d kkapp/ad-clean.js ncat/ad-clean.js happ/ad-clean.js \
  | tar -x -C /tmp/for-adm-ad-branch-baseline
node research/media-resilience/verify-countdown.mjs \
  --baseline=/tmp/for-adm-ad-branch-baseline --out=/tmp/ad-branch-archive-validation.json
node scripts/check-ad-clean.mjs
```
