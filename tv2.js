
/****************************************
[rewrite_local]
##yqs1.app 一起刷影视
^https?:\/\/nkas\.lnaahhj\.com\/icon\/betatest\.png* url reject-200
^https?:\/\/ansj\.ejjjaakq\.com\/api\/(init|index\/ad) url request-body "ad_type":"2", request-body "ad_type":"0"
^https?:\/\/yqs\d\.app url response-body var product_type = '\d' response-body var product_type = '0'
^https://js.anksna.com:8888/filejs/assets/LazyImg.vue_vue_type_script_setup_true_lang-.+.js url 302 https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js

##瓜子影视
^https?:\/\/(api|gzapi)\..+\.com\/App\/[Aa]d\/(barsIndexAdInfo|splashInfo|vajraInfo|config|activityInfo|skitAdInfo) url reject-200
^https?:\/\/api\..+.com\/App\/(IndexList|IndexPlay|Ad)\/(homeFloatAd|barsPlayAdInfo|vodAdvertisement) url reject-200

[mitm]
hostname =ansj.ejjjaakq.com,yqs1.app,*.anksna.com
*************************************/
