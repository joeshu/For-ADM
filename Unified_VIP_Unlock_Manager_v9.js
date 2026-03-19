/**
 * ==========================================
 * Unified VIP Unlock Manager v9.2
 * 统一 VIP 解锁管理器 - 兼容性修复版
 * @version 9.2
 * @description 修复 QX/Surge 环境异常，移除 URL API 依赖
 * ==========================================
 */

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
// 1. 元数据与全局配置
// ==========================================

const META = {
  name: 'UnifiedVIP',
  version: '9.2',
  author: 'joeshu & contributors',
  description: 'Unified VIP Unlock Manager - Compatibility Fixed',
  updated: '2026-03-19'
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
  MAX_CACHE_SIZE: 100,
  ENABLE_DOMAIN_INDEX: true // 默认关闭，避免兼容性问题
});

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

// ==========================================
// 2. 基础工具层（兼容性修复版）
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
  },

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

  // ==========================================
  // 【关键修复】使用正则代替 URL 构造函数
  // ==========================================
  
  /**
   * 安全提取 hostname（兼容 QX/Surge）
   * 不再使用 new URL()，改用正则提取
   */
  getHostname(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      // 移除协议前缀
      let withoutProtocol = url.replace(/^https?:\/\//i, '');
      // 移除路径，只保留域名部分
      const hostname = withoutProtocol.split('/')[0].split(':')[0].toLowerCase();
      return hostname || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * 简化的域名提取（避免复杂正则导致异常）
   */
  extractDomainsFromPattern(pattern) {
    const domains = new Set();
    try {
      if (!(pattern instanceof RegExp)) return [];
      
      const patternStr = pattern.source;
      
      // 简单提取：匹配 xxx.xxx 模式
      // 匹配 example.com, api.example.com 等
      const matches = patternStr.match(/[a-z0-9][a-z0-9\-]*\.[a-z]{2,}/gi);
      
      if (matches) {
        matches.forEach(match => {
          if (match && match.includes('.') && !match.startsWith('\\')) {
            domains.add(match.toLowerCase());
          }
        });
      }

      // 提取父域名
      const domainList = Array.from(domains);
      domainList.forEach(domain => {
        const parts = domain.split('.');
        if (parts.length > 2) {
          domains.add(parts.slice(-2).join('.'));
        }
      });

    } catch (e) {
      // 静默失败，不影响主流程
      console.log(`[Utils] Domain extract skip: ${e.message}`);
    }
    
    return Array.from(domains);
  }
};

// ==========================================
// 3. 声明式处理器
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
      if (modified > 0 && env) {
        env.debug(`SetFields: modified ${modified} fields`);
      }
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
      if (env) env.debug(`MapArray: modified ${modified}/${arr.length} items in ${arrayPath}`);
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
      if (env) {
        const name = logName || arrayPath;
        env.log(`Filtered ${name}: ${originalLength} -> ${filtered.length}`);
      }
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
      if (condition(obj)) {
        return processor(obj, env);
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
// 4. 应用配置集合（与 v8 完全一致）
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
      '*': {
        amount: CONSTANTS.BIG_NUMBER_STR,
        total_collected: CONSTANTS.BIG_NUMBER_STR
      }
    }, {
      logPrefix: 'Currency'
    })
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
            if (!bag.m_ItemList || !Array.isArray(bag.m_ItemList)) {
              bag.m_ItemList = [];
            }
            for (const weaponId of CONSTANTS.WEAPON_IDS) {
              const existing = bag.m_ItemList.find(it => it.ItemID === weaponId);
              if (existing) {
                existing.Count = CONSTANTS.TARGET_GAME_VALUE;
              } else {
                bag.m_ItemList.push({
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

  v2ex: {
    id: 'v2ex',
    name: 'V2EX去广告',
    urlPattern: /^https?:\/\/.*v2ex\.com\/(?!(.*(api|login|cdn-cgi|verify|auth|captch|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf)))))/,
    htmlReplacements: [
      {
        pattern: /<head>/i,
        replacement: `<head><style>*[class*="ad"],*[id*="ad"],.advertisement{display:none!important;opacity:0!important;height:0!important;width:0!important;}</style>`,
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
            description: '删除焦点图广告并切片热门模块',
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
            description: '删除浮层和弹窗广告',
            processor: ProcessorUtils.deleteFields(
              'data.floatAd',
              'data.popupAd'
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

  cyljy: {
    id: 'cyljy',
    name: '成语来解压',
    urlPattern: /^https?:\/\/yr-game-api\.feigo\.fun\/api\/user\/get-game-user-value/,
    mode: 'game',
    gameResources: [
      { field: 'coin', value: 999988800, description: '无限金币' }
    ]
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
// 5. 可选域名索引（默认关闭，避免异常）
// ==========================================

const DomainIndex = (() => {
  const _index = new Map();
  let _initialized = false;

  function build(configs) {
    if (_initialized) return;
    try {
      for (const [key, config] of Object.entries(configs)) {
        if (!config?.urlPattern) continue;
        const domains = Utils.extractDomainsFromPattern(config.urlPattern);
        for (const domain of domains) {
          if (!domain) continue;
          if (!_index.has(domain)) {
            _index.set(domain, []);
          }
          const arr = _index.get(domain);
          if (!arr.includes(key)) arr.push(key);
        }
      }
      _initialized = true;
      if (GLOBAL_CONFIG.DEBUG) {
        console.log(`[DomainIndex] Initialized with ${_index.size} domains`);
      }
    } catch (e) {
      console.log(`[DomainIndex] Init skipped: ${e.message}`);
    }
  }

  function lookup(url) {
    if (!_initialized) return null;
    try {
      const hostname = Utils.getHostname(url);
      if (!hostname) return null;
      
      if (_index.has(hostname)) return _index.get(hostname);
      
      const parts = hostname.split('.');
      if (parts.length > 2) {
        for (let i = 1; i < parts.length - 1; i++) {
          const parent = parts.slice(i).join('.');
          if (_index.has(parent)) return _index.get(parent);
        }
      }
    } catch (e) {
      // 静默失败
    }
    return null;
  }

  return { build, lookup };
})();

// ==========================================
// 6. 环境封装类（与 v8 一致）
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
    if (!GLOBAL_CONFIG.DEBUG && level === 'debug') return;
    const timestamp = new Date().toISOString();
    const prefix = `[${this.name}][${level.toUpperCase()}][${timestamp}]`;
    console.log(`${prefix} ${msg}`);
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

  getResponse() { return $response || {}; }
  getRequest() { return $request || {}; }

  getCurrentUrl() {
    const resp = this.getResponse();
    const req = this.getRequest();
    const url = resp.url || req.url || '';
    return url.toString();
  }
}

// ==========================================
// 7. 配置验证器
// ==========================================

class ConfigValidator {
  static validate(config) {
    const errors = [];
    for (const field of CONFIG_SCHEMA.required) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    const mode = config.mode || 'json';
    const modeSchema = CONFIG_SCHEMA.modes[mode];
    if (modeSchema?.required) {
      for (const field of modeSchema.required) {
        if (!config[field]) {
          errors.push(`Mode '${mode}' requires field: ${field}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

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
    if (invalid.length > 0 && GLOBAL_CONFIG.DEBUG) {
      console.log('[ConfigValidator] Invalid configs:', invalid);
    }
    return { valid, invalidCount: invalid.length };
  }
}

// ==========================================
// 8. VIP 解锁核心引擎
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
        this.env.warn('No response body found');
      }
      const mode = this.config.mode || this.detectMode();
      this.stats.mode = mode;
      this.env.debug(`Processing with mode: ${mode}`);

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

  processMultipathMode(body, url) {
    const safeUrl = (url || '').toString();
    let obj = Utils.safeJsonParse(body);
    if (!obj) {
      return { body: Utils.safeJsonStringify({}) };
    }
    const handlers = this.config.pathHandlers || [];
    let matched = false;
    for (const handler of handlers) {
      const pathMatch = safeUrl.includes(handler.path);
      const regexMatch = !handler.pathRegex || handler.pathRegex.test(safeUrl);
      const containsMatch = !handler.urlContains || safeUrl.includes(handler.urlContains);
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

  processJsonMode(body) {
    let obj = Utils.safeJsonParse(body);
    if (!obj) {
      return this.createErrorResponse('Failed to parse JSON');
    }
    if (typeof this.config.customProcessor === 'function') {
      obj = this.config.customProcessor(obj, this.env);
      this.env.info(`${this.config.name} processed (JSON-Declarative)`);
      return { body: Utils.safeJsonStringify(obj) };
    }
    if (this.config.fields) {
      this.applyFieldMapping(obj);
    }
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

  processGameMode(body) {
    let modifiedBody = body;
    const resources = this.config.gameResources || [];
    this.env.debug(`Game resources: ${resources.length} items`);
    for (const resource of resources) {
      try {
        const pattern = new RegExp(`\\"${resource.field}\\\":\\\\d+`, 'g');
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
// 9. 插件管理器（安全回退版）
// ==========================================

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this._totalAvailable = 0;
    // 默认关闭索引，避免兼容性问题
    this._useIndex = false;
  }

  loadForUrl(url, configs) {
    if (!url) return null;
    
    // 如果启用了索引且已初始化，尝试使用
    if (GLOBAL_CONFIG.ENABLE_DOMAIN_INDEX) {
      try {
        DomainIndex.build(configs);
        const candidates = DomainIndex.lookup(url);
        if (candidates && candidates.length > 0) {
          for (const key of candidates) {
            const config = configs[key];
            if (config?.urlPattern?.test(url)) {
              this.plugins.set(key, Object.freeze({ ...config }));
              return config;
            }
          }
        }
      } catch (e) {
        // 索引失败，继续回退
      }
    }
    
    // 传统线性遍历（最安全）
    return this.linearSearch(url, configs);
  }

  linearSearch(url, configs) {
    try {
      const { valid, invalidCount } = ConfigValidator.filterValidConfigs(configs);
      this._totalAvailable = Object.keys(valid).length;
      
      if (invalidCount > 0 && GLOBAL_CONFIG.DEBUG) {
        console.log(`[PluginManager] ${invalidCount} invalid configs skipped`);
      }
      
      for (const [key, config] of Object.entries(valid)) {
        if (config.urlPattern?.test(url)) {
          this.plugins.set(key, Object.freeze({ ...config }));
          return config;
        }
      }
    } catch (e) {
      console.error(`[PluginManager] Search error: ${e.message}`);
    }
    
    return null;
  }

  registerAll(configs) {
    try {
      const { valid, invalidCount } = ConfigValidator.filterValidConfigs(configs);
      this._totalAvailable = Object.keys(valid).length;
      let successCount = 0;
      for (const [key, config] of Object.entries(valid)) {
        this.plugins.set(key, Object.freeze({ ...config }));
        successCount++;
      }
      console.log(`[PluginManager] Loaded ${successCount} plugins (${invalidCount} invalid)`);
      return successCount;
    } catch (e) {
      console.error(`[PluginManager] Register error: ${e.message}`);
      return 0;
    }
  }

  get(id) { return this.plugins.get(id); }
  getLoadedCount() { return this.plugins.size; }
}

// ==========================================
// 10. 主入口（全局异常捕获）
// ==========================================

function main() {
  const env = new Environment(META.name);
  try {
    env.info(`Starting ${META.name} v${META.version}`);
    
    const requestUrl = env.getCurrentUrl();
    if (!requestUrl) {
      env.error('No URL found');
      env.done({});
      return;
    }
    
    const pluginManager = new PluginManager();
    let appConfig = pluginManager.loadForUrl(requestUrl, APP_CONFIGS);
    
    if (!appConfig) {
      pluginManager.registerAll(APP_CONFIGS);
      appConfig = pluginManager.loadForUrl(requestUrl, APP_CONFIGS);
    }
    
    if (!appConfig) {
      env.warn('Using generic config');
      appConfig = {
        name: 'Generic',
        mode: 'json',
        customProcessor: ProcessorUtils.setFields({
          'data.is_vip': 1,
          'data.vip_expire_date': CONSTANTS.EXPIRE_TIMESTAMP
        })
      };
    }
    
    const engine = new VipUnlockEngine(env);
    engine.setConfig(appConfig);
    const response = env.getResponse();
    const result = engine.process(response, requestUrl);
    const stats = engine.getStats();
    env.info(`Done in ${stats.duration}ms, ${stats.modifications} mods`);
    env.done(result);
    
  } catch (e) {
    env.error(`Fatal: ${e.message}`);
    try {
      env.done({ body: $response?.body });
    } catch (doneErr) {
      $done({});
    }
  }
}

main();
