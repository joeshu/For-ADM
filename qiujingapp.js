/****************************************
[rewrite_local]
# 移除球竞弹窗推广
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(8|11|6|3)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/qiujingapp.js
# 移除球竞轮播广告
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/qiujingapp.js
[mitm]
hostname= gateway-api.yizhilive.com
****************************************/
const url =  $request.url;
//const path6 = "/api/v2/index/carouses/3";
const path2 = "/v3/index/all?page=1&pageSize=20&position=2";
var body = $response.body;
var obj = JSON.parse(body);

/********************************************/
if (url.match(/\/api\/v2\/index\/carouses\/(11|8|6|3)\b/)) {
//console.log(`匹配到URL: ${url}`);
 if (Array.isArray(obj.data)) {
    obj.data = [];
  }
}

/*
if ($request.url.indexOf(path6) != -1){
  if (Array.isArray(obj.data)) {
    obj.data = [];
 }
}
*/
/************************************************/
if (url.match(/\/api\/v3\/index\/all\?.*position=2.*$/)) {
  console.log(`匹配到URL: ${url}`);
   if(obj.data&&obj.data.banners){
  obj.data.banners = [];
}
}

/*
if ($request.url.indexOf(path2) != -1){
  if(obj.data&&obj.data.banners){
  obj.data.banners = [];
 }
}
*/

body = JSON.stringify(obj);
console.log(body);
$done(body);
