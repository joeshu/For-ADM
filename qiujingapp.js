/****************************************
[rewrite_local]
# 移除球竞弹窗推广
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(8|11|6|3)(\?.*)?$ response-body-json-jq 'if (.data|type)=="array" then .data=[] else . end'
# 移除球竞轮播广告
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ response-body-json-jq 'if (.data|type)=="object" and (.data.banners|type)=="array" then .data.banners=[] else . end'


[mitm]
hostname= gateway-api.yizhilive.com
***************************/

const path1 = "/v2/index/carouses/(3|6|8|11))";
const path2 = "/v3/index/all?page=1&pageSize=20&position=2";
var body = $response.body;
var obj = JSON.parse(body);

/********************************************/
if ($request.url.indexOf(path1) != -1){
  if(obj.data){
  obj.data = [];
  }
}
/************************************************/
if ($request.url.indexOf(path2) != -1){
  if(obj.data&&obj.data.banners){
  obj.data.banners = [];
  }
}

body = JSON.stringify(obj);
console.log(body);
$done(body);
