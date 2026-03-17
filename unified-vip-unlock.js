/**
 * @file unified-vip-unlock.js
 * @description 统一VIP解锁脚本
 * @version 2.4.0
 * @date 2026-03-17
 *
 [rewrite_local]
 ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 ^https:\/\/api2\.tophub\.(today|app)\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js

  [mitm]
  hostname = api.iappdaily.com,api2.tophub.today,api2.tophub.app
 */

const $ = new Env('UnifiedVIP');

// 检查响应是否存在
if (!$response || !$response.body) {
    $.done({});
}

let body = $response.body;
let obj;

// 解析JSON
try {
    obj = JSON.parse(body);
} catch (e) {
    $.log("JSON parse error: " + e);
    $.done({});
}

const url = $response.url || '';

// ==============================
// iAppDaily 处理
// ==============================
if (url.indexOf('api.iappdaily.com') !== -1 && url.indexOf('/my/balance') !== -1) {
    if (obj && obj.data) {
        obj.data.is_vip = 1;
        obj.data.is_paid = 1;
        obj.data.vip_expired = 4102444800;
        obj.data.remain_coins = 9999;
        obj.data.total_coins = 9999;
        $.log("iAppDaily VIP activated");
    }
}
// ==============================
// 今日热榜处理
// ==============================
else if ((url.indexOf('api2.tophub.today') !== -1 || url.indexOf('api2.tophub.app') !== -1) && url.indexOf('/account/sync') !== -1) {
    if (obj && obj.data) {
        obj.error = 0;
        obj.status = 200;
        obj.data.is_vip = "1";
        obj.data.is_vip_now = 1;
        obj.data.vip_expired = "2099-12-31 23:59:59";
        $.log("Modified VIP status: permanent VIP until " + obj.data.vip_expired);
    } else {
        obj = {
            "error": 0,
            "status": 200,
            "data": {
                "is_vip": "1",
                "is_vip_now": 1,
                "vip_expired": "2099-12-31 23:59:59",
                "vip_type": "lifetime",
                "vip_level": 99
            }
        };
        $.log("Created new VIP response");
    }
}

body = JSON.stringify(obj);
$.done({ body: body });

// Env类
function Env(name) {
    this.name = name;
    this.log = function(msg) {
        console.log("[" + this.name + "] " + msg);
    };
    this.done = function(object) {
        $done(object);
    };
}
