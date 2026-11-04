/* Standalone CCTVHost WidgetAdapter for the three signed-app sources. */
var Source={"id":"happ","name":"好好看","origin":"https://a.happ3.com:51111","version":"2.5.24","appId":"hkan","signKey":"a1id2db7ced05pwnc323gezxyb","responseKeys":[{"index":1,"key":"ayt5wy5afwmwrpb19k9s3psx3dymyd0n","iv":"b3t069ijy7pirw0j"}]};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'独立站点适配：原站首页、分类、搜索、详情、分集与公开播放地址。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'剧集',value:'2'},{title:'动漫',value:'3'},{title:'综艺纪录',value:'4'},{title:'Netflix',value:'1000'},{title:'短剧',value:'6'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
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
 if(!image){var path=String(siteGet(row,['imagePath','coverPath','vodPic','vod_pic'])||'');if(path.indexOf('//')===0)image='https:'+path;else if(path.charAt(0)==='/'){var group=siteArray(siteConfig&&siteConfig.groups).find(function(x){return String(x.id)===String(row.imageGroup||'');}),domains=siteArray(group&&group.url).map(function(x){return siteSafeURL(String(x&&x.domain||''));}).filter(Boolean);image=domains.length?domains[0].replace(/\/$/,'')+'/'+path.replace(/^\//,''):Source.origin+path;}else image=siteSafeURL(path);}
 var subtitle=siteText(siteGet(row,['bottomLabel','remark','vod_remarks','scoreText','dynamic'])||'');
 var labels=siteArray(row.labels||row.tags).map(function(x){return siteText(x&&typeof x==='object'?x.name||x.title:x);}).filter(Boolean).slice(0,4);
 return {id:siteLink('vod',{id:id}),type:'url',link:siteLink('vod',{id:id}),title:title,coverUrl:image,posterPath:image,description:subtitle,mediaType:Number(row.channelId)===1?'movie':'tv',labels:labels.map(function(name){return {name:name};})};
};
var siteCards=function(value){var out=[],seen=Object.create(null);function visit(v,depth){if(depth>8||!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(function(x){visit(x,depth+1);});return;}var item=siteCard(v);if(item){var key=item.link;if(!seen[key]){seen[key]=true;out.push(item);}return;}['blocks','data','items','list','vods','vodList','recommendList'].forEach(function(k){if(v[k])visit(v[k],depth+1);});}visit(value,0);return out;};
var siteHeaders=function(raw){var out={};if(Array.isArray(raw))raw.forEach(function(x){if(x&&x.name&&x.value)out[String(x.name)]=String(x.value);});else if(raw&&typeof raw==='object')Object.keys(raw).forEach(function(k){var v=raw[k];if(typeof v==='string'&&/^[A-Za-z][A-Za-z0-9-]*$/.test(k)&&!/host|content-length/i.test(k))out[k]=v;});return out;};

var SiteAdapter=function(){this.key='cctvhost.signed.'+Source.id;};
SiteAdapter.prototype.storageGet=async function(key){try{var v=await CCTVStorage.get(this.key+'.'+key);if(typeof v==='string')return JSON.parse(v);return v||null;}catch(_){return null;}};
SiteAdapter.prototype.storageSet=async function(key,value){try{await CCTVStorage.set(this.key+'.'+key,JSON.stringify(value));}catch(_){}};
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
 var query=get?Object.keys(data).sort().filter(function(k){return data[k]!==''&&data[k]!=null;}).map(function(k){return k+'='+data[k]+'&';}).join(''):'';
 var ts=String(Date.now()),sig=C.HmacSHA1(method+'|'+path+'|'+query+'|'+ts+'|'+session+'|',Source.signKey).toString(C.enc.Hex);
 var headers={os:'webapp',appId:Source.appId,appVersion:Source.version,package:Source.appId,channelId:'c1',deviceId:dev.id,deviceCreatedAt:String(dev.created),st:'2',ts:ts,sign:sig,Referer:Source.origin+'/'};
 if(user&&user.id&&user.token){headers.userId=String(user.id);headers['x-token']=String(user.token);}
 var url=base+path;if(get){var parts=[];Object.keys(data).forEach(function(k){if(data[k]!==''&&data[k]!=null)parts.push(encodeURIComponent(k)+'='+encodeURIComponent(String(data[k])));});if(parts.length)url+=(url.indexOf('?')<0?'?':'&')+parts.join('&');}
 if(path==='/user/anonymous'||path==='/user/loginAccount')headers.apiVer='v2';
 return {url:url,method:method,headers:headers,body:get?undefined:JSON.stringify(data)};
};
SiteAdapter.prototype.requestAt=async function(base,path,params,kind,method){
 var req=await this.build(base,path,params,method||'GET'),res=method==='POST'?await CCTVHttp.post(req.url,req.body,{headers:req.headers}):await CCTVHttp.get(req.url,{headers:req.headers});
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
SiteAdapter.prototype.sessionApi=async function(path,params){await this.ensureGuest();return this.api(path,params,'logic','POST');};
SiteAdapter.prototype.home=async function(){return this.api('/v5/vod/home.capi',{},'cache','GET');};
SiteAdapter.prototype.category=async function(p){return this.api('/vod/channel/list.capi',{channelId:Number(p.channelId||1),category:'',sort:'3',area:'',year:'',language:'',next:'page='+sitePage(p.page)},'cache','GET');};
SiteAdapter.prototype.search=async function(p){var q=siteText(p.keyword);if(!q)return {items:[]};if(q.length>100)throw Error('搜索词过长');return this.sessionApi('/vod/search/query',{k:q,type:'title',channelId:0,next:'page='+sitePage(p.page)});};
SiteAdapter.prototype.detail=async function(id){var data=await this.api('/v2/vod/detail.capi',{vodId:id},'cache','GET');if(!data||String(data.id||data.vodId||'')!==String(id))throw Error(Source.name+'详情与所选影片不匹配');return data;};
SiteAdapter.prototype.episodes=async function(id,line){var d=await this.api('/v2/vod/episodes.capi',{vodId:id,siteId:line.siteId,episodeVodId:line.episodeVodId||0},'cache','GET');var list=Array.isArray(d)?d:siteArray(d&& (d.list||d.items||d.episodes||d.episodeList));return list.map(function(ep){return {id:String(siteGet(ep,['id','episodeId','epId','vodEpId','episodeVodId'])||''),title:siteText(siteGet(ep,['title','name','epName','episodeName'])||'选集'),raw:ep};}).filter(function(ep){return siteIdOK(ep.id);});};
SiteAdapter.prototype.play=async function(vodId,line,episode){var data=await this.sessionApi('/vod/episodePlayUrl',{vodId:vodId,siteId:line.siteId,episodeId:episode.id,episodeVodId:line.episodeVodId||0});return data;};
var adapter=new SiteAdapter();

async function loadHome(){return siteCards(await adapter.home());}
async function loadCatalog(p){p=p||{};var d=await adapter.category(p);return siteCards(d);}
async function search(p){p=p||{};return siteCards(await adapter.search(p));}
async function loadDetail(link){
 link=typeof link==='string'?link:String(link&&link.link||'');var isEp=link.indexOf('/episode?')>=0||link.indexOf('/episode&')>=0,id=siteQueryValue(link,'vodId')||siteQueryValue(link,'id');if(!siteIdOK(id))throw Error('影片链接不属于'+Source.name);
 var d=siteDetails[id]||await adapter.detail(id),lines=siteArray(d.playSources||d.playerList||d.lines).filter(function(x){return x&&x.needLogin!==true;});if(!lines.length)throw Error('原站未提供访客可用线路');
 var normalized=[];for(var i=0;i<lines.length;i++){var line=lines[i],list=siteArray(line.list||line.epList||line.episodes).map(function(ep){return {id:String(siteGet(ep,['id','episodeId','epId','vodEpId','episodeVodId'])||''),title:siteText(siteGet(ep,['title','name','epName','episodeName'])||'选集'),raw:ep};}).filter(function(ep){return siteIdOK(ep.id);});if(!list.length)list=await adapter.episodes(id,line);normalized.push({line:line,list:list});}
 siteDetails[id]={detail:d,lines:normalized};var firstLine=normalized.find(function(x){return x.list.length;});if(!firstLine)throw Error('原站没有返回可选分集');
 var requested=isEp?siteQueryValue(link,'episodeId'):'';if(requested){var match=normalized.find(function(x){return x.list.some(function(ep){return ep.id===requested;});});if(match)firstLine=match;}
 var card=siteCard({id:id,title:d.title||d.vodName||d.name,imageURL:d.imageURL||d.coverImg,imagePath:d.imagePath,imageGroup:d.imageGroup,channelId:d.channelId,summary:d.summary||d.intro,bottomLabel:d.bottomLabel||d.updateRemark});if(!card)throw Error('影片详情缺少标题或标识');
 card.description=siteText(d.summary||d.intro||d.description||'');card.releaseDate=String(d.year||'');card.episodeItems=firstLine.list.map(function(ep){var epLink=siteLink('episode',{vodId:id,siteId:firstLine.line.siteId,episodeId:ep.id});var children=normalized.map(function(other){var found=other.list.find(function(x){return x.id===ep.id||x.title===ep.title;});if(!found)return null;return {id:siteLink('episode',{vodId:id,siteId:other.line.siteId,episodeId:found.id}),type:'url',link:siteLink('episode',{vodId:id,siteId:other.line.siteId,episodeId:found.id}),title:String(other.line.name||other.line.siteId)+' · '+found.title};}).filter(Boolean);return {id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:card.coverUrl,childItems:children};});return card;
}
async function resolveResource(p){
 p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||''),vodId=siteQueryValue(link,'vodId'),siteId=siteQueryValue(link,'siteId'),episodeId=siteQueryValue(link,'episodeId');if(!siteIdOK(vodId)||!siteIdOK(episodeId)||!siteId)throw Error('请选择'+Source.name+'中的影片分集');
 var data=siteDetails[vodId]||await adapter.detail(vodId),rawLines=siteArray(data.detail?data.detail.playSources||data.detail.playerList:data.playSources||data.playerList),lines=data.lines||[];if(!lines.length){for(var i=0;i<rawLines.length;i++){var one=rawLines[i];if(one.needLogin===true||one.canPlay===false)continue;var eps=siteArray(one.list||one.epList||one.episodes).map(function(ep){return {id:String(siteGet(ep,['id','episodeId','epId','vodEpId','episodeVodId'])||''),title:siteText(siteGet(ep,['title','name','epName','episodeName'])||'选集'),raw:ep};}).filter(function(ep){return siteIdOK(ep.id);});if(!eps.length)eps=await adapter.episodes(vodId,one);lines.push({line:one,list:eps});}siteDetails[vodId]={detail:data.detail||data,lines:lines};}
 var chosen=lines.find(function(x){return String((x.line||x).siteId)===siteId;});if(!chosen)throw Error('所选线路不属于此影片');var ep=chosen.list.find(function(x){return String(x.id)===episodeId;});if(!ep)throw Error('所选分集不属于此影片线路');
 var candidates=[chosen];lines.forEach(function(x){if(x===chosen)return;var other=x.list.find(function(y){return y.title===ep.title;});if(other)candidates.push({line:x.line||x,list:[other]});});var errors=[];
 for(var c=0;c<Math.min(3,candidates.length);c++){var item=candidates[c],line=item.line||item,selected=item===chosen?ep:item.list[0];if(line.needLogin===true||line.canPlay===false)continue;try{var result=await adapter.play(vodId,line,selected),rows=siteArray(result&& (result.playUrls||result.urls));if(!rows.length){var url=siteSafeURL(siteGet(result,['url','playUrl','play_url']));if(url)rows=[{url:url,name:line.name||'原站线路',headers:result.headers||result.header||{}}];}
   var out=rows.map(function(row){var url=siteSafeURL(row.url||row.playUrl);if(!url)return null;return {name:String(row.name||line.name||'原站线路'),url:url,playerType:'app',customHeaders:siteHeaders(row.customHeaders||row.headers||row.header)};}).filter(Boolean);if(out.length)return out;
   throw Error(result&&result.message||'原站没有返回可播放的HTTPS地址');
  }catch(e){if(Number(e.code)===401||Number(e.code)===403||Number(e.code)===402)throw e;errors.push(String((item.line||item).name||'线路')+': '+String(e.message||e).slice(0,120));}}
 throw Error(Source.name+'所选集播放失败'+(errors.length?'（'+errors.join('；')+'）':''));
}

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
