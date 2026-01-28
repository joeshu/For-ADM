
/****************************************
[rewrite_local]
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/basic\/init url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/basic\/init url response-body data."startAdShowTime" : 5, response-body data."startAdShowTime" : 0,
[mitm]
hostname = yzy*.*.com
*************************************/


var body = $response.body;
var obj = JSON.parse(body);

obj.data["startAdShowTime"] = 0;
body = JSON.stringify(obj);

console.log(body);

$done(body);
