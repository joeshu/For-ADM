/**
 * ==========================================
 * Unified VIP Unlock Manager v13.1.4 (Final Corrected)
 * 统一 VIP 解锁管理器 - 最终修正版
 * @version 13.1.4
 * @description 修正正则表达式，支持声明式处理器
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
  # 成语来解压 - 微信小程序无限金币（游戏数值模式）
  ^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js
  # 星际使命 - 微信小程序游戏数据修改（JSON自定义处理器）
  ^https?:\/\/star\.jvplay\.cn\/v2\/storage url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v2.js

 [mitm]
 hostname = api.iappdaily.com, api2.tophub.today, api2.tophub.app, api3.tophub.xyz, api3.tophub.today, api3.tophub.app, tophub.tophubdata.com, tophub2.tophubdata.com, tophub.idaily.today, tophub2.idaily.today, tophub.remai.today, tophub.iappdaiy.com, tophub.ipadown.com,service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com,api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com,yr-game-api.feigo.fun,star.jvplay.cn
 */
'use strict';

// ==========================================
// 元数据与配置
// ==========================================

const META = {
  name: 'UnifiedVIP',
  version: '13.1.4',
  author: 'joeshu & contributors',
  description: 'Unified VIP Unlock Manager',
  updated: '2026-03-19'
};

// ==========================================
// 常量定义区 - 全局使用的常量值
// ==========================================

const CONSTANTS = Object.freeze({
  // 时间相关
  EXPIRE_DATE: "2099-12-31 23:59:59",
  EXPIRE_TIMESTAMP: 4102444800, // 秒级时间戳
  EXPIRE_TIMESTAMP_MS: 4102416000000, // 毫秒级时间戳

  // 数值相关
  BIG_NUMBER_STR: "99999999988888888",
  DEFAULT_COINS: 9999,
  DEFAULT_VIP_LEVEL: 99,
  DEFAULT_VIP_TYPE: "lifetime",

  // 状态相关
  STATUS_SUCCESS: 200,
  STATUS_OK: 0,

  // 处理模式
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
// 配置验证 Schema
// ==========================================

const CONFIG_SCHEMA = {
  required: ['id', 'name', 'urlPattern'],
  modes: {
    json: {
      optional: ['fields', 'responseWrapper', 'customProcessor']
    },
    regex: {
      required: ['regexReplacements']
    },
    game: {
      required: ['gameResources']
    },
    hybrid: {
      required: ['customProcessor', 'regexReplacements']
    },
    multipath: {
      required: ['pathHandlers']
    },
    html: {
      required: ['htmlReplacements']
    }
  }
};

// ==========================================
// 全局配置开关（之前遗漏，现已补上）
// ==========================================

const GLOBAL_CONFIG = Object.freeze({
  DEBUG: false,
  ENABLE_CACHE: true,
  MAX_CACHE_SIZE: 100
});

// ==========================================
// ProcessorUtils - 声明式处理器工具库（新增）
// ==========================================

const ProcessorUtils = {
  /**
   * 声明式字段批量设置
   * @param {Object} fieldsMap - 字段映射表 { 'path.to.field': value | function }
   */
  setFields(fieldsMap) {
    return function(obj, env) {
      let modified = 0;
      for (const [path, value] of Object.entries(fieldsMap)) {
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
   * 声明式数组批量修改
   * @param {String} arrayPath - 数组路径
   * @param {Object} fieldMap - 字段映射 { fieldName: value }
   * @param {Function} condition - 可选：条件函数 (item, index) => boolean
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
   * 声明式数组过滤
   * @param {String} arrayPath - 数组路径
   * @param {Object} options - 配置 { excludeSet, keyExtractor, keepPredicate, logName }
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
        filtered = arr.filter(item => !excludeSet.has(keyExtractor(item)));
      } else if (keepPredicate) {
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
   * 清空数组
   * @param {String} arrayPath - 数组路径
   * @param {Object} options - { logName }
   */
  clearArray(arrayPath, options = {}) {
    return function(obj, env) {
      const arr = Utils.getValueByPath(obj, arrayPath);
      if (Array.isArray(arr)) {
        const count = arr.length;
        arr.length = 0;
        if (env) env.log(`Cleared ${options.logName || arrayPath}: ${count} items`);
      }
      return obj;
    };
  },

  /**
   * 按 Key 前缀处理对象属性
   * @param {String} objPath - 对象路径
   * @param {Object} prefixHandlers - { 'Prefix_': { fields }, '*': defaultHandler }
   * @param {Object} options - { logPrefix }
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
          if (prefix === '*') continue;
          
          if (key.startsWith(prefix)) {
            if (handler && typeof handler === 'object') {
              Object.assign(value, handler);
            }
            stats[prefix] = (stats[prefix] || 0) + 1;
            matched = true;
            break;
          }
        }
        
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
   * 场景分发器 - 替代硬编码 if-else
   * @param {Array} scenes - [{ name, when, then }]
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
            break;
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
   * 错误边界包装器
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
   * 处理器链式组合
   */
  compose(...processors) {
    return function(obj, env) {
      return processors.reduce((acc, processor) => {
        if (!acc) return acc;
        return processor(acc, env);
      }, obj);
    };
  }
};

// ==========================================
// 应用配置区 - 新增应用只需在此添加配置
// ==========================================

const APP_CONFIGS = Object.freeze({

  // ==========================================
  // 1. JSON 对象模式示例
  // ==========================================

  /**
   * iAppDaily - 余额查询接口
   * 模式：JSON 字段映射
   */
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

  /**
   * TopHub - 账户同步接口
   * 模式：JSON 字段映射 + 响应包装器
   */
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

  /**
   * GPS工具箱 - 多种VIP类型
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
    }
  },

  /**
   * 口语星球 - 多场景处理（权限接口/课程列表）
   * 优化：使用场景分发器替代 if-else
   */
  kyxq: {
    id: 'kyxq',
    name: '口语星球',
    urlPattern: /^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2/,
    mode: 'json',
    customProcessor: ProcessorUtils.createSceneDispatcher([
      {
        name: 'permission',
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
        name: 'courseList',
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
   * 魔幻粒子 - 嵌套遍历+条件逻辑
   * 优化：使用前缀处理器替代手动遍历
   */
  mhlz: {
    id: 'mhlz',
    name: '魔幻粒子',
    urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
    mode: 'json',
    customProcessor: ProcessorUtils.processByKeyPrefix('currencies.list', {
      'Quest_': { amount: "1", total_collected: "1" },
      'Event_': {},
      '*': { amount: CONSTANTS.BIG_NUMBER_STR, total_collected: CONSTANTS.BIG_NUMBER_STR }
    }, { 
      logPrefix: 'Currency'
    })
  },

  // ==========================================
  // 2. HTML 替换模式示例
  // ==========================================

  /**
   * V2EX - 网页去广告
   * 修正：前瞻后添加 .*$ 确保匹配完整路径
   */
  v2ex: {
    id: 'v2ex',
    name: 'V2EX去广告',
    urlPattern: /^https?:\/\/[^\/]*v2ex\.com\/(?!.*(?:api|login|cdn-cgi|verify|auth|captch|\.js|\.css|\.jpg|\.jpeg|\.png|\.webp|\.gif|\.zip|\.woff|\.woff2|\.m3u8|\.mp4|\.mov|\.m4v|\.avi|\.mkv|\.flv|\.rmvb|\.wmv|\.rm|\.asf|\.asx|\.mp3|\.json|\.ico|\.otf|\.ttf)).*$/,
    mode: 'html',
    htmlReplacements: [
      {
        pattern: /<\/head>/i,
        replacement: `<style>.ads, .ad_container, #ads { display: none !important; }</style></head>`,
        description: '注入CSS隐藏广告元素'
      }
    ]
  },

  // ==========================================
  // 3. 多路径模式示例（去广告专用）
  // ==========================================

  /**
   * 复游会 - 微信小程序去广告
   * 优化：使用声明式数组过滤
   */
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
            processor: ProcessorUtils.filterArray('data.pageComponents', {
              excludeSet: new Set([
                "TCMP_home_followingadvertising",
                "TC_Interactive_Ad",
                "TC_Member_Banner",
                "TC_AIGO"
              ]),
              keyExtractor: (item) => item.componentCode,
              logName: 'pageComponents'
            })
          }
        ]
      }
    ]
  },

  /**
   * 球竞APP - 轮播广告/弹窗推广
   * 优化：使用 clearArray 替代手动清空
   */
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
            processor: ProcessorUtils.clearArray('data', { logName: 'carousel ads' })
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
            processor: ProcessorUtils.clearArray('data.banners', { logName: 'banners' })
          }
        ]
      }
    ]
  },

  /**
   * 影视去广告 - 多接口处理
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

  // ==========================================
  // 4. 正则替换模式示例
  // ==========================================

  /**
   * Keep - 课程/会员接口
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

  // ==========================================
  // 5. 游戏数值模式示例
  // ==========================================

  /**
   * 标枪王者 - 游戏数据修改
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

  // ==========================================
  // 6. 混合模式示例
  // ==========================================

  /**
   * 伴学课堂 - VIP解锁（JSON为主，失败回退正则）
   * 优化：使用 compose 组合多个声明式处理器
   */
  bxkt: {
    id: 'bxkt',
    name: '伴学课堂',
    urlPattern: /^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1/,
    mode: 'hybrid',
    customProcessor: ProcessorUtils.compose(
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
      ProcessorUtils.mapArray('data.refBusinessList', {
        isLock: false
      }, (item) => item?.isLock === true)
    ),
    regexReplacements: [
      { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' },
      { pattern: /"isHave":false/g, replacement: '"isHave":true', description: '拥有状态回退' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false', description: '锁定状态回退' }
    ]
  }
});

// ==========================================
// 工具类 - Env 兼容层（支持 QX/Surge/Loon）
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
    const timestamp = new Date().toISOString();
    const prefix = `[${this.name}][${level.toUpperCase()}][${timestamp}]`;
    const message = `${prefix} ${msg}`;

    console.log(message);

    // QX 支持通知
    if (this.isQX && level === 'error') {
      $notify(this.name, 'Error', msg);
    }
  }

  debug(msg) { this.log('debug', msg); }
  info(msg) { this.log('info', msg); }
  warn(msg) { this.log('warn', msg); }
  error(msg) { this.log('error', msg); }

  done(object) {
    // 确保始终返回有效响应
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
// 工具函数库 - 优化版
// ==========================================

const Utils = {
  // 缓存编译后的正则表达式
  _regexCache: new Map(),

  /**
   * 安全解析 JSON
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
   * 安全序列化 JSON
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
   * 根据路径获取值（支持数组索引）
   * 修正：修复正则转义错误，正确匹配 items[0] 格式
   */
  getValueByPath(obj, path) {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      // 支持数组索引，如 data.items[0].name
      // 修正：原代码使用 \\[ 和 \\d 导致匹配失败，现改为 \[ 和 \d
      const match = part.match(/^([^[]+)\[(\d+)\]$/);
      if (match) {
        const arr = acc[match[1]];
        return Array.isArray(arr) ? arr[parseInt(match[2])] : undefined;
      }
      return acc[part];
    }, obj);
  },

  /**
   * 根据路径设置值（自动创建中间对象/数组）
   * 增强：支持数组索引路径，如 data.items[0].name
   */
  setValueByPath(obj, path, value) {
    if (!path || !obj) return obj;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];
      
      // 检查当前部分是否包含数组索引，如 items[0]
      const match = part.match(/^([^[]+)\[(\d+)\]$/);
      
      if (match) {
        // 当前部分是数组索引
        const arrName = match[1];
        const arrIndex = parseInt(match[2]);
        
        if (!(arrName in current) || !Array.isArray(current[arrName])) {
          current[arrName] = [];
        }
        
        // 确保数组有足够长度
        while (current[arrName].length <= arrIndex) {
          current[arrName].push({});
        }
        
        if (i === parts.length - 2) {
          // 倒数第二部分是数组索引，直接设置
          current[arrName][arrIndex] = value;
          return obj;
        } else {
          // 还需要继续深入
          if (!current[arrName][arrIndex] || typeof current[arrName][arrIndex] !== 'object') {
            current[arrName][arrIndex] = {};
          }
          current = current[arrName][arrIndex];
        }
      } else {
        // 普通对象属性
        // 检查下一部分是否是数组索引
        const isNextArray = /^[^[]+\[\d+\]$/.test(nextPart);
        
        if (!(part in current) || current[part] === null) {
          current[part] = isNextArray ? [] : {};
        }
        current = current[part];
      }
    }

    // 处理最后一部分
    const lastPart = parts[parts.length - 1];
    const lastMatch = lastPart.match(/^([^[]+)\[(\d+)\]$/);
    
    if (lastMatch) {
      // 最后一部分是数组索引
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
      current[lastPart] = value;
    }
    
    return obj;
  },

  /**
   * 检查路径是否存在
   */
  pathExists(obj, path) {
    return this.getValueByPath(obj, path) !== undefined;
  },

  /**
   * 获取或编译正则表达式（带缓存）
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
   * 深度合并对象
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
  },

  /**
   * 检测应用配置（优化：使用 Map 缓存 URL 匹配结果）
   */
  detectApp(url, configs) {
    if (!url) return null;

    for (const [key, config] of Object.entries(configs)) {
      if (config.urlPattern && config.urlPattern.test(url)) {
        return config;
      }
    }
    return null;
  }
};

// ==========================================
// 配置验证器
// ==========================================

class ConfigValidator {
  static validate(config) {
    const errors = [];

    // 必填字段检查
    for (const field of CONFIG_SCHEMA.required) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // 模式特定检查
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
}

// ==========================================
// VIP 解锁核心引擎 v2.0
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
    // 验证配置
    const validation = ConfigValidator.validate(config);
    if (!validation.valid) {
      this.env.error(`Config validation failed: ${validation.errors.join(', ')}`);
      // 使用默认配置继续
      config = this.getDefaultConfig();
    }

    this.config = config;
    this.stats.mode = config.mode || 'auto';
    this.env.info(`Initialized: ${config.name} [Mode: ${this.stats.mode}]`);
  }

  getDefaultConfig() {
    return {
      name: 'Generic',
      mode: 'json',
      fields: {
        isVip: { path: 'data.is_vip', value: 1, type: 'number' },
        vipExpired: { path: 'data.vip_expire_date', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' }
      }
    };
  }

  /**
   * 主处理入口
   */
  process(response) {
    try {
      if (!response?.body) {
        this.env.warn('No response body found');
        return this.createErrorResponse('No response body');
      }

      const mode = this.config.mode || this.detectMode();
      this.stats.mode = mode;

      this.env.debug(`Processing with mode: ${mode}`);

      switch (mode) {
        case CONSTANTS.MODES.HTML:
          return this.processHtmlMode(response.body);
        case CONSTANTS.MODES.MULTIPATH:
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
      // 失败时返回原始响应，避免破坏应用
      return { body: response.body };
    }
  }

  /**
   * 自动检测处理模式
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
   * HTML 替换模式
   */
  processHtmlMode(body) {
    let modifiedBody = body;
    const replacements = this.config.htmlReplacements || [];

    this.env.debug(`HTML replacements: ${replacements.length} rules`);

    for (const rule of replacements) {
      try {
        const regex = Utils.getRegExp(rule.pattern, 'i');
        const original = modifiedBody;
        modifiedBody = modifiedBody.replace(regex, rule.replacement);

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
   * 多路径处理模式（增强版）
   */
  processMultipathMode(body, url) {
    let obj = Utils.safeJsonParse(body);
    if (!obj) {
      return this.createErrorResponse('Failed to parse JSON');
    }

    const handlers = this.config.pathHandlers || [];
    let matched = false;

    for (const handler of handlers) {
      // 路径匹配逻辑
      const pathMatch = url.includes(handler.path);
      const regexMatch = !handler.pathRegex || handler.pathRegex.test(url);
      const containsMatch = !handler.urlContains || url.includes(handler.urlContains);

      if (pathMatch && regexMatch && containsMatch) {
        matched = true;
        this.env.debug(`Matched handler: ${handler.path}`);

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

    if (!matched) {
      this.env.debug('No matching path handler found');
    }

    return { body: Utils.safeJsonStringify(obj) };
  }

  /**
   * 执行单个动作
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
    this.env.debug(`Deleted: ${action.field}`);
  }

  actionSet(obj, action) {
    Utils.setValueByPath(obj, action.field, action.value);
    this.stats.modifications++;
    this.env.debug(`Set: ${action.field} = ${JSON.stringify(action.value)}`);
  }

  actionArraySlice(obj, action) {
    const arr = Utils.getValueByPath(obj, action.field);
    if (Array.isArray(arr)) {
      const original = arr.length;
      Utils.setValueByPath(obj, action.field, arr.slice(0, action.keepCount));
      this.stats.modifications++;
      this.env.debug(`Sliced: ${action.field} ${original} -> ${action.keepCount}`);
    }
  }

  actionArrayShift(obj, action) {
    const arr = Utils.getValueByPath(obj, action.field);
    if (Array.isArray(arr) && arr.length > 0) {
      arr.shift();
      this.stats.modifications++;
      this.env.debug(`Shifted: ${action.field}`);
    }
  }

  /**
   * 混合模式：JSON 优先，失败回退正则
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

    return this.processRegexMode(body);
  }

  /**
   * JSON 对象模式
   */
  processJsonMode(body) {
    let obj = Utils.safeJsonParse(body);
    if (!obj) {
      return this.createErrorResponse('Failed to parse JSON');
    }

    // 响应包装器
    if (this.config.responseWrapper?.enabled) {
      const hasData = Utils.getValueByPath(obj, 'data');
      if (!hasData || Object.keys(hasData).length === 0) {
        this.env.debug('Using response wrapper template');
        obj = Utils.deepMerge({}, this.config.responseWrapper.template);
      }
    }

    // 字段映射
    if (this.config.fields) {
      this.applyFieldMapping(obj);
    }

    // 自定义处理器
    if (typeof this.config.customProcessor === 'function') {
      obj = this.config.customProcessor(obj, this.env);
    }

    this.env.info(`${this.config.name} processed (JSON mode)`);
    return { body: Utils.safeJsonStringify(obj) };
  }

  /**
   * 应用字段映射
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
  }

  /**
   * 正则替换模式
   */
  processRegexMode(body) {
    let modifiedBody = body;
    const replacements = this.config.regexReplacements || [];

    this.env.debug(`Regex replacements: ${replacements.length} rules`);

    for (const rule of replacements) {
      try {
        const regex = Utils.getRegExp(rule.pattern, 'g');
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
   * 游戏数值模式（转义 JSON）
   */
  processGameMode(body) {
    let modifiedBody = body;
    const resources = this.config.gameResources || [];

    this.env.debug(`Game resources: ${resources.length} items`);

    for (const resource of resources) {
      try {
        // 转义 JSON 格式：\"field\":123
        const pattern = new RegExp(`\\\\"${resource.field}\\\\":\\\\d+`, 'g');
        const replacement = `\\"${resource.field}\\":${resource.value}`;

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
   * 创建错误响应（返回原始数据避免破坏应用）
   */
  createErrorResponse(reason) {
    this.env.error(`Error: ${reason}`);
    return { body: $response?.body || '{}' };
  }

  /**
   * 获取处理统计
   */
  getStats() {
    return {
      ...this.stats,
      duration: Date.now() - this.stats.startTime
    };
  }
}

// ==========================================
// 插件管理器 v2.0
// ==========================================

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.urlCache = new Map(); // URL -> config 缓存
  }

  register(id, config) {
    const validation = ConfigValidator.validate(config);
    if (!validation.valid) {
      console.error(`[PluginManager] Invalid config for ${id}:`, validation.errors);
      return false;
    }

    // 冻结配置防止意外修改
    this.plugins.set(id, Object.freeze({ ...config }));
    console.log(`[PluginManager] Registered: ${config.name} [${config.mode || 'auto'}]`);
    return true;
  }

  get(id) {
    return this.plugins.get(id);
  }

  /**
   * 自动检测应用（带缓存）
   */
  detect(url) {
    if (!url) return null;

    // 检查缓存
    if (this.urlCache.has(url)) {
      return this.urlCache.get(url);
    }

    // 遍历检测
    for (const config of this.plugins.values()) {
      if (config.urlPattern?.test(url)) {
        this.urlCache.set(url, config);
        return config;
      }
    }

    return null;
  }

  init(configs) {
    let successCount = 0;
    for (const [key, config] of Object.entries(configs)) {
      if (this.register(key, config)) {
        successCount++;
      }
    }
    console.log(`[PluginManager] Initialized ${successCount}/${Object.keys(configs).length} plugins`);
  }

  clearCache() {
    this.urlCache.clear();
  }
}

// ==========================================
// 主入口
// ==========================================

function main() {
  const env = new Environment(META.name);

  try {
    env.info(`Starting ${META.name} v${META.version} on ${env.platform}`);

    // 初始化插件管理器
    const pluginManager = new PluginManager();
    pluginManager.init(APP_CONFIGS);

    // 获取请求信息
    const response = env.getResponse();
    const requestUrl = response.url || env.getRequest().url || '';

    if (!requestUrl) {
      env.error('No URL found in request/response');
      env.done({});
      return;
    }

    env.debug(`Processing URL: ${requestUrl}`);

    // 检测应用配置
    let appConfig = pluginManager.detect(requestUrl);

    // 兜底：使用通用配置
    if (!appConfig) {
      env.warn('App not detected, using generic config');
      appConfig = {
        name: 'Generic',
        mode: 'json',
        fields: {
          isVip: { path: 'data.is_vip', value: 1, type: 'number' },
          vipExpired: { path: 'data.vip_expire_date', value: CONSTANTS.EXPIRE_TIMESTAMP, type: 'number' }
        }
      };
    }

    // 创建引擎并执行
    const engine = new VipUnlockEngine(env);
    engine.setConfig(appConfig);

    const result = engine.process(response);
    const stats = engine.getStats();

    env.info(`Completed in ${stats.duration}ms, ${stats.modifications} modifications`);

    env.done(result);

  } catch (e) {
    env.error(`Fatal error: ${e.message}`);
    // 出错时返回原始响应，避免破坏应用
    env.done({ body: $response?.body });
  }
}

// 执行
main();
