/* 巴士动漫 CCTVHost 适配器：dmbus.cc 动漫目录/详情 + hhplayer 解析播放。
 * 协议来自 TVBoxOSC spider.jar 的 AnimeBashi 类方法级反编译（androguard，
 * playerContent/detailContent/categoryContent/searchContent/homeContent/b），
 * 并经本机实站验证 2026-11-13：
 * - 首页/分类/搜索均为 HTML 抓取：ul.v_list li div.item（a.cover 的 data-bg、
 *   a.title 的 href/title、span.desc）；分类 1 国漫 / 2 日漫 / 3 欧美动漫 /
 *   4 动漫电影，地址 /list-{tid}-{page}.html；搜索 /s----------.html?wd=；
 * - 详情 /v/{id}.html：h1.v_title a、div.cover img、p.v_desc span.desc、
 *   div#intro p（剧情/导演/主演）、div#play_list ul.play_list（每 ul 一条线，
 *   li 倒序排列，分集 /p/{id}-{line}-{n}.html）；
 * - 播放关键结论（反编译 playerContent）：key/t 不在客户端推导，而是从播放页
 *   iframe（https://hhjx.hhplayer.com/?url=…）的页面正文里用正则
 *   "url"/"t"/"key" 直接取到，再 POST 到 /api/parse。t 是服务端签发时间戳，
 *   须现取现用：同一组 url/t/key 首次 POST 超时后 9 分钟再试回 403
 *   {"code":403,"msg":"请求校验失败"}，而新鲜取回后立即 POST 则 200。
 * - 实测链（苏东坡与杭州的故事 /v/6139.html 第 1 集）：播放页 iframe 取到
 *   url/t/key → parse 200 {"code":200,"msg":"成功","url":"http://hhjx…
 *   /playlist/….m3u8?expires=…&sign=…"}（30 分钟有效期）→ 该 m3u8
 *   HTTP 200，125,371 字节，application/vnd.apple.mpegurl，含真实 iQiyi .ts
 *   分片；搜索「逆天至尊」得 1 条；列表页 36 条。
 * 注意：只按原类路径取 iframe 页正文里的三个字段，不解码、不执行播放页脚本。 */
var Source={"id":"bashi","name":"巴士动漫","origin":"https://dmbus.cc","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'巴士动漫公开目录、详情与分集播放（dmbus.cc 抓取 + hhplayer 解析）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'2',enumOptions:[{title:'国漫',value:'1'},{title:'日漫',value:'2'},{title:'欧美动漫',value:'3'},{title:'动漫电影',value:'4'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索动漫',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
var PARSE_ORIGIN='https://hhjx.hhplayer.com';
var CHALLENGE=/请稍候|正在验证|challenge|人机验证|访问验证|Just a moment/i;
function siteAbs(u){
  if(!u)return '';
  if(/^https?:\/\//i.test(u))return u;
  if(u.indexOf('//')===0)return 'https:'+u;
  if(u.charAt(0)==='/')return Source.origin+u;
  return Source.origin+'/'+u;
}
async function siteGetHtml(url,referer,skipChallenge){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':referer||Source.origin+'/'},timeout:15000});
  var html=typeof r.data==='string'?r.data:'';
  if(!html)throw Error(Source.name+'返回空页面（该站可能屏蔽了当前网络）');
  /* 解析服务 iframe 页是播放器 JS，正文里可能出现 challenge 字样，只对
   * dmbus.cc 站内页做验证页检查，iframe 页跳过。 */
  if(!skipChallenge&&CHALLENGE.test(html))throw Error(Source.name+'返回了验证页，当前网络无法访问');
  return html;
}
/* 列表卡片：<div class="item"><a class="cover" href="/v/{id}.html"
 * data-bg="封面" title="…"><a class="title" href="/v/{id}.html"
 * title="片名">片名</a><span class="desc">第N话</span></div> */
function siteParseItems(html){
  var out=[],seen=Object.create(null);
  var re=/<div class="item">([\s\S]*?)<\/div>/g,m;
  while((m=re.exec(html))){
    var seg=m[1];
    var href=(seg.match(/<a[^>]+class="title"[^>]+href="([^"]+)"/)||seg.match(/<a[^>]+href="([^"]+)"[^>]+class="cover"/)||[])[1]||'';
    var vidm=href.match(/\/v\/(\d+)\.html/);if(!vidm)continue;
    var id=vidm[1];if(seen[id])continue;seen[id]=1;
    var title=siteText((seg.match(/<a[^>]+class="title"[^>]+title="([^"]*)"/)||[])[1]||(seg.match(/<a[^>]+class="title"[^>]*>([^<]*)<\/a>/)||[])[1]||'');
    if(!title)continue;
    var img=(seg.match(/<a[^>]+class="cover"[^>]+data-bg="([^"]*)"/)||[])[1]||'';
    var label=siteText((seg.match(/<span class="desc">([^<]*)<\/span>/)||[])[1]||'');
    var link=siteLink('vod',{id:id});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(img)),posterPath:siteSafeURL(siteAbs(img)),
      description:label,mediaType:'tv',labels:label?[{name:label}]:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseItems(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'2'),page=sitePage(p.page);
  if(['1','2','3','4'].indexOf(cid)<0)cid='2';
  return siteParseItems(await siteGetHtml(Source.origin+'/list-'+cid+'-'+page+'.html')).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var url=Source.origin+'/s----------.html?wd='+encodeURIComponent(kw);
  try{return siteParseItems(await siteGetHtml(url)).slice(0,60);}
  catch(e){if(sitePage(p.page)>1)return [];throw e;}
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/v/'+id+'.html');
  var title=siteText((html.match(/<h1 class="v_title"><a[^>]*>([^<]*)<\/a>/)||[])[1]||'');
  if(!title)throw Error(Source.name+'未找到该动漫（详情页结构可能已变化）');
  var cover=siteSafeURL(siteAbs((html.match(/<div class="cover">[\s\S]{0,300}?<img[^>]+src="([^"]+)"/)||[])[1]||''));
  var desc=siteText((html.match(/<p class="v_desc"><span class="desc">([\s\S]*?)<\/span>/)||[])[1]||'');
  /* div#intro p：剧情：/导演：/主演：，原类按前缀截取。 */
  var plot='',director='',actor='';
  var intro=html.match(/<div id="intro">([\s\S]*?)<\/div>/);
  if(intro){
    var pm;
    var pre=/<p>([\s\S]*?)<\/p>/g;
    while((pm=pre.exec(intro[1]))){
      var t=siteText(pm[1]);
      if(t.indexOf('剧情：')===0)plot=t.slice(3).trim();
      else if(t.indexOf('导演：')===0)director=t.slice(3).trim();
      else if(t.indexOf('主演：')===0)actor=t.slice(3).trim();
    }
  }
  var full=plot||desc;
  if(director)full=(full?full+'\n':'')+'导演：'+director;
  if(actor)full=(full?full+'\n':'')+'主演：'+actor;
  var cardLink=siteLink('vod',{id:id});
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:full,mediaType:'tv',labels:desc?[{name:desc}]:[]};
  /* div#play_list ul.play_list：每 ul 一条「线路N」，原类把 li 倒序输出。 */
  var listSeg=(html.match(/<div[^>]+id="play_list"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)||[])[1]||html;
  var ulRe=/<ul class="play_list[^"]*">([\s\S]*?)<\/ul>/g,um,lineNo=0;
  var byEp=Object.create(null),order=[];
  while((um=ulRe.exec(listSeg))){
    lineNo++;
    var lineName='线路'+lineNo;
    var liRe=/<li><a href="([^"]+)">([^<]*)<\/a><\/li>/g,lm,eps=[];
    while((lm=liRe.exec(um[1])))eps.push({href:lm[1],title:siteText(lm[2])});
    eps.reverse();
    eps.forEach(function(ep){
      var key=ep.title+'|'+ep.href;
      if(!byEp[key]){byEp[key]={title:ep.title,href:ep.href,lines:[]};order.push(key);}
      byEp[key].lines.push(lineName);
    });
  }
  card.episodeItems=[];
  order.forEach(function(key){
    var row=byEp[key];
    var epLink=siteLink('episode',{play:row.href});
    var children=row.lines.map(function(line){
      return {id:epLink,type:'url',link:epLink,title:line+' · '+row.title};
    });
    card.episodeItems.push({id:epLink,type:'url',link:epLink,title:row.title,coverUrl:cover,
      childItems:children.length?children:[{id:epLink,type:'url',link:epLink,title:'原站线路 · '+row.title}]});
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var play=siteQueryValue(link,'play');
  if(!play&&/^\/p\/\d+-\d+-\d+\.html$/.test(link))play=link;
  if(!play)throw Error('请选择'+Source.name+'中的动漫分集');
  /* 原类 playerContent：播放页 → div.p_box iframe → 取 iframe 页正文里的
   * url/t/key → 立即 POST /api/parse（t 须新鲜，勿缓存、勿复用）。 */
  var playHtml=await siteGetHtml(siteAbs(play));
  var iframe=(playHtml.match(/<div class="p_box">[\s\S]{0,800}?<iframe[^>]+src="([^"]+)"/)||playHtml.match(/<iframe[^>]+src="([^"]+)"/)||[])[1]||'';
  if(!iframe)throw Error(Source.name+'未找到播放器（分集播放页结构已变化）');
  var frameHtml=await siteGetHtml(iframe,Source.origin+'/',true);
  var pUrl=(frameHtml.match(/"url"\s*:\s*"([^"]+)"/)||[])[1]||'';
  var pT=(frameHtml.match(/"t"\s*:\s*(\d+)/)||[])[1]||'';
  var pKey=(frameHtml.match(/"key"\s*:\s*"([^"]+)"/)||[])[1]||'';
  if(!pUrl||!pKey)throw Error(Source.name+'未返回解析参数（解析页结构已变化）');
  var body=JSON.stringify({url:pUrl,t:Number(pT)||0,key:pKey,client_fallback:false});
  var r=await CCTVHttp.post(PARSE_ORIGIN+'/api/parse',body,{headers:{'User-Agent':UA,'Referer':Source.origin+'/','Content-Type':'application/json','Origin':PARSE_ORIGIN},timeout:15000});
  var d=r.data;
  if(typeof d==='string'){try{d=JSON.parse(d);}catch(_){throw Error(Source.name+'解析服务返回了无效数据');}}
  var url=d&&d.url?String(d.url):'';
  if(!url||!/^https?:\/\//i.test(url))throw Error(Source.name+'解析失败'+(d&&d.msg?'：'+d.msg:'（请稍后重试）'));
  /* 原类把 http:// 开头的解析结果改写为 https://。 */
  if(url.indexOf('http://')===0)url='https://'+url.slice(7);
  return [{name:'巴士解析',url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
