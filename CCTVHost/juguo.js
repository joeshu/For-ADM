/* 剧果短剧 CCTVHost 适配器：公开目录与详情（18+ 成人站，仅做元数据；不提供播放直链）。
 * 注意：attract.vgbyziuz.cc 与 yeguodj.com 是同一后端、同一份目录（2026-11-12 实测逐项相同），
 * 本文件是 yeguo.js 的同源薄变体（仅 Source id/name/origin 不同，解析逻辑完全相同）。
 * 站点：https://yeguodj.com（Nuxt SSR）。
 * 数据源：各路由的 _payload.json（Nuxt devalue 扁平载荷；封面只在载荷里，
 * SSR HTML 里的 img 全是占位图）。首页载荷含 top_list（12 条）与 6 个模块
 * （各 10 条）；/explore/drama/ 载荷 total 1188、每页 20 条；详情载荷含
 * description/tags/分集 id/标题/清晰度与 access.state。客户端 API
 * （POST /api.php/api/...）返回加密载荷，播放页是纯客户端壳（6KB，
 * 无媒体地址），故 resolveResource 只在播放页出现公开 m3u8/mp4 时才返回，
 * 否则明确报错；不做登录、付费、签名、DRM 或解密。
 * 实站验证 2026-11-12（本机可达）：首页/探索/详情载荷均 200；第 2 页起、
 * 筛选、关键词搜索均为客户端加密接口，SSR 拿不到——分类只取首页 6 个
 * 模块第 1 页，搜索改为首页目录 + 探索第 1 页本地过滤（标题/标签子串）。
 * 剧果（attract/anyway.vgbyziuz.cc）实测与本站同一后端：top_list、6 个
 * 模块、探索 total 与首 20 条、详情分集逐项相同，故剧果适配器只需改
 * origin 与名称，解析逻辑完全相同。 */
var Source={"id":"juguo","name":"剧果短剧","origin":"https://attract.vgbyziuz.cc","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'剧果短剧公开目录与详情（18+ 成人站；暂不提供播放直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'rec-sweet-romance',enumOptions:[{title:'剧果原创短剧',value:'rec-sweet-romance'},{title:'热门精选短剧',value:'rec-hot-drama'},{title:'都市情感剧场',value:'rec-urban-emotion'},{title:'逆袭重生佳作',value:'rec-rebirth-rise'},{title:'古装穿越精选',value:'rec-ancient-travel'},{title:'校园青春故事',value:'rec-campus-youth'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或标签（仅检索首页目录与探索第 1 页）'},{name:'page',title:'页码',type:'page',value:'1'}]},
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

/* Nuxt _payload.json 是 devalue 扁平载荷：一个数组，字典/数组里的整数
 * 是指向该数组下标的引用，数组下标处存的字面量（字符串/数字/布尔/
 * null）才是值；负整数是特殊标记（按空值处理）。只读字符串/数组/
 * 字典字段时解析结果可靠，勿依赖小整数型标量字段。 */
function siteResolvePayload(arr){
  function deref(i,path){
    if(path.indexOf(i)>=0)return null;
    var v=arr[i],next=path.concat([i]),out,k,x;
    if(typeof v==='number')return v;
    if(Array.isArray(v)){
      out=[];
      for(var a=0;a<v.length;a++){x=v[a];out.push(typeof x==='number'?(x<0?null:(x<arr.length?deref(x,next):x)):x);}
      return out;
    }
    if(v&&typeof v==='object'){
      out={};
      for(k in v){x=v[k];out[k]=typeof x==='number'?(x<0?null:(x<arr.length?deref(x,next):x)):x;}
      return out;
    }
    return v;
  }
  return deref(0,[]);
}
async function siteGetPayload(path){
  var r=await CCTVHttp.get(Source.origin+path,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var data=r.data;
  if(typeof data==='string'){
    try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'返回了非 JSON 载荷（可能是客户端壳页面）');}
  }
  if(!Array.isArray(data))throw Error(Source.name+'返回的载荷结构已变化');
  return siteResolvePayload(data);
}
function sitePayloadSection(root,prefix){
  var holder=root&&root.data&&Array.isArray(root.data)?root.data[1]:null;
  if(!holder||typeof holder!=='object')throw Error(Source.name+'返回的载荷结构已变化');
  var keys=Object.keys(holder);
  for(var i=0;i<keys.length;i++){
    if(keys[i].indexOf(prefix)===0&&holder[keys[i]]&&typeof holder[keys[i]]==='object'&&holder[keys[i]].data)
      return holder[keys[i]].data;
  }
  throw Error(Source.name+'返回的载荷里没有 '+prefix+' 数据（结构可能已变化）');
}
async function siteHomeData(){
  return sitePayloadSection(await siteGetPayload('/_payload.json'),'home');
}
async function siteExploreData(){
  return sitePayloadSection(await siteGetPayload('/explore/drama/_payload.json'),'explore-drama');
}
/* tags 在不同载荷里可能是数组，也可能是 "['a', 'b']" 形式的字符串。 */
function siteTags(item){
  var t=item&&item.tags;
  if(Array.isArray(t))return t.map(siteText).filter(Boolean);
  if(typeof t==='string'){
    var out=[],m,re=/'([^']+)'/g;
    while((m=re.exec(t)))out.push(siteText(m[1]));
    return out.filter(Boolean);
  }
  return [];
}
function siteAccessLabel(item){
  var a=siteGet(item,['content_access_type']);
  if(a==='coin')return '金币';
  if(a==='vip')return 'VIP';
  if(a==='free')return '免费';
  return '';
}
function siteCard(item){
  if(!item||typeof item!=='object')return null;
  var id=String(siteGet(item,['video_id','id'])||'');
  if(!/^\d+$/.test(id))return null;
  var title=siteText(item.title);if(!title)return null;
  var image=siteSafeURL(siteGet(item,['cover','coverUrl']));
  var link=siteLink('vod',{id:id});
  var tags=siteTags(item);
  var labels=tags.slice(0,4);
  var access=siteAccessLabel(item);if(access)labels.push(access);
  var serial=siteText(siteGet(item,['serialize_status_text'])||(item.app_badge&&item.app_badge.text));
  if(serial&&labels.indexOf(serial)<0)labels.push(serial);
  var desc='';
  var plays=siteText(siteGet(item,['play_count_text']));
  if(plays)desc='播放 '+plays;
  var intro=siteText(siteGet(item,['intro','description']));
  if(intro)desc=desc?desc+' · '+intro:intro;
  return {id:link,type:'url',link:link,title:title,coverUrl:image,posterPath:image,
    description:desc,mediaType:'tv',
    labels:labels.slice(0,5).map(function(name){return {name:name};})};
}
function siteDedupe(items){
  var seen=Object.create(null),out=[];
  items.forEach(function(x){if(!x)return;var k=String(x.link||'');if(seen[k])return;seen[k]=1;out.push(x);});
  return out;
}
async function loadHome(){
  var data=await siteHomeData(),items=[];
  siteArray(data.top_list).forEach(function(x){items.push(siteCard(x));});
  siteArray(siteGet(data,['modules'])&&data.modules.list).forEach(function(mod){
    siteArray(mod.items).forEach(function(x){items.push(siteCard(x));});
  });
  return siteDedupe(items).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'rec-sweet-romance'),page=sitePage(p.page);
  if(page>1)return []; /* 首页模块只有第 1 页可 SSR；第 2 页起走客户端加密接口。 */
  var data=await siteHomeData(),mods=siteArray(data.modules&&data.modules.list),mod=null;
  for(var i=0;i<mods.length;i++){
    if(String(mods[i].code||'')===cid||siteText(mods[i].title)===cid){mod=mods[i];break;}
  }
  if(!mod)mod=mods[0];
  if(!mod)return [];
  return siteArray(mod.items).map(siteCard).filter(Boolean).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var needle=kw.toLowerCase(),items=[];
  var data=await siteHomeData();
  siteArray(data.top_list).forEach(function(x){items.push(siteCard(x));});
  siteArray(data.modules&&data.modules.list).forEach(function(mod){
    siteArray(mod.items).forEach(function(x){items.push(siteCard(x));});
  });
  try{
    var ex=await siteExploreData();
    siteArray(ex.list).forEach(function(x){items.push(siteCard(x));});
  }catch(_){/* 探索页不可用时只用首页目录 */}
  items=siteDedupe(items);
  return items.filter(function(x){
    if(!x)return false;
    var hay=(x.title+' '+(x.labels||[]).map(function(l){return l.name;}).join(' ')).toLowerCase();
    return hay.indexOf(needle)>=0;
  }).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var data=sitePayloadSection(await siteGetPayload('/drama/detail/'+id+'/_payload.json'),'drama-detail:');
  var card=siteCard(data);if(!card)throw Error(Source.name+'未找到该影片');
  card.description=siteText(siteGet(data,['description','intro']))||card.description;
  var episodes=siteArray(data.episodes);
  episodes.sort(function(a,b){return (Number(a.sort)||0)-(Number(b.sort)||0);});
  var lineLink=function(ep,no){
    return siteLink('episode',{vodId:id,episodeId:String(ep.id||''),episodeNo:String(no)});
  };
  card.episodeItems=episodes.map(function(ep,idx){
    var no=idx+1;
    var epLink=lineLink(ep,no);
    var title=siteText(ep.title)||('第'+no+'集');
    var res=siteText(ep.resolution);
    if(res)title=title+'（'+res+'）';
    return {id:epLink,type:'url',link:epLink,title:title,coverUrl:card.coverUrl,
      childItems:[{id:epLink,type:'url',link:epLink,title:Source.name+' · '+title}]};
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),episodeNo=siteQueryValue(link,'episodeNo');
  if(!/^\d+$/.test(vodId))throw Error('请选择'+Source.name+'中的影片分集');
  var no=Math.max(1,Math.floor(Number(episodeNo)||1));
  var playUrl=Source.origin+'/drama/video/'+vodId+'/'+(no>1?'ep-'+no+'/':'');
  var r=await CCTVHttp.get(playUrl,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var html=typeof r.data==='string'?r.data:'';
  var m=html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?/)||html.match(/https?:\/\/[^\s"'<>]+\.mp4(?:[^\s"'<>]*)?/);
  if(m&&m[0]){
    var url=siteSafeURL(m[0]);
    if(url)return [{name:'原站线路',url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
  }
  throw Error(Source.name+'暂不提供公开播放地址：分集播放需站内加密接口返回播放地址，页面未提供');
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
