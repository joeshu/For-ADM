/* 青空次元 CCTVHost 适配器：公开番剧目录/详情（仅非成人内容）。
 * 站点：https://www.sorani.net（SSR 直出，列表与详情数据嵌在页面 JSON 里）。
 * 实站验证 2026-11-12（本机可达）：首页 123 条、/anime/explore?categoryId=1/2、
 * /anime/mal/{id} 详情含分集 JSON；?page= 与 ?keyword= 参数会被服务端忽略，
 * 故分类只取第 1 页，搜索改为首页目录本地过滤（标题/别名/拼音）。
 * 成人过滤：含 肉番/里番/成人/R18 等标签的条目一律跳过；分类只映射
 * TV番剧/剧场动画/特摄剧场/国漫。播放：SSR 页面不含媒体地址（playUrl 为 null），
 * 播放地址需站内接口返回，暂不提供直链，resolveResource 会明确报错。 */
var Source={"id":"sorani","name":"青空次元","origin":"https://www.sorani.net","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'青空次元公开番剧目录与详情（仅非成人分类；搜索覆盖首页目录；暂不提供播放直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'TV番剧',value:'1'},{title:'剧场动画',value:'2'},{title:'特摄剧场',value:'5'},{title:'国漫',value:'7'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名、别名或拼音（仅检索首页目录）'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\\+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* 成人标签：命中其一即整条跳过，不进入任何列表/详情/搜索结果。 */
var ADULT_TAGS=['肉番','里番','成人','R18','R-18','エロ','色情','H漫'];
function siteIsAdult(item){
  var hay=(siteGet(item,['tags','tagText'])||'')+' '+(siteArray(item.tagList).join(' '))+' '+siteText(item.title);
  for(var i=0;i<ADULT_TAGS.length;i++){var t=ADULT_TAGS[i];if(t&&hay.indexOf(t)>=0)return true;}
  return false;
}
function siteCard(item){
  if(!item||typeof item!=='object'||siteIsAdult(item))return null;
  var id=String(siteGet(item,['id','videoId'])||'');
  if(!/^\d+$/.test(id))return null;
  var title=siteText(item.title);if(!title)return null;
  var image=siteSafeURL(siteGet(item,['cover','coverLarge','coverThumb','coverSmall']));
  var link=siteLink('vod',{id:id});
  var labels=siteArray(item.tagList).map(siteText).filter(Boolean).slice(0,4);
  return {id:link,type:'url',link:link,title:title,coverUrl:image,posterPath:image,
    description:siteText(siteGet(item,['categoryName','area'])||''),mediaType:'tv',
    labels:labels.map(function(name){return {name:name};})};
}
/* 页面内嵌的条目是 JS 对象字面量（键无引号），按 {id:NNN,title:"..." 定位，
 * 再在到下一个条目为止的片段里取其余字段，避免整段 JSON 解析。 */
function siteParseItems(html){
  var out=[],seen=Object.create(null);
  var re=/\{id:(\d+),title:"((?:[^"\\]|\\.)*)"/g,m;
  while((m=re.exec(html))){
    var id=m[1];if(seen[id])continue;seen[id]=1;
    var next=html.indexOf('{id:',m.index+1),span=html.slice(m.index,next<0?m.index+4000:next);
    var field=function(name){var r=new RegExp(name+':"((?:[^"\\\\]|\\\\.)*)"');var x=span.match(r);return x?siteText(x[1].replace(/\\"/g,'"')):'';};
    var num=function(name){var x=span.match(new RegExp(name+':(\\d+)'));return x?x[1]:'';};
    var tags=field('tags'),tagList=[];
    var tl=span.match(/tagList:\[([^\]]*)\]/);
    if(tl)tagList=tl[1].split(',').map(function(s){return siteText(s.replace(/^"|"$/g,''));}).filter(Boolean);
    if(!tagList.length&&tags)tagList=tags.split(',').map(siteText).filter(Boolean);
    out.push({id:id,title:siteText(m[2]),alias:field('alias'),pinyin:field('pinyin'),
      categoryId:num('categoryId'),categoryName:field('categoryName'),
      cover:siteSafeURL(field('cover')||field('coverLarge')||field('coverThumb')),
      tags:tags,tagList:tagList});
  }
  return out;
}
async function siteGetHtml(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:10000});
  var html=typeof r.data==='string'?r.data:'';
  if(!html)throw Error(Source.name+'返回空页面');
  return html;
}
async function loadHome(){
  var items=siteParseItems(await siteGetHtml(Source.origin+'/'));
  return items.map(siteCard).filter(Boolean).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(page>1)return []; /* ?page= 参数会被服务端忽略，第 2 页与第 1 页完全相同。 */
  var items=siteParseItems(await siteGetHtml(Source.origin+'/anime/explore?categoryId='+encodeURIComponent(cid)));
  return items.filter(function(x){return String(x.categoryId)===cid;}).map(siteCard).filter(Boolean).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var needle=kw.toLowerCase();
  var items=siteParseItems(await siteGetHtml(Source.origin+'/'));
  return items.filter(function(x){
    return (x.title+' '+x.alias+' '+x.pinyin).toLowerCase().indexOf(needle)>=0;
  }).map(siteCard).filter(Boolean).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/anime/mal/'+id);
  var items=siteParseItems(html),item=null;
  for(var i=0;i<items.length;i++)if(String(items[i].id)===id){item=items[i];break;}
  if(!item)throw Error(Source.name+'未找到该番剧');
  if(siteIsAdult(item))throw Error('该条目含成人标签，已跳过');
  var card=siteCard(item);if(!card)throw Error('影片详情缺少标题或标识');
  var desc='';
  var dm=html.match(/"description":"((?:[^"\\]|\\.)*)"/)||html.match(/synopsis:"((?:[^"\\]|\\.)*)"/);
  if(dm)desc=siteText(dm[1].replace(/\\"/g,'"'));
  card.description=desc;
  var episodes=[];
  var epRe=/\{episodeId:(\d+),videoId:(\d+),videoTitle:(null|"[^"]*"),title:"((?:[^"\\]|\\.)*)",playUrl:(null|"[^"]*"),[^}]*?episodeLabel:"([^"]*)",episodeOrder:(\d+),isVip:(true|false)/g,em;
  while((em=epRe.exec(html))){
    episodes.push({id:em[1],title:siteText(em[4])||('第'+em[6]+'集'),order:Number(em[6]),isVip:em[7]==='true'});
  }
  episodes.sort(function(a,b){return a.order-b.order;});
  var lineLink=function(ep){return siteLink('episode',{vodId:id,episodeId:ep.id});};
  card.episodeItems=episodes.map(function(ep){
    return {id:lineLink(ep),type:'url',link:lineLink(ep),title:ep.title+(ep.isVip?'（VIP）':''),coverUrl:card.coverUrl,
      childItems:[{id:lineLink(ep),type:'url',link:lineLink(ep),title:'青空 · '+ep.title}]};
  });
  return card;
}
async function resolveResource(p){
  /* SSR 详情里 playUrl 为 null，分集页也不含媒体地址；播放地址由站内接口在
   * 点击分集后返回，未验证载荷与鉴权，不猜、不绕。 */
  throw Error(Source.name+'暂不提供公开播放地址：分集播放地址需站内接口返回，页面未提供');
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
