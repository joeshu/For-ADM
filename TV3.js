[rewrite_local]
# 移除球竞弹窗推广
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(8|11)(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js
# 移除球竞轮播广告
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/6(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js
# 移除球竞我的页面推广
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/3(\?.*)?$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js
[mitm]
hostname = gateway-api.yizhilive.com


// Quantumult X 广告屏蔽脚本
const path1 = "position=2";
const url = $request.url;
let body = JSON.parse($response.body);

// 规则1: 移除球竞弹窗推广 (ID 8/11)
if (url.match(/\/api\/v2\/index\/carouses\/(8|11)(\?|$)/)) {
  if (Array.isArray(body.data)) body.data = [];
}

// 规则2: 移除球竞轮播广告 (position=2)
//else if (url.match(/\/api\/v3\/index\/all\?.*position=2)) {
//    body.data.banners = [];}

if ($request.url.indexOf(path1) != -1){
delete body.data.banners;
delete body.data.posts.banners;
}



// 规则3: 移除球竞轮播广告 (ID 6)
if (url.match(/\/api\/v2\/index\/carouses\/6(\?|$)/)) {
  if (Array.isArray(body.data)) body.data = [];
}

// 规则4: 移除球竞我的页面推广 (ID 3)
if (url.match(/\/api\/v2\/index\/carouses\/3(\?|$)/)) {
  if (Array.isArray(body.data)) body.data = [];
}

$done({ body: JSON.stringify(body) });
