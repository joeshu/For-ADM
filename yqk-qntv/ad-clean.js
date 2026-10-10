/* YQK / QNTV Nuxt adapter. Verified bundles: 2026-10-10. */
(function () {
  var original = $response.body || "", url = ($request && $request.url) || "";
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
    } else if (/\/(?:vodInfo\/getVodPauseAd|adInfo\/getTextAd)$/.test(path)) {
      next = null;
    } else if (/\/(?:vodInfo\/getVodBodyAd|adInfo\/(?:getSearchAd|getUserCenterAd))$/.test(path) && Array.isArray(d)) {
      next = [];
    } else if (/\/vodInfo\/index$/.test(path) && Array.isArray(d.playerList)) {
      next = Object.assign({}, d, {startAd:null});
    } else if (/\/home\/body$/.test(path) && Array.isArray(d.adList)) {
      next = Object.assign({}, d, {adList:[]});
    } else if (/\/home\/firstScreen$/.test(path) && Array.isArray(d.focusAdList)) {
      next = Object.assign({}, d, {focusAdList:[]});
    }
    return next === d ? r : Object.assign({}, r, {data:next});
  }
})();
