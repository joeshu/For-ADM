/*************************************
[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty1.js
^https?:\/\/api\.adaptytech\.com\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty1.js

[mitm]
hostname = api.adapty.io,api.adaptytech.com
************************************/

const headers = $request.headers || {};
const ua = headers['User-Agent'] || headers['user-agent'] || '';
const profileId = headers['adapty-sdk-profile-id'] || headers['profile-id'] || 'fbbb0d4c-f754-4117-b23e-a5fe14f57138';
const customerUserId = headers['adapty-customer-user-id'] || headers['x-customer-user-id'] || `user_${profileId}`;
const requestUrl = $request.url || '';
const timestamp = Date.now();

const DEFAULT_CONFIG = {
  productId: 'remotetv.yearly.01',
  bundleId: 'com.universal.remotetv',
  appId: '20ed8826-ed31-44ad-a0b3-43c8d360d393',
  appleId: 1560806510,
  subscriptionGroupIdentifier: '20903333',
  storefront: 'USA',
  currency: 'USD',
  price: 0,
  accessLevelId: 'premium',
  isSandbox: false
};

const APP_PRESETS = [
  { match: /^PlantApp/i, config: { productId: 'plantapp.weekly.trial.subs', bundleId: 'com.scaleup.plantid', appId: 'cb92b41e-b78b-4244-9dfb-f0b35cf4ec74', appleId: 1595795215, storefront: 'CHN', currency: 'CNY' } },
  { match: /^ArtGenerator/i, config: { productId: 'yearly_premium_artgenerator', bundleId: 'co.appnation.artgenerator' } },
  { match: /^KeyboardGPT/i, config: { productId: 'smart.keyboard.yearly.01', bundleId: 'com.smart.keyboard' } },
  { match: /^SketchAR/i, config: { productId: 'tech.sketchar.subscription.yearly', bundleId: 'tech.sketchar.ios' } },
  { match: /^universal/i, config: { productId: 'remotetv.yearly.01', bundleId: 'com.universal.remotetv' } },
  { match: /^Lingvist/i, config: { productId: 'com.lingvist.unlimited_12_months.v11.full_1md_ft', bundleId: 'ee.keel24.Lingvist' } },
  { match: /^ChatAI/i, config: { productId: 'chatai_yearly_ios', bundleId: 'com.scaleup.chatai' } },
  { match: /^FacePlus/i, config: { productId: 'faceplus_yearly_subs_3dft_ios', bundleId: 'com.scaleup.faceplus' } },
  { match: /^Overdrop/i, config: { productId: 'app.overdrop.lifetime', bundleId: 'com.weather.overdrop', accessLevelId: 'lifetime' } },
  { match: /^Batched/i, config: { productId: 'com.advasoft.batched.premium_year', bundleId: 'com.advasoft.batched' } },
  { match: /^ScreenMirror/i, config: { productId: 'tv.screen.week.01', bundleId: 'tv.screen.mirroring', storefront: 'USA', currency: 'USD' } }
];

const CUSTOM_ATTRIBUTES = {
  design: '1',
  obeyPaywallDesignParams: 'false',
  offerId: 'offer_6',
  closeSecs: '0',
  paywallType: 'session_start_paywall',
  close: 'true',
  packagePaymentTrigger: 'false',
  isActive: 'true'
};

const formatAdaptyDate = (ms) => {
  const iso = new Date(ms).toISOString().split('.')[0];
  return `${iso}.000000+0000`;
};

const formatAppleDate = (ms) => new Date(ms).toISOString().split('.')[0] + 'Z';
const formatReceiptDate = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' Etc/GMT');

const pickConfig = () => {
  for (const preset of APP_PRESETS) {
    if (preset.match.test(ua)) {
      return Object.assign({}, DEFAULT_CONFIG, preset.config);
    }
  }
  return Object.assign({}, DEFAULT_CONFIG);
};

const config = pickConfig();
const transactionId = (30000000000000 + Math.floor(Math.random() * 1000000000000)).toString();
const purchaseDate = timestamp - 1500;
const expiresDate = timestamp + 3 * 24 * 60 * 60 * 1000;
const purchaseIso = formatAdaptyDate(purchaseDate);
const expiresIso = formatAdaptyDate(expiresDate);

const subscriptions = {};
subscriptions[config.productId] = {
  vendor_transaction_id: transactionId,
  offer_id: null,
  billing_issue_detected_at: null,
  is_lifetime: false,
  store: 'app_store',
  vendor_product_id: config.productId,
  vendor_original_transaction_id: transactionId,
  will_renew: true,
  renewed_at: purchaseIso,
  cancellation_reason: null,
  active_promotional_offer_id: null,
  active_promotional_offer_type: null,
  unsubscribed_at: null,
  is_active: true,
  activated_at: purchaseIso,
  is_refund: false,
  is_in_grace_period: false,
  active_introductory_offer_type: 'free_trial',
  expires_at: expiresIso,
  starts_at: null,
  base_plan_id: null,
  is_sandbox: config.isSandbox
};

const paidAccessLevels = {};
paidAccessLevels[config.accessLevelId] = Object.assign({ id: config.accessLevelId }, subscriptions[config.productId]);

const appleValidation = {
  environment: config.isSandbox ? 'Sandbox' : 'Production',
  revision: `${timestamp}_${transactionId}_8`,
  appAppleId: config.appleId,
  transactions: [
    {
      productId: config.productId,
      storefront: config.storefront,
      appAccountToken: null,
      originalTransactionId: transactionId,
      isUpgraded: false,
      expiresDate: new Date(expiresDate).toISOString().split('.')[0] + 'Z',
      offerDiscountType: 'FREE_TRIAL',
      type: 'Auto-Renewable Subscription',
      subscriptionGroupIdentifier: config.subscriptionGroupIdentifier,
      purchaseDate: new Date(purchaseDate).toISOString().split('.')[0] + 'Z',
      price: config.price,
      transactionId,
      offerType: 1,
      offerIdentifier: null,
      revocationDate: null,
      revocationReason: null,
      currency: config.currency,
      inAppOwnershipType: 'PURCHASED',
      originalPurchaseDate: new Date(purchaseDate).toISOString().split('.')[0] + 'Z'
    }
  ],
  hasMore: false,
  bundleId: config.bundleId
};

const receipt = {
  receipt_type: config.isSandbox ? 'ProductionSandbox' : 'Production',
  app_item_id: config.appleId,
  receipt_creation_date: formatReceiptDate(purchaseDate),
  bundle_id: config.bundleId,
  in_app: [
    {
      quantity: '1',
      purchase_date_ms: purchaseDate.toString(),
      expires_date: formatReceiptDate(expiresDate),
      expires_date_pst: formatReceiptDate(expiresDate),
      is_in_intro_offer_period: 'false',
      transaction_id: transactionId,
      is_trial_period: 'true',
      original_transaction_id: transactionId,
      purchase_date: formatReceiptDate(purchaseDate),
      original_purchase_date_pst: formatReceiptDate(purchaseDate),
      in_app_ownership_type: 'PURCHASED',
      original_purchase_date_ms: purchaseDate.toString(),
      web_order_line_item_id: '490000579504987',
      expires_date_ms: expiresDate.toString(),
      purchase_date_pst: formatReceiptDate(purchaseDate),
      original_purchase_date: formatReceiptDate(purchaseDate),
      product_id: config.productId
    }
  ],
  original_purchase_date: formatReceiptDate(purchaseDate),
  adam_id: config.appleId,
  request_date: formatReceiptDate(timestamp),
  version_external_identifier: 854389279,
  application_version: '1'
};

const analyticsPayload = {
  profile_id: profileId,
  app_id: config.appId,
  bundle_id: config.bundleId,
  timestamp
};

const responseType = (() => {
  if (/analytics\/profiles/i.test(requestUrl)) return 'adapty_analytics_profile';
  if (/in-apps\/apple\/receipt\/validate/i.test(requestUrl)) return 'adapty_purchase_app_store_original_transaction_id_validation_result';
  return 'adapty_purchase_app_store_original_transaction_id_validation_result';
})();

const attributes = {
  app_id: config.appId,
  profile_id: profileId,
  is_test_user: config.isSandbox,
  segment_hash: 'ef46db3751d8e999',
  timestamp,
  promotional_offer_eligibility: false,
  non_subscriptions: null,
  apple_validation_result: appleValidation,
  autoconsume: true,
  custom_attributes: CUSTOM_ATTRIBUTES,
  customer_user_id: customerUserId,
  introductory_offer_eligibility: true,
  subscriptions,
  total_revenue_usd: 0,
  paid_access_levels: paidAccessLevels,
  analytics: analyticsPayload,
  receipt
};

const body = JSON.stringify({
  data: {
    type: responseType,
    id: profileId,
    attributes
  }
});

$done({ body });
