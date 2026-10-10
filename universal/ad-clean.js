/* Shared Quantumult X engine: verified adapters; unknown sites stay unchanged. */
(function () {
  var original = $response.body || "", url = ($request && $request.url) || "";
  var match = url.match(/^https?:\/\/([^/:?#]+)(?::\d+)?(\/[^#]*)?/i);
  if (!match) { $done({}); return; }
  var host = match[1].toLowerCase().replace(/^www\./, ""), path = match[2] || "/";
  // Add only a verified site to the appropriate adapter, then add targeted rules / MITM.
  var adapters = [
    { id: "yqk-qntv", hosts: [], hostPattern: /^yz(?:y)?\d{4,6}\.(?:bzy42ezt|zazy3mc5|7k5jb8t9|3nyk7h9o|jba2yo1c|hzkeka49|q8nsderug|o5r52at9v|tgs2hl4ut|goi6lhmry|6vh3qyu9x)\.com$/i, route: /^\/v[12]\/api\/(?:basic\/init|home\/(?:body|firstScreen)|adInfo\/(?:getPageAd|getTextAd|getSearchAd|getUserCenterAd|getChatAd|getTopicAd)|vodInfo\/(?:index|getVodBodyAd|getVodPauseAd))(?:\?|$)/ },
    { id: "yqk-qntv", hosts: ["yqk18.app","qntv28.app"], hostPattern: /^(?:yqk|qntv)\d+\.app$/, route: /^\/_nuxt\/(?:entry|_play_)\.[a-z0-9]+\.js(?:\?|$)/i },
    { id: "buka-ycblcw", hosts: ["ycblcw.com","m.ycblcw.com"], route: /^\/(?:dedg\/cs13341\.js(?:\?|$)|(?:[^?#]*\.html)?(?:\?|$))/ },
    { id: "souju", hosts: ["ai.baipiaozhe.com","souju.ai"], route: /^\/(?:v1\/|assets\/(?:global-player-host-|movie-card-runtime-|main-)[^/?]+\.js(?:[?#]|$))/ },
    { id: "artplayer-preroll", hosts: ["4kvms.org","4kvms.com","4kvm.top","4kvm.cc","4kvm.me","4kvm.org","4kvm.tv","4kvm.net","4kvm.pro","4kvm.com"], route: /^\/(?:$|\?|play\/|static\/js\/dist\/app\.ultra\.min\.[^/?]+\.js(?:\?|$))/ }
  ];
  var adapter = adapters.filter(function (a) { return (a.hosts.indexOf(host) >= 0 || (a.hostPattern && a.hostPattern.test(host))) && a.route.test(path); })[0];
  if (!adapter) { $done({}); return; }
  var output = original;
  function capture(result) { if (result && typeof result.body === "string") output = result.body; }
  try {
    if (adapter.id === "souju") runSouju(original, "https://ai.baipiaozhe.com" + path, capture);
    else if (adapter.id === "buka-ycblcw") runBuka(original, url, capture);
    else if (adapter.id === "yqk-qntv") runYqk(original, url, capture);
    else runArtplayer(original, url, capture);
    $done(output === original ? {} : { body: output });
  } catch (_) { $done({}); }
  function runSouju(source, url, done) {
    var $response = {body:source}, $request = {url:url}, $done = done;
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

  }
  function runArtplayer(source, url, done) {
    var $response = {body:source}, $request = {url:url}, $done = done;
/* 4kvm Quantumult X: verified www.4kvms.org, 2026-10-10 */
(function () {
  var original = $response.body || "";
  var body = original;
  var url = $request.url || "";
  try {
    if (/\/static\/js\/dist\/app\.ultra\.min\.[^/?]+\.js/.test(url)) {
      // Dedicated preroll switches. Preserve HLS, fallback URLs, episodes and danmaku.
      if (body.indexOf("artplayerPluginAds({") >= 0) {
        body = body.replace(/this\.prerollAdEnabled=!0/g, "this.prerollAdEnabled=!1");
        body = body.replace(/this\.prerollAdEnabled&&/g, "false&&");
      }
    } else if (/<html[\s>]/i.test(body)) {
      // Server-rendered ads: remove only explicitly marked ad-item divs.
      var start = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bad-item\b[^"']*["'][^>]*>/ig;
      var match;
      while ((match = start.exec(body))) {
        var tags = /<\/?div\b[^>]*>/ig;
        tags.lastIndex = start.lastIndex;
        var depth = 1, tag, end = -1;
        while ((tag = tags.exec(body))) {
          depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
          if (!depth) { end = tags.lastIndex; break; }
        }
        if (end < 0) break;
        body = body.slice(0, match.index) + body.slice(end);
        start.lastIndex = match.index;
      }
      // Prevent preroll activation before the app initializes.
      body = body.replace(/\sdata-preroll-ad-[\w-]+\s*=\s*(?:"[^"]*"|'[^']*')/ig, "");
    }
    $done(body === original ? {} : { body: body });
  } catch (e) { $done({}); }
})();

  }
function runBuka(source, url, done) {
var $response={body:source}, $request={url:url}, $done=done;
/* ycblcw / Buka template: verified 2026-10-10. */
(function () {
  var original = $response.body || "", url = ($request && $request.url) || "";
  if (!/^https?:\/\/(?:www\.|m\.)?ycblcw\.com(?:[:/]|$)/i.test(url)) { $done({}); return; }
  try {
    if (/\/dedg\/cs13341\.js(?:[?#]|$)/i.test(url)) {
      $done({body:"/* Dedicated click-overlay and redirect advertising disabled. */"}); return;
    }
    if (!/<html[\s>]/i.test(original) || original.indexOf("/template/buka/") < 0) { $done({}); return; }
    var body = original.replace(/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?(?:\/\/(?:www\.|m\.)?ycblcw\.com)?\/dedg\/cs13341\.js(?:\?[^"']*)?["'][^>]*>[\s\S]*?<\/script\s*>/ig, "");
    // Confirmed app-promotion anchors only. Preserve player_* config and episode links.
    body = body.replace(/<a\b[^>]*\bhref\s*=\s*["'](?:https?:)?\/\/app2\.zstv47\.com(?:[/?][^"']*)?["'][^>]*>[\s\S]*?<\/a\s*>/ig, "");
    $done(body === original ? {} : {body:body});
  } catch (_) { $done({}); }
})();

}
function runYqk(source, url, done) {
var $response={body:source}, $request={url:url}, $done=done;
/* YQK / QNTV v5: quiet mode; API prefix pattern on verified domain suffixes. */
(function () {
  var original = $response.body || "", url = ($request && $request.url) || "";
  var apiHostPattern = /^yz(?:y)?\d{4,6}\.(?:bzy42ezt|zazy3mc5|7k5jb8t9|3nyk7h9o|jba2yo1c|hzkeka49|q8nsderug|o5r52at9v|tgs2hl4ut|goi6lhmry|6vh3qyu9x)\.com$/i;
  var api = url.match(/^https?:\/\/([^/:?#]+)(\/v[12]\/api\/(?:basic\/init|home\/(?:body|firstScreen)|adInfo\/(?:getPageAd|getTextAd|getSearchAd|getUserCenterAd|getChatAd|getTopicAd)|vodInfo\/(?:index|getVodBodyAd|getVodPauseAd)))(?:[?#].*)?$/i);
  if (api && apiHostPattern.test(api[1])) {
    try {
      var payload = JSON.parse(original), cleaned = sanitize(payload, api[2]);
      var changed = cleaned !== payload;
      $done(changed ? {body:JSON.stringify(cleaned)} : {});
    } catch (_) { $done({}); }
    return;
  }
  var match = url.match(/^https?:\/\/(?:www\.)?((?:yqk|qntv)\d+\.app)\/_nuxt\/(entry|_play_)\.[a-z0-9]+\.js(?:[?#].*)?$/i);
  if (!match) { $done({}); return; }
  var body = original;
  // Require each complete group once (or the explicitly expected count).
  // A changed minifier layout fails open rather than applying a guessed patch.
  function group(pairs) {
    for (var i = 0; i < pairs.length; i++) {
      if (body.split(pairs[i][0]).length - 1 !== (pairs[i][2] || 1)) return false;
    }
    for (var j = 0; j < pairs.length; j++) body = body.split(pairs[j][0]).join(pairs[j][1]);
    return true;
  }
  try {
    if (match[2].toLowerCase() === "entry") {
      if (body.indexOf('class:"startup-ad"') < 0 || body.indexOf('/adInfo/getPageAd') < 0 || body.indexOf('useHttp={get:') < 0) { $done({}); return; }
      group([
        ['m.value=X.value.data.startAdList||[]', 'm.value=[]'],
        ['z.floatAd&&R.name!="play-play"', 'false&&R.name!="play-play"']
      ]);
      if (body.indexOf('__forAdmYqkClean') < 0 && group([
        ['transform:r=>typeof r=="string"?JSON.parse(r):r', 'transform:r=>__forAdmYqkClean(r,e)', 3]
      ])) {
        // useHttp transforms run after JSON parsing. API host changes need no extra MITM rule.
        body += '\n' + sanitize.toString().replace('function sanitize', 'function __forAdmYqkClean') + '\n';
      }
    } else {
      if (body.indexOf('name:"VideoStartAd"') < 0 || body.indexOf('getVodPauseAd({vodId:T') < 0 || body.indexOf('getVideoDetail({vodId:T') < 0) { $done({}); return; }
      group([
        ['N.value=t.value.data,m.value', 'N.value=t.value.data,N.value.startAd=null,m.value', 2],
        ['Ga.value=t.value.data,ta.value=!!t.value.data', 'Ga.value=null,ta.value=!1'],
        ['e.result&&(Nt.value=t.value.data)},jt=i()', 'e.result&&(Nt.value=[])},jt=i()'],
        ['e.result&&(jt.value=t.value.data)};let ga=', 'e.result&&(jt.value=null)};let ga=']
      ]);
    }
    $done(body === original ? {} : {body:body});
  } catch (_) { $done({}); }

  function sanitize(raw, endpoint) {
    var r = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!r || r.result !== true || !r.data || typeof endpoint !== "string") return r;
    var path = endpoint.split("?")[0], d = r.data, next = d;
    if (/\/adInfo\/getPageAd$/.test(path) && !Array.isArray(d) && typeof d === "object") {
      next = Object.assign({}, d, {floatAd:null, popupAd:null});
    } else if (/\/adInfo\/getChatAd$/.test(path) && Array.isArray(d)) {
      next = [];
    } else if (/\/adInfo\/getTopicAd$/.test(path) && Array.isArray(d.topicAdList)) {
      next = Object.assign({}, d, {topicAdList:[]});
    } else if (/\/(?:vodInfo\/getVodPauseAd|adInfo\/getTextAd)$/.test(path)) {
      next = null;
    } else if (/\/(?:vodInfo\/getVodBodyAd|adInfo\/(?:getSearchAd|getUserCenterAd))$/.test(path) && Array.isArray(d)) {
      next = [];
    } else if (/\/vodInfo\/index$/.test(path) && Array.isArray(d.playerList)) {
      next = Object.assign({}, d, {startAd:null});
    } else if (/\/basic\/init$/.test(path) && Array.isArray(d.startAdList)) {
      next = Object.assign({}, d, {startAdList:[], startAdShowTime:0});
    } else if (/\/home\/body$/.test(path) && Array.isArray(d.adList)) {
      next = Object.assign({}, d, {adList:[]});
    } else if (/\/home\/firstScreen$/.test(path) && (Array.isArray(d.focusAdList) || Array.isArray(d.hotMudleList))) {
      // useAdLink sends actions 1/2/11 to external URLs and 8/10 to game pages.
      // Keep the site's internal shortcuts (for example rankings and release pages).
      var shortcutList = Array.isArray(d.hotMudleList)
        ? d.hotMudleList.filter(function (item) { return !item || [1, 2, 8, 10, 11].indexOf(Number(item.adAction)) < 0; })
        : d.hotMudleList;
      next = Object.assign({}, d, {focusAdList:[], hotMudleList:shortcutList});
    }
    return next === d ? r : Object.assign({}, r, {data:next});
  }
})();

}
})();
