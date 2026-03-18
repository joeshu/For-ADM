/**
 * ==========================================
 * Unified VIP Unlock Manager
 * 统一 VIP 解锁管理器
 * @version 12.1.0
 * @description 插件化架构，支持 JSON对象/正则替换/游戏数值/混合/多路径/HTML替换 多模式，新增调试模式
 * ==========================================
 *
 * 【架构设计】
 * 本脚本采用插件化设计，支持六种处理模式：
 * 1. JSON 对象模式（json）：纯 JSON 字段映射或自定义处理器，适合标准 API 接口
 * 2. 正则替换模式（regex）：批量正则替换文本，适合复杂非结构化接口
 * 3. 游戏数值模式（game）：转义 JSON 数值替换，适合游戏类应用
 * 4. 混合模式（hybrid）：JSON为主，失败回退正则替换，适合需要容错处理的复杂接口
 * 5. 多路径模式（multipath）：根据 URL 路径执行不同处理逻辑，适合去广告场景
 * 6. HTML 替换模式（html）：直接操作 HTML 文本内容，适合网页去广告
 *
 * 【新增 foday 说明】
 * 复游会是旅游类微信小程序，接口特点：
 * - 两个不同路径需要不同处理（页面组件/广告推荐）
 * - 使用数组过滤（filter）排除特定广告组件
 * - 使用 Set 数据结构提高查找效率
 * - 广告组件代码：TCMP_home_followingadvertising、TC_Interactive_Ad、TC_Member_Banner、TC_AIGO
 *
 * 【调试模式说明】
 * - 设置 debugMode: true 开启详细执行日志
 * - 设置 logLevel 控制日志详细程度（DEBUG/INFO/WARN/ERROR）
 * - 在应用配置中单独设置，方便定位问题
 *
 * 【使用说明】
 * 1. 在 [rewrite_local] 中配置不同应用的规则，指向此统一文件
 * 2. 在 APP_CONFIGS 配置区添加新应用配置即可自动生效
 * 3. 脚本会自动根据 URL 识别当前请求对应的应用
 *
 * 【配置示例】
 [rewrite_local]
  # iAppDaily - 余额查询接口（JSON模式-字段映射）
  ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # TopHub - 账户同步接口（JSON模式-字段映射+包装器）
  ^https?:\/\/(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # gps - GPS工具箱（JSON模式-字段映射）
  ^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # kyxq - 口语星球（JSON模式-自定义处理器-多场景）
  ^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # mhlz - 魔幻粒子（JSON模式-自定义处理器-嵌套遍历+条件逻辑）
  ^https?:\/\/ss\.landintheair\.com\/storage\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # v2ex - V2EX去广告（HTML替换模式）
  ^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf))))) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
 # foday - 复游会去广告（多路径模式-数组过滤）
  ^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
 # qiujingapp - 球竞APP去广告（多路径模式-数组清空）
  ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(3|6|8|11)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # Keep - 课程/会员接口（正则替换模式）
  ^https?:\/\/(api|kit).gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # bqwz - 标枪王者游戏数据接口（游戏数值模式）
  ^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # bxkt - 伴学课堂接口（混合模式）
  ^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
  # tv - 影视去广告接口（多路径模式）
  ^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
 
 [mitm]
 hostname = api.iappdaily.com, api2.tophub.today, api2.tophub.app, api3.tophub.xyz, api3.tophub.today, api3.tophub.app, tophub.tophubdata.com, tophub2.tophubdata.com, tophub.idaily.today, tophub2.idaily.today, tophub.remai.today, tophub.iappdaiy.com, tophub.ipadown.com, service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com, api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com
 */


'use strict';

// ==========================================
// 全局调试配置区 - 控制整体日志行为
// ==========================================

/**
 * 全局调试配置
 * debugMode: 是否开启调试模式（显示详细执行步骤）
 * logLevel: 日志级别 DEBUG/INFO/WARN/ERROR（默认INFO，DEBUG显示所有，ERROR只显示错误）
 * enableTimestamp: 是否在日志中添加时间戳
 */
const GLOBAL_DEBUG_CONFIG = {
    debugMode: false,           // 全局调试开关
    logLevel: 'INFO',          // 全局日志级别：DEBUG/INFO/WARN/ERROR
    enableTimestamp: true,     // 启用时间戳
    maxLogLength: 500          // 单条日志最大长度，防止过长日志
};

// ==========================================
// 配置区 - 新增应用只需在此添加配置，无需修改下方核心逻辑
// ==========================================

/**
 * 应用配置对象
 * 每个键对应一个应用的配置，包含以下属性：
 * - id: 应用唯一标识（小写，无空格）
 * - name: 应用显示名称（用于日志）
 * - urlPattern: URL 正则表达式，用于自动识别当前请求对应的应用
 * 
 * 【调试配置】（可选，不设置则使用全局配置）
 * - debugMode: 单独开启该应用的调试模式
 * - logLevel: 单独设置该应用的日志级别
 * 
 * 【处理模式选择】
 * 模式一：JSON 对象模式（json）
 * - 使用 fields 配置简单字段映射
 * - 或使用 customProcessor 实现复杂逻辑
 * - 适合结构化的标准 JSON 接口
 *
 * 模式二：正则替换模式（regex）
 * - 使用 regexReplacements 配置正则规则数组
 * - 直接操作文本，不解析 JSON
 * - 适合数据结构复杂、字段不统一的接口
 *
 * 模式三：游戏数值模式（game）
 * - 使用 gameResources 配置游戏资源数值
 * - 专门针对转义 JSON 中的数值字段替换
 * - 适合游戏类应用修改金币/钻石/经验等
 *
 * 模式四：混合模式（hybrid）
 * - 优先使用 JSON 对象处理（含数组遍历逻辑）
 * - JSON 解析失败时自动回退到正则替换
 * - 适合需要容错处理的复杂接口
 *
 * 模式五：多路径模式（multipath）
 * - 根据 URL 路径执行不同处理逻辑
 * - 每个路径可配置不同操作（删除、置空、数组清空/过滤等）
 * - 适合去广告场景（foday、qiujingapp、tv等）
 *
 * 模式六：HTML 替换模式（html）
 * - 直接操作 HTML 文本内容
 * - 使用正则匹配替换特定标签或内容
 * - 适合网页去广告（V2EX等）
 */
const APP_CONFIGS = {
    /**
     * iAppDaily 应用配置
     * 原文件：iappdaily.js
     * 处理模式：JSON 对象模式（简单字段映射）
     * 功能：修改余额查询接口，激活 VIP 并增加金币
     */
    iappdaily: {
        id: 'iappdaily',
        name: 'iAppDaily',
        urlPattern: /api\.iappdaily\.com\/my\/balance/,
        
        // 调试配置（可选，覆盖全局配置）
        // debugMode: true,
        // logLevel: 'DEBUG',

        fields: {
            isVip: { path: 'data.is_vip', value: 1, type: 'number' },
            isPaid: { path: 'data.is_paid', value: 1, type: 'number' },
            vipExpired: { path: 'data.vip_expired', value: 4102444800, type: 'number' },
            remainCoins: { path: 'data.remain_coins', value: 9999, type: 'number' },
            totalCoins: { path: 'data.total_coins', value: 9999, type: 'number' }
        },

        responseWrapper: null,
        customProcessor: null,
        mode: 'json'
    },

    /**
     * TopHub 应用配置
     * 原文件：tophub.js
     * 处理模式：JSON 对象模式（字段映射+响应包装器）
     * 功能：修改账户同步接口，强制返回永久 VIP 状态
     */
    tophub: {
        id: 'tophub',
        name: 'TopHub',
        urlPattern: /(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync/,

        fields: {
            error: { path: 'error', value: 0, type: 'number' },
            status: { path: 'status', value: 200, type: 'number' },
            isVip: { path: 'data.is_vip', value: "1", type: 'string' },
            isVipNow: { path: 'data.is_vip_now', value: 1, type: 'number' },
            vipExpired: { path: 'data.vip_expired', value: "2099-12-31 23:59:59", type: 'string' },
            vipType: { path: 'data.vip_type', value: "lifetime", type: 'string' },
            vipLevel: { path: 'data.vip_level', value: 99, type: 'number' }
        },

        responseWrapper: {
            enabled: true,
            template: {
                error: 0,
                status: 200,
                data: {
                    is_vip: "1",
                    is_vip_now: 1,
                    vip_expired: "2099-12-31 23:59:59",
                    vip_type: "lifetime",
                    vip_level: 99
                }
            }
        },

        customProcessor: null,
        mode: 'json'
    },

    /**
     * gps 应用配置
     * 原文件：gps.js（作者：joeshu）
     * 处理模式：JSON 对象模式（简单字段映射）
     * 功能：GPS工具箱 VIP 解锁（多种VIP类型）
     */
    gps: {
        id: 'gps',
        name: 'GPS工具箱',
        urlPattern: /^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo/,
        mode: 'json',

        fields: {
            isVip: { path: 'data.is_vip', value: 1, type: 'number' },
            vipName: { path: 'data.vip_name', value: "VIP会员", type: 'string' },
            vipExpireDate: { path: 'data.vip_expire_date', value: 2099999, type: 'number' },
            isSuperVip: { path: 'data.is_super_vip', value: 1, type: 'number' },
            isPowerVip: { path: 'data.is_power_vip', value: 1, type: 'number' },
            groupVip: { path: 'data.group_vip', value: 1, type: 'number' },
            groupVipExpireDate: { path: 'data.group_vip_expire_date', value: 2099999, type: 'number' }
        },

        responseWrapper: null,
        customProcessor: null
    },

    /**
     * kyxq 应用配置
     * 原文件：kyxq.js（作者：WeiGiegie）
     * 处理模式：JSON 对象模式（自定义处理器-多场景）
     * 功能：口语星球 VIP 解锁（多场景处理）
     */
    kyxq: {
        id: 'kyxq',
        name: '口语星球',
        urlPattern: /^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2/,
        mode: 'json',

        customProcessor: function(obj, env) {
            if (obj.data) {
                if (typeof obj.data === 'object' && !Array.isArray(obj.data)) {
                    env.log('Processing permission interface (object type)');

                    obj.data.expireDate = CONSTANTS.EXPIRE_TIMESTAMP_MS;
                    obj.data.havePermission = true;
                    obj.data.type = 2;
                    obj.data.isVip = true;

                    if (obj.data.vipLevel !== undefined) {
                        obj.data.vipLevel = 10;
                        env.log('Set vipLevel: 10');
                    }

                    env.log('Permission interface processed: VIP activated');
                }
                else if (Array.isArray(obj.data)) {
                    env.log(`Processing course list interface (array type, ${obj.data.length} courses)`);

                    let modifiedCount = 0;
                    obj.data.forEach((course, index) => {
                        course.overTime = CONSTANTS.EXPIRE_TIMESTAMP_MS;

                        if (course.status !== undefined) {
                            course.status = 1;
                        }

                        if (course.isStudyIng !== undefined) {
                            course.isStudyIng = 1;
                        }

                        modifiedCount++;
                    });

                    env.log(`Course list processed: ${modifiedCount} courses unlocked`);
                }
            }
            return obj;
        },

        fields: null,
        responseWrapper: null,
        regexReplacements: null
    },

    /**
     * mhlz 应用配置
     * 原文件：mhlz.js（作者：WeiGiegie）
     * 处理模式：JSON 对象模式（自定义处理器-嵌套遍历+条件逻辑）
     * 功能：魔幻粒子游戏货币修改（任务进度/普通货币/事件货币区分处理）
     */
    mhlz: {
        id: 'mhlz',
        name: '魔幻粒子',
        urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
        mode: 'json',

        customProcessor: function(obj, env) {
            if (obj && obj.currencies && obj.currencies.list) {
                let questCount = 0;
                let currencyCount = 0;
                let eventCount = 0;

                for (let key in obj.currencies.list) {
                    let currency = obj.currencies.list[key];

                    if (key.startsWith("Quest_")) {
                        if (currency.amount !== undefined) {
                            currency.amount = "1";
                        }
                        if (currency.total_collected !== undefined) {
                            currency.total_collected = "1";
                        }
                        questCount++;
                    }
                    else if (key.startsWith("Event_")) {
                        eventCount++;
                    }
                    else {
                        if (currency.amount !== undefined) {
                            currency.amount = CONSTANTS.BIG_NUMBER_STR;
                        }
                        if (currency.total_collected !== undefined) {
                            currency.total_collected = CONSTANTS.BIG_NUMBER_STR;
                        }
                        currencyCount++;
                    }
                }

                env.log(`Currency processing completed: ${questCount} quests, ${currencyCount} currencies, ${eventCount} events (preserved)`);
            } else {
                env.log('Currency structure not found (obj.currencies.list)');
            }
            return obj;
        },

        fields: null,
        responseWrapper: null,
        regexReplacements: null
    },

    /**
     * v2ex 应用配置
     * 原文件：v2ex.ads.js（作者：ddgksf2013）
     * 处理模式：HTML 替换模式（网页去广告专用）
     * 功能：V2EX 技术社区网站去广告（注入 CSS 隐藏广告元素）
     */
    v2ex: {
        id: 'v2ex',
        name: 'V2EX去广告',
        urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
        mode: 'html',

        htmlReplacements: [
            {
                pattern: /<head>/i,
                replacement: `<head>
<style>
    .sidebar_compliance, .sidebar_ads, .ads, .advertisement, .sponsor, .banner-ads { display: none !important; }
    #Top .content { max-width: 100% !important; }
</style>`,
                description: '注入CSS隐藏广告元素'
            }
        ],

        fields: null,
        responseWrapper: null,
        customProcessor: null,
        regexReplacements: null,
        gameResources: null,
        pathHandlers: null
    },

    /**
     * foday 应用配置
     * 原文件：foday.js（作者：joeshu）
     * 处理模式：多路径模式（去广告专用-数组过滤）
     * 功能：复游会微信小程序去广告（页面组件过滤）
     *
     * 【foday 特殊说明】
     * 复游会是旅游类微信小程序，接口特点：
     * 1. 两个不同路径需要不同处理：
     *    - /getPageComponents - 页面组件接口，过滤广告组件
     *    - /getAdAndRecommendedProduct - 广告推荐接口（在 rewrite_local 中用正则替换处理）
     * 2. 使用数组过滤（filter）排除特定广告组件
     * 3. 使用 Set 数据结构提高查找效率
     * 4. 广告组件代码：
     *    - TCMP_home_followingadvertising（首页跟随广告）
     *    - TC_Interactive_Ad（互动广告）
     *    - TC_Member_Banner（会员横幅）
     *    - TC_AIGO（AIGO广告）
     */
    foday: {
        id: 'foday',
        name: '复游会',
        // 匹配 getPageComponents 接口（getAdAndRecommendedProduct 在 rewrite_local 中用正则替换处理）
        urlPattern: /^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents/,
        mode: 'multipath',

        /**
         * 多路径处理配置
         * 路径1：过滤 pageComponents 数组中的广告组件
         */
        pathHandlers: [
            {
                path: '/getPageComponents',
                description: '页面组件接口 - 过滤广告组件',
                actions: [
                    {
                        type: 'custom',
                        description: '使用 Set 过滤广告组件',
                        processor: function(obj, env) {
                            // 原代码逻辑：
                            // const excludedSet = new Set(["TCMP_home_followingadvertising","TC_Interactive_Ad","TC_Member_Banner","TC_AIGO"]);
                            // if (obj?.data?.pageComponents?.length > 0) {
                            //     obj.data.pageComponents = obj.data.pageComponents.filter(item => !excludedSet.has(item.componentCode));
                            // }

                            // 使用 Set 存储需要排除的广告组件代码（提高查找效率）
                            const excludedSet = new Set([
                                "TCMP_home_followingadvertising", // 首页跟随广告
                                "TC_Interactive_Ad", // 互动广告
                                "TC_Member_Banner", // 会员横幅
                                "TC_AIGO" // AIGO广告
                            ]);

                            // 安全访问嵌套属性（可选链操作符效果）
                            if (obj && obj.data && obj.data.pageComponents &&
                                Array.isArray(obj.data.pageComponents) &&
                                obj.data.pageComponents.length > 0) {

                                let originalLength = obj.data.pageComponents.length;

                                // 过滤掉广告组件（保留非广告组件）
                                obj.data.pageComponents = obj.data.pageComponents.filter(
                                    item => !excludedSet.has(item.componentCode)
                                );

                                let filteredLength = obj.data.pageComponents.length;
                                let removedCount = originalLength - filteredLength;

                                env.log(`Filtered pageComponents: ${originalLength} -> ${filteredLength} (removed ${removedCount} ad components)`);
                            } else {
                                env.log('pageComponents not found or empty, skipping');
                            }

                            return obj;
                        }
                    }
                ]
            }
        ],

        fields: null,
        responseWrapper: null,
        customProcessor: null,
        regexReplacements: null,
        gameResources: null
    },

    /**
     * qiujingapp 应用配置
     * 原文件：qiujingapp.js（作者：joeshu）
     * 处理模式：多路径模式（去广告专用-数组清空）
     * 功能：球竞APP去广告（轮播广告/弹窗推广数组清空）
     */
    qiujingapp: {
        id: 'qiujingapp',
        name: '球竞APP',
        urlPattern: /^https?:\/\/gateway-api\.yizhilive\.com\/api\/(v2\/index\/carouses\/(3|6|8|11)|v3\/index\/all)/,
        mode: 'multipath',

        pathHandlers: [
            {
                path: '/api/v2/index/carouses/',
                description: '轮播广告接口 - 清空广告数组',
                pathRegex: /\/api\/v2\/index\/carouses\/(11|8|6|3)\b/,
                actions: [
                    {
                        type: 'custom',
                        description: '清空 obj.data 广告数组',
                        processor: function(obj, env) {
                            if (Array.isArray(obj.data)) {
                                let originalLength = obj.data.length;
                                obj.data = [];
                                env.log(`Cleared carouses data array: ${originalLength} items -> 0 items`);
                            } else {
                                env.log('obj.data is not an array, skipping');
                            }
                            return obj;
                        }
                    }
                ]
            },
            {
                path: '/api/v3/index/all',
                description: '弹窗推广接口 - 清空 banners 数组',
                urlContains: 'position=2',
                actions: [
                    {
                        type: 'custom',
                        description: '清空 obj.data.banners 广告数组',
                        processor: function(obj, env) {
                            if (obj.data && obj.data.banners) {
                                let originalLength = Array.isArray(obj.data.banners) ? obj.data.banners.length : 'non-array';
                                obj.data.banners = [];
                                env.log(`Cleared banners array: ${originalLength} items -> 0 items`);
                            } else {
                                env.log('obj.data.banners not found, skipping');
                            }
                            return obj;
                        }
                    }
                ]
            }
        ],

        fields: null,
        responseWrapper: null,
        customProcessor: null,
        regexReplacements: null,
        gameResources: null
    },

    /**
     * Keep 应用配置
     * 原文件：keep.js（作者：WeiGiegie）
     * 处理模式：正则替换模式（特殊）
     * 功能：解锁课程预览、直播课、会员付费课跟练、会员训练计划
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
        ],

        fields: null,
        responseWrapper: null,
        customProcessor: null
    },

    /**
     * bqwz 应用配置
     * 原文件：bqwz.js（作者：WeiGiegie）
     * 处理模式：游戏数值模式（转义 JSON 正则替换）
     * 功能：标枪王者游戏数据修改（金币/钻石/经验/排位券/PVE体力）
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
        ],

        fields: null,
        responseWrapper: null,
        customProcessor: null,
        regexReplacements: null
    },

    /**
     * bxkt 应用配置
     * 原文件：bxkt.js（作者：WeiGiegie）
     * 处理模式：混合模式（JSON为主，失败回退正则）
     * 功能：伴学课堂 VIP 解锁，遍历嵌套数组解锁所有视频
     */
    bxkt: {
        id: 'bxkt',
        name: '伴学课堂',
        urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
        mode: 'hybrid',

        customProcessor: function(obj, env) {
            if (obj && obj.data) {
                let data = obj.data;

                data.isVip = true;
                data.isHave = true;
                data.isLock = false;
                data.isSale = true;
                data.isVipExpire = false;
                data.originalPrice = 0;
                data.salePrice = 0;
                data.trialTopNum = 999;

                env.log('Modified top-level fields: isVip=true, isHave=true, isLock=false, etc.');

                if (Array.isArray(data.refBusinessList)) {
                    let unlockCount = 0;
                    data.refBusinessList.forEach((item, index) => {
                        if (item && item.isLock === true) {
                            item.isLock = false;
                            unlockCount++;
                        }
                    });
                    env.log(`Unlocked ${unlockCount} items in refBusinessList`);
                }
            }
            return obj;
        },

        regexReplacements: [
            { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' },
            { pattern: /"isHave":false/g, replacement: '"isHave":true', description: '拥有状态回退' },
            { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态回退' }
        ],

        fields: null,
        responseWrapper: null
    },

    /**
     * tv 应用配置
     * 原文件：tv.js（作者：joeshu）
     * 处理模式：多路径模式（去广告专用）
     * 功能：影视应用去广告（开屏广告、焦点图广告、浮层广告、弹窗广告、列表广告）
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
                    { type: 'set', field: 'data.startAdShowTime', value: 0, description: '开屏广告显示时间置0' },
                    { type: 'set', field: 'data.startAd', value: null, description: '开屏广告对象置空' },
                    { type: 'set', field: 'data.startAdList', value: null, description: '开屏广告列表置空' }
                ]
            },
            {
                path: '/home/firstScreen',
                description: '首页首屏 - 去除焦点图广告、精简热门模块',
                actions: [
                    { type: 'delete', field: 'data.focusAdList', description: '删除焦点图广告列表' },
                    {
                        type: 'custom',
                        description: '热门模块列表保留前5个',
                        processor: function(obj, env) {
                            if (obj.data && obj.data.hotMudleList && Array.isArray(obj.data.hotMudleList)) {
                                let originalLength = obj.data.hotMudleList.length;
                                obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
                                env.log(`Sliced hotMudleList: ${originalLength} -> ${obj.data.hotMudleList.length}`);
                            }
                            return obj;
                        }
                    }
                ]
            },
            {
                path: '/adInfo/getPageAd',
                description: '页面广告接口 - 去除浮层和弹窗广告',
                actions: [
                    { type: 'delete', field: 'data.floatAd', description: '删除浮层广告' },
                    { type: 'delete', field: 'data.popupAd', description: '删除弹窗广告' }
                ]
            },
            {
                path: '/home/body',
                description: '首页主体 - 去除列表首个广告',
                actions: [
                    {
                        type: 'custom',
                        description: '广告列表shift移除首个',
                        processor: function(obj, env) {
                            if (obj.data && obj.data.adList && Array.isArray(obj.data.adList) && obj.data.adList.length > 0) {
                                let removed = obj.data.adList.shift();
                                env.log(`Removed first ad from adList: ${removed?.title || 'item'}`);
                            }
                            return obj;
                        }
                    }
                ]
            }
        ],

        fields: null,
        responseWrapper: null,
        customProcessor: null,
        regexReplacements: null,
        gameResources: null
    }

    // ==========================================
    // 新增应用配置示例：
    // ==========================================

    // 示例 1-7 省略（与之前版本相同）
};

// ==========================================
// 常量定义区 - 全局使用的常量值
// ==========================================

const CONSTANTS = {
    EXPIRE_DATE: "2099-12-31 23:59:59",
    EXPIRE_TIMESTAMP: 4102444800,
    EXPIRE_TIMESTAMP_MS: 4102416000000,
    BIG_NUMBER_STR: "9999999999999999999988888888",
    DEFAULT_COINS: 9999,
    DEFAULT_VIP_LEVEL: 99,
    DEFAULT_VIP_TYPE: "lifetime"
};

// ==========================================
// 日志级别常量
// ==========================================
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// ==========================================
// 工具类 - Env 兼容层（增强版，支持调试配置）
// ==========================================

class Env {
    constructor(name, debugConfig = {}) {
        this.name = name;
        this.isQX = typeof $task !== 'undefined';
        this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
        this.isLoon = typeof $loon !== 'undefined';
        
        // 合并调试配置：应用配置 > 全局配置 > 默认值
        this.debugConfig = {
            ...GLOBAL_DEBUG_CONFIG,
            ...debugConfig
        };
        
        // 解析日志级别
        this.currentLogLevel = LOG_LEVELS[this.debugConfig.logLevel] || LOG_LEVELS.INFO;
        
        // 记录启动信息
        this.log('DEBUG', `Env initialized - DebugMode: ${this.debugConfig.debugMode}, LogLevel: ${this.debugConfig.logLevel}`);
    }

    /**
     * 分级日志输出
     * @param {string} level - 日志级别 DEBUG/INFO/WARN/ERROR
     * @param {string} msg - 日志内容
     */
    log(level, msg) {
        // 兼容旧版调用方式：如果第一个参数不是级别，则视为消息
        if (arguments.length === 1) {
            msg = level;
            level = 'INFO';
        }
        
        const levelValue = LOG_LEVELS[level] || LOG_LEVELS.INFO;
        
        // 检查日志级别是否允许输出
        if (levelValue < this.currentLogLevel) {
            return;
        }
        
        // 截断过长日志
        let formattedMsg = String(msg);
        if (formattedMsg.length > this.debugConfig.maxLogLength) {
            formattedMsg = formattedMsg.substring(0, this.debugConfig.maxLogLength) + '... [truncated]';
        }
        
        // 添加时间戳
        let prefix = `[${this.name}]`;
        if (this.debugConfig.enableTimestamp) {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
            prefix = `[${timeStr}]${prefix}`;
        }
        
        // 添加级别标识（DEBUG模式显示）
        if (this.debugConfig.debugMode || level !== 'INFO') {
            prefix += `[${level}]`;
        }
        
        console.log(`${prefix} ${formattedMsg}`);
    }

    /**
     * 调试日志 - 仅在DEBUG级别输出
     */
    debug(msg) {
        this.log('DEBUG', msg);
    }

    /**
     * 警告日志
     */
    warn(msg) {
        this.log('WARN', msg);
    }

    /**
     * 错误日志
     */
    error(msg) {
        this.log('ERROR', msg);
    }

    done(object) {
        $done(object);
    }

    getResponse() {
        return $response || {};
    }
}

// ==========================================
// 工具函数库
// ==========================================

const Utils = {
    safeJsonParse(str, defaultVal = {}) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return defaultVal;
        }
    },

    safeJsonStringify(obj) {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            console.log(`JSON stringify error: ${e}`);
            return '{}';
        }
    },

    getValueByPath(obj, path) {
        return path.split('.').reduce((acc, part) => {
            return acc && acc[part] !== undefined ? acc[part] : undefined;
        }, obj);
    },

    setValueByPath(obj, path, value) {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
        return obj;
    },

    detectApp(url, configs) {
        for (const key in configs) {
            if (configs[key].urlPattern && configs[key].urlPattern.test(url)) {
                return configs[key];
            }
        }
        return null;
    }
};

// ==========================================
// VIP 解锁核心引擎（增强版，带详细调试）
// 支持 JSON对象/正则替换/游戏数值/混合/多路径/HTML替换 六种模式
// ==========================================

class VipUnlockEngine {
    constructor(env) {
        this.env = env;
        this.config = null;
        this.executionTrace = []; // 执行追踪记录
    }

    setConfig(config) {
        this.config = config;
        this.env.log('INFO', `Initialized for: ${config.name} [Mode: ${config.mode || 'auto'}]`);
        this.env.debug(`Full config: ${JSON.stringify(config, (key, val) => typeof val === 'function' ? '[Function]' : val)}`);
    }

    /**
     * 记录执行步骤（用于调试）
     */
    trace(step, details = '') {
        const traceEntry = `[${step}] ${details}`;
        this.executionTrace.push(traceEntry);
        this.env.debug(`TRACE: ${traceEntry}`);
    }

    /**
     * 主处理入口
     * 根据配置的模式选择不同的处理方式
     */
    process(response) {
        this.trace('START', `Processing ${this.config.name}`);

        if (!response || !response.body) {
            this.env.error('No response body found');
            this.trace('ERROR', 'Empty response body');
            return {};
        }

        this.trace('BODY_CHECK', `Body length: ${response.body.length}, URL: ${response.url || 'N/A'}`);

        // 确定处理模式：显式配置 > 自动检测
        const mode = this.config.mode || this.detectMode();
        this.trace('MODE_DETECT', `Using mode: ${mode}`);

        // 根据模式分发到不同处理器
        switch (mode) {
            case 'html':
                // HTML 替换模式（v2ex）：直接操作 HTML 文本
                return this.processHtmlMode(response.body);
            case 'multipath':
                // 多路径模式（tv/qiujingapp/foday）：根据 URL 路径执行不同逻辑
                return this.processMultipathMode(response.body, response.url);
            case 'hybrid':
                // 混合模式（bxkt）：JSON为主，失败回退正则
                return this.processHybridMode(response.body);
            case 'game':
                // 游戏数值模式（bqwz）
                return this.processGameMode(response.body);
            case 'regex':
                // 正则替换模式（Keep）
                return this.processRegexMode(response.body);
            case 'json':
            default:
                // JSON 对象模式（iAppDaily/TopHub/gps/kyxq/mhlz）
                return this.processJsonMode(response.body);
        }
    }

    /**
     * 自动检测处理模式
     * 优先级：htmlReplacements > pathHandlers > customProcessor+regexReplacements > gameResources > regexReplacements > fields > json
     */
    detectMode() {
        this.trace('DETECT_MODE', 'Starting mode detection...');

        // 有 htmlReplacements -> HTML 替换模式（v2ex）
        if (this.config.htmlReplacements && Array.isArray(this.config.htmlReplacements)) {
            this.trace('DETECT_RESULT', 'Detected: html (has htmlReplacements)');
            return 'html';
        }
        // 有 pathHandlers -> 多路径模式（tv/qiujingapp/foday）
        if (this.config.pathHandlers && Array.isArray(this.config.pathHandlers)) {
            this.trace('DETECT_RESULT', 'Detected: multipath (has pathHandlers)');
            return 'multipath';
        }
        // 同时有 customProcessor 和 regexReplacements -> 混合模式
        if (this.config.customProcessor && this.config.regexReplacements) {
            this.trace('DETECT_RESULT', 'Detected: hybrid (has customProcessor + regexReplacements)');
            return 'hybrid';
        }
        if (this.config.gameResources && Array.isArray(this.config.gameResources)) {
            this.trace('DETECT_RESULT', 'Detected: game (has gameResources)');
            return 'game';
        }
        if (this.config.regexReplacements && Array.isArray(this.config.regexReplacements)) {
            this.trace('DETECT_RESULT', 'Detected: regex (has regexReplacements)');
            return 'regex';
        }
        if (this.config.fields && typeof this.config.fields === 'object') {
            this.trace('DETECT_RESULT', 'Detected: json (has fields)');
            return 'json';
        }
        
        this.trace('DETECT_RESULT', 'Defaulting to: json');
        return 'json';
    }

    /**
     * HTML 替换处理模式（v2ex）
     * 直接操作 HTML 文本内容，使用正则匹配替换特定标签
     */
    processHtmlMode(body) {
        this.trace('HTML_MODE', 'Starting HTML processing');
        
        let modifiedBody = body;
        const replacements = this.config.htmlReplacements || [];

        if (replacements.length === 0) {
            this.env.warn('No HTML replacements configured');
            return { body };
        }

        this.env.log('INFO', `Starting HTML replacements (${replacements.length} rules)`);

        for (let i = 0; i < replacements.length; i++) {
            const rule = replacements[i];
            try {
                this.trace('HTML_RULE', `Rule ${i + 1}/${replacements.length}: ${rule.description || 'unnamed'}`);
                
                const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
                const originalBody = modifiedBody;

                modifiedBody = modifiedBody.replace(pattern, rule.replacement);

                if (originalBody !== modifiedBody) {
                    this.env.log('INFO', `Applied: ${rule.description || 'unnamed rule'}`);
                    this.trace('HTML_SUCCESS', `Rule ${i + 1} applied successfully`);
                } else {
                    this.env.debug(`Pattern not matched: ${rule.description || 'unnamed rule'}`);
                    this.trace('HTML_SKIP', `Rule ${i + 1} pattern not matched`);
                }
            } catch (e) {
                this.env.error(`HTML replacement error in rule "${rule.description}": ${e}`);
                this.trace('HTML_ERROR', `Rule ${i + 1} error: ${e.message}`);
            }
        }

        this.env.log('INFO', `Ad removal completed for ${this.config.name} (HTML mode)`);
        this.trace('HTML_DONE', `Body length changed: ${body.length} -> ${modifiedBody.length}`);
        
        return { body: modifiedBody };
    }

    /**
     * 多路径处理模式（tv/qiujingapp/foday）
     * 根据 URL 路径匹配不同处理逻辑，支持多种操作类型
     *
     * 【增强功能】
     * - 支持 pathRegex 正则验证（qiujingapp 需求）
     * - 支持 urlContains 额外验证（qiujingapp 需求）
     */
    processMultipathMode(body, url) {
        this.trace('MULTIPATH_MODE', `Starting multipath processing, URL: ${url}`);
        
        let obj = Utils.safeJsonParse(body);

        if (!obj || Object.keys(obj).length === 0) {
            this.env.error('Failed to parse response body');
            this.trace('PARSE_ERROR', 'JSON parse failed or empty object');
            return { body };
        }

        this.trace('PARSE_SUCCESS', `Parsed JSON with keys: ${Object.keys(obj).join(', ')}`);

        // 检查是否有 data 字段（多路径模式通常需要）
        if (!obj.data) {
            this.env.warn('No data field found in response');
            this.trace('DATA_CHECK', 'Missing obj.data field');
            return { body: Utils.safeJsonStringify(obj) };
        }

        const pathHandlers = this.config.pathHandlers || [];
        let matchedHandler = null;

        this.trace('PATH_SCAN', `Scanning ${pathHandlers.length} path handlers...`);

        // 遍历所有路径处理器，查找匹配的路径
        for (let i = 0; i < pathHandlers.length; i++) {
            const handler = pathHandlers[i];
            this.trace('PATH_CHECK', `Checking handler ${i + 1}: ${handler.path}`);
            
            // 基础路径匹配（indexOf）
            if (url.indexOf(handler.path) !== -1) {
                this.trace('PATH_MATCH', `Basic match found for: ${handler.path}`);
                
                // 额外验证1：pathRegex 正则验证（如 qiujingapp 的 /carouses/(3|6|8|11)）
                if (handler.pathRegex && !handler.pathRegex.test(url)) {
                    this.trace('PATH_REGEX_FAIL', `pathRegex validation failed for: ${handler.path}`);
                    continue; // 正则验证失败，跳过此处理器
                }
                
                if (handler.pathRegex) {
                    this.trace('PATH_REGEX_PASS', `pathRegex validation passed`);
                }

                // 额外验证2：urlContains 包含验证（如 qiujingapp 的 position=2）
                if (handler.urlContains && url.indexOf(handler.urlContains) === -1) {
                    this.trace('PATH_CONTAINS_FAIL', `urlContains validation failed, missing: ${handler.urlContains}`);
                    continue; // URL 不包含指定字符串，跳过此处理器
                }
                
                if (handler.urlContains) {
                    this.trace('PATH_CONTAINS_PASS', `urlContains validation passed: ${handler.urlContains}`);
                }

                matchedHandler = handler;
                break;
            }
        }

        // 找到匹配的路径处理器
        if (matchedHandler) {
            this.env.log('INFO', `Matched path handler: ${matchedHandler.path} (${matchedHandler.description})`);
            this.trace('HANDLER_FOUND', `Selected handler: ${matchedHandler.path} with ${matchedHandler.actions.length} actions`);

            // 执行该路径的所有操作
            for (let i = 0; i < matchedHandler.actions.length; i++) {
                const action = matchedHandler.actions[i];
                this.trace('ACTION_START', `Executing action ${i + 1}/${matchedHandler.actions.length}: ${action.type} - ${action.description}`);
                
                try {
                    switch (action.type) {
                        case 'delete':
                            // 删除指定字段
                            if (Utils.getValueByPath(obj, action.field) !== undefined) {
                                const parts = action.field.split('.');
                                let current = obj;
                                for (let j = 0; j < parts.length - 1; j++) {
                                    current = current[parts[j]];
                                }
                                delete current[parts[parts.length - 1]];
                                this.env.log('INFO', `Deleted field: ${action.field} (${action.description})`);
                                this.trace('ACTION_DONE', `Deleted: ${action.field}`);
                            } else {
                                this.trace('ACTION_SKIP', `Field not found for delete: ${action.field}`);
                            }
                            break;

                        case 'set':
                            // 设置字段值
                            Utils.setValueByPath(obj, action.field, action.value);
                            this.env.log('INFO', `Set field: ${action.field} = ${JSON.stringify(action.value)} (${action.description})`);
                            this.trace('ACTION_DONE', `Set: ${action.field} = ${JSON.stringify(action.value)}`);
                            break;

                        case 'arraySlice':
                            // 数组切片（保留前N个）
                            {
                                const arr = Utils.getValueByPath(obj, action.field);
                                if (Array.isArray(arr)) {
                                    const originalLength = arr.length;
                                    const newArr = arr.slice(0, action.keepCount);
                                    Utils.setValueByPath(obj, action.field, newArr);
                                    this.env.log('INFO', `Sliced array: ${action.field} ${originalLength} -> ${newArr.length} (${action.description})`);
                                    this.trace('ACTION_DONE', `Sliced: ${action.field} ${originalLength} -> ${newArr.length}`);
                                } else {
                                    this.trace('ACTION_SKIP', `Not an array: ${action.field}`);
                                }
                            }
                            break;

                        case 'arrayShift':
                            // 数组 shift（移除第一个元素）
                            {
                                const arr = Utils.getValueByPath(obj, action.field);
                                if (Array.isArray(arr) && arr.length > 0) {
                                    const removed = arr.shift();
                                    this.env.log('INFO', `Shifted array: ${action.field}, removed: ${removed?.title || 'item'} (${action.description})`);
                                    this.trace('ACTION_DONE', `Shifted: ${action.field}, removed: ${removed?.title || 'item'}`);
                                } else {
                                    this.trace('ACTION_SKIP', `Cannot shift: ${action.field} not array or empty`);
                                }
                            }
                            break;

                        case 'custom':
                            // 自定义处理函数（foday/qiujingapp 主要使用此类型）
                            if (action.processor && typeof action.processor === 'function') {
                                this.trace('CUSTOM_START', `Executing custom processor: ${action.description}`);
                                const prevKeys = Object.keys(obj).join(',');
                                obj = action.processor(obj, this.env);
                                const newKeys = Object.keys(obj).join(',');
                                this.env.log('INFO', `Executed custom processor: ${action.description}`);
                                this.trace('CUSTOM_DONE', `Custom processor completed. Keys changed: ${prevKeys !== newKeys}`);
                            } else {
                                this.trace('CUSTOM_SKIP', 'No valid processor function');
                            }
                            break;

                        default:
                            this.env.warn(`Unknown action type: ${action.type}`);
                            this.trace('ACTION_UNKNOWN', `Unknown type: ${action.type}`);
                    }
                } catch (e) {
                    this.env.error(`Error executing action ${action.type}: ${e}`);
                    this.trace('ACTION_ERROR', `Action ${action.type} failed: ${e.message}`);
                }
            }

            this.env.log('INFO', `Ad removal completed for path: ${matchedHandler.path}`);
            this.trace('MULTIPATH_DONE', `All actions completed for ${matchedHandler.path}`);
        } else {
            this.env.warn('No matching path handler found for this URL');
            this.trace('NO_HANDLER', 'No path handler matched');
        }

        const result = Utils.safeJsonStringify(obj);
        this.trace('SERIALIZE', `Result body length: ${result.length}`);
        
        return { body: result };
    }

    /**
     * 混合处理模式（bxkt）
     * 优先尝试 JSON 解析 + customProcessor，失败时回退到正则替换
     */
    processHybridMode(body) {
        this.trace('HYBRID_MODE', 'Starting hybrid processing');
        
        let obj = Utils.safeJsonParse(body, null);

        if (obj !== null) {
            this.env.log('INFO', 'Hybrid mode: JSON parsed successfully, executing custom processor');
            this.trace('HYBRID_JSON', 'JSON parse success');

            if (this.config.customProcessor && typeof this.config.customProcessor === 'function') {
                try {
                    this.trace('CUSTOM_START', 'Executing custom processor');
                    obj = this.config.customProcessor(obj, this.env);
                    this.env.log('INFO', `VIP unlocked for ${this.config.name} (Hybrid-JSON mode)`);
                    this.trace('HYBRID_DONE', 'Custom processor completed');
                    return { body: Utils.safeJsonStringify(obj) };
                } catch (e) {
                    this.env.error(`Custom processor error: ${e}, falling back to regex`);
                    this.trace('CUSTOM_ERROR', `Processor failed: ${e.message}, falling back`);
                }
            }
        } else {
            this.trace('HYBRID_PARSE_FAIL', 'JSON parse failed, falling back to regex');
        }

        this.env.log('INFO', 'Hybrid mode: Falling back to regex replacements');
        return this.processRegexMode(body);
    }

    /**
     * JSON 对象处理模式
     * 解析 -> 包装器检查 -> 字段映射 -> 自定义处理 -> 序列化
     */
    processJsonMode(body) {
        this.trace('JSON_MODE', 'Starting JSON processing');
        
        let obj = Utils.safeJsonParse(body);

        if (!obj || Object.keys(obj).length === 0) {
            this.env.error('Failed to parse response body');
            this.trace('PARSE_ERROR', 'JSON parse failed');
            return { body };
        }

        this.trace('PARSE_SUCCESS', `Parsed JSON with keys: ${Object.keys(obj).join(', ')}`);

        if (this.config.responseWrapper && this.config.responseWrapper.enabled) {
            const hasData = Utils.getValueByPath(obj, 'data');
            if (!hasData || Object.keys(hasData).length === 0) {
                this.env.log('INFO', 'Data empty, creating new VIP response from template');
                this.trace('WRAPPER', 'Applied response wrapper template');
                obj = this.config.responseWrapper.template;
            } else {
                this.trace('WRAPPER_SKIP', 'Data exists, skipping wrapper');
            }
        }

        if (this.config.fields) {
            this.trace('FIELDS_START', `Applying ${Object.keys(this.config.fields).length} field mappings`);
            this.applyFieldMapping(obj);
        }

        if (this.config.customProcessor && typeof this.config.customProcessor === 'function') {
            this.trace('CUSTOM_START', 'Executing custom processor');
            const prevObj = JSON.stringify(obj);
            obj = this.config.customProcessor(obj, this.env);
            this.trace('CUSTOM_DONE', `Custom processor completed, changed: ${prevObj !== JSON.stringify(obj)}`);
        }

        this.env.log('INFO', `VIP unlocked for ${this.config.name} (JSON mode)`);
        this.trace('JSON_DONE', 'JSON processing completed');
        
        return { body: Utils.safeJsonStringify(obj) };
    }

    /**
     * 正则替换处理模式
     * 直接对文本进行批量正则替换，不解析 JSON
     */
    processRegexMode(body) {
        this.trace('REGEX_MODE', 'Starting regex processing');
        
        let modifiedBody = body;
        const replacements = this.config.regexReplacements || [];

        if (replacements.length === 0) {
            this.env.warn('No regex replacements configured');
            this.trace('REGEX_EMPTY', 'No replacements configured');
            return { body };
        }

        this.env.log('INFO', `Starting regex replacements (${replacements.length} rules)`);

        for (let i = 0; i < replacements.length; i++) {
            const rule = replacements[i];
            try {
                this.trace('REGEX_RULE', `Rule ${i + 1}/${replacements.length}: ${rule.description || 'unnamed'}`);
                
                const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'g');
                const originalBody = modifiedBody;

                modifiedBody = modifiedBody.replace(pattern, rule.replacement);

                if (originalBody !== modifiedBody) {
                    this.env.log('INFO', `Applied: ${rule.description || 'unnamed rule'}`);
                    this.trace('REGEX_SUCCESS', `Rule ${i + 1} applied, body length: ${originalBody.length} -> ${modifiedBody.length}`);
                } else {
                    this.env.debug(`Pattern not matched: ${rule.description || 'unnamed rule'}`);
                    this.trace('REGEX_SKIP', `Rule ${i + 1} pattern not matched`);
                }
            } catch (e) {
                this.env.error(`Regex error in rule "${rule.description}": ${e}`);
                this.trace('REGEX_ERROR', `Rule ${i + 1} error: ${e.message}`);
            }
        }

        this.env.log('INFO', `VIP unlocked for ${this.config.name} (Regex mode)`);
        this.trace('REGEX_DONE', `Completed, final length: ${modifiedBody.length}`);
        
        return { body: modifiedBody };
    }

    /**
     * 游戏数值处理模式（bqwz）
     * 专门针对转义 JSON 中的游戏资源数值替换
     */
    processGameMode(body) {
        this.trace('GAME_MODE', 'Starting game resource modification');
        
        let modifiedBody = body;
        const resources = this.config.gameResources || [];

        this.env.log('INFO', `Starting game resource modification (${resources.length} resources)`);

        for (let i = 0; i < resources.length; i++) {
            const resource = resources[i];
            try {
                this.trace('GAME_RULE', `Resource ${i + 1}/${resources.length}: ${resource.description} (${resource.field})`);
                
                const pattern = new RegExp(`\\\\"${resource.field}\\\\":\\\\d+`, 'g');
                const replacement = `\\\\"${resource.field}\\\\":${resource.value}`;

                const originalBody = modifiedBody;

                modifiedBody = modifiedBody.replace(pattern, replacement);

                if (originalBody !== modifiedBody) {
                    this.env.log('INFO', `Modified ${resource.description} (${resource.field}): ${resource.value}`);
                    this.trace('GAME_SUCCESS', `Modified ${resource.field}: ${resource.value}`);
                } else {
                    this.env.debug(`Field not found or already modified: ${resource.field}`);
                    this.trace('GAME_SKIP', `Pattern not found for: ${resource.field}`);
                }
            } catch (e) {
                this.env.error(`Error modifying ${resource.description}: ${e}`);
                this.trace('GAME_ERROR', `Resource ${i + 1} error: ${e.message}`);
            }
        }

        this.env.log('INFO', `Game resources modified for ${this.config.name} (Game mode)`);
        this.trace('GAME_DONE', `Completed, final length: ${modifiedBody.length}`);
        
        return { body: modifiedBody };
    }

    applyFieldMapping(obj) {
        const fields = this.config.fields;
        let modifiedCount = 0;
        let createdCount = 0;

        for (const key in fields) {
            const field = fields[key];
            const currentValue = Utils.getValueByPath(obj, field.path);
            const exists = this.pathExists(obj, field.path);

            if (currentValue !== undefined || exists) {
                Utils.setValueByPath(obj, field.path, field.value);
                this.env.log('INFO', `Modified ${field.path} = ${JSON.stringify(field.value)}`);
                modifiedCount++;
            } else {
                Utils.setValueByPath(obj, field.path, field.value);
                this.env.log('INFO', `Created ${field.path} = ${JSON.stringify(field.value)}`);
                createdCount++;
            }
        }
        
        this.trace('FIELDS_DONE', `Modified: ${modifiedCount}, Created: ${modifiedCount}`);
    }

    pathExists(obj, path) {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined || !(part in current)) {
                return false;
            }
            current = current[part];
        }
        return true;
    }
}

// ==========================================
// 插件管理器
// ==========================================

class PluginManager {
    constructor() {
        this.plugins = new Map();
    }

    register(id, config) {
        this.plugins.set(id, config);
        console.log(`Plugin registered: ${config.name} [${config.mode || 'auto'}]`);
    }

    getConfig(id) {
        return this.plugins.get(id);
    }

    autoDetect(url) {
        const detected = Utils.detectApp(url, Object.fromEntries(this.plugins));
        if (detected) return detected;
        return this.detectByResponseStructure();
    }

    detectByResponseStructure() {
        return null;
    }

    initConfigs(configs) {
        for (const key in configs) {
            this.register(key, configs[key]);
        }
    }
}

// ==========================================
// 主入口
// ==========================================

function main() {
    // 创建环境实例（使用全局调试配置）
    const env = new Env('UnifiedVIP');
    const pluginManager = new PluginManager();

    // 加载所有配置（iAppDaily、TopHub、gps、kyxq、mhlz、v2ex、foday、qiujingapp、Keep、bqwz、bxkt、tv）
    pluginManager.initConfigs(APP_CONFIGS);

    const response = env.getResponse();
    const requestUrl = response.url || (typeof $request !== 'undefined' ? $request.url : '');

    env.debug(`Request URL: ${requestUrl}`);
    env.debug(`Response body length: ${response.body ? response.body.length : 0}`);

    // 自动检测应用
    let appConfig = pluginManager.autoDetect(requestUrl);
    env.debug(`Auto-detect result: ${appConfig ? appConfig.name : 'none'}`);

    // 备用检测：通过脚本名称
    if (!appConfig) {
        const scriptTag = (typeof $script !== 'undefined' && $script.name) ? $script.name : '';
        env.debug(`Script tag: ${scriptTag}`);

        if (scriptTag.includes('iappdaily')) {
            appConfig = pluginManager.getConfig('iappdaily');
        } else if (scriptTag.includes('tophub')) {
            appConfig = pluginManager.getConfig('tophub');
        } else if (scriptTag.includes('gps')) {
            appConfig = pluginManager.getConfig('gps');
        } else if (scriptTag.includes('kyxq')) {
            appConfig = pluginManager.getConfig('kyxq');
        } else if (scriptTag.includes('mhlz')) {
            appConfig = pluginManager.getConfig('mhlz');
        } else if (scriptTag.includes('v2ex')) {
            appConfig = pluginManager.getConfig('v2ex');
        } else if (scriptTag.includes('foday')) {
            appConfig = pluginManager.getConfig('foday');
        } else if (scriptTag.includes('qiujingapp')) {
            appConfig = pluginManager.getConfig('qiujingapp');
        } else if (scriptTag.includes('keep')) {
            appConfig = pluginManager.getConfig('keep');
        } else if (scriptTag.includes('bqwz')) {
            appConfig = pluginManager.getConfig('bqwz');
        } else if (scriptTag.includes('bxkt')) {
            appConfig = pluginManager.getConfig('bxkt');
        } else if (scriptTag.includes('tv')) {
            appConfig = pluginManager.getConfig('tv');
        }
        
        if (appConfig) {
            env.debug(`Detected by script tag: ${appConfig.name}`);
        }
    }

    // 兜底：通用配置
    if (!appConfig) {
        env.warn('Could not detect app type, using generic VIP unlock');
        appConfig = {
            name: 'Generic',
            fields: {
                isVip: { path: 'data.is_vip', value: 1, type: 'number' },
                vipExpired: { path: 'data.vip_expire_date', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' }
            },
            responseWrapper: null,
            customProcessor: null,
            mode: 'json'
        };
    }

    // 提取应用的调试配置
    const appDebugConfig = {
        debugMode: appConfig.debugMode !== undefined ? appConfig.debugMode : GLOBAL_DEBUG_CONFIG.debugMode,
        logLevel: appConfig.logLevel || GLOBAL_DEBUG_CONFIG.logLevel,
        enableTimestamp: GLOBAL_DEBUG_CONFIG.enableTimestamp,
        maxLogLength: GLOBAL_DEBUG_CONFIG.maxLogLength
    };

    // 如果应用有独立的调试配置，重新创建env实例
    let finalEnv = env;
    if (appConfig.debugMode !== undefined || appConfig.logLevel) {
        finalEnv = new Env('UnifiedVIP', appDebugConfig);
        finalEnv.debug(`Using app-specific debug config for ${appConfig.name}`);
    }

    // 创建引擎并执行
    const engine = new VipUnlockEngine(finalEnv);
    engine.setConfig(appConfig);

    finalEnv.debug('Starting engine processing...');
    const result = engine.process(response);
    finalEnv.debug('Engine processing completed');

    finalEnv.done(result);
}

// 执行主函数
main();
