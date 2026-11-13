/* 1905电影网 CCTVHost 适配器。
 * 站点：https://www.1905.com/（1905电影网，电影/微电影/纪录片/晚会/独家/综艺）。
 * 反编译依据：TVBoxOSC spider.jar Lcom/github/catvod/spider/Web1905; playerContent
 *   nonce = floor(now_ms/1000)，expiretime = nonce+600
 *   uuid = UUID.randomUUID()，playerid = uuid去横线后 substring(5,20)
 *   page = https://www.1905.com/vod/play/<cid>.shtml，冒号→%3A、斜杠→%2F
 *   signature = SHA-1 hex（小写，逐字节补零）of
 *     cid=<cid>&expiretime=<expire>&nonce=<nonce>&page=<pageEnc>&playerid=<playerid>&type=hls&uuid=<uuid>.dde3d61a0411511d
 *   （哈希算法由 Lcom/github/catvod/spider/merge/m/I;.k 确认：MessageDigest "SHA-1"，
 *   不是 MD5；I.a 才是 MD5，playerContent 用的是 I.k。）
 *   play-info：https://profile.m1905.com/mvod/getVideoinfo.php?nonce=&expiretime=&cid=&uuid=&playerid=&page=&type=hls&signature=&callback=
 *   （JSONP，去括号后取 data；清晰度取 uhd>hd>sd；最终地址 = data.quality[q].host + data.sign[q].path + data.path[q].path）
 * 实站验证 2026-11-13（本机）：列表 6 分类全部 200（每页 30 条，含 count/pageNum）、
 *   详情 getVodSidebar 200（series_data 分集正常，如 860362 含 7 集）、搜索页 200
 *   （paly-tab-icon 播放入口仅当结果是本站可播 vod 时出现；搜“仙逆”无可播 vod，
 *   只有 video 新闻片段，搜“特殊交易”得 vod 637987 一条）。
 * 未验证：play-info 本机无法验证——profile.m1905.com 对本机出口 IP
 *   （403 页明示 IP 87.81.226.122，节点 VM-DEN-01）一律 403，
 *   根目录/无参/错签名/正确签名/SHA-1 与 MD5/桌面 UA/http 全部同款 403，
 *   详情为“The access control configuration prevents your request”，
 *   是边缘访问控制（IP/地域），不是签名被拒。签名正确性只能由 iPhone/
 *   国内 IP 实测 getVideoinfo.php 判定：返回 data.sign 即通过。
 * 2026-11-14 应用户要求直接装入订阅，由用户 iPhone 实测播放。 */
var Source={id:'m1905',name:'1905',origin:'https://www.1905.com',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'1905电影网公开片库、详情与分集播放（官方 JSON 接口 + play-info SHA-1 签名）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'',enumOptions:[{title:'电影',value:''},{title:'微电影',value:'922'},{title:'纪录片',value:'927'},{title:'晚会',value:'586'},{title:'独家',value:'178'},{title:'综艺',value:'1024'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Linux; Android 17; PKG110 Build/UKQ1.231108.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.43 Mobile Safari/537.36';
var CHALLENGE=/请稍候|正在验证|challenge|人机验证|访问验证/i;
function siteAbs(u){
  if(!u)return '';
  if(/^https?:\/\//i.test(u))return u;
  if(u.indexOf('//')===0)return 'https:'+u;
  if(u.charAt(0)==='/')return Source.origin+u;
  return Source.origin+'/'+u;
}
async function siteGetRaw(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/','Accept':'application/json, text/plain, */*'},timeout:10000});
  /* CCTVHttp 会把 JSON 字符串预解析为对象；JSONP/HTML 保持字符串。 */
  var body=typeof r.data==='string'?r.data:(r.data!=null?JSON.stringify(r.data):'');
  if(!body)throw Error(Source.name+'返回空页面（该站可能屏蔽了当前网络）');
  if(CHALLENGE.test(body))throw Error(Source.name+'返回了验证页（请稍候/人机验证），当前网络无法访问');
  return body;
}
async function siteGetJson(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/','Accept':'application/json, text/plain, */*'},timeout:10000});
  var data=r.data;
  if(typeof data==='string'){
    try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'返回了非 JSON 数据');}
  }
  if(data==null)throw Error(Source.name+'返回空页面（该站可能屏蔽了当前网络）');
  return data;
}
/* 纯 JS SHA-1（CCTVHost 沙箱无 node 内置模块；与 merge/m/I;.k 一致：SHA-1 摘要逐字节转小写 hex）。 */
function siteSha1(msg){
  function rotl(x,n){return (x<<n)|(x>>>(32-n));}
  var bytes=[],i,c;
  for(i=0;i<msg.length;i++){
    c=msg.charCodeAt(i);
    if(c<128)bytes.push(c);
    else if(c<2048)bytes.push(192|(c>>6),128|(c&63));
    else if(c>=55296&&c<57344){i++;c=65536+((c&1023)<<10)+(msg.charCodeAt(i)&1023);bytes.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));}
    else bytes.push(224|(c>>12),128|((c>>6)&63),128|(c&63));
  }
  var bitLen=bytes.length*8;
  bytes.push(128);
  while(bytes.length%64!==56)bytes.push(0);
  bytes.push(0,0,0,0,(bitLen>>>24)&255,(bitLen>>>16)&255,(bitLen>>>8)&255,bitLen&255);
  var h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;
  for(var off=0;off<bytes.length;off+=64){
    var w=[],t;
    for(t=0;t<16;t++)w[t]=((bytes[off+t*4]<<24)|(bytes[off+t*4+1]<<16)|(bytes[off+t*4+2]<<8)|bytes[off+t*4+3])|0;
    for(t=16;t<80;t++)w[t]=rotl(w[t-3]^w[t-8]^w[t-14]^w[t-16],1);
    var a=h0,b=h1,cc=h2,d=h3,e=h4,f,k,temp;
    for(t=0;t<80;t++){
      if(t<20){f=(b&cc)|((~b)&d);k=0x5A827999;}
      else if(t<40){f=b^cc^d;k=0x6ED9EBA1;}
      else if(t<60){f=(b&cc)|(b&d)|(cc&d);k=0x8F1BBCDC;}
      else{f=b^cc^d;k=0xCA62C1D6;}
      temp=(rotl(a,5)+f+e+k+w[t])|0;e=d;d=cc;cc=rotl(b,30);b=a;a=temp;
    }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+cc)|0;h3=(h3+d)|0;h4=(h4+e)|0;
  }
  function hex(x){return ('00000000'+(x>>>0).toString(16)).slice(-8);}
  return hex(h0)+hex(h1)+hex(h2)+hex(h3)+hex(h4);
}
function siteUuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(ch){
    var r=Math.floor(Math.random()*16);
    return (ch==='x'?r:(r&3|8)).toString(16);
  });
}
function siteCard(id,title,cover,desc){
  var link=siteLink('vod',{id:id});
  return {id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(cover)),posterPath:siteSafeURL(siteAbs(cover)),
    description:desc||'',mediaType:'tv',labels:[]};
}
function siteListCards(list){
  var out=[],seen=Object.create(null);
  (Array.isArray(list)?list:[]).forEach(function(it){
    var id=String(it&&it.contentid||'');
    if(!/^\d+$/.test(id)||seen[id])return;seen[id]=1;
    var title=siteText(it.title);
    if(!title)return;
    out.push(siteCard(id,title,siteText(it.thumb),siteText(it.score)?('评分 '+siteText(it.score)):''));
  });
  return out;
}
var CATIDS=['','922','927','586','178','1024'];
async function loadHome(){
  var j=await siteGetJson(Source.origin+'/m/api/loadpage/vodlist/?o=3&catid=&order=3&page=1');
  return siteListCards(j&&j.list).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId==null?'':p.channelId),page=sitePage(p.page);
  if(CATIDS.indexOf(cid)<0)cid='';
  var j=await siteGetJson(Source.origin+'/m/api/loadpage/vodlist/?o=3&catid='+encodeURIComponent(cid)+'&order=3&page='+page);
  return siteListCards(j&&j.list).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);
  if(!kw)return [];
  var page=sitePage(p.page);
  if(page>1)return [];
  var html=await siteGetRaw(Source.origin+'/search/index-p-type-all-q-'+encodeURIComponent(kw)+'.html');
  /* 仅当结果是本站可播 vod 时，movie_box 内才有 li.paly-tab-icon > a 指向 vod/play/<id>.shtml
   *（与 dex 的 div.movie_box / paly-tab-icon / play/(.*?).sh  selector 一致）；
   * mdb 影片库条目与 video 新闻片段没有该入口，不收。 */
  var out=[],seen=Object.create(null),re=/paly-tab-icon[^>]*>\s*<a[^>]+href="[^"]*vod\/play\/(\d+)\.shtml"/g,m;
  while((m=re.exec(html))){
    var id=m[1];
    if(seen[id])continue;seen[id]=1;
    var block=html.slice(Math.max(0,m.index-4000),m.index);
    var imgs=block.match(/<img[^>]+>/g)||[];
    var title='',cover='';
    for(var i=imgs.length-1;i>=0;i--){
      var alt=(imgs[i].match(/alt="([^"]*)"/)||[])[1];
      var src=(imgs[i].match(/src="([^"]+)"/)||[])[1];
      if(alt&&siteText(alt)){title=siteText(alt);cover=src||'';break;}
    }
    if(!title)title='1905影片 '+id;
    out.push(siteCard(id,title,cover,''));
    if(out.length>=60)break;
  }
  return out;
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');
  if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var j=await siteGetJson(Source.origin+'/api/content/?m=Vod&a=getVodSidebar&id='+id+'&fomat=json');
  if(!j||typeof j!=='object'||Array.isArray(j))throw Error(Source.name+'未找到该影片（详情接口未返回影片数据）');
  var title=siteText(j.title);
  if(!title)throw Error(Source.name+'未找到该影片');
  var cover=siteSafeURL(siteAbs(siteText(j.thumb)));
  var desc=[siteText(j.commendreason),siteText(j.description)].filter(function(s){return s;}).join(' ');
  var labels=[];
  if(siteText(j.direct))labels.push({name:'导演 '+siteText(j.direct)});
  if(siteText(j.starring))labels.push({name:'主演 '+siteText(j.starring)});
  var card=siteCard(id,title,siteText(j.thumb),desc);
  card.labels=labels;
  card.episodeItems=[];
  var eps=[];
  eps.push({title:title,contentid:id});
  var series=(j.info&&Array.isArray(j.info.series_data))?j.info.series_data:[];
  series.forEach(function(s){
    var cid=String(s&&s.contentid||''),t=siteText(s&&s.title);
    if(/^\d+$/.test(cid)&&t&&cid!==id)eps.push({title:t,contentid:cid});
  });
  eps.forEach(function(ep){
    var epLink=siteLink('episode',{cid:ep.contentid});
    card.episodeItems.push({id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:cover,childItems:[{id:epLink,type:'url',link:epLink,title:'1905 · '+ep.title}]});
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var cid=siteQueryValue(link,'cid');
  if(!/^\d+$/.test(cid)){
    var m2=link.match(/vod\/play\/(\d+)\.shtml/);
    cid=m2?m2[1]:'';
  }
  if(!/^\d+$/.test(cid))throw Error('请选择'+Source.name+'中的影片分集');
  var nonce=Math.floor(Date.now()/1000),expire=nonce+600;
  var uuid=siteUuid(),playerid=uuid.replace(/-/g,'').substring(5,20);
  var pageRaw=Source.origin+'/vod/play/'+cid+'.shtml';
  var pageEnc=pageRaw.replace(/:/g,'%3A').replace(/\//g,'%2F');
  var signed='cid='+cid+'&expiretime='+expire+'&nonce='+nonce+'&page='+pageEnc+'&playerid='+playerid+'&type=hls&uuid='+uuid+'.dde3d61a0411511d';
  var sig=siteSha1(signed);
  var url='https://profile.m1905.com/mvod/getVideoinfo.php?nonce='+nonce+'&expiretime='+expire+'&cid='+cid+'&uuid='+uuid+'&playerid='+playerid+'&page='+pageEnc+'&type=hls&signature='+sig+'&callback=';
  var body=await siteGetRaw(url);
  var text=body.trim();
  if(text.charAt(0)==='('&&text.charAt(text.length-1)===')')text=text.slice(1,-1);
  var j;
  try{j=JSON.parse(text);}catch(_){throw Error(Source.name+'播放信息未返回有效数据（签名可能被拒或该站屏蔽了当前网络）');}
  var data=j&&j.data;
  if(!data||typeof data!=='object')throw Error(Source.name+'播放信息未返回有效数据');
  var sign=data.sign||{},quality=data.quality||{},path=data.path||{},q='';
  if(sign.uhd)q='uhd';else if(sign.hd)q='hd';else if(sign.sd)q='sd';
  if(!q)throw Error(Source.name+'未返回可播清晰度');
  var host=quality[q]&&quality[q].host||'',signPath=sign[q]&&sign[q].path||'',dataPath=path[q]&&path[q].path||'';
  var playUrl=host+signPath+dataPath;
  if(!/^https?:\/\//i.test(playUrl))throw Error(Source.name+'未返回可播放地址');
  return [{name:'1905 '+q,url:playUrl,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
