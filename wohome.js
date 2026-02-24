/**
 * @function 联通智家
 * @date 2026-02-24
 [rewrite_local]
^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-request-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js 
[mitm]
hostname = iotpservice.smartont.net
 */

// 修复：检查 $request.body 是否存在
if (!$request || !$request.body) {
    $done({});
}

let body = $request.body;
let obj;

// 修复：使用 try-catch 解析 JSON
try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    return $done({});
}

// 修复：检查 obj.body 是否存在，并正确比较 posCodeArr
if (obj && obj.body && obj.body.body.posCodeArr === "APP_START_PAGE") {
    delete obj.body.body;
}

body = JSON.stringify(obj);
console.log(body);

$done({body: body});
