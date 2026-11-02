import {NativeTransport} from './transport.mjs';
import {ServiceError,SiteClient} from './site-api.mjs';
import {safeHTTPS} from './model.mjs';

const CATEGORIES=[
 {id:1,name:'真人剧',slug:'real-drama',type:1},
 {id:2,name:'漫剧',slug:'comic-drama',type:3},
 {id:3,name:'AI剧',slug:'ai-drama',type:4},
 {id:4,name:'漫画',slug:'comic',type:2},
];
const CACHE_TTL=180_000;
const SEARCH_CACHE_TTL=120_000;
const clonePlayURLs=list=>list.map(item=>({...item,headers:{...item.headers}}));
const MAX_HTML_BYTES=3_500_000;
const MAX_ROUTER_BYTES=2_500_000;
const MAX_PLAY_INFO_BYTES=256_000;
const MAX_PAGES=10_000;
const RETRY_DELAYS=[250,700];
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const number=value=>/^\d{1,24}$/.test(String(value??''));
const abort=signal=>{if(signal?.aborted)throw new DOMException('请求取消','AbortError');};
function officialMediaURL(value){
 const url=safeHTTPS(value);if(!url)return '';
 try{const parsed=new URL(url);return !parsed.username&&!parsed.password&&!parsed.port&&/^v\d+-(?:reading|hgweb)\.qznovelvod\.com$/i.test(parsed.hostname)?url:'';}catch{return '';}
}
const abortableDelay=(milliseconds,signal)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(done,milliseconds);
 function done(){signal?.removeEventListener('abort',cancel);resolve();}
 function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('请求取消','AbortError'));}
 if(signal?.aborted){cancel();return;}
 signal?.addEventListener('abort',cancel,{once:true});
});

function decodeBase64(value,maxBytes,label){
 if(typeof value!=='string'||!value.length)throw new Error(label+'为空');
 if(value.length>Math.ceil(maxBytes*4/3)+8)throw new Error(label+'超过大小限制');
 let binary;try{binary=atob(value);}catch{throw new Error(label+'不是有效的 Base64 数据');}
 if(binary.length>maxBytes)throw new Error(label+'超过大小限制');
 const bytes=new Uint8Array(binary.length);
 for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
 return new TextDecoder().decode(bytes);
}

function parseJSON(text,label){
 try{return JSON.parse(text);}catch{throw new Error(label+'不是有效 JSON');}
}

export function parseHongguoRouterData(html){
 if(typeof html!=='string'||html.length>MAX_HTML_BYTES)throw Error('红果页面数据过大或格式错误');
 const marker=/(?:window\.|globalThis\.)?_ROUTER_DATA\s*=/.exec(html);
 if(!marker)throw Error('红果页面没有返回目录数据');
 const start=html.indexOf('{',marker.index+marker[0].length);if(start<0)throw Error('红果页面数据结构已变化');
 let depth=0,inString=false,escaped=false,end=-1;
 for(let index=start;index<html.length;index++){
  const char=html[index];
  if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue;}
  if(char==='"'){inString=true;continue;}
  if(char==='{'||char==='[')depth++;
  else if(char==='}'||char===']'){
   depth--;
   if(depth===0){end=index+1;break;}
   if(depth<0)break;
  }
  if(index-start>MAX_ROUTER_BYTES)throw Error('红果页面数据超过解析限制');
 }
 if(end<0)throw Error('红果页面数据不完整');
 const router=parseJSON(html.slice(start,end),'红果页面数据');
 if(!isObject(router)||!isObject(router.loaderData))throw Error('红果页面缺少目录数据');
 return router;
}

function routeData(router,kind){
 const preferred={
  home:['page'],
  category:['category_$'],
  detail:['detail_page','detail_$'],
  player:['player_(series_id)/page'],
 }[kind]||[];
 for(const key of preferred){const value=router.loaderData[key];if(isObject(value))return {key,data:value};}
 const match=Object.entries(router.loaderData).find(([key,value])=>isObject(value)&&key.toLowerCase().includes(kind.toLowerCase()));
 return match?{key:match[0],data:match[1]}:null;
}

function arrayField(object,...keys){
 for(const key of keys)if(Array.isArray(object?.[key]))return object[key];
 return [];
}

function canonicalMovie(row){
 const id=String(row?.series_id??row?.seriesId??row?.id??'');
 const title=String(row?.series_name||row?.series_title||row?.title||'').trim();
 if(!number(id)||!title)return null;
 const rawTags=Array.isArray(row.tags)?row.tags:Array.isArray(row.category_list)?row.category_list:[];
 const tags=rawTags.map(tag=>typeof tag==='string'?tag:tag?.name).filter(tag=>typeof tag==='string'&&tag.trim());
 const hot=row.hot_score_data?.text||row.hotScoreText||'';
 const count=row.episode_cnt??row.episodeCount;
 const image=safeHTTPS(row.series_cover||row.cover||row.image||row.cover_url);
 return {
  title,url:'vod/detail?vodId='+encodeURIComponent(id),imageURL:image,
  bottomLabel:String(row.episode_right_text||(/^\d+$/.test(String(count??''))?'全'+count+'集':'')),
  scoreText:String(hot),labels:tags.slice(0,8).map(name=>({name})),channelId:0,isAdult:false,
 };
}

function pageFromNext(value){
 const query=String(value||'page=1').replace(/^\?/,'');
 const parsed=Number(new URLSearchParams(query).get('page'));
 return Math.max(1,Math.min(MAX_PAGES,Number.isSafeInteger(parsed)?parsed:1));
}

function totalPages(data,currentPage){
 const pagination=data?.pagination||data?.page_info||{};
 const explicit=Number(pagination.totalPages??pagination.total_pages??pagination.pageCount??pagination.page_count);
 if(Number.isSafeInteger(explicit)&&explicit>0)return Math.min(MAX_PAGES,explicit);
 const total=Number(pagination.total??pagination.totalCount??pagination.total_count);
 const size=Number(pagination.pageSize??pagination.page_size??data?.pageSize);
 if(Number.isFinite(total)&&total>=0&&Number.isFinite(size)&&size>0)return Math.min(MAX_PAGES,Math.max(1,Math.ceil(total/size)));
 return currentPage;
}

function episodeIDs(series){
 const source=arrayField(series,'vid_list','video_list','videoList','episodes');
 const seen=new Set(),result=[];
 for(const item of source){
  const value=isObject(item)?item.vid??item.video_id??item.videoId??item.item_id:item;
  const id=String(value??'');
  if(number(id)&&!seen.has(id)){seen.add(id);result.push(id);}
 }
 return result;
}

function expectedShape(kind,data){
 if(kind==='home')return ['mBannerList','bannerList','banner_list','homeSections','home_sections','sections'].some(key=>Array.isArray(data[key]));
 if(kind==='category')return ['recommendList','video_list','videoList','list'].some(key=>Array.isArray(data[key]));
 if(kind==='detail')return isObject(data.seriesDetail)||isObject(data.series_detail);
 return true;
}

export class HongguoClient extends SiteClient{
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);
  const siteURL=new URL(site.origin);
  if(siteURL.protocol!=='https:')throw new ServiceError('红果官网地址必须使用 HTTPS');
  this.origin=siteURL.origin;
  this.pageCache=new Map();
  this.playCache=new Map();
  this.details=new Map();
  this.searchCache=null;
  this.searchPending=null;
  this.preparedChannels=new Set();
  this.channelPending=new Map();
  this.cacheEpoch=0;
  this.config=null;
  this.lastDiagnostics=null;
  this.playbackDiagnostics=null;
 }

 async requestWithRetry(request,signal,label){
  let lastError;
  for(let attempt=0;attempt<=RETRY_DELAYS.length;attempt++){
   abort(signal);
   try{
    const response=await this.transport({...request,signal});
    abort(signal);
    const status=Number(response?.status)||0;
    const retryable=status===408||status===425||status===429||status>=500;
    if(retryable&&attempt<RETRY_DELAYS.length){await abortableDelay(RETRY_DELAYS[attempt],signal);continue;}
    return response;
   }catch(error){
    if(signal?.aborted||error?.name==='AbortError')throw error;
    lastError=error;
    if(attempt>=RETRY_DELAYS.length)break;
    await abortableDelay(RETRY_DELAYS[attempt],signal);
   }
  }
  throw new ServiceError(label+'请求失败：'+String(lastError?.message||'网络连接异常').slice(0,180),lastError?.code);
 }

 async routerPage(path,kind,signal,{ttl=CACHE_TTL,force=false}={}){
  abort(signal);
  const requestEpoch=this.cacheEpoch;
  const url=new URL(path,this.origin);
  if(url.origin!==this.origin||url.protocol!=='https:')throw new ServiceError('红果页面地址无效');
  url.hash='';
  const key=url.href,cached=this.pageCache.get(key);
  if(!force&&cached&&cached.kind===kind&&Date.now()-cached.at<ttl){
   this.pageCache.delete(key);this.pageCache.set(key,cached);
   this.lastDiagnostics={...cached.diagnostics,cached:true};
   return cached.data;
  }

  let status=0,html='';
  try{
   const response=await this.requestWithRetry({
    url:key,method:'GET',headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'zh-CN,zh;q=0.9,en;q=0.5','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',Referer:this.origin+'/'},
   },signal,'红果官网');
   status=Number(response?.status)||0;
   if(status<200||status>=300){
    const hint=status===429?'请求过于频繁，请稍后重试':'暂时无法访问';
    throw new ServiceError('红果官网'+hint+'（HTTP '+status+'）',status||502);
   }
   if(response.url){
    let finalURL;try{finalURL=new URL(response.url);}catch{throw new ServiceError('红果官网返回了无效的页面地址',502);}
    if(finalURL.origin!==this.origin)throw new ServiceError('红果官网将页面跳转到其他域名，已停止解析',502);
   }
   try{html=decodeBase64(response.bodyBase64,MAX_HTML_BYTES,'红果页面');}
   catch(error){throw new ServiceError(error.message,502);}
   const router=parseHongguoRouterData(html),selected=routeData(router,kind);
   if(!selected||selected.data.isSuccess===false||!expectedShape(kind,selected.data)){
    throw new ServiceError('红果官网'+({home:'首页',category:'分类',detail:'影片详情',player:'播放页'}[kind]||'页面')+'结构已变化，请更新适配器',502);
   }
   const diagnostics={kind,path:url.pathname,status,htmlBytes:html.length,loaderKeys:Object.keys(router.loaderData).slice(0,20),routeKey:selected.key,payloadKeys:Object.keys(selected.data).slice(0,32),cached:false,ok:true};
   this.lastDiagnostics=diagnostics;
   if(requestEpoch===this.cacheEpoch){
    this.pageCache.set(key,{kind,at:Date.now(),data:selected.data,diagnostics});
    while(this.pageCache.size>32)this.pageCache.delete(this.pageCache.keys().next().value);
   }
   return selected.data;
  }catch(error){
   if(error?.name==='AbortError')throw error;
   this.lastDiagnostics={kind,path:url.pathname,status,htmlBytes:html.length,ok:false,error:String(error?.message||error).slice(0,180)};
   throw error;
  }
 }

 async bootstrap(){
  if(this.config)return this.config;
  this.config={vodTabs:CATEGORIES.map(item=>({type:'category',channelId:item.id,text:item.name})),adultChannelIds:[],channelListQuery:[],groups:[],urls:{cache:[this.origin],logic:[this.origin]},supportsAccount:false};
  for(const category of CATEGORIES)this.config.channelListQuery.push({channelId:category.id,items:[]});
  return this.config;
 }
 async ready(signal){if(!this.config)await this.bootstrap();abort(signal);}
 category(channelId){return CATEGORIES.find(item=>Number(item.id)===Number(channelId));}

 async home(signal){
  await this.ready(signal);
  const data=await this.routerPage('/','home',signal),blocks=[];
  const banners=arrayField(data,'mBannerList','bannerList','banner_list').map(canonicalMovie).filter(Boolean);
  if(banners.length)blocks.push({header:{title:'红果精选短剧',url:'catalog/channel?channelId=1'},data:banners});
  for(const section of arrayField(data,'homeSections','home_sections','sections')){
   if(!isObject(section))continue;
   const tabType=String(section.tab_type||section.tabType||''),category=tabType==='human'?CATEGORIES[0]:tabType==='comic'?CATEGORIES[1]:tabType==='ai'?CATEGORIES[2]:tabType==='comic-content'?CATEGORIES[3]:null;
   const items=arrayField(section,'video_list','videoList','list').map(canonicalMovie).filter(Boolean);
   if(items.length)blocks.push({header:{title:String(section.tab_name||section.tabName||'红果短剧'),url:'catalog/channel?channelId='+(category||CATEGORIES[0]).id},data:items});
  }
  return {blocks};
 }

 async categoryData(category,filters={},page=1,signal){
  const selected=String(filters?.topic||'');
  const filter=this.config?.channelListQuery?.find(row=>Number(row.channelId)===category.id)?.items?.find(item=>item.query==='topic');
  const option=filter?.data?.find(item=>String(item.id)===selected);
  const slug=option?.path||'';
  if(slug&&!/^[a-z0-9-]{1,80}$/i.test(slug))throw new ServiceError('红果题材路径无效');
  const path='/category/'+category.slug+(slug?'/'+encodeURIComponent(slug):'')+'?page='+Math.max(1,Math.min(MAX_PAGES,Number(page)||1));
  return this.routerPage(path,'category',signal);
 }

 async prepareChannel(channelId,signal){
  await this.ready(signal);
  const category=this.category(channelId);if(!category)throw new ServiceError('红果没有提供该分类');
  if(this.preparedChannels.has(category.id))return;
  const requestEpoch=this.cacheEpoch;
  const pending=this.channelPending.get(category.id);if(pending){await pending;abort(signal);return;}
  const task=(async()=>{
   const data=await this.categoryData(category,{},1,signal),selectors=arrayField(data,'selectorList','selector_list'),topicOptions=[];
   for(const row of selectors){
    for(const item of arrayField(row,'items','list')){
     const id=String(item?.selector_item_id??item?.selectorItemId??'').trim(),name=String(item?.show_name??item?.showName??'').trim();
     if(/^[a-z0-9-]{1,80}$/i.test(id)&&name)topicOptions.push({id,name,path:id});
    }
   }
   const unique=[...new Map(topicOptions.map(option=>[option.id,option])).values()];
   const definitions=this.config.channelListQuery.find(row=>Number(row.channelId)===category.id);
   if(unique.length)definitions.items=[{query:'topic',name:'题材',selected:'',data:[{id:'',name:'全部'},...unique]}];
   if(requestEpoch===this.cacheEpoch)this.preparedChannels.add(category.id);
  })();
  this.channelPending.set(category.id,task);
  try{await task;}finally{if(this.channelPending.get(category.id)===task)this.channelPending.delete(category.id);}
 }

 async channel(channelId,filters={},next='page=1',signal){
  await this.prepareChannel(channelId,signal);
  const category=this.category(channelId),page=pageFromNext(next),data=await this.categoryData(category,filters,page,signal);
  const list=arrayField(data,'recommendList','video_list','videoList','list').map(canonicalMovie).filter(Boolean),pages=totalPages(data,page);
  return {items:list,next:page<pages?'page='+(page+1):''};
 }

 async collection(route,next='page=1',signal){
  if(route?.kind==='channel')return this.channel(route.id,route.filters||{},next,signal);
  throw new ServiceError('红果暂未提供该栏目');
 }

 async searchableCatalog(signal){
  if(this.searchCache&&Date.now()-this.searchCache.at<SEARCH_CACHE_TTL)return this.searchCache.items;
  if(this.searchPending)return this.searchPending;
  const requestEpoch=this.cacheEpoch;
  const task=(async()=>{
   await this.ready(signal);
   const [home,...pages]=await Promise.all([this.home(signal),...CATEGORIES.map(category=>this.channel(category.id,{},'page=1',signal))]);
   const byID=new Map();
   for(const movie of [...home.blocks.flatMap(block=>block.data||[]),...pages.flatMap(page=>page.items)])byID.set(movie.url,movie);
   const items=[...byID.values()];if(requestEpoch===this.cacheEpoch)this.searchCache={at:Date.now(),items};return items;
  })();
  this.searchPending=task;
  try{return await task;}finally{if(this.searchPending===task)this.searchPending=null;}
 }

 async search(keyword,next='page=1',signal){
  abort(signal);
  const query=String(keyword||'').trim().toLocaleLowerCase();if(!query)return {items:[],next:''};
  // The public website search endpoint rejects requests without its browser token.
  // Search the same public catalogue pages as the site instead of synthesizing a token.
  const catalog=await this.searchableCatalog(signal),items=catalog.filter(movie=>{
   const labels=(movie.labels||[]).map(item=>item.name||item).join(' ');
   return (movie.title+' '+labels).toLocaleLowerCase().includes(query);
  });
  return {items,next:''};
 }

 rememberDetail(id,record){
  this.details.delete(String(id));this.details.set(String(id),record);
  while(this.details.size>20)this.details.delete(this.details.keys().next().value);
 }

 async detail(id,signal){
  await this.ready(signal);if(!number(id))throw new ServiceError('红果影片编号无效');
  const requestEpoch=this.cacheEpoch;
  const data=await this.routerPage('/detail?series_id='+encodeURIComponent(String(id)),'detail',signal),series=data.seriesDetail||data.series_detail;
  if(!isObject(series)||String(series.series_id??series.seriesId)!==String(id)){
   const message='红果影片详情与请求编号不匹配';this.lastDiagnostics={...this.lastDiagnostics,ok:false,error:message};throw new ServiceError(message,502);
  }
  const movie=canonicalMovie({...series,series_name:series.series_name||series.seriesName,hot_score_data:data.seriesSocialInfo?.hot_score_data}),vids=episodeIDs(series);
  if(!movie){const message='红果影片详情缺少标题或编号';this.lastDiagnostics={...this.lastDiagnostics,ok:false,error:message};throw new ServiceError(message,502);}
  if(!vids.length){const message='红果详情未返回有效剧集列表，官网页面结构可能已变化';this.lastDiagnostics={...this.lastDiagnostics,ok:false,error:message};throw new ServiceError(message,502);}
  const availableRaw=Number(series.accessible_episode_cnt??series.accessibleEpisodeCount??0),available=Number.isFinite(availableRaw)?Math.max(0,Math.min(Math.trunc(availableRaw),vids.length)):0;
  const detail={id:String(id),title:movie.title,imageURL:movie.imageURL,channelId:0,channelName:'短剧',labels:movie.labels,summary:String(series.series_intro||series.seriesIntro||''),actors:arrayField(series,'celebrities','actors').map(item=>item?.nickname||item?.name).filter(Boolean),bottomLabel:String(series.episode_right_text||series.episodeRightText||''),scoreText:data.seriesSocialInfo?.rating?String(data.seriesSocialInfo.rating)+'分':'',playbackNotice:NativeTransport.native()?'首次播放需稍候，已缓存剧集可快速打开。':available>0?'官网网页当前开放前 '+available+' 集完整播放，其余集请前往红果官方 App。':'使用官网整集播放线路，播放范围以官网返回为准。',previewNotice:'当前为官网公开试看片段，非完整剧集。全集请前往红果官方 App 观看。',playSources:[{siteId:'hongguo-official',name:NativeTransport.native()?'红果完整播放':'官网完整播放',total:vids.length,list:[]},{siteId:'hongguo-preview',name:'官网公开试看',preview:true,total:vids.length,list:[]}]};
  if(requestEpoch===this.cacheEpoch)this.rememberDetail(id,{detail,vids,accessible:available,at:Date.now()});
  return detail;
 }

 async episodes(id,line,signal){
  abort(signal);
  if(!this.details.has(String(id)))await this.detail(id,signal);
  const record=this.details.get(String(id));
  if(!record||!['hongguo-official','hongguo-preview'].includes(line?.siteId))return [];
  const episodes=record.vids.map((videoId,index)=>({id:videoId,title:'第'+(index+1)+'集'}));
  const target=record.detail.playSources.find(item=>item.siteId===line.siteId);
  if(target){target.list=episodes;target.total=episodes.length;}
  return episodes;
 }

 async publicPlayback(seriesId,videoId,signal){
  const path='/player/'+encodeURIComponent(seriesId)+'/'+encodeURIComponent(videoId);
  let data;
  try{data=await this.routerPage(path,'player',signal,{ttl:30_000});}
  catch(error){if(error.code===404)throw new ServiceError('红果官网未提供本集的公开试看。请前往红果官方 App 观看完整剧集。','HONGGUO_OFFICIAL_REQUIRED');throw error;}
  const seo=data.publicVideoSeo;
  // The publicVideoSeo asset is a short preview, separate from the complete
  // clear MP4 returned by the normal website's compatibility player endpoint.
  if(seo?.available!==true||String(seo.seriesId)!==seriesId||String(seo.itemId)!==videoId){
   throw new ServiceError('红果官网未提供本集的公开试看。请前往红果官方 App 观看完整剧集。','HONGGUO_OFFICIAL_REQUIRED');
  }
  return [{url:this.origin+'/video/public/'+encodeURIComponent(videoId)+'/360p.mp4',name:'官网公开试看 · 360P',preview:true,headers:{Referer:this.origin+path}}];
 }

 async fullPlayback(seriesId,videoId,signal){
  const referer=this.origin+'/player/'+encodeURIComponent(seriesId)+'/'+encodeURIComponent(videoId);
  const userAgent=globalThis.navigator?.userAgent||'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  // Exactly the website's HTML-video compatibility request. Do not use the
  // similarly named play-info endpoint: it returns encrypted, split DASH.
  const playbackEpoch=this.cacheEpoch;
  const key=seriesId+':'+videoId,cached=this.playCache.get(key);
  if(cached&&cached.expires>Date.now()+15000)return clonePlayURLs(cached.urls);
  this.playCache.delete(key);
  let response;
  for(let attempt=0;attempt<6;attempt++){
   response=await this.requestWithRetry({url:this.origin+'/api/video/protected/fallback-play-info',method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Origin:this.origin,Referer:referer,'User-Agent':userAgent},body:JSON.stringify({item_id:videoId})},signal,'红果整集播放');
   if(Number(response?.status)!==403)break;
   let reason;try{reason=parseJSON(decodeBase64(response.bodyBase64,MAX_PLAY_INFO_BYTES,'播放信息'),'播放信息')?.error;}catch{}
   if(reason!=='public_fallback_unavailable'||attempt===5)break;
   await new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason||new Error('播放请求已取消'));return;}
    const abort=()=>{clearTimeout(timer);reject(signal.reason||new Error('播放请求已取消'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},[250,500,1000,1500,2000][attempt]);
    signal?.addEventListener('abort',abort,{once:true});
   });
  }
  const status=Number(response?.status)||0;
  this.playbackDiagnostics={kind:'full-mp4',path:'/api/video/protected/fallback-play-info',status,ok:false};
  if(status===403||status===404)throw new ServiceError('红果官网未提供本集的完整播放。请前往红果官方 App 观看。','HONGGUO_OFFICIAL_REQUIRED');
  if(status<200||status>=300)throw new ServiceError('红果整集播放服务暂时不可用（HTTP '+status+'）',status||502);
  const data=parseJSON(decodeBase64(response.bodyBase64,MAX_PLAY_INFO_BYTES,'红果整集播放信息'),'红果整集播放信息');
  if(Number(data?.base_resp?.StatusCode)!==0)throw new ServiceError(String(data?.base_resp?.StatusMessage||'红果整集播放服务返回异常'),502);
  const url=officialMediaURL(data.main_url);
  if(!url||data.format==='dash'||data.encrypted===true||data.audio)throw new ServiceError('红果官网未返回兼容的完整 MP4，播放接口可能已变化',502);
  this.playbackDiagnostics={...this.playbackDiagnostics,ok:true,responseKeys:Object.keys(data),mediaHost:new URL(url).hostname};
  const urls=[{url,name:'官网完整播放',preview:false,headers:{Referer:referer,'User-Agent':userAgent,'Accept-Encoding':'identity'}}];
  let expires=Number(data.url_expire);if(expires<1e12)expires*=1000;
  if(playbackEpoch===this.cacheEpoch&&Number.isFinite(expires)&&expires>Date.now()+15000){
   this.playCache.set(key,{expires:Math.min(expires,Date.now()+300000),urls});
   while(this.playCache.size>64)this.playCache.delete(this.playCache.keys().next().value);
  }
  return clonePlayURLs(urls);
 }

 async play({vodId,siteId,episodeId},signal){
  const detail=this.details.get(String(vodId))?.detail||await this.detail(vodId,signal),record=this.details.get(String(vodId));
  const line=detail.playSources.find(item=>item.siteId===siteId);
  if(!line||!record?.vids.includes(String(episodeId)))throw new ServiceError('红果选集编号无效',404);
  let nativeFailure=false;
  if(!line.preview&&NativeTransport.native()){
   try{const local=await NativeTransport.hongguoResolve(String(vodId),String(episodeId),signal);return {playUrls:[{url:local.url,name:'红果本地完整播放',preview:false,localPrepared:true,referrerPolicy:'no-referrer',headers:{}}]};}
   catch(error){if(signal?.aborted||error.name==='AbortError')throw error;nativeFailure=true;this.playbackDiagnostics={kind:'native-model',ok:false,error:'native preparation failed; trying website compatibility'};}
  }
  try{return {playUrls:await (line.preview?this.publicPlayback(String(vodId),String(episodeId),signal):this.fullPlayback(String(vodId),String(episodeId),signal))};}
  catch(error){if(signal?.aborted||error.name==='AbortError')throw error;if(nativeFailure)throw new ServiceError('红果媒体暂时未准备成功，请稍后重试或切换剧集','HONGGUO_PREPARATION_FAILED');throw error;}
 }

 clearCache(){
  this.cacheEpoch++;
  this.playCache.clear();this.pageCache.clear();this.details.clear();this.searchCache=null;this.searchPending=null;
  this.preparedChannels.clear();this.channelPending.clear();this.lastDiagnostics=null;this.playbackDiagnostics=null;
 }

 async login(){throw new ServiceError('红果账户与会员权限由官网管理，当前不支持在 App 内登录',403);}
 async anonymous(){throw new ServiceError('红果官网访问不需要 App 访客账户',403);}
}
