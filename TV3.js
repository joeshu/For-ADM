/***********
[rewrite_local]
^https?:\/\/www\.bigbangquant\.com\/api-new\/user\/login\/signInToken url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js
[mitm]
hostname = www.bigbangquant.com
***/
var body = $response.body;
var obj = JSON.parse(body);


if (obj.data) {
    obj.data.vipLevel = 2;
    obj.data.check_in_days_cycle = 1000;
    obj.data.check_in_days_continue = 100;
    obj.data.reset_card = 101;
    obj.data.assets.yanhua = 39999;
    obj.data.assets.baozhu = 39991;
    obj.data.vipEndTime = "2027-02-01 21:50:41";
    obj.data.vip_day_card = 200;
    obj.data.received_likes = 200;
    obj.data.check_in_days_all = 200;
    obj.data.partner = 2000;
    obj.data.score = 20000;
    obj.data.buyProducts = ["product_id":3,"product_name":"年卡会员","product_type":1,"product_type_sub":3];


    
}

body = JSON.stringify(obj);
console.log(body);
$done(body);
