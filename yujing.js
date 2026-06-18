/**
 * LingoWhale 会员解锁脚本
[rewrite_local]
# 会员状态
https://api-public.lingowhale.com/api/lingowhale/v1/membership/status url script-request-header lingowhale-unlock.js
https://api-public.lingowhale.com/api/lingowhale/v1/membership/status url script-response-body lingowhale-unlock.js
# 会员计划列表
https://api-public.lingowhale.com/api/lingowhale/v1/membership/plans url script-response-body lingowhale-unlock.js
# 会员购买/订阅
https://api-public.lingowhale.com/api/lingowhale/v1/membership/purchase url script-request-header lingowhale-unlock.js
https://api-public.lingowhale.com/api/lingowhale/v1/membership/purchase url script-response-body lingowhale-unlock.js
# 取消续费
https://api-public.lingowhale.com/api/lingowhale/v1/membership/cancel url script-response-body lingowhale-unlock.js
# 会员功能检查
https://api-public.lingowhale.com/api/lingowhale/v1/membership/features url script-response-body lingowhale-unlock.js
# TTS限制
https://api-public.lingowhale.com/api/lingowhale/v1/tts/check_limit url script-response-body lingowhale-unlock.js
# 文章分解限制
https://api-public.lingowhale.com/api/lingowhale/v1/article/check_limit url script-response-body lingowhale-unlock.js
# 用户信息
https://api-public.lingowhale.com/api/lingowhale/v1/user/info url script-response-body lingowhale-unlock.js
# 试用领取
https://api-public.lingowhale.com/api/lingowhale/v1/membership/claim_trial url script-response-body lingowhale-unlock.js
[mitm]
 hostname = iotpservice.smartont.net
 */



const MEMBERSHIP_MOCK = {
    plan_status: "active",
    current_plan: "pro",
    plan_id: "69ea15cd50c847af2a8101a2",
    previous_plan: "free"
};

const QUOTA_MOCK = {
    tts_limit: -1,
    channel_create_limit: 50,
    article_key_points_limit: -1,
    export_limit: -1,
    article_key_points_used: 0,
    export_used: 0,
    channel_sub_limit: 1000,
    daily_voice_used: 0,
    tts_used: 0,
    channel_sub_used: 0,
    article_breakdown_limit: -1,
    daily_voice_limit: -1,
    article_breakdown_used: 0,
    channel_create_used: 0
};

const FEATURES_MOCK = {
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

const UNLIMITED_LIMIT = {
    can_use: true,
    daily_used: 0,
    daily_limit: -1,
    remaining: -1
};

const NOW_TS = () => Math.floor(Date.now() / 1000);

// 生成完整的 membership 对象 (含时间)
function buildMembership() {
    return {
        ...MEMBERSHIP_MOCK,
        plan_start_time: NOW_TS() - 86400 * 30,
        plan_expire_time: NOW_TS() + 86400 * 365 * 10,
        previous_plan_expire_time: NOW_TS() - 86400,
        auto_renewal: 0
    };
}

// ============ 响应体覆写处理 ============

function onResponseBody(request, response) {
    const url = request.url;
    let body;
    try {
        body = JSON.parse(response.body);
    } catch (e) {
        // 非 JSON 响应, 放行
        return response;
    }

    // 1. 会员计划列表
    if (url.includes('/membership/plans')) {
        if (body.data && Array.isArray(body.data.plans)) {
            body.data.trial_available = false;
        }
        console.log('[LingoWhale] 会员计划列表已覆写');
    }

    // 2. 会员状态
    else if (url.includes('/membership/status')) {
        body.code = 0;
        body.msg = 'success';
        body.data = body.data || {};
        body.data.membership = buildMembership();
        body.data.quota = { ...QUOTA_MOCK };
        body.data.available_pay_type = ["monthly", "yearly", "lifetime"];
        body.data.can_claim_trial = false;
        console.log('[LingoWhale] 会员状态已覆写 → Pro 会员');
    }

    // 3. 会员购买/订阅
    else if (url.includes('/membership/purchase')) {
        body.code = 0;
        body.msg = 'success';
        body.data = body.data || {};
        body.data.order_id = "mock-order-" + Date.now();
        body.data.status = "completed";
        body.data.membership = buildMembership();
        console.log('[LingoWhale] 购买响应已覆写 (未实际扣费)');
    }

    // 4. 取消续费
    else if (url.includes('/membership/cancel')) {
        body.code = 0;
        body.msg = 'success';
        body.data = body.data || {};
        body.data.membership = body.data.membership || {};
        body.data.membership.plan_status = "active";
        body.data.membership.current_plan = "pro";
        body.data.membership.auto_renewal = 0;
        body.data.membership.plan_expire_time = NOW_TS() + 86400 * 365 * 10;
        console.log('[LingoWhale] 取消续费响应已覆写');
    }

    // 5. 会员功能检查
    else if (url.includes('/membership/features')) {
        body.code = 0;
        body.msg = 'success';
        body.data = { ...FEATURES_MOCK };
        console.log('[LingoWhale] 功能检查已覆写 → 全部解锁');
    }

    // 6. TTS 限制检查
    else if (url.includes('/tts/check_limit')) {
        body.code = 0;
        body.msg = 'success';
        body.data = { ...UNLIMITED_LIMIT };
        console.log('[LingoWhale] TTS 限制已解除');
    }

    // 7. 文章分解限制检查
    else if (url.includes('/article/check_limit')) {
        body.code = 0;
        body.msg = 'success';
        body.data = { ...UNLIMITED_LIMIT };
        console.log('[LingoWhale] 文章分解限制已解除');
    }

    // 8. 用户信息
    else if (url.includes('/user/info')) {
        body.code = 0;
        body.msg = 'success';
        if (body.data) {
            body.data.membership = {
                plan_status: "active",
                current_plan: "pro",
                plan_name: "Pro 年付",
                plan_expire_time: NOW_TS() + 86400 * 365 * 10,
                is_lifetime: false
            };
        }
        console.log('[LingoWhale] 用户信息已覆写 → Pro 会员');
    }

    // 9. 试用领取
    else if (url.includes('/membership/claim_trial')) {
        body.code = 1001;
        body.msg = '您已经是Pro会员，无需领取试用';
        body.data = null;
        console.log('[LingoWhale] 试用领取已拦截 → 提示已是会员');
    }

    // 10. 兜底: 任意包含 membership 的响应
    else if (body.data && body.data.membership) {
        body.data.membership = buildMembership();
        body.code = 0;
        body.msg = body.msg || 'success';
        if (body.data.quota) {
            body.data.quota = { ...QUOTA_MOCK };
        }
        console.log('[LingoWhale] 兜底覆写: 会员信息');
    }

    // 11. 兜底: 任意包含限制检查的响应
    else if (body.data && (body.data.can_use !== undefined || body.data.remaining !== undefined)) {
        Object.assign(body.data, UNLIMITED_LIMIT);
        console.log('[LingoWhale] 兜底覆写: 限制检查');
    }

    try {
        response.body = JSON.stringify(body);
    } catch (e) {
        // ignore
    }
    return response;
}

// ============ 请求头处理 ============
// Quantumult X 的 script-request-header 主要用于在请求发送前修改 headers
// 这里可以用来阻止某些请求 (通过修改 URL 或添加标记)

function onRequest(request) {
    const url = request.url;

    // 对于购买请求, 注入标记头 (配合响应覆写使用)
    if (url.includes('/membership/purchase')) {
        request.headers['X-Mock-Purchase'] = '1';
        console.log('[LingoWhale] 购买请求已标记');
    }

    // 对于会员状态请求, 注入标记头
    if (url.includes('/membership/status')) {
        request.headers['X-Mock-Status'] = '1';
        console.log('[LingoWhale] 状态请求已标记');
    }

    return request;
}

// ============ Quantumult X 入口 ============
// Quantumult X 会自动调用以下两个函数之一:
//   $done({response})   → 对于响应体覆写
//   $done({request})    → 对于请求头注入

if ($response) {
    // script-response-body: 响应体覆写
    $response = onResponseBody($request, $response);
    $done($response);
} else if ($request) {
    // script-request-header: 请求头注入
    $request = onRequest($request);
    $done($request);
} else {
    $done({});
}
