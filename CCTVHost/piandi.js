// Standalone 懂片帝 adapter. Public web protocol observed on dongpian17.com, 2026-11-13.
// Same x-ai-movie signing family as Kanju (HMAC-SHA256, ms timestamp, 32-hex nonce);
// different key and client headers. Uses the site's normal anonymous visitor session.
// No account credentials.
var Source={id:'piandi',name:'懂片帝',origin:'https://dongpian17.com',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.piandi',title:'懂片帝',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'最新片单、分类榜单、搜索、完整分集与直连/官方线路。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'kind',title:'分类',type:'enumeration',value:'all',enumOptions:[{title:'全部',value:'all'},{title:'电影',value:'movie'},{title:'电视剧',value:'series'},{title:'动漫',value:'anime'},{title:'综艺',value:'variety'},{title:'短剧',value:'short_drama'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'懂片帝搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
// Menus are per-content-kind; the CatVod bridge maps category type_id to kind.
var SjKinds=[['all','全部'],['movie','电影'],['series','电视剧'],['anime','动漫'],['variety','综艺'],['short_drama','短剧']];
var PD={site:'https://dongpian17.com',
 // Public request-signing configuration distributed in the site's web bundle;
 // not an account token. Site changes may require updating this configuration.
 signingKey:'8b9a908a05eac640e1ee06f52acaa741bfe4ba9e004eeffdbeb635e532e06666',
 clientName:'movie-search-frontend',clientVersion:'1.0.0',
 buildVersion:'dongpiandi-v2026.10.04.1-episode-resume-efd9a7f2e87e-web',
 protocolVersion:'2026-07-05.library-v2.playback-v1',
 ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'};
function sjBytes(text){var s=unescape(encodeURIComponent(text));return Array.prototype.map.call(s,function(c){return c.charCodeAt(0);});}
function sjSha(bytes){
 var k=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
 var h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],b=bytes.slice(),bits=b.length*8;
 b.push(128);while(b.length%64!==56)b.push(0);for(var i=7;i>=0;i--)b.push(Math.floor(bits/Math.pow(256,i))&255);
 function r(x,n){return (x>>>n)|(x<<(32-n));}
 for(var off=0;off<b.length;off+=64){var w=[];for(i=0;i<16;i++)w[i]=(b[off+i*4]<<24)|(b[off+i*4+1]<<16)|(b[off+i*4+2]<<8)|b[off+i*4+3];
  for(i=16;i<64;i++){var x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(r(x,7)^r(x,18)^(x>>>3))+w[i-7]+(r(y,17)^r(y,19)^(y>>>10)))|0;}
  var a=h.slice();for(i=0;i<64;i++){var t1=(a[7]+(r(a[4],6)^r(a[4],11)^r(a[4],25))+((a[4]&a[5])^(~a[4]&a[6]))+k[i]+w[i])|0,t2=((r(a[0],2)^r(a[0],13)^r(a[0],22))+((a[0]&a[1])^(a[0]&a[2])^(a[1]&a[2])))|0;a=[(t1+t2)|0,a[0],a[1],a[2],(a[3]+t1)|0,a[4],a[5],a[6]];}
  for(i=0;i<8;i++)h[i]=(h[i]+a[i])|0;
 }var out=[];h.forEach(function(x){for(var n=3;n>=0;n--)out.push((x>>>(n*8))&255);});return out;
}
function sjHmac(key,text){var k=sjBytes(key);if(k.length>64)k=sjSha(k);while(k.length<64)k.push(0);return sjSha(k.map(function(x){return x^92;}).concat(sjSha(k.map(function(x){return x^54;}).concat(sjBytes(text))))).map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
var pdMemory={},pdSessionPromise=null;
async function pdGet(k){if(Object.prototype.hasOwnProperty.call(pdMemory,k))return pdMemory[k];try{var v=await CCTVStorage.get('piandi.'+k);if(v)return pdMemory[k]=JSON.parse(v);}catch(e){}return null;}
async function pdSet(k,v){pdMemory[k]=v;try{await CCTVStorage.set('piandi.'+k,JSON.stringify(v));}catch(e){}}
function pdNonce(){return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g,function(){return (Math.random()*16|0).toString(16);});}
function pdUuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});}
function pdText(s){return String(s==null?'':s).replace(/<[^>]*>/g,'').trim();}
function pdPage(p){var n=Number(p||1);if(!Number.isSafeInteger(n)||n<1||n>500)throw new Error('页码无效');return n;}
function pdData(r){
 var s=r.statusCode||r.status,d=r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){throw new Error('懂片帝返回了无效数据，请稍后重试');}}
 if(s<200||s>=300||!d||d.error){var code=d&&(d.error&&d.error.code||d.code)||'',msg=d&&d.error&&d.error.message||('懂片帝接口暂不可用（HTTP '+s+'）');var err=new Error(msg);err.status=Number(s);err.apiCode=code;throw err;}
 return d;
}
async function pdRaw(path,body,cookie){
 var q=path.indexOf('?'),p=q>=0?path.slice(0,q):path,query=q>=0?path.slice(q):'';
 var method=body?'POST':'GET',ts=String(Date.now()),nonce=pdNonce();
 var headers={Accept:'application/json','User-Agent':PD.ua,
  'x-ai-movie-client-name':PD.clientName,'x-ai-movie-client-version':PD.clientVersion,
  'x-ai-movie-build-version':PD.buildVersion,'x-ai-movie-protocol-version':PD.protocolVersion,
  'x-ai-movie-timestamp':ts,'x-ai-movie-nonce':nonce,
  'x-ai-movie-signature':sjHmac(PD.signingKey,method+'\n'+p+query+'\n'+ts+'\n'+nonce)};
 if(cookie)headers.Cookie=cookie;
 if(body)headers['Content-Type']='application/json';
 return body?await CCTVHttp.post(PD.site+path,body,{headers:headers}):await CCTVHttp.get(PD.site+path,{headers:headers});
}
async function pdApi(path,body){return pdData(await pdRaw(path,body,null));}
async function pdSession(){
 if(pdSessionPromise)return pdSessionPromise;
 pdSessionPromise=(async function(){
  var old=await pdGet('session');if(old&&old.cookie&&old.expires>Date.now()+60000)return old;
  var id=await pdGet('visitor');if(!id){id='web_'+pdUuid();await pdSet('visitor',id);}
  var r=await pdRaw('/v1/users/anonymous',JSON.stringify({anonymous_id:id}),null),d=pdData(r),hs=r.headers||{},raw='';
  Object.keys(hs).forEach(function(k){if(k.toLowerCase()==='set-cookie')raw+=String(hs[k])+'\n';});
  var m=raw.match(/ai_movie_session=([^;,\s]+)/g);
  if(!m)throw new Error('未获得懂片帝访客会话，请重新进入组件');
  var last=m[m.length-1].split('=')[1];
  var session={cookie:'ai_movie_session='+last,expires:Date.now()+364*24*3600*1000};
  await pdSet('session',session);return session;
 })();
 try{return await pdSessionPromise;}finally{pdSessionPromise=null;}
}
async function pdResolveLine(ticket,useSession){
 var cookie=null;
 if(useSession){var s=await pdSession();cookie=s.cookie;}
 var r=await pdRaw('/v1/playback/resolve-line?view=compact',JSON.stringify({ticket:ticket}),cookie);
 return pdData(r);
}
function pdCard(c){
 if(!c||!c.title)throw new Error('懂片帝影片数据不完整');
 var id=c.selected_variant_id||c.id;
 var link=Source.origin+'/__cctvhost__/piandi/vod?id='+encodeURIComponent(id);
 var cover=/^https?:\/\//.test(c.poster_url||'')?c.poster_url:'';
 function names(list){return (list||[]).map(function(a){return typeof a==='string'?a:(a&&a.name||'');}).filter(Boolean).join(' / ');}
 return {id:link,type:'url',link:link,title:pdText(c.title),coverUrl:cover,posterPath:cover,
  mediaType:c.content_kind==='movie'?'movie':'tv',releaseDate:c.year?String(c.year):'',
  genreTitle:(c.genres||[]).map(pdText).join(' / '),
  description:[pdText(c.description),c.year,pdText(c.area),pdText(c.remarks)].filter(Boolean).join(' · '),
  actor:names(c.actors),director:names(c.directors)};
}
function pdCards(cards){
 if(!Array.isArray(cards))throw new Error('懂片帝片单格式异常');
 var seen={};return cards.filter(function(c){if(!c||!c.id||seen[c.id])return false;seen[c.id]=true;return true;}).map(pdCard);
}
async function loadHome(params){
 var d=await pdApi('/v1/feed/home?scope=public&mode=preview&sections=3&cards=12');
 if(!Array.isArray(d.sections))throw new Error('懂片帝首页数据异常');
 var cards=[];d.sections.forEach(function(s){if(!Array.isArray(s.cards))throw new Error('推荐片单异常');cards=cards.concat(s.cards);});
 return pdCards(cards);
}
async function loadCatalog(params){
 params=params||{};var kind=String(params.kind||'all');
 if(SjKinds.every(function(k){return k[0]!==kind;}))throw new Error('分类无效');
 var q='/v1/browse/catalog?sort=trending&window=day&page='+pdPage(params.page)+'&limit=20';
 if(kind!=='all')q+='&kind='+encodeURIComponent(kind);
 var d=await pdApi(q);
 return pdCards(d.cards);
}
async function search(params){
 params=params||{};var keyword=String(params.keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 if(!keyword)return [];
 var q='/v1/browse/catalog?q='+encodeURIComponent(keyword)+'&page='+pdPage(params.page)+'&limit=20';
 var d=await pdApi(q);
 // The site occasionally returns a valid 200 with an empty list; retry once.
 if(Array.isArray(d.cards)&&!d.cards.length&&pdPage(params.page)===1)d=await pdApi(q);
 return pdCards(d.cards);
}
function pdVodLink(id){return Source.origin+'/__cctvhost__/piandi/vod?id='+encodeURIComponent(id);}
function pdEpisodeLink(variant,episode,offset){return Source.origin+'/__cctvhost__/piandi/episode?variant='+encodeURIComponent(variant)+'&episode='+encodeURIComponent(episode)+'&offset='+offset;}
function pdParseVod(link){var m=String(link).match(/^https:\/\/dongpian17\.com\/__cctvhost__\/piandi\/vod\?id=(.+)$/);if(!m)throw new Error('请选择懂片帝组件内的影片');return decodeURIComponent(m[1]);}
function pdParseEpisode(link){var m=String(link).match(/^https:\/\/dongpian17\.com\/__cctvhost__\/piandi\/episode\?variant=([^&]+)&episode=([^&]+)&offset=(\d+)$/);if(!m)throw new Error('请选择懂片帝组件内的分集');return {variant:decodeURIComponent(m[1]),episode:decodeURIComponent(m[2]),offset:Number(m[3])};}
async function pdEpisodes(variant,offset){
 var d=await pdApi('/v1/catalog/'+encodeURIComponent(variant)+'/episodes?limit=48&offset='+offset);
 if(!d||d.variant_id!==variant||!Array.isArray(d.episodes)||!d.episode_pagination||typeof d.episode_pagination.has_more!=='boolean')throw new Error('懂片帝分集数据异常');
 return d;
}
async function pdAllEpisodes(variant){
 var offset=0,out=[],seen={};
 for(var pages=0;pages<100;pages++){
  var page=await pdEpisodes(variant,offset);
  page.episodes.forEach(function(e){if(!e||!e.id||!e.token||seen[e.id])return;seen[e.id]=true;out.push({episode:e,offset:offset});});
  if(!page.episode_pagination.has_more)return out;
  if(!page.episodes.length)throw new Error('懂片帝分集分页未推进，请重新进入详情');
  offset+=page.episodes.length;
 }
 throw new Error('懂片帝分集分页超出安全上限，未返回不完整选集');
}
async function loadDetail(link){
 var id=pdParseVod(link);
 var detail=await pdApi('/v1/catalog/'+encodeURIComponent(id));
 if(detail.id!==id&&detail.variant_id!==id)throw new Error('影片详情不匹配');
 var episodes=await pdAllEpisodes(id);
 var item=pdCard(detail);item.link=link;item.id=link;
 item.description=(item.description?item.description+' · ':'')+'共 '+episodes.length+' 集';
 item.episodeItems=episodes.map(function(row){var e=row.episode,l=pdEpisodeLink(id,e.id,row.offset);return {id:l,type:'url',link:l,title:pdText(e.title||('第'+e.number+'集')),coverUrl:item.coverUrl,mediaType:item.mediaType};});
 item.childItems=[];
 (detail.variants||detail.seasons||[]).forEach(function(v){var vid=v.variant_id||v.id;if(vid&&vid!==id&&v.has_playback!==false)item.childItems.push({id:pdVodLink(vid),type:'url',link:pdVodLink(vid),title:pdText(v.title||'其他季'),coverUrl:item.coverUrl});});
 return item;
}
async function resolveResource(params){
 params=params||{};var link=String(params.link||params.id||'');
 var p=pdParseEpisode(link);
 var page=await pdEpisodes(p.variant,p.offset),target=null;
 page.episodes.forEach(function(e){if(e&&e.id===p.episode)target=e;});
 if(!target||!target.token)throw new Error('该影片中未找到所选分集，请重新进入详情');
 var r=await pdApi('/v1/playback/resolve/'+encodeURIComponent(target.token));
 if(!r||!Array.isArray(r.line_options))throw new Error('懂片帝线路数据异常');
 var out=[];
 var officials=r.line_options.filter(function(l){return l&&l.minimum_user_level===0&&typeof l.url==='string'&&l.url.indexOf('resolve://')===0;});
 var directs=r.line_options.filter(function(l){return l&&l.minimum_user_level===0&&typeof l.url==='string'&&/^https?:\/\//.test(l.url);});
 // Official lines first (resolved via the site's own parser); direct m3u8 lines after.
 for(var i=0;i<officials.length;i++){
  var line=officials[i],ticket=line.url.slice('resolve://'.length),resolved;
  try{resolved=await pdResolveLine(ticket,false);}
  catch(e){
   if(e&&e.apiCode==='playback_user_session_required')resolved=await pdResolveLine(ticket,true);
   else throw e;
  }
  var actual=resolved&&resolved.line;
  if(!actual||!/^https?:\/\//.test(actual.url||''))continue;
  out.push({name:pdText(actual.display_label||actual.label||line.display_label||line.label||'官方线路'),url:actual.url,playerType:'app',customHeaders:{},description:'官方线路解析'});
 }
 directs.forEach(function(l){
  out.push({name:pdText(l.display_label||l.label||l.provider_name||'播放线路'),url:l.url,playerType:'app',customHeaders:{},description:'直连线路'});
 });
 if(!out.length)throw new Error('此分集暂无可用线路');
 return out;
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
