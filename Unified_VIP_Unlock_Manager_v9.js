/**
 * ==========================================
 * Unified VIP Unlock Manager v14.2.0
 * A+B+E 优化版（极速匹配+预编译+内存保护）
 * @version 14.2.0
 * @description 保留原架构，添加域名路径索引、正则预编译、LRU缓存
 * ==========================================
 * 
 * 【优化特性】
 * A. 极速匹配：Domain-Path 二级索引，O(1)域名查找+路径前缀匹配
 * B. 正则预编译：启动时编译所有正则，运行时零开销
 * E. 内存保护：LRU缓存限制50条，防止内存泄漏
 * 
 * 【保留架构】
 * - ProcessorUtils 完整声明式处理器
 * - VipUnlockEngine 引擎结构
 * - APP_CONFIGS 配置对象格式
 * - 详细注释和错误处理逻辑
 * ==========================================
 
[rewrite_local]
 # iAppDaily - 余额查询接口（JSON模式-声明式字段设置）
 ^https:\/\/api\.iappdaily\.com\/my\/balance url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # TopHub - 账户同步接口（JSON模式-声明式组合）
 ^https?:\/\/(?:api[23]\.tophub\.(?:xyz|today|app)|tophub(?:2)?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # gps - GPS工具箱（JSON模式-声明式字段设置）
 ^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # kyxq - 口语星球（JSON模式-声明式场景分发）
 ^https?:\/\/mapi\.kouyuxingqiu\.com\/api\/v2 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # mhlz - 魔幻粒子（JSON模式-声明式前缀处理）
 ^https?:\/\/ss\.landintheair\.com\/storage\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # v2ex - V2EX去广告（HTML替换模式）
 ^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf))))) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # foday - 复游会去广告（多路径模式-声明式过滤）
 ^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # qiujingapp - 球竞APP去广告（多路径模式-声明式清空）
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(3|6|8|11)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 ^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # Keep - 课程/会员接口（正则替换模式）
 ^https?:\/\/(api|kit)\.gotokeep\.com\/(nuocha|gerudo|athena|nuocha\/plans|suit\/v5\/smart|kprime\/v4\/suit\/sales)\/ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # bqwz - 标枪王者游戏数据接口（游戏数值模式）
 ^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # bxkt - 伴学课堂接口（混合模式-声明式组合）
 ^https?:\/\/api\.banxueketang\.com\/api\/classpal\/app\/v1 url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # tv - 影视去广告接口（多路径模式-完全声明式）
 ^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getSearchAd|getVodBodyAd|getVodPauseAd|getUserCenterAd) url reject-dict
 ^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(home\/notice|gameCenter\/gameDetailList) url reject-dict
 # 成语来解压 - 微信小程序无限金币（游戏数值模式）
 ^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # 星际使命 - 微信小程序游戏数据修改（JSON声明式处理器-完全重构）
 ^https?:\/\/star\.jvplay\.cn\/v2\/storage url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # wohome - 联通智家去广告（条件删除模式）
 ^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 # 思朗月影视 - 用户信息VIP解锁
^https?:\/\/theater-api\.sylangyue\.xyz\/api\/user\/info url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/Unified_VIP_Unlock_Manager_v9.js
 [mitm]
 hostname = theater-api.sylangyue.xyz, api.iappdaily.com, api2.tophub.today, api2.tophub.app, api3.tophub.xyz, api3.tophub.today, api3.tophub.app, tophub.tophubdata.com, tophub2.tophubdata.com, tophub.idaily.today, tophub2.idaily.today, tophub.remai.today, tophub.iappdaiy.com, tophub.ipadown.com,service.gpstool.com, mapi.kouyuxingqiu.com, ss.landintheair.com, *.v2ex.com, apis.folidaymall.com, gateway-api.yizhilive.com, pagead*.googlesyndication.com, api.gotokeep.com, kit.gotokeep.com, *.gotokeep.*, 120.53.74.*, 162.14.5.*, 42.187.199.*, 101.42.124.*, javelin.mandrillvr.com,api.banxueketang.com, yzy0916.*.com, yz1018.*.com, yz250907.*.com, yz0320.*.com, cfvip.*.com,yr-game-api.feigo.fun,star.jvplay.cn,iotpservice.smartont.net
 */
'use strict';

// ==========================================
// 元数据与配置
// ==========================================

const META = {
  name: 'UnifiedVIP',
  version: '14.2.0-ABE',
  author: 'joeshu & contributors (Optimized)',
  description: 'Unified VIP Unlock Manager - High Performance Edition',
  updated: '2026-03-20'
};

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
  WEAPON_IDS: Object.freeze(["1100","1101","1102","1103","1104","1105","1106","1107","1108","1109","1110"]),
  MODES: Object.freeze({ JSON: 'json', REGEX: 'regex', GAME: 'game', HYBRID: 'hybrid', MULTIPATH: 'multipath', HTML: 'html' })
});

const GLOBAL_CONFIG = Object.freeze({
  DEBUG: true,
  MAX_REGEX_CACHE: 50  // E模块：LRU缓存上限
});

// ==========================================
// 防御性工具库
// ==========================================

const SafeUtils = {
  safeJsonParse: (str, def = null) => {
    try { return JSON.parse(str); } catch (e) { return def; }
  },
  safeJsonStringify: (obj, pretty = false) => {
    try { return JSON.stringify(obj, null, pretty ? 2 : undefined); } catch (e) { return '{}'; }
  }
};

// ==========================================
// A模块：极速 URL 匹配器（Domain-Path Index）
// ==========================================

const SimpleMatcher = (() => {
  // 结构: Map<domain, Map<pathPrefix, config[]>>
  const domainIndex = new Map();
  
  /**
   * 从正则表达式提取域名和路径特征
   * 例如：/api\.example\.com\/user\/info/ → {domain: 'example.com', path: '/user/info'}
   */
  function extractKeys(pattern) {
    const str = pattern.toString();
    // 提取域名（支持多级域名）
    const domainMatch = str.match(/([a-z0-9-]+\.(?:com|cn|net|app|xyz|today|fun|cc|io))/);
    const domain = domainMatch ? domainMatch[1] : 'general';
    
    // 提取路径前缀（取第一个 \/xxx\/yyy 段）
    const pathMatch = str.match(/\\\/[a-z0-9_-]+(?:\\\/[a-z0-9_-]+)*/);
    const path = pathMatch ? pathMatch[0].replace(/\\/g, '') : '/';
    
    return { domain, path };
  }
  
  return {
    /**
     * 构建索引（APP_CONFIGS 定义后调用一次）
     */
    build: (configs) => {
      Object.values(configs).forEach(cfg => {
        if (!cfg?.urlPattern) return;
        
        const { domain, path } = extractKeys(cfg.urlPattern);
        
        // 确保域名桶存在
        if (!domainIndex.has(domain)) {
          domainIndex.set(domain, new Map());
        }
        const pathMap = domainIndex.get(domain);
        
        // 确保路径桶存在
        if (!pathMap.has(path)) {
          pathMap.set(path, []);
        }
        pathMap.get(path).push(cfg);
      });
      
      if (GLOBAL_CONFIG.DEBUG) {
        let totalPaths = 0;
        domainIndex.forEach(pm => { totalPaths += pm.size; });
        console.log(`[${META.name}] Index built: ${domainIndex.size} domains, ${totalPaths} paths`);
      }
    },
    
    /**
     * 查找配置
     * 策略：1.域名Hash → 2.路径前缀匹配 → 3.正则验证（极小N）
     */
    find: (url) => {
      try {
        // 提取域名（从URL）
        const domainMatch = url.match(/\/\/([^\/:]+)/);
        const domain = domainMatch ? domainMatch[1].toLowerCase() : '';
        
        // 提取完整路径
        const pathMatch = url.match(/\/\/[^\/]+(\/[^?#]+)/);
        const fullPath = pathMatch ? pathMatch[1] : '/';
        
        // 1. 域名查找（O(1)）
        const pathMap = domainIndex.get(domain);
        if (!pathMap) return null;
        
        // 2. 路径前缀匹配（最长前缀优先）
        let testPath = fullPath;
        while (testPath.length > 0) {
          const candidates = pathMap.get(testPath);
          if (candidates && candidates.length > 0) {
            // 3. 正则验证（通常只有1-2个配置）
            for (const cfg of candidates) {
              if (cfg.urlPattern.test(url)) return cfg;
            }
          }
          // 回退到父路径（去掉最后一段）
          testPath = testPath.replace(/\/[^\/]+$/, '');
        }
        
        // 4. 兜底：遍历该域名下无路径特征或路径不匹配的配置
        for (const [pathKey, cfgs] of pathMap) {
          if (pathKey === '/') {  // 通配路径（如只匹配域名）
            for (const cfg of cfgs) {
              if (cfg.urlPattern.test(url)) return cfg;
            }
          }
        }
        
        return null;
      } catch (e) {
        console.log(`[${META.name}] Match error: ${e.message}`);
        return null;
      }
    }
  };
})();

// ==========================================
// 环境封装
// ==========================================

class Environment {
  constructor(name) {
    this.name = name;
    this.isQX = typeof $task !== 'undefined';
    this.isSurge = typeof $httpClient !== 'undefined' && !this.isQX;
    this.isLoon = typeof $loon !== 'undefined';
    this.platform = this.isQX ? 'Quantumult X' : this.isSurge ? 'Surge' : this.isLoon ? 'Loon' : 'Unknown';
  }

  log(level, msg) {
    if (!GLOBAL_CONFIG.DEBUG && level === 'debug') return;
    const timestamp = new Date().toISOString();
    console.log(`[${this.name}][${level.toUpperCase()}][${timestamp}] ${msg}`);
    if (this.isQX && level === 'error') {
      try { $notify(this.name, 'Error', msg); } catch (e) {}
    }
  }
  debug(m) { this.log('debug', m); }
  info(m) { this.log('info', m); }
  warn(m) { this.log('warn', m); }
  error(m) { this.log('error', m); }

  getResponse() {
    try { return $response || {}; } catch (e) { return {}; }
  }
  getRequest() {
    try { return $request || {}; } catch (e) { return {}; }
  }
  getCurrentUrl() {
    try {
      const resp = this.getResponse();
      const req = this.getRequest();
      return (resp.url || req.url || '').toString();
    } catch (e) { return ''; }
  }
  done(object) {
    try {
      if (!object?.body) { $done({}); return; }
      $done(object);
    } catch (e) { try { $done({}); } catch (e2) {} }
  }
}

// ==========================================
// 工具函数（E模块：LRU正则缓存）
// ==========================================

const Utils = {
  // E模块：LRU Cache 实现（限制50条）
  _regexCache: (() => {
    const map = new Map();
    const max = GLOBAL_CONFIG.MAX_REGEX_CACHE;
    return {
      get: (k) => {
        const v = map.get(k);
        if (v) { map.delete(k); map.set(k, v); } // 更新访问顺序
        return v;
      },
      set: (k, v) => {
        if (map.size >= max) map.delete(map.keys().next().value);
        map.set(k, v);
      }
    };
  })(),

  getRegExp(pattern, flags = 'g') {
    try {
      const key = `${pattern.toString()}_${flags}`;
      let regex = this._regexCache.get(key);
      if (!regex) {
        regex = pattern instanceof RegExp 
          ? new RegExp(pattern.source, flags || pattern.flags)
          : new RegExp(pattern, flags);
        this._regexCache.set(key, regex);
      }
      return regex;
    } catch (e) {
      return /(?:)/; // 空正则兜底
    }
  },

  getValueByPath(obj, path) {
    if (!path || !obj) return undefined;
    try {
      return path.split('.').reduce((acc, part) => {
        if (acc == null) return undefined;
        const match = part.match(/^([^[]+)\[(\d+)\]$/);
        if (match) {
          const arr = acc[match[1]];
          return Array.isArray(arr) ? arr[parseInt(match[2])] : undefined;
        }
        return acc[part];
      }, obj);
    } catch (e) { return undefined; }
  },

  setValueByPath(obj, path, value) {
    if (!path || !obj) return obj;
    try {
      const parts = path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const isNextArray = /^\w+\[\d+\]$/.test(nextPart);
        if (!(part in current) || current[part] == null) {
          current[part] = isNextArray ? [] : {};
        }
        current = current[part];
      }
      const lastPart = parts[parts.length - 1];
      const lastMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
      if (lastMatch) {
        const [_, arrName, idx] = lastMatch;
        if (!Array.isArray(current[arrName])) current[arrName] = [];
        while (current[arrName].length <= parseInt(idx)) current[arrName].push(null);
        current[arrName][parseInt(idx)] = value;
      } else {
        current[lastPart] = value;
      }
      return obj;
    } catch (e) { return obj; }
  }
};

// ==========================================
// 配置验证 Schema
// ==========================================

const CONFIG_SCHEMA = {
  required: ['id', 'name', 'urlPattern'],
  modes: {
    json: { optional: ['fields', 'responseWrapper', 'customProcessor'] },
    regex: { required: ['regexReplacements'] },
    game: { required: ['gameResources'] },
    hybrid: { required: ['customProcessor', 'regexReplacements'] },
    multipath: { required: ['pathHandlers'] },
    html: { required: ['htmlReplacements'] }
  }
};

class ConfigValidator {
  static validate(config) {
    const errors = [];
    for (const field of CONFIG_SCHEMA.required) {
      if (!config[field]) errors.push(`Missing: ${field}`);
    }
    const mode = config.mode || 'json';
    const modeSchema = CONFIG_SCHEMA.modes[mode];
    if (modeSchema?.required) {
      for (const field of modeSchema.required) {
        if (!config[field]) errors.push(`${mode} requires: ${field}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

// ==========================================
// 声明式处理器（保留完整功能）
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
      if (modified > 0 && env) env.debug(`SetFields: ${modified} fields`);
      return obj;
    };
  },

  mapArray(arrayPath, fieldMap, condition = null) {
    return function(obj, env) {
      const arr = Utils.getValueByPath(obj, arrayPath);
      if (!Array.isArray(arr)) {
        env?.warn(`MapArray: ${arrayPath} is not array`);
        return obj;
      }
      let modified = 0;
      arr.forEach((item, index) => {
        if (!item) return;
        if (condition && !condition(item, index)) return;
        for (const [field, value] of Object.entries(fieldMap)) {
          if (item[field] !== undefined || value !== undefined) item[field] = value;
        }
        modified++;
      });
      if (env) env.debug(`MapArray: ${modified}/${arr.length} items`);
      return obj;
    };
  },

  filterArray(arrayPath, options = {}) {
    const { excludeSet, keyExtractor, keepPredicate, logName } = options;
    return function(obj, env) {
      const arr = Utils.getValueByPath(obj, arrayPath);
      if (!Array.isArray(arr)) {
        env?.warn(`FilterArray: ${arrayPath} is not array`);
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
      env?.log(`Filtered ${logName || arrayPath}: ${originalLength} -> ${filtered.length}`);
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
        env?.warn(`ProcessByKeyPrefix: ${objPath} not object`);
        return obj;
      }
      const stats = {};
      Object.entries(target).forEach(([key, value]) => {
        let matched = false;
        for (const [prefix, handler] of Object.entries(prefixHandlers)) {
          if (prefix === '*') continue;
          if (key.startsWith(prefix)) {
            if (handler && typeof handler === 'object') Object.assign(value, handler);
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
        env.log(`${options.logPrefix} processed: ${Object.entries(stats).map(([k,v])=>`${k}:${v}`).join(', ')}`);
      }
      return obj;
    };
  },

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
      if (!matched && env) env.debug(`No scene matched`);
      return obj;
    };
  },

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

  deleteFields(...paths) {
    return function(obj, env) {
      for (const path of paths) {
        try {
          const parts = path.split('.');
          let current = obj;
          for (let i = 0; i < parts.length - 1; i++) {
            current = current?.[parts[i]];
            if (!current) break;
          }
          if (current) delete current[parts[parts.length - 1]];
          env?.debug(`Deleted: ${path}`);
        } catch (e) {}
      }
      return obj;
    };
  }
};

// ==========================================
// 应用配置（保留全部原配置）
// ==========================================

const APP_CONFIGS = Object.freeze({
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

  tophub: {
    id: 'tophub',
    name: 'TopHub',
    urlPattern: /(?:api[23]\.tophub\.(?:xyz|today|app)|tophub2?\.(?:tophubdata\.com|idaily\.today|remai\.today|iappdaiy\.com|ipadown\.com))\/account\/sync/,
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
  },

  sylangyue: {
    id: 'sylangyue',
    name: '思朗月影视',
    urlPattern: /^https?:\/\/theater-api\.sylangyue\.xyz\/api\/user\/info/,
    mode: 'json',
    customProcessor: ProcessorUtils.setFields({
      'code': 200,
      'msg': '发送成功',
      'data.vip.status': true,
      'data.vip.expired_date': '2999-09-09',
      'data.vip.expired_at': 99999999999999,
      'data.login_way': true,
      'data.beans': 999880,
      'data.mobile': ''
    })
  },

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

  mhlz: {
    id: 'mhlz',
    name: '魔幻粒子',
    urlPattern: /^https?:\/\/ss\.landintheair\.com\/storage\//,
    mode: 'json',
    customProcessor: ProcessorUtils.processByKeyPrefix('currencies.list', {
      'Quest_': { amount: "1", total_collected: "1" },
      'Event_': {},
      '*': { amount: CONSTANTS.BIG_NUMBER_STR, total_collected: CONSTANTS.BIG_NUMBER_STR }
    }, { logPrefix: 'Currency' })
  },

  xjsm: {
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
            let wallet = SafeUtils.safeJsonParse(walletObj.value);
            wallet.coin = CONSTANTS.TARGET_GAME_VALUE;
            wallet.coupon = CONSTANTS.TARGET_GAME_VALUE;
            wallet.gem = CONSTANTS.TARGET_GAME_VALUE;
            walletObj.value = SafeUtils.safeJsonStringify(wallet);
            env?.info('Wallet: unlimited currency activated');
          } catch (e) { env?.error(`Wallet parse failed: ${e.message}`); }
          return obj;
        }
      ),
      ProcessorUtils.when(
        (obj) => obj.objects?.some(o => o.collection === "Common" && o.key === "Bag"),
        (obj, env) => {
          const bagObj = obj.objects.find(o => o.collection === "Common" && o.key === "Bag");
          try {
            let bag = SafeUtils.safeJsonParse(bagObj.value);
            if (!bag.m_ItemList || !Array.isArray(bag.m_ItemList)) bag.m_ItemList = [];
            CONSTANTS.WEAPON_IDS.forEach(weaponId => {
              const existing = bag.m_ItemList.find(it => it.ItemID === weaponId);
              if (existing) existing.Count = CONSTANTS.TARGET_GAME_VALUE;
              else bag.m_ItemList.push({ Count: CONSTANTS.TARGET_GAME_VALUE, ItemID: weaponId });
            });
            bagObj.value = SafeUtils.safeJsonStringify(bag);
            env?.info(`Bag: ${CONSTANTS.WEAPON_IDS.length} weapons unlocked`);
          } catch (e) { env?.error(`Bag parse failed: ${e.message}`); }
          return obj;
        }
      )
    )
  },

  v2ex: {
    id: 'v2ex',
    name: 'V2EX去广告',
    urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
    htmlReplacements: [
      { pattern: /<head>/i, replacement: '<head><style>.sidebar_units,.ads{display:none!important}</style>' }
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
        actions: [
          {
            type: 'custom',
            processor: ProcessorUtils.filterArray('data.pageComponents', {
              excludeSet: new Set(["TCMP_home_followingadvertising", "TC_Interactive_Ad", "TC_Member_Banner", "TC_AIGO"]),
              keyExtractor: (item) => item.componentCode,
              logName: 'pageComponents'
            })
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
        actions: [{ type: 'custom', processor: ProcessorUtils.clearArray('data', { logName: 'carousel ads' }) }]
      },
      {
        path: '/api/v3/index/all',
        urlContains: 'position=2',
        actions: [{ type: 'custom', processor: ProcessorUtils.clearArray('data.banners', { logName: 'banners' }) }]
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
        actions: [
          { type: 'custom', processor: ProcessorUtils.setFields({ 'data.startAdShowTime': 0, 'data.startAd': null, 'data.startAdList': null }) }
        ]
      },
      {
        path: '/home/firstScreen',
        actions: [
          { type: 'custom', processor: ProcessorUtils.compose(
            ProcessorUtils.deleteFields('data.focusAdList'),
            ProcessorUtils.sliceArray('data.hotMudleList', 5, 'hotMudleList')
          )}
        ]
      },
      {
        path: '/adInfo/getPageAd',
        actions: [
          { type: 'custom', processor: ProcessorUtils.deleteFields('data.floatAd', 'data.popupAd') }
        ]
      },
      {
        path: '/home/body',
        actions: [
          { type: 'custom', processor: ProcessorUtils.shiftArray('data.adList', 'first ad') }
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
      { pattern: /"memberStatus":\d+/g, replacement: '"memberStatus":1' },
      { pattern: /"username":".*?"/g, replacement: '"username":"VIP"' },
      { pattern: /"buttonText":".*?"/g, replacement: '"buttonText":""' },
      { pattern: /"hasPaid":\w+/g, replacement: '"hasPaid":true' },
      { pattern: /"downLoadAll":\w+/g, replacement: '"downLoadAll":true' },
      { pattern: /"videoTime":\d+/g, replacement: '"videoTime":0' },
      { pattern: /"startEnable":\w+/g, replacement: '"startEnable":true' },
      { pattern: /"preview":\w+/g, replacement: '"preview":false' },
      { pattern: /"errorCode":\d+/g, replacement: '"errorCode":0' },
      { pattern: /"status":\w+/g, replacement: '"status":1' },
      { pattern: /"member":\w+/g, replacement: '"member":true' },
      { pattern: /"limitFree":\w+/g, replacement: '"limitFree":true' },
      { pattern: /"limitCount":\d/g, replacement: '"limitCount":0' },
      { pattern: /"limitFreeType":"\w+/g, replacement: '"limitFreeType":""' },
      { pattern: /"free":\w+/g, replacement: '"free":true' },
      { pattern: /"userLiveMemberStatus":\w+/g, replacement: '"userLiveMemberStatus":1' },
      { pattern: /"canWatchLive":\w+/g, replacement: '"canWatchLive":true' },
      { pattern: /"userMemberAutoRenew":\w+/g, replacement: '"userMemberAutoRenew":true' },
      { pattern: /"userUseLiveMemberRights":\w+/g, replacement: '"userUseLiveMemberRights":true' },
      { pattern: /"userLiveMemberExpireTime":\d/g, replacement: '"userLiveMemberExpireTime":0' },
      { pattern: /"code":\d+/g, replacement: '"code":200' },
      { pattern: /":false/g, replacement: '":true' }
    ]
  },

  bqwz: {
    id: 'bqwz',
    name: '标枪王者',
    urlPattern: /^https?:\/\/javelin\.mandrillvr\.com\/api\/data\/get_game_data/,
    mode: 'game',
    gameResources: [
      { field: 'coin', value: 9999880 },
      { field: 'diamond', value: 9999880 },
      { field: 'exp', value: 9999880 },
      { field: 'rank_ticket', value: 666 },
      { field: 'pve_power', value: 888 }
    ]
  },

  cyljy: {
    id: 'cyljy',
    name: '成语来解压',
    urlPattern: /^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value/,
    mode: 'game',
    gameResources: [{ field: 'coin', value: 999988800 }]
  },

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
        'data.originalPrice': 0,
        'data.salePrice': 0,
        'data.trialTopNum': 999
      }),
      ProcessorUtils.mapArray('data.refBusinessList', { isLock: false }, (item) => item?.isLock === true)
    ),
    regexReplacements: [
      { pattern: /"isVip":false/g, replacement: '"isVip":true' },
      { pattern: /"isHave":false/g, replacement: '"isHave":true' },
      { pattern: /"isLock":true/g, replacement: '"isLock":false' }
    ]
  },

  wohome: {
    id: 'wohome',
    name: '联通智家',
    urlPattern: /^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher/,
    mode: 'json',
    customProcessor: ProcessorUtils.when(
      (obj) => obj?.data?.posCode?.includes("APP_START_PAGE"),
      ProcessorUtils.deleteFields('data.configList')
    )
  }
});

// ==========================================
// B模块：正则预编译（启动时执行）
// ==========================================

(function precompileRegex() {
  if (!GLOBAL_CONFIG.DEBUG) console.log(`[${META.name}] Precompiling regex patterns...`);
  
  Object.values(APP_CONFIGS).forEach(cfg => {
    // 预编译 regexReplacements
    if (cfg.regexReplacements && Array.isArray(cfg.regexReplacements)) {
      cfg._compiledRegex = cfg.regexReplacements.map(rule => ({
        ...rule,
        _regex: new RegExp(rule.pattern.source || rule.pattern, 'g')
      }));
    }
    
    // 预编译 gameResources
    if (cfg.gameResources && Array.isArray(cfg.gameResources)) {
      cfg._compiledGame = cfg.gameResources.map(res => ({
        ...res,
        _regex: new RegExp(`"${res.field}":\\d+`, 'g')
      }));
    }
  });
  
  if (GLOBAL_CONFIG.DEBUG) console.log(`[${META.name}] Regex precompilation done`);
})();

// A模块：构建 URL 索引（启动时执行）
SimpleMatcher.build(APP_CONFIGS);

// ==========================================
// VIP 解锁核心引擎（使用预编译正则）
// ==========================================

class VipUnlockEngine {
  constructor(env) {
    this.env = env;
    this.config = null;
    this.stats = { startTime: Date.now(), mode: null, modifications: 0, errors: [] };
  }

  setConfig(config) {
    const validation = ConfigValidator.validate(config);
    if (!validation.valid) {
      this.env.error(`Config validation failed: ${validation.errors.join(', ')}`);
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
      customProcessor: ProcessorUtils.setFields({
        'data.is_vip': 1,
        'data.vip_expire_date': CONSTANTS.EXPIRE_TIMESTAMP
      })
    };
  }

  process(response, url) {
    try {
      if (!response?.body) {
        this.env.warn('No response body');
        return { body: response?.body || '{}' };
      }

      const mode = this.config.mode || this.detectMode();
      this.stats.mode = mode;

      switch (mode) {
        case CONSTANTS.MODES.HTML: return this.processHtmlMode(response.body);
        case CONSTANTS.MODES.MULTIPATH: return this.processMultipathMode(response.body, url);
        case CONSTANTS.MODES.HYBRID: return this.processHybridMode(response.body);
        case CONSTANTS.MODES.GAME: return this.processGameMode(response.body);
        case CONSTANTS.MODES.REGEX: return this.processRegexMode(response.body);
        case CONSTANTS.MODES.JSON: default: return this.processJsonMode(response.body);
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
    
    for (const rule of replacements) {
      try {
        const regex = Utils.getRegExp(rule.pattern, 'i');
        modifiedBody = modifiedBody.replace(regex, rule.replacement);
        this.stats.modifications++;
      } catch (e) {
        this.env.warn(`HTML replacement error: ${e.message}`);
      }
    }
    return { body: modifiedBody };
  }

  processMultipathMode(body, url) {
    const obj = SafeUtils.safeJsonParse(body, null);
    if (!obj) return { body };

    const handlers = this.config.pathHandlers || [];
    for (const handler of handlers) {
      try {
        const pathMatch = url.includes(handler.path);
        const regexMatch = !handler.pathRegex || handler.pathRegex.test(url);
        const containsMatch = !handler.urlContains || url.includes(handler.urlContains);
        
        if (pathMatch && regexMatch && containsMatch) {
          (handler.actions || []).forEach(action => this.executeAction(obj, action));
          break;
        }
      } catch (e) {
        continue;
      }
    }
    return { body: SafeUtils.safeJsonStringify(obj) };
  }

  executeAction(obj, action) {
    try {
      switch (action.type) {
        case 'delete':
          if (action.field) {
            const parts = action.field.split('.');
            let curr = obj;
            for (let i = 0; i < parts.length - 1; i++) {
              curr = curr?.[parts[i]];
              if (!curr) return;
            }
            delete curr?.[parts[parts.length - 1]];
            this.stats.modifications++;
          }
          break;
        case 'set':
          if (action.field) {
            Utils.setValueByPath(obj, action.field, action.value);
            this.stats.modifications++;
          }
          break;
        case 'arraySlice':
          if (action.field) {
            const arr = Utils.getValueByPath(obj, action.field);
            if (Array.isArray(arr)) {
              Utils.setValueByPath(obj, action.field, arr.slice(0, action.keepCount));
              this.stats.modifications++;
            }
          }
          break;
        case 'arrayShift':
          if (action.field) {
            const arr = Utils.getValueByPath(obj, action.field);
            if (Array.isArray(arr) && arr.length > 0) {
              arr.shift();
              this.stats.modifications++;
            }
          }
          break;
        case 'custom':
          if (typeof action.processor === 'function') {
            action.processor(obj, this.env);
            this.stats.modifications++;
          }
          break;
      }
    } catch (e) {
      this.env.warn(`Action execution error: ${e.message}`);
    }
  }

  processHybridMode(body) {
    let obj = SafeUtils.safeJsonParse(body, null);
    if (obj !== null && this.config.customProcessor) {
      try {
        obj = this.config.customProcessor(obj, this.env);
        return { body: SafeUtils.safeJsonStringify(obj) };
      } catch (e) {
        this.env.warn(`Custom processor failed: ${e.message}, falling back to regex`);
      }
    }
    return this.processRegexMode(body);
  }

  processJsonMode(body) {
    const obj = SafeUtils.safeJsonParse(body, null);
    if (!obj) return { body };

    if (typeof this.config.customProcessor === 'function') {
      this.config.customProcessor(obj, this.env);
    } else if (this.config.fields) {
      this.applyFieldMapping(obj);
    }
    
    return { body: SafeUtils.safeJsonStringify(obj) };
  }

  applyFieldMapping(obj) {
    for (const [key, field] of Object.entries(this.config.fields)) {
      try {
        Utils.setValueByPath(obj, field.path || key, field.value);
        this.stats.modifications++;
      } catch (e) {
        this.env.warn(`Field mapping error: ${e.message}`);
      }
    }
  }

  // B模块：使用预编译正则
  processRegexMode(body) {
    let modifiedBody = body;
    
    // 优先使用预编译正则
    if (this.config._compiledRegex) {
      for (const rule of this.config._compiledRegex) {
        try {
          modifiedBody = modifiedBody.replace(rule._regex, rule.replacement);
          this.stats.modifications++;
        } catch (e) {
          this.env.warn(`Regex error: ${rule.description || 'unnamed'}`);
        }
      }
    } else {
      // 回退到动态编译（兼容）
      const replacements = this.config.regexReplacements || [];
      for (const rule of replacements) {
        try {
          const regex = Utils.getRegExp(rule.pattern, 'g');
          modifiedBody = modifiedBody.replace(regex, rule.replacement);
          this.stats.modifications++;
        } catch (e) {
          this.env.warn(`Regex error: ${rule.description || 'unnamed'}`);
        }
      }
    }
    return { body: modifiedBody };
  }

  // B模块：使用预编译游戏正则
  processGameMode(body) {
    let modifiedBody = body;
    
    if (this.config._compiledGame) {
      for (const res of this.config._compiledGame) {
        try {
          modifiedBody = modifiedBody.replace(res._regex, `"${res.field}":${res.value}`);
          this.stats.modifications++;
        } catch (e) {
          this.env.warn(`Game resource error: ${res.field}`);
        }
      }
    } else {
      const resources = this.config.gameResources || [];
      for (const res of resources) {
        try {
          const pattern = new RegExp(`"${res.field}":\\d+`, 'g');
          modifiedBody = modifiedBody.replace(pattern, `"${res.field}":${res.value}`);
          this.stats.modifications++;
        } catch (e) {
          this.env.warn(`Game resource error: ${res.field}`);
        }
      }
    }
    return { body: modifiedBody };
  }

  getStats() {
    return { ...this.stats, duration: Date.now() - this.stats.startTime };
  }
}

// ==========================================
// 主入口（使用 SimpleMatcher 替代遍历）
// ==========================================

function main() {
  const env = new Environment(META.name);
  
  try {
    env.info(`Starting ${META.name} v${META.version} [ABE: Index+Precompile+LRU]`);
    
    const url = env.getCurrentUrl();
    if (!url) {
      env.error('URL not found');
      env.done({});
      return;
    }
    
    // A模块：使用索引匹配（替代原遍历）
    const config = SimpleMatcher.find(url);
    if (!config) {
      env.info('No config matched');
      env.done(env.getResponse());
      return;
    }
    
    env.info(`Matched: ${config.name}`);
    
    const response = env.getResponse();
    if (!response?.body) {
      env.warn('Empty response body');
      env.done({});
      return;
    }
    
    const engine = new VipUnlockEngine(env);
    engine.setConfig(config);
    const result = engine.process(response, url);
    
    const stats = engine.getStats();
    env.info(`Completed: ${stats.modifications} mods, ${stats.errors.length} errs, ${stats.duration}ms`);
    
    env.done(result);
    
  } catch (e) {
    env.error(`Fatal error: ${e.message}`);
    try {
      env.done(env.getResponse());
    } catch (e2) {
      env.done({});
    }
  }
}

// 执行
main();
