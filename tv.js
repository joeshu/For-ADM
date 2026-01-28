
/****************************************
[rewrite_local]
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/basic\/init url response-body data."startAdShowTime" : 5 response-body data."startAdShowTime" : 0

^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js


^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v2\/api\/(adInfo|vodInfo)\/(getPageAd|getTextAd|getVodBodyAd) url reject
^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v2\/api\/home\/notice url reject-200

[mitm]
hostname = yzy*.*.com,yz1018.*.com,yz250907.*.com,
*************************************/

var body = $response.body;
var obj = JSON.parse(body);

obj.data["startAdShowTime"] = 0;
obj.data["startAd"] = null;
obj.data["startAdList"] = null;
body = JSON.stringify(obj);

console.log(body);

$done(body);
