/**
 * 搜剧AI：Quantumult X 本地 JS 广告隐藏改写 v2
 * 仅改写目标 JS 响应并在页面运行时隐藏广告容器，不替换播放器/线路逻辑。
 */
(() => {
  const original = $response.body || "";
  const requestUrl = ($request && $request.url) || "";
  const targetAsset =
    /^https?:\/\/(?:ai\.baipiaozhe\.com|souju\.ai)\/assets\/(?:global-player-host-[^/]+|movie-card-runtime-[^/]+|main-[^/]+)\.js(?:[?#].*)?$/i;

  if (!original || !targetAsset.test(requestUrl)) {
    $done({ body: original });
    return;
  }

  const marker = "souju-ad-js-hide-v2";
  if (original.includes(marker)) {
    $done({ body: original });
    return;
  }

  const runtimePatch = [
    "",
    ";/* " + marker + " */",
    ";(() => {",
    "  try {",
    "    if (typeof document === 'undefined') return;",
    "    const styleId = '" + marker + "-style';",
    "    if (!document.getElementById(styleId)) {",
    "      const style = document.createElement('style');",
    "      style.id = styleId;",
    "      style.textContent = '[class*=\"movie-player-info-ad\"],.movie-player-top-grid-ad,[class*=\"app-startup-ad\"]{display:none!important;visibility:hidden!important;pointer-events:none!important}';",
    "      (document.head || document.documentElement).appendChild(style);",
    "    }",
    "    const hide = element => {",
    "      if (!element || !element.style) return;",
    "      element.style.setProperty('display', 'none', 'important');",
    "      element.style.setProperty('visibility', 'hidden', 'important');",
    "      element.style.setProperty('pointer-events', 'none', 'important');",
    "      element.setAttribute('data-souju-ad-hidden', '1');",
    "    };",
    "    const hideByTitle = () => {",
    "      const nodes = document.querySelectorAll('body *');",
    "      for (const node of nodes) {",
    "        if (node.children.length > 2) continue;",
    "        const text = (node.innerText || node.textContent || '').trim();",
    "        if (!text || text.length > 60 || text.indexOf('官方靠谱推荐') < 0) continue;",
    "        let parent = node;",
    "        for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {",
    "          const cardText = parent.innerText || parent.textContent || '';",
    "          const imageCount = parent.querySelectorAll ? parent.querySelectorAll('img').length : 0;",
    "          if (imageCount >= 4 && cardText.indexOf('官方靠谱推荐') >= 0 && cardText.indexOf('广告') >= 0) {",
    "            hide(parent);",
    "            break;",
    "          }",
    "        }",
    "      }",
    "    };",
    "    const hideAds = () => {",
    "      try {",
    "        document.querySelectorAll('[class*=\"movie-player-info-ad\"],.movie-player-top-grid-ad,[class*=\"app-startup-ad\"]').forEach(hide);",
    "        hideByTitle();",
    "      } catch (_) {}",
    "    };",
    "    hideAds();",
    "    if (typeof MutationObserver !== 'undefined' && document.documentElement && !window.__soujuAdObserverV2) {",
    "      let scheduled = false;",
    "      window.__soujuAdObserverV2 = new MutationObserver(() => {",
    "        if (scheduled) return;",
    "        scheduled = true;",
    "        setTimeout(() => { scheduled = false; hideAds(); }, 80);",
    "      });",
    "      window.__soujuAdObserverV2.observe(document.documentElement, { childList: true, subtree: true });",
    "    }",
    "  } catch (_) {}",
    "})();",
    ""
  ].join("\n");

  $done({ body: original + runtimePatch });
})();
