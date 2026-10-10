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
