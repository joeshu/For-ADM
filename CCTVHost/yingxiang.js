/* 映像星球 CCTVHost 适配器：MacCMS（mxpro 模板）公开目录/详情/直链。
 * 站点：https://www.yxxq50.cc（镜像站之一；yxxq.top 与 51/52/53 镜像返回
 * 同款“备用入口”落地页，50 号镜像为完整内容站）。
 * 实站验证 2026-11-13（本机可达）：
 *  - 首页、分类 /list/{1:电影,2:电视剧,3:综艺,4:动漫,39:短剧}.html、搜索
 *    /search/{关键词}-------------.html、详情 /html/*.html 均正常；
 *    搜索“仙逆”14 条，首条即仙逆（166 集）。
 *  - 分页被服务端忽略（/list/1-2.html 与第 1 页内容完全相同），故
 *    loadCatalog 只取第 1 页。
 *  - 详情页 5 条线路（TX线路/4K高清/线路①/线路②/线路⑨），播放页
 *    player_aaaa 的 url 即直链 m3u8（dytt/bfzy/ok/1080zyk 四条）；
 *    TX线路（qq）为腾讯视频页面，无直链，resolveResource 会明确报错，
 *    请切换其他线路。
 *  - 播放地址为原站直给的 m3u8；本机探测：四条直链 403/404（CDN 地理封锁
 *    或 dated 路径过期），最终播放需 iPhone 实测。
 * 广告卡（/go/ad/）只出现在边栏/热搜，不进入任何列表。 */
var Source={"id":"yingxiang","name":"映像星球","origin":"https://www.yxxq50.cc","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'映像星球公开目录与详情，直链 m3u8；TX线路为第三方视频页面，无直连地址。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'电视剧',value:'2'},{title:'综艺',value:'3'},{title:'动漫',value:'4'},{title:'短剧',value:'39'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\\u([\dA-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/\s+/g,' ').trim();};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function siteGetHtml(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:15000});
  var html=typeof r.data==='string'?r.data:'';
  if(!html)throw Error(Source.name+'返回空页面');
  return html;
}
/* 首页/分类/搜索卡片有两种样式：
 *  <a href="/html/VID.html" title="片名" class="module-poster-item …">
 *  <a href="/html/VID.html" class="module-card-item-poster">（片名在 img alt）
 * 只认带海报图的卡片锚点；纯文字链接（相关推荐）会被跳过，不会误占去重。 */
function siteParseCards(html){
  var out=[],seen=Object.create(null);
  var re=/<a href="(\/html\/[A-Za-z0-9]+\.html)"([^>]*)>/g,m;
  while((m=re.exec(html))){
    var href=m[1];if(seen[href])continue;
    var attrs=m[2],win=html.slice(m.index,m.index+2600);
    var title='';
    var ta=attrs.match(/title="([^"]+)"/);if(ta)title=siteText(ta[1]);
    var cover='';
    var im=win.match(/data-original="([^"]+)"|src="(https?:\/\/[^"]+)"|src="(\/[^"]+)"/);
    if(im)cover=im[1]||im[2]||im[3]||'';
    if(!title){var al=win.match(/alt="([^"]+)"/);if(al)title=siteText(al[1]);}
    if(!title){var ti=win.match(/module-poster-item-title">([^<]+)</);if(ti)title=siteText(ti[1]);}
    if(!title||!cover)continue;
    seen[href]=1;
    if(cover.charAt(0)==='/')cover=Source.origin+cover;
    var note=win.match(/<div class="module-item-note">([^<]*)<\/div>/);
    var vid=href.replace(/^\/html\/|\.html$/g,'');
    var link=siteLink('vod',{id:vid});
    out.push({id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
      description:note?siteText(note[1]):'',mediaType:'tv'});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/')).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(['1','2','3','4','39'].indexOf(cid)<0)throw Error('分类无效');
  if(page>1)return []; /* 服务端忽略分页参数，第 2 页与第 1 页内容完全相同。 */
  var items=siteParseCards(await siteGetHtml(Source.origin+'/list/'+cid+'.html'));
  var mediaType=cid==='1'?'movie':'tv';
  items.forEach(function(x){x.mediaType=mediaType;});
  return items.slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var items=siteParseCards(await siteGetHtml(Source.origin+'/search/'+encodeURIComponent(kw)+'-------------.html'));
  return items.slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var vid=siteQueryValue(link,'id');if(!/^[A-Za-z0-9]+$/.test(vid))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/html/'+vid+'.html');
  var title='',year='',area='',type='';
  var tm=html.match(/<title>([^<]+)<\/title>/);
  if(tm){var parts=siteText(tm[1]).split('·').map(siteText);
    /* “仙逆 · 2023 · 大陆 · 动漫 · 在线观看 - 映像星球线路五十” */
    if(parts.length>=4){title=parts[0];year=/^\d{4}$/.test(parts[1])?parts[1]:'';area=parts[2];type=parts[3];}}
  if(!title){var jm=html.match(/"name":"((?:[^"\\]|\\.)*)"/);if(jm)title=siteText(jm[1]);}
  if(!title)throw Error('影片详情缺少标题');
  var cover='';var og=html.match(/property="og:image" content="([^"]+)"/);if(og)cover=og[1];
  if(!cover){var th=html.match(/"thumbnailUrl":"([^"]+)"/);if(th)cover=th[1];}
  var desc='';var dm=html.match(/"description":"((?:[^"\\]|\\.)*)"/);if(dm)desc=siteText(dm[1].replace(/\\"/g,'"'));
  /* 线路标签（data-dropdown-value）与分集面板（id="panel1"）按同一顺序出现。 */
  var tabs=[];var tr=/data-dropdown-value="([^"]+)"/g,tm2;
  while((tm2=tr.exec(html)))tabs.push(siteText(tm2[1]));
  var starts=[];var pr=/<div class="module-list sort-list tab-list[^"]*" id="panel1">/g,pm;
  while((pm=pr.exec(html)))starts.push(pm.index);
  if(!starts.length)throw Error('影片详情没有可选分集');
  var lines=[];
  for(var i=0;i<starts.length;i++){
    var seg=html.slice(starts[i],i+1<starts.length?starts[i+1]:starts[i]+40000);
    var eps=[],seen={};
    var er=/href="\/play\/([A-Za-z0-9]+)-(\d+)-(\d+)\.html"[^>]*>(?:<span>)?([^<]*)/g,em;
    while((em=er.exec(seg))){
      if(em[1]!==vid)continue;
      var num=Number(em[3]);if(seen[num])continue;seen[num]=1;
      eps.push({num:num,src:Number(em[2]),title:siteText(em[4])||('第'+num+'集')});
    }
    eps.sort(function(a,b){return a.num-b.num;});
    if(eps.length)lines.push({name:tabs[i]||('线路'+(i+1)),episodes:eps});
  }
  if(!lines.length)throw Error('影片详情没有可选分集');
  var nums={},all=[];
  lines.forEach(function(l){l.episodes.forEach(function(e){if(!nums[e.num]){nums[e.num]=1;all.push(e.num);}});});
  all.sort(function(a,b){return a-b;});
  var card={id:siteLink('vod',{id:vid}),type:'url',link:siteLink('vod',{id:vid}),title:title,
    coverUrl:cover,posterPath:cover,
    description:[type,area,desc].filter(Boolean).join(' · '),
    mediaType:type==='电影'?'movie':'tv',releaseDate:year};
  card.episodeItems=all.map(function(num){
    var epTitle='';
    lines.forEach(function(l){if(!epTitle){var e=l.episodes.filter(function(x){return x.num===num;})[0];if(e)epTitle=e.title;}});
    epTitle=epTitle||('第'+num+'集');
    var children=[];
    lines.forEach(function(l){
      var e=l.episodes.filter(function(x){return x.num===num;})[0];
      if(!e)return;
      var link=siteLink('episode',{vod:vid,src:e.src,num:num,line:l.name});
      children.push({id:link,type:'url',link:link,title:l.name+' · '+epTitle});
    });
    var first=children[0];
    return {id:first.id,type:'url',link:first.link,title:epTitle,coverUrl:cover,childItems:children};
  });
  return card;
}
async function resolveResource(p){
  p=p||{};var link=String(p.link||p.id||'');
  var vod=siteQueryValue(link,'vod'),src=Number(siteQueryValue(link,'src')||0),num=Number(siteQueryValue(link,'num')||0);
  var line=siteQueryValue(link,'line');
  if(!/^[A-Za-z0-9]+$/.test(vod)||!(src>=1&&src<=9)||!(num>=1&&num<=999))throw Error('请选择'+Source.name+'组件内的分集');
  var html=await siteGetHtml(Source.origin+'/play/'+vod+'-'+src+'-'+num+'.html');
  var i=html.indexOf('var player_aaaa=');
  if(i<0)throw Error('该分集暂无播放地址');
  var start=html.indexOf('{',i);if(start<0)throw Error('播放地址解析失败');
  var depth=0,j=start;
  for(j=start;j<html.length;j++){
    var c=html.charAt(j);
    if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0)break;}
  }
  var url='',from='',encrypt=0;
  try{var d=JSON.parse(html.slice(start,j+1));url=String(d.url||'');from=String(d.from||'');encrypt=Number(d.encrypt||0);}catch(_){throw Error('播放地址解析失败');}
  if(encrypt!==0)throw Error('该线路播放地址已加密，暂不支持');
  if(!url)throw Error('该分集暂无播放地址');
  if(!/\.(m3u8|mp4)([?#]|$)/i.test(url))throw Error('该线路（'+(from||'第三方')+'）为第三方视频页面，无直连播放地址，请切换其他线路');
  var safe=siteSafeURL(url);
  if(!safe)throw Error('播放地址无效');
  return [{name:line||from||'播放线路',url:safe,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
