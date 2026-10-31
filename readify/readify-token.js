/****************************************************
 * Readify 阅读挑战 · 登录态抓取
 * 类型: Quantumult X 重写脚本 (script-request-header)
 * 作用: 被动保存 x-token / x-user-id / x-device-id / campaignId
 * 设计: 只读不写请求；异常一律吞掉并 $done({})；不改有效 token
 ****************************************************/
const KEY_TOKEN = 'readify_token';
const KEY_UID   = 'readify_userId';
const KEY_DID   = 'readify_deviceId';
const KEY_CID   = 'readify_campaignId';
const KEY_TS    = 'readify_tokenUpdatedAt';

const MAX_VALUE = 4096;

function text(v) {
  if (Array.isArray(v)) v = v[0];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const lower = name.toLowerCase();
  for (const k in headers) {
    if (String(k).toLowerCase() === lower) return text(headers[k]);
  }
  return '';
}

// Readify 的 x-token 是 JWT；格式不符时只在本地为空时兜底保存
function isJwt(t) {
  return t.length >= 40 && t.length <= MAX_VALUE && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(t);
}

// 活动 id 只接受安全字符，避免把奇怪的 query 片段写进后续请求
function isCampaignId(v) {
  return v.length > 0 && v.length <= 64 && /^[A-Za-z0-9._-]+$/.test(v);
}

function safeGet(prefs, key) {
  try {
    const v = prefs.valueForKey(key);
    return v === null || v === undefined ? '' : String(v);
  } catch (e) { return ''; }
}

(function () {
  let called = false;
  function finish() {
    if (called) return;
    called = true;
    try { $done({}); } catch (e) { /* 重写脚本必须结束 */ }
  }

  try {
    if (typeof $prefs === 'undefined' || !$prefs) {
      console.log('Readify: 当前环境无 $prefs，跳过抓取');
      return;
    }

    const headers = ($request && $request.headers) || {};
    const url = ($request && $request.url) || '';

    const token = getHeader(headers, 'x-token');
    const uid   = getHeader(headers, 'x-user-id');
    const did   = getHeader(headers, 'x-device-id');

    const changed = [];

    function save(key, value, max) {
      if (!value || value.length > (max || 128)) return false;
      if (safeGet($prefs, key) === value) return false;
      try {
        $prefs.setValueForKey(value, key);
        changed.push(key);
        return true;
      } catch (e) {
        console.log('Readify: 写入 ' + key + ' 失败');
        return false;
      }
    }

    if (token) {
      const prev = safeGet($prefs, KEY_TOKEN);
      if (isJwt(token)) {
        if (save(KEY_TOKEN, token, MAX_VALUE)) {
          try { $prefs.setValueForKey(String(Date.now()), KEY_TS); } catch (e) {}
        }
      } else if (!prev) {
        // 首次抓取但格式不认识：兜底保存，后续抓到 JWT 会覆盖
        save(KEY_TOKEN, token, MAX_VALUE);
      } else {
        console.log('Readify: 收到非 JWT token，保留本地旧值');
      }
    }

    if (uid) save(KEY_UID, uid, 128);
    if (did) save(KEY_DID, did, 128);

    // 活动 id 会随活动变化，从 URL 里自动提取覆盖
    const m = url.match(/[?&]campaignId=([^&#]+)/);
    if (m) {
      let cid = '';
      try { cid = decodeURIComponent(m[1]); } catch (e) { cid = m[1]; }
      if (isCampaignId(cid)) save(KEY_CID, cid, 64);
    }

    if (changed.length) {
      // 只报键名，不输出值，避免 token 进日志
      console.log('Readify: 登录态已更新 [' + changed.join(',') + ']');
    }
  } catch (e) {
    console.log('Readify: 抓取异常 ' + ((e && e.message) || e));
  } finally {
    finish();
  }
})();
