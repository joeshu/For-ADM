/*
📜 统一订阅解锁框架
📅 更新时间：2025-04-03
🔓 功能：自动识别服务类型并解锁永久 VIP

目前支持服务：
- Adapty (adapty.io)
- Apphud (apphud.com)
- SNOW (snow.me)

[rewrite_local]
# Adapty解锁
^https?:\/\/api\.adapty\.io\/api\/v\d\/(sdk\/analytics\/profiles|sdk\/in-apps\/[^\/]+\/products-ids\/app_store|sdk\/in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/Script/main/qx/adaptyhub.js
^https?:\/\/api\.adaptytech\.com\/api\/v\d\/(sdk\/analytics\/profiles|sdk\/in-apps\/[^\/]+\/products-ids\/app_store|sdk\/in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/Script/main/qx/adaptyhub.js
# Apphud解锁
^https?:\/\/.*\.apphud\.com\/v\d\/(subscriptions|customers)$ url script-response-body https://raw.githubusercontent.com/joeshu/Script/main/qx/adaptyhub.js

# SNOW系列解锁
^https?:\/\/.*\.snow\.me\/v\d\/purchase\/subscription\/subscriber\/status url script-response-body https://raw.githubusercontent.com/joeshu/Script/main/qx/adaptyhub.js

[mitm]
hostname = api.adapty.io, *.apphud.com, *.snow.me, api.adaptytech.com
*/

// ================ 配置区域 ================
const SETTINGS = {
    // 调试日志开关
    DEBUG_LOG: true,
    
    // 通知设置
    NOTIFICATION: {
        ENABLED: true,            // 通知开关
        INTERVAL: 10 * 60 * 1000, // 同一应用通知间隔(毫秒)：10分钟
        ERROR: true               // 错误通知开关
    },
    
    // 注入配置
    INJECT: {
        // 日期配置
        DATES: {
            CURRENT: new Date().toISOString(),
            FUTURE: "2088-08-08T08:08:08.000Z"
        },
        // 交易ID配置（末尾数字可随机化）
        TRANSACTION: {
            ID: `4900012${Math.floor(Math.random() * 10000000)}`
        }
    }
};
// ============================================

// 环境类 - 提供基础功能
class Env {
    constructor(name) {
        this.name = name;
        this.startTime = Date.now();
        
        // 初始化存储系统
        if (typeof $persistentStore !== 'undefined') {
            this.storage = $persistentStore;
        } else if (typeof $prefs !== 'undefined') {
            this.storage = $prefs;
        } else {
            this.storage = {
                read: () => null,
                write: () => false
            };
        }
    }
    
    log(...args) {
        if (SETTINGS.DEBUG_LOG) {
            console.log(`[${this.name}] ${args.join(" ")}`);
        }
    }
    
    // 读取持久化数据
    getdata(key) {
        try {
            if (typeof $persistentStore !== 'undefined') {
                return this.storage.read(key);
            } else if (typeof $prefs !== 'undefined') {
                return this.storage.valueForKey(key);
            }
            return null;
        } catch (e) {
            this.log(`读取数据失败: ${e.message}`);
            return null;
        }
    }
    
    // 写入持久化数据
    setdata(key, value) {
        try {
            if (typeof $persistentStore !== 'undefined') {
                return this.storage.write(value, key);
            } else if (typeof $prefs !== 'undefined') {
                return this.storage.setValueForKey(value, key);
            }
            return false;
        } catch (e) {
            this.log(`写入数据失败: ${e.message}`);
            return false;
        }
    }
    
    // 发送通知
    notify(title, subtitle = "", message = "", appId = "") {
        // 如果通知已关闭，仅记录日志
        if (!SETTINGS.NOTIFICATION.ENABLED) {
            this.log(`[通知已关闭] ${title}: ${subtitle} ${message}`);
            return;
        }
        
        // 检查通知间隔
        if (appId && !title.includes("错误")) {
            const notificationKey = `${this.name}_${appId}_lastNotify`;
            const lastNotifyTime = this.getdata(notificationKey);
            
            // 如果存在上次通知时间且未超过间隔，不发送通知
            if (lastNotifyTime) {
                const timeSince = Date.now() - parseInt(lastNotifyTime);
                if (timeSince < SETTINGS.NOTIFICATION.INTERVAL) {
                    this.log(`[通知间隔未到] ${appId}: 上次通知于 ${Math.floor(timeSince/1000/60)} 分钟前`);
                    return;
                }
            }
            
            // 更新通知时间
            this.setdata(notificationKey, Date.now().toString());
        }
        
        // 发送通知
        if (typeof $notify !== 'undefined') {
            $notify(title, subtitle, message);
        } else if (typeof $notification !== 'undefined') {
            $notification.post(title, subtitle, message);
        } else {
            // 如果不支持通知，则输出到日志
            this.log(`${title}\n${subtitle}\n${message}`);
        }
    }
    
    // 发送错误通知
    notifyError(error, context = "") {
        if (!SETTINGS.NOTIFICATION.ERROR) return;
        
        const errorMsg = error instanceof Error ? error.message : String(error);
        const title = "🔴 脚本执行错误";
        const subtitle = context ? `[${context}]` : "";
        const message = errorMsg;
        
        this.notify(title, subtitle, message);
        this.log(`错误通知: ${context} - ${errorMsg}`);
    }
    
    // 获取模板
    getTemplate(templateName) {
        try {
            // 根据模板名返回对应的内置模板
            switch (templateName.toLowerCase()) {
                case "adapty":
                    return TEMPLATES.ADAPTY;
                case "apphud":
                    return TEMPLATES.APPHUD;
                case "snow":
                    return TEMPLATES.SNOW;
                default:
                    throw new Error(`未知模板: ${templateName}`);
            }
        } catch (e) {
            this.notifyError(e, `获取${templateName}模板`);
            throw e;
        }
    }
    
    done(value = {}) {
        const costTime = (Date.now() - this.startTime) / 1000;
        this.log(`执行完毕，用时 ${costTime}s`);
        $done(value);
    }
}

// 服务检测类 - 负责识别请求的服务类型
class ServiceDetector {
    constructor(request) {
        this.url = request?.url || "";
        this.headers = request?.headers || {};
    }
    
    // 检测服务类型
    detect() {
        // 检测 Adapty
        if (this.url.includes('adapty.io')) {
            return {
                type: 'adapty',
                domain: 'adapty.io',
                name: 'Adapty'
            };
        }
        
        // 检测 Apphud
        if (this.url.includes('.apphud.com')) {
            return {
                type: 'apphud',
                domain: 'apphud.com',
                name: 'Apphud'
            };
        }
        
        // 检测 SNOW
        if (this.url.includes('.snow.me')) {
            return {
                type: 'snow',
                domain: 'snow.me',
                name: 'SNOW'
            };
        }
        
        // 未识别的服务
        return {
            type: 'unknown',
            domain: new URL(this.url).hostname,
            name: '未知服务'
        };
    }
}

// 基础请求处理器 - 服务处理器的抽象基类
class BaseHandler {
    constructor(response, request, template = {}) {
        this.rawResponse = response;
        try {
            this.response = JSON.parse(response.body || "{}");
        } catch (e) {
            env.log(`解析响应失败: ${e.message}`);
            env.notifyError(e, "解析响应");
            this.response = {};
        }
        this.request = request;
        this.headers = request?.headers || {};
        this.url = request?.url || "";
        this.template = template;
    }
    
    // 通用应用信息提取方法
    getAppInfo() {
        // 从请求头提取 User-Agent
        const ua = this.headers["User-Agent"] || this.headers["user-agent"] || "";
        // 提取应用名称 - 通常是 User-Agent 的第一部分
        const appName = ua.split("/")[0].trim();
        
        // 由子类实现具体的 Bundle ID 和额外信息提取
        const bundleId = this.extractBundleId();
        
        return {
            appName,
            bundleId
        };
    }
    
    // 捕获请求和响应的关键信息，用于调试或增强功能
    captureInfo() {
        try {
            // 基本信息收集
            const info = {
                url: this.url,
                method: this.request.method || "GET",
                headers: {},
                responseStatus: this.rawResponse.status || 200,
                timestamp: new Date().toISOString()
            };
            
            // 选择性收集关键请求头 (避免收集敏感信息)
            const safeHeaders = [
                "user-agent", "content-type", "accept", 
                "accept-language", "accept-encoding", "connection",
                "host", "origin", "referer"
            ];
            
            for (const key of Object.keys(this.headers)) {
                const lowerKey = key.toLowerCase();
                if (safeHeaders.includes(lowerKey)) {
                    info.headers[lowerKey] = this.headers[key];
                }
            }
            
            // 获取应用信息
            info.appInfo = this.getAppInfo();
            
            return info;
        } catch (e) {
            env.log(`捕获信息失败: ${e.message}`);
            return null;
        }
    }
    
    // 需要由子类实现的方法
    extractBundleId() { return "com.app.unknown"; }
    injectSubscription() { return this.response; }
}

// Adapty 服务处理器
class AdaptyHandler extends BaseHandler {
    constructor(response, request, template) {
        super(response, request, template);
    }
    
    // 从各种可能的来源提取 Bundle ID
    extractBundleId() {
        // 1. 尝试从响应数据中提取（原有的几种方式）
        if (this.response?.data?.attributes?.apple_validation_result?.bundleId) {
            return this.response.data.attributes.apple_validation_result.bundleId;
        }
        
        if (this.response?.data?.attributes?.apple_validation_result?.receipt?.bundle_id) {
            return this.response.data.attributes.apple_validation_result.receipt.bundle_id;
        }
        
        // 2. 特殊处理 products-ids 接口
        // 检查 URL 是否匹配 products-ids 模式
        const productsIdsMatch = this.url.match(/\/products-ids\/(app_store|google_play)\/?$/);
        if (productsIdsMatch && Array.isArray(this.response?.data)) {
            // 从产品 ID 数组中提取 Bundle ID
            // 产品 ID 格式示例: com.weather.overdrop.one_year, app.overdrop.lifetime
            const platform = productsIdsMatch[1]; // app_store 或 google_play
            const bundleId = this.extractBundleIdFromProductsIds(this.response.data, platform);
            if (bundleId) {
                env.log(`从 products-ids 响应中提取 Bundle ID: ${bundleId}`);
                return bundleId;
            }
        }
        
        // 3. 从 SDK Profile ID 提取
        if (this.headers["adapty-sdk-profile-id"]) {
            const parts = this.headers["adapty-sdk-profile-id"].split('$');
            if (parts.length > 1) {
                return parts[0]; // 通常 ProfileID 的前部分是 Bundle ID
            }
        }
        
        // 最后的备选项
        return "com.adapty.app";
    }
    
    // 从 products-ids 数组提取 Bundle ID
    extractBundleIdFromProductsIds(productIds, platform) {
        if (!productIds || productIds.length === 0) {
            return null;
        }
        
        env.log(`从 products-ids 提取 Bundle ID，产品数量: ${productIds.length}`);
        
        // 过滤出符合平台特征的产品 ID
        // iOS App Store: 通常以 com. 或 net. 开头
        // Google Play: 通常以 app. 或无限级包名
        const candidates = [];
        
        for (const productId of productIds) {
            // 跳过明显不是 bundle ID 前缀的条目
            if (!productId || typeof productId !== 'string') {
                continue;
            }
            
            // 分割产品 ID（格式：bundle_id.product_name 或 bundle_id.product_name.duration）
            const parts = productId.split('.');
            if (parts.length < 2) {
                continue;
            }
            
            // iOS App Store 常见的前缀：com、net、org、io、co 等
            // Google Play 常见的前缀：app 或包名开头通常是小写字母
            if (platform === 'app_store') {
                // 检查第一段是否是常见的 iOS 包名前缀
                const commonIosPrefixes = ['com', 'net', 'org', 'io', 'co', 'app'];
                if (commonIosPrefixes.includes(parts[0].toLowerCase())) {
                    // 提取前两段作为 Bundle ID（如 com.weather、com.app）
                    const candidate = parts.slice(0, 2).join('.');
                    candidates.push(candidate);
                }
            } else if (platform === 'google_play') {
                // Google Play 包名通常以 app. 或直接以小写字母开始
                // 如果第一段是 'app'，则取前两段；否则取第一段
                if (parts[0].toLowerCase() === 'app' && parts.length >= 2) {
                    const candidate = parts.slice(0, 2).join('.');
                    candidates.push(candidate);
                } else {
                    const candidate = parts[0];
                    candidates.push(candidate);
                }
            } else {
                // 通用处理：取前两段（如果存在）
                if (parts.length >= 2) {
                    const candidate = parts.slice(0, 2).join('.');
                    candidates.push(candidate);
                } else {
                    candidates.push(parts[0]);
                }
            }
        }
        
        // 如果有候选，返回出现频率最高的（多数票）
        if (candidates.length > 0) {
            // 统计出现次数
            const counts = {};
            for (const c of candidates) {
                counts[c] = (counts[c] || 0) + 1;
            }
            
            // 找到最高票
            let maxCount = 0;
            let bundleId = null;
            for (const [candidate, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxCount = count;
                    bundleId = candidate;
                }
            }
            
            if (bundleId && maxCount >= Math.ceil(candidates.length / 2)) {
                // 如果最高票超过半数，认为可靠
                env.log(`products-ids 候选 Bundle ID: ${bundleId} (出现 ${maxCount}/${candidates.length} 次)`);
                return bundleId;
            }
        }
        
        // 作为最后手段，取第一个看起来合理的产品 ID 的前两段
        for (const productId of productIds) {
            const parts = productId.split('.');
            if (parts.length >= 2) {
                const candidate = parts.slice(0, 2).join('.');
                env.log(`products-ids 回退方案，使用第一个产品 ID 提取: ${candidate}`);
                return candidate;
            }
        }
        
        return null;
    }
    
    // 获取应用信息
    getAppInfo() {
        // 先获取基本信息
        const baseInfo = super.getAppInfo();
        
        // 从请求头获取 SDK Profile ID
        const profileId = this.headers["adapty-sdk-profile-id"] || this.headers["ADAPTY-SDK-PROFILE-ID"] || "";
        
        env.log(`应用名称: ${baseInfo.appName}`);
        env.log(`Profile ID: ${profileId}`);
        env.log(`Bundle ID: ${baseInfo.bundleId}`);
        
        return {
            ...baseInfo,
            profileId
        };
    }
    
    // 提取或生成产品 ID
    extractProductId() {
        // 尝试从响应数据中获取产品 ID
        if (this.response?.data?.attributes?.subscriptions) {
            const subs = this.response.data.attributes.subscriptions;
            const productId = Object.keys(subs)[0];
            if (productId) {
                env.log(`从响应中提取产品 ID: ${productId}`);
                return productId;
            }
        }
        
        if (this.response?.data?.attributes?.apple_validation_result?.transactions) {
            const transactions = this.response.data.attributes.apple_validation_result.transactions;
            if (transactions && transactions.length > 0 && transactions[0].productId) {
                env.log(`从交易中提取产品 ID: ${transactions[0].productId}`);
                return transactions[0].productId;
            }
        }
        
        if (this.response?.data?.attributes?.apple_validation_result?.latest_receipt_info) {
            const receipts = this.response.data.attributes.apple_validation_result.latest_receipt_info;
            if (receipts && receipts.length > 0 && receipts[0].product_id) {
                env.log(`从收据中提取产品 ID: ${receipts[0].product_id}`);
                return receipts[0].product_id;
            }
        }
        
        // 生成一个基于 Bundle ID 的默认产品 ID
        const appInfo = this.getAppInfo();
        const defaultId = `${appInfo.bundleId}.yearly.premium`;
        env.log(`生成默认产品 ID: ${defaultId}`);
        return defaultId;
    }
    
    // 注入订阅信息
    injectSubscription() {
        try {
            const appInfo = this.getAppInfo();
            const productId = this.extractProductId();
            
            // 使用模板创建响应
            if (/(analytics\/profiles|purchase\/app-store)/.test(this.url)) {
                env.log("处理 Adapty 分析/购买请求");
                return this.template.createAnalyticsResponse(appInfo, productId);
            }
            
            // 处理收据验证请求
            if (/(receipt\/validate|purchase-containers)/.test(this.url)) {
                env.log("处理 Adapty 收据验证请求");
                return this.template.createReceiptResponse(appInfo, productId);
            }
            
            env.log("未匹配到处理逻辑，返回原始响应");
            return this.response;
        } catch (e) {
            env.notifyError(e, "Adapty注入订阅");
            // 捕获错误时，返回原始响应
            return this.response;
        }
    }
}

// Apphud 服务处理器
class ApphudHandler extends BaseHandler {
    constructor(response, request, template) {
        super(response, request, template);
        
        // 解析 URL 提取有用信息
        this.urlParts = this.url.split('/');
        
        // 是否是订阅接口
        this.isSubscriptionEndpoint = this.url.includes('/subscriptions');
        this.isCustomerEndpoint = this.url.includes('/customers');
        
        env.log(`处理 Apphud 请求，URL: ${this.url}`);
        env.log(`接口类型: ${this.isSubscriptionEndpoint ? '订阅接口' : (this.isCustomerEndpoint ? '客户接口' : '未知接口')}`);
    }
    
    // 从 URL 或响应提取应用 ID
    extractAppId() {
        // 从 URL 提取
        // 通常 apphud URL 格式为: https://{appid}.apphud.com/v1/...
        const hostParts = this.url.split('://')[1]?.split('.apphud.com')[0];
        if (hostParts && hostParts !== 'api') {
            return hostParts;
        }
        
        // 从响应数据提取
        if (this.response.data?.results?.application?.id) {
            return this.response.data.results.application.id;
        }
        
        // 生成随机 ID 作为备选
        return `app_${Math.random().toString(36).substring(2, 10)}`;
    }
    
    // 提取 Bundle ID
    extractBundleId() {
        // 从响应数据中提取
        if (this.response.data?.results?.application?.bundle_id) {
            return this.response.data.results.application.bundle_id;
        }
        
        // 从应用 ID 生成
        const appId = this.extractAppId();
        return `com.${appId.replace(/[^a-zA-Z0-9]/g, '')}.app`;
    }
    
    // 获取应用信息
    getAppInfo() {
        // 先获取基本信息
        const baseInfo = super.getAppInfo();
        
        // 尝试从 URL 或响应数据获取应用 ID
        let appId = this.extractAppId();
        
        env.log(`应用名称: ${baseInfo.appName}`);
        env.log(`应用 ID: ${appId}`);
        env.log(`Bundle ID: ${baseInfo.bundleId}`);
        
        return {
            ...baseInfo,
            appId
        };
    }
    
    // 提取产品信息
    extractProducts() {
        const products = [];
        
        // 尝试从 paywalls 提取产品信息
        if (this.response.data?.results?.paywalls) {
            for (const paywall of this.response.data.results.paywalls) {
                if (paywall.items) {
                    for (const item of paywall.items) {
                        if (item.product_id) {
                            products.push({
                                productId: item.product_id,
                                groupId: item.id || `group_${Math.random().toString(36).substring(2, 10)}`,
                                name: item.name || "Premium"
                            });
                        }
                    }
                }
            }
        }
        
        // 如果没有找到产品，创建一个默认产品
        if (products.length === 0) {
            const bundleId = this.extractBundleId();
            products.push({
                productId: `${bundleId}.premium.yearly`,
                groupId: `group_${Math.random().toString(36).substring(2, 10)}`,
                name: "Premium"
            });
        }
        
        env.log(`提取到 ${products.length} 个产品`);
        return products;
    }
    
    // 注入客户权限信息
    injectCustomerPermissions(products) {
        try {
            if (!this.response.data.results.permissions) {
                this.response.data.results.permissions = {};
            }
            
            // 为每个产品创建权限
            for (const product of products) {
                this.response.data.results.permissions[product.name] = this.template.createPermission(product);
                env.log(`已创建权限: ${product.name}`);
            }
        } catch (e) {
            env.notifyError(e, "注入客户权限");
        }
    }
    
    // 注入订阅信息
    injectSubscription() {
        try {
            // 保证 data 和 results 存在
            if (!this.response.data) this.response.data = {};
            if (!this.response.data.results) this.response.data.results = {};
            
            // 清空现有订阅
            this.response.data.results.subscriptions = [];
            
            // 提取产品信息
            const products = this.extractProducts();
            
            // 为每个产品创建订阅
            for (const product of products) {
                const subscription = this.template.createSubscription(product);
                this.response.data.results.subscriptions.push(subscription);
                env.log(`已创建订阅: ${product.productId}`);
            }
            
            // 注入客户权限信息（如果是客户端点）
            if (this.isCustomerEndpoint) {
                this.injectCustomerPermissions(products);
            }
            
            return this.response;
        } catch (e) {
            env.notifyError(e, "Apphud注入订阅");
            // 捕获错误时，返回原始响应
            return this.response;
        }
    }
}

// SNOW 服务处理器
class SnowHandler extends BaseHandler {
    constructor(response, request, template) {
        super(response, request, template);
    }
    
    // 获取应用信息
    getAppInfo() {
        // 从请求头提取 User-Agent
        const ua = this.headers["User-Agent"] || this.headers["user-agent"] || "";
        
        // 尝试匹配SNOW产品ID
        let appName = "";
        let productId = "";
        
        for (const key of Object.keys(this.template.productList)) {
            if (new RegExp(`^${key}`, "i").test(ua)) {
                appName = key;
                productId = this.template.productList[key].id;
                break;
            }
        }
        
        // 如果没有匹配到，使用默认值
        if (!appName) {
            appName = ua.split("/")[0].trim() || "SNOW App";
            productId = "com.campmobile.snow.subscribe.oneyear";
        }
        
        // 生成默认的Bundle ID
        const bundleId = `com.snowcorp.${appName.replace("iphoneapp.", "")}`;
        
        env.log(`应用名称: ${appName}`);
        env.log(`产品 ID: ${productId}`);
        env.log(`Bundle ID: ${bundleId}`);
        
        return {
            appName,
            bundleId,
            productId
        };
    }
    
    // 提取Bundle ID
    extractBundleId() {
        return this.getAppInfo().bundleId;
    }
    
    // 捕获SNOW特定信息
    captureInfo() {
        const baseInfo = super.captureInfo();
        
        // 添加SNOW特定信息
        const snowInfo = {
            ...baseInfo,
            snow: {
                productId: this.getAppInfo().productId
            }
        };
        
        return snowInfo;
    }
    
    // 注入订阅信息
    injectSubscription() {
        try {
            const appInfo = this.getAppInfo();
            
            // 使用模板创建响应
            return this.template.createSubscriptionResponse(appInfo);
        } catch (e) {
            env.notifyError(e, "SNOW注入订阅");
            // 捕获错误时，返回原始响应
            return this.response;
        }
    }
}

// 处理器工厂 - 创建相应的服务处理器
class HandlerFactory {
    static createHandler(serviceInfo, response, request) {
        try {
            // 获取相应的模板
            switch (serviceInfo.type) {
                case 'adapty':
                    const adaptyTemplate = env.getTemplate('adapty');
                    return new AdaptyHandler(response, request, adaptyTemplate);
                case 'apphud':
                    const apphudTemplate = env.getTemplate('apphud');
                    return new ApphudHandler(response, request, apphudTemplate);
                case 'snow':
                    const snowTemplate = env.getTemplate('snow');
                    return new SnowHandler(response, request, snowTemplate);
                default:
                    env.log(`未知服务类型: ${serviceInfo.type}，使用基础处理器`);
                    return new BaseHandler(response, request);
            }
        } catch (e) {
            env.notifyError(e, `创建${serviceInfo.name}处理器`);
            return new BaseHandler(response, request);
        }
    }
}

// 创建环境实例
const env = new Env("UnifiedVIP");

// 主函数
function main() {
    try {
        env.log("开始处理请求");
        
        // 1. 检测服务类型
        const detector = new ServiceDetector($request);
        const serviceInfo = detector.detect();
        
        env.log(`检测到服务: ${serviceInfo.name} (${serviceInfo.domain})`);
        
        // 2. 创建对应的处理器
        const handler = HandlerFactory.createHandler(serviceInfo, $response, $request);
        
        // 3. 获取应用信息
        const appInfo = handler.getAppInfo();
        
        // 4. 捕获关键信息
        const capturedInfo = handler.captureInfo();
        if (capturedInfo) {
            // 存储捕获的信息，可用于后续分析
            const captureKey = `${env.name}_captured_${Date.now()}`;
            env.setdata(captureKey, JSON.stringify(capturedInfo));
            env.log(`已捕获请求信息: ${captureKey}`);
        }
        
        // 5. 注入订阅信息
        const modifiedResponse = handler.injectSubscription();
        
        // 6. 发送通知
        if (appInfo.appName && appInfo.bundleId) {
            env.notify(
                "✨ VIP 已激活 ✨", 
                appInfo.appName, 
                `已成功注入 ${serviceInfo.name} 订阅数据 (${appInfo.bundleId})`,
                appInfo.bundleId
            );
        }
        
        env.log("订阅注入成功");
        env.done({ body: JSON.stringify(modifiedResponse) });
    } catch (err) {
        env.log(`处理失败: ${err.message}`);
        env.notifyError(err, "主函数执行");
        // 返回原始响应，避免出错
        env.done({ body: $response.body });
    }
}

// ================ 内嵌模板区域 ================
// 精简内嵌模板，仅包含必要功能
const TEMPLATES = {
    // Adapty模板 - 精简版
    ADAPTY: {
        // 创建会员信息
        createPremiumInfo: function(productId) {
            return {
                id: "premium",
                is_lifetime: false,
                store: "app_store",
                starts_at: SETTINGS.INJECT.DATES.CURRENT,
                expires_at: SETTINGS.INJECT.DATES.FUTURE,
                will_renew: true,
                is_active: true,
                vendor_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
                vendor_original_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
                vendor_product_id: productId
            };
        },
        
        // 创建收据信息 - 精简版
        createReceiptInfo: function(productId) {
            return {
                quantity: "1",
                purchase_date_ms: Date.now().toString(),
                expires_date: "2088-08-08 08:08:08 Etc/GMT",
                transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
                original_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
                product_id: productId,
                expires_date_ms: "3742762088000"
            };
        },
        
        // 创建分析/购买响应
        createAnalyticsResponse: function(appInfo, productId) {
            const subscriptions = {};
            subscriptions[productId] = this.createPremiumInfo(productId);
            
            return {
                data: {
                    type: "adapty_purchase_app_store_original_transaction_id_validation_result",
                    id: appInfo.profileId,
                    attributes: {
                        profile_id: appInfo.profileId,
                        apple_validation_result: {
                            environment: "Production",
                            transactions: [{
                                productId: productId,
                                originalTransactionId: SETTINGS.INJECT.TRANSACTION.ID,
                                expiresDate: SETTINGS.INJECT.DATES.FUTURE,
                                purchaseDate: SETTINGS.INJECT.DATES.CURRENT,
                                transactionId: SETTINGS.INJECT.TRANSACTION.ID
                            }],
                            bundleId: appInfo.bundleId
                        },
                        subscriptions: subscriptions,
                        paid_access_levels: {
                            premium: this.createPremiumInfo(productId)
                        }
                    }
                }
            };
        },
        
        // 创建收据验证响应
        createReceiptResponse: function(appInfo, productId) {
            const subscriptions = {};
            subscriptions[productId] = this.createPremiumInfo(productId);
            const receiptData = [this.createReceiptInfo(productId)];
            
            return {
                data: {
                    type: "adapty_inapps_apple_receipt_validation_result",
                    id: appInfo.profileId,
                    attributes: {
                        profile_id: appInfo.profileId,
                        apple_validation_result: {
                            environment: "Production",
                            receipt: {
                                receipt_type: "Production",
                                bundle_id: appInfo.bundleId,
                                in_app: receiptData
                            },
                            status: 0,
                            latest_receipt_info: receiptData
                        },
                        subscriptions: subscriptions,
                        paid_access_levels: {
                            premium: this.createPremiumInfo(productId)
                        }
                    }
                }
            };
        }
    },
    
    // Apphud模板 - 精简版
    APPHUD: {
        // 创建订阅对象
        createSubscription: function(product) {
            const { productId, groupId } = product;
            
            return {
                "status": "trial",
                "group_id": groupId,
                "autorenew_enabled": false,
                "id": `sub_${Math.random().toString(36).substring(2, 15)}`,
                "product_id": productId,
                "platform": "ios",
                "environment": "production",
                "started_at": SETTINGS.INJECT.DATES.CURRENT,
                "original_transaction_id": SETTINGS.INJECT.TRANSACTION.ID,
                "expires_at": SETTINGS.INJECT.DATES.FUTURE
            };
        },
        
        // 创建客户权限
        createPermission: function(product) {
            return {
                "id": `perm_${Math.random().toString(36).substring(2, 10)}`,
                "name": product.name,
                "active": true,
                "product_ids": [product.productId],
                "group_ids": [product.groupId]
            };
        }
    },
    
    // SNOW模板
    SNOW: {
        // 产品ID列表
        productList: {
            "iphoneapp.epik": { id: "com.snowcorp.epik.subscribe.plan.oneyear" },  // Epik-AI照片&视频编辑
            "iphoneapp.snow": { id: "com.campmobile.snow.subscribe.oneyear" }      // SNOW-AI写真
        },
        
        // 创建订阅响应
        createSubscriptionResponse: function(appInfo) {
            const times = Date.now();
            
            return {
                result: {
                    "products": [
                        {
                            "managed": true,
                            "status": "ACTIVE",
                            "startDate": times,
                            "productId": appInfo.productId,
                            "expireDate": 3742762088000
                        }
                    ],
                    "tickets": [
                        {
                            "managed": true,
                            "status": "ACTIVE",
                            "startDate": times,
                            "productId": appInfo.productId,
                            "expireDate": 3742762088000
                        }
                    ],
                    "activated": true
                }
            };
        }
    }
};

// 执行主函数
main();
