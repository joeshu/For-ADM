/**
 * @file unified-vip-unlock.js
 * @description 统一VIP解锁脚本 - 支持多应用扩展
 * @version 2.3.0
 * @date 2026-03-17
 *
 * @usage
  [rewrite_local]
  ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
  ^https:\/\/api2\.tophub\.(today|app)\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 
  [mitm]
  hostname = api.iappdaily.com,api2.tophub.today,api2.tophub.app
 */

// ==========================================
// 1. 应用配置注册表
// ==========================================
var appConfigs = [
    // --- iAppDaily ---
    {
        name: "iAppDaily",
        host1: "api.iappdaily.com",
        path: "/my/balance",
        handler: function(obj) {
            if (obj && obj.data) {
                obj.data.is_vip = 1;
                obj.data.is_paid = 1;
                obj.data.vip_expired = 4102444800;
                obj.data.remain_coins = 9999;
                obj.data.total_coins = 9999;
                $.log("iAppDaily VIP activated");
                return true;
            }
            return false;
        }
    },

    // --- 今日热榜 (TopHub) ---
    {
        name: "今日热榜",
        host1: "api2.tophub.today",
        host2: "api2.tophub.app",
        path: "/account/sync",
        handler: function(obj) {
            if (obj && obj.data) {
                obj.error = 0;
                obj.status = 200;
                obj.data.is_vip = "1";
                obj.data.is_vip_now = 1;
                obj.data.vip_expired = "2099-12-31 23:59:59";
                $.log("Modified VIP status: permanent VIP until " + obj.data.vip_expired);
                return true;
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
                return true;
            }
        }
    }
];

// ==========================================
// 2. 路由匹配函数
// ==========================================
function findMatchingApp(url) {
    for (var i = 0; i < appConfigs.length; i++) {
        var app = appConfigs[i];
        var hostMatch = false;

        if (app.host1 && url.indexOf(app.host1) !== -1) {
            hostMatch = true;
        }
        if (!hostMatch && app.host2 && url.indexOf(app.host2) !== -1) {
            hostMatch = true;
        }

        if (hostMatch && url.indexOf(app.path) !== -1) {
            return app;
        }
    }
    return null;
}

// ==========================================
// 3. Env类定义
// ==========================================
function Env(name) {
    this.name = name;
    this.log = function(msg) {
        console.log("[" + this.name + "] " + msg);
    };
    this.done = function(object) {
        $done(object);
    };
}

var $ = new Env('UnifiedVIP');

// ==========================================
// 4. 主处理逻辑
// ==========================================
if (!$response || !$response.body) {
    $.done({});
}

var body = $response.body;
var obj;

try {
    obj = JSON.parse(body);
} catch (e) {
    $.log("JSON parse error: " + e);
    $.done({});
}

var url = $response.url || '';
var matchedApp = findMatchingApp(url);

if (matchedApp) {
    var success = matchedApp.handler(obj);
    if (success) {
        body = JSON.stringify(obj);
        $.done({ body: body });
    } else {
        $.done({});
    }
} else {
    $.done({});
}
