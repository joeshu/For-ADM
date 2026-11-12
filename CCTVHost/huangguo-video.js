/* 黄果剧场 CCTVHost 适配器：公开目录/详情/分集与可播直链（18+ 成人站）。
 * 站点：https://huangguo.video（SSR 直出，卡片与分集嵌在页面 HTML 里）。
 * 实站验证 2026-11-12（本机可达）：首页剧集卡片、/videos?category=1..4
 * （1 MV/音乐剧、2 短片、3 连续剧、4 片段，每页 20 条，分页有效）、
 * /search?q=（?page= 被忽略）、/series/{slug} 详情（og 标签 + 分集芯片）、
 * /video/{slug} 播放页含 data-hls="/uploads/content/video/{id}/master.m3u8"。
 * 播放：master.m3u8 直接返回 480p/720p 变体（变体与分片自带时效签名
 * 参数），分片 AES-128 加密、密钥由播放器按相对地址 /api/hls_key/…
 * 正常取回；本机实测变体清单 200、分片 200（752,944 字节）。 */
var Source={"id":"huangguo-video","name":"黄果剧场","origin":"https://huangguo.video","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'黄果剧场公开目录与详情（18+ 成人站；分集为公开 HLS 直链）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'3',enumOptions:[{title:'连续剧',value:'3'},{title:'MV/音乐剧',value:'1'},{title:'短片',value:'2'},{title:'片段',value:'4'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
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

function siteUnescape(s){
  return String(s||'').replace(/&#(\d+);/g,function(_,n){return String.fromCharCode(Number(n));})
    .replace(/&#x([0-9a-fA-F]+);/g,function(_,n){return String.fromCharCode(parseInt(n,16));})
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
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
/* SSR 卡片：<a href="/series/{slug}"> 或 <a href="/video/{slug}">，内含
 * <img src=封面 alt=标题> 与“更新至第N集”备注。 */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a[^>]+href="\/(series|video)\/([a-zA-Z0-9]+)"[^>]*>([\s\S]*?)<\/a>/g,m;
  while((m=re.exec(html))){
    var kind=m[1],slug=m[2],key=kind+':'+slug;
    if(seen[key])continue;seen[key]=1;
    var block=m[3];
    var img=(block.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/)||block.match(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]+)"/)||[]);
    var title=siteUnescape(siteText(img[2]||img[1]||''));
    if(!title)continue;
    var cover=siteSafeURL(siteAbs(img[1]||img[2]||''));
    var note=(block.match(/(更新至第\d+集|全\d+集|第\d+集)/)||[])[1]||'';
    var link=kind==='series'?siteLink('vod',{series:slug}):siteLink('vod',{video:slug});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
      description:siteUnescape(siteText(note)),mediaType:'tv',labels:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'3'),page=sitePage(p.page);
  if(['1','2','3','4'].indexOf(cid)<0)cid='3';
  var url=Source.origin+'/videos?category='+cid+(page>1?'&page='+page:'');
  return siteParseCards(await siteGetHtml(url)).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  if(page>1)return []; /* ?page= 参数会被服务端忽略，第 2 页与第 1 页完全相同。 */
  return siteParseCards(await siteGetHtml(Source.origin+'/search?q='+encodeURIComponent(kw))).slice(0,60);
}
function siteOg(html,name){
  var m=html.match(new RegExp('property="og:'+name+'" content="([^"]*)"'))||html.match(new RegExp('name="'+name+'" content="([^"]*)"'));
  return m?siteUnescape(siteText(m[1])):'';
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var series=siteQueryValue(link,'series'),video=siteQueryValue(link,'video');
  if(series){
    if(!/^[a-zA-Z0-9]+$/.test(series))throw Error('影片链接不属于'+Source.name);
    var html=await siteGetHtml(Source.origin+'/series/'+series);
    var title=siteOg(html,'title').replace(/ · 黄果剧场$/,'')||siteText((html.match(/<title>([^<]*)<\/title>/)||[])[1]||'').replace(/ · 黄果剧场$/,'');
    if(!title)throw Error(Source.name+'未找到该剧集');
    var cover=siteSafeURL(siteAbs(siteOg(html,'image')));
    var cardLink=siteLink('vod',{series:series});
    var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
      description:siteOg(html,'description'),mediaType:'tv',labels:[]};
    /* 分集芯片：<a href="/video/{vslug}" class="series-ep-chip" title="第N集 · M:SS"> */
    var eps=[],seen=Object.create(null);
    var tagRe=/<a[^>]+href="\/video\/([a-zA-Z0-9]+)"[^>]*>/g,tm;
    while((tm=tagRe.exec(html))){
      var tag=tm[0];
      if(tag.indexOf('series-ep-chip')<0)continue;
      var vslug=tm[1];if(seen[vslug])continue;seen[vslug]=1;
      var t=(tag.match(/title="第(\d+)集 · ([0-9:]+)"/)||[])[1];
      if(!t)continue;
      eps.push({vslug:vslug,num:Number(t),dur:(tag.match(/title="第\d+集 · ([0-9:]+)"/)||[])[1]||''});
    }
    eps.sort(function(a,b){return a.num-b.num;});
    card.episodeItems=eps.map(function(ep){
      var epLink=siteLink('episode',{video:ep.vslug});
      var t='第'+ep.num+'集'+(ep.dur?' · '+ep.dur:'');
      return {id:epLink,type:'url',link:epLink,title:t,coverUrl:cover,
        childItems:[{id:epLink,type:'url',link:epLink,title:'原站线路 · '+t}]};
    });
    return card;
  }
  if(video){
    if(!/^[a-zA-Z0-9]+$/.test(video))throw Error('影片链接不属于'+Source.name);
    var vhtml=await siteGetHtml(Source.origin+'/video/'+video);
    var vtitle=siteOg(vhtml,'title').replace(/ · 黄果剧场$/,'')||siteText((vhtml.match(/<title>([^<]*)<\/title>/)||[])[1]||'').replace(/ · 黄果剧场$/,'');
    if(!vtitle)throw Error(Source.name+'未找到该视频');
    var vcover=siteSafeURL(siteAbs(siteOg(vhtml,'image')));
    var vlink=siteLink('vod',{video:video});
    var epLink2=siteLink('episode',{video:video});
    return {id:vlink,type:'url',link:vlink,title:vtitle,coverUrl:vcover,posterPath:vcover,
      description:siteOg(vhtml,'description'),mediaType:'tv',labels:[],
      episodeItems:[{id:epLink2,type:'url',link:epLink2,title:'正片',coverUrl:vcover,
        childItems:[{id:epLink2,type:'url',link:epLink2,title:'原站线路 · 正片'}]}]};
  }
  throw Error('影片链接不属于'+Source.name);
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var video=siteQueryValue(link,'video');
  if(!/^[a-zA-Z0-9]+$/.test(video))throw Error('请选择'+Source.name+'中的影片分集');
  var html=await siteGetHtml(Source.origin+'/video/'+video);
  var hls=(html.match(/data-hls="([^"]+\.m3u8[^"]*)"/)||[])[1]||'';
  var url=siteSafeURL(siteAbs(hls));
  if(!url)throw Error(Source.name+'未找到公开播放地址（播放页未给出 HLS 地址）');
  /* 媒体路径会校验 UA：短 UA（如 Mozilla/5.0）直接 403，完整浏览器 UA
   * 才 200（2026-11-12 本机 A/B 验证），故随直链带上浏览器 UA。 */
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
