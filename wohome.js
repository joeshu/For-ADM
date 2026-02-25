/**
 * @function 联通智家
 * @date 2026-02-24
 [rewrite_local]
^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js   
 [mitm]
hostname = iotpservice.smartont.net
 *****/

if (!$response || !$response.body) {
    $done({});
}

let body = $response.body;
let obj;

try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    $done({});
}

// 修复：检查 posCodeArr 数组是否包含 "APP_START_PAGE"
if (obj?.body?.posCodeArr?.includes("APP_START_PAGE")) {
    //console.log("Before delete:", JSON.parse($request.body));
    //delete obj.body;
     obj.body = {};
    //console.log("After delete:", JSON.parse($request.body));
}

body = JSON.stringify(obj);
//console.log("Final body:", body);
$done({ body: body });
