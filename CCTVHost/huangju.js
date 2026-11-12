/* 黄剧 CCTVHost 适配器：公开目录/详情/分集与可播直链（18+ 成人站）。
 * 站点：https://huangju.net（Next.js SSR + api.huangju.net；同款域名
 * yanyushorttv.cc / yanyushorttv.top 见 seed 配置，属同一应用）。
 * 实站验证 2026-11-12（本机可达）：首页推荐流 24 条（RSC flight 数据）、
 * /theater 剧场 30 条（SSR 卡片，?page= 被忽略）、搜索 /search?q= SSR
 * 60 条（?page= 被忽略）、详情 GET api.huangju.net/dramas/{slug}-{id}、
 * 播放 GET api.huangju.net/play/{episodeId}（无需登录，直接返回
 * CloudFront 签名 m3u8 + 三个 Set-Cookie）。
 * 关键结论（2026-11-12 本机实测）：播放列表的分片地址是相对路径
 * （seg_00000.ts），按 RFC 3986 解析会丢掉查询参数——把签名拼成
 * ?Policy=&Signature=&Key-Pair-Id= 的地址只能取到 playlist，分片
 * 一律 403，真实播放器无法播放；只有带 Cookie 请求才全通
 * （playlist 200、分片 200、1,749,340 字节），裸地址无 Cookie 则
 * playlist 直接 403。因此 resolveResource 返回站点原样下发的裸
 * m3u8 地址（不拼查询参数），前提是 /play/ 调用已在同一会话的
 * Cookie 存储里留下签名——站内 Web 播放器就是靠浏览器自动带
 * Cookie 播放的；CCTVHost 的播放器能否带上这组 Cookie 需 iPhone
 * 实测，若带不上则播放失败。不登录、不伪造、不绕鉴权。 */
var Source={"id":"huangju","name":"黄剧","origin":"https://huangju.net","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'黄剧公开目录与详情（18+ 成人站；分集为站点签发的 CloudFront 签名直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'feed',enumOptions:[{title:'推荐',value:'feed'},{title:'剧场 · 全部',value:'theater'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
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
var API='https://api.huangju.net';

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
  if(!html)throw Error(Source.name+'返回空页面');
  return html;
}
async function siteGetJson(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var data=r.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'返回了非 JSON 数据');}}
  if(!data||typeof data!=='object')throw Error(Source.name+'返回空数据');
  return data;
}
/* 海报地址遵循固定模式 https://video.huangju.net/posters/yanyu/drama-{N}.jpg，
 * N 即 slug 中的数字（多站样本已验证），仅作 coverUrl 缺失时的回退。 */
function sitePoster(slug){
  var m=String(slug||'').match(/(\d+)/);
  return m?siteSafeURL('https://video.huangju.net/posters/yanyu/drama-'+m[1]+'.jpg'):'';
}
function siteFeedCard(drama){
  if(!drama||typeof drama!=='object')return null;
  var id=String(drama.id||'');if(!/^\d+$/.test(id))return null;
  var slug=String(drama.slug||'');if(!/^[a-z0-9-]+$/.test(slug))return null;
  var title=siteText(drama.title);if(!title)return null;
  var cover=siteSafeURL(String(drama.cover||''))||sitePoster(slug);
  var link=siteLink('vod',{slug:slug,id:id});
  return {id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
    description:siteText(drama.summary||''),mediaType:'tv',labels:[]};
}
/* 首页 flight 数据：{"items":[{"drama":{...},"episode":{...}}]}，键值用 \" 转义。 */
function siteParseFeed(html){
  var u=String(html||'').replace(/\\"/g,'"');
  var out=[],seen=Object.create(null);
  var re=/"drama":\{"id":(\d+),"slug":"([^"]+)","title":"((?:[^"\\]|\\.)*)"/g,m;
  while((m=re.exec(u))){
    var id=m[1];if(seen[id])continue;seen[id]=1;
    var next=u.indexOf('"drama":{',m.index+1),span=u.slice(m.index,next<0?m.index+3000:next);
    var cover=(span.match(/"cover":"(https:[^"]+)"/)||[])[1]||'';
    var summary=(span.match(/"summary":"((?:[^"\\]|\\.)*)"/)||[])[1]||'';
    out.push(siteFeedCard({id:id,slug:m[2],title:m[3].replace(/\\"/g,'"'),cover:cover,summary:summary.replace(/\\"/g,'"')}));
  }
  return out.filter(Boolean);
}
/* /theater 与 /search?q= 均为 SSR 卡片：<a href="/drama/{slug}-{id}/ep-1">…<img alt=标题 src=海报>…</a> */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a[^>]+href="\/drama\/([a-z0-9-]+)-(\d+)\/ep-1"[^>]*>([\s\S]*?)<\/a>/g,m;
  while((m=re.exec(html))){
    var id=m[2];if(seen[id])continue;seen[id]=1;
    var block=m[3];
    var img=(block.match(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]+)"/)||block.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/)||[]);
    var title=siteText(img[1]||img[4]||siteText(block));
    if(!title)continue;
    var cover=siteSafeURL(img[2]||img[3]||'')||sitePoster(m[1]);
    var link=siteLink('vod',{slug:m[1],id:id});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
      description:'',mediaType:'tv',labels:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseFeed(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'feed'),page=sitePage(p.page);
  if(page>1)return []; /* ?page= 参数会被服务端忽略，第 2 页与第 1 页完全相同。 */
  if(cid==='theater')return siteParseCards(await siteGetHtml(Source.origin+'/theater')).slice(0,60);
  return siteParseFeed(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  if(page>1)return []; /* ?page= 参数会被服务端忽略，第 2 页与第 1 页完全相同。 */
  return siteParseCards(await siteGetHtml(Source.origin+'/search?q='+encodeURIComponent(kw))).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id'),slug=siteQueryValue(link,'slug');
  if(!/^\d+$/.test(id)||!/^[a-z0-9-]+$/.test(slug))throw Error('影片链接不属于'+Source.name);
  var d=await siteGetJson(API+'/dramas/'+slug+'-'+id);
  var title=siteText(d.title);if(!title)throw Error(Source.name+'未找到该影片');
  var cover=siteSafeURL(String(d.coverUrl||''))||sitePoster(slug);
  var cardLink=siteLink('vod',{slug:slug,id:id});
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:siteText(d.description||''),mediaType:'tv',labels:[]};
  var episodes=siteArray(d.episodes).map(function(ep){
    return {id:String(ep.id||''),num:Number(ep.epNo)||0,
      title:siteText(ep.title)||('第'+(Number(ep.epNo)||0)+'集'),
      playable:ep.playable!==false};
  }).filter(function(ep){return /^\d+$/.test(ep.id)&&ep.num>0;});
  episodes.sort(function(a,b){return a.num-b.num;});
  card.episodeItems=episodes.map(function(ep){
    var epLink=siteLink('episode',{episodeId:ep.id});
    var title='第'+ep.num+'集'+(ep.title&&ep.title!==('第'+ep.num+'集')?' · '+ep.title:'');
    return {id:epLink,type:'url',link:epLink,title:title,coverUrl:cover,
      childItems:[{id:epLink,type:'url',link:epLink,title:'原站线路 · '+title}]};
  });
  return card;
}
function siteCookieValue(headers,name){
  if(!headers||typeof headers!=='object')return '';
  var vals=[];
  Object.keys(headers).forEach(function(k){
    if(k.toLowerCase()==='set-cookie'){
      var v=headers[k];
      if(Array.isArray(v))vals=vals.concat(v);
      else if(typeof v==='string')vals.push(v);
    }
  });
  var joined=vals.join('\n');
  var m=joined.match(new RegExp('(?:^|\\n)'+name+'=([^;\\n]+)'));
  return m?m[1]:'';
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var episodeId=siteQueryValue(link,'episodeId');
  if(!/^\d+$/.test(episodeId))throw Error('请选择'+Source.name+'中的影片分集');
  var r=await CCTVHttp.get(API+'/play/'+episodeId,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var data=r.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'播放接口返回了非 JSON 数据');}}
  var url=siteSafeURL(String((data||{}).url||''));
  if(!url)throw Error(Source.name+'未返回播放地址（分集可能已下线）');
  /* /play/ 随响应下发三个 CloudFront 签名 Cookie（Domain=.huangju.net）；
   * 播放列表分片是相对地址，查询参数签发方式在真实播放器里分片必 403，
   * 只有 Cookie 方式全通。故只校验 Cookie 已下发，返回站点原样地址，
   * 播放依赖播放器带上同一会话的 Cookie（需 iPhone 实测）。
   * 环境若未透传 Set-Cookie 则明确报错，不返回必然 403 的地址。 */
  var policy=siteCookieValue(r.headers,'CloudFront-Policy');
  var signature=siteCookieValue(r.headers,'CloudFront-Signature');
  var keyPairId=siteCookieValue(r.headers,'CloudFront-Key-Pair-Id');
  if(!policy||!signature||!keyPairId)
    throw Error(Source.name+'播放地址需要站点签发的 CloudFront 签名（/play/ 未返回 Set-Cookie，当前环境无法读取），请在 iPhone 上实测');
  return [{name:'原站线路',url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/','User-Agent':UA}}];
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
