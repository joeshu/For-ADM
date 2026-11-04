# CCTVHost 独立影视源合集

主合集提供 8 个可独立浏览的 CatVod / TVBox JavaScript 影视源，按 CCTVHost 实际运行接口实现首页、分类、搜索、详情和播放。每个站点都使用单独的适配文件。

## CCTVHost 统一合集导入

在 CCTVHost 中打开「资源 → 添加资源 → TVBox 配置 → 从 URL 导入」，粘贴下面这个**合集 JSON**地址：

```text
https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/For-ADM.json
```

导入后 CCTVHost 会显示 8 个站点；点选某站后，CCTVHost 会按脚本接口识别为 CatVod / TVBox JavaScript 源，再下载和检查对应文件。合集只保存索引，不会批量执行脚本。修复版入口带 `v=2`，会与此前误识别的旧 Widget 副本区分。升级时先移除本地旧合集，再导入同一地址；选择站点后点“导入并打开资源”。文件是 CCTVHost 的 TVBox `sites` 清单格式，不是 Forward/Rex 的 `.fwd` 格式。

Forward/Rex 用户可使用 [For-ADM.fwd](For-ADM.fwd) 订阅 `widget/` 中的旧版 Widget 资源解析器。它们与 TVBox JSON 里的完整影视源脚本分开，避免 CCTVHost 将完整站点错误识别成只支持搜索的资源解析器。

| CatVod / TVBox 脚本 | 来源 | 实现方式 |
| --- | --- | --- |
| `kkapp.js` | 可可影视 | 原站签名接口、访客会话和播放 API |
| `ncat.js` | 网飞猫 | 独立 appId、源站和会话命名空间 |
| `happ.js` | 好好看 | 独立 appId、源站和会话命名空间 |
| `yqk.js` | 一起看 | CCTVHost 原生站点组件，独立 API 配置 |
| `qntv.js` | 青柠 TV | 与一起看分开的站点组件、appId 和会话 |
| `dyls.js` | 电影猎手 | 原站 RSA/HMAC 请求协议、公开解析接口和原站媒体请求头 |
| `souju.js` | 搜剧 AI | 独立访客会话、签名接口和分集播放线路 |
| `kanju.js` | 看剧 AI | 独立公开目录接口和授权线路解析 |

`kkapp.js`、`ncat.js` 和 `happ.js` 由 `generic-site.template.js` 生成到 `widget/`，TVBox 主脚本由适配器构建生成。修改通用请求逻辑后执行：

```sh
cd ios-app
npm run build:cctvhost
npm run test:cctvhost
```

`widget/` 子目录保留 Forward/Rex 兼容的旧版 Widget 解析脚本。TVBox 主脚本由这些原始适配器生成，并附带 CCTVHost 的 CatVod 接口层；更新源站适配时先修改 `widget/` 对应原文件，再运行构建命令生成主合集脚本。测试会模拟 CCTVHost 的首页、分类、搜索、详情和播放调用，并验证导入识别协议、播放线路和站点隔离。

脚本只使用各站点公开接口返回的数据和播放地址；站点账号、付费或地区权限仍由源站控制。返回的临时播放地址可能因接口版本、网络环境和具体片源而变化。

这批资源文件尚未在用户设备的 CCTVHost 中完成导入和原生解码验收；HTTP/HLS 地址返回成功不代表 iPhone 上已经验证出画面。
