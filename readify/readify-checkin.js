/****************************************************
 * Readify 7 天阅读挑战 · 自动签到
 * 类型: Quantumult X 定时任务 (task_local)
 * 前置: readify-token.js 已抓到 x-token / x-user-id
 * 说明: 只调用官方签到接口，不伪造奖励、不代领
 ****************************************************/
function Env(name) {
  this.name = name;
  this.log = (msg) => console.log('[Readify] ' + msg);
  this.msg = (title, subt, body) => $notify(title, subt, body);
}
const $ = new Env('Readify阅读签到');

// ================== 配置 ==================
const HOST = 'https://readifyapp.voiceclub.cn';
const DEFAULT_CAMPAIGN_ID = 'reading-streak-7d-202607';
const DEFAULT_DEVICE_ID = 'E7C9599F-C470-4FE7-BDCD-77F5BAA10296';

// 兜底手填（正常不用填，抓取脚本会自动写入；换机/新装时再填）
const FALLBACK = {
  token: '',       // x-token（JWT）
  userId: '',      // x-user-id
  deviceId: '',    // x-device-id
  campaignId: ''   // 留空用默认
};
// =========================================

const TOKEN       = $prefs.valueForKey('readify_token')      || FALLBACK.token;
const USER_ID     = $prefs.valueForKey('readify_userId')     || FALLBACK.userId;
const DEVICE_ID   = $prefs.valueForKey('readify_deviceId')   || FALLBACK.deviceId || DEFAULT_DEVICE_ID;
const CAMPAIGN_ID = $prefs.valueForKey('readify_campaignId') || FALLBACK.campaignId || DEFAULT_CAMPAIGN_ID;

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) readify version/3.6.2 platform/ios timezone/Asia/Shanghai lang/zh-Hans theme/light region/CN';

/* ---------- 工具 ---------- */
function headers(extra) {
  const h = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Origin': HOST,
    'Referer': HOST + '/activity/check-in/7DayChallenge?immersive=1',
    'User-Agent': UA,
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

function req(options) {
  return $task.fetch(options).then(
    res => ({ ok: true, status: res.statusCode, body: res.body || '' }),
    err => ({ ok: false, status: -1, body: (err && (err.error || err.message)) || 'request error' })
  );
}

function parse(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
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

// token 剩余有效天数
function tokenLeftDays(token) {
  try {
    const p = JSON.parse(b64d(token.split('.')[1]));
    if (!p || !p.exp) return null;
    return (p.exp * 1000 - Date.now()) / 86400000;
  } catch (e) { return null; }
}

function done(title, body) {
  $.log(title + ' | ' + body);
  $.msg('Readify 阅读挑战', title, body);
}

/* ---------- 主流程 ---------- */
function checkIn() {
  req({
    url: HOST + '/api/campaigns/streaks',
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ campaignId: CAMPAIGN_ID })
  }).then(r => {
    if (!r.ok) return done('❌ 签到请求失败', r.body);
    if (r.status === 401 || r.status === 403) return done('❌ 鉴权失败', 'Token 失效，打开 App 重新抓取');
    const json = parse(r.body);
    if (!json || json.code !== 0) return done('❌ 签到失败', (json && json.message) || String(r.body).slice(0, 120));

    const d = json.data || {};
    if (d.checkInResult === 'CHECKED_IN' || d.streakedToday === true) {
      let msg = '连续第 ' + (d.currentDay || '?') + ' 天签到成功';
      if (d.canClaim) msg += '，还有奖励待领取（App 内领取）';
      return done('✅ 签到成功', msg);
    }
    return done('⚠️ 未签到成功', 'checkInResult=' + d.checkInResult + ' | ' + JSON.stringify(d).slice(0, 120));
  });
}

function main() {
  if (!TOKEN || !USER_ID) {
    return done('❌ 缺少登录态', '请先用 readify-token.js 抓取，或手动填 FALLBACK');
  }
  const left = tokenLeftDays(TOKEN);
  if (left !== null && left <= 0) {
    return done('❌ Token 已过期', '打开一次 Readify App 触发请求即可自动更新');
  }

  const url = HOST + '/api/campaigns/streaks/status?campaignId=' + encodeURIComponent(CAMPAIGN_ID);

  req({ url: url, method: 'GET', headers: headers() }).then(r => {
    if (!r.ok) return done('❌ 网络错误', r.body);
    if (r.status === 401 || r.status === 403) return done('❌ 鉴权失败', 'Token 失效，打开 App 重新抓取');
    const json = parse(r.body);
    if (!json || json.code !== 0) return done('❌ 状态查询失败', (json && json.message) || String(r.body).slice(0, 120));

    const d = json.data || {};
    if (d.activityStatus && d.activityStatus !== 'ACTIVE') {
      return done('ℹ️ 活动未开启', 'activityStatus=' + d.activityStatus);
    }
    if (d.canCheckIn === true && d.streakedToday !== true) {
      return checkIn();  // 今天还没签，去签
    }
    let msg = '今日已签到，当前第 ' + (d.currentDay || 0) + ' 天';
    if (d.canClaim) msg += '，有奖励待领取';
    return done('✅ 无需签到', msg);
  });
}

main();
