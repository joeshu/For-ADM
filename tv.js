
/****************************************
[rewrite_local]
^https:\/\/(yzy.*\.*\.com url script-response-body 9.js

[mitm]
hostname = yzy*.*.com

*************************************/


var body = $response.body;

body = body.replace(/\"startAdShowTime":\d+/g, '\"startAdShowTime":0');

$done({body});
