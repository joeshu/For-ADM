
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
//^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js


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
//obj.data.hotMudleList.pop();
//obj.data.hotMudleList.pop();
//obj.data.hotMudleList.pop();
//obj.data.hotMudleList = obj.data.hotMudleList.slice(0, -5);
obj.data.hotMudleList = obj.data.hotMudleList.slice(0, 5);
      /*
      obj.data.hotMudleList = [
      {
        "imgUrl" : "https://ff1.1t4b19ec.com/upload/images/202405/799e33c8-107e-4adc-af5f-af6edf3fe9e4.png",
        "adImgType" : 0,
        "adAction" : 9,
        "id" : 59,
        "actionContent" : "",
        "title" : "上映表单",
        "adInsertRule" : null,
        "subTitle" : "",
        "fileType" : 1
      },
      {
        "imgUrl" : "https://ff1.1t4b19ec.com/upload/images/202405/d294ae3a-4e06-464d-a1c5-0738e12a2e4b.png",
        "adImgType" : 0,
        "adAction" : 3,
        "id" : 6,
        "actionContent" : "2",
        "title" : "爱优腾芒",
        "adInsertRule" : null,
        "subTitle" : "",
        "fileType" : 1
      },
      {
        "imgUrl" : "https://ff1.1t4b19ec.com/upload/images/202405/f7c78ea1-e9af-4bf8-835d-07b0509b7120.png",
        "adImgType" : 0,
        "adAction" : 3,
        "id" : 7,
        "actionContent" : "3",
        "title" : "院线上新",
        "adInsertRule" : null,
        "subTitle" : "",
        "fileType" : 1
      },
      {
        "imgUrl" : "https://ff1.1t4b19ec.com/upload/images/202405/291a8fc5-96f1-4f68-a09d-5d47e10bfb8a.png",
        "adImgType" : 0,
        "adAction" : 3,
        "id" : 8,
        "actionContent" : "4",
        "title" : "美韩日剧",
        "adInsertRule" : null,
        "subTitle" : "",
        "fileType" : 1
      },
      {
        "imgUrl" : "https://ff1.1t4b19ec.com/upload/images/202405/2e3cbeff-b707-4d39-a1df-2d93efe336ae.png",
        "adImgType" : 0,
        "adAction" : 7,
        "id" : 9,
        "actionContent" : "",
        "title" : "热播排行",
        "adInsertRule" : null,
        "subTitle" : "",
        "fileType" : 1
      }]
*/

}

/*************************************/
if ($request.url.indexOf(path3) != -1){
delete obj.data.floatAd;
delete obj.data.popupAd;
}

if ($request.url.indexOf(path4) != -1){
obj.data.adList.shift();
}

body = JSON.stringify(obj);
console.log(body);
$done(body);


