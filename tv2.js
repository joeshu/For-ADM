
/****************************************
[rewrite_local]
^https?:\/\/yzy0916\.q8nsderug\.com\/v2\/api\/home\/firstScreen url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv2.js
^https?:\/\/yz250907\.*\.com\/v2\/api\/home\/firstScreen url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv2.js
^https?:\/\/yz1018\.*\.com\/v2\/api\/home\/firstScreen url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv2.js
[mitm]
hostname = yzy*.*.com,yz1018.*.com,yz250907.*.com,
*************************************/

var body = $response.body;
var obj = JSON.parse(body);


obj.data["focusAdList"] = null;

body = JSON.stringify(obj);

console.log(body);

$done(body);
