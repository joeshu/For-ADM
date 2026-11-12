/* 禁果短剧 CCTVHost 适配器：公开目录/详情（18+ 成人站，仅元数据）。
 * 站点：https://play.jinguoduanju.app（Vue SPA + /api/v1，纯 JSON，无需签名）。
 * 实站验证 2026-11-12（本机可达）：
 * - jinguoduanju.app、play.jinguoduanju.app、jgdj.app 三域返回同一 SPA 壳
 *   （md5 ae8bbbaf…）、同一 JS 包（md5 17f99a77…）、同一目录 JSON，
 *   故只需一个适配器（jinguo），origin 取 og:url 的 play.jinguoduanju.app。
 * - 目录接口无需登录/签名：GET /api/v1/dramas?displayArea=HOME_FEED（472 条）、
 *   /dramas?sort=latest（1045 条）、/dramas?sort=latest&navigationId={2,3,5,6,7,10}
 *   （全部 1045 / 单体 550 / 精选 150 / 短剧 46 / 原创 82 / 漫剧 30）、
 *   /dramas?sort=latest&q={关键词}（服务端搜索）、/dramas/{id}（详情含分集
 *   id/number/title/durationSeconds/locked/unlocked）。服务端忽略分页参数，
 *   每次返回完整列表，适配器在本地按每页 60 条切片。
 * - 播放：GET /api/v1/episodes/{id}/play 未登录返回 401 {message:"需要登录"}；
 *   播放地址（videoUrl）只在登录后返回，登录需 POST /api/v1/auth/device
 *   注册设备取 orange_token。本适配器不实现设备注册/登录/签名/支付，
 *   resolveResource 明确报错，不伪造播放地址。 */
var Source={"id":"jinguo","name":"禁果短剧","origin":"https://play.jinguoduanju.app","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'禁果短剧公开目录与详情（18+ 成人站；仅元数据，暂不提供播放直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'2',enumOptions:[{title:'全部',value:'2'},{title:'单体',value:'3'},{title:'精选',value:'5'},{title:'原创',value:'7'},{title:'短剧',value:'6'},{title:'漫剧',value:'10'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词（站内服务端搜索）'},{name:'page',title:'页码',type:'page',value:'1'}]},
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
var PAGE_SIZE=60;
/* 封面是站内相对地址 /media/covers/...，拼成绝对地址；其它域同名资源相同。 */
function siteAbs(u){
  if(!u)return '';
  if(/^https?:\/\//i.test(u))return u;
  if(u.indexOf('//')===0)return 'https:'+u;
  if(u.charAt(0)==='/')return Source.origin+u;
  return Source.origin+'/'+u;
}
async function siteGetJson(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/','Accept':'application/json'},timeout:15000});
  var data=r.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'返回了无法解析的响应');}}
  return data;
}
function siteCard(item){
  if(!item||typeof item!=='object')return null;
  var id=String(siteGet(item,['id'])||'');
  if(!/^\d+$/.test(id))return null;
  var title=siteText(item.title);if(!title)return null;
  var link=siteLink('vod',{id:id});
  var epCount=Number(item.episodeCount)||0,freeCount=Number(item.freeEpisodeCount)||0;
  var desc=siteText(item.subtitle)||'';
  if(!desc&&epCount)desc=epCount+'集'+(freeCount?' · 免费'+freeCount+'集':'');
  var labels=siteArray(item.tags).map(siteText).filter(Boolean).slice(0,4);
  var cover=siteSafeURL(siteAbs(String(siteGet(item,['coverUrl','cover'])||'')));
  return {id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
    description:desc,mediaType:'tv',labels:labels.map(function(name){return {name:name};})};
}
/* 服务端每次返回完整列表（无分页参数），本地按 PAGE_SIZE 切片。 */
function sitePageSlice(items,page){
  var start=(page-1)*PAGE_SIZE;
  return items.slice(start,start+PAGE_SIZE);
}
async function loadHome(){
  var items=siteArray(await siteGetJson(Source.origin+'/api/v1/dramas?displayArea=HOME_FEED'));
  return items.map(siteCard).filter(Boolean).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'2'),page=sitePage(p.page);
  if(['2','3','5','6','7','10'].indexOf(cid)<0)cid='2';
  var items=siteArray(await siteGetJson(Source.origin+'/api/v1/dramas?sort=latest&navigationId='+encodeURIComponent(cid)));
  return sitePageSlice(items.map(siteCard).filter(Boolean),page);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  var items=siteArray(await siteGetJson(Source.origin+'/api/v1/dramas?sort=latest&q='+encodeURIComponent(kw)));
  return sitePageSlice(items.map(siteCard).filter(Boolean),page);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var data=await siteGetJson(Source.origin+'/api/v1/dramas/'+id);
  var drama=data&&data.drama;
  if(!drama||String(drama.id)!==id)throw Error(Source.name+'未找到该影片');
  var card=siteCard(drama);if(!card)throw Error('影片详情缺少标题或标识');
  var desc=siteText(data.description||'');
  if(desc)card.description=desc;
  var freeCount=Number(drama.freeEpisodeCount)||0;
  var episodes=siteArray(data.episodes);
  episodes.sort(function(a,b){return (Number(a.number)||0)-(Number(b.number)||0);});
  card.episodeItems=episodes.map(function(ep){
    var num=Number(ep.number)||0;
    var title=siteText(ep.title)||('第'+num+'集');
    if(freeCount&&num>freeCount)title+='（需解锁）';
    var epLink=siteLink('episode',{vodId:id,episodeId:String(ep.id||'')});
    return {id:epLink,type:'url',link:epLink,title:title,coverUrl:card.coverUrl,
      childItems:[{id:epLink,type:'url',link:epLink,title:'禁果短剧 · '+title}]};
  });
  return card;
}
async function resolveResource(p){
  /* GET /api/v1/episodes/{id}/play 未登录返回 401 {"message":"需要登录"}；
   * 播放地址（videoUrl）只在登录后返回，登录需设备注册取 token。
   * 本适配器不实现设备注册/登录/签名/支付，故不提供播放直链。 */
  throw Error(Source.name+'暂不提供公开播放地址：分集播放需登录后调用 /episodes/{id}/play，当前适配器不实现登录/签名');
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
