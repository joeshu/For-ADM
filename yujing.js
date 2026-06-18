/*
[rewrite_local]
^https://api-public\.lingowhale\.com/api/lingowhale/v1/.* url script-request-header https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/yujing.js
^https://api-public\.lingowhale\.com/api/lingowhale/v1/.* url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/yujing.js

[mitm]
hostname = api-public.lingowhale.com
 */

const NOW = () => Math.floor(Date.now() / 1000);

const PRO_MEMBERSHIP = {
    plan_status: "active",
    current_plan: "pro",
    plan_id: "69ea15cd50c847af2a8101a2",
    previous_plan: "free",
    plan_start_time: NOW() - 86400 * 30,
    plan_expire_time: NOW() + 86400 * 365 * 10,
    previous_plan_expire_time: NOW() - 86400,
    auto_renewal: 0
};

// APICatcher 风格：使用极大值 999999 替代 -1，避免客户端解析异常
const PRO_QUOTA = {
    channel_create_used: 0,
    article_breakdown_limit: 999999,
    channel_sub_limit: 999999,
    article_breakdown_used: 0,
    daily_voice_used: 0,
    article_key_points_used: 0,
    channel_create_limit: 999999,
    article_key_points_limit: 999999,
    export_limit: 999999,
    channel_sub_used: 0,
    tts_used: 0,
    tts_limit: 999999,
    export_used: 0,
    daily_voice_limit: 999999
};

const PRO_FEATURES = {
    features: {
        export_enabled: true,
        daily_voice_enabled: true,
        tts_enabled: true,
        article_breakdown_enabled: true,
        article_key_points_enabled: true,
        multi_channel_enabled: true,
        priority_support: true,
        api_access: true
    },
    limits: {
        max_channels: 50,
        max_subscriptions: 1000,
        max_sources_per_channel: 20
    }
};

const UNLIMITED = { can_use: true, daily_used: 0, daily_limit: 999999, remaining: 999999 };

// ============ 响应体路由表 ============

const RESPONSE_ROUTES = {
    "/membership/plans": function(body) {
        if (body.data && body.data.plans) body.data.trial_available = false;
        return "会员计划列表已覆写";
    },
    "/membership/status": function(body) {
        body.code = 0;
        body.msg = "success";
        body.data = {
            membership: Object.assign({}, PRO_MEMBERSHIP),
            quota: Object.assign({}, PRO_QUOTA),
            available_pay_type: ["monthly", "yearly", "lifetime"],
            can_claim_trial: false
        };
        return "会员状态 -> Pro";
    },
    "/membership/purchase": function(body) {
        body.code = 0;
        body.msg = "success";
        body.data = {
            order_id: "mock-" + Date.now(),
            status: "completed",
            membership: Object.assign({}, PRO_MEMBERSHIP)
        };
        return "购买响应已覆写";
    },
    "/membership/cancel": function(body) {
        body.code = 0;
        body.msg = "success";
        if (!body.data) body.data = {};
        body.data.membership = {
            plan_status: "active",
            current_plan: "pro",
            auto_renewal: 0,
            plan_expire_time: NOW() + 86400 * 365 * 10
        };
        return "取消续费已覆写";
    },
    "/membership/features": function(body) {
        body.code = 0;
        body.msg = "success";
        body.data = JSON.parse(JSON.stringify(PRO_FEATURES));
        return "功能检查 -> 全部解锁";
    },
    "/membership/quota/detail": function(body) {
        body.code = 0;
        body.msg = "success";
        body.data = {
            quota: Object.assign({}, PRO_QUOTA),
            plan_type: "premium",
            plan_id: "unlimited-mock"
        };
        return "配额详情 -> Premium 无限";
    },
    "/tts/check_limit": function(body) {
        body.code = 0;
        body.msg = "success";
        body.data = Object.assign({}, UNLIMITED);
        return "TTS 限制已解除";
    },
    "/article/check_limit": function(body) {
        body.code = 0;
        body.msg = "success";
        body.data = Object.assign({}, UNLIMITED);
        return "文章分解限制已解除";
    },
    "/user/info": function(body) {
        body.code = 0;
        body.msg = "success";
        if (body.data) {
            body.data.membership = {
                plan_status: "active",
                current_plan: "pro",
                plan_name: "Pro 年付",
                plan_expire_time: NOW() + 86400 * 365 * 10,
                is_lifetime: false
            };
        }
        return "用户信息 -> Pro";
    },
    "/membership/claim_trial": function(body) {
        body.code = 1001;
        body.msg = "您已经是Pro会员，无需领取试用";
        body.data = null;
        return "试用领取已拦截";
    }
};

// 兜底处理
function fallbackMembership(body) {
    if (!body.data) body.data = {};
    body.data.membership = Object.assign({}, PRO_MEMBERSHIP);
    body.code = 0;
    body.msg = body.msg || "success";
    if (body.data.quota) body.data.quota = Object.assign({}, PRO_QUOTA);
    return "兜底: membership";
}

function fallbackLimit(body) {
    if (!body.data) body.data = {};
    Object.assign(body.data, UNLIMITED);
    return "兜底: 限制检查";
}

// 通用 quota 兜底：任何包含 quota 字段的响应都覆写
function fallbackQuota(body) {
    if (!body.data) body.data = {};
    if (body.data.quota) body.data.quota = Object.assign({}, PRO_QUOTA);
    body.code = 0;
    body.msg = body.msg || "success";
    return "兜底: quota 覆写";
}

// ============ 请求头处理 ============

function handleRequest() {
    var url = $request.url;
    var headers = $request.headers || {};
    if (url.indexOf("/purchase") !== -1) {
        headers["X-LingoWhale-Mock"] = "1";
        console.log("[LingoWhale] 购买请求已标记");
    } else if (url.indexOf("/status") !== -1) {
        headers["X-LingoWhale-Mock"] = "1";
        console.log("[LingoWhale] 状态请求已标记");
    }
    $done({ headers: headers });
}

// ============ 响应体处理 ============

function handleResponse() {
    var body;
    try {
        body = JSON.parse($response.body);
    } catch (e) {
        console.log("[LingoWhale] JSON解析失败，返回原始响应");
        $done({});
        return;
    }

    var path = $request.url.replace(/^https?:\/\/[^\/]+/, "").replace(/\?.*$/, "");
    var handler = RESPONSE_ROUTES[path];

    if (handler) {
        console.log("[LingoWhale] " + handler(body));
    } else if (body.data && body.data.membership) {
        console.log("[LingoWhale] " + fallbackMembership(body));
    } else if (body.data && body.data.quota) {
        console.log("[LingoWhale] " + fallbackQuota(body));
    } else if (body.data && (body.data.can_use !== undefined || body.data.remaining !== undefined)) {
        console.log("[LingoWhale] " + fallbackLimit(body));
    }

    try {
        $done({ body: JSON.stringify(body) });
    } catch (e) {
        console.log("[LingoWhale] JSON序列化失败");
        $done({});
    }
}

// ============ Quantumult X 入口 ============

if (typeof $response !== "undefined" && $response) {
    handleResponse();
} else if (typeof $request !== "undefined" && $request) {
    handleRequest();
} else {
    $done({});
}
