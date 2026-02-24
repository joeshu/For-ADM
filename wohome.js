/**
 * @function 联通智家
 * @date 2026-02-24
 * [rewrite_local]
 * ^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-request-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js   
 * [mitm]
 * hostname = iotpservice.smartont.net
 */

// 检查请求体是否存在
if (!$request || !$request.body) {
    $done({});
    return; // 显式返回，避免后续执行
}

let body = $request.body;
let obj;

// 解析 JSON
try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON parse error: " + e);
    $done({}); // 使用 $done 而不是 return
    return;
}

// 检查并处理 posCodeArr
if (obj && obj.body && obj.body.posCodeArr === "APP_START_PAGE") {
    console.log("Before delete:", obj.body);
    delete obj.body;
    console.log("After delete:", obj);
}

body = JSON.stringify(obj);
console.log("Final body:", body);

$done({ body: body });
