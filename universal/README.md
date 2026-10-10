# Quantumult X 统一去广告

统一版与独立版现在由一份模板清单生成。共同的 JSON 操作、HTML 广告块删除和 JS 特征匹配已提取为公共逻辑；网站只配置域名、接口、广告字段和源码特征。当前覆盖搜剧、4kvm、ycblcw、YQK/QNTV 四组适配。

## 使用

规则地址：<https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/quantumult-x-snippet.conf>

将规则的 `[rewrite_local]` 内容加入重写，将 `[mitm]` 主机列表合并到 MITM。启用 HTTPS 解密并信任证书。统一版与对应独立版择一启用，避免重复改写。更新规则后刷新远程脚本缓存，再重新打开页面；已缓存的旧页面不会自动更新。

脚本默认关闭日志。脚本本身不发起请求、不自动发现域名、不改写播放地址和媒体分片。测试验证了播放列表、剧集与鉴权字段的保留；尚不能替代手机端逐站播放实测，也不处理视频中已经烧录的广告。

## 文件与生成

| 文件 | 作用 |
| --- | --- |
| `templates.json` | 域名、路由、输出路径、广告策略与源码指纹的唯一清单 |
| `src/engine.js` | 字段校验、不可变 JSON 操作、HTML 删除、JS 修改组、统一入口 |
| `src/souju.js`、`src/function-tools.js` | 搜剧特定组件函数定位 |
| `src/yqk.js` | Nuxt 源码定位及公共 JSON 清理器注入 |
| `../scripts/build-ad-clean.mjs` | 生成五份脚本及五份规则，统一 MITM 和缓存版本 |
| `../tests/ad-clean.test.mjs` | 域名边界、广告策略、独立/统一一致性及播放字段验证 |

仓库根目录执行，使用 Node.js 24，无需安装依赖：

```sh
node scripts/build-ad-clean.mjs
node scripts/build-ad-clean.mjs --check
node --test tests/ad-clean.test.mjs
```

生成文件带 `GENERATED` 标记，不直接编辑。版本参数由模板、源码和生成器的内容哈希产生；所有规则引用同一版本。GitHub Actions 检查生成结果与源码一致，并运行回归测试。

## 域名边界

YQK/QNTV 页面域名支持 `(yqk|qntv)数字.app` 与 www 前缀。后端仅支持已登记的 11 个域名后缀，以及 `yz(?:y)?\d{4,6}` 日期前缀；未知 .com 后缀不会自动进入规则。MITM 使用对应后缀的 `yz*.` 通配符，但重写还需满足更严格的前缀与已适配接口路径。

搜剧 `/v1/` 后续路径已在统一版及独立版修正。JS 只匹配已登记文件族，并检查广告源码特征。页面导航保留，YQK 首页 `hotMudleList` 仅过滤已确认的广告动作 1、2、8、10、11。

## 接入新网站

1. 获取广告接口样本或网站 JS，确认广告字段、播放字段及页面容器。不要只凭 `ad` 名称或宣传文字推断。
2. 优先复用现有模板。相同网站换域名时，只扩充该模板的域名清单；相同结构可复用操作并登记新域名。
3. JSON 使用 `set`、`clearArray`、`filterArray`，配合精确接口和结构条件；HTML 使用明确容器或广告资源地址；JS 使用源码指纹与预期替换次数。
4. 新模板选择 `declarative` 或已有适配器，声明 `bindings`、路由类型及 `output`。结构无法复用时才增加适配器，适配器返回正文，由公共入口统一调用 `$done`。
5. 增加广告清除和播放字段保留样例，生成后运行检查。未取得源码或无法确认的站点不加入匹配范围。

可统一的是清理操作与模板结构；不同网站的广告字段、混淆变量和播放流程仍需分别确认。当前没有自动清除任意网站广告的规则。未知 JS 特征或异常响应保留原正文；源码结构变化需要复核模板。
