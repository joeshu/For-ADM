# 搜剧AI Quantumult X JS 改写版

这是按实际页面广告未隐藏的截图修订的 v2。脚本针对播放器 JS、广告配置运行时和入口 JS，在页面加载后隐藏已知广告容器；同时用“官方靠谱推荐”和“广告”标题定位广告卡片，适配动态挂载的广告 DOM。

## 文件

- `souju-ad-js-rewrite.js`：Quantumult X 本地 `script-response-body` 脚本。
- `quantumult-x-js-snippet.conf`：配置片段。

## 安装

1. 将 `souju-ad-js-rewrite.js` 保存到 Quantumult X 本地 Scripts 目录。
2. 将配置片段中的 rewrite 规则合并到现有 `[rewrite_local]`。
3. 将 `ai.baipiaozhe.com` 与 `souju.ai` 合并进现有 `[mitm]` hostname 列表。
4. 启用 Rewrite、MITM，并信任 Quantumult X 根证书。
5. 清除 Safari 中该站点的网站数据后重新打开，确保浏览器重新请求并加载被改写的 JS，而非缓存副本。
6. 测试时先停用旧版 `/v1/` 广告配置规则，单独确认本 JS 版本效果。

## 改写范围

规则只匹配：

- `/assets/global-player-host-*.js`
- `/assets/movie-card-runtime-*.js`
- `/assets/main-*.js`

并同时兼容 `ai.baipiaozhe.com` 与 `souju.ai` 两个域名。脚本在这些响应末尾附加广告隐藏样式和 DOM 观察器，不重写视频源、线路或选集请求。

如果广告卡片类名和标题同时变化，需根据新截图调整选择器；若播放异常，停用此规则并重新载入网站即可。当前通过模拟资源地址和 JS 语法检查，尚未在实际 iPhone / Quantumult X 会话验证。
