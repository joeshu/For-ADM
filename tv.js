
/****************************************
[rewrite_local]
^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/home\/firstScreen url jsonjq-response-body '.data.hotMudleList |= map(select(.title|contains("广告招商")|not))'
^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getSearchAd|getVodBodyAd|getVodPauseAd|getUserCenterAd) url reject-200
^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(home\/notice|gameCenter\/gameDetailList) url reject-200

[mitm]
hostname = yzy0916.*.com,yz1018.*.com,yz250907.*.com,yz0320.*.com,cfvip.*.com
*************************************/
const path1 = "/basic/init";
const path2 = "/home/firstScreen";
const path3 = "/adInfo/getPageAd";
const path4 = "/home/body";

// 修复：检查 response body 是否存在
if (!$response || !$response.body) {
    $done({});
}

var body = $response.body;
var obj;

// 修复：使用 try-catch 解析 JSON
try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    $done({});
}

// 修复：检查 obj.data 是否存在
if (!obj || !obj.data) {
    $done({body: body});
}

/*************************************/
if ($request.url.indexOf(path1) != -1) {
    if (obj.data) {
        obj.data["startAdShowTime"] = 0;
        obj.data["startAd"] = null;
        obj.data["startAdList"] = null;
    }
}

/*************************************
if ($request.url.indexOf(path2) != -1) {
    if (obj.data) {
        delete obj.data.focusAdList;
        //obj.data.hotMudleList.pop();
        //obj.data.hotMudleList = obj.data.hotMudleList.slice(0, -5);
        if (obj.data.hotMudleList && Array.isArray(obj.data.hotMudleList)) {
            obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
        }
    }
}

/*************************************/
if ($request.url.indexOf(path3) != -1) {
    if (obj.data) {
        delete obj.data.floatAd;
        delete obj.data.popupAd;
    }
}

if ($request.url.indexOf(path4) != -1) {
    if (obj.data && obj.data.adList && Array.isArray(obj.data.adList) && obj.data.adList.length > 0) {
        obj.data.adList.shift();
    }
}

body = JSON.stringify(obj);
//console.log(body);
$done({body: body});
