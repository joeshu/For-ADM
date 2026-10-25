import {SiteClient,ServiceError} from './site-api.mjs';
import {safeHTTPS} from './model.mjs';

const crypto=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const decode=response=>JSON.parse(crypto().enc.Utf8.stringify(crypto().enc.Base64.parse(response.bodyBase64||'')));
const origin=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.origin:'';}catch{return '';}};
const numeric=value=>/^\d+$/.test(String(value||''));
const firstCursor=value=>value==null||value===''||value==='page=1'?'':String(value);
const nextCursor=data=>data?.hasNext&&data.nextVal!=null?String(data.nextVal):'';
const pageIndex=value=>{const raw=String(value||'page=1');const n=Number(new URLSearchParams(raw).get('page')||raw);return Number.isSafeInteger(n)&&n>0?n:1;};
const names=value=>(Array.isArray(value)?value:[]).map(x=>typeof x==='string'?x:x?.vodWorkerName||x?.name).filter(Boolean);
const authDenial=(code,message)=>[10001,10006,10012].includes(Number(code))||/登录|注册|会员|付费|权限|下载\s*APP|客户端限制/i.test(message||'');

export class YqkClient extends SiteClient {
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);this.protocol=site.protocol||{};this.details=new Map();this.movieHints=new Map();this.topicHints=new Map();this.childFilters=new Map();
  let stored=[];try{stored=JSON.parse(storage.getItem(this.key+'apiOrigins'))||[];}catch{}
  this.apiOrigins=[...new Set([...stored,...(this.protocol.apiOrigins||[])].map(origin).filter(Boolean))];
  try{const preferred=origin(storage.getItem(this.key+'preferredApiOrigin'));if(preferred&&this.apiOrigins.includes(preferred))this.preferred.cache=preferred;}catch{}
 }
 buildRequest(base,path,params={}){
  const p={...params,appId:this.protocol.appId,reqDomain:new URL(this.site.origin).host,deviceInfo:'iPhone',version:this.protocol.version||this.site.version,requestId:globalThis.crypto?.randomUUID?.()||crypto().lib.WordArray.random(16).toString(),cus1tom:'aabbcc',udid:this.device.id};
  if(!p.appId||!this.protocol.appKey||!p.version)throw Error('缺少网站接口配置，请更新 App');
  const sorted=Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]]));
  const input=Object.keys(sorted).filter(k=>sorted[k]!=='').map(k=>k+'='+sorted[k]+'&').join('')+'appKey='+this.protocol.appKey;
  sorted.sign=crypto().MD5(input).toString();
  return {url:new URL(path,base).href,method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8',Referer:this.site.origin+'/',Origin:this.site.origin},body:JSON.stringify(sorted)};
 }
 async network(request,signal,timeout=12000){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);
  try{const response=await this.transport({...request,signal:controller.signal});if(signal?.aborted)throw new DOMException('请求取消','AbortError');if(controller.signal.aborted)throw Error('网站接口请求超时');return response;}
  catch(error){if(signal?.aborted)throw new DOMException('请求取消','AbortError');if(error.name==='AbortError')throw Error('网站接口请求超时');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async post(path,params={},signal){
  const bases=[...new Set([this.preferred.cache,...this.apiOrigins].filter(Boolean))];let last;
  for(let offset=0;offset<bases.length;offset+=3){
   if(signal?.aborted)throw new DOMException('请求取消','AbortError');
   const controllers=new Map(),pending=bases.slice(offset,offset+3).map(base=>{const controller=new AbortController(),forward=()=>controller.abort();controllers.set(base,{controller,forward});signal?.addEventListener('abort',forward,{once:true});const started=Date.now();return this.network(this.buildRequest(base,path,params),controller.signal).then(response=>{
    if(response.status<200||response.status>=300)throw Error('网站接口返回 HTTP '+response.status);
    let body;try{body=decode(response);}catch{throw Error('网站接口数据格式已变化');}
    if(body?.result!==true){const message=body?.msg||'网站暂时无法提供数据';if(authDenial(body?.operateCode,message))throw new ServiceError(message,Number(body.operateCode)||403);throw Object.assign(Error(message),{businessDenial:true});}
    this.recordHealth(base,'cache',Date.now()-started,true);return {base,data:body.data};
   }).catch(error=>{if(!controllers.get(base).controller.signal.aborted)this.recordHealth(base,'cache',Date.now()-started,false);throw Object.assign(error,{failedBase:base});});});
   let remaining=pending.slice();
   while(remaining.length){
    const outcome=await Promise.race(remaining.map(p=>p.then(value=>({ok:true,p,value}),error=>({ok:false,p,error}))));
    remaining=remaining.filter(p=>p!==outcome.p);
    if(outcome.ok){for(const [base,{controller,forward}]of controllers){signal?.removeEventListener('abort',forward);if(base!==outcome.value.base)controller.abort();}this.preferred.cache=outcome.value.base;this.preferred.logic=outcome.value.base;try{this.storage.setItem(this.key+'preferredApiOrigin',outcome.value.base);}catch{}return outcome.value.data;}
    last=outcome.error;if(signal?.aborted)throw new DOMException('请求取消','AbortError');if(outcome.error instanceof ServiceError||outcome.error.businessDenial){for(const [base,{controller,forward}]of controllers){signal?.removeEventListener('abort',forward);controller.abort();}throw outcome.error;}
   }
   for(const [base,{controller,forward}]of controllers)signal?.removeEventListener('abort',forward);
  }
  throw last||Error('没有可用的网站数据线路');
 }
 async bootstrap(signal){
  try{
   if(this.apiOrigins.length){const data=await this.post('/v2/api/home/header',{},signal);if(!Array.isArray(data?.channeList))throw Error('网站分类数据格式已变化');this.childFilters.clear();this.config={vodTabs:data.channeList.filter(c=>numeric(c.channelId)&&c.channelName).map(c=>({type:'category',channelId:Number(c.channelId),text:String(c.channelName),isAdult:false})),adultChannelIds:[],groups:[],channelListQuery:[],urls:{cache:this.apiOrigins.slice(),logic:this.apiOrigins.slice()},supportsAccount:false};return this.config;}
   const r=await this.network({url:this.site.origin+'/js/baseUrlList.js',method:'GET',headers:{Referer:this.site.origin+'/'}},signal,8000);
   if(r.status===200){const text=crypto().enc.Utf8.stringify(crypto().enc.Base64.parse(r.bodyBase64||''));const match=text.match(/\bbaseApiList\s*=\s*(\[[\s\S]*?\])/);
    if(match){const list=JSON.parse(match[1]);if(Array.isArray(list)){const discovered=[...new Set(list.map(origin).filter(Boolean))];if(discovered.length){this.apiOrigins=[...new Set([...discovered,...this.apiOrigins])];try{this.storage.setItem(this.key+'apiOrigins',JSON.stringify(discovered));}catch{}}}}
   }
  }catch(error){if(error.name==='AbortError'||!this.apiOrigins.length)throw error;}
  const data=await this.post('/v2/api/home/header',{},signal);
  if(!Array.isArray(data?.channeList))throw Error('网站分类数据格式已变化');
  this.childFilters.clear();
  this.config={vodTabs:data.channeList.filter(c=>numeric(c.channelId)&&c.channelName).map(c=>({type:'category',channelId:Number(c.channelId),text:String(c.channelName),isAdult:false})),adultChannelIds:[],groups:[],channelListQuery:[],urls:{cache:this.apiOrigins.slice(),logic:this.apiOrigins.slice()},supportsAccount:false};
  return this.config;
 }
 async ready(signal){if(!this.config)await this.bootstrap(signal);}
 movie(item){
  if(!item||!numeric(item.vodId)||!item.vodName)return null;
  const flags=String(item.flags||''),row={title:String(item.vodName),url:'vod/detail?vodId='+item.vodId,imageURL:safeHTTPS(item.coverImg),bottomLabel:String(item.remark||''),scoreText:item.score?String(item.score)+'分':'',topLeftLabel:(item.iconList||[]).map(x=>x.iconText).filter(Boolean).slice(0,1).join(''),labels:flags.split('/').map(x=>({name:x.trim()})).filter(x=>x.name),channelId:/(?:^|\s|\/)[^/]*片(?:\s|\/|$)/.test(flags)?1:0,isAdult:false};
  this.movieHints.set(String(item.vodId),row);return row;
 }
 movies(value){return (Array.isArray(value)?value:[]).map(x=>this.movie(x)).filter(Boolean);}
 sections(value){return (Array.isArray(value)?value:[]).map(t=>{if(numeric(t.vodTopicId))this.topicHints.set(String(t.vodTopicId),t);return {header:{title:String(t.topicName||'精选片库'),...(numeric(t.vodTopicId)?{url:'specialTopic/vods?specialTopicId='+t.vodTopicId}:{})},data:this.movies(t.vodList)};}).filter(b=>b.data.length);}
 async home(signal){const [,d]=await Promise.all([this.ready(signal),this.post('/v2/api/home/body',{},signal)]);if(!Array.isArray(d?.vodTopicList))throw Error('网站首页结构已变化');return {blocks:this.sections(d.vodTopicList)};}
 async prepareChannel(channelId,signal){
  await this.ready(signal);if(!numeric(channelId))throw Error('无效分类');
  if(!this.childFilters.has(String(channelId))){const d=await this.post('/v2/api/channel/childListView',{channelId:Number(channelId)},signal);const children=(d?.childChannelList||[]).filter(c=>numeric(c.channelId)&&c.channelName);this.childFilters.set(String(channelId),children);
   this.config.channelListQuery.push({channelId:Number(channelId),items:[{query:'childChannelId',name:'类型',selected:'',data:[{id:'',name:'全部'},...children.map(c=>({id:String(c.channelId),name:String(c.channelName)}))]}]});
  }
 }
 async channel(channelId,filters={},next='page=1',signal){
  await this.prepareChannel(channelId,signal);
  const d=await this.post('/v2/api/channel/getVodList',{parentChannelId:Number(channelId),childChannelId:filters.childChannelId==null?'':String(filters.childChannelId),nextCount:24,nextVal:firstCursor(next)},signal);
  if(!Array.isArray(d?.items))throw Error('网站分类列表格式已变化');return {items:this.movies(d.items),next:nextCursor(d)};
 }
 async search(keyword,next='page=1',signal){await this.ready(signal);const d=await this.post('/v1/api/search/search',{keyword:String(keyword),nextCount:24,nextVal:firstCursor(next)},signal);if(!Array.isArray(d?.items))throw Error('网站搜索列表格式已变化');return {items:this.movies(d.items),next:nextCursor(d)};}
 async collection(route,next='page=1',signal){
  await this.ready(signal);if(route?.kind==='channel')return this.channel(route.id,{},next,signal);
  if(route?.kind==='topics')return {items:(await this.home(signal)).blocks.filter(b=>b.header.url).map(b=>({title:b.header.title,url:b.header.url,imageURL:safeHTTPS(this.topicHints.get(String(new URLSearchParams(b.header.url.split('?')[1]).get('specialTopicId')))?.coverImg)})),next:''};
  if(route?.kind!=='topic'||!numeric(route.id))throw Error('此网站没有提供该类栏目');
  const page=pageIndex(next),data=await this.post('/v1/api/vodTopic/getVodList',{vodTopicId:Number(route.id),pageIndex:page,pageSize:18},signal);
  if(!Array.isArray(data?.items))throw Error('网站专题列表格式已变化');return {items:this.movies(data.items),next:Number(data.totalPages)>page?'page='+(page+1):''};
 }
 async detail(id,signal){
  await this.ready(signal);if(!numeric(id))throw Error('无效影片');const d=await this.post('/v2/api/vodInfo/index',{vodId:Number(id)},signal);
  if(!numeric(d?.vodId)||!Array.isArray(d.playerList))throw Error('网站影片详情结构已变化');
  const hint=this.movieHints.get(String(id)),playSources=d.playerList.map((line,index)=>({siteId:String(line.vodPlayerKind??'line')+':'+index,name:String(line.playerName||'线路 '+(index+1)),total:Number(line.totalEpCount)||line.epList?.length||0,list:(line.epList||[]).filter(e=>numeric(e.epId)).map(e=>({id:Number(e.epId),title:String(e.epName||'选集'),open:false}))}));
  const out={id:String(d.vodId),title:String(d.vodName||''),imageURL:safeHTTPS(d.coverImg),scoreText:d.score?String(d.score)+'分':'',bottomLabel:String(d.updateRemark||''),year:d.year,area:d.areaName?[{name:String(d.areaName)}]:[],language:[],channelId:hint?.channelId||0,channelName:hint?.channelId===1?'电影':'影片',isAdult:false,summary:String(d.intro||''),actors:names(d.actorList),directors:names(d.directorList),labels:names(d.tagList),playSources};
  this.details.set(String(id),out);while(this.details.size>12)this.details.delete(this.details.keys().next().value);return out;
 }
 async episodes(id,line,signal){const d=this.details.get(String(id))||await this.detail(id,signal);return d.playSources.find(x=>x.siteId===line.siteId)?.list||[];}
 async play({vodId,siteId,episodeId},signal){
  await this.ready(signal);const d=this.details.get(String(vodId))||await this.detail(vodId,signal),line=d.playSources.find(x=>x.siteId===siteId);
  if(!line?.list.some(e=>String(e.id)===String(episodeId)))throw Error('此线路未找到对应选集');
  const resolutions=await this.post('/v2/api/vodInfo/epDetail',{vodEpId:Number(episodeId)},signal);
  if(!Array.isArray(resolutions))throw Error('网站清晰度数据格式已变化');const allowed=resolutions.filter(r=>r.canPlay===true),resolution=allowed.find(r=>r.defaultSelect===true)||allowed[0];
  // A successful metadata response may describe an app-only line. Skip it
  // without requesting a denied URL; explicit server auth errors remain fatal.
  if(!resolution)throw Error('此线路暂不提供可播放清晰度，请选择其他线路');
  const p=await this.post('/v2/api/vodInfo/playUrl',{vodResolution:resolution.vodResolution,epId:Number(episodeId)},signal),url=safeHTTPS(p?.playUrl);
  if(!url)throw Error(p?.popMsg||'此线路暂未返回可播放地址');return {playUrls:[{url,name:String(resolution.showName||'默认清晰度'),headers:{Referer:this.site.origin+'/'}}]};
 }
 async anonymous(){throw new ServiceError('此来源使用公开网站访问，暂不支持在 App 内创建访客账号',403);}
 async login(){throw new ServiceError('此来源暂不支持在 App 内登录，请保留原站访问限制',403);}
 async logout(){this.user=null;this.sessionKind='none';}
}
