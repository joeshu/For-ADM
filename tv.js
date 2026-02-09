
/****************************************
[rewrite_local]
^https?:\/\/(yzy0916|yz1018|yz250907|yz0320|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd|home\/body) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getVodBodyAd|getVodPauseAd|getUserCenterAd) url reject-200
^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(home\/notice|gameCenter\/gameDetailList) url reject-200

[mitm]
hostname = yzy0916.*.com,yz1018.*.com,yz250907.*.com,yz0320.*.com,cfvip.*.com
*************************************/
const path1 = "/basic/init";
const path2 = "/home/firstScreen";
const path3 = "/adInfo/getPageAd";
const path4 = "/home/body";

var body = $response.body;
var obj = JSON.parse(body);

/*************************************/
if ($request.url.indexOf(path1) != -1){
obj.data["startAdShowTime"] = 0;
obj.data["startAd"] = null;
obj.data["startAdList"] = null;
}

/*************************************/
if ($request.url.indexOf(path2) != -1){
delete obj.data.focusAdList; 
//obj.data.hotMudleList.pop();
//obj.data.hotMudleList = obj.data.hotMudleList.slice(0, -5);
//obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
if (obj?.data?.hotMudleList?.length > 0) {
    let list = obj.data.hotMudleList;
    const newList = [];
    for (let item of list) {
      if (item?.title?.some((i) =>
          i?.text?.includes("广告招商"))
      ) {
        continue;
      }
      newList.push(item);
    }
    obj.data.hotMudleList = newList;
  }
}

/*************************************/
if ($request.url.indexOf(path3) != -1){
delete obj.data.floatAd;
delete obj.data.popupAd;
}

if ($request.url.indexOf(path4) != -1){
obj.data.adList.shift();
/*******
if (obj?.data?.adList?.length > 0) {
    let list = obj.data.adList;
    const newList = [];
    for (let item of list) {
      if (item?.title?.some((i) =>
          i?.text?.includes("招商"))
      ) {
        continue;
      }
      newList.push(item);
    }
    obj.data.adList = newList;
  }
********/
}

/*************************
const url = $request.url;
if (!$response.body) $done({});
let obj = JSON.parse($response.body);

if (
    url.includes("/api/news/index") ||
    url.includes("/api/topmenu/getfeeds")
) {
  if (obj?.data?.list?.length > 0) {
    let list = obj.data.list;
    const newList = [];
    for (let item of list) {
      if (item?.feedContent?.smallTags?.some((i) =>
          i?.text?.includes("广告"))
      ) {
        continue;
      }
      if ([10002, 10003].includes(item?.feedType)) {
        continue;
      }
      newList.push(item);
    }
    obj.data.list = newList;
  }
}
$done({body: JSON.stringify(obj)})
*****///



body = JSON.stringify(obj);
//console.log(body);
$done(body);


