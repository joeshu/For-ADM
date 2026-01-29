
/****************************************
[rewrite_local]
^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/(v2|v1)\/api\/(basic\/init|home\/firstScreen|adInfo\/getPageAd) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v2\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getVodBodyAd) url reject-200
^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v2\/api\/home\/notice url reject-200

[mitm]
hostname = yzy0916.*.com,yz1018.*.com,yz250907.*.com
*************************************/
const path1 = "/basic/init";
const path2 = "/home/firstScreen";
const path3 = "/adInfo/getPageAd";

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
}

/*************************************/
if ($request.url.indexOf(path3) != -1){
delete obj.data.floatAd;
}

body = JSON.stringify(obj);
console.log(body);
$done(body);


