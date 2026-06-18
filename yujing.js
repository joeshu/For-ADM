/**
 * LingoWhale (语鲸) 会员解锁脚本 — Quantumult X 优化版
 * 原始: https://github.com/joeshu/For-ADM/blob/master/yujing.js
 *
 * ==== Quantumult X 重写配置 (放入 [rewrite_local]) ====
 * # 语鲸会员解锁 (请求头 + 响应体)
^https://api-public\.lingowhale\.com/api/lingowhale/v1/(membership|tts|article|user)/.* url script-request-header https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/yujing.js
^https://api-public\.lingowhale\.com/api/lingowhale/v1/(membership|tts|article|user)/.* url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/yujing.js
 
[mitm]
hostname = api-public.lingowhale.com
 */

// ============ Mock 数据 ============

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

// ============ 路由表 (path 匹配 → handler) ============

// 响应体路由
const RESPONSE_ROUTES = {
    "/membership/plans": (body) => {
        if (body.data?.plans) body.data.trial_available = false;
        return "会员计划列表已覆写";
    },
    "/membership/status": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = { ...body.data, membership: { ...PRO_MEMBERSHIP }, quota: { ...PRO_QUOTA }, available_pay_type: ["monthly", "yearly", "lifetime"], can_claim_trial: false };
        return "会员状态 → Pro";
    },
    "/membership/purchase": (body) => {
        body.code = 0;
        body.msg = "success";
        body.data = { ...body.data, order_id: "mock-" + Date.now(), status: "completed", membership: { ...PRO_MEMBERSHIP } };
        return "购买响应已覆写 (未实际扣费)";
    },
    "/membership/cancel": (body) => {
        body.code = 0;
        body.msg = "success";
        if (!body.data) body.data = {};
        body.data.membership = { plan_status: "active", current_plan: "pro", auto_renewal: 0, plan_expire_time: NOW() + 86400 * 365 * 10 };
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
            body.data.membership = { plan_status: "active", current_plan: "pro", plan_name: "Pro 年付", plan_expire_time: NOW() + 86400 * 365 * 10, is_lifetime: false };
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

// 兜底: 含 membership 字段
function fallbackMembership(body) {
    body.data.membership = { ...PRO_MEMBERSHIP };
    body.code = 0;
    body.msg = body.msg || "success";
    if (body.data.quota) body.data.quota = { ...PRO_QUOTA };
    return "兜底: membership";
}

// 兜底: 含 can_use / remaining 字段
function fallbackLimit(body) {
    Object.assign(body.data, UNLIMITED);
    return "兜底: 限制检查";
}

// ============ 请求头处理 ============

function onRequest(req) {
    const tag = req.url.includes("/purchase") ? "购买" : req.url.includes("/status") ? "状态" : null;
    if (tag) {
        req.headers["X-LingoWhale-Mock"] = "1";
        console.log(`[LingoWhale] ${tag}请求已标记`);
    }
    return req;
}

// ============ 响应体处理 ============

function onResponse(req, res) {
    let body;
    try { body = JSON.parse(res.body); } catch (_) { return res; }

    const path = req.url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "");
    const handler = RESPONSE_ROUTES[path];

    if (handler) {
        console.log(`[LingoWhale] ${handler(body)}`);
    } else if (body.data?.membership) {
        console.log(`[LingoWhale] ${fallbackMembership(body)}`);
    } else if (body.data && (body.data.can_use !== undefined || body.data.remaining !== undefined)) {
        console.log(`[LingoWhale] ${fallbackLimit(body)}`);
    }

    try { res.body = JSON.stringify(body); } catch (_) {}
    return res;
}

// ============ Quantumult X 入口 ============

$response ? $done(onResponse($request, $response)) : $request ? $done(onRequest($request)) : $done({});
