import {ServiceError,SiteClient} from './site-api.mjs';
import {safeHTTPS} from './model.mjs';

const CATEGORIES=[
 {id:1,name:'真人剧',slug:'real-drama',type:1},
 {id:2,name:'漫剧',slug:'comic-drama',type:3},
 {id:3,name:'AI剧',slug:'ai-drama',type:4},
 {id:4,name:'漫画',slug:'comic',type:2},
];
const number=value=>/^\d{1,24}$/.test(String(value??''));
const firstPage=value=>Math.max(1,Number(new URLSearchParams(String(value||'page=1')).get('page'))||1);
const abort=signal=>{if(signal?.aborted)throw new DOMException('请求取消','AbortError');};
const officialMediaURL=value=>{
 const url=safeHTTPS(value);if(!url)return '';
 try{return /^v\d+-(?:reading|hgweb)\.qznovelvod\.com$/i.test(new URL(url).hostname)?url:'';}catch{return '';}
};

function decodeBase64(value){
 const binary=atob(String(value||'')),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new TextDecoder().decode(bytes);
}

export function parseHongguoRouterData(html){
 if(typeof html!=='string'||html.length>3_500_000)throw Error('红果页面数据过大或格式错误');
 const marker=html.indexOf('_ROUTER_DATA');if(marker<0)throw Error('红果页面没有返回目录数据');
 const start=html.indexOf('{',marker);if(start<0)throw Error('红果页面数据结构已变化');
 let depth=0,inString=false,escaped=false,end=-1;
 for(let index=start;index<html.length;index++){
  const char=html[index];
  if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue;}
  if(char==='"'){inString=true;continue;}
  if(char==='{'||char==='[')depth++;
  else if(char==='}'||char===']'){depth--;if(depth===0){end=index+1;break;}}
  if(depth<0)break;
 }
 if(end<0||end-start>2_500_000)throw Error('红果页面数据不完整');
 let result;try{result=JSON.parse(html.slice(start,end));}catch{throw Error('红果页面数据解析失败');}
 if(!result||typeof result!=='object'||!result.loaderData||typeof result.loaderData!=='object')throw Error('红果页面缺少目录数据');
 return result;
}

function firstPageData(router,kind){
 const entries=Object.entries(router?.loaderData||{});
 const preferred={home:['page'],category:['category_$'],detail:['detail_page','detail_$'],player:['player_(series_id)/page']}[kind]||[];
 for(const key of preferred){const value=router.loaderData[key];if(value&&typeof value==='object')return value;}
 const found=entries.find(([key,value])=>value&&typeof value==='object'&&key.includes(kind));
 return found?.[1]||null;
}

function canonicalMovie(row){
 const id=String(row?.series_id??row?.seriesId??row?.id??'');
 const title=String(row?.series_name||row?.series_title||row?.title||'').trim();
 if(!number(id)||!title)return null;
 const tags=Array.isArray(row.tags)?row.tags:Array.isArray(row.category_list)?row.category_list.map(x=>x?.name):[];
 const hot=row.hot_score_data?.text||row.hotScoreText||'';
 return {title,url:'vod/detail?vodId='+encodeURIComponent(id),imageURL:safeHTTPS(row.series_cover||row.cover||row.image),bottomLabel:String(row.episode_right_text||(/\d+/.test(String(row.episode_cnt||''))?'全'+row.episode_cnt+'集':'')),scoreText:String(hot),labels:tags.filter(x=>typeof x==='string'&&x).slice(0,8).map(name=>({name})),channelId:0,isAdult:false};
}

function pageNumber(data,fallback=1){
 const n=Number(data?.pagination?.pageNum)||Number(data?.query?.page)||fallback;
 return Math.max(1,n);
}

export class HongguoClient extends SiteClient{
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);this.pageCache=new Map();this.details=new Map();this.searchCache=null;this.origin=new URL(site.origin).origin;this.config=null;
 }
 async requestPage(path,signal,{ttl=180000}={}){
  abort(signal);const url=new URL(path,this.origin);
  if(url.origin!==this.origin)throw Error('红果页面地址无效');
  const cached=this.pageCache.get(url.href);if(cached&&Date.now()-cached.at<ttl)return cached.text;
  const response=await this.transport({url:url.href,method:'GET',headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'zh-CN,zh;q=0.9,en;q=0.5','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',Referer:this.origin+'/'},signal});
  abort(signal);
  if(response.status<200||response.status>=300)throw Error('红果官网返回 HTTP '+response.status);
  let html;try{html=decodeBase64(response.bodyBase64);}catch{throw Error('红果官网页面编码错误');}
  if(html.length>3_500_000)throw Error('红果官网页面超出安全大小限制');
  this.pageCache.set(url.href,{at:Date.now(),text:html});while(this.pageCache.size>32)this.pageCache.delete(this.pageCache.keys().next().value);
  return html;
 }
 async routerPage(path,kind,signal,options){
  const router=parseHongguoRouterData(await this.requestPage(path,signal,options)),data=firstPageData(router,kind);
  if(!data||data.isSuccess===false)throw Error('红果官网暂时没有返回'+({home:'首页',category:'分类',detail:'影片详情',player:'播放页'}[kind]||'页面')+'数据');
  return data;
 }
 async bootstrap(){
  if(this.config)return this.config;
  this.config={vodTabs:CATEGORIES.map(item=>({type:'category',channelId:item.id,text:item.name})),adultChannelIds:[],channelListQuery:[],groups:[],urls:{cache:[this.origin],logic:[this.origin]},supportsAccount:false};
  for(const category of CATEGORIES)this.config.channelListQuery.push({channelId:category.id,items:[]});
  return this.config;
 }
 async ready(signal){if(!this.config)await this.bootstrap(signal);abort(signal);}
 category(channelId){return CATEGORIES.find(item=>Number(item.id)===Number(channelId));}
 async home(signal){
  await this.ready(signal);const data=await this.routerPage('/', 'home', signal);
  const blocks=[];
  const banners=Array.isArray(data.mBannerList)?data.mBannerList:Array.isArray(data.bannerList)?data.bannerList:[];
  const bannerMovies=banners.map(canonicalMovie).filter(Boolean);
  if(bannerMovies.length)blocks.push({header:{title:'红果精选短剧',url:'catalog/channel?channelId=1'},data:bannerMovies});
  for(const section of Array.isArray(data.homeSections)?data.homeSections:[]){
   const category=section.tab_type==='human'?CATEGORIES[0]:section.tab_type==='comic'?CATEGORIES[1]:section.tab_type==='ai'?CATEGORIES[2]:section.tab_type==='comic-content'?CATEGORIES[3]:null;
   const items=(Array.isArray(section.video_list)?section.video_list:[]).map(canonicalMovie).filter(Boolean);
   if(items.length)blocks.push({header:{title:String(section.tab_name||'红果短剧'),...(category?{url:'catalog/channel?channelId='+category.id}:{url:'catalog/channel?channelId=1'})},data:items});
  }
  return {blocks};
 }
 async categoryData(category,filters={},page=1,signal){
  const selected=String(filters.topic||'');
  const filter=this.config?.channelListQuery?.find(row=>Number(row.channelId)===category.id)?.items?.find(item=>item.query==='topic');
  const option=filter?.data?.find(item=>String(item.id)===selected);
  const path='/category/'+category.slug+(option?.path?'/'+option.path:'')+'?page='+page;
  return this.routerPage(path,'category',signal);
 }
 async prepareChannel(channelId,signal){
  await this.ready(signal);const category=this.category(channelId);if(!category)throw Error('红果没有提供该分类');
  const definitions=this.config.channelListQuery.find(row=>row.channelId===category.id);if(definitions?.items?.length)return;
  const data=await this.categoryData(category,{},1,signal),selectors=Array.isArray(data.selectorList)?data.selectorList:[];
  const topicOptions=[];
  for(const row of selectors)for(const item of Array.isArray(row.items)?row.items:[]){
   const id=String(item.selector_item_id||'').trim(),name=String(item.show_name||'').trim();
   if(/^[a-z0-9-]{1,80}$/i.test(id)&&name)topicOptions.push({id,name,path:id});
  }
  if(topicOptions.length)definitions.items=[{query:'topic',name:'题材',selected:'',data:[{id:'',name:'全部'},...topicOptions]}];
 }
 async channel(channelId,filters={},next='page=1',signal){
  await this.prepareChannel(channelId,signal);const category=this.category(channelId),page=firstPage(next),data=await this.categoryData(category,filters,page,signal);
  const items=(Array.isArray(data.recommendList)?data.recommendList:[]).map(canonicalMovie).filter(Boolean),pages=Number(data.pagination?.totalPages)||page;
  return {items,next:page<pages?'page='+(page+1):''};
 }
 async collection(route,next='page=1',signal){
  if(route?.kind==='channel')return this.channel(route.id,route.filters||{},next,signal);
  throw Error('红果暂未提供该栏目');
 }
 async searchableCatalog(signal){
  if(this.searchCache&&Date.now()-this.searchCache.at<120000)return this.searchCache.items;
  await this.ready(signal);const home=await this.home(signal),fromHome=home.blocks.flatMap(block=>block.data||[]);
  const pages=await Promise.all(CATEGORIES.map(category=>this.channel(category.id,{},'page=1',signal)));
  const byId=new Map();for(const movie of [...fromHome,...pages.flatMap(page=>page.items)])byId.set(movie.url,movie);
  this.searchCache={at:Date.now(),items:[...byId.values()]};return this.searchCache.items;
 }
 async search(keyword,next='page=1',signal){
  const query=String(keyword||'').trim().toLocaleLowerCase();if(!query)return {items:[],next:''};
  // The public website's search-result endpoint currently rejects requests
  // without its browser security token. Search only the public catalog pages
  // already served to the website instead of synthesizing that token.
  const catalog=await this.searchableCatalog(signal),items=catalog.filter(movie=>{
   const labels=(movie.labels||[]).map(item=>item.name||item).join(' ');
   return (movie.title+' '+labels).toLocaleLowerCase().includes(query);
  });
  return {items,next:''};
 }
 async detail(id,signal){
  await this.ready(signal);if(!number(id))throw Error('红果影片编号无效');
  const data=await this.routerPage('/detail?series_id='+encodeURIComponent(String(id)),'detail',signal),series=data.seriesDetail;
  if(!series||String(series.series_id)!==String(id))throw Error('红果影片详情与请求编号不匹配');
  const movie=canonicalMovie({...series,series_name:series.series_name,hot_score_data:data.seriesSocialInfo?.hot_score_data}),vids=Array.isArray(series.vid_list)?series.vid_list.map(String).filter(number):[];
  if(!movie)throw Error('红果影片详情缺少标题或编号');
  const available=Number(series.accessible_episode_cnt)||0;
  const detail={id:String(id),title:movie.title,imageURL:movie.imageURL,channelId:0,channelName:'短剧',labels:movie.labels,summary:String(series.series_intro||''),actors:(Array.isArray(series.celebrities)?series.celebrities:[]).map(item=>item.nickname).filter(Boolean),bottomLabel:String(series.episode_right_text||''),scoreText:data.seriesSocialInfo?.rating?String(data.seriesSocialInfo.rating)+'分':'',playSources:[{siteId:'hongguo-official',name:'红果官方线路 · 720P',total:vids.length,list:[]} ]};
  this.details.set(String(id),{detail,vids,accessible:Math.min(available,vids.length)});while(this.details.size>20)this.details.delete(this.details.keys().next().value);
  return detail;
 }
 async episodes(id,line,signal){
  abort(signal);if(!this.details.has(String(id)))await this.detail(id,signal);const record=this.details.get(String(id));
  if(!record||line?.siteId!=='hongguo-official')return [];
  const episodes=record.vids.map((videoId,index)=>({id:videoId,title:'第'+(index+1)+'集'}));
  const target=record.detail.playSources.find(item=>item.siteId==='hongguo-official');
  if(target){target.list=episodes;target.total=episodes.length;}
  return episodes;
 }
 async playInfo(seriesId,videoId,signal){
  abort(signal);const url=this.origin+'/api/video/protected/play-info',referer=this.origin+'/player/'+encodeURIComponent(seriesId)+'/'+encodeURIComponent(videoId);
  const response=await this.transport({url,method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Origin:this.origin,Referer:referer},body:JSON.stringify({series_id:String(seriesId),item_id:String(videoId),definition:'720p'}),signal});
  abort(signal);let data;try{data=JSON.parse(decodeBase64(response.bodyBase64));}catch{throw new ServiceError('红果播放服务返回了无法识别的数据',response.status||502);}
  if(response.status<200||response.status>=300){
   if(response.status===403&&data?.error==='protected_playback_unavailable')throw new ServiceError('红果网页播放器没有返回此集地址；官网提示可前往红果App免费看全集。',403);
   throw new ServiceError('红果播放服务返回 HTTP '+response.status,response.status);
  }
  if(Number(data?.base_resp?.StatusCode)!==0)throw new ServiceError(String(data?.base_resp?.StatusMessage||'红果播放服务暂不可用'),data?.base_resp?.StatusCode||502);
  const info=data?.play_info;if(!info||typeof info!=='object')throw new ServiceError('红果播放服务没有返回媒体信息',502);
  const urls=[['main_url','720P · 主线路'],['backup_url','720P · 备用线路']].map(([key,name])=>({url:officialMediaURL(info[key]),name,headers:{Referer:referer}})).filter(item=>item.url);
  if(!urls.length)throw new ServiceError('红果播放服务没有返回可用的官方线路',502);
  return urls;
 }
 async play({vodId,siteId,episodeId},signal){
  const detail=this.details.get(String(vodId))?.detail||await this.detail(vodId,signal);
  const line=detail.playSources.find(item=>item.siteId===siteId),record=this.details.get(String(vodId));
  if(!line||!record?.vids.includes(String(episodeId)))throw new ServiceError('红果选集编号无效',404);
  return {playUrls:await this.playInfo(String(vodId),String(episodeId),signal)};
 }
 async login(){throw new ServiceError('红果账户与会员权限由官网管理，当前不支持在 App 内登录',403);}
 async anonymous(){throw new ServiceError('红果官网访问不需要 App 访客账户',403);}
}
