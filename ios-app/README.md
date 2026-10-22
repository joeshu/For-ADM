# 三源影视 · 无签名 iOS App

独立于 `universal` 去广告脚本的新应用，整合可可影视、网飞猫、好好看的公开片库接口。名称暂定“三源影视”，最低 iOS 15，支持 arm64 iPhone / iPad。

## 功能

- 统一首页、站点切换、动态分类、地区/年份等筛选、搜索、详情、分集及播放线路选择。
- HTTPS 数据线路故障自动切换，支持查看检测结果、手动指定优先线路。
- 本机收藏与观看历史；内嵌播放器记录进度，支持续播、切换地址和系统全屏播放器。
- 原站账户或原站访客会话；iOS 会话存入系统钥匙串，不保存密码，三站分开存储。
- 页面代码随 App 打包，不加载原站启动广告、推广横幅、网盘下载倒计时或推广脚本。当前版本不提供网盘下载入口。

本应用仍依赖原站接口，原站账号、资源权限和服务限制照常生效。仅使用服务端明确开放或播放接口授权返回的地址，不推测受限资源地址。未处理视频流内部广告。搜索通常需要先到“我的”启用访客或登录。

## 安装

产物：`dist/Sanyuan-0.1.0-unsigned.ipa`。这是**未签名**的安装包，不能直接点开安装；使用自己的合法签名方式签名后安装。没有预置证书、账号或描述文件。包标识为 `com.joeshu.sanyuan`，签名时可按工具要求调整。

### macOS + Xcode（推荐重新构建方式）

需要 Xcode iPhoneOS SDK、Node.js 20+、npm 和 Python 3：

```sh
bash tools/build-macos.sh
```

仓库的 `Sanyuan unsigned iOS app` GitHub Actions 工作流也会使用 macOS 构建并上传 IPA 构建附件。

完成 SDK 构建后，可在 macOS 执行 `bash tools/simulator-smoke.sh`。它另行编译并签名模拟器专用程序，验证本地 WebKit 界面、原生网络桥、真实首页与海报，输出 `simulator-smoke.json` 和截图；分发用 IPA 始终不签名。该检查依赖原站网络可用。

该脚本使用真实 iPhoneOS SDK 编译，无需开发者证书，生成 unsigned IPA，并校验文件结构、架构及签名缺失状态。

### Linux 交叉构建

需要 LLVM 19 的 clang、ld64.lld 和其运行库：

```sh
npm ci
npm run build:web
python3 tools/cross-build.py --clang /path/to/clang-19 --linker /path/to/ld64.lld-19
python3 tools/check-ipa.py dist/Sanyuan-0.1.0-unsigned.ipa
```

`Sources/RuntimeSDK.h` 在 Linux 下提供本应用所需的最小公开 Objective-C ABI 声明；链接时生成仅含系统库名称与符号的 TAPI 文件，运行时链接设备上的系统框架。没有捆绑 Apple SDK，也没有模拟或替代 UIKit。macOS 编译自动使用真实 SDK 头文件。Linux 交叉编译的包完成静态校验，但不能据此保证真机启动或媒体播放；正式使用前应真机验证。

## 验证和预览

```sh
npm ci
npm test
npm run build:web
# 若运行环境使用代理，给 Node 设置其支持的代理配置
NODE_USE_ENV_PROXY=1 npm run preview
# 另一个终端，需安装 Chromium：
NODE_USE_ENV_PROXY=1 node tools/browser-check.mjs
# 使用固定响应测试系统播放器切换及资源拒绝处理：
node tools/playback-ui-check.mjs
# 实际访问三站；--with-guest 会按原站协议创建临时访客会话
NODE_USE_ENV_PROXY=1 node tools/live-probe.mjs --with-guest
```

预览仅绑定 `127.0.0.1:4173`，本地代理用于替代原生 NSURLSession 网络桥。浏览器预览会话只保留在内存。浏览器检查脚本默认将截图写入 `/workspace/outputs`，可通过 `APP_OUTPUT` 修改目录；`CHROMIUM` 可指定浏览器路径。

`docs/live-probe.json` 和 `docs/browser-check.json` 保存验证结果，不包含用户令牌或临时签名播放地址。`docs/playback-probe.json` 记录播放 URL 的独立网络检查，浏览器界面通过不等同于视频播放通过。

## 当前限制

- 尚未进行 iPhone/iPad 真机启动、签名安装、AVPlayer、AirPlay、后台播放及真实账号登录测试。浏览器检查覆盖界面与接口，不代替真机测试。
- 实测“超清2”“极速蓝光”线路返回的 IP HTTPS 地址证书与主机不匹配，无法通过 TLS 校验。应用不关闭校验；实测“蓝光1”经原站访客会话授权后可读取 HLS 播放清单；未下载视频分片，也未完成真机解码测试。线路能否播放还取决于证书、原站授权、网络、视频编码及服务端防盗链。
- 内嵌播放器记录播放进度；系统全屏播放器目前不向网页回传进度。进入播放器即产生历史记录，并不表示已成功解码视频。
- 不包含离线下载、投屏管理、跨站聚合搜索、iCloud 同步或原站付费管理页面。
- 线路池、分类、图片域名由启动配置动态获取，因此不受网页 JS 文件名更新影响；签名算法、协议字段或响应加密变更时仍需要更新适配器和 App。不能承诺永久免维护。

## 文件结构与维护

- `Sources/main.m`：UIKit 容器、本地 WebKit 界面、HTTPS 网络桥、Keychain 会话、AVPlayer。
- `Web/app.mjs` / `app.css`：统一界面及交互；`app.js` 是供本地 WebKit 加载的构建产物。
- `Web/site-api.mjs`：签名、解码、路由、会话与服务端权限处理。
- `Web/sites.json`：从仓库已归档原版客户端提取的公开协议常量，含版本和源文件 SHA-256；不是用户密钥。不得在此放入账号密码或会话令牌。
- `Web/model.mjs`：影片、分类、图片与播放地址的展示模型。
- `tools/`、`tests/`：构建、IPA 校验、离线测试、真实接口和界面检查。

首次适配版本：KKAPP 2.5.16 / NCAT 2.5.31 / HAPP 2.5.24。只对已确认的影片结构进行展示；广告和未知跳转不直接渲染，从而减少网页推广组件变化对 App 的影响。

加密组件为 CryptoJS 4.2.0，按随附 `Web/vendor/LICENSE.crypto-js` 的 MIT 条款分发。开发依赖使用各自许可证。
