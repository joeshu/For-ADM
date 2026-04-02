/*************************************

项目名称：adapty-合集
更新日期：2025-05-29
脚本作者：@ddm1023
电报频道：https://t.me/ddm1023
使用声明：⚠️仅供参考，🈲转载与售卖！

**************************************

[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/adapty.js

[mitm]
hostname = api.adapty.io

*************************************/


let ddm = JSON.parse($response.body);
const headers = $request?.headers || {};
const ua = headers['User-Agent'] || headers['user-agent'] || "";
const profileid = headers['adapty-sdk-profile-id'] || headers['ADAPTY-SDK-PROFILE-ID'] || "";
const time = Date.now();

const list = {
  'Logo%20Maker': { dy: 'dypda', id: "com.limepresso.lm.paid.subscription.pro_yearly_high", bundle_id: "com.limepresso.logomaker" },  //LogoShop-logo设计软件
  'Luminar': { dy: 'dypda', id: "com.skylum.luminaripad.lifetime", bundle_id: "com.skylum.luminaripad" },  //Luminar手机照片编辑器
  'Genie': { dy: 'dypda', id: "yearly_advanced_pro", bundle_id: "co.appnation.geniechat" },  //Genie - Chatbot
  'Flight%20Tracker': { dy: 'dypda', id: "com.iaftt.flightplusfree.49.99year", bundle_id: "com.iaftt.flightplusfree" },
  '$%7BPRODUCT_NAME%7D': { dy: 'dypda', id: "com.iaftt.flightplusfree.49.99year", bundle_id: "com.iaftt.flightplusfree" },  //FlightTracker - 飞机追踪
  'AvA': { dy: 'dypda', id: "momo_yearly_subs_pro", bundle_id: "com.scaleup.dreame" },  //Momo
  'PlantApp': { dy: 'dypda', id: "plantapp.lifetime.promoted.sub", bundle_id: "com.scaleup.plantid" },  //PlantApp-植物识别
  'KeyboardGPT': { dy: 'dypda', id: "smart.keyboard.yearly.01", bundle_id: "com.smart.keyboard" },  //AiChatbot
  'SketchAR': { dy: 'dypda', id: "tech.sketchar.subscription.yearly", bundle_id: "tech.sketchar.ios" },  //Sketchar-AR画图应用
  'universal': { dy: 'dypda', id: "remotetv.yearly.01", bundle_id: "com.universal.remotetv", },  //TVRemote万能遥控器
  'Lingvist': { dy: 'dypda', id: "com.lingvist.unlimited_12_months.v11.full_1md_ft", bundle_id: "ee.keel24.Lingvist" },  //Lingvist-学习英语
  'ChatAI': { dy: 'dypda', id: "chatai_yearly_ios", bundle_id: "com.scaleup.chatai" },  //Nova-chat机器人
  'FacePlus': { dy: 'dypda', id: "faceplus_yearly_subs_3dft_ios", bundle_id: "com.scaleup.faceplus" },  //Retouch: Al FaceEditor
  'Batched': { dy: 'dypdba', id: "com.advasoft.batched.premium_year", bundle_id: "com.advasoft.batched" }  //Batched-多量图片编辑器
};
var obj = JSON.parse($response.body);
   
    obj = {
   "data" : {
     "type" : "adapty_inapps_apple_receipt_validation_result",
     "id" : "c0fd67d9-1578-4c58-b24b-d744ce4a2bdf",
     "attributes" : {
       "app_id" : "de891419-be85-43e4-a3b8-6aa08efb23f1",
       "total_revenue_usd" : 0,
       "customer_user_id" : null,
       "subscriptions" : {
         "com.watch.faces.subs2" : {
           "vendor_transaction_id" : "310001397531700",
           "billing_issue_detected_at" : null,
           "is_lifetime" : false,
           "store" : "app_store",
           "vendor_product_id" : "com.watch.faces.subs2",
           "vendor_original_transaction_id" : "310001397531700",
           "will_renew" : true,
           "renewed_at" : "2023-04-11T08:39:54.000000+0000",
           "cancellation_reason" : null,
           "active_promotional_offer_id" : null,
           "active_promotional_offer_type" : null,
           "unsubscribed_at" : null,
           "is_active" : true,
           "activated_at" : "2023-04-11T08:39:56.000000+0000",
           "is_refund" : false,
           "is_in_grace_period" : false,
           "active_introductory_offer_type" : "free_trial",
           "expires_at" : "2276-10-17T06:53:14.000000+0000",
           "starts_at" : null,
           "is_sandbox" : false
         }
       },
       "promotional_offer_eligibility" : false,
       "custom_attributes" : {
 
       },
       "profile_id" : "c0fd67d9-1578-4c58-b24b-d744ce4a2bdf",
       "paid_access_levels" : {
         "premium_watch_widgets" : {
           "id" : "premium_watch_widgets",
           "is_lifetime" : false,
           "vendor_product_id" : "com.watch.faces.subs2",
           "active_promotional_offer_type" : null,
           "cancellation_reason" : null,
           "billing_issue_detected_at" : null,
           "unsubscribed_at" : null,
           "expires_at" : "2276-10-17T06:53:14.000000+0000",
           "will_renew" : true,
           "is_active" : true,
           "active_promotional_offer_id" : null,
           "is_in_grace_period" : false,
           "activated_at" : "2023-04-11T08:39:56.000000+0000",
           "renewed_at" : "2023-04-11T08:39:54.000000+0000",
           "is_refund" : false,
           "active_introductory_offer_type" : "free_trial",
           "store" : "app_store",
           "starts_at" : null
         }
       },
       "introductory_offer_eligibility" : false,
       "apple_validation_result" : {
         "environment" : "Production",
         "receipt" : {
           "receipt_type" : "Production",
           "app_item_id" : 1577752071,
           "receipt_creation_date" : "2023-04-11 08:39:56 Etc/GMT",
           "bundle_id" : "com.watch.faces.app",
           "original_purchase_date" : "2023-04-11 08:36:32 Etc/GMT",
           "in_app" : [
             {
               "quantity" : "1",
               "purchase_date_ms" : "1681202394000",
               "expires_date" : "2276-10-17 06:53:14 Etc/GMT",
               "expires_date_pst" : "2276-10-17 06:53:14 America/Los_Angeles",
               "is_in_intro_offer_period" : "false",
               "transaction_id" : "310001397531700",
               "is_trial_period" : "true",
               "original_transaction_id" : "310001397531700",
               "purchase_date" : "2023-04-11 08:39:54 Etc/GMT",
               "product_id" : "com.watch.faces.subs2",
               "original_purchase_date_pst" : "2023-04-11 01:39:56 America/Los_Angeles",
               "in_app_ownership_type" : "PURCHASED",
               "original_purchase_date_ms" : "1681202396000",
               "web_order_line_item_id" : "310000650605036",
               "expires_date_ms" : "9681461594000",
               "purchase_date_pst" : "2023-04-11 01:39:54 America/Los_Angeles",
               "original_purchase_date" : "2023-04-11 08:39:56 Etc/GMT"
             }
           ],
           "adam_id" : 1577752071,
           "receipt_creation_date_pst" : "2023-04-11 01:39:56 America/Los_Angeles",
           "request_date" : "2023-04-11 08:39:58 Etc/GMT",
           "request_date_pst" : "2023-04-11 01:39:58 America/Los_Angeles",
           "version_external_identifier" : 856171850,
           "request_date_ms" : "1681202398648",
           "original_purchase_date_pst" : "2023-04-11 01:36:32 America/Los_Angeles",
           "application_version" : "1",
           "original_purchase_date_ms" : "1681202192000",
           "receipt_creation_date_ms" : "1681202396000",
           "original_application_version" : "1",
           "download_id" : 502338957716873322
         },
         "pending_renewal_info" : [
           {
             "product_id" : "com.watch.faces.subs2",
             "original_transaction_id" : "310001397531700",
             "auto_renew_product_id" : "com.watch.faces.subs2",
             "auto_renew_status" : "1"
           }
         ],
         "status" : 0,
         "latest_receipt_info" : [
           {
             "quantity" : "1",
             "purchase_date_ms" : "1681202394000",
             "expires_date" : "2276-10-17 06:53:14 Etc/GMT",
             "expires_date_pst" : "2276-10-17 06:53:14 America/Los_Angeles",
             "is_in_intro_offer_period" : "false",
             "transaction_id" : "310001397531700",
             "is_trial_period" : "true",
             "original_transaction_id" : "310001397531700",
             "purchase_date" : "2023-04-11 08:39:54 Etc/GMT",
             "product_id" : "com.watch.faces.subs2",
             "original_purchase_date_pst" : "2023-04-11 01:39:56 America/Los_Angeles",
             "in_app_ownership_type" : "PURCHASED",
             "subscription_group_identifier" : "20857042",
             "original_purchase_date_ms" : "1681202396000",
             "web_order_line_item_id" : "310000650605036",
             "expires_date_ms" : "9681461594000",
             "purchase_date_pst" : "2023-04-11 01:39:54 America/Los_Angeles",
             "original_purchase_date" : "2023-04-11 08:39:56 Etc/GMT"
           }
         ],
         "latest_receipt" : "*"
       },
       "non_subscriptions" : null
     }
   }
 }

$done({body : JSON.stringify(obj)});
