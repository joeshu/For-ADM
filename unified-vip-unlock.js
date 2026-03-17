/**
 * ==========================================
 * Unified VIP Unlock Manager
 * 统一 VIP 解锁管理器
 * @version 2.0.0
 * @description 插件化架构，支持多应用 VIP 解锁统一管理
 * ==========================================
 * 
 * 【架构设计】
 * 本脚本采用插件化设计，将不同应用的 VIP 解锁逻辑抽象为配置，实现：
 * 1. 新增应用无需修改核心代码，仅需添加配置
 * 2. 统一的字段映射、响应处理、错误处理机制
 * 3. 自动路由识别，支持多应用共用同一文件
 * 
 * 【使用说明】
 * 1. 在 [rewrite_local] 中配置不同应用的规则，指向此统一文件
 * 2. 在下方 APP_CONFIGS 配置区添加新应用配置即可自动生效
 * 3. 脚本会自动根据 URL 识别当前请求对应的应用
 * 
 * 【配置示例】
  [rewrite_local]
 # iAppDaily - 余额查询接口
 ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 # TopHub - 账户同步接口
 ^https:\/\/api2\.tophub\.(today|app)\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/unified-vip-unlock.js
 
 [mitm]
 hostname = api.iappdaily.com, api2.tophub.today, api2.tophub.app
 */

// ==========================================
// 配置区 - 新增应用只需在此添加配置，无需修改下方核心逻辑
// ==========================================

/**
 * 应用配置对象
 * 每个键对应一个应用的配置，包含以下属性：
 * - id: 应用唯一标识（小写，无空格）
 * - name: 应用显示名称（用于日志）
 * - urlPattern: URL 正则表达式，用于自动识别当前请求对应的应用
 * - fields: 需要修改的字段映射表，支持多级路径（如 data.user.vip）
 * - responseWrapper: 响应包装器配置，用于在原始响应为空时构造新响应
 * - customProcessor: 自定义处理函数（可选），用于特殊逻辑处理
 */
const APP_CONFIGS = {
    /**
     * iAppDaily 应用配置
     * 原文件：iappdaily.js
     * 功能：修改余额查询接口，激活 VIP 并增加金币
     */
    iappdaily: {
        // 应用唯一标识
        id: 'iappdaily',
        // 应用显示名称（日志输出用）
        name: 'iAppDaily',
        
        // URL 匹配正则：匹配 api.iappdaily.com/my/balance
        // 用于路由识别，当请求 URL 匹配此正则时，使用本配置
        urlPattern: /api\.iappdaily\.com\/my\/balance/,
        
        /**
         * VIP 字段映射配置
         * 每个字段包含：
         * - path: 字段在 JSON 中的路径，使用点号分隔多级（如 data.is_vip）
         * - value: 要设置的值
         * - type: 数据类型（用于日志显示，可选）
         */
        fields: {
            // VIP 状态标识：1 表示是 VIP
            isVip: { 
                path: 'data.is_vip',      // JSON 路径：根对象 -> data -> is_vip
                value: 1,                  // 设置为 1（启用 VIP）
                type: 'number'             // 数值类型
            },
            // 付费状态标识：1 表示已付费
            isPaid: { 
                path: 'data.is_paid', 
                value: 1, 
                type: 'number' 
            },
            // VIP 过期时间：Unix 时间戳格式
            // 4102444800 = 2099-12-31 00:00:00 UTC（永久 VIP）
            vipExpired: { 
                path: 'data.vip_expired', 
                value: 4102444800, 
                type: 'number' 
            },
            // 剩余金币数量：设置为 9999
            remainCoins: { 
                path: 'data.remain_coins', 
                value: 9999, 
                type: 'number' 
            },
            // 总金币数量：设置为 9999
            totalCoins: { 
                path: 'data.total_coins', 
                value: 9999, 
                type: 'number' 
            }
        },
        
        // 响应包装器：iAppDaily 不需要构造新响应，设置为 null
        // 当原始响应的 data 字段为空时，如果启用 wrapper，会使用模板构造新响应
        responseWrapper: null,
        
        // 自定义处理器：iAppDaily 不需要特殊处理，设置为 null
        // 如需自定义逻辑，可传入函数：function(obj, env) { return modifiedObj; }
        customProcessor: null
    },

    /**
     * TopHub 应用配置
     * 原文件：tophub.js
     * 功能：修改账户同步接口，强制返回永久 VIP 状态
     */
    tophub: {
        id: 'tophub',
        name: 'TopHub',
        
        // URL 匹配正则：匹配 api2.tophub.today 或 api2.tophub.app 的 /account/sync 接口
        urlPattern: /api2\.tophub\.(today|app)\/account\/sync/,
        
        fields: {
            // API 错误码：0 表示成功
            error: { 
                path: 'error', 
                value: 0, 
                type: 'number' 
            },
            // HTTP 状态码：200 表示成功
            status: { 
                path: 'status', 
                value: 200, 
                type: 'number' 
            },
            // VIP 状态：字符串 "1" 表示是 VIP（注意 TopHub 使用字符串类型）
            isVip: { 
                path: 'data.is_vip', 
                value: "1",               // 字符串类型的 "1"
                type: 'string' 
            },
            // 当前 VIP 状态：数值 1 表示当前处于 VIP 状态
            isVipNow: { 
                path: 'data.is_vip_now', 
                value: 1, 
                type: 'number' 
            },
            // VIP 过期时间：字符串格式（与 iAppDaily 的时间戳格式不同）
            vipExpired: { 
                path: 'data.vip_expired', 
                value: "2099-12-31 23:59:59",  // 字符串格式的时间
                type: 'string' 
            },
            // VIP 类型：lifetime 表示永久会员
            vipType: { 
                path: 'data.vip_type', 
                value: "lifetime", 
                type: 'string' 
            },
            // VIP 等级：99 表示最高等级
            vipLevel: { 
                path: 'data.vip_level', 
                value: 99, 
                type: 'number' 
            }
        },
        
        /**
         * 响应包装器配置
         * TopHub 特殊需求：如果原始响应中 data 字段为空或不存在，
         * 需要构造一个全新的 VIP 响应，而不是修改原响应
         */
        responseWrapper: {
            // 启用响应包装功能
            enabled: true,
            // 响应模板：当需要构造新响应时使用此模板
            template: {
                error: 0,                    // 错误码 0（成功）
                status: 200,                 // HTTP 200（成功）
                data: {                      // 数据对象
                    is_vip: "1",             // VIP 状态：是
                    is_vip_now: 1,           // 当前 VIP 状态：是
                    vip_expired: "2099-12-31 23:59:59",  // 过期时间：永久
                    vip_type: "lifetime",    // VIP 类型：永久
                    vip_level: 99            // VIP 等级：99级
                }
            }
        },
        
        // 自定义处理器：TopHub 不需要额外处理，使用默认逻辑即可
        customProcessor: null
    }
    
    // ==========================================
    // 新增应用配置示例（复制此模板并修改）：
    // ==========================================
    // newapp: {
    //     id: 'newapp',                    // 应用唯一标识（英文小写）
    //     name: 'NewApp',                   // 应用显示名称
    //     urlPattern: /api\.newapp\.com\/user\/info/,  // URL 匹配正则
    //     fields: {
    //         // 字段 1：VIP 状态（布尔类型示例）
    //         isVip: { 
    //             path: 'data.user.vip_status',  // 多级路径示例
    //             value: true, 
    //             type: 'boolean' 
    //         },
    //         // 字段 2：过期时间（字符串类型示例）
    //         expireTime: { 
    //             path: 'data.user.vip_expire', 
    //             value: "2099-12-31", 
    //             type: 'string' 
    //         }
    //     },
    //     responseWrapper: null,            // 不需要构造新响应
    //     customProcessor: null             // 不需要自定义处理
    // }
};

// ==========================================
// 常量定义区 - 全局使用的常量值
// ==========================================

/**
 * 常量对象
 * 集中管理所有魔法数值，方便统一修改
 */
const CONSTANTS = {
    // 过期日期字符串格式（用于 TopHub 等需要字符串的场景）
    EXPIRE_DATE: "2099-12-31 23:59:59",
    
    // 过期时间戳（用于 iAppDaily 等需要数值的场景）
    // 4102444800 = 2099-12-31 00:00:00 UTC
    EXPIRE_TIMESTAMP: 4102444800,
    
    // 默认金币/积分数量
    DEFAULT_COINS: 9999,
    
    // 默认 VIP 等级
    DEFAULT_VIP_LEVEL: 99,
    
    // 默认 VIP 类型标识
    DEFAULT_VIP_TYPE: "lifetime"
};

// ==========================================
// 工具类 - Env 兼容层
// 封装 Quantumult X / Surge / Loon 的 API 差异
// ==========================================

/**
 * Env 环境类
 * 提供跨平台（QX/Surge/Loon）的兼容封装
 * 统一日志输出和脚本结束处理
 */
class Env {
    /**
     * 构造函数
     * @param {string} name - 脚本名称（用于日志标识）
     */
    constructor(name) {
        this.name = name;
        
        // 检测当前运行环境
        // isQX: Quantumult X（有 $task 对象）
        this.isQX = typeof $task !== 'undefined';
        
        // isSurge: Surge（有 $httpClient 且无 $task）
        this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
        
        // isLoon: Loon（有 $loon 对象）
        this.isLoon = typeof $loon !== 'undefined';
        
        // 记录当前环境（调试用）
        // console.log(`Environment detected: QX=${this.isQX}, Surge=${this.isSurge}, Loon=${this.isLoon}`);
    }

    /**
     * 输出日志
     * 统一格式：[脚本名] 日志内容
     * @param {string} msg - 日志消息
     */
    log(msg) {
        console.log(`[${this.name}] ${msg}`);
    }

    /**
     * 结束脚本执行
     * 封装不同平台的 $done() 调用
     * @param {object} object - 返回给代理工具的对象（包含修改后的 body）
     */
    done(object) {
        $done(object);
    }

    /**
     * 获取响应对象
     * 封装 $response 的获取（部分平台可能有差异）
     * @returns {object} 响应对象，包含 body、url、headers 等
     */
    getResponse() {
        return $response || {};
    }
}

// ==========================================
// 工具函数库 - 通用工具方法
// ==========================================

/**
 * Utils 工具对象
 * 提供 JSON 处理、对象操作、路径解析等通用功能
 */
const Utils = {
    /**
     * 安全解析 JSON 字符串
     * 避免解析错误导致脚本崩溃
     * 
     * @param {string} str - 要解析的 JSON 字符串
     * @param {object} defaultVal - 解析失败时的默认值（默认为空对象）
     * @returns {object} 解析后的对象，或默认值
     */
    safeJsonParse(str, defaultVal = {}) {
        try {
            return JSON.parse(str);
        } catch (e) {
            // 解析失败时输出错误日志，返回默认值
            console.log(`JSON parse error: ${e}`);
            return defaultVal;
        }
    },

    /**
     * 安全序列化为 JSON 字符串
     * 避免循环引用等导致的序列化错误
     * 
     * @param {object} obj - 要序列化的对象
     * @returns {string} JSON 字符串，失败时返回 '{}'
     */
    safeJsonStringify(obj) {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            console.log(`JSON stringify error: ${e}`);
            return '{}';
        }
    },

    /**
     * 根据路径获取对象值
     * 支持多级路径，如 'data.user.vip.status'
     * 
     * @param {object} obj - 源对象
     * @param {string} path - 路径字符串，使用点号分隔
     * @returns {any} 路径对应的值，不存在则返回 undefined
     */
    getValueByPath(obj, path) {
        // 将路径按点号分割为数组，逐级访问
        return path.split('.').reduce((acc, part) => {
            // 如果当前层级存在，进入下一层；否则返回 undefined
            return acc && acc[part] !== undefined ? acc[part] : undefined;
        }, obj);
    },

    /**
     * 根据路径设置对象值
     * 自动创建不存在的中间对象，支持多级路径
     * 
     * @param {object} obj - 目标对象
     * @param {string} path - 路径字符串，使用点号分隔
     * @param {any} value - 要设置的值
     * @returns {object} 修改后的对象（方便链式调用）
     */
    setValueByPath(obj, path, value) {
        // 将路径分割为数组
        const parts = path.split('.');
        let current = obj;
        
        // 遍历除最后一级外的所有路径部分
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            
            // 如果当前部分不存在，创建一个空对象
            if (!(part in current)) {
                current[part] = {};
            }
            
            // 进入下一层
            current = current[part];
        }
        
        // 设置最后一级的值
        current[parts[parts.length - 1]] = value;
        return obj;
    },

    /**
     * 检测当前请求匹配哪个应用配置
     * 通过 URL 正则匹配来识别应用类型
     * 
     * @param {string} url - 当前请求的 URL
     * @param {object} configs - 应用配置对象（APP_CONFIGS）
     * @returns {object|null} 匹配的应用配置，未匹配则返回 null
     */
    detectApp(url, configs) {
        // 遍历所有配置，检查 URL 是否匹配正则
        for (const key in configs) {
            if (configs[key].urlPattern && configs[key].urlPattern.test(url)) {
                return configs[key];
            }
        }
        // 无匹配时返回 null，主逻辑会使用兜底方案
        return null;
    }
};

// ==========================================
// VIP 解锁核心引擎
// 处理 VIP 字段修改、响应包装等核心逻辑
// ==========================================

/**
 * VipUnlockEngine VIP 解锁引擎
 * 负责执行具体的 VIP 解锁逻辑，包括字段映射、响应构造等
 */
class VipUnlockEngine {
    /**
     * 构造函数
     * @param {Env} env - 环境对象（用于日志和结束脚本）
     */
    constructor(env) {
        this.env = env;           // 保存环境对象
        this.config = null;       // 当前应用配置（通过 setConfig 设置）
    }

    /**
     * 设置当前应用配置
     * 在开始处理前调用，指定使用哪个应用的配置规则
     * 
     * @param {object} config - 应用配置对象（来自 APP_CONFIGS）
     */
    setConfig(config) {
        this.config = config;
        this.env.log(`Initialized for: ${config.name}`);
    }

    /**
     * 执行 VIP 解锁主流程
     * 解析响应 -> 检查包装器 -> 应用字段映射 -> 执行自定义处理 -> 返回结果
     * 
     * @param {object} response - 代理工具传入的响应对象，包含 body 等
     * @returns {object} 处理结果，包含修改后的 body
     */
    process(response) {
        // 检查响应是否存在且包含 body
        if (!response || !response.body) {
            this.env.log('No response body found');
            return {};
        }

        // 获取响应体文本
        let body = response.body;
        
        // 安全解析 JSON
        let obj = Utils.safeJsonParse(body);

        // 检查解析结果是否有效
        if (!obj || Object.keys(obj).length === 0) {
            this.env.log('Failed to parse response body');
            return { body };
        }

        // 步骤 1：检查是否需要构造新响应（Response Wrapper）
        // 某些应用（如 TopHub）在 data 为空时需要构造全新响应，而不是修改原响应
        if (this.config.responseWrapper && this.config.responseWrapper.enabled) {
            // 检查当前响应中 data 字段是否存在且非空
            const hasData = Utils.getValueByPath(obj, 'data');
            
            // 如果 data 为空或不存在，使用模板构造新响应
            if (!hasData || Object.keys(hasData).length === 0) {
                this.env.log('Data empty, creating new VIP response from template');
                obj = this.config.responseWrapper.template;
            }
        }

        // 步骤 2：应用字段映射（核心 VIP 修改逻辑）
        this.applyFieldMapping(obj);

        // 步骤 3：执行自定义处理器（如果有配置）
        // 用于处理特殊逻辑，如额外字段计算、条件判断等
        if (this.config.customProcessor && typeof this.config.customProcessor === 'function') {
            obj = this.config.customProcessor(obj, this.env);
        }

        // 记录成功日志
        this.env.log(`VIP unlocked for ${this.config.name}`);
        
        // 返回修改后的响应体（序列化为 JSON 字符串）
        return { body: Utils.safeJsonStringify(obj) };
    }

    /**
     * 应用字段映射
     * 遍历配置中的所有字段，按路径设置对应值
     * 
     * @param {object} obj - 响应对象（会被直接修改）
     */
    applyFieldMapping(obj) {
        const fields = this.config.fields;
        
        // 遍历字段配置中的所有键值对
        for (const key in fields) {
            const field = fields[key];
            
            // 获取当前路径的现有值（用于判断是否存在）
            const currentValue = Utils.getValueByPath(obj, field.path);
            
            // 判断路径是否已存在（存在则修改，不存在则创建）
            if (currentValue !== undefined || this.pathExists(obj, field.path)) {
                // 路径存在：修改现有值
                Utils.setValueByPath(obj, field.path, field.value);
                this.env.log(`Modified ${field.path} = ${JSON.stringify(field.value)}`);
            } else {
                // 路径不存在：创建新路径并设置值
                Utils.setValueByPath(obj, field.path, field.value);
                this.env.log(`Created ${field.path} = ${JSON.stringify(field.value)}`);
            }
        }
    }

    /**
     * 检查路径是否存在（不检查值是否为 undefined）
     * 用于区分 "值是 undefined" 和 "路径不存在" 两种情况
     * 
     * @param {object} obj - 源对象
     * @param {string} path - 路径字符串
     * @returns {boolean} 路径是否存在
     */
    pathExists(obj, path) {
        const parts = path.split('.');
        let current = obj;
        
        // 逐级检查路径是否存在
        for (const part of parts) {
            // 如果当前层级为 null/undefined，或不存在该属性，返回 false
            if (current === null || current === undefined || !(part in current)) {
                return false;
            }
            // 进入下一层
            current = current[part];
        }
        // 所有层级都存在
        return true;
    }
}

// ==========================================
// 插件管理器
// 管理所有应用配置的注册和检索
// ==========================================

/**
 * PluginManager 插件管理器
 * 负责应用配置的注册、存储和自动检测
 */
class PluginManager {
    /**
     * 构造函数
     * 初始化存储结构
     */
    constructor() {
        // 使用 Map 存储插件配置，键为应用 ID，值为配置对象
        this.plugins = new Map();
    }

    /**
     * 注册插件（应用配置）
     * 
     * @param {string} id - 应用唯一标识
     * @param {object} config - 应用配置对象
     */
    register(id, config) {
        this.plugins.set(id, config);
        console.log(`Plugin registered: ${config.name}`);
    }

    /**
     * 获取指定 ID 的插件配置
     * 
     * @param {string} id - 应用 ID
     * @returns {object|undefined} 应用配置对象
     */
    getConfig(id) {
        return this.plugins.get(id);
    }

    /**
     * 自动检测当前请求对应的应用配置
     * 优先通过 URL 匹配，失败时通过响应结构特征匹配
     * 
     * @param {string} url - 当前请求的 URL
     * @returns {object|null} 匹配的应用配置
     */
    autoDetect(url) {
        // 方法 1：通过 URL 正则匹配（主要方式）
        // 将 Map 转换为普通对象供 Utils.detectApp 使用
        const detected = Utils.detectApp(url, Object.fromEntries(this.plugins));
        if (detected) return detected;

        // 方法 2：通过响应结构特征检测（兜底方案）
        // 当 URL 匹配失败时，尝试根据响应内容推断应用类型
        return this.detectByResponseStructure();
    }

    /**
     * 通过响应结构特征检测应用类型（高级功能）
     * 用于 URL 匹配失败时的兜底识别
     * 
     * @returns {null} 当前版本预留，返回 null 使用通用配置
     */
    detectByResponseStructure() {
        // 预留功能：可根据响应中的特定字段（如 iAppDaily 有 coins 字段，TopHub 有 tophub 特有字段）
        // 来推断应用类型。当前版本返回 null，由主逻辑使用通用配置。
        return null;
    }

    /**
     * 批量初始化应用配置
     * 将 APP_CONFIGS 中的所有配置注册到管理器
     * 
     * @param {object} configs - 配置对象（APP_CONFIGS）
     */
    initConfigs(configs) {
        for (const key in configs) {
            this.register(key, configs[key]);
        }
    }
}

// ==========================================
// 主入口函数
// 脚本执行起点，协调各模块工作
// ==========================================

/**
 * main 主函数
 * 脚本执行流程：
 * 1. 初始化环境和插件管理器
 * 2. 加载所有应用配置
 * 3. 检测当前请求对应的应用
 * 4. 创建引擎并执行 VIP 解锁
 * 5. 返回修改后的响应
 */
function main() {
    // 步骤 1：初始化环境对象（用于日志和脚本控制）
    const env = new Env('UnifiedVIP');
    
    // 步骤 2：初始化插件管理器
    const pluginManager = new PluginManager();
    
    // 步骤 3：加载所有预定义的应用配置
    pluginManager.initConfigs(APP_CONFIGS);

    // 步骤 4：获取当前请求的响应信息和 URL
    const response = env.getResponse();
    // 从响应对象或请求对象中获取 URL（不同平台可能位置不同）
    const requestUrl = response.url || (typeof $request !== 'undefined' ? $request.url : '');

    // 步骤 5：自动检测当前请求对应的应用配置
    let appConfig = pluginManager.autoDetect(requestUrl);

    // 步骤 6：如果 URL 检测失败，尝试通过脚本名称推断（备用方案）
    if (!appConfig) {
        // 某些代理工具允许在脚本 URL 后添加 #id 参数指定应用
        // 例如：script-response-body https://.../unified-vip.js#iappdaily
        const scriptTag = (typeof $script !== 'undefined' && $script.name) ? $script.name : '';
        
        if (scriptTag.includes('iappdaily')) {
            appConfig = pluginManager.getConfig('iappdaily');
        } else if (scriptTag.includes('tophub')) {
            appConfig = pluginManager.getConfig('tophub');
        }
    }

    // 步骤 7：如果仍无法确定应用类型，使用通用 VIP 配置（兜底方案）
    if (!appConfig) {
        env.log('Could not detect app type, using generic VIP unlock');
        
        // 通用配置：仅修改最常见的 VIP 字段
        appConfig = {
            name: 'Generic',
            fields: {
                // 通用的 VIP 状态字段
                isVip: { 
                    path: 'data.is_vip', 
                    value: 1, 
                    type: 'number' 
                },
                // 通用的过期时间字段（使用时间戳格式）
                vipExpired: { 
                    path: 'data.vip_expired', 
                    value: CONSTANTS.EXPIRE_TIMESTAMP, 
                    type: 'number' 
                }
            },
            responseWrapper: null,
            customProcessor: null
        };
    }

    // 步骤 8：创建 VIP 解锁引擎并设置配置
    const engine = new VipUnlockEngine(env);
    engine.setConfig(appConfig);
    
    // 步骤 9：执行 VIP 解锁处理
    const result = engine.process(response);
    
    // 步骤 10：返回修改后的响应给代理工具
    env.done(result);
}

// ==========================================
// 脚本执行入口
// ==========================================

// 立即执行主函数，开始处理请求
main();
