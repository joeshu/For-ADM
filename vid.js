[rewrite_local]
##dramaboxd
^https?:\/\/sapi\.(dramaboxdb|dramaboxapp)\.com\/drama-box\/operation\/activity.* url script-request-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/vid.js
##河马剧场
^http?:\/\/ssp\.1rtb\.com\/*&adv_id=* url reject-200
^https?:\/\/api\.ximalaya\.com\/growth\/feedback\/exposed\/youmengtongxin\/1\/collect* url reject-200
^http?:\/\/ad-api\.adn-plus\.com\.cn\/* url reject-200
^http?:\/\/ezdclog\.wojiazongguan\.cn\/statistics\.do url reject-200
##联通APP
^https?:\/\/m\.client\.10010\.com\/mobileService\/customer\/getclientconfig\.htm url reject-200
^https?:\/\/m\.client\.10010\.com\/mobileService\/customer\/accountListData\.htm url reject-200
##微信app
^https?:\/\/mp\.weixin\.qq\.com\/mp\/getappmsgad url response-body advertisement response-body shiju007
^https?:\/\/findermp\.video\.qq\.com\/.*\/stodownload?.*&wxampicformat=.*&picformat=.* url reject-200
^https?:\/\/wximg\.wxs\.qq\.com\/.*\/snscosdownload\/SZ\/reserved\/* url reject-200
^https?:\/\/wxsmw\.wxs\.qq\.com\/.*\/snssvpdownload\/SH\/reserved\/ads_svp_* url reject-200
##瓜子影视
^https?:\/\/(api|gzapi)\..+\.com\/App\/[Aa]d\/(barsIndexAdInfo|splashInfo|vajraInfo|config|activityInfo|skitAdInfo) url reject-200
^https?:\/\/api\..+.com\/App\/(IndexList|IndexPlay|Ad)\/(homeFloatAd|barsPlayAdInfo|vodAdvertisement) url reject-200

  
[mitm]
hostname = sapi.dramaboxdb.com,sapi.dramaboxapp.com,ad-api.adn-plus.com.cn,api.ximalaya.com,m.client.10010.com,mp.weixin.qq.com,wximg.wxs.qq.com,findermp.video.qq.com,wxsmw.wxs.qq.com,ezdclog.wojiazongguan.cn,ssp.1rtb.com


  
const url = $request.url;
var  obj = JSON.parse($request.body);

if (url.includes("/drama-box/operation/activity")) {
  if (obj&&obj.position) {
    obj.position = ["PAY_SUCCESS_RECOMMEND_POSITION"] ;
    console.log(`匹配到URL: ${obj.position}`);
  }
}

$done({body: JSON.stringify(obj)});
