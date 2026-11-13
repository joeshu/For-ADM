// 荐片影视 adapter for CCTVHost (joeshu.jianpian).
// Public JSON API observed on api.ztcgi.com, 2026-11-13 (api.ubj83.com is dead).
// - Search: GET /api/v2/search/videoV2?key=<keyword> (the parameter is `key`)
// - List: GET /api/crumb/list?category_id=<1-4>&type=&class=&area=&year=&sort=&page=<n>&pageSize=20
//   (all filter params must be present, even empty, or the server returns 500)
// - Detail: GET /api/video/detailv2?id=<id> (direct m3u8 URLs in source_list_source)
// - Home slides: GET /api/slide/list?pos_id=1|2 (jump_id is the video id)
// - Image host from /api/appAuthConfig (imgDomain static.ztcuc.com, 2026-11-13)
// The video CDN (mv.gzlcl.com) is not reachable from this machine (connection
// fails outright): resolveResource returns the real address the API gave;
// play it on a domestic-IP device.
var Source={id:'jianpian',name:'荐片',origin:'https://api.ztcgi.com'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:'荐片',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'荐片影视：电影/电视剧/动漫/综艺，直连 m3u8 播放地址。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'电视剧',value:'2'},{title:'动漫',value:'3'},{title:'综艺',value:'4'}]},{name:'sort',title:'排序',type:'enumeration',value:'',enumOptions:[{title:'默认',value:''},{title:'最新',value:'update'},{title:'最热',value:'hot'},{title:'评分',value:'rating'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆、凡人修仙传'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'荐片搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var JpApi=Source.origin;
var JpImg='https://static.ztcuc.com';
var JpUA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
var JpKinds={'1':'movie','2':'tv','3':'tv','4':'tv'};
function jpText(s){return String(s==null?'':s).replace(/<[^>]*>/g,'').trim();}
function jpCover(path){if(!path)return '';path=String(path);if(/^https?:\/\//.test(path))return path;if(path.charAt(0)!=='/')path='/'+path;return JpImg+path;}
function jpVodLink(id){return JpApi+'/__cctvhost__/jianpian/vod?id='+encodeURIComponent(String(id));}
function jpEpLink(vodId,line,ep){return JpApi+'/__cctvhost__/jianpian/episode?vodId='+encodeURIComponent(String(vodId))+'&line='+encodeURIComponent(line)+'&ep='+encodeURIComponent(ep);}
function jpPage(p){var n=Number(p||1);if(!Number.isSafeInteger(n)||n<1||n>500)throw new Error('页码无效');return n;}
async function jpGet(path){
 var r=await CCTVHttp.get(JpApi+path,{headers:{Accept:'application/json, text/plain, */*','User-Agent':JpUA}});
 var status=r.statusCode||r.status;
 if(status!==200)throw new Error('荐片接口暂不可用（HTTP '+status+'）');
 var d=r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){throw new Error('荐片返回了无效数据');}}
 if(!d||d.code!==1)throw new Error('荐片接口返回异常：'+jpText(d&&d.msg||''));
 return d.data;
}
function jpCard(item,channelId){
 if(!item||!item.id||!item.title)throw new Error('荐片影片数据不完整');
 var labels=[];
 if(item.mask)labels.push({name:jpText(item.mask)});
 if(item.score!=null&&item.score!=='')labels.push({name:'评分 '+item.score});
 (item.types||[]).forEach(function(t){var name=(t&&typeof t==='object')?t.name:t;if(name)labels.push({name:jpText(name)});});
 (item.years||[]).forEach(function(y){if(y&&y.year)labels.push({name:String(y.year)});});
 return {id:jpVodLink(item.id),type:'url',link:jpVodLink(item.id),title:jpText(item.title),
  coverUrl:jpCover(item.tvimg||item.thumbnail||item.path),posterPath:jpCover(item.tvimg||item.thumbnail||item.path),
  description:jpText(item.description||''),mediaType:channelId?JpKinds[channelId]||'':'',labels:labels};
}
async function loadHome(params){
 var slides=[];
 for(var pos=1;pos<=2;pos++){
  var data=await jpGet('/api/slide/list?pos_id='+pos);
  if(Array.isArray(data))slides=slides.concat(data);
 }
 var seen={},cards=[];
 slides.forEach(function(s){
  if(!s||!s.jump_id||!s.title||seen[s.jump_id])return;seen[s.jump_id]=true;
  cards.push({id:jpVodLink(s.jump_id),type:'url',link:jpVodLink(s.jump_id),title:jpText(s.title),
   coverUrl:jpCover(s.tvimg||s.thumbnail||s.pc_thumbnail),posterPath:jpCover(s.tvimg||s.thumbnail||s.pc_thumbnail),
   description:'',mediaType:'',labels:[{name:'轮播推荐'}]});
 });
 if(!cards.length)throw new Error('荐片首页没有返回推荐');
 return cards;
}
async function loadCatalog(params){
 params=params||{};
 var channelId=String(params.channelId||'1');
 if(!JpKinds[channelId])throw new Error('分类无效');
 var sort=String(params.sort||'');
 if(['','update','hot','rating'].indexOf(sort)<0)throw new Error('排序无效');
 var page=jpPage(params.page);
 var data=await jpGet('/api/crumb/list?category_id='+channelId+'&type=&class=&area=&year=&sort='+sort+'&page='+page+'&pageSize=20');
 if(!Array.isArray(data))throw new Error('荐片分类数据异常');
 return data.map(function(item){return jpCard(item,channelId);});
}
async function search(params){
 params=params||{};
 var keyword=String(params.keyword||'').trim();
 if(!keyword)return [];
 if(keyword.length>200)throw new Error('片名过长');
 var data=await jpGet('/api/v2/search/videoV2?key='+encodeURIComponent(keyword));
 if(!Array.isArray(data))throw new Error('荐片搜索数据异常');
 return data.map(function(item){return jpCard(item,'');});
}
function jpEpKey(name){var m=String(name||'').match(/^第(\d+)集$/);return m?('第'+parseInt(m[1],10)+'集'):jpText(name);}
async function loadDetail(link){
 var m=String(link||'').match(/[?&]id=(\d+)/);
 if(!m)throw new Error('请选择荐片组件内的影片');
 var id=m[1];
 var d=await jpGet('/api/video/detailv2?id='+id);
 if(!d||String(d.id)!==id)throw new Error('影片详情不匹配');
 var item=jpCard({id:d.id,title:d.title,description:d.description,score:d.score,types:d.types,years:d.years,tvimg:d.tvimg,thumbnail:d.thumbnail},'');
 item.description=[jpText(d.description),d.area,d.year?String(d.year):'',d.mask?('更新至 '+d.mask):'',d.score!=null?('评分 '+d.score):''].filter(Boolean).join(' · ');
 var lines=[],seenLine={};
 (d.vip_source_list_source||[]).forEach(function(l){if(l&&l.name&&Array.isArray(l.source_list)&&l.source_list.length&&!seenLine[l.name]){seenLine[l.name]=true;lines.push(l);}});
 (d.source_list_source||[]).forEach(function(l){if(l&&l.name&&Array.isArray(l.source_list)&&l.source_list.length&&!seenLine[l.name]){seenLine[l.name]=true;lines.push(l);}});
 if(!lines.length)throw new Error('该影片暂无播放线路');
 var longest=lines.slice().sort(function(a,b){return b.source_list.length-a.source_list.length;})[0];
 // Union of all lines' episodes (some lines use 第01集, some carry extras
 // like 合集篇 that the longest line lacks). Match by normalized key.
 var epOrder=[],epSeen={};
 function addEp(name){var key=jpEpKey(name);if(!epSeen[key]){epSeen[key]=true;epOrder.push({key:key,name:jpText(name)});}}
 longest.source_list.forEach(function(ep){addEp(ep.source_name||'正片');});
 lines.forEach(function(l){l.source_list.forEach(function(ep){addEp(ep.source_name||'正片');});});
 item.episodeItems=epOrder.map(function(ep){
  var children=[];
  lines.forEach(function(l){
   var found=null;
   l.source_list.forEach(function(x){if(jpEpKey(x.source_name)===ep.key&&!found)found=x;});
   if(found&&found.url)children.push({id:jpEpLink(id,l.name,ep.name),type:'url',link:jpEpLink(id,l.name,ep.name),title:jpText(l.name)+' · '+ep.name});
  });
  return {id:jpEpLink(id,lines[0].name,ep.name),type:'url',link:jpEpLink(id,lines[0].name,ep.name),title:ep.name,coverUrl:item.coverUrl,mediaType:item.mediaType,childItems:children};
 });
 return item;
}
async function resolveResource(params){
 params=params||{};
 var link=String(params.link||params.id||'');
 var m=link.match(/[?&]vodId=(\d+)&line=([^&]*)&ep=([^&]*)/);
 if(!m){
  var v=link.match(/[?&]id=(\d+)/);
  if(!v)throw new Error('请选择荐片组件内的分集');
  var detail=await loadDetail(link);
  var first=detail.episodeItems&&detail.episodeItems[0];
  var child=first&&first.childItems&&first.childItems[0];
  if(!child)throw new Error('该影片暂无可播放的分集');
  m=String(child.link).match(/[?&]vodId=(\d+)&line=([^&]*)&ep=([^&]*)/);
  if(!m)throw new Error('分集链接无效');
 }
 var vodId=m[1],line=decodeURIComponent(m[2]),ep=decodeURIComponent(m[3]);
 var d=await jpGet('/api/video/detailv2?id='+vodId);
 var lines=[],seenLine={};
 (d.vip_source_list_source||[]).forEach(function(l){if(l&&l.name&&!seenLine[l.name]){seenLine[l.name]=true;lines.push(l);}});
 (d.source_list_source||[]).forEach(function(l){if(l&&l.name&&!seenLine[l.name]){seenLine[l.name]=true;lines.push(l);}});
 var target=null,targetLine='';
 lines.forEach(function(l){
  if(jpText(l.name)!==line)return;
  (l.source_list||[]).forEach(function(x){if(jpEpKey(x.source_name)===jpEpKey(ep)&&x.url&&!target){target=x;targetLine=l.name;}});
 });
 if(!target)throw new Error('未找到所选线路的分集，请重新进入详情');
 return [{name:targetLine+' · '+ep,url:String(target.url),playerType:'app',
  customHeaders:{Referer:JpApi+'/'},
  description:'原站返回的直连地址；视频 CDN 在本机无法直连验证，需在国内网络设备上复测。'}];
}

// BEGIN COLLECTION RUNTIME
var CollectionConfig={"description":"荐片影视 · 电影/电视剧/动漫/综艺 · 直连播放地址","poster":"https://joeshu.github.io/yqk-forward-widget/collection-poster.png","guide":"荐片影视：首页为轮播推荐；分类走 /api/crumb/list；详情返回原站全部线路与分集；播放地址为原站直连 m3u8，视频 CDN 在本机无法直连验证。"};
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
