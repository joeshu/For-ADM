
/****************************************
[rewrite_local]
^https:\/\/(yzy*\.*\.com url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tv.js

[mitm]
hostname = yzy*.*.com

*************************************/


var body = $response.body;

body = body.replace(/\"startAdShowTime":\d+/g, '\"startAdShowTime":0');

$done({body});
