import {SiteClient,ServiceError} from './site-api.mjs';
import {safeHTTPS} from './model.mjs';

const C=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const KINDS=[['movie',1,'电影'],['series',2,'电视剧'],['anime',3,'动漫'],['variety',4,'综艺'],['short_drama',6,'短剧'],['documentary',7,'纪录片']];
const QUERY_KEYS=new Set(['kind','genre','area','language','year','year_gte','year_lte','sort','window','intent','q','hot_list_key','include_unavailable','candidate_set_ref','continue_search','cursor']);
const safeID=value=>typeof value==='string'&&/^av_[A-Za-z0-9_-]{1,2048}$/.test(value);
const abortIf=signal=>{if(signal?.aborted)throw new DOMException('请求取消','AbortError');};
const names=value=>(Array.isArray(value)?value:[]).map(x=>typeof x==='string'?x:x?.name||x?.title).filter(Boolean);
const decode=response=>{if((response.bodyBase64||'').length>12*1024*1024)throw Error('搜剧AI响应过大');try{return JSON.parse(C().enc.Utf8.stringify(C().enc.Base64.parse(response.bodyBase64||'')));}catch{throw Error('搜剧AI响应格式已变化');}};
const header=(response,key)=>Object.entries(response.headers||{}).find(([k])=>k.toLowerCase()===key)?.[1];
const cookieFrom=response=>{const text=String(header(response,'set-cookie')||'');return [...text.matchAll(/(?:^|[,;\s])ai_movie_session=([^;,\s]*)/g)].map(m=>m[1]).filter(v=>v&&v.length<8192&&!/[\r\n]/.test(v)).map(v=>'ai_movie_session='+v).pop()||'';};
const safeParams=params=>Object.fromEntries(Object.entries(params||{}).filter(([k,v])=>QUERY_KEYS.has(k)&&['string','number','boolean'].includes(typeof v)&&String(v).length<=8192&&!/[\r\n]/.test(String(v))));
const lineKey=line=>String(line.playback_source_id||line.id||line.provider_id||'');
const directLine=line=>line&&Number(line.minimum_user_level||0)<=0&&!line.resolve_required&&line.resolved!==false&&line.resolve_mode!=='parse'&&line.url_kind!=='resolve_ticket'&&safeHTTPS(line.url);
const mediaLine=line=>{
 const headers={};for(const [key,value]of Object.entries(line.headers||{}))if(typeof value==='string'&&/^[A-Za-z0-9-]+$/.test(key)&&!/[\r\n]/.test(value)&&!['cookie','authorization','host','content-length','connection'].includes(key.toLowerCase()))headers[key]=value;
 if(typeof line.userAgent==='string'&&!/[\r\n]/.test(line.userAgent))headers['User-Agent']=line.userAgent;
 return {url:safeHTTPS(line.url),name:String(line.display_label||line.label||line.provider_name||'直连线路'),headers,referrerPolicy:'no-referrer'};
};

// Uses the same public request protocol and normal anonymous identity as the site.
// Cookies stay in memory / native Keychain. Catalog IDs may be persisted, never
// episode tokens or signed media URLs.
export class SoujuClient extends SiteClient {
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);this.protocol=site.protocol||{};this.details=new Map();this.registry=new Map();this.collections=new Map();this.filterOptions=new Map();this.resolves=new Map();this.cooldownUntil=0;this.session=null;this.sessionLoad=null;this.guestPending=null;
  try{for(const [key,value]of JSON.parse(storage.getItem(this.key+'ids')||'[]'))if(/^sj_[a-f0-9]{32}$/.test(key)&&safeID(value))this.registry.set(key,value);}catch{}
 }
 id(raw){if(!safeID(raw))throw Error('搜剧AI影片标识无效');if(raw.length<=80)return raw;const id='sj_'+C().SHA256(raw).toString().slice(0,32);this.registry.delete(id);this.registry.set(id,raw);while(this.registry.size>2000)this.registry.delete(this.registry.keys().next().value);return id;}
 persistIDs(){try{this.storage.setItem(this.key+'ids',JSON.stringify([...this.registry]));}catch{}}
 rawID(id){const raw=this.registry.get(String(id))||String(id);if(!safeID(raw))throw Error('此影片索引已失效，请在搜剧AI中重新搜索');return raw;}
 async network(request,signal){
  abortIf(signal);const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,16000);
  try{const response=await this.transport({...request,signal:controller.signal});abortIf(signal);return response;}
  catch(error){abortIf(signal);if(controller.signal.aborted)throw Error('搜剧AI请求超时，请重试');throw error;}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
 }
 async raw(path,body,cookie,signal){
  abortIf(signal);if(!/^\/v1\//.test(path)||/[\r\n#]/.test(path)||path.length>16000)throw Error('无效搜剧AI接口');
  if(Date.now()<this.cooldownUntil)throw new ServiceError('搜剧AI请求过于频繁，请稍后重试',429);
  if(!this.protocol.signingKey)throw Error('搜剧AI接口配置缺失，请更新 App');
  const method=body===undefined?'GET':'POST',timestamp=String(Date.now()),nonce=C().lib.WordArray.random(16).toString(),signature=C().HmacSHA256(method+'\n'+path+'\n'+timestamp+'\n'+nonce,this.protocol.signingKey).toString();
  const headers={Accept:'application/json','Content-Type':'application/json',Origin:this.site.origin,Referer:this.site.origin+'/','x-ai-movie-timestamp':timestamp,'x-ai-movie-nonce':nonce,'x-ai-movie-signature':signature};if(cookie)headers.Cookie=cookie;
  const response=await this.network({url:this.site.origin+path,method,headers,...body===undefined?{}:{body:JSON.stringify(body)}},signal),data=decode(response);
  if(response.status<200||response.status>=300||data?.error){
   const status=Number(response.status),code=String(data?.error?.code||data?.code||''),denial=[401,402,403,429].includes(status);if(status===429)this.cooldownUntil=Date.now()+30000;
   const message=status===429?'搜剧AI请求过于频繁，请稍后重试':status===402?'此线路的原站额度不足':status===403?'原站暂未开放此资源或账号权限不足':status===401&&/signature/i.test(code)?'搜剧AI请求协议已更新，请更新 App':status===401?'搜剧AI访客会话已失效':'搜剧AI接口返回 HTTP '+status;
   const error=denial?new ServiceError(message,status):Error(message);Object.assign(error,{status,apiCode:code});throw error;
  }
  return {data,response};
 }
 async restoreGuest(){
  if(!this.sessionLoad)this.sessionLoad=(async()=>{if(!this.vault)return;try{const value=await this.vault.get(this.site.id);if(value?.schema===2&&/^ai_movie_session=[^\s;,]+$/.test(value.cookie||'')&&Number(value.expiresAt)>Date.now()+60000)this.session=value;}catch{}})();
  await this.sessionLoad;
 }
 async ensureSession(signal){
  abortIf(signal);await this.restoreGuest();if(this.session?.expiresAt>Date.now()+60000)return this.session;
  if(!this.guestPending)this.guestPending=(async()=>{
   const {data,response}=await this.raw('/v1/users/anonymous',{anonymous_id:'web_'+this.device.id.replace(/-/g,'')},'',undefined),cookie=cookieFrom(response);if(!cookie)throw Error('搜剧AI未返回有效访客会话');
   const expires=Date.parse(data.expires_at);this.session={schema:2,cookie,expiresAt:Number.isFinite(expires)?expires:Date.now()+3600000};this.sessionKind='guest';
   if(this.vault)try{await this.vault.put(this.site.id,this.session);}catch{}
   return this.session;
  })().finally(()=>{this.guestPending=null;});
  const session=await this.guestPending;abortIf(signal);return session;
 }
 async api(path,signal){
  const session=await this.ensureSession(signal);
  try{return (await this.raw(path,undefined,session.cookie,signal)).data;}
  catch(error){
   if(error.status!==401||/signature/i.test(error.apiCode||'')||!/session|authentication|unauthorized/i.test(error.apiCode||''))throw error;
   if(this.session===session)this.session=null;const renewed=await this.ensureSession(signal);return (await this.raw(path,undefined,renewed.cookie,signal)).data;
  }
 }
 async bootstrap(signal){
  abortIf(signal);if(this.config)return this.config;if(!this.bootstrapPending)this.bootstrapPending=(async()=>{
   const [{data:runtime}]=await Promise.all([this.raw('/v1/runtime/bootstrap',undefined,'',undefined),this.ensureSession()]);
   const catalogs=Array.isArray(runtime.catalog_ui?.catalogs)?runtime.catalog_ui.catalogs:[],availableKinds=KINDS.filter(([kind])=>catalogs.some(catalog=>catalog.kind===kind));
   const vodTabs=availableKinds.map(([kind,channelId,text])=>({type:'category',channelId,text}));
   const channelListQuery=availableKinds.map(([kind,channelId])=>{
    const catalog=catalogs.find(c=>c.kind===kind),maps=new Map(),items=[];
    for(const row of catalog?.rows||[]){const query=row.key==='genre'?'class':row.key;if(!['class','area','language','year','sort'].includes(query))continue;
     const options=new Map(),data=[{id:'',name:String(row.all_label||'全部')}];
     for(const option of row.options||[]){if(option.enabled===false)continue;const id=String(option.key||'');if(!id||id==='3')continue;options.set(id,safeParams(option.params));data.push({id,name:String(option.label||id)});}
     maps.set(query,options);items.push({query,selected:query==='sort'?String(catalog.default_sort||'heat_desc'):'',data});
    }
    if(!maps.has('sort')){maps.set('sort',new Map([['updated_desc',{sort:'updated_desc'}],['heat_desc',{sort:'heat_desc'}]]));items.push({query:'sort',selected:'heat_desc',data:[{id:'heat_desc',name:'最热'},{id:'updated_desc',name:'最新'}]});}
    this.filterOptions.set(channelId,maps);return {channelId,items};
   });
   this.config={vodTabs,channelListQuery,groups:[],adultChannelIds:[],supportsAccount:false,urls:{cache:[this.site.origin],logic:[this.site.origin]}};return this.config;
  })().finally(()=>{this.bootstrapPending=null;});
  const result=await this.bootstrapPending;abortIf(signal);return result;
 }
 movies(cards){
  if(!Array.isArray(cards))throw Error('搜剧AI片单结构已变化');const out=[];
  for(const movie of cards){if(!safeID(movie?.id)||!movie.title||movie.content_kind==='adult')continue;const kind=KINDS.find(k=>k[0]===movie.content_kind),id=this.id(movie.id);out.push({title:String(movie.title),url:'vod/detail?vodId='+id,imageURL:safeHTTPS(movie.poster_url),channelId:kind?.[1]||0,isAdult:false,bottomLabel:String(movie.remarks||movie.availability?.label||''),topLeftLabel:movie.availability?.disabled?'暂未上线':'',labels:names(movie.genres).map(name=>({name}))});}
  this.persistIDs();return out;
 }
 async home(signal){
  await this.bootstrap(signal);const data=await this.api('/v1/feed/home?scope=public&mode=preview&sections=11&cards=8',signal);if(!Array.isArray(data.sections))throw Error('搜剧AI首页结构已变化');
  const blocks=data.sections.map(section=>{
   let route='';const browse=section.browse;if(browse?.path==='/v1/browse/catalog'&&(!browse.method||browse.method==='GET')){const id=String(parseInt(C().SHA256(String(section.id)).toString().slice(0,12),16));this.collections.set(id,safeParams(browse.params));route='specialTopic/vods?specialTopicId='+id;}
   return {header:{title:String(section.title||'精选'),url:route},data:this.movies(section.cards||[])};
  });return {blocks};
 }
 pageParams(next){const params=new URLSearchParams(next||'page=1'),page=Number(params.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>500)throw Error('搜剧AI页码无效');return {page,...params.get('cursor')?{cursor:params.get('cursor')}:{}};}
 async browse(params,next='page=1',signal){
  const paging=this.pageParams(next),query=new URLSearchParams();for(const [key,value]of Object.entries({...safeParams(params),...paging,limit:20}))if(value!==''&&value!=null)query.set(key,String(value));
  const data=await this.api('/v1/browse/catalog?'+query,signal);if(!Array.isArray(data.cards))throw Error('搜剧AI片单结构已变化');
  const p=data.pagination||{};let continuation='';if(p.has_more){const page=Number(p.next_page||paging.page+1),cursor=p.next_cursor;if(!Number.isSafeInteger(page)||page<=paging.page)throw Error('搜剧AI分页未推进');continuation=new URLSearchParams({page:String(page),...cursor?{cursor:String(cursor)}:{}}).toString();}
  if(!data.cards.length&&data.source_statuses?.some(s=>s.status==='failed'))throw Error('搜剧AI片库暂时不可用，请重试');
  return {items:this.movies(data.cards),next:continuation};
 }
 async channel(channelId,filters={},next='page=1',signal){
  await this.bootstrap(signal);const kind=KINDS.find(k=>k[1]===Number(channelId));if(!kind)throw Error('搜剧AI分类无效');const params={kind:kind[0]},maps=this.filterOptions.get(Number(channelId));
  for(const [query,value]of Object.entries(filters)){if(value===''||value==='3')continue;const mapped=maps?.get(query)?.get(String(value));if(mapped)Object.assign(params,mapped);else if(query==='class')params.genre=String(value);else if(['area','language','year','sort'].includes(query))params[query]=String(value);}
  if(!params.sort)params.sort=this.config.channelListQuery.find(c=>c.channelId===Number(channelId))?.items.find(i=>i.query==='sort')?.selected||'heat_desc';
  return this.browse(params,next,signal);
 }
 async search(keyword,next='page=1',signal){const q=String(keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();if(!q)return {items:[],next:''};if(q.length>200)throw Error('搜索词过长');await this.bootstrap(signal);return this.browse({q,intent:'catalog_search'},next,signal);}
 async collection(route,next='page=1',signal){await this.bootstrap(signal);let params=this.collections.get(String(route?.id));if(!params){await this.home(signal);params=this.collections.get(String(route?.id));}if(!params)throw Error('搜剧AI栏目已更新，请刷新首页');return this.browse(params,next,signal);}
 async discovery(tab,next='page=1',signal){await this.bootstrap(signal);if(Number(tab)===2)return this.home(signal);return this.browse(Number(tab)===1?{sort:'trending',window:'day'}:{intent:'latest_catalog'},next,signal);}
 async episodePage(raw,offset,signal){const data=await this.api('/v1/catalog/'+raw+'/episodes?offset='+offset+'&limit=100&anchor=start',signal);if(data.variant_id!==raw||!Array.isArray(data.episodes)||typeof data.episode_pagination?.has_more!=='boolean')throw Error('搜剧AI分集数据不匹配');return data;}
 async allEpisodes(raw,signal){
  let offset=0,total=null;const out=[],seen=new Set();
  for(let page=0;page<100;page++){
   abortIf(signal);const data=await this.episodePage(raw,offset,signal),p=data.episode_pagination;if(p.offset!=null&&Number(p.offset)!==offset)throw Error('搜剧AI分集分页位置不匹配');
   if(p.total_count!=null){const n=Number(p.total_count);if(!Number.isSafeInteger(n)||n<0||n>10000||total!=null&&n!==total)throw Error('搜剧AI分集总数发生变化，请重新打开详情');total=n;}
   let added=0;for(const episode of data.episodes){if(!safeID(episode?.id)||!safeID(episode?.token)||seen.has(episode.id))continue;seen.add(episode.id);out.push({id:episode.id,title:String(episode.display_name||episode.title||'选集'),open:false,pageOffset:offset});added++;}
   if(!p.has_more){if(total!=null&&out.length!==total)throw Error('搜剧AI分集未完整返回，请重新打开详情');return out;}
   if(!added||!data.episodes.length)throw Error('搜剧AI分集分页未推进');offset+=data.episodes.length;
  }
  throw Error('搜剧AI分集超出安全上限');
 }
 async resolve(raw,episode,signal){
  const page=await this.episodePage(raw,episode.pageOffset||0,signal),fresh=page.episodes.find(e=>e.id===episode.id);if(!safeID(fresh?.token))throw Error('此影片中未找到所选集，请刷新选集');
  const data=await this.api('/v1/playback/resolve/'+fresh.token,signal);if(data.current_episode?.id!==episode.id||!Array.isArray(data.line_options))throw Error('搜剧AI返回了其他集的播放数据');return data.line_options;
 }
 async detail(id,signal){
  await this.bootstrap(signal);const raw=this.rawID(id),data=await this.api('/v1/catalog/'+raw,signal);if(data.id!==raw)throw Error('搜剧AI影片详情不匹配');const episodes=await this.allEpisodes(raw,signal),kind=KINDS.find(k=>k[0]===data.content_kind),encoded=this.id(raw);
  const lines=episodes.length?await this.resolve(raw,episodes[0],signal):[],direct=lines.filter(directLine),unique=[...new Map(direct.map(l=>[lineKey(l),l])).values()];
  const playSources=episodes.length?[{siteId:'auto',name:'智能直连',total:episodes.length,list:episodes},...unique.map(line=>({siteId:lineKey(line),name:mediaLine(line).name,total:episodes.length,list:episodes}))]:[];
  const seasons=(data.variants||data.seasons||[]).filter(v=>safeID(v.id)&&v.has_playback!==false).map(v=>({id:this.id(v.id),title:String(v.season_label||v.title||'其他季'),selected:v.id===raw}));
  const out={id:encoded,title:String(data.title||''),imageURL:safeHTTPS(data.poster_url),year:data.year,area:data.area?[{name:String(data.area)}]:[],language:data.language?[{name:String(data.language)}]:[],channelId:kind?.[1]||0,channelName:kind?.[2]||'影片',isAdult:false,summary:String(data.description||''),actors:names(data.actors),directors:names(data.directors),labels:names(data.genres),bottomLabel:String(data.remarks||''),playSources,seasons};
  this.details.delete(encoded);this.details.set(encoded,out);while(this.details.size>12)this.details.delete(this.details.keys().next().value);this.persistIDs();return out;
 }
 async episodes(id,line,signal){const d=this.details.get(String(id))||await this.detail(id,signal);return d.playSources.find(x=>x.siteId===line.siteId)?.list||[];}
 async play({vodId,siteId,episodeId},signal){
  const detail=this.details.get(String(vodId))||await this.detail(vodId,signal),source=detail.playSources.find(s=>s.siteId===siteId),episode=source?.list.find(e=>e.id===episodeId);if(!episode)throw Error('此线路未找到所选集');
  const lines=(await this.resolve(this.rawID(vodId),episode,signal)).filter(directLine),chosen=siteId==='auto'?lines:lines.filter(l=>lineKey(l)===siteId);if(!chosen.length)throw Error('此集暂未提供当前直连线路，请切换同集的其他线路');
  const unique=new Map();for(const line of chosen)if(!unique.has(line.url))unique.set(line.url,mediaLine(line));return {playUrls:[...unique.values()]};
 }
 async anonymous(){await this.ensureSession();return {guest:true};}
 async login(){throw new ServiceError('当前搜剧AI适配使用原站匿名访客会话',403);}
 async logout(){this.session=null;if(this.vault)await this.vault.remove(this.site.id);}
}
