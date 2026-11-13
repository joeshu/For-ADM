/* 番社动漫 CCTVHost 适配器：XBPQ 规则“番社动漫”直译，纯 HTML 抓取，无接口、无签名。
* 站点：规则主页 https://dora.xiaoxinbk.com/（本机返回 JS 验证页，无内容）；
* 分类/详情/分集走 https://www.dora-video.cn（与规则主页不同 host）。
* 实站验证 2026-11-13（本机可达）：分类 /search/sy/?niandai=0&cat=0&tag=0&
* gaojijiansuo=1&zhuangtai=-2 200、146 卡；动画 tag=20 得 85 卡、剧场版 tag=21
* 得 49 卡、剧情 cat=11（七小子）得 2 卡、年代 niandai=2024 得 5 卡。
* 注意规则模板的 cat/tag 与实站相反：实站导航链接证明分类 id 在 tag 里、
* 剧目 id 在 cat 里（动画链接 …?niandai=0&tag=20&cat=0…），niandai=0 与
* zhuangtai=-2 为“全部/默认”。
* 详情 /archives/192/（哆啦A梦新番 897~至今）200；分集页
* /archives/192/?action=get&p=1（第897集）200，iframe 播放器
* https://us-m3u8.urldwz.com/index.php/play/2179.html? 内含直链 m3u8，
* 302 跳转后 200、#EXTM3U 真清单（AES-128 分片）；搜索 GET /?s=关键词
* 302 到 /search/关键词/，200。
* 本站只有哆啦A梦相关内容（小众站），分类无服务器翻页（第 1 页即全部）。 */
var Source={id:'fanshe',name:'番社动漫',origin:'https://www.dora-video.cn'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'番社动漫：哆啦A梦专站（仅哆啦A梦相关内容），分类/详情/分集直链播放。',detailCacheDuration:0,
modules:[
{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
{id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'kind',title:'分类',type:'enumeration',value:'0',enumOptions:[{title:'全部',value:'0'},{title:'动画',value:'20'},{title:'剧场版',value:'21'},{title:'MV',value:'22'},{title:'预告片',value:'23'},{title:'直播',value:'27'},{title:'同人',value:'25'},{title:'民间',value:'26'},{title:'目录',value:'28'},{title:'中篇',value:'30'}]},{name:'genre',title:'剧目',type:'enumeration',value:'0',enumOptions:[{title:'全部',value:'0'},{title:'哆啦A梦新番',value:'1'},{title:'新哆啦A梦 台湾配音',value:'2'},{title:'哆啦A梦剧场版',value:'3'},{title:'最新预告片',value:'6'},{title:'剧场版集合',value:'7'},{title:'哆啦A梦MV',value:'4'},{title:'哆啦A梦七小子集合',value:'11'},{title:'生日特别篇',value:'19'},{title:'哆啦A梦生日特别篇',value:'12'},{title:'哆啦美生日特别篇',value:'14'},{title:'大雄生日特别篇',value:'13'},{title:'静香生日特别篇',value:'15'},{title:'胖虎生日特别篇',value:'16'},{title:'小夫生日特别篇',value:'17'},{title:'24小时直播',value:'24'},{title:'哆啦A梦中篇附映',value:'29'},{title:'哆啦A梦大山版',value:'31'},{title:'哆啦A梦大山修复&补档区',value:'32'},{title:'藤子·F·不二雄',value:'33'}]},{name:'year',title:'年代',type:'input',value:'',description:'如 2024，留空为全部'},{name:'sort',title:'状态',type:'enumeration',value:'-2',enumOptions:[{title:'全部',value:'-2'},{title:'完结',value:'2'},{title:'连载',value:'1'},{title:'待定',value:'-1'},{title:'未分类',value:'0'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
{id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
{id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var SjKinds=[['0','全部'],['20','动画'],['21','剧场版'],['22','MV'],['23','预告片'],['27','直播'],['25','同人'],['26','民间'],['28','目录'],['30','中篇']];
var SjGenres=['0','1','2','3','6','7','4','11','19','12','14','13','15','16','17','24','29','31','32','33'];

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
var CHALLENGE=/请稍候|正在验证|challenge|人机验证|访问验证/i;
function siteAbs(u){
if(!u)return '';
if(/^https?:\/\//i.test(u))return u;
if(u.indexOf('//')===0)return 'https:'+u;
if(u.charAt(0)==='/')return Source.origin+u;
return Source.origin+'/'+u;
}
async function siteGetHtml(url,extraHeaders){
var headers=Object.assign({'User-Agent':UA,'Referer':Source.origin+'/'},extraHeaders||{});
var r=await CCTVHttp.get(url,{headers:headers,timeout:10000});
var html=typeof r.data==='string'?r.data:'';
if(!html)throw Error(Source.name+'返回空页面（该站可能屏蔽了当前网络）');
if(CHALLENGE.test(html))throw Error(Source.name+'返回了验证页（请稍候/人机验证），当前网络无法访问');
return html;
}
/* 卡片（规则“数组”）：<div class="card-img-bili"><a href="/archives/{id}/">
* <img … data-url="封面" alt="片名"></a>。注意搜索结果的 alt 里含高亮
* <font color="red">…</font>，引号在属性值内，alt 用贪婪匹配取到 img 标签结尾。 */
function siteParseCards(html){
var out=[],seen=Object.create(null);
var re=/class="card-img-bili">([\s\S]{0,900}?)<\/a>/g,m;
while((m=re.exec(html))){
var block=m[1];
var href=(block.match(/href="([^"]+)"/)||[])[1]||'';
var idm=href.match(/\/archives\/(\d+)\//);
if(!idm)continue;
var id=idm[1];if(seen[id])continue;seen[id]=1;
var img=(block.match(/data-url="([^"]+)"/)||[])[1]||'';
var title=siteText((block.match(/alt="(.+)"\s*>/)||[])[1]||'');
if(!title)continue;
var link=siteLink('archives',{id:id});
out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(img)),posterPath:siteSafeURL(siteAbs(img)),
description:'',mediaType:'tv',labels:[]});
}
return out;
}
function siteCategoryUrl(kind,genre,year,sort){
/* 实站参数（与规则模板相反，以站内导航链接为准）：tag=分类 id，cat=剧目 id，
* niandai=年代（0 为全部），zhuangtai=状态（-2 为默认）。 */
return Source.origin+'/search/sy/?niandai='+encodeURIComponent(year||'0')+'&cat='+encodeURIComponent(genre||'0')+'&tag='+encodeURIComponent(kind||'0')+'&gaojijiansuo=1&zhuangtai='+encodeURIComponent(sort||'-2');
}
async function loadHome(){
/* 规则主页 dora.xiaoxinbk.com 本机返回 JS 验证页；首页用默认分类列表代替。 */
return siteParseCards(await siteGetHtml(siteCategoryUrl('0','0','','')));
}
async function loadCatalog(p){
p=p||{};var kind=String(p.kind||'0');
if(!SjKinds.some(function(k){return k[0]===kind;}))kind='0';
var genre=String(p.genre||'0');
if(SjGenres.indexOf(genre)<0)genre='0';
var year=String(p.year||'');
if(year&&!/^\d{4}$/.test(year))year='';
var sort=String(p.sort||'');
if(['0','2','1','-1','-2'].indexOf(sort)<0)sort='-2';
var page=sitePage(p.page);
if(page>1)return [];
return siteParseCards(await siteGetHtml(siteCategoryUrl(kind,genre,year,sort)));
}
async function search(p){
p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
var page=sitePage(p.page);
if(page>1)return [];
/* 站内搜索：GET /?s=关键词 302 到 /search/关键词/。 */
return siteParseCards(await siteGetHtml(Source.origin+'/?s='+encodeURIComponent(kw)));
}
async function loadDetail(link){
link=typeof link==='string'?link:String(link&&link.link||'');
var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
var html=await siteGetHtml(Source.origin+'/archives/'+id+'/');
var title=siteText((html.match(/<h3 class="mt-0">([^<]*)<\/h3>/)||[])[1]||'');
if(!title)title=siteText((html.match(/<title>([^<]+)<\/title>/)||[])[1]||'').split(' - ')[0];
if(!title)throw Error(Source.name+'未找到该影片（详情页结构可能已变化）');
var cover='';
var poster=html.match(/<img[^>]+class="card-img-top[^"]*"[^>]+data-url="([^"]+)"/);
if(poster)cover=siteSafeURL(siteAbs(poster[1]));
var desc='';
var dm=html.match(/<h3 class="mt-0">[^<]*<\/h3>\s*<p>[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/);
if(dm)desc=siteText(dm[1]);
var status=siteText((html.match(/状态：([^<]*)</)||[])[1]||'');
var cardLink=siteLink('archives',{id:id});
var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
description:desc,mediaType:'tv',labels:status?[{name:status}]:[]};
/* 分集（规则“播放数组”）：<div class="card-body button-list">
* <a href="/archives/{id}/?action=get&p={N}">第N集</a>…</div> */
var listBlock=(html.match(/class="card-body button-list">([\s\S]*?)<\/div>/)||[])[1]||'';
var eps=[],em;
var epRe=/<a[^>]+href="([^"]*?action=get&p=(\d+))"[^>]*>([^<]*)<\/a>/g;
while((em=epRe.exec(listBlock))){
var epTitle=siteText(em[3])||('第'+em[2]+'集');
eps.push({p:em[2],title:epTitle});
}
card.episodeItems=eps.map(function(ep){
var epLink=siteLink('episode',{id:id,p:ep.p});
return {id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:cover,
childItems:[{id:epLink,type:'url',link:epLink,title:'原站线路 · '+ep.title}]};
});
return card;
}
async function resolveResource(p){
p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
var id=siteQueryValue(link,'id'),ep=siteQueryValue(link,'p');
var epUrl='';
if(/^https?:\/\//i.test(link)&&/action=get/i.test(link))epUrl=link;
else if(siteIdOK(id)&&/^\d+$/.test(ep))epUrl=Source.origin+'/archives/'+id+'/?action=get&p='+ep;
if(!epUrl)throw Error('请选择'+Source.name+'中的影片分集');
var html=await siteGetHtml(epUrl);
var iframe=(html.match(/<iframe[^>]+src="([^"]+)"/)||[])[1]||'';
if(!iframe)throw Error(Source.name+'未找到播放器（分集页结构已变化）');
var playerUrl=siteAbs(iframe);
var playerPage=await siteGetHtml(playerUrl,{'Referer':epUrl});
var m=playerPage.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:[?#][^\s"'<>]*)?/i);
if(!m)throw Error(Source.name+'播放器未返回直链播放地址');
return [{name:'番社线路',url:m[0],playerType:'app',customHeaders:{Referer:playerUrl}}];
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
