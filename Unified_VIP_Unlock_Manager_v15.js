/**
 * ==========================================
 * Unified VIP Unlock Manager v16.0.0
 * 统一 VIP 解锁管理器 - 容错架构版（SafeConfigLoader）
 * 统一 VIP 解锁管理器 - 按需加载优化版
 * @version 16.0.0
 * @description 按需加载配置，只执行匹配URL的工厂函数
 * @description 采用配置工厂模式，单个配置错误完全隔离
 * ==========================================
  * 【架构特性】
 * 1. SafeConfigLoader: 配置工厂模式，延迟执行 + 独立验证
 * 2. RobustPluginManager: 试运行验证（dry-run），自动隔离故障配置
 * 3. CrossPlatformEnv: 统一封装 QX/Surge/Loon API 差异
 * 4. 单个配置语法错误不影响其他配置加载
[rewrite_local]
 # iAppDaily - 余额查询接口（JSON模式-声明式字段设置）
 ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # TopHub - 账户同步接口（JSON模式-声明式组合）
 ^https?:\/\/(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # gps - GPS工具箱（JSON模式-声明式字段设置）
 ^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # kyxq - 口语星球（JSON模式-声明式场景分发）
 ^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # mhlz - 魔幻粒子（JSON模式-声明式前缀处理）
 ^https?:\/\/ss\.landintheair\.com\/storage\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # v2ex - V2EX去广告（HTML替换模式）
 ^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf))))) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # foday - 复游会去广告（多路径模式-声明式过滤）
 ^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # qiujingapp - 球竞APP去广告（多路径模式-声明式清空）
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(3|6|8|11)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # Keep - 课程/会员接口（正则替换模式）
 ^https?:\/\/(api|kit).gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # bqwz - 标枪王者游戏数据接口（游戏数值模式）
 ^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # bxkt - 伴学课堂接口（混合模式-声明式组合）
 ^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # tv - 影视去广告接口（多路径模式-完全声明式）
 ^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getSearchAd|getVodBodyAd|getVodPauseAd|getUserCenterAd) url reject-dict
 ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(home\/notice|gameCenter\/gameDetailList) url reject-dict
 # 成语来解压 - 微信小程序无限金币（游戏数值模式）
 ^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 # 星际使命 - 微信小程序游戏数据修改（JSON声明式处理器-完全重构）
 ^https?:\/\/star\.jvplay\.cn\/v2\/storage url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
# wohome - 联通智家去广告（条件删除模式）
 ^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
# 思朗月影视 - 用户信息VIP解锁
^https?:\/\/theater-api\.sylangyue\.xyz\/api\/user\/info url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v15.js
 [mitm]
 hostname = theater-api.sylangyue.xyz, api.iappdaily.com, api2.tophub.today, api2.tophub.app, api3.tophub.xyz, api3.tophub.today, api3.tophub.app, tophub.tophubdata.com, tophub2.tophubdata.com, tophub.idaily.today, tophub2.idaily.today, tophub.remai.today, tophub.iappdaiy.com, tophub.ipadown.com,service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com,api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com,yr-game-api.feigo.fun,star.jvplay.cn,iotpservice.smartont.net
 */
'use strict';

// ==========================================
// QX 环境兼容层
// ==========================================

(function fixQXConsole() {
  if (typeof console === 'undefined') {
    globalThis.console = { log: function() {} };
  }
  const _originalLog = console.log.bind(console);
  
  if (typeof console.error !== 'function') {
    console.error = function(...args) {
      _originalLog('[ERROR]', ...args);
    };
  }
  if (typeof console.warn !== 'function') {
    console.warn = function(...args) {
      _originalLog('[WARN]', ...args);
    };
  }
  if (typeof console.debug !== 'function') {
    console.debug = function(...args) {
      _originalLog('[DEBUG]', ...args);
    };
  }
  if (typeof console.info !== 'function') {
    console.info = function(...args) {
      _originalLog('[INFO]', ...args);
    };
  }
})();

// ==========================================
// 元数据
// ==========================================

const META = {
  name: 'UnifiedVIP',
  version: '16.0.0',
  author: 'joeshu & contributors',
  description: 'Unified VIP Unlock Manager - On-Demand Loading',
  updated: '2026-03-20'
};

// ==========================================
// 常量定义
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
  TARGET_GAME_VALUE: 999988990,
  WEAPON_IDS: Object.freeze([
    "1100", "1101", "1102", "1103", "1104",
    "1105", "1106", "1107", "1108", "1109", "1110"
  ]),
  MODES: Object.freeze({
    JSON: 'json',
    REGEX: 'regex',
    GAME: 'game',
    HYBRID: 'hybrid',
    MULTIPATH: 'multipath',
    HTML: 'html'
  })
});

const GLOBAL_CONFIG = Object.freeze({
  DEBUG: true,
  ENABLE_CACHE: true,
  MAX_CACHE_SIZE: 100
});

// ==========================================
// 跨平台环境封装
// ==========================================

class CrossPlatformEnv {
  constructor(name) {
    this.name = name;
    this.platform = this._detectPlatform();
    this.isQX = typeof $task !== 'undefined';
    this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
    this.isLoon = typeof $loon !== 'undefined';
    this._initRequestResponse();
  }

  _detectPlatform() {
    if (typeof $task !== 'undefined') return 'Quantumult X';
    if (typeof $loon !== 'undefined') return 'Loon';
    if (typeof $httpClient !== 'undefined') return 'Surge';
    return 'Unknown';
  }

  _initRequestResponse() {
    this.request = typeof $request !== 'undefined' ? $request : {};
    this.response = typeof $response !== 'undefined' ? $response : {};
    if (!this.request.url && this.response.request?.url) {
      this.request = this.response.request;
    }
  }

  getCurrentUrl() {
    let url = this.response?.url || this.request?.url || '';
    if (this.isQX && typeof $request === 'string') url = $request;
    return url.toString();
  }

  getResponseBody() {
    return this.response?.body || '';
  }

  log(level, msg) {
    if (!GLOBAL_CONFIG.DEBUG && level === 'debug') return;
    const timestamp = new Date().toISOString();
    console.log(`[${this.name}][${level.toUpperCase()}][${timestamp}] ${msg}`);
    if (this.isQX && level === 'error' && typeof $notify === 'function') {
      $notify(this.name, 'Error', msg);
    }
  }

  debug(msg) { this.log('debug', msg); }
  info(msg) { this.log('info', msg); }
  warn(msg) { this.log('warn', msg); }
  error(msg) { this.log('error', msg); }

  done(result) {
    if (typeof $done === 'function') {
      $done(result);
    } else {
      console.log('[DONE]', result);
    }
  }
}

// ==========================================
// 声明式处理器工具库
// ==========================================

const ProcessorUtils = {
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
      if (modified > 0 && env) env.debug(`SetFields: modified ${modified} fields`);
      return obj;
    };
  },

  compose(...processors) {
    return function(obj, env) {
      return processors.reduce((acc, processor) => {
        if (!acc) return acc;
        return processor(acc, env);
      }, obj);
    };
  },

  when(condition, processor) {
    return function(obj, env) {
      if (condition(obj)) return processor(obj, env);
      return obj;
    };
  },

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
      if (env) env.debug(`MapArray: modified ${modified}/${arr.length} items`);
      return obj;
    };
  },

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
      if (env) env.log(`Filtered ${logName || arrayPath}: ${originalLength} -> ${filtered.length}`);
      return obj;
    };
  },

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

  shiftArray(arrayPath, logName = null) {
    return function(obj, env) {
      const arr = Utils.getValueByPath(obj, arrayPath);
      if (Array.isArray(arr) && arr.length > 0) {
        const removed = arr.shift();
        env?.log(`Shifted ${logName || arrayPath}: removed ${removed?.title || 'item'}`);
      }
      return obj;
    };
  },

  processByKeyPrefix(objPath, prefixHandlers, options = {}) {
    return function(obj, env) {
      const target = Utils.getValueByPath(obj, objPath);
      if (!target || typeof target !== 'object') {
        env?.warn(`ProcessByKeyPrefix: ${objPath} not found`);
        return obj;
      }
      const stats = {};
      for (const [key, value] of Object.entries(target)) {
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
      }
      if (env && options.logPrefix) {
        env.log(`${options.logPrefix} processed: ${JSON.stringify(stats)}`);
      }
      return obj;
    };
  },

  createSceneDispatcher(scenes) {
    return function(obj, env) {
      for (const scene of scenes) {
        try {
          if (scene.when(obj)) {
            env?.debug(`Scene matched: ${scene.name}`);
            scene.then(obj, env);
            return obj;
          }
        } catch (e) {
          env?.warn(`Scene ${scene.name} error: ${e.message}`);
          if (!scene.continueOnError) break;
        }
      }
      return obj;
    };
  },

  deleteFields(...paths) {
    return function(obj, env) {
      for (const path of paths) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          current = current?.[parts[i]];
          if (!current) break;
        }
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
// 工具函数
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
      const match = part.match(/^([^\[]+)\[(\d+)\]$/);
      
      if (match) {
        const arrName = match[1];
        const arrIndex = parseInt(match[2]);
        if (!(arrName in current) || !Array.isArray(current[arrName])) {
          current[arrName] = [];
        }
        while (current[arrName].length <= arrIndex) {
          current[arrName].push({});
        }
        if (i === parts.length - 2) {
          current[arrName][arrIndex] = value;
          return obj;
        } else {
          if (!current[arrName][arrIndex] || typeof current[arrName][arrIndex] !== 'object') {
            current[arrName][arrIndex] = {};
          }
          current = current[arrName][arrIndex];
        }
      } else {
        const isNextArray = /^[^\[]+\[\d+\]$/.test(nextPart);
        if (!(part in current) || current[part] === null) {
          current[part] = isNextArray ? [] : {};
        }
        current = current[part];
      }
    }
    
    const lastPart = parts[parts.length - 1];
    const lastMatch = lastPart.match(/^([^\[]+)\[(\d+)\]$/);
    
    if (lastMatch) {
      const arrName = lastMatch[1];
      const arrIndex = parseInt(lastMatch[2]);
      if (!Array.isArray(current[arrName])) current[arrName] = [];
      while (current[arrName].length <= arrIndex) current[arrName].push(null);
      current[arrName][arrIndex] = value;
    } else {
      current[lastPart] = value;
    }
    return obj;
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
// 按需加载配置器（核心优化）
// ==========================================

/**
 * LazyConfigLoader - 按需加载配置器
 * 
 * 【优化原理】
 * 1. 注册阶段：只存工厂函数，不执行
 * 2. 匹配阶段：URL索引快速查找
 * 3. 加载阶段：只执行匹配的工厂
 * 4. 缓存阶段：同一会话复用已加载配置
 */
const LazyConfigLoader = {
  
  // 工厂注册表：key -> { factory, urlPattern }
  _factories: new Map(),
  
  // 配置缓存：key -> frozenConfig
  _cache: new Map(),
  
  // URL索引：[{ key, pattern }, ...]
  _urlIndex: [],
  
  // 是否已初始化
  _initialized: false,

  /**
   * 初始化：注册所有配置工厂（只注册，不执行）
   */
  init() {
    if (this._initialized) return;
    
    // 注册所有配置工厂
    const factories = this._getAllFactories();
    let count = 0;
    
    for (const [key, factory] of Object.entries(factories)) {
      try {
        // 执行一次获取元数据（仅用于索引）
        const preview = factory();
        if (preview && preview.urlPattern instanceof RegExp) {
          this._factories.set(key, factory);
          this._urlIndex.push({ key, pattern: preview.urlPattern });
          count++;
        }
      } catch (e) {
        console.warn(`[LazyConfigLoader] Failed to index ${key}: ${e.message}`);
      }
    }
    
    this._initialized = true;
    console.log(`[LazyConfigLoader] Indexed ${count} factories`);
  },

  /**
   * 获取所有配置工厂定义
   */
  _getAllFactories() {
    return {
      
      iappdaily: () => ({
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
      }),

      tophub: () => ({
        id: 'tophub',
        name: 'TopHub',
        urlPattern: /(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync/,
        mode: 'json',
        customProcessor: ProcessorUtils.compose(
          ProcessorUtils.setFields({
            'error': CONSTANTS.STATUS_OK,
            'status': CONSTANTS.STATUS_SUCCESS
          }),
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
      }),

      sylangyue: () => ({
        id: 'sylangyue',
        name: '思朗月影视',
        urlPattern: /^https?:\/\/theater-api\.sylangyue\.xyz\/api\/user\/info/,
        mode: 'json',
        customProcessor: ProcessorUtils.setFields({
          //'code': 200,
          //'msg': '发送成功',
          'data.vip.status': true,
          'data.vip.expired_date': '2999-09-09',
          'data.vip.expired_at': 99999999999999,
          'data.login_way': true,
          //'data.mobile': '',
          'data.beans': 999880,
        })
      }),

      gps: () => ({
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
      }),

      kyxq: () => ({
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
      }),

      mhlz: () => ({
        id: 'mhlz',
        name: '魔幻粒子',
        urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
        mode: 'json',
        customProcessor: ProcessorUtils.processByKeyPrefix('currencies.list', {
          'Quest_': { amount: "1", total_collected: "1" },
          'Event_': {},
          '*': {
            amount: CONSTANTS.BIG_NUMBER_STR,
            total_collected: CONSTANTS.BIG_NUMBER_STR
          }
        }, { logPrefix: 'Currency' })
      }),

      xjsm: () => ({
        id: 'xjsm',
        name: '星际使命',
        urlPattern: /^https?:\/\/star\.jvplay\.cn\/v2\/storage/,
        mode: 'json',
        customProcessor: ProcessorUtils.compose(
          ProcessorUtils.when(
            (obj) => obj.objects?.some(o => o.collection === "Common" && o.key === "wallet"),
            (obj, env) => {
              const walletObj = obj.objects.find(o => o.collection === "Common" && o.key === "wallet");
              try {
                let wallet = JSON.parse(walletObj.value);
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
          ProcessorUtils.when(
            (obj) => obj.objects?.some(o => o.collection === "Common" && o.key === "Bag"),
            (obj, env) => {
              const bagObj = obj.objects.find(o => o.collection === "Common" && o.key === "Bag");
              try {
                let bag = JSON.parse(bagObj.value);
                if (!bag.m_ItemList || !Array.isArray(bag.m_ItemList)) bag.m_ItemList = [];
                for (const weaponId of CONSTANTS.WEAPON_IDS) {
                  const existing = bag.m_ItemList.find(it => it.ItemID === weaponId);
                  if (existing) {
                    existing.Count = CONSTANTS.TARGET_GAME_VALUE;
                  } else {
                    bag.m_ItemList.push({ Count: CONSTANTS.TARGET_GAME_VALUE, ItemID: weaponId });
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
      }),

      v2ex: () => ({
        id: 'v2ex',
        name: 'V2EX去广告',
        urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/
,
        mode: 'html',
        htmlReplacements: [
          {
            pattern: /<head>/i,
            replacement: `<head><style>.sidebar_units,.sidebar_compliance,ins.adsbygoogle,.Rightbar > .box,div[class="wwads-cn wwads-horizontal"],div[class="wwads-img"],div[class="wwads-content"]{display: none !important;}</style>`,
            description: '注入CSS隐藏广告元素'
          }
        ]
      }),

      foday: () => ({
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
      }),

      qiujingapp: () => ({
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
      }),

      tv: () => ({
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
                processor: ProcessorUtils.compose(
                  ProcessorUtils.setFields({
                    'data.startAdShowTime': 0,
                    'data.startAd': null,
                    'data.startAdList': null
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
                processor: ProcessorUtils.compose(
                  ProcessorUtils.deleteFields('data.focusAdList'),
                  ProcessorUtils.sliceArray('data.hotMudleList', 5, 'hotMudleList')
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
                processor: ProcessorUtils.deleteFields('data.floatAd', 'data.popupAd')
              }
            ]
          },
          {
            path: '/home/body',
            description: '首页主体 - 去除列表首个广告',
            actions: [
              {
                type: 'custom',
                processor: ProcessorUtils.shiftArray('data.adList', 'first ad')
              }
            ]
          }
        ]
      }),

      keep: () => ({
        id: 'keep',
        name: 'Keep',
        urlPattern: /^https?:\/\/(api|kit)\.gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\//,
        mode: 'regex',
        regexReplacements: [
          { pattern: /"memberStatus":\d+/g, replacement: '"memberStatus":1', description: '会员状态' },
          { pattern: /"hasPaid":\w+/g, replacement: '"hasPaid":true', description: '已付费标识' },
          { pattern: /"member":\w+/g, replacement: '"member":true', description: '会员标识' },
          { pattern: /"code":\d+/g, replacement: '"code":200', description: 'HTTP状态码' },
          { pattern: /"free":\w+/g, replacement: '"free":true', description: '免费标识' }
        ]
      }),

      bqwz: () => ({
        id: 'bqwz',
        name: '标枪王者',
        urlPattern: /^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data/,
        mode: 'game',
        gameResources: [
          { field: 'coin', value: 9999880, description: '金币' },
          { field: 'diamond', value: 9999880, description: '钻石' },
          { field: 'exp', value: 9999880, description: '经验' }
        ]
      }),

      cyljy: () => ({
        id: 'cyljy',
        name: '成语来解压',
        urlPattern: /^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value/,
        mode: 'game',
        gameResources: [
          { field: 'coin', value: 999988800, description: '无限金币' }
        ]
      }),

      bxkt: () => ({
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
            'data.trialTopNum': 999
          }),
          ProcessorUtils.mapArray('data.refBusinessList', { isLock: false }, (item) => item?.isLock === true)
        ),
        regexReplacements: [
          { pattern: /"isVip":false/g, replacement: '"isVip":true', description: 'VIP状态回退' }
        ]
      }),

      wohome: () => ({
        id: 'wohome',
        name: '联通智家',
        urlPattern: /^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher/,
        mode: 'json',
        customProcessor: ProcessorUtils.when(
          (obj) => obj?.data?.posCode?.includes("APP_START_PAGE"),
          ProcessorUtils.deleteFields('data.configList')
        )
      })
    };
  },

  /**
   * 根据URL查找匹配的配置键
   */
  findMatchKey(url) {
    if (!url) return null;
    
    for (const { key, pattern } of this._urlIndex) {
      try {
        if (pattern.test(url)) {
          return key;
        }
      } catch (e) {
        console.warn(`[LazyConfigLoader] Pattern test failed for ${key}`);
      }
    }
    return null;
  },

  /**
   * 按需加载配置（核心方法）
   * @param {string} url - 当前URL
   * @returns {Object|null} 匹配的配置（已缓存）
   */
  loadForUrl(url) {
    // 找到匹配的配置键
    const key = this.findMatchKey(url);
    if (!key) {
      console.log(`[LazyConfigLoader] No match for URL: ${url.substring(0, 50)}...`);
      return null;
    }
    
    // 检查缓存
    if (this._cache.has(key)) {
      console.log(`[LazyConfigLoader] Cache hit: ${key}`);
      return this._cache.get(key);
    }
    
    // 执行工厂函数（只这一次）
    const factory = this._factories.get(key);
    if (!factory) {
      console.warn(`[LazyConfigLoader] No factory for ${key}`);
      return null;
    }
    
    try {
      console.log(`[LazyConfigLoader] Executing factory: ${key}`);
      const config = factory();
      
      if (!config || !config.id) {
        console.warn(`[LazyConfigLoader] Invalid config from ${key}`);
        return null;
      }
      
      // 冻结并缓存
      const frozen = Object.freeze(config);
      this._cache.set(key, frozen);
      
      return frozen;
    } catch (e) {
      console.error(`[LazyConfigLoader] Factory execution failed: ${key} - ${e.message}`);
      return null;
    }
  },

  /**
   * 获取统计
   */
  getStats() {
    return {
      registered: this._factories.size,
      cached: this._cache.size,
      indexed: this._urlIndex.length
    };
  },

  /**
   * 清除缓存
   */
  clearCache() {
    this._cache.clear();
    console.log('[LazyConfigLoader] Cache cleared');
  }
};

// ==========================================
// VIP 解锁引擎
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
    this.stats.mode = config.mode || 'json';
    this.env.info(`Initialized: ${config.name} [Mode: ${this.stats.mode}]`);
  }

  process(response, url) {
    try {
      if (!response?.body) {
        this.env.warn('No response body found');
        return { body: response?.body || '{}' };
      }

      const mode = this.config.mode || 'json';
      
      switch (mode) {
        case CONSTANTS.MODES.HTML:
          return this.processHtmlMode(response.body);
        case CONSTANTS.MODES.MULTIPATH:
          return this.processMultipathMode(response.body, url);
        case CONSTANTS.MODES.HYBRID:
          return this.processHybridMode(response.body);
        case CONSTANTS.MODES.GAME:
          return this.processGameMode(response.body);
        case CONSTANTS.MODES.REGEX:
          return this.processRegexMode(response.body);
        default:
          return this.processJsonMode(response.body);
      }
    } catch (e) {
      this.env.error(`Processing error: ${e.message}`);
      return { body: response.body };
    }
  }

  processJsonMode(body) {
    let obj = Utils.safeJsonParse(body);
    if (!obj) return { body };

    if (typeof this.config.customProcessor === 'function') {
      obj = this.config.customProcessor(obj, this.env);
    }
    return { body: Utils.safeJsonStringify(obj) };
  }

  processHtmlMode(body) {
    let modifiedBody = body;
    for (const rule of this.config.htmlReplacements || []) {
      try {
        const regex = Utils.getRegExp(rule.pattern, 'i');
        const original = modifiedBody;
        modifiedBody = modifiedBody.replace(regex, rule.replacement);
        if (original !== modifiedBody) this.stats.modifications++;
      } catch (e) {
        this.env.warn(`HTML replacement error: ${e.message}`);
      }
    }
    return { body: modifiedBody };
  }

  processRegexMode(body) {
    let modifiedBody = body;
    for (const rule of this.config.regexReplacements || []) {
      try {
        const regex = Utils.getRegExp(rule.pattern, 'g');
        const original = modifiedBody;
        modifiedBody = modifiedBody.replace(regex, rule.replacement);
        if (original !== modifiedBody) this.stats.modifications++;
      } catch (e) {
        this.env.warn(`Regex error: ${e.message}`);
      }
    }
    return { body: modifiedBody };
  }

  processGameMode(body) {
    let modifiedBody = body;
    for (const resource of this.config.gameResources || []) {
      try {
        const pattern = new RegExp(`"${resource.field}":\\d+`, 'g');
        const replacement = `"${resource.field}":${resource.value}`;
        const original = modifiedBody;
        modifiedBody = modifiedBody.replace(pattern, replacement);
        if (original !== modifiedBody) this.stats.modifications++;
      } catch (e) {
        this.env.warn(`Game resource error: ${e.message}`);
      }
    }
    return { body: modifiedBody };
  }

  processHybridMode(body) {
    let obj = Utils.safeJsonParse(body, null);
    if (obj !== null && this.config.customProcessor) {
      try {
        obj = this.config.customProcessor(obj, this.env);
        return { body: Utils.safeJsonStringify(obj) };
      } catch (e) {
        this.env.warn(`Custom processor failed: ${e.message}`);
      }
    }
    return this.processRegexMode(body);
  }

  processMultipathMode(body, url) {
    const safeUrl = (url || '').toString();
    let obj = Utils.safeJsonParse(body);
    if (!obj) return { body };

    for (const handler of this.config.pathHandlers || []) {
      const pathMatch = safeUrl.includes(handler.path);
      const regexMatch = !handler.pathRegex || handler.pathRegex.test(safeUrl);
      const containsMatch = !handler.urlContains || safeUrl.includes(handler.urlContains);

      if (pathMatch && regexMatch && containsMatch) {
        for (const action of handler.actions || []) {
          try {
            if (action.type === 'custom' && typeof action.processor === 'function') {
              action.processor(obj, this.env);
              this.stats.modifications++;
            }
          } catch (e) {
            this.env.warn(`Action error: ${e.message}`);
          }
        }
        break;
      }
    }
    return { body: Utils.safeJsonStringify(obj) };
  }

  getStats() {
    return { ...this.stats, duration: Date.now() - this.stats.startTime };
  }
}

// ==========================================
// 主入口（按需加载）
// ==========================================

function main() {
  const env = new CrossPlatformEnv(META.name);

  try {
    env.info(`Starting ${META.name} v${META.version} on ${env.platform}`);

    const requestUrl = env.getCurrentUrl();
    if (!requestUrl) {
      env.error('No URL found');
      env.done({});
      return;
    }
    env.debug(`Processing URL: ${requestUrl}`);

    // 初始化加载器（只注册工厂，不执行）
    LazyConfigLoader.init();

    // 按需加载：只加载匹配的配置
    let appConfig = LazyConfigLoader.loadForUrl(requestUrl);

    // 回退策略
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
      const stats = LazyConfigLoader.getStats();
      env.info(`Matched app: ${appConfig.name} (on-demand loaded, ${stats.cached}/${stats.registered} cached)`);
    }

    // 执行处理
    const engine = new VipUnlockEngine(env);
    engine.setConfig(appConfig);

    const response = env.getResponseBody();
    const result = engine.process({ body: response }, requestUrl);

    const stats = engine.getStats();
    env.info(`Completed in ${stats.duration}ms, ${stats.modifications} modifications`);

    env.done(result);

  } catch (e) {
    env.error(`Fatal error: ${e.message}`);
    env.done({ body: env.getResponseBody() });
  }
}

// 执行入口
main();
