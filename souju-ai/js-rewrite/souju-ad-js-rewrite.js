/**
 * 搜剧AI：Quantumult X 本地 JS 资源改写
 * 针对播放器、广告配置运行时和入口 JS，在页面运行时注入广告隐藏样式。
 * 不替换播放器组件代码，因此保留线路、选集、播放和登录逻辑。
 */
(() => {
  const original = $response.body || "";
  const requestUrl = ($request && $request.url) || "";
  const targetAsset =
    /^https?:\/\/ai\.baipiaozhe\.com\/assets\/(?:global-player-host-[^/]+|movie-card-runtime-[^/]+|main-[^/]+)\.js(?:[?#].*)?$/i;

  if (!original || !targetAsset.test(requestUrl)) {
    $done({ body: original });
    return;
  }

  const marker = "souju-ad-js-hide-v1";
  if (original.includes(marker)) {
    $done({ body: original });
    return;
  }

  const runtimePatch = `
;/* ${marker} */
;(() => {
  try {
    if (typeof document === "undefined") return;
    const styleId = "${marker}";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      '[class*="movie-player-info-ad"]',
      '.movie-player-top-grid-ad',
      '[class*="app-startup-ad"]'
    ].join(",") + '{display:none!important;visibility:hidden!important;pointer-events:none!important}';

    (document.head || document.documentElement).appendChild(style);
  } catch (_) {}
})();
`;

  $done({ body: original + runtimePatch });
})();
