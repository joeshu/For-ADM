/* 韩小圈 CCTVHost 适配器：MacCMS 韩剧站公开目录/详情/分集。
 * 站点：https://www.jennyhow.com（SSR，jQuery 前端）。
 * 注意：本机到该站的连接被服务端拒绝（TLS 握手后空回复 / HTTP 444），
 * 2026-11-12 未能从本机实站验证；以下路由与解析均按交接文档
 * （2026-11-12 实站验证：分类 /hxq/{1..4}.html、详情 /hanxiaoquan/{id}.html、
 * 搜索 /index.php/vod/search.html?wd=、联想 /index.php/ajax/suggest?mid=1&wd=）
 * 实现，并在结构不符或命中挑战页时明确报错、不伪造数据。
 * 使用前请先在 iPhone（国内网络）上实测首页/分类/详情/分集播放页。 */
var Source={"id":"hanxiaoquan","name":"韩小圈","origin":"https://www.jennyhow.com","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'韩小圈公开目录与详情（MacCMS；分集播放页结构待实站确认，搜索可能被挑战页拦截）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'最新韩剧',value:'1'},{title:'韩国电影',value:'2'},{title:'韩国综艺',value:'3'},{title:'韩国动漫',value:'4'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
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
  if(CHALLENGE.test(html))throw Error(Source.name+'返回了验证页（请稍候/人机验证），当前网络无法访问');
  return html;
}
/* MacCMS 列表卡片：<a href="/hanxiaoquan/{id}.html">…封面…标题…备注…</a> */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a[^>]+href="([^"]*\/hanxiaoquan\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g,m;
  while((m=re.exec(html))){
    var id=m[2];if(seen[id])continue;seen[id]=1;
    var block=m[3];
    var img=(block.match(/data-original="([^"]+)"/)||block.match(/data-background="([^"]+)"/)||block.match(/src="([^"]+)"/)||[])[1];
    var title=siteText(block);
    if(!title)continue;
    /* 卡片文本常把标题与集数/备注连在一起，只取第一行当标题。 */
    title=title.split(/\s{2,}|\n/)[0].trim();
    var note='';
    var nm=block.match(/(更新至[^<\s]{1,20}|全\d+集|第\d+集|连载\d+集)/);
    if(nm)note=nm[1];
    var link=siteLink('vod',{id:id});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(img||'')),posterPath:siteSafeURL(siteAbs(img||'')),
      description:note,mediaType:'tv',labels:[]});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(['1','2','3','4'].indexOf(cid)<0)cid='1';
  var url=Source.origin+'/hxq/'+cid+(page>1?'-'+page:'')+'.html';
  return siteParseCards(await siteGetHtml(url)).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  /* 1) MacCMS 联想接口，常返回 JSON；2) 站内搜索页。任一命中挑战页即报错。 */
  try{
    var r=await CCTVHttp.get(Source.origin+'/index.php/ajax/suggest?mid=1&wd='+encodeURIComponent(kw),{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:8000});
    var data=r.data;
    if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){}}
    var rows=siteArray(data&&(data.data||data.list||data));
    if(rows.length){
      var out=[],seen=Object.create(null);
      rows.forEach(function(row){
        var id=String(siteGet(row,['id','vod_id'])||'');if(!/^\d+$/.test(id)||seen[id])return;seen[id]=1;
        var title=siteText(siteGet(row,['name','title','vod_name']));if(!title)return;
        var link=siteLink('vod',{id:id});
        out.push({id:link,type:'url',link:link,title:title,coverUrl:siteSafeURL(siteAbs(String(siteGet(row,['pic','cover','vod_pic'])||''))),posterPath:siteSafeURL(siteAbs(String(siteGet(row,['pic','cover','vod_pic'])||''))),description:'',mediaType:'tv',labels:[]});
      });
      if(out.length)return out.slice(0,60);
    }
    if(typeof r.data==='string'&&CHALLENGE.test(r.data))throw Error('搜索被挑战页拦截');
  }catch(e){if(/挑战页/.test(String(e.message||'')))throw e;/* 联想接口不可用时落到搜索页 */}
  var html=await siteGetHtml(Source.origin+'/index.php/vod/search.html?wd='+encodeURIComponent(kw));
  return siteParseCards(html).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/hanxiaoquan/'+id+'.html');
  var title=siteText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)||[])[1]||'');
  if(!title){var ogt=html.match(/property="og:title" content="([^"]+)"/);if(ogt)title=siteText(ogt[1]);}
  if(!title)throw Error(Source.name+'未找到该影片（详情页结构可能已变化）');
  var cover='';
  var og=html.match(/property="og:image" content="([^"]+)"/)||html.match(/name="og:image" content="([^"]+)"/);
  if(og)cover=siteSafeURL(og[1]);
  var desc='';
  var dm=html.match(/剧情[：:][\s\S]{0,80}?>([^<]{10,600})/)||html.match(/<p[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  if(dm)desc=siteText(dm[1]);
  var cardLink=siteLink('vod',{id:id});
  var card={id:cardLink,type:'url',link:cardLink,title:title,coverUrl:cover,posterPath:cover,
    description:desc,mediaType:'tv',labels:[]};
  /* 分集：MacCMS 标准播放路由 /index.php/vod/play/id/{vid}/sid/{line}/nid/{ep}.html，
   * 按 sid 分线路；线路名优先取页内线路 Tab（云播资源/快播资源），取不到用“线路{sid}”。 */
  var lineNames=[],lnRe=/(云播资源|快播资源|高清线路|极速线路|默认线路)/g,lm;
  while((lm=lnRe.exec(html)))if(lineNames.indexOf(lm[1])<0)lineNames.push(lm[1]);
  var groups=Object.create(null),order=[];
  var epRe=/<a[^>]+href="([^"]*\/index\.php\/vod\/play\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g,em;
  while((em=epRe.exec(html))){
    if(em[2]!==id)continue;
    var sid=em[3];
    if(!groups[sid]){groups[sid]=[];order.push(sid);}
    groups[sid].push({nid:em[4],title:siteText(em[5])||('第'+em[4]+'集')});
  }
  if(!order.length){
    /* 兜底：任何含 play 的分集链接。 */
    var altRe=/<a[^>]+href="([^"]*play[^"]*)"[^>]*>([^<]{1,40})<\/a>/g,am;
    while((am=altRe.exec(html))){
      var t=siteText(am[2]);if(!/第?\d+[集话]|正片|预告/.test(t))continue;
      if(!groups['1']){groups['1']=[];order.push('1');}
      groups['1'].push({nid:am[1],title:t,href:am[1]});
    }
  }
  card.episodeItems=[];
  order.sort(function(a,b){return Number(a)-Number(b);});
  order.forEach(function(sid,idx){
    var lineName=lineNames[idx]||('线路'+sid);
    var list=groups[sid];
    list.sort(function(a,b){return (parseInt(a.nid,10)||0)-(parseInt(b.nid,10)||0);});
    list.forEach(function(ep){
      var epLink=ep.href?siteAbs(ep.href):siteLink('episode',{vodId:id,siteId:sid,episodeId:ep.nid});
      var children=order.map(function(otherSid){
        var other=(groups[otherSid]||[]).find(function(x){return x.nid===ep.nid||x.title===ep.title;});
        if(!other)return null;
        var otherLink=other.href?siteAbs(other.href):siteLink('episode',{vodId:id,siteId:otherSid,episodeId:other.nid});
        return {id:otherLink,type:'url',link:otherLink,title:(lineNames[order.indexOf(otherSid)]||('线路'+otherSid))+' · '+other.title};
      }).filter(Boolean);
      card.episodeItems.push({id:epLink,type:'url',link:epLink,title:ep.title,coverUrl:cover,
        childItems:children.length>1?children:[{id:epLink,type:'url',link:epLink,title:lineName+' · '+ep.title}]});
    });
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),siteId=siteQueryValue(link,'siteId'),episodeId=siteQueryValue(link,'episodeId');
  var playUrl='';
  if(/^https?:\/\//i.test(link)&&/play/i.test(link))playUrl=link;
  else if(siteIdOK(vodId)&&siteIdOK(episodeId)&&siteId)
    playUrl=Source.origin+'/index.php/vod/play/id/'+vodId+'/sid/'+siteId+'/nid/'+episodeId+'.html';
  if(!playUrl)throw Error('请选择'+Source.name+'中的影片分集');
  var html=await siteGetHtml(playUrl);
  var m3u8=(html.match(/data-hls=["']([^"']+\.m3u8[^"']*)["']/)||html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/)||html.match(/vPath\s*=\s*["']([^"']+)["']/));
  var url=m3u8?siteSafeURL(m3u8[1]):'';
  if(!url)throw Error(Source.name+'未找到公开播放地址（分集播放页结构待实站确认）');
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
