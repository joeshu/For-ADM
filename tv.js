
/****************************************
[rewrite_local]
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/basic\/init url response-body data."startAdShowTime" : 5 response-body data."startAdShowTime" : 0
^https?:\/\/yz250907\.zazy3mc5\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz250907\.7k5jb8t9\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz250907\.3nyk7h9o\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz250907\.jba2yo1c\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz250907\.hzkeka49\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz1018\.o5r52at9v\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz1018\.tgs2hl4ut\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz1018\.goi6lhmry\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yz1018\.6vh3qyu9x\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js

^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/adInfo\/getTextAd url reject-200
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/vodInfo\/getVodBodyAd url reject-200

^https?:\/\/yz*\.*\.com\/v2\/api\/adInfo\/getTextAd url reject-200
^https?:\/\/yz*\.*\.com\/v2\/api\/vodInfo\/getVodBodyAd url reject-200

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
