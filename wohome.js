/**
 * @function 联通智家
 * @date 2026-02-24
 [rewrite_local]
^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-request-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js   
 [mitm]
hostname = iotpservice.smartont.net
 *****/

if (!$request || !$request.body) {
    $done({});
}

let body = $request.body;
let obj;

try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    $done({});
}

// 修复：检查 posCodeArr 数组是否包含 "APP_START_PAGE"
if (obj?.body?.posCodeArr?.includes("APP_START_PAGE")) {
    console.log("Before delete:", JSON.stringify(obj.body));
    delete obj.body;
    console.log("After delete:", JSON.stringify(obj));
}

body = JSON.stringify(obj);
console.log("Final body:", body);

$done({ body: body });
