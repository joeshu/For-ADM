// Standalone 河马短剧 adapter.
// Protocol reconstructed from the site's Android client (spider.jar:
// ShortHema + merge/J/b + merge/g/a3) and verified live 2026-11-13:
//   host https://freevideo.zqqds.cn (found only in the merge/J/b helper class,
//   which also holds 'hema api code=' — NOT in ShortHema itself).
//   POST /free-video-portal/portal/{1125 home+category, 1131 detail,
//   1139 play (returns empty chapterInfo live — not used), 1803 search}.
//   Body = base64(AES-CBC/PKCS7(compact JSON, key 'dzkjgfyxgshylgzm',
//   iv 'apiupdownedcrypt')); header 'datas' = same encoding of the device
//   fingerprint, 'alg' = 'HG45LKBS', 'x-request-id' = UUID, UA okhttp/4.10.0.
//   Response JSON code 0 + data/datas = base64 AES-CBC (same key/IV) -> JSON.
//   Detail (1131) returns no chapterList: episodes are chapterId..maxChapterId
//   (verified sequential: first 618646059, next 618646060, max 618646120 for a
//   62-episode title) and detail with a chapterId returns that chapter's
//   direct mp4 (mp4720p/m3u8720p, same URL; HEAD 200 video/mp4 7.0MB live).
//   Per-chapter URL hash prefixes differ, so URLs are NOT synthesized:
//   resolveResource re-calls 1131 with the episode's chapterId (1 call/episode).
//   Category pagination is a numeric cursor: pageFlag '' -> page 1 (flag '1'),
//   pageFlag '1' -> page 2 (flag '2'), so page p sends String(p-1).
//   Category = group + its FIRST channel (Java client default); the channel
//   filter UI is not exposed by the generic CatVod bridge.
var Source={id:'hema',name:'河马短剧',origin:'https://freevideo.zqqds.cn',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.hema',title:'河马短剧',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'短剧片库、搜索、完整分集与直连播放地址（AES 加密接口）。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'channelId',title:'分类',type:'enumeration',value:'157',enumOptions:[{"title":"热播","value":"157"},{"title":"新剧","value":"180"},{"title":"漫剧","value":"78"},{"title":"排行榜","value":"14"},{"title":"小说","value":"-117"},{"title":"经典好剧","value":"17"},{"title":"河马杯大赛","value":"182"},{"title":"北京大视听","value":"92"},{"title":"小说","value":"0"}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'河马短剧搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var HM={host:'https://freevideo.zqqds.cn',key:'dzkjgfyxgshylgzm',iv:'apiupdownedcrypt',
  aliUA:'aliplayer(appv=2.7.1&av=7.1.0&av2=7.1.0_46933858&os=android&ov=11&dm=M2012K10C)'};
var HMHomeCache={at:0,data:null};

// ---- AES via the runtime CryptoJS (bundled in CCTVHost) ----
function hmCryptoJS(){
  if(typeof CryptoJS!=='undefined'&&CryptoJS&&CryptoJS.AES&&CryptoJS.enc&&CryptoJS.mode&&CryptoJS.pad) return CryptoJS;
  try{
    var g=(typeof globalThis!=='undefined')?globalThis:null;
    if(g&&typeof g.__cctvImport==='function'){ var c=g.__cctvImport('crypto-js'); if(c&&c.AES&&c.enc) return c; }
  }catch(e){}
  throw new Error('本站需要 CryptoJS 运行环境，请更新 CCTVHost 后重试');
}
function hmEncrypt(obj){
  var C=hmCryptoJS();
  var enc=C.AES.encrypt(C.enc.Utf8.parse(JSON.stringify(obj)),C.enc.Utf8.parse(HM.key),
    {iv:C.enc.Utf8.parse(HM.iv),mode:C.mode.CBC,padding:C.pad.Pkcs7});
  return enc.toString();
}
function hmDecrypt(b64){
  var C=hmCryptoJS();
  var dec=C.AES.decrypt(String(b64),C.enc.Utf8.parse(HM.key),
    {iv:C.enc.Utf8.parse(HM.iv),mode:C.mode.CBC,padding:C.pad.Pkcs7});
  var text=dec.toString(C.enc.Utf8);
  if(!text) throw new Error('河马短剧响应解密失败');
  return JSON.parse(text);
}
function hmUuid(){
  function h(n){ var s=''; for(var i=0;i<n;i++) s+='0123456789abcdef'[Math.floor(Math.random()*16)]; return s; }
  return h(8)+'-'+h(4)+'-4'+h(3)+'-'+h(4)+'-'+h(12);
}
function hmStamp(){
  var d=new Date(),p=function(n){ return (n<10?'0':'')+n; };
  return ''+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}
function hmFingerprint(){
  var u=hmUuid();
  return hmEncrypt({version:'3.6.0',pname:'com.dz.hmjc',channelCode:'HMJC1000001',
    utdidTmp:'A'+hmStamp()+'TVBX',token:'',utdid:'7d2e96f3ed64e228ef1b337de386cdce',
    os:'android',osv:30,brand:'Redmi',model:'M2012K10C',manu:'Xiaomi',userId:'',
    launch:'shortcut',mchid:'HMJC1000001',nchid:'HMJC1000004',
    session1:u,session2:u,startScene:'shortcut',recSwitch:false,
    installTime:Date.now(),p:0});
}
function hmText(v){ return String(v==null?'':v).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim(); }
function hmPage(v){ var p=parseInt(v,10); return isNaN(p)||p<1?1:p; }
async function hmCall(path,body){
  var r=await CCTVHttp.post(HM.host+path,hmEncrypt(body),{headers:{
    'User-Agent':'okhttp/4.10.0','Content-Type':'application/json; charset=utf-8',
    'alg':'HG45LKBS','datas':hmFingerprint(),'x-request-id':hmUuid()},timeout:15000});
  var j=r&&r.data;
  if(!j||typeof j!=='object') throw new Error('河马短剧接口返回异常');
  if(j.code!==0) throw new Error('河马短剧接口异常 code='+j.code+' '+(j.msg||''));
  var enc=j.data||j.datas||'';
  if(!enc) return j;
  return hmDecrypt(enc);
}
async function hmHome(){
  if(HMHomeCache.data&&Date.now()-HMHomeCache.at<600000) return HMHomeCache.data;
  var home=await hmCall('/free-video-portal/portal/1125',
    {recSwitch:false,pageFlag:'',theaterSubscriptSwitch:false});
  HMHomeCache={at:Date.now(),data:home};
  return home;
}
function hmCollect(res){
  var items=[];
  (res.columnData||[]).forEach(function(col){ (col.videoData||[]).forEach(function(it){ items.push(it); }); });
  (res.videoData||[]).forEach(function(it){ items.push(it); });
  return items;
}
function hmCard(it){
  var intro=hmText(it.introduction),tags=[];
  if(it.finishStatusCn) tags.push(it.finishStatusCn);
  if(it.updateNum!=null&&it.updateNum!=='') tags.push('更新至'+it.updateNum+'集');
  if(intro) tags.push(intro.length>60?intro.slice(0,60)+'…':intro);
  return {id:String(it.bookId),link:String(it.bookId),title:hmText(it.bookName),
    coverUrl:String(it.coverWap||''),posterPath:String(it.coverWap||''),mediaType:'tv',
    genreTitle:'河马短剧',description:tags.join(' · '),
    actor:Array.isArray(it.protagonist)?it.protagonist.join(' '):hmText(it.protagonist)};
}
async function loadHome(params){
  var home=await hmHome();
  var items=hmCollect(home);
  if(!items.length) throw new Error('河马短剧首页没有返回影片');
  return items.map(hmCard);
}
async function loadCatalog(params){
  params=params||{};
  var kind=(params.channelId!=null&&params.channelId!=='')?String(params.channelId):'157';
  var page=hmPage(params.page);
  var home=await hmHome();
  var group=null;
  (home.channelGroupData||[]).forEach(function(g){ if(String(g.channelGroupId)===kind) group=g; });
  if(!group) throw new Error('河马短剧分类不存在，请更新适配器');
  var channel=(group.channelData||[])[0];
  if(!channel) throw new Error('河马短剧分类下没有频道');
  var res=await hmCall('/free-video-portal/portal/1125',
    {recSwitch:false,pageFlag:page<=1?'':String(page-1),theaterSubscriptSwitch:false,
     channelGroupId:parseInt(kind,10),channelId:parseInt(channel.channelId,10)});
  var items=hmCollect(res);
  if(!items.length&&page>1) return [];
  if(!items.length) throw new Error('河马短剧分类没有返回影片');
  return items.map(hmCard);
}
async function search(params){
  params=params||{};
  var keyword=hmText(params.keyword);
  if(!keyword) return [];
  var res=await hmCall('/free-video-portal/portal/1803',
    {keyword:keyword,page:hmPage(params.page),size:20,hotWordType:0});
  return (res.searchVos||[]).map(hmCard);
}
async function loadDetail(link){
  var id=String(link||'').split('@')[0].split('$').pop();
  if(!id) throw new Error('河马短剧详情编号无效');
  var res=await hmCall('/free-video-portal/portal/1131',
    {bookId:id,needNextChapter:0,isNeedAlias:'',bookAlias:'',resolutionRate:'1080P'});
  var vi=res.videoInfo||{};
  if(!vi.bookName) throw new Error('河马短剧详情数据异常');
  var first=parseInt(vi.chapterId,10),total=parseInt(vi.updateNum,10);
  if(!first||isNaN(first)) throw new Error('河马短剧没有返回可选分集');
  if(!total||isNaN(total)||total<1){
    var max=parseInt(vi.maxChapterId,10);
    total=(max&&max>=first)?(max-first+1):1;
  }
  if(total>500) total=500;
  var desc=[hmText(vi.introduction),hmText(vi.finishStatusCn)];
  if(vi.updateNum!=null&&vi.updateNum!=='') desc.push('更新至'+vi.updateNum+'集');
  var item={id:id,type:'url',link:id,title:hmText(vi.bookName),
    coverUrl:String(vi.coverWap||''),posterPath:String(vi.coverWap||''),mediaType:'tv',
    releaseDate:'',genreTitle:'河马短剧',description:desc.filter(Boolean).join(' · '),
    actor:Array.isArray(vi.protagonist)?vi.protagonist.join(' '):hmText(vi.protagonist),director:''};
  var eps=[];
  for(var i=1;i<=total;i++){
    var cid=String(first+i-1),epId=id+'@'+cid,epTitle='第'+i+'集';
    eps.push({id:epId,type:'url',link:epId,title:epTitle,coverUrl:item.coverUrl,mediaType:'tv',
      childItems:[{id:epId,type:'url',link:epId,title:'河马 · '+epTitle}]});
  }
  item.episodeItems=eps;
  item.childItems=[];
  return item;
}
function hmFirstHttp(o){
  if(typeof o==='string'&&/^https?:\/\//i.test(o)) return o;
  if(Array.isArray(o)){ for(var i=0;i<o.length;i++){ var v=hmFirstHttp(o[i]); if(v) return v; } }
  else if(o&&typeof o==='object'){
    var keys=['mp4Url','mp4SwitchUrl','mp4720p','m3u8720p'];
    for(var k=0;k<keys.length;k++){ if(o[keys[k]]!=null){ var u=hmFirstHttp(o[keys[k]]); if(u) return u; } }
    for(var key in o){ var w=hmFirstHttp(o[key]); if(w) return w; }
  }
  return '';
}
async function resolveResource(params){
  var link=String((params&&params.link)||'');
  var parts=link.split('@');
  var bookId=parts[0],chapterId=parts[1];
  if(!bookId||!chapterId) throw new Error('河马短剧播放编号无效');
  var res=await hmCall('/free-video-portal/portal/1131',
    {bookId:bookId,chapterId:chapterId,needNextChapter:0,isNeedAlias:'',bookAlias:'',resolutionRate:'1080P'});
  var vi=res.videoInfo||{};
  var url=hmFirstHttp(vi.content||{});
  if(!/^https?:\/\//i.test(url)) throw new Error('河马短剧没有返回可播放的视频地址');
  return [{name:'河马',url:url,playerType:'app',customHeaders:{'User-Agent':HM.aliUA}}];
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
