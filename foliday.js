/************************************************
# > 复游会<微信小程序> - FOLIDAY
[rewrite_local]
^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getPageComponents url script-response-body https://raw.githubusercontent.com/zirawell/R-Store/main/Res/Scripts/AntiAd/foliday.js
^https?:\/\/apis\.folidaymall\.com\/online\/capi\/component\/getAdAndRecommendedProduct url response-body "adComponent":.+, response-body "adComponent":null,
[mitm]
hostname = apis.folidaymall.com
************************************************/
const url = $request.url;
if (!$response.body) $done({});
let body = $response.body;

if (url.includes("getPageComponents")) {
    let obj = JSON.parse(body);
    const excludedSet = new Set(["TCMP_home_followingadvertising","TC_AIGO"]);
    if (obj?.data?.pageComponents?.length > 0) {
        obj.data.pageComponents = obj.data.pageComponents.filter(
           item => !excludedSet.has(item.componentCode)
        );
    }
    body = JSON.stringify(obj);
}



$done({body});
