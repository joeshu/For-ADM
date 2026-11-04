# CCTVHost 独立站点播放组件

此目录提供按站点拆分的 CCTVHost JavaScript Widget 组件，每个文件都包含站点入口、详情/分集处理和 `loadResource` 播放资源入口。

统一导入订阅：

```text
https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/For-ADM.fwd
```

在 Forward/Rex 的组件订阅入口添加以上地址，即可一次导入 8 个来源。订阅 JSON 是 [For-ADM.fwd](For-ADM.fwd)；CCTVHost 本地导入若需要逐个组件，可直接导入下表的 JS。

| 文件 | 来源 | 实现方式 |
| --- | --- | --- |
| `kkapp.js` | 可可影视 | 原站签名接口、访客会话和播放 API |
| `ncat.js` | 网飞猫 | 独立 appId、源站和会话命名空间 |
| `happ.js` | 好好看 | 独立 appId、源站和会话命名空间 |
| `yqk.js` | 一起看 | CCTVHost 原生站点组件，独立 API 配置 |
| `qntv.js` | 青柠 TV | 与一起看分开的站点组件、appId 和会话 |
| `dyls.js` | 电影猎手 | 原站 RSA/HMAC 请求协议、公开解析接口和原站媒体请求头 |
| `souju.js` | 搜剧 AI | 独立访客会话、签名接口和分集播放线路 |
| `kanju.js` | 看剧 AI | 独立公开目录接口和授权线路解析 |

`kkapp.js`、`ncat.js` 和 `happ.js` 由 `generic-site.template.js` 生成。修改通用请求逻辑后执行：

```sh
cd ios-app
npm run build:cctvhost
npm run test:cctvhost
```

组件实现使用 CCTVHost WidgetAdaptor 提供的 `Widget.http` / `Widget.storage` 接口。测试用模拟响应验证组件能被加载、媒体 URL 校验、同集资源选择、权限拒绝和站点隔离。它不会替换网站的账号、订阅或地区授权，不解密 DRM，也不把网页解析结果猜作直链。返回的临时播放地址由源站当前接口提供，站点策略、接口版本、网络环境和具体片源会影响可用性。

这批资源文件尚未在用户设备的 CCTVHost 中完成导入和原生解码验收；HTTP/HLS 地址返回成功不代表 iPhone 上已经验证出画面。
