/****************************************************
 * Readify 阅读挑战 · 登录态抓取
 * 类型: Quantumult X 重写脚本 (script-request-header)
 * 作用: 被动保存 x-token / x-user-id / x-device-id / campaignId
 * 说明: 只存值，不改请求；值未变化时不重复写入 $prefs
 ****************************************************/
const KEY_TOKEN = 'readify_token';
const KEY_UID   = 'readify_userId';
const KEY_DID   = 'readify_deviceId';
const KEY_CID   = 'readify_campaignId';

function getHeader(headers, name) {
  const lower = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return '';
}

function save(key, value) {
  if (!value) return false;
  if ($prefs.valueForKey(key) === value) return false;
  $prefs.setValueForKey(value, key);
  return true;
}

(function () {
  const headers = ($request && $request.headers) || {};
  const url = ($request && $request.url) || '';

  const changed = [
    save(KEY_TOKEN, getHeader(headers, 'x-token')),
    save(KEY_UID, getHeader(headers, 'x-user-id')),
    save(KEY_DID, getHeader(headers, 'x-device-id'))
  ].some(Boolean);

  // 活动 id 会随活动变化，从 URL 里自动提取覆盖
  const m = url.match(/[?&]campaignId=([^&#]+)/);
  if (m) {
    const cid = decodeURIComponent(m[1]);
    if (save(KEY_CID, cid)) changed = true;
  }

  console.log(changed ? 'Readify: 登录态已更新' : 'Readify: 登录态无变化');
  $done({});
})();
