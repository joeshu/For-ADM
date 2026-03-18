/**
 * ==========================================
 * Unified VIP Unlock Manager v13.1.1
 * 统一 VIP 解锁管理器 - Bug修复版
 * @version 13.1.1
 * @description 修复 multipath 模式下 url undefined 错误
 * ==========================================
  [rewrite_local]
  # iAppDaily - 余额查询接口（JSON模式-字段映射）
  ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # TopHub - 账户同步接口（JSON模式-字段映射+包装器）
  ^https?:\/\/(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # gps - GPS工具箱（JSON模式-字段映射）
  ^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # kyxq - 口语星球（JSON模式-自定义处理器-多场景）
  ^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # mhlz - 魔幻粒子（JSON模式-自定义处理器-嵌套遍历+条件逻辑）
  ^https?:\/\/ss\.landintheair\.com\/storage\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # v2ex - V2EX去广告（HTML替换模式）
  ^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf))))) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
 # foday - 复游会去广告（多路径模式-数组过滤）
  ^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
 # qiujingapp - 球竞APP去广告（多路径模式-数组清空）
  ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(3|6|8|11)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # Keep - 课程/会员接口（正则替换模式）
  ^https?:\/\/(api|kit).gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # bqwz - 标枪王者游戏数据接口（游戏数值模式）
  ^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # bxkt - 伴学课堂接口（混合模式）
  ^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # tv - 影视去广告接口（多路径模式）
  ^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getSearchAd|getVodBodyAd|getVodPauseAd|getUserCenterAd) url reject-dict
  ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(home\/notice|gameCenter\/gameDetailList) url reject-dict

 [mitm]
 hostname = api.iappdaily.com, api2.tophub.today, api2.tophub.app, api3.tophub.xyz, api3.tophub.today, api3.tophub.app, tophub.tophubdata.com, tophub2.tophubdata.com, tophub.idaily.today, tophub2.idaily.today, tophub.remai.today, tophub.iappdaiy.com, tophub.ipadown.com, service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com, api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com
 */

'use strict';

// ==========================================
// 全局配置开关
// ==========================================

const GLOBAL_CONFIG = Object.freeze({
    DEBUG: true,
    ENABLE_CACHE: true,
    MAX_CACHE_SIZE: 100
});

// ==========================================
// 元数据与配置
// ==========================================

const META = {
    name: 'UnifiedVIP',
    version: '13.1.1',
    author: 'joeshu & contributors',
    description: 'Unified VIP Unlock Manager',
    updated: '2026-03-18'
};

// ==========================================
// 常量定义区
// ==========================================

const CONSTANTS = Object.freeze({
    EXPIRE_DATE: "2099-12-31 23:59:59",
    EXPIRE_TIMESTAMP: 4102444800,
    EXPIRE_TIMESTAMP_MS: 4102416000000,
    BIG_NUMBER_STR: "99999999988888888",
    DEFAULT_COINS: 9999,
    DEFAULT_VIP_LEVEL: 99,
    DEFAULT_VIP_TYPE: "lifetime",
    STATUS_SUCCESS: 200,
    STATUS_OK: 0,
    MODES: Object.freeze({
        JSON: 'json',
        REGEX: 'regex',
        GAME: 'game',
        HYBRID: 'hybrid',
        MULTIPATH: 'multipath',
        HTML: 'html'
    })
});

// ==========================================
// 应用配置工厂
// ==========================================

const AppConfigFactory = {
    _configs: null,
    
    get configs() {
        if (!this._configs) {
            this._configs = this._initConfigs();
        }
        return this._configs;
    },

    getConfigByUrl(url) {
        if (!url) return null;
        
        const configs = this.configs;
        for (const [key, config] of Object.entries(configs)) {
            if (config.urlPattern && config.urlPattern.test(url)) {
                return JSON.parse(JSON.stringify(config));
            }
        }
        return null;
    },

    _initConfigs() {
        return Object.freeze({
            iappdaily: {
                id: 'iappdaily',
                name: 'iAppDaily',
                urlPattern: /api\.iappdaily\.com\/my\/balance/,
                mode: 'json',
                fields: {
                    isVip: { path: 'data.is_vip', value: 1, type: 'number' },
                    isPaid: { path: 'data.is_paid', value: 1, type: 'number' },
                    vipExpired: { path: 'data.vip_expired', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' },
                    remainCoins: { path: 'data.remain_coins', value: CONSTANTS.DEFAULT_COINS, type: 'number' },
                    totalCoins: { path: 'data.total_coins', value: CONSTANTS.DEFAULT_COINS, type: 'number' }
                }
            },

            tophub: {
                id: 'tophub',
                name: 'TopHub',
                urlPattern: /(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync/,
                mode: 'json',
                fields: {
                    error: { path: 'error', value: CONSTANTS.STATUS_OK, type: 'number' },
                    status: { path: 'status', value: CONSTANTS.STATUS_SUCCESS, type: 'number' },
                    isVip: { path: 'data.is_vip', value: "1", type: 'string' },
                    isVipNow: { path: 'data.is_vip_now', value: 1, type: 'number' },
                    vipExpired: { path: 'data.vip_expired', value: CONSTANTS.EXPIRE_DATE, type: 'string' },
                    vipType: { path: 'data.vip_type', value: CONSTANTS.DEFAULT_VIP_TYPE, type: 'string' },
                    vipLevel: { path: 'data.vip_level', value: CONSTANTS.DEFAULT_VIP_LEVEL, type: 'number' }
                },
                responseWrapper: {
                    enabled: true,
                    template: {
                        error: 0,
                        status: 200,
                        data: {
                            is_vip: "1",
                            is_vip_now: 1,
                            vip_expired: CONSTANTS.EXPIRE_DATE,
                            vip_type: CONSTANTS.DEFAULT_VIP_TYPE,
                            vip_level: CONSTANTS.DEFAULT_VIP_LEVEL
                        }
                    }
                }
            },

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
                }
            },

            kyxq: {
                id: 'kyxq',
                name: '口语星球',
                urlPattern: /^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2/,
                mode: 'json',
                customProcessor: function(obj, env) {
                    if (!obj.data) return obj;
                    if (typeof obj.data === 'object' && !Array.isArray(obj.data)) {
                        env.log('Processing permission interface');
                        Object.assign(obj.data, {
                            expireDate: CONSTANTS.EXPIRE_TIMESTAMP_MS,
                            havePermission: true,
                            type: 2,
                            isVip: true,
                            vipLevel: obj.data.vipLevel !== undefined ? 10 : undefined
                        });
                        env.log('Permission interface processed: VIP activated');
                    } else if (Array.isArray(obj.data)) {
                        env.log(`Processing course list: ${obj.data.length} courses`);
                        let modifiedCount = 0;
                        obj.data.forEach(course => {
                            if (course) {
                                course.overTime = CONSTANTS.EXPIRE_TIMESTAMP_MS;
                                if (course.status !== undefined) course.status = 1;
                                if (course.isStudyIng !== undefined) course.isStudyIng = 1;
                                modifiedCount++;
                            }
                        });
                        env.log(`Unlocked ${modifiedCount} courses`);
                    }
                    return obj;
                }
            },

            mhlz: {
                id: 'mhlz',
                name: '魔幻粒子',
                urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
                mode: 'json',
                customProcessor: function(obj, env) {
                    if (!obj?.currencies?.list) {
                        env.log('Currency structure not found');
                        return obj;
                    }
                    const counters = { quest: 0, currency: 0, event: 0 };
                    for (const [key, currency] of Object.entries(obj.currencies.list)) {
                        if (key.startsWith("Quest_")) {
                            if (currency.amount !== undefined) currency.amount = "1";
                            if (currency.total_collected !== undefined) currency.total_collected = "1";
                            counters.quest++;
                        } else if (key.startsWith("Event_")) {
                            counters.event++;
                        } else {
                            if (currency.amount !== undefined) currency.amount = CONSTANTS.BIG_NUMBER_STR;
                            if (currency.total_collected !== undefined) currency.total_collected = CONSTANTS.BIG_NUMBER_STR;
                            counters.currency++;
                        }
                    }
                    env.log(`Processed: ${counters.quest} quests, ${counters.currency} currencies, ${counters.event} events`);
                    return obj;
                }
            },

            v2ex: {
                id: 'v2ex',
                name: 'V2EX去广告',
                urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
                mode: 'html',
                htmlReplacements: [
                    {
                        pattern: /<\/head>/i,
                        //replacement: `<head><style>.topic-ads,.sidebar-ads,.adsbygoogle,[class*="ads"],[id*="ads"]{display:none!important;}</style>`,
                      //replacement: `<head><style>.sidebar_units,.sidebar_compliance,ins.adsbygoogle,div[class^="wwads-"]{display: none !important;}</style>`,
                      replacement:`<head>
                      <style>
                      .sidebar_units,
                      .sidebar_compliance,
                      ins.adsbygoogle,
                      div[class^="wwads-"]{
                      display: none !important;
                      }
                      </style>`
                        description: '注入CSS隐藏广告元素'
                    }
                ]
            },

            foday: {
                id: 'foday',
                name: '复游会',
                urlPattern: /^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents/,
                mode: 'multipath',
                pathHandlers: [
                    {
                        path: '/getPageComponents',
                        description: '页面组件接口 - 过滤广告组件',
                        actions: [
                            {
                                type: 'custom',
                                description: '使用 Set 过滤广告组件',
                                processor: function(obj, env) {
                                    const EXCLUDED_ADS = new Set([
                                        "TCMP_home_followingadvertising",
                                        "TC_Interactive_Ad",
                                        "TC_Member_Banner",
                                        "TC_AIGO"
                                    ]);
                                    if (!obj?.data?.pageComponents?.length) {
                                        env.log('No pageComponents to filter');
                                        return obj;
                                    }
                                    const originalLength = obj.data.pageComponents.length;
                                    obj.data.pageComponents = obj.data.pageComponents.filter(
                                        item => !EXCLUDED_ADS.has(item.componentCode)
                                    );
                                    env.log(`Filtered: ${originalLength} -> ${obj.data.pageComponents.length} components`);
                                    return obj;
                                }
                            }
                        ]
                    }
                ]
            },

            qiujingapp: {
                id: 'qiujingapp',
                name: '球竞APP',
                urlPattern: /^https?:\/\/gateway-api\.yizhilive\.com\/api\/(v2\/index\/carouses\/(3|6|8|11)|v3\/index\/all)/,
                mode: 'multipath',
                pathHandlers: [
                    {
                        path: '/api/v2/index/carouses/',
                        pathRegex: /\/api\/v2\/index\/carouses\/(11|8|6|3)\b/,
                        description: '轮播广告接口 - 清空广告数组',
                        actions: [
                            {
                                type: 'custom',
                                description: '清空广告数组',
                                processor: function(obj, env) {
                                    if (Array.isArray(obj.data)) {
                                        const count = obj.data.length;
                                        obj.data = [];
                                        env.log(`Cleared ${count} carousel ads`);
                                    }
                                    return obj;
                                }
                            }
                        ]
                    },
                    {
                        path: '/api/v3/index/all',
                        urlContains: 'position=2',
                        description: '弹窗推广接口 - 清空 banners',
                        actions: [
                            {
                                type: 'custom',
                                description: '清空 banners 数组',
                                processor: function(obj, env) {
                                    if (obj.data?.banners) {
                                        const count = Array.isArray(obj.data.banners) ? obj.data.banners.length : 0;
                                        obj.data.banners = [];
                                        env.log(`Cleared ${count} banners`);
                                    }
                                    return obj;
                                }
                            }
                        ]
                    }
                ]
            },

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
                            { type: 'set', field: 'data.startAdShowTime', value: 0, description: '开屏广告时间置0' },
                            { type: 'set', field: 'data.startAd', value: null, description: '开屏广告置空' },
                            { type: 'set', field: 'data.startAdList', value: null, description: '开屏广告列表置空' }
                        ]
                    },
                    {
                        path: '/home/firstScreen',
                        description: '首页首屏 - 去除焦点图广告',
                        actions: [
                            { type: 'delete', field: 'data.focusAdList', description: '删除焦点图广告' },
                            {
                                type: 'custom',
                                description: '热门模块保留前5个',
                                processor: function(obj, env) {
                                    if (obj.data?.hotMudleList?.length > 5) {
                                        const original = obj.data.hotMudleList.length;
                                        obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
                                        env.log(`Sliced hotMudleList: ${original} -> 5`);
                                    }
                                    return obj;
                                }
                            }
                        ]
                    },
                    {
                        path: '/adInfo/getPageAd',
                        description: '页面广告接口',
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
                                description: '移除首个广告',
                                processor: function(obj, env) {
                                    if (obj.data?.adList?.length > 0) {
                                        const removed = obj.data.adList.shift();
                                        env.log(`Removed first ad: ${removed?.title || 'unnamed'}`);
                                    }
                                    return obj;
                                }
                            }
                        ]
                    }
                ]
            },

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

            bxkt: {
                id: 'bxkt',
                name: '伴学课堂',
                urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
                mode: 'hybrid',
                customProcessor: function(obj, env) {
                    if (!obj?.data) return obj;
                    const data = obj.data;
                    Object.assign(data, {
                        isVip: true,
                        isHave: true,
                        isLock: false,
                        isSale: true,
                        isVipExpire: false,
                        originalPrice: 0,
                        salePrice: 0,
                        trialTopNum: 999
                    });
                    env.log('Modified top-level VIP fields');
                    if (Array.isArray(data.refBusinessList)) {
                        let unlockCount = 0;
                        data.refBusinessList.forEach(item => {
                            if (item?.isLock === true) {
                                item.isLock = false;
                                unlockCount++;
                            }
                        });
                        env.log(`Unlocked ${unlockCount} courses`);
                    }
                    return obj;
                },
                regexReplacements: [
                    { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' },
                    { pattern: /"isHave":false/g, replacement: '"isHave":true', description: '拥有状态回退' },
                    { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态回退' }
                ]
            }
        });
    }
};

// ==========================================
// 工具类 - Env 兼容层
// ==========================================

class Environment {
    constructor(name) {
        this.name = name;
        this.isQX = typeof $task !== 'undefined';
        this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
        this.isLoon = typeof $loon !== 'undefined';
        this.platform = this.detectPlatform();
    }

    detectPlatform() {
        if (this.isQX) return 'Quantumult X';
        if (this.isSurge) return 'Surge';
        if (this.isLoon) return 'Loon';
        return 'Unknown';
    }

    log(level, msg) {
        if (!GLOBAL_CONFIG.DEBUG && level !== 'error') return;
        
        const timestamp = new Date().toISOString();
        const prefix = `[${this.name}][${level.toUpperCase()}][${timestamp}]`;
        const message = `${prefix} ${msg}`;
        
        console.log(message);
        
        if (this.isQX && level === 'error') {
            $notify(this.name, 'Error', msg);
        }
    }

    debug(msg) { this.log('debug', msg); }
    info(msg) { this.log('info', msg); }
    warn(msg) { this.log('warn', msg); }
    error(msg) { this.log('error', msg); }

    done(object) {
        if (!object || !object.body) {
            this.warn('Empty response body, returning original');
            $done({});
            return;
        }
        $done(object);
    }

    getResponse() {
        return $response || {};
    }

    getRequest() {
        return $request || {};
    }
}

// ==========================================
// 工具函数库
// ==========================================

const Utils = {
    _regexCache: new Map(),

    safeJsonParse(str, defaultVal = null) {
        if (!str || typeof str !== 'string') return defaultVal;
        try {
            return JSON.parse(str);
        } catch (e) {
            return defaultVal;
        }
    },

    safeJsonStringify(obj, pretty = false) {
        try {
            return JSON.stringify(obj, null, pretty ? 2 : undefined);
        } catch (e) {
            console.error(`JSON stringify error: ${e}`);
            return '{}';
        }
    },

    getValueByPath(obj, path) {
        if (!path || !obj) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === null || acc === undefined) return undefined;
            const match = part.match(/^([^\[]+)\[(\d+)\]$/);
            if (match) {
                const arr = acc[match[1]];
                return Array.isArray(arr) ? arr[parseInt(match[2])] : undefined;
            }
            return acc[part];
        }, obj);
    },

    setValueByPath(obj, path, value) {
        if (!path || !obj) return obj;
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPart = parts[i + 1];
            const isNextArray = /^\[\d+\]$/.test(nextPart);
            if (!(part in current) || current[part] === null) {
                current[part] = isNextArray ? [] : {};
            }
            current = current[part];
        }
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
        return obj;
    },

    pathExists(obj, path) {
        return this.getValueByPath(obj, path) !== undefined;
    },

    getRegExp(pattern, flags = 'g') {
        const key = `${pattern.toString()}_${flags}`;
        if (!this._regexCache.has(key)) {
            const regex = pattern instanceof RegExp
                ? new RegExp(pattern.source, flags || pattern.flags)
                : new RegExp(pattern, flags);
            this._regexCache.set(key, regex);
        }
        return this._regexCache.get(key);
    }
};

// ==========================================
// VIP 解锁核心引擎 v2.1 - 修复版
// ==========================================

class VipUnlockEngine {
    constructor(env) {
        this.env = env;
        this.config = null;
        this.stats = {
            startTime: Date.now(),
            mode: null,
            modifications: 0,
            errors: []
        };
    }

    setConfig(config) {
        this.config = config;
        this.stats.mode = config.mode || 'auto';
        if (GLOBAL_CONFIG.DEBUG) {
            this.env.info(`Initialized: ${config.name} [Mode: ${this.stats.mode}]`);
        }
    }

    process(response) {
        try {
            if (!response?.body) {
                this.env.warn('No response body found');
                return this.createErrorResponse('No response body');
            }

            const mode = this.config.mode || this.detectMode();
            this.stats.mode = mode;
            
            if (GLOBAL_CONFIG.DEBUG) {
                this.env.debug(`Processing with mode: ${mode}`);
            }

            switch (mode) {
                case CONSTANTS.MODES.HTML:
                    return this.processHtmlMode(response.body);
                case CONSTANTS.MODES.MULTIPATH:
                    // 修复：传递完整的 response 对象，确保能获取 url
                    return this.processMultipathMode(response.body, response.url);
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
            return { body: response.body };
        }
    }

    detectMode() {
        if (this.config.htmlReplacements?.length) return CONSTANTS.MODES.HTML;
        if (this.config.pathHandlers?.length) return CONSTANTS.MODES.MULTIPATH;
        if (this.config.customProcessor && this.config.regexReplacements) return CONSTANTS.MODES.HYBRID;
        if (this.config.gameResources?.length) return CONSTANTS.MODES.GAME;
        if (this.config.regexReplacements?.length) return CONSTANTS.MODES.REGEX;
        return CONSTANTS.MODES.JSON;
    }

    processHtmlMode(body) {
        let modifiedBody = body;
        const replacements = this.config.htmlReplacements || [];
        
        if (GLOBAL_CONFIG.DEBUG) {
            this.env.debug(`HTML replacements: ${replacements.length} rules`);
        }

        for (const rule of replacements) {
            try {
                const regex = Utils.getRegExp(rule.pattern, 'i');
                const original = modifiedBody;
                modifiedBody = modifiedBody.replace(regex, rule.replacement);
                if (original !== modifiedBody) {
                    this.stats.modifications++;
                    if (GLOBAL_CONFIG.DEBUG) {
                        this.env.debug(`Applied: ${rule.description || 'unnamed'}`);
                    }
                }
            } catch (e) {
                this.env.warn(`HTML replacement error: ${e.message}`);
            }
        }
        
        if (GLOBAL_CONFIG.DEBUG) {
            this.env.info(`${this.config.name} processed (HTML mode)`);
        }
        return { body: modifiedBody };
    }

    /**
     * 多路径处理模式 - 修复 url undefined 问题
     */
    processMultipathMode(body, url) {
        // 修复点1：确保 url 有值，从 response 或 request 中获取
        if (!url) {
            url = this.env.getResponse().url || this.env.getRequest().url || '';
        }
        
        // 修复点2：如果仍然没有 url，记录错误并返回原始 body
        if (!url) {
            this.env.error('URL is undefined in multipath mode, cannot match handlers');
            return { body: body };
        }

        let obj = Utils.safeJsonParse(body);
        if (!obj) {
            return this.createErrorResponse('Failed to parse JSON');
        }

        const handlers = this.config.pathHandlers || [];
        let matched = false;

        for (const handler of handlers) {
            // 修复点3：安全的路径匹配逻辑，确保 url 和 handler.path 都存在
            const pathMatch = url && handler.path && url.includes(handler.path);
            const regexMatch = !handler.pathRegex || (url && handler.pathRegex.test(url));
            const containsMatch = !handler.urlContains || (url && url.includes(handler.urlContains));

            if (pathMatch && regexMatch && containsMatch) {
                matched = true;
                if (GLOBAL_CONFIG.DEBUG) {
                    this.env.debug(`Matched handler: ${handler.path}`);
                }

                for (const action of handler.actions || []) {
                    try {
                        this.executeAction(obj, action);
                    } catch (e) {
                        this.env.warn(`Action error: ${e.message}`);
                    }
                }
                break;
            }
        }

        if (!matched && GLOBAL_CONFIG.DEBUG) {
            this.env.debug(`No matching path handler found for url: ${url}`);
        }

        return { body: Utils.safeJsonStringify(obj) };
    }

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
                if (typeof action.processor === 'function') {
                    action.processor(obj, this.env);
                    this.stats.modifications++;
                }
                break;
            default:
                this.env.warn(`Unknown action type: ${action.type}`);
        }
    }

    actionDelete(obj, action) {
        const parts = action.field.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current?.[parts[i]];
            if (!current) return;
        }
        delete current[parts[parts.length - 1]];
        this.stats.modifications++;
        if (GLOBAL_CONFIG.DEBUG) {
            this.env.debug(`Deleted: ${action.field}`);
        }
    }

    actionSet(obj, action) {
        Utils.setValueByPath(obj, action.field, action.value);
        this.stats.modifications++;
        if (GLOBAL_CONFIG.DEBUG) {
            this.env.debug(`Set: ${action.field} = ${JSON.stringify(action.value)}`);
        }
    }

    actionArraySlice(obj, action) {
        const arr = Utils.getValueByPath(obj, action.field);
        if (Array.isArray(arr)) {
            const original = arr.length;
            Utils.setValueByPath(obj, action.field, arr.slice(0, action.keepCount));
            this.stats.modifications++;
            if (GLOBAL_CONFIG.DEBUG) {
                this.env.debug(`Sliced: ${action.field} ${original} -> ${action.keepCount}`);
            }
        }
    }

    actionArrayShift(obj, action) {
        const arr = Utils.getValueByPath(obj, action.field);
        if (Array.isArray(arr) && arr.length > 0) {
            arr.shift();
            this.stats.modifications++;
            if (GLOBAL_CONFIG.DEBUG) {
                this.env.debug(`Shifted: ${action.field}`);
            }
        }
    }

    processHybridMode(body) {
        let obj = Utils.safeJsonParse(body, null);

        if (obj !== null && this.config.customProcessor) {
            try {
                obj = this.config.customProcessor(obj, this.env);
                if (GLOBAL_CONFIG.DEBUG) {
                    this.env.info(`${this.config.name} processed (Hybrid-JSON)`);
                }
                return { body: Utils.safeJsonStringify(obj) };
            } catch (e) {
                this.env.warn(`Custom processor failed: ${e.message}, falling back to regex`);
            }
        }

        return this.processRegexMode(body);
    }

    processJsonMode(body) {
        let obj = Utils.safeJsonParse(body);
        if (!obj) {
            return this.createErrorResponse('Failed to parse JSON');
        }

        if (this.config.responseWrapper?.enabled) {
            const hasData = Utils.getValueByPath(obj, 'data');
            if (!hasData || Object.keys(hasData).length === 0) {
                if (GLOBAL_CONFIG.DEBUG) {
                    this.env.debug('Using response wrapper template');
                }
                obj = JSON.parse(JSON.stringify(this.config.responseWrapper.template));
            }
        }

        if (this.config.fields) {
            this.applyFieldMapping(obj);
        }

        if (typeof this.config.customProcessor === 'function') {
            obj = this.config.customProcessor(obj, this.env);
        }

        if (GLOBAL_CONFIG.DEBUG) {
            this.env.info(`${this.config.name} processed (JSON mode)`);
        }
        return { body: Utils.safeJsonStringify(obj) };
    }

    applyFieldMapping(obj) {
        for (const [key, field] of Object.entries(this.config.fields)) {
            const exists = Utils.pathExists(obj, field.path);
            Utils.setValueByPath(obj, field.path, field.value);
            if (exists) {
                this.stats.modifications++;
                if (GLOBAL_CONFIG.DEBUG) {
                    this.env.debug(`Modified: ${field.path} = ${JSON.stringify(field.value)}`);
                }
            } else {
                if (GLOBAL_CONFIG.DEBUG) {
                    this.env.debug(`Created: ${field.path} = ${JSON.stringify(field.value)}`);
                }
            }
        }
    }

    processRegexMode(body) {
        let modifiedBody = body;
        const replacements = this.config.regexReplacements || [];

        if (GLOBAL_CONFIG.DEBUG) {
            this.env.debug(`Regex replacements: ${replacements.length} rules`);
        }

        for (const rule of replacements) {
            try {
                const regex = Utils.getRegExp(rule.pattern, 'g');
                const original = modifiedBody;
                modifiedBody = modifiedBody.replace(regex, rule.replacement);
                if (original !== modifiedBody) {
                    this.stats.modifications++;
                    if (GLOBAL_CONFIG.DEBUG) {
                        this.env.debug(`Applied: ${rule.description || 'unnamed'}`);
                    }
                }
            } catch (e) {
                this.env.warn(`Regex error: ${e.message}`);
            }
        }

        if (GLOBAL_CONFIG.DEBUG) {
            this.env.info(`${this.config.name} processed (Regex mode)`);
        }
        return { body: modifiedBody };
    }

    processGameMode(body) {
        let modifiedBody = body;
        const resources = this.config.gameResources || [];

        if (GLOBAL_CONFIG.DEBUG) {
            this.env.debug(`Game resources: ${resources.length} items`);
        }

        for (const resource of resources) {
            try {
                const pattern = new RegExp(`\\\\"${resource.field}\\\\":\\\\d+`, 'g');
                const replacement = `\"${resource.field}\":${resource.value}`;
                const original = modifiedBody;
                modifiedBody = modifiedBody.replace(pattern, replacement);
                if (original !== modifiedBody) {
                    this.stats.modifications++;
                    if (GLOBAL_CONFIG.DEBUG) {
                        this.env.debug(`Modified: ${resource.description} (${resource.field})`);
                    }
                }
            } catch (e) {
                this.env.warn(`Game resource error: ${e.message}`);
            }
        }

        if (GLOBAL_CONFIG.DEBUG) {
            this.env.info(`${this.config.name} processed (Game mode)`);
        }
        return { body: modifiedBody };
    }

    createErrorResponse(reason) {
        this.env.error(`Error: ${reason}`);
        return { body: $response?.body || '{}' };
    }

    getStats() {
        return {
            ...this.stats,
            duration: Date.now() - this.stats.startTime
        };
    }
}

// ==========================================
// 插件管理器 v3.0
// ==========================================

class PluginManager {
    constructor() {
        this.urlCache = new Map();
        this.cacheKeys = [];
    }

    getConfig(url) {
        if (!url) return null;

        if (GLOBAL_CONFIG.ENABLE_CACHE && this.urlCache.has(url)) {
            const config = this.urlCache.get(url);
            this._updateCacheOrder(url);
            return config;
        }

        const config = AppConfigFactory.getConfigByUrl(url);
        
        if (config && GLOBAL_CONFIG.ENABLE_CACHE) {
            this._addToCache(url, config);
        }

        return config;
    }

    _addToCache(url, config) {
        if (this.cacheKeys.length >= GLOBAL_CONFIG.MAX_CACHE_SIZE) {
            const oldestKey = this.cacheKeys.shift();
            this.urlCache.delete(oldestKey);
        }
        
        this.urlCache.set(url, config);
        this.cacheKeys.push(url);
    }

    _updateCacheOrder(url) {
        const index = this.cacheKeys.indexOf(url);
        if (index > -1) {
            this.cacheKeys.splice(index, 1);
            this.cacheKeys.push(url);
        }
    }

    clearCache() {
        this.urlCache.clear();
        this.cacheKeys = [];
    }
}

// ==========================================
// 主入口
// ==========================================

function main() {
    const env = new Environment(META.name);

    try {
        if (GLOBAL_CONFIG.DEBUG) {
            env.info(`Starting ${META.name} v${META.version} on ${env.platform}`);
        }

        const pluginManager = new PluginManager();

        const response = env.getResponse();
        const requestUrl = response.url || env.getRequest().url || '';

        if (!requestUrl) {
            env.error('No URL found in request/response');
            env.done({});
            return;
        }

        if (GLOBAL_CONFIG.DEBUG) {
            env.debug(`Processing URL: ${requestUrl}`);
        }

        let appConfig = pluginManager.getConfig(requestUrl);

        if (!appConfig) {
            if (GLOBAL_CONFIG.DEBUG) {
                env.warn('App not detected, using generic config');
            }
            appConfig = {
                name: 'Generic',
                mode: 'json',
                fields: {
                    isVip: { path: 'data.is_vip', value: 1, type: 'number' },
                    vipExpired: { path: 'data.vip_expire_date', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' }
                }
            };
        } else if (GLOBAL_CONFIG.DEBUG) {
            env.info(`Matched app: ${appConfig.name}`);
        }

        const engine = new VipUnlockEngine(env);
        engine.setConfig(appConfig);

        const result = engine.process(response);
        const stats = engine.getStats();

        if (GLOBAL_CONFIG.DEBUG) {
            env.info(`Completed in ${stats.duration}ms, ${stats.modifications} modifications`);
        }

        env.done(result);

    } catch (e) {
        env.error(`Fatal error: ${e.message}`);
        env.done({ body: $response?.body });
    }
}

// 执行
main();
