
/****************************************
[rewrite_local]
^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v2\/api\/home\/firstScreen url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv2.js
^https?:\/\/(yzy0916|yz1018|yz250907)\.(q8nsderug|6vh3qyu9x|goi6lhmry|tgs2hl4ut|o5r52at9v|hzkeka49|jba2yo1c|3nyk7h9o|7k5jb8t9|zazy3mc5)\.com\/v1\/api\/adInfo\/getPageAd url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv2.js

[mitm]
hostname = yzy*.*.com,yz1018.*.com,yz250907.*.com,
*************************************/

var body = $response.body;
var obj = JSON.parse(body);


obj.data["focusAdList"] = null;
obj.data["floatAd"] = null;
obj.data.hotMudleList.id[("246"] = 0;
body = JSON.stringify(obj);

console.log(body);

$done(body);
