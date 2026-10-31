#!/usr/bin/env node
/**
 * Readify QX 脚本离线回归（mock Quantumult X 环境）
 * 运行: node readify/tests/run.js
 * 覆盖: token 抓取容错/去重/防覆盖；签到 已签/未签/401/网络重试/超时/过期/缺登录态
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const TOKEN_JS = path.join(ROOT, 'readify-token.js');
const CHECKIN_JS = path.join(ROOT, 'readify-checkin.js');

let failed = 0;
let passed = 0;

function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function jwt(expSeconds) {
  return b64url({ alg: 'HS256', typ: 'JWT' }) + '.' +
         b64url({ userId: 'u1', exp: expSeconds || Math.floor(Date.now() / 1000) + 86400 * 7 }) +
         '.signaturepart0123456789';
}

function makeSandbox(opts) {
  opts = opts || {};
  const prefs = opts.prefs || new Map();
  const log = { writes: 0, values: [] };
  const logs = [];
  const notifications = [];
  const timers = new Map();
  let timerId = -1;
  let doneCalls = 0;
  let fetchCalls = [];

  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;

  const sandbox = {
    console: { log: (m) => { logs.push(String(m)); } },
    $prefs: {
      valueForKey: (k) => (prefs.has(k) ? prefs.get(k) : null),
      setValueForKey: (v, k) => {
        log.writes++;
        log.values.push(String(v));
        if (opts.failWrites) throw new Error('prefs write failed');
        prefs.set(k, String(v));
      }
    },
    $notify: (...a) => { notifications.push(a.join(' | ')); },
    $done: () => { doneCalls++; },
    $request: opts.request || {},
    $task: {
      fetch: (o) => {
        fetchCalls.push(o);
        return opts.fetch ? opts.fetch(o, fetchCalls.length) : Promise.reject(new Error('no fetch mock'));
      }
    },
    setTimeout: (fn, ms) => {
      if (ms >= 10000) { const id = timerId--; timers.set(id, fn); return id; }
      return realSetTimeout(fn, 0);
    },
    clearTimeout: (id) => {
      if (timers.has(id)) { timers.delete(id); return; }
      if (id >= 0) realClearTimeout(id);
    },
    Date, Math, JSON, Promise, String, Number, Boolean, Array, Object, RegExp, Error,
    encodeURIComponent, decodeURIComponent, isNaN
  };
  sandbox.globalThis = sandbox;

  return {
    sandbox, prefs, log, logs, notifications, timers,
    get doneCalls() { return doneCalls; },
    get fetchCalls() { return fetchCalls; }
  };
}

function run(file, sb) {
  const code = fs.readFileSync(file, 'utf8');
  vm.createContext(sb);
  vm.runInContext(code, sb, { timeout: 5000 });
}

async function settle(ms) {
  await new Promise((r) => setTimeout(r, ms === undefined ? 20 : ms));
}

// 触发被收集的超时定时器（模拟请求悬挂），并等待重试链
async function pumpTimeout(env, rounds) {
  for (let i = 0; i < (rounds || 12); i++) {
    await settle(10);
    if (!env.timers.size) continue;
    const fns = [...env.timers.values()];
    env.timers.clear();
    fns.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  }
  await settle(10);
}

const STATUS_OK = (data) => JSON.stringify({ code: 0, message: 'ok', data });
const CHECKIN_OK = (data) => JSON.stringify({ code: 0, message: 'ok', data });

async function testToken() {
  console.log('\n[readify-token.js]');
  const t = jwt();

  // 1. 正常抓取
  {
    const env = makeSandbox({
      request: {
        url: 'https://readifyapp.voiceclub.cn/api/campaigns/streaks/status?campaignId=reading-streak-7d-202607',
        headers: { 'X-Token': t, 'x-user-id': 'u1', 'X-Device-Id': 'dev-1' }
      }
    });
    run(TOKEN_JS, env.sandbox);
    check('保存 token', env.prefs.get('readify_token') === t);
    check('保存 userId', env.prefs.get('readify_userId') === 'u1');
    check('保存 deviceId', env.prefs.get('readify_deviceId') === 'dev-1');
    check('保存 campaignId', env.prefs.get('readify_campaignId') === 'reading-streak-7d-202607');
    check('$done 调用一次', env.doneCalls === 1, String(env.doneCalls));
    check('日志不含 token', !env.logs.join('\n').includes(t.slice(0, 30)));
  }

  // 2. 相同值不重复写
  {
    const prefs = new Map([['readify_token', t], ['readify_userId', 'u1'], ['readify_deviceId', 'dev-1'], ['readify_campaignId', 'c1']]);
    const env = makeSandbox({
      prefs,
      request: { url: 'https://readifyapp.voiceclub.cn/api/x?campaignId=c1', headers: { 'x-token': t, 'x-user-id': 'u1', 'x-device-id': 'dev-1' } }
    });
    run(TOKEN_JS, env.sandbox);
    check('无变化时不写 prefs', env.log.writes === 0, String(env.log.writes));
    check('$done 仍调用', env.doneCalls === 1);
  }

  // 3. 非 JWT 不覆盖已有有效 token
  {
    const prefs = new Map([['readify_token', t]]);
    const env = makeSandbox({
      prefs,
      request: { url: 'https://readifyapp.voiceclub.cn/api/x', headers: { 'x-token': 'broken-token', 'x-user-id': 'u1' } }
    });
    run(TOKEN_JS, env.sandbox);
    check('保留旧 token', env.prefs.get('readify_token') === t, env.prefs.get('readify_token'));
  }

  // 4. 脏 query 不写 campaignId
  {
    const env = makeSandbox({
      request: { url: 'https://readifyapp.voiceclub.cn/api/x?campaignId=%E4%B8%AD%E6%96%87;drop', headers: { 'x-token': t } }
    });
    run(TOKEN_JS, env.sandbox);
    check('非法 campaignId 被丢弃', !env.prefs.has('readify_campaignId'), env.prefs.get('readify_campaignId'));
  }

  // 5. prefs 写失败不崩、仍 $done
  {
    const env = makeSandbox({
      failWrites: true,
      request: { url: 'https://readifyapp.voiceclub.cn/api/x', headers: { 'x-token': t, 'x-user-id': 'u1' } }
    });
    let threw = null;
    try { run(TOKEN_JS, env.sandbox); } catch (e) { threw = e; }
    check('写入异常不外抛', !threw, threw && threw.message);
    check('异常时仍 $done', env.doneCalls === 1);
  }
}

function basePrefs(token, extra) {
  const p = new Map();
  p.set('readify_token', token);
  p.set('readify_userId', 'u1');
  p.set('readify_deviceId', 'dev-1');
  p.set('readify_campaignId', 'reading-streak-7d-202607');
  if (extra) extra.forEach((v, k) => p.set(k, v));
  return p;
}

async function testCheckin() {
  console.log('\n[readify-checkin.js]');

  // 1. 未签到 -> 签到成功
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: (o) => {
        if (o.method === 'GET') return Promise.resolve({ statusCode: 200, body: STATUS_OK({ activityStatus: 'ACTIVE', canCheckIn: true, streakedToday: false, currentDay: 2 }) });
        return Promise.resolve({ statusCode: 200, body: CHECKIN_OK({ checkInResult: 'CHECKED_IN', currentDay: 3, canClaim: true }) });
      }
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(60);
    check('先查状态再签到', env.fetchCalls.length === 2, String(env.fetchCalls.length));
    check('签到成功通知', env.notifications.join('').includes('签到成功'), env.notifications.join(''));
    check('提示奖励待领取', env.notifications.join('').includes('待领取'));
  }

  // 2. 今日已签 -> 不发 POST
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: (o) => Promise.resolve({ statusCode: 200, body: STATUS_OK({ activityStatus: 'ACTIVE', streakedToday: true, currentDay: 4 }) })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(60);
    check('已签不重复请求', env.fetchCalls.length === 1, String(env.fetchCalls.length));
    check('已签通知', env.notifications.join('').includes('今日已签到'), env.notifications.join(''));
  }

  // 3. 401 不重试
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: () => Promise.resolve({ statusCode: 401, body: '{"code":401}' })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(60);
    check('401 只请求一次', env.fetchCalls.length === 1, String(env.fetchCalls.length));
    check('401 鉴权失败通知', env.notifications.join('').includes('鉴权失败'), env.notifications.join(''));
  }

  // 4. 网络错误重试后成功
  {
    let n = 0;
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: () => {
        n++;
        if (n <= 2) return Promise.reject(new Error('network down'));
        return Promise.resolve({ statusCode: 200, body: STATUS_OK({ activityStatus: 'ACTIVE', streakedToday: true, currentDay: 5 }) });
      }
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(120);
    check('重试后成功（3 次请求）', env.fetchCalls.length === 3, String(env.fetchCalls.length));
    check('最终成功通知', env.notifications.join('').includes('今日已签到'), env.notifications.join(''));
  }

  // 5. 5xx 重试耗尽
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: () => Promise.resolve({ statusCode: 503, body: 'busy' })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(200);
    check('5xx 共 3 次（1+2 重试）', env.fetchCalls.length === 3, String(env.fetchCalls.length));
    check('失败通知', env.notifications.join('').includes('状态查询失败'), env.notifications.join(''));
  }

  // 6. 请求悬挂 -> 超时收尾
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: () => new Promise(() => {})   // 永不 resolve
    });
    run(CHECKIN_JS, env.sandbox);
    await pumpTimeout(env, 20);
    check('悬挂请求最终收尾', env.notifications.length >= 1, String(env.notifications.length));
    check('超时提示', env.notifications.join('').includes('超时'), env.notifications.join(''));
    check('超时后 $done 调用', env.doneCalls === 1, String(env.doneCalls));
  }

  // 7. token 过期不发请求
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt(Math.floor(Date.now() / 1000) - 60)),
      fetch: () => Promise.resolve({ statusCode: 200, body: STATUS_OK({}) })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(40);
    check('过期不发请求', env.fetchCalls.length === 0, String(env.fetchCalls.length));
    check('过期通知', env.notifications.join('').includes('已过期'), env.notifications.join(''));
  }

  // 8. 缺登录态
  {
    const env = makeSandbox({ prefs: new Map(), fetch: () => Promise.resolve({ statusCode: 200, body: '{}' }) });
    run(CHECKIN_JS, env.sandbox);
    await settle(40);
    check('缺登录态不发请求', env.fetchCalls.length === 0, String(env.fetchCalls.length));
    check('缺登录态通知', env.notifications.join('').includes('缺少登录态'), env.notifications.join(''));
  }

  // 9. 非法 campaignId 回落到默认值
  {
    const prefs = basePrefs(jwt());
    prefs.set('readify_campaignId', '../etc/passwd');
    const env = makeSandbox({
      prefs,
      fetch: () => Promise.resolve({ statusCode: 200, body: STATUS_OK({ streakedToday: true, currentDay: 1 }) })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(60);
    check('非法活动 id 回落默认', env.fetchCalls[0] && env.fetchCalls[0].url.includes('reading-streak-7d-202607'), env.fetchCalls[0] && env.fetchCalls[0].url);
  }

  // 10. canCheckIn=false 不硬刷签到
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: () => Promise.resolve({ statusCode: 200, body: STATUS_OK({ activityStatus: 'ACTIVE', canCheckIn: false, streakedToday: false }) })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(60);
    check('canCheckIn=false 不发 POST', env.fetchCalls.length === 1, String(env.fetchCalls.length));
    check('提示暂不可签', env.notifications.join('').includes('暂不可签'), env.notifications.join(''));
  }

  // 11. code 为字符串 0、字段为字符串布尔
  {
    const env = makeSandbox({
      prefs: basePrefs(jwt()),
      fetch: (o) => o.method === 'GET'
        ? Promise.resolve({ statusCode: 200, body: JSON.stringify({ code: '0', data: { canCheckIn: 'true', streakedToday: 'false' } }) })
        : Promise.resolve({ statusCode: 200, body: JSON.stringify({ code: '0', data: { checkInResult: 'CHECKED_IN', currentDay: 6 } }) })
    });
    run(CHECKIN_JS, env.sandbox);
    await settle(80);
    check('字符串 code/布尔可解析', env.notifications.join('').includes('签到成功'), env.notifications.join(''));
  }
}

(async () => {
  await testToken();
  await testCheckin();
  console.log('\n结果: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
