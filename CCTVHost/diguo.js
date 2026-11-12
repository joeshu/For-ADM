/* 帝果短剧 CCTVHost 适配器：公开目录/详情/分集（18+ 成人站）。
 * 注意：thu.ediayikma.cc（帝果入口，重定向到 ec2b.rlhjeyuvw.cc）与 huangguoai.com 是同一应用、
 * 同一份目录（2026-11-12 实测 /api/home 与 /api/videos/117 完全相同），本文件是 huangguo.js 的
 * 同源薄变体（仅 Source id/name/origin 不同，解析逻辑完全相同）。origin 直接取重定向目标
 * ec2b.rlhjeyuvw.cc：2026-11-12 实测 thu 域的 /api/home 持续 502（nginx Bad Gateway），
 * 而 ec2b 域的 /api/home 与 /api/videos/117 均 200；若 ec2b 域名轮换，需按发布页重取。
 * 站点：https://huangguoai.com（REST API，无需登录即可取目录与详情）。
 * 同款镜像：thu.ediayikma.cc（重定向到 ec2b.rlhjeyuvw.cc）——2026-11-12
 * 实测与 huangguoai.com 是同一个应用、同一份目录：/api/home 横幅
 * video_id 完全相同、/api/videos/117 返回字节数与标题/集数相同，
 * 故一个适配器覆盖两者，origin 取 huangguoai.com。
 * 播放：GET /api/videos/{id}/play 返回 video_url/video_key/video_iv
 * 全部为空（预览 token/登录鉴权控制），resolveResource 明确报错，
 * 不绕过鉴权、不猜播放地址。 */
var Source={"id":"diguo","name":"帝果短剧","origin":"https://ec2b.rlhjeyuvw.cc","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'帝果短剧公开目录与详情（18+ 成人站；暂不提供播放直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'ai-duanju',enumOptions:[{title:'短剧',value:'ai-duanju'},{title:'漫剧',value:'ai-manju'},{title:'AI换脸',value:'ai-huanlian'},{title:'AI魔改',value:'ai-mogai'},{title:'最近更新',value:'new'},{title:'当前最热',value:'popular'},{title:'正在播放',value:'watchings'},{title:'小蓝原创',value:'xiaolan'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
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

function siteAbs(u){
  if(!u)return '';
  if(/^https?:\/\//i.test(u))return u;
  if(u.indexOf('//')===0)return 'https:'+u;
  if(u.charAt(0)==='/')return Source.origin+u;
  return Source.origin+'/'+u;
}
async function siteGetJson(url){
  /* 注意：/api/videos/sort/* 在客户端声明 Accept-Encoding: gzip 时会回
   * 缓存的失败响应 {"msg":"获取视频列表失败"}（2026-11-12 本机 A/B 验证：
   * gzip/gzip,deflate 失败，identity/br 正常）；故全部请求改用 identity。 */
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/','Accept-Encoding':'identity'},timeout:10000});
  var data=r.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'返回了非 JSON 数据');}}
  if(!data||typeof data!=='object')throw Error(Source.name+'返回空数据');
  return data;
}
/* /api/home、/api/videos/category/*、/api/search 返回的条目字段相同。 */
function siteCard(item){
  if(!item||typeof item!=='object')return null;
  var id=String(siteGet(item,['id','video_id'])||'');
  if(!/^\d+$/.test(id))return null;
  var title=siteText(item.title);if(!title)return null;
  var cover=siteSafeURL(siteAbs(String(siteGet(item,['cover','image'])||'')));
  var link=siteLink('vod',{id:id});
  var desc=siteText(siteGet(item,['desc','description'])||'');
  var note='';
  var eps=siteGet(item,['episode_count','total_episodes']);
  if(eps!=null&&eps!=='')note='共'+eps+'集';
  if(siteGet(item,['score'])!=null&&siteGet(item,['score'])!=='')note=(note?note+' · ':'')+'评分'+item.score;
  var labels=siteArray(item.tags).map(siteText).filter(Boolean).slice(0,4);
  return {id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
    description:desc||note,mediaType:'tv',labels:labels.map(function(name){return {name:name};})};
}
function siteDedupe(items){
  var out=[],seen=Object.create(null);
  items.forEach(function(x){if(!x)return;var k=x.id;if(seen[k])return;seen[k]=1;out.push(x);});
  return out;
}
async function loadHome(){
  var d=await siteGetJson(Source.origin+'/api/home');
  var data=d.data||{};
  var out=[];
  siteArray(data.banners).forEach(function(b){
    var vid=String(b.video_id||'');
    if(!/^\d+$/.test(vid))return;
    var link=siteLink('vod',{id:vid});
    out.push({id:link,type:'url',link:link,title:siteText(b.title)||('视频 '+vid),
      coverUrl:siteSafeURL(siteAbs(String(b.image||''))),posterPath:siteSafeURL(siteAbs(String(b.image||''))),
      description:siteText(b.desc||''),mediaType:'tv',labels:[]});
  });
  siteArray(data.featured).forEach(function(x){out.push(siteCard(x));});
  siteArray(data.latest).forEach(function(x){out.push(siteCard(x));});
  siteArray(data.cate_rec).forEach(function(c){siteArray(c.videos).forEach(function(x){out.push(siteCard(x));});});
  return siteDedupe(out).slice(0,60);
}
var SORTS=['new','popular','watchings','xiaolan'];
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'ai-duanju'),page=sitePage(p.page);
  var base=SORTS.indexOf(cid)>=0?Source.origin+'/api/videos/sort/':Source.origin+'/api/videos/category/';
  var d=await siteGetJson(base+encodeURIComponent(cid)+'?page='+page);
  var items=siteArray((d.data||{}).items);
  return items.map(siteCard).filter(Boolean).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  var d=await siteGetJson(Source.origin+'/api/search?q='+encodeURIComponent(kw)+'&page='+page);
  var items=siteArray((d.data||{}).items);
  return items.map(siteCard).filter(Boolean).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var d=await siteGetJson(Source.origin+'/api/videos/'+id);
  var v=d.data||d;
  var title=siteText(v.title);if(!title)throw Error(Source.name+'未找到该影片');
  var cover=siteSafeURL(siteAbs(String(siteGet(v,['cover'])||'')));
  var cardLink=siteLink('vod',{id:id});
  var actors=siteArray(v.actors).map(function(a){return siteText(a&&a.name);}).filter(Boolean).join('、');
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:siteText(v.description||''),mediaType:'tv',labels:siteArray(v.tags).map(siteText).filter(Boolean).slice(0,4).map(function(name){return {name:name};})};
  if(actors)card.description=(card.description?card.description+'\n':'')+'演员：'+actors;
  var episodes=siteArray(v.episodes).map(function(ep){
    var num=Number(ep.ep_num)||0;
    var t=siteText(ep.title)||('第'+num+'集');
    return {num:num,title:t,duration:ep.duration};
  }).filter(function(ep){return ep.num>0;});
  episodes.sort(function(a,b){return a.num-b.num;});
  card.episodeItems=episodes.map(function(ep){
    var epLink=siteLink('episode',{vodId:id,episode:ep.num});
    var title='第'+ep.num+'集'+(ep.title&&ep.title!==('第'+ep.num+'集')?' · '+ep.title:'');
    return {id:epLink,type:'url',link:epLink,title:title,coverUrl:cover,
      childItems:[{id:epLink,type:'url',link:epLink,title:'原站线路 · '+title}]};
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),episode=siteQueryValue(link,'episode');
  if(!/^\d+$/.test(vodId))throw Error('请选择'+Source.name+'中的影片分集');
  /* /api/videos/{id}/play 正常返回 200，但 video_url/video_key/video_iv
   * 全部为空——播放地址由预览 token/登录鉴权控制，不绕过鉴权。 */
  var d=await siteGetJson(Source.origin+'/api/videos/'+vodId+'/play');
  var play=(d.data||d)||{};
  var url=siteSafeURL(String(play.video_url||''));
  if(!url)throw Error(Source.name+'暂不提供公开播放地址：正片播放地址由预览 token/登录鉴权控制（第'+(episode||'?')+'集 /api/videos/'+vodId+'/play 返回空地址），不绕过鉴权');
  return [{name:'原站线路',url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
