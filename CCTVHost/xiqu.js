// Standalone 戏曲多多 adapter. Public JSON API observed on fly.daoran.tv, 2026-11-13.
// Decompiled from Lcom/github/catvod/spider/AppLY (spider.jar): the 'md5' request header
// is a static constant, not a computed signature; requests are plain POST JSON with no
// per-request signing. The '92315ec6...' player userId is likewise a fixed literal.
// No account credentials.
var Source={id:'xiqu',name:'戏曲多多',origin:'https://fly.daoran.tv'};
var CCTVHostMetadata={id:'joeshu.xiqu',title:'戏曲多多',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'戏曲多多：豫剧、京剧、越剧等 78 个剧种分类、搜索与完整分集播放。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'channelId',title:'剧种',type:'enumeration',value:'yuju',enumOptions:[{title:'枣梆',value:'zaobang'},{title:'豫剧',value:'yuju'},{title:'黄梅戏',value:'hmx'},{title:'越剧',value:'yueju'},{title:'京剧',value:'jingju'},{title:'评剧',value:'pingju'},{title:'曲剧',value:'quju'},{title:'坠子',value:'hnzz'},{title:'秦腔',value:'qinq'},{title:'河北梆子',value:'hbbz'},{title:'潮剧',value:'chaoju'},{title:'粤剧',value:'gddx'},{title:'沪剧',value:'huju'},{title:'二夹弦',value:'ejx'},{title:'昆曲',value:'kunqu'},{title:'河南琴书',value:'hnqs'},{title:'河南大鼓书',value:'hndgs'},{title:'越调',value:'yued'},{title:'采茶戏',value:'caichaxi'},{title:'绍剧',value:'shaojv'},{title:'扬剧',value:'yangju'},{title:'西河大鼓',value:'xhdg'},{title:'北路梆子',value:'blbz'},{title:'广东汉剧',value:'gdhj'},{title:'曲艺晚会',value:'else'},{title:'丝弦',value:'sixian'},{title:'乐腔',value:'lq'},{title:'民族音乐',value:'MZYY'},{title:'楚剧',value:'chuju'},{title:'蒲剧',value:'pujv'},{title:'戏曲',value:'xq'},{title:'高甲戏',value:'gaojiaxi'},{title:'眉户',value:'meihu'},{title:'皮影戏',value:'pyx'},{title:'柳琴戏',value:'liuqx'},{title:'正字戏',value:'zzx'},{title:'四平调',value:'spd'},{title:'老年大学',value:'WK'},{title:'滇剧',value:'dianju'},{title:'UGC视频',value:'UGC'},{title:'京东大鼓',value:'jddg'},{title:'锡剧',value:'xiju'},{title:'吕剧',value:'lvjv'},{title:'单弦',value:'danxian'},{title:'莆仙戏',value:'pxx'},{title:'庐剧',value:'luju'},{title:'话剧',value:'huaju'},{title:'上党梆子',value:'SDBZ'},{title:'宛梆',value:'wb'},{title:'琼剧',value:'qiongju'},{title:'花鼓戏',value:'huagx'},{title:'川剧',value:'chuanju'},{title:'彩调',value:'caidiao'},{title:'大平调',value:'dpd'},{title:'汉剧',value:'hj'},{title:'评弹',value:'pingtan'},{title:'梅花大鼓',value:'mhdg'},{title:'山东梆子',value:'gb'},{title:'闽剧',value:'minju'},{title:'晋剧',value:'jinju'},{title:'二人台',value:'ERT'},{title:'赣剧',value:'gj'},{title:'麦田乡韾',value:'mtxy'},{title:'吉剧',value:'jiju'},{title:'湘剧',value:'xj'},{title:'太康道情',value:'tkdq'},{title:'花朝戏',value:'hcx'},{title:'评书',value:'pingshu'},{title:'天津时调',value:'tjsd'},{title:'西秦戏',value:'xqx'},{title:'淮剧',value:'huaiju'},{title:'京韵大鼓',value:'jydg'},{title:'白字戏',value:'bzx'},{title:'四股弦',value:'sgx'},{title:'婺剧',value:'wuju'},{title:'相声',value:'xiang'},{title:'怀梆',value:'hb'},{title:'保定老调',value:'bdld'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索戏曲',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'剧名',type:'input',description:'例如：穆桂英'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'戏曲多多搜索',functionName:'search',params:[{name:'keyword',title:'剧名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var XQ={site:'https://fly.daoran.tv',img:'https://ottphoto.daoran.tv/HD/',
 // Static request header distributed in the app; not an account token.
 md5:'SkvyrWqK9QHTdCT12Rhxunjx+WwMTe9y4KwgeASFDhbYabRSPskR0Q==',ua:'okhttp/3.9.1',
 userId:'92315ec6e58a45ba7f47fd143b3d7956'};
function xqText(s){return String(s==null?'':s).replace(/<[^>]*>/g,'').trim();}
function xqPage(p){var n=Number(p||1);if(!Number.isSafeInteger(n)||n<1||n>500)throw new Error('页码无效');return n;}
function xqCover(img){var s=xqText(img);if(!s)return '';if(/^https?:\/\//.test(s))return s;return XQ.img+s;}
async function xqPost(path,body){
 var r=await CCTVHttp.post(XQ.site+path,JSON.stringify(body),{headers:{'Content-Type':'application/json;charset=utf-8','User-Agent':XQ.ua,'md5':XQ.md5}});
 var s=r.statusCode||r.status,d=r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){throw new Error('戏曲多多返回了无效数据，请稍后重试');}}
 if(s<200||s>=300||!d||d.code!==10000000)throw new Error('戏曲多多接口暂不可用（HTTP '+s+(d&&d.text?'：'+xqText(d.text):'')+'）');
 return d;
}
function xqCard(a){
 if(!a||!a.code||!a.name)throw new Error('戏曲多多片单格式异常');
 var link=XQ.site+'/album/'+a.code;
 return {id:link,type:'url',link:link,title:xqText(a.name),coverUrl:xqCover(a.img),posterPath:xqCover(a.img),
  releaseDate:xqText(a.publishTime),genreTitle:'',description:xqText(a.name)};
}
async function xqList(body){
 var d=await xqPost('/API_ROP/search/album/list',body),pb=d.pb||{};
 if(!Array.isArray(pb.dataList))throw new Error('戏曲多多片单格式异常');
 return {items:pb.dataList.map(xqCard),totalPage:Number(pb.totalPage)||0,totalCount:Number(pb.totalCount)||0};
}
async function loadHome(params){
 var r=await xqList({cur:'1',free:'0',item:'o5',pageSize:'20',sect:[]});
 return r.items;
}
async function loadCatalog(params){
 params=params||{};var sect=String(params.channelId||'yuju');
 var r=await xqList({cur:String(xqPage(params.page)),free:'0',item:'o5',pageSize:'20',sect:sect==='all'?[]:[sect]});
 return r.items;
}
async function search(params){
 params=params||{};var kw=xqText(params.keyword).replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 if(!kw)return [];if(kw.length>200)throw new Error('剧名过长');
 var r=await xqList({cur:String(xqPage(params.page)),free:'0',item:'o5',pageSize:'20',sect:[],keyword:kw});
 return r.items;
}
async function loadDetail(link){
 var m=String(link||'').match(/\/album\/([A-Za-z0-9]+)$/);
 if(!m)throw new Error('请选择戏曲多多组件内的影片');
 var d=await xqPost('/API_ROP/album/res/list',{albumCode:m[1],cur:'1',project:'lyhxcx',pageSize:'2147483647',selectFlag:'0',userId:'yszyz'});
 var album=d.album||{},eps=(d.pb&&Array.isArray(d.pb.dataList))?d.pb.dataList:[];
 var item={id:link,type:'url',link:link,title:xqText(album.name),coverUrl:xqCover(album.img),posterPath:xqCover(album.img),
  releaseDate:xqText(album.publishTime),genreTitle:xqText(album.sect),
  description:[xqText(album.des),xqText(album.artistName),xqText(album.publishTime)].filter(Boolean).join(' · '),
  episodeItems:eps.map(function(e){
   var l=XQ.site+'/res/'+e.code;
   return {id:l,type:'url',link:l,title:xqText(e.name)||'正片',coverUrl:xqCover(album.img),mediaType:'tv'};
  })};
 if(!item.episodeItems.length)throw new Error('该戏曲暂无可选分集');
 return item;
}
async function resolveResource(params){
 params=params||{};var m=String(params.link||params.id||'').match(/\/res\/([A-Za-z0-9]+)$/);
 if(!m)throw new Error('请选择戏曲多多组件内的分集');
 var d=await xqPost('/API_ROP/play/get/playurl',{item:'y9',nodeCode:'001000',project:'lyhxcx',px:'2',resCode:m[1],userId:XQ.userId});
 var url=d.playres&&d.playres.playurl;
 if(!/^https?:\/\//.test(url||''))throw new Error('该分集暂无可播放地址');
 return [{name:'在线播放',url:url}];
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
