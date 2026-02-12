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
// ==================== 第一部分: 环境初始化 ====================

// Quantumult X / Surge 环境对象
const $ = new Env('小明计算器');

// ==================== 第二部分: 主程序逻辑 ====================

(function main() {
    // 获取原始HTTP响应体
    let body = $response.body;
    
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
        $done({ body: JSON.stringify(hackedResponse) });
        
    } catch (error) {
        // 异常处理：解析失败时返回原始数据
        $.log('❌ 解析失败: ' + error.message);
        $done({ body: body });
    }
})();

// ==================== 第三部分: 破解核心函数 ====================

/**
 * VIP解锁主函数
 * @param {Object} originalData - 原始服务器响应数据
 * @returns {Object} - 修改后的VIP数据
 */
function unlockVIP(originalData) {
    
    // 确保data对象存在
    if (!originalData.data) {
        originalData.data = {};
    }
    
    const data = originalData.data;
    
    // ------- 3.1 会员状态解锁 -------
    data.isVip = true;                    // VIP标识
    data.vipStatus = 1;                   // VIP状态码 (1=生效)
    data.memberType = "premium";          // 会员类型
    data.userType = 1;                    // 用户类型 (1=付费用户)
    
    // ------- 3.2 时间设置 (永久有效) -------
    const permanentDate = "2099-12-31 23:59:59";
    const permanentTimestamp = 4102444799000;  // 2099年时间戳
    
    data.vipExpireTime = permanentDate;           // VIP过期时间(字符串)
    data.vipExpireDate = permanentDate;           // 备用字段
    data.vipExpireTimestamp = permanentTimestamp; // VIP过期时间(时间戳)
    data.vipStartTime = "2020-01-01 00:00:00";    // VIP开始时间
    
    // ------- 3.3 功能权限解锁 -------
    data.permissions = {
        "advancedCalculate": true,    // 高级计算
        "historyExport": true,        // 历史记录导出
        "cloudSync": true,            // 云同步
        "voiceInput": true,           // 语音输入
        "customTheme": true,          // 自定义主题
        "noAds": true,                // 去广告
        "batchCalculation": true,     // 批量计算
        "formulaEditor": true         // 公式编辑
    };
    
    // ------- 3.4 皮肤主题解锁 -------
    // 解锁所有付费皮肤
    data.skinList = [
        "default",           // 默认皮肤
        "dark",             // 暗夜黑
        "business",         // 商务蓝
        "pink",             // 少女粉
        "green",            // 清新绿
        "purple",           // 优雅紫
        "golden",           // 土豪金
        "minimal",          // 极简白
        "tech",             // 科技蓝
        "custom"            // 自定义
    ];
    data.currentSkin = data.currentSkin || "golden";  // 默认使用金色皮肤
    data.unlockedSkins = data.skinList;               // 已解锁皮肤列表
    
    // ------- 3.5 广告配置关闭 -------
    data.adConfig = {
        "showBannerAd": false,        // 底部横幅广告
        "showInterstitialAd": false,  // 插屏广告
        "showRewardAd": false,        // 激励视频广告
        "showSplashAd": false,        // 开屏广告
        "adFree": true                // 无广告标识
    };
    data.showAd = false;              // 总广告开关
    data.adEnabled = false;           // 广告启用状态
    
    // ------- 3.6 计算器功能增强 -------
    data.calcConfig = {
        "precision": 10,              // 计算精度(小数位)
        "maxHistory": 9999,           // 最大历史记录数
        "maxFavorites": 999,          // 最大收藏数
        "enableSound": true,          // 按键音效
        "enableVibration": true,      // 按键震动
        "scientificMode": true        // 科学计算模式
    };
    
    // ------- 3.7 用户信息显示 -------
    data.userInfo = {
        "nickname": "VIP用户",
        "avatar": "https://example.com/vip-avatar.png",
        "level": 99,                  // 用户等级
        "exp": 99999,                 // 经验值
        "credit": 9999                // 积分
    };
    
    // ------- 3.8 响应状态码 -------
    originalData.code = 200;          // HTTP状态码
    originalData.message = "success"; // 响应消息
    originalData.success = true;      // 成功标识
    
    return originalData;
}

// ==================== 第四部分: 工具函数 ====================

/**
 * 环境对象构造函数 (Env)
 * 用于Quantumult X / Surge / Loon等代理工具
 */
function Env(name) {
    this.name = name;
    this.log = function(message) {
        console.log(`[${this.name}] ${message}`);
    };
    this.msg = function(title, subtitle, message) {
        console.log(`${title}\n${subtitle}\n${message}`);
    };
}

// ==================== 第五部分: 响应对象构造示例 ====================

/**
 * 如果原始响应为空，构造全新的VIP响应
 */
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
            "permissions": {
                "all": true
            },
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
        "timestamp": new Date().getTime()
    };
}
