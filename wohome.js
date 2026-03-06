/**
 * @function 联通智家 - 去除开屏广告
 * @date 2026-02-24
 * [rewrite_local]
 * ^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js
 * [mitm]
 * hostname = iotpservice.smartont.net
 */

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

// 检查是否为开屏广告响应（posCode 是字符串 "APP_START_PAGE"）
if (obj?.posCode === "APP_START_PAGE" && obj?.configList) {
    console.log("Before modify:", JSON.stringify(obj));
    
    // 清空广告配置列表，保留其他字段避免报错
    obj.configList = [];
    
    console.log("After modify:", JSON.stringify(obj));
}

body = JSON.stringify(obj);
$done({ body: body });
