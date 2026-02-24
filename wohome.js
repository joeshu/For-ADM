/**
 * @function 联通智家
 * @date 2026-02-24
 [rewrite_local]
^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-request-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js
[mitm]
hostname = iotpservice.smartont.net
 */
// 修复：检查 request body 是否存在
if (!request || !request.body) {
    $done({});
}

var body = $request.body;
var obj;

// 修复：使用 try-catch 解析 JSON
try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    $done({});
}

// 修复：检查 obj.data 是否存在
if (!obj || (obj.posCodeArr = "APP_START_PAGE") ) {
    obj.body = {};
}

body = JSON.stringify(obj);
//console.log(body);
$done({body: body});
