/*
📜 adapty-动态解锁 VIP 脚本
📅 更新时间：2025-03-14
🔓 功能：自动获取应用信息并解锁永久 VIP

[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty2.js
 
[mitm]
hostname = api.adapty.io
*/

// ================ 配置区域 ================
const SETTINGS = {
    // 调试日志开关
    DEBUG_LOG: true,
    
    // 通知设置
    NOTIFICATION: {
        ENABLED: true,            // 通知开关
        INTERVAL: 10 * 60 * 1000, // 同一应用通知间隔(毫秒)：10分钟
    },
    
    // 注入模式
    INJECT: {
        // 日期配置
        DATES: {
            CURRENT: "2024-04-04T04:04:04.000000+0000",
            FUTURE: "2088-08-08T08:08:08.000000+0000"
        },
        // 交易ID配置
        TRANSACTION: {
            ID: "490001271881589"
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
        if (appId) {
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
    
    done(value = {}) {
        const costTime = (Date.now() - this.startTime) / 1000;
        this.log(`执行完毕，用时 ${costTime}s`);
        $done(value);
    }
}

// 创建环境实例
const env = new Env("AdaptyAuto");

// 响应处理类
class ResponseHandler {
    constructor(response, request) {
        this.response = JSON.parse(response.body || "{}");
        this.request = request;
        this.headers = request?.headers || {};
        this.url = request?.url || "";
    }
    
    // 获取应用信息
    getAppInfo() {
        // 从请求头提取 User-Agent
        const ua = this.headers["User-Agent"] || this.headers["user-agent"] || "";
        // 提取应用名称 - 通常是 User-Agent 的第一部分
        const appName = ua.split("/")[0].trim();
        
        // 从请求头获取 SDK Profile ID
        const profileId = this.headers["adapty-sdk-profile-id"] || this.headers["ADAPTY-SDK-PROFILE-ID"] || "";
        
        // 尝试从 URL 或响应数据中获取 Bundle ID
        let bundleId = this.extractBundleId();
        
        env.log(`应用名称: ${appName}`);
        env.log(`Profile ID: ${profileId}`);
        env.log(`Bundle ID: ${bundleId}`);
        
        return {
            appName,
            profileId,
            bundleId
        };
    }
    
    // 从各种可能的来源提取 Bundle ID
    extractBundleId() {
        // 尝试从响应数据中提取
        if (this.response?.data?.attributes?.apple_validation_result?.bundleId) {
            return this.response.data.attributes.apple_validation_result.bundleId;
        }
        
        if (this.response?.data?.attributes?.apple_validation_result?.receipt?.bundle_id) {
            return this.response.data.attributes.apple_validation_result.receipt.bundle_id;
        }
        
        // 如果找不到，生成一个默认 Bundle ID（基于 Profile ID）
        if (this.headers["adapty-sdk-profile-id"]) {
            const parts = this.headers["adapty-sdk-profile-id"].split('$');
            if (parts.length > 1) {
                return parts[0]; // 通常 ProfileID 的前部分是 Bundle ID
            }
        }
        
        // 最后的备选项
        return "com.adapty.app";
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
    
    // 创建会员信息
    createPremiumInfo(productId) {
        return {
            id: "premium",
            is_lifetime: false,
            store: "app_store",
            starts_at: SETTINGS.INJECT.DATES.CURRENT,
            expires_at: SETTINGS.INJECT.DATES.FUTURE,
            will_renew: true,
            is_active: true,
            is_in_grace_period: false,
            activated_at: SETTINGS.INJECT.DATES.CURRENT,
            renewed_at: SETTINGS.INJECT.DATES.CURRENT,
            is_refund: false,
            vendor_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
            vendor_original_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
            vendor_product_id: productId,
            is_sandbox: false,
            active_introductory_offer_type: "trial"
        };
    }
    
    // 创建收据信息
    createReceiptInfo(productId) {
        return {
            quantity: "1",
            purchase_date_ms: "1712174644000",
            expires_date: "2088-08-08 08:08:08 Etc/GMT",
            is_in_intro_offer_period: "false",
            transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
            is_trial_period: "true",
            original_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
            purchase_date: "2024-04-04 04:04:04 Etc/GMT",
            product_id: productId,
            in_app_ownership_type: "PURCHASED",
            original_purchase_date_ms: "1712174644000",
            expires_date_ms: "3742762088000"
        };
    }
    
    // 注入订阅信息
    injectSubscription() {
        const appInfo = this.getAppInfo();
        const productId = this.extractProductId();
        
        // 创建订阅数据
        let subscriptions = {};
        subscriptions[productId] = this.createPremiumInfo(productId);
        
        // 创建收据数据
        const receiptData = [this.createReceiptInfo(productId)];
        
        // 根据请求 URL 路径处理不同类型的请求
        if (/(analytics\/profiles|purchase\/app-store)/.test(this.url)) {
            env.log("处理分析/购买请求");
            return {
                data: {
                    type: "adapty_purchase_app_store_original_transaction_id_validation_result",
                    id: appInfo.profileId,
                    attributes: {
                        profile_id: appInfo.profileId,
                        is_test_user: false,
                        segment_hash: "8245f974014fdf4c",
                        timestamp: Date.now(),
                        apple_validation_result: {
                            environment: "Production",
                            revision: "1726387136000_490001234567890_4",
                            appAppleId: 1560806510,
                            transactions: [{
                                productId: productId,
                                storefront: "CHN",
                                originalTransactionId: SETTINGS.INJECT.TRANSACTION.ID,
                                expiresDate: "2088-08-08T08:08:08Z",
                                subscriptionGroupIdentifier: "20459405",
                                purchaseDate: "2024-04-04T04:04:04Z",
                                price: 0,
                                transactionId: SETTINGS.INJECT.TRANSACTION.ID,
                                currency: "CNY",
                                inAppOwnershipType: "PURCHASED"
                            }],
                            hasMore: false,
                            bundleId: appInfo.bundleId
                        },
                        subscriptions: subscriptions,
                        paid_access_levels: {
                            premium: this.createPremiumInfo(productId)
                        }
                    }
                }
            };
        }
        
        // 处理收据验证请求
        if (/(receipt\/validate|purchase-containers)/.test(this.url)) {
            env.log("处理收据验证请求");
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
                                in_app: receiptData,
                                original_purchase_date: "2024-04-04T04:04:04 Etc/GMT",
                                adam_id: 1560806510,
                                request_date: "2024-04-04T04:04:04 Etc/GMT",
                                request_date_ms: "1712174644000",
                                application_version: "1",
                                original_application_version: "1"
                            },
                            status: 0,
                            pending_renewal_info: [{
                                expiration_intent: "1",
                                product_id: productId,
                                is_in_billing_retry_period: "0",
                                auto_renew_product_id: productId,
                                original_transaction_id: SETTINGS.INJECT.TRANSACTION.ID,
                                auto_renew_status: "0"
                            }],
                            latest_receipt_info: receiptData,
                            latest_receipt: "adapty"
                        },
                        subscriptions: subscriptions,
                        paid_access_levels: {
                            premium: this.createPremiumInfo(productId)
                        }
                    }
                }
            };
        }
        
        // 默认返回原始响应
        return this.response;
    }
}

// 主函数
function main() {
    try {
        env.log("开始处理 Adapty 请求");
        
        // 创建响应处理器
        const handler = new ResponseHandler($response, $request);
        const appInfo = handler.getAppInfo();
        
        // 注入订阅
        const modifiedResponse = handler.injectSubscription();
        
        // 发送通知
        if (appInfo.appName && appInfo.bundleId) {
            // 使用 Bundle ID 作为通知键，避免频繁通知
            env.notify(
                "✨ VIP 已激活 ✨", 
                appInfo.appName, 
                `已成功注入订阅数据 (${appInfo.bundleId})`,
                appInfo.bundleId
            );
        }
        
        // 返回修改后的响应
        env.log("订阅注入成功");
        env.done({ body: JSON.stringify(modifiedResponse) });
    } catch (err) {
        env.log(`处理失败: ${err.message}`);
        // 返回原始响应，避免出错
        env.done({ body: $response.body });
    }
}

// 执行主函数
main();