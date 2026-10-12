# 扩展新网站

复用清理操作，逐站确认域名、路径、广告特征和播放内容。以下命令仅在本地读取样本，不联网、不执行网站 JS、不自动发现域名，也不修改正式规则。使用 Node.js 24，无需安装依赖。

## 一键检查

仓库根目录运行：

```sh
node scripts/check-ad-clean.mjs
```

检查生成文件一致性、网站登记表、广告删除、播放字段保留、未知主机/异常响应放行、重复执行以及统一版和独立版输出一致性。新增 `universal/fixtures/*.json` 自动进入检查；每个启用模板至少需要一个样本。这是离线回归检查，不能替代手机播放实测。

## 新网站草稿

先保存脱敏的 HTML、JS 或 JSON 响应为 `sample.html` 等文件，保留广告结构和播放结构。不要保存账号、访问令牌或私人内容。再建立 `site.json`：

```json
{
  "id": "example-video",
  "name": "示例视频网站",
  "url": "https://video.example/player.html",
  "kind": "html",
  "sample": "sample.html",
  "requires": ["明确的网站源码标记"],
  "operation": "container",
  "tag": "div",
  "target": "已确认广告容器的完整class词",
  "removed": ["样本中的广告内容"],
  "preserved": ["样本中的完整播放器配置", "样本中的选集链接"]
}
```

`sample` 相对于 spec 文件目录。`requires`、`removed`、`preserved` 都是字面字符串，必须存在于原样本。广告身份需人工确认：工具只证明指定内容被移除且保护内容保留，不能判断任意模块是否为广告。

```sh
node scripts/new-ad-site.mjs --spec ./site.json
```

默认写入 `universal/drafts/example-video/`，也可以使用 `--out /tmp/example-video-draft`。已存在目录不会覆盖。生成的 `template.json`、`site.json`、`fixture.json` 和接入说明均为草稿，不自动进入规则、MITM 或 GitHub 发布。检查失败时不写入草稿。

| 目标 | kind / operation | target 等参数 |
| --- | --- | --- |
| HTML 广告容器 | html / container | tag 和一个完整 class token；保留相似 class |
| HTML 广告脚本入口 | html / script | target 为 script/src 的完整原始属性值 |
| JSON 广告数组 | json / clearArray | target 为 data.adList 等明确路径；仅 result:true/data 信封、数组结构且指纹匹配时清空 |
| JS 广告特征 | js / replace | target 为完整原始片段，replacement 为新片段；count 默认 1，次数不符整组放行 |

草稿工具会用 Node 的 module 语法模式检查修改后的 JS，不执行代码；复杂网站构建产物仍需针对实际环境验证。手工修改 ES module 时可使用 `.mjs` 与 `node --check`，不要直接运行网站或广告代码。复杂函数边界定位优先复用现有 souju/yqk 适配器，草稿工具不猜测混淆变量。

生成器只登记输入 URL 的精确主机和 pathname，可带 query；不会自动增加 www、子域名、整个 JS 目录、文件哈希族或媒体路径。HTML 的脚本 src 使用原属性精确匹配，绝对/相对路径变体需分别确认。JS 指纹建议选不被修改的稳定源码片段。

HTML 中的内嵌广告入口可在模板中使用 `removeInlineScripts`，提供至少三个 `scriptRequires` 源码指纹，并用 `requires` 限定站点模板。只作用于无 src 的真实 script 标签，不执行源码。该操作需手工配置与样本验证，草稿工具不会自动猜测内嵌广告。

## 从草稿接入

1. 检查广告身份、源码特征、路径和保护断言，增加首页/播放页/切换线路样本。若仅换域名且结构一致，直接复用现有模板绑定，不新增重复适配器。
2. 将 `template.json` 保存为 `templates/模板ID.json`，并将模板 ID 加入 `manifest.json` 的 templateFiles。将 `site.json` 的 template 设置为模板 ID、status 改为 source-verified，再追加到 `sites.json` 的 sites。把 fixture.json 复制到 `universal/fixtures/模板ID.json`。
3. 运行以下命令；生成文件不要手改：

```sh
node scripts/build-ad-clean.mjs
node scripts/site-registry.mjs
node scripts/check-ad-clean.mjs
```

4. 设备端检查首页、播放、选集和线路切换，刷新 Quantumult X 远程规则/脚本缓存。实际通过后才把 status 改为 device-verified。默认日志保持关闭。

`sites.json` 仅存放来源、发布页、样本链接和核验状态；运行时域名与路径由 `templates/*.json` 维护。`SITES.md` 自动生成，pending 项不进入规则。发布页增加新域名时先核验，不自动登记。规则更新失败可恢复上一提交的配置和脚本，或暂时禁用对应重写。

内嵌 JS 的局部修改可使用 `replaceInlineScripts`：配置站点 `requires`、至少三个 `scriptRequires` 和 `pairs` 的精确源码/替换内容/预期次数。仅修改真实、无 src 的 script，未知或重复源码保留；用于明确的兼容性修改时保留原脚本其他内容。

## 瓜子影视原规则完整保留

`requestRules` 支持显式 verbatim 模式，从本地 sourceFile 读取并原样合并规则。瓜子影视按用户要求完整采用上游 23 条规则及 13 个 MITM 主机，原匹配正则保持不变；6 条响应规则调用本仓库瓜子独立脚本。来源原文件存档在 guazi-app/upstream；详见 [说明](../guazi-app/README.md)。加密依赖本地打包，尚未设备验证。该模式是明确选择的完整导入，不用于自动发现或扩域。

## 复用解析器策略

`manifest.json` 的 `parserProfiles` 保存解析器广告操作与源码指纹；解析器模板通过 `parserProfile` 引用，并单独维护 `bindings` 域名与路径。构建时展开策略，运行时不联网加载，不自动发现主机。当前策略：

| 策略 ID | 内容 |
| --- | --- |
| qlplayer | 麒麟片头/暂停广告两个判断，保留直接解析播放分支 |
| qingning-player | 清宁错误点击 APP 推广与下载链接 |

新增网站调用已登记解析器时，无需修改解析器策略或复制广告代码；统一订阅已经按解析器主机匹配。相同解析器结构换主机时，先核验正常源码，再给原解析器模板增加明确 binding/域名和样例。不同主机需要独立模块但结构一致时，可以引用同一策略生成独立模块。播放器库名称相同不能作为策略适用的证据。

例如新解析器源码与麒麟策略一致，可创建草稿 spec：

```json
{
  "id": "new-parser",
  "url": "https://parser.example/assets/player.js",
  "kind": "js",
  "sample": "sample.js",
  "operation": "profile",
  "parserProfile": "qlplayer",
  "removed": ["if (playerConfig.ads.pre_roll.enabled) {", "if (playerConfig.ads.pause.enabled) {"],
  "preserved": ["const { url, type } = await resolveVideo();", "initPlayer(url, type);"]
}
```

运行现有 `node scripts/new-ad-site.mjs --spec ./site.json`。无需重新提供 replacement 或指纹，工具使用已登记策略，验证样本的广告删除与播放保留；特征缺失时失败，不写入草稿。不自动启用新主机。禁止将 parserProfile 与本地 actions、其他适配器或 JSON 策略混用，避免覆盖保护条件。

### 按需 JS helper

声明式模板可在 `jsHelpers` 定义 `{name:{marker,source}}`，JS `replaceGroup` 可通过 `helper: name` 引用。只有整个替换组成功并改变源码才注入 helper；同一响应同名 helper 去重，错误响应、未知源码、未变化组不注入。marker 必须是 source 中的非空唯一标记。helper 在浏览器执行，清理脚本本身只做文本改写；需单独验证 helper 行为以及完整模块改写后的语法。

### 非默认端口

绑定可声明 `ports: [51111]`。生成规则允许该显式端口以及不带显式端口的 URL；运行时按相同规则检查端口，MITM 保留纯域名。未声明 ports 的旧绑定保持原行为，不默认给全部站点开放端口匹配。

### 标签属性中的缓存参数

HTML `setQueryParameter` 使用 tag/attr/pattern 选择器，只修改指定标签属性里的查询参数，重复处理不追加重复参数。显式 `cacheBustRevision: true` 的模板可在参数或替换文本引用 `__ADM_CACHE_REVISION__`；构建时按本站模板与公共引擎计算版本，同一模板的统一/独立脚本使用相同版本，其他站点的改动不会触发本站版本变化。
