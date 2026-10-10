# 搜剧AI Quantumult X 广告配置清理

这个规则针对搜剧AI返回的 `app.experience_snapshot` 广告配置，清空开屏、推荐网格和播放器广告素材，并关闭播放器广告投放。它通过修改配置响应来生效，不重写网站的哈希 JS 文件；`global-player-host-*.js` 还负责播放器、线路和其他交互，拦截整份文件会破坏正常功能。

## 文件

- `souju-ad-clean.js`：Quantumult X 本地 `script-response-body` 脚本。
- `quantumult-x-snippet.conf`：需要合并到现有配置的规则片段。

## 安装

1. 将 `souju-ad-clean.js` 保存到 Quantumult X 的本地 Scripts 目录（“我的 iPhone - Quantumult X - Scripts”或 iCloud Drive 对应目录）。
2. 将配置片段中的 `[rewrite_local]` 规则放入现有同名区段。
3. 把 `ai.baipiaozhe.com` 加入现有 `[mitm]` 的 hostname 列表。若没有该区段，再新增。
4. 确认 Quantumult X 已启用 Rewrite 和 MITM，并在 iOS 中信任 Quantumult X 根证书。
5. 清除 Safari 中该站点的缓存/网站数据后重新打开，避免旧的广告配置仍留在页面本地缓存中。清除网站数据可能会退出登录。

## 请求范围与验证

目前代码中广告配置以 `app_experience` 字段返回，但静态前端资源没有暴露稳定的后端接口路径。规则因此匹配该站点的 `/v1/` HTTPS 响应；脚本只在 JSON 中找到 `app.experience_snapshot` 时修改内容，其他响应原样返回。启用 MITM 后，Quantumult X 会解密匹配域名的流量以检查响应。

脚本遇到非 JSON、缺少广告配置或结构不匹配时保留原响应。当前只完成静态代码结构验证，尚未在实际 iPhone / Quantumult X 会话中验证拦截效果；若网站调整接口结构，需从 Quantumult X HTTP 记录中确认新的响应格式。
