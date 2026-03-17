/**
 * ReCat 订阅解锁脚本 - 优化版
 * 支持 Quantumult X / Surge / Loon
 * 更新: 2026-03-17
 *
 * 购买日期: 2024-09-09T09:09:09Z
 * 过期日期: 2099-09-09T09:09:09Z
 */

// ==================== 常量定义 ====================
const PURCHASE_DATE = "2024-09-09T09:09:09Z";
const EXPIRES_DATE = "2099-09-09T09:09:09Z";

// 禁止MITM的应用列表
const FORBIDDEN_APPS = [
  'PicSeedClient', 'ReflixiOS', 'Pomodoro', 'MyHabit',
  'Rond', 'Filebar', 'Fileball', 'APTV'
];

// Bundle ID 映射表 (O(1) 查找)
const BUNDLE_MAP = {
  'com.flexicalc.app': { name: 'pro', id: 'pro_product', cm: 'sja' },
  'com.trainfitness.Train': { name: 'Pro', id: 'TrainAnnualSubscription', cm: 'sja' },
  'com.OfflineMusic.www': { name: 'premium', id: 'com.OfflineMusic.www.lifetime298', cm: 'sjb' },
  'com.ausoco.umai': { name: 'umai_pro', id: 'umai_pro_yearly', cm: 'sja' },
  'camp.user.penbook': { name: 'pro', id: 'penbook.lifetime01', cm: 'sjb' },
  'design.yugen.Flow': { name: 'pro', id: 'design.yugen.Flow.Lifetime', cm: 'sja' },
  'com.runbuddy.prod': { name: 'premium', id: 'rb_9999_1y_1y7999', cm: 'sja' },
  'TeleprompterX': { name: 'Pro Upgrade', id: 'TPXOTP', cm: 'sjb' },
  'com.exoplanet.chatme': { name: 'premium', id: 'chatme_premium_year_trial', cm: 'sja' },
  'com.reku.Counter': { name: 'plus', id: 'com.reku.counter.plus.lifetime', cm: 'sjb' },
  'moonbox.co.il.grow': { name: 'pro', id: 'moonbox.co.il.grow.lifetime.offer', cm: 'sjb' },
  'tech.miidii.MDClock': { name: 'Entitlement.Pro', id: 'tech.miidii.MDClock.pro', cm: 'sjb' },
  'com.voicedream.Voic': { name: 'standard', id: 'vd_annual_79_3daytrial', cm: 'sja' },
  'com.laser-focused.focus-ios': { name: 'subscribed', id: 'iap.io.masterbuilders.focus.pro_one_year', cm: 'sja' },
  'com.roehl': { name: 'Pro', id: 'habitkit_3499_lt', cm: 'sjb' },
  'net.tengl.powertimer': { name: 'plus', id: 'powertimer.plus', cm: 'sjb' },
  'com.reader.book': { name: 'pro', id: 'reader.lifetimeFamily.pro', cm: 'sja' },
  'app.imone.OneWidget': { name: 'pro', id: 'app.imone.OneWidget.Lifetime', cm: 'sjb' },
  'io.innerpeace.yiye': { name: 'Premium', id: 'io.innerpeace.yiye.lifetime.forYearly', cm: 'sja' },
  'com.valo.reader': {
    name: 'com.valo.reader.vip1.forever',
    id: 'com.valo.reader.vip1.forever',
    nameb: 'com.valo.reader.vip2.forever',
    idb: 'com.valo.reader.vip2.forever',
    cm: 'sjb'
  },
  'com.skysoft.removalfree': { name: 'Pro', id: 'com.skysoft.removalfree.subscription.newyearly', cm: 'sja' }
};

// UA 映射表 (O(1) 查找) - 需要根据实际数据填充
const UA_MAP = {
  // 示例: 'AppName': { name: 'premium', id: 'app.product.id', cm: 'sja' }
  // 请在此处添加更多应用配置
};

// 默认配置
const DEFAULT_CONFIG = {
  name: 'pro',
  ids: ['com.chxm1023.pro'],
  data: { purchase_date: PURCHASE_DATE, expires_date: EXPIRES_DATE }
};

// ==================== 工具函数 ====================

/**
 * 安全解析 JSON
 */
function safeJSONParse(str) {
  try {
    return str ? JSON.parse(str) : null;
  } catch (e) {
    console.log('JSON解析错误: ' + e.message);
    return null;
  }
}

/**
 * 检查是否为禁止的应用
 */
function isForbiddenApp(ua, body) {
  return FORBIDDEN_APPS.some(app =>
    (ua && ua.includes(app)) || (body && body.includes(app))
  );
}

/**
 * 从 Bundle ID 查找配置
 */
function findByBundleId(bundleId) {
  if (!bundleId) return null;
  return BUNDLE_MAP[bundleId] || null;
}

/**
 * 从 UA 查找配置 (前缀匹配)
 */
function findByUA(ua) {
  if (!ua) return null;

  // 遍历 UA_MAP 查找匹配
  for (const key in UA_MAP) {
    if (ua.startsWith(key)) {
      return UA_MAP[key];
    }
  }
  return null;
}

/**
 * 构建订阅数据
 */
function buildSubscriptionData() {
  return {
    purchase_date: PURCHASE_DATE,
    expires_date: EXPIRES_DATE,
    is_sandbox: false,
    ownership_type: "PURCHASED",
    store_transaction_id: "490001314520000",
    store: "app_store"
  };
}

/**
 * 构建购买记录
 */
function buildPurchaseRecord() {
  return {
    is_sandbox: false,
    ownership_type: "PURCHASED",
    id: "888888888",
    expires_date: EXPIRES_DATE,
    original_purchase_date: PURCHASE_DATE,
    store_transaction_id: "490001314520000",
    purchase_date: PURCHASE_DATE,
    store: "app_store"
  };
}

// ==================== 主逻辑 ====================

function main() {
  // 1. 获取请求头
  const headers = $request.headers;
  const ua = headers['User-Agent'] || headers['user-agent'] || '';
  const bundleId = headers['X-Client-Bundle-ID'] || headers['x-client-bundle-id'] || '';
  const body = $request.body || '';

  // 2. 检查禁止的应用
  if (isForbiddenApp(ua, body)) {
    console.log('⛔️ 检测到禁止 MITM 的 APP，脚本停止运行！');
    return $done({});
  }

  // 3. 判断请求类型
  // 3.1 只有请求头（无响应体）- 清理缓存头
  if (typeof $response === 'undefined') {
    delete headers['x-revenuecat-etag'];
    delete headers['X-RevenueCat-ETag'];
    return $done({ headers });
  }

  // 3.2 有响应体 - 解析并修改
  const responseBody = safeJSONParse($response.body);

  // 检查响应是否有效
  if (!responseBody || !responseBody.subscriber) {
    return $done({});
  }

  // 4. 查找匹配配置
  let config = findByBundleId(bundleId) || findByUA(ua);

  // 5. 处理订阅
  if (config) {
    processSubscription(responseBody, config);
  } else {
    // 未匹配到本地配置，尝试从 API 获取
    console.log('本地未匹配，尝试从 RevenueCat API 获取...');
    fetchFromAPI(headers, responseBody);
    return; // 异步处理
  }

  // 6. 返回修改后的响应
  return $done({
    body: JSON.stringify(responseBody)
  });
}

/**
 * 处理订阅数据
 */
function processSubscription(data, config) {
  const subscriber = data.subscriber;

  // 确保对象存在
  subscriber.subscriptions = subscriber.subscriptions || {};
  subscriber.entitlements = subscriber.entitlements || {};
  subscriber.non_subscriptions = subscriber.non_subscriptions || {};
  subscriber.other_purchases = subscriber.other_purchases || {};

  const { name, id, nameb, idb, cm } = config;
  const ids = id ? [id] : [];
  const subData = buildSubscriptionData();
  const purchaseRecord = buildPurchaseRecord();

  // 设置 entitlements
  if (name) {
    subscriber.entitlements[name] = {
      purchase_date: PURCHASE_DATE,
      expires_date: EXPIRES_DATE,
      product_identifier: id || 'com.chxm1023.pro'
    };
  }

  // 设置第二个 entitlement（可选）
  if (nameb && idb) {
    subscriber.entitlements[nameb] = {
      purchase_date: PURCHASE_DATE,
      expires_date: EXPIRES_DATE,
      product_identifier: idb
    };
  }

  // 设置 subscriptions
  ids.forEach(productId => {
    subscriber.subscriptions[productId] = subData;
  });
  if (idb) {
    subscriber.subscriptions[idb] = subData;
  }

  // 设置 non_subscriptions
  ids.forEach(productId => {
    if (!subscriber.non_subscriptions[productId]) {
      subscriber.non_subscriptions[productId] = [];
    }
    subscriber.non_subscriptions[productId].push(purchaseRecord);
  });
  if (idb) {
    if (!subscriber.non_subscriptions[idb]) {
      subscriber.non_subscriptions[idb] = [];
    }
    subscriber.non_subscriptions[idb].push(purchaseRecord);
  }

  // 设置 other_purchases
  ids.forEach(productId => {
    subscriber.other_purchases[productId] = {
      expires_date: EXPIRES_DATE,
      purchase_date: PURCHASE_DATE
    };
  });
  if (idb) {
    subscriber.other_purchases[idb] = {
      expires_date: EXPIRES_DATE,
      purchase_date: PURCHASE_DATE
    };
  }

  console.log('✅ 订阅处理完成: ' + (name || 'unknown'));
}

/**
 * 从 RevenueCat API 获取配置
 */
function fetchFromAPI(headers, data) {
  const apiUrl = 'https://api.revenuecat.com/v1/product_entitlement_mapping';

  $task.fetch({
    url: apiUrl,
    headers: headers,
    timeout: 10
  }).then(response => {
    const mappingData = safeJSONParse(response.body);

    if (mappingData && mappingData.product_entitlement_mapping) {
      const apiConfig = extractFromMapping(mappingData);
      if (apiConfig.name && apiConfig.ids && apiConfig.ids.length > 0) {
        console.log('API 获取成功: ' + apiConfig.name);
        processSubscription(data, apiConfig);
      } else {
        processSubscription(data, DEFAULT_CONFIG);
      }
    } else {
      processSubscription(data, DEFAULT_CONFIG);
    }

    $done({ body: JSON.stringify(data) });

  }).catch(reason => {
    console.log('API 请求失败: ' + reason.error);
    processSubscription(data, DEFAULT_CONFIG);
    $done({ body: JSON.stringify(data) });
  });
}

/**
 * 从 mapping 数据提取配置
 */
function extractFromMapping(mappingData) {
  const mapping = mappingData.product_entitlement_mapping;
  const entitlementMap = {};

  // 遍历 mapping 构建 entitlement 映射
  Object.keys(mapping).forEach(productId => {
    const item = mapping[productId];
    if (item.entitlements && item.entitlements.length > 0) {
      item.entitlements.forEach(ent => {
        if (!entitlementMap[ent]) {
          entitlementMap[ent] = [];
        }
        if (!entitlementMap[ent].includes(productId)) {
          entitlementMap[ent].push(productId);
        }
      });
    }
  });

  const entitlementNames = Object.keys(entitlementMap);

  if (entitlementNames.length > 0) {
    return {
      name: entitlementNames[0],
      id: entitlementMap[entitlementNames[0]][0],
      ids: entitlementMap[entitlementNames[0]],
      cm: 'sja'
    };
  }

  return DEFAULT_CONFIG;
}

// ==================== 启动 ====================
main();
