import {SiteClient,ServiceError} from './site-api.mjs';
import {safeHTTPS} from './model.mjs';

const C=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const KINDS=[['series',2,'电视剧'],['movie',1,'电影'],['short_drama',6,'短剧'],['anime',3,'动漫'],['variety',4,'综艺'],['documentary',7,'纪录片'],['sports',8,'体育'],['adult',5,'限制级']];
const QUERY_KEYS=new Set(['kind','area','genre','year','language','q','page','limit','sort','intent','window','hot_list_key','channel','channel_id','candidate_set_ref','cursor']);
const safeID=value=>typeof value==='string'&&/^av_[A-Za-z0-9_-]{1,4096}$/.test(value);
const abortIf=signal=>{if(signal?.aborted)throw new DOMException('请求取消','AbortError');};
const names=value=>(Array.isArray(value)?value:[]).map(x=>typeof x==='string'?x:x?.name||x?.title).filter(Boolean);
const safeParams=params=>Object.fromEntries(Object.entries(params||{}).filter(([key,value])=>QUERY_KEYS.has(key)&&['string','number','boolean'].includes(typeof value)&&String(value).length<=8192&&!/[\r\n]/.test(String(value))));
const decode=response=>{if((response.bodyBase64||'').length>24*1024*1024)throw Error('看剧AI响应过大');try{return JSON.parse(C().enc.Utf8.stringify(C().enc.Base64.parse(response.bodyBase64||'')));}catch{throw Error('看剧AI响应格式已变化');}};
const lineKey=line=>{const key=[line.provider_id||'',line.play_from||'',line.url_kind||''].join('|');return key!=='||'?key:String(line.id||line.label||'');};
const userLevel=line=>Number(line?.minimum_user_level??line?.minimumUserLevel??0);
const directLine=line=>!!line&&userLevel(line)<=0&&!line.resolve_required&&line.resolved!==false&&line.resolve_mode!=='parse'&&line.url_kind!=='resolve_ticket'&&['m3u8','mp4'].includes(String(line.url_kind||'').toLowerCase())&&!!safeHTTPS(line.url);
const ticketLine=line=>!!line&&userLevel(line)<=0&&line.url_kind==='resolve_ticket'&&typeof line.url==='string'&&line.url.startsWith('resolve://')&&line.url.length<=8192&&!/[\r\n]/.test(line.url);
function lineOrder(a,b){
 const selected=Number(!!b.selected)-Number(!!a.selected);if(selected)return selected;
 const priority=Number(!!b.default_priority)-Number(!!a.default_priority);if(priority)return priority;
 const weight=Number(b.preference_weight||0)-Number(a.preference_weight||0);if(weight)return weight;
 return Number(b.url_kind==='m3u8')-Number(a.url_kind==='m3u8');
}
function mediaLine(line){
 const headers={};
 for(const [key,value]of Object.entries(line.headers||{})){
  if(typeof value==='string'&&/^[A-Za-z][A-Za-z0-9-]*$/.test(key)&&!/[\r\n]/.test(value)&&!['cookie','authorization','host','content-length','connection'].includes(key.toLowerCase()))headers[key]=value;
 }
 const userAgent=line.user_agent||line.userAgent;
 if(typeof userAgent==='string'&&!/[\r\n]/.test(userAgent))headers['User-Agent']=userAgent;
 return {url:safeHTTPS(line.url),name:String(line.label||line.display_label||line.provider_name||'直连线路'),headers};
}

// Native transport performs normal TLS certificate validation. Only public
// catalog IDs are persisted; episode tokens, tickets and media URLs stay in memory.
export class KanjuClient extends SiteClient {
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);this.protocol=site.protocol||{};this.origins=[...new Set([site.origin,...(this.protocol.apiOrigins||[])])].filter(value=>{try{return new URL(value).protocol==='https:';}catch{return false;}});
  this.details=new Map();this.registry=new Map();this.collections=new Map();this.filterOptions=new Map();this.badOrigins=new Map();this.cooldownUntil=0;this.bootstrapPending=null;
  try{for(const [key,value]of JSON.parse(storage.getItem(this.key+'ids')||'[]'))if(/^kj_[a-f0-9]{32}$/.test(key)&&safeID(value))this.registry.set(key,value);}catch{}
 }
 discoveryProfile(){return {timeline:false,timelineTab:null,sectionTab:'2',tabs:[{id:'0',name:'最新更新',mode:'latest'},{id:'1',name:'今日热播',mode:'trending'},{id:'2',name:'首页推荐',mode:'home'}]};}
 id(raw){
  if(!safeID(raw))throw Error('看剧AI影片标识无效');
  if(raw.length<=80)return raw;
  const id='kj_'+C().SHA256(raw).toString().slice(0,32);this.registry.delete(id);this.registry.set(id,raw);
  while(this.registry.size>2000)this.registry.delete(this.registry.keys().next().value);return id;
 }
 persistIDs(){try{this.storage.setItem(this.key+'ids',JSON.stringify([...this.registry]));}catch{}}
 rawID(id){const raw=this.registry.get(String(id))||String(id);if(!safeID(raw))throw Error('此影片索引已失效，请重新打开看剧AI片库');return raw;}
 async network(request,signal){
  abortIf(signal);const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,8000);
  try{const response=await this.transport({...request,signal:controller.signal});abortIf(signal);if(controller.signal.aborted)throw Error('看剧AI请求超时，请重试');return response;}
  catch(error){abortIf(signal);if(controller.signal.aborted)throw Error('看剧AI请求超时，请重试');throw error;}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
 }
 requestHeaders(origin,method,path){
  if(!this.protocol.signingKey)throw Error('看剧AI接口配置缺失，请更新 App');
  const timestamp=String(Date.now()),nonce=C().lib.WordArray.random(16).toString(),signature=C().HmacSHA256(method+'\n'+path+'\n'+timestamp+'\n'+nonce,this.protocol.signingKey).toString();
  return {Accept:'application/json','Content-Type':'application/json',Origin:origin,Referer:origin+'/', 'User-Agent':this.protocol.userAgent||'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1','client-name':this.protocol.clientName||'dianyingtiantang-frontend','client-version':this.protocol.clientVersion||'1.0.0','build-version':this.protocol.buildVersion||'','protocol-version':this.protocol.protocolVersion||'','x-ai-movie-timestamp':timestamp,'x-ai-movie-nonce':nonce,'x-ai-movie-signature':signature};
 }
 async api(path,{method='GET',body,signal}={}){
  abortIf(signal);if(!/^\/v1\//.test(path)||/[\r\n#]/.test(path)||path.length>16000)throw Error('无效看剧AI接口');
  if(Date.now()<this.cooldownUntil)throw new ServiceError('看剧AI请求过于频繁，请稍后重试',429);
  if(!this.origins.length)throw Error('看剧AI接口域名配置缺失');
  const now=Date.now(),ordered=[...new Set([this.preferredOrigin,...this.origins].filter(Boolean))],healthy=ordered.filter(origin=>(this.badOrigins.get(origin)||0)<=now),candidates=(healthy.length?healthy:ordered).slice(0,3);
  let last;
  for(const origin of candidates){
   abortIf(signal);const started=Date.now();
   try{
    const headers=this.requestHeaders(origin,method,path),response=await this.network({url:origin+path,method,headers,...body===undefined?{}:{body:JSON.stringify(body)}},signal),status=Number(response.status);
    if(status===429){this.cooldownUntil=Date.now()+30000;throw new ServiceError('看剧AI请求过于频繁，请稍后重试',429);}
    if([401,403].includes(status))throw new ServiceError(status===401?'看剧AI签名校验失败，请更新 App':'看剧AI暂未开放此资源',status);
    if(status>=500){this.badOrigins.set(origin,Date.now()+60000);last=Error('看剧AI线路暂时不可用（HTTP '+status+'）');continue;}
    const data=decode(response);
    if(status<200||status>=300){const error=Error('看剧AI请求失败（HTTP '+status+'）');error.status=status;throw error;}
    if(data?.error||data?.success===false){const statusCode=Number(data?.error?.status||data?.status||0),message=String(data?.error?.message||data?.message||'看剧AI暂时无法提供此内容');if(statusCode===429){this.cooldownUntil=Date.now()+30000;throw new ServiceError('看剧AI请求过于频繁，请稍后重试',429);}throw new ServiceError(message,statusCode||400);}
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('看剧AI响应结构已变化');
    this.preferredOrigin=origin;this.badOrigins.delete(origin);this.recordHealth(origin,'cache',Date.now()-started,true);return data;
   }catch(error){
    abortIf(signal);if(error instanceof ServiceError)throw error;last=error;this.badOrigins.set(origin,Date.now()+60000);this.recordHealth(origin,'cache',Date.now()-started,false);
   }
  }
  throw last||Error('看剧AI暂时没有可用接口线路');
 }
 makeFilters(channelId,catalog){
  const maps=new Map(),items=[];
  for(const row of catalog?.rows||[]){
   const query=row.key==='genre'?'class':String(row.key||'');if(!['class','area','language','year','sort'].includes(query))continue;
   const options=new Map(),data=[{id:'',name:String(row.all_label||'全部')}];
   for(const option of row.options||[]){if(option.enabled===false)continue;const id=String(option.key||option.value||'');if(!id)continue;options.set(id,safeParams(option.params));data.push({id,name:String(option.label||id)});}
   maps.set(query,options);items.push({query,selected:query==='sort'?String(catalog.default_sort||'heat_desc'):'',data});
  }
  if(!maps.has('sort')){maps.set('sort',new Map([['updated_desc',{sort:'updated_desc'}],['heat_desc',{sort:'heat_desc'}]]));items.push({query:'sort',selected:String(catalog?.default_sort||'heat_desc'),data:[{id:'heat_desc',name:'最热'},{id:'updated_desc',name:'最新'}]});}
  this.filterOptions.set(Number(channelId),maps);return {channelId:Number(channelId),items};
 }
 async bootstrap(signal){
  abortIf(signal);if(this.config)return this.config;
  if(!this.bootstrapPending)this.bootstrapPending=(async()=>{
   const runtime=await this.api('/v1/runtime/bootstrap',{signal}),catalogs=Array.isArray(runtime.catalog_ui?.catalogs)?runtime.catalog_ui.catalogs:[],channels=Array.isArray(runtime.catalog_ui?.channels)?runtime.catalog_ui.channels:[];
   if(!catalogs.length)throw Error('看剧AI片库分类为空');
   const available=KINDS.filter(([kind])=>catalogs.some(catalog=>catalog.kind===kind)),vodTabs=[],channelListQuery=[];
   const updates=channels.find(channel=>channel.key==='updates'),latestName=String(updates?.label||'最近更新');
   vodTabs.push({type:'category',channelId:9,text:latestName});
   const defaultCatalog=catalogs.find(catalog=>catalog.kind==='series')||catalogs[0];channelListQuery.push(this.makeFilters(9,defaultCatalog));
   for(const [kind,channelId,fallbackName]of available){
    const catalog=catalogs.find(item=>item.kind===kind),channel=channels.find(item=>item.key===kind);
    vodTabs.push({type:'category',channelId,text:String(channel?.label||fallbackName),...(kind==='adult'?{isAdult:true}:{})});
    channelListQuery.push(this.makeFilters(channelId,catalog));
   }
   const adultChannelIds=vodTabs.filter(tab=>tab.isAdult).map(tab=>tab.channelId);
   this.runtime=runtime;this.config={vodTabs,channelListQuery,adultChannelIds,groups:[],supportsAccount:false,urls:{cache:this.origins,logic:this.origins}};return this.config;
  })().finally(()=>{this.bootstrapPending=null;});
  const result=await this.bootstrapPending;abortIf(signal);return result;
 }
 movies(cards){
  if(!Array.isArray(cards))throw Error('看剧AI片单结构已变化');const out=[];
  for(const item of cards){
   const raw=item?.selected_variant_id||item?.variant_id||item?.default_variant_id||item?.id;
   if(!safeID(raw)||!item?.title)continue;
   const kind=KINDS.find(row=>row[0]===item.content_kind),id=this.id(raw),availability=item.availability||{};
   out.push({title:String(item.title),url:'vod/detail?vodId='+id,imageURL:safeHTTPS(item.poster_url),channelId:kind?.[1]||0,isAdult:item.content_kind==='adult'||kind?.[0]==='adult',bottomLabel:String(item.remarks||item.episode_progress_text||availability.label||''),topLeftLabel:availability.disabled?'暂未上线':'',labels:names(item.genres).map(name=>({name}))});
  }
  this.persistIDs();return out;
 }
 async home(signal){
  await this.bootstrap(signal);const data=await this.api('/v1/feed/home?scope=public',{signal});if(!Array.isArray(data.sections))throw Error('看剧AI首页结构已变化');
  const blocks=data.sections.map(section=>{
   let url='';const browse=section.browse;
   if(browse?.path==='/v1/browse/catalog'&&(!browse.method||browse.method==='GET')){
    const params=safeParams(browse.params),identity=JSON.stringify({id:section.id||'',title:section.title||'',params}),id=String(parseInt(C().SHA256(identity).toString().slice(0,12),16));
    this.collections.set(id,params);url='specialTopic/vods?specialTopicId='+id;
   }
   return {header:{title:String(section.title||'精选'),...(url?{url}:{})},data:this.movies(section.cards||[])};
  });
  return {blocks};
 }
 pageParams(next){
  const params=new URLSearchParams(next||'page=1'),page=Number(params.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>500)throw Error('看剧AI页码无效');
  return {page,...params.get('cursor')?{cursor:params.get('cursor')}:{},...params.get('offset')?{offset:params.get('offset')}:{}}};
 async browse(params,next='page=1',signal){
  const paging=this.pageParams(next),query=new URLSearchParams();
  for(const [key,value]of Object.entries({...safeParams(params),...paging,limit:24}))if(value!==''&&value!=null)query.set(key,String(value));
  const data=await this.api('/v1/browse/catalog?'+query.toString(),{signal});if(!Array.isArray(data.cards))throw Error('看剧AI片单结构已变化');
  const p=data.pagination||{};let continuation='';
  if(p.has_more){const page=Number(p.next_page||paging.page+1),cursor=p.next_cursor;if(!Number.isSafeInteger(page)||page<=paging.page||page>500)throw Error('看剧AI分页未推进');continuation=new URLSearchParams({page:String(page),...cursor?{cursor:String(cursor)}:{}}).toString();}
  if(!data.cards.length&&data.source_statuses?.some(item=>item.status==='failed'))throw Error('看剧AI片库暂时不可用，请重试');
  return {items:this.movies(data.cards),next:continuation};
 }
 async channel(channelId,filters={},next='page=1',signal){
  await this.bootstrap(signal);const id=Number(channelId),kind=id===9?null:KINDS.find(item=>item[1]===id);
  if(id!==9&&!kind)throw Error('看剧AI分类无效');
  const params=id===9?{intent:'latest_catalog'}:{kind:kind[0]},maps=this.filterOptions.get(id);
  for(const [query,value]of Object.entries(filters||{})){
   if(value===''||value==='3')continue;const mapped=maps?.get(query)?.get(String(value));
   if(mapped)Object.assign(params,mapped);
   else if(query==='class')params.genre=String(value);
   else if(['area','language','year','sort'].includes(query))params[query]=String(value);
  }
  const sort=this.config.channelListQuery.find(item=>item.channelId===id)?.items.find(item=>item.query==='sort');
  if(!params.sort&&sort?.selected)params.sort=sort.selected;
  return this.browse(params,next,signal);
 }
 async search(keyword,next='page=1',signal){
  const q=String(keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();if(!q)return {items:[],next:''};if(q.length>200)throw Error('搜索词过长');
  await this.bootstrap(signal);return this.browse({q,intent:'catalog_search'},next,signal);
 }
 async collection(route,next='page=1',signal){
  await this.bootstrap(signal);let params=route?.kind==='topic'?this.collections.get(String(route.id)):null;
  if(!params){await this.home(signal);params=route?.kind==='topic'?this.collections.get(String(route.id)):null;}
  if(!params)throw Error('看剧AI栏目已更新，请刷新首页');return this.browse(params,next,signal);
 }
 async discovery(tab,next='page=1',signal){
  await this.bootstrap(signal);if(Number(tab)===2)return this.home(signal);
  if(Number(tab)===0)return this.browse({intent:'latest_catalog'},next,signal);
  const catalogs=this.runtime.catalog_ui.catalogs||[],sortRows=catalogs.flatMap(catalog=>catalog.rows||[]).filter(row=>row.key==='sort'),hot=sortRows.flatMap(row=>row.options||[]).find(option=>/热|人气|hot|popular/i.test(String(option.label||'')));
  const params=hot?safeParams(hot.params):{sort:String(catalogs[0]?.default_sort||'heat_desc')};return this.browse(params,next,signal);
 }
 episodePage(raw,offset,signal){return this.api('/v1/catalog/'+encodeURIComponent(raw)+'/episodes?limit=200&offset='+Number(offset||0),{signal});}
 async allEpisodes(raw,signal){
  let offset=0,total=null;const out=[],seen=new Set();
  for(let page=0;page<50;page++){
   abortIf(signal);const data=await this.episodePage(raw,offset,signal),pagination=data.episode_pagination||{},rows=data.episodes;
   if(data.variant_id!==raw||!Array.isArray(rows)||typeof pagination.has_more!=='boolean')throw Error('看剧AI分集数据不匹配');
   if(pagination.offset!=null&&Number(pagination.offset)!==offset)throw Error('看剧AI分集位置不匹配');
   if(pagination.total_count!=null){const count=Number(pagination.total_count);if(!Number.isSafeInteger(count)||count<0||count>10000||total!=null&&count!==total)throw Error('看剧AI分集总数发生变化，请重新打开详情');total=count;}
   let added=0;for(const row of rows){if(!safeID(row?.id)||!safeID(row?.token)||seen.has(row.id))continue;seen.add(row.id);out.push({id:row.id,title:String(row.display_name||row.title||('第'+(out.length+1)+'集')),open:false,pageOffset:offset});added++;}
   if(!pagination.has_more){if(total!=null&&out.length!==total)throw Error('看剧AI分集未完整返回，请重新打开详情');return out;}
   if(!added||!rows.length)throw Error('看剧AI分集分页未推进');offset+=rows.length;
  }
  throw Error('看剧AI分集超出安全上限');
 }
 async resolve(raw,episode,signal){
  const page=await this.episodePage(raw,episode.pageOffset||0,signal),row=page.episodes?.find(item=>item.id===episode.id);
  if(page.variant_id!==raw||!safeID(row?.token))throw Error('此影片中未找到所选集，请刷新选集');
  const data=await this.api('/v1/playback/resolve/'+encodeURIComponent(row.token)+'?view=compact',{signal});
  if(data.current_episode?.id!==episode.id||!Array.isArray(data.line_options))throw Error('看剧AI返回了其他集的播放线路');return data.line_options;
 }
 async detail(id,signal){
  await this.bootstrap(signal);let raw=this.rawID(id),data=await this.api('/v1/catalog/'+encodeURIComponent(raw)+'/detail',{signal});
  if(!data||!safeID(data.id||data.variant_id||raw))throw Error('看剧AI影片详情不匹配');
  const variants=data.variants||data.seasons||[],selected=data.selected_variant_id||variants.find(item=>item.selected||item.default)?.variant_id||variants.find(item=>item.selected||item.default)?.id;
  if(safeID(selected)&&selected!==raw){raw=selected;data=await this.api('/v1/catalog/'+encodeURIComponent(raw)+'/detail',{signal});}
  const episodes=await this.allEpisodes(raw,signal),kind=KINDS.find(item=>item[0]===data.content_kind),encoded=this.id(raw),firstLines=episodes.length?await this.resolve(raw,episodes[0],signal):[];
  const direct=[...new Map(firstLines.filter(directLine).map(line=>[lineKey(line),line])).values()].sort(lineOrder),tickets=[...new Map(firstLines.filter(ticketLine).map(line=>[lineKey(line),line])).values()].sort(lineOrder),routes=new Map(),playSources=[];
  const sourceFor=(key,name,type)=>{let sourceId=type==='auto'?'auto':'kanju_'+C().SHA256(key).toString().slice(0,24),suffix=1;while(routes.has(sourceId))sourceId='kanju_'+C().SHA256(key).toString().slice(0,20)+'_'+suffix++;routes.set(sourceId,{key,type});playSources.push({siteId:sourceId,name,total:episodes.length,list:episodes,playMode:type});};
  if(direct.length||tickets.length)sourceFor('auto','智能直连', 'auto');
  for(const line of direct)sourceFor(lineKey(line),String(line.label||line.display_label||line.provider_name||'直连线路'),'direct');
  for(const line of tickets)sourceFor(lineKey(line),String(line.label||line.display_label||line.provider_name||'解析线路'),'ticket');
  const seasonRows=(data.variants||data.seasons||[]).filter(item=>safeID(item.variant_id||item.id)&&item.has_playback!==false);
  const seasons=seasonRows.map(item=>({id:this.id(item.variant_id||item.id),title:String(item.season_label||item.title||'其他季'),selected:(item.variant_id||item.id)===raw}));
  const out={id:encoded,title:String(data.title||''),imageURL:safeHTTPS(data.poster_url),year:data.year,area:data.area?[{name:String(data.area)}]:[],language:data.language?[{name:String(data.language)}]:[],channelId:kind?.[1]||0,channelName:kind?.[2]||'影片',isAdult:data.content_kind==='adult'||kind?.[0]==='adult',summary:String(data.description||data.overview||''),actors:names(data.actors),directors:names(data.directors),labels:names(data.genres),bottomLabel:String(data.remarks||data.episode_progress_text||''),playSources,seasons};
  Object.defineProperty(out,'_kanjuRoutes',{value:routes});this.details.delete(encoded);this.details.set(encoded,out);while(this.details.size>12)this.details.delete(this.details.keys().next().value);this.persistIDs();return out;
 }
 async episodes(id,line,signal){const detail=this.details.get(String(id))||await this.detail(id,signal);return detail.playSources.find(item=>item.siteId===line.siteId)?.list||[];}
 async play({vodId,siteId,episodeId},signal){
  const detail=this.details.get(String(vodId))||await this.detail(vodId,signal),source=detail.playSources.find(item=>item.siteId===siteId),episode=source?.list.find(item=>item.id===episodeId);
  if(!source||!episode)throw Error('看剧AI此线路未找到所选集');
  const raw=this.rawID(vodId),lines=await this.resolve(raw,episode,signal),route=detail._kanjuRoutes.get(String(siteId));
  if(!route)throw Error('看剧AI播放线路已更新，请重新打开详情');
  if(route.type==='auto'){
   const candidates=[...new Map(lines.filter(directLine).map(line=>[lineKey(line),line])).values()].sort(lineOrder).slice(0,3);
   if(candidates.length)return {playUrls:candidates.map(mediaLine)};
   const tickets=lines.filter(ticketLine).sort(lineOrder).slice(0,3),playUrls=[];
   for(const line of tickets){const ticket=line.url.slice('resolve://'.length),resolved=await this.api('/v1/playback/resolve-line?view=compact',{method:'POST',body:{ticket},signal}),media=resolved.line;if(!media||Number(media.minimum_user_level||0)>0||!safeHTTPS(media.url))continue;playUrls.push({...mediaLine(media),name:String(line.label||'解析线路')});}
   if(playUrls.length)return {playUrls};throw Error('看剧AI此集暂未返回可用的 HTTPS 线路');
  }
  const line=lines.find(item=>lineKey(item)===route.key);if(!line)throw Error('看剧AI此集未提供所选线路，请切换同集线路');
  if(route.type==='direct'&&directLine(line))return {playUrls:[mediaLine(line)]};
  if(route.type==='ticket'&&ticketLine(line)){
   const ticket=line.url.slice('resolve://'.length),resolved=await this.api('/v1/playback/resolve-line?view=compact',{method:'POST',body:{ticket},signal}),media=resolved.line;
   if(!media||Number(media.minimum_user_level||0)>0||!safeHTTPS(media.url))throw Error('看剧AI解析线路未返回可用的 HTTPS 媒体地址');
   return {playUrls:[{...mediaLine(media),name:String(line.label||'解析线路')} ]};
  }
  throw Error('看剧AI此线路当前不可用，请切换同集线路');
 }
 async anonymous(){return {guest:true};}
 async login(){throw new ServiceError('看剧AI适配器使用公开目录接口',403);}
 async logout(){}
}
