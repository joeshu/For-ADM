// Standalone 王子 adapter (AppGet family: custom JSON API, AES-CBC signing).
// Protocol reconstructed from the site's Android client (TVBoxOSC spider.jar,
// Lcom/github/catvod/spider/AppGet + helper Lcom/github/catvod/spider/merge/m/a)
// and verified live against https://app.95112475.xyz on 2026-11-13 (see notes below).
// Signing: app-api-verify-sign = Base64(AES-CBC-PKCS5(key=dataKey, iv=dataIv)
//   .encrypt(String(currentTimeMillis()/1000))); app-api-verify-time = same
//   seconds timestamp. General calls (init/category/search/detail) carry NO
//   sign header — only vodParse does. Responses: outer JSON {"data": base64}
//   -> AES-CBC-PKCS7 decrypt with the same key/iv -> inner JSON.
// Wire quirk that matters: the Java client sends the JSON body with media type
//   application/json (OkHttp BridgeInterceptor overwrites the form-urlencoded
//   Content-Type header the spider sets), so the server only parses the body
//   when Content-Type is application/json. Sending the JSON body as
//   application/x-www-form-urlencoded makes search ignore keywords and detail
//   return vod:null. vodParse is the opposite: form-urlencoded body
//   "parse_api=<parse>&url=<urlencoded base64-AES(url)>&token=<token>".
// Live verified 2026-11-13: init/category/search/detail/resolve all work from this machine;
//   search 仙逆 -> 仙逆 (vod 245), 18 lines; ep1 RY line m3u8 GET 200 #EXTM3U;
//   signed vodParse (line 腾讯4K②) returns a playable m3u8. Needs iPhone retest for
//   final playback (CDN may geo-block) and for lines whose parse proxy rate-limits.
// No account credentials. dataKey/dataIv are per-site public config from the
// TVBox subscription ext, not an account token.
var Source={id:'wangzi',name:'王子',origin:'https://app.95112475.xyz',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.wangzi',title:'王子',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'最新片单、分类榜单、搜索、完整分集与直连/解析线路。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'kind',title:'分类',type:'enumeration',value:'0',enumOptions:[{"title": "全部", "value": "0"},{"title": "电影", "value": "1"},{"title": "电视剧", "value": "2"},{"title": "综艺", "value": "3"},{"title": "动漫", "value": "4"},{"title": "短剧", "value": "5"}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'王子搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var SjKinds=[['0','全部'],['1','电影'],['2','电视剧'],['3','综艺'],['4','动漫'],['5','短剧']];
var AG={host:'https://app.95112475.xyz',dataKey:'5a9w6x58dsq6z3a6',dataIv:'5a9w6x58dsq6z3a6',ua:'okhttp/3.14.9',
 initPath:'/getappapi.index/initV119',searchPath:'/getappapi.index/searchList',catPath:'/getappapi.index/typeFilterVodList?page=',detPath:'/getappapi.index/vodDetail',
 parsePath:'/getappapi.index/vodParse',family:'AppGet'};

// ---- CryptoJS (bundled in CCTVHost) ----
function agCryptoJS(){
 if(typeof CryptoJS!=='undefined'&&CryptoJS&&CryptoJS.AES&&CryptoJS.enc&&CryptoJS.mode&&CryptoJS.pad) return CryptoJS;
 try{var g=(typeof globalThis!=='undefined')?globalThis:null;
  if(g&&typeof g.__cctvImport==='function'){var c=g.__cctvImport('crypto-js');if(c&&c.AES&&c.enc) return c;}}catch(e){}
 throw new Error('本站需要 CryptoJS 运行环境，请更新 CCTVHost 后重试');
}
function agKeyIv(){var C=agCryptoJS();return {key:C.enc.Utf8.parse(AG.dataKey),iv:C.enc.Utf8.parse(AG.dataIv)};}
function agAesEncrypt(plain){
 var C=agCryptoJS(),k=agKeyIv();
 var enc=C.AES.encrypt(C.enc.Utf8.parse(String(plain)),k.key,{iv:k.iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
 return C.enc.Base64.stringify(enc.ciphertext);
}
function agAesDecrypt(b64){
 var C=agCryptoJS(),k=agKeyIv();
 var dec=C.AES.decrypt({ciphertext:C.enc.Base64.parse(String(b64||''))},k.key,{iv:k.iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
 return dec.toString(C.enc.Utf8);
}
function agText(s){return String(s==null?'':s).replace(/<[^>]*>/g,'').trim();}
function agPage(p){var n=Number(p||1);if(!Number.isSafeInteger(n)||n<1||n>500)throw new Error('页码无效');return n;}
function agTs(){return String(Math.floor(Date.now()/1000));}
function agHeaders(sign){
 var ts=agTs(),h={'User-Agent':AG.ua,'Content-Type':'application/json; charset=utf-8',
  'app-user-device-id':'','app-version-code':'','app-api-verify-time':ts,'app-ui-mode':'light'};
 if(sign)h['app-api-verify-sign']=agAesEncrypt(ts);
 return h;
}
function agOuter(r){
 var s=r&&(r.statusCode||r.status),d=r&&r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){d=null;}}
 if(s<200||s>=300||!d||typeof d!=='object')throw new Error(Source.name+'接口暂不可用（HTTP '+s+'）');
 return d;
}
async function agApi(path,bodyObj){
 var r=await CCTVHttp.post(AG.host+'/api.php'+path,JSON.stringify(bodyObj||{}),{headers:agHeaders(false)});
 var outer=agOuter(r);
 if(typeof outer.data!=='string'||!outer.data)throw new Error(Source.name+'返回了无效数据，请稍后重试');
 var inner;
 try{inner=JSON.parse(agAesDecrypt(outer.data));}catch(e){throw new Error(Source.name+'返回了无法解密的数据，请稍后重试');}
 return inner;
}
async function agRaw(path,bodyObj){
 var r=await CCTVHttp.post(AG.host+'/api.php'+path,JSON.stringify(bodyObj||{}),{headers:agHeaders(false)});
 return agOuter(r);
}

function agCard(v){
 if(!v||!v.vod_id||!v.vod_name)throw new Error(Source.name+'影片数据不完整');
 var id=String(v.vod_id),link=Source.origin+'/__cctvhost__/'+Source.id+'/vod?id='+encodeURIComponent(id);
 var cover=/^https?:\/\//.test(v.vod_pic||'')?v.vod_pic:'';
 return {id:link,type:'url',link:link,title:agText(v.vod_name),coverUrl:cover,posterPath:cover,
  mediaType:'tv',releaseDate:v.vod_year?String(v.vod_year):'',genreTitle:agText(v.vod_class),
  description:[agText(v.vod_remarks),agText(v.vod_blurb),agText(v.vod_actor)].filter(Boolean).join(' · '),
  actor:agText(v.vod_actor),director:agText(v.vod_director)};
}
function agCards(list){
 if(!Array.isArray(list))throw new Error(Source.name+'片单格式异常');
 var seen={};return list.filter(function(v){if(!v||!v.vod_id||seen[v.vod_id])return false;seen[v.vod_id]=true;return true;}).map(agCard);
}
async function loadHome(params){
 var d=await agApi(AG.initPath,{});
 var cards=[];
 (d.banner_list||[]).forEach(function(v){cards.push(v);});
 (d.recommend_list||[]).forEach(function(v){cards.push(v);});
 if(cards.length<5){
  try{var c=await agApi(AG.catPath+'1',{type_id:'0',page:'1'});(c.recommend_list||[]).forEach(function(v){cards.push(v);});}catch(e){}
 }
 return agCards(cards);
}
async function loadCatalog(params){
 params=params||{};var kind=String(params.kind||'0');
 if(SjKinds.every(function(k){return k[0]!==kind;}))throw new Error('分类无效');
 var page=agPage(params.page);
 var body={type_id:kind,page:String(page)};
 var ext=params.extend||{};
 if(ext.class||ext.genre)body.class=ext.class||ext.genre;
 if(ext.lang)body.lang=ext.lang;
 if(ext.area)body.area=ext.area;
 if(ext.year)body.year=ext.year;
 if(ext.by||ext.sort)body.sort=ext.by||ext.sort;
 var d=await agApi(AG.catPath+page,body);
 return agCards(d.recommend_list||[]);
}
async function search(params){
 params=params||{};var keyword=String(params.keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 if(!keyword)return [];
 var page=agPage(params.page);
 var body={type_id:0,keywords:keyword,page:page};
 var d=await agApi(AG.searchPath,body);
 return agCards(d.search_list||[]);
}
function agParseVod(link){
 var m=String(link||'').match(/[?&]id=([^&]+)/);
 if(m)return decodeURIComponent(m[1]);
 if(/^\d+$/.test(String(link||'').trim()))return String(link).trim();
 throw new Error('请选择'+Source.name+'组件内的影片');
}
function agEpisodeLink(vod,line,ep,payload,show){
 return Source.origin+'/__cctvhost__/'+Source.id+'/episode?vod='+encodeURIComponent(vod)+'&line='+line+'&ep='+ep+'&ln='+encodeURIComponent(show||'')+'&p='+encodeURIComponent(payload);
}
function agParseEpisode(link){
 var m=String(link||'').match(/[?&]p=([^&]*)/);
 if(!m)throw new Error('请选择'+Source.name+'组件内的分集');
 var q=String(link).match(/[?&]ln=([^&]*)/);
 return {payload:decodeURIComponent(m[1]),show:q?decodeURIComponent(q[1]):''};
}
async function loadDetail(link){
 var id=agParseVod(link);
 var d=await agApi(AG.detPath,{vod_id:id});
 var vod=d.vod||{};
 if(!vod.vod_name)throw new Error(Source.name+'详情数据异常');
 var lines=Array.isArray(d.vod_play_list)?d.vod_play_list:[];
 if(!lines.length)throw new Error(Source.name+'没有返回可选分集');
 var item={id:link,type:'url',link:link,title:agText(vod.vod_name),coverUrl:vod.vod_pic||'',posterPath:vod.vod_pic||'',
  mediaType:vod.type_id===1||vod.type_id==='1'?'movie':'tv',releaseDate:vod.vod_year?String(vod.vod_year):'',
  genreTitle:agText(vod.vod_class),
  description:[agText(vod.vod_content),agText(vod.vod_remarks),vod.vod_year,agText(vod.vod_area)].filter(Boolean).join(' · '),
  actor:agText(vod.vod_actor),director:agText(vod.vod_director)};
 // Lines use different episode namings for the same episode ('01' vs '1' vs
 // '第1集' vs '第01集'). Grouping by raw name interleaves the schemes and
 // scrambles each line's order (e.g. a line's ep '10' sorts under the '10' key
 // introduced by another line). Normalise to the episode number instead.
 var byTitle={},order=[];
 function agEpKey(name,ei){
  var m=String(name||'').match(/第\s*(\d+)\s*集/);
  if(!m)m=String(name||'').match(/(\d+)/);
  if(m)return {key:'n'+Number(m[1]),title:'第'+Number(m[1])+'集'};
  return {key:'s'+String(name||('第'+(ei+1)+'集')),title:String(name||('第'+(ei+1)+'集'))};
 }
 lines.forEach(function(line,li){
  var show=agText((line.player_info&&line.player_info.show)||('线路'+(li+1)));
  var parse=String((line.player_info&&line.player_info.parse)||'');
  (Array.isArray(line.urls)?line.urls:[]).forEach(function(ep,ei){
   var name=agText(ep.name)||('第'+(ei+1)+'集');
   var k=agEpKey(name,ei);
   var pau=String(ep.parse_api_url||''),url=String(ep.url||''),token=String(ep.token||'');
   var payload;
   if(/^https?:\/\//.test(pau))payload=pau;
   else payload='$parse_api='+parse+'&url='+agAesEncrypt(url)+'&token='+token;
   if(!byTitle[k.key]){byTitle[k.key]=[];order.push(k);}
   byTitle[k.key].push({show:show,payload:payload});
  });
 });
 order.sort(function(a,b){
  var an=a.key.charAt(0)==='n',bn=b.key.charAt(0)==='n';
  if(an&&bn)return Number(a.key.slice(1))-Number(b.key.slice(1));
  if(an)return -1;if(bn)return 1;return 0;
 });
 item.episodeItems=order.map(function(k){
  var title=k.title,eps=byTitle[k.key],first=eps[0];
  return {id:agEpisodeLink(id,0,0,first.payload,first.show),type:'url',
   link:agEpisodeLink(id,0,0,first.payload,first.show),title:title,coverUrl:item.coverUrl,mediaType:item.mediaType,
   childItems:eps.map(function(ep){
    return {id:agEpisodeLink(id,0,0,ep.payload,ep.show),type:'url',
     link:agEpisodeLink(id,0,0,ep.payload,ep.show),title:ep.show+' · '+title};
   })};
 });
 item.childItems=[];
 return item;
}
async function agVodParse(parse,encUrl,token){
 var ts=agTs();
 var body='parse_api='+parse+'&url='+encodeURIComponent(encUrl)+'&token='+token;
 var h=agHeaders(true);
 h['Content-Type']='application/x-www-form-urlencoded';
 var r=await CCTVHttp.post(AG.host+'/api.php'+AG.parsePath,body,{headers:h});
 var outer=agOuter(r);
 if(typeof outer.data!=='string'||!outer.data)throw new Error(Source.name+'解析服务未返回数据');
 var inner;
 try{inner=JSON.parse(agAesDecrypt(outer.data));}catch(e){throw new Error(Source.name+'解析结果无法解密，请稍后重试');}
 var url='';
 if(inner&&typeof inner.json==='string'){try{var j=JSON.parse(inner.json);if(j&&typeof j.url==='string')url=j.url;}catch(e){}}
 if(!url&&inner&&typeof inner.url==='string')url=inner.url;
 if(!url){var m=JSON.stringify(inner).match(/"url"\s*:\s*"([^"]+)"/);if(m)url=m[1];}
 return url;
}
async function agGetParse(url){
 var r=await CCTVHttp.get(url,{headers:{'User-Agent':AG.ua}});
 var d=r&&r.data;
 if(d&&typeof d==='object'){
  if(typeof d.url==='string'&&d.url)return d.url;
  if(d.data&&typeof d.data.url==='string')return d.data.url;
 }
 var s=typeof d==='string'?d:String((r&&r.bodyBase64)||'');
 if(!s&&r&&typeof r.data==='string')s=r.data;
 var m=String(s||'').match(/"url"\s*:\s*"([^"]+)"/);
 if(m)return m[1];
 if(/^https?:\/\//.test(String(s||'').trim()))return String(s).trim();
 return '';
}
async function resolveResource(params){
 params=params||{};var link=String(params.link||params.id||'');
 var ep=agParseEpisode(link),payload=ep.payload;
 var url='';
 if(payload.indexOf('$parse_api=')===0){
  var m=payload.match(/^\$parse_api=([^&]*)&url=([^&]*)&token=(.*)$/);
  if(!m)throw new Error(Source.name+'分集地址异常，请重新进入详情');
  url=await agVodParse(m[1],decodeURIComponent(m[2]),m[3]);
 }else if(/^https?:\/\//.test(payload)){
  if(/\.(m3u8|mp4|mkv)(\?|#|$)/i.test(payload))url=payload;
  else url=await agGetParse(payload);
 }
 if(!/^https?:\/\//i.test(url))throw new Error(Source.name+'没有返回可播放的视频地址');
 return [{name:ep.show||'播放线路',url:url,playerType:'app',customHeaders:{},description:'直连线路'}];
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
