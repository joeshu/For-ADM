[rewrite_local]
^https?:\/\/sapi\.(dramaboxdb|dramaboxapp)\.com\/drama-box\/operation\/activity.* url script-request-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/vid.js
[mitm]
hostname = sapi.dramaboxdb.com,sapi.dramaboxapp.com


//^https?:\/\/sapi\.(dramaboxdb|dramaboxapp)\.com\/drama-box\/operation\/activity.* url request-body "position":["RECHARGE_RETENTION_POP_UP","UNLOCK_PROMPT_PAGE"], request-body "position":["PAY_SUCCESS_RECOMMEND_POSITION"],

  
const url = $request.url;
var  obj = JSON.parse($request.body);

if (url.includes("/drama-box/operation/activity")) {
  if (obj&&obj.position) {
    obj.position = ["PAY_SUCCESS_RECOMMEND_POSITION"] ;
    console.log(`匹配到URL: ${obj.position}`);
  }
}

$done({body: JSON.stringify(obj)});
