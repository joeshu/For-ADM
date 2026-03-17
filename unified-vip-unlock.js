/**
 * @file unified-vip-unlock.js
 * @description 统一VIP解锁脚本 - 支持多应用扩展
 * @version 2.1.0
 * @date 2026-03-17
 *
 * @usage
 [rewrite_local]
 ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 ^https:\/\/api2\.tophub\.(today|app)\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 
 [mitm]
 hostname = api.iappdaily.com,api2.tophub.today,api2.tophub.app
 *
 * ==========================================
 * 新增应用配置说明
 * ==========================================
 * 在 appConfigs 数组中添加新的应用配置
 */

// ==========================================
// 1. 应用配置注册表
// ==========================================
const appConfigs = [
    // --- iAppDaily ---
    {
        name: "iAppDaily",
        hostPattern: "api.iappdaily.com",
        pathPattern: "/my/balance",
        handler: (obj) => {
            if (obj && obj.data) {
                obj.data.is_vip = 1;
                obj.data.is_paid = 1;
                obj.data.vip_expired = 4102444800;
                obj.data.remain_coins = 9999;
                obj.data.total_coins = 9999;
                return { success: true, msg: "iAppDaily VIP activated" };
            }
            return { success: false };
        }
    },

    // --- 今日热榜 (TopHub) ---
    {
        name: "今日热榜",
        hostPattern: "api2.tophub.today",
        pathPattern: "/account/sync",
        handler: (obj) => {
            if (obj && obj.data) {
                obj.error = 0;
                obj.status = 200;
                obj.data.is_vip = "1";
                obj.data.is_vip_now = 1;
                obj.data.vip_expired = "2099-12-31 23:59:59";
                return { success: true, msg: "TopHub VIP activated" };
            } else {
                // 响应结构异常，构造新的VIP响应
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
                return { success: true, msg: "Created new VIP response", newObj: obj };
            }
        }
    }

    // ======================================
    // 新增应用配置示例
    // ======================================
    // {
    //     name: "新应用名称",
    //     hostPattern: "api.example.com",
    //     pathPattern: "/api/user",
    //     handler: (obj) => {
    //         if (obj && obj.data) {
    //             obj.data.is_vip = 1;
    //             return { success: true, msg: "App VIP activated" };
    //         }
    //         return { success: false };
    //     }
    // }
];

// ==========================================
// 2. 路由匹配函数
// ==========================================
function findMatchingApp(url) {
    for (const app of appConfigs) {
        if (url.indexOf(app.hostPattern) !== -1 && url.indexOf(app.pathPattern) !== -1) {
            return app;
        }
    }
    return null;
}

// ==========================================
// 3. 主处理逻辑
// ==========================================
function main() {
    // 检查响应是否存在
    if (!$response || !$response.body) {
        $.done({});
        return;
    }

    let body = $response.body;
    let obj;

    // 解析JSON
    try {
        obj = JSON.parse(body);
    } catch (e) {
        $.log("JSON parse error: " + e);
        $.done({});
        return;
    }

    // 查找匹配的应用
    const url = $response.url || '';
    const matchedApp = findMatchingApp(url);

    if (!matchedApp) {
        $.done({});
        return;
    }

    // 执行VIP解锁逻辑
    const result = matchedApp.handler(obj);

    if (result.success) {
        // 如果生成了新对象，使用新对象
        if (result.newObj) {
            obj = result.newObj;
        }
        $.log(result.msg);
        body = JSON.stringify(obj);
        $.done({ body: body });
    } else {
        $.done({});
    }
}

// ==========================================
// 4. Env类定义
// ==========================================
function Env(name) {
    this.name = name;
    this.log = function(msg) {
        console.log(`[${this.name}] ${msg}`);
    };
    this.done = function(object) {
        $done(object);
    };
}

const $ = new Env('UnifiedVIP');

// ==========================================
// 5. 脚本入口
// ==========================================
main();
