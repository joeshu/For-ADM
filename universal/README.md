# Quantumult X 统一去广告

统一版与独立版现在由一份模板清单生成。共同的 JSON 操作、HTML 广告块删除和 JS 特征匹配已提取为公共逻辑；网站只配置域名、接口、广告字段和源码特征。当前覆盖搜剧/看剧AI（kanju3.com）、4kvm、ycblcw、YQK/QNTV、Auete、eboyang、聚爷爷、追影猫八组网站适配，另含瓜子影视 App 完整原规则。

## 使用

规则地址：<https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/quantumult-x-snippet.conf>

将规则的 `[rewrite_local]` 内容加入重写，将 `[mitm]` 主机列表合并到 MITM。启用 HTTPS 解密并信任证书。统一版与对应独立版择一启用，避免重复改写。更新规则后刷新远程脚本缓存，再重新打开页面；已缓存的旧页面不会自动更新。

脚本默认关闭日志。本站统一响应脚本不发起请求、不自动发现域名、不改写播放地址和媒体分片。瓜子模块独立引用上游脚本，保留其导航、会员标记和播放来源改写行为。测试验证了播放列表、剧集与鉴权字段的保留；尚不能替代手机端逐站播放实测，也不处理视频中已经烧录的广告。

当前维护网站响应清理与 App API 规则，不接入媒体流改写。

## 文件与生成

| 文件 | 作用 |
| --- | --- |
| `sites.json`、`SITES.md` | 网站来源、发布页与核验状态；后者自动生成，不决定运行时匹配 |
| `fixtures/*.json` | 可扩展的广告移除与播放保留断言，自动加入一键检查 |
| `templates.json` | 域名、路由、输出路径、广告策略与源码指纹的唯一清单 |
| `src/engine.js` | 字段校验、不可变 JSON 操作、HTML 删除、JS 修改组、统一入口 |
| `src/souju.js`、`src/function-tools.js` | 搜剧特定组件函数定位 |
| `src/yqk.js` | Nuxt 源码定位及公共 JSON 清理器注入 |
| `../scripts/build-ad-clean.mjs` | 生成八份脚本及八份规则，统一 MITM 和缓存版本 |
| `../tests/ad-clean.test.mjs` | 域名边界、广告策略、独立/统一一致性及播放字段验证 |

仓库根目录执行，使用 Node.js 24，无需安装依赖：

```sh
node scripts/build-ad-clean.mjs
node scripts/site-registry.mjs
node scripts/check-ad-clean.mjs
```

生成文件带 `GENERATED` 标记，不直接编辑。版本参数由模板、源码和生成器的内容哈希产生；所有规则引用同一版本。GitHub Actions 检查生成结果与源码一致，并运行回归测试。

## 域名边界

YQK/QNTV 页面域名支持 `(yqk|qntv)数字.app` 与 www 前缀。后端仅支持已登记的 11 个域名后缀，以及 `yz(?:y)?\d{4,6}` 日期前缀；未知 .com 后缀不会自动进入规则。MITM 使用对应后缀的 `yz*.` 通配符，但重写还需满足更严格的前缀与已适配接口路径。

搜剧 `/v1/` 后续路径已在统一版及独立版修正。JS 只匹配已登记文件族，并检查广告源码特征。页面导航保留，YQK 首页 `hotMudleList` 仅过滤已确认的广告动作 1、2、8、10、11。

看剧AI `kanju3.com` 经真实源码确认复用搜剧模板，统一版和搜剧独立版均包含该域名。已核验 `global-player-host-BEk1MOSZ.js`、`movie-card-runtime-DQVzig5g.js`、`main-DupXbhqc.js`：复用广告配置、网格、横幅与开屏处理，补充翻转容器 `Sp` 和手机顶部广告 `em`；翻转容器改为保留原前景包装及 children，不删除其中的选集/播放器内容。其他文件哈希仍需满足源码指纹。

## 接入新网站

参阅 [扩展操作说明](EXTENDING.md)：`node scripts/new-ad-site.mjs --spec ./site.json` 生成并检查新站草稿，`node scripts/check-ad-clean.mjs` 一键验证。网站来源和核验状态见自动生成的 [网站登记表](SITES.md)，待核验地址不会自动加入规则。

1. 获取广告接口样本或网站 JS，确认广告字段、播放字段及页面容器。不要只凭 `ad` 名称或宣传文字推断。
2. 优先复用现有模板。相同网站换域名时，只扩充该模板的域名清单；相同结构可复用操作并登记新域名。
3. JSON 使用 `set`、`clearArray`、`filterArray`，配合精确接口和结构条件；HTML 使用 `removeElements` 按真实标签的完整属性值或 class token 删除，使用 `removeAttributes` 删除明确的广告属性；JS 使用源码指纹与每处预期替换次数。
4. 新模板选择 `declarative` 或已有适配器，声明 `bindings`、路由类型及 `output`。结构无法复用时才增加适配器，适配器返回正文，由公共入口统一调用 `$done`。
5. 增加广告清除和播放字段保留样例，生成后运行检查。未取得源码或无法确认的站点不加入匹配范围。

可统一的是清理操作与模板结构；不同网站的广告字段、混淆变量和播放流程仍需分别确认。当前没有自动清除任意网站广告的规则。未知 JS 特征或异常响应保留原正文；源码结构变化需要复核模板。

## Auete 网页广告

发布页 `auete.asia` 当前指向 `www.aeete.com`，访问后使用 `aeete.com`。另核验用户提供的 `au1080.top` 与 www 前缀：首页结构一致，`dbtl.js` 与 aeete 的实际响应逐字节相同，已复用同一模板。只登记已确认域名，发布页和未来域名不会自动扩大匹配范围。

首页与播放页包含 `/js/mcenter/tbxf.js`、`tbtl.js`（首页顶部通栏）、`tlbf.js`（播放页）、`dibu.js`、`dbtl.js`。页面注释明确标出顶部通栏与底部广告位。获取并离线解码 `dbtl.js` 后确认：它加载 `日期+4951g.smun7ro.com:8005/sc/4951` 和 `日期+4951gc.mehqk5u.com:8005/d/4951`，注入底部透明点击层、修改 body 底部留白，并通过触摸/点击跳转广告网址；只进行字符串解码，没有运行广告代码。其他四个模块本次返回 404，仍从 HTML 移除其广告位入口，防止后续恢复加载。

复用现有精确 HTML 脚本标签删除及专用 JS 置空操作，处理这五个路径；不匹配整个 mcenter 目录，也不增加外部广告域名 MITM。禁用 `dbtl.js` 从源头阻止其外部广告加载、占位样式和透明点击层。

`/js/seajump.js`、`common.js`、`function.js`、`play.js`、`statics/js/ditre.js`、播放器 iframe、播放地址、选集与观看记录保留。未增加播放器或 HLS 处理。测试核对入口删除、主机/路径边界、重复执行和上述内容保留；另用实际首页、实际视频播放页 HTML 与实际 `dbtl.js` 验证改写；播放页的播放器 iframe、源地址变量、线路和选集链接均保留。没有加入视频流/HLS 改写。截图中的手机横幅是否完全消失仍需 Quantumult X 实测。

## 公共清理操作与播放保护

四类操作共用 engine：JSON 字段使用结构校验后的 set/clearArray/filterArray；广告脚本入口使用 script/src 精确选择器；HTML 容器使用标签与完整 class token，属性清理由独立 removeAttributes 执行；JS 成组替换由 admGroup 校验每处预期次数。网站仍只在自己的域名、路径与源码特征范围内运行。生成器拒绝无效选择器、未锚定的属性正则、HTML 文本正则删除、错误替换次数和重复输出路径。

HTML 扫描跳过注释与 script/style/textarea/title 的正文，支持引号内的 >、未加引号的属性和实际页面中的相邻引号属性。ad-item-wrapper 不再匹配 ad-item。没有闭合的广告容器保留原文；无法可靠完成扫描时也保留原文。JS 和 CSS 字符串中的伪 HTML 不参与删除。

公共入口统一保护数字或字符串状态码、HTTP 状态行、HEAD/OPTIONS、Content-Type 与正文类型不符，以及带 BOM/注释前缀的 HTML 错误页。已知非 2xx 响应保留原文；脚本异常也保留原文，日志仍默认关闭。

搜剧/看剧 AI 运行时的六处必需替换均要求恰好一次，缺失或重复时整组保留原文；不再使用至少三处命中的部分替换策略。已核验真实 kanju3 运行时的六处原始特征及修改后 ES module 语法。

新增四组回归覆盖相似 class、注释/脚本/样式中的伪标签、错误页及类型不符、成组替换缺失/重复。共 14 项测试通过，并以实际 AUETE 首页和播放页验证广告入口删除、播放器配置/线路/选集/下一集保留。真实页面源响应验证不能代替 iOS 上的播放实测；本轮未增加 HLS 处理。

## 一起看影院 eboyang（旧版）

新增 eboyang.com / www.eboyang.com 的旧版 qiqino5 模板，独立于 Nuxt YQK。广告核心位置、匹配范围和验证见 [eboyang 说明](../eboyang/README.md)。已核验真实首页、详情页、播放页与专用广告 JS，保留播放源、下一集和播放器 iframe；不增加外部播放器或媒体流规则。

## 聚爷爷

依据用户手机详情页响应定位 HTML 底部内嵌混淆广告 JS，复用新增的 removeInlineScripts 操作，仅在站点特征和五个广告源码特征都匹配时移除。见 [聚爷爷说明](../juyeye/README.md)。保留验证码、平台判断变量、站点公告及播放器逻辑；按用户要求另精确取消正常页面中的电脑 404 跳转；实际播放页仍待获取。

## 瓜子影视原规则完整保留

`requestRules` 支持显式 verbatim 模式，从本地 sourceFile 读取并原样合并规则。瓜子影视按用户要求完整采用上游 23 条规则及 13 个 MITM 主机，原正则和 6 条脚本 URL 均不改写。来源原文件存档在 guazi-app/upstream；详见 [说明](../guazi-app/README.md)。配套脚本依赖上游，尚未设备验证。该模式是明确选择的完整导入，不用于自动发现或扩域。

## 更新与排查

生成配置按模块分组，瓜子完整原规则单独标注；不改变各模块规则顺序。只启用统一版或对应独立版，重复订阅会造成重复改写。更新后刷新配置及远程脚本缓存；如果有网页异常，记录命中的模块、请求地址与正常响应再定位。瓜子依赖上游 JS，统一脚本的版本号不能替代该外部脚本的缓存更新。

原文件导入会校验全部有效行、正则、重复匹配、MITM 和源文件路径，出现未知语法直接阻止生成，避免静默漏规则。现有 23 条瓜子规则原样保留。
