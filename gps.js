/* * *
脚本功能：gps工具箱
软件版本：2.7.38
*******************************
[rewrite_local]
# > gps工具箱
^^https:\/\/service\.gpstool\.com\/app\/index\/getUserInfo url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/gps.js

[mitm]
hostname = service.gpstool.com
***/
varobj = JSON.prase($response.body);
if(obj&&obj.data){


  
}
var obj = JSON.parse($response.body);
if (obj && obj.data) {
    obj.data.is_vip = 1;
    obj.data.vip_name = "VIP会员";
    obj.data.vip_expire_date = 2099999;
    obj.data.is_super_vip = 1;
    obj.data.is_power_vip = 1;
    obj.data.group_vip = 1;
    obj.data.group_vip_expire_date = 2099999;
}
$done({body: JSON.stringify(obj)});
