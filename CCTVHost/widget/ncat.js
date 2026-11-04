/* Standalone CCTVHost WidgetAdapter for the three signed-app sources. */
var Source={"id":"ncat","name":"网飞猫","origin":"https://a.napp03.com:51111","version":"2.5.31","appId":"ncat","signKey":"a1id2db7ced05pwnc323gezxyb","responseKeys":[{"index":1,"key":"ayt5wy5afwmwrpb19k9s3psx3dymyd0n","iv":"b3t069ijy7pirw0j"}]};
var WidgetMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.1',requiredVersion:'0.0.1',description:'独立站点适配：原站首页、分类、搜索、详情、分集与公开播放地址。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'剧集',value:'2'},{title:'动漫',value:'3'},{title:'综艺纪录',value:'4'},{title:'Netflix',value:'1000'},{title:'短剧',value:'6'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'loadResource',title:'播放线路',type:'stream',functionName:'loadResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var SiteCrypto=function(){if(typeof CryptoJS==='undefined')throw Error('CCTVHost 加密组件缺失');return CryptoJS;};
var siteDevice=null,siteUser=null,siteConfig=null,siteBootstrap=null,siteGuest=null,siteDetails=Object.create(null);
var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteRandom=function(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var n=Math.random()*16|0;return(c==='x'?n:(n&3|8)).toString(16);});};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var siteCard=function(row){
 if(!row||typeof row!=='object'||row.isAd===true||row.type==='ad'||String(row._vod||'').indexOf('ad_')===0)return null;
 var route=String(row.url||''),id=siteGet(row,['vodId','vod_id','id']);
 if(route.indexOf('vod/detail?')>=0){id=siteQueryValue(route,'vodId')||siteQueryValue(route,'id')||id;}
 if(!siteIdOK(id))return null;
 var title=siteText(siteGet(row,['title','vodName','vod_name','name']));if(!title)return null;
 var image=siteSafeURL(siteGet(row,['imageURL','coverImg','cover','image','vod_pic']));
 if(!image){var path=String(siteGet(row,['imagePath','coverPath','vodPic','vod_pic'])||'');if(path.indexOf('//')===0)image='https:'+path;else if(path.charAt(0)==='/'){var group=siteArray(siteConfig&&siteConfig.groups).find(function(x){return String(x.id)===String(row.imageGroup||'');}),domains=siteArray(group&&group.url).map(function(x){return siteSafeURL(String(x&&x.domain||''));}).filter(Boolean),probe=siteImageDomains[String(row.imageGroup||'')],domain=probe?probe.domain:(domains[0]||'');image=domain?domain.replace(/\/$/,'')+'/'+path.replace(/^\//,''):domains.length?'':Source.origin+path;}else image=siteSafeURL(path);}
 var subtitle=siteText(siteGet(row,['bottomLabel','remark','vod_remarks','scoreText','dynamic'])||'');
 var labels=siteArray(row.labels||row.tags).map(function(x){return siteText(x&&typeof x==='object'?x.name||x.title:x);}).filter(Boolean).slice(0,4);
 return {id:siteLink('vod',{id:id}),type:'url',link:siteLink('vod',{id:id}),title:title,coverUrl:image,posterPath:image,description:subtitle,mediaType:Number(row.channelId)===1?'movie':'tv',labels:labels.map(function(name){return {name:name};})};
};
var siteCards=function(value){var out=[],seen=Object.create(null);function visit(v,depth){if(depth>8||!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(function(x){visit(x,depth+1);});return;}var item=siteCard(v);if(item){var key=item.link;if(!seen[key]){seen[key]=true;out.push(item);}return;}['blocks','data','items','list','vods','vodList','recommendList'].forEach(function(k){if(v[k])visit(v[k],depth+1);});}visit(value,0);return out;};
var siteHeaders=function(raw){var out={};if(Array.isArray(raw))raw.forEach(function(x){if(x&&x.name&&x.value)out[String(x.name)]=String(x.value);});else if(raw&&typeof raw==='object')Object.keys(raw).forEach(function(k){var v=raw[k];if(typeof v==='string'&&/^[A-Za-z][A-Za-z0-9-]*$/.test(k)&&!/host|content-length/i.test(k))out[k]=v;});return out;};
var siteImageDomains=Object.create(null),siteImageDomainFlights=Object.create(null);
function siteHeaderValue(headers,name){if(!headers||typeof headers!=='object')return '';name=String(name||'').toLowerCase();var keys=Object.keys(headers);for(var i=0;i<keys.length;i++)if(String(keys[i]).toLowerCase()===name)return String(headers[keys[i]]||'');return '';}
async function sitePrepareImageDomains(value){
 if(!siteConfig)return;
 var samples=Object.create(null),visited=0;
 function visit(v,depth){
  if(depth>8||!v||typeof v!=='object'||visited++>1200)return;
  if(Array.isArray(v)){for(var i=0;i<Math.min(v.length,300);i++)visit(v[i],depth+1);return;}
  var path=String(siteGet(v,['imagePath','coverPath','vodPic','vod_pic'])||''),group=String(v.imageGroup||'');
  if(path.charAt(0)==='/'&&path.slice(0,2)!=='//'&&path.length<2048&&group&&!samples[group])samples[group]=path;
  Object.keys(v).slice(0,48).forEach(function(key){visit(v[key],depth+1);});
 }
 visit(value,0);
 await Promise.all(Object.keys(samples).map(async function(groupID){
  var cached=siteImageDomains[groupID],cacheAge=cached&&cached.domain?1800000:60000;
  if(cached&&Date.now()-cached.time<cacheAge)return;
  var active=siteImageDomainFlights[groupID];if(active){try{await active;}catch(_){}return;}
  var flight=(async function(){
   var group=siteArray(siteConfig.groups).find(function(row){return String(row.id)===groupID;}),mirrors=siteArray(group&&group.url).map(function(row){return siteSafeURL(String(row&&row.domain||''));}).filter(Boolean).slice(0,9),selected='';
   for(var offset=0;offset<mirrors.length&&!selected;offset+=3){
    var probes=await Promise.all(mirrors.slice(offset,offset+3).map(async function(mirror){
     try{var base=mirror;while(base.charAt(base.length-1)==='/')base=base.slice(0,-1);var result=await Widget.http.get(base+samples[groupID],{buffer:1,timeout:3000,headers:{Referer:Source.origin+'/',Accept:'image/*'}}),status=Number(result.statusCode||result.status||0),headers=result.headers||{},contentType=siteHeaderValue(headers,'content-type').toLowerCase();return status>=200&&status<300&&contentType.indexOf('image/')===0&&siteHeaderValue(headers,'encrypted')!=='1'?mirror:'';}catch(_){return '';}
    }));
    selected=probes.find(function(mirror){return !!mirror;})||'';
   }
   siteImageDomains[groupID]={domain:selected,time:Date.now()};
  })();
  siteImageDomainFlights[groupID]=flight;
  try{await flight;}catch(_){siteImageDomains[groupID]={domain:'',time:Date.now()};}
  finally{if(siteImageDomainFlights[groupID]===flight)delete siteImageDomainFlights[groupID];}
 }));
}

var SiteAdapter=function(){this.key='cctvhost.signed.'+Source.id;};
SiteAdapter.prototype.storageGet=async function(key){try{var v=await Widget.storage.get(this.key+'.'+key);if(typeof v==='string')return JSON.parse(v);return v||null;}catch(_){return null;}};
SiteAdapter.prototype.storageSet=async function(key,value){try{await Widget.storage.set(this.key+'.'+key,JSON.stringify(value));}catch(_){}};
SiteAdapter.prototype.deviceInfo=async function(){if(siteDevice)return siteDevice;siteDevice=await this.storageGet('device');if(!siteDevice||!siteDevice.id||!siteDevice.created){siteDevice={id:siteRandom(),created:Date.now()};await this.storageSet('device',siteDevice);}return siteDevice;};
SiteAdapter.prototype.decode=function(response){
 var C=SiteCrypto(),body=response&&response.data;if(body&&typeof body==='object'&&!ArrayBuffer.isView(body))return body;
 var text=typeof body==='string'?body:'';if(!text&&response&&response.bodyBase64)text=response.bodyBase64;
 var raw;try{raw=C.enc.Utf8.stringify(C.enc.Base64.parse(text));}catch(_){raw=text;}
 try{return JSON.parse(raw);}catch(_){}
 var entry=Source.responseKeys&&Source.responseKeys[0];if(!entry)throw Error(Source.name+'返回数据无法识别');
 try{var cipher=C.enc.Base64.parse(text);var clear=C.AES.decrypt({ciphertext:cipher},C.enc.Utf8.parse(entry.key),{iv:C.enc.Utf8.parse(entry.iv),mode:C.mode.CBC,padding:C.pad.Pkcs7}).toString(C.enc.Utf8);return JSON.parse(clear);}catch(_){throw Error(Source.name+'加密响应格式已变化');}
};
SiteAdapter.prototype.build=async function(base,path,params,method){
 var C=SiteCrypto(),dev=await this.deviceInfo(),get=method==='GET',user=siteUser;
 var data=get?Object.assign({os:'webapp',appId:Source.appId,userLevel:String(user&&user.level||0)},params||{}):(params||{});
 var session='appId='+Source.appId+'&deviceCreatedAt='+dev.created+'&deviceId='+dev.id+'&st=2'+(user&&user.id?'&userId='+user.id:'');
 var query=get?Object.keys(data).sort().filter(function(k){return data[k]!==''&&data[k]!=null;}).map(function(k){return k+'='+data[k];}).join('&'):'';
 var signMethod=path==='/config/prod/appInit.html'?method:method.toLowerCase(),ts=String(Date.now()),sig=C.HmacSHA1(signMethod+'|'+path+'|'+query+'|'+ts+'|'+session+'|',Source.signKey).toString(C.enc.Hex);
 var headers={os:'webapp',appId:Source.appId,appVersion:Source.version,package:Source.appId,channelId:'c1',deviceId:dev.id,deviceCreatedAt:String(dev.created),st:'2',ts:ts,sign:sig,Referer:Source.origin+'/'};
 if(!get)headers['Content-Type']='application/json';if(user&&user.id&&user.token){headers.userId=String(user.id);headers['x-token']=String(user.token);}
 var url=base+path;if(get){var parts=[];Object.keys(data).forEach(function(k){if(data[k]!==''&&data[k]!=null)parts.push(encodeURIComponent(k)+'='+encodeURIComponent(String(data[k])));});if(parts.length)url+=(url.indexOf('?')<0?'?':'&')+parts.join('&');}
 if(path==='/user/anonymous'||path==='/user/loginAccount')headers.apiVer='v2';
 return {url:url,method:method,headers:headers,body:get?undefined:JSON.stringify(data)};
};
SiteAdapter.prototype.requestAt=async function(base,path,params,kind,method){
 var req=await this.build(base,path,params,method||'GET'),res=method==='POST'?await Widget.http.post(req.url,req.body,{headers:req.headers}):await Widget.http.get(req.url,{headers:req.headers});
 var status=Number(res.statusCode||res.status||200),data=this.decode(res);
 if(status<200||status>=300)throw Object.assign(Error(data&&data.message||Source.name+'请求失败（HTTP '+status+'）'),{code:Number(data&&data.code)||status});
 if(data&&data.code!=null&&Number(data.code)!==200&&String(data.code)!=='200')throw Object.assign(Error(data.message||Source.name+'拒绝了请求'),{code:data.code});
 return data&&Object.prototype.hasOwnProperty.call(data,'data')?data.data:data;
};
SiteAdapter.prototype.bootstrap=async function(){
 if(siteConfig)return siteConfig;if(siteBootstrap)return siteBootstrap;
 var self=this;siteBootstrap=(async function(){var d=await self.requestAt(Source.origin,'/config/prod/appInit.html',{},'cache','GET');if(!Array.isArray(d&&d.urls&&d.urls.cache)||!Array.isArray(d&&d.urls&&d.urls.logic))throw Error(Source.name+'初始化数据结构已变化');siteConfig=d;return d;})();
 try{return await siteBootstrap;}finally{siteBootstrap=null;}
};
SiteAdapter.prototype.api=async function(path,params,kind,method){
 var config=await this.bootstrap(),bases=[].concat(config.urls[kind||'cache']||[],[Source.origin]).filter(function(x,i,a){return /^https:\/\//.test(x)&&a.indexOf(x)===i;});if(!bases.length)throw Error(Source.name+'没有可用接口');var last;
 for(var i=0;i<Math.min(5,bases.length);i++){try{return await this.requestAt(bases[i],path,params,kind,method||'GET');}catch(e){last=e;if(Number(e.code)===429||[401,403,40401].includes(Number(e.code)))throw e;}}
 throw last||Error(Source.name+'接口暂时不可用');
};
SiteAdapter.prototype.ensureGuest=async function(){if(siteUser&&siteUser.id&&siteUser.token)return siteUser;if(siteGuest)return siteGuest;var self=this;siteGuest=(async function(){var old=await self.storageGet('guest');if(old&&old.id&&old.token){siteUser=old;return old;}var data=await self.api('/user/anonymous',{},'logic','POST'),user=data&&data.user||data;if(!user||!user.id||!user.token)throw Error(Source.name+'没有返回公开访客会话');siteUser=user;await self.storageSet('guest',user);return user;})();try{return await siteGuest;}finally{siteGuest=null;}};
SiteAdapter.prototype.sessionApi=async function(path,params){await this.ensureGuest();return this.api(path,params,'logic','GET');};
SiteAdapter.prototype.home=async function(){return this.api('/v5/vod/home.capi',{},'cache','GET');};
SiteAdapter.prototype.category=async function(p){return this.api('/vod/channel/list.capi',{channelId:Number(p.channelId||1),category:'',sort:'3',area:'',year:'',language:'',next:'page='+sitePage(p.page)},'cache','GET');};
SiteAdapter.prototype.search=async function(p){var q=siteText(p.keyword);if(!q)return {items:[]};if(q.length>100)throw Error('搜索词过长');return this.sessionApi('/vod/search/query',{k:q,type:'title',channelId:0,next:'page='+sitePage(p.page)});};
SiteAdapter.prototype.detail=async function(id){var data=await this.api('/v2/vod/detail.capi',{vodId:id},'cache','GET');if(!data||String(data.id||data.vodId||'')!==String(id))throw Error(Source.name+'详情与所选影片不匹配');return data;};
SiteAdapter.prototype.episodes=async function(id,line){var d=await this.api('/v2/vod/episodes.capi',{vodId:id,siteId:line.siteId,episodeVodId:line.episodeVodId||0},'cache','GET');var list=Array.isArray(d)?d:siteArray(d&& (d.list||d.items||d.episodes||d.episodeList));return list.map(function(ep){return {id:String(siteGet(ep,['id','episodeId','epId','vodEpId','episodeVodId'])||''),title:siteText(siteGet(ep,['title','name','epName','episodeName'])||'选集'),raw:ep};}).filter(function(ep){return siteIdOK(ep.id);});};
SiteAdapter.prototype.play=async function(vodId,line,episode){var data=await this.sessionApi('/vod/episodePlayUrl',{vodId:vodId,siteId:line.siteId,episodeId:episode.id,episodeVodId:line.episodeVodId||0});return data;};
var adapter=new SiteAdapter();

async function loadHome(){var data=await adapter.home();await sitePrepareImageDomains(data);return siteCards(data);}
async function loadCatalog(p){p=p||{};var d=await adapter.category(p);await sitePrepareImageDomains(d);return siteCards(d);}
async function search(p){p=p||{};var data=await adapter.search(p);await sitePrepareImageDomains(data);return siteCards(data);}
async function loadDetail(link){
 link=typeof link==='string'?link:String(link&&link.link||'');var isEp=link.indexOf('/episode?')>=0||link.indexOf('/episode&')>=0,id=siteQueryValue(link,'vodId')||siteQueryValue(link,'id');if(!siteIdOK(id))throw Error('影片链接不属于'+Source.name);
 var d=siteDetails[id]||await adapter.detail(id);await sitePrepareImageDomains(d);var lines=siteArray(d.playSources||d.playerList||d.lines).filter(function(x){return x&&x.needLogin!==true;});if(!lines.length)throw Error('原站未提供访客可用线路');
 var normalized=[];for(var i=0;i<lines.length;i++){var line=lines[i],list=siteArray(line.list||line.epList||line.episodes).map(function(ep){return {id:String(siteGet(ep,['id','episodeId','epId','vodEpId','episodeVodId'])||''),title:siteText(siteGet(ep,['title','name','epName','episodeName'])||'选集'),raw:ep};}).filter(function(ep){return siteIdOK(ep.id);});if(!list.length)list=await adapter.episodes(id,line);normalized.push({line:line,list:list});}
 siteDetails[id]={detail:d,lines:normalized};var firstLine=normalized.find(function(x){return x.list.length;});if(!firstLine)throw Error('原站没有返回可选分集');
 var requested=isEp?siteQueryValue(link,'episodeId'):'';if(requested){var match=normalized.find(function(x){return x.list.some(function(ep){return ep.id===requested;});});if(match)firstLine=match;}
 var card=siteCard({id:id,title:d.title||d.vodName||d.name,imageURL:d.imageURL||d.coverImg,imagePath:d.imagePath,imageGroup:d.imageGroup,channelId:d.channelId,summary:d.summary||d.intro,bottomLabel:d.bottomLabel||d.updateRemark});if(!card)throw Error('影片详情缺少标题或标识');
 card.description=siteText(d.summary||d.intro||d.description||'');card.releaseDate=String(d.year||'');card.episodeItems=firstLine.list.map(function(ep){var epLink=siteLink('episode',{vodId:id,siteId:firstLine.line.siteId,episodeId:ep.id});var children=normalized.map(function(other){var found=other.list.find(function(x){return x.id===ep.id||x.title===ep.title;});if(!found)return null;return {id:siteLink('episode',{vodId:id,siteId:other.line.siteId,episodeId:found.id}),type:'url',link:siteLink('episode',{vodId:id,siteId:other.line.siteId,episodeId:found.id}),title:String(other.line.name||other.line.siteId)+' · '+found.title};}).filter(Boolean);return {id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:card.coverUrl,childItems:children};});return card;
}
async function loadResource(p){
 p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||''),vodId=siteQueryValue(link,'vodId'),siteId=siteQueryValue(link,'siteId'),episodeId=siteQueryValue(link,'episodeId');if(!siteIdOK(vodId)||!siteIdOK(episodeId)||!siteId)throw Error('请选择'+Source.name+'中的影片分集');
 var data=siteDetails[vodId]||await adapter.detail(vodId),rawLines=siteArray(data.detail?data.detail.playSources||data.detail.playerList:data.playSources||data.playerList),lines=data.lines||[];if(!lines.length){for(var i=0;i<rawLines.length;i++){var one=rawLines[i];if(one.needLogin===true||one.canPlay===false)continue;var eps=siteArray(one.list||one.epList||one.episodes).map(function(ep){return {id:String(siteGet(ep,['id','episodeId','epId','vodEpId','episodeVodId'])||''),title:siteText(siteGet(ep,['title','name','epName','episodeName'])||'选集'),raw:ep};}).filter(function(ep){return siteIdOK(ep.id);});if(!eps.length)eps=await adapter.episodes(vodId,one);lines.push({line:one,list:eps});}siteDetails[vodId]={detail:data.detail||data,lines:lines};}
 var chosen=lines.find(function(x){return String((x.line||x).siteId)===siteId;});if(!chosen)throw Error('所选线路不属于此影片');var ep=chosen.list.find(function(x){return String(x.id)===episodeId;});if(!ep)throw Error('所选分集不属于此影片线路');
 var candidates=[chosen];lines.forEach(function(x){if(x===chosen)return;var other=x.list.find(function(y){return y.title===ep.title;});if(other)candidates.push({line:x.line||x,list:[other]});});var errors=[];
 for(var c=0;c<Math.min(3,candidates.length);c++){var item=candidates[c],line=item.line||item,selected=item===chosen?ep:item.list[0];if(line.needLogin===true||line.canPlay===false)continue;try{var result=await adapter.play(vodId,line,selected),rows=Array.isArray(result)?result:siteArray(result&& (result.playUrls||result.urls));if(!rows.length){var url=siteSafeURL(siteGet(result,['url','playUrl','play_url']));if(url)rows=[{url:url,name:line.name||'原站线路',headers:result.headers||result.header||{}}];}
   var out=rows.map(function(row){var url=siteSafeURL(row.url||row.playUrl);if(!url)return null;var headers=siteHeaders(row.customHeaders||row.headers||row.header);if(row.referrerPolicy!=='no-referrer'&&!headers.Referer&&!headers.referer)headers.Referer=Source.origin+'/';return {name:String(row.name||line.name||'原站线路'),url:url,playerType:'app',customHeaders:headers};}).filter(Boolean);if(out.length)return out;
   throw Error(result&&result.message||'原站没有返回可播放的HTTPS地址');
  }catch(e){if(Number(e.code)===401||Number(e.code)===403||Number(e.code)===402)throw e;errors.push(String((item.line||item).name||'线路')+': '+String(e.message||e).slice(0,120));}}
 throw Error(Source.name+'所选集播放失败'+(errors.length?'（'+errors.join('；')+'）':''));
}
