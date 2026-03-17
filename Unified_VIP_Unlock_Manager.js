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
// 常量定义区
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
// 处理模式枚举
// ==========================================

const MODE = Object.freeze({
  JSON: 'json',       // JSON对象处理：字段映射 + 自定义处理器
  REGEX: 'regex',     // 正则替换：纯文本替换，不解析JSON
  GAME: 'game',       // 游戏数值：转义JSON字符串中的数值替换
  HYBRID: 'hybrid',   // 混合模式：先JSON，失败则回退到REGEX
  MULTIPATH: 'multipath', // 多路径：根据URL路径执行不同操作
  HTML: 'html'          // HTML替换：操作HTML内容
});

// ==========================================
// 应用配置区
// ==========================================

const APP_CONFIGS = Object.freeze({
  
  // JSON模式示例：iAppDaily - 简单字段映射
  iappdaily: {
    name: 'iAppDaily',
    urlPattern: /api\.iappdaily\.com\/my\/balance/,
    mode: MODE.JSON,
    fields: {
      isVip: { path: 'data.is_vip', value: 1 },
      isPaid: { path: 'data.is_paid', value: 1 },
      vipExpired: { path: 'data.vip_expired', value: 4102444800 },
      remainCoins: { path: 'data.remain_coins', value: 9999 },
      totalCoins: { path: 'data.total_coins', value: 9999 }
    }
  },

  // JSON模式示例：TopHub - 字段映射 + 响应包装器
  tophub: {
    name: 'TopHub',
    urlPattern: /api2\.tophub\.(today|app)\/account\/sync/,
    mode: MODE.JSON,
    fields: {
      error: { path: 'error', value: 0 },
      status: { path: 'status', value: 200 },
      isVip: { path: 'data.is_vip', value: "1" },
      isVipNow: { path: 'data.is_vip_now', value: 1 },
      vipExpired: { path: 'data.vip_expired', value: "2099-12-31 23:59:59" },
      vipType: { path: 'data.vip_type', value: "lifetime" },
      vipLevel: { path: 'data.vip_level', value: 99 }
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

  // JSON模式示例：GPS工具箱 - 多VIP类型
  gps: {
    name: 'GPS工具箱',
    urlPattern: /^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo/,
    mode: MODE.JSON,
    fields: {
      isVip: { path: 'data.is_vip', value: 1 },
      vipName: { path: 'data.vip_name', value: "VIP会员" },
      vipExpireDate: { path: 'data.vip_expire_date', value: 2099999 },
      isSuperVip: { path: 'data.is_super_vip', value: 1 },
      isPowerVip: { path: 'data.is_power_vip', value: 1 },
      groupVip: { path: 'data.group_vip', value: 1 },
      groupVipExpireDate: { path: 'data.group_vip_expire_date', value: 2099999 }
    }
  },

  // JSON模式示例：口语星球 - 自定义处理器（多场景）
  kyxq: {
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
        if (obj.data.vipLevel !== undefined) obj.data.vipLevel = 10;
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

  // JSON模式示例：魔幻粒子 - 嵌套遍历+条件逻辑
  mhlz: {
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

  // HTML模式示例：V2EX去广告
  v2ex: {
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

  // 多路径模式示例：复游会 - 数组过滤
  foday: {
    name: '复游会',
    urlPattern: /^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents/,
    mode: MODE.MULTIPATH,
    pathHandlers: [
      {
        path: '/getPageComponents',
        description: '过滤页面广告组件',
        handler(obj, env) {
          const AD_CODES = new Set([
            "TCMP_home_followingadvertising",
            "TC_Interactive_Ad", 
            "TC_Member_Banner",
            "TC_AIGO"
          ]);

          const components = obj?.data?.pageComponents;
          if (!Array.isArray(components)) return obj;

          const before = components.length;
          obj.data.pageComponents = components.filter(
            item => !AD_CODES.has(item?.componentCode)
          );
          
          env.log(`Filtered: ${before} -> ${obj.data.pageComponents.length} components`);
          return obj;
        }
      }
    ]
  },

  // 多路径模式示例：球竞APP - 数组清空
  qiujingapp: {
    name: '球竞APP',
    urlPattern: /^https?:\/\/gateway-api\.yizhilive\.com\/api\/(v2\/index\/carouses\/(3|6|8|11)|v3\/index\/all)/,
    mode: MODE.MULTIPATH,
    pathHandlers: [
      {
        path: '/api/v2/index/carouses/',
        pathRegex: /\/api\/v2\/index\/carouses\/(11|8|6|3)\b/,
        description: '清空轮播广告',
        handler(obj, env) {
          if (Array.isArray(obj.data)) {
            const count = obj.data.length;
            obj.data = [];
            env.log(`Cleared ${count} carouses`);
          }
          return obj;
        }
      },
      {
        path: '/api/v3/index/all',
        urlContains: 'position=2',
        description: '清空弹窗广告',
        handler(obj, env) {
          if (obj.data?.banners) {
            const count = obj.data.banners.length;
            obj.data.banners = [];
            env.log(`Cleared ${count} banners`);
          }
          return obj;
        }
      }
    ]
  },

  // 正则模式示例：Keep - 批量文本替换
  keep: {
    name: 'Keep',
    urlPattern: /^https?:\/\/(api|kit)\.gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\//,
    mode: MODE.REGEX,
    regexReplacements: [
      { pattern: /"memberStatus":\d+/g, replacement: '"memberStatus":1' },
      { pattern: /"hasPaid":\w+/g, replacement: '"hasPaid":true' },
      { pattern: /"isVip":\w+/g, replacement: '"isVip":true' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false' },
      { pattern: /"free":\w+/g, replacement: '"free":true' },
      { pattern: /"preview":\w+/g, replacement: '"preview":false' },
      { pattern: /"limitFree":\w+/g, replacement: '"limitFree":true' },
      { pattern: /"member":\w+/g, replacement: '"member":true' },
      { pattern: /"code":\d+/g, replacement: '"code":200' },
      { pattern: /":false/g, replacement: '":true' }
    ]
  },

  // 游戏数值模式示例：标枪王者 - 转义JSON数值替换
  bqwz: {
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

  // 混合模式示例：伴学课堂 - JSON优先，失败回退REGEX
  bxkt: {
    name: '伴学课堂',
    urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
    mode: MODE.HYBRID,
    // 第一步：尝试JSON处理
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
    // 第二步：JSON失败时的回退正则
    regexReplacements: [
      { pattern: /"isVip":false/g, replacement: '"isVip":true' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false' }
    ]
  },

  // 多路径模式示例：影视去广告 - 复杂路径处理
  tv: {
    name: '影视去广告',
    urlPattern: /^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body)/,
    mode: MODE.MULTIPATH,
    pathHandlers: [
      {
        path: '/basic/init',
        description: '开屏广告',
        handler(obj, env) {
          if (!obj.data) return obj;
          obj.data.startAdShowTime = 0;
          obj.data.startAd = null;
          obj.data.startAdList = null;
          env.log('Cleared start ads');
          return obj;
        }
      },
      {
        path: '/home/firstScreen',
        description: '焦点图+热门精简',
        handler(obj, env) {
          if (!obj.data) return obj;
          delete obj.data.focusAdList;
          if (Array.isArray(obj.data.hotMudleList)) {
            obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
          }
          return obj;
        }
      },
      {
        path: '/adInfo/getPageAd',
        description: '浮层弹窗广告',
        handler(obj, env) {
          if (!obj.data) return obj;
          delete obj.data.floatAd;
          delete obj.data.popupAd;
          return obj;
        }
      },
      {
        path: '/home/body',
        description: '列表首个广告',
        handler(obj, env) {
          if (Array.isArray(obj?.data?.adList) && obj.data.adList.length > 0) {
            obj.data.adList.shift();
          }
          return obj;
        }
      }
    ]
  }
});

// ==========================================
// 工具函数
// ==========================================

const Utils = {
  safeJsonParse(str, defaultVal = {}) {
    try {
      return JSON.parse(str);
    } catch {
      return defaultVal;
    }
  },

  safeJsonStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch {
      return '{}';
    }
  },

  // 根据路径获取值
  getByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  },

  // 根据路径设置值
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

  // 动态检测应用（按需加载）
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
// 环境兼容层
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
// VIP解锁引擎 - 各模式处理器
// ==========================================

class VipUnlockEngine {
  constructor(env, config) {
    this.env = env;
    this.config = config;
  }

  /**
   * 主入口：根据模式分发处理
   */
  process(responseBody, requestUrl) {
    const { mode } = this.config;
    
    this.env.log(`Processing [${mode}]: ${this.config.name}`);

    switch (mode) {
      case MODE.JSON:
        return this.processJson(responseBody);
      
      case MODE.REGEX:
        return this.processRegex(responseBody);
      
      case MODE.GAME:
        return this.processGame(responseBody);
      
      case MODE.HYBRID:
        return this.processHybrid(responseBody);
      
      case MODE.MULTIPATH:
        return this.processMultipath(responseBody, requestUrl);
      
      case MODE.HTML:
        return this.processHtml(responseBody);
      
      default:
        this.env.log(`Unknown mode: ${mode}`);
        return { body: responseBody };
    }
  }

  /**
   * JSON模式：解析→修改→序列化
   * 支持：字段映射 + 自定义处理器
   */
  processJson(body) {
    let data = Utils.safeJsonParse(body);
    if (!data || Object.keys(data).length === 0) {
      this.env.log('JSON parse failed');
      return { body };
    }

    // 1. 响应包装器（空数据时创建新结构）
    if (this.config.responseWrapper?.enabled) {
      const hasData = Utils.getByPath(data, 'data');
      if (!hasData || Object.keys(hasData).length === 0) {
        this.env.log('Using response wrapper template');
        data = JSON.parse(JSON.stringify(this.config.responseWrapper.template));
      }
    }

    // 2. 字段映射（批量设置值）
    if (this.config.fields) {
      Object.entries(this.config.fields).forEach(([key, field]) => {
        Utils.setByPath(data, field.path, field.value);
        this.env.log(`Set: ${field.path} = ${JSON.stringify(field.value)}`);
      });
    }

    // 3. 自定义处理器（复杂逻辑）
    if (typeof this.config.customProcessor === 'function') {
      data = this.config.customProcessor(data, this.env) || data;
    }

    return { body: Utils.safeJsonStringify(data) };
  }

  /**
   * 正则模式：纯文本替换，不解析JSON
   * 适用：字段不固定、格式混乱的接口
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
        this.env.log(`Rule ${index + 1} applied`);
      }
    });

    return { body: result };
  }

  /**
   * 游戏数值模式：专门处理转义JSON字符串
   * 原始格式：{\"coin\":123,\"diamond\":456}
   * 目标格式：{\"coin\":9999880,\"diamond\":9999880}
   */
  processGame(body) {
    const resources = this.config.gameResources || [];
    let result = body;

    this.env.log(`Modifying ${resources.length} game resources`);

    resources.forEach(res => {
      // 构建匹配转义JSON的正则
      // \\\" 在字符串中表示 \" （反斜杠+双引号）
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

    return { body: result };
  }

  /**
   * 混合模式：先尝试JSON，失败则回退到正则
   * 流程：Parse JSON → Process → Stringify | Fallback to Regex
   */
  processHybrid(body) {
    // 尝试JSON处理
    const data = Utils.safeJsonParse(body, null);
    
    if (data !== null && this.config.customProcessor) {
      this.env.log('Hybrid: JSON mode');
      try {
        const processed = this.config.customProcessor(data, this.env);
        return { body: Utils.safeJsonStringify(processed) };
      } catch (e) {
        this.env.log(`JSON failed: ${e.message}, fallback to regex`);
      }
    } else {
      this.env.log('Hybrid: JSON unavailable, using regex');
    }

    // 回退到正则
    return this.processRegex(body);
  }

  /**
   * 多路径模式：URL路由 + 操作分发
   * 根据URL路径匹配处理器，执行对应操作
   */
  processMultipath(body, requestUrl) {
    // 1. 解析JSON
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

    // 2. 查找匹配的路径处理器
    const handlers = this.config.pathHandlers || [];
    const matched = handlers.find(h => {
      // 基础路径匹配（子字符串）
      if (requestUrl.indexOf(h.path) === -1) return false;
      
      // 可选：正则验证
      if (h.pathRegex && !h.pathRegex.test(requestUrl)) return false;
      
      // 可选：URL包含验证
      if (h.urlContains && requestUrl.indexOf(h.urlContains) === -1) return false;
      
      return true;
    });

    if (!matched) {
      this.env.log('No path handler matched');
      return { body: JSON.stringify(data) };
    }

    this.env.log(`Matched path: ${matched.path} (${matched.description})`);

    // 3. 执行处理器
    try {
      const result = matched.handler(data, this.env);
      if (result !== undefined) {
        data = result;
      }
    } catch (e) {
      this.env.log(`Handler error: ${e.message}`);
    }

    return { body: JSON.stringify(data) };
  }

  /**
   * HTML模式：HTML内容替换
   * 适用：网页去广告、CSS注入
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

    return { body: result };
  }
}

// ==========================================
// 主程序
// ==========================================

function main() {
  const env = new Env('UnifiedVIP');

  // 获取请求信息
  const requestUrl = (typeof $request !== 'undefined' && $request.url) 
    ? $request.url 
    : '';

  if (!requestUrl) {
    env.log('No request URL');
    env.done({});
    return;
  }

  // 动态检测应用配置（按需加载）
  let config = Utils.detectApp(requestUrl);

  // 备用：通用配置
  if (!config) {
    env.log('Using generic config');
    config = {
      name: 'Generic',
      mode: MODE.JSON,
      fields: {
        isVip: { path: 'data.is_vip', value: 1 },
        vipExpired: { path: 'data.vip_expire_date', value: CONSTANTS.EXPIRE_TIMESTAMP }
      }
    };
  }

  // 获取响应体
  const response = env.getResponse();
  if (!response.body) {
    env.log('No response body');
    env.done({});
    return;
  }

  // 执行处理
  const engine = new VipUnlockEngine(env, config);
  const result = engine.process(response.body, requestUrl);
  
  env.done(result);
}

// 启动
main();
