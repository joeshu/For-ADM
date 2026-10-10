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
