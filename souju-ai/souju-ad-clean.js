/**
 * 搜剧AI Quantumult X 综合广告清理
 * 同一条规则同时处理旧版 /v1/ 配置响应和指定广告 JS 资源。
 * JS 资源中只移除专用广告组件；播放源、线路和集数请求不改动。
 */
(() => {
  const body = $response.body || "";
  const requestUrl = ($request && $request.url) || "";
  const assetMatch = requestUrl.match(
    /^https?:\/\/(?:ai\.baipiaozhe\.com|souju\.ai)\/assets\/(global-player-host-[^/]+|movie-card-runtime-[^/]+|main-[^/]+)\.js(?:[?#].*)?$/i
  );

  function functionBounds(source, name, fromIndex) {
    const matcher = new RegExp("\\bfunction\\s+" + name + "\\s*\\(", "g");
    matcher.lastIndex = fromIndex || 0;
    const match = matcher.exec(source);
    if (!match) return null;

    let parameterDepth = 1;
    let parameterQuote = "";
    let parameterEscape = false;
    let parameterLineComment = false;
    let parameterBlockComment = false;
    let parameterEnd = -1;

    for (let i = matcher.lastIndex; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];

      if (parameterLineComment) {
        if (ch === "\\n") parameterLineComment = false;
        continue;
      }
      if (parameterBlockComment) {
        if (ch === "*" && next === "/") {
          parameterBlockComment = false;
          i++;
        }
        continue;
      }
      if (parameterQuote) {
        if (parameterEscape) {
          parameterEscape = false;
          continue;
        }
        if (ch === "\\\\") {
          parameterEscape = true;
          continue;
        }
        if (ch === parameterQuote) parameterQuote = "";
        continue;
      }
      if (ch === "/" && next === "/") {
        parameterLineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        parameterBlockComment = true;
        i++;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        parameterQuote = ch;
        continue;
      }
      if (ch === "(") parameterDepth++;
      if (ch === ")" && --parameterDepth === 0) {
        parameterEnd = i;
        break;
      }
    }

    if (parameterEnd < 0) return null;
    const open = source.indexOf("{", parameterEnd + 1);
    if (open < 0) return null;

    let depth = 0;
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (let i = open; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];

      if (lineComment) {
        if (ch === "\n") lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === "*" && next === "/") {
          blockComment = false;
          i++;
        }
        continue;
      }
      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === "/" && next === "/") {
        lineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        blockComment = true;
        i++;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}" && --depth === 0) {
        return { start: match.index, end: i + 1, text: source.slice(match.index, i + 1) };
      }
    }
    return null;
  }

  function replaceFunction(source, name, predicate, replacement) {
    let cursor = 0;
    while (cursor < source.length) {
      const bounds = functionBounds(source, name, cursor);
      if (!bounds) return { source, changed: false };
      if (predicate(bounds.text)) {
        return {
          source: source.slice(0, bounds.start) + replacement + source.slice(bounds.end),
          changed: true
        };
      }
      cursor = bounds.end;
    }
    return { source, changed: false };
  }

  function rewriteRuntimeConfig(source) {
    let bounds = functionBounds(source, "As", 0);
    while (
      bounds &&
      !(bounds.text.includes("splash_screen") && bounds.text.includes("player_info") && bounds.text.includes("showcase_grid"))
    ) {
      bounds = functionBounds(source, "As", bounds.end);
    }
    if (!bounds) return { source, changed: false };

    let patchedFunction = bounds.text;
    const replacements = [
      ['n=en(t.splash_screen,"banner")', 'n=en({...t.splash_screen,items:[]},"banner")'],
      ['o=en(t.showcase_grid,"grid")', 'o=en({...t.showcase_grid,items:[]},"grid")'],
      ['u=en({...a,layout:c==="grid"?"grid":"banner"})', 'u=en({...a,items:[],layout:c==="grid"?"grid":"banner"})'],
      ['enabled:a.enabled!==!1', 'enabled:!1'],
      ['banner_items:un(a.banner_items)??u.items', 'banner_items:[]'],
      ['grid_items:un(a.grid_items)??u.items', 'grid_items:[]']
    ];
    let replacementCount = 0;
    for (const pair of replacements) {
      const pieces = patchedFunction.split(pair[0]);
      if (pieces.length > 1) {
        replacementCount += pieces.length - 1;
        patchedFunction = pieces.join(pair[1]);
      }
    }
    if (replacementCount < 3) return { source, changed: false };

    return {
      source: source.slice(0, bounds.start) + patchedFunction + source.slice(bounds.end),
      changed: true
    };
  }

  function rewriteJsAsset(source, assetName) {
    let current = source;
    let changed = false;

    if (assetName.startsWith("global-player-host-")) {
      const adFunctions = [
        ["Cp", text => text.includes('qr("player_info")') && text.includes("creative_daily_rotation_limit")],
        ["ti", text => text.includes("movie-player-info-ad-grid")],
        ["qu", text => text.includes("movie-player-info-ad-banner-shell")]
      ];
      for (const [name, predicate] of adFunctions) {
        const result = replaceFunction(current, name, predicate, "function " + name + "(){return null}");
        current = result.source;
        changed = result.changed || changed;
      }
    } else if (assetName.startsWith("movie-card-runtime-")) {
      const result = rewriteRuntimeConfig(current);
      current = result.source;
      changed = result.changed;
    } else if (assetName.startsWith("main-")) {
      const result = replaceFunction(
        current,
        "T0",
        text => text.includes("app-startup-ad") && text.includes("跳过"),
        "function T0(){return null}"
      );
      current = result.source;
      changed = result.changed;
    }

    if (changed) {
      $done({ body: current });
    } else {
      // Unknown bundle revisions are preserved; the /v1/ response rewrite remains active.
      $done({ body: source });
    }
  }

  if (assetMatch) {
    rewriteJsAsset(body, assetMatch[1]);
    return;
  }

  try {
    const payload = JSON.parse(body);
    let changed = false;

    function clearPlacement(placement) {
      if (placement && typeof placement === "object" && Array.isArray(placement.items)) {
        placement.items = [];
      }
    }

    function sanitizeSnapshot(snapshot) {
      if (
        !snapshot ||
        typeof snapshot !== "object" ||
        snapshot.object !== "app.experience_snapshot" ||
        !snapshot.placements ||
        typeof snapshot.placements !== "object"
      ) return false;

      const placements = snapshot.placements;
      clearPlacement(placements.splash_screen);
      clearPlacement(placements.showcase_grid);
      const player = placements.player_info;
      if (player && typeof player === "object") {
        player.enabled = false;
        player.default_ad_targeting = {
          ...(player.default_ad_targeting || {}),
          enabled: false
        };
        for (const key of ["items", "banner_items", "grid_items"]) {
          if (Array.isArray(player[key])) player[key] = [];
        }
      }
      return true;
    }

    function visit(node, depth) {
      if (!node || typeof node !== "object" || depth > 12) return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item, depth + 1);
        return;
      }
      if (node.object === "app.experience_snapshot") {
        changed = sanitizeSnapshot(node) || changed;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "app_experience" && value && typeof value === "object") {
          if (value.object === "app.experience_snapshot") {
            changed = sanitizeSnapshot(value) || changed;
          } else {
            visit(value, depth + 1);
          }
        } else if (value && typeof value === "object") {
          visit(value, depth + 1);
        }
      }
    }

    visit(payload, 0);
    $done({ body: changed ? JSON.stringify(payload) : body });
  } catch (_) {
    $done({ body });
  }
})();
