/**
 * @function iAppDaily VIP 破解
 * @date 2026-03-15
  [rewrite_local]
  ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/iappdaily.js
  [mitm]
 hostname = api.iappdaily.com
 */

if (!$response || !$response.body) {
    $done({});
}

let body = $response.body;
let obj;

try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    $done({});
}

// 修改 VIP 状态
if (obj?.data) {
    obj.data.is_vip = 1;
    obj.data.is_paid = 1;
    obj.data.vip_expired = 4102444800; // 2099-12-31 的时间戳
    
    // 可选：增加金币数量
    obj.data.remain_coins = 9999;
    obj.data.total_coins = 9999;
    
    console.log("iAppDaily VIP 已激活");
}

$done({ body: JSON.stringify(obj) });
