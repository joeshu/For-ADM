/**
 * @function 联通智家 - 去除开屏广告
 * @date 2026-02-24
  [rewrite_local]
  ^https:\/\/iotpservice\.smartont\.net\/wohome\/dispatcher url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/wohome.js
  [mitm]
 hostname = iotpservice.smartont.net
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

// 检查响应状态并处理开屏广告
if (obj?.STATUS === "200" && obj?.RSP?.DATA?.length > 0) {
    let modified = false;
    
    // 遍历 DATA 数组，查找开屏广告配置
    for (let i = 0; i < obj.RSP.DATA.length; i++) {
        let item = obj.RSP.DATA[i];
        
        if (item?.posCode === "APP_START_PAGE" && item?.configList) {
            console.log(`Found APP_START_PAGE at index ${i}, removing ${item.configList.length} ads`);
            
            // 清空广告配置列表
            item.configList = [];
            modified = true;
        }
    }
    
    if (modified) {
        console.log("After modify:", JSON.stringify(obj));
    }
}

body = JSON.stringify(obj);
$done({ body: body });
