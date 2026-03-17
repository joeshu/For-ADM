/**
 * @file unified-vip-unlock.js
 * @description 统一VIP解锁脚本 - 支持多应用扩展
 * @version 2.0.0
 * @date 2026-03-17
 *
 * @usage
 * [rewrite_local]
 * ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 * ^https:\/\/api2\.tophub\.(today|app)\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 *
 * [mitm]
 * hostname = api.iappdaily.com,api2.tophub.today,api2.tophub.app
 */

// ==========================================
// 1. 环境适配层
// ==========================================
const $ = new Env('UnifiedVIP');

function Env(name) {
    this.name = name;
    this.log = function(msg) {
        console.log(`[${this.name}] ${msg}`);
    };
    this.done = function(object) {
        $done(object);
    };
}

// ==========================================
// 2. 工具函数
// ==========================================
function safeJSONParse(body) {
    try {
        return JSON.parse(body);
    } catch (e) {
        $.log("JSON解析错误: " + e);
        return null;
    }
}

// ==========================================
// 3. VIP数据模板
// ==========================================
const VIPTemplates = {
    standard: {
        is_vip: 1,
        is_paid: 1,
        vip_expired: 4102444800
    },
    stringType: {
        is_vip: "1",
        is_vip_now: 1,
        vip_expired: "2099-12-31 23:59:59",
        vip_type: "lifetime",
        vip_level: 99
    },
    extended: {
        is_vip: 1,
        is_paid: 1,
        vip_expired: 4102444800,
        remain_coins: 9999,
        total_coins: 9999
    }
};

// ==========================================
// 4. 应用策略注册表
// ==========================================
const appRegistry = [
    // --- iAppDaily ---
    {
        name: "iAppDaily",
        id: "iappdaily",
        hostRegex: /api\.iappdaily\.com/,
        pathHandlers: [
            {
                path: /\/my\/balance/,
                handler: (data, url) => {
                    const vipData = VIPTemplates.extended;
                    data.is_vip = vipData.is_vip;
                    data.is_paid = vipData.is_paid;
                    data.vip_expired = vipData.vip_expired;
                    data.remain_coins = vipData.remain_coins;
                    data.total_coins = vipData.total_coins;
                    $.log("iAppDaily VIP已激活");
                    return data;
                }
            }
        ]
    },
    // --- 今日热榜 ---
    {
        name: "今日热榜",
        id: "tophub",
        hostRegex: /api2\.tophub\.(today|app)/,
        pathHandlers: [
            {
                path: /\/account\/sync/,
                handler: (data, url) => {
                    if (!data) {
                        return VIPTemplates.stringType;
                    }
                    const vipData = VIPTemplates.stringType;
                    data.error = 0;
                    data.status = 200;
                    data.is_vip = vipData.is_vip;
                    data.is_vip_now = vipData.is_vip_now;
                    data.vip_expired = vipData.vip_expired;
                    data.vip_type = vipData.vip_type;
                    data.vip_level = vipData.vip_level;
                    $.log("今日热榜 VIP已激活");
                    return data;
                }
            }
        ]
    }
];

// ==========================================
// 5. 路由处理
// ==========================================
function findMatchingApp(url) {
    for (const app of appRegistry) {
        if (app.hostRegex.test(url)) {
            return app;
        }
    }
    return null;
}

function findMatchingHandler(app, url) {
    if (!app.pathHandlers) return null;
    for (const handler of app.pathHandlers) {
        if (handler.path.test(url)) {
            return handler;
        }
    }
    return null;
}

// ==========================================
// 6. 主逻辑
// ==========================================
function main() {
    const response = $response || {};
    const url = response.url || '';
    const body = response.body || '';

    if (!body) {
        $.done({});
        return;
    }

    const data = safeJSONParse(body);
    if (!data) {
        $.done({});
        return;
    }

    const matchedApp = findMatchingApp(url);
    if (!matchedApp) {
        $.done({});
        return;
    }

    const matchedHandler = findMatchingHandler(matchedApp, url);
    if (!matchedHandler) {
        $.done({});
        return;
    }

    let targetData = data.data !== undefined ? data.data : data;

    try {
        const modifiedData = matchedHandler.handler(targetData, url);
        if (modifiedData) {
            if (data.data !== undefined) {
                data.data = modifiedData;
            }
            $.done({ body: JSON.stringify(data) });
        } else {
            $.done({});
        }
    } catch (e) {
        $.log("处理错误: " + e);
        $.done({});
    }
}

main();
