/**
 * ==========================================
 * Unified VIP Unlock Manager v13.3.0
 * 统一 VIP 解锁管理器 - 完全声明式优化版（详细注释版）
 * @version 13.3.0
 * @description 所有配置统一使用声明式处理器，消除自定义函数
 * ==========================================
 * 
 * 【使用说明】
 * 1. 本脚本采用声明式编程风格，所有数据处理通过组合处理器完成
 * 2. 处理器位于 ProcessorUtils 对象中，可自由组合使用
 * 3. 新增配置只需在 APP_CONFIGS 中添加，遵循声明式风格
 * 
 * 【处理器组合示例】
 * customProcessor: ProcessorUtils.compose(
 *     ProcessorUtils.setFields({...}),      // 设置字段
 *     ProcessorUtils.mapArray('data', {...}), // 修改数组
 *     ProcessorUtils.filterArray('items', {...}) // 过滤数组
 * )
 * 
[rewrite_local]
 # iAppDaily - 余额查询接口（JSON模式-声明式字段设置）
 ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # TopHub - 账户同步接口（JSON模式-声明式组合）
 ^https?:\/\/(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # gps - GPS工具箱（JSON模式-声明式字段设置）
 ^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # kyxq - 口语星球（JSON模式-声明式场景分发）
 ^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # mhlz - 魔幻粒子（JSON模式-声明式前缀处理）
 ^https?:\/\/ss\.landintheair\.com\/storage\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # v2ex - V2EX去广告（HTML替换模式）
 ^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf))))) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # foday - 复游会去广告（多路径模式-声明式过滤）
 ^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # qiujingapp - 球竞APP去广告（多路径模式-声明式清空）
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(3|6|8|11)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # Keep - 课程/会员接口（正则替换模式）
 ^https?:\/\/(api|kit).gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # bqwz - 标枪王者游戏数据接口（游戏数值模式）
 ^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # bxkt - 伴学课堂接口（混合模式-声明式组合）
 ^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # tv - 影视去广告接口（多路径模式-完全声明式）
 ^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getSearchAd|getVodBodyAd|getVodPauseAd|getUserCenterAd) url reject-dict
 ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(home\/notice|gameCenter\/gameDetailList) url reject-dict
 # 成语来解压 - 微信小程序无限金币（游戏数值模式）
 ^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
 # 星际使命 - 微信小程序游戏数据修改（JSON声明式处理器-完全重构）
 ^https?:\/\/star\.jvplay\.cn\/v2\/storage url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js
# wohome - 联通智家去广告（条件删除模式）
 ^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v6.js

 [mitm]
 hostname = api.iappdaily.com, api2.tophub.today, api2.tophub.app, api3.tophub.xyz, api3.tophub.today, api3.tophub.app, tophub.tophubdata.com, tophub2.tophubdata.com, tophub.idaily.today, tophub2.idaily.today, tophub.remai.today, tophub.iappdaiy.com, tophub.ipadown.com,service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com,api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com,yr-game-api.feigo.fun,star.jvplay.cn,iotpservice.smartont.net
 */
'use strict';

// ==========================================
// 元数据与配置
// ==========================================

/**
 * META - 脚本元数据
 * @property {string} name - 脚本名称，用于日志标识
 * @property {string} version - 版本号，主版本.次版本.修订版本
 * @property {string} author - 作者信息
 * @property {string} description - 脚本描述
 * @property {string} updated - 最后更新日期
 */
const META = {
    name: 'UnifiedVIP',
    version: '13.3.0',
    author: 'joeshu & contributors',
    description: 'Unified VIP Unlock Manager - Fully Declarative',
    updated: '2026-03-19'
};

// ==========================================
// 常量定义区
// ==========================================

/**
 * CONSTANTS - 全局常量定义
 * 所有配置共享的常量值，使用 Object.freeze 防止意外修改
 * 
 * 使用示例：
 * 'data.vip_expire': CONSTANTS.EXPIRE_DATE
 */
const CONSTANTS = Object.freeze({
    EXPIRE_DATE: "2099-12-31 23:59:59",           // VIP过期日期字符串
    EXPIRE_TIMESTAMP: 4102444800,                 // VIP过期时间戳（秒）
    EXPIRE_TIMESTAMP_MS: 4102416000000,            // VIP过期时间戳（毫秒）
    BIG_NUMBER_STR: "99999999988888888",           // 大数字字符串（用于金币等）
    DEFAULT_COINS: 9999,                           // 默认金币数
    DEFAULT_VIP_LEVEL: 99,                         // 默认VIP等级
    DEFAULT_VIP_TYPE: "lifetime",                  // 默认VIP类型
    STATUS_SUCCESS: 200,                           // HTTP成功状态码
    STATUS_OK: 0,                                  // 业务成功状态码
    TARGET_GAME_VALUE: 999988990,                   // 游戏数值修改目标值
    WEAPON_IDS: Object.freeze([                    // 星际使命武器ID列表
        "1100", "1101", "1102", "1103", "1104", 
        "1105", "1106", "1107", "1108", "1109", "1110"
    ]),
    MODES: Object.freeze({                         // 处理器模式枚举
        JSON: 'json',                              // 数据处理模式
        REGEX: 'regex',                            // 正则替换模式
        GAME: 'game',                              // 游戏数值修改模式
        HYBRID: 'hybrid',                          // 混合模式（JSON+正则）
        MULTIPATH: 'multipath',                    // 多路径处理模式
        HTML: 'html'                               // HTML替换模式
    })
});

// ==========================================
// 全局配置开关
// ==========================================

/**
 * GLOBAL_CONFIG - 全局配置开关
 * 控制脚本的全局行为
 * 
 * DEBUG: 是否开启调试日志（true=显示所有日志，false=只显示info及以上）
 * ENABLE_CACHE: 是否启用正则表达式缓存
 * MAX_CACHE_SIZE: 最大缓存条目数
 */
const GLOBAL_CONFIG = Object.freeze({
    DEBUG: true,                                  // 生产环境建议设为false
    ENABLE_CACHE: true,                            // 启用缓存提升性能
    MAX_CACHE_SIZE: 100                            // 缓存上限，防止内存泄漏
});

// ==========================================
// 配置验证 Schema
// ==========================================

/**
 * CONFIG_SCHEMA - 配置验证模式
 * 用于验证 APP_CONFIGS 中的每个配置是否合法
 * 
 * 验证规则：
 * 1. 所有配置必须有 id, name, urlPattern
 * 2. 不同 mode 需要不同的必填字段
 */
const CONFIG_SCHEMA = {
    required: ['id', 'name', 'urlPattern'],        // 所有模式通用必填字段
    modes: {
        json: {
            // JSON模式：可选字段映射、响应包装器、自定义处理器
            optional: ['fields', 'responseWrapper', 'customProcessor']
        },
        regex: {
            // 正则模式：必须有正则替换规则数组
            required: ['regexReplacements']
        },
        game: {
            // 游戏模式：必须有游戏资源配置数组
            required: ['gameResources']
        },
        hybrid: {
            // 混合模式：必须同时有自定义处理器和正则替换
            required: ['customProcessor', 'regexReplacements']
        },
        multipath: {
            // 多路径模式：必须有路径处理器数组
            required: ['pathHandlers']
        },
        html: {
            // HTML模式：必须有HTML替换规则数组
            required: ['htmlReplacements']
        }
    }
};

// ==========================================
// 声明式处理器工具库（核心 - v3.0详细注释版）
// ==========================================

/**
 * ProcessorUtils - 声明式处理器工具库
 * 
 * 【设计理念】
 * 每个处理器都是一个高阶函数，返回一个处理函数(obj, env) => obj
 * 处理器可以组合使用，通过 compose 函数串联多个处理步骤
 * 
 * 【使用范式】
 * 1. 单一处理器：customProcessor: ProcessorUtils.setFields({...})
 * 2. 组合处理器：customProcessor: ProcessorUtils.compose(
 *        ProcessorUtils.setFields({...}),
 *        ProcessorUtils.mapArray('data', {...})
 *    )
 * 3. 条件处理器：customProcessor: ProcessorUtils.when(
 *        (obj) => obj.code === 200,
 *        ProcessorUtils.setFields({...})
 *    )
 */
const ProcessorUtils = {
    
    /**
     * setFields - 声明式字段批量设置处理器
     * 
     * 【功能】批量设置对象中的字段值，支持动态值函数
     * 
     * 【参数】
     * @param {Object} fieldsMap - 字段映射对象
     *   - key: 字段路径（支持嵌套，如 'data.user.vip'）
     *   - value: 字段值（可以是具体值或函数(obj) => value）
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 示例1：设置固定值
     * ProcessorUtils.setFields({
     *     'data.is_vip': 1,
     *     'data.vip_expire': '2099-12-31'
     * })
     * 
     * // 示例2：动态值（根据原对象计算）
     * ProcessorUtils.setFields({
     *     'data.vipLevel': (obj) => obj.data?.level ? obj.data.level * 10 : 99
     * })
     * 
     * // 示例3：混合使用
     * ProcessorUtils.setFields({
     *     'data.status': 200,
     *     'data.message': (obj) => `Welcome, ${obj.data?.username || 'Guest'}`
     * })
     */
    setFields(fieldsMap) {
        return function(obj, env) {
            let modified = 0;
            for (const [path, value] of Object.entries(fieldsMap)) {
                // 如果值是函数，则调用函数获取实际值；否则直接使用
                const actualValue = typeof value === 'function' ? value(obj) : value;
                if (actualValue !== undefined) {
                    Utils.setValueByPath(obj, path, actualValue);
                    modified++;
                }
            }
            if (modified > 0 && env) {
                env.debug(`SetFields: modified ${modified} fields`);
            }
            return obj;
        };
    },

    /**
     * mapArray - 声明式数组批量修改处理器
     * 
     * 【功能】遍历数组中的每个元素，批量修改指定字段
     * 
     * 【参数】
     * @param {string} arrayPath - 数组路径（如 'data.items'）
     * @param {Object} fieldMap - 字段映射对象 {字段名: 新值}
     * @param {Function} [condition] - 可选条件函数 (item, index) => boolean
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 示例1：修改所有元素的status字段
     * ProcessorUtils.mapArray('data.courses', {
     *     status: 1,
     *     isVip: true
     * })
     * 
     * // 示例2：只修改满足条件的元素
     * ProcessorUtils.mapArray('data.items', {
     *     isLock: false
     * }, (item) => item.type === 'video')  // 只修改type为video的项
     */
    mapArray(arrayPath, fieldMap, condition = null) {
        return function(obj, env) {
            const arr = Utils.getValueByPath(obj, arrayPath);
            if (!Array.isArray(arr)) {
                env?.warn(`MapArray: ${arrayPath} is not an array`);
                return obj;
            }

            let modified = 0;
            arr.forEach((item, index) => {
                if (!item) return;
                // 如果提供了条件函数，只有满足条件才修改
                if (condition && !condition(item, index)) return;

                for (const [field, value] of Object.entries(fieldMap)) {
                    if (item[field] !== undefined || value !== undefined) {
                        item[field] = value;
                    }
                }
                modified++;
            });

            if (env) env.debug(`MapArray: modified ${modified}/${arr.length} items in ${arrayPath}`);
            return obj;
        };
    },

    /**
     * filterArray - 声明式数组过滤处理器
     * 
     * 【功能】根据条件过滤数组元素，支持黑名单或自定义条件
     * 
     * 【参数】
     * @param {string} arrayPath - 数组路径
     * @param {Object} options - 配置选项
     *   - excludeSet: Set对象，包含要排除的key值（需配合keyExtractor）
     *   - keyExtractor: 函数，从item中提取key用于匹配excludeSet
     *   - keepPredicate: 函数，返回true保留，false删除（item, index）=> boolean
     *   - logName: 日志中显示的名称
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 示例1：使用黑名单过滤（排除特定code的广告组件）
     * ProcessorUtils.filterArray('data.pageComponents', {
     *     excludeSet: new Set(["AD_001", "AD_002"]),
     *     keyExtractor: (item) => item.componentCode,
     *     logName: 'pageComponents'
     * })
     * 
     * // 示例2：使用条件函数过滤（只保留status=1的项）
     * ProcessorUtils.filterArray('data.items', {
     *     keepPredicate: (item) => item.status === 1,
     *     logName: 'activeItems'
     * })
     */
    filterArray(arrayPath, options = {}) {
        const { excludeSet, keyExtractor, keepPredicate, logName } = options;

        return function(obj, env) {
            const arr = Utils.getValueByPath(obj, arrayPath);
            if (!Array.isArray(arr)) {
                env?.warn(`FilterArray: ${arrayPath} is not an array`);
                return obj;
            }

            const originalLength = arr.length;
            let filtered;

            if (excludeSet && keyExtractor) {
                // 黑名单模式：排除在excludeSet中的项
                filtered = arr.filter(item => !excludeSet.has(keyExtractor(item)));
            } else if (keepPredicate) {
                // 条件模式：只保留满足条件的项
                filtered = arr.filter(keepPredicate);
            } else {
                return obj;
            }

            Utils.setValueByPath(obj, arrayPath, filtered);

            if (env) {
                const name = logName || arrayPath;
                env.log(`Filtered ${name}: ${originalLength} -> ${filtered.length}`);
            }
            return obj;
        };
    },

    /**
     * clearArray - 清空数组处理器
     * 
     * 【功能】清空指定路径的数组（长度置为0）
     * 
     * 【参数】
     * @param {string} arrayPath - 数组路径
     * @param {Object} [options] - 可选配置
     *   - logName: 日志显示名称
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 清空广告数组
     * ProcessorUtils.clearArray('data.ads', { logName: 'advertisements' })
     * // 日志输出: Cleared advertisements: 5 items
     */
    clearArray(arrayPath, options = {}) {
        return function(obj, env) {
            const arr = Utils.getValueByPath(obj, arrayPath);
            if (Array.isArray(arr)) {
                const count = arr.length;
                arr.length = 0;  // 清空数组的高效方式
                if (env) env.log(`Cleared ${options.logName || arrayPath}: ${count} items`);
            }
            return obj;
        };
    },

    /**
     * sliceArray - 数组切片处理器（保留前N个）
     * 
     * 【功能】截取数组前N个元素，丢弃后面的
     * 
     * 【参数】
     * @param {string} arrayPath - 数组路径
     * @param {number} keepCount - 保留的元素数量
     * @param {string} [logName] - 日志显示名称
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 只保留热门模块前5个
     * ProcessorUtils.sliceArray('data.hotModules', 5, 'hotModules')
     * // 原数组10个 -> 保留前5个，丢弃后5个
     */
    sliceArray(arrayPath, keepCount, logName = null) {
        return function(obj, env) {
            const arr = Utils.getValueByPath(obj, arrayPath);
            if (Array.isArray(arr) && arr.length > keepCount) {
                const original = arr.length;
                Utils.setValueByPath(obj, arrayPath, arr.slice(0, keepCount));
                env?.log(`Sliced ${logName || arrayPath}: ${original} -> ${keepCount}`);
            }
            return obj;
        };
    },

    /**
     * shiftArray - 数组移位处理器（移除第一个元素）
     * 
     * 【功能】移除数组的第一个元素（常用于去除列表首个广告）
     * 
     * 【参数】
     * @param {string} arrayPath - 数组路径
     * @param {string} [logName] - 日志显示名称
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 移除广告列表第一个广告
     * ProcessorUtils.shiftArray('data.adList', 'first ad')
     * // 日志输出: Shifted first ad: removed 开屏广告
     */
    shiftArray(arrayPath, logName = null) {
        return function(obj, env) {
            const arr = Utils.getValueByPath(obj, arrayPath);
            if (Array.isArray(arr) && arr.length > 0) {
                const removed = arr.shift();  // 移除并返回第一个元素
                env?.log(`Shifted ${logName || arrayPath}: removed ${removed?.title || 'item'}`);
            }
            return obj;
        };
    },

    /**
     * processByKeyPrefix - 按键前缀批量处理对象属性
     * 
     * 【功能】根据key的前缀，批量设置对象的属性值
     * 
     * 【参数】
     * @param {string} objPath - 目标对象路径
     * @param {Object} prefixHandlers - 前缀处理规则
     *   - key: 前缀字符串（如 'Quest_'）
     *   - value: 要合并的对象，或空对象表示不修改
     *   - '*': 特殊key，表示默认处理（未匹配任何前缀时）
     * @param {Object} [options] - 可选配置
     *   - logPrefix: 日志前缀
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 魔幻粒子游戏：不同前缀的货币设置不同值
     * ProcessorUtils.processByKeyPrefix('currencies.list', {
     *     'Quest_': { amount: "1", total_collected: "1" },      // 任务货币
     *     'Event_': {},                                        // 活动货币不修改
     *     '*': { amount: "999999", total_collected: "999999" } // 其他货币
     * }, {
     *     logPrefix: 'Currency'
     * })
     */
    processByKeyPrefix(objPath, prefixHandlers, options = {}) {
        return function(obj, env) {
            const target = Utils.getValueByPath(obj, objPath);
            if (!target || typeof target !== 'object') {
                env?.warn(`ProcessByKeyPrefix: ${objPath} not found or not object`);
                return obj;
            }

            const stats = {};
            const entries = Object.entries(target);

            entries.forEach(([key, value]) => {
                let matched = false;

                for (const [prefix, handler] of Object.entries(prefixHandlers)) {
                    if (prefix === '*') continue;  // 跳过默认规则

                    if (key.startsWith(prefix)) {
                        if (handler && typeof handler === 'object') {
                            Object.assign(value, handler);  // 合并属性
                        }
                        stats[prefix] = (stats[prefix] || 0) + 1;
                        matched = true;
                        break;
                    }
                }

                // 未匹配任何前缀，使用默认规则
                if (!matched && prefixHandlers['*']) {
                    Object.assign(value, prefixHandlers['*']);
                    stats['*'] = (stats['*'] || 0) + 1;
                }
            });

            if (env && options.logPrefix) {
                const statsStr = Object.entries(stats).map(([k, v]) => `${k}:${v}`).join(', ');
                env.log(`${options.logPrefix} processed: ${statsStr}`);
            }

            return obj;
        };
    },

    /**
     * createSceneDispatcher - 场景分发器
     * 
     * 【功能】根据条件自动选择不同的处理场景，替代复杂的if-else
     * 
     * 【参数】
     * @param {Array} scenes - 场景数组，每个场景包含：
     *   - name: 场景名称（用于日志）
     *   - when: 条件函数 (obj) => boolean
     *   - then: 处理器函数 (obj, env) => obj
     *   - continueOnError: 出错时是否继续匹配下一个场景（默认false）
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 口语星球：根据数据结构自动选择处理方式
     * ProcessorUtils.createSceneDispatcher([
     *     {
     *         name: 'permission',  // 场景1：权限对象
     *         when: (obj) => obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data),
     *         then: ProcessorUtils.setFields({
     *             'data.isVip': true,
     *             'data.expireDate': CONSTANTS.EXPIRE_TIMESTAMP_MS
     *         })
     *     },
     *     {
     *         name: 'courseList',  // 场景2：课程数组
     *         when: (obj) => Array.isArray(obj.data),
     *         then: ProcessorUtils.mapArray('data', { status: 1 })
     *     }
     * ])
     */
    createSceneDispatcher(scenes) {
        return function(obj, env) {
            let matched = false;

            for (const scene of scenes) {
                try {
                    if (scene.when(obj)) {
                        env?.debug(`Scene matched: ${scene.name}`);
                        scene.then(obj, env);
                        matched = true;
                        break;  // 匹配成功则停止
                    }
                } catch (e) {
                    env?.warn(`Scene ${scene.name} error: ${e.message}`);
                    if (!scene.continueOnError) break;
                }
            }

            if (!matched && env) {
                const sceneNames = scenes.map(s => s.name).join(', ');
                env.debug(`No scene matched. Available scenes: ${sceneNames}`);
            }

            return obj;
        };
    },

    /**
     * createTypeDispatcher - 类型检查分发器
     * 
     * 【功能】根据obj.data的数据类型自动选择处理器
     * 
     * 【参数】
     * @param {Object} handlers - 处理器映射
     *   - array: data为数组时的处理器
     *   - object: data为对象时的处理器
     *   - other: 其他类型时的处理器
     *   - default: 默认处理器（可选）
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * ProcessorUtils.createTypeDispatcher({
     *     array: ProcessorUtils.mapArray('data', {...}),
     *     object: ProcessorUtils.setFields({...}),
     *     default: (obj, env) => obj  // 什么都不做
     * })
     */
    createTypeDispatcher(handlers) {
        return function(obj, env) {
            const type = Array.isArray(obj.data) ? 'array' : 
                        (obj.data && typeof obj.data === 'object') ? 'object' : 'other';
            
            const handler = handlers[type] || handlers['default'];
            if (handler) {
                env?.debug(`Type dispatcher: matched type '${type}'`);
                return handler(obj, env);
            }
            
            env?.warn(`Type dispatcher: no handler for type '${type}'`);
            return obj;
        };
    },

    /**
     * withErrorHandling - 错误边界包装器
     * 
     * 【功能】为处理器添加错误捕获和降级处理
     * 
     * 【参数】
     * @param {Function} processor - 主处理器
     * @param {Object} [fallback] - 降级字段映射（出错时执行setFields）
     * 
     * 【返回值】Function(obj, env) => obj - 包装后的处理函数
     * 
     * 【使用示例】
     * ProcessorUtils.withErrorHandling(
     *     ProcessorUtils.setFields({ 'data.complex': calculateComplexValue }),
     *     { 'data.isVip': true }  // 出错时的保底方案
     * )
     */
    withErrorHandling(processor, fallback = null) {
        return function(obj, env) {
            try {
                return processor(obj, env);
            } catch (e) {
                env?.error(`Processor error: ${e.message}`);
                if (fallback) {
                    env?.info('Applying fallback');
                    return ProcessorUtils.setFields(fallback)(obj, env);
                }
                return obj;
            }
        };
    },

    /**
     * compose - 处理器链式组合
     * 
     * 【功能】将多个处理器串联执行，前一个的输出作为后一个的输入
     * 
     * 【参数】
     * @param {...Function} processors - 任意数量的处理器函数
     * 
     * 【返回值】Function(obj, env) => obj - 组合后的处理函数
     * 
     * 【执行顺序】从左到右依次执行
     * 
     * 【使用示例】
     * ProcessorUtils.compose(
     *     ProcessorUtils.setFields({ 'data.status': 200 }),  // 第1步
     *     ProcessorUtils.mapArray('data.items', {...}),       // 第2步
     *     ProcessorUtils.filterArray('data.ads', {...})         // 第3步
     * )
     * // 执行流程: obj -> 第1步 -> 第2步 -> 第3步 -> 返回结果
     */
    compose(...processors) {
        return function(obj, env) {
            return processors.reduce((acc, processor) => {
                if (!acc) return acc;  // 如果中间结果为null，停止处理
                return processor(acc, env);
            }, obj);
        };
    },

    /**
     * when - 条件执行器
     * 
     * 【功能】只有条件满足时才执行处理器
     * 
     * 【参数】
     * @param {Function} condition - 条件函数 (obj) => boolean
     * @param {Function} processor - 处理器函数
     * 
     * 【返回值】Function(obj, env) => obj - 包装后的处理函数
     * 
     * 【使用示例】
     * // 只有VIP等级小于10时才升级
     * ProcessorUtils.when(
     *     (obj) => (obj.data?.vipLevel || 0) < 10,
     *     ProcessorUtils.setFields({ 'data.vipLevel': 10 })
     * )
     */
    when(condition, processor) {
        return function(obj, env) {
            if (condition(obj)) {
                return processor(obj, env);
            }
            return obj;  // 条件不满足，原样返回
        };
    },

    /**
     * deleteFields - 批量删除字段处理器
     * 
     * 【功能】批量删除对象中的多个字段
     * 
     * 【参数】
     * @param {...string} paths - 要删除的字段路径（可变参数）
     * 
     * 【返回值】Function(obj, env) => obj - 处理函数
     * 
     * 【使用示例】
     * // 删除多个广告相关字段
     * ProcessorUtils.deleteFields(
     *     'data.floatAd',
     *     'data.popupAd',
     *     'data.bannerAd'
     * )
     */
    deleteFields(...paths) {
        return function(obj, env) {
            for (const path of paths) {
                const parts = path.split('.');
                let current = obj;
                // 遍历到父对象
                for (let i = 0; i < parts.length - 1; i++) {
                    current = current?.[parts[i]];
                    if (!current) break;
                }
                // 删除最终字段
                if (current) {
                    delete current[parts[parts.length - 1]];
                    env?.debug(`Deleted: ${path}`);
                }
            }
            return obj;
        };
    }
};

// ==========================================
// 应用配置（完全声明式 - v13.3.0详细注释版）
// ==========================================

/**
 * APP_CONFIGS - 应用配置集合
 * 
 * 【配置结构说明】
 * 每个配置是一个对象，包含以下字段：
 * 
 * @property {string} id - 唯一标识符（小写，无空格）
 * @property {string} name - 显示名称（用于日志）
 * @property {RegExp} urlPattern - URL匹配正则表达式
 * @property {string} mode - 处理模式（json/regex/game/hybrid/multipath/html）
 * 
 * 【mode说明】
 * - json: 使用 customProcessor 处理JSON对象
 * - regex: 使用 regexReplacements 进行文本替换
 * - game: 使用 gameResources 修改游戏数值
 * - hybrid: 同时使用 customProcessor 和 regexReplacements
 * - multipath: 使用 pathHandlers 根据URL路径分发处理
 * - html: 使用 htmlReplacements 替换HTML内容
 */
const APP_CONFIGS = Object.freeze({
    
    /**
     * iappdaily - iAppDaily余额查询
     * 
     * 【接口说明】获取用户余额和VIP状态
     * 
     * 【处理策略】使用 setFields 直接设置VIP相关字段
     * 
     * 【字段说明】
     * - is_vip: 是否VIP（1=是）
     * - is_paid: 是否付费用户（1=是）
     * - vip_expired: VIP过期时间戳
     * - remain_coins: 剩余金币
     * - total_coins: 总金币
     */
    iappdaily: {
        id: 'iappdaily',
        name: 'iAppDaily',
        urlPattern: /api\.iappdaily\.com\/my\/balance/,
        mode: 'json',
        customProcessor: ProcessorUtils.setFields({
            'data.is_vip': 1,
            'data.is_paid': 1,
            'data.vip_expired': CONSTANTS.EXPIRE_TIMESTAMP,
            'data.remain_coins': CONSTANTS.DEFAULT_COINS,
            'data.total_coins': CONSTANTS.DEFAULT_COINS
        })
    },

    /**
     * tophub - TopHub账户同步
     * 
     * 【接口说明】同步用户账户信息，返回VIP状态
     * 
     * 【处理策略】使用 compose + when 组合处理
     * 1. 先设置顶层状态字段
     * 2. 根据data是否存在选择不同处理方式
     *    - data为空：创建完整的VIP数据结构
     *    - data有值：修改现有字段为VIP状态
     * 
     * 【特殊处理】使用 when 条件处理器实现类似 responseWrapper 的功能
     */
    tophub: {
        id: 'tophub',
        name: 'TopHub',
        urlPattern: /(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync/,
        mode: 'json',
        customProcessor: ProcessorUtils.compose(
            // 第1步：设置API状态码
            ProcessorUtils.setFields({
                'error': CONSTANTS.STATUS_OK,
                'status': CONSTANTS.STATUS_SUCCESS
            }),
            // 第2步：如果data为空，创建完整VIP结构
            ProcessorUtils.when(
                (obj) => !obj.data || Object.keys(obj.data).length === 0,
                ProcessorUtils.setFields({
                    'data': {
                        is_vip: "1",
                        is_vip_now: 1,
                        vip_expired: CONSTANTS.EXPIRE_DATE,
                        vip_type: CONSTANTS.DEFAULT_VIP_TYPE,
                        vip_level: CONSTANTS.DEFAULT_VIP_LEVEL
                    }
                })
            ),
            // 第3步：如果data有值，修改关键字段
            ProcessorUtils.when(
                (obj) => obj.data && Object.keys(obj.data).length > 0,
                ProcessorUtils.setFields({
                    'data.is_vip': "1",
                    'data.is_vip_now': 1,
                    'data.vip_expired': CONSTANTS.EXPIRE_DATE,
                    'data.vip_type': CONSTANTS.DEFAULT_VIP_TYPE,
                    'data.vip_level': CONSTANTS.DEFAULT_VIP_LEVEL
                })
            )
        )
    },

    /**
     * gps - GPS工具箱用户信息
     * 
     * 【接口说明】获取用户VIP状态和到期时间
     * 
     * 【处理策略】使用 setFields 设置多级VIP标识
     * 
     * 【VIP类型说明】
     * - is_vip: 普通VIP
     * - is_super_vip: 超级VIP
     * - is_power_vip: 强力VIP
     * - group_vip: 团队VIP
     */
    gps: {
        id: 'gps',
        name: 'GPS工具箱',
        urlPattern: /^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo/,
        mode: 'json',
        customProcessor: ProcessorUtils.setFields({
            'data.is_vip': 1,
            'data.vip_name': "VIP会员",
            'data.vip_expire_date': 2099999,
            'data.is_super_vip': 1,
            'data.is_power_vip': 1,
            'data.group_vip': 1,
            'data.group_vip_expire_date': 2099999
        })
    },

    /**
     * kyxq - 口语星球
     * 
     * 【接口说明】多场景接口，根据返回数据结构不同有两种形态：
     * 1. 权限对象：data为对象，包含用户权限信息
     * 2. 课程列表：data为数组，包含课程列表
     * 
     * 【处理策略】使用 createSceneDispatcher 场景分发器
     * 自动识别数据结构并应用对应的处理器
     */
    kyxq: {
        id: 'kyxq',
        name: '口语星球',
        urlPattern: /^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2/,
        mode: 'json',
        customProcessor: ProcessorUtils.createSceneDispatcher([
            {
                name: 'permission',  // 场景1：权限对象
                when: (obj) => obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data),
                then: ProcessorUtils.setFields({
                    'data.expireDate': CONSTANTS.EXPIRE_TIMESTAMP_MS,
                    'data.havePermission': true,
                    'data.type': 2,
                    'data.isVip': true,
                    'data.vipLevel': (obj) => obj.data?.vipLevel !== undefined ? 10 : undefined
                })
            },
            {
                name: 'courseList',  // 场景2：课程数组
                when: (obj) => Array.isArray(obj.data),
                then: ProcessorUtils.mapArray('data', {
                    overTime: CONSTANTS.EXPIRE_TIMESTAMP_MS,
                    status: 1,
                    isStudyIng: 1
                })
            }
        ])
    },

    /**
     * mhlz - 魔幻粒子游戏数据
     * 
     * 【接口说明】游戏货币数据，不同前缀代表不同类型货币
     * 
     * 【处理策略】使用 processByKeyPrefix 按键前缀处理
     * - Quest_ 前缀：任务货币，设为特定值
     * - Event_ 前缀：活动货币，不修改
     * - 其他货币：设为最大值
     */
    mhlz: {
        id: 'mhlz',
        name: '魔幻粒子',
        urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
        mode: 'json',
        customProcessor: ProcessorUtils.processByKeyPrefix('currencies.list', {
            'Quest_': { amount: "1", total_collected: "1" },  // 任务货币
            'Event_': {},                                    // 活动货币不修改
            '*': {                                           // 默认规则（其他货币）
                amount: CONSTANTS.BIG_NUMBER_STR, 
                total_collected: CONSTANTS.BIG_NUMBER_STR 
            }
        }, {
            logPrefix: 'Currency'  // 日志前缀
        })
    },

    /**
     * xjsm - 星际使命游戏数据
     * 
     * 【接口说明】游戏存档数据，包含wallet（钱包）和Bag（背包）两个对象
     * 
     * 【处理策略】使用 compose + when 组合处理
     * 1. 查找并修改wallet对象（金币、优惠券、宝石）
     * 2. 查找并修改Bag对象（武器碎片）
     * 
     * 【数据结构】
     * objects: [
     *   { collection: "Common", key: "wallet", value: "{"coin":100,...}" },
     *   { collection: "Common", key: "Bag", value: "{"m_ItemList":[...]}" }
     * ]
     */
    xjsm: {
        id: 'xjsm',
        name: '星际使命',
        urlPattern: /^https?:\/\/star\.jvplay\.cn\/v2\/storage/,
        mode: 'json',
        customProcessor: ProcessorUtils.compose(
            // 第1步：处理wallet（钱包）
            ProcessorUtils.when(
                (obj) => obj.objects?.some(o => o.collection === "Common" && o.key === "wallet"),
                (obj, env) => {
                    // 查找wallet对象
                    const walletObj = obj.objects.find(o => o.collection === "Common" && o.key === "wallet");
                    try {
                        let wallet = JSON.parse(walletObj.value);
                        // 设置无限货币
                        wallet.coin = CONSTANTS.TARGET_GAME_VALUE;
                        wallet.coupon = CONSTANTS.TARGET_GAME_VALUE;
                        wallet.gem = CONSTANTS.TARGET_GAME_VALUE;
                        walletObj.value = JSON.stringify(wallet);
                        env?.info('Wallet: unlimited coins/coupons/gems activated');
                    } catch (e) {
                        env?.error(`Wallet parse failed: ${e.message}`);
                    }
                    return obj;
                }
            ),
            // 第2步：处理Bag（背包）
            ProcessorUtils.when(
                (obj) => obj.objects?.some(o => o.collection === "Common" && o.key === "Bag"),
                (obj, env) => {
                    const bagObj = obj.objects.find(o => o.collection === "Common" && o.key === "Bag");
                    try {
                        let bag = JSON.parse(bagObj.value);
                        // 确保m_ItemList是数组
                        if (!bag.m_ItemList || !Array.isArray(bag.m_ItemList)) {
                            bag.m_ItemList = [];
                        }
                        
                        // 遍历所有武器ID，确保都有且数量为最大值
                        for (const weaponId of CONSTANTS.WEAPON_IDS) {
                            const existing = bag.m_ItemList.find(it => it.ItemID === weaponId);
                            if (existing) {
                                existing.Count = CONSTANTS.TARGET_GAME_VALUE;  // 已有则修改数量
                            } else {
                                bag.m_ItemList.push({                           // 没有则添加
                                    Count: CONSTANTS.TARGET_GAME_VALUE, 
                                    ItemID: weaponId 
                                });
                            }
                        }
                        
                        bagObj.value = JSON.stringify(bag);
                        env?.info(`Bag: all ${CONSTANTS.WEAPON_IDS.length} weapon fragments unlocked`);
                    } catch (e) {
                        env?.error(`Bag parse failed: ${e.message}`);
                    }
                    return obj;
                }
            )
        )
    },

    /**
     * v2ex - V2EX去广告
     * 
     * 【接口说明】返回HTML页面内容
     * 
     * 【处理策略】使用 htmlReplacements 在</head>前注入CSS隐藏广告
     * 
     * 【注意】HTML模式不使用声明式处理器，直接进行文本替换
     */
    v2ex: {
        id: 'v2ex',
        name: 'V2EX去广告',
        urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
        htmlReplacements: [
            {
                pattern: /<head>/i,
                replacement:`<head><style>.sidebar_units,.sidebar_compliance,ins.adsbygoogle,.Rightbar > .box,div[class="wwads-cn wwads-horizontal"],div[class="wwads-img"],div[class="wwads-content"]{display: none !important;}</style>`,
                description: '注入CSS隐藏广告元素'
            }
        ]
    },

    /**
     * foday - 复游会页面组件
     * 
     * 【接口说明】返回页面组件列表，包含广告组件
     * 
     * 【处理策略】使用 multipath 模式 + filterArray 过滤广告
     * 
     * 【pathHandlers说明】
     * 根据URL路径匹配不同的处理器，本配置只处理 /getPageComponents 路径
     */
    foday: {
        id: 'foday',
        name: '复游会',
        urlPattern: /^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents/,
        mode: 'multipath',
        pathHandlers: [
            {
                path: '/getPageComponents',  // URL包含此路径时匹配
                description: '页面组件接口 - 过滤广告组件',
                actions: [
                    {
                        type: 'custom',
                        description: '使用 Set 过滤广告组件',
                        processor: ProcessorUtils.filterArray('data.pageComponents', {
                            excludeSet: new Set([  // 黑名单：这些code的组件会被过滤掉
                                "TCMP_home_followingadvertising",
                                "TC_Interactive_Ad",
                                "TC_Member_Banner",
                                "TC_AIGO"
                            ]),
                            keyExtractor: (item) => item.componentCode,  // 提取code用于匹配
                            logName: 'pageComponents'
                        })
                    }
                ]
            }
        ]
    },

    /**
     * qiujingapp - 球竞APP广告接口
     * 
     * 【接口说明】多个广告相关接口，需要不同处理
     * 
     * 【处理策略】multipath模式，两个pathHandler分别处理不同路径
     * 
     * 【路径1】/api/v2/index/carouses/ - 轮播广告，清空data数组
     * 【路径2】/api/v3/index/all?position=2 - 弹窗推广，清空data.banners
     */
    qiujingapp: {
        id: 'qiujingapp',
        name: '球竞APP',
        urlPattern: /^https?:\/\/gateway-api\.yizhilive\.com\/api\/(v2\/index\/carouses\/(3|6|8|11)|v3\/index\/all)/,
        mode: 'multipath',
        pathHandlers: [
            {
                path: '/api/v2/index/carouses/',
                pathRegex: /\/api\/v2\/index\/carouses\/(11|8|6|3)\b/,  // 正则精确匹配
                description: '轮播广告接口 - 清空广告数组',
                actions: [
                    {
                        type: 'custom',
                        description: '清空广告数组',
                        processor: ProcessorUtils.clearArray('data', { logName: 'carousel ads' })
                    }
                ]
            },
            {
                path: '/api/v3/index/all',
                urlContains: 'position=2',  // URL必须包含此参数
                description: '弹窗推广接口 - 清空 banners',
                actions: [
                    {
                        type: 'custom',
                        description: '清空 banners 数组',
                        processor: ProcessorUtils.clearArray('data.banners', { logName: 'banners' })
                    }
                ]
            }
        ]
    },

    /**
     * tv - 影视去广告（完全声明式重构版）
     * 
     * 【接口说明】多个广告相关接口，原版本使用自定义函数，现完全声明式化
     * 
     * 【处理策略】multipath模式，4个pathHandler分别处理：
     * 
     * 1. /basic/init - 开屏广告：使用setFields置空字段
     * 2. /home/firstScreen - 焦点图广告：使用deleteFields+sliceArray
     * 3. /adInfo/getPageAd - 浮层弹窗：使用deleteFields批量删除
     * 4. /home/body - 列表广告：使用shiftArray移除首个
     */
    tv: {
        id: 'tv',
        name: '影视去广告',
        urlPattern: /^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body)/,
        mode: 'multipath',
        pathHandlers: [
            {
                path: '/basic/init',
                description: '初始化接口 - 去除开屏广告',
                actions: [
                    { 
                        type: 'custom',
                        description: '去除开屏广告相关字段',
                        processor: ProcessorUtils.compose(
                            ProcessorUtils.setFields({
                                'data.startAdShowTime': 0,    // 广告显示时间置0
                                'data.startAd': null,          // 广告对象置null
                                'data.startAdList': null       // 广告列表置null
                            })
                        )
                    }
                ]
            },
            {
                path: '/home/firstScreen',
                description: '首页首屏 - 去除焦点图广告并切片热门模块',
                actions: [
                    {
                        type: 'custom',
                        description: '删除焦点图广告并切片热门模块',
                        processor: ProcessorUtils.compose(
                            ProcessorUtils.deleteFields('data.focusAdList'),           // 删除焦点图广告
                            ProcessorUtils.sliceArray('data.hotMudleList', 5, 'hotMudleList')  // 热门模块只保留5个
                        )
                    }
                ]
            },
            {
                path: '/adInfo/getPageAd',
                description: '页面广告接口',
                actions: [
                    {
                        type: 'custom',
                        description: '删除浮层和弹窗广告',
                        processor: ProcessorUtils.deleteFields(
                            'data.floatAd',   // 浮层广告
                            'data.popupAd'    // 弹窗广告
                        )
                    }
                ]
            },
            {
                path: '/home/body',
                description: '首页主体 - 去除列表首个广告',
                actions: [
                    {
                        type: 'custom',
                        description: '移除首个广告',
                        processor: ProcessorUtils.shiftArray('data.adList', 'first ad')
                        // shiftArray会移除数组第一个元素，并记录被移除的item.title
                    }
                ]
            }
        ]
    },

    /**
     * keep - Keep健身会员接口
     * 
     * 【接口说明】多个会员相关接口返回JSON文本
     * 
     * 【处理策略】regex模式，批量替换关键字段为VIP状态
     * 
     * 【替换规则说明】
     * 使用正则表达式全局替换(g)，将所有会员相关字段改为开通状态
     */
    keep: {
        id: 'keep',
        name: 'Keep',
        urlPattern: /^https?:\/\/(api|kit)\.gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\//,
        mode: 'regex',
        regexReplacements: [
            { pattern: /"memberStatus":\d+/g, replacement: '"memberStatus":1', description: '会员状态' },
            { pattern: /"username":".*?"/g, replacement: '"username":"VIP"', description: '用户名' },
            { pattern: /"buttonText":".*?"/g, replacement: '"buttonText":""', description: '按钮文本' },
            { pattern: /"hasPaid":\w+/g, replacement: '"hasPaid":true', description: '已付费标识' },
            { pattern: /"downLoadAll":\w+/g, replacement: '"downLoadAll":true', description: '下载权限' },
            { pattern: /"videoTime":\d+/g, replacement: '"videoTime":0', description: '视频时间限制' },
            { pattern: /"startEnable":\w+/g, replacement: '"startEnable":true', description: '开始训练权限' },
            { pattern: /"preview":\w+/g, replacement: '"preview":false', description: '预览模式' },
            { pattern: /"errorCode":\d+/g, replacement: '"errorCode":0', description: '错误码' },
            { pattern: /"status":\w+/g, replacement: '"status":1', description: '状态码' },
            { pattern: /"member":\w+/g, replacement: '"member":true', description: '会员标识' },
            { pattern: /"limitFree":\w+/g, replacement: '"limitFree":true', description: '限免标识' },
            { pattern: /"limitCount":\d/g, replacement: '"limitCount":0', description: '限制次数' },
            { pattern: /"limitFreeType":"\w+/g, replacement: '"limitFreeType":""', description: '限免类型' },
            { pattern: /"free":\w+/g, replacement: '"free":true', description: '免费标识' },
            { pattern: /"userLiveMemberStatus":\w+/g, replacement: '"userLiveMemberStatus":1', description: '直播会员状态' },
            { pattern: /"canWatchLive":\w+/g, replacement: '"canWatchLive":true', description: '观看直播权限' },
            { pattern: /"userMemberAutoRenew":\w+/g, replacement: '"userMemberAutoRenew":true', description: '自动续费标识' },
            { pattern: /"userUseLiveMemberRights":\w+/g, replacement: '"userUseLiveMemberRights":true', description: '使用直播权益' },
            { pattern: /"userLiveMemberExpireTime":\d/g, replacement: '"userLiveMemberExpireTime":0', description: '直播会员过期时间' },
            { pattern: /"code":\d+/g, replacement: '"code":200', description: 'HTTP状态码' },
            { pattern: /":false/g, replacement: '":true', description: '全局false改true' }
        ]
    },

    /**
     * bqwz - 标枪王者游戏数据
     * 
     * 【接口说明】返回游戏资源数值（JSON格式文本）
     * 
     * 【处理策略】game模式，使用正则替换数值
     * 
     * 【gameResources说明】
     * 每个资源包含 field（字段名）、value（目标值）、description（描述）
     * 处理器会自动构建正则：\"field\":\d+ -> \"field\":value
     */
    bqwz: {
        id: 'bqwz',
        name: '标枪王者',
        urlPattern: /^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data/,
        mode: 'game',
        gameResources: [
            { field: 'coin', value: 9999880, description: '金币' },
            { field: 'diamond', value: 9999880, description: '钻石' },
            { field: 'exp', value: 9999880, description: '经验' },
            { field: 'rank_ticket', value: 666, description: '排位券' },
            { field: 'pve_power', value: 888, description: 'PVE体力' }
        ]
    },

    /**
     * cyljy - 成语来解压（微信小程序）
     * 
     * 【接口说明】返回用户金币数量
     * 
     * 【处理策略】game模式，修改coin字段为最大值
     */
    cyljy: {
        id: 'cyljy',
        name: '成语来解压',
        urlPattern: /^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value/,
        mode: 'game',
        gameResources: [
            { field: 'coin', value: 999988800, description: '无限金币' }
        ]
    },

    /**
     * bxkt - 伴学课堂
     * 
     * 【接口说明】返回课程权限信息
     * 
     * 【处理策略】hybrid模式（JSON处理+正则回退）
     * 
     * 【处理流程】
     * 1. 先用compose处理JSON：设置VIP字段+修改引用业务列表
     * 2. 如果JSON处理失败，正则替换作为回退
     */
    bxkt: {
        id: 'bxkt',
        name: '伴学课堂',
        urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
        mode: 'hybrid',
        customProcessor: ProcessorUtils.compose(
            // 第1步：设置主对象VIP字段
            ProcessorUtils.setFields({
                'data.isVip': true,
                'data.isHave': true,
                'data.isLock': false,
                'data.isSale': true,
                'data.isVipExpire': false,
                'data.originalPrice': 0,
                'data.salePrice': 0,
                'data.trialTopNum': 999
            }),
            // 第2步：修改引用业务列表中的锁定状态
            ProcessorUtils.mapArray('data.refBusinessList', {
                isLock: false
            }, (item) => item?.isLock === true)  // 只修改当前被锁定的项
        ),
        // 正则回退：确保关键字段被替换（防止JSON解析失败）
        regexReplacements: [
            { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' },
            { pattern: /"isHave":false/g, replacement: '"isHave":true', description: '拥有状态回退' },
            { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态回退' }
        ]
    }
},
        /**
             * wohome - 联通智家
             *
             * 【接口说明】联通智家APP接口，返回配置列表
             *
             * 【处理策略】使用 when + deleteFields 条件删除
             * 当 posCode 包含 "APP_START_PAGE" 时，删除 configList 字段（开屏广告配置）
             *
             * 【逻辑说明】
             * - 条件判断：检查 obj.data.posCode 是否包含 "APP_START_PAGE"
             * - 执行操作：如果条件满足，删除 obj.data.configList
             * - 保留其他数据：只删除广告配置，保留其他正常数据
             */
            wohome: {
                id: 'wohome',
                name: '联通智家',
                urlPattern: /^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher/,
                mode: 'json',
                customProcessor: ProcessorUtils.when(
                    // 条件：posCode 包含 APP_START_PAGE（开屏广告场景）
                    (obj) => obj?.data?.posCode?.includes("APP_START_PAGE"),
                    // 执行：删除 configList 字段
                    ProcessorUtils.deleteFields('data.configList')
                )
            });


// ==========================================
// 工具类 - Env 兼容层（详细注释版）
// ==========================================

/**
 * Environment - 环境封装类
 * 
 * 【功能】封装不同平台（QX/Surge/Loon）的差异，提供统一接口
 * 
 * 【主要方法】
 * - log/debug/info/warn/error: 分级日志输出
 * - done: 结束脚本并返回结果
 * - getResponse/getRequest: 获取响应/请求对象
 * - getCurrentUrl: 统一获取当前URL（关键方法）
 */
class Environment {
    /**
     * 构造函数
     * @param {string} name - 脚本名称，用于日志标识
     */
    constructor(name) {
        this.name = name;
        // 检测当前平台
        this.isQX = typeof $task !== 'undefined';                    // Quantumult X
        this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;  // Surge
        this.isLoon = typeof $loon !== 'undefined';                 // Loon
        this.platform = this.detectPlatform();
    }

    /**
     * 检测当前运行平台
     * @returns {string} 平台名称
     */
    detectPlatform() {
        if (this.isQX) return 'Quantumult X';
        if (this.isSurge) return 'Surge';
        if (this.isLoon) return 'Loon';
        return 'Unknown';
    }

    /**
     * 基础日志方法
     * @param {string} level - 日志级别（debug/info/warn/error）
     * @param {string} msg - 日志内容
     */
    log(level, msg) {
        // 非调试模式下，不输出debug日志
        if (!GLOBAL_CONFIG.DEBUG && level === 'debug') return;

        const timestamp = new Date().toISOString();
        const prefix = `[${this.name}][${level.toUpperCase()}][${timestamp}]`;
        const message = `${prefix} ${msg}`;

        console.log(message);

        // QX平台错误时发送通知
        if (this.isQX && level === 'error') {
            $notify(this.name, 'Error', msg);
        }
    }

    // 分级日志快捷方法
    debug(msg) { this.log('debug', msg); }
    info(msg) { this.log('info', msg); }
    warn(msg) { this.log('warn', msg); }
    error(msg) { this.log('error', msg); }

    /**
     * 结束脚本并返回结果
     * @param {Object} object - 包含body字段的结果对象
     */
    done(object) {
        if (!object || !object.body) {
            this.warn('Empty response body, returning original');
            $done({});
            return;
        }
        $done(object);
    }

    /**
     * 获取响应对象
     * @returns {Object} $response或空对象
     */
    getResponse() {
        return $response || {};
    }

    /**
     * 获取请求对象
     * @returns {Object} $request或空对象
     */
    getRequest() {
        return $request || {};
    }

    /**
     * 统一获取当前URL（关键方法）
     * 
     * 【优先级】response.url > request.url > ''
     * 【返回值】字符串类型的URL，确保不为undefined
     * 
     * @returns {string} 当前请求的URL
     */
    getCurrentUrl() {
        const resp = this.getResponse();
        const req = this.getRequest();
        const url = resp.url || req.url || '';
        return url.toString();
    }
}

// ==========================================
// 工具函数库（详细注释版）
// ==========================================

/**
 * Utils - 通用工具函数
 * 
 * 【主要功能】
 * - JSON安全解析/序列化
 * - 对象路径操作（get/set）
 * - 正则缓存管理
 * - 对象深度合并
 */
const Utils = {
    // 正则表达式缓存，避免重复编译
    _regexCache: new Map(),

    /**
     * 安全解析JSON字符串
     * 
     * @param {string} str - 要解析的字符串
     * @param {*} defaultVal - 解析失败时的默认值
     * @returns {*} 解析结果或默认值
     */
    safeJsonParse(str, defaultVal = null) {
        if (!str || typeof str !== 'string') return defaultVal;
        try {
            return JSON.parse(str);
        } catch (e) {
            return defaultVal;
        }
    },

    /**
     * 安全序列化为JSON字符串
     * 
     * @param {Object} obj - 要序列化的对象
     * @param {boolean} pretty - 是否格式化（缩进2空格）
     * @returns {string} JSON字符串，失败返回'{}'
     */
    safeJsonStringify(obj, pretty = false) {
        try {
            return JSON.stringify(obj, null, pretty ? 2 : undefined);
        } catch (e) {
            console.error(`JSON stringify error: ${e}`);
            return '{}';
        }
    },

    /**
     * 根据路径获取对象值（支持数组索引）
     * 
     * 【路径格式】
     * - 普通路径：'data.user.name'
     * - 数组索引：'data.items[0].title'
     * - 混合使用：'data.list[2].tags[0]'
     * 
     * @param {Object} obj - 目标对象
     * @param {string} path - 字段路径
     * @returns {*} 路径对应的值，不存在返回undefined
     */
    getValueByPath(obj, path) {
        if (!path || !obj) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === null || acc === undefined) return undefined;

            // 匹配数组索引格式：items[0]
            const match = part.match(/^([^\[]+)\[(\d+)\]$/);
            if (match) {
                const arr = acc[match[1]];
                return Array.isArray(arr) ? arr[parseInt(match[2])] : undefined;
            }
            return acc[part];
        }, obj);
    },

    /**
     * 根据路径设置对象值（自动创建中间结构）
     * 
     * 【特性】
     * - 自动创建不存在的中间对象
     * - 自动创建不存在的数组并填充空值
     * - 支持数组索引路径
     * 
     * @param {Object} obj - 目标对象
     * @param {string} path - 字段路径
     * @param {*} value - 要设置的值
     * @returns {Object} 修改后的对象（引用相同）
     */
    setValueByPath(obj, path, value) {
        if (!path || !obj) return obj;

        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPart = parts[i + 1];

            // 检查当前部分是否包含数组索引
            const match = part.match(/^([^\[]+)\[(\d+)\]$/);

            if (match) {
                // 处理数组索引，如 items[0]
                const arrName = match[1];
                const arrIndex = parseInt(match[2]);

                if (!(arrName in current) || !Array.isArray(current[arrName])) {
                    current[arrName] = [];
                }

                // 确保数组长度足够
                while (current[arrName].length <= arrIndex) {
                    current[arrName].push({});
                }

                // 如果是倒数第二个部分，直接设置值
                if (i === parts.length - 2) {
                    current[arrName][arrIndex] = value;
                    return obj;
                } else {
                    // 否则确保是对象并继续深入
                    if (!current[arrName][arrIndex] || typeof current[arrName][arrIndex] !== 'object') {
                        current[arrName][arrIndex] = {};
                    }
                    current = current[arrName][arrIndex];
                }
            } else {
                // 检查下一部分是否是数组索引
                const isNextArray = /^[^\[]+\[\d+\]$/.test(nextPart);

                // 自动创建中间结构
                if (!(part in current) || current[part] === null) {
                    current[part] = isNextArray ? [] : {};
                }
                current = current[part];
            }
        }

        // 处理最后一部分
        const lastPart = parts[parts.length - 1];
        const lastMatch = lastPart.match(/^([^\[]+)\[(\d+)\]$/);

        if (lastMatch) {
            // 最后是数组索引
            const arrName = lastMatch[1];
            const arrIndex = parseInt(lastMatch[2]);
            if (!Array.isArray(current[arrName])) {
                current[arrName] = [];
            }
            while (current[arrName].length <= arrIndex) {
                current[arrName].push(null);
            }
            current[arrName][arrIndex] = value;
        } else {
            // 最后是普通字段
            current[lastPart] = value;
        }

        return obj;
    },

    /**
     * 检查路径是否存在
     * @param {Object} obj - 目标对象
     * @param {string} path - 字段路径
     * @returns {boolean} 是否存在且不为undefined
     */
    pathExists(obj, path) {
        return this.getValueByPath(obj, path) !== undefined;
    },

    /**
     * 获取缓存的正则表达式（性能优化）
     * 
     * 【说明】相同pattern和flags的正则只会编译一次，提升性能
     * 
     * @param {RegExp|string} pattern - 正则模式
     * @param {string} flags - 正则标志（如'g', 'i'）
     * @returns {RegExp} 编译后的正则对象
     */
    getRegExp(pattern, flags = 'g') {
        const key = `${pattern.toString()}_${flags}`;
        if (!this._regexCache.has(key)) {
            const regex = pattern instanceof RegExp
                ? new RegExp(pattern.source, flags || pattern.flags)
                : new RegExp(pattern, flags);
            this._regexCache.set(key, regex);
        }
        return this._regexCache.get(key);
    },

    /**
     * 深度合并对象（递归）
     * 
     * 【特性】
     * - 递归合并嵌套对象
     * - 数组直接替换（不合并）
     * - 修改target对象并返回
     * 
     * @param {Object} target - 目标对象
     * @param {Object} source - 源对象
     * @returns {Object} 合并后的target对象
     */
    deepMerge(target, source) {
        if (!source) return target;
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }
};

// ==========================================
// 配置验证器（详细注释版）
// ==========================================

/**
 * ConfigValidator - 配置验证器
 * 
 * 【功能】验证应用配置是否符合规范，提前发现配置错误
 * 
 * 【验证规则】
 * 1. 所有配置必须有 id, name, urlPattern
 * 2. 不同 mode 需要不同的必填字段（见 CONFIG_SCHEMA）
 */
class ConfigValidator {
    /**
     * 验证单个配置对象
     * 
     * @param {Object} config - 要验证的配置对象
     * @returns {Object} 验证结果 { valid: boolean, errors: string[] }
     * 
     * 【使用示例】
     * const result = ConfigValidator.validate({
     *     id: 'test',
     *     name: 'Test',
     *     urlPattern: /test\.com/,
     *     mode: 'json'
     * });
     * if (!result.valid) console.log(result.errors);
     */
    static validate(config) {
        const errors = [];

        // 检查通用必填字段
        for (const field of CONFIG_SCHEMA.required) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // 检查模式特定必填字段
        const mode = config.mode || 'json';
        const modeSchema = CONFIG_SCHEMA.modes[mode];

        if (modeSchema?.required) {
            for (const field of modeSchema.required) {
                if (!config[field]) {
                    errors.push(`Mode '${mode}' requires field: ${field}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 批量过滤有效配置
     * 
     * 【功能】遍历所有配置，分离出有效和无效的配置
     * 
     * @param {Object} configs - 配置集合（如 APP_CONFIGS）
     * @returns {Object} { valid: Object, invalidCount: number }
     *   - valid: 有效的配置集合（key-value形式）
     *   - invalidCount: 无效配置的数量
     * 
     * 【使用示例】
     * const { valid, invalidCount } = ConfigValidator.filterValidConfigs(APP_CONFIGS);
     * console.log(`有效配置: ${Object.keys(valid).length}个，无效: ${invalidCount}个`);
     */
    static filterValidConfigs(configs) {
        const valid = {};
        const invalid = [];
        
        for (const [key, config] of Object.entries(configs)) {
            const validation = this.validate(config);
            if (validation.valid) {
                valid[key] = config;
            } else {
                invalid.push({ key, errors: validation.errors });
            }
        }

        // 调试模式下输出无效配置详情
        if (invalid.length > 0 && GLOBAL_CONFIG.DEBUG) {
            console.log('[ConfigValidator] Invalid configs:', invalid);
        }

        return { valid, invalidCount: invalid.length };
    }
}

// ==========================================
// VIP 解锁核心引擎 v2.2（详细注释版）
// ==========================================

/**
 * VipUnlockEngine - VIP解锁核心引擎
 * 
 * 【职责】
 * 1. 根据配置选择合适的处理模式
 * 2. 执行具体的解锁逻辑（JSON/正则/游戏/混合/多路径/HTML）
 * 3. 统计处理结果（修改次数、耗时、错误）
 * 
 * 【使用流程】
 * 1. 实例化：const engine = new VipUnlockEngine(env)
 * 2. 设置配置：engine.setConfig(config)
 * 3. 执行处理：const result = engine.process(response, url)
 * 4. 获取统计：const stats = engine.getStats()
 */
class VipUnlockEngine {
    /**
     * 构造函数
     * @param {Environment} env - 环境对象，用于日志输出
     */
    constructor(env) {
        this.env = env;
        this.config = null;
        // 统计信息
        this.stats = {
            startTime: Date.now(),    // 处理开始时间
            mode: null,               // 实际使用的处理模式
            modifications: 0,         // 修改次数统计
            errors: []                // 错误信息收集
        };
    }

    /**
     * 设置处理配置
     * 
     * @param {Object} config - 应用配置（来自 APP_CONFIGS）
     * 
     * 【逻辑】
     * 1. 验证配置合法性
     * 2. 如果验证失败，使用默认配置
     * 3. 记录实际使用的模式
     */
    setConfig(config) {
        const validation = ConfigValidator.validate(config);
        if (!validation.valid) {
            this.env.error(`Config validation failed: ${validation.errors.join(', ')}`);
            config = this.getDefaultConfig();  // 降级到默认配置
        }

        this.config = config;
        this.stats.mode = config.mode || 'auto';
        this.env.info(`Initialized: ${config.name} [Mode: ${this.stats.mode}]`);
    }

    /**
     * 获取默认配置（降级用）
     * 
     * @returns {Object} 通用VIP配置
     */
    getDefaultConfig() {
        return {
            name: 'Generic',
            mode: 'json',
            customProcessor: ProcessorUtils.setFields({
                'data.is_vip': 1,
                'data.vip_expire_date': CONSTANTS.EXPIRE_TIMESTAMP
            })
        };
    }

    /**
     * 执行处理（主入口）
     * 
     * @param {Object} response - 响应对象，必须包含 body 字段
     * @param {string} url - 当前请求URL（用于multipath模式）
     * @returns {Object} 处理结果 { body: string }
     * 
     * 【处理流程】
     * 1. 检查响应体是否存在
     * 2. 自动检测或获取处理模式
     * 3. 根据模式分发到对应处理方法
     * 4. 捕获异常并记录错误
     */
    process(response, url) {
        try {
            // 检查响应体
            if (!response?.body) {
                this.env.warn('No response body found');
                //return this.createErrorResponse('No response body');
            }

            // 确定处理模式
            const mode = this.config.mode || this.detectMode();
            this.stats.mode = mode;

            this.env.debug(`Processing with mode: ${mode}`);

            // 模式分发
            switch (mode) {
                case CONSTANTS.MODES.HTML:
                    return this.processHtmlMode(response.body);
                case CONSTANTS.MODES.MULTIPATH:
                    // multipath模式需要URL参数
                    return this.processMultipathMode(response.body, url);
                case CONSTANTS.MODES.HYBRID:
                    return this.processHybridMode(response.body);
                case CONSTANTS.MODES.GAME:
                    return this.processGameMode(response.body);
                case CONSTANTS.MODES.REGEX:
                    return this.processRegexMode(response.body);
                case CONSTANTS.MODES.JSON:
                default:
                    return this.processJsonMode(response.body);
            }
        } catch (e) {
            this.env.error(`Processing error: ${e.message}`);
            this.stats.errors.push(e.message);
            return { body: response.body };  // 出错时返回原内容
        }
    }

    /**
     * 自动检测处理模式
     * 
     * 【检测优先级】（从高到低）
     * 1. htmlReplacements存在 → HTML模式
     * 2. pathHandlers存在 → MULTIPATH模式
     * 3. 同时有customProcessor和regexReplacements → HYBRID模式
     * 4. gameResources存在 → GAME模式
     * 5. regexReplacements存在 → REGEX模式
     * 6. 默认 → JSON模式
     * 
     * @returns {string} 检测到的模式常量
     */
    detectMode() {
        if (this.config.htmlReplacements?.length) return CONSTANTS.MODES.HTML;
        if (this.config.pathHandlers?.length) return CONSTANTS.MODES.MULTIPATH;
        if (this.config.customProcessor && this.config.regexReplacements) return CONSTANTS.MODES.HYBRID;
        if (this.config.gameResources?.length) return CONSTANTS.MODES.GAME;
        if (this.config.regexReplacements?.length) return CONSTANTS.MODES.REGEX;
        return CONSTANTS.MODES.JSON;
    }

    /**
     * HTML替换模式处理
     * 
     * @param {string} body - HTML文本内容
     * @returns {Object} { body: 修改后的HTML }
     * 
     * 【处理逻辑】
     * 遍历 htmlReplacements 数组，对每个规则执行正则替换
     */
    processHtmlMode(body) {
        let modifiedBody = body;
        const replacements = this.config.htmlReplacements || [];

        this.env.debug(`HTML replacements: ${replacements.length} rules`);

        for (const rule of replacements) {
            try {
                const regex = Utils.getRegExp(rule.pattern, 'i');  // i=忽略大小写
                const original = modifiedBody;
                modifiedBody = modifiedBody.replace(regex, rule.replacement);

                // 如果内容发生变化，记录修改
                if (original !== modifiedBody) {
                    this.stats.modifications++;
                    this.env.debug(`Applied: ${rule.description || 'unnamed'}`);
                }
            } catch (e) {
                this.env.warn(`HTML replacement error: ${e.message}`);
            }
        }

        this.env.info(`${this.config.name} processed (HTML mode)`);
        return { body: modifiedBody };
    }

    /**
     * 多路径模式处理
     * 
     * @param {string} body - JSON文本
     * @param {string} url - 当前请求URL
     * @returns {Object} { body: 修改后的JSON字符串 }
     * 
     * 【处理逻辑】
     * 1. 解析JSON
     * 2. 遍历 pathHandlers，匹配URL路径
     * 3. 执行匹配handler的所有actions
     * 4. 序列化返回
     */
    processMultipathMode(body, url) {
        // 确保url是字符串，防止undefined
        const safeUrl = (url || '').toString();
        
        let obj = Utils.safeJsonParse(body);
        if (!obj) {
            //return this.createErrorResponse('Failed to parse JSON');
        }

        const handlers = this.config.pathHandlers || [];
        let matched = false;

        for (const handler of handlers) {
            // 匹配条件检查（必须同时满足）
            const pathMatch = safeUrl.includes(handler.path);           // 路径包含检查
            const regexMatch = !handler.pathRegex || handler.pathRegex.test(safeUrl);  // 正则检查（可选）
            const containsMatch = !handler.urlContains || safeUrl.includes(handler.urlContains);  // 内容包含检查（可选）

            if (pathMatch && regexMatch && containsMatch) {
                matched = true;
                this.env.debug(`Matched handler: ${handler.path}`);

                // 执行该handler的所有actions
                for (const action of handler.actions || []) {
                    try {
                        this.executeAction(obj, action);
                    } catch (e) {
                        this.env.warn(`Action error: ${e.message}`);
                    }
                }
                break;  // 匹配成功后不再检查其他handler
            }
        }

        if (!matched) {
            this.env.debug('No matching path handler found');
        }

        return { body: Utils.safeJsonStringify(obj) };
    }

    /**
     * 执行单个action（multipath模式内部使用）
     * 
     * @param {Object} obj - 当前处理的对象
     * @param {Object} action - action配置
     *   - type: 'delete'|'set'|'arraySlice'|'arrayShift'|'custom'
     *   - 其他字段根据type不同而变化
     */
    executeAction(obj, action) {
        switch (action.type) {
            case 'delete':
                this.actionDelete(obj, action);
                break;
            case 'set':
                this.actionSet(obj, action);
                break;
            case 'arraySlice':
                this.actionArraySlice(obj, action);
                break;
            case 'arrayShift':
                this.actionArrayShift(obj, action);
                break;
            case 'custom':
                // 自定义处理器，直接调用
                if (typeof action.processor === 'function') {
                    action.processor(obj, this.env);
                    this.stats.modifications++;
                }
                break;
            default:
                this.env.warn(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * delete类型action：删除字段
     * 
     * @param {Object} obj - 目标对象
     * @param {Object} action - 配置 { type: 'delete', field: 'data.ads' }
     */
    actionDelete(obj, action) {
        const parts = action.field.split('.');
        let current = obj;
        // 遍历到父对象
        for (let i = 0; i < parts.length - 1; i++) {
            current = current?.[parts[i]];
            if (!current) return;  // 路径不存在，直接返回
        }
        // 删除最终字段
        delete current[parts[parts.length - 1]];
        this.stats.modifications++;
        this.env.debug(`Deleted: ${action.field}`);
    }

    /**
     * set类型action：设置字段值
     * 
     * @param {Object} obj - 目标对象
     * @param {Object} action - 配置 { type: 'set', field: 'data.vip', value: 1 }
     */
    actionSet(obj, action) {
        Utils.setValueByPath(obj, action.field, action.value);
        this.stats.modifications++;
        this.env.debug(`Set: ${action.field} = ${JSON.stringify(action.value)}`);
    }

    /**
     * arraySlice类型action：数组切片
     * 
     * @param {Object} obj - 目标对象
     * @param {Object} action - 配置 { type: 'arraySlice', field: 'data.items', keepCount: 5 }
     */
    actionArraySlice(obj, action) {
        const arr = Utils.getValueByPath(obj, action.field);
        if (Array.isArray(arr)) {
            const original = arr.length;
            Utils.setValueByPath(obj, action.field, arr.slice(0, action.keepCount));
            this.stats.modifications++;
            this.env.debug(`Sliced: ${action.field} ${original} -> ${action.keepCount}`);
        }
    }

    /**
     * arrayShift类型action：数组移位（移除第一个）
     * 
     * @param {Object} obj - 目标对象
     * @param {Object} action - 配置 { type: 'arrayShift', field: 'data.ads' }
     */
    actionArrayShift(obj, action) {
        const arr = Utils.getValueByPath(obj, action.field);
        if (Array.isArray(arr) && arr.length > 0) {
            arr.shift();
            this.stats.modifications++;
            this.env.debug(`Shifted: ${action.field}`);
        }
    }

    /**
     * 混合模式处理（JSON + 正则回退）
     * 
     * @param {string} body - 响应文本
     * @returns {Object} { body: 修改后的文本 }
     * 
     * 【处理逻辑】
     * 1. 尝试解析JSON
     * 2. 如果成功且存在customProcessor，执行处理器
     * 3. 如果JSON处理失败，回退到正则替换
     */
    processHybridMode(body) {
        let obj = Utils.safeJsonParse(body, null);

        if (obj !== null && this.config.customProcessor) {
            try {
                obj = this.config.customProcessor(obj, this.env);
                this.env.info(`${this.config.name} processed (Hybrid-JSON)`);
                return { body: Utils.safeJsonStringify(obj) };
            } catch (e) {
                this.env.warn(`Custom processor failed: ${e.message}, falling back to regex`);
            }
        }

        // JSON处理失败，回退到正则模式
        return this.processRegexMode(body);
    }

    /**
     * JSON模式处理
     * 
     * @param {string} body - JSON文本
     * @returns {Object} { body: 修改后的JSON }
     * 
     * 【处理优先级】
     * 1. 如果有customProcessor，优先使用（声明式处理器）
     * 2. 否则使用传统的fields映射（兼容旧配置）
     * 3. 如果启用responseWrapper，处理空数据情况
     */
    processJsonMode(body) {
        let obj = Utils.safeJsonParse(body);
        if (!obj) {
            return this.createErrorResponse('Failed to parse JSON');
        }

        // 优先：声明式处理器
        if (typeof this.config.customProcessor === 'function') {
            obj = this.config.customProcessor(obj, this.env);
            this.env.info(`${this.config.name} processed (JSON-Declarative)`);
            return { body: Utils.safeJsonStringify(obj) };
        }

        // 兼容：传统fields映射
        if (this.config.fields) {
            this.applyFieldMapping(obj);
        }

        // 兼容：responseWrapper包装器
        if (this.config.responseWrapper?.enabled) {
            const hasData = Utils.getValueByPath(obj, 'data');
            if (!hasData || Object.keys(hasData).length === 0) {
                this.env.debug('Using response wrapper template');
                obj = Utils.deepMerge({}, this.config.responseWrapper.template);
            }
        }

        this.env.info(`${this.config.name} processed (JSON mode)`);
        return { body: Utils.safeJsonStringify(obj) };
    }

    /**
     * 传统字段映射处理（兼容旧配置）
     * 
     * @param {Object} obj - 解析后的JSON对象
     */
    applyFieldMapping(obj) {
        for (const [key, field] of Object.entries(this.config.fields)) {
            const exists = Utils.pathExists(obj, field.path);
            Utils.setValueByPath(obj, field.path, field.value);

            if (exists) {
                this.stats.modifications++;
                this.env.debug(`Modified: ${field.path} = ${JSON.stringify(field.value)}`);
            } else {
                this.env.debug(`Created: ${field.path} = ${JSON.stringify(field.value)}`);
            }
        }
    }

    /**
     * 正则替换模式处理
     * 
     * @param {string} body - 响应文本
     * @returns {Object} { body: 修改后的文本 }
     */
    processRegexMode(body) {
        let modifiedBody = body;
        const replacements = this.config.regexReplacements || [];

        this.env.debug(`Regex replacements: ${replacements.length} rules`);

        for (const rule of replacements) {
            try {
                const regex = Utils.getRegExp(rule.pattern, 'g');  // g=全局替换
                const original = modifiedBody;
                modifiedBody = modifiedBody.replace(regex, rule.replacement);

                if (original !== modifiedBody) {
                    this.stats.modifications++;
                    this.env.debug(`Applied: ${rule.description || 'unnamed'}`);
                }
            } catch (e) {
                this.env.warn(`Regex error: ${e.message}`);
            }
        }

        this.env.info(`${this.config.name} processed (Regex mode)`);
        return { body: modifiedBody };
    }

    /**
     * 游戏数值修改模式
     * 
     * @param {string} body - 响应文本（包含游戏数值的JSON）
     * @returns {Object} { body: 修改后的文本 }
     * 
     * 【处理逻辑】
     * 使用正则精确匹配 "field":123 格式，替换为 "field":value
     */
    processGameMode(body) {
        let modifiedBody = body;
        const resources = this.config.gameResources || [];

        this.env.debug(`Game resources: ${resources.length} items`);

        for (const resource of resources) {
            try {
                // 构建精确匹配正则：\"field\":数字
                const pattern = new RegExp(`\\"${resource.field}\\":\\d+`, 'g');
                const replacement = `"${resource.field}":${resource.value}`;

                const original = modifiedBody;
                modifiedBody = modifiedBody.replace(pattern, replacement);

                if (original !== modifiedBody) {
                    this.stats.modifications++;
                    this.env.debug(`Modified: ${resource.description} (${resource.field})`);
                }
            } catch (e) {
                this.env.warn(`Game resource error: ${e.message}`);
            }
        }

        this.env.info(`${this.config.name} processed (Game mode)`);
        return { body: modifiedBody };
    }

    /**
     * 创建错误响应
     * 
     * @param {string} reason - 错误原因
     * @returns {Object} { body: 原响应内容或空对象 }
     */
    createErrorResponse(reason) {
        this.env.error(`Error: ${reason}`);
        return { body: $response?.body || '{}' };
    }

    /**
     * 获取处理统计信息
     * 
     * @returns {Object} 统计信息
     *   - mode: 使用的处理模式
     *   - modifications: 修改次数
     *   - errors: 错误数组
     *   - duration: 处理耗时（毫秒）
     */
    getStats() {
        return {
            ...this.stats,
            duration: Date.now() - this.stats.startTime
        };
    }
}

// ==========================================
// 插件管理器 v3.0（详细注释版）
// ==========================================

/**
 * PluginManager - 插件管理器
 * 
 * 【核心优化】动态加载模式
 * 传统方式：启动时加载所有14个插件（浪费内存）
 * 优化方式：只加载匹配当前URL的1个插件（节省资源）
 * 
 * 【使用流程】
 * 1. 实例化：const pm = new PluginManager()
 * 2. 动态加载：const config = pm.loadForUrl(url, APP_CONFIGS)
 * 3. 如果失败，可选全量加载：pm.registerAll(APP_CONFIGS)
 */
class PluginManager {
    constructor() {
        this.plugins = new Map();      // 存储已加载的插件
        this._totalAvailable = 0;       // 记录总可用配置数（用于日志）
    }

    /**
     * 动态加载 - 只注册匹配当前URL的有效插件（推荐方式）
     * 
     * @param {string} url - 当前请求URL
     * @param {Object} configs - 配置集合（如 APP_CONFIGS）
     * @returns {Object|null} 匹配的配置对象，无匹配返回null
     * 
     * 【执行流程】
     * 1. 预验证所有配置，分离有效/无效
     * 2. 遍历有效配置，测试urlPattern匹配
     * 3. 第一个匹配的即冻结存储并返回
     * 4. 记录加载模式（dynamic/lazy）和数量
     */
    loadForUrl(url, configs) {
        if (!url) return null;
        
        // 预验证配置
        const { valid, invalidCount } = ConfigValidator.filterValidConfigs(configs);
        this._totalAvailable = Object.keys(valid).length;
        
        if (invalidCount > 0) {
            console.log(`[PluginManager] Warning: ${invalidCount} invalid configs skipped`);
        }

        // 遍历寻找匹配
        for (const [key, config] of Object.entries(valid)) {
            if (config.urlPattern?.test(url)) {
                // 找到匹配，冻结配置（防止运行时修改）
                this.plugins.set(key, Object.freeze({ ...config }));
                
                const loadMode = GLOBAL_CONFIG.DEBUG ? 'dynamic' : 'lazy';
                console.log(`[PluginManager] ${loadMode}-loaded: ${config.name} [${config.mode || 'auto'}] (1/${this._totalAvailable})`);
                
                return config;
            }
        }
        
        console.log(`[PluginManager] No match for URL: ${url.substring(0, 50)}...`);
        return null;
    }

    /**
     * 传统批量注册（兼容性保留，不推荐）
     * 
     * @param {Object} configs - 配置集合
     * @returns {number} 成功注册的数量
     * 
     * 【使用场景】
     * - 调试时需要查看所有配置
     * - 某些特殊场景需要回退到全量模式
     */
    registerAll(configs) {
        const { valid, invalidCount } = ConfigValidator.filterValidConfigs(configs);
        this._totalAvailable = Object.keys(valid).length;
        
        let successCount = 0;
        for (const [key, config] of Object.entries(valid)) {
            this.plugins.set(key, Object.freeze({ ...config }));
            successCount++;
        }

        console.log(`[PluginManager] Full-load: ${successCount} plugins registered (${invalidCount} invalid skipped)`);
        return successCount;
    }

    /**
     * 获取指定ID的插件
     * @param {string} id - 插件ID
     * @returns {Object|undefined} 插件配置
     */
    get(id) {
        return this.plugins.get(id);
    }

    /**
     * 获取已加载插件数量
     * @returns {number} 数量
     */
    getLoadedCount() {
        return this.plugins.size;
    }
}

// ==========================================
// 主入口（详细注释版）
// ==========================================

/**
 * main - 脚本主入口函数
 * 
 * 【执行流程详解】
 * 
 * 第1步：环境初始化
 *   - 创建Environment实例，检测平台（QX/Surge/Loon）
 *   - 输出启动日志，包含版本号和平台信息
 * 
 * 第2步：URL获取
 *   - 调用 env.getCurrentUrl() 统一获取URL
 *   - 优先级：response.url > request.url > ''
 *   - 如果为空，直接返回错误
 * 
 * 第3步：插件加载（核心优化点）
 *   - 创建PluginManager实例
 *   - 调用 loadForUrl() 动态加载匹配URL的单个插件
 *   - 如果失败，回退到 registerAll() 全量加载
 *   - 如果仍失败，使用默认配置
 * 
 * 第4步：处理执行
 *   - 创建VipUnlockEngine实例
 *   - 设置匹配到的配置
 *   - 调用 process() 执行解锁逻辑
 *   - 传递已获取的URL，避免重复获取
 * 
 * 第5步：结果返回
 *   - 获取处理统计（耗时、修改次数）
 *   - 输出完成日志
 *   - 调用 env.done() 返回结果
 * 
 * 【异常处理】
 * - 任何步骤抛出异常都会被捕获
 * - 输出错误日志，返回原始响应
 */
function main() {
    // 第1步：环境初始化
    const env = new Environment(META.name);

    try {
        // 输出启动信息
        env.info(`Starting ${META.name} v${META.version} on ${env.platform}`);

        // 第2步：统一获取URL（关键优化，避免undefined）
        const requestUrl = env.getCurrentUrl();
        
        if (!requestUrl) {
            env.error('No URL found in request/response');
            env.done({});
            return;
        }

        env.debug(`Processing URL: ${requestUrl}`);

        // 第3步：动态加载插件（只加载匹配的1个）
        const pluginManager = new PluginManager();
        let appConfig = pluginManager.loadForUrl(requestUrl, APP_CONFIGS);
        
        // 回退策略：如果动态加载失败，尝试全量加载
        if (!appConfig) {
            pluginManager.registerAll(APP_CONFIGS);
            // 再次尝试匹配
            appConfig = pluginManager.loadForUrl(requestUrl, APP_CONFIGS);
        }

        // 最终回退：使用默认配置
        if (!appConfig) {
            env.warn('App not detected, using generic config');
            appConfig = {
                name: 'Generic',
                mode: 'json',
                customProcessor: ProcessorUtils.setFields({
                    'data.is_vip': 1,
                    'data.vip_expire_date': CONSTANTS.EXPIRE_TIMESTAMP
                })
            };
        } else {
            env.info(`Matched app: ${appConfig.name}`);
        }

        // 第4步：执行处理
        const engine = new VipUnlockEngine(env);
        engine.setConfig(appConfig);

        const response = env.getResponse();
        // 传递已获取的URL，确保multipath模式不会拿到undefined
        const result = engine.process(response, requestUrl);
        
        // 第5步：输出统计并返回
        const stats = engine.getStats();
        env.info(`Completed in ${stats.duration}ms, ${stats.modifications} modifications`);

        env.done(result);

    } catch (e) {
        // 全局异常捕获，确保脚本不会崩溃
        env.error(`Fatal error: ${e.message}`);
        env.done({ body: $response?.body });  // 返回原始响应
    }
}

// 执行入口
main();
