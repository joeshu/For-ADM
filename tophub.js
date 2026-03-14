 /**
 * @function 今日热榜 VIP 解锁
 * @desc 修改 account/sync 接口响应，强制返回永久 VIP 状态
 * 
 [rewrite_local]
 ^https:\/\/api2\.tophub\.today\/account\/sync url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/tophub.js
 
 [mitm]
 hostname = api2.tophub.today
 */

const $ = new Env('TopHubVIP');

// 检查响应是否存在
if (!$response || !$response.body) {
    $.done({});
}

let body = $response.body;
let obj;

// 解析 JSON
try {
    obj = JSON.parse(body);
} catch (e) {
    $.log("JSON parse error: " + e);
    $.done({});
}

// 强制修改为 VIP 状态
if (obj && obj.data) {
  //  $.log("Original VIP status: is_vip=" + obj.data.is_vip + ", is_vip_now=" + obj.data.is_vip_now);
    
    // 修改 VIP 相关字段
    obj.error = 0;
    obj.status = 200;
    obj.data.is_vip = "1";
    obj.data.is_vip_now = 1;
    obj.data.vip_expired = "2099-12-31 23:59:59";
    
    // 可选：添加其他 VIP 字段（根据实际接口可能需要）
    //obj.data.vip_type = "lifetime";
    //obj.data.vip_level = 99;
    
   $.log("Modified VIP status: permanent VIP until " + obj.data.vip_expired);
} else {
    // 如果响应结构异常，构造一个新的 VIP 响应
    obj = {
        "error": 0,
        "status": 200,
        "data": {
            "is_vip": "1",
            "is_vip_now": 1,
            "vip_expired": "2099-12-31 23:59:59",
            "vip_type": "lifetime",
            "vip_level": 99
        }
    };
    $.log("Created new VIP response");
}

body = JSON.stringify(obj);
$.done({ body: body });

// 简单的 Env 类（Quantumult X 兼容）
function Env(name) {
    this.name = name;
    this.log = function(msg) {
        console.log(`[${this.name}] ${msg}`);
    };
    this.done = function(object) {
        $done(object);
    };
}
