
/****************************************
[rewrite_local]
^https:\/\/yzy*\.*\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
[mitm]
hostname = yzy*.*.com
*************************************/
/* ^https:\/\/yzy*\.*\.com\/v2\/api\/basic\/init  url response-body "startAdShowTime":?", response-body "startAdShowTime":0" */
var body = $response.body;
var obj = JSON.parse(body);

obj['startAdShowTime'] = 0;
body = JSON.stringify(obj);

console.log(body);

$done(body);
