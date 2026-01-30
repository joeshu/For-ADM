
/****************************************
[rewrite_local]
##yqs1.app 一起刷影视
^https?:\/\/nkas\.lnaahhj\.com\/icon\/betatest\.png* url reject-200
^https?:\/\/ansj\.ejjjaakq\.com\/api\/(init|index\/ad) url request-body "ad_type":"2", request-body "ad_type":"0"
##瓜子影视
^https?:\/\/(api|gzapi)\..+\.com\/App\/[Aa]d\/(barsIndexAdInfo|splashInfo|vajraInfo|config|activityInfo|skitAdInfo) url reject-200
^https?:\/\/api\..+.com\/App\/(IndexList|IndexPlay|Ad)\/(homeFloatAd|barsPlayAdInfo|vodAdvertisement) url reject-200

[mitm]
hostname =ansj.ejjjaakq.com
*************************************/
