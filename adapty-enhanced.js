/*************************************
[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|profiles|customers\/.+\/profile|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store|purchase\/app-store\/original-transaction-id\/validate|integration\/profile\/set\/integration-identifiers) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty-enhanced.js
^https?:\/\/api\.adaptytech\.com\/api\/v\d\/sdk\/(analytics\/profiles|profiles|customers\/.+\/profile|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store|purchase\/app-store\/original-transaction-id\/validate|integration\/profile\/set\/integration-identifiers) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty-enhanced.js

[mitm]
hostname = api.adapty.io,api.adaptytech.com
*************************************/

(() => {
  const safeParse = (body) => { try { return JSON.parse(body || '{}'); } catch (e) { return {}; } };
  const log = (msg) => { try { console.log('[adapty-enhanced] ' + msg); } catch (_) {} };
  const $req = typeof $request !== 'undefined' ? $request : { headers: {}, url: '', body: '' };
  const $res = typeof $response !== 'undefined' ? $response : { body: '{}' };

  let mikephie = safeParse($res.body);
  if (!mikephie || typeof mikephie !== 'object') mikephie = { data: {} };

  const headers = $req.headers || {};
  const uaRaw = headers['User-Agent'] || headers['user-agent'] || '';
  const ua = decodeURIComponent(uaRaw);
  const bodyJson = safeParse($req.body || '{}');
  const profileFromBody = bodyJson?.data?.attributes?.profile_id;
  const profileid = headers['adapty-sdk-profile-id'] || headers['ADAPTY-SDK-PROFILE-ID'] || profileFromBody || 'profile';
  const time = Date.now();
  log(`url=${$req.url || ''}`);
  log(`ua=${ua}`);

  const list = {
    'Logo Maker': { dy: 'dypda', id: "com.limepresso.lm.paid.subscription.pro_yearly_high", bundle_id: "com.limepresso.logomaker" },
    'Luminar': { dy: 'dypda', id: "com.skylum.luminaripad.lifetime", bundle_id: "com.skylum.luminaripad" },
    'Genie': { dy: 'dypda', id: "yearly_advanced_pro", bundle_id: "co.appnation.geniechat" },
    'Flight Tracker': { dy: 'dypda', id: "com.iaftt.flightplusfree.49.99year", bundle_id: "com.iaftt.flightplusfree" },
    'AvA': { dy: 'dypda', id: "momo_yearly_subs_pro", bundle_id: "com.scaleup.dreame" },
    'PlantApp': { dy: 'dypda', id: "plantapp.lifetime.promoted.sub", bundle_id: "com.scaleup.plantid" },
    'KeyboardGPT': { dy: 'dypda', id: "smart.keyboard.yearly.01", bundle_id: "com.smart.keyboard" },
    'SketchAR': { dy: 'dypda', id: "tech.sketchar.subscription.yearly", bundle_id: "tech.sketchar.ios" },
    'universal': { dy: 'dypda', id: "remotetv.yearly.01", bundle_id: "com.universal.remotetv" },
    'Lingvist': { dy: 'dypda', id: "com.lingvist.unlimited_12_months.v11.full_1md_ft", bundle_id: "ee.keel24.Lingvist" },
    'ChatAI': { dy: 'dypda', id: "chatai_yearly_ios", bundle_id: "com.scaleup.chatai" },
    'FacePlus': { dy: 'dypda', id: "faceplus_yearly_subs_3dft_ios", bundle_id: "com.scaleup.faceplus" },
    'Overdrop': { dy: 'dypda', id: "app.overdrop.one_month_2", bundle_id: "com.weather.overdrop" },
    'Batched': { dy: 'dypdba', id: "com.advasoft.batched.premium_year", bundle_id: "com.advasoft.batched" }
  };
  const fallbackApp = { dy: 'dypda', id: "plantapp.lifetime.promoted.sub", bundle_id: "com.scaleup.plantid" };

  const premiumTemplate = {"id":"premium","is_lifetime":true,"store":"app_store","starts_at":"2024-04-04T04:04:04.000000+0000","expires_at":"2088-08-08T08:08:08.000000+0000","will_renew":true,"is_active":true,"is_in_grace_period":false,"activated_at":"2024-04-04T04:04:04.000000+0000","renewed_at":"2024-04-04T04:04:04.000000+0000","is_refund":false,"vendor_transaction_id":"300002087810351","vendor_original_transaction_id":"300002087810351","is_sandbox":false,"vendor_product_id" : "plantapp_lifetime_special_ios_2499","product_type" : "lifetime","access_level_id" : "premium","active_introductory_offer_type":"trial"};

  const receiptTemplate = {"quantity":"1","vendor_product_id" : "plantapp_lifetime_special_ios_2499", "product_type" : "lifetime","access_level_id" : "premium","purchase_date_ms":"1712174644000","expires_date":"2088-08-08 08:08:08 Etc/GMT","expires_date_pst":"2088-08-08 08:08:08 America/Los_Angeles","is_in_intro_offer_period":"false","transaction_id":"300002087810351","is_trial_period":"true","original_transaction_id":"300002087810351","purchase_date":"2024-04-04 04:04:04 Etc/GMT","original_purchase_date_pst":"2024-04-04 04:04:04 America/Los_Angeles","in_app_ownership_type":"PURCHASED","original_purchase_date_ms":"1712174644000","web_order_line_item_id":"300002087810351","expires_date_ms":"3742762088000","purchase_date_pst":"2024-04-04T04:04:04Z America/Los_Angeles","original_purchase_date":"2024-04-04T04:04:04Z Etc/GMT"};

  const matchApp = () => {
    const names = Object.keys(list);
    for (const n of names) {
      if (ua.toLowerCase().includes(n.toLowerCase())) return list[n];
    }
    return fallbackApp;
  };

  const buildSubscriptionData = function(appConfig) {
    const subscriptions = {};
    const receiptData = [];
    subscriptions[appConfig.id] = Object.assign({}, premiumTemplate, { "vendor_product_id": appConfig.id, "vendor_transaction_id": "30003219514509", "vendor_original_transaction_id": "30003219514509", "is_lifetime": false, "expires_at": "2088-08-08T08:08:08.000000+0000" });
    receiptData.push(Object.assign({}, receiptTemplate, { "product_id": appConfig.id, "transaction_id": "30003219514509", "original_transaction_id": "30003219514509" }));
    return { subscriptions, receiptData };
  };

  const buildAccessLevels = (appConfig) => ({
    "premium": Object.assign({}, premiumTemplate, {
      "vendor_product_id": appConfig.id,
      "vendor_transaction_id": "30003219514509",
      "vendor_original_transaction_id": "30003219514509",
      "store": "app_store",
      "product_id": appConfig.id,
      "renewed_at": "2024-04-04T04:04:04.000000+0000",
      "activated_at": "2024-04-04T04:04:04.000000+0000",
      "starts_at": "2024-04-04T04:04:04.000000+0000",
      "expires_at": "2088-08-08T08:08:08.000000+0000",
      "is_active": true,
      "is_lifetime": false,
      "will_renew": false,
      "active_introductory_offer_type": "free_trial"
    })
  });

  const buildResponseData = function(appConfig, originalTx) {
    const { subscriptions, receiptData } = buildSubscriptionData(appConfig);
    const access_levels = buildAccessLevels(appConfig);
    const appleValidationResult = {
      "environment":"Production",
      "receipt":{"receipt_type":"Production","app_item_id":6446992925,"bundle_id":appConfig.bundle_id,"in_app":receiptData,"original_purchase_date":"2024-04-04 04:04:04 Etc/GMT"},
      "status":0,
      "pending_renewal_info":[{"expiration_intent":"1","product_id":appConfig.id,"is_in_billing_retry_period":"0","auto_renew_product_id":appConfig.id,"auto_renew_status":"0"}],
      "latest_receipt_info":receiptData,
      "latest_receipt":"mikephie"
    };
    return {"data":{"type":"adapty_inapps_apple_receipt_validation_result","id":profileid,"attributes":{"app_id":"dde4cae7-fdd9-4837-92fb-70c0432b0011","profile_id":profileid,"segment_hash":"ef46db3751d8e999","subscriptions":subscriptions,"total_revenue_usd":0,"paid_access_levels":access_levels,"access_levels":access_levels,"apple_validation_result":appleValidationResult}}};
  };

  try {
    const appConfig = matchApp();
    const url = $req.url || '';
    const hitReceipt = /receipt\/?.?validate|purchase-containers/i.test(url);
    const hitPurchase = /purchase\/?.?app-store$/i.test(url);
    const hitPurchaseOTI = /purchase\/?.?app-store\/original-transaction-id\/validate/i.test(url);
    const hitProfiles = /analytics\/?.?profiles|\Wprofiles\W|customers\/.+\/profile/i.test(url);
    const hitIntegration = /integration\/profile\/set\/integration-identifiers/i.test(url);

    const originalTxFromBody = bodyJson?.data?.attributes?.original_transaction_id;
    const originalTx = headers['original-transaction-id'] || headers['Original-Transaction-Id'] || originalTxFromBody || '30003219514509';

    if (hitReceipt) {
      log('hit receipt/validate or purchase-containers');
      mikephie = buildResponseData(appConfig, originalTx);
    } else if (hitPurchase || hitProfiles || hitPurchaseOTI || hitIntegration) {
      log('hit purchase/app-store or profiles or OTI/validate or integration');
      const access_levels = buildAccessLevels(appConfig);
      const { subscriptions } = buildSubscriptionData(appConfig);
      const transaction = {
        "productId": appConfig.id,
        "storefront": "US",
        "transactionId": originalTx,
        "originalTransactionId": originalTx,
        "expiresDate": "2088-08-08T08:08:08Z",
        "purchaseDate": "2024-04-04 04:04:04Z"
      };
      mikephie.data = {
        "type":"adapty_purchase_app_store_original_transaction_id_validation_result",
        "id": profileid,
        "attributes": {
          "app_id":"dde4cae7-fdd9-4837-92fb-70c0432b0011",
          "profile_id": profileid,
          "is_test_user": false,
          "segment_hash":"ef46db3751d8e999",
          "timestamp": time,
          "promotional_offer_eligibility": false,
          "non_subscriptions": null,
          "apple_validation_result": {
            "environment":"Production",
            "revision":"1731137627000_300002087810351_4",
            "appAppleId":6446992925,
            "transactions":[transaction],
            "hasMore": false,
            "bundleId": appConfig.bundle_id
          },
          "autoconsume": true,
          "custom_attributes": {},
          "customer_user_id": null,
          "introductory_offer_eligibility": true,
          "subscriptions": subscriptions,
          "access_levels": access_levels,
          "total_revenue_usd": 0,
          "paid_access_levels": access_levels
        }
      };
    } else {
      log('pass-through (no match)');
    }
  } catch (e) {
    log('error: ' + e.message);
  }

  $done({ body: JSON.stringify(mikephie) });
})();
