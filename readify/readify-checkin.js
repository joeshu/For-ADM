/****************************************************
 * Readify 7 天阅读挑战 · 自动签到
 * 类型: Quantumult X 定时任务 (task_local)
 * 前置: readify-token.js 已抓到 x-token / x-user-id
 * 设计: 超时保护 + 有界重试 + 字段宽松解析；只调官方签到接口
 ****************************************************/
function Env(name) {
  this.name = name;
  this.log = (msg) => { try { console.log('[Readify] ' + msg); } catch (e) {} };
  this.msg = (title, subt, body) => { try { $notify(title, subt, body); } catch (e) {} };
}
const $ = new Env('Readify阅读签到');

// ================== 配置 ==================
const HOST = 'https://readifyapp.voiceclub.cn';
const DEFAULT_CAMPAIGN_ID = 'reading-streak-7d-202607';

// 兜底手填（正常不用填，抓取脚本会自动写入；换机/新装时再填）
const FALLBACK = {
  token: '',       // x-token（JWT）
  userId: '',      // x-user-id
  deviceId: '',    // x-device-id
  campaignId: ''   // 留空用默认
};

const TIMEOUT_MS = 15000;   // 单次请求超时
const RETRY_GET  = 2;       // 状态查询最多再试 2 次
const RETRY_POST = 1;       // 签到最多再试 1 次（接口幂等，重复签到只会返回已签）
const WARN_DAYS  = 2;       // 剩余有效天数小于该值时提醒续期
// =========================================

/* ---------- 本地存储 ---------- */
function pget(key) {
  try {
    const v = $prefs.valueForKey(key);
    return (v === null || v === undefined) ? '' : String(v);
  } catch (e) { return ''; }
}
function pset(key, value) {
  try { $prefs.setValueForKey(String(value), key); } catch (e) {}
}

const TOKEN       = pget('readify_token')      || FALLBACK.token;
const USER_ID     = pget('readify_userId')     || FALLBACK.userId;
const CAMPAIGN_ID = pickCampaignId(pget('readify_campaignId'), FALLBACK.campaignId);

// 设备 id 只来自抓取或本次生成，不写死在仓库里
function uuid() {
  const hex = '0123456789ABCDEF';
  const rnd = () => hex.charAt(Math.floor(Math.random() * 16));
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex.charAt(8 + Math.floor(Math.random() * 4));
    else out += rnd();
  }
  return out;
}

let DEVICE_ID = pickId(pget('readify_deviceId')) || pickId(FALLBACK.deviceId);
if (!DEVICE_ID) {
  DEVICE_ID = uuid();
  pset('readify_deviceId', DEVICE_ID);
}

/* ---------- 工具 ---------- */
function pickId(v) {
  if (!v) return '';
  return v.length <= 128 ? v : '';
}
function pickCampaignId(v, fallback) {
  const ok = (x) => x && x.length <= 64 && /^[A-Za-z0-9._-]+$/.test(x);
  if (ok(v)) return v;
  if (ok(fallback)) return fallback;
  return DEFAULT_CAMPAIGN_ID;
}

function parse(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function isTrue(v) { return v === true || v === 1 || v === '1' || v === 'true'; }
function isFalse(v) { return v === false || v === 0 || v === '0' || v === 'false'; }

// 部分接口会把 code 写成字符串，data 也可能缺失
function responseOk(json) {
  if (!json || typeof json !== 'object') return false;
  if (json.code !== undefined && json.code !== null) return Number(json.code) === 0;
  if (json.success !== undefined) return json.success !== false && json.success !== 'false';
  return false;
}

function errText(r) {
  if (!r) return 'unknown';
  if (r.status === -2) return '请求超时（' + TIMEOUT_MS + 'ms）';
  if (!r.ok) return String(r.body || 'request error').slice(0, 160);
  return String(r.body || '').slice(0, 160);
}

// base64url 解码（QX 无 Buffer/atob，手动实现）
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64d(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let out = '', buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const idx = B64.indexOf(s.charAt(i));
    if (idx < 0) continue;
    buf = (buf << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buf >> bits) & 0xff);
    }
  }
  return out;
}

function tokenLeftDays(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const p = JSON.parse(b64d(part));
    if (!p || !p.exp) return null;
    return (p.exp * 1000 - Date.now()) / 86400000;
  } catch (e) { return null; }
}

function headers(extra) {
  const h = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Origin': HOST,
    'Referer': HOST + '/activity/check-in/7DayChallenge?immersive=1',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) readify version/3.6.2 platform/ios timezone/Asia/Shanghai lang/zh-Hans theme/light region/CN',
    'x-app-name': 'readifyai',
    'x-client-region': 'CN',
    'x-client-sys-region': 'CN',
    'x-device-id': DEVICE_ID,
    'x-lang': 'zh-Hans',
    'x-os': '27.0.1',
    'x-time-zone': 'Asia/Shanghai',
    'x-user-agent': 'iOS/3.6.2',
    'x-v': 'v1',
    'x-user-id': USER_ID,
    'x-token': TOKEN
  };
  if (extra) for (const k in extra) h[k] = extra[k];
  return h;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 单次请求：无论回调还是异常都只结算一次，超时先到先赢
function fetchOnce(options) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    function end(result) {
      if (settled) return;
      settled = true;
      if (timer !== null) { try { clearTimeout(timer); } catch (e) {} }
      resolve(result);
    }

    try {
      timer = setTimeout(() => end({ ok: false, status: -2, body: 'timeout' }), TIMEOUT_MS);
    } catch (e) { timer = null; }

    try {
      const opts = {};
      for (const k in options) opts[k] = options[k];
      opts.timeout = TIMEOUT_MS;
      $task.fetch(opts).then(
        (res) => end({ ok: true, status: (res && res.statusCode) || 0, body: (res && res.body) || '' }),
        (err) => end({ ok: false, status: -1, body: (err && (err.error || err.message)) || 'request error' })
      );
    } catch (e) {
      end({ ok: false, status: -1, body: (e && e.message) || 'request error' });
    }
  });
}

// 有界重试：网络错误/超时/429/5xx 才重试，4xx 直接返回
function call(options, retry) {
  const max = retry === undefined ? 0 : retry;
  let attempt = 0;

  function once() {
    attempt++;
    return fetchOnce(options).then((r) => {
      const retryable = !r.ok || r.status === 429 || (r.status >= 500 && r.status < 600);
      if (retryable && attempt <= max) {
        const wait = attempt === 1 ? 1500 : 4000;
        $.log('第 ' + attempt + ' 次请求失败（' + errText(r) + '），' + wait + 'ms 后重试');
        return sleep(wait).then(once);
      }
      return r;
    });
  }

  return once();
}

/* ---------- 收尾 ---------- */
let finished = false;
function finish(title, body) {
  if (finished) return;
  finished = true;
  $.log(title + ' | ' + body);

  pset('readify_lastRun', String(Date.now()));
  pset('readify_lastResult', JSON.stringify({
    at: Date.now(),
    title: title,
    body: String(body).slice(0, 200)
  }));

  $.msg('Readify 阅读挑战', title, body);
  try { if (typeof $done === 'function') $done({}); } catch (e) {}
}

function successText(d, title) {
  let msg = '连续第 ' + (d.currentDay || '?') + ' 天';
  if (isTrue(d.canClaim)) msg += '，有奖励待领取（App 内领取）';
  const left = tokenLeftDays(TOKEN);
  if (left !== null && left > 0 && left <= WARN_DAYS) {
    msg += '｜Token 约剩 ' + Math.max(1, Math.ceil(left)) + ' 天，打开 App 可续期';
  }
  return finish(title, msg);
}

/* ---------- 主流程 ---------- */
function checkIn() {
  return call({
    url: HOST + '/api/campaigns/streaks',
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ campaignId: CAMPAIGN_ID })
  }, RETRY_POST).then((r) => {
    if (!r.ok) return finish('❌ 签到请求失败', errText(r));
    if (r.status === 401 || r.status === 403) return finish('❌ 鉴权失败', 'Token 失效，打开 App 重新抓取');

    const json = parse(r.body);
    if (!responseOk(json)) {
      return finish('❌ 签到失败', (json && (json.message || json.msg)) || errText(r));
    }

    const d = json.data || {};
    if (d.checkInResult === 'CHECKED_IN' || isTrue(d.streakedToday)) {
      return successText(d, '✅ 签到成功');
    }
    return finish('⚠️ 未签到成功', 'checkInResult=' + (d.checkInResult || 'unknown') + ' | ' + JSON.stringify(d).slice(0, 120));
  });
}

function handleStatus(r) {
  if (!r.ok) return finish('❌ 状态查询失败', errText(r));
  if (r.status === 401 || r.status === 403) return finish('❌ 鉴权失败', 'Token 失效，打开 App 重新抓取');

  const json = parse(r.body);
  if (!responseOk(json)) {
    return finish('❌ 状态查询失败', (json && (json.message || json.msg)) || errText(r));
  }

  const d = json.data || {};
  if (d.activityStatus && d.activityStatus !== 'ACTIVE') {
    return finish('ℹ️ 活动未开启', 'activityStatus=' + d.activityStatus);
  }
  if (isTrue(d.streakedToday)) return successText(d, '✅ 今日已签到');
  if (isFalse(d.canCheckIn)) {
    // 服务端明确说当前不可签：不硬刷接口
    return finish('ℹ️ 暂不可签到', (d.message || d.checkInHint || 'canCheckIn=false') + '，稍后或 App 内确认');
  }
  // canCheckIn 缺失或为其他取值时按未签处理，由签到接口给出最终结果
  return checkIn();
}

function main() {
  if (!TOKEN || !USER_ID) {
    return finish('❌ 缺少登录态', '请先用 readify-token.js 抓取，或手动填 FALLBACK');
  }

  const left = tokenLeftDays(TOKEN);
  if (left !== null && left <= 0) {
    return finish('❌ Token 已过期', '打开一次 Readify App 触发请求即可自动更新');
  }

  return call({
    url: HOST + '/api/campaigns/streaks/status?campaignId=' + encodeURIComponent(CAMPAIGN_ID),
    method: 'GET',
    headers: headers()
  }, RETRY_GET).then(handleStatus).catch((e) => {
    finish('❌ 脚本异常', String((e && e.message) || e).slice(0, 160));
  });
}

try {
  main();
} catch (e) {
  finish('❌ 脚本异常', String((e && e.message) || e).slice(0, 160));
}
