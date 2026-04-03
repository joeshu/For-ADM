/*************************************
[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|profiles|customers\/.+\/profile|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store|purchase\/app-store\/original-transaction-id\/validate|integration\/profile\/set\/integration-identifiers) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty-enhanced.js
^https?:\/\/api\.adaptytech\.com\/api\/v\d\/sdk\/(analytics\/profiles|profiles|customers\/.+\/profile|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store|purchase\/app-store\/original-transaction-id\/validate|integration\/profile\/set\/integration-identifiers) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty-enhanced.js

[mitm]
hostname = api.adapty.io, api.adaptytech.com
*************************************/

(() => {
  const safeParse = (s) => { try { return JSON.parse(s || "{}"); } catch (_) { return {}; } };
  const log = (m) => { try { console.log("[adapty-enhanced] " + m); } catch (_) {} };
  const now = () => new Date();
  const isoZ = (d) => d.toISOString();
  const isoPlus = (d) => d.toISOString().replace("Z", ".000000+0000");
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };

  const req = (typeof $request !== "undefined") ? $request : { headers: {}, url: "", body: "" };
  const res = (typeof $response !== "undefined") ? $response : { body: "{}" };

  let out = safeParse(res.body);
  if (!out || typeof out !== "object") out = {};

  const headers = req.headers || {};
  const body = safeParse(req.body || "{}");
  const url = req.url || "";
  const uaRaw = headers["User-Agent"] || headers["user-agent"] || "";
  const ua = decodeURIComponent(uaRaw);

  const profileId =
    headers["adapty-sdk-profile-id"] ||
    headers["ADAPTY-SDK-PROFILE-ID"] ||
    body?.data?.attributes?.profile_id ||
    "8b05ed9d-9f56-43af-ac81-4e7e5d7b724c";

  const originalTx =
    headers["original-transaction-id"] ||
    headers["Original-Transaction-Id"] ||
    body?.data?.attributes?.original_transaction_id ||
    "30003219514509";

  const requestSource = body?.data?.attributes?.request_source || "restore";
  const customerUserId = body?.data?.attributes?.customer_user_id ?? null;

  log(`url=${url}`);
  log(`ua=${ua}`);
  log(`profile_id=${profileId}`);
  log(`original_transaction_id=${originalTx}`);
  log(`request_source=${requestSource}`);

  // App matcher
  const appList = {
    "Overdrop":     { productId: "app.overdrop.one_month_2", bundleId: "com.weather.overdrop", appAppleId: 1459855011, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "Logo Maker":   { productId: "com.limepresso.lm.paid.subscription.pro_yearly_high", bundleId: "com.limepresso.logomaker", appAppleId: 1459855011, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "PlantApp":     { productId: "plantapp.lifetime.promoted.sub", bundleId: "com.scaleup.plantid", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "Genie":        { productId: "yearly_advanced_pro", bundleId: "co.appnation.geniechat", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "Luminar":      { productId: "com.skylum.luminaripad.lifetime", bundleId: "com.skylum.luminaripad", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "ChatAI":       { productId: "chatai_yearly_ios", bundleId: "com.scaleup.chatai", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "FacePlus":     { productId: "faceplus_yearly_subs_3dft_ios", bundleId: "com.scaleup.faceplus", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "SketchAR":     { productId: "tech.sketchar.subscription.yearly", bundleId: "tech.sketchar.ios", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "universal":    { productId: "remotetv.yearly.01", bundleId: "com.universal.remotetv", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "Lingvist":     { productId: "com.lingvist.unlimited_12_months.v11.full_1md_ft", bundleId: "ee.keel24.Lingvist", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "KeyboardGPT":  { productId: "smart.keyboard.yearly.01", bundleId: "com.smart.keyboard", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "AvA":          { productId: "momo_yearly_subs_pro", bundleId: "com.scaleup.dreame", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "Flight Tracker": { productId: "com.iaftt.flightplusfree.49.99year", bundleId: "com.iaftt.flightplusfree", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" },
    "Batched":      { productId: "com.advasoft.batched.premium_year", bundleId: "com.advasoft.batched", appAppleId: 6446992925, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" }
  };

  const fallback = { productId: "app.overdrop.one_month_2", bundleId: "com.weather.overdrop", appAppleId: 1459855011, appId: "b6bbb868-d9a7-4abb-8e9e-0c806e7945c2" };
  let app = fallback;
  for (const k in appList) {
    if (ua.toLowerCase().includes(k.toLowerCase())) { app = appList[k]; break; }
  }

  // Dynamic time
  const t0 = now();
  const tExp = addDays(t0, 30);
  const purchaseDate = isoZ(t0);
  const expiresDate = isoZ(tExp);
  const activatedAt = isoPlus(t0);
  const renewedAt = isoPlus(t0);
  const expiresAt = isoPlus(tExp);

  const subscription = {
    vendor_transaction_id: originalTx,
    offer_id: null,
    billing_issue_detected_at: null,
    is_lifetime: false,
    store: "app_store",
    vendor_product_id: app.productId,
    vendor_original_transaction_id: originalTx,
    will_renew: false,
    renewed_at: renewedAt,
    cancellation_reason: null,
    active_promotional_offer_id: null,
    active_promotional_offer_type: null,
    unsubscribed_at: null,
    is_active: true,
    activated_at: activatedAt,
    is_refund: false,
    is_in_grace_period: false,
    active_introductory_offer_type: "free_trial",
    expires_at: expiresAt,
    starts_at: null,
    base_plan_id: null,
    is_sandbox: false
  };

  const accessPremium = Object.assign({ id: "premium" }, subscription);

  const transaction = {
    productId: app.productId,
    storefront: "CHN",
    appAccountToken: null,
    originalTransactionId: originalTx,
    isUpgraded: false,
    expiresDate: expiresDate,
    offerDiscountType: "FREE_TRIAL",
    type: "Auto-Renewable Subscription",
    subscriptionGroupIdentifier: "20576718",
    purchaseDate: purchaseDate,
    price: 0,
    transactionId: originalTx,
    offerType: 1,
    offerIdentifier: null,
    revocationDate: null,
    revocationReason: null,
    currency: "CNY",
    inAppOwnershipType: "PURCHASED",
    originalPurchaseDate: purchaseDate
  };

  const profileAttrs = {
    app_id: app.appId,
    profile_id: profileId,
    is_test_user: false,
    segment_hash: "fa60e57287863a71",
    timestamp: Date.now(),
    promotional_offer_eligibility: false,
    non_subscriptions: null,
    autoconsume: true,
    custom_attributes: {},
    customer_user_id: customerUserId,
    introductory_offer_eligibility: true,
    subscriptions: { [app.productId]: subscription },
    total_revenue_usd: 0,
    paid_access_levels: { premium: accessPremium },
    access_levels: { premium: accessPremium }
  };

  const respProfile = {
    data: {
      type: "adapty_profile",
      id: profileId,
      attributes: profileAttrs
    }
  };

  const respOTI = {
    data: {
      type: "adapty_purchase_app_store_original_transaction_id_validation_result",
      id: profileId,
      attributes: Object.assign({}, profileAttrs, {
        request_source: requestSource,
        apple_validation_result: {
          environment: "Production",
          revision: `${Date.now()}_${originalTx}_8`,
          appAppleId: app.appAppleId,
          transactions: [transaction],
          hasMore: false,
          bundleId: app.bundleId
        }
      })
    }
  };

  const respIntegrationSet = {
    data: {
      type: "adapty_integration_profile_set_integration_identifiers_result",
      id: profileId,
      attributes: {
        profile_id: profileId,
        request_source: requestSource,
        original_transaction_id: originalTx,
        customer_user_id: customerUserId,
        updated_at: isoZ(now()),
        success: true
      }
    }
  };

  const respReceipt = {
    data: {
      type: "adapty_inapps_apple_receipt_validation_result",
      id: profileId,
      attributes: Object.assign({}, profileAttrs, {
        apple_validation_result: {
          environment: "Production",
          status: 0,
          appAppleId: app.appAppleId,
          bundleId: app.bundleId,
          transactions: [transaction],
          hasMore: false
        }
      })
    }
  };

  try {
    const hitIntegration = /integration\/profile\/set\/integration-identifiers/i.test(url);
    const hitOTI = /purchase\/app-store\/original-transaction-id\/validate/i.test(url);
    const hitReceipt = /in-apps\/apple\/receipt\/validate|purchase-containers/i.test(url);
    const hitPurchase = /purchase\/app-store$/i.test(url);
    const hitProfile = /analytics\/profiles|\/profiles(?:\/|$)|customers\/.+\/profile/i.test(url);

    if (hitIntegration) {
      log("hit INTEGRATION_SET");
      out = respIntegrationSet;
    } else if (hitOTI) {
      log("hit OTI_VALIDATE");
      out = respOTI;
    } else if (hitReceipt || hitPurchase) {
      log("hit RECEIPT/PURCHASE");
      out = respReceipt;
    } else if (hitProfile) {
      log("hit PROFILE");
      out = respProfile;
    } else {
      log("pass-through (no match)");
    }
  } catch (e) {
    log("error=" + e.message);
  }

  $done({ body: JSON.stringify(out) });
})();