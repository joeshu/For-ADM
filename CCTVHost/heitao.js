/* 黑桃短剧 CCTVHost 适配器：MacCMS 成人短剧站公开目录/详情/分集播放。
 * 站点：https://heitaodj.com（SSR，MacCMS 默认模板 + 自定义年龄确认层）。
 * 18+ 成人站：仅供已确认成年的用户自用；元数据里已注明，播放地址来自
 * 站内公开的 MacCMS 播放器接口（见 resolveResource）。
 * 实站验证 2026-11-12（本机可达）：首页 51 卡、分类 30 卡/页（共 34 页，
 * /index.php/vod/type/id/{1..6}/page/{n}.html）、详情含简介/标签/分集
 * （/index.php/vod/play/id/{vid}/sid/{sid}/nid/{ep}.html，实测仅 sid=1
 * 一条线路）、搜索 /index.php/vod/search.html?wd=（翻页为
 * /index.php/vod/search/page/{n}/wd/{kw}.html）。
 * 播放：分集页本身不含媒体地址，只嵌一个 iframe，指向播放器端点
 * /index.php/vod/player/id/{vid}/nid/{ep}/sid/{sid}.html；该端点返回
 * var player_aaaa={...,"url":"https://play.djqiepian.app/.../index.m3u8",
 * "from":"zym3u8","encrypt":0}。播放器端点要求带年龄确认 Cookie
 * heitao_age_confirmed=1——这是本站的自我声明年龄确认（点"我已年满 18
 * 周岁，继续"后由站内 JS 写入，无身份验证、无登录、无付费、无签名、
 * 无验证码）；不带该 Cookie 只返回年龄确认壳，无播放地址。适配器在
 * 播放器请求里带上该 Cookie，等同于用户在浏览器里点过确认；CCTVHost
 * 内另有自身的 18+ 开关（adultEnabled）做前置确认。
 * 取到的 m3u8 为标准 HLS VOD（AES-128，key.key 可直接取到，AVPlayer
 * 原生支持），分片可直接取到（206）。encrypt!=0 或无 player_aaaa 时
 * 明确报错，不猜地址。 */
var Source={"id":"heitao","name":"黑桃短剧","origin":"https://heitaodj.com","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'黑桃短剧公开目录、详情与分集播放（18+ 成人站；播放地址来自站内 MacCMS 播放器接口，需年龄确认 Cookie）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'现代都市',value:'1'},{title:'古装传奇',value:'2'},{title:'仙侠玄幻',value:'3'},{title:'科幻脑洞',value:'4'},{title:'灵异悬疑',value:'5'},{title:'其他短剧',value:'6'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
var CHALLENGE=/请稍候|正在验证|challenge|人机验证|访问验证/i;
/* 年龄确认 Cookie：站内 JS 在用户点"我已年满 18 周岁，继续"后写入
 * （heitao_age_confirmed=1，Max-Age 180 天）；仅自我声明，无验证。 */
var AGE_COOKIE='heitao_age_confirmed=1';
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
/* MacCMS 列表卡片：<li class="m-item"><a class="thumb" href="/index.php/vod/detail/id/{id}.html"
 * title="片名"><img src="封面"><span class="label">N集</span></a>…<p class="des">子分类</p> */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<li[^>]+class="m-item"[^>]*>([\s\S]*?)<\/li>/g,m;
  while((m=re.exec(html))){
    var block=m[1];
    var href=(block.match(/href="([^"]*\/index\.php\/vod\/detail\/id\/(\d+)\.html)"/)||[])[1];
    var id=(block.match(/\/index\.php\/vod\/detail\/id\/(\d+)\.html/)||[])[1];
    if(!id||seen[id])continue;seen[id]=1;
    var title=siteText((block.match(/<a[^>]+class="thumb"[^>]*title="([^"]*)"/)||[])[1]||(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)||[])[1]||'');
    if(!title)continue;
    var img=(block.match(/<img[^>]+src="([^"]+)"/)||[])[1];
    var label=siteText((block.match(/<span class="label">([^<]*)<\/span>/)||[])[1]||'');
    var des=siteText((block.match(/<p class="des">([^<]*)<\/p>/)||[])[1]||'');
    var link=siteLink('vod',{id:id});
    var desc=[des,label].filter(Boolean).join(' · ');
    out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(img||'')),posterPath:siteSafeURL(siteAbs(img||'')),
      description:desc,mediaType:'tv',labels:des?[{name:des}]:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(['1','2','3','4','5','6'].indexOf(cid)<0)cid='1';
  var url=Source.origin+'/index.php/vod/type/id/'+cid+(page>1?'/page/'+page:'')+'.html';
  return siteParseCards(await siteGetHtml(url)).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  var url=page>1
    ?Source.origin+'/index.php/vod/search/page/'+page+'/wd/'+encodeURIComponent(kw)+'.html'
    :Source.origin+'/index.php/vod/search.html?wd='+encodeURIComponent(kw);
  return siteParseCards(await siteGetHtml(url)).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/index.php/vod/detail/id/'+id+'.html');
  var title=siteText((html.match(/<h1[^>]*class="title"[^>]*>([\s\S]*?)<\/h1>/)||[])[1]||'');
  if(!title){var ogt=html.match(/property="og:title" content="([^"]+)"/);if(ogt)title=siteText(ogt[1].split(' - ')[0]);}
  if(!title)throw Error(Source.name+'未找到该影片（详情页结构可能已变化）');
  var cover='';
  var og=html.match(/property="og:image" content="([^"]+)"/);
  if(og)cover=siteSafeURL(og[1]);
  if(!cover){var poster=html.match(/<img[^>]+alt="[^"]*海报"[^>]+src="([^"]+)"/);if(poster)cover=siteSafeURL(siteAbs(poster[1]));}
  var desc='';
  var dm=html.match(/<p[^>]*class="intro-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  if(dm){desc=siteText(dm[1]).replace(/^简介[：:]/,'');}
  if(!desc){var meta=html.match(/name="description" content="([^"]+)"/);if(meta)desc=siteText(meta[1]);}
  var tags=[];
  var tagRe=/<a[^>]+class="tag-chip"[^>]*>([^<]+)<\/a>/g,tm;
  while((tm=tagRe.exec(html)))if(tags.indexOf(siteText(tm[1]))<0)tags.push(siteText(tm[1]));
  var cardLink=siteLink('vod',{id:id});
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:desc,mediaType:'tv',labels:tags.map(function(name){return {name:name};})};
  /* 分集：MacCMS 标准播放路由 /index.php/vod/play/id/{vid}/sid/{line}/nid/{ep}.html，
   * 按 sid 分线路；实测详情页只有 sid=1 一条线路，线路名取不到时用"线路{sid}"。 */
  var groups=Object.create(null),order=[];
  var epRe=/<a[^>]+href="([^"]*\/index\.php\/vod\/play\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g,em;
  while((em=epRe.exec(html))){
    if(em[2]!==id)continue;
    var epTitle=siteText(em[5])||('第'+em[4]+'集');
    if(epTitle==='立即播放')continue; /* 详情页顶部的"立即播放"按钮也指向 nid=1，不是分集。 */
    var sid=em[3];
    if(!groups[sid]){groups[sid]=[];order.push(sid);}
    groups[sid].push({nid:em[4],title:epTitle});
  }
  card.episodeItems=[];
  order.sort(function(a,b){return Number(a)-Number(b);});
  order.forEach(function(sid){
    var lineName='线路'+sid;
    var list=groups[sid];
    list.sort(function(a,b){return (parseInt(a.nid,10)||0)-(parseInt(b.nid,10)||0);});
    list.forEach(function(ep){
      var epLink=siteLink('episode',{vodId:id,siteId:sid,episodeId:ep.nid});
      var children=order.map(function(otherSid){
        var other=(groups[otherSid]||[]).find(function(x){return x.nid===ep.nid||x.title===ep.title;});
        if(!other)return null;
        var otherLink=siteLink('episode',{vodId:id,siteId:otherSid,episodeId:other.nid});
        return {id:otherLink,type:'url',link:otherLink,title:'线路'+otherSid+' · '+other.title};
      }).filter(Boolean);
      card.episodeItems.push({id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:cover,
        childItems:children.length>1?children:[{id:epLink,type:'url',link:epLink,title:lineName+' · '+ep.title}]});
    });
  });
  return card;
}
/* 从 player_aaaa 脚本里按花括号配对取出 JSON 对象（字符串内花括号不计）。 */
function sitePlayerJson(html){
  var start=html.indexOf('var player_aaaa=');
  if(start<0)return null;
  var i=html.indexOf('{',start);
  if(i<0)return null;
  var depth=0,inStr=false,esc=false;
  for(var j=i;j<html.length;j++){
    var ch=html[j];
    if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue;}
    if(ch==='"')inStr=true;
    else if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0){try{return JSON.parse(html.slice(i,j+1));}catch(_){return null;}}}
  }
  return null;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),siteId=siteQueryValue(link,'siteId'),episodeId=siteQueryValue(link,'episodeId');
  var playUrl='';
  if(/^https?:\/\//i.test(link)&&/play/i.test(link))playUrl=link;
  else if(siteIdOK(vodId)&&siteIdOK(episodeId)&&siteId)
    playUrl=Source.origin+'/index.php/vod/play/id/'+vodId+'/sid/'+siteId+'/nid/'+episodeId+'.html';
  if(!playUrl)throw Error('请选择'+Source.name+'中的影片分集');
  /* 分集页只嵌播放器 iframe，媒体地址在播放器端点里。播放器端点要求带
   * 年龄确认 Cookie（见文件头注释），不带只返回确认壳，无 player_aaaa。 */
  var pm=playUrl.match(/\/index\.php\/vod\/play\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)\.html/);
  if(!pm)throw Error(Source.name+'分集链接格式无法识别');
  var playerUrl=Source.origin+'/index.php/vod/player/id/'+pm[1]+'/nid/'+pm[3]+'/sid/'+pm[2]+'.html';
  var html=await siteGetHtml(playerUrl,{'Cookie':AGE_COOKIE,'Referer':playUrl});
  var player=sitePlayerJson(html);
  if(!player)throw Error(Source.name+'未返回播放地址（年龄确认未通过或分集播放页结构已变化）');
  if(player.encrypt)throw Error(Source.name+'该分集播放地址已加密，暂不提供');
  var url=siteSafeURL(player.url||'');
  if(!url||!/\.m3u8($|[?#])/i.test(url))throw Error(Source.name+'未找到公开播放地址');
  return [{name:'黑桃线路',url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
  var classes=cctvCatVodClasses(),items;
  items=await loadHome({});
  return {class:classes,list:cctvCatVodCards(items)};
}
async function cctvCatVodCategory(tid,page,filter,extend){
  var id=String(tid||''),current=Math.max(1,Math.floor(Number(page)||1)),items,maxPage=0;
  items=await loadCatalog({channelId:id,page:current});
  return cctvCatVodPage(items,current,maxPage);
}
async function cctvCatVodSearch(keyword,quick,page){
  return cctvCatVodPage(await search({keyword:String(keyword||''),page:Math.max(1,Math.floor(Number(page)||1))}),page);
}
async function cctvCatVodDetail(ids){
  var id=Array.isArray(ids)?ids[0]:ids,detail=await loadDetail(String(id||''));
  var groups=cctvCatVodGroups(detail);
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
