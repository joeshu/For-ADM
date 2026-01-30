
/****************************************
[rewrite_local]
^https?:\/\/(yz\w{4,6}|cfvip)\..+\.com\/(v2|v1)\/api\/home\/body url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/TV3.js
[mitm]
hostname = yzy0916.*.com,yz1018.*.com,yz250907.*.com,yz0320.*.com,cfvip.*.com
*************************************/
const path4 = "/home/body";
var body = $response.body;
var obj = JSON.parse(body);

/*************************************/
if ($request.url.indexOf(path4) != -1){
obj.data.adList.shift();
}

body = JSON.stringify(obj);
console.log(body);
$done(body);
