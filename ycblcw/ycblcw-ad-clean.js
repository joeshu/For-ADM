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
