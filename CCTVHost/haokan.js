/* 好看短剧 CCTVHost 适配器：百度好看视频短剧（sv.baidu.com）。
 * 协议来自 TVBoxOSC spider.jar 的 ShortHaokan 类方法级反编译（androguard，
 * playerContent/detailContent/categoryContent/homeContent/searchContent/a/b），
 * 并经本机实站验证 2026-11-13：
 * - playletShelfFeed（from=feed）：HTTP 200，status 0，29 个分类 tag（男频 3、
 *   女频 4、都市 2013、玄幻 2009……），banner 10 条；
 * - playletTagsFeed（tag_id=3 男频，rn=9，pn=1）：9 条，首条《都市超级医圣》
 *   8407903595576161476，94集；
 * - 详情两步：appui/api video/commonlist 取 vid（4171608771048245209），
 *   rec/detail 取 vid_list 94 集；
 * - 解析：appui/api video/relate 取 clarityUrl，1080p 直链 MP4
 *   http://vd2.bdstatic.com/.../1080p/...mp4，HEAD 200 video/mp4 48,691,528 字节。
 * - 搜索：sugs 接口本机对 12 个关键词一律回 status 101801001105「猜空了」、
 *   data []（login_status -1），实现按原类照写，iPhone 上需复测搜索是否可用。
 * 认证是写死在类里的 BAIDUCUID cookie（见下），2026-11-13 实测仍有效；
 * 该值是设备标识而非账号口令，失效时需从好看 App 抓包换新。 */
var Source={"id":"haokan","name":"好看短剧","origin":"https://sv.baidu.com","version":"0.1.0"};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'百度好看视频短剧：分类片库、详情分集与 1080p 直链播放（BAIDUCUID 会话）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'3',enumOptions:[{title:'男频',value:'3'},{title:'女频',value:'4'},{title:'都市',value:'2013'},{title:'玄幻',value:'2009'},{title:'年代',value:'2014'},{title:'科幻',value:'2015'},{title:'军旅战争',value:'2016'},{title:'历史架空',value:'2010'},{title:'武侠武打',value:'2017'},{title:'家庭伦理',value:'2012'},{title:'古代言情',value:'2011'},{title:'现代言情',value:'2008'},{title:'青春校园',value:'2018'},{title:'逆袭',value:'1004'},{title:'鉴宝',value:'2019'},{title:'异能',value:'2005'},{title:'甜宠',value:'1007'},{title:'虐恋',value:'1006'},{title:'闪婚',value:'2007'},{title:'种田',value:'2020'},{title:'穿越重生',value:'2004'},{title:'宫斗宅斗',value:'2006'},{title:'战神',value:'1001'},{title:'总裁',value:'1008'},{title:'神豪',value:'2001'},{title:'神医',value:'1002'},{title:'萌宝',value:'2003'},{title:'赘婿',value:'1003'},{title:'王妃',value:'2002'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索短剧',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Linux; Android 11; M2012K10C Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 haokan/7.80.0.18 (Baidu; P1 11)/imoaiX_03_11_C01K2102M/1043677m/5ACDB023CFB9D64743B08E51953F7C76%7CVSAJ32AVA/1/7.80.0.18/780001/1/immersiveMode/modeV4PlusWhite/isFirstInstall/bbqMode/bbqModeV2/blackStyle/isPlaylet Talos/1.8.7';
/* 原类 a() 的请求头：BAIDUCUID 写死在类里，Talos-Module-Name 为 shortDrama。 */
var HK_HEADERS={'User-Agent':UA,'Cookie':'BAIDUCUID=giHCu0azv80G8SfQ0avU8gaaH8jfiv86ju2MugiR2i8-k3a35avAa1_mA','Content-Type':'application/x-www-form-urlencoded; charset=utf-8','Talos-Module-Name':'shortDrama','Talos-Module-Version':'1.0.71.1'};
function siteForm(values){return Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');}
async function sitePostJson(url,values){
  var r=await CCTVHttp.post(url,siteForm(values),{headers:HK_HEADERS,timeout:15000});
  var d=r.data;
  if(typeof d==='string'){try{d=JSON.parse(d);}catch(_){throw Error(Source.name+'返回了无效数据');}}
  if(!d||typeof d!=='object')throw Error(Source.name+'返回了无效数据');
  return d;
}
function siteCard(id,title,cover,desc){
  var link=siteLink('vod',{id:id});
  return {id:link,type:'url',link:link,title:siteText(title),coverUrl:siteSafeURL(cover||''),posterPath:siteSafeURL(cover||''),
    description:siteText(desc||''),mediaType:'tv',labels:[]};
}
async function loadHome(){
  var d=await sitePostJson(Source.origin+'/haokan/ui-feed/playletShelfFeed?osbranch=a0',{from:'feed'});
  var banner=(d.data&&d.data.playlet_banner)||[];
  return banner.map(function(b){
    var desc=siteText(b.description||'');
    if(b.episodes_num_text)desc=(desc?desc+' · ':'')+b.episodes_num_text;
    return siteCard(String(b.playlet_id),b.playlet_title,b.playlet_poster,desc);
  }).slice(0,60);
}
async function loadCatalog(p){
  p=p||{};var tid=String(p.channelId||'3'),page=sitePage(p.page);
  var d=await sitePostJson(Source.origin+'/haokan/ui-feed/playletTagsFeed?osbranch=a0',{tag_id:tid,rn:'9',pn:String(page)});
  var list=(d.data&&d.data.list)||[];
  return list.map(function(b){return siteCard(String(b.playlet_id),b.playlet_title,b.playlet_poster,b.episodes_num_text);}).slice(0,60);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var d=await sitePostJson(Source.origin+'/haokan/ui-interact/playlet/search/sugs?osbranch=a0',{search_word:kw});
  var list=Array.isArray(d.data)?d.data:[];
  return list.map(function(b){return siteCard(String(b.id),b.title,b.cover_url,b.tag);}).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  var id=siteQueryValue(link,'id');if(!/^\d+$/.test(id))throw Error('影片链接不属于'+Source.name);
  /* 原类 detailContent：先经 appui/api 的 video/commonlist 取首集 vid，
   * 再经 rec/detail 取标题、海报、简介与 vid_list。 */
  var body='enable_enter_playlet=0&seek_time=0&hotspot=0&auto_show_hot_point_panel=0&type=playlet&commonlist_id='+Date.now()+'&scene=&vid=&enable_atlas=0&mark_pn=&uk=&ctime=0&from=playlet_new&id='+id+'&rn=10&pn=1&direction=3';
  var d1=await sitePostJson(Source.origin+'/appui/api?osbranch=a0',{'video/commonlist':body});
  var results=d1['video/commonlist']&&d1['video/commonlist'].data&&d1['video/commonlist'].data.results;
  if(!results||!results.length||!results[0].content||!results[0].content.vid)throw Error(Source.name+'未找到该短剧（详情接口结构可能已变化）');
  var firstVid=String(results[0].content.vid);
  var d2=await sitePostJson(Source.origin+'/haokan/ui-video/playlet/rec/detail?osbranch=a0',{vid:firstVid,playlet_id:id});
  var data=d2.data||{};
  var title=siteText(data.playlet_title);if(!title)throw Error(Source.name+'未找到该短剧');
  var cover=siteSafeURL(data.playlet_poster||'');
  var card={id:siteLink('vod',{id:id}),type:'url',link:siteLink('vod',{id:id}),title:title,coverUrl:cover,posterPath:cover,
    description:siteText(data.description||''),mediaType:'tv',labels:[]};
  var vids=Array.isArray(data.vid_list)?data.vid_list:[];
  card.episodeItems=vids.map(function(vid,i){
    var epTitle='第'+(i+1)+'集';
    var epLink=siteLink('episode',{vid:String(vid),pid:id});
    return {id:epLink,type:'url',link:epLink,title:epTitle,coverUrl:cover,
      childItems:[{id:epLink,type:'url',link:epLink,title:'短剧 · '+epTitle}]};
  });
  return card;
}
async function resolveResource(p){
  p=typeof p==='string'?{link:p}:p||{};var link=String(p.link||p.id||'');
  var vid=siteQueryValue(link,'vid'),pid=siteQueryValue(link,'pid');
  if(!vid&&/\|\|\|/.test(link)){var parts=link.split('|||');vid=parts[0];pid=parts[1];}
  if(!/^\d+$/.test(vid||'')||!/^\d+$/.test(pid||''))throw Error('请选择'+Source.name+'中的短剧分集');
  /* 原类 playerContent：appui/api 的 video/relate，clarityUrl 优先 1080p，其次 sc。 */
  var body='method=post&vid='+vid+'&immersive_mode=v4_5&tplname=feed_small_video&tag=playlet_talos&tab=detail&external_from=&is_dp_video=0&immersive_square_type=3&video_set_id='+pid+'&play_screen_type=1&play_volume_type=2&play_external_device_type=1';
  var d=await sitePostJson(Source.origin+'/appui/api?osbranch=a0',{'video/relate':body});
  var clarity=d['video/relate']&&d['video/relate'].data&&d['video/relate'].data.cur_video&&d['video/relate'].data.cur_video.clarityUrl;
  if(!Array.isArray(clarity)||!clarity.length)throw Error(Source.name+'未返回播放地址');
  var pick=null,i;
  for(i=0;i<clarity.length;i++)if(clarity[i]&&clarity[i].key==='1080p'&&clarity[i].url){pick=clarity[i];break;}
  if(!pick)for(i=0;i<clarity.length;i++)if(clarity[i]&&clarity[i].key==='sc'&&clarity[i].url){pick=clarity[i];break;}
  if(!pick)pick=clarity[0];
  if(!pick||!pick.url)throw Error(Source.name+'未返回播放地址');
  return [{name:pick.key||'原站线路',url:String(pick.url),playerType:'app',customHeaders:{'User-Agent':UA,Referer:Source.origin+'/'}}];
}
// BEGIN COLLECTION RUNTIME
var CollectionConfig={"description":"六类片库 · 完整分集 · 直连与AI（受原站额度限制）","poster":"https://joeshu.github.io/yqk-forward-widget/collection-poster.png","guide":"六类片库 · 完整分集 · 直连与AI（受原站额度限制）\nAI会消耗原站词元，请查看AI额度状态；不通过轮换游客身份绕过额度。\n片单摘要为展示而缩短，详情保留全文；占位图仅表示暂无海报。新旧片以原站标注为准；旧片补录也可能出现在近期更新。"};
// Common presentation and request lifecycle. Site parsers and permissions remain in their adapters.
var CollectionCooldownUntil=0;
(function collectionInstall(root) {
  var meta=CCTVHostMetadata, config=CollectionConfig, pending=Object.create(null), last=null;
  var storeKey='collection.status.v1.'+meta.id, guideLink=meta.site.replace(/\/$/,'')+'/#joeshu-widget-guide';
  function text(value){return String(value==null?'':value).trim();}
  function scrub(value){return text(value).replace(/https?:\/\/\S+/g,'[地址]').replace(/(?:cookie|token|sessionSign|captcha_login_sign)\s*[:=]\s*\S+/gi,'[会话信息]').replace(/\b[a-f\d]{32,}\b/gi,'[标识]').slice(0,240);}
  function artwork(value){var s=text(value);if(/^\/\//.test(s))return 'https:'+s;if(/^https?:\/\/[^\s/@]+(?:[/?#]|$)/i.test(s)||/^data:image\//i.test(s))return s;return '';}
  function listItem(item){if(!item||typeof item!=='object')return item;var out=Object.assign({},item), cover=artwork(item.coverUrl)||artwork(item.posterPath);
    out.title=text(item.title);if(!cover&&/^\//.test(text(item.coverUrl)))cover=meta.site.replace(/\/$/,'')+text(item.coverUrl);
    if(!cover&&!text(item.posterPath)){cover=config.poster;out.description='暂无原站海报'+(item.description?' · '+text(item.description):'');}
    if(cover){out.coverUrl=cover;if(!item.posterPath)out.posterPath=cover;}
    var info=[],year=text(item.releaseDate).match(/^(?:19|20)\d{2}/), desc=text(out.description||item.description);
    if(year&&desc.indexOf(year[0])<0)info.push(year[0]);
    var genre=text(item.genreTitle);if(genre&&genre.length<=30&&desc.indexOf(genre)<0)info.push(genre);
    var summary=desc.replace(/\s+/g,' ');if(summary.length>150)summary=summary.slice(0,150)+'…';out.description=info.concat(summary?[summary]:[]).join(' · ');return out;
  }
  function resultList(items){if(!Array.isArray(items))throw new Error('片单格式异常，请更新模块后重试');var seen=Object.create(null),out=[];items.forEach(function(item){var key=item&&text(item.id||item.link);if(key&&seen[key])return;if(key)seen[key]=true;out.push(listItem(item));});return out;}
  function canonical(value,depth){if(depth>8)throw Error('deep');if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(function(v){return canonical(v,depth+1);});var out={};Object.keys(value).sort().forEach(function(k){out[k]=canonical(value[k],depth+1);});return out;}
  function requestKey(name,args){try{var s=JSON.stringify(canonical(args,0));return s.length<=8192?name+'|'+s:null;}catch(e){return null;}}
  function errorHint(error){var e=new Error(),s=scrub(error&&error.message||error),status=Number(error&&error.status);
    if(/TLS|SSL|secure connection|安全连接|证书|-120[0-6]/i.test(s))s='HTTPS连接失败，请检查网络或代理后重试';
    else if(/timed out|timeout|超时|-1001/i.test(s))s='请求超时，请稍后重试或检查网络';
    if((error&&error.code==='RATE_LIMIT')||status===429){CollectionCooldownUntil=Date.now()+30000;s='原站请求过于频繁，30秒后重试；本次不再继续换线';}
    e.message=(s.indexOf(meta.title)===0?'':meta.title+'：')+s;
    ['code','status','apiCode','name'].forEach(function(k){if(error&&error[k]!=null)e[k]=error[k];});return e;
  }
  async function record(row){last={version:1,id:meta.id,at:Date.now(),stage:({loadDetail:'完整分集',resolveResource:'线路检查',search:'搜索',loadHome:'首页推荐',loadLatest:'近期更新',loadCatalog:'分类片库',loadCategory:'分类片库',loadFiltered:'条件筛选'})[row.stage]||'片单加载',ok:row.ok,count:row.count==null?null:row.count,elapsedMs:row.elapsedMs,error:row.error||''};try{if(CCTVStorage&&typeof CCTVStorage.set==='function')await CCTVStorage.set(storeKey,JSON.stringify(last));}catch(e){}}
  async function status(){var row=last;try{if(!row&&CCTVStorage){var raw=await CCTVStorage.get(storeKey);if(typeof raw==='string'&&raw.length<4096){var data=JSON.parse(raw);if(data.version===1&&data.id===meta.id&&typeof data.ok==='boolean'&&Number.isFinite(data.at)&&data.at>0&&data.at<=Date.now()+60000)row=data;}}}catch(e){}
    var title=meta.title+' · '+(row?(row.ok?'最近加载成功':'最近加载受阻'):'使用说明'),description=config.guide;
    if(row){var date=new Date(row.at+8*3600000).toISOString().slice(0,16).replace('T',' ');description='最近记录：北京时间 '+date+' · '+(row.stage||'加载')+' · '+Math.round(Number(row.elapsedMs)||0)+'毫秒'+(row.count!=null?' · '+row.count+'项':'')+'\n'+(!row.ok?scrub(row.error)+'\n':'')+description+'\n这是一条历史记录，不代表原站当前在线状态。';}
    return [{id:guideLink,type:'url',link:guideLink,title:title,description:description,coverUrl:config.poster}];
  }
  root.collectionStatus=status;
  var functions=Object.create(null);meta.modules.forEach(function(m){if(m.functionName&&!/^(?:configureSession|loadAiQuotaStatus|collectionStatus)$/.test(m.functionName))functions[m.functionName]=true;});if(meta.search)functions[meta.search.functionName]=true;functions.loadDetail=true;functions.resolveResource=true;
  Object.keys(functions).forEach(function(name){var original=root[name];if(typeof original!=='function')return;root[name]=function(){var args=Array.prototype.slice.call(arguments),self=this;if(name==='search'&&!text(args[0]&&args[0].keyword).replace(/[\u200b-\u200d\ufeff]/g,''))return Promise.resolve([]);
    if(name==='loadDetail'&&args[0]===guideLink)return status().then(function(items){return items[0];});
    if(Date.now()<CollectionCooldownUntil){var e=new Error(meta.title+'：原站请求过于频繁，请在30秒后重试');e.code='RATE_LIMIT';return Promise.reject(e);}
    var key=requestKey(name,args);if(Object.keys(pending).length>=64)key=null;if(key&&pending[key])return pending[key];var start=Date.now();var promise=Promise.resolve().then(function(){return original.apply(self,args);}).then(function(value){return name==='loadDetail'||name==='resolveResource'?value:resultList(value);}).then(async function(out){await record({stage:name,ok:true,count:Array.isArray(out)?out.length:null,elapsedMs:Date.now()-start});return out;},async function(error){var e=errorHint(error);await record({stage:name,ok:false,elapsedMs:Date.now()-start,error:e.message});throw e;});
    if(key){pending[key]=promise;function clean(){if(pending[key]===promise)delete pending[key];}promise.then(clean,clean);}return promise;
  };});
  meta.description=config.description;meta.detailCacheDuration=0;
  meta.modules.forEach(function(m){if(m.id==='latest')m.title=config.latestTitle||'近期更新';if(m.id==='home')m.title=config.homeTitle||'首页推荐';if(m.id==='catalog'||m.id==='category')m.title=config.catalogTitle||'分类片库';if(m.id==='searchList')m.title=meta.id==='joeshu.anime1'?'搜索动画':'搜索影片';if(m.type==='stream'){m.cacheDuration=0;m.title='播放线路';}else if(m.functionName==='search')m.cacheDuration=0;else if(!/^(?:configureSession|loadAiQuotaStatus)$/.test(m.functionName))m.cacheDuration=m.id==='latest'?30:60;});
  if(meta.search&&!meta.modules.some(function(m){return m.functionName===meta.search.functionName;}))meta.modules.push({id:'searchList',title:'搜索影片',functionName:meta.search.functionName,cacheDuration:0,params:meta.search.params});
  function order(m){if(m.id==='latest')return 0;if(m.id==='home')return 1;if(m.id==='newReleases')return 2;if(m.functionName==='configureSession')return meta.id==='joeshu.juyeye'?-1:8;if(m.functionName==='loadAiQuotaStatus')return 8;if(m.type==='stream')return 10;if(m.id==='searchList')return 7;return 3;}
  meta.modules=meta.modules.map(function(m,i){return {m:m,i:i};}).sort(function(a,b){return order(a.m)-order(b.m)||a.i-b.i;}).map(function(x){return x.m;});
  meta.modules.splice(meta.modules.findIndex(function(m){return m.type==='stream';})<0?meta.modules.length:meta.modules.findIndex(function(m){return m.type==='stream';}),0,{id:'collectionGuide',title:'使用说明与状态',functionName:'collectionStatus',cacheDuration:0,params:[]});
})(globalThis);

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
  if(typeof DYL!=='undefined')return (dylConfig&&dylConfig.index_top_nav||[]).filter(function(row){return row&&/^\d+$/.test(String(row.id));}).map(function(row){return {type_id:String(row.id),type_name:cctvCatVodText(row.name||row.title)};});
  if(typeof YqkCategories!=='undefined'){
    var out=[];
    YqkCategories.forEach(function(row){out.push({type_id:String(row.id),type_name:String(row.title)});(row.children||[]).forEach(function(child){out.push({type_id:String(row.id)+':'+String(child[0]),type_name:String(row.title)+' · '+String(child[1])});});});
    out.push({type_id:'65',type_name:'奈飞 Netflix'},{type_id:'56',type_name:'高清韩剧'});
    return out;
  }
  if(typeof SjKinds!=='undefined')return SjKinds.map(function(row){return {type_id:String(row[0]),type_name:String(row[1])};});
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
  if(typeof DYL!=='undefined')await dylEnsure();
  var classes=cctvCatVodClasses(),items;
  if(typeof YQK!=='undefined')items=await loadHome({topicId:'all'});else items=await loadHome({});
  return {class:classes,list:cctvCatVodCards(items)};
}
async function cctvCatVodCategory(tid,page,filter,extend){
  var id=String(tid||''),current=Math.max(1,Math.floor(Number(page)||1)),items,maxPage=0;
  if(typeof YQK!=='undefined'){
    if(id==='65'||id==='56')items=await loadCollection({channelId:id,collection:'latest',page:current});
    else{var match=id.match(/^(\d+)(?::(\d+))?$/);if(!match)throw new Error('分类编号无效');
      items=await loadCategory({parentChannelId:match[1],childChannelId:match[2]||extend&&extend.childChannelId||'',page:current});}
    maxPage=Number(YQK.maxPage)||0;
  }else if(typeof SjKinds!=='undefined'){
    items=await loadCatalog({kind:id,genre:extend&&extend.genre||'',area:extend&&extend.area||'',year:extend&&extend.year||'',sort:extend&&extend.sort||'updated_desc',page:current});
  }else items=await loadCatalog({channelId:id,page:current});
  return cctvCatVodPage(items,current,maxPage);
}
async function cctvCatVodSearch(keyword,quick,page){
  return cctvCatVodPage(await search({keyword:String(keyword||''),page:Math.max(1,Math.floor(Number(page)||1))}),page);
}
async function cctvCatVodDetail(ids){
  var id=Array.isArray(ids)?ids[0]:ids,detail=await loadDetail(String(id||''));
  var groups=cctvCatVodGroups(detail);
  if(typeof YQK!=='undefined'&&Array.isArray(detail.childItems)&&detail.childItems.length){
    var sources=detail.childItems.slice(0,24);
    var resolved=await cctvCatVodMap(sources,async function(source){
      try{var lineDetail=await loadDetail(String(source.link||source.id||'')),episodes=Array.isArray(lineDetail.episodeItems)?lineDetail.episodeItems:[];
        var name=cctvCatVodText(source.title).replace(/\s*[（(].*[）)]\s*$/,'')||'原站线路';
        return {name:name,episodes:episodes.map(cctvCatVodEpisode).filter(Boolean)};
      }catch(_){return null;}
    },4);
    groups=resolved.filter(function(group){return group&&group.episodes.length;});
  }
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
