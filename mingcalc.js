/**
 * ============================================
 * 小明计算器 VIP解锁脚本 (反混淆版本)
 * ============================================
 * 目标应用: 小明计算器 (MingCalc)
 * 功能: 解锁永久VIP、去除广告、解锁所有皮肤
 * 拦截接口: jsq.mingcalc.cn/XMGetMeCount.ashx
 * ============================================
 */
[rewrite_local]
^http:\/\/jsq\.mingcalc\.cn\/XMGetMeCount\.ashx url script-analyze-echo-response https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/mingcalc.js

[mitm]
hostname =jsq.mingcalc.cn
/*
// ==================== 第一部分: 环境初始化 ====================

// 安全获取环境对象
const $ = (typeof init !== 'undefined') ? init() : 
          (typeof $task !== 'undefined') ? $task : 
          (typeof $httpClient !== 'undefined') ? $httpClient :
          (typeof $rocket !== 'undefined') ? $rocket :
          createEnv('小明计算器');

// 兼容不同代理工具的环境构造
function createEnv(name) {
    return {
        name: name,
        log: function(message) {
            console.log(`[${this.name}] ${message}`);
        },
        msg: function(title, subtitle, message) {
            console.log(`${title}\n${subtitle}\n${message}`);
        },
        done: function(data) {
            if (typeof $done !== 'undefined') {
                $done(data);
            } else if (typeof $task !== 'undefined' && $task.done) {
                $task.done(data);
            } else {
                console.log('Response:', data);
            }
        }
    };
}

// ==================== 第二部分: 主程序逻辑 ====================

(function main() {
    // 安全检查：确保 $response 存在
    if (typeof $response === 'undefined' || !$response) {
        $.log('❌ 错误: $response 对象不存在');
        $.done({ body: JSON.stringify({ code: 500, message: "环境错误" }) });
        return;
    }

    // 获取原始HTTP响应体
    let body = $response.body;

    // 如果 body 为空，构造新响应
    if (!body) {
        $.log('⚠️ 响应体为空，构造新VIP响应');
        const newResponse = createVIPResponse();
        $.done({ body: JSON.stringify(newResponse) });
        return;
    }

    try {
        // 解析JSON响应
        let responseObj = JSON.parse(body);

        // 调用破解核心函数
        const hackedResponse = unlockVIP(responseObj);

        // 输出调试日志
        $.log('✅ 小明计算器VIP解锁成功');
        $.log('📅 VIP到期时间: 2099-12-31');
        $.log('👤 用户等级: 永久会员');

        // 返回修改后的响应
        $.done({ body: JSON.stringify(hackedResponse) });

    } catch (error) {
        // 异常处理：解析失败时返回原始数据
        $.log('❌ 解析失败: ' + error.message);
        // 返回原始 body 避免崩溃
        $.done({ body: body || "{}" });
    }
})();

// ==================== 第三部分: 破解核心函数 ====================

function unlockVIP(originalData) {
    // 确保输入是对象
    if (!originalData || typeof originalData !== 'object') {
        originalData = {};
    }

    // 确保data对象存在
    if (!originalData.data) {
        originalData.data = {};
    }

    const data = originalData.data;
    const permanentDate = "2099-12-31 23:59:59";
    const permanentTimestamp = 4102444799000;

    // VIP状态
    data.isVip = true;
    data.vipStatus = 1;
    data.memberType = "premium";
    data.userType = 1;
    data.vipExpireTime = permanentDate;
    data.vipExpireDate = permanentDate;
    data.vipExpireTimestamp = permanentTimestamp;
    data.vipStartTime = "2020-01-01 00:00:00";

    // 权限
    data.permissions = {
        "advancedCalculate": true,
        "historyExport": true,
        "cloudSync": true,
        "voiceInput": true,
        "customTheme": true,
        "noAds": true,
        "batchCalculation": true,
        "formulaEditor": true
    };

    // 皮肤
    data.skinList = ["default", "dark", "business", "pink", "green", "purple", "golden", "minimal", "tech", "custom"];
    data.currentSkin = data.currentSkin || "golden";
    data.unlockedSkins = data.skinList;

    // 广告关闭
    data.adConfig = {
        "showBannerAd": false,
        "showInterstitialAd": false,
        "showRewardAd": false,
        "showSplashAd": false,
        "adFree": true
    };
    data.showAd = false;
    data.adEnabled = false;

    // 计算器配置
    data.calcConfig = {
        "precision": 10,
        "maxHistory": 9999,
        "maxFavorites": 999,
        "enableSound": true,
        "enableVibration": true,
        "scientificMode": true
    };

    // 用户信息
    data.userInfo = {
        "nickname": "VIP用户",
        "avatar": "https://example.com/vip-avatar.png",
        "level": 99,
        "exp": 99999,
        "credit": 9999
    };

    // 响应状态
    originalData.code = 200;
    originalData.message = "success";
    originalData.success = true;

    return originalData;
}

function createVIPResponse() {
    return {
        "code": 200,
        "message": "获取用户信息成功",
        "success": true,
        "data": {
            "userId": "88888888",
            "nickname": "永久VIP用户",
            "avatar": "",
            "isVip": true,
            "vipStatus": 1,
            "memberType": "lifetime",
            "vipExpireTime": "2099-12-31 23:59:59",
            "vipStartTime": "2020-01-01 00:00:00",
            "permissions": { "all": true },
            "skinList": ["default", "dark", "business", "pink", "green", "purple", "golden"],
            "currentSkin": "golden",
            "adConfig": {
                "showBannerAd": false,
                "showInterstitialAd": false,
                "adFree": true
            },
            "calcConfig": {
                "precision": 10,
                "maxHistory": 9999,
                "scientificMode": true
            },
            "userInfo": {
                "level": 99,
                "exp": 99999
            }
        },
        "timestamp": Date.now()
    };
}
