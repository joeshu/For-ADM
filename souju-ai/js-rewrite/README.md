# 搜剧AI Quantumult X JS 改写版

本目录提供一个直接改写网站 JS 响应的试用版本。Quantumult X 只拦截三类资源：播放器组件、广告配置运行时、入口脚本。脚本在资源末尾注入 CSS，将播放器推荐广告、横幅/网格/翻转广告、手机端顶部广告和开屏广告隐藏。

## 文件

- `souju-ad-js-rewrite.js`：本地 Quantumult X `script-response-body` 脚本。
- `quantumult-x-js-snippet.conf`：需合并到现有 Quantumult X 配置的规则片段。

## 安装

1. 把 `souju-ad-js-rewrite.js` 保存到 Quantumult X 的本地 Scripts 目录。
2. 把配置片段的 `[rewrite_local]` 规则加入现有同名区段。
3. 把 `ai.baipiaozhe.com` 追加进现有 `[mitm]` 的 hostname 列表。
4. 启用 Rewrite 和 MITM，并在 iOS 中信任 Quantumult X 根证书。
5. 清除 Safari 中该站点的网站数据或缓存，然后重新载入页面，确保加载到被改写的 JS 资源。

不要删除现有 `hostname` 列表；把域名合并进去即可。若此前已启用 `/v1/` 广告配置清理规则，测试本版本时建议先暂时停用旧规则，单独观察 JS 改写效果。

## 改写范围

规则匹配：

- `/assets/global-player-host-*.js`
- `/assets/movie-card-runtime-*.js`
- `/assets/main-*.js`

资源文件名中的构建哈希可变化，规则按固定前缀匹配。脚本只向这些 JS 响应末尾附加一段样式注入代码，不改原有播放器函数、线路数据或选集逻辑。广告 DOM 出现时由 CSS 隐藏；若网站改了广告 DOM 类名，需要更新选择器。

## 验证说明

已验证脚本只处理上述三类资源，其他 URL 返回原响应；改写后的 JS 仍可解析，重复执行不会重复注入。尚未在实际 iPhone / Quantumult X 会话中验证视觉效果。若播放器异常，可停用本目录规则并重新载入网站。
