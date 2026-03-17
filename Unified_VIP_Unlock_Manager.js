/**
 * ==========================================
 * Unified VIP Unlock Manager
 * 统一 VIP 解锁管理器
 * @version 12.1.0
 * @description 插件化架构，支持 JSON对象/正则替换/游戏数值/混合/多路径/HTML替换 多模式
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
 ^https:\/\/api2\.tophub\.(today|app)\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager.js
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
 ^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getAdAndRecommendedProduct response-body "adComponent":.+, response-body "adComponent":null,
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
 hostname = api.iappdaily.com, api2.tophub.today, api2.tophub.app, service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com, api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com
 */

'use strict';


// ==========================================
// 常量定义区 - 全局使用的常量值
// ==========================================

const CONSTANTS = Object.freeze({
  EXPIRE_DATE: "2099-12-31 23:59:59",
  EXPIRE_TIMESTAMP: 4102444800,
  EXPIRE_TIMESTAMP_MS: 4102416000000,
  BIG_NUMBER_STR: "9999999999999999999988888888",
  DEFAULT_COINS: 9999,
  DEFAULT_VIP_LEVEL: 99,
  DEFAULT_VIP_TYPE: "lifetime"
});

// ==========================================
// 配置区 - 新增应用只需在此添加配置，无需修改下方核心逻辑
// ==========================================

/**
 * 处理模式枚举
 * @readonly
 * @enum {string}
 */
const PROCESSING_MODES = Object.freeze({
  JSON: 'json',
  REGEX: 'regex',
  GAME: 'game',
  HYBRID: 'hybrid',
  MULTIPATH: 'multipath',
  HTML: 'html'
});

/**
 * 应用配置对象
 * 每个键对应一个应用的配置，包含以下属性：
 * - id: 应用唯一标识（小写，无空格）
 * - name: 应用显示名称（用于日志）
 * - urlPattern: URL 正则表达式，用于自动识别当前请求对应的应用
 * - mode: 处理模式，见 PROCESSING_MODES
 */
const APP_CONFIGS = Object.freeze({
  
  /**
   * iAppDaily 应用配置
   */
  iappdaily: {
    id: 'iappdaily',
    name: 'iAppDaily',
    urlPattern: /api\.iappdaily\.com\/my\/balance/,
    mode: PROCESSING_MODES.JSON,
    fields: {
      isVip: { path: 'data.is_vip', value: 1, type: 'number' },
      isPaid: { path: 'data.is_paid', value: 1, type: 'number' },
      vipExpired: { path: 'data.vip_expired', value: 4102444800, type: 'number' },
      remainCoins: { path: 'data.remain_coins', value: 9999, type: 'number' },
      totalCoins: { path: 'data.total_coins', value: 9999, type: 'number' }
    }
  },

  /**
   * TopHub 应用配置
   */
  tophub: {
    id: 'tophub',
    name: 'TopHub',
    urlPattern: /api2\.tophub\.(today|app)\/account\/sync/,
    mode: PROCESSING_MODES.JSON,
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
    }
  },

  /**
   * gps 应用配置
   */
  gps: {
    id: 'gps',
    name: 'GPS工具箱',
    urlPattern: /^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo/,
    mode: PROCESSING_MODES.JSON,
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

  /**
   * kyxq 应用配置
   */
  kyxq: {
    id: 'kyxq',
    name: '口语星球',
    urlPattern: /^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2/,
    mode: PROCESSING_MODES.JSON,
    customProcessor(obj, env) {
      if (!obj.data) return obj;

      if (typeof obj.data === 'object' && !Array.isArray(obj.data)) {
        env.log('Processing permission interface (object type)');
        Object.assign(obj.data, {
          expireDate: CONSTANTS.EXPIRE_TIMESTAMP_MS,
          havePermission: true,
          type: 2,
          isVip: true,
          vipLevel: obj.data.vipLevel !== undefined ? 10 : undefined
        });
        env.log('Permission interface processed: VIP activated');
      } 
      else if (Array.isArray(obj.data)) {
        env.log(`Processing course list interface (array type, ${obj.data.length} courses)`);
        let modifiedCount = 0;
        obj.data.forEach(course => {
          if (course && typeof course === 'object') {
            course.overTime = CONSTANTS.EXPIRE_TIMESTAMP_MS;
            if (course.status !== undefined) course.status = 1;
            if (course.isStudyIng !== undefined) course.isStudyIng = 1;
            modifiedCount++;
          }
        });
        env.log(`Course list processed: ${modifiedCount} courses unlocked`);
      }
      return obj;
    }
  },

  /**
   * mhlz 应用配置
   */
  mhlz: {
    id: 'mhlz',
    name: '魔幻粒子',
    urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
    mode: PROCESSING_MODES.JSON,
    customProcessor(obj, env) {
      const currencies = obj?.currencies?.list;
      if (!currencies || typeof currencies !== 'object') {
        env.log('Currency structure not found (obj.currencies.list)');
        return obj;
      }

      let questCount = 0, currencyCount = 0, eventCount = 0;

      for (const [key, currency] of Object.entries(currencies)) {
        if (!currency || typeof currency !== 'object') continue;

        if (key.startsWith("Quest_")) {
          if (currency.amount !== undefined) currency.amount = "1";
          if (currency.total_collected !== undefined) currency.total_collected = "1";
          questCount++;
        } 
        else if (key.startsWith("Event_")) {
          eventCount++;
        } 
        else {
          if (currency.amount !== undefined) currency.amount = CONSTANTS.BIG_NUMBER_STR;
          if (currency.total_collected !== undefined) currency.total_collected = CONSTANTS.BIG_NUMBER_STR;
          currencyCount++;
        }
      }

      env.log(`Currency processing completed: ${questCount} quests, ${currencyCount} currencies, ${eventCount} events (preserved)`);
      return obj;
    }
  },

  /**
   * v2ex 应用配置
   */
  v2ex: {
    id: 'v2ex',
    name: 'V2EX去广告',
    urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
    mode: PROCESSING_MODES.HTML,
    htmlReplacements: [
      {
        pattern: /<head>/i,
        replacement: `<head>
<style>
.topic-ads, .sidebar-ads, .adsbygoogle, [class*="ads"], [id*="ads"] { display: none !important; }
</style>`,
        description: '注入CSS隐藏广告元素'
      }
    ]
  },

  /**
   * foday 应用配置
   */
  foday: {
    id: 'foday',
    name: '复游会',
    urlPattern: /^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents/,
    mode: PROCESSING_MODES.MULTIPATH,
    pathHandlers: [
      {
        path: '/getPageComponents',
        description: '页面组件接口 - 过滤广告组件',
        actions: [
          {
            type: 'custom',
            description: '使用 Set 过滤广告组件',
            processor(obj, env) {
              const EXCLUDED_ADS = new Set([
                "TCMP_home_followingadvertising",
                "TC_Interactive_Ad",
                "TC_Member_Banner",
                "TC_AIGO"
              ]);

              const components = obj?.data?.pageComponents;
              if (!Array.isArray(components) || components.length === 0) {
                env.log('pageComponents not found or empty, skipping');
                return obj;
              }

              const originalLength = components.length;
              obj.data.pageComponents = components.filter(
                item => !EXCLUDED_ADS.has(item?.componentCode)
              );
              
              env.log(`Filtered pageComponents: ${originalLength} -> ${obj.data.pageComponents.length} (removed ${originalLength - obj.data.pageComponents.length} ad components)`);
              return obj;
            }
          }
        ]
      }
    ]
  },

  /**
   * qiujingapp 应用配置
   */
  qiujingapp: {
    id: 'qiujingapp',
    name: '球竞APP',
    urlPattern: /^https?:\/\/gateway-api\.yizhilive\.com\/api\/(v2\/index\/carouses\/(3|6|8|11)|v3\/index\/all)/,
    mode: PROCESSING_MODES.MULTIPATH,
    pathHandlers: [
      {
        path: '/api/v2/index/carouses/',
        description: '轮播广告接口 - 清空广告数组',
        pathRegex: /\/api\/v2\/index\/carouses\/(11|8|6|3)\b/,
        actions: [
          {
            type: 'custom',
            description: '清空 obj.data 广告数组',
            processor(obj, env) {
              if (!Array.isArray(obj.data)) {
                env.log('obj.data is not an array, skipping');
                return obj;
              }
              const originalLength = obj.data.length;
              obj.data = [];
              env.log(`Cleared carouses data array: ${originalLength} items -> 0 items`);
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
            processor(obj, env) {
              if (!obj.data?.banners) {
                env.log('obj.data.banners not found, skipping');
                return obj;
              }
              const originalLength = Array.isArray(obj.data.banners) ? obj.data.banners.length : 'non-array';
              obj.data.banners = [];
              env.log(`Cleared banners array: ${originalLength} items -> 0 items`);
              return obj;
            }
          }
        ]
      }
    ]
  },

  /**
   * Keep 应用配置
   */
  keep: {
    id: 'keep',
    name: 'Keep',
    urlPattern: /^https?:\/\/(api|kit)\.gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\//,
    mode: PROCESSING_MODES.REGEX,
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
   * bqwz 应用配置
   */
  bqwz: {
    id: 'bqwz',
    name: '标枪王者',
    urlPattern: /^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data/,
    mode: PROCESSING_MODES.GAME,
    gameResources: [
      { field: 'coin', value: 9999880, description: '金币' },
      { field: 'diamond', value: 9999880, description: '钻石' },
      { field: 'exp', value: 9999880, description: '经验' },
      { field: 'rank_ticket', value: 666, description: '排位券' },
      { field: 'pve_power', value: 888, description: 'PVE体力' }
    ]
  },

  /**
   * bxkt 应用配置
   */
  bxkt: {
    id: 'bxkt',
    name: '伴学课堂',
    urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
    mode: PROCESSING_MODES.HYBRID,
    customProcessor(obj, env) {
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
      
      env.log('Modified top-level fields: isVip=true, isHave=true, isLock=false, etc.');

      if (Array.isArray(data.refBusinessList)) {
        const unlockCount = data.refBusinessList.reduce((count, item) => {
          if (item?.isLock === true) {
            item.isLock = false;
            return count + 1;
          }
          return count;
        }, 0);
        env.log(`Unlocked ${unlockCount} items in refBusinessList`);
      }
      
      return obj;
    },
    regexReplacements: [
      { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' },
      { pattern: /"isHave":false/g, replacement: '"isHave":true', description: '拥有状态回退' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态回退' }
    ]
  },

  /**
   * tv 应用配置 - 参考原始 tv.js 优化
   * 原文件：tv.js（作者：joeshu）
   * 处理模式：多路径模式（去广告专用）
   * 功能：影视应用去广告（开屏广告、焦点图广告、浮层广告、弹窗广告、列表广告）
   */
  tv: {
    id: 'tv',
    name: '影视去广告',
    urlPattern: /^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body)/,
    mode: PROCESSING_MODES.MULTIPATH,
    
    // 路径处理器 - 严格匹配原始 tv.js 逻辑
    pathHandlers: [
      {
        path: '/basic/init',
        description: '初始化接口 - 去除开屏广告',
        actions: [
          {
            type: 'custom',
            description: '设置开屏广告相关字段',
            processor(obj, env) {
              if (!obj.data) {
                env.log('No obj.data in /basic/init');
                return obj;
              }
              obj.data.startAdShowTime = 0;
              obj.data.startAd = null;
              obj.data.startAdList = null;
              env.log('Cleared start ads in /basic/init');
              return obj;
            }
          }
        ]
      },
      {
        path: '/home/firstScreen',
        description: '首页首屏 - 去除焦点图广告、精简热门模块',
        actions: [
          {
            type: 'custom',
            description: '删除焦点图广告并精简热门模块',
            processor(obj, env) {
              if (!obj.data) {
                env.log('No obj.data in /home/firstScreen');
                return obj;
              }
              // 删除焦点图广告列表
              delete obj.data.focusAdList;
              
              // 精简热门模块列表（保留前5个）
              if (Array.isArray(obj.data.hotMudleList)) {
                const originalLength = obj.data.hotMudleList.length;
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
          {
            type: 'custom',
            description: '删除浮层和弹窗广告',
            processor(obj, env) {
              if (!obj.data) {
                env.log('No obj.data in /adInfo/getPageAd');
                return obj;
              }
              delete obj.data.floatAd;
              delete obj.data.popupAd;
              env.log('Deleted floatAd and popupAd');
              return obj;
            }
          }
        ]
      },
      {
        path: '/home/body',
        description: '首页主体 - 去除列表首个广告',
        actions: [
          {
            type: 'custom',
            description: '移除广告列表第一个元素',
            processor(obj, env) {
              if (!obj.data?.adList || !Array.isArray(obj.data.adList) || obj.data.adList.length === 0) {
                env.log('No adList or empty in /home/body');
                return obj;
              }
              const removed = obj.data.adList.shift();
              env.log(`Removed first ad from adList: ${removed?.title || 'item'}`);
              return obj;
            }
          }
        ]
      }
    ]
  }
});

// ==========================================
// 工具类 - Env 兼容层
// ==========================================

class Env {
  constructor(name) {
    this.name = name;
    this.isQX = typeof $task !== 'undefined';
    this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
    this.isLoon = typeof $loon !== 'undefined';
  }

  log(msg) {
    console.log(`[${this.name}] ${msg}`);
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
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  },

  setValueByPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return obj;
  },

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
  },

  detectApp(url, configs) {
    for (const config of Object.values(configs)) {
      if (config.urlPattern?.test(url)) {
        return config;
      }
    }
    return null;
  }
};

// ==========================================
// VIP 解锁核心引擎
// ==========================================

class VipUnlockEngine {
  constructor(env) {
    this.env = env;
    this.config = null;
  }

  setConfig(config) {
    this.config = config;
    this.env.log(`Initialized for: ${config.name} [Mode: ${config.mode || 'json'}]`);
  }

  /**
   * 主处理入口
   * @param {Object} response - 响应对象
   * @param {string} requestUrl - 请求 URL（从 $request 获取）
   * @returns {Object}
   */
  process(response, requestUrl) {
    // 严格检查 response body
    if (!response?.body) {
      this.env.log('No response body found');
      return {};
    }

    const mode = this.config.mode || PROCESSING_MODES.JSON;
    
    // 多路径模式需要 requestUrl
    if (mode === PROCESSING_MODES.MULTIPATH && !requestUrl) {
      this.env.log('MULTIPATH mode requires requestUrl but got undefined');
      return { body: response.body };
    }
    
    const modeHandlers = {
      [PROCESSING_MODES.HTML]: () => this.processHtmlMode(response.body),
      [PROCESSING_MODES.MULTIPATH]: () => this.processMultipathMode(response.body, requestUrl),
      [PROCESSING_MODES.HYBRID]: () => this.processHybridMode(response.body),
      [PROCESSING_MODES.GAME]: () => this.processGameMode(response.body),
      [PROCESSING_MODES.REGEX]: () => this.processRegexMode(response.body),
      [PROCESSING_MODES.JSON]: () => this.processJsonMode(response.body)
    };

    const handler = modeHandlers[mode];
    if (!handler) {
      this.env.log(`Unknown mode: ${mode}, falling back to JSON mode`);
      return this.processJsonMode(response.body);
    }

    try {
      return handler();
    } catch (error) {
      this.env.log(`Processing error in ${mode} mode: ${error.message}`);
      return { body: response.body };
    }
  }

  processHtmlMode(body) {
    const replacements = this.config.htmlReplacements || [];
    
    if (replacements.length === 0) {
      this.env.log('No HTML replacements configured');
      return { body };
    }

    this.env.log(`Starting HTML replacements (${replacements.length} rules)`);
    let modifiedBody = body;

    for (const rule of replacements) {
      try {
        const pattern = rule.pattern instanceof RegExp 
          ? rule.pattern 
          : new RegExp(rule.pattern, 'i');
        
        const originalBody = modifiedBody;
        modifiedBody = modifiedBody.replace(pattern, rule.replacement);

        this.env.log(
          originalBody !== modifiedBody 
            ? `Applied: ${rule.description || 'unnamed rule'}` 
            : `Pattern not matched: ${rule.description || 'unnamed rule'}`
        );
      } catch (e) {
        this.env.log(`HTML replacement error: ${e.message}`);
      }
    }

    this.env.log(`Ad removal completed for ${this.config.name} (HTML mode)`);
    return { body: modifiedBody };
  }

  /**
   * 多路径处理模式 - 参考 tv.js 优化
   * 关键修复：使用 indexOf 进行路径匹配（与原始 tv.js 一致）
   */
  processMultipathMode(body, requestUrl) {
    // 先解析 JSON
    let obj;
    try {
      obj = JSON.parse(body);
    } catch (e) {
      this.env.log(`JSON parse error: ${e.message}`);
      return { body };
    }

    // 检查 obj.data 是否存在
    if (!obj || !obj.data) {
      this.env.log('No obj.data found in response');
      return { body: JSON.stringify(obj) };
    }

    const pathHandlers = this.config.pathHandlers || [];
    let matched = false;

    // 遍历所有路径处理器，使用 indexOf 匹配（与原始 tv.js 一致）
    for (const handler of pathHandlers) {
      if (requestUrl.indexOf(handler.path) !== -1) {
        // 额外验证（可选）
        if (handler.pathRegex && !handler.pathRegex.test(requestUrl)) {
          continue;
        }
        if (handler.urlContains && requestUrl.indexOf(handler.urlContains) === -1) {
          continue;
        }

        matched = true;
        this.env.log(`Matched path handler: ${handler.path} (${handler.description})`);

        // 执行该路径的所有操作
        for (const action of handler.actions) {
          try {
            if (action.type === 'custom' && typeof action.processor === 'function') {
              const result = action.processor(obj, this.env);
              if (result !== undefined) {
                Object.assign(obj, result);
              }
              this.env.log(`Executed: ${action.description}`);
            }
            // 其他 action 类型保留但 tv.js 主要使用 custom
          } catch (e) {
            this.env.log(`Action error: ${e.message}`);
          }
        }
        
        this.env.log(`Completed processing for path: ${handler.path}`);
        // 匹配到一个路径后退出（与原始 tv.js 的 if-else 逻辑一致）
        break;
      }
    }

    if (!matched) {
      this.env.log('No matching path handler found for this URL');
    }

    return { body: JSON.stringify(obj) };
  }

  processHybridMode(body) {
    const obj = Utils.safeJsonParse(body, null);

    if (obj !== null && this.config.customProcessor) {
      this.env.log('Hybrid mode: JSON parsed successfully, executing custom processor');
      try {
        const processed = this.config.customProcessor(obj, this.env);
        this.env.log(`VIP unlocked for ${this.config.name} (Hybrid-JSON mode)`);
        return { body: Utils.safeJsonStringify(processed) };
      } catch (e) {
        this.env.log(`Custom processor error: ${e.message}, falling back to regex`);
      }
    }

    this.env.log('Hybrid mode: Falling back to regex replacements');
    return this.processRegexMode(body);
  }

  processJsonMode(body) {
    let obj = Utils.safeJsonParse(body);

    if (!obj || Object.keys(obj).length === 0) {
      this.env.log('Failed to parse response body');
      return { body };
    }

    // 响应包装器检查
    if (this.config.responseWrapper?.enabled) {
      const hasData = Utils.getValueByPath(obj, 'data');
      if (!hasData || Object.keys(hasData).length === 0) {
        this.env.log('Data empty, creating new VIP response from template');
        obj = JSON.parse(JSON.stringify(this.config.responseWrapper.template));
      }
    }

    // 字段映射
    if (this.config.fields) {
      this.applyFieldMapping(obj);
    }

    // 自定义处理器
    if (typeof this.config.customProcessor === 'function') {
      obj = this.config.customProcessor(obj, this.env) || obj;
    }

    this.env.log(`VIP unlocked for ${this.config.name} (JSON mode)`);
    return { body: Utils.safeJsonStringify(obj) };
  }

  processRegexMode(body) {
    const replacements = this.config.regexReplacements || [];
    
    if (replacements.length === 0) {
      this.env.log('No regex replacements configured');
      return { body };
    }

    this.env.log(`Starting regex replacements (${replacements.length} rules)`);
    let modifiedBody = body;

    for (const rule of replacements) {
      try {
        const pattern = rule.pattern instanceof RegExp 
          ? rule.pattern 
          : new RegExp(rule.pattern, 'g');
        
        const originalBody = modifiedBody;
        modifiedBody = modifiedBody.replace(pattern, rule.replacement);

        if (originalBody !== modifiedBody) {
          this.env.log(`Applied: ${rule.description || 'unnamed rule'}`);
        }
      } catch (e) {
        this.env.log(`Regex error: ${e.message}`);
      }
    }

    this.env.log(`VIP unlocked for ${this.config.name} (Regex mode)`);
    return { body: modifiedBody };
  }

  processGameMode(body) {
    const resources = this.config.gameResources || [];
    
    this.env.log(`Starting game resource modification (${resources.length} resources)`);
    let modifiedBody = body;

    for (const resource of resources) {
      try {
        const pattern = new RegExp(`\\\\"${resource.field}\\\\":\\\\d+`, 'g');
        const replacement = `\\\\"${resource.field}\\\\":${resource.value}`;
        
        const originalBody = modifiedBody;
        modifiedBody = modifiedBody.replace(pattern, replacement);

        this.env.log(
          originalBody !== modifiedBody
            ? `Modified ${resource.description} (${resource.field}): ${resource.value}`
            : `Field not found: ${resource.field}`
        );
      } catch (e) {
        this.env.log(`Error modifying ${resource.description}: ${e.message}`);
      }
    }

    this.env.log(`Game resources modified for ${this.config.name} (Game mode)`);
    return { body: modifiedBody };
  }

  applyFieldMapping(obj) {
    for (const [key, field] of Object.entries(this.config.fields)) {
      const currentValue = Utils.getValueByPath(obj, field.path);
      
      if (currentValue !== undefined || Utils.pathExists(obj, field.path)) {
        Utils.setValueByPath(obj, field.path, field.value);
        this.env.log(`Modified ${field.path} = ${JSON.stringify(field.value)}`);
      } else {
        Utils.setValueByPath(obj, field.path, field.value);
        this.env.log(`Created ${field.path} = ${JSON.stringify(field.value)}`);
      }
    }
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
    console.log(`Plugin registered: ${config.name} [${config.mode || 'json'}]`);
  }

  getConfig(id) {
    return this.plugins.get(id);
  }

  autoDetect(url) {
    return Utils.detectApp(url, Object.fromEntries(this.plugins));
  }

  initConfigs(configs) {
    for (const [key, config] of Object.entries(configs)) {
      this.register(key, config);
    }
  }
}

// ==========================================
// 主入口
// ==========================================

function main() {
  const env = new Env('UnifiedVIP');
  const pluginManager = new PluginManager();

  // 加载所有配置
  pluginManager.initConfigs(APP_CONFIGS);

  // 获取响应和请求信息
  const response = env.getResponse();
  
  // 关键修复：优先使用 $request.url（与原始 tv.js 一致）
  const requestUrl = (typeof $request !== 'undefined' && $request.url) 
    ? $request.url 
    : (response.url || '');

  if (!requestUrl) {
    env.log('No request URL found');
    env.done({});
    return;
  }

  // 自动检测应用
  let appConfig = pluginManager.autoDetect(requestUrl);

  // 备用检测：通过脚本名称
  if (!appConfig) {
    const scriptTag = (typeof $script !== 'undefined' && $script.name) ? $script.name : '';
    const scriptMappings = {
      'iappdaily': 'iappdaily',
      'tophub': 'tophub',
      'gps': 'gps',
      'kyxq': 'kyxq',
      'mhlz': 'mhlz',
      'v2ex': 'v2ex',
      'foday': 'foday',
      'qiujingapp': 'qiujingapp',
      'keep': 'keep',
      'bqwz': 'bqwz',
      'bxkt': 'bxkt',
      'tv': 'tv'
    };

    for (const [keyword, configKey] of Object.entries(scriptMappings)) {
      if (scriptTag.includes(keyword)) {
        appConfig = pluginManager.getConfig(configKey);
        break;
      }
    }
  }

  // 兜底：通用配置
  if (!appConfig) {
    env.log('Could not detect app type, using generic VIP unlock');
    appConfig = {
      name: 'Generic',
      mode: PROCESSING_MODES.JSON,
      fields: {
        isVip: { path: 'data.is_vip', value: 1, type: 'number' },
        vipExpired: { path: 'data.vip_expire_date', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' }
      }
    };
  }

  // 创建引擎并执行 - 传入 requestUrl 用于多路径模式
  const engine = new VipUnlockEngine(env);
  engine.setConfig(appConfig);

  const result = engine.process(response, requestUrl);
  env.done(result);
}

// 执行主函数
main();
