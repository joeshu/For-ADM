// 一起影视 (yiqi) — NOT the shipped joeshu.yqk 一起看 (different backend).
// Protocol recovered 2026-11-13 by method-level DEX disassembly of
// Lcom/github/catvod/spider/AppYQK; in TVBoxOSC spider.jar, then verified live.
//   sign = MD5hex(UTF-8) of "k=v&k=v&...&appKey=3359de478f8d45638125e446a10ec541"
//   where k=v are the request params in insertion order, appKey appended last.
//   (merge/J/e.a = MessageDigest MD5, lowercase zero-padded hex; getSign appends
//   appKey, hashes, removes appKey, adds sign, Gson-serialises the map.)
//   appId = e6ddefe09e0349739874563459f56c54 (literal in every call site).
//   requestId = i() = 32 random chars from [0-9A-Za-z]; udid = getUUID() which,
//   per the raw bytecode (return-object v0), returns only "%016x" of
//   System.currentTimeMillis() — the UUID it builds is discarded.
//   Common params (insertion order): appId, cus1tom=aabbcc, deviceInfo=Android,
//   reqDomain=yqk1.app, requestId, udid, version=1.2.7.104, + endpoint param last
//   (channelId 2nd for topicListView; vodId / vodEpId last; epId 4th + vodResolution
//   last for playUrl; keyword + nextCount=15 for search).
//   All five v2 endpoints live on https://yzy0916.n0z6fkpuk.com (the <init>
//   constructor concatenates that base for every path); yqk1.app is only the
//   reqDomain / Origin / Referer. Search is the v1 path on the same host.
//   Headers: User-Agent Dart/3.1 (dart:io), Origin https://yqk1.app,
//   Referer https://yqk1.app/, Content-Type application/json.
// Live verification 2026-11-13: home/header (8 channels) -> topicListView ch 65
// (30 topics, 180 vods) -> vodInfo/index 474653 恋爱充电中 (14 players) ->
// epDetail 27998611 (标清 canPlay, 超清 not) -> playUrl (m3u8, HEAD 200);
// search 仙逆 -> 15 items, first vodId 129431.
var Source={id:'yiqi',name:'一起影视',origin:'https://yqk1.app'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:'一起影视',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'一起影视：电影、电视剧、动漫、综艺、奈飞、高清韩剧；搜索与分集播放。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'channelId',title:'分类',type:'enumeration',value:'2',enumOptions:[{title:'电影',value:'2'},{title:'电视剧',value:'3'},{title:'动漫',value:'8'},{title:'综艺',value:'10'},{title:'高清韩剧',value:'56'},{title:'奈飞Netflix',value:'65'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'一起影视搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var YIQI={api:'https://yzy0916.n0z6fkpuk.com',appId:'e6ddefe09e0349739874563459f56c54',appKey:'3359de478f8d45638125e446a10ec541',version:'1.2.7.104'};
// Compact pure-JS MD5 (RFC 1321), UTF-8 input, lowercase hex output. No node:crypto,
// no CryptoJS dependency, so it runs in the app sandbox and the node test harness.
function yiqiMd5Hex(text){
 var bytes=unescape(encodeURIComponent(text)),msg=[],i;
 for(i=0;i<bytes.length;i++)msg.push(bytes.charCodeAt(i));
 var bitLen=msg.length*8;msg.push(128);while(msg.length%64!==56)msg.push(0);
 for(i=0;i<8;i++)msg.push(Math.floor(bitLen/Math.pow(256,i))&255);
 function rotl(x,n){return (x<<n)|(x>>>(32-n));}
 var a0=1732584193,a1=4023233417,a2=2562383102,a3=271733878;
 var s=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
 var k=[],j;for(i=0;i<64;i++)k.push(Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
 for(var off=0;off<msg.length;off+=64){
  var w=[];for(i=0;i<16;i++)w.push((msg[off+i*4])|(msg[off+i*4+1]<<8)|(msg[off+i*4+2]<<16)|(msg[off+i*4+3]<<24));
  var a=a0,b=a1,c=a2,d=a3,f,g;
  for(i=0;i<64;i++){
   if(i<16){f=(b&c)|((~b)&d);g=i;}
   else if(i<32){f=(d&b)|((~d)&c);g=(5*i+1)%16;}
   else if(i<48){f=b^c^d;g=(3*i+5)%16;}
   else{f=c^(b|(~d));g=(7*i)%16;}
   f=(f+a+k[i]+w[g])|0;a=d;d=c;c=b;b=(b+rotl(f,s[i]))|0;
  }
  a0=(a0+a)|0;a1=(a1+b)|0;a2=(a2+c)|0;a3=(a3+d)|0;
 }
 var out='';[a0,a1,a2,a3].forEach(function(x){for(j=0;j<4;j++)out+=('0'+((x>>>(j*8))&255).toString(16)).slice(-2);});
 return out;
}
function yiqiRequestId(){var alpha='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',s='';for(var i=0;i<32;i++)s+=alpha.charAt(Math.floor(Math.random()*62));return s;}
function yiqiUdid(){return Date.now().toString(16).padStart(16,'0');}
function yiqiHeaders(){return {'User-Agent':'Dart/3.1 (dart:io)','Origin':'https://yqk1.app','Referer':'https://yqk1.app/','Content-Type':'application/json'};}
// Build the signed JSON body exactly like getSign: params in insertion order,
// appKey appended to the preimage only, sign added to the body, Gson-style
// escaping of the five HTML chars Gson escapes by default.
function yiqiSignedBody(orderedPairs){
 var pre=orderedPairs.map(function(p){return p[0]+'='+p[1];}).join('&')+'&appKey='+YIQI.appKey;
 var body={};orderedPairs.forEach(function(p){body[p[0]]=p[1];});
 body.sign=yiqiMd5Hex(pre);
 return JSON.stringify(body).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/=/g,'\\u003d').replace(/'/g,'\\u0027');
}
function yiqiCommon(){
 return [['cus1tom','aabbcc'],['deviceInfo','Android'],['reqDomain','yqk1.app'],['requestId',yiqiRequestId()],['udid',yiqiUdid()],['version',YIQI.version]];
}
// The sign preimage order is per call site in the DEX, not alphabetical:
// home/category: appId[, channelId] + common; detail/epDetail: appId + common +
// [vodId|vodEpId]; playUrl: appId + cus1tom + deviceInfo + epId + reqDomain +
// requestId + udid + version + vodResolution; search: appId + cus1tom +
// deviceInfo + keyword + nextCount + reqDomain + requestId + udid + version.
// Each caller therefore passes its full ordered pair list.
async function yiqiApi(path,orderedPairs){
 var body=yiqiSignedBody(orderedPairs);
 var r=await CCTVHttp.post(YIQI.api+path,body,{headers:yiqiHeaders()});
 var status=Number(r.statusCode||r.status||0),d=r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){throw new Error('一起影视返回了无效数据');}}
 if(status<200||status>=300||!d)throw new Error('一起影视接口暂不可用（HTTP '+status+'）');
 if(d.result===false)throw new Error('一起影视：'+(d.msg||'请求被拒绝'));
 return d.data;
}
function yiqiCard(v){
 if(!v||v.vodId==null||!v.vodName)return null;
 return {id:String(v.vodId),title:String(v.vodName),coverUrl:String(v.coverImg||''),description:String(v.remark||v.intro||''),vod_remarks:String(v.remark||'')};
}
function yiqiTopicVods(data){
 var out=[];
 (data&&Array.isArray(data.topicList)?data.topicList:[]).forEach(function(topic){
  (Array.isArray(topic.vodList)?topic.vodList:[]).forEach(function(v){
   var card=yiqiCard(v);if(card)out.push(card);
  });
 });
 return out;
}
function yiqiBase(extra){
 // extra: [[k,v],...] inserted between appId and the common params.
 return [['appId',YIQI.appId]].concat(extra||[]).concat(yiqiCommon());
}
async function loadHome(){
 var data=await yiqiApi('/v2/api/home/header',yiqiBase());
 var channels=(data&&Array.isArray(data.channeList)?data.channeList:[]).filter(function(c){return c.channelName!=='短剧'&&c.channelName!=='体育';});
 var first=channels.find(function(c){return String(c.channelId)==='2';})||channels[0];
 if(!first)return [];
 var list=await yiqiApi('/v2/api/channel/topicListView',yiqiBase([['channelId',String(first.channelId)]]));
 return yiqiTopicVods(list);
}
async function loadCatalog(params){
 params=params||{};
 var page=Math.max(1,Math.floor(Number(params.page)||1));
 if(page>1)return [];
 var channelId=String(params.channelId||'2');
 var data=await yiqiApi('/v2/api/channel/topicListView',yiqiBase([['channelId',channelId]]));
 return yiqiTopicVods(data);
}
async function search(params){
 params=params||{};
 var keyword=String(params.keyword||'').trim();
 if(!keyword)return [];
 var page=Math.max(1,Math.floor(Number(params.page)||1));
 if(page>1)return [];
 var common=yiqiCommon();
 var data=await yiqiApi('/v1/api/search/search',[['appId',YIQI.appId]].concat(common.slice(0,2)).concat([['keyword',keyword],['nextCount','15']]).concat(common.slice(2)));
 var items=Array.isArray(data&&data.items)?data.items:[];
 return items.filter(function(v){return String(v.flags||'').indexOf('短剧')<0;}).map(yiqiCard).filter(Boolean);
}
function yiqiVodId(raw){
 var s=String(raw||'');
 var m=s.match(/[?&]id=(\d+)/);if(m)return m[1];
 m=s.match(/(\d+)(?:[^\d]*)$/);return m?m[1]:s;
}
async function loadDetail(vodId){
 var id=yiqiVodId(vodId);
 var data=await yiqiApi('/v2/api/vodInfo/index',yiqiBase().concat([['vodId',id]]));
 if(!data||data.vodId==null)throw new Error('一起影视没有返回该影片详情');
 var actors=[];
 (Array.isArray(data.actorList)?data.actorList:[]).forEach(function(a){if(a&&a.vodWorkerName)actors.push(a.vodWorkerName);});
 var episodeItems=[];
 (Array.isArray(data.playerList)?data.playerList:[]).forEach(function(player){
  var line=String(player.playerName||'原站线路').replace(/[$#]/g,' ');
  var total=String(player.totalEpCount||'');
  var eps=Array.isArray(player.epList)?player.epList:[];
  eps.forEach(function(ep){
   if(ep==null||ep.epId==null)return;
   var epName=String(ep.epName||'正片');
   var link=String(ep.epId)+'|'+String(data.vodName)+'|'+epName;
   // Same episode name across players = one slot; each player's own epId
   // stays in that line's child link (epIds differ per player). Episode
   // names vary in format across lines ("第01集" vs "第1集" vs "第10集完结"),
   // so group by a normalised key while each child keeps its own label.
   var slotKey=epName.replace(/第0+(\d+)/g,'第$1').replace(/完结/g,'').trim();
   var slot=episodeItems.find(function(e){return e.key===slotKey;});
   if(!slot){slot={title:slotKey,link:link,key:slotKey,childItems:[]};episodeItems.push(slot);}
   slot.childItems.push({title:line+' · '+epName,link:link});
  });
  void total;
 });
 return {id:String(data.vodId),title:String(data.vodName||''),coverUrl:String(data.coverImg||''),
  description:String(data.intro||''),vod_remarks:String(data.updateRemark||''),
  releaseDate:String(data.year||''),area:String(data.areaName||''),actor:actors.join(' '),
  episodeItems:episodeItems};
}
async function resolveResource(params){
 params=params||{};
 var link=String(params.link||'');
 var parts=link.split('|');
 var vodEpId=parts[0];
 if(!/^\d+$/.test(vodEpId))throw new Error('一起影视分集地址无效');
 var items=await yiqiApi('/v2/api/vodInfo/epDetail',yiqiBase().concat([['vodEpId',vodEpId]]));
 if(!Array.isArray(items)||!items.length)throw new Error('一起影视没有返回该集的可播清晰度');
 var pick=items.find(function(x){return x&&x.defaultSelect&&String(x.canPlay)==='true';})
  ||items.find(function(x){return x&&String(x.canPlay)==='true';})
  ||items[0];
 var common=yiqiCommon();
 var data=await yiqiApi('/v2/api/vodInfo/playUrl',[['appId',YIQI.appId]].concat(common.slice(0,2)).concat([['epId',vodEpId]]).concat(common.slice(2)).concat([['vodResolution',String(pick.vodResolution)]]));
 var url=data&&data.playUrl?String(data.playUrl):'';
 if(!/^https?:\/\//i.test(url))throw new Error('一起影视没有返回可播放的视频地址');
 return {url:url,headers:yiqiHeaders()};
}
// BEGIN COLLECTION RUNTIME
var CollectionConfig={"description":"六类片库 · 完整分集 · 直连与AI（受原站额度限制）","poster":"https://joeshu.github.io/yqk-forward-widget/collection-poster.png","guide":"六类片库 · 完整分集 · 直连与AI（受原站额度限制）\nAI会消耗原站词元，请查看AI额度状态；不通过轮换游客身份绕过额度。\n片单摘要为展示而缩短，详情保留全文；占位图仅表示暂无海报。新旧片以原站标注为准；旧片补录也可能出现在近期更新。"};
// Common presentation and request lifecycle. Site parsers and permissions remain in their adapters.
var CollectionCooldownUntil=0;
(function collectionInstall(root) {
  var meta=CCTVHostMetadata, config=CollectionConfig, pending=Object.create(null), last=null;
  var storeKey='collection.status.v1.'+meta.id, guideLink=meta.site.replace(/\/$/,'')+'/#joeshu-widget-guide';
  function text(value){return String(value==null?'':value).trim();}
  function scrub(value){return text(value).replace(/https?:\/\/\S+/g,'[地址]').replace(/(?:cookie|token|sessionSign|captcha_login_sign)\s*[:=]\s*\S+/gi,'[会话信息]').replace(/\b[a-f\d]{32,}\b/gi,'[标识]').slice(0,240);}
  function artwork(value){var s=text(value);if(/^\/\//.test(s))return 'https:'+s;if(/^https?:\/\/[^\s/@]+(?:[/?#]|$)/i.test(s)||/^data:image\//i.test(s))return s;return '';}
  function listItem(item){if(!item||typeof item!=='object')return item;var out=Object.assign({},item), cover=artwork(item.coverUrl)||artwork(item.posterPath);
    out.title=text(item.title);if(!cover&&/^\//.test(text(item.coverUrl)))cover=meta.site.replace(/\/$/,'')+text(item.coverUrl);
    if(!cover&&!text(item.posterPath)){cover=config.poster;out.description='暂无原站海报'+(item.description?' · '+text(item.description):'');}
    if(cover){out.coverUrl=cover;if(!item.posterPath)out.posterPath=cover;}
    var info=[],year=text(item.releaseDate).match(/^(?:19|20)\d{2}/), desc=text(out.description||item.description);
    if(year&&desc.indexOf(year[0])<0)info.push(year[0]);
    var genre=text(item.genreTitle);if(genre&&genre.length<=30&&desc.indexOf(genre)<0)info.push(genre);
    var summary=desc.replace(/\s+/g,' ');if(summary.length>150)summary=summary.slice(0,150)+'…';out.description=info.concat(summary?[summary]:[]).join(' · ');return out;
  }
  function resultList(items){if(!Array.isArray(items))throw new Error('片单格式异常，请更新模块后重试');var seen=Object.create(null),out=[];items.forEach(function(item){var key=item&&text(item.id||item.link);if(key&&seen[key])return;if(key)seen[key]=true;out.push(listItem(item));});return out;}
  function canonical(value,depth){if(depth>8)throw Error('deep');if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(function(v){return canonical(v,depth+1);});var out={};Object.keys(value).sort().forEach(function(k){out[k]=canonical(value[k],depth+1);});return out;}
  function requestKey(name,args){try{var s=JSON.stringify(canonical(args,0));return s.length<=8192?name+'|'+s:null;}catch(e){return null;}}
  function errorHint(error){var e=new Error(),s=scrub(error&&error.message||error),status=Number(error&&error.status);
    if(/TLS|SSL|secure connection|安全连接|证书|-120[0-6]/i.test(s))s='HTTPS连接失败，请检查网络或代理后重试';
    else if(/timed out|timeout|超时|-1001/i.test(s))s='请求超时，请稍后重试或检查网络';
    if((error&&error.code==='RATE_LIMIT')||status===429){CollectionCooldownUntil=Date.now()+30000;s='原站请求过于频繁，30秒后重试；本次不再继续换线';}
    e.message=(s.indexOf(meta.title)===0?'':meta.title+'：')+s;
    ['code','status','apiCode','name'].forEach(function(k){if(error&&error[k]!=null)e[k]=error[k];});return e;
  }
  async function record(row){last={version:1,id:meta.id,at:Date.now(),stage:({loadDetail:'完整分集',resolveResource:'线路检查',search:'搜索',loadHome:'首页推荐',loadLatest:'近期更新',loadCatalog:'分类片库',loadCategory:'分类片库',loadFiltered:'条件筛选'})[row.stage]||'片单加载',ok:row.ok,count:row.count==null?null:row.count,elapsedMs:row.elapsedMs,error:row.error||''};try{if(CCTVStorage&&typeof CCTVStorage.set==='function')await CCTVStorage.set(storeKey,JSON.stringify(last));}catch(e){}}
  async function status(){var row=last;try{if(!row&&CCTVStorage){var raw=await CCTVStorage.get(storeKey);if(typeof raw==='string'&&raw.length<4096){var data=JSON.parse(raw);if(data.version===1&&data.id===meta.id&&typeof data.ok==='boolean'&&Number.isFinite(data.at)&&data.at>0&&data.at<=Date.now()+60000)row=data;}}}catch(e){}
    var title=meta.title+' · '+(row?(row.ok?'最近加载成功':'最近加载受阻'):'使用说明'),description=config.guide;
    if(row){var date=new Date(row.at+8*3600000).toISOString().slice(0,16).replace('T',' ');description='最近记录：北京时间 '+date+' · '+(row.stage||'加载')+' · '+Math.round(Number(row.elapsedMs)||0)+'毫秒'+(row.count!=null?' · '+row.count+'项':'')+'\n'+(!row.ok?scrub(row.error)+'\n':'')+description+'\n这是一条历史记录，不代表原站当前在线状态。';}
    return [{id:guideLink,type:'url',link:guideLink,title:title,description:description,coverUrl:config.poster}];
  }
  root.collectionStatus=status;
  var functions=Object.create(null);meta.modules.forEach(function(m){if(m.functionName&&!/^(?:configureSession|loadAiQuotaStatus|collectionStatus)$/.test(m.functionName))functions[m.functionName]=true;});if(meta.search)functions[meta.search.functionName]=true;functions.loadDetail=true;functions.resolveResource=true;
  Object.keys(functions).forEach(function(name){var original=root[name];if(typeof original!=='function')return;root[name]=function(){var args=Array.prototype.slice.call(arguments),self=this;if(name==='search'&&!text(args[0]&&args[0].keyword).replace(/[\u200b-\u200d\ufeff]/g,''))return Promise.resolve([]);
    if(name==='loadDetail'&&args[0]===guideLink)return status().then(function(items){return items[0];});
    if(Date.now()<CollectionCooldownUntil){var e=new Error(meta.title+'：原站请求过于频繁，请在30秒后重试');e.code='RATE_LIMIT';return Promise.reject(e);}
    var key=requestKey(name,args);if(Object.keys(pending).length>=64)key=null;if(key&&pending[key])return pending[key];var start=Date.now();var promise=Promise.resolve().then(function(){return original.apply(self,args);}).then(function(value){return name==='loadDetail'||name==='resolveResource'?value:resultList(value);}).then(async function(out){await record({stage:name,ok:true,count:Array.isArray(out)?out.length:null,elapsedMs:Date.now()-start});return out;},async function(error){var e=errorHint(error);await record({stage:name,ok:false,elapsedMs:Date.now()-start,error:e.message});throw e;});
    if(key){pending[key]=promise;function clean(){if(pending[key]===promise)delete pending[key];}promise.then(clean,clean);}return promise;
  };});
  meta.description=config.description;meta.detailCacheDuration=0;
  meta.modules.forEach(function(m){if(m.id==='latest')m.title=config.latestTitle||'近期更新';if(m.id==='home')m.title=config.homeTitle||'首页推荐';if(m.id==='catalog'||m.id==='category')m.title=config.catalogTitle||'分类片库';if(m.id==='searchList')m.title=meta.id==='joeshu.anime1'?'搜索动画':'搜索影片';if(m.type==='stream'){m.cacheDuration=0;m.title='播放线路';}else if(m.functionName==='search')m.cacheDuration=0;else if(!/^(?:configureSession|loadAiQuotaStatus)$/.test(m.functionName))m.cacheDuration=m.id==='latest'?30:60;});
  if(meta.search&&!meta.modules.some(function(m){return m.functionName===meta.search.functionName;}))meta.modules.push({id:'searchList',title:'搜索影片',functionName:meta.search.functionName,cacheDuration:0,params:meta.search.params});
  function order(m){if(m.id==='latest')return 0;if(m.id==='home')return 1;if(m.id==='newReleases')return 2;if(m.functionName==='configureSession')return meta.id==='joeshu.juyeye'?-1:8;if(m.functionName==='loadAiQuotaStatus')return 8;if(m.type==='stream')return 10;if(m.id==='searchList')return 7;return 3;}
  meta.modules=meta.modules.map(function(m,i){return {m:m,i:i};}).sort(function(a,b){return order(a.m)-order(b.m)||a.i-b.i;}).map(function(x){return x.m;});
  meta.modules.splice(meta.modules.findIndex(function(m){return m.type==='stream';})<0?meta.modules.length:meta.modules.findIndex(function(m){return m.type==='stream';}),0,{id:'collectionGuide',title:'使用说明与状态',functionName:'collectionStatus',cacheDuration:0,params:[]});
})(globalThis);

/* CCTVHost CatVod contract. This adapter is intentionally self-contained. */
var CCTVHttp=(function(){
  async function request(url,options){
    options=options||{};
    if(typeof net==='undefined'||!net||typeof net.http!=='function')throw new Error('CCTVHost 网络接口不可用');
    var result=await net.http(String(url),options);
    if(result&&result.error)throw new Error(String(result.error));
    var content=result&&result.content,data=content;
    if(options.buffer===1)data='';
    else if(typeof content==='string'){
      try{data=JSON.parse(content);}catch(_){data=content;}
    }
    return {statusCode:Number(result&&result.code)||0,status:Number(result&&result.code)||0,
      headers:result&&result.headers||{},data:data,bodyBase64:options.buffer===1&&typeof content==='string'?content:''};
  }
  return {request:request,get:function(url,options){return request(url,options);},
    post:function(url,body,options){options=Object.assign({},options||{},{method:'POST',body:body});return request(url,options);}};
})();
var CCTVStorage={
  get:async function(key){if(typeof local==='undefined'||!local||typeof local.get!=='function')return null;return local.get('cctvhost.'+String(CCTVHostMetadata.id)+'.'+String(key));},
  set:async function(key,value){if(typeof local==='undefined'||!local||typeof local.set!=='function')return;local.set('cctvhost.'+String(CCTVHostMetadata.id)+'.'+String(key),value==null?'':String(value));},
  remove:async function(key){if(typeof local==='undefined'||!local||typeof local.delete!=='function')return;local.delete('cctvhost.'+String(CCTVHostMetadata.id)+'.'+String(key));}
};

function cctvCatVodText(value){return String(value==null?'':value).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();}
function cctvCatVodValue(item,keys){for(var i=0;i<keys.length;i++)if(item&&item[keys[i]]!=null&&item[keys[i]]!=='')return item[keys[i]];return '';}
function cctvCatVodCards(items){
  return (Array.isArray(items)?items:[]).map(function(item){
    if(!item||typeof item!=='object')return null;
    var id=cctvCatVodValue(item,['id','link']),name=cctvCatVodValue(item,['title','name']);
    if(!id||!name)return null;
    var cover=cctvCatVodValue(item,['coverUrl','posterPath','vod_pic']);
    return {vod_id:String(id),vod_name:cctvCatVodText(name),vod_pic:String(cover||''),
      vod_remarks:cctvCatVodText(cctvCatVodValue(item,['description','remark','vod_remarks'])),
      vod_content:cctvCatVodText(cctvCatVodValue(item,['description','summary','vod_content'])),
      vod_year:cctvCatVodText(cctvCatVodValue(item,['releaseDate','year','vod_year'])),
      vod_area:cctvCatVodText(cctvCatVodValue(item,['area','vod_area'])),
      vod_class:cctvCatVodText(cctvCatVodValue(item,['genreTitle','type','vod_class'])),
      vod_actor:cctvCatVodText(cctvCatVodValue(item,['actor','vod_actor'])),
      vod_director:cctvCatVodText(cctvCatVodValue(item,['director','vod_director']))};
  }).filter(Boolean);
}
function cctvCatVodPage(items,page,maxPage){
  var list=cctvCatVodCards(items),current=Math.max(1,Math.floor(Number(page)||1));
  var count=Number(maxPage)||0;
  if(!count)count=list.length?current+1:current;
  return {page:String(current),pagecount:String(Math.max(current,count)),limit:String(list.length||20),total:String(list.length),list:list};
}
function cctvCatVodClasses(){
  if(typeof Source!=='undefined'&&CCTVHostMetadata.modules){
    var module=CCTVHostMetadata.modules.find(function(row){return row&&row.functionName==='loadCatalog';});
    var param=module&&module.params&&module.params.find(function(row){return row.name==='channelId';});
    if(param&&Array.isArray(param.enumOptions))return param.enumOptions.map(function(row){return {type_id:String(row.value),type_name:String(row.title)};});
  }
  if(typeof DYL!=='undefined')return (dylConfig&&dylConfig.index_top_nav||[]).filter(function(row){return row&&/^\d+$/.test(String(row.id));}).map(function(row){return {type_id:String(row.id),type_name:cctvCatVodText(row.name||row.title)};});
  if(typeof YqkCategories!=='undefined'){
    var out=[];
    YqkCategories.forEach(function(row){out.push({type_id:String(row.id),type_name:String(row.title)});(row.children||[]).forEach(function(child){out.push({type_id:String(row.id)+':'+String(child[0]),type_name:String(row.title)+' · '+String(child[1])});});});
    out.push({type_id:'65',type_name:'奈飞 Netflix'},{type_id:'56',type_name:'高清韩剧'});
    return out;
  }
  if(typeof SjKinds!=='undefined')return SjKinds.map(function(row){return {type_id:String(row[0]),type_name:String(row[1])};});
  return [];
}
function cctvCatVodEpisode(item){
  var route=cctvCatVodValue(item,['link','id']);
  if(!route)return null;
  var title=cctvCatVodText(cctvCatVodValue(item,['title','name']))||'正片';
  return {title:title.replace(/[$#]/g,' '),url:String(route)};
}
function cctvCatVodGroups(item){
  var episodes=Array.isArray(item&&item.episodeItems)?item.episodeItems:[],groups=Object.create(null),order=[];
  function add(name,episode){if(!episode)return;name=cctvCatVodText(name)||'原站线路';if(!groups[name]){groups[name]=[];order.push(name);}groups[name].push(episode);}
  episodes.forEach(function(ep){
    var children=Array.isArray(ep&&ep.childItems)?ep.childItems:[];
    if(children.length){children.forEach(function(child){var title=cctvCatVodText(child&&child.title),split=title.indexOf(' · '),line=split>0?title.slice(0,split):'原站线路',episodeTitle=split>0?title.slice(split+3):cctvCatVodText(ep.title);add(line,{title:(episodeTitle||ep.title||'正片').replace(/[$#]/g,' '),url:String(child.link||child.id||'')});});}
    else add('原站线路',cctvCatVodEpisode(ep));
  });
  return order.map(function(name){return {name:name,episodes:groups[name]};});
}
function cctvCatVodDetailRow(item,groups){
  var row=cctvCatVodCards([item])[0];if(!row)throw new Error('站点详情缺少有效影片信息');
  groups=(groups||cctvCatVodGroups(item)).filter(function(group){return group&&group.episodes&&group.episodes.length;});
  if(!groups.length)throw new Error('站点没有返回可选分集');
  row.vod_play_from=groups.map(function(group){return cctvCatVodText(group.name).replace(/[$#]/g,' ');}).join('$$$');
  row.vod_play_url=groups.map(function(group){return group.episodes.map(function(ep){return ep.title+'$'+ep.url;}).join('#');}).join('$$$');
  return row;
}
async function cctvCatVodMap(items,mapper,limit){
  var out=new Array(items.length),next=0,workers=[];limit=Math.max(1,Math.min(Number(limit)||4,items.length||1));
  for(var i=0;i<limit;i++)workers.push((async function(){while(next<items.length){var index=next++;out[index]=await mapper(items[index],index);}})());
  await Promise.all(workers);return out;
}
async function cctvCatVodHome(){
  if(typeof DYL!=='undefined')await dylEnsure();
  var classes=cctvCatVodClasses(),items;
  if(typeof YQK!=='undefined')items=await loadHome({topicId:'all'});else items=await loadHome({});
  return {class:classes,list:cctvCatVodCards(items)};
}
async function cctvCatVodCategory(tid,page,filter,extend){
  var id=String(tid||''),current=Math.max(1,Math.floor(Number(page)||1)),items,maxPage=0;
  if(typeof YQK!=='undefined'){
    if(id==='65'||id==='56')items=await loadCollection({channelId:id,collection:'latest',page:current});
    else{var match=id.match(/^(\d+)(?::(\d+))?$/);if(!match)throw new Error('分类编号无效');
      items=await loadCategory({parentChannelId:match[1],childChannelId:match[2]||extend&&extend.childChannelId||'',page:current});}
    maxPage=Number(YQK.maxPage)||0;
  }else if(typeof SjKinds!=='undefined'){
    items=await loadCatalog({kind:id,genre:extend&&extend.genre||'',area:extend&&extend.area||'',year:extend&&extend.year||'',sort:extend&&extend.sort||'updated_desc',page:current});
  }else items=await loadCatalog({channelId:id,page:current});
  return cctvCatVodPage(items,current,maxPage);
}
async function cctvCatVodSearch(keyword,quick,page){
  return cctvCatVodPage(await search({keyword:String(keyword||''),page:Math.max(1,Math.floor(Number(page)||1))}),page);
}
async function cctvCatVodDetail(ids){
  var id=Array.isArray(ids)?ids[0]:ids,detail=await loadDetail(String(id||''));
  var groups=cctvCatVodGroups(detail);
  if(typeof YQK!=='undefined'&&Array.isArray(detail.childItems)&&detail.childItems.length){
    var sources=detail.childItems.slice(0,24);
    var resolved=await cctvCatVodMap(sources,async function(source){
      try{var lineDetail=await loadDetail(String(source.link||source.id||'')),episodes=Array.isArray(lineDetail.episodeItems)?lineDetail.episodeItems:[];
        var name=cctvCatVodText(source.title).replace(/\s*[（(].*[）)]\s*$/,'')||'原站线路';
        return {name:name,episodes:episodes.map(cctvCatVodEpisode).filter(Boolean)};
      }catch(_){return null;}
    },4);
    groups=resolved.filter(function(group){return group&&group.episodes.length;});
  }
  return {list:[cctvCatVodDetailRow(detail,groups)]};
}
async function cctvCatVodPlay(flag,id,vipFlags){
  var result=await resolveResource({link:String(id||'')}),media=Array.isArray(result)?result[0]:result;
  var url=String(media&&media.url||media&&media.playUrl||'');
  if(!/^https?:\/\//i.test(url))throw new Error('站点没有返回可播放的视频地址');
  return {parse:0,url:url,header:media.customHeaders||media.headers||media.header||{}};
}
module.exports={
  home:async function(filter){return cctvCatVodHome();},
  category:async function(tid,page,filter,extend){return cctvCatVodCategory(tid,page,filter,extend||{});},
  search:async function(keyword,quick,page){return cctvCatVodSearch(keyword,quick,page);},
  detail:async function(ids){return cctvCatVodDetail(ids);},
  play:async function(flag,id,vipFlags){return cctvCatVodPlay(flag,id,vipFlags);}
};
