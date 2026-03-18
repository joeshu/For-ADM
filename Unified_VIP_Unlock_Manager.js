/**
 * ==========================================
 * Unified VIP Unlock Manager
 * 统一 VIP 解锁管理器
 * @version 12.3.0
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
// 常量定义区 - 全局使用的常量值
// ==========================================

/**
 * 常量对象
 * 集中管理所有魔法数值，方便统一修改
 */
const CONSTANTS = Object.freeze({
  // 过期日期字符串格式（用于 TopHub 等需要字符串的场景）
  EXPIRE_DATE: "2099-12-31 23:59:59",
  // 过期时间戳（用于 iAppDaily 等需要数值的场景）
  EXPIRE_TIMESTAMP: 4102444800,
  // 过期时间戳（毫秒）
  EXPIRE_TIMESTAMP_MS: 4102416000000,
  // 大数值字符串（用于游戏货币）
  BIG_NUMBER_STR: "9999999999999999999988888888",
  // 默认金币/积分数量
  DEFAULT_COINS: 9999,
  // 默认 VIP 等级
  DEFAULT_VIP_LEVEL: 99,
  // 默认 VIP 类型标识
  DEFAULT_VIP_TYPE: "lifetime"
});

// ==========================================
// 处理模式枚举
// ==========================================

const MODE = Object.freeze({
  MULTIPATH: 'multipath', // 多路径：最特定，有明确的 pathHandlers
  HTML: 'html',             // HTML：特定，有 htmlReplacements
  HYBRID: 'hybrid',         // 混合：同时有 customProcessor 和 regexReplacements
  GAME: 'game',             // 游戏：有 gameResources
  REGEX: 'regex',           // 正则：有 regexReplacements
  JSON: 'json'              // JSON：默认，最常见
});

// ==========================================
// 应用配置区 - 新增应用只需在此添加配置
// ==========================================

/**
 * 应用配置对象
 * 每个键对应一个应用的配置，包含以下属性：
 * - id: 应用唯一标识（小写，无空格）
 * - name: 应用显示名称（用于日志）
 * - urlPattern: URL 正则表达式，用于自动识别当前请求对应的应用
 * - mode: 处理模式（json/regex/game/hybrid/multipath/html）
 * - fields: 字段映射表（JSON模式），支持多级路径（如 data.user.vip）
 * - responseWrapper: 响应包装器配置（可选），用于在原始响应为空时构造新响应
 * - customProcessor: 自定义处理函数（可选），用于特殊逻辑处理
 * - regexReplacements: 正则替换规则（REGEX/HYBRID模式）
 * - gameResources: 游戏数值配置（GAME模式）
 * - pathHandlers: 路径处理器（MULTIPATH模式）
 * - htmlReplacements: HTML替换规则（HTML模式）
 */
const APP_CONFIGS = Object.freeze({
  
  /**
   * iAppDaily 应用配置
   * 原文件：iappdaily.js
   * 功能：修改余额查询接口，激活 VIP 并增加金币
   */
  iappdaily: {
    id: 'iappdaily',
    name: 'iAppDaily',
    // URL 匹配：api.iappdaily.com/my/balance
    urlPattern: /api\.iappdaily\.com\/my\/balance/,
    mode: MODE.JSON,
    // VIP 字段映射
    fields: {
      isVip: { path: 'data.is_vip', value: 1, type: 'number' },
      isPaid: { path: 'data.is_paid', value: 1, type: 'number' },
      vipExpired: { path: 'data.vip_expired', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' },
      remainCoins: { path: 'data.remain_coins', value: CONSTANTS.DEFAULT_COINS, type: 'number' },
      totalCoins: { path: 'data.total_coins', value: CONSTANTS.DEFAULT_COINS, type: 'number' }
    },
    responseWrapper: null,
    customProcessor: null
  },

  /**
   * TopHub 应用配置
   * 原文件：tophub.js
   * 功能：修改账户同步接口，强制返回永久 VIP 状态
   * 特点：支持多域名匹配（tophub.today/app/xyz 等）
   */
  tophub: {
    id: 'tophub',
    name: 'TopHub',
    // URL 匹配：支持多域名（来自 unified-vip-unlock.js）
    urlPattern: /(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync/,
    mode: MODE.JSON,
    fields: {
      error: { path: 'error', value: 0, type: 'number' },
      status: { path: 'status', value: 200, type: 'number' },
      isVip: { path: 'data.is_vip', value: "1", type: 'string' },
      isVipNow: { path: 'data.is_vip_now', value: 1, type: 'number' },
      vipExpired: { path: 'data.vip_expired', value: CONSTANTS.EXPIRE_DATE, type: 'string' },
      vipType: { path: 'data.vip_type', value: CONSTANTS.DEFAULT_VIP_TYPE, type: 'string' },
      vipLevel: { path: 'data.vip_level', value: CONSTANTS.DEFAULT_VIP_LEVEL, type: 'number' }
    },
    // TopHub 特殊需求：data为空时构造新响应
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
    },
    customProcessor: null
  },

  /**
   * GPS工具箱应用配置
   * 原文件：gps.js
   * 功能：GPS工具箱 VIP 解锁（多种VIP类型）
   */
  gps: {
    id: 'gps',
    name: 'GPS工具箱',
    urlPattern: /^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo/,
    mode: MODE.JSON,
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
   * 口语星球应用配置
   * 原文件：kyxq.js
   * 功能：口语星球 VIP 解锁（多场景处理）
   */
  kyxq: {
    id: 'kyxq',
    name: '口语星球',
    urlPattern: /^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2/,
    mode: MODE.JSON,
    customProcessor(obj, env) {
      if (!obj.data) return obj;

      // 场景1：权限接口（对象类型）
      if (typeof obj.data === 'object' && !Array.isArray(obj.data)) {
        env.log('Processing permission interface');
        Object.assign(obj.data, {
          expireDate: CONSTANTS.EXPIRE_TIMESTAMP_MS,
          havePermission: true,
          type: 2,
          isVip: true
        });
        if (obj.data.vipLevel !== undefined) obj.data.vipLevel = CONSTANTS.DEFAULT_VIP_LEVEL;
      } 
      // 场景2：课程列表（数组类型）
      else if (Array.isArray(obj.data)) {
        env.log(`Processing ${obj.data.length} courses`);
        obj.data.forEach(course => {
          if (!course) return;
          course.overTime = CONSTANTS.EXPIRE_TIMESTAMP_MS;
          if (course.status !== undefined) course.status = 1;
          if (course.isStudyIng !== undefined) course.isStudyIng = 1;
        });
      }
      return obj;
    }
  },

  /**
   * 魔幻粒子应用配置
   * 原文件：mhlz.js
   * 功能：魔幻粒子游戏货币修改（任务进度/普通货币/事件货币区分处理）
   */
  mhlz: {
    id: 'mhlz',
    name: '魔幻粒子',
    urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
    mode: MODE.JSON,
    customProcessor(obj, env) {
      const currencies = obj?.currencies?.list;
      if (!currencies) {
        env.log('Currency list not found');
        return obj;
      }

      let quest = 0, normal = 0, events = 0;

      Object.entries(currencies).forEach(([key, currency]) => {
        if (!currency) return;

        if (key.startsWith("Quest_")) {
          currency.amount = "1";
          currency.total_collected = "1";
          quest++;
        } else if (key.startsWith("Event_")) {
          events++;
        } else {
          currency.amount = CONSTANTS.BIG_NUMBER_STR;
          currency.total_collected = CONSTANTS.BIG_NUMBER_STR;
          normal++;
        }
      });

      env.log(`Processed: ${quest} quests, ${normal} currencies, ${events} events`);
      return obj;
    }
  },

  /**
   * V2EX去广告应用配置
   * 原文件：v2ex.ads.js
   * 功能：V2EX 技术社区网站去广告（注入 CSS 隐藏广告元素）
   */
  v2ex: {
    id: 'v2ex',
    name: 'V2EX去广告',
    urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
    mode: MODE.HTML,
    htmlReplacements: [
      {
        pattern: /<head>/i,
        replacement: `<head><style>.topic-ads,.sidebar-ads,.adsbygoogle,[class*="ads"],[id*="ads"]{display:none!important;}</style>`,
        description: '注入CSS隐藏广告'
      }
    ]
  },

  /**
   * 复游会应用配置
   * 原文件：foday.js
   * 功能：复游会微信小程序去广告（页面组件过滤）
   */
  foday: {
    id: 'foday',
    name: '复游会',
    urlPattern: /^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents/,
    mode: MODE.MULTIPATH,
    pathHandlers: [
      {
        path: '/getPageComponents',
        description: '过滤页面广告组件',
        actions: [
          {
            type: 'arrayFilter',
            field: 'data.pageComponents',
            keyField: 'componentCode',
            excludeSet: [
              "TCMP_home_followingadvertising",
              "TC_Interactive_Ad",
              "TC_Member_Banner",
              "TC_AIGO"
            ],
            description: '过滤广告组件'
          }
        ]
      }
    ]
  },

  /**
   * 球竞APP应用配置
   * 原文件：qiujingapp.js
   * 功能：球竞APP去广告（轮播广告/弹窗推广数组清空）
   */
  qiujingapp: {
    id: 'qiujingapp',
    name: '球竞APP',
    urlPattern: /^https?:\/\/gateway-api\.yizhilive\.com\/api\/(v2\/index\/carouses\/(3|6|8|11)|v3\/index\/all)/,
    mode: MODE.MULTIPATH,
    pathHandlers: [
      {
        path: '/api/v2/index/carouses/',
        pathRegex: /\/api\/v2\/index\/carouses\/(11|8|6|3)\b/,
        description: '清空轮播广告',
        actions: [
          {
            type: 'custom',
            description: '清空广告数组',
            processor(obj, env) {
              if (Array.isArray(obj.data)) {
                const count = obj.data.length;
                obj.data = [];
                env.log(`Cleared ${count} carouses`);
              }
              return obj;
            }
          }
        ]
      },
      {
        path: '/api/v3/index/all',
        urlContains: 'position=2',
        description: '清空弹窗广告',
        actions: [
          {
            type: 'custom',
            description: '清空banners',
            processor(obj, env) {
              if (obj.data?.banners) {
                const count = obj.data.banners.length;
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

  /**
   * Keep应用配置
   * 原文件：keep.js
   * 功能：解锁课程预览、直播课、会员付费课跟练、会员训练计划
   */
  keep: {
    id: 'keep',
    name: 'Keep',
    urlPattern: /^https?:\/\/(api|kit)\.gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\//,
    mode: MODE.REGEX,
    regexReplacements: [
      { pattern: /"memberStatus":\d+/g, replacement: '"memberStatus":1', description: '会员状态' },
      { pattern: /"hasPaid":\w+/g, replacement: '"hasPaid":true', description: '已付费标识' },
      { pattern: /"isVip":\w+/g, replacement: '"isVip":true', description: 'VIP状态' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态' },
      { pattern: /"free":\w+/g, replacement: '"free":true', description: '免费标识' },
      { pattern: /"preview":\w+/g, replacement: '"preview":false', description: '预览模式' },
      { pattern: /"limitFree":\w+/g, replacement: '"limitFree":true', description: '限免标识' },
      { pattern: /"member":\w+/g, replacement: '"member":true', description: '会员标识' },
      { pattern: /"code":\d+/g, replacement: '"code":200', description: 'HTTP状态码' },
      { pattern: /":false/g, replacement: '":true', description: '全局false改true' }
    ]
  },

  /**
   * 标枪王者应用配置
   * 原文件：bqwz.js
   * 功能：标枪王者游戏数据修改（金币/钻石/经验/排位券/PVE体力）
   */
  bqwz: {
    id: 'bqwz',
    name: '标枪王者',
    urlPattern: /^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data/,
    mode: MODE.GAME,
    gameResources: [
      { field: 'coin', value: 9999880, description: '金币' },
      { field: 'diamond', value: 9999880, description: '钻石' },
      { field: 'exp', value: 9999880, description: '经验' },
      { field: 'rank_ticket', value: 666, description: '排位券' },
      { field: 'pve_power', value: 888, description: 'PVE体力' }
    ]
  },

  /**
   * 伴学课堂应用配置
   * 原文件：bxkt.js
   * 功能：伴学课堂 VIP 解锁，遍历嵌套数组解锁所有视频
   */
  bxkt: {
    id: 'bxkt',
    name: '伴学课堂',
    urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
    mode: MODE.HYBRID,
    customProcessor(obj, env) {
      if (!obj?.data) return obj;
      
      const d = obj.data;
      d.isVip = true;
      d.isHave = true;
      d.isLock = false;
      d.isSale = true;
      d.originalPrice = 0;
      d.salePrice = 0;

      if (Array.isArray(d.refBusinessList)) {
        d.refBusinessList.forEach(item => {
          if (item?.isLock === true) item.isLock = false;
        });
      }
      return obj;
    },
    regexReplacements: [
      { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态回退' }
    ]
  },

  /**
   * 影视去广告应用配置
   * 原文件：tv.js
   * 功能：影视应用去广告（开屏广告、焦点图广告、浮层广告、弹窗广告、列表广告）
   */
  tv: {
    id: 'tv',
    name: '影视去广告',
    urlPattern: /^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body)/,
    mode: MODE.MULTIPATH,
    pathHandlers: [
      {
        path: '/basic/init',
        description: '开屏广告',
        actions: [
          {
            type: 'custom',
            description: '清除开屏广告',
            processor(obj, env) {
              if (!obj.data) return obj;
              obj.data.startAdShowTime = 0;
              obj.data.startAd = null;
              obj.data.startAdList = null;
              env.log('Cleared start ads');
              return obj;
            }
          }
        ]
      },
      {
        path: '/home/firstScreen',
        description: '焦点图+热门精简',
        actions: [
          {
            type: 'custom',
            description: '删除焦点图并精简热门',
            processor(obj, env) {
              if (!obj.data) return obj;
              delete obj.data.focusAdList;
              if (Array.isArray(obj.data.hotMudleList)) {
                obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
              }
              return obj;
            }
          }
        ]
      },
      {
        path: '/adInfo/getPageAd',
        description: '浮层弹窗广告',
        actions: [
          {
            type: 'custom',
            description: '删除浮层和弹窗',
            processor(obj, env) {
              if (!obj.data) return obj;
              delete obj.data.floatAd;
              delete obj.data.popupAd;
              return obj;
            }
          }
        ]
      },
      {
        path: '/home/body',
        description: '列表首个广告',
        actions: [
          {
            type: 'custom',
            description: '移除首个广告',
            processor(obj, env) {
              if (Array.isArray(obj?.data?.adList) && obj.data.adList.length > 0) {
                obj.data.adList.shift();
              }
              return obj;
            }
          }
        ]
      }
    ]
  }
});

// ==========================================
// 工具函数库
// ==========================================

/**
 * Utils 工具对象
 * 提供 JSON 处理、对象操作、路径解析等通用功能
 */
const Utils = {
  /**
   * 安全解析 JSON 字符串
   * @param {string} str - 要解析的 JSON 字符串
   * @param {*} defaultVal - 解析失败时的默认值
   * @returns {*} 解析后的对象，或默认值
   */
  safeJsonParse(str, defaultVal = {}) {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.log(`JSON parse error: ${e}`);
      return defaultVal;
    }
  },

  /**
   * 安全序列化为 JSON 字符串
   * @param {*} obj - 要序列化的对象
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
   * @param {Object} obj - 源对象
   * @param {string} path - 路径字符串，使用点号分隔
   * @returns {*} 路径对应的值，不存在则返回 undefined
   */
  getByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  },

  /**
   * 根据路径设置对象值
   * 自动创建不存在的中间对象，支持多级路径
   * @param {Object} obj - 目标对象
   * @param {string} path - 路径字符串，使用点号分隔
   * @param {*} value - 要设置的值
   * @returns {Object} 修改后的对象
   */
  setByPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return obj;
  },

  /**
   * 检查路径是否存在
   * @param {Object} obj - 源对象
   * @param {string} path - 路径字符串
   * @returns {boolean} 路径是否存在
   */
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

  /**
   * 动态检测应用配置（按需加载）
   * @param {string} url - 当前请求的 URL
   * @returns {Object|null} 匹配的应用配置
   */
  detectApp(url) {
    for (const [id, config] of Object.entries(APP_CONFIGS)) {
      if (config.urlPattern?.test(url)) {
        console.log(`[UnifiedVIP] Loaded: ${config.name} [${config.mode}]`);
        return { ...config, id };
      }
    }
    return null;
  }
};

// ==========================================
// 环境兼容层 - 封装 Quantumult X / Surge / Loon 的 API 差异
// ==========================================

/**
 * Env 环境类
 * 提供跨平台（QX/Surge/Loon）的兼容封装
 */
class Env {
  /**
   * 构造函数
   * @param {string} name - 脚本名称（用于日志标识）
   */
  constructor(name) {
    this.name = name;
    this.isQX = typeof $task !== 'undefined';
    this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
    this.isLoon = typeof $loon !== 'undefined';
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
   * @param {Object} object - 返回给代理工具的对象
   */
  done(object) {
    $done(object);
  }

  /**
   * 获取响应对象
   * @returns {Object} 响应对象，包含 body、url、headers 等
   */
  getResponse() {
    return $response || {};
  }
}

// ==========================================
// VIP解锁引擎 - 核心处理类
// ==========================================

/**
 * VipUnlockEngine VIP 解锁引擎
 * 支持六种处理模式：JSON / REGEX / GAME / HYBRID / MULTIPATH / HTML
 */
class VipUnlockEngine {
  /**
   * 构造函数
   * @param {Env} env - 环境对象
   * @param {Object} config - 应用配置对象
   */
  constructor(env, config) {
    this.env = env;
    this.config = config;
  }

  /**
   * 执行 VIP 解锁主流程
   * 根据配置的模式分发到对应的处理器
   * @param {string} responseBody - 响应体文本
   * @param {string} requestUrl - 请求 URL（用于多路径模式）
   * @returns {Object} 处理结果，包含修改后的 body
   */
  process(responseBody, requestUrl) {
    const mode = this.config.mode || this.detectMode();
    this.env.log(`Processing [${mode}]: ${this.config.name}`);

    switch (mode) {
      case MODE.MULTIPATH:
        return this.processMultipath(responseBody, requestUrl);
      case MODE.HTML:
        return this.processHtml(responseBody);
      case MODE.HYBRID:
        return this.processHybrid(responseBody);
      case MODE.GAME:
        return this.processGame(responseBody);
      case MODE.REGEX:
        return this.processRegex(responseBody);
      case MODE.JSON:
        return this.processJson(responseBody);
      default:
        this.env.log(`Unknown mode: ${mode}, using JSON`);
        return this.processJson(responseBody);
    }
  }

  /**
   * 自动检测处理模式（优先级：MULTIPATH > HTML > HYBRID > GAME > REGEX > JSON）
   * @returns {string} 检测到的模式
   */
  detectMode() {
    if (this.config.pathHandlers && Array.isArray(this.config.pathHandlers)) {
      return MODE.MULTIPATH;
    }
    if (this.config.htmlReplacements && Array.isArray(this.config.htmlReplacements)) {
      return MODE.HTML;
    }
    if (this.config.customProcessor && this.config.regexReplacements) {
      return MODE.HYBRID;
    }
    if (this.config.gameResources && Array.isArray(this.config.gameResources)) {
      return MODE.GAME;
    }
    if (this.config.regexReplacements && Array.isArray(this.config.regexReplacements)) {
      return MODE.REGEX;
    }
    return MODE.JSON;
  }

  /**
   * JSON模式：解析→修改→序列化
   * 支持字段映射和自定义处理器
   */
  processJson(body) {
    let data = Utils.safeJsonParse(body);
    if (!data || Object.keys(data).length === 0) {
      this.env.log('JSON parse failed');
      return { body };
    }

    // 响应包装器：data为空时构造新响应
    if (this.config.responseWrapper?.enabled) {
      const hasData = Utils.getByPath(data, 'data');
      if (!hasData || Object.keys(hasData).length === 0) {
        this.env.log('Data empty, creating new VIP response from template');
        data = JSON.parse(JSON.stringify(this.config.responseWrapper.template));
      }
    }

    // 字段映射
    if (this.config.fields) {
      Object.entries(this.config.fields).forEach(([key, field]) => {
        const currentValue = Utils.getByPath(data, field.path);
        
        if (currentValue !== undefined || Utils.pathExists(data, field.path)) {
          Utils.setByPath(data, field.path, field.value);
          this.env.log(`Modified ${field.path} = ${JSON.stringify(field.value)}`);
        } else {
          Utils.setByPath(data, field.path, field.value);
          this.env.log(`Created ${field.path} = ${JSON.stringify(field.value)}`);
        }
      });
    }

    // 自定义处理器
    if (typeof this.config.customProcessor === 'function') {
      data = this.config.customProcessor(data, this.env) || data;
    }

    this.env.log(`VIP unlocked for ${this.config.name}`);
    return { body: Utils.safeJsonStringify(data) };
  }

  /**
   * 正则模式：纯文本替换，不解析JSON
   */
  processRegex(body) {
    const rules = this.config.regexReplacements || [];
    let result = body;

    this.env.log(`Applying ${rules.length} regex rules`);

    rules.forEach((rule, index) => {
      const pattern = rule.pattern instanceof RegExp 
        ? rule.pattern 
        : new RegExp(rule.pattern, 'g');
      
      const before = result;
      result = result.replace(pattern, rule.replacement);
      
      if (result !== before) {
        this.env.log(`Applied: ${rule.description || `Rule ${index + 1}`}`);
      }
    });

    this.env.log(`VIP unlocked for ${this.config.name} (Regex mode)`);
    return { body: result };
  }

  /**
   * 游戏数值模式：转义JSON字符串中的数值替换
   * 匹配格式：\"field\":123 → \"field\":999
   */
  processGame(body) {
    const resources = this.config.gameResources || [];
    let result = body;

    this.env.log(`Modifying ${resources.length} game resources`);

    resources.forEach(res => {
      const pattern = new RegExp(`\\\\"${res.field}\\\\":(\\d+)`, 'g');
      const replacement = `\\\\"${res.field}\\\\":${res.value}`;
      
      const before = result;
      result = result.replace(pattern, replacement);

      this.env.log(
        result !== before 
          ? `✓ ${res.description}: ${res.value}` 
          : `✗ ${res.description} not found`
      );
    });

    this.env.log(`Game resources modified for ${this.config.name}`);
    return { body: result };
  }

  /**
   * 混合模式：先尝试JSON，失败回退REGEX
   */
  processHybrid(body) {
    const data = Utils.safeJsonParse(body, null);
    
    if (data !== null && this.config.customProcessor) {
      this.env.log('Hybrid: trying JSON mode');
      try {
        const processed = this.config.customProcessor(data, this.env);
        this.env.log(`VIP unlocked for ${this.config.name} (Hybrid-JSON mode)`);
        return { body: Utils.safeJsonStringify(processed) };
      } catch (e) {
        this.env.log(`JSON failed: ${e.message}, fallback to regex`);
      }
    } else {
      this.env.log('Hybrid: JSON unavailable, using regex');
    }

    return this.processRegex(body);
  }

  /**
   * 多路径模式：URL路由 + 操作分发
   */
  processMultipath(body, requestUrl) {
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      this.env.log(`JSON parse error: ${e.message}`);
      return { body };
    }

    if (!data) {
      return { body };
    }

    const handlers = this.config.pathHandlers || [];
    const matched = handlers.find(h => this.matchPath(requestUrl, h));

    if (!matched) {
      this.env.log('No path handler matched');
      return { body: JSON.stringify(data) };
    }

    this.env.log(`Matched path: ${matched.path} (${matched.description})`);

    for (const action of matched.actions) {
      try {
        this.executeAction(data, action);
      } catch (e) {
        this.env.log(`Action error [${action.type}]: ${e.message}`);
      }
    }

    this.env.log(`Completed for path: ${matched.path}`);
    return { body: JSON.stringify(data) };
  }

  /**
   * 路径匹配检查
   */
  matchPath(url, handler) {
    if (url.indexOf(handler.path) === -1) return false;
    if (handler.pathRegex && !handler.pathRegex.test(url)) return false;
    if (handler.urlContains && url.indexOf(handler.urlContains) === -1) return false;
    if (handler.urlExcludeRegex && handler.urlExcludeRegex.test(url)) return false;
    return true;
  }

  /**
   * 执行多路径操作
   */
  executeAction(obj, action) {
    switch (action.type) {
      case 'delete':
        this.handleDelete(obj, action);
        break;
      case 'set':
        this.handleSet(obj, action);
        break;
      case 'arraySlice':
        this.handleArraySlice(obj, action);
        break;
      case 'arrayShift':
        this.handleArrayShift(obj, action);
        break;
      case 'arrayFilter':
        this.handleArrayFilter(obj, action);
        break;
      case 'custom':
        if (typeof action.processor === 'function') {
          const result = action.processor(obj, this.env);
          if (result !== undefined) Object.assign(obj, result);
          this.env.log(`Executed custom: ${action.description}`);
        }
        break;
      default:
        this.env.log(`Unknown action type: ${action.type}`);
    }
  }

  handleDelete(obj, action) {
    if (Utils.getByPath(obj, action.field) !== undefined) {
      const parts = action.field.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      delete current[parts[parts.length - 1]];
      this.env.log(`Deleted: ${action.field} (${action.description})`);
    }
  }

  handleSet(obj, action) {
    Utils.setByPath(obj, action.field, action.value);
    this.env.log(`Set: ${action.field} = ${JSON.stringify(action.value)} (${action.description})`);
  }

  handleArraySlice(obj, action) {
    const arr = Utils.getByPath(obj, action.field);
    if (Array.isArray(arr)) {
      const originalLength = arr.length;
      const newArr = arr.slice(0, action.keepCount);
      Utils.setByPath(obj, action.field, newArr);
      this.env.log(`Sliced: ${action.field} ${originalLength} -> ${newArr.length} (${action.description})`);
    }
  }

  handleArrayShift(obj, action) {
    const arr = Utils.getByPath(obj, action.field);
    if (Array.isArray(arr) && arr.length > 0) {
      const removed = arr.shift();
      this.env.log(`Shifted: ${action.field}, removed: ${removed?.title || 'item'} (${action.description})`);
    }
  }

  handleArrayFilter(obj, action) {
    const arr = Utils.getByPath(obj, action.field);
    if (Array.isArray(arr) && action.excludeSet && action.keyField) {
      const originalLength = arr.length;
      const excludeSet = new Set(action.excludeSet);
      const newArr = arr.filter(item => !excludeSet.has(item[action.keyField]));
      Utils.setByPath(obj, action.field, newArr);
      this.env.log(`Filtered: ${action.field} ${originalLength} -> ${newArr.length} (${action.description})`);
    }
  }

  /**
   * HTML模式：HTML内容替换
   */
  processHtml(body) {
    const rules = this.config.htmlReplacements || [];
    let result = body;

    this.env.log(`Applying ${rules.length} HTML rules`);

    rules.forEach((rule, index) => {
      try {
        const pattern = rule.pattern instanceof RegExp 
          ? rule.pattern 
          : new RegExp(rule.pattern, 'i');
        
        result = result.replace(pattern, rule.replacement);
        this.env.log(`Rule ${index + 1}: ${rule.description || 'applied'}`);
      } catch (e) {
        this.env.log(`Rule ${index + 1} error: ${e.message}`);
      }
    });

    this.env.log(`Ad removal completed for ${this.config.name} (HTML mode)`);
    return { body: result };
  }
}

// ==========================================
// 主入口函数
// ==========================================

/**
 * main 主函数
 * 脚本执行流程：
 * 1. 初始化环境和配置
 * 2. 检测当前请求对应的应用
 * 3. 创建引擎并执行 VIP 解锁
 * 4. 返回修改后的响应
 */
function main() {
  const env = new Env('UnifiedVIP');

  // 获取请求URL
  const requestUrl = (typeof $request !== 'undefined' && $request.url) 
    ? $request.url 
    : '';

  if (!requestUrl) {
    env.log('No request URL found');
    env.done({});
    return;
  }

  // 动态检测应用配置
  let config = Utils.detectApp(requestUrl);

  // 备用：通过脚本名称检测
  if (!config) {
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
        config = { ...APP_CONFIGS[configKey], id: configKey };
        break;
      }
    }
  }

  // 兜底：通用配置
  if (!config) {
    env.log('Could not detect app type, using generic VIP unlock');
    config = {
      name: 'Generic',
      mode: MODE.JSON,
      fields: {
        isVip: { path: 'data.is_vip', value: 1, type: 'number' },
        vipExpired: { path: 'data.vip_expired', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' }
      },
      responseWrapper: null,
      customProcessor: null
    };
  }

  // 获取响应体
  const response = env.getResponse();
  if (!response.body) {
    env.log('No response body found');
    env.done({});
    return;
  }

  // 创建引擎并执行处理
  const engine = new VipUnlockEngine(env, config);
  const result = engine.process(response.body, requestUrl);
  
  env.done(result);
}

// 启动
main();
