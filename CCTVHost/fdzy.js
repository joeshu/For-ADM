/* 饭搭子影视 CCTVHost 适配器：MacCMS 站公开目录/详情/分集播放。
 * 站点：https://fdzys.com（mizhiady 模板；详情用拼音 slug 路由 /movie/{slug}）。
 * 实站验证 2026-11-13（本机可达）：首页含影片卡（路由 /tv/{slug}、/movie/{slug}
 * 等，卡片锚点内含 data-src 海报与 <div class="title"> 片名）、分类 /vodtype/1.html
 * （1=电影，2=电视剧，3=动漫，4=综艺，5=体育；实测站内无服务端翻页，/vodtype/1-2.html
 * 等均返回与第 1 页相同内容，适配器第 2 页起返回空）、搜索
 * /index.php/ajax/suggest?mid=1&wd=仙逆 返回 7 条（含 id 293 仙逆、5998 仙逆剧场版
 * 神临之战；en 字段即详情 slug）、详情 /movie/xian-ni 含 10 条线路与 166 集
 * （分集为相对路径 /dongman/{slug}/{ep}[?sid=N]，路由随分类变化）、播放
 * /dongman/{slug}/{ep} 的 player_aaaa.url 是直链分享地址
 * （https://play.phimgood.com/share/...）。该分享地址本机 Range 请求返回
 * 403 "The region has been denied"（视频 CDN 地理封锁），未验证可播；iPhone 上需复测。
 * 注意：/search?wd= 只返回不带结果的空壳页，搜索改走 suggest JSON 接口。
 * 播放地址一律取站内 player_aaaa 原样返回，不猜不编。 */
var Source={"id":"fdzy","name":"饭搭子影视","origin":"https://fdzys.com","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'饭搭子影视公开目录、详情与分集播放（MacCMS；播放地址来自站内 player_aaaa 直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'电视剧',value:'2'},{title:'动漫',value:'3'},{title:'综艺',value:'4'},{title:'体育',value:'5'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
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
var UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
var CHALLENGE=/请稍候|正在验证|challenge|人机验证|访问验证/i;
function siteAbs(u){
  if(!u)return '';
  if(/^http:\/\//i.test(u))return 'https://'+u.slice(7);
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
/* 首页/分类卡片：<a href="https://fdzys.com/{movie|tv|dongman|zongyi|duanju}/{slug}">…
 * <img class="mizhiady-defer-card-img" data-src="封面">…<div class="tag">全40集</div>…
 * <div class="title">片名</div>…</a>；锚点内约 4300 字符，标题在 title div 里。
 * 只有带海报图和 title div 的锚点才是影片卡（轮播横幅/导航链接没有）。 */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a[^>]+href="https:\/\/fdzys\.com\/((?:movie|tv|dongman|zongyi|duanju)\/[A-Za-z0-9-]+)"[^>]*>((?:(?!<\/a>)[\s\S]){0,6000}?)<div class="title">([^<]+)<\/div>/g,m;
  while((m=re.exec(html))){
    var path=m[1];if(seen[path])continue;
    var inner=m[2],title=siteText(m[3]);
    if(!title||title.length>40)continue;
    var img=(inner.match(/data-src="([^"]+)"/)||inner.match(/<img[^>]+src="([^"]+)"/)||[])[1]||'';
    if(!img)continue;
    seen[path]=1;
    var label=siteText((inner.match(/<div class="tag[^"]*"[^>]*>([^<]*)<\/div>/)||[])[1]||'');
    var link=siteLink('vod',{id:path});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(img)),posterPath:siteSafeURL(siteAbs(img)),
      description:label,mediaType:'tv',labels:label?[{name:label}]:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(['1','2','3','4','5'].indexOf(cid)<0)cid='1';
  /* 实测：/vodtype/{cid}-2.html、/vodtype/{cid}/2.html、?page=2 均返回与第 1 页
   * 相同的内容（站内无服务端翻页、无分页链接），翻页直接返回空，避免重复内容。 */
  if(page>1)return [];
  var url=Source.origin+'/vodtype/'+cid+'.html';
  return siteParseCards(await siteGetHtml(url)).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  if(page>1)return [];
  /* /search?wd= 只返回不带结果的空壳页；改走 MacCMS suggest JSON 接口。 */
  var headers={'User-Agent':UA,'Referer':Source.origin+'/'};
  var r=await CCTVHttp.get(Source.origin+'/index.php/ajax/suggest?mid=1&wd='+encodeURIComponent(kw),{headers:headers,timeout:10000});
  var data=r.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){throw Error(Source.name+'搜索接口返回了无效数据');}}
  var list=siteArray(data&&data.list),out=[],seen=Object.create(null);
  list.forEach(function(row){
    var slug=siteText(row&&row.en),title=siteText(row&&row.name);
    if(!slug||!title||seen[slug])return;seen[slug]=1;
    var link=siteLink('vod',{id:slug});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(row.pic||'')),posterPath:siteSafeURL(siteAbs(row.pic||'')),
      description:'',mediaType:'tv',labels:[]});
  });
  return out.slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var slug=siteQueryValue(link,'id');
  /* id 可能是卡片里的完整路由 tv/xian-ni，也可能是搜索 suggest 的裸 slug；裸 slug 走 /movie/（已验证通用）。 */
  var detailPath='';
  if(/^(?:movie|tv|dongman|zongyi|duanju)\/[A-Za-z0-9-]+$/.test(slug))detailPath=slug;
  else if(/^[A-Za-z0-9-]{1,100}$/.test(slug))detailPath='movie/'+slug;
  else throw Error('影片链接不属于'+Source.name);
  var bareSlug=detailPath.split('/')[1];
  var html=await siteGetHtml(Source.origin+'/'+detailPath);
  var rawTitle=siteText((html.match(/<title>([^<]+)<\/title>/)||[])[1]||'');
  var title=rawTitle.split('免费在线观看')[0].split(' 高清正片')[0].replace(/_+$/,'').replace(/\s*第\d+集\s*$/,'').trim();
  if(!title)throw Error(Source.name+'未找到该影片（详情页结构可能已变化）');
  var cover='';
  var og=html.match(/property="og:image" content="([^"]+)"/);
  if(og)cover=siteSafeURL(siteAbs(og[1]));
  if(!cover){var firstImg=html.match(/data-src="([^"]+)"/);if(firstImg)cover=siteSafeURL(siteAbs(firstImg[1]));}
  var desc='';
  var meta=html.match(/name="description" content="([^"]+)"/);
  if(meta)desc=siteText(meta[1]);
  var cardLink=siteLink('vod',{id:detailPath});
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:desc,mediaType:'tv',labels:[]};
  /* 线路 tab：<a href="#playlist{N}" data-toggle="tab">线路名</a>；
   * 分集 pane：<div id="playlist{N}" data-sid="N">…<div class="listitem">
   * <a href="/{route}/{slug}/{ep}[?sid=N]">集名</a></div>…（相对路径，路由随分类变化）。 */
  var tabs=[],tm;
  var tabRe=/<a[^>]+href="#(playlist\d+)"[^>]*>([\s\S]{0,80}?)<\/a>/g;
  while((tm=tabRe.exec(html))){
    var name=siteText(tm[2]);
    if(name)tabs.push({pane:tm[1],name:name});
  }
  var byEp=Object.create(null),order=[];
  tabs.forEach(function(tab){
    var start=html.indexOf('id="'+tab.pane+'"');
    if(start<0)return;
    var end=html.length;
    tabs.forEach(function(other){
      var o=html.indexOf('id="'+other.pane+'"',start+10);
      if(o>start&&o<end)end=o;
    });
    var seg=html.slice(start,end);
    /* 分集链接有相对（/dongman/{slug}/{ep}）和绝对（https://fdzys.com/movie/{slug}/{ep}）两种写法。 */
    var epRe=/<a[^>]+href="((?:https:\/\/fdzys\.com)?\/[^"]+)"[^>]*>([\s\S]{0,120}?)<\/a>/g,em;
    while((em=epRe.exec(seg))){
      var href=em[1],epTitle=siteText(em[2]);
      if(!epTitle||epTitle==='立即播放')continue;
      var parts=href.replace(/^https:\/\/fdzys\.com/i,'').split('?')[0].split('/').filter(Boolean);
      if(parts.length<3||parts[1]!==bareSlug)continue;
      var epSlug=parts[2];
      /* 按 epSlug 归组：不同线路集名写法可能不同（如 第01集 vs 第1集），标题取首次出现。 */
      var key=epSlug;
      if(!byEp[key]){byEp[key]={slug:epSlug,title:epTitle,hrefs:[]};order.push(key);}
      byEp[key].hrefs.push({href:href,name:tab.name});
    }
  });
  card.episodeItems=[];
  order.forEach(function(key){
    var row=byEp[key];
    var first=row.hrefs[0];
    var epLink=siteLink('episode',{u:first.href});
    var children=row.hrefs.map(function(h){
      var l=siteLink('episode',{u:h.href});
      return {id:l,type:'url',link:l,title:h.name+' · '+row.title};
    });
    card.episodeItems.push({id:epLink,type:'url',link:epLink,title:row.title,coverUrl:cover,
      childItems:children.length?children:[{id:epLink,type:'url',link:epLink,title:'原站线路 · '+row.title}]});
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
function siteBase64Decode(s){
  /* MacCMS encrypt=2 用标准 Base64；URL 本身是 ASCII，atob 足够。 */
  try{return decodeURIComponent(escape(atob(String(s).replace(/\s+/g,''))));}
  catch(_){try{return atob(String(s).replace(/\s+/g,''));}catch(__){return '';}}
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var u=siteQueryValue(link,'u');
  var playUrl='';
  if(u)playUrl=siteAbs(u);
  else if(/^https?:\/\//i.test(link)&&/\/movie\//i.test(link))playUrl=link;
  if(!playUrl)throw Error('请选择'+Source.name+'中的影片分集');
  var html=await siteGetHtml(playUrl);
  var player=sitePlayerJson(html);
  if(!player||!player.url)throw Error(Source.name+'未返回播放地址（分集播放页结构已变化）');
  var url=String(player.url);
  if(player.encrypt==1){try{url=decodeURIComponent(url);}catch(_){}}
  else if(player.encrypt==2){url=siteBase64Decode(url);}
  if(!url||!/^https:\/\//i.test(url))throw Error(Source.name+'未找到公开播放地址');
  return [{name:'饭搭子线路',url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
