/* 快映fox CCTVHost 适配器：MacCMS Appfox JSON 接口，无签名。
 * 配置：https://www.pjb777.top/ky4kbgq7b273.json 只含 apiDomain
 * （2026-11-13 实测返回 {"apiDomain": "https://www.kanzurm65ak.top/"}）。
 * 注意：本机到 apiDomain 一律被挡（HTTPS 空回复 curl 52、HTTP 444、
 * HTTP/2 流重置，换 UA/方法/HTTP1.1 均无效），配置地址本身 200 正常。
 * 因此分类 type_id 未能从 /api.php/appfox/nav 实取，现用 MacCMS 通用
 * 1 电影 / 2 电视剧 / 3 综艺 / 4 动漫，iPhone 上需确认；首页/分类/
 * 搜索/详情/解析均按类字符串所载端点实现，未编造返回值。
 * 播放地址取详情 vod_play_url 原样返回（直链 m3u8/mp4）；若某线路
 * 返回的不是 http(s) 地址，resolveResource 会明确报错。 */
var Source={id:'kuaiying',name:'快映fox',origin:'https://www.kanzurm65ak.top/'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:'快映fox',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'快映fox 公开目录、详情与分集播放（MacCMS Appfox 接口；apiDomain 取自配置地址。注意：API 域名本机无法直连，分类 id 未确认，需 iPhone 实测）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'电视剧',value:'2'},{title:'综艺',value:'3'},{title:'动漫',value:'4'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var KY_CONFIG_URL='https://www.pjb777.top/ky4kbgq7b273.json';
var KY_FALLBACK='https://www.kanzurm65ak.top/';
var KY_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
var kyHostCache='';
function kyText(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();}
function kyIdOK(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));}
function kyPage(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;}
function kySafeURL(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';}
function kyQuery(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}}
function kyLink(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'__cctvhost__/kuaiying/'+kind+'?'+q;}
function kyAbs(u,base){
  if(!u)return '';
  if(/^https?:\/\//i.test(u))return u;
  if(u.indexOf('//')===0)return 'https:'+u;
  var b=base||Source.origin;
  if(u.charAt(0)==='/')return b.replace(/\/$/,'')+u;
  return b+u;
}
async function kyHost(){
  if(kyHostCache)return kyHostCache;
  try{
    var r=await CCTVHttp.get(KY_CONFIG_URL,{headers:{'User-Agent':KY_UA,'Accept':'application/json'},timeout:10000});
    var d=r.data;
    if(typeof d==='string'){try{d=JSON.parse(d);}catch(_){d=null;}}
    var domain=d&&typeof d==='object'?String(d.apiDomain||d.host||''):'' ;
    if(/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/?$/i.test(domain)){
      kyHostCache=domain.replace(/\/?$/,'')+'/';
      return kyHostCache;
    }
  }catch(_){}
  kyHostCache=KY_FALLBACK;
  return kyHostCache;
}
async function kyGet(path){
  var host=await kyHost();
  var r=await CCTVHttp.get(host+path,{headers:{'User-Agent':KY_UA,'Accept':'application/json, text/plain, */*'},timeout:15000});
  var status=r.statusCode||r.status;
  if(status&&status!==200)throw new Error('快映fox接口暂不可用（HTTP '+status+'）');
  var d=r.data;
  if(typeof d==='string'){try{d=JSON.parse(d);}catch(_){throw new Error('快映fox返回了无效数据');}}
  if(!d||typeof d!=='object')throw new Error('快映fox返回了无效数据');
  if(d.code!==undefined&&Number(d.code)!==1)throw new Error('快映fox接口返回异常：'+kyText(d.msg||d.message||''));
  return d.data!==undefined?d.data:d;
}
function kyCard(item){
  if(!item||item.vod_id==null||!item.vod_name)return null;
  var id=String(item.vod_id);
  var link=kyLink('vod',{id:id});
  var labels=[];
  if(item.vod_remarks)labels.push({name:kyText(item.vod_remarks)});
  if(item.vod_year)labels.push({name:String(item.vod_year)});
  if(item.vod_score!=null&&String(item.vod_score)!==''&&String(item.vod_score)!=='0.0')labels.push({name:'评分 '+item.vod_score});
  return {id:link,type:'url',link:link,title:kyText(item.vod_name),
    coverUrl:kySafeURL(kyAbs(item.vod_pic)),posterPath:kySafeURL(kyAbs(item.vod_pic)),
    description:kyText(item.vod_blurb||item.vod_content||item.vod_remarks||''),
    mediaType:'',labels:labels};
}
function kyCards(data){
  var list=Array.isArray(data)?data:(data&&Array.isArray(data.list)?data.list:[]);
  return list.map(kyCard).filter(Boolean);
}
async function loadHome(){
  try{
    var init=await kyGet('api.php/Appfox/init');
    var arr=null;
    if(init&&typeof init==='object'){
      arr=init.home||init.homeVideo||init.recommend_list||init.list||init.videos||null;
      if(arr&&!Array.isArray(arr))arr=null;
    }
    if(arr&&arr.length)return kyCards(arr).slice(0,60);
  }catch(_){}
  return kyCards(await kyGet('api.php/Appfox/vod?ac=videolist&t=1&pg=1')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=kyPage(p.page);
  if(['1','2','3','4'].indexOf(cid)<0)cid='1';
  return kyCards(await kyGet('api.php/Appfox/vod?ac=videolist&t='+cid+'&pg='+page+'&area=&class=&from=&lang=&sort=&year=')).slice(0,60);
}
async function search(p){
  p=p||{};var kw=kyText(p.keyword);if(!kw)return [];
  var data=await kyGet('api.php/Appfox/vod?ac=detail&wd='+encodeURIComponent(kw));
  if(data&&typeof data==='object'&&!Array.isArray(data)&&data.vod_id!=null)return kyCards([data]);
  return kyCards(data).slice(0,60);
}
function kyPlayGroups(info){
  var froms=String(info.vod_play_from||'').split('$$$');
  var urls=String(info.vod_play_url||'').split('$$$');
  var groups=[];
  for(var i=0;i<urls.length;i++){
    var lineName=kyText(froms[i]||'')||('线路'+(i+1));
    var eps=[];
    urls[i].split('#').forEach(function(part){
      var cut=part.indexOf('$');
      if(cut<0)return;
      var title=kyText(part.slice(0,cut))||'正片';
      var url=part.slice(cut+1).trim();
      if(url)eps.push({title:title,url:url});
    });
    if(eps.length)groups.push({name:lineName,episodes:eps});
  }
  return groups;
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=kyQuery(link,'id');if(!kyIdOK(id))throw Error('影片链接不属于快映fox');
  var data=await kyGet('api.php/Appfox/vod?ac=detail&ids='+encodeURIComponent(id));
  var info=Array.isArray(data)?data[0]:(data&&Array.isArray(data.list)?data.list[0]:data);
  if(!info||info.vod_id==null)throw Error('快映fox未找到该影片');
  var card=kyCard(info);
  if(!card)throw Error('快映fox影片数据不完整');
  card.description=[kyText(info.vod_content||info.vod_blurb||''),info.vod_area?kyText(info.vod_area):'',info.vod_year?String(info.vod_year):'',info.vod_actor?('主演 '+kyText(info.vod_actor)):'' ].filter(Boolean).join(' · ')||card.description;
  var groups=kyPlayGroups(info);
  if(!groups.length)throw Error('该影片暂无播放线路');
  card.episodeItems=[];
  groups.forEach(function(group){
    group.episodes.forEach(function(ep,idx){
      var epLink=kyLink('episode',{vodId:String(info.vod_id),line:group.name,ep:ep.title,idx:String(idx)});
      var children=groups.map(function(g){
        var found=null;
        g.episodes.forEach(function(x){if(x.title===ep.title&&!found)found=x;});
        if(!found)return null;
        return {id:kyLink('episode',{vodId:String(info.vod_id),line:g.name,ep:ep.title,idx:String(g.episodes.indexOf(found))}),type:'url',link:kyLink('episode',{vodId:String(info.vod_id),line:g.name,ep:ep.title,idx:String(g.episodes.indexOf(found))}),title:g.name+' · '+ep.title};
      }).filter(Boolean);
      card.episodeItems.push({id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:card.coverUrl,
        childItems:children.length?children:[{id:epLink,type:'url',link:epLink,title:group.name+' · '+ep.title}]});
    });
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vodId=kyQuery(link,'vodId'),line=kyQuery(link,'line'),ep=kyQuery(link,'ep');
  if(!kyIdOK(vodId)||!line||!ep)throw Error('请选择快映fox中的影片分集');
  var data=await kyGet('api.php/Appfox/vod?ac=detail&ids='+encodeURIComponent(vodId));
  var info=Array.isArray(data)?data[0]:(data&&Array.isArray(data.list)?data.list[0]:data);
  if(!info)throw Error('快映fox未找到该影片');
  var groups=kyPlayGroups(info),target=null,targetLine='';
  groups.forEach(function(g){
    if(g.name!==line)return;
    g.episodes.forEach(function(x){if(x.title===ep&&!target){target=x;targetLine=g.name;}});
  });
  if(!target)throw Error('未找到所选线路的分集，请重新进入详情');
  var url=String(target.url||'');
  if(!/^https?:\/\//i.test(url))throw Error('该线路需要站内解析，暂不支持直连播放');
  var host=await kyHost();
  return [{name:targetLine+' · '+ep,url:url,playerType:'app',customHeaders:{Referer:host}}];
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
