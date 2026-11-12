/* 红果短剧 CCTVHost 适配器：公开目录与详情（metadata-only，不含播放）。
 * 站点：https://hongguoduanju.com（SSR 直出）。
 * 实站验证 2026-11-12（本机可达）：首页/分类/详情均可抓；详情页含
 * application/ld+json（@graph，TVSeries + episode[]）；分类支持 ?page=N。
 * 播放：正片走 CloudFront 签名 + 设备注册，播放页 SSR 不含任何可播地址，
 * 不复刻签名/设备注册，resolveResource 会明确报错。搜索：/api/search/*
 * 受安全 SDK 保护，直接调用会失败，search 同样明确报错。
 * 分集：SSR 只公开可免费访问的前几集（本页 seriesDetail.accessible_episode_cnt=5，
 * 其余集数需 App 内签名，CCTVHost 内置的红果适配已覆盖该链路），详情只列这几集。 */
var Source={"id":"hongguo","name":"红果短剧","origin":"https://hongguoduanju.com","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'红果短剧公开目录与详情（只做浏览与详情；正片需 App 内签名播放，搜索接口受保护，暂不提供）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'real-drama',enumOptions:[{title:'真人剧',value:'real-drama'},{title:'漫剧',value:'comic-drama'},{title:'AI剧',value:'ai-drama'},{title:'漫画',value:'comic'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/<!--[^>]*-->/g,'').replace(/\s+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
var CATEGORIES={ 'real-drama':1, 'comic-drama':1, 'ai-drama':1, 'comic':1 };

/* 首页与分类页卡片 class 不同（pc-card-vcXcvF / pc-card-DQXf3W），
 * 标题/封面/集数/标签的取法按两种结构容错：标题优先取 img alt。 */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a[^>]*href="\/detail\?series_id=(\d+)"[^>]*>([\s\S]*?)<\/a>/g,m;
  while((m=re.exec(html))){
    var sid=m[1];if(seen[sid])continue;seen[sid]=1;
    var body=m[2];
    var title='';
    var alt=body.match(/<img[^>]*alt="([^"]+)"/);
    if(alt&&siteText(alt[1]))title=siteText(alt[1]);
    if(!title){var t=body.match(/pc-card-title-tQOqhJ">([^<]+)/)||body.match(/pc-title-l_s3n8[^>]*>([^<]+)/);if(t)title=siteText(t[1]);}
    if(!title)continue;
    var cover='';
    var img=body.match(/image-PWlIcn" src="([^"]+)"/)||body.match(/srcSet="([^"]+\.webp)"/);
    if(img)cover=siteSafeURL(img[1]);
    var note='';
    var ep=body.match(/pc-episode-[A-Za-z0-9_-]+">([^<]+)/);
    if(ep)note=siteText(ep[1]);
    var labels=[];
    var tagRe=/pc-tag-(?:YrEEv6|text-vEpsxC)[^>]*>([^<]+)/g,tm;
    while((tm=tagRe.exec(body)))labels.push(siteText(tm[1]));
    var link=siteLink('vod',{seriesId:sid});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
      description:note,mediaType:'tv',labels:labels.slice(0,4).map(function(name){return {name:name};})});
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
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'real-drama'),page=sitePage(p.page);
  if(!CATEGORIES[cid])cid='real-drama';
  var url=Source.origin+'/category/'+cid+(page>1?'?page='+page:'');
  return siteParseCards(await siteGetHtml(url)).slice(0,60);
}
async function search(p){
  /* /api/search/result/ 受安全 SDK 保护，直接调用会被拦截；不猜公开搜索路由。 */
  throw Error(Source.name+'搜索接口受安全 SDK 保护，暂不提供站内搜索');
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var sid=siteQueryValue(link,'seriesId');if(!/^\d{10,}$/.test(sid))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/detail?series_id='+sid);
  var card=null,episodes=[],desc='';
  var ld=html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if(ld){
    try{
      var data=JSON.parse(ld[1]),nodes=siteArray(data['@graph']||data);
      var series=null;
      for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n&&(siteArray(n.episode).length||String(n['@type']||'').indexOf('TVSeries')>=0)){series=n;break;}}
      if(series){
        var title=siteText(series.name||'');
        var image=typeof series.image==='string'?series.image:(series.image&&series.image.url)||'';
        if(!image){var og=html.match(/property="og:image" content="([^"]+)"/);if(og)image=og[1];}
        desc=siteText(series.description||'');
        var link0=siteLink('vod',{seriesId:sid});
        card={id:link0,type:'url',link:link0,title:title,coverUrl:siteSafeURL(image),posterPath:siteSafeURL(image),
          description:desc,mediaType:'tv',labels:[]};
        var eps=siteArray(series.episode);
        eps.sort(function(a,b){return (Number(a.episodeNumber)||0)-(Number(b.episodeNumber)||0);});
        episodes=eps.map(function(ep){
          var num=Number(ep.episodeNumber)||0;
          var epLink=siteLink('episode',{seriesId:sid,episode:num});
          return {id:epLink,type:'url',link:epLink,title:siteText(ep.name)||('第'+num+'集'),coverUrl:card.coverUrl,
            childItems:[{id:epLink,type:'url',link:epLink,title:'红果短剧 · '+(siteText(ep.name)||('第'+num+'集'))}]};
        });
      }
    }catch(_){/* JSON-LD 解析失败时走下面的 DOM 兜底 */}
  }
  if(!card){
    var title=siteText((html.match(/<title[^>]*>([^<]+)<\/title>/)||[])[1]||'').replace(/_高清完整版全集免费观看_红果短剧$/,'');
    var og=html.match(/property="og:image" content="([^"]+)"/);
    var intro=html.match(/简介：<!-- -->([\s\S]{0,600}?)</);
    if(!title)throw Error(Source.name+'未找到该短剧');
    desc=siteText(intro?intro[1]:'');
    var link1=siteLink('vod',{seriesId:sid});
    card={id:link1,type:'url',link:link1,title:title,coverUrl:siteSafeURL(og?og[1]:''),posterPath:siteSafeURL(og?og[1]:''),
      description:desc,mediaType:'tv',labels:[]};
  }
  card.episodeItems=episodes;
  return card;
}
async function resolveResource(p){
  /* 播放页 SSR 不含任何可播地址；正片走 CloudFront 签名 + 设备注册，
   * 不复刻签名链路。CCTVHost 内置的红果播放请用 cctvhost 自带的红果适配。 */
  throw Error(Source.name+'暂不提供公开播放地址：正片需 App 内签名播放');
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
