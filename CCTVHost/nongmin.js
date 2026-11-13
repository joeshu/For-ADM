/* 农民影视 CCTVHost 适配器：旺旺影视 MacCMS（wap3 模板）公开目录/详情/直链。
 * 站点：https://vip.wwgz.cn:5200（首页 200，约 8.3KB）。
 * 实站验证 2026-11-13（本机可达）：
 *  - 首页、分类（/vod-type-id-{1,2,3,4,26}-pg-1.html）与详情
 *    （/vod-detail-id-*.html）正常；分页被服务端忽略（pg-2 与 pg-1 内容
 *    完全相同），故 loadCatalog 只取第 1 页。
 *  - 搜索不可用：?m=vod-search 与 /vod-search-wd-*.html 均返回“缺少文件：
 *    /data/img.wwgz.cn/template/wap3/html//vod_search.html”；
 *    /index.php/vod/search/wd/ 返回首页；/index.php/ajax/suggest 返回首页；
 *    POST 搜索连接失败；首页无任何搜索表单。search 会明确报错。
 *  - 播放页（/vod-play-id-*-src-*-num-*.html）内联 mac_from/mac_url，含
 *    全部线路全部集数的直链 m3u8；桌面 UA 返回空页面，必须用 iPhone UA 请求。
 *  - 播放地址为原站直给的 m3u8；本机探测：西瓜线路 302 跳转到真实 CDN，
 *    量子线路 dated 路径 404；最终播放需 iPhone 实测。
 * 分类只映射电影/连续剧/综艺/动漫/短剧；小姐姐/音乐分类未接入。 */
var Source={"id":"nongmin","name":"农民影视","origin":"https://vip.wwgz.cn:5200","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'旺旺影视公开目录与详情，直链 m3u8；搜索模板缺失，暂不支持搜索。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'电影',value:'1'},{title:'电视剧',value:'2'},{title:'综艺',value:'3'},{title:'动漫',value:'4'},{title:'短剧',value:'26'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'本站搜索模板缺失，暂不支持搜索'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();};
var siteStripHtml=function(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ').replace(/<[^>]*>/g,' ');};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
/* 桌面 UA 请求播放页返回空页面，必须用 iPhone UA。 */
var UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function siteGetHtml(url){
  var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Referer':Source.origin+'/'},timeout:15000});
  var html=typeof r.data==='string'?r.data:'';
  if(!html)throw Error(Source.name+'返回空页面');
  if(html.indexOf('缺少文件')>=0)throw Error(Source.name+'页面模板缺失');
  return html;
}
/* 首页/分类卡片：<a href="/vod-detail-id-N.html" title="片名"><div class="pic">
 * <img src="海报">…<span class="sTit">片名</span><span class="sDes">主演：…</span></a> */
function siteParseCards(html,mediaType){
  var out=[],seen=Object.create(null);
  var re=/<a href="\/vod-detail-id-(\d+)\.html" title="([^"]*)">/g,m;
  while((m=re.exec(html))){
    var id=m[1];if(seen[id])continue;seen[id]=1;
    var title=siteText(m[2]);if(!title)continue;
    var win=html.slice(m.index,m.index+1800);
    var img=win.match(/src="(https?:\/\/[^"]+)"/);
    var des=win.match(/<span class="sDes">([^<]*)<\/span>/);
    var note=win.match(/<span>([^<]*?)<em>/);
    var link=siteLink('vod',{id:id});
    out.push({id:link,type:'url',link:link,title:title,
      coverUrl:img?img[1]:'',posterPath:img?img[1]:'',
      description:siteText(des?des[1]:'')+(note?(' · '+siteText(note[1])):''),
      mediaType:mediaType||'tv'});
  }
  return out;
}
async function loadHome(){
  return siteParseCards(await siteGetHtml(Source.origin+'/'),'tv').slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'1'),page=sitePage(p.page);
  if(['1','2','3','4','26'].indexOf(cid)<0)throw Error('分类无效');
  if(page>1)return []; /* 服务端忽略 pg 参数，第 2 页与第 1 页内容完全相同。 */
  return siteParseCards(await siteGetHtml(Source.origin+'/vod-type-id-'+cid+'-pg-1.html'),cid==='1'?'movie':'tv').slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  throw Error('农民影视搜索暂不可用：本站搜索模板文件缺失（?m=vod-search 返回“缺少文件”），请用分类浏览');
}
function sitePadNum(n){n=Number(n);return n<10?'0'+n:String(n);}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  var html=await siteGetHtml(Source.origin+'/vod-detail-id-'+id+'.html');
  var title='';
  var hm=html.match(/<h1 class="title"><a[^>]*>([^<]+)<\/a><\/h1>/);
  if(hm)title=siteText(hm[1]);
  if(!title){var tm=html.match(/<title>《([^》]+)》/);if(tm)title=siteText(tm[1]);}
  if(!title)throw Error('影片详情缺少标题');
  var img=html.match(/<img src="(https?:\/\/[^"]+)" alt="[^"]*">/);
  var cover=img?img[1]:'';
  var text=siteStripHtml(html);
  var status='',actors='',director='',year='',desc='';
  var sm=text.match(/状态:\s*(\S+)/);if(sm)status=sm[1];
  var am=text.match(/主演:\s*(.+?)\s*导演:/);if(am)actors=siteText(am[1]);
  var dm=text.match(/导演:\s*(\S+)\s*更新日期:/);if(dm)director=dm[1];
  var ym=text.match(/年代[:：]\s*(\d{4})/);if(ym)year=ym[1];
  var ds=text.match(/简\s*介[:：]\s*([\s\S]{1,600})/);if(ds)desc=siteText(ds[1]).slice(0,600);
  var tid='';var tm2=html.match(/SiteTid='(\d+)'/);if(tm2)tid=tm2[1];
  /* 线路标签与分集容器按同一顺序出现：<li><a>线路③</a></li>…对应
   * <div id="xiguam3u8" class="numList">…</div>；容器内链接自带 src。 */
  var tabs=[];var tr=/<li><a href="javascript:;">([^<]+)<\/a><\/li>/g,tm3;
  while((tm3=tr.exec(html)))tabs.push(siteText(tm3[1]));
  var divs=[];var dr=/<div id="([A-Za-z0-9_]+)" class="numList">([\s\S]*?)<\/div>/g,dm4;
  while((dm4=dr.exec(html)))divs.push({from:dm4[1],body:dm4[2]});
  if(!divs.length)throw Error('影片详情没有可选分集');
  var lines=divs.map(function(div,idx){
    var eps=[],seen={};
    var er=/\/vod-play-id-(\d+)-src-(\d+)-num-(\d+)\.html"[^>]*>([^<]*)</g,em;
    while((em=er.exec(div.body))){
      var num=Number(em[3]);if(!seen[num]){seen[num]=1;
        var t=siteText(em[4]);if(t==='立即播放')t='第'+sitePadNum(num)+'集';
        eps.push({num:num,title:t||('第'+num+'集'),src:Number(em[2])});
      }
    }
    eps.sort(function(a,b){return a.num-b.num;});
    return {name:tabs[idx]||div.from||('线路'+(idx+1)),from:div.from,episodes:eps};
  }).filter(function(l){return l.episodes.length;});
  if(!lines.length)throw Error('影片详情没有可选分集');
  var nums={},all=[];
  lines.forEach(function(l){l.episodes.forEach(function(e){if(!nums[e.num]){nums[e.num]=1;all.push(e.num);}});});
  all.sort(function(a,b){return a-b;});
  var card={id:siteLink('vod',{id:id}),type:'url',link:siteLink('vod',{id:id}),title:title,
    coverUrl:cover,posterPath:cover,
    description:[status,actors?('主演：'+actors):'',director?('导演：'+director):'',desc].filter(Boolean).join(' · '),
    mediaType:tid==='1'?'movie':'tv',releaseDate:year};
  card.episodeItems=all.map(function(num){
    var epTitle='';
    lines.forEach(function(l){if(!epTitle){var e=l.episodes.filter(function(x){return x.num===num;})[0];if(e)epTitle=e.title;}});
    epTitle=epTitle||('第'+num+'集');
    var children=[];
    lines.forEach(function(l){
      var e=l.episodes.filter(function(x){return x.num===num;})[0];
      if(!e)return;
      var link=siteLink('episode',{vodId:id,src:e.src,num:num,line:l.name});
      children.push({id:link,type:'url',link:link,title:l.name+' · '+epTitle});
    });
    var first=children[0];
    return {id:first.id,type:'url',link:first.link,title:epTitle,coverUrl:cover,childItems:children};
  });
  return card;
}
async function resolveResource(p){
  p=p||{};var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),src=Number(siteQueryValue(link,'src')||0),num=Number(siteQueryValue(link,'num')||0);
  var line=siteQueryValue(link,'line');
  if(!/^\d+$/.test(vodId)||!(src>=1&&src<=9)||!(num>=1&&num<=999))throw Error('请选择'+Source.name+'组件内的分集');
  var html=await siteGetHtml(Source.origin+'/vod-play-id-'+vodId+'-src-'+src+'-num-'+num+'.html');
  var fromM=html.match(/mac_from='([^']*)'/),urlM=html.match(/mac_url='([^']*)'/);
  if(!fromM||!urlM)throw Error('该分集暂无播放地址');
  var froms=fromM[1].split('$$$'),groups=urlM[1].split('$$$');
  var group=groups[src-1]||'',found='';
  var eps=group.split('#');
  for(var i=0;i<eps.length;i++){
    var parts=eps[i].split('$');if(parts.length<2)continue;
    var nm=parts[0].match(/(\d+)/);if(nm&&Number(nm[1])===num){found=parts.slice(1).join('$');break;}
  }
  if(!found&&eps.length){var dflt=eps[Math.min(num-1,eps.length-1)];if(dflt)found=dflt.split('$').slice(1).join('$');}
  var url=siteSafeURL(found);
  if(!url||!/\.(m3u8|mp4)([?#]|$)/i.test(url))throw Error('该分集暂无直连播放地址');
  return [{name:line||froms[src-1]||('线路'+src),url:url,playerType:'app',customHeaders:{Referer:Source.origin+'/'}}];
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
