/* 鬼片网 CCTVHost 适配器：公开影视目录/详情/分集播放地址。
 * 站点：https://guipianwu.com（ewave 模板，SSR 直出）。
 * 实站验证 2026-11-12（本机可达）：首页 56 卡；分类 /list/{id}.html
 * （1 鬼片大全/2 电视剧/3 恐怖片/4 动漫/6 大陆鬼片/7 日韩鬼片/8 林正英鬼片/
 * 9 港台鬼片/10 泰国鬼片/11 欧美鬼片/31 剧情片，5 不存在）；
 * 详情 /nv/{id}.html，线路 Tab data-target="#ewave-playlist-N"，
 * 分集 <a href='/play/{vod}-{sid}-{nid}.html'>，sid = N-1；
 * 播放页 /play/{vod}-{sid}-{nid}.html 内含 var now="...index.m3u8"。
 * 限制（实测）：① /search.php 已下线，任何关键词都回 404 "File not found."，
 * 故 search() 明确报错；② 分类页无分页，/list/1-2.html 与第 1 页字节完全相同，
 * 故 loadCatalog 只取第 1 页；③ 播放页给出的 m3u8 直链本机取不到
 * （CDN 回 403，openresty），属出口网络限制，需 iPhone（国内网络）实测播放。
 * 交接文档称根页"没有找到站点"已过时：本站点 2026-11-12 正常服务。 */
var Source={"id":"guipian","name":"鬼片网","origin":"https://guipianwu.com","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'鬼片网公开影视目录与详情（暂不提供播放直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'鬼片大全',value:'1'},{title:'电视剧',value:'2'},{title:'恐怖片',value:'3'},{title:'动漫',value:'4'},{title:'大陆鬼片',value:'6'},{title:'日韩鬼片',value:'7'},{title:'林正英鬼片',value:'8'},{title:'港台鬼片',value:'9'},{title:'泰国鬼片',value:'10'},{title:'欧美鬼片',value:'11'},{title:'剧情片',value:'31'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/&nbsp;/g,' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'; /* 桌面 Chrome UA 会被本站回 403“没有找到站点”，移动 UA 正常。 */
var CATEGORIES=['1','2','3','4','6','7','8','9','10','11','31'];
function siteAbs(u){
  if(!u)return '';
  if(/^https?:\/\//i.test(u))return u;
  if(u.indexOf('//')===0)return 'https:'+u;
  if(u.charAt(0)==='/')return Source.origin+u;
  return Source.origin+'/'+u;
}
async function siteGetHtml(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var html=typeof r.data==='string'?r.data:'';
  if(!html)throw Error(Source.name+'返回空页面（该站可能屏蔽了当前网络）');
  return html;
}
/* ewave 列表卡片（首页/分类共用两种写法）：
 * <a class="video-link" href="/nv/{id}.html" title="标题">
 *   <div class="item-pic lazyload" data-original="封面">
 *     [<div class="video-tips">推荐</div>]<div class="video-duration">更新第08集</div>
 *   </div><div class="video-con"><h2 class="video-con-tit">标题</h2></div></a>
 * 滑动列表里封面改用 data-background，同样匹配。 */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a[^>]*class="video-link"[^>]*href="\/nv\/(\d+)\.html"[^>]*title="([^"]*)"[^>]*>/g,m;
  while((m=re.exec(html))){
    var id=m[1];if(seen[id])continue;seen[id]=1;
    var block=html.slice(m.index,m.index+900);
    var img=(block.match(/data-original="([^"]+)"/)||block.match(/data-background="([^"]+)"/)||block.match(/<img[^>]+src="([^"]+)"/)||[])[1];
    var title=siteText(m[2]);
    if(!title){var hm=block.match(/class="video-con-tit[^"]*"[^>]*>([^<]+)</);if(hm)title=siteText(hm[1]);}
    if(!title)continue;
    var dur=(block.match(/class="video-duration">([^<]*)</)||[])[1];
    var tip=(block.match(/class="video-tips[^"]*">([^<]*)</)||[])[1];
    var link=siteLink('vod',{id:id});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(img||'')),posterPath:siteSafeURL(siteAbs(img||'')),
      description:siteText(dur||''),mediaType:'tv',labels:tip?[{name:siteText(tip)}]:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(CATEGORIES.indexOf(cid)<0)cid='1';
  if(page>1)return []; /* 分类页无分页：/list/1-2.html 与第 1 页字节完全相同。 */
  return siteParseCards(await siteGetHtml(Source.origin+'/list/'+cid+'.html')).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  /* 站内搜索表单指向 /search.php?searchword=，但该接口已下线：
   * 2026-11-12 实测任何关键词（有参/无参/中文/POST）都回 404 "File not found."。
   * 先实地请求一次，接口恢复时可直接用；仍不可用则明确报错，不伪造结果。 */
  var r=await CCTVHttp.get(Source.origin+'/search.php?searchword='+encodeURIComponent(kw),{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var html=typeof r.data==='string'?r.data:'';
  if(Number(r.statusCode)!==200||!html||/File not found/i.test(html))throw Error(Source.name+'站内搜索接口已下线，暂不提供站内搜索');
  var out=siteParseCards(html);
  if(!out.length)throw Error(Source.name+'未找到与“'+kw+'”相关的影片');
  return out.slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/nv/'+id+'.html');
  var title=siteText((html.match(/<h1[^>]*class="[^"]*media-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)||html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)||[])[1]||'');
  if(!title){var ogt=html.match(/property="og:title" content="([^"]+)"/);if(ogt)title=siteText(ogt[1]);}
  if(!title)throw Error(Source.name+'未找到该影片（详情页结构可能已变化）');
  var cover='';
  var img=html.match(/class="detail-img"[^>]*>\s*<img[^>]+src="([^"]+)"/)||html.match(/class="detail-cover blur lazyload"[^>]*data-original="([^"]+)"/);
  if(img)cover=siteSafeURL(siteAbs(img[1]));
  if(!cover){var og=html.match(/property="og:image" content="([^"]+)"/);if(og)cover=siteSafeURL(og[1]);}
  /* 简介与信息：<li>…类型：<span>美剧</span>…状态：更新第08集…年份：<span>2026</span>
   * …简介：&nbsp;正文…</li>；取不到简介时用类型/状态/年份拼描述。 */
  var desc='';
  var sm=html.match(/简介：([\s\S]{0,900}?)<\/li>/);
  if(sm)desc=siteText(sm[1].replace(/&nbsp;/g,' '));
  if(!desc){
    var bits=[];
    [['类型：','type'],['状态：','status'],['年份：','year'],['地区：','area'],['语言：','lang']].forEach(function(pair){
      var mm=html.match(new RegExp(pair[0]+'\\s*(?:<span>)?([^<]{1,40})'));
      if(mm)bits.push(siteText(mm[1]));
    });
    desc=bits.join(' · ');
  }
  var pageTitle=(html.match(/<title>([^<]*)<\/title>/)||[])[1]||'';
  var cardLink=siteLink('vod',{id:id});
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:desc,mediaType:/电影/.test(pageTitle)?'movie':'tv',labels:[]};
  /* 分集：线路 Tab data-target="#ewave-playlist-N"（N 为线路序号+1），
   *  playlist div 里的分集链接 href='/play/{vod}-{sid}-{nid}.html'，sid = N-1。
   *  线路名取 Tab 文本（百度云/量子云/高速云/鬼片云/高清云），取不到用“线路{sid}”。 */
  var tabNames=Object.create(null);
  var tabRe=/data-target="#ewave-playlist-(\d+)"[^>]*>([^<]*)</g,tm;
  while((tm=tabRe.exec(html)))tabNames[tm[1]]=siteText(tm[2]);
  var groups=Object.create(null),order=[];
  var epRe=/<a[^>]+href=['"]\/play\/(\d+)-(\d+)-(\d+)\.html['"][^>]*?(?:title=['"]([^'"]*)['"])?[^>]*>([\s\S]*?)<\/a>/g,em;
  while((em=epRe.exec(html))){
    if(em[1]!==id)continue;
    var sid=em[2];
    var epTitle=siteText(em[4]||em[5])||('第'+(Number(em[3])+1)+'集');
    if(epTitle==='立即播放')continue; /* 详情页顶部的“立即播放”按钮与第 1 集同 nid，会重复。 */
    if(!groups[sid]){groups[sid]=Object.create(null);order.push(sid);}
    if(!groups[sid][em[3]])groups[sid][em[3]]={nid:em[3],title:epTitle};
  }
  if(!order.length)throw Error(Source.name+'未找到该影片的分集（详情页结构可能已变化）');
  order.sort(function(a,b){return Number(a)-Number(b);});
  var lineName=function(sid){
    var pid=String(Number(sid)+1);
    return tabNames[pid]||('线路'+sid);
  };
  /* episodeItems 以集为单位（取 sid 最小的线路为主链接），
   * 每集的 childItems 列出全部线路，标题“线路名 · 集名”。 */
  var lines=Object.create(null);
  order.forEach(function(sid){
    lines[sid]=Object.keys(groups[sid]).map(function(k){return groups[sid][k];}).sort(function(a,b){return Number(a.nid)-Number(b.nid);});
  });
  var firstLine=lines[order[0]];
  card.episodeItems=[];
  firstLine.forEach(function(ep){
    var epLink=siteLink('episode',{vodId:id,siteId:order[0],episodeId:ep.nid});
    var children=order.map(function(sid){
      var other=(lines[sid]||[]).filter(function(x){return x.nid===ep.nid;})[0];
      if(!other)return null;
      var otherLink=siteLink('episode',{vodId:id,siteId:sid,episodeId:other.nid});
      return {id:otherLink,type:'url',link:otherLink,title:lineName(sid)+' · '+other.title};
    }).filter(Boolean);
    card.episodeItems.push({id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:cover,
      childItems:children.length?children:[{id:epLink,type:'url',link:epLink,title:lineName(order[0])+' · '+ep.title}]});
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),siteId=siteQueryValue(link,'siteId'),episodeId=siteQueryValue(link,'episodeId');
  var playUrl='',lineName='原站线路';
  if(/^https?:\/\//i.test(link)&&/\/play\//i.test(link))playUrl=link;
  else if(siteIdOK(vodId)&&siteIdOK(episodeId)&&siteIdOK(siteId))
    playUrl=Source.origin+'/play/'+vodId+'-'+siteId+'-'+episodeId+'.html';
  if(!playUrl)throw Error('请选择'+Source.name+'中的影片分集');
  var referer=siteIdOK(vodId)?Source.origin+'/nv/'+vodId+'.html':Source.origin+'/';
  var html=await siteGetHtml(playUrl);
  /* 播放页明文给出当前集的 m3u8：var now="https://.../index.m3u8"；
   * var next= 是下一集，不要用。取不到即明确报错，不猜地址。 */
  var m=(html.match(/var\s+now\s*=\s*"([^"]+\.m3u8[^"]*)"/)||html.match(/var\s+now\s*=\s*'([^']+\.m3u8[^']*)'/)||html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/));
  var url=m?siteSafeURL(m[1]):'';
  if(!url)throw Error(Source.name+'分集播放页未提供公开播放地址');
  return [{name:lineName,url:url,playerType:'app',customHeaders:{Referer:referer}}];
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
