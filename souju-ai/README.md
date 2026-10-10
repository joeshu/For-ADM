# 搜剧AI Quantumult X 广告清理

使用同一条 Quantumult X `script-response-body` 规则处理广告配置 API 和广告专用 JS 组件。

## 核心位置

- `assets/global-player-host-*.js`：播放器广告组件 `Cp`（播放器信息位/翻转广告）、`ti`（网格素材）、`qu`（横幅素材）。脚本把这些专用广告组件改为返回空内容，保留播放器和线路组件。
- `assets/movie-card-runtime-*.js`：`As` 负责解析 `app.experience_snapshot` 配置。脚本清空开屏、推荐网格和播放器广告素材，并关闭播放器广告开关。
- `assets/main-*.js`：`T0` 是开屏广告组件。脚本让该组件返回空内容，跳过广告倒计时和跳过界面。
- `/v1/*`：保留旧版响应清理逻辑，清空 API 返回的广告素材。

脚本只在文件名和已知函数特征匹配时修改 JS；遇到网站构建更新、函数结构不匹配时，会保留原 JS 响应。播放源、线路和集数接口的数据不会被 JS 改写。

## 安装

1. 把 `souju-ad-clean.js` 保存到 Quantumult X 本地 Scripts 目录。
2. 将 `quantumult-x-snippet.conf` 中规则合并到现有配置。不要覆盖已有的 `[rewrite_local]` 或 `[mitm]` 内容。
3. 启用 Rewrite 与 MITM，并信任 Quantumult X 根证书。
4. 清除 Safari 中该站的网站数据，再重新打开，确保重新加载 JS 而非缓存文件。

## 验证

脚本的逻辑需要在 Quantumult X 设备流量中验证。若播放页面异常，停用本规则即可恢复原始 JS 与 API 响应。
