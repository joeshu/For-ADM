/*
 * LingoWhale (语鲸) 会员解锁脚本 — Quantumult X 单文件版
 *
 * ==== Quantumult X 重写配置 ====
[rewrite_local]
^https://api-public\.lingowhale\.com/api/lingowhale/v1/(membership|tts|article|user)/.* url script-request-header https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/yujing.js
^https://api-public\.lingowhale\.com/api/lingowhale/v1/(membership|tts|article|user)/.* url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/yujing.js

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

const PRO_QUOTA = {
    tts_limit: -1,
    daily_voice_limit: -1,
    channel_create_limit: 50,
    channel_sub_limit: 1000,
    article_key_points_limit: -1,
    article_breakdown_limit: -1,
    export_limit: -1,
    tts_used: 0,
    daily_voice_used: 0,
    channel_create_used: 0,
    channel_sub_used: 0,
    article_key_points_used: 0,
    article_breakdown_used: 0,
    export_used: 0
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

const UNLIMITED = { can_use: true, daily_used: 0, daily_limit: -1, remaining: -1 };

// ============ 响应体路由表 ============

const RESPONSE_ROUTES = {
    "/membership/plans": (body) => {
        if (body.data && body.data.plans) body.data.trial_available = false;
        return "会员计划列表已覆写";
    },
    "/membership/status": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = {
            ...body.data,
            membership: { ...PRO_MEMBERSHIP },
            quota: { ...PRO_QUOTA },
            available_pay_type: ["monthly", "yearly", "lifetime"],
            can_claim_trial: false
        };
        return "会员状态 → Pro";
    },
    "/membership/purchase": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = {
            ...body.data,
            order_id: "mock-" + Date.now(),
            status: "completed",
            membership: { ...PRO_MEMBERSHIP }
        };
        return "购买响应已覆写 (未实际扣费)";
    },
    "/membership/cancel": (body) => {
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
    "/membership/features": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = { ...PRO_FEATURES };
        return "功能检查 → 全部解锁";
    },
    "/tts/check_limit": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = { ...UNLIMITED };
        return "TTS 限制已解除";
    },
    "/article/check_limit": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = { ...UNLIMITED };
        return "文章分解限制已解除";
    },
    "/user/info": (body) => {
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
        return "用户信息 → Pro";
    },
    "/membership/claim_trial": (body) => {
        body.code = 1001;
        body.msg = "您已经是Pro会员，无需领取试用";
        body.data = null;
        return "试用领取已拦截";
    }
};

// 兜底处理
function fallbackMembership(body) {
    if (!body.data) body.data = {};
    body.data.membership = { ...PRO_MEMBERSHIP };
    body.code = 0;
    body.msg = body.msg || "success";
    if (body.data.quota) body.data.quota = { ...PRO_QUOTA };
    return "兜底: membership";
}

function fallbackLimit(body) {
    if (!body.data) body.data = {};
    Object.assign(body.data, UNLIMITED);
    return "兜底: 限制检查";
}

// ============ 请求头处理 ============

function handleRequest() {
    const url = $request.url;
    let headers = $request.headers || {};

    if (url.includes("/purchase")) {
        headers["X-LingoWhale-Mock"] = "1";
        console.log("[LingoWhale] 购买请求已标记");
    } else if (url.includes("/status")) {
        headers["X-LingoWhale-Mock"] = "1";
        console.log("[LingoWhale] 状态请求已标记");
    }

    $done({ headers });
}

// ============ 响应体处理 ============

function handleResponse() {
    let body;
    try {
        body = JSON.parse($response.body);
    } catch (e) {
        console.log("[LingoWhale] JSON解析失败，返回原始响应");
        $done({});
        return;
    }

    const path = $request.url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "");
    const handler = RESPONSE_ROUTES[path];

    if (handler) {
        console.log("[LingoWhale] " + handler(body));
    } else if (body.data && body.data.membership) {
        console.log("[LingoWhale] " + fallbackMembership(body));
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
// QX 调用 script-response-body 时提供 $response
// 调用 script-request-header 时提供 $request，不提供 $response

if (typeof $response !== "undefined" && $response) {
    handleResponse();
} else if (typeof $request !== "undefined" && $request) {
    handleRequest();
} else {
    $done({});
}
