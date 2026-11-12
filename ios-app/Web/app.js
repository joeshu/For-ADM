(() => {
const __modules = {};
// --- player-controller.mjs ---
__modules.m2 = (() => {
// Pure playback orchestration, line health scoring, and resume/outro rules shared
// between Native UIKit playback events, Web <video>, and headless state-machine tests.
function lineHealthKey(siteId, line) {
  const lineId = line?.siteId ?? line?.name ?? '';
  return `${siteId || 'default'}:${lineId}`;
}
function lineHealthScore(healthMap = {}, siteId = '', line = {}) {
  const entry = healthMap?.[lineHealthKey(siteId, line)];
  if (!entry) return 0;
  const ok = Number(entry.ok) || 0;
  const fail = Number(entry.fail) || 0;
  const avgMs = Number(entry.avgMs) || 1200;
  const rate = ok / Math.max(1, ok + fail + 1);
  const latencyBonus = Math.max(0, 1 - Math.min(avgMs, 5000) / 5000) * 0.25;
  const recentFailPenalty = entry.lastOk === false && Date.now() - (Number(entry.updatedAt) || 0) < 300000 ? 0.5 : 0;
  return rate + latencyBonus - recentFailPenalty;
}
function recordLineOutcome(healthMap = {}, siteId = '', line = {}, { ok = true, latencyMs = 0 } = {}) {
  const key = lineHealthKey(siteId, line);
  const prev = healthMap?.[key] || { ok: 0, fail: 0, avgMs: 0, lastOk: true, updatedAt: 0 };
  const nextOk = prev.ok + (ok ? 1 : 0);
  const nextFail = prev.fail + (ok ? 0 : 1);
  const ms = Number(latencyMs) > 0 ? Number(latencyMs) : prev.avgMs || 800;
  const nextAvg = ok && prev.avgMs > 0 ? Math.round(prev.avgMs * 0.6 + ms * 0.4) : ok ? Math.round(ms) : prev.avgMs;
  return {
    ...healthMap,
    [key]: {
      ok: nextOk,
      fail: nextFail,
      avgMs: nextAvg,
      lastOk: !!ok,
      updatedAt: Date.now(),
    },
  };
}
function orderLinesByHealth(lines = [], lineIndex = 0, preferredSiteId = '', healthMap = {}, siteId = '', excludedLines = []) {
  const preferred = lines.findIndex(x => x.siteId === preferredSiteId);
  const base = [...new Set([lineIndex, preferred, ...lines.map((_, i) => i)].filter(i => i >= 0))];
  const filtered = base.filter(i => (i === lineIndex || lines[i]?.preview !== true) && !excludedLines.includes(i));
  const head = filtered.slice(0, lineIndex >= 0 ? 1 : 0);
  const rest = filtered.slice(head.length).sort((a, b) => {
    if (a === preferred && b !== preferred) return -1;
    if (b === preferred && a !== preferred) return 1;
    return lineHealthScore(healthMap, siteId, lines[b]) - lineHealthScore(healthMap, siteId, lines[a]);
  });
  return [...head, ...rest].slice(0, 5);
}
function computeResumeStartAt({ preview = false, time = 0, duration = 0 } = {}) {
  if (preview) return 0;
  const t = Number(time) || 0;
  const d = Number(duration) || 0;
  if (t <= 0) return 0;
  if (d > 0 && t >= d - 5) return 0;
  return t;
}
function shouldAutoSkipOutro({ preview = false, outroSkipped = false, autoNext = true, skipOutroSeconds = 0, duration = 0, currentTime = 0 } = {}) {
  if (preview || outroSkipped || !autoNext) return false;
  const threshold = Number(skipOutroSeconds) || 0;
  const dur = Number(duration) || 0;
  const cur = Number(currentTime) || 0;
  if (threshold <= 0 || !Number.isFinite(dur) || dur <= 600 || cur <= 300) return false;
  return dur - cur <= threshold;
}

return { lineHealthKey, lineHealthScore, recordLineOutcome, orderLinesByHealth, computeResumeStartAt, shouldAutoSkipOutro };
})();

// --- model.mjs ---
__modules.m3 = (() => {
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function safeHTTPS(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}}
// Image CDNs sometimes return protocol-relative, HTTP, or path-relative covers
// even when their HTTPS site is available. Keep playback URLs strict; only
// image metadata is upgraded/resolved here, and never allow non-web schemes.
function safeImageURL(value,base){
 const raw=String(value??'').trim();if(!raw||/[\r\n]/.test(raw))return '';
 try{const url=new URL(raw.startsWith('//')?'https:'+raw:raw,base);if(url.protocol==='http:')url.protocol='https:';return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
const flaggedAdult=(item,adultChannelIds)=>!!item&&(item.isAdult===true||Number(item.isAdult)===1||(Array.isArray(adultChannelIds)?adultChannelIds.map(String).includes(String(item.channelId)):Number(item.channelId)===5));
function movieFrom(item,{includeAdult=false}={}){
  if(!item||typeof item!=='object'||(!includeAdult&&flaggedAdult(item))||!item.title)return null;
  const route=String(item.url||'').replace(/^\//,'');if(!/^vod\/detail\?/.test(route))return null;
  const id=new URLSearchParams(route.split('?')[1]).get('vodId')||new URLSearchParams(route.split('?')[1]).get('id');if(!/^[A-Za-z0-9_-]{1,80}$/.test(id||''))return null;
  return {id:String(id),title:String(item.title),imagePath:String(item.imagePath||''),imageGroup:String(item.imageGroup||''),...(safeImageURL(item.imageURL)?{imageURL:safeImageURL(item.imageURL)}:{}),subtitle:String(item.bottomLabel||item.scoreText||''),badge:String(item.topLeftLabel||item.topRightLabel||''),channelId:item.channelId,isAdult:!!flaggedAdult(item),labels:Array.isArray(item.labels)?item.labels.map(x=>x.name||x).filter(Boolean):[]};
}
function collectMovies(value,options={}){const out=[],seen=new Set();function visit(node,depth){if(depth>9||!node||typeof node!=='object')return;if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}if(String(node._vod||'').startsWith('ad_')||node.type==='ad'||node.isAd)return;const movie=movieFrom(node,options);if(movie){if(!seen.has(movie.id)){seen.add(movie.id);out.push(movie);}return;}for(const key of ['data','items','list','vods'])if(node[key])visit(node[key],depth+1);}visit(value,0);return out;}
function sectionRoute(value){
 if(typeof value!=='string'||/^(?:[a-z]+:|\/\/)/i.test(value))return null;
 const [path,query='']=value.replace(/^\//,'').split('?'),params=new URLSearchParams(query);
 const routes={'specialTopic/vods':['topic','specialTopicId'],'specialTopic/categoryTopics':['topics','topicCategoryId'],'vod/timeline':['timeline','timelineId'],'catalog/channel':['channel','channelId']},spec=routes[path];
 if(!spec||!/^\d+$/.test(params.get(spec[1])||''))return null;
 const clean=new URLSearchParams({[spec[1]]:params.get(spec[1])}),filters={};
 if(spec[0]==='channel')for(const key of ['class','area','year','sort']){const value=params.get(key);if(value&&value.length<=120&&!/[\x00-\x1f]/.test(value)){clean.set(key,value);filters[key]=value;}}
 return {kind:spec[0],id:params.get(spec[1]),title:params.get('title')||'',url:path+'?'+clean.toString(),...(Object.keys(filters).length?{filters}:{})};
}
function topicFrom(item,{includeAdult=false}={}){
 if(!item||!item.title||(!includeAdult&&flaggedAdult(item)))return null;
 const route=sectionRoute(item.url);if(!route)return null;
 return {id:route.kind+':'+route.id,title:String(item.title),route,imagePath:String(item.imagePath||item.coverPathVertical||item.coverPathHorizontal||''),imageGroup:String(item.imageGroup||item.coverGroupVertical||item.coverGroupHorizontal||''),...(safeImageURL(item.imageURL)?{imageURL:safeImageURL(item.imageURL)}:{}),labels:[],subtitle:item.count?item.count+' 部影片':'专题合集',badge:'专题'};
}
function sectionItems(value,options={}){
 const out=[],seen=new Set();
 function visit(node,depth){
  if(depth>9||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}
  if(String(node._vod||'').startsWith('ad_')||node.isAd||node.type==='ad')return;
  const item=movieFrom(node,options)||topicFrom(node,options);
  if(item){if(!seen.has(item.id)){seen.add(item.id);out.push(item);}return;}
  for(const key of ['items','data','list','vods'])if(node[key])visit(node[key],depth+1);
 }
 visit(value,0);return out;
}
function homeSections(data){return (Array.isArray(data?.blocks)?data.blocks:[]).filter(block=>block&&block.isAd!==true&&block.type!=='ad'&&block.layout!=='advert_self'&&!String(block._vod||'').startsWith('ad_')).map(block=>({title:String(block.header?.title||'为你推荐'),route:sectionRoute(block.header?.url),items:sectionItems(block.data)})).filter(section=>section.items.length);}
function collectionGroups(data,options={}){
 return (data?.items||[]).filter(item=>!String(item?._vod||'').startsWith('ad_')).map(item=>({title:String(item.header?.title||''),route:sectionRoute(item.header?.url),items:sectionItems(item.data,options)})).filter(group=>group.items.length);
}
function categories(config,{includeAdult=false}={}){const adult=tab=>flaggedAdult(tab,config?.adultChannelIds);return (config?.vodTabs||[]).filter(tab=>tab.type==='category'&&(includeAdult||!adult(tab))).map(tab=>({id:Number(tab.channelId),name:String(adult(tab)?'18+ · ':'')+(tab.text||tab.name),...(adult(tab)?{isAdult:true}:{})}));}
function imageURLs(movie,config){if(safeImageURL(movie?.imageURL))return [safeImageURL(movie.imageURL)];const group=config?.groups?.find(x=>String(x.id)===String(movie?.imageGroup));if(!movie?.imagePath||!group)return [];return [...new Set((group.url||[]).map(x=>safeImageURL(String(x.domain||'').replace(/\/$/,'')+'/'+String(movie.imagePath).replace(/^\//,''))).filter(Boolean))];}
// YQK and QNTV publish cover paths on a shared CDN hostname. The same bucket
// is also available under a QNTV hostname; keep the API URL first and add this
// independently verified hostname as a fallback.
function imageURLsForSource(movie,source,config){
 const urls=Array.isArray(movie?.imageURLs)&&movie.imageURLs.length?movie.imageURLs.filter(value=>safeImageURL(value)):imageURLs(movie,config);
 if(!['yqk','qntv'].includes(source))return urls;
 const mirror='qntv.j3kjn242sq.com',out=[];
 for(const value of urls){
  const url=safeImageURL(value);if(!url)continue;out.push(url);
  try{const alternate=new URL(url);if(alternate.hostname.toLowerCase()==='yqk.j3kjn242sq.com'){alternate.hostname=mirror;out.push(alternate.href);}}catch{}
 }
 return [...new Set(out)];
}
function playbackURLs(episode){return (episode?.playUrls||[]).map(entry=>({...entry,url:safeHTTPS(entry.url)})).filter(x=>x.url);}
function sourceKey(siteId,movieId){return siteId+':'+movieId;}

return { safeHTTPS, safeImageURL, movieFrom, collectMovies, sectionRoute, topicFrom, sectionItems, homeSections, collectionGroups, categories, imageURLs, imageURLsForSource, playbackURLs, sourceKey, escapeHTML };
})();

// --- site-api.mjs ---
__modules.m4 = (() => {
class ServiceError extends Error {constructor(message,code){super(message);this.code=code;}}
const canonicalQuery = params => Object.keys(params).sort().map(key=>key+'='+params[key]).join('&');
const C=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const read=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}};
function decodeResponse(response,site){
  const crypto=C(),raw=crypto.enc.Base64.parse(response.bodyBase64),text=crypto.enc.Utf8;
  try{return JSON.parse(text.stringify(raw));}catch{}
  const entry=site.responseKeys.find(x=>x.index===1);if(!entry)throw new ServiceError('缺少数据解码配置');
  try {return JSON.parse(crypto.AES.decrypt({ciphertext:raw},crypto.enc.Utf8.parse(entry.key),{iv:crypto.enc.Utf8.parse(entry.iv),mode:crypto.mode.CBC,padding:crypto.pad.Pkcs7}).toString(text));}
  catch{throw new ServiceError('数据格式已变化，请更新站点适配配置');}
}
function unwrap(data){
  if(data&&typeof data==='object'&&'code'in data){if(data.code&&data.code!==200&&data.code!=='200')throw new ServiceError(data.message||'服务拒绝了请求',data.code);return data.data;}
  return data;
}
class SiteClient {
  constructor(site,transport,storage=globalThis.localStorage){
    this.site=site;this.transport=transport;this.storage=storage;this.key='sanyuan:'+site.id+':';
    this.device=read(storage,this.key+'device',null)||{id:globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.random()*16|0;return(c==='x'?n:(n&3|8)).toString(16);}),created:Date.now()};
    storage.setItem(this.key+'device',JSON.stringify(this.device));this.user=null;this.sessionLoaded=false;this.sessionKind="none";this.guestPending=null;this.vault=globalThis.NativeTransport?.vault;this.config=null;this.health=[];this.preferred={};
  }
  buildRequest(base,path,params={},method='get'){
    const site=this.site,user=this.user,timestamp=Date.now(),get=method.toLowerCase()==='get';
    const data=get?{os:'webapp',appId:site.appId,userLevel:String(user?.level||0),...params}:params;
    const userId=user?.id,session='appId='+site.appId+'&deviceCreatedAt='+this.device.created+'&deviceId='+this.device.id+'&st=2'+(userId?'&userId='+userId:'');
    const sign=C().HmacSHA1(method+'|'+path+'|'+(get?canonicalQuery(data):'')+'|'+timestamp+'|'+session+'|',site.signKey).toString(C().enc.Hex);
    const headers={os:'webapp',appId:site.appId,appVersion:site.version,package:site.appId,channelId:'c1',deviceId:this.device.id,deviceCreatedAt:String(this.device.created),st:'2',ts:String(timestamp),sign,Referer:site.origin+'/'};
    if(userId&&user.token){headers.userId=String(userId);headers['x-token']=user.token;}
    const url=new URL(path,base);if(get)for(const [key,value]of Object.entries(data))url.searchParams.set(key,String(value));
    if(!get)headers['Content-Type']='application/json';
    if(path==='/user/anonymous'||path==='/user/loginAccount')headers.apiVer='v2';
    return {url:url.href,method:method.toUpperCase(),headers,...(!get?{body:JSON.stringify(data)}:{})};
  }
  async requestAt(base,path,params={},method='get',signal){
    const response=await this.transport({...this.buildRequest(base,path,params,method),signal});
    let data;try{data=decodeResponse(response,this.site);}catch(error){if(response.status<200||response.status>=300)throw new ServiceError('线路返回 HTTP '+response.status,response.status);throw error;}
    if(response.status<200||response.status>=300)throw new ServiceError(data.message||'请求失败：HTTP '+response.status,data.code||response.status);
    return unwrap(data);
  }
  async bootstrap(signal){
    await this.restoreSession();
    const config=await this.requestAt(this.site.origin,'/config/prod/appInit.html',{},'GET',signal);
    if(!Array.isArray(config?.urls?.cache)||!Array.isArray(config?.urls?.logic))throw new ServiceError('站点初始化数据格式已变化');
    this.config=config;return config;
  }
  async restoreSession(){
    if(!this.sessionLoad)this.sessionLoad=(async()=>{try{if(this.vault){const saved=await this.vault.get(this.site.id);this.user=saved?.schema===1?saved.user:saved;this.sessionKind=saved?.schema===1?saved.kind:this.user&&['bindLogin','bindPhone','bindEmail','bindAccount'].every(k=>this.user[k]===false||this.user[k]===0)?'guest':this.user?'account':'none';}}catch{this.sessionWarning='会话仅在本次使用期间有效';}this.sessionLoaded=true;})();
    await this.sessionLoad;
  }
  async saveSession(kind){
    this.sessionKind=kind;
    if(this.vault)try{await this.vault.put(this.site.id,{schema:1,kind,user:this.user});}catch{this.sessionWarning='会话未能保存，本次仍可正常使用';}
  }
  async ensureSession(signal){
    if(!this.config)await this.bootstrap(signal);else await this.restoreSession();
    if(!this.user?.id||!this.user?.token){
      if(!this.guestPending)this.guestPending=this.anonymous().finally(()=>{this.guestPending=null;});
      await this.guestPending;
    }
    if(signal?.aborted)throw new DOMException('请求取消','AbortError');
    return this.user;
  }
  async sessionRequest(path,params,signal){
    await this.ensureSession(signal);const user=this.user;
    try{return await this.request(path,params,'logic',signal);}
    catch(error){
      // Only renew a known guest session once; never replace an account or retry VIP denials.
      if(Number(error.code)!==40401||this.sessionKind!=='guest'||this.user!==user)throw error;
      this.user=null;await this.ensureSession(signal);
      return this.request(path,params,'logic',signal);
    }
  }
  async request(path,params={},kind='cache',signal,method='get'){
    if(!this.config)await this.bootstrap(signal);
    const bases=[...new Set([this.preferred[kind],...(this.config.urls[kind]||[])].filter(Boolean))].filter(x=>{try{return new URL(x).protocol==='https:';}catch{return false;}});
    let last;
    for(const base of bases.slice(0,5)){
      if(signal?.aborted)throw new DOMException('请求取消','AbortError');
      const start=Date.now();
      try{const result=await this.requestAt(base,path,params,method,signal);this.preferred[kind]=base;this.recordHealth(base,kind,Date.now()-start,true);return result;}
      catch(error){if(error.name==='AbortError')throw error;this.recordHealth(base,kind,Date.now()-start,false);last=error;
        // Authentication, payment and other business denials are not line failures.
        if(error instanceof ServiceError&&error.code&&!(typeof error.code==='number'&&error.code>=500&&error.code<=599))throw error;
      }
    }
    throw last||new ServiceError('没有可用数据线路');
  }
  recordHealth(url,kind,ms,ok){this.health=this.health.filter(x=>!(x.url===url&&x.kind===kind));this.health.push({url,kind,ms,ok});}
  home(signal){return this.request('/v5/vod/home.capi',{},'cache',signal);}
  channel(channelId,filters={},next='page=1',signal){return this.request('/vod/channel/list.capi',{channelId,category:'',sort:'3',area:'',year:'',language:'',...filters,next},'cache',signal);}
  collection(route,next='page=1',signal){
    const endpoints={topic:['/v2/vod/specialTopic/vods.capi','specialTopicId'],topics:['/vod/specialTopic/categoryTopics.capi','topicCategoryId'],timeline:['/vod/timeline.capi','timelineId']},entry=endpoints[route?.kind];
    if(!entry||!/^\d+$/.test(String(route.id)))throw new ServiceError('无效栏目');
    return this.request(entry[0],{[entry[1]]:route.id,next},'cache',signal);
  }
  search(k,next='page=1',signal){return this.sessionRequest('/vod/search/query',{k,type:'title',channelId:0,next},signal);}
  detail(id,signal){return this.request('/v2/vod/detail.capi',{vodId:id},'cache',signal);}
  episodes(id,source,signal){return this.request('/v2/vod/episodes.capi',{vodId:id,siteId:source.siteId,episodeVodId:source.episodeVodId||0},'cache',signal);}
  play(params,signal){return this.sessionRequest('/vod/episodePlayUrl',params,signal);}
  async login(account,password,signal){const user=await this.request('/user/loginAccount',{account,password},'logic',signal,'post');this.user=user;await this.saveSession('account');return user;}
  async logout(){this.user=null;this.sessionKind='none';if(this.vault)await this.vault.remove(this.site.id);}
  async anonymous(signal){this.user=await this.request('/user/anonymous',{},'logic',signal,'post');await this.saveSession('guest');return this.user;}
  discoveryProfile(){return {timeline:true,timelineTab:'0',sectionTab:null,tabs:[{id:'0',name:'上映表',mode:'timeline'},{id:'1',name:'Netflix',mode:'netflix'},{id:'2',name:'专题',mode:'topics'},{id:'3',name:'排行榜',mode:'ranking'}]};}
}

return { decodeResponse, unwrap, ServiceError, SiteClient, canonicalQuery };
})();

// --- playback.mjs ---
__modules.m1 = (() => {
const { orderLinesByHealth } = __modules.m2;
const { playbackURLs, safeHTTPS } = __modules.m3;
const { ServiceError } = __modules.m4;
class MediaError extends Error {constructor(message,status=0){super(message);this.status=status;}}
const urlsFrom=data=>playbackURLs({playUrls:Array.isArray(data)?data:data?.playUrls||data?.urls||[]}).concat(data?.url?playbackURLs({playUrls:[data]}):[]);
function mediaHeaders(client,entry={}){
 const headers={...(entry.referrerPolicy==='no-referrer'?{}:{Referer:client.site.origin+'/'}),...entry.headers};
 return Object.fromEntries(Object.entries(headers).filter(([,v])=>typeof v==='string'&&v.length));
}
function prioritizeMediaCandidates(urls=[]){
 if(!Array.isArray(urls)||urls.length<=1)return Array.isArray(urls)?urls:[];
 const isM3U8=entry=>{try{const u=new URL(entry?.url||'');return /\.m3u8(?:$|\?)/i.test(u.pathname+u.search);}catch{return false;}};
 const hls=[],other=[];
 for(const item of urls)(isM3U8(item)?hls:other).push(item);
 return [...hls,...other];
}
async function resolvePlayback(client,vodId,line,episode,signal,{refresh=false}={}){
 const raw=episode.open&&!refresh?playbackURLs(episode):urlsFrom(await client.play({vodId,siteId:line.siteId,episodeId:episode.id},signal));
 const urls=prioritizeMediaCandidates(raw);
 if(!urls.length)throw new MediaError('这条线路暂未返回播放地址');
 return urls;
}
// A1 先播后验的快路径：只取地址，不做清单验证。按与
// resolvePlayableEpisode 相同的线路顺序取第一条有地址的线路；
// 调用方先用这条地址起播，验证在后台并行跑。
async function resolveFirstCandidate(client,detail,lineIndex,episodeIndex,signal,{excludedLines=[],lineHealth={}}={}){
 const lines=detail.playSources||[],original=lines[lineIndex],requested=original?.list?.[episodeIndex];
 if(!original||!requested)throw new MediaError('未找到选集');
 const order=orderLinesByHealth(lines,lineIndex,client.preferredPlaybackSiteId,lineHealth,client.site?.id||'',excludedLines);
 let last;
 for(const index of order){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');
  const line=lines[index];
  try{
   if(!Array.isArray(line.list)||!line.list.length||line.list.length<Number(line.total||0)){const list=await client.episodes(detail.id,line,signal);if(Array.isArray(list)&&list.length)line.list=list;}
   const at=index===lineIndex?episodeIndex:matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&original.list.length===1,singleEpisodeSource:original.list.length===1});
   if(at<0)continue;
   const urls=await resolvePlayback(client,detail.id,line,line.list[at],signal);
   if(!urls.length)continue;
   return {lineIndex:index,episodeIndex:at,episode:line.list[at],urls,switched:index!==lineIndex};
  }catch(error){if(error.name==='AbortError'||error instanceof ServiceError)throw error;last=error;}
 }
 throw new MediaError('暂未找到可用的同集线路。'+(last?.message||'请稍后重试或手动切换线路。'));
}
function matchingEpisode(requested,list,{singleMovie=false,singleEpisodeSource=false}={}){
 const key=e=>{const title=String(e.title||'').trim().toLowerCase().replace(/\s+/g,'');const n=title.match(/^(?:第|ep(?:isode)?[._-]?)?0*(\d+)(?:集|话|期)?$/);return n?'number:'+Number(n[1]):title;};
 const target=key(requested);const index=list.findIndex(e=>target?key(e)===target||(!key(e)&&e.id===requested.id):e.id===requested.id);
 if(index>=0)return index;
 if(list.length!==1)return -1;
 const extra=e=>/预告|花絮|特辑|trailer|teaser|behind.the.scenes/i.test(e?.title||'');
 if(extra(requested)||extra(list[0]))return -1;
 const filmQuality=e=>/^(?:(?:tc|hd|bd|sd|4k|1080p|720p|2160p|蓝光|正片|高清|超清|标清|国语|粤语|中字|国粤双语|中英双字)[\s._-]*)+$/i.test(String(e?.title||'').trim());
 return singleMovie||(singleEpisodeSource&&filmQuality(requested)&&filmQuality(list[0]))?0:-1;
}
async function mediaRequest(client,url,signal,method='GET',headers={}){
 const ctrl=new AbortController(),abort=()=>ctrl.abort();if(signal?.aborted)throw new DOMException('请求取消','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,8000);
 try{return await client.transport({url,method,headers,signal:ctrl.signal});}
 catch(error){if(signal?.aborted)throw new DOMException('请求取消','AbortError');const problem=new MediaError(error.name==='AbortError'?'视频线路检查超时':error.message);problem.certificate=/CERT|TLS/.test(String(error.cause?.code||error.code||''))||[-1200,-1201,-1202,-1203,-1204,-1205,-1206].includes(error.code);throw problem;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function playlist(response){if(response.status<200||response.status>=300)throw new MediaError('视频线路返回 HTTP '+response.status,response.status);let text;try{const binary=atob(response.bodyBase64||''),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}text=text.replace(/^\uFEFF/,'').trim();}catch{throw new MediaError('视频清单格式错误');}if(!text.startsWith('#EXTM3U'))throw new MediaError('视频线路未返回有效播放清单');return text;}
function parseMasterVariants(text,baseURL){
 const lines=String(text||'').split(/\r?\n/),variants=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line.startsWith('#EXT-X-STREAM-INF:'))continue;
  const bwMatch=line.match(/BANDWIDTH=(\d+)/i),resMatch=line.match(/RESOLUTION=(\d+)x(\d+)/i);
  const bandwidth=bwMatch?Number(bwMatch[1]):0,width=resMatch?Number(resMatch[1]):0,height=resMatch?Number(resMatch[2]):0;
  const label=height>=2160?'4K UHD':height>=1080?'1080p FHD':height>=720?'720p HD':height>0?`${height}p`:bandwidth>=2500000?'高码率':bandwidth>0?`${Math.round(bandwidth/1000)}kbps`:'自适应';
  for(let j=i+1;j<lines.length;j++){
   const candidate=lines[j].trim();if(!candidate)continue;if(candidate.startsWith('#'))break;
   const href=safeHTTPS(new URL(candidate,baseURL).href);
   if(href)variants.push({href,bandwidth,width,height,label,order:variants.length});
   break;
  }
 }
 variants.sort((a,b)=>(b.height-a.height)||(b.bandwidth-a.bandwidth)||(a.order-b.order));
 return variants;
}
function selectBestMasterVariant(text,baseURL){
 const variants=parseMasterVariants(text,baseURL);
 if(variants.length)return variants[0].href;
 const lines=String(text||'').split(/\r?\n/);
 const next=lines.find(x=>x.trim()&&!x.trim().startsWith('#'));
 return next?safeHTTPS(new URL(next.trim(),baseURL).href):'';
}
async function verifyMedia(client,url,signal,headers={},referrerPolicy){
 headers=mediaHeaders(client,{headers,referrerPolicy});
 const parsed=new URL(url),hls=/\.m3u8(?:$|\?)/i.test(parsed.pathname+parsed.search),response=await mediaRequest(client,url,signal,hls?'GET':'HEAD',headers);
 if(!hls){
  if((response.status<200||response.status>=300)&&![405,501].includes(response.status))throw new MediaError('视频线路返回 HTTP '+response.status,response.status);
  const type=Object.entries(response.headers||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||'';
  if(/text\/html|application\/(?:json|xml)/i.test(type))throw new MediaError('该线路返回网页，未返回媒体文件');
  return {hls:false,qualityLabel:'',bandwidth:0};
 }
 const text=playlist(response),masterURL=safeHTTPS(response.url||url)||url,warmPlaylists=[];
 const remember=(entryURL,body,baseURL=entryURL)=>{if(!entryURL||!body||warmPlaylists.some(item=>item.url===entryURL))return;warmPlaylists.push(baseURL&&baseURL!==entryURL?{url:entryURL,text:body,baseURL}:{url:entryURL,text:body});};
 remember(url,text,masterURL);remember(masterURL,text,masterURL);
 if(text.includes('#EXT-X-STREAM-INF:')){
  const variants=parseMasterVariants(text,masterURL),child=variants[0]?.href||selectBestMasterVariant(text,masterURL);
  if(!child)throw new MediaError('视频清单缺少有效子线路');
  const childResponse=await mediaRequest(client,child,signal,'GET',headers),childText=playlist(childResponse),childFinal=safeHTTPS(childResponse.url||child)||child;
  remember(child,childText,childFinal);remember(childFinal,childText,childFinal);
  return {hls:true,qualityLabel:variants[0]?.label||'',bandwidth:variants[0]?.bandwidth||0,variants,warmPlaylists};
 }
 return {hls:true,qualityLabel:'',bandwidth:0,variants:[],warmPlaylists};
}
async function resolvePlayableEpisode(client,detail,lineIndex,episodeIndex,signal,onAttempt=()=>{},{excludedSites=[],excludedLines=[],initialUrls=null,initialLineIndex=-1,lineHealth={}}={}){
 const lines=detail.playSources||[],original=lines[lineIndex],requested=original?.list?.[episodeIndex];if(!requested)throw new MediaError('未找到选集');
 const order=orderLinesByHealth(lines,lineIndex,client.preferredPlaybackSiteId,lineHealth,client.site?.id||'',excludedLines).filter(i=>!excludedSites.includes(lines[i]?.siteId)),badHosts=new Set();let last;
 for(const index of order){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');const line=lines[index];onAttempt(line.name||'播放线路');
  try{
   if(!Array.isArray(line.list)||!line.list.length||line.list.length<Number(line.total||0)){const list=await client.episodes(detail.id,line,signal);if(Array.isArray(list)&&list.length)line.list=list;}
   const at=index===lineIndex?episodeIndex:matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&original.list.length===1,singleEpisodeSource:original.list.length===1});if(at<0)continue;const episode=line.list[at];
   const reuseInitial=index===initialLineIndex&&Array.isArray(initialUrls)&&initialUrls.length;
   let urls=reuseInitial?initialUrls.map(item=>({...item})):await resolvePlayback(client,detail.id,line,episode,signal),checked=[],expired=false,latencyMs=0,qualityLabel='',bandwidth=0;
   const inspect=async candidates=>{
    // 候选地址并行验证：三条一起验，取第一条通过的；其余通过的也
    // 留在 checked 里备用。每条通过的地址都打上 verifiedMeta，供
    // 后台验证合并与恢复流程直接复用，不必重复验。
    const targets=candidates.slice(0,3).filter(entry=>{try{return !badHosts.has(new URL(entry.url).host);}catch{return false;}});
    const t0=Date.now();
    const outcomes=await Promise.all(targets.map(entry=>verifyMedia(client,entry.url,signal,entry.headers,entry.referrerPolicy).then(meta=>({entry,meta,error:null}),error=>({entry,meta:null,error}))));
    for(const {entry,meta,error} of outcomes){
     if(error){if(error.name==='AbortError')throw error;if(error instanceof ServiceError)throw error;last=error;if(error.certificate){try{badHosts.add(new URL(entry.url).host);}catch{}}if([403,404,410].includes(error.status))expired=true;continue;}
     if(!checked.length){latencyMs=Math.max(1,Date.now()-t0);qualityLabel=meta?.qualityLabel||'';bandwidth=meta?.bandwidth||0;}
     entry.cicadaURL=meta?.variants?.[0]?.href||'';
     entry.verifiedMeta={qualityLabel:meta?.qualityLabel||'',bandwidth:meta?.bandwidth||0,warmPlaylists:meta?.warmPlaylists||[],cicadaURL:entry.cicadaURL};
     checked.push(entry);
    }
   };
   await inspect(urls);
   if(!checked.length&&expired&&(episode.open||reuseInitial)){urls=await resolvePlayback(client,detail.id,line,episode,signal,{refresh:true});await inspect(urls);}
   if(checked.length){if(!line.preview)client.preferredPlaybackSiteId=line.siteId;return {lineIndex:index,episodeIndex:at,episode,urls:[...checked,...urls.filter(x=>!checked.some(y=>y.url===x.url))],switched:index!==lineIndex,latencyMs,qualityLabel,bandwidth};}
  }catch(error){if(error.name==='AbortError'||error instanceof ServiceError)throw error;last=error;}
 }
 throw new MediaError('暂未找到可用的同集线路。'+(last?.message||'请稍后重试或手动切换线路。'));
}

return { resolvePlayback, resolveFirstCandidate, verifyMedia, resolvePlayableEpisode, mediaHeaders, prioritizeMediaCandidates, matchingEpisode, parseMasterVariants, selectBestMasterVariant, MediaError };
})();

// --- image-loader.mjs ---
__modules.m5 = (() => {
// Images travel through the same HTTPS bridge so file:// origins do not lose the site's Referer.
const cache=new Map(),queue=[];let active=0,cacheBytes=0;
const cacheLimit=32*1024*1024,maxCacheItems=64;
function imageData(response){
 if(response.status!==200||response.bodyBase64?.length>2800000)throw Error('图片不可用');
 const b=response.bodyBase64||'',prefix=atob(b.slice(0,24));
 const mime=b.startsWith('/9j/')?'image/jpeg':b.startsWith('iVBORw0KGgo')?'image/png':b.startsWith('R0lGOD')?'image/gif':prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP'?'image/webp':'';
 if(!mime)throw Error('图片格式不支持');return 'data:'+mime+';base64,'+b;
}
function pump(){while(active<6&&queue.length){const job=queue.shift();if(!job.img.isConnected)continue;active++;job.run().finally(()=>{active--;pump();});}}
function loadVisibleImages(root,imageMap,request,referer){
 const controller=new AbortController(),jobs=new Set(),inflight=new Map();let stopped=false;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);enqueue(entry.target);}}, {rootMargin:'320px'});
 function enqueue(img){const saved=imageMap.get(img.dataset.image),urls=Array.isArray(saved)?saved:Array.isArray(saved?.urls)?saved.urls:[],imageReferer=Array.isArray(saved)?referer:saved?.referer||referer,job={img,owner:jobs,run:async()=>{for(const url of urls){if(stopped||!img.isConnected)return;try{let entry=cache.get(url),data=entry?.data;if(entry){cache.delete(url);cache.set(url,entry);}else{let flight=inflight.get(url);if(!flight){flight=request({url,method:'GET',headers:imageReferer?{Referer:imageReferer}:{},signal:controller.signal}).then(imageData).finally(()=>inflight.delete(url));inflight.set(url,flight);}data=await flight;const size=data.length*2;if(size<=4*1024*1024&&!cache.has(url)){entry={data,size};cache.set(url,entry);cacheBytes+=size;while(cache.size>maxCacheItems||cacheBytes>cacheLimit){const [oldest,value]=cache.entries().next().value;cache.delete(oldest);cacheBytes-=value.size;}}}if(!stopped&&img.isConnected){img.src=data;img.classList.add('is-loaded');}return;}catch(error){if(error.name==='AbortError')return;}}if(!stopped&&img.isConnected)img.remove();}};jobs.add(job);queue.push(job);pump();}
 function observe(container=root){for(const img of container.querySelectorAll('img[data-image]'))if(!img.hasAttribute('src'))observer.observe(img);}
 observe(root);
 // Observers are disconnected on the next render to avoid retaining removed DOM nodes.
 const stop=()=>{stopped=true;observer.disconnect();controller.abort();for(const job of jobs){const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);}jobs.clear();};
 stop.observe=(container,nextImageMap)=>{if(stopped)return;if(nextImageMap instanceof Map)imageMap=nextImageMap;observe(container);};
 return stop;
}

return { imageData, loadVisibleImages };
})();

// --- live.mjs ---
__modules.m6 = (() => {
const attribute=(text,name)=>{
 const match=text.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,]+))`,'i'));
 return match?.[1]??match?.[2]??match?.[3]??'';
};
const channelIdentity=channel=>(channel.tvgId||channel.name).trim().toLocaleLowerCase();
function decodePlaylist(base64){
 const binary=atob(base64||''),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes.subarray(2)).replace(/^\uFEFF/,'');
 if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes.subarray(2)).replace(/^\uFEFF/,'');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}
 catch{try{return new TextDecoder('gb18030',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/,'');}}
}
function normalizePlaylistURL(value){
 let input=String(value||'').trim();if(input&&!/^[a-z][a-z\d+.-]*:\/\//i.test(input))input='http://'+input;
 const url=new URL(input);if(!['https:','http:'].includes(url.protocol)||!url.hostname)throw Error('请输入有效的 HTTP 或 HTTPS M3U 地址。');return url;
}

function createM3UParser(playlistURL){
 const base=new URL(playlistURL),channels=[];let pending='',group='',epgUrl='',started=false;
 const addLine=raw=>{
 const line=raw.trim();if(!line)return;
  if(/^#EXTM3U\b/i.test(line)){started=true;const values=[attribute(line,'x-tvg-url'),attribute(line,'url-tvg')].filter(Boolean).flatMap(value=>value.split(',').map(item=>item.trim()).filter(Boolean));for(const value of values){try{const url=new URL(value,base);if(['https:','http:'].includes(url.protocol)){epgUrl=url.href;break;}}catch{}}return;}
  if(!started)return;
  if(/^#EXTGRP:/i.test(line)){group=line.slice(line.indexOf(':')+1).trim()||'未分类';return;}
  if(/^#EXTINF:/i.test(line)){pending=line;group=attribute(line,'group-title')||group||'未分类';return;}
  if(line.startsWith('#')||!pending)return;
  let stream;try{stream=new URL(line,base);}catch{pending='';return;}
  if(!['https:','http:'].includes(stream.protocol)){pending='';return;}
  const comma=pending.search(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/),title=comma>=0?pending.slice(comma+1).trim():'';
  const tvgId=attribute(pending,'tvg-id')||attribute(pending,'svg-id');
  const tvgName=attribute(pending,'tvg-name')||attribute(pending,'svg-name');
  const name=tvgName||title||tvgId||`频道 ${channels.length+1}`;
  let logo='';const logoText=attribute(pending,'tvg-logo')||attribute(pending,'svg-logo');if(logoText)try{const candidate=new URL(logoText,base);if(candidate.protocol==='https:')logo=candidate.href;}catch{}
  channels.push({index:channels.length,name,tvgName,tvgId,logo,group:attribute(pending,'group-title')||group||'未分类',url:stream.href,secure:stream.protocol==='https:',identity:channelIdentity({tvgId,name})});
  pending='';group='';
 };
 return {addLine,finish(){if(!started)throw Error('这个地址没有返回有效的 M3U 播放列表');if(!channels.length)throw Error('M3U 列表里没有可用频道');return {channels,groups:[...new Set(channels.map(channel=>channel.group))],epgUrl};}};
}
function parseM3U(text,playlistURL){
 if(typeof text!=='string'||!/^(?:\uFEFF)?\s*#EXTM3U(?:\s|$)/i.test(text))throw Error('这个地址没有返回有效的 M3U 播放列表');
 const parser=createM3UParser(playlistURL);for(const raw of text.split(/\r?\n/))parser.addLine(raw);return parser.finish();
}
async function parseM3UIncremental(text,playlistURL,{signal,batchLines=1200}={}){
 if(typeof text!=='string'||!/^(?:\uFEFF)?\s*#EXTM3U(?:\s|$)/i.test(text))throw Error('这个地址没有返回有效的 M3U 播放列表');
 if(signal?.aborted)throw new DOMException('请求取消','AbortError');
 const parser=createM3UParser(playlistURL),limit=Math.max(100,Math.min(5000,Number(batchLines)||1200));let start=0,processed=0;
 while(start<text.length){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');
  let end=text.indexOf('\n',start);if(end<0)end=text.length;const raw=text.slice(start,end);parser.addLine(raw);start=end+1;
  if(++processed>=limit){processed=0;await new Promise(resolve=>setTimeout(resolve,0));}
 }
 return parser.finish();
}

function xmlAttribute(text,name){return attribute(text,name);}
function xmlText(text){return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,value)=>{
 if(value[0]==='#'){const hex=value[1]?.toLowerCase()==='x',number=parseInt(value.slice(hex?2:1),hex?16:10);return Number.isFinite(number)?String.fromCodePoint(number):'';}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[value.toLowerCase()]||'';
 });}
function xmlTime(value){
 const match=value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);if(!match)return 0;
 const [,year,month,day,hour,minute,second,sign,offsetHour,offsetMinute]=match;
 const offset=(Number(offsetHour||0)*60+Number(offsetMinute||0))*(sign==='-'?-1:1);
 return Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute),Number(second))-offset*60000;
}
const EPG_INDEX_CACHE_MAX=6;
const epgIndexCache=new Map();
function getEPGIndex(xml){
 if(epgIndexCache.has(xml)){const cached=epgIndexCache.get(xml);epgIndexCache.delete(xml);epgIndexCache.set(xml,cached);return cached;}
 const norm=s=>String(s||'').trim().toLocaleLowerCase().replace(/[\s_-]+/g,'');
 const names=new Map(),programmes=new Map();
 const chanRe=/<channel\b([^>]*)>([\s\S]*?)<\/channel\s*>/gi;let cm;
 while((cm=chanRe.exec(xml))){const cid=xmlAttribute(cm[1],'id').trim();if(!cid)continue;const keys=[cid, ...[...cm[2].matchAll(/<display-name\b[^>]*>([\s\S]*?)<\/display-name\s*>/gi)].map(dm=>xmlText(dm[1]).trim())];for(const value of keys){if(!value)continue;for(const key of new Set([value.toLocaleLowerCase(),norm(value)])){const ids=names.get(key)||new Set();ids.add(cid.toLocaleLowerCase());names.set(key,ids);}}}
 const programmeRe=/<programme\b([^>]*)>([\s\S]*?)<\/programme\s*>/gi;let match;
 while((match=programmeRe.exec(xml))){const attrs=match[1],chAttr=xmlAttribute(attrs,'channel').trim().toLocaleLowerCase();if(!chAttr)continue;const start=xmlTime(xmlAttribute(attrs,'start')),stop=xmlTime(xmlAttribute(attrs,'stop')),
  tag=name=>{const found=match[2].match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`,'i'));return found?xmlText(found[1]).trim():'';},
  title=tag('title'),subtitle=tag('sub-title'),description=tag('desc'),categories=[...match[2].matchAll(/<category\b[^>]*>([\s\S]*?)<\/category\s*>/gi)].map(row=>xmlText(row[1]).trim()).filter(Boolean);
  if(start&&stop>start&&title){const rows=programmes.get(chAttr)||[];rows.push({start,stop,title,subtitle,description,categories});programmes.set(chAttr,rows);}
 }
 for(const rows of programmes.values())rows.sort((a,b)=>a.start-b.start);
 const index={names,programmes};epgIndexCache.set(xml,index);while(epgIndexCache.size>EPG_INDEX_CACHE_MAX)epgIndexCache.delete(epgIndexCache.keys().next().value);return index;
}
function parseXMLTV(xml,channelId){
 if(typeof xml!=='string'||!channelId)return [];
 const norm=s=>String(s||'').trim().toLocaleLowerCase().replace(/[\s_-]+/g,'');
 const wanted=channelId.trim(),index=getEPGIndex(xml),matchedIds=new Set([wanted.toLocaleLowerCase(),norm(wanted)]);
 for(const key of matchedIds)for(const id of index.names.get(key)||[])matchedIds.add(id);
 const rows=[];for(const id of matchedIds)rows.push(...(index.programmes.get(id)||[]));return rows.sort((a,b)=>a.start-b.start);
}
function indexChannelAlternates(channels){
 const index=new Map();for(const channel of channels){const list=index.get(channel.identity)||[];list.push(channel);index.set(channel.identity,list);}return index;
}
function channelAlternates(channels,channel,index){
 if(!channel)return [];
 return index?.get(channel.identity)||channels.filter(candidate=>candidate.identity===channel.identity);
}
function nextUntriedRouteIndex(routes,triedURLs){
 return routes.findIndex(route=>route&&!triedURLs?.has(route.url));
}

return { parseM3UIncremental, decodePlaylist, normalizePlaylistURL, parseM3U, parseXMLTV, indexChannelAlternates, channelAlternates, nextUntriedRouteIndex };
})();

// --- sites-data.mjs ---
__modules.m7 = (() => {
const __default__ = [
  {
    "id": "kkapp",
    "name": "可可影视",
    "version": "2.5.16",
    "origin": "https://a.kkapp06.com",
    "appId": "kkdy",
    "signKey": "a1id2db7ced05pwnc323gezxyb",
    "initKey": "f0c9bb729c939a350b5e56049fd562fc",
    "initIV": "d96b212338ec775c",
    "responseKeys": [
      {
        "index": 1,
        "key": "ayt5wy5afwmwrpb19k9s3psx3dymyd0n",
        "iv": "b3t069ijy7pirw0j"
      }
    ],
    "sourceSha256": "d24f55a5c703446468cd30cc0523de3540e151d6020c76621a45b03367b30d96",
    "assetKeys": [
      {
        "index": 1,
        "key": "otxtqra0kt78a506rbf2neiyv9z19642",
        "iv": "aghjvy51d8qifqzf"
      },
      {
        "index": 2,
        "key": "5kiwicd7c5d6l6yuuq5ngmdvchp8xnha",
        "iv": "ykha1ekypnpvy224"
      },
      {
        "index": 3,
        "key": "wga8225bhoo2s6455k9rmnvl8t0wvj2s",
        "iv": "9lk30q8wch7qhefg"
      },
      {
        "index": 4,
        "key": "5egzkoxlvv33becwz8mv4rgxtndp8ydh",
        "iv": "xz33oqwo0crm7gx5"
      },
      {
        "index": 5,
        "key": "fb65723e4tpzz7vp8ie6psk61hz1zszn",
        "iv": "aegcz7vjpnpvozme"
      },
      {
        "index": 6,
        "key": "51idij4atjynzvw0tzbacr8hyej01iby",
        "iv": "vxmjgcu286wcfnel"
      },
      {
        "index": 7,
        "key": "qabrbw59b96l92qi0mdg6vxwq1u1g1px",
        "iv": "wzxysfk50d4ccsk1"
      },
      {
        "index": 8,
        "key": "83jisi29us0pn1p2bcafeqvyqb32dvop",
        "iv": "biykrrn0w7ve5fim"
      },
      {
        "index": 9,
        "key": "rly05dia390jqzfid1i3oxlqlbjgb8p1",
        "iv": "uactsgpja4ac7u9i"
      },
      {
        "index": 10,
        "key": "s71h4uw00dc38b0u5uptmdiecyey1j35",
        "iv": "gznsj9fd6crv8t8v"
      }
    ]
  },
  {
    "id": "ncat",
    "name": "网飞猫",
    "version": "2.5.31",
    "origin": "https://a.napp03.com:51111",
    "appId": "ncat",
    "signKey": "a1id2db7ced05pwnc323gezxyb",
    "initKey": "f0c9bb729c939a350b5e56049fd562fc",
    "initIV": "d96b212338ec775c",
    "responseKeys": [
      {
        "index": 1,
        "key": "ayt5wy5afwmwrpb19k9s3psx3dymyd0n",
        "iv": "b3t069ijy7pirw0j"
      }
    ],
    "sourceSha256": "3f7c2a8bbf59a70ac644d11361499f8d8fb3a45ccdc2dc481ae46ee29e552097",
    "assetKeys": [
      {
        "index": 1,
        "key": "otxtqra0kt78a506rbf2neiyv9z19642",
        "iv": "aghjvy51d8qifqzf"
      },
      {
        "index": 2,
        "key": "5kiwicd7c5d6l6yuuq5ngmdvchp8xnha",
        "iv": "ykha1ekypnpvy224"
      },
      {
        "index": 3,
        "key": "wga8225bhoo2s6455k9rmnvl8t0wvj2s",
        "iv": "9lk30q8wch7qhefg"
      },
      {
        "index": 4,
        "key": "5egzkoxlvv33becwz8mv4rgxtndp8ydh",
        "iv": "xz33oqwo0crm7gx5"
      },
      {
        "index": 5,
        "key": "fb65723e4tpzz7vp8ie6psk61hz1zszn",
        "iv": "aegcz7vjpnpvozme"
      },
      {
        "index": 6,
        "key": "51idij4atjynzvw0tzbacr8hyej01iby",
        "iv": "vxmjgcu286wcfnel"
      },
      {
        "index": 7,
        "key": "qabrbw59b96l92qi0mdg6vxwq1u1g1px",
        "iv": "wzxysfk50d4ccsk1"
      },
      {
        "index": 8,
        "key": "83jisi29us0pn1p2bcafeqvyqb32dvop",
        "iv": "biykrrn0w7ve5fim"
      },
      {
        "index": 9,
        "key": "rly05dia390jqzfid1i3oxlqlbjgb8p1",
        "iv": "uactsgpja4ac7u9i"
      },
      {
        "index": 10,
        "key": "s71h4uw00dc38b0u5uptmdiecyey1j35",
        "iv": "gznsj9fd6crv8t8v"
      }
    ]
  },
  {
    "id": "happ",
    "name": "好好看",
    "version": "2.5.24",
    "origin": "https://a.happ3.com:51111",
    "appId": "hkan",
    "signKey": "a1id2db7ced05pwnc323gezxyb",
    "initKey": "f0c9bb729c939a350b5e56049fd562fc",
    "initIV": "d96b212338ec775c",
    "responseKeys": [
      {
        "index": 1,
        "key": "ayt5wy5afwmwrpb19k9s3psx3dymyd0n",
        "iv": "b3t069ijy7pirw0j"
      }
    ],
    "sourceSha256": "0f236977c330eedae7806a823f12285c27fafe63967dd8d751ab2ddfca14a7cc",
    "assetKeys": [
      {
        "index": 1,
        "key": "otxtqra0kt78a506rbf2neiyv9z19642",
        "iv": "aghjvy51d8qifqzf"
      },
      {
        "index": 2,
        "key": "5kiwicd7c5d6l6yuuq5ngmdvchp8xnha",
        "iv": "ykha1ekypnpvy224"
      },
      {
        "index": 3,
        "key": "wga8225bhoo2s6455k9rmnvl8t0wvj2s",
        "iv": "9lk30q8wch7qhefg"
      },
      {
        "index": 4,
        "key": "5egzkoxlvv33becwz8mv4rgxtndp8ydh",
        "iv": "xz33oqwo0crm7gx5"
      },
      {
        "index": 5,
        "key": "fb65723e4tpzz7vp8ie6psk61hz1zszn",
        "iv": "aegcz7vjpnpvozme"
      },
      {
        "index": 6,
        "key": "51idij4atjynzvw0tzbacr8hyej01iby",
        "iv": "vxmjgcu286wcfnel"
      },
      {
        "index": 7,
        "key": "qabrbw59b96l92qi0mdg6vxwq1u1g1px",
        "iv": "wzxysfk50d4ccsk1"
      },
      {
        "index": 8,
        "key": "83jisi29us0pn1p2bcafeqvyqb32dvop",
        "iv": "biykrrn0w7ve5fim"
      },
      {
        "index": 9,
        "key": "rly05dia390jqzfid1i3oxlqlbjgb8p1",
        "iv": "uactsgpja4ac7u9i"
      },
      {
        "index": 10,
        "key": "s71h4uw00dc38b0u5uptmdiecyey1j35",
        "iv": "gznsj9fd6crv8t8v"
      }
    ]
  },
  {
    "id": "yqk",
    "name": "一起看",
    "provider": "yqk",
    "origin": "https://yqk18.app",
    "version": "1.2.7.194",
    "sourceSha256": "8083cb56c452a3fd47030d1e4f12693de40af38c956e26b881b6a373538b99b1",
    "protocol": {
      "appId": "e6ddefe09e0349739874563459f56c54",
      "appKey": "3359de478f8d45638125e446a10ec541",
      "version": "1.2.7.194",
      "apiOrigins": [
        "https://yz260324.bzy42ezt.com",
        "https://yz250907.zazy3mc5.com",
        "https://yz250907.7k5jb8t9.com",
        "https://yz250907.3nyk7h9o.com",
        "https://yz250907.jba2yo1c.com",
        "https://yz250907.hzkeka49.com",
        "https://yzy0916.q8nsderug.com",
        "https://yz1018.o5r52at9v.com",
        "https://yz1018.tgs2hl4ut.com",
        "https://yz1018.goi6lhmry.com",
        "https://yz1018.6vh3qyu9x.com"
      ]
    }
  },
  {
    "id": "qntv",
    "name": "青柠 TV",
    "provider": "yqk",
    "origin": "https://qntv28.app",
    "version": "1.0.0.109",
    "sourceSha256": "c77aa657ba5ecabbc17b38498c1e73b2313d61e4f8b57b98b50be0f55b7fe2be",
    "protocol": {
      "appId": "0576435a23b94990806ca98e54f95adf",
      "appKey": "99595b5da5d245b59aa73714b96ea73d",
      "version": "1.0.0.109",
      "apiOrigins": [
        "https://yz260324.bzy42ezt.com",
        "https://yz250907.zazy3mc5.com",
        "https://yz250907.7k5jb8t9.com",
        "https://yz250907.3nyk7h9o.com",
        "https://yz250907.jba2yo1c.com",
        "https://yz250907.hzkeka49.com",
        "https://yzy0916.q8nsderug.com",
        "https://yz1018.o5r52at9v.com",
        "https://yz1018.tgs2hl4ut.com",
        "https://yz1018.goi6lhmry.com",
        "https://yz1018.6vh3qyu9x.com"
      ]
    }
  },
  {
    "id": "dyls",
    "name": "电影猎手",
    "provider": "dyls",
    "origin": "https://dyls1.mbxqnb.cn",
    "version": "3102",
    "sourceSha256": "4455dc920ed1797bd133d6394ff3449e1d538199840d85e389ef928d09cd2d26",
    "protocol": {
      "publicKey": "-----BEGIN RSA PUBLIC KEY-----MIIBCgKCAQEA02F/kPg5A2NX4qZ5JSns+bjhVMCC6JbTiTKpbgNgiXU+Kkorg6Dj76gS68gB8llhbUKCXjIdygnHPrxVHWfzmzisq9P9awmXBkCk74Skglx2LKHa/mNz9ivg6YzQ5pQFUEWS0DfomGBXVtqvBlOXMCRxp69oWaMsnfjnBV+0J7vHbXzUIkqBLdXSNfM9Ag5qdRDrJC3CqB65EJ3ARWVzZTTcXSdMW9i3qzEZPawPNPe5yPYbMZIoXLcrqvEZnRK1oak67/ihf7iwPJqdc+68ZYEmmdqwunOvRdjq89fQMVelmqcRD9RYe08v+xDxG9Co9z7hcXGTsUquMxkh29uNawIDAQAB-----END RSA PUBLIC KEY-----",
      "signKey": "635a580fcb5dc6e60caa39c31a7bde48",
      "aesKey": "e6d5de5fcc51f53d",
      "aesIV": "2f13eef7dfc6c613",
      "clientVersion": 3102
    }
  },
  {
    "id": "souju",
    "name": "搜剧AI",
    "provider": "souju",
    "origin": "https://ai.baipiaozhe.com",
    "version": "web-2026-11-02",
    "sourceSha256": "44fb10e31a57eeddbd93750f16d8d42d51cb5d249ffd2844a385dd377c4e49fc",
    "protocol": {
      "signingKey": "f39d73aa7a6426203cdee1ef17b31d3b7ea8c23f4c59c62a3a8aa0f39ee5e79d"
    }
  },
  {
    "id": "kanju",
    "name": "看剧AI",
    "provider": "kanju",
    "origin": "https://ai.kanju25.com",
    "version": "web-2026-11-02",
    "sourceSha256": "f1fc0021de2ce4b30875287f237827861d37e1b9ce9ae148d8d46306f2ba0c31",
    "protocol": {
      "apiOrigins": [
        "https://ai.kanju25.com",
        "https://kanju.ai",
        "https://kanju25.com"
      ],
      "signingKey": "557d0e4ae929f438da6bd84412374e6086b8af09b3fed54bf22601d5bf8c54a0",
      "clientName": "dianyingtiantang-frontend",
      "clientVersion": "1.0.0",
      "buildVersion": "dianyingtiantang-v2026.10.21.6-redis-lifecycle-b85b39a9cc04-web",
      "protocolVersion": "2026-07-05.library-v2.playback-v1",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
    }
  }
];

return { default: __default__ };
})();

// --- transport.mjs ---
__modules.m8 = (() => {
let sequence=0;const pending=new Map(),memory=new Map();
const native=()=>!!globalThis.webkit?.messageHandlers?.native;
function post(type,options={}){
  const id='r'+(++sequence);return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{options.signal?.removeEventListener('abort',abort);pending.delete(id);globalThis.webkit?.messageHandlers?.native.postMessage({id,type:'cancel'});reject(Error('请求超时，请切换线路重试'));},25000);
    const abort=()=>{clearTimeout(timeout);pending.delete(id);globalThis.webkit?.messageHandlers?.native.postMessage({id,type:'cancel'});reject(new DOMException('请求取消','AbortError'));};
    if(options.signal?.aborted){abort();return;}
    options.signal?.addEventListener('abort',abort,{once:true});
    pending.set(id,{resolve,reject,timeout,abort,signal:options.signal});
    const {signal,...payload}=options;globalThis.webkit.messageHandlers.native.postMessage({id,type,...payload});
  });
}
const NativeTransport={
  deliver(message){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timeout);item.signal?.removeEventListener('abort',item.abort);if(message.error){const error=Error(message.error);error.code=message.errorCode;item.reject(error);}else item.resolve(message);},
  async request(options){if(native())return post('request',options);const {signal,...payload}=options;const response=await fetch('/__transport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});if(!response.ok)throw Error('本地预览服务不可用');const data=await response.json();if(data.error)throw Error(data.error);return data;},
  async play(url,headers={},options={}){if(native())return post('play',{url,headers,...options});return false;},
  controlPlayer(action,payload={}){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'player-control',type:'playerControl',action,...payload});},
  async copyText(text){if(native())return post('copyText',{text});await navigator.clipboard.writeText(text);return {ok:true};},
  async openExternal(url,{live=false}={}){if(native())return post('openExternal',{url,live});throw Error('外部播放器仅在 iPhone 原生 App 中可用');},
  async getLiveCache(){if(native())return (await post('liveCacheGet')).cache||null;try{return JSON.parse(localStorage.getItem('sanyuan:liveCache')||'null');}catch{return null;}},
  async saveLiveCache(url,text,baseURL=url){const value={url,text,baseURL};if(native())return post('liveCachePut',value);localStorage.setItem('sanyuan:liveCache',JSON.stringify(value));return {ok:true};},
  stopLive(){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'live-stop',type:'stopLive'});},
  openLive(){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'live-open',type:'liveOpen'});},
  closeLive(){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'live-close',type:'liveClose'});},
  syncLive(state,{fast=false}={}){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:fast?'live-state-fast':'live-state',type:fast?'liveStateFast':'liveState',state});},
  syncPage(state){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'page-state',type:'pageState',state});},
  syncProgress(time,duration){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'page-progress',type:'pageProgress',time,duration});},
  showAirPlay(frame){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'airplay',type:'airplay',frame});},
  layoutPlayer(context,frame){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:"layout",type:"playerLayout",context,frame});},
  statusStyle(dark){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:"theme",type:"statusStyle",dark:!!dark});},
  native,
  async saveOfflineEpisode(key,title,url,headers={}){if(native())return post('offlineCacheSave',{key,title,url,headers});return {ok:false};},
  async listOfflineEpisodes(){if(native())return (await post('offlineCacheList')).items||[];return [];},
  async deleteOfflineEpisode(key){if(native())return post('offlineCacheDelete',{key});return {ok:true};},
  vault:{async get(key){if(!native())return memory.get(key)||null;const result=await post('vaultGet',{key});try{return JSON.parse(result.value)||null;}catch{return null;}},async put(key,user){if(!native()){memory.set(key,user);return;}await post('vaultPut',{key,value:JSON.stringify(user)});},async remove(key){if(!native()){memory.delete(key);return;}await post('vaultDelete',{key});}},
};
globalThis.NativeTransport=NativeTransport;

return { NativeTransport };
})();

// --- yqk-api.mjs ---
__modules.m10 = (() => {
const { SiteClient, ServiceError } = __modules.m4;
const { safeHTTPS, safeImageURL } = __modules.m3;

const crypto=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const decode=response=>JSON.parse(crypto().enc.Utf8.stringify(crypto().enc.Base64.parse(response.bodyBase64||'')));
const origin=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.origin:'';}catch{return '';}};
const numeric=value=>/^\d+$/.test(String(value||''));
const firstCursor=value=>value==null||value===''||value==='page=1'?'':String(value);
const nextCursor=data=>data?.hasNext&&data.nextVal!=null?String(data.nextVal):'';
const pageIndex=value=>{const raw=String(value||'page=1');const n=Number(new URLSearchParams(raw).get('page')||raw);return Number.isSafeInteger(n)&&n>0?n:1;};
const names=value=>(Array.isArray(value)?value:[]).map(x=>typeof x==='string'?x:x?.vodWorkerName||x?.name).filter(Boolean);
const authDenial=(code,message)=>[10001,10006,10012].includes(Number(code))||/登录|注册|会员|付费|权限|下载\s*APP|客户端限制/i.test(message||'');
class YqkClient extends SiteClient {
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);this.protocol=site.protocol||{};this.details=new Map();this.movieHints=new Map();this.topicHints=new Map();this.childFilters=new Map();
  let stored=[];try{stored=JSON.parse(storage.getItem(this.key+'apiOrigins'))||[];}catch{}
  this.apiOrigins=[...new Set([...stored,...(this.protocol.apiOrigins||[])].map(origin).filter(Boolean))];
  try{const preferred=origin(storage.getItem(this.key+'preferredApiOrigin'));if(preferred&&this.apiOrigins.includes(preferred))this.preferred.cache=preferred;}catch{}
 }
 discoveryProfile(){return {timeline:false,timelineTab:null,sectionTab:'2',tabs:[{id:'0',name:'片库',mode:'catalog'},{id:'1',name:'Netflix',mode:'netflix'},{id:'2',name:'专题',mode:'topics'}]};}
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
    const ms=Date.now()-started;this.recordHealth(base,'cache',ms,true);this.recordHealth(base,'logic',ms,true);return {base,data:body.data};
   }).catch(error=>{if(!controllers.get(base).controller.signal.aborted){const ms=Date.now()-started;this.recordHealth(base,'cache',ms,false);this.recordHealth(base,'logic',ms,false);}throw Object.assign(error,{failedBase:base});});});
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
  const flags=String(item.flags||''),row={title:String(item.vodName),url:'vod/detail?vodId='+item.vodId,imageURL:safeImageURL(item.coverImg,this.site.origin),bottomLabel:String(item.remark||''),scoreText:item.score?String(item.score)+'分':'',topLeftLabel:(item.iconList||[]).map(x=>x.iconText).filter(Boolean).slice(0,1).join(''),labels:flags.split('/').map(x=>({name:x.trim()})).filter(x=>x.name),channelId:/(?:^|\s|\/)[^/]*片(?:\s|\/|$)/.test(flags)?1:0,isAdult:false};
  const key=String(item.vodId);this.movieHints.delete(key);this.movieHints.set(key,row);while(this.movieHints.size>500)this.movieHints.delete(this.movieHints.keys().next().value);return row;
 }
 movies(value){return (Array.isArray(value)?value:[]).map(x=>this.movie(x)).filter(Boolean);}
 sections(value){return (Array.isArray(value)?value:[]).map(t=>{if(numeric(t.vodTopicId)){const tk=String(t.vodTopicId);this.topicHints.delete(tk);this.topicHints.set(tk,t);while(this.topicHints.size>100)this.topicHints.delete(this.topicHints.keys().next().value);}return {header:{title:String(t.topicName||'精选片库'),...(numeric(t.vodTopicId)?{url:'specialTopic/vods?specialTopicId='+t.vodTopicId}:{})},data:this.movies(t.vodList)};}).filter(b=>b.data.length);}
 async home(signal){const [,d]=await Promise.all([this.ready(signal),this.post('/v2/api/home/body',{},signal)]);if(!Array.isArray(d?.vodTopicList))throw Error('网站首页结构已变化');return {blocks:this.sections(d.vodTopicList)};}
 async prepareChannel(channelId,signal){
  await this.ready(signal);if(!numeric(channelId))throw Error('无效分类');
  if(!this.childFilters.has(String(channelId))){
   let children=[];
   try{
    const d=await this.post('/v2/api/channel/childListView',{channelId:Number(channelId)},signal);
    children=(d?.childChannelList||[]).filter(c=>numeric(c.channelId)&&c.channelName);
    this.childFilters.set(String(channelId),children);
   }catch(error){
    if(error.name==='AbortError'||signal?.aborted)throw error;
   }
   this.config.channelListQuery=this.config.channelListQuery.filter(x=>Number(x.channelId)!==Number(channelId));
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
  if(route?.kind==='topics')return {items:(await this.home(signal)).blocks.filter(b=>b.header.url).map(b=>({title:b.header.title,url:b.header.url,imageURL:safeImageURL(this.topicHints.get(String(new URLSearchParams(b.header.url.split('?')[1]).get('specialTopicId')))?.coverImg,this.site.origin)})),next:''};
  if(route?.kind!=='topic'||!numeric(route.id))throw Error('此网站没有提供该类栏目');
  const page=pageIndex(next),data=await this.post('/v1/api/vodTopic/getVodList',{vodTopicId:Number(route.id),pageIndex:page,pageSize:18},signal);
  if(!Array.isArray(data?.items))throw Error('网站专题列表格式已变化');return {items:this.movies(data.items),next:Number(data.totalPages)>page?'page='+(page+1):''};
 }
 async detail(id,signal){
  await this.ready(signal);if(!numeric(id))throw Error('无效影片');const d=await this.post('/v2/api/vodInfo/index',{vodId:Number(id)},signal);
  if(!numeric(d?.vodId)||!Array.isArray(d.playerList))throw Error('网站影片详情结构已变化');
  const hint=this.movieHints.get(String(id)),playSources=d.playerList.map((line,index)=>({siteId:String(line.vodPlayerKind??'line')+':'+index,name:String(line.playerName||'线路 '+(index+1)),total:Number(line.totalEpCount)||line.epList?.length||0,list:(line.epList||[]).filter(e=>numeric(e.epId)).map(e=>({id:Number(e.epId),title:String(e.epName||'选集'),open:false}))}));
  const out={id:String(d.vodId),title:String(d.vodName||''),imageURL:safeImageURL(d.coverImg,this.site.origin),scoreText:d.score?String(d.score)+'分':'',bottomLabel:String(d.updateRemark||''),year:d.year,area:d.areaName?[{name:String(d.areaName)}]:[],language:[],channelId:hint?.channelId||0,channelName:hint?.channelId===1?'电影':'影片',isAdult:false,summary:String(d.intro||''),actors:names(d.actorList),directors:names(d.directorList),labels:names(d.tagList),playSources};
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

return { YqkClient };
})();

__modules.m12 = (() => {
const module = { exports: {} }, exports = module.exports;
/* JSEncrypt 3.5.4, MIT licensed; see JSEncrypt-LICENSE.txt. */
!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.JSEncrypt=e():t.JSEncrypt=e()}(this,function(){return function(){var t={606:function(t){var e,r,i=t.exports={};function n(){throw new Error("setTimeout has not been defined")}function s(){throw new Error("clearTimeout has not been defined")}function o(t){if(e===setTimeout)return setTimeout(t,0);if((e===n||!e)&&setTimeout)return e=setTimeout,setTimeout(t,0);try{return e(t,0)}catch(r){try{return e.call(null,t,0)}catch(r){return e.call(this,t,0)}}}!function(){try{e="function"==typeof setTimeout?setTimeout:n}catch(t){e=n}try{r="function"==typeof clearTimeout?clearTimeout:s}catch(t){r=s}}();var h,a=[],u=!1,c=-1;function f(){u&&h&&(u=!1,h.length?a=h.concat(a):c=-1,a.length&&l())}function l(){if(!u){var t=o(f);u=!0;for(var e=a.length;e;){for(h=a,a=[];++c<e;)h&&h[c].run();c=-1,e=a.length}h=null,u=!1,function(t){if(r===clearTimeout)return clearTimeout(t);if((r===s||!r)&&clearTimeout)return r=clearTimeout,clearTimeout(t);try{return r(t)}catch(e){try{return r.call(null,t)}catch(e){return r.call(this,t)}}}(t)}}function p(t,e){this.fun=t,this.array=e}function g(){}i.nextTick=function(t){var e=new Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)e[r-1]=arguments[r];a.push(new p(t,e)),1!==a.length||u||o(l)},p.prototype.run=function(){this.fun.apply(null,this.array)},i.title="browser",i.browser=!0,i.env={},i.argv=[],i.version="",i.versions={},i.on=g,i.addListener=g,i.once=g,i.off=g,i.removeListener=g,i.removeAllListeners=g,i.emit=g,i.prependListener=g,i.prependOnceListener=g,i.listeners=function(t){return[]},i.binding=function(t){throw new Error("process.binding is not supported")},i.cwd=function(){return"/"},i.chdir=function(t){throw new Error("process.chdir is not supported")},i.umask=function(){return 0}}},e={};function r(i){var n=e[i];if(void 0!==n)return n.exports;var s=e[i]={exports:{}};return t[i](s,s.exports,r),s.exports}r.d=function(t,e){for(var i in e)r.o(e,i)&&!r.o(t,i)&&Object.defineProperty(t,i,{enumerable:!0,get:e[i]})},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)};var i={};return function(){"use strict";r.d(i,{default:function(){return Et}});function t(t){return"0123456789abcdefghijklmnopqrstuvwxyz".charAt(t)}function e(t,e){return t&e}function n(t,e){return t|e}function s(t,e){return t^e}function o(t,e){return t&~e}function h(t){if(0==t)return-1;var e=0;return 65535&t||(t>>=16,e+=16),255&t||(t>>=8,e+=8),15&t||(t>>=4,e+=4),3&t||(t>>=2,e+=2),1&t||++e,e}function a(t){for(var e=0;0!=t;)t&=t-1,++e;return e}var u,c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";function f(t){var e,r,i="";for(e=0;e+3<=t.length;e+=3)r=parseInt(t.substring(e,e+3),16),i+=c.charAt(r>>6)+c.charAt(63&r);for(e+1==t.length?(r=parseInt(t.substring(e,e+1),16),i+=c.charAt(r<<2)):e+2==t.length&&(r=parseInt(t.substring(e,e+2),16),i+=c.charAt(r>>2)+c.charAt((3&r)<<4));(3&i.length)>0;)i+="=";return i}function l(e){var r,i="",n=0,s=0;for(r=0;r<e.length&&"="!=e.charAt(r);++r){var o=c.indexOf(e.charAt(r));o<0||(0==n?(i+=t(o>>2),s=3&o,n=1):1==n?(i+=t(s<<2|o>>4),s=15&o,n=2):2==n?(i+=t(s),i+=t(o>>2),s=3&o,n=3):(i+=t(s<<2|o>>4),i+=t(15&o),n=0))}return 1==n&&(i+=t(s<<2)),i}var p,g=function(t){var e;if(void 0===u){var r="0123456789ABCDEF",i=" \f\n\r\t \u2028\u2029";for(u={},e=0;e<16;++e)u[r.charAt(e)]=e;for(r=r.toLowerCase(),e=10;e<16;++e)u[r.charAt(e)]=e;for(e=0;e<8;++e)u[i.charAt(e)]=-1}var n=[],s=0,o=0;for(e=0;e<t.length;++e){var h=t.charAt(e);if("="==h)break;if(-1!=(h=u[h])){if(void 0===h)throw new Error("Illegal character at offset "+e);s|=h,++o>=2?(n[n.length]=s,s=0,o=0):s<<=4}}if(o)throw new Error("Hex encoding incomplete: 4 bits missing");return n},d={decode:function(t){var e;if(void 0===p){var r="= \f\n\r\t \u2028\u2029";for(p=Object.create(null),e=0;e<64;++e)p["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(e)]=e;for(p["-"]=62,p._=63,e=0;e<9;++e)p[r.charAt(e)]=-1}var i=[],n=0,s=0;for(e=0;e<t.length;++e){var o=t.charAt(e);if("="==o)break;if(-1!=(o=p[o])){if(void 0===o)throw new Error("Illegal character at offset "+e);n|=o,++s>=4?(i[i.length]=n>>16,i[i.length]=n>>8&255,i[i.length]=255&n,n=0,s=0):n<<=6}}switch(s){case 1:throw new Error("Base64 encoding incomplete: at least 2 bits missing");case 2:i[i.length]=n>>10;break;case 3:i[i.length]=n>>16,i[i.length]=n>>8&255}return i},re:/-----BEGIN [^-]+-----([A-Za-z0-9+\/=\s]+)-----END [^-]+-----|begin-base64[^\n]+\n([A-Za-z0-9+\/=\s]+)====/,unarmor:function(t){var e=d.re.exec(t);if(e)if(e[1])t=e[1];else{if(!e[2])throw new Error("RegExp out of sync");t=e[2]}return d.decode(t)}},v=1e13,y=function(){function t(t){this.buf=[+t||0]}return t.prototype.mulAdd=function(t,e){var r,i,n=this.buf,s=n.length;for(r=0;r<s;++r)(i=n[r]*t+e)<v?e=0:i-=(e=0|i/v)*v,n[r]=i;e>0&&(n[r]=e)},t.prototype.sub=function(t){var e,r,i=this.buf,n=i.length;for(e=0;e<n;++e)(r=i[e]-t)<0?(r+=v,t=1):t=0,i[e]=r;for(;0===i[i.length-1];)i.pop()},t.prototype.toString=function(t){if(10!=(t||10))throw new Error("only base 10 is supported");for(var e=this.buf,r=e[e.length-1].toString(),i=e.length-2;i>=0;--i)r+=(v+e[i]).toString().substring(1);return r},t.prototype.valueOf=function(){for(var t=this.buf,e=0,r=t.length-1;r>=0;--r)e=e*v+t[r];return e},t.prototype.simplify=function(){var t=this.buf;return 1==t.length?t[0]:this},t}(),m=/^(\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/,b=/^(\d\d\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/;function T(t,e){return t.length>e&&(t=t.substring(0,e)+"…"),t}var S,E=function(){function t(e,r){this.hexDigits="0123456789ABCDEF",e instanceof t?(this.enc=e.enc,this.pos=e.pos):(this.enc=e,this.pos=r)}return t.prototype.get=function(t){if(void 0===t&&(t=this.pos++),t>=this.enc.length)throw new Error("Requesting byte offset ".concat(t," on a stream of length ").concat(this.enc.length));return"string"==typeof this.enc?this.enc.charCodeAt(t):this.enc[t]},t.prototype.hexByte=function(t){return this.hexDigits.charAt(t>>4&15)+this.hexDigits.charAt(15&t)},t.prototype.hexDump=function(t,e,r){for(var i="",n=t;n<e;++n)if(i+=this.hexByte(this.get(n)),!0!==r)switch(15&n){case 7:i+="  ";break;case 15:i+="\n";break;default:i+=" "}return i},t.prototype.isASCII=function(t,e){for(var r=t;r<e;++r){var i=this.get(r);if(i<32||i>176)return!1}return!0},t.prototype.parseStringISO=function(t,e){for(var r="",i=t;i<e;++i)r+=String.fromCharCode(this.get(i));return r},t.prototype.parseStringUTF=function(t,e){for(var r="",i=t;i<e;){var n=this.get(i++);r+=n<128?String.fromCharCode(n):n>191&&n<224?String.fromCharCode((31&n)<<6|63&this.get(i++)):String.fromCharCode((15&n)<<12|(63&this.get(i++))<<6|63&this.get(i++))}return r},t.prototype.parseStringBMP=function(t,e){for(var r,i,n="",s=t;s<e;)r=this.get(s++),i=this.get(s++),n+=String.fromCharCode(r<<8|i);return n},t.prototype.parseTime=function(t,e,r){var i=this.parseStringISO(t,e),n=(r?m:b).exec(i);return n?(r&&(n[1]=+n[1],n[1]+=+n[1]<70?2e3:1900),i=n[1]+"-"+n[2]+"-"+n[3]+" "+n[4],n[5]&&(i+=":"+n[5],n[6]&&(i+=":"+n[6],n[7]&&(i+="."+n[7]))),n[8]&&(i+=" UTC","Z"!=n[8]&&(i+=n[8],n[9]&&(i+=":"+n[9]))),i):"Unrecognized time: "+i},t.prototype.parseInteger=function(t,e){for(var r,i=this.get(t),n=i>127,s=n?255:0,o="";i==s&&++t<e;)i=this.get(t);if(0===(r=e-t))return n?-1:0;if(r>4){for(o=i,r<<=3;!(128&(+o^s));)o=+o<<1,--r;o="("+r+" bit)\n"}n&&(i-=256);for(var h=new y(i),a=t+1;a<e;++a)h.mulAdd(256,this.get(a));return o+h.toString()},t.prototype.parseBitString=function(t,e,r){for(var i=this.get(t),n="("+((e-t-1<<3)-i)+" bit)\n",s="",o=t+1;o<e;++o){for(var h=this.get(o),a=o==e-1?i:0,u=7;u>=a;--u)s+=h>>u&1?"1":"0";if(s.length>r)return n+T(s,r)}return n+s},t.prototype.parseOctetString=function(t,e,r){if(this.isASCII(t,e))return T(this.parseStringISO(t,e),r);var i=e-t,n="("+i+" byte)\n";i>(r/=2)&&(e=t+r);for(var s=t;s<e;++s)n+=this.hexByte(this.get(s));return i>r&&(n+="…"),n},t.prototype.parseOID=function(t,e,r){for(var i="",n=new y,s=0,o=t;o<e;++o){var h=this.get(o);if(n.mulAdd(128,127&h),s+=7,!(128&h)){if(""===i)if((n=n.simplify())instanceof y)n.sub(80),i="2."+n.toString();else{var a=n<80?n<40?0:1:2;i=a+"."+(n-40*a)}else i+="."+n.toString();if(i.length>r)return T(i,r);n=new y,s=0}}return s>0&&(i+=".incomplete"),i},t}(),w=function(){function t(t,e,r,i,n){if(!(i instanceof D))throw new Error("Invalid tag value.");this.stream=t,this.header=e,this.length=r,this.tag=i,this.sub=n}return t.prototype.typeName=function(){switch(this.tag.tagClass){case 0:switch(this.tag.tagNumber){case 0:return"EOC";case 1:return"BOOLEAN";case 2:return"INTEGER";case 3:return"BIT_STRING";case 4:return"OCTET_STRING";case 5:return"NULL";case 6:return"OBJECT_IDENTIFIER";case 7:return"ObjectDescriptor";case 8:return"EXTERNAL";case 9:return"REAL";case 10:return"ENUMERATED";case 11:return"EMBEDDED_PDV";case 12:return"UTF8String";case 16:return"SEQUENCE";case 17:return"SET";case 18:return"NumericString";case 19:return"PrintableString";case 20:return"TeletexString";case 21:return"VideotexString";case 22:return"IA5String";case 23:return"UTCTime";case 24:return"GeneralizedTime";case 25:return"GraphicString";case 26:return"VisibleString";case 27:return"GeneralString";case 28:return"UniversalString";case 30:return"BMPString"}return"Universal_"+this.tag.tagNumber.toString();case 1:return"Application_"+this.tag.tagNumber.toString();case 2:return"["+this.tag.tagNumber.toString()+"]";case 3:return"Private_"+this.tag.tagNumber.toString()}},t.prototype.content=function(t){if(void 0===this.tag)return null;void 0===t&&(t=1/0);var e=this.posContent(),r=Math.abs(this.length);if(!this.tag.isUniversal())return null!==this.sub?"("+this.sub.length+" elem)":this.stream.parseOctetString(e,e+r,t);switch(this.tag.tagNumber){case 1:return 0===this.stream.get(e)?"false":"true";case 2:return this.stream.parseInteger(e,e+r);case 3:return this.sub?"("+this.sub.length+" elem)":this.stream.parseBitString(e,e+r,t);case 4:return this.sub?"("+this.sub.length+" elem)":this.stream.parseOctetString(e,e+r,t);case 6:return this.stream.parseOID(e,e+r,t);case 16:case 17:return null!==this.sub?"("+this.sub.length+" elem)":"(no elem)";case 12:return T(this.stream.parseStringUTF(e,e+r),t);case 18:case 19:case 20:case 21:case 22:case 26:return T(this.stream.parseStringISO(e,e+r),t);case 30:return T(this.stream.parseStringBMP(e,e+r),t);case 23:case 24:return this.stream.parseTime(e,e+r,23==this.tag.tagNumber)}return null},t.prototype.toString=function(){return this.typeName()+"@"+this.stream.pos+"[header:"+this.header+",length:"+this.length+",sub:"+(null===this.sub?"null":this.sub.length)+"]"},t.prototype.toPrettyString=function(t){void 0===t&&(t="");var e=t+this.typeName()+" @"+this.stream.pos;if(this.length>=0&&(e+="+"),e+=this.length,this.tag.tagConstructed?e+=" (constructed)":!this.tag.isUniversal()||3!=this.tag.tagNumber&&4!=this.tag.tagNumber||null===this.sub||(e+=" (encapsulates)"),e+="\n",null!==this.sub){t+="  ";for(var r=0,i=this.sub.length;r<i;++r)e+=this.sub[r].toPrettyString(t)}return e},t.prototype.posStart=function(){return this.stream.pos},t.prototype.posContent=function(){return this.stream.pos+this.header},t.prototype.posEnd=function(){return this.stream.pos+this.header+Math.abs(this.length)},t.prototype.toHexString=function(){return this.stream.hexDump(this.posStart(),this.posEnd(),!0)},t.decodeLength=function(t){var e=t.get(),r=127&e;if(r==e)return r;if(r>6)throw new Error("Length over 48 bits not supported at position "+(t.pos-1));if(0===r)return null;e=0;for(var i=0;i<r;++i)e=256*e+t.get();return e},t.prototype.getHexStringValue=function(){var t=this.toHexString(),e=2*this.header,r=2*this.length;return t.substring(e,e+r)},t.decode=function(e){var r;r=e instanceof E?e:new E(e,0);var i=new E(r),n=new D(r),s=t.decodeLength(r),o=r.pos,h=o-i.pos,a=null,u=function(){var e=[];if(null!==s){for(var i=o+s;r.pos<i;)e[e.length]=t.decode(r);if(r.pos!=i)throw new Error("Content size is not correct for container starting at offset "+o)}else try{for(;;){var n=t.decode(r);if(n.tag.isEOC())break;e[e.length]=n}s=o-r.pos}catch(t){throw new Error("Exception while decoding undefined length content: "+t)}return e};if(n.tagConstructed)a=u();else if(n.isUniversal()&&(3==n.tagNumber||4==n.tagNumber))try{if(3==n.tagNumber&&0!=r.get())throw new Error("BIT STRINGs with unused bits cannot encapsulate.");a=u();for(var c=0;c<a.length;++c)if(a[c].tag.isEOC())throw new Error("EOC is not supposed to be actual content.")}catch(t){a=null}if(null===a){if(null===s)throw new Error("We can't skip over an invalid tag with undefined length at offset "+o);r.pos=o+Math.abs(s)}return new t(i,h,s,n,a)},t}(),D=function(){function t(t){var e=t.get();if(this.tagClass=e>>6,this.tagConstructed=!!(32&e),this.tagNumber=31&e,31==this.tagNumber){var r=new y;do{e=t.get(),r.mulAdd(128,127&e)}while(128&e);this.tagNumber=r.simplify()}}return t.prototype.isUniversal=function(){return 0===this.tagClass},t.prototype.isEOC=function(){return 0===this.tagClass&&0===this.tagNumber},t}(),x=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997],R=(1<<26)/x[x.length-1],A=function(){function r(t,e,r){null!=t&&("number"==typeof t?this.fromNumber(t,e,r):null==e&&"string"!=typeof t?this.fromString(t,256):this.fromString(t,e))}return r.prototype.toString=function(e){if(this.s<0)return"-"+this.negate().toString(e);var r;if(16==e)r=4;else if(8==e)r=3;else if(2==e)r=1;else if(32==e)r=5;else{if(4!=e)return this.toRadix(e);r=2}var i,n=(1<<r)-1,s=!1,o="",h=this.t,a=this.DB-h*this.DB%r;if(h-- >0)for(a<this.DB&&(i=this[h]>>a)>0&&(s=!0,o=t(i));h>=0;)a<r?(i=(this[h]&(1<<a)-1)<<r-a,i|=this[--h]>>(a+=this.DB-r)):(i=this[h]>>(a-=r)&n,a<=0&&(a+=this.DB,--h)),i>0&&(s=!0),s&&(o+=t(i));return s?o:"0"},r.prototype.negate=function(){var t=N();return r.ZERO.subTo(this,t),t},r.prototype.abs=function(){return this.s<0?this.negate():this},r.prototype.compareTo=function(t){var e=this.s-t.s;if(0!=e)return e;var r=this.t;if(0!=(e=r-t.t))return this.s<0?-e:e;for(;--r>=0;)if(0!=(e=this[r]-t[r]))return e;return 0},r.prototype.bitLength=function(){return this.t<=0?0:this.DB*(this.t-1)+F(this[this.t-1]^this.s&this.DM)},r.prototype.mod=function(t){var e=N();return this.abs().divRemTo(t,null,e),this.s<0&&e.compareTo(r.ZERO)>0&&t.subTo(e,e),e},r.prototype.modPowInt=function(t,e){var r;return r=t<256||e.isEven()?new O(e):new V(e),this.exp(t,r)},r.prototype.clone=function(){var t=N();return this.copyTo(t),t},r.prototype.intValue=function(){if(this.s<0){if(1==this.t)return this[0]-this.DV;if(0==this.t)return-1}else{if(1==this.t)return this[0];if(0==this.t)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]},r.prototype.byteValue=function(){return 0==this.t?this.s:this[0]<<24>>24},r.prototype.shortValue=function(){return 0==this.t?this.s:this[0]<<16>>16},r.prototype.signum=function(){return this.s<0?-1:this.t<=0||1==this.t&&this[0]<=0?0:1},r.prototype.toByteArray=function(){var t=this.t,e=[];e[0]=this.s;var r,i=this.DB-t*this.DB%8,n=0;if(t-- >0)for(i<this.DB&&(r=this[t]>>i)!=(this.s&this.DM)>>i&&(e[n++]=r|this.s<<this.DB-i);t>=0;)i<8?(r=(this[t]&(1<<i)-1)<<8-i,r|=this[--t]>>(i+=this.DB-8)):(r=this[t]>>(i-=8)&255,i<=0&&(i+=this.DB,--t)),128&r&&(r|=-256),0==n&&(128&this.s)!=(128&r)&&++n,(n>0||r!=this.s)&&(e[n++]=r);return e},r.prototype.equals=function(t){return 0==this.compareTo(t)},r.prototype.min=function(t){return this.compareTo(t)<0?this:t},r.prototype.max=function(t){return this.compareTo(t)>0?this:t},r.prototype.and=function(t){var r=N();return this.bitwiseTo(t,e,r),r},r.prototype.or=function(t){var e=N();return this.bitwiseTo(t,n,e),e},r.prototype.xor=function(t){var e=N();return this.bitwiseTo(t,s,e),e},r.prototype.andNot=function(t){var e=N();return this.bitwiseTo(t,o,e),e},r.prototype.not=function(){for(var t=N(),e=0;e<this.t;++e)t[e]=this.DM&~this[e];return t.t=this.t,t.s=~this.s,t},r.prototype.shiftLeft=function(t){var e=N();return t<0?this.rShiftTo(-t,e):this.lShiftTo(t,e),e},r.prototype.shiftRight=function(t){var e=N();return t<0?this.lShiftTo(-t,e):this.rShiftTo(t,e),e},r.prototype.getLowestSetBit=function(){for(var t=0;t<this.t;++t)if(0!=this[t])return t*this.DB+h(this[t]);return this.s<0?this.t*this.DB:-1},r.prototype.bitCount=function(){for(var t=0,e=this.s&this.DM,r=0;r<this.t;++r)t+=a(this[r]^e);return t},r.prototype.testBit=function(t){var e=Math.floor(t/this.DB);return e>=this.t?0!=this.s:!!(this[e]&1<<t%this.DB)},r.prototype.setBit=function(t){return this.changeBit(t,n)},r.prototype.clearBit=function(t){return this.changeBit(t,o)},r.prototype.flipBit=function(t){return this.changeBit(t,s)},r.prototype.add=function(t){var e=N();return this.addTo(t,e),e},r.prototype.subtract=function(t){var e=N();return this.subTo(t,e),e},r.prototype.multiply=function(t){var e=N();return this.multiplyTo(t,e),e},r.prototype.divide=function(t){var e=N();return this.divRemTo(t,e,null),e},r.prototype.remainder=function(t){var e=N();return this.divRemTo(t,null,e),e},r.prototype.divideAndRemainder=function(t){var e=N(),r=N();return this.divRemTo(t,e,r),[e,r]},r.prototype.modPow=function(t,e){var r,i,n=t.bitLength(),s=H(1);if(n<=0)return s;r=n<18?1:n<48?3:n<144?4:n<768?5:6,i=n<8?new O(e):e.isEven()?new I(e):new V(e);var o=[],h=3,a=r-1,u=(1<<r)-1;if(o[1]=i.convert(this),r>1){var c=N();for(i.sqrTo(o[1],c);h<=u;)o[h]=N(),i.mulTo(c,o[h-2],o[h]),h+=2}var f,l,p=t.t-1,g=!0,d=N();for(n=F(t[p])-1;p>=0;){for(n>=a?f=t[p]>>n-a&u:(f=(t[p]&(1<<n+1)-1)<<a-n,p>0&&(f|=t[p-1]>>this.DB+n-a)),h=r;!(1&f);)f>>=1,--h;if((n-=h)<0&&(n+=this.DB,--p),g)o[f].copyTo(s),g=!1;else{for(;h>1;)i.sqrTo(s,d),i.sqrTo(d,s),h-=2;h>0?i.sqrTo(s,d):(l=s,s=d,d=l),i.mulTo(d,o[f],s)}for(;p>=0&&!(t[p]&1<<n);)i.sqrTo(s,d),l=s,s=d,d=l,--n<0&&(n=this.DB-1,--p)}return i.revert(s)},r.prototype.modInverse=function(t){var e=t.isEven();if(this.isEven()&&e||0==t.signum())return r.ZERO;for(var i=t.clone(),n=this.clone(),s=H(1),o=H(0),h=H(0),a=H(1);0!=i.signum();){for(;i.isEven();)i.rShiftTo(1,i),e?(s.isEven()&&o.isEven()||(s.addTo(this,s),o.subTo(t,o)),s.rShiftTo(1,s)):o.isEven()||o.subTo(t,o),o.rShiftTo(1,o);for(;n.isEven();)n.rShiftTo(1,n),e?(h.isEven()&&a.isEven()||(h.addTo(this,h),a.subTo(t,a)),h.rShiftTo(1,h)):a.isEven()||a.subTo(t,a),a.rShiftTo(1,a);i.compareTo(n)>=0?(i.subTo(n,i),e&&s.subTo(h,s),o.subTo(a,o)):(n.subTo(i,n),e&&h.subTo(s,h),a.subTo(o,a))}return 0!=n.compareTo(r.ONE)?r.ZERO:a.compareTo(t)>=0?a.subtract(t):a.signum()<0?(a.addTo(t,a),a.signum()<0?a.add(t):a):a},r.prototype.pow=function(t){return this.exp(t,new B)},r.prototype.gcd=function(t){var e=this.s<0?this.negate():this.clone(),r=t.s<0?t.negate():t.clone();if(e.compareTo(r)<0){var i=e;e=r,r=i}var n=e.getLowestSetBit(),s=r.getLowestSetBit();if(s<0)return e;for(n<s&&(s=n),s>0&&(e.rShiftTo(s,e),r.rShiftTo(s,r));e.signum()>0;)(n=e.getLowestSetBit())>0&&e.rShiftTo(n,e),(n=r.getLowestSetBit())>0&&r.rShiftTo(n,r),e.compareTo(r)>=0?(e.subTo(r,e),e.rShiftTo(1,e)):(r.subTo(e,r),r.rShiftTo(1,r));return s>0&&r.lShiftTo(s,r),r},r.prototype.isProbablePrime=function(t){var e,r=this.abs();if(1==r.t&&r[0]<=x[x.length-1]){for(e=0;e<x.length;++e)if(r[0]==x[e])return!0;return!1}if(r.isEven())return!1;for(e=1;e<x.length;){for(var i=x[e],n=e+1;n<x.length&&i<R;)i*=x[n++];for(i=r.modInt(i);e<n;)if(i%x[e++]==0)return!1}return r.millerRabin(t)},r.prototype.copyTo=function(t){for(var e=this.t-1;e>=0;--e)t[e]=this[e];t.t=this.t,t.s=this.s},r.prototype.fromInt=function(t){this.t=1,this.s=t<0?-1:0,t>0?this[0]=t:t<-1?this[0]=t+this.DV:this.t=0},r.prototype.fromString=function(t,e){var i;if(16==e)i=4;else if(8==e)i=3;else if(256==e)i=8;else if(2==e)i=1;else if(32==e)i=5;else{if(4!=e)return void this.fromRadix(t,e);i=2}this.t=0,this.s=0;for(var n=t.length,s=!1,o=0;--n>=0;){var h=8==i?255&+t[n]:C(t,n);h<0?"-"==t.charAt(n)&&(s=!0):(s=!1,0==o?this[this.t++]=h:o+i>this.DB?(this[this.t-1]|=(h&(1<<this.DB-o)-1)<<o,this[this.t++]=h>>this.DB-o):this[this.t-1]|=h<<o,(o+=i)>=this.DB&&(o-=this.DB))}8==i&&128&+t[0]&&(this.s=-1,o>0&&(this[this.t-1]|=(1<<this.DB-o)-1<<o)),this.clamp(),s&&r.ZERO.subTo(this,this)},r.prototype.clamp=function(){for(var t=this.s&this.DM;this.t>0&&this[this.t-1]==t;)--this.t},r.prototype.dlShiftTo=function(t,e){var r;for(r=this.t-1;r>=0;--r)e[r+t]=this[r];for(r=t-1;r>=0;--r)e[r]=0;e.t=this.t+t,e.s=this.s},r.prototype.drShiftTo=function(t,e){for(var r=t;r<this.t;++r)e[r-t]=this[r];e.t=Math.max(this.t-t,0),e.s=this.s},r.prototype.lShiftTo=function(t,e){for(var r=t%this.DB,i=this.DB-r,n=(1<<i)-1,s=Math.floor(t/this.DB),o=this.s<<r&this.DM,h=this.t-1;h>=0;--h)e[h+s+1]=this[h]>>i|o,o=(this[h]&n)<<r;for(h=s-1;h>=0;--h)e[h]=0;e[s]=o,e.t=this.t+s+1,e.s=this.s,e.clamp()},r.prototype.rShiftTo=function(t,e){e.s=this.s;var r=Math.floor(t/this.DB);if(r>=this.t)e.t=0;else{var i=t%this.DB,n=this.DB-i,s=(1<<i)-1;e[0]=this[r]>>i;for(var o=r+1;o<this.t;++o)e[o-r-1]|=(this[o]&s)<<n,e[o-r]=this[o]>>i;i>0&&(e[this.t-r-1]|=(this.s&s)<<n),e.t=this.t-r,e.clamp()}},r.prototype.subTo=function(t,e){for(var r=0,i=0,n=Math.min(t.t,this.t);r<n;)i+=this[r]-t[r],e[r++]=i&this.DM,i>>=this.DB;if(t.t<this.t){for(i-=t.s;r<this.t;)i+=this[r],e[r++]=i&this.DM,i>>=this.DB;i+=this.s}else{for(i+=this.s;r<t.t;)i-=t[r],e[r++]=i&this.DM,i>>=this.DB;i-=t.s}e.s=i<0?-1:0,i<-1?e[r++]=this.DV+i:i>0&&(e[r++]=i),e.t=r,e.clamp()},r.prototype.multiplyTo=function(t,e){var i=this.abs(),n=t.abs(),s=i.t;for(e.t=s+n.t;--s>=0;)e[s]=0;for(s=0;s<n.t;++s)e[s+i.t]=i.am(0,n[s],e,s,0,i.t);e.s=0,e.clamp(),this.s!=t.s&&r.ZERO.subTo(e,e)},r.prototype.squareTo=function(t){for(var e=this.abs(),r=t.t=2*e.t;--r>=0;)t[r]=0;for(r=0;r<e.t-1;++r){var i=e.am(r,e[r],t,2*r,0,1);(t[r+e.t]+=e.am(r+1,2*e[r],t,2*r+1,i,e.t-r-1))>=e.DV&&(t[r+e.t]-=e.DV,t[r+e.t+1]=1)}t.t>0&&(t[t.t-1]+=e.am(r,e[r],t,2*r,0,1)),t.s=0,t.clamp()},r.prototype.divRemTo=function(t,e,i){var n=t.abs();if(!(n.t<=0)){var s=this.abs();if(s.t<n.t)return null!=e&&e.fromInt(0),void(null!=i&&this.copyTo(i));null==i&&(i=N());var o=N(),h=this.s,a=t.s,u=this.DB-F(n[n.t-1]);u>0?(n.lShiftTo(u,o),s.lShiftTo(u,i)):(n.copyTo(o),s.copyTo(i));var c=o.t,f=o[c-1];if(0!=f){var l=f*(1<<this.F1)+(c>1?o[c-2]>>this.F2:0),p=this.FV/l,g=(1<<this.F1)/l,d=1<<this.F2,v=i.t,y=v-c,m=null==e?N():e;for(o.dlShiftTo(y,m),i.compareTo(m)>=0&&(i[i.t++]=1,i.subTo(m,i)),r.ONE.dlShiftTo(c,m),m.subTo(o,o);o.t<c;)o[o.t++]=0;for(;--y>=0;){var b=i[--v]==f?this.DM:Math.floor(i[v]*p+(i[v-1]+d)*g);if((i[v]+=o.am(0,b,i,y,0,c))<b)for(o.dlShiftTo(y,m),i.subTo(m,i);i[v]<--b;)i.subTo(m,i)}null!=e&&(i.drShiftTo(c,e),h!=a&&r.ZERO.subTo(e,e)),i.t=c,i.clamp(),u>0&&i.rShiftTo(u,i),h<0&&r.ZERO.subTo(i,i)}}},r.prototype.invDigit=function(){if(this.t<1)return 0;var t=this[0];if(!(1&t))return 0;var e=3&t;return(e=(e=(e=(e=e*(2-(15&t)*e)&15)*(2-(255&t)*e)&255)*(2-((65535&t)*e&65535))&65535)*(2-t*e%this.DV)%this.DV)>0?this.DV-e:-e},r.prototype.isEven=function(){return 0==(this.t>0?1&this[0]:this.s)},r.prototype.exp=function(t,e){if(t>4294967295||t<1)return r.ONE;var i=N(),n=N(),s=e.convert(this),o=F(t)-1;for(s.copyTo(i);--o>=0;)if(e.sqrTo(i,n),(t&1<<o)>0)e.mulTo(n,s,i);else{var h=i;i=n,n=h}return e.revert(i)},r.prototype.chunkSize=function(t){return Math.floor(Math.LN2*this.DB/Math.log(t))},r.prototype.toRadix=function(t){if(null==t&&(t=10),0==this.signum()||t<2||t>36)return"0";var e=this.chunkSize(t),r=Math.pow(t,e),i=H(r),n=N(),s=N(),o="";for(this.divRemTo(i,n,s);n.signum()>0;)o=(r+s.intValue()).toString(t).substring(1)+o,n.divRemTo(i,n,s);return s.intValue().toString(t)+o},r.prototype.fromRadix=function(t,e){this.fromInt(0),null==e&&(e=10);for(var i=this.chunkSize(e),n=Math.pow(e,i),s=!1,o=0,h=0,a=0;a<t.length;++a){var u=C(t,a);u<0?"-"==t.charAt(a)&&0==this.signum()&&(s=!0):(h=e*h+u,++o>=i&&(this.dMultiply(n),this.dAddOffset(h,0),o=0,h=0))}o>0&&(this.dMultiply(Math.pow(e,o)),this.dAddOffset(h,0)),s&&r.ZERO.subTo(this,this)},r.prototype.fromNumber=function(t,e,i){if("number"==typeof e)if(t<2)this.fromInt(1);else for(this.fromNumber(t,i),this.testBit(t-1)||this.bitwiseTo(r.ONE.shiftLeft(t-1),n,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(e);)this.dAddOffset(2,0),this.bitLength()>t&&this.subTo(r.ONE.shiftLeft(t-1),this);else{var s=[],o=7&t;s.length=1+(t>>3),e.nextBytes(s),o>0?s[0]&=(1<<o)-1:s[0]=0,this.fromString(s,256)}},r.prototype.bitwiseTo=function(t,e,r){var i,n,s=Math.min(t.t,this.t);for(i=0;i<s;++i)r[i]=e(this[i],t[i]);if(t.t<this.t){for(n=t.s&this.DM,i=s;i<this.t;++i)r[i]=e(this[i],n);r.t=this.t}else{for(n=this.s&this.DM,i=s;i<t.t;++i)r[i]=e(n,t[i]);r.t=t.t}r.s=e(this.s,t.s),r.clamp()},r.prototype.changeBit=function(t,e){var i=r.ONE.shiftLeft(t);return this.bitwiseTo(i,e,i),i},r.prototype.addTo=function(t,e){for(var r=0,i=0,n=Math.min(t.t,this.t);r<n;)i+=this[r]+t[r],e[r++]=i&this.DM,i>>=this.DB;if(t.t<this.t){for(i+=t.s;r<this.t;)i+=this[r],e[r++]=i&this.DM,i>>=this.DB;i+=this.s}else{for(i+=this.s;r<t.t;)i+=t[r],e[r++]=i&this.DM,i>>=this.DB;i+=t.s}e.s=i<0?-1:0,i>0?e[r++]=i:i<-1&&(e[r++]=this.DV+i),e.t=r,e.clamp()},r.prototype.dMultiply=function(t){this[this.t]=this.am(0,t-1,this,0,0,this.t),++this.t,this.clamp()},r.prototype.dAddOffset=function(t,e){if(0!=t){for(;this.t<=e;)this[this.t++]=0;for(this[e]+=t;this[e]>=this.DV;)this[e]-=this.DV,++e>=this.t&&(this[this.t++]=0),++this[e]}},r.prototype.multiplyLowerTo=function(t,e,r){var i=Math.min(this.t+t.t,e);for(r.s=0,r.t=i;i>0;)r[--i]=0;for(var n=r.t-this.t;i<n;++i)r[i+this.t]=this.am(0,t[i],r,i,0,this.t);for(n=Math.min(t.t,e);i<n;++i)this.am(0,t[i],r,i,0,e-i);r.clamp()},r.prototype.multiplyUpperTo=function(t,e,r){--e;var i=r.t=this.t+t.t-e;for(r.s=0;--i>=0;)r[i]=0;for(i=Math.max(e-this.t,0);i<t.t;++i)r[this.t+i-e]=this.am(e-i,t[i],r,0,0,this.t+i-e);r.clamp(),r.drShiftTo(1,r)},r.prototype.modInt=function(t){if(t<=0)return 0;var e=this.DV%t,r=this.s<0?t-1:0;if(this.t>0)if(0==e)r=this[0]%t;else for(var i=this.t-1;i>=0;--i)r=(e*r+this[i])%t;return r},r.prototype.millerRabin=function(t){var e=this.subtract(r.ONE),i=e.getLowestSetBit();if(i<=0)return!1;var n=e.shiftRight(i);(t=t+1>>1)>x.length&&(t=x.length);for(var s=N(),o=0;o<t;++o){s.fromInt(x[Math.floor(Math.random()*x.length)]);var h=s.modPow(n,this);if(0!=h.compareTo(r.ONE)&&0!=h.compareTo(e)){for(var a=1;a++<i&&0!=h.compareTo(e);)if(0==(h=h.modPowInt(2,this)).compareTo(r.ONE))return!1;if(0!=h.compareTo(e))return!1}}return!0},r.prototype.square=function(){var t=N();return this.squareTo(t),t},r.prototype.gcda=function(t,e){var r=this.s<0?this.negate():this.clone(),i=t.s<0?t.negate():t.clone();if(r.compareTo(i)<0){var n=r;r=i,i=n}var s=r.getLowestSetBit(),o=i.getLowestSetBit();if(o<0)e(r);else{s<o&&(o=s),o>0&&(r.rShiftTo(o,r),i.rShiftTo(o,i));var h=function(){(s=r.getLowestSetBit())>0&&r.rShiftTo(s,r),(s=i.getLowestSetBit())>0&&i.rShiftTo(s,i),r.compareTo(i)>=0?(r.subTo(i,r),r.rShiftTo(1,r)):(i.subTo(r,i),i.rShiftTo(1,i)),r.signum()>0?setTimeout(h,0):(o>0&&i.lShiftTo(o,i),setTimeout(function(){e(i)},0))};setTimeout(h,10)}},r.prototype.fromNumberAsync=function(t,e,i,s){if("number"==typeof e)if(t<2)this.fromInt(1);else{this.fromNumber(t,i),this.testBit(t-1)||this.bitwiseTo(r.ONE.shiftLeft(t-1),n,this),this.isEven()&&this.dAddOffset(1,0);var o=this,h=function(){o.dAddOffset(2,0),o.bitLength()>t&&o.subTo(r.ONE.shiftLeft(t-1),o),o.isProbablePrime(e)?setTimeout(function(){s()},0):setTimeout(h,0)};setTimeout(h,0)}else{var a=[],u=7&t;a.length=1+(t>>3),e.nextBytes(a),u>0?a[0]&=(1<<u)-1:a[0]=0,this.fromString(a,256)}},r}(),B=function(){function t(){}return t.prototype.convert=function(t){return t},t.prototype.revert=function(t){return t},t.prototype.mulTo=function(t,e,r){t.multiplyTo(e,r)},t.prototype.sqrTo=function(t,e){t.squareTo(e)},t}(),O=function(){function t(t){this.m=t}return t.prototype.convert=function(t){return t.s<0||t.compareTo(this.m)>=0?t.mod(this.m):t},t.prototype.revert=function(t){return t},t.prototype.reduce=function(t){t.divRemTo(this.m,null,t)},t.prototype.mulTo=function(t,e,r){t.multiplyTo(e,r),this.reduce(r)},t.prototype.sqrTo=function(t,e){t.squareTo(e),this.reduce(e)},t}(),V=function(){function t(t){this.m=t,this.mp=t.invDigit(),this.mpl=32767&this.mp,this.mph=this.mp>>15,this.um=(1<<t.DB-15)-1,this.mt2=2*t.t}return t.prototype.convert=function(t){var e=N();return t.abs().dlShiftTo(this.m.t,e),e.divRemTo(this.m,null,e),t.s<0&&e.compareTo(A.ZERO)>0&&this.m.subTo(e,e),e},t.prototype.revert=function(t){var e=N();return t.copyTo(e),this.reduce(e),e},t.prototype.reduce=function(t){for(;t.t<=this.mt2;)t[t.t++]=0;for(var e=0;e<this.m.t;++e){var r=32767&t[e],i=r*this.mpl+((r*this.mph+(t[e]>>15)*this.mpl&this.um)<<15)&t.DM;for(t[r=e+this.m.t]+=this.m.am(0,i,t,e,0,this.m.t);t[r]>=t.DV;)t[r]-=t.DV,t[++r]++}t.clamp(),t.drShiftTo(this.m.t,t),t.compareTo(this.m)>=0&&t.subTo(this.m,t)},t.prototype.mulTo=function(t,e,r){t.multiplyTo(e,r),this.reduce(r)},t.prototype.sqrTo=function(t,e){t.squareTo(e),this.reduce(e)},t}(),I=function(){function t(t){this.m=t,this.r2=N(),this.q3=N(),A.ONE.dlShiftTo(2*t.t,this.r2),this.mu=this.r2.divide(t)}return t.prototype.convert=function(t){if(t.s<0||t.t>2*this.m.t)return t.mod(this.m);if(t.compareTo(this.m)<0)return t;var e=N();return t.copyTo(e),this.reduce(e),e},t.prototype.revert=function(t){return t},t.prototype.reduce=function(t){for(t.drShiftTo(this.m.t-1,this.r2),t.t>this.m.t+1&&(t.t=this.m.t+1,t.clamp()),this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3),this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);t.compareTo(this.r2)<0;)t.dAddOffset(1,this.m.t+1);for(t.subTo(this.r2,t);t.compareTo(this.m)>=0;)t.subTo(this.m,t)},t.prototype.mulTo=function(t,e,r){t.multiplyTo(e,r),this.reduce(r)},t.prototype.sqrTo=function(t,e){t.squareTo(e),this.reduce(e)},t}();function N(){return new A(null)}function P(t,e){return new A(t,e)}var M="undefined"!=typeof navigator;M&&"Microsoft Internet Explorer"==navigator.appName?(A.prototype.am=function(t,e,r,i,n,s){for(var o=32767&e,h=e>>15;--s>=0;){var a=32767&this[t],u=this[t++]>>15,c=h*a+u*o;n=((a=o*a+((32767&c)<<15)+r[i]+(1073741823&n))>>>30)+(c>>>15)+h*u+(n>>>30),r[i++]=1073741823&a}return n},S=30):M&&"Netscape"!=navigator.appName?(A.prototype.am=function(t,e,r,i,n,s){for(;--s>=0;){var o=e*this[t++]+r[i]+n;n=Math.floor(o/67108864),r[i++]=67108863&o}return n},S=26):(A.prototype.am=function(t,e,r,i,n,s){for(var o=16383&e,h=e>>14;--s>=0;){var a=16383&this[t],u=this[t++]>>14,c=h*a+u*o;n=((a=o*a+((16383&c)<<14)+r[i]+n)>>28)+(c>>14)+h*u,r[i++]=268435455&a}return n},S=28),A.prototype.DB=S,A.prototype.DM=(1<<S)-1,A.prototype.DV=1<<S;A.prototype.FV=Math.pow(2,52),A.prototype.F1=52-S,A.prototype.F2=2*S-52;var L,j,q=[];for(L="0".charCodeAt(0),j=0;j<=9;++j)q[L++]=j;for(L="a".charCodeAt(0),j=10;j<36;++j)q[L++]=j;for(L="A".charCodeAt(0),j=10;j<36;++j)q[L++]=j;function C(t,e){var r=q[t.charCodeAt(e)];return null==r?-1:r}function H(t){var e=N();return e.fromInt(t),e}function F(t){var e,r=1;return 0!=(e=t>>>16)&&(t=e,r+=16),0!=(e=t>>8)&&(t=e,r+=8),0!=(e=t>>4)&&(t=e,r+=4),0!=(e=t>>2)&&(t=e,r+=2),0!=(e=t>>1)&&(t=e,r+=1),r}A.ZERO=H(0),A.ONE=H(1);var K=function(){function t(){this.i=0,this.j=0,this.S=[]}return t.prototype.init=function(t){var e,r,i;for(e=0;e<256;++e)this.S[e]=e;for(r=0,e=0;e<256;++e)r=r+this.S[e]+t[e%t.length]&255,i=this.S[e],this.S[e]=this.S[r],this.S[r]=i;this.i=0,this.j=0},t.prototype.next=function(){var t;return this.i=this.i+1&255,this.j=this.j+this.S[this.i]&255,t=this.S[this.i],this.S[this.i]=this.S[this.j],this.S[this.j]=t,this.S[t+this.S[this.i]&255]},t}();var U,k,_=null;if(null==_){_=[],k=0;var z=void 0;if("undefined"!=typeof window&&self.crypto&&self.crypto.getRandomValues){var Z=new Uint32Array(256);for(self.crypto.getRandomValues(Z),z=0;z<Z.length;++z)_[k++]=255&Z[z]}var G=0,$=function(t){if((G=G||0)>=256||k>=256)self.removeEventListener?self.removeEventListener("mousemove",$,!1):self.detachEvent&&self.detachEvent("onmousemove",$);else try{var e=t.x+t.y;_[k++]=255&e,G+=1}catch(t){}};"undefined"!=typeof window&&(self.addEventListener?self.addEventListener("mousemove",$,!1):self.attachEvent&&self.attachEvent("onmousemove",$))}function Y(){if(null==U){for(U=new K;k<256;){var t=Math.floor(65536*Math.random());_[k++]=255&t}for(U.init(_),k=0;k<_.length;++k)_[k]=0;k=0}return U.next()}var J=function(){function t(){}return t.prototype.nextBytes=function(t){for(var e=0;e<t.length;++e)t[e]=Y()},t}();function X(t){return function(t){for(var e="",r=0;r<32*t.length;r+=8)e+=String.fromCharCode(t[r>>5]>>>24-r%32&255);return e}(function(t,e){var r,i,n,s,o,h,a,u,c,f,l,p,g=new Array(1779033703,-1150833019,1013904242,-1521486534,1359893119,-1694144372,528734635,1541459225),d=new Array(64);for(t[e>>5]|=128<<24-e%32,t[15+(e+64>>9<<4)]=e,c=0;c<t.length;c+=16){for(r=g[0],i=g[1],n=g[2],s=g[3],o=g[4],h=g[5],a=g[6],u=g[7],f=0;f<64;f++)d[f]=f<16?t[f+c]:at(at(at(ot(d[f-2]),d[f-7]),st(d[f-15])),d[f-16]),l=at(at(at(at(u,nt(o)),et(o,h,a)),ht[f]),d[f]),p=at(it(r),rt(r,i,n)),u=a,a=h,h=o,o=at(s,l),s=n,n=i,i=r,r=at(l,p);g[0]=at(r,g[0]),g[1]=at(i,g[1]),g[2]=at(n,g[2]),g[3]=at(s,g[3]),g[4]=at(o,g[4]),g[5]=at(h,g[5]),g[6]=at(a,g[6]),g[7]=at(u,g[7])}return g}(function(t){for(var e=Array(t.length>>2),r=0;r<e.length;r++)e[r]=0;for(r=0;r<8*t.length;r+=8)e[r>>5]|=(255&t.charCodeAt(r/8))<<24-r%32;return e}(t),8*t.length))}function Q(t){for(var e="0123456789abcdef",r="",i=0;i<t.length;i++){var n=t.charCodeAt(i);r+=e.charAt(n>>>4&15)+e.charAt(15&n)}return r}function W(t,e){return t>>>e|t<<32-e}function tt(t,e){return t>>>e}function et(t,e,r){return t&e^~t&r}function rt(t,e,r){return t&e^t&r^e&r}function it(t){return W(t,2)^W(t,13)^W(t,22)}function nt(t){return W(t,6)^W(t,11)^W(t,25)}function st(t){return W(t,7)^W(t,18)^tt(t,3)}function ot(t){return W(t,17)^W(t,19)^tt(t,10)}var ht=new Array(1116352408,1899447441,-1245643825,-373957723,961987163,1508970993,-1841331548,-1424204075,-670586216,310598401,607225278,1426881987,1925078388,-2132889090,-1680079193,-1046744716,-459576895,-272742522,264347078,604807628,770255983,1249150122,1555081692,1996064986,-1740746414,-1473132947,-1341970488,-1084653625,-958395405,-710438585,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,-2117940946,-1838011259,-1564481375,-1474664885,-1035236496,-949202525,-778901479,-694614492,-200395387,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,-2067236844,-1933114872,-1866530822,-1538233109,-1090935817,-965641998);function at(t,e){var r=(65535&t)+(65535&e);return(t>>16)+(e>>16)+(r>>16)<<16|65535&r}function ut(t,e){if(e<t.length+11)return console.error("Message too long for RSA"),null;for(var r=[],i=t.length-1;i>=0&&e>0;){var n=t.charCodeAt(i--);n<128?r[--e]=n:n>127&&n<2048?(r[--e]=63&n|128,r[--e]=n>>6|192):(r[--e]=63&n|128,r[--e]=n>>6&63|128,r[--e]=n>>12|224)}r[--e]=0;for(var s=new J,o=[];e>2;){for(o[0]=0;0==o[0];)s.nextBytes(o);r[--e]=o[0]}return r[--e]=2,r[--e]=0,new A(r)}function ct(t,e,r){for(var i="",n=0;i.length<e;)i+=r(String.fromCharCode.apply(String,t.concat([(4278190080&n)>>24,(16711680&n)>>16,(65280&n)>>8,255&n]))),n+=1;return i}function ft(t,e){var r=X;if(t.length+64+2>e)throw"Message too long for RSA";var i,n="";for(i=0;i<e-t.length-64-2;i+=1)n+="\0";var s=r("")+n+""+t,o=new Array(32);(new J).nextBytes(o);var h=ct(o,s.length,r),a=[];for(i=0;i<s.length;i+=1)a[i]=s.charCodeAt(i)^h.charCodeAt(i);var u=ct(a,o.length,r),c=[0];for(i=0;i<o.length;i+=1)c[i+1]=o[i]^u.charCodeAt(i);return new A(c.concat(a))}var lt=function(){function t(){this.n=null,this.e=0,this.d=null,this.p=null,this.q=null,this.dmp1=null,this.dmq1=null,this.coeff=null}return t.prototype.doPublic=function(t){return t.modPowInt(this.e,this.n)},t.prototype.doPrivate=function(t){if(null==this.p||null==this.q)return t.modPow(this.d,this.n);for(var e=t.mod(this.p).modPow(this.dmp1,this.p),r=t.mod(this.q).modPow(this.dmq1,this.q);e.compareTo(r)<0;)e=e.add(this.p);return e.subtract(r).multiply(this.coeff).mod(this.p).multiply(this.q).add(r)},t.prototype.setPublic=function(t,e){null!=t&&null!=e&&t.length>0&&e.length>0?(this.n=P(t,16),this.e=parseInt(e,16)):console.error("Invalid RSA public key")},t.prototype.encrypt=function(t,e){void 0===e&&(e=ut);var r=this.n.bitLength()+7>>3,i=e(t,r);if(null==i)return null;var n=this.doPublic(i);if(null==n)return null;for(var s=n.toString(16),o=s.length,h=0;h<2*r-o;h++)s="0"+s;return s},t.prototype.setPrivate=function(t,e,r){null!=t&&null!=e&&t.length>0&&e.length>0?(this.n=P(t,16),this.e=parseInt(e,16),this.d=P(r,16)):console.error("Invalid RSA private key")},t.prototype.setPrivateEx=function(t,e,r,i,n,s,o,h){null!=t&&null!=e&&t.length>0&&e.length>0?(this.n=P(t,16),this.e=parseInt(e,16),this.d=P(r,16),this.p=P(i,16),this.q=P(n,16),this.dmp1=P(s,16),this.dmq1=P(o,16),this.coeff=P(h,16)):console.error("Invalid RSA private key")},t.prototype.generate=function(t,e){var r=new J,i=t>>1;this.e=parseInt(e,16);for(var n=new A(e,16);;){for(;this.p=new A(t-i,1,r),0!=this.p.subtract(A.ONE).gcd(n).compareTo(A.ONE)||!this.p.isProbablePrime(10););for(;this.q=new A(i,1,r),0!=this.q.subtract(A.ONE).gcd(n).compareTo(A.ONE)||!this.q.isProbablePrime(10););if(this.p.compareTo(this.q)<=0){var s=this.p;this.p=this.q,this.q=s}var o=this.p.subtract(A.ONE),h=this.q.subtract(A.ONE),a=o.multiply(h);if(0==a.gcd(n).compareTo(A.ONE)){this.n=this.p.multiply(this.q),this.d=n.modInverse(a),this.dmp1=this.d.mod(o),this.dmq1=this.d.mod(h),this.coeff=this.q.modInverse(this.p);break}}},t.prototype.decrypt=function(t){var e=P(t,16),r=this.doPrivate(e);return null==r?null:function(t,e){var r=t.toByteArray(),i=0;for(;i<r.length&&0==r[i];)++i;if(r.length-i!=e-1||2!=r[i])return null;++i;for(;0!=r[i];)if(++i>=r.length)return null;var n="";for(;++i<r.length;){var s=255&r[i];s<128?n+=String.fromCharCode(s):s>191&&s<224?(n+=String.fromCharCode((31&s)<<6|63&r[i+1]),++i):(n+=String.fromCharCode((15&s)<<12|(63&r[i+1])<<6|63&r[i+2]),i+=2)}return n}(r,this.n.bitLength()+7>>3)},t.prototype.generateAsync=function(t,e,r){var i=new J,n=t>>1;this.e=parseInt(e,16);var s=new A(e,16),o=this,h=function(){var e=function(){if(o.p.compareTo(o.q)<=0){var t=o.p;o.p=o.q,o.q=t}var e=o.p.subtract(A.ONE),i=o.q.subtract(A.ONE),n=e.multiply(i);0==n.gcd(s).compareTo(A.ONE)?(o.n=o.p.multiply(o.q),o.d=s.modInverse(n),o.dmp1=o.d.mod(e),o.dmq1=o.d.mod(i),o.coeff=o.q.modInverse(o.p),setTimeout(function(){r()},0)):setTimeout(h,0)},a=function(){o.q=N(),o.q.fromNumberAsync(n,1,i,function(){o.q.subtract(A.ONE).gcda(s,function(t){0==t.compareTo(A.ONE)&&o.q.isProbablePrime(10)?setTimeout(e,0):setTimeout(a,0)})})},u=function(){o.p=N(),o.p.fromNumberAsync(t-n,1,i,function(){o.p.subtract(A.ONE).gcda(s,function(t){0==t.compareTo(A.ONE)&&o.p.isProbablePrime(10)?setTimeout(a,0):setTimeout(u,0)})})};setTimeout(u,0)};setTimeout(h,0)},t.prototype.sign=function(t,e,r){var i=(pt[r]||"")+e(t).toString(),n=this.n.bitLength()/4,s=function(t,e){if(e<t.length+22)return console.error("Message too long for RSA"),null;for(var r=e-t.length-6,i="",n=0;n<r;n+=2)i+="ff";return P("0001"+i+"00"+t,16)}(i,n);if(null==s)return null;var o=this.doPrivate(s);if(null==o)return null;for(var h=o.toString(16),a=h.length,u=0;u<n-a;u++)h="0"+h;return h},t.prototype.verify=function(t,e,r){var i=P(e,16),n=this.doPublic(i);return null==n?null:function(t){for(var e in pt)if(pt.hasOwnProperty(e)){var r=pt[e],i=r.length;if(t.substring(0,i)==r)return t.substring(i)}return t}(n.toString(16).replace(/^1f+00/,""))==r(t).toString()},t}();var pt={md2:"3020300c06082a864886f70d020205000410",md5:"3020300c06082a864886f70d020505000410",sha1:"3021300906052b0e03021a05000414",sha224:"302d300d06096086480165030402040500041c",sha256:"3031300d060960864801650304020105000420",sha384:"3041300d060960864801650304020205000430",sha512:"3051300d060960864801650304020305000440",ripemd160:"3021300906052b2403020105000414"};function gt(t,e,r){if(!e||!t)throw new Error("extend failed, please check that all dependencies are included.");var i=function(){};if(i.prototype=e.prototype,t.prototype=new i,t.prototype.constructor=t,t.superclass=e.prototype,e.prototype.constructor==Object.prototype.constructor&&(e.prototype.constructor=e),r){var n;for(n in r)t.prototype[n]=r[n];var s=function(){},o=["toString","valueOf"];try{/MSIE/.test(navigator.userAgent)&&(s=function(t,e){for(n=0;n<o.length;n+=1){var r=o[n],i=e[r];"function"==typeof i&&i!=Object.prototype[r]&&(t[r]=i)}})}catch(t){}s(t.prototype,r)}}var dt={};void 0!==dt.asn1&&dt.asn1||(dt.asn1={}),dt.asn1.ASN1Util=new function(){this.integerToByteHex=function(t){var e=t.toString(16);return e.length%2==1&&(e="0"+e),e},this.bigIntToMinTwosComplementsHex=function(t){var e=t.toString(16);if("-"!=e.substring(0,1))e.length%2==1?e="0"+e:e.match(/^[0-7]/)||(e="00"+e);else{var r=e.substring(1).length;r%2==1?r+=1:e.match(/^[0-7]/)||(r+=2);for(var i="",n=0;n<r;n++)i+="f";e=new A(i,16).xor(t).add(A.ONE).toString(16).replace(/^-/,"")}return e},this.getPEMStringFromHex=function(t,e){return hextopem(t,e)},this.newObject=function(t){var e=dt.asn1,r=e.DERBoolean,i=e.DERInteger,n=e.DERBitString,s=e.DEROctetString,o=e.DERNull,h=e.DERObjectIdentifier,a=e.DEREnumerated,u=e.DERUTF8String,c=e.DERNumericString,f=e.DERPrintableString,l=e.DERTeletexString,p=e.DERIA5String,g=e.DERUTCTime,d=e.DERGeneralizedTime,v=e.DERSequence,y=e.DERSet,m=e.DERTaggedObject,b=e.ASN1Util.newObject,T=Object.keys(t);if(1!=T.length)throw"key of param shall be only one.";var S=T[0];if(-1==":bool:int:bitstr:octstr:null:oid:enum:utf8str:numstr:prnstr:telstr:ia5str:utctime:gentime:seq:set:tag:".indexOf(":"+S+":"))throw"undefined key: "+S;if("bool"==S)return new r(t[S]);if("int"==S)return new i(t[S]);if("bitstr"==S)return new n(t[S]);if("octstr"==S)return new s(t[S]);if("null"==S)return new o(t[S]);if("oid"==S)return new h(t[S]);if("enum"==S)return new a(t[S]);if("utf8str"==S)return new u(t[S]);if("numstr"==S)return new c(t[S]);if("prnstr"==S)return new f(t[S]);if("telstr"==S)return new l(t[S]);if("ia5str"==S)return new p(t[S]);if("utctime"==S)return new g(t[S]);if("gentime"==S)return new d(t[S]);if("seq"==S){for(var E=t[S],w=[],D=0;D<E.length;D++){var x=b(E[D]);w.push(x)}return new v({array:w})}if("set"==S){for(E=t[S],w=[],D=0;D<E.length;D++){x=b(E[D]);w.push(x)}return new y({array:w})}if("tag"==S){var R=t[S];if("[object Array]"===Object.prototype.toString.call(R)&&3==R.length){var A=b(R[2]);return new m({tag:R[0],explicit:R[1],obj:A})}var B={};if(void 0!==R.explicit&&(B.explicit=R.explicit),void 0!==R.tag&&(B.tag=R.tag),void 0===R.obj)throw"obj shall be specified for 'tag'.";return B.obj=b(R.obj),new m(B)}},this.jsonToASN1HEX=function(t){return this.newObject(t).getEncodedHex()}},dt.asn1.ASN1Util.oidHexToInt=function(t){for(var e="",r=parseInt(t.substring(0,2),16),i=(e=Math.floor(r/40)+"."+r%40,""),n=2;n<t.length;n+=2){var s=("00000000"+parseInt(t.substring(n,n+2),16).toString(2)).slice(-8);if(i+=s.substring(1,8),"0"==s.substring(0,1))e=e+"."+new A(i,2).toString(10),i=""}return e},dt.asn1.ASN1Util.oidIntToHex=function(t){var e=function(t){var e=t.toString(16);return 1==e.length&&(e="0"+e),e},r=function(t){var r="",i=new A(t,10).toString(2),n=7-i.length%7;7==n&&(n=0);for(var s="",o=0;o<n;o++)s+="0";i=s+i;for(o=0;o<i.length-1;o+=7){var h=i.substring(o,o+7);o!=i.length-7&&(h="1"+h),r+=e(parseInt(h,2))}return r};if(!t.match(/^[0-9.]+$/))throw"malformed oid string: "+t;var i="",n=t.split("."),s=40*parseInt(n[0])+parseInt(n[1]);i+=e(s),n.splice(0,2);for(var o=0;o<n.length;o++)i+=r(n[o]);return i},dt.asn1.ASN1Object=function(){this.getLengthHexFromValue=function(){if(void 0===this.hV||null==this.hV)throw"this.hV is null or undefined.";if(this.hV.length%2==1)throw"value hex must be even length: n=0,v="+this.hV;var t=this.hV.length/2,e=t.toString(16);if(e.length%2==1&&(e="0"+e),t<128)return e;var r=e.length/2;if(r>15)throw"ASN.1 length too long to represent by 8x: n = "+t.toString(16);return(128+r).toString(16)+e},this.getEncodedHex=function(){return(null==this.hTLV||this.isModified)&&(this.hV=this.getFreshValueHex(),this.hL=this.getLengthHexFromValue(),this.hTLV=this.hT+this.hL+this.hV,this.isModified=!1),this.hTLV},this.getValueHex=function(){return this.getEncodedHex(),this.hV},this.getFreshValueHex=function(){return""}},dt.asn1.DERAbstractString=function(t){dt.asn1.DERAbstractString.superclass.constructor.call(this);this.getString=function(){return this.s},this.setString=function(t){this.hTLV=null,this.isModified=!0,this.s=t,this.hV=stohex(this.s)},this.setStringHex=function(t){this.hTLV=null,this.isModified=!0,this.s=null,this.hV=t},this.getFreshValueHex=function(){return this.hV},void 0!==t&&("string"==typeof t?this.setString(t):void 0!==t.str?this.setString(t.str):void 0!==t.hex&&this.setStringHex(t.hex))},gt(dt.asn1.DERAbstractString,dt.asn1.ASN1Object),dt.asn1.DERAbstractTime=function(t){dt.asn1.DERAbstractTime.superclass.constructor.call(this);this.localDateToUTC=function(t){return utc=t.getTime()+6e4*t.getTimezoneOffset(),new Date(utc)},this.formatDate=function(t,e,r){var i=this.zeroPadding,n=this.localDateToUTC(t),s=String(n.getFullYear());"utc"==e&&(s=s.substring(2,4));var o=s+i(String(n.getMonth()+1),2)+i(String(n.getDate()),2)+i(String(n.getHours()),2)+i(String(n.getMinutes()),2)+i(String(n.getSeconds()),2);if(!0===r){var h=n.getMilliseconds();if(0!=h){var a=i(String(h),3);o=o+"."+(a=a.replace(/[0]+$/,""))}}return o+"Z"},this.zeroPadding=function(t,e){return t.length>=e?t:new Array(e-t.length+1).join("0")+t},this.getString=function(){return this.s},this.setString=function(t){this.hTLV=null,this.isModified=!0,this.s=t,this.hV=stohex(t)},this.setByDateValue=function(t,e,r,i,n,s){var o=new Date(Date.UTC(t,e-1,r,i,n,s,0));this.setByDate(o)},this.getFreshValueHex=function(){return this.hV}},gt(dt.asn1.DERAbstractTime,dt.asn1.ASN1Object),dt.asn1.DERAbstractStructured=function(t){dt.asn1.DERAbstractString.superclass.constructor.call(this);this.setByASN1ObjectArray=function(t){this.hTLV=null,this.isModified=!0,this.asn1Array=t},this.appendASN1Object=function(t){this.hTLV=null,this.isModified=!0,this.asn1Array.push(t)},this.asn1Array=new Array,void 0!==t&&void 0!==t.array&&(this.asn1Array=t.array)},gt(dt.asn1.DERAbstractStructured,dt.asn1.ASN1Object),dt.asn1.DERBoolean=function(){dt.asn1.DERBoolean.superclass.constructor.call(this),this.hT="01",this.hTLV="0101ff"},gt(dt.asn1.DERBoolean,dt.asn1.ASN1Object),dt.asn1.DERInteger=function(t){dt.asn1.DERInteger.superclass.constructor.call(this),this.hT="02",this.setByBigInteger=function(t){this.hTLV=null,this.isModified=!0,this.hV=dt.asn1.ASN1Util.bigIntToMinTwosComplementsHex(t)},this.setByInteger=function(t){var e=new A(String(t),10);this.setByBigInteger(e)},this.setValueHex=function(t){this.hV=t},this.getFreshValueHex=function(){return this.hV},void 0!==t&&(void 0!==t.bigint?this.setByBigInteger(t.bigint):void 0!==t.int?this.setByInteger(t.int):"number"==typeof t?this.setByInteger(t):void 0!==t.hex&&this.setValueHex(t.hex))},gt(dt.asn1.DERInteger,dt.asn1.ASN1Object),dt.asn1.DERBitString=function(t){if(void 0!==t&&void 0!==t.obj){var e=dt.asn1.ASN1Util.newObject(t.obj);t.hex="00"+e.getEncodedHex()}dt.asn1.DERBitString.superclass.constructor.call(this),this.hT="03",this.setHexValueIncludingUnusedBits=function(t){this.hTLV=null,this.isModified=!0,this.hV=t},this.setUnusedBitsAndHexValue=function(t,e){if(t<0||7<t)throw"unused bits shall be from 0 to 7: u = "+t;var r="0"+t;this.hTLV=null,this.isModified=!0,this.hV=r+e},this.setByBinaryString=function(t){var e=8-(t=t.replace(/0+$/,"")).length%8;8==e&&(e=0);for(var r=0;r<=e;r++)t+="0";var i="";for(r=0;r<t.length-1;r+=8){var n=t.substring(r,r+8),s=parseInt(n,2).toString(16);1==s.length&&(s="0"+s),i+=s}this.hTLV=null,this.isModified=!0,this.hV="0"+e+i},this.setByBooleanArray=function(t){for(var e="",r=0;r<t.length;r++)1==t[r]?e+="1":e+="0";this.setByBinaryString(e)},this.newFalseArray=function(t){for(var e=new Array(t),r=0;r<t;r++)e[r]=!1;return e},this.getFreshValueHex=function(){return this.hV},void 0!==t&&("string"==typeof t&&t.toLowerCase().match(/^[0-9a-f]+$/)?this.setHexValueIncludingUnusedBits(t):void 0!==t.hex?this.setHexValueIncludingUnusedBits(t.hex):void 0!==t.bin?this.setByBinaryString(t.bin):void 0!==t.array&&this.setByBooleanArray(t.array))},gt(dt.asn1.DERBitString,dt.asn1.ASN1Object),dt.asn1.DEROctetString=function(t){if(void 0!==t&&void 0!==t.obj){var e=dt.asn1.ASN1Util.newObject(t.obj);t.hex=e.getEncodedHex()}dt.asn1.DEROctetString.superclass.constructor.call(this,t),this.hT="04"},gt(dt.asn1.DEROctetString,dt.asn1.DERAbstractString),dt.asn1.DERNull=function(){dt.asn1.DERNull.superclass.constructor.call(this),this.hT="05",this.hTLV="0500"},gt(dt.asn1.DERNull,dt.asn1.ASN1Object),dt.asn1.DERObjectIdentifier=function(t){var e=function(t){var e=t.toString(16);return 1==e.length&&(e="0"+e),e},r=function(t){var r="",i=new A(t,10).toString(2),n=7-i.length%7;7==n&&(n=0);for(var s="",o=0;o<n;o++)s+="0";i=s+i;for(o=0;o<i.length-1;o+=7){var h=i.substring(o,o+7);o!=i.length-7&&(h="1"+h),r+=e(parseInt(h,2))}return r};dt.asn1.DERObjectIdentifier.superclass.constructor.call(this),this.hT="06",this.setValueHex=function(t){this.hTLV=null,this.isModified=!0,this.s=null,this.hV=t},this.setValueOidString=function(t){if(!t.match(/^[0-9.]+$/))throw"malformed oid string: "+t;var i="",n=t.split("."),s=40*parseInt(n[0])+parseInt(n[1]);i+=e(s),n.splice(0,2);for(var o=0;o<n.length;o++)i+=r(n[o]);this.hTLV=null,this.isModified=!0,this.s=null,this.hV=i},this.setValueName=function(t){var e=dt.asn1.x509.OID.name2oid(t);if(""===e)throw"DERObjectIdentifier oidName undefined: "+t;this.setValueOidString(e)},this.getFreshValueHex=function(){return this.hV},void 0!==t&&("string"==typeof t?t.match(/^[0-2].[0-9.]+$/)?this.setValueOidString(t):this.setValueName(t):void 0!==t.oid?this.setValueOidString(t.oid):void 0!==t.hex?this.setValueHex(t.hex):void 0!==t.name&&this.setValueName(t.name))},gt(dt.asn1.DERObjectIdentifier,dt.asn1.ASN1Object),dt.asn1.DEREnumerated=function(t){dt.asn1.DEREnumerated.superclass.constructor.call(this),this.hT="0a",this.setByBigInteger=function(t){this.hTLV=null,this.isModified=!0,this.hV=dt.asn1.ASN1Util.bigIntToMinTwosComplementsHex(t)},this.setByInteger=function(t){var e=new A(String(t),10);this.setByBigInteger(e)},this.setValueHex=function(t){this.hV=t},this.getFreshValueHex=function(){return this.hV},void 0!==t&&(void 0!==t.int?this.setByInteger(t.int):"number"==typeof t?this.setByInteger(t):void 0!==t.hex&&this.setValueHex(t.hex))},gt(dt.asn1.DEREnumerated,dt.asn1.ASN1Object),dt.asn1.DERUTF8String=function(t){dt.asn1.DERUTF8String.superclass.constructor.call(this,t),this.hT="0c"},gt(dt.asn1.DERUTF8String,dt.asn1.DERAbstractString),dt.asn1.DERNumericString=function(t){dt.asn1.DERNumericString.superclass.constructor.call(this,t),this.hT="12"},gt(dt.asn1.DERNumericString,dt.asn1.DERAbstractString),dt.asn1.DERPrintableString=function(t){dt.asn1.DERPrintableString.superclass.constructor.call(this,t),this.hT="13"},gt(dt.asn1.DERPrintableString,dt.asn1.DERAbstractString),dt.asn1.DERTeletexString=function(t){dt.asn1.DERTeletexString.superclass.constructor.call(this,t),this.hT="14"},gt(dt.asn1.DERTeletexString,dt.asn1.DERAbstractString),dt.asn1.DERIA5String=function(t){dt.asn1.DERIA5String.superclass.constructor.call(this,t),this.hT="16"},gt(dt.asn1.DERIA5String,dt.asn1.DERAbstractString),dt.asn1.DERUTCTime=function(t){dt.asn1.DERUTCTime.superclass.constructor.call(this,t),this.hT="17",this.setByDate=function(t){this.hTLV=null,this.isModified=!0,this.date=t,this.s=this.formatDate(this.date,"utc"),this.hV=stohex(this.s)},this.getFreshValueHex=function(){return void 0===this.date&&void 0===this.s&&(this.date=new Date,this.s=this.formatDate(this.date,"utc"),this.hV=stohex(this.s)),this.hV},void 0!==t&&(void 0!==t.str?this.setString(t.str):"string"==typeof t&&t.match(/^[0-9]{12}Z$/)?this.setString(t):void 0!==t.hex?this.setStringHex(t.hex):void 0!==t.date&&this.setByDate(t.date))},gt(dt.asn1.DERUTCTime,dt.asn1.DERAbstractTime),dt.asn1.DERGeneralizedTime=function(t){dt.asn1.DERGeneralizedTime.superclass.constructor.call(this,t),this.hT="18",this.withMillis=!1,this.setByDate=function(t){this.hTLV=null,this.isModified=!0,this.date=t,this.s=this.formatDate(this.date,"gen",this.withMillis),this.hV=stohex(this.s)},this.getFreshValueHex=function(){return void 0===this.date&&void 0===this.s&&(this.date=new Date,this.s=this.formatDate(this.date,"gen",this.withMillis),this.hV=stohex(this.s)),this.hV},void 0!==t&&(void 0!==t.str?this.setString(t.str):"string"==typeof t&&t.match(/^[0-9]{14}Z$/)?this.setString(t):void 0!==t.hex?this.setStringHex(t.hex):void 0!==t.date&&this.setByDate(t.date),!0===t.millis&&(this.withMillis=!0))},gt(dt.asn1.DERGeneralizedTime,dt.asn1.DERAbstractTime),dt.asn1.DERSequence=function(t){dt.asn1.DERSequence.superclass.constructor.call(this,t),this.hT="30",this.getFreshValueHex=function(){for(var t="",e=0;e<this.asn1Array.length;e++){t+=this.asn1Array[e].getEncodedHex()}return this.hV=t,this.hV}},gt(dt.asn1.DERSequence,dt.asn1.DERAbstractStructured),dt.asn1.DERSet=function(t){dt.asn1.DERSet.superclass.constructor.call(this,t),this.hT="31",this.sortFlag=!0,this.getFreshValueHex=function(){for(var t=new Array,e=0;e<this.asn1Array.length;e++){var r=this.asn1Array[e];t.push(r.getEncodedHex())}return 1==this.sortFlag&&t.sort(),this.hV=t.join(""),this.hV},void 0!==t&&void 0!==t.sortflag&&0==t.sortflag&&(this.sortFlag=!1)},gt(dt.asn1.DERSet,dt.asn1.DERAbstractStructured),dt.asn1.DERTaggedObject=function(t){dt.asn1.DERTaggedObject.superclass.constructor.call(this),this.hT="a0",this.hV="",this.isExplicit=!0,this.asn1Object=null,this.setASN1Object=function(t,e,r){this.hT=e,this.isExplicit=t,this.asn1Object=r,this.isExplicit?(this.hV=this.asn1Object.getEncodedHex(),this.hTLV=null,this.isModified=!0):(this.hV=null,this.hTLV=r.getEncodedHex(),this.hTLV=this.hTLV.replace(/^../,e),this.isModified=!1)},this.getFreshValueHex=function(){return this.hV},void 0!==t&&(void 0!==t.tag&&(this.hT=t.tag),void 0!==t.explicit&&(this.isExplicit=t.explicit),void 0!==t.obj&&(this.asn1Object=t.obj,this.setASN1Object(this.isExplicit,this.hT,this.asn1Object)))},gt(dt.asn1.DERTaggedObject,dt.asn1.ASN1Object);var vt,yt,mt=(vt=function(t,e){return vt=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r])},vt(t,e)},function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Class extends value "+String(e)+" is not a constructor or null");function r(){this.constructor=t}vt(t,e),t.prototype=null===e?Object.create(e):(r.prototype=e.prototype,new r)}),bt=function(t){function e(r){var i=t.call(this)||this;return r&&("string"==typeof r?i.parseKey(r):(e.hasPrivateKeyProperty(r)||e.hasPublicKeyProperty(r))&&i.parsePropertiesFrom(r)),i}return mt(e,t),e.prototype.parseKey=function(t){try{var e=0,r=0,i=/^\s*(?:[0-9A-Fa-f][0-9A-Fa-f]\s*)+$/.test(t)?g(t):d.unarmor(t),n=w.decode(i);if(3===n.sub.length&&(n=n.sub[2].sub[0]),9===n.sub.length){e=n.sub[1].getHexStringValue(),this.n=P(e,16),r=n.sub[2].getHexStringValue(),this.e=parseInt(r,16);var s=n.sub[3].getHexStringValue();this.d=P(s,16);var o=n.sub[4].getHexStringValue();this.p=P(o,16);var h=n.sub[5].getHexStringValue();this.q=P(h,16);var a=n.sub[6].getHexStringValue();this.dmp1=P(a,16);var u=n.sub[7].getHexStringValue();this.dmq1=P(u,16);var c=n.sub[8].getHexStringValue();this.coeff=P(c,16)}else{if(2!==n.sub.length)return!1;if(n.sub[0].sub){var f=n.sub[1].sub[0];e=f.sub[0].getHexStringValue(),this.n=P(e,16),r=f.sub[1].getHexStringValue(),this.e=parseInt(r,16)}else e=n.sub[0].getHexStringValue(),this.n=P(e,16),r=n.sub[1].getHexStringValue(),this.e=parseInt(r,16)}return!0}catch(t){return!1}},e.prototype.getPrivateBaseKey=function(){var t={array:[new dt.asn1.DERInteger({int:0}),new dt.asn1.DERInteger({bigint:this.n}),new dt.asn1.DERInteger({int:this.e}),new dt.asn1.DERInteger({bigint:this.d}),new dt.asn1.DERInteger({bigint:this.p}),new dt.asn1.DERInteger({bigint:this.q}),new dt.asn1.DERInteger({bigint:this.dmp1}),new dt.asn1.DERInteger({bigint:this.dmq1}),new dt.asn1.DERInteger({bigint:this.coeff})]};return new dt.asn1.DERSequence(t).getEncodedHex()},e.prototype.getPrivateBaseKeyB64=function(){return f(this.getPrivateBaseKey())},e.prototype.getPublicBaseKey=function(){var t=new dt.asn1.DERSequence({array:[new dt.asn1.DERObjectIdentifier({oid:"1.2.840.113549.1.1.1"}),new dt.asn1.DERNull]}),e=new dt.asn1.DERSequence({array:[new dt.asn1.DERInteger({bigint:this.n}),new dt.asn1.DERInteger({int:this.e})]}),r=new dt.asn1.DERBitString({hex:"00"+e.getEncodedHex()});return new dt.asn1.DERSequence({array:[t,r]}).getEncodedHex()},e.prototype.getPublicBaseKeyB64=function(){return f(this.getPublicBaseKey())},e.wordwrap=function(t,e){if(!t)return t;var r="(.{1,"+(e=e||64)+"})( +|$\n?)|(.{1,"+e+"})";return t.match(RegExp(r,"g")).join("\n")},e.prototype.getPrivateKey=function(){var t="-----BEGIN RSA PRIVATE KEY-----\n";return t+=e.wordwrap(this.getPrivateBaseKeyB64())+"\n",t+="-----END RSA PRIVATE KEY-----"},e.prototype.getPublicKey=function(){var t="-----BEGIN PUBLIC KEY-----\n";return t+=e.wordwrap(this.getPublicBaseKeyB64())+"\n",t+="-----END PUBLIC KEY-----"},e.hasPublicKeyProperty=function(t){return(t=t||{}).hasOwnProperty("n")&&t.hasOwnProperty("e")},e.hasPrivateKeyProperty=function(t){return(t=t||{}).hasOwnProperty("n")&&t.hasOwnProperty("e")&&t.hasOwnProperty("d")&&t.hasOwnProperty("p")&&t.hasOwnProperty("q")&&t.hasOwnProperty("dmp1")&&t.hasOwnProperty("dmq1")&&t.hasOwnProperty("coeff")},e.prototype.parsePropertiesFrom=function(t){this.n=t.n,this.e=t.e,t.hasOwnProperty("d")&&(this.d=t.d,this.p=t.p,this.q=t.q,this.dmp1=t.dmp1,this.dmq1=t.dmq1,this.coeff=t.coeff)},e}(lt),Tt=r(606),St=void 0!==Tt?null===(yt=Tt.env)||void 0===yt?void 0:"3.5.4":void 0,Et=function(){function t(t){void 0===t&&(t={}),this.default_key_size=t.default_key_size?parseInt(t.default_key_size,10):1024,this.default_public_exponent=t.default_public_exponent||"010001",this.log=t.log||!1,this.key=t.key||null}return t.prototype.setKey=function(t){t?(this.log&&this.key&&console.warn("A key was already set, overriding existing."),this.key=new bt(t)):!this.key&&this.log&&console.error("A key was not set.")},t.prototype.setPrivateKey=function(t){this.setKey(t)},t.prototype.setPublicKey=function(t){this.setKey(t)},t.prototype.decrypt=function(t){try{return this.getKey().decrypt(l(t))}catch(t){return!1}},t.prototype.encrypt=function(t){try{return f(this.getKey().encrypt(t))}catch(t){return!1}},t.prototype.encryptOAEP=function(t){try{return f(this.getKey().encrypt(t,ft))}catch(t){return!1}},t.prototype.sign=function(t,e,r){void 0===e&&(e=function(t){return t}),void 0===r&&(r="");try{return f(this.getKey().sign(t,e,r))}catch(t){return!1}},t.prototype.signSha256=function(t){return this.sign(t,function(t){return Q(X(t))},"sha256")},t.prototype.verify=function(t,e,r){void 0===r&&(r=function(t){return t});try{return this.getKey().verify(t,l(e),r)}catch(t){return!1}},t.prototype.verifySha256=function(t,e){return this.verify(t,e,function(t){return Q(X(t))})},t.prototype.getKey=function(t){if(!this.key){if(this.key=new bt,t&&"[object Function]"==={}.toString.call(t))return void this.key.generateAsync(this.default_key_size,this.default_public_exponent,t);this.key.generate(this.default_key_size,this.default_public_exponent)}return this.key},t.prototype.getPrivateKey=function(){return this.getKey().getPrivateKey()},t.prototype.getPrivateKeyB64=function(){return this.getKey().getPrivateBaseKeyB64()},t.prototype.getPublicKey=function(){return this.getKey().getPublicKey()},t.prototype.getPublicKeyB64=function(){return this.getKey().getPublicBaseKeyB64()},t.version=St,t}()}(),i=i.default}()});

const JSEncrypt = module.exports.default || module.exports || globalThis.JSEncrypt;
return { default: JSEncrypt, JSEncrypt };
})();

// --- dyls-api.mjs ---
__modules.m11 = (() => {
const JSEncrypt = __modules.m12.default ?? __modules.m12;
const { SiteClient, ServiceError } = __modules.m4;
const { safeImageURL } = __modules.m3;

const crypto=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const validId=value=>/^[A-Za-z0-9_-]{1,100}$/.test(String(value??''));
const abort=signal=>{if(signal?.aborted)throw new DOMException('请求取消','AbortError');};
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const array=value=>Array.isArray(value)?value:[];
const named=value=>typeof value==='string'?value:value?.name||value?.text||'';
const names=value=>array(value).map(named).filter(Boolean).map(name=>({name}));
const adult=value=>value?.is_adult===true||value?.isAdult===true||Number(value?.is_adult)===1||/(?:18\+|成人|福利|情色)/i.test(String(value?.name||value?.type_name||''));
const adultMovie=value=>adult({...value,name:String(value?.type_name||'')});
const bool=value=>value==null||value===''?undefined:typeof value==='string'?value==='1'||value.toLowerCase()==='true':!!value;
function needsDylsParsing(episode,line){
 if(String(episode?.parseUrl||'').trim())return false;
 const declared=bool(line?.need_to_parse??line?.player_need_to_parse??episode?.need_to_parse??episode?.player_need_to_parse);
 return declared===undefined?!episode?.ready_to_play:declared;
}

// The site's public client uses PKCS#1 v1.5 blocks, concatenates ciphertext,
// then Base64URL encodes the complete result. JSON escapes avoid CESU-8 for
// supplementary Unicode characters in JSEncrypt's legacy string encoder.
function encodeDylsPack(params,publicKey){
 const cipher=new JSEncrypt();cipher.setPublicKey(publicKey);
 const size=Math.ceil(cipher.getKey().n.bitLength()/8)-11;
 const json=JSON.stringify(params).replace(/[\uD800-\uDFFF]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 const encoder=new TextEncoder(),chunks=[];let current='',bytes=0;
 for(const c of json){const count=encoder.encode(c).length;if(bytes+count>size){chunks.push(current);current='';bytes=0;}current+=c;bytes+=count;}
 if(current)chunks.push(current);
 const binary=chunks.map(chunk=>{const encrypted=cipher.encrypt(chunk);if(!encrypted)throw Error('电影猎手请求编码失败');return atob(encrypted);}).join('');
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeDylsResponse(response,protocol){
 const C=crypto(),text=C.enc.Utf8.stringify(C.enc.Base64.parse(response.bodyBase64||''));let parsed;
 try{parsed=JSON.parse(text);}catch{}
 if(parsed&&typeof parsed==='object')return parsed;
 try{
  const ciphertext=C.enc.Base64.parse(String(typeof parsed==='string'?parsed:text).trim().replace(/-/g,'+').replace(/_/g,'/'));
  return JSON.parse(C.AES.decrypt({ciphertext},C.enc.Utf8.parse(protocol.aesKey),{iv:C.enc.Utf8.parse(protocol.aesIV),mode:C.mode.CBC,padding:C.pad.Pkcs7}).toString(C.enc.Utf8));
 }catch{throw Error('电影猎手返回了未知数据格式，请更新站点配置');}
}

function mediaHeaders(line){
 const result={};const put=(k,v)=>{if(typeof k==='string'&&typeof v==='string'&&/^[A-Za-z][A-Za-z0-9-]*$/.test(k)&&!/[\r\n]/.test(v)&&!['host','content-length'].includes(k.toLowerCase()))result[k]=v;};
 const raw=line?.player_headers;
 if(Array.isArray(raw))for(const item of raw){if(item&&typeof item==='object')put(item.name||item.key,item.value);}
 else if(raw&&typeof raw==='object')for(const [k,v]of Object.entries(raw))put(k,v);
 if(typeof line?.player_user_agent==='string'&&line.player_user_agent)put('User-Agent',line.player_user_agent);
 return result;
}
class DylsClient extends SiteClient {
 constructor(site,transport,storage){super(site,transport,storage);this.protocol=site.protocol||{};this.details=new Map();}
 discoveryProfile(){return {timeline:false,timelineTab:null,sectionTab:null,tabs:[{id:'0',name:'片库',mode:'catalog'},{id:'3',name:'热播',mode:'hot'}]};}
 buildRequest(_base,path,params={}){
  const payload={timestamp:Date.now(),...params},pack=encodeDylsPack(payload,this.protocol.publicKey);
  const url=new URL('/api/v1'+path,this.site.origin);url.searchParams.set('pack',pack);url.searchParams.set('signature',crypto().HmacMD5(pack,this.protocol.signKey).toString());
  return {url:url.href,method:'GET',headers:{Accept:'application/json, text/plain, */*','X-Client-Version':String(this.protocol.clientVersion||3102),'X-Client-Setting':'{"pure-mode":0}','Accept-Language':'en',Referer:this.site.origin+'/'}};
 }
 async request(request,signal,timeout=12000){
  abort(signal);const controller=new AbortController(),forward=()=>controller.abort();
  signal?.addEventListener('abort',forward,{once:true});const timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await this.transport({...request,signal:controller.signal});abort(signal);if(controller.signal.aborted)throw Error('电影猎手请求超时，请重试');return response;}
  catch(error){if(signal?.aborted)throw new DOMException('请求取消','AbortError');if(error?.name==='AbortError')throw Error('电影猎手请求超时，请重试');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);}
 }
 async api(path,params={},signal){
  abort(signal);const started=Date.now();let response;
  try{response=await this.request(this.buildRequest(this.site.origin,path,params),signal);abort(signal);}catch(error){if(error.name!=='AbortError'){const ms=Date.now()-started;this.recordHealth(this.site.origin,'cache',ms,false);this.recordHealth(this.site.origin,'logic',ms,false);}throw error;}
  let data;
  try{data=decodeDylsResponse(response,this.protocol);}catch(error){
   if(response.status>=200&&response.status<300)throw error;
   const ms=Date.now()-started;this.recordHealth(this.site.origin,'cache',ms,false);this.recordHealth(this.site.origin,'logic',ms,false);
   const message='电影猎手请求失败（HTTP '+response.status+'）';
   if([401,403].includes(response.status))throw new ServiceError(message,response.status);
   const failure=new Error(message);failure.status=response.status;throw failure;
  }
  const errorCode=Number(data?.errorCode||0);
  const ms=Date.now()-started,ok=response.status>=200&&response.status<300&&!errorCode;this.recordHealth(this.site.origin,'cache',ms,ok);this.recordHealth(this.site.origin,'logic',ms,ok);
  if(response.status<200||response.status>=300||errorCode){
   const message=data?.msg||data?.message||'电影猎手请求失败（HTTP '+response.status+'）';
   if([401,403].includes(response.status)||/登录|登陆|授权|会员|付费|权限/.test(message))throw new ServiceError(message,errorCode||response.status);
   const error=new Error(message);error.status=response.status;error.code=errorCode;throw error;
  }
  if(!data||typeof data!=='object'||!('data'in data))throw Error('电影猎手响应缺少数据字段');
  return data.data;
 }
 async bootstrap(signal){
  const raw=await this.api('/app/config',{},signal),filters=array(raw?.movie_screen?.filter),tabs=array(raw?.index_top_nav).filter(t=>Number(t.id)>0&&validId(t.id));
  if(!filters.length||!tabs.length)throw Error('电影猎手分类结构已变化');
  const adultIds=tabs.filter(adult).map(t=>Number(t.id));
  const definitions=filters.map(row=>({channelId:Number(row.id),items:[
   {query:'sort',selected:'',data:[{id:'',name:'默认'},...array(raw.movie_screen.sort).map(o=>({id:String(o.value),name:String(o.name)}))]},
   ...['class','area','year'].filter(key=>Array.isArray(row[key])&&row[key].length>1).map(key=>({query:key,selected:'',data:[{id:'',name:'全部'},...row[key].slice(1).filter(v=>typeof v==='string').map(v=>({id:v,name:v}))]}))
  ]}));
  this.sourceConfig=raw;
  this.config={vodTabs:tabs.map(t=>({type:'category',channelId:Number(t.id),text:String(t.name),isAdult:adult(t)})),adultChannelIds:adultIds,channelListQuery:definitions,groups:[],urls:{cache:[this.site.origin],logic:[this.site.origin]},supportsAccount:false};
  return this.config;
 }
 canonicalMovie(row){
  const id=row?.id??row?.movie_id,title=row?.name||row?.title;
  if(!validId(id)||!title||row?.isAd||row?.type==='ad')return null;
  const sourceChannel=Number(row.type_id),cat=this.config?.vodTabs?.find(t=>t.channelId===sourceChannel),isAdult=adultMovie(row)||cat?.isAdult===true;
  return {title:String(title),url:'vod/detail?vodId='+encodeURIComponent(String(id)),imageURL:safeImageURL(row.cover||row.image,this.site.origin),channelId:row.type_name==='电影'||cat?.text==='电影'?1:0,isAdult,bottomLabel:String(row.dynamic||row.label||''),scoreText:String(row.score||''),labels:[row.type_name?{name:String(row.type_name)}:null].filter(Boolean)};
 }
 async home(signal){
  const [,blocks]=await Promise.all([this.config?Promise.resolve(this.config):this.bootstrap(signal),this.api('/movie/index_recommend',{},signal)]);if(!Array.isArray(blocks))throw Error('电影猎手首页结构已变化');
  return {blocks:blocks.filter(b=>b.layout!=='advert_self'&&!/carousel/i.test(b.layout||'')).map(block=>{
   const items=array(block.list).map(x=>this.canonicalMovie(x)).filter(Boolean);
   // Only create a More route when the server supplies an explicit category.
   const more=block.right,tab=more?.type==='tabs'?array(this.sourceConfig?.index_top_nav)[Number(more.data?.index)]:null;
   const channelId=tab?.id??more?.type_id??block.type_id;
   let route=this.config.vodTabs.some(c=>String(c.channelId)===String(channelId))?'catalog/channel?channelId='+channelId:undefined;
   if(route&&more?.data?.param){const q=new URLSearchParams(route.split('?')[1]);for(const key of ['class','area','year','sort'])if(typeof more.data.param[key]==='string'&&more.data.param[key])q.set(key,more.data.param[key]);route='catalog/channel?'+q;}
   return {header:{title:String(block.title||'推荐影片'),...(route?{url:route}:{})},data:items};
  }).filter(b=>b.data.length)};
 }
 pagination(data,page,pageSize){
  const list=Array.isArray(data)?data:array(data?.list||data?.items),size=Number(data?.pageSize)||pageSize,total=Number(data?.total);
  const hasNext=Number.isFinite(total)?page*size<total:list.length>=size;
  return {items:list.map(row=>this.canonicalMovie(row)).filter(Boolean),next:hasNext?'page='+(page+1):''};
 }
 async channel(channelId,filters={},next='page=1',signal){
  if(!this.config)await this.bootstrap(signal);if(!this.config.vodTabs.some(c=>String(c.channelId)===String(channelId)))throw Error('电影猎手未提供此分类');
  const page=Math.max(1,Number(new URLSearchParams(next||'page=1').get('page'))||1),params={type_id:Number(channelId),page,pageSize:24};
  const definitions=this.config.channelListQuery.find(c=>String(c.channelId)===String(channelId))?.items||[];
  for(const definition of definitions){const value=String(filters[definition.query]??''),option=definition.data.find(d=>String(d.id).toLowerCase()===value.toLowerCase());if(value&&option)params[definition.query]=option.id;}
  return this.pagination(await this.api('/movie/screen/list',params,signal),page,24);
 }
 async search(keyword,next='page=1',signal){
  if(!this.config)await this.bootstrap(signal);const page=Math.max(1,Number(new URLSearchParams(next||'page=1').get('page'))||1);
  return this.pagination(await this.api('/movie/search',{keyword:String(keyword),page,res_type:'by_movie_name'},signal),page,20);
 }
 collection(route,next='page=1',signal){if(route?.kind==='channel'){const q=new URLSearchParams(String(route.url||'').split('?')[1]||''),filters={...route.filters};for(const key of ['class','area','year','sort'])if(q.has(key))filters[key]=q.get(key);return this.channel(route.id,filters,next,signal);}throw Error('电影猎手没有提供此栏目接口');}
 normalizeEpisode(row){return {id:row.episode_id,title:String(row.episode_name||''),open:false,sourceEpisode:row};}
 async detail(id,signal){
  if(!validId(id))throw Error('无效影片编号');if(!this.config)await this.bootstrap(signal);
  const raw=await this.api('/movie/detail',{id:String(id)},signal);if(!raw||!validId(raw.id))throw Error('影片详情结构已变化');
  const cat=this.config.vodTabs.find(t=>Number(t.channelId)===Number(raw.type_id));
  const result={id:String(raw.id),title:String(raw.name||'影片'),imageURL:safeImageURL(raw.cover,this.site.origin),channelId:cat?.text==='电影'?1:0,sourceChannelId:raw.type_id,isAdult:adultMovie(raw)||cat?.isAdult===true,channelName:raw.type_name||cat?.text||'',year:raw.year,area:raw.area?[{name:raw.area}]:[],language:[],summary:String(raw.content||''),scoreText:raw.score?String(raw.score)+'分':'',bottomLabel:String(raw.dynamic||''),labels:names(raw.tags),actors:names(array(raw.members).filter(x=>Number(x.type)===1)),directors:names(array(raw.members).filter(x=>Number(x.type)===3)),playSources:array(raw.play_from).map(line=>({siteId:String(line.code),name:String(line.name||line.code),total:Number(line.total)||array(line.list).length,list:array(line.list).map(ep=>this.normalizeEpisode(ep)),sourceLine:line}))};
  this.details.set(String(id),result);while(this.details.size>12)this.details.delete(this.details.keys().next().value);return result;
 }
 async episodes(id,line,signal){
  const rows=await this.api('/movie_addr/list',{from_code:String(line.siteId),movie_id:String(id)},signal);
  if(!Array.isArray(rows))throw Error('电影猎手选集结构已变化');
  const list=rows.map(ep=>this.normalizeEpisode(ep));line.list=list;return list;
 }
 async play({vodId,siteId,episodeId},signal){
  const d=this.details.get(String(vodId))||await this.detail(vodId,signal),line=d.playSources.find(l=>String(l.siteId)===String(siteId));if(!line)throw Error('播放线路不存在');
  const list=await this.episodes(vodId,line,signal),episode=list.find(e=>String(e.id)===String(episodeId));if(!episode)throw Error('该线路没有对应选集');
  const raw=episode.sourceEpisode,source=line.sourceLine||{};let url=raw.parseUrl||raw.play_url;
  if(needsDylsParsing(raw,source)){
   const parsed=await this.api('/movie_addr/parse_url',{type:'play',episode_id:raw.episode_id,from_code:raw.from_code||String(siteId),play_url:raw.play_url,refresh:1},signal);url=parsed?.play_url||parsed?.data?.play_url;
  }
  const safe=https(url);if(!safe)throw Error('这条线路未返回可用的 HTTPS 播放地址');
  const headers=mediaHeaders(source);if(!Object.keys(headers).some(k=>k.toLowerCase()==='user-agent'))headers['User-Agent']='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
  return [{url:safe,name:line.name,headers,referrerPolicy:Object.keys(headers).some(k=>k.toLowerCase()==='referer')?'source':'no-referrer'}];
 }
 async anonymous(){throw new ServiceError('电影猎手当前以公开访客接口访问，需要账号的资源请使用原站服务',403);}
 async login(){throw new ServiceError('电影猎手当前未接入账号登录，请使用原站服务',403);}
 async logout(){this.user=null;this.sessionKind='none';}
}

return { needsDylsParsing, encodeDylsPack, decodeDylsResponse, DylsClient };
})();

// --- souju-api.mjs ---
__modules.m13 = (() => {
const { SiteClient, ServiceError } = __modules.m4;
const { safeHTTPS, safeImageURL } = __modules.m3;

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
class SoujuClient extends SiteClient {
 constructor(site,transport,storage=globalThis.localStorage){
  super(site,transport,storage);this.protocol=site.protocol||{};this.details=new Map();this.registry=new Map();this.collections=new Map();this.filterOptions=new Map();this.resolves=new Map();this.cooldownUntil=0;this.session=null;this.sessionLoad=null;this.guestPending=null;
  try{for(const [key,value]of JSON.parse(storage.getItem(this.key+'ids')||'[]'))if(/^sj_[a-f0-9]{32}$/.test(key)&&safeID(value))this.registry.set(key,value);}catch{}
 }
 discoveryProfile(){return {timeline:false,timelineTab:null,sectionTab:'2',tabs:[{id:'0',name:'最新更新',mode:'latest'},{id:'1',name:'今日热播',mode:'trending'},{id:'2',name:'首页推荐',mode:'home'}]};}
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
  const started=Date.now();let response;try{response=await this.network({url:this.site.origin+path,method,headers,...body===undefined?{}:{body:JSON.stringify(body)}},signal);}catch(err){if(err.name!=='AbortError'){const ms=Date.now()-started;this.recordHealth(this.site.origin,'cache',ms,false);this.recordHealth(this.site.origin,'logic',ms,false);}throw err;}const data=decode(response);const elapsed=Date.now()-started,ok=response.status>=200&&response.status<300&&!data?.error;this.recordHealth(this.site.origin,'cache',elapsed,ok);this.recordHealth(this.site.origin,'logic',elapsed,ok);
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
  for(const movie of cards){if(!safeID(movie?.id)||!movie.title||movie.content_kind==='adult')continue;const kind=KINDS.find(k=>k[0]===movie.content_kind),id=this.id(movie.id);out.push({title:String(movie.title),url:'vod/detail?vodId='+id,imageURL:safeImageURL(movie.poster_url,this.site.origin),channelId:kind?.[1]||0,isAdult:false,bottomLabel:String(movie.remarks||movie.availability?.label||''),topLeftLabel:movie.availability?.disabled?'暂未上线':'',labels:names(movie.genres).map(name=>({name}))});}
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
  const out={id:encoded,title:String(data.title||''),imageURL:safeImageURL(data.poster_url,this.site.origin),year:data.year,area:data.area?[{name:String(data.area)}]:[],language:data.language?[{name:String(data.language)}]:[],channelId:kind?.[1]||0,channelName:kind?.[2]||'影片',isAdult:false,summary:String(data.description||''),actors:names(data.actors),directors:names(data.directors),labels:names(data.genres),bottomLabel:String(data.remarks||''),playSources,seasons};
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

return { SoujuClient };
})();

// --- kanju-api.mjs ---
__modules.m14 = (() => {
const { SiteClient, ServiceError } = __modules.m4;
const { safeHTTPS, safeImageURL } = __modules.m3;

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
class KanjuClient extends SiteClient {
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
    const ms=Date.now()-started;this.preferredOrigin=origin;this.preferred.cache=origin;this.preferred.logic=origin;this.badOrigins.delete(origin);this.recordHealth(origin,'cache',ms,true);this.recordHealth(origin,'logic',ms,true);return data;
   }catch(error){
    abortIf(signal);if(error instanceof ServiceError)throw error;last=error;const ms=Date.now()-started;this.badOrigins.set(origin,Date.now()+60000);this.recordHealth(origin,'cache',ms,false);this.recordHealth(origin,'logic',ms,false);
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
   out.push({title:String(item.title),url:'vod/detail?vodId='+id,imageURL:safeImageURL(item.poster_url,this.site.origin),channelId:kind?.[1]||0,isAdult:item.content_kind==='adult'||kind?.[0]==='adult',bottomLabel:String(item.remarks||item.episode_progress_text||availability.label||''),topLeftLabel:availability.disabled?'暂未上线':'',labels:names(item.genres).map(name=>({name}))});
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
  const out={id:encoded,title:String(data.title||''),imageURL:safeImageURL(data.poster_url,this.site.origin),year:data.year,area:data.area?[{name:String(data.area)}]:[],language:data.language?[{name:String(data.language)}]:[],channelId:kind?.[1]||0,channelName:kind?.[2]||'影片',isAdult:data.content_kind==='adult'||kind?.[0]==='adult',summary:String(data.description||data.overview||''),actors:names(data.actors),directors:names(data.directors),labels:names(data.genres),bottomLabel:String(data.remarks||data.episode_progress_text||''),playSources,seasons};
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

return { KanjuClient };
})();

// --- source-contract.mjs ---
__modules.m15 = (() => {
const SOURCE_ADAPTER_PROVIDERS = Object.freeze(['yqk', 'dyls', 'souju', 'kanju']);
const SOURCE_DISCOVERY_MODES = Object.freeze([
  'timeline', 'netflix', 'topics', 'ranking', 'catalog', 'hot', 'latest', 'trending', 'home'
]);
const SOURCE_CLIENT_METHODS = Object.freeze([
  'bootstrap', 'home', 'channel', 'collection', 'search', 'detail',
  'episodes', 'play', 'anonymous', 'login', 'logout', 'discoveryProfile'
]);

const PROVIDER_FIELDS = {
  yqk: ['protocol.appId', 'protocol.appKey', 'protocol.version', 'protocol.apiOrigins'],
  dyls: ['protocol.publicKey', 'protocol.signKey', 'protocol.aesKey', 'protocol.aesIV', 'protocol.clientVersion'],
  souju: ['protocol.signingKey'],
  kanju: ['protocol.signingKey', 'protocol.clientName', 'protocol.clientVersion', 'protocol.buildVersion', 'protocol.protocolVersion', 'protocol.apiOrigins']
};
const BASE_FIELDS = ['appId', 'signKey', 'initKey', 'initIV', 'responseKeys'];

function field(value, path) {
  return path.split('.').reduce((node, key) => node && node[key], value);
}

function validOrigin(value, allowHTTP = false) {
  try {
    const url = new URL(value);
    return Boolean(
      (url.protocol === 'https:' || (allowHTTP && url.protocol === 'http:')) &&
      !url.username && !url.password && url.hostname &&
      url.pathname === '/' && !url.search && !url.hash
    );
  } catch {
    return false;
  }
}
function validateSiteManifest(sites) {
  const errors = [];
  const seen = new Set();
  if (!Array.isArray(sites) || !sites.length) throw Error('站点清单必须是非空数组');

  for (const [index, site] of sites.entries()) {
    const label = `sites[${index}]`;
    if (!site || typeof site !== 'object' || Array.isArray(site)) {
      errors.push(`${label} 必须是对象`);
      continue;
    }

    if (typeof site.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,31}$/.test(site.id)) {
      errors.push(`${label}.id 格式无效`);
    } else if (seen.has(site.id)) {
      errors.push(`${label}.id 重复`);
    } else {
      seen.add(site.id);
    }

    if (typeof site.name !== 'string' || !site.name.trim() || site.name.length > 40) {
      errors.push(`${label}.name 缺失或过长`);
    }
    if (typeof site.version !== 'string' || !site.version.trim()) {
      errors.push(`${label}.version 缺失`);
    }

    const allowHTTP = site.allowInsecureOrigin === true;
    if (!validOrigin(site.origin, allowHTTP)) {
      errors.push(`${label}.origin 必须是无路径的 HTTPS 源站地址；HTTP 源站需显式设置 allowInsecureOrigin`);
    }
    if (site.provider && !SOURCE_ADAPTER_PROVIDERS.includes(site.provider)) {
      errors.push(`${label}.provider 未注册：${String(site.provider)}`);
    }
    if (site.sourceSha256 && !/^[a-f0-9]{64}$/.test(site.sourceSha256)) {
      errors.push(`${label}.sourceSha256 必须是 SHA-256`);
    }

    const fields = site.provider ? (PROVIDER_FIELDS[site.provider] || []) : BASE_FIELDS;
    for (const path of fields) {
      const value = field(site, path);
      const valid = path.endsWith('Origins')
        ? Array.isArray(value) && value.length > 0
        : value !== undefined && value !== null && value !== '';
      if (!valid) errors.push(`${label}.${path} 缺失或无效`);
    }

    const apiOrigins = site.protocol?.apiOrigins;
    if (apiOrigins !== undefined && (
      !Array.isArray(apiOrigins) ||
      apiOrigins.length > 32 ||
      new Set(apiOrigins).size !== apiOrigins.length ||
      apiOrigins.some(origin => !validOrigin(origin, allowHTTP))
    )) {
      errors.push(`${label}.protocol.apiOrigins 必须是最多 32 个不重复的无路径源站地址；HTTP 需显式设置 allowInsecureOrigin`);
    }

    if (!site.provider && (!Array.isArray(site.responseKeys) || !site.responseKeys.length)) {
      errors.push(`${label}.responseKeys 必须包含解码配置`);
    }
    if (!site.provider && Array.isArray(site.responseKeys)) {
      const indexes = site.responseKeys.map(key => Number(key?.index));
      if (site.responseKeys.some(key => !Number.isSafeInteger(Number(key?.index)) || !key?.key || !key?.iv)) {
        errors.push(`${label}.responseKeys 条目必须包含有效 index、key 和 iv`);
      }
      if (new Set(indexes).size !== indexes.length) errors.push(`${label}.responseKeys index 不能重复`);
    }
  }

  if (errors.length) throw Error(`站点清单校验失败：\n${errors.join('\n')}`);
  return sites;
}
function assertSourceClientContract(site, client) {
  if (!site || typeof site.id !== 'string' || !client || client.site?.id !== site.id) {
    throw TypeError('片源适配器必须绑定对应的站点描述');
  }

  const missing = SOURCE_CLIENT_METHODS.filter(method => typeof client[method] !== 'function');
  if (missing.length) throw TypeError(`片源适配器缺少统一接口：${missing.join(', ')}`);

  const profile = client.discoveryProfile();
  if (!profile || typeof profile.timeline !== 'boolean' || !Array.isArray(profile.tabs) || !profile.tabs.length) {
    throw TypeError('片源发现页配置不符合统一契约');
  }
  if (profile.timeline && profile.timelineTab == null) {
    throw TypeError('开启时间轴的来源必须指定 timelineTab');
  }

  const ids = new Set();
  for (const tab of profile.tabs) {
    const tabId = tab?.id == null ? '' : String(tab.id);
    const numericTabId = Number(tabId);
    if (!tab || !tabId.trim() || !Number.isSafeInteger(numericTabId) || tabId !== String(numericTabId) ||
        typeof tab.name !== 'string' || !tab.name.trim() ||
        typeof tab.mode !== 'string' || !SOURCE_DISCOVERY_MODES.includes(tab.mode)) {
      throw TypeError('发现页栏目必须提供数值 id、name 和 mode');
    }
    const id = String(tab.id);
    if (ids.has(id)) throw TypeError('发现页栏目 id 不能重复');
    ids.add(id);
    if (tab.mode === 'timeline' && (!profile.timeline || id !== String(profile.timelineTab))) {
      throw TypeError('timeline 模式必须对应来源声明的 timelineTab');
    }
    if (tab.mode === 'home' && id !== String(profile.sectionTab)) {
      throw TypeError('home 模式必须对应来源声明的 sectionTab');
    }
  }

  if (profile.timeline && !ids.has(String(profile.timelineTab))) {
    throw TypeError('发现页 timelineTab 必须引用已声明的栏目');
  }
  if (profile.sectionTab != null && !ids.has(String(profile.sectionTab))) {
    throw TypeError('发现页 sectionTab 必须引用已声明的栏目');
  }
  return client;
}

return { validateSiteManifest, assertSourceClientContract, SOURCE_ADAPTER_PROVIDERS, SOURCE_DISCOVERY_MODES, SOURCE_CLIENT_METHODS };
})();

// --- source-clients.mjs ---
__modules.m9 = (() => {
const { SiteClient } = __modules.m4;
const { YqkClient } = __modules.m10;
const { DylsClient } = __modules.m11;
const { SoujuClient } = __modules.m13;
const { KanjuClient } = __modules.m14;
const { assertSourceClientContract } = __modules.m15;

// Each client owns its device identity, configuration and source-local caches.
const sourceAdapterRegistry=Object.freeze({yqk:YqkClient,dyls:DylsClient,souju:SoujuClient,kanju:KanjuClient});
function createSourceClient(site,transport,storage=globalThis.localStorage){
 if(!site||typeof site.id!=='string'||typeof transport!=='function')throw TypeError('创建片源客户端需要有效站点和网络传输器');
 const Client=site.provider&&Object.prototype.hasOwnProperty.call(sourceAdapterRegistry,site.provider)?sourceAdapterRegistry[site.provider]:site.provider?undefined:SiteClient;
 if(!Client)throw TypeError('未注册的片源适配器：'+String(site.provider));
 return assertSourceClientContract(site,new Client(site,transport,storage));
}

return { createSourceClient, sourceAdapterRegistry };
})();

// --- app.mjs ---
__modules.m0 = (() => {
const { resolvePlayableEpisode, resolveFirstCandidate, verifyMedia, matchingEpisode, mediaHeaders } = __modules.m1;
const { recordLineOutcome, shouldAutoSkipOutro, computeResumeStartAt, orderLinesByHealth } = __modules.m2;
const { loadVisibleImages } = __modules.m5;
const { decodePlaylist, parseM3UIncremental, parseXMLTV, channelAlternates, indexChannelAlternates, nextUntriedRouteIndex, normalizePlaylistURL } = __modules.m6;
const sites = __modules.m7.default ?? __modules.m7;
const { NativeTransport: native } = __modules.m8;
const { createSourceClient } = __modules.m9;
const { escapeHTML: e, collectMovies, homeSections, categories, imageURLsForSource, sourceKey, sectionRoute, sectionItems, collectionGroups } = __modules.m3;
const $=selector=>document.querySelector(selector),root=$('#app'),pageRoot=$('#app-page'),navRoot=$('#bottomnav');
const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',browse:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z',saved:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z',settings:'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',discover:'M6 3h12v18l-6-4-6 4z',live:'M4 8a11 11 0 0 1 16 0 M7 11a7 7 0 0 1 10 0 M10 14a3 3 0 0 1 4 0 M12 18h.01',games:'M6 8h12a4 4 0 0 1 3.8 5l-1.4 4.2a2 2 0 0 1-3.2 1l-3.2-2.4h-4l-3.2 2.4a2 2 0 0 1-3.2-1L2.2 13A4 4 0 0 1 6 8z M7 11v4 M5 13h4 M16 12h.01 M18 14h.01',search:'m21 21-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',back:'m15 5-7 7 7 7',refresh:'M20 7v5h-5 M19 11a8 8 0 1 0 0 5',play:'m9 5 11 7-11 7z',star:'m12 3 3 6 6 .9-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 9.9 9 9z'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.play}"/></svg>`;
const read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem('sanyuan:'+key))??fallback;}catch{return fallback;}};
const validSavedRows=key=>{const raw=read(key,[]);return Array.isArray(raw)?raw.filter(row=>row&&typeof row==='object'&&row.movie&&typeof row.movie==='object'&&row.movie.id!=null):[];};
const write=(key,value)=>localStorage.setItem('sanyuan:'+key,JSON.stringify(value));
const formatDuration=sec=>{const s=Math.max(0,Math.floor(Number(sec)||0)),m=Math.floor(s/60),r=s%60;return m>=60?`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}:${String(r).padStart(2,'0')}`:`${m}:${String(r).padStart(2,'0')}`;};
const savedColumns=localStorage.getItem('sanyuan:columns')||'3';
const savedTheme=localStorage.getItem('sanyuan:theme')==='black'?'black':'white';
const storedSite=localStorage.getItem('sanyuan:site'),initialSite=sites.find(item=>item.id===storedSite)?.id||'kkapp';
const state={theme:savedTheme,cleanHLS:read('cleanHLS',true)!==false,autoNext:read('autoNext',true)!==false,skipIntroSeconds:[60,90,120].includes(Number(read('skipIntroSeconds',90)))?Number(read('skipIntroSeconds',90)):90,skipOutroSeconds:[0,60,90,120].includes(Number(read('skipOutroSeconds',0)))?Number(read('skipOutroSeconds',0)):0,playerMirrored:false,playerMuted:false,sleepTimerMode:'off',sleepTimerEndAt:0,nextEpisodeReady:false,playQualityLabel:'',playBandwidth:0,savedSourceFilter:'all',savedSort:'recent',settingsSection:'all',siteHealth:(h=>h&&typeof h==='object'&&!Array.isArray(h)?h:{})(read('siteHealth',{})),lineHealth:(h=>h&&typeof h==='object'&&!Array.isArray(h)?h:{})(read('lineHealth',{})),siteProbing:false,aspectMode:['fit','fill','stretch'].includes(localStorage.getItem('sanyuan:aspectMode'))?localStorage.getItem('sanyuan:aspectMode'):'fit',episodeDesc:false,locatedEpisodeIndex:-1,removedAdSegments:0,removedAdSeconds:0,playLatencyMs:0,searchHistory:Array.isArray(read('searchHistory',[]))?read('searchHistory',[]).slice(0,8):[],heroIndex:0,homeScroll:0,collection:null,collectionStack:[],collectionGroups:[],detailReturn:null,site:initialSite,page:'home',query:'',channel:1,filters:{},next:'page=1',items:[],sections:[],loading:false,error:'',savedTab:'favorites',detail:null,line:0,episode:null,episodePage:0,playURLs:[],playIndex:0,playError:'',playStatus:'',playLoading:false,playLoadingText:'',playTime:0,playDuration:0,summaryExpanded:false,playRecovery:null,pendingEpisodeIndex:0,epoch:0,authError:'',adultEnabled:localStorage.getItem('sanyuan:adult')==='true',showAgeGate:false,columns:['3','4','5','6'].includes(savedColumns)?savedColumns:'3',playbackRate:[0.5,0.75,1,1.25,1.5,2].includes(Number(read('playbackRate',1)))?Number(read('playbackRate',1)):1,diagnostics:read('diagnostics',[]),diagEngine:'AVPlayer',imageMap:new Map()};
Object.assign(state,{discoverTab:0,discoverYear:new Date().getFullYear(),discoverMonth:new Date().getMonth()+1,discoverGroups:[],discoverSections:[],discoverItems:[],discoverNext:'',meTab:'favorites'});
Object.assign(state,{liveLastPlaybackTime:null,livePlaybackProgressAt:0,liveVideoReady:false,liveVideoFormat:null});
Object.assign(state,{liveURL:localStorage.getItem('sanyuan:livePlaylistURL')||'https://fnipv.69574517.xyz/shiju19880215/interface.m3u',liveChannels:[],liveGroups:[],liveAlternateIndex:new Map(),liveEPGUrl:'',liveLoadedURL:'',livePanel:'channels',liveCategory:'',liveSearch:'',liveVisibleCount:80,liveNativeVisibleCount:40,liveCurrentIndex:-1,liveVariantIndex:0,liveRendererRetry:0,liveImportOpen:true,liveLoading:false,liveError:'',liveStatus:'',liveActive:false,liveResume:false,liveEPGLoading:false,liveEPGText:'',livePrograms:[],liveProgramDate:'',liveSelectedProgram:null,liveSelectedRoute:null,liveSheet:'',liveReturn:null,liveFavorites:read('liveFavorites',[]),liveImportController:null,liveGuideController:null,liveEPGCache:new Map(),liveTriedURLs:new Set(),liveCacheFound:false,liveInitialAttempted:false});
const clients=new Map(sites.map(site=>[site.id,createSourceClient(site,options=>native.request(options))]));
if(!clients.has(state.site))state.site=sites[0].id;
const client=()=>clients.get(state.site),site=()=>sites.find(s=>s.id===state.site);
const shelfOffsets=new Map(),liveScrollOffsets=new Map(),viewCache=new Map(),discoveryCache=new Map(),pageDOMCache=new Map(),pageScrollCache=new Map(),episodePrefetchCache=new Map();
const pageCursor=value=>value==null||value===0||value==='0'?'':String(value);
let controller,prefetchController=null,prefetchTimer=null,toastTimeout,hudTimeout,playbackSession=null,stopImages,nativeSession=null,activeRenderKey=null,activeRenderReady=false,scrollFramePending=false,nativeClearConfirm=false,heroTouchStartX=null,lastHeroInteractionAt=0;
function toast(text){clearTimeout(toastTimeout);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function showPlayerHUD(text){const hud=$('#player-hud');if(!hud)return;clearTimeout(hudTimeout);hud.textContent=text;hud.hidden=false;hud.classList.add('show');hudTimeout=setTimeout(()=>{hud.classList.remove('show');hud.hidden=true;},1400);}
function rememberSearch(keyword){const q=String(keyword||'').trim();if(!q)return;state.searchHistory=[q,...state.searchHistory.filter(x=>x!==q)].slice(0,8);write('searchHistory',state.searchHistory);}
function posterURLsFor(movie,source=state.site){return imageURLsForSource(movie,source,clients.get(source)?.config||{});}
function picture(movie,hero=false,source=state.site){const urls=posterURLsFor(movie,source),key=source+':'+movie.id,origin=sites.find(item=>item.id===source)?.origin||'';state.imageMap.set(key,{urls,referer:origin?new URL(origin).origin+'/':''});return urls.length?`<img ${hero?'':'loading="lazy"'} data-image="${e(key)}" data-attempt="0" alt="${e(movie.title)}">`:'';}
function liveLogo(channel){if(!channel?.logo)return '';const key=`live:${channel.index}`;state.imageMap.set(key,[channel.logo]);return `<img data-image="${key}" alt="" loading="lazy">`;}
function card(movie,source=state.site,subtitle,removableKey=''){return `<button class="card" data-act="${movie.route?'collection-link':'detail'}" data-route="${e(movie.route?.url||'')}" data-title="${e(movie.title)}" data-id="${e(movie.id)}" data-source="${e(source)}"><div class="poster"><span>${e(movie.title.slice(0,1))}</span>${picture(movie,false,source)}${movie.badge?`<div class="postbadge">${e(movie.badge)}</div>`:''}${removableKey?`<span class="card-remove" data-act="remove-saved-item" data-key="${e(removableKey)}" role="button" aria-label="移除 ${e(movie.title)}">×</span>`:''}<div class="postsub">${e(subtitle||movie.subtitle)}</div></div><strong>${e(movie.title)}</strong><small>${e(movie.labels?.slice(0,2).join(' · ')||sites.find(x=>x.id===source)?.name||'')}</small></button>`;}
function grid(items){return `<div class="grid">${items.map(movie=>card(movie)).join('')}</div>`;}
function loading(){return `<div class="grid" aria-label="加载中">${Array.from({length:9},()=>'<div><div class="skeleton poster"></div><p class="caption">正在加载…</p></div>').join('')}</div>`;}
function notice(title,text,action='refresh',label='重新加载'){return `<div class="notice"><h3>${e(title)}</h3><div>${e(text)}</div>${action?`<button class="secondary" data-act="${action}">${e(label)}</button>`:''}</div>`;}
function header(){return `<header class="top"><div class="topline"><div class="logo"><span class="brandmark">▶</span><div><span>三源影视</span><small class="logo-sub">${e(site().name)} · 沉浸影院</small></div></div><div class="top-actions"><button class="iconbutton" data-act="theme" data-id="${state.theme==='black'?'white':'black'}" aria-label="切换主题" title="切换深浅色主题">◐</button><button class="iconbutton" data-act="refresh" aria-label="刷新">${icon('refresh')}</button></div></div><div class="sources" aria-label="影视来源">${sites.map(s=>`<button class="${state.site===s.id?'active':''}" data-act="source" data-id="${s.id}">${e(s.name)}</button>`).join('')}</div>${['me','saved','settings'].includes(state.page)?'':`<form class="searchform" id="search-form"><label class="searchinput">${icon('search')}<input id="search-query" value="${e(state.query)}" placeholder="搜索影片、演员、导演" autocomplete="off" enterkeyhint="search" aria-label="搜索影片"><button type="button" class="search-clear" data-act="search-clear" ${state.query?'':'hidden'} aria-label="清空搜索词">×</button></label><button class="primary" type="submit">搜索</button></form>`}${['home','browse','search'].includes(state.page)&&state.searchHistory.length?`<div class="search-history" aria-label="搜索历史"><span class="subtle">最近搜索</span><div class="search-history-chips">${state.searchHistory.map(q=>`<button type="button" class="chip search-chip" data-act="search-chip" data-query="${e(q)}">${e(q)}</button>`).join('')}</div><button type="button" class="textbutton search-history-clear" data-act="search-history-clear">清空</button></div>`:''}</header>`;}
function nav(){return [['home','首页'],['discover','发现'],['browse','看啥片'],['live','直播'],['me','我的']].map(([id,label])=>`<button data-act="page" data-id="${id}" class="nav-item" aria-label="${label}"><span class="nav-icon">${icon(id)}</span><span class="nav-label">${label}</span></button>`).join('');}
function syncNav(){if(!navRoot.children.length)navRoot.innerHTML=nav();if(!$('#back-to-top'))root.insertAdjacentHTML('beforeend','<button id="back-to-top" type="button" class="back-to-top" data-act="scroll-top" hidden aria-label="回到顶部" title="回到顶部">↑ 顶部</button>');const topBtn=$('#back-to-top');if(topBtn)topBtn.hidden=window.scrollY<=360;navRoot.hidden=['detail','collection'].includes(state.page);for(const button of navRoot.children){const active=button.dataset.id===state.page||button.dataset.id==='me'&&['me','saved','settings'].includes(state.page);button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');}}
function viewKey(page=state.page){const filters=Object.keys(state.filters).sort().map(key=>`${key}=${state.filters[key]}`).join('&');return `${state.site}:${page}:${page==='browse'?state.channel+':'+filters:''}${page==='search'?':'+state.query:''}`;}
function pageRenderKey(){const adult=state.adultEnabled?'adult':'all';if(state.page==='home')return `${state.site}:home:${adult}`;if(state.page==='browse'||state.page==='search')return `${viewKey()}:${adult}`;if(state.page==='discover')return `${state.site}:discover:${state.discoverTab}:${state.discoverYear}:${state.discoverMonth}:${adult}`;if(state.page==='collection')return `${state.site}:collection:${state.collection?.kind||''}:${state.collection?.url||state.collection?.id||'root'}:${adult}`;return null;}
function invalidateHomeDOMCache(){for(const k of pageDOMCache.keys())if(k.includes(':home:'))pageDOMCache.delete(k);}
function cacheView(){if(state.loading||state.error||!['home','browse'].includes(state.page))return;viewCache.set(viewKey(),{items:state.items.slice(),sections:state.sections.slice(),next:state.next,error:state.error});}
function restoreView(page=state.page){const cached=viewCache.get(viewKey(page));if(!cached)return false;state.items=cached.items.slice();state.sections=cached.sections.slice();state.next=cached.next;state.error=cached.error;state.loading=false;return true;}
function detailPageSnapshot(){return {page:state.page,site:state.site,scrollY:window.scrollY,channel:state.channel,filters:{...state.filters},query:state.query,items:state.items.slice(),sections:state.sections.slice(),next:state.next,collection:state.collection,collectionGroups:state.collectionGroups.slice(),collectionStack:state.collectionStack.slice(),discoverTab:state.discoverTab,discoverYear:state.discoverYear,discoverMonth:state.discoverMonth,discoverGroups:state.discoverGroups.slice(),discoverSections:state.discoverSections.slice(),discoverItems:state.discoverItems.slice(),discoverNext:state.discoverNext};}
function restoreDetailPage(snapshot){Object.assign(state,snapshot,{detailReturn:null,detail:null,episode:null,playURLs:[],playError:'',loading:false,error:''});localStorage.setItem('sanyuan:site',state.site);render();requestAnimationFrame(()=>window.scrollTo({top:snapshot.scrollY||0,behavior:'instant'}));}
function quickCategories(){return `<div class="quickcats">${categories(client().config,{includeAdult:state.adultEnabled}).map(c=>`<button class="chip ${c.isAdult?'adultchip':''} ${state.page==='browse'&&state.channel===c.id?'active':''}" data-act="category" data-id="${c.id}">${e(c.name)}</button>`).join('')}</div>`;}
const filterName=query=>({sort:'排序',category:'类型',childChannelId:'类型',class:'类型',area:'地区',year:'年份',language:'语言'}[query]||query);
function filterDefinitions(){return client().config?.channelListQuery?.find(x=>Number(x.channelId)===state.channel)?.items||[];}
function filterDefault(filter){return String(filter.selected??(filter.query==='sort'?'3':''));}
function rememberFilters(){write('filters:'+state.site+':'+state.channel,state.filters);}
function restoreFilters(){const saved=read('filters:'+state.site+':'+state.channel,{});state.filters=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}
function homePicks(){return [...new Map(state.sections.flatMap(section=>section.items).filter(movie=>!movie.route).map(movie=>[movie.id,movie])).values()].slice(0,5);}
function updateHeroCarouselDOM(){
 const picks=homePicks();if(picks.length<2)return false;
 const idx=state.heroIndex%picks.length,first=picks[idx];if(!first)return false;
 if(native.native()){native.syncPage(nativePageSnapshot());return true;}
 const heroNode=pageRoot.querySelector('.hero');if(!heroNode)return false;
 const key=state.site+':'+first.id,urls=posterURLsFor(first,state.site),origin=site()?.origin||'';
 state.imageMap.set(key,{urls,referer:origin?new URL(origin).origin+'/':''});
 const h1=heroNode.querySelector('.herocopy h1'),p=heroNode.querySelector('.herocopy p'),playBtn=heroNode.querySelector('[data-act="detail"]'),favBtn=heroNode.querySelector('[data-act="favorite"]'),badgeNode=heroNode.querySelector('.hero-score');
 if(h1)h1.textContent=first.title;
 if(p)p.textContent=first.labels?.join(' / ')||first.subtitle||'精选推荐';
 if(playBtn)playBtn.dataset.id=first.id;
 if(favBtn){favBtn.dataset.id=first.id;const isFav=validSavedRows('favorites').some(x=>x.siteId===state.site&&String(x.movie.id)===String(first.id));favBtn.textContent=isFav?'✓ 已在片单':'＋ 片单';favBtn.classList.toggle('active',isFav);}
 if(badgeNode){badgeNode.textContent=first.badge||'';badgeNode.hidden=!first.badge;}
 const img=heroNode.querySelector('img[data-image]');
 if(img&&urls.length){img.removeAttribute('src');img.dataset.image=key;img.alt=first.title;observeAppendedImages(heroNode);}
 for(const [i,btn] of [...pageRoot.querySelectorAll('.hero-switch button[data-act="hero-pick"]')].entries()){
  const active=i===idx;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
 }
 return true;
}
function home(){
 if(state.loading&&!state.sections.length)return loading();if(state.error&&!state.sections.length)return notice('暂时未能连接',state.error);
 const picks=homePicks();
 const first=picks[state.heroIndex%Math.max(picks.length,1)];if(!first)return notice('暂无影片','可以切换来源，或稍后刷新。');
 const favs=validSavedRows('favorites'),isFirstFav=favs.some(x=>x.siteId===state.site&&String(x.movie.id)===String(first.id));
 const recent=validSavedRows('history').filter(row=>row.siteId===state.site&&(state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5))).sort((a,b)=>b.updated-a.updated).slice(0,6);
 return `<section class="hero">${picture(first,true)}<div class="herocopy"><div class="hero-badges"><span class="tag">✦ 今日精选 · ${e(site().name)}</span>${first.badge?`<span class="tag hero-score">${e(first.badge)}</span>`:`<span class="tag hero-score" hidden></span>`}</div><h1>${e(first.title)}</h1><p>${e(first.labels?.join(' / ')||first.subtitle||'高清院线与热播剧集实时同步')}</p><div class="herobuttons"><button class="primary" data-act="detail" data-id="${first.id}">${icon('play')}查看选集</button><button class="secondary ${isFirstFav?'active':''}" data-act="favorite" data-id="${first.id}">${isFirstFav?'✓ 已在片单':'＋ 片单'}</button></div></div></section>${state.error?`<div class="home-stale-banner" role="status"><span>暂时无法更新，仍显示上次加载的内容</span><button data-act="refresh">重试</button></div>`:''}<div class="hero-switch" aria-label="切换首页推荐">${picks.map((movie,i)=>`<button data-act="hero-pick" data-id="${i}" aria-label="推荐 ${i+1}：${e(movie.title)}" aria-pressed="${state.heroIndex%picks.length===i}" class="${state.heroIndex%picks.length===i?'active':''}"><span></span></button>`).join('')}<span class="subtle">点选或左右滑动切换</span></div>${quickCategories()}
 ${recent.length?`<section class="continue-section"><div class="sectiontop row"><h2>继续观看 <span class="section-count">${recent.length} 部</span></h2><button class="textbutton" data-act="history-all">全部记录 ›</button></div><div class="continue-row">${recent.map(row=>{const denom=Number(row.duration)>60?Number(row.duration):2700,pct=row.time>0?Math.min(96,Math.max(8,Math.round((row.time/denom)*100))):18,timeText=row.time>0?` · 看到 ${formatDuration(row.time)}${Number(row.duration)>60?' / '+formatDuration(row.duration):''}`:'';return `<button class="continue-card" data-act="detail" data-id="${e(row.movie.id)}"><div class="continue-card-top"><strong>${e(row.movie.title)}</strong><span class="continue-remove" data-act="remove-history" data-key="${e(row.key||(row.siteId+':'+row.movie.id))}" role="button" aria-label="移除观看记录">×</span></div><span>${e(row.episodeTitle||'查看选集')}${timeText}</span><div class="continue-progress"><i style="width:${pct}%"></i></div><small>接着上次进度播放 ›</small></button>`;}).join('')}</div></section>`:''}
 ${state.sections.map((section,index)=>`<section class="home-section"><div class="sectiontop row"><h2>${e(section.title)} <span class="section-count">${section.items.length} 部</span></h2>${section.route?`<button class="textbutton" data-act="collection-link" data-route="${e(section.route.url)}" data-title="${e(section.title)}">更多 ›</button>`:`<span class="subtle">精选片单</span>`}</div><div class="shelf" data-shelf="${state.site}:${index}" tabindex="0" aria-label="${e(section.title)}，${section.items.length} 部">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join('')}`;
}
function discoveryProfile(){return client().discoveryProfile();}
function discoveryTabs(){return discoveryProfile().tabs;}
function discoveryCacheKey(tab=state.discoverTab){return `${state.site}:${tab}:${state.adultEnabled?'adult':'safe'}`;}
function mergeDiscoveryGroups(existing,incoming){
 const map=new Map();
 for(const group of [...(existing||[]),...(incoming||[])]){
  if(!group||!Array.isArray(group.items))continue;
  const key=String(group.title||'近期更新'),prev=map.get(key);
  if(prev)prev.items=[...new Map([...prev.items,...group.items].map(item=>[item.id,item])).values()];
  else map.set(key,{...group,title:key,items:group.items.slice()});
 }
 return [...map.values()];
}
function discover(){
 const profile=discoveryProfile(),tabs=profile.tabs,activeTab=tabs.find(tab=>String(tab.id)===String(state.discoverTab)),tabMode=activeTab?.mode||'timeline',years=Array.from({length:5},(_,i)=>new Date().getFullYear()-i),months=Array.from({length:12},(_,i)=>i+1),sections=state.discoverSections;
 const topicSections=sections.filter(section=>['topic','topics'].includes(section.route?.kind));
 const groups=state.discoverGroups.length?state.discoverGroups:state.discoverItems.length?[{title:'近期更新',items:state.discoverItems}]:[];
 const visibleGroups=groups.filter(group=>{const title=String(group.title),current=new Date(),relative=/今天|昨天|今日/.test(title),match=title.match(/(20\d{2})\D{0,3}(\d{1,2})月|^(\d{1,2})月/);if(relative)return state.discoverYear===current.getFullYear()&&state.discoverMonth===current.getMonth()+1;if(!match)return true;const year=Number(match[1]||state.discoverYear),month=Number(match[2]||match[3]);return year===state.discoverYear&&month===state.discoverMonth;});
 let panel='';
 if(state.loading&&!groups.length&&!sections.length&&!state.discoverItems.length)panel=loading();
 else if(profile.sectionTab!=null&&String(profile.sectionTab)===String(state.discoverTab))panel=sections.length?sections.map((section,index)=>`<section class="home-section source-discovery-section" data-discovery-key="${e(section.route?.url||section.title)}"><div class="sectiontop row"><h2>${e(section.title)} <span class="section-count">${section.items.length} 部</span></h2>${section.route?`<button class="textbutton" data-act="collection-link" data-route="${e(section.route.url)}" data-title="${e(section.title)}">更多 ›</button>`:''}</div><div class="shelf" data-shelf="discovery:${e(site().id)}:${state.discoverTab}:${index}">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):state.discoverItems.length?grid(state.discoverItems):state.error?notice('栏目暂时不可用',state.error,'refresh','重新加载'):notice('暂时没有内容','可切换上方栏目，或稍后刷新。','','');
 else if(profile.timeline&&String(profile.timelineTab??'0')===String(state.discoverTab))panel=`<div class="timeline-months">${months.map(month=>`<button class="month-chip ${month===state.discoverMonth?'active':''}" data-act="discover-month" data-id="${month}">${month}月</button>`).join('')}</div>${visibleGroups.length?visibleGroups.map((group,index)=>`<section class="timeline-group"><div class="timeline-mark"></div><div class="timeline-heading"><h2>${e(group.title)}</h2><span>${group.items.length} 部</span></div><div class="timeline-shelf" data-shelf="discovery:release:${index}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):state.error?notice('上映表暂时不可用',state.error,'refresh','重新加载'):groups.length?notice(`${state.discoverYear}年${state.discoverMonth}月暂无排期`,'可切换其他月份，或一键回到当前月份排期。','discover-reset-date','回到当月'):notice('此来源暂未提供上映表','切换其他影视来源，或稍后刷新片源目录。','','')}`;
 else if(tabMode==='topics')panel=state.discoverGroups.length?state.discoverGroups.map((group,index)=>`<section class="home-section discover-topic"><div class="sectiontop"><h2>${e(group.title||'专题')}</h2></div><div class="shelf" data-shelf="discovery:topic:${index}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):topicSections.length?topicSections.map((section,index)=>`<section class="home-section discover-topic"><div class="sectiontop row"><h2>${e(section.title)}</h2>${section.route?`<button class="textbutton" data-act="collection-link" data-route="${e(section.route.url)}" data-title="${e(section.title)}">更多 ›</button>`:''}</div><div class="shelf" data-shelf="discovery:topic:${index}">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):notice('暂未找到专题','此来源没有提供专题目录。','','');
 else if(tabMode==='netflix'&&sections.length)panel=sections.map((section,index)=>`<section class="home-section"><div class="sectiontop"><h2>${e(section.title)}</h2></div><div class="shelf" data-shelf="discovery:netflix:${index}">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join('');
 else panel=state.loading&&!state.discoverItems.length?loading():state.discoverItems.length?grid(state.discoverItems):state.error?notice('栏目暂时不可用',state.error,'refresh','重新加载'):notice(tabMode==='netflix'?'暂未找到 Netflix 专区':'暂未找到此栏目的影片','可切换影视来源后再试。','','');
 return `<div class="discover-page"><section class="discover-banner"><div class="discover-banner-top"><span>✦ 片库探索 · ${e(site().name)}</span><button class="discover-refresh" data-act="refresh" aria-label="刷新">${icon('refresh')}</button></div><div class="movie-time-word">CINEMA DISCOVERY</div><span class="discover-caption">RELEASES · CURATED TOPICS · TRENDING CHARTS</span><div class="discover-sources">${sites.map(source=>`<button data-act="source" data-id="${source.id}" class="${source.id===state.site?'active':''}">${e(source.name)}</button>`).join('')}</div></section><div class="discover-tabs" role="tablist" aria-label="发现栏目">${tabs.map(tab=>`<button role="tab" aria-selected="${String(state.discoverTab)===String(tab.id)}" class="${String(state.discoverTab)===String(tab.id)?'active':''}" data-act="discover-tab" data-id="${tab.id}">${e(tab.name)}</button>`).join('')}</div>${profile.timeline&&String(profile.timelineTab??'0')===String(state.discoverTab)?`<div class="timeline-years" aria-label="选择年份">${years.map(year=>`<button class="year-chip ${year===state.discoverYear?'active':''}" data-act="discover-year" data-id="${year}">${year}</button>`).join('')}</div>`:''}${panel}${state.discoverNext&&!state.loading?`<button class="secondary loadmore" data-act="discover-more">加载更多</button>`:''}</div>`;
}
async function loadDiscovery({refresh=false,more=false}={}){
 if(!discoveryTabs().some(t=>Number(t.id)===state.discoverTab))state.discoverTab=0;
 const profile=discoveryProfile(),tab=profile.tabs.find(item=>String(item.id)===String(state.discoverTab)),mode=tab?.mode||'timeline';
 const key=discoveryCacheKey(state.discoverTab),cached=discoveryCache.get(key);if(!refresh&&!more&&cached){Object.assign(state,cached,{loading:false,error:''});render();return;}
 const previousGroups=state.discoverGroups.length,previousItems=state.discoverItems.length,{signal,epoch}=cancel(),c=client();state.loading=true;state.error='';if(!more){state.discoverGroups=[];state.discoverSections=[];state.discoverItems=[];state.discoverNext='';render();}else{const button=pageRoot.querySelector('[data-act="discover-more"]');if(button){button.disabled=true;button.textContent='正在加载…';}}
 try{
  if(!c.config)await c.bootstrap(signal);
  if(typeof c.discovery==='function'){
   const data=await c.discovery(state.discoverTab,more?state.discoverNext||'page=1':'page=1',signal);if(epoch!==state.epoch)return;
   const sections=homeSections(data),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});
   if(more){const combined=new Map();for(const section of [...state.discoverSections,...sections]){const key=section.route?.url||section.title,previous=combined.get(key);combined.set(key,previous?{...previous,items:[...new Map([...previous.items,...section.items].map(item=>[item.id,item])).values()]}:section);}state.discoverSections=[...combined.values()];}else state.discoverSections=sections;
   state.discoverItems=more?[...new Map([...state.discoverItems,...items].map(item=>[item.id,item])).values()]:items;state.discoverNext=pageCursor(data?.next);
  }else{
  if(!state.sections.length){const home=await c.home(signal);state.sections=homeSections(home);}
  if(mode==='timeline'){
   const route=state.sections.find(section=>section.route?.kind==='timeline')?.route;
   if(route){const data=await c.collection(route,more?state.discoverNext||'page=1':'page=1',signal),groups=collectionGroups(data,{includeAdult:state.adultEnabled});state.discoverGroups=more?mergeDiscoveryGroups(state.discoverGroups,groups):groups;state.discoverNext=pageCursor(data?.next);}
   else{const category=categories(c.config,{includeAdult:state.adultEnabled})[0];if(category){const data=await c.channel(category.id,{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}}
  }
  else if(mode==='catalog'||mode==='latest'){const category=categories(c.config,{includeAdult:state.adultEnabled})[0];if(category){const data=await c.channel(category.id,{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}}
  else if(mode==='netflix'){const netflix=(c.config.vodTabs||[]).find(tab=>/netflix/i.test(String(tab.text||tab.name||''))&&Number(tab.channelId)>0);if(netflix){const data=await c.channel(Number(netflix.channelId),{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}else state.discoverSections=state.sections.filter(section=>/netflix/i.test(section.title));}
  else if(mode==='topics'){const topicRoute=state.sections.find(section=>section.route?.kind==='topics')?.route;state.discoverSections=state.sections.filter(section=>['topic','topics'].includes(section.route?.kind));if(topicRoute){const data=await c.collection(topicRoute,more?state.discoverNext||'page=1':'page=1',signal),groups=collectionGroups(data,{includeAdult:state.adultEnabled});state.discoverGroups=more?mergeDiscoveryGroups(state.discoverGroups,groups):groups;state.discoverNext=pageCursor(data?.next);}}
  else if(mode==='home'){state.discoverSections=state.sections;}
  else if(['ranking','hot','trending'].includes(mode)){const category=categories(c.config,{includeAdult:state.adultEnabled})[0],definition=c.config.channelListQuery?.find(row=>Number(row.channelId)===category?.id)?.items?.find(row=>row.query==='sort'),hot=definition?.data?.find(option=>/热|人气|排行/.test(option.name))?.id;if(category){const data=await c.channel(category.id,hot?{sort:String(hot)}:{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}}
  }
  if(epoch!==state.epoch)return;
 }catch(error){if(error.name!=='AbortError'&&epoch===state.epoch)state.error=error.message;}
 finally{if(epoch===state.epoch){state.loading=false;if(!state.error)discoveryCache.set(key,{discoverGroups:state.discoverGroups.slice(),discoverSections:state.discoverSections.slice(),discoverItems:state.discoverItems.slice(),discoverNext:state.discoverNext});if(!more||native.native()||!appendDiscoveryResults(previousGroups,previousItems))render();else if(native.native())native.syncPage(nativePageSnapshot());}}
}
function observeAppendedImages(container){stopImages?.observe?.(container,new Map(state.imageMap));}
function appendDiscoveryResults(previousGroups,previousItems){
 if(state.error)return false;
 const page=pageRoot.querySelector('.discover-page');if(!page)return false;
 const template=document.createElement('div');template.innerHTML=discover();
 const more=page.querySelector('[data-act="discover-more"]');
 const profile=discoveryProfile();
 if(profile.sectionTab!=null&&String(profile.sectionTab)===String(state.discoverTab)&&state.discoverSections.length){
  for(const section of template.querySelectorAll('.source-discovery-section')){const existing=[...page.querySelectorAll('.source-discovery-section')].find(node=>node.dataset.discoveryKey===section.dataset.discoveryKey);if(!existing){if(more)more.insertAdjacentElement('beforebegin',section);else page.append(section);continue;}const shelf=existing.querySelector('.shelf'),known=new Set([...shelf.querySelectorAll('.card')].map(node=>node.dataset.id));for(const cardNode of section.querySelectorAll('.card'))if(!known.has(cardNode.dataset.id)){known.add(cardNode.dataset.id);shelf.append(cardNode);}}
  observeAppendedImages(page);if(more){if(state.discoverNext){more.disabled=false;more.textContent='加载更多';}else more.remove();}return true;
 }
 const addedItems=state.discoverItems.slice(previousItems),firstCard=page.querySelector('.card');
 if(addedItems.length&&firstCard){firstCard.parentElement.insertAdjacentHTML('beforeend',addedItems.map(item=>card(item)).join(''));observeAppendedImages(firstCard.parentElement);const button=page.querySelector('[data-act="discover-more"]');if(button){if(state.discoverNext){button.disabled=false;button.textContent='加载更多';}else button.remove();}return true;}
 const existingGrid=page.querySelector(':scope > .grid'),nextGrid=template.querySelector('.discover-page > .grid');
 if(existingGrid&&nextGrid){existingGrid.insertAdjacentHTML('beforeend',state.discoverItems.slice(previousItems).map(item=>card(item)).join(''));observeAppendedImages(existingGrid);}
 else{
  const selectors=profile.sectionTab!=null&&String(profile.sectionTab)===String(state.discoverTab)?['.source-discovery-section']:profile.timeline&&String(profile.timelineTab??'0')===String(state.discoverTab)?['.timeline-group']:discoveryProfile().tabs.find(item=>String(item.id)===String(state.discoverTab))?.mode==='topics'?['.discover-topic']:[];
  if(selectors.length){const selector=selectors[0],existingByTitle=new Map([...page.querySelectorAll(selector)].map(node=>[node.querySelector('h2')?.textContent||'',node])),incoming=[...template.querySelectorAll(selector)];for(const section of incoming){const title=section.querySelector('h2')?.textContent||'',existing=existingByTitle.get(title);if(!existing){if(more)more.insertAdjacentElement('beforebegin',section);else page.append(section);existingByTitle.set(title,section);continue;}const shelf=existing.querySelector('.shelf,.timeline-shelf'),known=new Set([...(shelf?.querySelectorAll('.card')||[])].map(node=>node.dataset.id));for(const cardNode of section.querySelectorAll('.card'))if(shelf&&!known.has(cardNode.dataset.id)){known.add(cardNode.dataset.id);shelf.append(cardNode);}}observeAppendedImages(page);}
 }
 const button=page.querySelector('[data-act="discover-more"]');if(button){if(state.discoverNext){button.disabled=false;button.textContent='加载更多';}else button.remove();}
 return true;
}
function browse(){
 const cats=categories(client().config,{includeAdult:state.adultEnabled}),category=cats.find(c=>c.id===state.channel),filters=filterDefinitions();
 const selected=filters.filter(f=>state.filters[f.query]!==undefined&&String(state.filters[f.query])!==filterDefault(f));
 const expansionKey=`sanyuan:filters-expanded:${state.site}:${state.channel}`,filtersExpanded=localStorage.getItem(expansionKey)==='true',visibleFilters=filtersExpanded?filters:filters.slice(0,2);
 return `<div class="browse-heading"><div class="browse-title-group"><h1 class="heading">${state.page==='search'?`“${e(state.query)}” 的搜索结果`:e(category?.name||'分类片库')}</h1>${state.page==='search'?`<button class="textbutton" data-act="page" data-id="browse">返回分类 ›</button>`:''}</div><label class="density-control">分栏 <select aria-label="海报分栏" data-grid-columns>${['3','4','5','6'].map(value=>`<option value="${value}" ${state.columns===value?'selected':''}>${value} 栏</option>`).join('')}</select></label></div>
 ${state.page==='browse'?quickCategories()+(filters.length?`<section class="filters" aria-label="筛选影片"><div class="row filter-heading"><strong>筛选条件${selected.length?` · ${selected.length}`:''}</strong><button class="textbutton" data-act="filters-reset" ${selected.length?'':'disabled'}>重置</button></div>${visibleFilters.map(filter=>`<div class="filterrow"><span class="filter-label">${e(filterName(filter.query))}</span><div class="filter-options" role="group" aria-label="${e(filterName(filter.query))}">${(filter.data||[]).map(option=>{const active=String(state.filters[filter.query]??filterDefault(filter))===String(option.id);return `<button class="filter-chip ${active?'active':''}" data-act="filter-option" data-key="${e(filter.query)}" data-id="${e(option.id)}" aria-pressed="${active}">${e(option.name)}</button>`;}).join('')}</div></div>`).join('')}${filters.length>2?`<button class="filter-expand" data-act="filters-expanded" aria-expanded="${filtersExpanded}">${filtersExpanded?'收起筛选':'更多筛选'} <span>${filtersExpanded?'⌃':'＋'}</span></button>`:''}</section>`:'')+(selected.length?`<div class="selected-filters" aria-label="已选条件">${selected.map(filter=>`<button data-act="filter-clear" data-key="${e(filter.query)}" aria-label="取消${e(filterName(filter.query))}筛选">${e(filterName(filter.query))}：${e(filter.data?.find(o=>String(o.id)===String(state.filters[filter.query]))?.name||state.filters[filter.query])} ×</button>`).join('')}</div>`:''):''}
 ${state.page==='search'&&state.items.length?`<div class="search-source-bar" aria-label="跨站搜索同关键词"><span class="subtle">换源同搜</span><div class="search-source-chips">${sites.filter(s=>s.id!==state.site).map(s=>`<button type="button" class="chip" data-act="source" data-id="${e(s.id)}">${e(s.name)}</button>`).join('')}</div></div>`:''}
 <div class="results-status" role="status" aria-live="polite">${state.loading?'正在加载影片…':state.items.length?'已显示 '+state.items.length+' 部'+(state.next?' · 下方可加载更多':' · 已全部显示'):''}</div>
 ${state.error?notice('请求未完成',state.error,state.error.includes('初始化')||state.error.includes('登录')?'account':'refresh',state.error.includes('初始化')||state.error.includes('登录')?'前往登录':'重试'):''}
 ${state.items.length?grid(state.items):state.loading?loading():!state.error?(state.page==='search'?`<div class="notice"><h3>在 ${e(site().name)} 中暂未找到 “${e(state.query)}”</h3><div>可点击下方片源直接跨站搜索同一关键词：</div><div class="cross-source-chips">${sites.filter(s=>s.id!==state.site).map(s=>`<button type="button" class="chip" data-act="source" data-id="${e(s.id)}">${e(s.name)}</button>`).join('')}</div></div>`:notice('还没有找到影片','试试减少筛选条件，或切换上方分类。',state.page==='browse'&&selected.length?'filters-reset':'', '清除筛选')):''}
 ${state.next&&state.items.length?`<button class="secondary loadmore" data-act="more" ${state.loading?'disabled':''}>${state.loading?'正在加载…':'加载更多影片'}</button>`:''}`;
}
function collectionSnapshot(){return {collection:state.collection,items:state.items,next:state.next,collectionGroups:state.collectionGroups,scrollY:window.scrollY};}
function openCollection(value,title){
 const route=sectionRoute(value);if(!route)return;if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);if(state.page==='home')state.homeScroll=window.scrollY;
 if(state.page==='collection'){if(state.collectionStack.length>=12)state.collectionStack.shift();state.collectionStack.push(collectionSnapshot());}else state.collectionStack=[];
 state.collection={...route,title:title||route.title||'专题片库'};state.items=[];state.collectionGroups=[];state.page='collection';window.scrollTo(0,0);load();
}
function collectionView(){
 const grouped=!['topic','channel'].includes(state.collection?.kind);
 return `<div class="content collection-content"><h1 class="heading">${e(state.collection?.title||'专题片库')}</h1>${state.error?notice('栏目加载失败',state.error):''}
 ${state.loading&&!state.items.length&&!state.collectionGroups.length?loading():grouped?state.collectionGroups.map((group,index)=>`<section class="collection-group"><div class="sectiontop row"><h2>${e(group.title)}</h2>${group.route?`<button class="textbutton" data-act="collection-link" data-route="${e(group.route.url)}" data-title="${e(group.title)}">全部影片 ›</button>`:''}</div><div class="shelf collection-shelf" data-shelf="collection:${e(state.collection?.id||'root')}:${index}" aria-label="${e(group.title)}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):grid(state.items)}
 ${!state.loading&&!state.error&&!state.items.length&&!state.collectionGroups.length?notice('暂无内容','可返回首页浏览其他栏目。','',''):''}
 ${state.next&&(state.items.length||state.collectionGroups.length)?`<button class="secondary loadmore" data-act="more" ${state.loading?'disabled':''}>${state.loading?'正在加载…':'加载更多'}</button>`:''}</div>`;
}
function saved(){const allRows=validSavedRows(state.savedTab).filter(row=>state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5)).sort((a,b)=>b.updated-a.updated),sourceIds=[...new Set(allRows.map(r=>r.siteId).filter(Boolean))];if(state.savedSourceFilter!=='all'&&!sourceIds.includes(state.savedSourceFilter))state.savedSourceFilter='all';const filtered=state.savedSourceFilter==='all'?allRows:allRows.filter(r=>r.siteId===state.savedSourceFilter),rows=state.savedSort==='title'?filtered.slice().sort((a,b)=>String(a.movie?.title||'').localeCompare(String(b.movie?.title||''),'zh-CN')):filtered,label=state.savedTab==='history'?'观看记录':'收藏',empty=state.savedTab==='history'?'开始播放后，影片和集数会保存在这里。':'点击影片上的收藏按钮，方便稍后继续观看。';const sortPill=filtered.length>=4?`<button type="button" class="chip saved-sort-chip" data-act="saved-sort-toggle" title="切换排序">${state.savedSort==='title'?'⇅ 按片名':'⇅ 按时间'}</button>`:'';const filterBar=(sourceIds.length>1||sortPill)?`<div class="saved-source-filters" role="group" aria-label="按来源筛选">${sourceIds.length>1?`<button type="button" class="chip ${state.savedSourceFilter==='all'?'active':''}" data-act="saved-source-filter" data-id="all">全部 (${allRows.length})</button>${sourceIds.map(sid=>{const sname=sites.find(s=>s.id===sid)?.name||sid,cnt=allRows.filter(r=>r.siteId===sid).length;return `<button type="button" class="chip ${state.savedSourceFilter===sid?'active':''}" data-act="saved-source-filter" data-id="${e(sid)}">${e(sname)} (${cnt})</button>`;}).join('')}`:''}${sortPill}</div>`:'';return `<section class="my-library"><div class="my-library-heading"><div><span class="eyebrow">MY LIBRARY</span><h2>${label}</h2></div><span class="my-library-count">${rows.length} 部</span></div>${filterBar}${rows.length?`<div class="grid">${rows.map(row=>{const sub=state.savedTab==='history'?[row.episodeTitle,row.time>0?(Number(row.duration)>60?`${formatDuration(row.time)}/${formatDuration(row.duration)}`:formatDuration(row.time)):''].filter(Boolean).join(' · '):undefined;return card(row.movie,row.siteId,sub,row.key||(row.siteId+':'+row.movie.id));}).join('')}</div><button class="my-clear-button" data-act="clear-saved">${state.savedTab==='favorites'?'清空收藏':'清空观看记录'}</button>`:notice(state.savedTab==='history'?'还没有观看记录':'还没有收藏影片',empty,'', '')}<p class="caption">收藏与观看记录仅保存在本机。</p></section>`;}
function me(){const tabs=[['favorites','收藏'],['history','观看记录'],['settings','设置']];return `<div class="me-page"><header class="me-intro"><span class="eyebrow">PERSONAL SPACE</span><h1>我的</h1><p>收藏、观看记录与应用偏好</p></header><div class="me-tabs" role="tablist" aria-label="我的页面">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${state.meTab===id}" class="${state.meTab===id?'active':''}" data-act="me-tab" data-id="${id}">${label}</button>`).join('')}</div>${state.meTab==='settings'?settings():saved()}</div>`;}
const liveChannel=()=>state.liveChannels[state.liveCurrentIndex]||null;
const liveFavorite=channel=>state.liveFavorites.includes(channel?.identity||'');
function liveGroupCounts(){const counts=new Map();for(const channel of state.liveChannels){counts.set(channel.group,(counts.get(channel.group)||0)+1);if(liveFavorite(channel))counts.set('__favorites__',(counts.get('__favorites__')||0)+1);}return counts;}
function dayKey(timestamp){const d=new Date(timestamp);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function clockTime(timestamp){return new Date(timestamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});}
function liveGroupsMarkup(){if(!state.liveChannels.length)return `<div class="live-empty">先导入 M3U 播放列表，再按分类浏览频道。</div>`;const counts=liveGroupCounts();return `<div class="live-group-grid"><button data-act="live-category" data-id="__all__" class="live-group-card ${state.liveCategory==='__all__'?'active':''}"><span>全部频道</span><small>${state.liveChannels.length} 个频道</small></button><button data-act="live-category" data-id="__favorites__" class="live-group-card ${state.liveCategory==='__favorites__'?'active':''}"><span>♥ 我的收藏</span><small>${counts.get('__favorites__')||0} 个频道</small></button>${state.liveGroups.map(group=>{const count=counts.get(group)||0;return `<button data-act="live-category" data-id="${e(group)}" class="live-group-card ${state.liveCategory===group?'active':''}"><span>${e(group)}</span><small>${count} 个频道</small></button>`;}).join('')}</div>`;}
function liveFilteredChannels(){
 let channels=state.liveChannels;
 if(state.liveCategory==='__favorites__')channels=channels.filter(liveFavorite);else if(state.liveCategory&&state.liveCategory!=='__all__')channels=channels.filter(channel=>channel.group===state.liveCategory);
 const query=state.liveSearch.trim().toLocaleLowerCase();if(query)channels=channels.filter(channel=>`${channel.name} ${channel.tvgId} ${channel.group}`.toLocaleLowerCase().includes(query));
 return channels;
}
function liveChannelList(){
 const channels=liveFilteredChannels();
 const visible=channels.slice(0,state.liveVisibleCount);
 return `<form id="live-search-form" class="live-search"><div class="live-search-input-wrap"><input name="query" value="${e(state.liveSearch)}" placeholder="搜索频道名称、分组" aria-label="搜索直播频道"><button type="button" class="search-clear live-search-clear" data-act="live-search-clear" ${state.liveSearch?'':'hidden'} aria-label="清除频道搜索">×</button></div><button type="submit">搜索</button></form><div class="live-channel-list">${visible.map(channel=>`<article class="live-channel-row ${channel.index===state.liveCurrentIndex?'active':''}"><button class="live-channel-main" data-act="live-channel" data-id="${channel.index}" aria-current="${channel.index===state.liveCurrentIndex?'true':'false'}"><span class="live-channel-number">${String(channel.index+1).padStart(2,'0')}</span><span class="live-channel-logo">${liveLogo(channel)||`<b>${e(channel.name.slice(0,2))}</b>`}</span><span class="live-channel-copy"><strong>${e(channel.name)}</strong><small>${e(channel.group)} · ${channel.secure?'HTTPS':'HTTP · 未加密'}</small></span></button><button class="live-favorite ${liveFavorite(channel)?'active':''}" data-act="live-favorite" data-id="${channel.index}" aria-label="${liveFavorite(channel)?'取消':'加入'}收藏">${liveFavorite(channel)?'♥':'♡'}</button></article>`).join('')||`<div class="live-empty">${state.liveCategory==='__favorites__'?'还没有收藏频道':'没有找到匹配频道'}</div>`}</div>${channels.length>visible.length?`<button class="secondary live-load-more" data-act="live-more">加载更多 · 还剩 ${channels.length-visible.length} 个</button>`:''}`;
}
function liveProgramsPanel(channel){
 if(!channel)return `<div class="live-empty">先从频道列表选择频道。</div>`;
 if(!state.liveEPGUrl)return `<div class="live-empty">此播放列表没有提供节目单地址。</div>`;
 if(state.liveEPGLoading)return `<div class="live-empty"><span class="spinner"></span>正在读取节目单…</div>`;
 if(state.liveError&&!state.livePrograms.length)return `<div class="live-empty">${e(state.liveError)}<button class="textbutton" data-act="live-epg-refresh">重试</button></div>`;
 const days=[...new Set(state.livePrograms.map(program=>dayKey(program.start)))],today=dayKey(Date.now()),selectedDate=days.includes(state.liveProgramDate)?state.liveProgramDate:days.includes(today)?today:days[0]||today;
 const dateBase=new Date(`${selectedDate}T12:00:00`),dateOptions=Array.from({length:8},(_,index)=>{const date=new Date(dateBase);date.setDate(dateBase.getDate()-6+index);return dayKey(date.getTime());});
 const programs=state.livePrograms.filter(program=>dayKey(program.start)===selectedDate),now=Date.now();
 return `<div class="live-date-tabs" data-live-scroll="program-dates">${dateOptions.map(day=>{const date=new Date(`${day}T12:00:00`),weekday=day===today?'今天':new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(date);return `<button data-act="live-date" data-id="${day}" class="${selectedDate===day?'active':''}"><b>${date.getDate()}</b><small>${weekday}</small></button>`;}).join('')}</div><div class="live-program-list">${programs.map((program,index)=>{const current=now>=program.start&&now<program.stop,pct=current?Math.min(100,Math.max(4,Math.round((now-program.start)/Math.max(1,program.stop-program.start)*100))):0;return `<button class="live-program ${current?'current':''} ${state.liveSelectedProgram?.start===program.start?'selected':''}" data-act="live-program" data-id="${index}"><time>${clockTime(program.start)}</time><span><strong>${e(program.title)}</strong><small>${program.subtitle?e(program.subtitle)+' · ':''}${clockTime(program.start)} – ${clockTime(program.stop)}</small>${current?`<i class="live-prog-bar"><b style="width:${pct}%"></b></i>`:''}</span><em>${current?'正在播出':program.start>now?'未播':'已播'}</em></button>`;}).join('')||`<div class="live-empty">所选日期暂无节目数据</div>`}</div><div class="live-program-footer"><span>节目表 · ${e(channel.name)}</span><span><button class="textbutton" data-act="live-epg-info">来源详情</button><button class="textbutton" data-act="live-epg-refresh">刷新</button></span></div>`;
}
function liveRoutesPanel(channel){
 if(!channel)return `<div class="live-empty">先选择一个频道，查看它的播放线路。</div>`;
 const routes=liveCandidateList(channel);
 return `<div class="live-route-list">${routes.map((route,index)=>`<button class="live-route ${state.liveVariantIndex===index?'active':''}" data-act="live-route" data-id="${index}"><span class="live-route-order">${index===state.liveVariantIndex?'✓':index+1}</span><span><strong>${e(route.name)}</strong><small>${e(route.group)} · ${route.secure?'HTTPS':'HTTP · 未加密'}</small></span><span class="live-route-state">${index===state.liveVariantIndex&&state.liveActive?'正在播放':route.secure?'可播放':'未加密线路'}</span></button>`).join('')||`<div class="live-empty">没有其他播放线路。</div>`}</div>`;
}
async function loadLivePlaylist(value=state.liveURL){
 state.liveInitialAttempted=true;
 let url;try{url=normalizePlaylistURL(value);}catch{state.liveError='请输入有效的 HTTP 或 HTTPS M3U 地址。';state.liveImportOpen=true;render();return;}
 state.liveImportController?.abort();const controller=new AbortController();state.liveImportController=controller;state.liveURL=url.href;localStorage.setItem('sanyuan:livePlaylistURL',url.href);state.liveLoading=true;state.liveError='';render();
 try{const fetchURL=new URL(url.href);fetchURL.searchParams.set('_sanyuan_refresh',String(Date.now()));const response=await native.request({url:fetchURL.href,method:'GET',headers:{Accept:'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*','Cache-Control':'no-cache','Pragma':'no-cache'},livePlaylist:true,signal:controller.signal});if(response.status<200||response.status>=300)throw Error(`播放列表请求失败（HTTP ${response.status}）`);const baseURL=normalizePlaylistURL(response.url||url.href).href,text=decodePlaylist(response.bodyBase64),parsed=await parseM3UIncremental(text,baseURL,{signal:controller.signal});if(controller.signal.aborted)return;
  let saved=true;try{await native.saveLiveCache(url.href,text,baseURL);if(controller.signal.aborted)return;state.liveCacheFound=true;}catch{saved=false;}
  if(controller.signal.aborted)return;
  applyLivePlaylist(parsed,url.href,baseURL);state.liveStatus=`${url.protocol==='http:'?'HTTP 列表未加密 · ':''}已导入 ${parsed.channels.length.toLocaleString()} 个频道${saved?' · 已保存在本机':' · 本地保存失败，请检查设备空间'}`;
  const preferred=liveChannel();if(state.page==='live'&&preferred)queueMicrotask(()=>playLiveVariant(0));
 }catch(error){if(error.name!=='AbortError'&&!controller.signal.aborted)state.liveError=error.message||'无法读取 M3U 播放列表';}
 finally{if(state.liveImportController===controller){state.liveLoading=false;state.liveImportController=null;render();}}
}
function applyLivePlaylist(parsed,url,baseURL=url){
 state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGCache.clear();state.liveEPGText='';state.livePrograms=[];
 state.liveChannels=parsed.channels;state.liveGroups=parsed.groups;state.liveAlternateIndex=indexChannelAlternates(parsed.channels);state.liveEPGUrl=parsed.epgUrl;state.liveLoadedURL=baseURL;state.liveURL=url;localStorage.setItem('sanyuan:livePlaylistURL',url);state.liveCategory='__all__';state.livePanel='channels';state.liveVisibleCount=80;state.liveNativeVisibleCount=40;state.liveSearch='';state.liveImportOpen=false;state.liveSelectedRoute=null;state.liveTriedURLs.clear();
 const preferred=parsed.channels.find(channel=>/CCTV\s*[- ]?1综合/i.test(channel.name))||parsed.channels[0];
 state.liveCurrentIndex=preferred?.index??-1;state.liveVariantIndex=0;state.livePrograms=[];state.liveProgramDate='';state.liveSelectedProgram=null;
}
async function restoreLivePlaylist(){
 try{const cached=await native.getLiveCache();if(state.liveInitialAttempted||!cached?.url||typeof cached.text!=='string'||!cached.text)return false;state.liveCacheFound=true;const baseURL=normalizePlaylistURL(cached.baseURL||cached.url).href,parsed=await parseM3UIncremental(cached.text,baseURL);if(state.liveInitialAttempted)return false;applyLivePlaylist(parsed,cached.url,baseURL);state.liveStatus=`${cached.url.startsWith('http:')?'HTTP 列表未加密 · ':''}已从本机读取 ${parsed.channels.length.toLocaleString()} 个频道`;if(state.page==='live')render();return true;}
 catch(error){state.liveCacheFound=true;state.liveError='本地直播列表读取失败，请手动更新。';return false;}
}
const liveCacheReady=restoreLivePlaylist();
async function loadLiveGuide({force=false}={}){
 const channel=liveChannel();if(!channel||!state.liveEPGUrl)return;state.liveGuideController?.abort();const controller=new AbortController();state.liveGuideController=controller;const identity=channel.identity,key=channel.tvgId||channel.name;if(force){state.liveEPGText='';state.liveEPGCache.clear();}const cached=state.liveEPGCache.get(key);if(cached){state.livePrograms=cached;state.liveProgramDate='';state.liveError='';state.liveEPGLoading=false;state.liveGuideController=null;render();return;}
 state.liveEPGLoading=true;state.liveError='';render();try{if(!state.liveEPGText){const response=await native.request({url:state.liveEPGUrl,method:'GET',headers:{Accept:'application/xml, text/xml, */*'},liveGuide:true,signal:controller.signal});if(response.status<200||response.status>=300)throw Error(`节目单请求失败（HTTP ${response.status}）`);const xml=decodePlaylist(response.bodyBase64);if(controller.signal.aborted||liveChannel()?.identity!==identity)return;state.liveEPGText=xml;}if(controller.signal.aborted||liveChannel()?.identity!==identity)return;const programs=parseXMLTV(state.liveEPGText,key);state.livePrograms=programs;state.liveEPGCache.set(key,programs);state.liveProgramDate='';if(!programs.length)state.liveError='节目单里没有找到这个频道（频道 ID：'+key+'）';}catch(error){if(error.name!=='AbortError'&&!controller.signal.aborted&&liveChannel()?.identity===identity)state.liveError=error.message||'无法读取节目单';}finally{if(state.liveGuideController===controller){state.liveGuideController=null;state.liveEPGLoading=false;render();}}
}
function liveCandidateList(channel){const seen=new Set();return channelAlternates(state.liveChannels,channel,state.liveAlternateIndex).slice().sort((a,b)=>a.index===channel.index?-1:b.index===channel.index?1:a.index-b.index).filter(r=>r?.url&&!seen.has(r.url)&&seen.add(r.url));}
async function playLiveVariant(variantIndex=0,{automatic=false,retrySame=false}={}){
 const channel=liveChannel();if(!channel)return;const routes=liveCandidateList(channel),route=routes[variantIndex];if(!route)return;
 state.liveVideoReady=false;state.liveVideoFormat=null;state.liveVariantIndex=variantIndex;state.liveTriedURLs.add(route.url);state.liveCurrentIndex=channel.index;state.liveActive=true;state.liveLastPlaybackTime=null;state.livePlaybackProgressAt=Date.now();if(!retrySame)state.liveRendererRetry=0;state.liveStatus=retrySame?'正在重建画面渲染，当前线路保持不变…':automatic?'正在切换备用线路…':route.secure?'正在连接…':'HTTP 未加密 · 正在连接…';state.liveError='';if(!['programs','routes'].includes(state.livePanel))state.livePanel='channels';render({liveFast:true});
 if(!native.native()){const video=$('#live-video');if(video)await video.play().catch(()=>{});return;}
 // Keep one playback context for all mirrors of this channel. The native bridge
 // can then replace the AVPlayerItem in place instead of tearing down the view.
 const context='live:'+channel.identity+':'+variantIndex;nativeSession={context,kind:'live',session:{channelId:channel.tvgId||channel.name,title:channel.name}};
 let referer=state.liveLoadedURL;try{referer=new URL(referer).origin+'/';}catch{}
 try{await native.play(route.url,{Referer:referer},{cleanHLS:false,context,frame:playerFrame(),title:channel.name});}catch(error){if(nativeSession?.context===context)await handleLivePlaybackFailure(error.message);}
}
async function handleLivePlaybackFailure(message=''){
 if(state.page!=='live')return;
 const channel=liveChannel(),routes=liveCandidateList(channel);state.liveActive=false;const next=nextUntriedRouteIndex(routes,state.liveTriedURLs);
 if(next>=0){state.liveStatus='线路异常，正在尝试备用源';toast('直播源连接失败，切换备用线路');await playLiveVariant(next,{automatic:true});return;}
 state.liveError=message||'直播源暂时无法播放。可重试或切换线路。';state.liveStatus='播放失败';state.liveActive=false;native.stopLive();nativeSession=null;render();
}
function nativeLiveSnapshot(){
 const channel=liveChannel(),routes=channel?liveCandidateList(channel):[],groupCounts=liveGroupCounts();
 let channels=state.liveChannels;if(state.liveCategory==='__favorites__')channels=channels.filter(liveFavorite);else if(state.liveCategory&&state.liveCategory!=='__all__')channels=channels.filter(item=>item.group===state.liveCategory);
 const query=state.liveSearch.trim().toLocaleLowerCase();if(query)channels=channels.filter(item=>`${item.name} ${item.tvgId} ${item.group}`.toLocaleLowerCase().includes(query));
 const days=[...new Set(state.livePrograms.map(item=>dayKey(item.start)))],today=dayKey(Date.now()),selectedDate=days.includes(state.liveProgramDate)?state.liveProgramDate:days.includes(today)?today:days[0]||today;
 const nativeCount=Math.min(state.liveNativeVisibleCount,state.liveVisibleCount),routesForChannel=channel?liveCandidateList(channel):[],categoryName=state.liveCategory==='__all__'?'全部频道':state.liveCategory==='__favorites__'?'我的收藏':state.liveCategory||'全部频道',groups=state.liveChannels.length?[{name:'全部频道',count:state.liveChannels.length,value:'__all__',active:state.liveCategory==='__all__'},{name:'♥ 我的收藏',count:groupCounts.get('__favorites__')||0,value:'__favorites__',active:state.liveCategory==='__favorites__'},...state.liveGroups.map(name=>({name,count:groupCounts.get(name)||0,value:name,active:state.liveCategory===name}))]:[];return {theme:state.theme,title:channel?.name||'直播',group:channel?.group||'',status:state.liveError||state.liveStatus||'',url:state.liveURL,loading:state.liveLoading,search:state.liveSearch,panel:state.livePanel,category:state.liveCategory,categoryName,filteredChannelCount:channels.length,active:state.liveActive,channelIndex:state.liveCurrentIndex,channelCount:state.liveChannels.length,favoriteCurrent:liveFavorite(channel),groups,channels:channels.slice(0,nativeCount).map(item=>({index:item.index,name:item.name,group:item.group,secure:item.secure,favorite:liveFavorite(item),active:item.index===state.liveCurrentIndex})),hasMore:channels.length>nativeCount,routes:routes.map(item=>({index:routesForChannel.findIndex(route=>route.url===item.url),name:item.name,group:item.group,secure:item.secure,active:item.url===routesForChannel[state.liveVariantIndex]?.url})),programs:state.livePrograms.filter(item=>dayKey(item.start)===selectedDate).map((item,index)=>({index,title:item.title,start:clockTime(item.start),subtitle:item.subtitle||'',description:item.description||''})),selectedProgram:state.liveSelectedProgram?{title:state.liveSelectedProgram.title,subtitle:state.liveSelectedProgram.subtitle||'',description:state.liveSelectedProgram.description||'',start:clockTime(state.liveSelectedProgram.start),stop:clockTime(state.liveSelectedProgram.stop)}:null,selectedRoute:state.liveSelectedRoute?{name:state.liveSelectedRoute.name,group:state.liveSelectedRoute.group,url:state.liveSelectedRoute.url,secure:state.liveSelectedRoute.secure}:null,sheet:state.liveSheet,channelInfo:channel?{name:channel.name,tvgId:channel.tvgId||'未提供',tvgName:channel.tvgName||channel.name,group:channel.group,url:channel.url,epgUrl:state.liveEPGUrl||'未提供'}:null,epgUrl:state.liveEPGUrl||'',epgLoading:state.liveEPGLoading,hasEPG:!!state.liveEPGUrl,selectedDate,days};
}
function liveCurrentProgram(channel=liveChannel()){if(!channel)return null;const key=channel.tvgId||channel.name,progs=state.livePrograms.length?state.livePrograms:(state.liveEPGCache.get(key)||[]),now=Date.now();return progs.find(p=>now>=p.start&&now<p.stop)||null;}
function liveNextProgram(channel=liveChannel()){if(!channel)return null;const key=channel.tvgId||channel.name,progs=state.livePrograms.length?state.livePrograms:(state.liveEPGCache.get(key)||[]),now=Date.now();return progs.find(p=>p.start>now)||null;}
function liveFormatLabel(format=state.liveVideoFormat){if(!format)return '';const dimensions=format.width&&format.height?`${format.width}×${format.height}`:'分辨率未知';return `${dimensions} ${format.codec||''}`.trim();}
window.NativeLiveRequestState=()=>native.syncLive(nativeLiveSnapshot());
window.NativeLiveSnapshot=nativeLiveSnapshot;
window.NativeLiveAction=(act,id='')=>{
 if(act==='live-import'){void loadLivePlaylist(String(id||''));return;}
 if(act==='live-search'){state.liveSearch=String(id||'').trim();state.liveVisibleCount=80;state.liveNativeVisibleCount=40;render();return;}
 if(act==='live-panel'){state.livePanel=String(id||'channels');render();if(state.livePanel==='programs')loadLiveGuide();return;}
 if(act==='live-native-route'){state.liveTriedURLs.clear();state.liveError='';void playLiveVariant(Number(id));return;}
 if(act==='live-more'){state.liveNativeVisibleCount+=40;state.liveVisibleCount=Math.max(state.liveVisibleCount,state.liveNativeVisibleCount);render();return;}
 const button=document.createElement('button');button.dataset.act=act;if(id!==undefined&&id!==null)button.dataset.id=String(id);button.hidden=true;root.append(button);button.click();button.remove();
};
function livePage(){
 const channel=liveChannel(),hasChannels=state.liveChannels.length>0,fmt=liveFormatLabel(),curProg=liveCurrentProgram(channel),nextProg=liveNextProgram(channel);
 const screen=native.native()?`<div id="native-player-slot" class="native-card live-native-card"><span>${channel?e(state.liveStatus||channel.name):'选择频道开始直播'}</span></div>`:state.liveActive&&channel?`<video id="live-video" data-aspect="${e(state.aspectMode)}" controls autoplay playsinline preload="none" src="${e(liveCandidateList(channel)[state.liveVariantIndex]?.url||channel.url)}"></video>`:`<div class="live-screen-placeholder"><span class="live-screen-mark">${channel?e(channel.name.slice(0,2)):'LIVE'}</span><strong>${channel?e(channel.name):'三源直播'}</strong><small>${channel?e(state.liveStatus||'点击播放，开始观看'):hasChannels?'请选择一个频道':'导入 M3U 播放列表即可开始'}</small>${channel&&!state.liveActive?`<button class="live-start" data-act="live-play">▶ 播放直播</button>`:''}</div>`;
 const importForm=`<form id="live-import-form" class="live-import-form" ${state.liveImportOpen?'':'hidden'}><label for="live-playlist-url">M3U 播放列表地址</label><div><input id="live-playlist-url" name="url" type="text" inputmode="url" autocapitalize="off" spellcheck="false" value="${e(state.liveURL)}" placeholder="https:// 或 http:// 播放列表地址" required><button class="live-import-button" type="submit">${state.liveLoading?'正在导入…':'导入 / 更新'}</button><button class="live-reset-button" type="button" data-act="live-reset-default" title="恢复默认直播源">默认源</button></div><small>可省略 http://；导入后保存到本机，打开直播时不自动更新。HTTP 传输未加密；建议优先使用 HTTPS。</small></form>`;
 const panelContent=state.liveLoading&&!hasChannels?`<div class="live-empty"><span class="spinner"></span>正在加载 M3U 频道…</div>`:state.liveError&&!hasChannels?`<div class="live-error"><strong>导入失败</strong><span>${e(state.liveError)}</span><button class="secondary" data-act="live-import-open">检查地址并重试</button></div>`:state.livePanel==='categories'?liveGroupsMarkup():state.livePanel==='programs'?liveProgramsPanel(channel):state.livePanel==='routes'?liveRoutesPanel(channel):liveChannelList();
 const routes=liveCandidateList(channel),routeIndex=routes.findIndex(item=>item.url===routes[state.liveVariantIndex]?.url),selectedRoute=state.liveSelectedRoute||routes[routeIndex>=0?routeIndex:0],programDays=[...new Set(state.livePrograms.map(program=>dayKey(program.start)))],today=dayKey(Date.now()),guideDate=programDays.includes(state.liveProgramDate)?state.liveProgramDate:programDays.includes(today)?today:programDays[0]||today;
 let sheet='';
 if(state.liveSheet==='channel'&&channel)sheet=`<span class="live-eyebrow">频道信息</span><h2>${e(channel.name)}</h2><dl><dt>频道 ID (tvg-id)</dt><dd>${e(channel.tvgId||'未提供')}</dd><dt>频道名称 (tvg-name)</dt><dd>${e(channel.tvgName||channel.name)}</dd><dt>频道分组</dt><dd>${e(channel.group)}</dd><dt>节目单 ID</dt><dd>${e(channel.tvgId||channel.name)}</dd><dt>播放地址</dt><dd class="live-sheet-url">${e(channel.url)}</dd>${state.liveEPGUrl?`<dt>节目单地址</dt><dd class="live-sheet-url">${e(state.liveEPGUrl)}</dd>`:''}</dl><button class="live-sheet-action" data-act="live-sheet-dismiss">完成</button>`;
 else if(state.liveSheet==='program'&&state.liveSelectedProgram)sheet=`<span class="live-eyebrow">节目单详情</span><h2>${e(state.liveSelectedProgram.title)}</h2>${state.liveSelectedProgram.subtitle?`<h3>${e(state.liveSelectedProgram.subtitle)}</h3>`:''}<p>${channel?e(channel.name):''} · ${clockTime(state.liveSelectedProgram.start)} – ${clockTime(state.liveSelectedProgram.stop)}</p>${state.liveSelectedProgram.description?`<p>${e(state.liveSelectedProgram.description)}</p>`:''}${state.liveSelectedProgram.categories?.length?`<div class="live-sheet-tags">${state.liveSelectedProgram.categories.map(label=>`<span>${e(label)}</span>`).join('')}</div>`:''}<button class="live-sheet-action" data-act="live-sheet-dismiss">完成</button>`;
 else if(state.liveSheet==='guide')sheet=`<span class="live-eyebrow">EPG 指南</span><h2>${e(channel?.name||'节目单来源')}</h2><dl><dt>频道 ID (tvg-id)</dt><dd>${e(channel?.tvgId||'未提供')}</dd><dt>频道名称 (tvg-name)</dt><dd>${e(channel?.tvgName||channel?.name||'')}</dd><dt>节目单匹配字段</dt><dd>${channel?.tvgId?'tvg-id':'频道名称'}</dd><dt>匹配值</dt><dd>${e(channel?.tvgId||channel?.name||'')}</dd><dt>选中日期</dt><dd>${e(guideDate)}</dd><dt>EPG 来源</dt><dd class="live-sheet-url">${e(state.liveEPGUrl||'此播放列表未提供')}</dd><dt>已读取节目</dt><dd>${state.livePrograms.length} 条</dd></dl><button class="live-sheet-action" data-act="live-sheet-dismiss">完成</button>`;
 else if(state.liveSheet==='route'&&selectedRoute)sheet=`<span class="live-eyebrow">播放线路</span><h2>${e(selectedRoute.name)}</h2><p>${e(selectedRoute.group)} · ${selectedRoute.secure?'HTTPS':'HTTP · 未加密'}</p><p class="live-sheet-url">${e(selectedRoute.url)}</p><button class="live-sheet-action" data-act="live-route-system" data-id="${selectedRoute.index}">系统播放器 · 自动硬件解码</button><button class="live-sheet-secondary" data-act="live-route-vlc" data-id="${selectedRoute.index}">在 VLC 播放</button><button class="live-sheet-secondary" data-act="live-route-copy" data-id="${selectedRoute.index}">复制线路地址</button>`;
 return `<div class="live-shell"><div class="live-pinned"><header class="live-topbar"><button class="live-back" data-act="live-back" aria-label="返回上一页">‹</button><div class="live-top-title"><strong>${channel?e(channel.name):'直播'}</strong><small>${channel?e(channel.group)+' · '+e(state.liveStatus||'频道'):hasChannels?'已导入 '+state.liveChannels.length+' 个频道':'M3U 直播频道'}</small></div><div class="live-top-actions"><button data-act="live-import-open" aria-label="管理播放源" title="管理 M3U 地址">⊕</button><button data-act="live-favorite-current" aria-label="收藏频道" class="${channel&&liveFavorite(channel)?'active':''}">${channel&&liveFavorite(channel)?'♥':'♡'}</button><button data-act="live-airplay" aria-label="AirPlay 投放">▣</button><button data-act="live-channel-info" aria-label="频道信息">ⓘ</button></div></header>${importForm}<section class="live-player-card"><div class="live-player-screen">${screen}<span class="live-live-badge">${state.liveActive?'● LIVE':'LIVE'}</span>${fmt?`<span class="live-format-badge">${e(fmt)}</span>`:''}${native.native()?'':`<button class="live-fullscreen" data-act="live-fullscreen" aria-label="全屏播放">⛶</button>`}</div><div class="live-now-row">${channel?`${liveLogo(channel)?`<span class="live-now-logo">${liveLogo(channel)}</span>`:`<span class="live-now-logo fallback">${e(channel.name.slice(0,2))}</span>`}<span class="live-now-copy"><strong>${e(channel.name)}</strong><small>${curProg?`正在播出：${e(curProg.title)}${nextProg?` · 即将：${e(nextProg.title)}`:''} · `:``}${e(channel.group)} · ${e(state.liveStatus||'已选择')}</small></span><div class="live-quick-actions"><button class="live-step-btn" data-act="live-step" data-id="-1" title="上一频道" aria-label="上一频道">⏮</button><button class="live-step-btn" data-act="live-step" data-id="1" title="下一频道" aria-label="下一频道">⏭</button><button class="live-step-btn" data-act="player-aspect" title="切换画面比例">${state.aspectMode==='fill'?'铺满':state.aspectMode==='stretch'?'拉伸':'适应'}</button><button class="live-now-play" data-act="live-play">${state.liveActive?'重连':'播放'}</button></div>`:`<span class="live-now-copy"><strong>选择频道开始观看</strong><small>${e(state.liveStatus||'支持 M3U / M3U8')}</small></span>`}</div></section>${state.liveError&&hasChannels?`<div class="live-inline-error" role="status">${e(state.liveError)}</div>`:''}<nav class="live-panel-tabs" data-live-scroll="panel-tabs" aria-label="直播内容"><button data-act="live-panel" data-id="categories" class="${state.livePanel==='categories'?'active':''}">分类</button><button data-act="live-panel" data-id="channels" class="${state.livePanel==='channels'?'active':''}">频道</button><button data-act="live-panel" data-id="programs" class="${state.livePanel==='programs'?'active':''}">节目</button><button data-act="live-panel" data-id="routes" class="${state.livePanel==='routes'?'active':''}">${routeIndex>=0?`${routeIndex+1}/${routes.length} `:'0/0 '}线路</button></nav></div>${state.livePanel==='channels'&&hasChannels?`<div class="live-category-row" data-live-scroll="channel-categories"><button data-act="live-category" data-id="__all__" class="${state.liveCategory==='__all__'?'active':''}">全部频道</button><button data-act="live-category" data-id="__favorites__" class="${state.liveCategory==='__favorites__'?'active':''}">♥ 收藏</button>${state.liveGroups.slice(0,12).map(group=>`<button data-act="live-category" data-id="${e(group)}" class="${state.liveCategory===group?'active':''}">${e(group)}</button>`).join('')}${state.liveGroups.length>12?`<button data-act="live-panel" data-id="categories">全部分类 ›</button>`:''}</div>`:''}<section class="live-panel-content">${panelContent}</section>${state.liveSheet?`<div class="live-sheet-backdrop" data-act="live-sheet-dismiss"><section class="live-sheet-card"><button class="live-sheet-close" data-act="live-sheet-dismiss" aria-label="关闭">×</button>${sheet}</section></div>`:''}</div>`;
}

const SITE_FEATURES = {
 kkapp:{tag:'主线片库 · 自动 HLS 净化',protocol:'AES-CBC 加密 · 静态 CDN 镜像'},
 ncat:{tag:'网飞专区 · 海外精选剧集',protocol:'AES-CBC 签名 · 专线端口'},
 happ:{tag:'经典院线 · 高清多线路',protocol:'AES-CBC 签名 · 备用多集群'},
 souju:{tag:'AI 智能索引 · 聚合直连',protocol:'HMAC-SHA256 · 动态令牌'},
 yqk:{tag:'蓝光秒播 · 多码率自适应',protocol:'动态 API 轮询 · 分布式 CDN'},
 qntv:{tag:'综合影视 · 体育竞技频道',protocol:'动态 API 轮询 · 双通道防盗链'},
 dyls:{tag:'4K 原画 · 院线大片首发',protocol:'RSA+AES 双重加密 · 接口混淆'},
 kanju:{tag:'聚合解析 · 智能冗余直连',protocol:'HMAC 签名鉴权 · 双通道解析'}
};

async function probeSite(siteObj,{timeout=6000}={}){
 const c=clients.get(siteObj.id);if(!c)return {ok:false,ms:0,status:'未注册'};
 const start=Date.now(),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  if(!c.config)await c.bootstrap(ctrl.signal);
  else await c.home(ctrl.signal);
  const ms=Math.max(1,Date.now()-start);
  const result={ok:true,ms,status:'握手正常',timestamp:Date.now()};
  state.siteHealth[siteObj.id]=result;
  write('siteHealth',state.siteHealth);
  return result;
 }catch(error){
  const ms=Date.now()-start,isTimeout=error.name==='AbortError'||/超时/i.test(error.message);
  const result={ok:false,ms:isTimeout?timeout:ms,status:isTimeout?'响应超时':(error.message||'连接失败').slice(0,32),timestamp:Date.now()};
  state.siteHealth[siteObj.id]=result;
  write('siteHealth',state.siteHealth);
  return result;
 }finally{
  clearTimeout(timer);
 }
}

async function probeAllSites(){
 if(state.siteProbing)return;
 state.siteProbing=true;render();
 toast('正在并发探测全部 8 大片源连通性…');
 let fastName='',fastMs=Infinity;
 await Promise.all(sites.map(async s=>{
  const res=await probeSite(s);
  if(res.ok&&res.ms<fastMs){fastMs=res.ms;fastName=s.name;}
  if(['me','settings'].includes(state.page))render();
 }));
 state.siteProbing=false;render();
 if(native.native())native.syncPage(nativePageSnapshot());
 toast(fastName?`全网测速完成 · 最快片源：${fastName} (${fastMs} ms)`:'全网测速完成');
}

function settings(){
 const c=client(),user=c.user,supportsAcc=c.config?.supportsAccount!==false;
 const accountTitle=!supportsAcc?'公开直连片库':user?(c.sessionKind==='guest'?'访客会话已连接':'个人账号已登录'):'未建立会话';
 const accountDetail=!supportsAcc?'无需登录即可浏览与播放全部公开资源':user&&c.sessionKind!=='guest'?(`${user.nickname||user.account||'已登录'} · ${site().name}`):'搜索与播放会自动建立匿名访客会话；原站要求权限时可登录';
 const lineKinds=[['cache','片库数据节点'],['logic','搜索与鉴权节点']];
 const favCount=validSavedRows('favorites').length,histCount=validSavedRows('history').length,sec=state.settingsSection||'all';
 const showSec=id=>sec==='all'||sec===id?'':'hidden';
 const aspectLabel=state.aspectMode==='fill'?'铺满裁剪':state.aspectMode==='stretch'?'全屏拉伸':'适应比例';
 return `<div class="settings-page">
  <section class="settings-dashboard" aria-label="系统状态总览">
   <div class="settings-stat-card accent-card">
    <span class="stat-eyebrow">当前片源 · SOURCE</span>
    <strong>${e(site().name)}</strong>
    <small>${e(accountTitle)}</small>
   </div>
   <div class="settings-stat-card">
    <span class="stat-eyebrow">播放内核 · ENGINE</span>
    <strong>${state.playbackRate}× · ${aspectLabel}</strong>
    <small>片头 +${state.skipIntroSeconds}s · ${state.skipOutroSeconds>0?('片尾 -'+state.skipOutroSeconds+'s'):'片尾正常'}</small>
   </div>
   <div class="settings-stat-card">
    <span class="stat-eyebrow">广告净化 · GUARD</span>
    <strong>${state.cleanHLS?'智能守护已开启':'净化已暂停'}</strong>
    <small>${state.removedAdSegments>0?(`本次已拦截 ${state.removedAdSegments} 段 (${Math.round(state.removedAdSeconds)}s)`):'自动剥离切片广告'}</small>
   </div>
   <div class="settings-stat-card">
    <span class="stat-eyebrow">本机片库 · STORAGE</span>
    <strong>${favCount} 收藏 · ${histCount} 记录</strong>
    <small>搜索词 ${state.searchHistory.length} 条 · 独立沙盒存储</small>
   </div>
  </section>

  <nav class="settings-nav-pills" role="tablist" aria-label="设置分组筛选">
   ${[['all','全部设置'],['playback','▶ 播放引擎'],['appearance','◐ 外观与视图'],['network','⌁ 线路与账户'],['storage','◎ 存储与关于']].map(([id,label])=>`<button type="button" role="tab" aria-selected="${sec===id}" class="settings-pill ${sec===id?'active':''}" data-act="settings-section" data-id="${id}">${label}</button>`).join('')}
  </nav>

  <section class="settings-card" aria-labelledby="settings-playback-title" ${showSec('playback')}>
   <div class="settings-card-heading">
    <span class="settings-icon">▶</span>
    <div><h2 id="settings-playback-title">播放体验与引擎增强</h2><p>定制双核解码、智能去广告、连播及手势步长</p></div>
    <button type="button" class="settings-action quiet" data-act="reset-playback-prefs">恢复默认</button>
   </div>
   <div class="settings-switch-grid">
    <label class="settings-switch-tile ${state.cleanHLS?'is-on':''}">
     <div class="switch-tile-top">
      <strong>HLS 广告智能净化</strong>
      <input type="checkbox" data-clean-hls ${state.cleanHLS?'checked':''} aria-label="过滤播放清单广告">
     </div>
     <small>自动移除点播 M3U8 切片广告，保留正片时间轴${state.removedAdSegments>0?(` · 已净 ${state.removedAdSegments} 段`):''}</small>
    </label>
    <label class="settings-switch-tile ${state.autoNext?'is-on':''}">
     <div class="switch-tile-top">
      <strong>剧集自动无缝连播</strong>
      <input type="checkbox" data-auto-next ${state.autoNext?'checked':''} aria-label="自动连播下一集">
     </div>
     <small>单集播放完毕或到达片尾阈值时自动切入下一集</small>
    </label>
   </div>
   <div class="settings-note">提示：播放画面支持左右双击快进/快退 15 秒、长按画面开启 2.0× 临时倍速播放。如个别源出现跳段可关闭广告净化重试。</div>
   <div class="settings-option">
    <div class="settings-label"><strong>默认播放倍速</strong><small>支持播放中在座舱栏实时循环切换</small></div>
    <div class="settings-segmented">${[0.75,1,1.25,1.5,2].map(rate=>`<button type="button" class="${state.playbackRate===rate?'active':''}" data-act="playback-rate-btn" data-id="${rate}" aria-pressed="${state.playbackRate===rate}">${rate}×</button>`).join('')}</div>
    <select data-player-rate aria-label="默认播放倍速" hidden>${[0.5,0.75,1,1.25,1.5,2].map(rate=>`<option value="${rate}" ${rate===state.playbackRate?'selected':''}>${rate}×</option>`).join('')}</select>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>默认画面比例</strong><small>适应原始比例、全屏裁剪铺满或拉伸填充</small></div>
    <div class="settings-segmented">${[['fit','适应'],['fill','铺满'],['stretch','拉伸']].map(([mode,label])=>`<button type="button" class="${state.aspectMode===mode?'active':''}" data-act="aspect-setting" data-id="${mode}" aria-pressed="${state.aspectMode===mode}">${label}</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>跳过片头步长</strong><small>点击座舱栏“跳过片头”单次快进秒数</small></div>
    <div class="settings-segmented">${[60,90,120].map(sec=>`<button type="button" class="${state.skipIntroSeconds===sec?'active':''}" data-act="skip-intro-setting" data-id="${sec}" aria-pressed="${state.skipIntroSeconds===sec}">${sec}秒</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>自动跳过片尾</strong><small>长视频距结束剩余指定秒数时自动切下一集</small></div>
    <div class="settings-segmented">${[[0,'关闭'],[60,'60秒'],[90,'90秒'],[120,'120秒']].map(([sec,lbl])=>`<button type="button" class="${state.skipOutroSeconds===sec?'active':''}" data-act="skip-outro-setting" data-id="${sec}" aria-pressed="${state.skipOutroSeconds===sec}">${lbl}</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>睡眠定时停播</strong><small>倒计时结束或本集播完后自动暂停点播与直播</small></div>
    <div class="settings-segmented">${[['off','关闭'],['episode','本集完'],['15','15分'],['30','30分'],['60','60分']].map(([m,lbl])=>`<button type="button" class="${state.sleepTimerMode===m?'active':''}" data-act="sleep-timer-setting" data-id="${m}" aria-pressed="${state.sleepTimerMode===m}">${lbl}</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>播放诊断</strong><small>最近 20 条播放事件（开始播放、卡顿、改用软解、失败），仅保存在本机</small></div>
    <button type="button" class="settings-action" data-act="page" data-id="diagnostics">查看诊断日志</button>
   </div>
  </section>

  <section class="settings-card" aria-labelledby="settings-appearance-title" ${showSec('appearance')}>
   <div class="settings-card-heading">
    <span class="settings-icon">◐</span>
    <div><h2 id="settings-appearance-title">外观与片库视图</h2><p>切换沉浸式日夜主题、海报列数与内容分级</p></div>
   </div>
   <div class="theme-picker-grid" role="group" aria-label="全局主题选择">
    <button type="button" class="theme-card light-preview ${state.theme==='white'?'active':''}" data-act="theme" data-id="white" aria-pressed="${state.theme==='white'}">
     <div class="theme-swatch"><span class="sw-bg"></span><span class="sw-accent"></span></div>
     <div class="theme-meta"><strong>浅色晨曦</strong><small>明亮日间视图</small></div>
     <span class="theme-check">${state.theme==='white'?'✓':'○'}</span>
    </button>
    <button type="button" class="theme-card dark-preview ${state.theme==='black'?'active':''}" data-act="theme" data-id="black" aria-pressed="${state.theme==='black'}">
     <div class="theme-swatch"><span class="sw-bg"></span><span class="sw-accent"></span></div>
     <div class="theme-meta"><strong>深邃影院</strong><small>暗光沉浸视图</small></div>
     <span class="theme-check">${state.theme==='black'?'✓':'○'}</span>
    </button>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>每行海报密度</strong><small>首页、发现与分类页网格列数 · 当前 ${state.columns} 列</small></div>
    <div class="settings-segmented four">${['3','4','5','6'].map(value=>`<button type="button" class="${state.columns===value?'active':''}" data-act="columns" data-id="${value}" aria-pressed="${state.columns===value}">${value}列</button>`).join('')}</div>
   </div>
   <div class="settings-option settings-age-row">
    <div class="settings-label"><strong>成人分类 (18+)</strong><small>${state.adultEnabled?'已启用 · 显示片源提供的 18+ 频道':'默认隐藏 · 过滤片源中的成人分级内容'}</small></div>
    <button type="button" class="settings-action ${state.adultEnabled?'quiet':''}" data-act="adult-toggle">${state.adultEnabled?'关闭 18+':'启用 18+'}</button>
   </div>
   ${state.showAgeGate?`<div class="agebackdrop" data-act="age-cancel"><section class="agegate" role="dialog" aria-modal="true" aria-labelledby="age-title"><span class="agebadge">18+</span><h2 id="age-title">成人分类提示</h2><p>此分类可能包含仅适合成年人的内容。继续前请确认你已年满 18 周岁，并愿意自行承担浏览后果。站点提供的内容仍受当地法律和站点规则约束。</p><button class="primary" data-act="age-confirm">我已年满 18 周岁，继续</button><button class="secondary" data-act="age-cancel">返回</button></section></div>`:''}
  </section>

  <section class="settings-card site-connectivity-card" aria-labelledby="settings-sites-connectivity-title" ${showSec('network')}>
   <div class="settings-card-heading">
    <span class="settings-icon">⚡</span>
    <div><h2 id="settings-sites-connectivity-title">全网片源连通性与健康监测</h2><p>实时并发探测全部 8 大内置片源 API 与 CDN 握手延迟 · 智能推荐极速低延迟片源</p></div>
    <div class="settings-heading-btns">
     <button type="button" class="settings-action" data-act="probe-all-sites" ${state.siteProbing?'disabled':''}>${state.siteProbing?'⚡ 探测中…':'⚡ 全网一键测速'}</button>
     <button type="button" class="settings-action quiet" data-act="clear-site-health" title="清空测速历史">重置</button>
    </div>
   </div>
   ${(()=>{
    const healthEntries=Object.entries(state.siteHealth||{}).map(([id,h])=>({id,...h,site:sites.find(s=>s.id===id)})).filter(x=>x.site);
    const healthy=healthEntries.filter(x=>x.ok).sort((a,b)=>a.ms-b.ms);
    const fastest=healthy[0],curHealth=state.siteHealth?.[state.site];
    if(!fastest)return '';
    if(fastest.id!==state.site){
     return `<div class="site-recommend-banner alert"><span class="recommend-badge">⚡ 极速推荐</span><div class="recommend-info"><strong>检测到【${e(fastest.site.name)}】响应最快 · 延迟仅 ${fastest.ms} ms</strong><small>当前【${e(site().name)}】${curHealth?(curHealth.ok?`延迟 ${curHealth.ms} ms`:`异常 (${e(curHealth.status)})`):'未测'}。一键切换可显著降低海报与视频加载等待时间。</small></div><button type="button" class="settings-action" data-act="source" data-id="${e(fastest.id)}">立即切换</button></div>`;
    }
    return `<div class="site-recommend-banner success"><span class="recommend-badge">✓ 状态极佳</span><div class="recommend-info"><strong>当前使用的【${e(site().name)}】连通性最优 (${fastest.ms} ms)</strong><small>接口握手与媒体分发延迟极低，建议继续作为主用片源。</small></div></div>`;
   })()}
   <div class="site-connectivity-grid" role="group" aria-label="全网片源健康度列表">
    ${sites.map(s=>{
     const h=state.siteHealth?.[s.id],isCurrent=s.id===state.site,feat=SITE_FEATURES[s.id]||{tag:'影视片源',protocol:'HTTPS 安全直连'};
     let originHost=s.origin;try{originHost=new URL(s.origin).host;}catch{}
     const latencyClass=!h?'none':h.ok?(h.ms<300?'fast':h.ms<800?'medium':'slow'):'error';
     const latencyText=!h?'○ 未检测':h.ok?`● ${h.ms} ms · ${h.ms<300?'极速':h.ms<800?'良好':'较慢'}`:`✕ ${e(h.status||'连接失败')}`;
     return `<div class="site-conn-tile ${isCurrent?'is-current':''} ${h?.ok?'is-healthy':''}">
      <div class="site-conn-header">
       <div class="site-conn-title-group">
        <strong>${e(s.name)}</strong>
        ${isCurrent?'<span class="site-curr-tag">当前主源</span>':''}
       </div>
       <span class="site-latency-pill ${latencyClass}">${latencyText}</span>
      </div>
      <div class="site-conn-meta">
       <span class="site-conn-domain" title="${e(s.origin)}">🌐 ${e(originHost)}</span>
       <span class="site-conn-feature">${e(feat.tag)}</span>
       <span class="site-conn-protocol">${e(feat.protocol)}</span>
      </div>
      <div class="site-conn-footer">
       <button type="button" class="site-probe-btn" data-act="probe-site" data-id="${e(s.id)}" title="测试此站点连通性">⚡ 测速</button>
       ${isCurrent?`<button type="button" class="site-switch-btn current" disabled>✓ 正在使用</button>`:`<button type="button" class="site-switch-btn" data-act="source" data-id="${e(s.id)}" title="切换为主片源">一键切换</button>`}
      </div>
     </div>`;
    }).join('')}
   </div>
  </section>

  <section class="settings-card" aria-labelledby="settings-network-title" ${showSec('network')}>
   <div class="settings-card-heading">
    <span class="settings-icon">⌁</span>
    <div><h2 id="settings-network-title">当前片源节点监测</h2><p>当前片源：${e(site().name)} · 点击节点可手动锁定优先线路</p></div>
    <button type="button" class="settings-action" data-act="probe-lines">⚡ 节点测速</button>
   </div>
   <div class="settings-lines">${lineKinds.map(([kind,label])=>`<div class="settings-line-group"><h3>${label}</h3>${(c.config?.urls?.[kind]||[]).filter(url=>{try{return new URL(url).protocol==='https:';}catch{return false;}}).slice(0,5).map(url=>{const health=c.health.find(item=>item.url===url&&item.kind===kind),preferred=c.preferred[kind]===url;return `<button type="button" class="settings-line ${preferred?'is-preferred':''}" data-act="prefer-line" data-kind="${kind}" data-url="${e(url)}"><span class="settings-line-state ${preferred?'preferred':health?.ok?'available':health?'unavailable':''}">${preferred?'★ 优先':health?health.ok?`● ${health.ms} ms`:'✕ 暂不可用':'○ 未检测'}</span><strong>${e(new URL(url).host)}</strong><span class="settings-line-mark">${preferred?'✓':'›'}</span></button>`;}).join('')||'<p class="settings-empty">暂无可用线路</p>'}</div>`).join('')}</div>
  </section>

  <section class="settings-card" aria-labelledby="settings-account-title" ${showSec('network')}>
   <div class="settings-card-heading">
    <span class="settings-icon">◎</span>
    <div><h2 id="settings-account-title">源站会话与账户授权</h2><p>${e(accountTitle)} · ${e(accountDetail)}</p></div>
   </div>
   ${!supportsAcc?`<div class="settings-public-banner"><span>✓</span><div><strong>当前片源采用公开直连协议</strong><small>所有公开剧集均可直接播放；若个别资源提示客户端或会员限制，为源站固有规则。</small></div></div>`:user&&c.sessionKind!=='guest'?`<div class="settings-account-state"><span class="settings-status-dot"></span><span>${e(user.nickname||user.account||'已连接')}</span><button class="settings-action quiet" data-act="logout">退出登录</button></div>`:`<p class="settings-help">搜索与播放会自动建立访客会话。原站明确要求账号时，可在这里登录。</p><form id="login-form" class="settings-login-form"><input name="account" placeholder="原站账号" autocomplete="username" required><input name="password" type="password" placeholder="原站密码" autocomplete="current-password" required><div><button class="primary" type="submit">登录账号</button><button class="secondary" type="button" data-act="anonymous">${user?'刷新访客会话':'启用访客模式'}</button></div></form>`}
   ${state.authError?`<p class="settings-error" role="alert">${e(state.authError)}</p>`:''}${!supportsAcc?'':`<p class="settings-footnote">密码不会保存。iPhone 登录会话加密保存在系统钥匙串，各来源相互隔离。</p>`}
  </section>

  <section class="settings-card settings-about" aria-labelledby="settings-storage-title" ${showSec('storage')}>
   <div class="settings-card-heading">
    <span class="settings-icon">✦</span>
    <div><h2 id="settings-storage-title">存储维护与关于应用</h2><p>版本 v${"1.0.7"} · iOS 15+ 双核渲染架构</p></div>
   </div>
   <div class="settings-maintenance-grid">
    <button type="button" class="maintenance-btn" data-act="clear-runtime-cache">
     <strong>清理运行缓存</strong>
     <small>释放内存海报与页面快照</small>
    </button>
    <button type="button" class="maintenance-btn" data-act="clear-search-history-settings">
     <strong>清空搜索记录</strong>
     <small>已存 ${state.searchHistory.length} 条搜索关键词</small>
    </button>
    <button type="button" class="maintenance-btn" data-act="refresh-config">
     <strong>同步站点配置</strong>
     <small>重新拉取当前片源接口目录</small>
    </button>
   </div>
   <p>内置八大独立影视片源适配器、本地 HLS 广告清洗代理与 AVPlayer / Cicada 硬件+软解双冗余播放引擎。</p>
  </section>
 </div>`;
}
function isPreviewPlayback(){return state.detail?.playSources?.[state.line]?.preview===true||state.playURLs[state.playIndex]?.preview===true;}
function resumeEntryForDetail(d=state.detail){
 if(!d)return null;
 const row=validSavedRows('history').find(x=>x.siteId===state.site&&String(x.movie?.id)===String(d.id));
 if(!row)return null;
 const list=d.playSources?.[state.line]?.list||[];
 let index=list.findIndex(ep=>String(ep.id)===String(row.episodeId));
 if(index<0&&row.episodeTitle)index=matchingEpisode({id:row.episodeId,title:row.episodeTitle},list,{singleMovie:Number(d.channelId)===1&&list.length===1,singleEpisodeSource:list.length===1});
 return {row,index,episode:index>=0?list[index]:null};
}
function sleepTimerLabel(){
 if(state.sleepTimerMode==='episode')return '🌙 播完本集';
 if(state.sleepTimerEndAt>Date.now()){const mins=Math.max(1,Math.ceil((state.sleepTimerEndAt-Date.now())/60000));return `🌙 ${mins}m`;}
 return '🌙 定时';
}
function applySleepTimer(mode){
 state.sleepTimerMode=mode;
 state.sleepTimerEndAt=['15','30','60'].includes(String(mode))?Date.now()+Number(mode)*60000:0;
 const label=mode==='off'?'已关闭睡眠定时':mode==='episode'?'已开启：播完本集后自动停播':`已开启：${mode} 分钟后自动暂停播放`;
 showPlayerHUD(label);toast(label);
 render({liveFast:state.page==='live'});
}
function cycleSleepTimer(){
 const modes=state.page==='detail'?['off','episode','15','30','60']:['off','15','30','60'];
 const cur=state.sleepTimerMode==='off'||(state.sleepTimerMode!=='episode'&&state.sleepTimerEndAt<=Date.now())?'off':state.sleepTimerMode;
 const next=modes[(modes.indexOf(cur)+1)%modes.length];
 applySleepTimer(next);
}
function cancelEpisodePrefetch(){
 clearTimeout(prefetchTimer);prefetchTimer=null;
 prefetchController?.abort();prefetchController=null;
}
function scheduleNextEpisodePrefetch(detailObj,lineIdx,nextEpIdx){
 cancelEpisodePrefetch();
 const line=detailObj?.playSources?.[lineIdx];
 if(!line?.list?.[nextEpIdx])return;
 const cacheKey=`${state.site}:${detailObj.id}:${lineIdx}:${nextEpIdx}`;
 const existing=episodePrefetchCache.get(cacheKey);
 if(existing&&Date.now()-existing.timestamp<180000){state.nextEpisodeReady=true;const badge=$('.cockpit-prefetch');if(badge)badge.hidden=false;return;}
 const siteId=state.site,vodId=detailObj.id,c=client();
 prefetchTimer=setTimeout(async()=>{
  if(state.page!=='detail'||state.site!==siteId||String(state.detail?.id)!==String(vodId))return;
  const ctrl=new AbortController();prefetchController=ctrl;
  try{
   const res=await resolvePlayableEpisode(c,detailObj,lineIdx,nextEpIdx,ctrl.signal,()=>{});
   if(ctrl.signal.aborted||state.site!==siteId||String(state.detail?.id)!==String(vodId))return;
   episodePrefetchCache.delete(cacheKey);
   episodePrefetchCache.set(cacheKey,{result:res,timestamp:Date.now()});
   while(episodePrefetchCache.size>8)episodePrefetchCache.delete(episodePrefetchCache.keys().next().value);
   state.nextEpisodeReady=true;
   const badge=$('.cockpit-prefetch');if(badge)badge.hidden=false;
  }catch{}
 },2200);
}

function detail(){
 const d=state.detail;
 if(state.loading&&!d)return `<div class="content detail-content">${loading()}</div>`;
 if(!d)return `<div class="content detail-content">${notice('无法读取详情',state.error)}</div>`;
 const movie={...d,id:String(d.id),labels:(d.labels||[]).map(x=>x.name||x),subtitle:d.bottomLabel,badge:d.scoreText},line=d.playSources?.[state.line],episodes=line?.list||[],favorite=validSavedRows('favorites').some(x=>x.siteId===state.site&&String(x.movie.id)===movie.id),resumeInfo=resumeEntryForDetail(d);
 const year=typeof d.year==='object'?(d.year?.name||d.year?.text||d.year?.id||''):d.year;
 const toList=v=>Array.isArray(v)?v.map(x=>x?.name||x):v?[v]:[];const metadata=[year,...toList(d.area),...toList(d.language),d.channelName].filter(Boolean).join(' · ');
 const activeURL=state.playURLs[state.playIndex]?.url||'',isHLS=/\.m3u8/i.test(activeURL),currentEpIdx=episodes.findIndex(x=>x.id===state.episode?.id),hasNextEp=currentEpIdx>=0&&currentEpIdx<episodes.length-1,bwText=state.playBandwidth>=1000000?`${(state.playBandwidth/1000000).toFixed(1)} Mbps`:state.playBandwidth>0?`${Math.round(state.playBandwidth/1000)} kbps`:'';
 const player=state.playURLs.length?`<div class="playerbox"><div class="player-video-wrap">${native.native()?`<div id="native-player-slot" class="native-card" aria-label="播放器"><span>正在加载播放器…</span></div>`:`<video id="video" data-aspect="${e(state.aspectMode)}" controls playsinline preload="auto" x-webkit-airplay="allow" src="${e(activeURL)}" poster="${e(posterURLsFor(movie,state.site)[0]||'')}"></video>`}<div id="player-hud" class="player-hud" hidden></div></div><div class="playtoolbar"><span class="playing-title">${e(state.episode?.title||'')}</span><select id="source-line" aria-label="切换播放源">${(d.playSources||[]).map((source,i)=>`<option value="${i}" ${state.line===i?'selected':''}>${e(source.name||'线路 '+(i+1))}</option>`).join('')}</select>${state.playURLs.length>1?`<select id="play-line" aria-label="当前集备用地址">${state.playURLs.map((p,i)=>`<option value="${i}" ${i===state.playIndex?'selected':''}>${e(p.name||'地址 '+(i+1))}</option>`).join('')}</select>`:''}${native.native()?'<span class="subtle">画面内可切换全屏</span>':'<button data-act="native-player">全屏</button>'}</div><div class="player-cockpit" role="toolbar" aria-label="增强播放控制"><div class="cockpit-controls"><button type="button" class="cockpit-btn" data-act="player-seek" data-id="-15" title="快退 15 秒">↺ -15s</button><button type="button" class="cockpit-btn accent" data-act="player-skip-intro" title="跳过片头">跳过片头</button><button type="button" class="cockpit-btn" data-act="player-seek" data-id="15" title="快进 15 秒">↻ +15s</button>${hasNextEp?`<button type="button" class="cockpit-btn accent" data-act="episode-step" data-id="1" title="播放下一集">⏭ 下一集</button>`:``}<button type="button" class="cockpit-btn" data-act="player-aspect" title="切换画面比例">画面: ${state.aspectMode==='fill'?'铺满':state.aspectMode==='stretch'?'拉伸':'适应'}</button><button type="button" class="cockpit-btn ${state.playerMuted?'accent':''}" data-act="player-mute" title="静音切换">${state.playerMuted?'🔇 已静音':'🔊 声音'}</button><button type="button" class="cockpit-btn ${state.sleepTimerMode!=='off'?'accent':''}" data-act="player-sleep-timer" title="睡眠定时关闭">${sleepTimerLabel()}</button><button type="button" class="cockpit-btn" data-act="player-copy-url" title="复制当前视频流地址">🔗 复制流</button>${native.native()?`<button type="button" class="cockpit-btn" data-act="player-offline-cache" title="缓存本集到本地">缓存本集</button><button type="button" class="cockpit-btn" data-act="player-open-vlc" title="在 VLC 中打开">VLC</button>`:`<button type="button" class="cockpit-btn ${state.playerMirrored?'accent':''}" data-act="player-mirror" title="水平镜像翻转">⇄ 镜像</button><button type="button" class="cockpit-btn" data-act="player-pip" title="画中画播放">画中画</button>`}</div><div class="cockpit-rates" role="group" aria-label="播放倍速">${[0.75,1,1.25,1.5,2].map(rate=>`<button type="button" class="cockpit-rate-btn ${state.playbackRate===rate?'active':''}" data-act="playback-rate-btn" data-id="${rate}" aria-pressed="${state.playbackRate===rate}">${rate}×</button>`).join('')}</div><div class="cockpit-telemetry"><span class="cockpit-badge">${isHLS?'HLS 直连':'MP4 直连'}${state.playQualityLabel?` · ${e(state.playQualityLabel)}`:''}${bwText?` (${bwText})`:''}${state.playLatencyMs?` · 响应 ${state.playLatencyMs}ms`:''}</span>${state.removedAdSegments>0?`<span class="cockpit-badge ad-clean">✓ 已净化 ${state.removedAdSegments} 段广告 (${Math.round(state.removedAdSeconds)}s)</span>`:state.cleanHLS&&isHLS?`<span class="cockpit-badge ad-clean">✓ 广告净化守护中</span>`:''}<span class="cockpit-badge prefetch-ready cockpit-prefetch" ${state.nextEpisodeReady?'':'hidden'}>⚡ 下集已预热</span></div></div></div>`:'';
 const directors=d.directors?.map(x=>x.name||x).filter(Boolean)||[],actors=d.actors?.map(x=>x.name||x).filter(Boolean)||[];
 const seasons=(Array.isArray(d.seasons)?d.seasons:[]).filter(season=>season&&season.id!=null&&String(season.id));
 return `<div class="content detail-content">${player}${state.error?notice('选集读取失败',state.error):''}${state.playError?notice('暂时无法播放',state.playError,/登录|账号|账户|会员|付费/.test(state.playError)?'account':'retry-play',/登录|账号|账户|会员|付费/.test(state.playError)?'账户设置':'重试播放'):''}
  <section class="detail-hero">${picture(movie,true)}<div class="detail-hero-shade"></div><div class="detail-hero-copy"><div class="detail-kicker">${e(site().name)} · ${e(d.channelName||'影片')}</div><h1>${e(d.title)}</h1><p class="detail-meta">${e(metadata||'')}</p>${d.scoreText?`<span class="detail-score">${e(d.scoreText)}</span>`:''}<div class="detail-actions"><button class="detail-play" data-act="play-first">${icon('play')}<span>${isPreviewPlayback()?'播放试看':state.episode?'继续播放':resumeInfo?.episode?`续播 ${e(resumeInfo.episode.title||resumeInfo.row.episodeTitle||'')}`:'播放'}</span></button><button class="detail-favorite" data-act="favorite-detail" aria-pressed="${favorite}">${icon('star')}<span>${favorite?'已收藏':'收藏'}</span></button><button class="detail-secondary-action" data-act="scroll-episodes">选集 <span>${Number(line?.total)||episodes.length} 集</span></button></div></div></section>
  ${movie.labels.length?`<div class="detail-tags">${movie.labels.slice(0,8).map(label=>`<span>${e(label)}</span>`).join('')}</div>`:''}
  <section class="detail-section synopsis-section"><div class="detail-section-heading"><h2>剧情简介</h2><span>${e(d.channelName||'')}</span></div><p class="detailsummary" id="summary">${e(d.summary||'暂无简介')}</p>${String(d.summary||'').length>68?`<button class="summary-toggle" data-act="expand-summary">展开简介 <span>⌄</span></button>`:``}</section>
  ${(directors.length||actors.length)?`<section class="detail-section cast-section"><div class="detail-section-heading"><h2>演职员</h2><span>${directors.length+actors.length} 位</span></div><div class="cast-list">${directors.slice(0,4).map(dir=>`<span role="button" tabindex="0" class="cast-chip director-chip" data-act="actor-search" data-id="${e(dir)}" title="搜索导演 ${e(dir)} 的作品">导演 · ${e(dir)}</span>`).join('')}${actors.slice(0,12).map(actor=>`<span role="button" tabindex="0" class="cast-chip" data-act="actor-search" data-id="${e(actor)}" title="搜索 ${e(actor)} 的作品">${e(actor)}</span>`).join('')}</div></section>`:''}
  ${seasons.length>1?`<section class="detail-section season-section"><div class="detail-section-heading"><h2>季度与版本</h2><span>${seasons.length} 项</span></div><div class="sourcebuttons route-grid" role="group" aria-label="季度与版本">${seasons.map(season=>{const selected=season.selected===true||String(season.id)===String(d.id);return `<button class="route-card ${selected?'active':''}" data-act="season" data-id="${e(season.id)}" aria-pressed="${selected}"><strong>${e(season.title||season.name||'季度')}</strong></button>`;}).join('')}</div></section>`:''}
  <section class="detail-section playback-section" id="episode-list"><div class="detail-section-heading"><div><h2>选集播放</h2><span class="section-note">${line?.name?e(line.name)+' · ':''}${Number(line?.total)||episodes.length} 集</span></div>${episodes.length?`<span class="selected-episode">${state.episode?`正在播放 ${e(state.episode.title||'')}`:'选择一集开始播放'}</span>`:''}</div><p class="caption route-help">播放出错时会尝试同一集的备用线路；手动换线也会尽量保留当前集数。</p><div class="sourcebuttons route-grid" role="group" aria-label="播放线路">${(d.playSources||[]).map((source,i)=>`<button class="route-card ${state.line===i?'active':''}" data-act="play-source" data-id="${i}" aria-pressed="${state.line===i}"><strong>${e(source.name||'线路 '+(i+1))}</strong><span>${state.line===i?'✓ 已选 · ':''}${Number(source.total)||source.list?.length?((Number(source.total)||source.list.length)+' 集'):'待加载选集'}${source.siteId===client().preferredPlaybackSiteId?' · 上次可用':''}</span></button>`).join('')}</div>${state.loading?`<span class="spinner"></span><p id="playback-status" class="caption playback-status" role="status">${e(state.playStatus||'正在加载选集…')}</p>`:''}${episodes.length?episodesPanel(line,episodes):notice('这条线路暂无选集','可尝试切换上方播放线路。','', '')}</section>
 </div>`;
}
function render(options={}){
 for(const row of pageRoot.querySelectorAll('[data-shelf]'))shelfOffsets.set(row.dataset.shelf,row.scrollLeft);
 for(const row of pageRoot.querySelectorAll('[data-live-scroll]'))liveScrollOffsets.set(row.dataset.liveScroll,row.scrollLeft);
 const renderKey=pageRenderKey(),previousKey=activeRenderKey,switched=renderKey!==previousKey;
 if(!native.native()&&switched&&previousKey&&activeRenderReady&&pageRoot.firstElementChild){pageDOMCache.set(previousKey,{node:pageRoot.firstElementChild,images:new Map(state.imageMap),scrollY:pageScrollCache.get(previousKey)??window.scrollY});while(pageDOMCache.size>3){const oldest=pageDOMCache.keys().next().value;pageDOMCache.delete(oldest);pageScrollCache.delete(oldest);}}
 document.documentElement.dataset.columns=state.columns;document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.page=state.page;document.documentElement.dataset.playing=state.playURLs.length?'true':'false';native.statusStyle(state.theme==='black');
 stopImages?.();const video=$('#video'),activeVideoURL=state.page==='detail'&&!native.native()?state.playURLs[state.playIndex]?.url||'':'',preserveVideo=!!(video&&activeVideoURL&&video.getAttribute('src')===activeVideoURL);if(video){saveProgress(video.currentTime);if(!preserveVideo)video.pause();else video.remove();}
 if(!native.native()&&switched&&renderKey&&pageDOMCache.has(renderKey)){const cached=pageDOMCache.get(renderKey);pageDOMCache.delete(renderKey);pageDOMCache.set(renderKey,cached);state.imageMap=new Map(cached.images);pageRoot.replaceChildren(cached.node);for(const row of pageRoot.querySelectorAll('[data-shelf]'))row.scrollLeft=shelfOffsets.get(row.dataset.shelf)||row.scrollLeft;for(const row of pageRoot.querySelectorAll('[data-live-scroll]'))row.scrollLeft=liveScrollOffsets.get(row.dataset.liveScroll)||0;activeRenderKey=renderKey;activeRenderReady=true;syncNav();wireVideo();requestAnimationFrame(()=>{window.scrollTo({top:cached.scrollY||0,behavior:'instant'});syncNativePlayer();});stopImages=loadVisibleImages(pageRoot,new Map(state.imageMap),options=>native.request(options),site().origin+'/');return;}
 activeRenderKey=renderKey;activeRenderReady=!state.loading;state.imageMap.clear();
 if(native.native()&&!(state.page==='detail'&&state.playURLs.length)){
  pageRoot.replaceChildren();syncNav();native.syncPage(nativePageSnapshot());if(state.page==='live')native.syncLive(nativeLiveSnapshot(),{fast:options.liveFast===true});wireVideo();stopImages=()=>{};
  requestAnimationFrame(syncNativePlayer);return;
 }
 if(state.page==='collection')pageRoot.innerHTML=`<div class="shell"><div class="detailtop"><button class="iconbutton" data-act="collection-back" aria-label="返回上一页">${icon('back')}</button><span class="caption">专题片库</span><button class="iconbutton" data-act="page" data-id="home" aria-label="首页">${icon('home')}</button></div>${collectionView()}</div>`;
 else if(state.page==='detail'){pageRoot.innerHTML=`<div class="shell detail-shell ${state.playURLs.length?'is-playing':''}"><div class="detailtop"><button class="iconbutton" data-act="back" aria-label="返回上一页">${icon('back')}</button><span class="detailtop-title">${e(state.playURLs.length?(state.detail?.title||'正在播放')+' · '+(state.episode?.title||'播放中'):'影片详情')}</span><button class="iconbutton" data-act="page" data-id="saved" aria-label="片单">${icon('saved')}</button></div>${detail()}<div class="footer">SANYUAN · 让好故事继续</div></div>`;if(preserveVideo){const slot=pageRoot.querySelector('#video');if(slot)slot.replaceWith(video);}}
 else if(state.page==='discover')pageRoot.innerHTML=`<div class="shell discover-shell">${discover()}</div>`;
 else if(state.page==='live')pageRoot.innerHTML=native.native()?'<div id="native-player-slot" class="native-live-anchor"></div>':`<div class="shell live-shell-root">${livePage()}</div>`;
 else pageRoot.innerHTML=`<div class="shell">${header()}<main class="content">${state.page==='home'?home():state.page==='me'?me():state.page==='games'?notice('游戏频道暂未接入','当前版本连接的是影视点播片库，暂时没有游戏数据源。','',''):state.page==='saved'?saved():state.page==='settings'?settings():state.page==='diagnostics'?diagnosticsView():browse()}<div class="footer">SANYUAN · 让好故事继续</div></main></div>`;
 syncNav();if(native.native()){native.syncPage(nativePageSnapshot());if(state.page==='live')native.syncLive(nativeLiveSnapshot(),{fast:options.liveFast===true});}for(const row of pageRoot.querySelectorAll('[data-shelf]'))row.scrollLeft=shelfOffsets.get(row.dataset.shelf)||0;for(const row of pageRoot.querySelectorAll('[data-live-scroll]'))row.scrollLeft=liveScrollOffsets.get(row.dataset.liveScroll)||0;wireVideo();
 requestAnimationFrame(()=>{syncNativePlayer();for(const row of pageRoot.querySelectorAll('.filter-options,.route-grid,.timeline-months,.timeline-years,.discover-sources,.saved-source-filters')){const active=row.querySelector('.active');if(active)row.scrollLeft+=active.getBoundingClientRect().left-row.getBoundingClientRect().left-(row.clientWidth-active.clientWidth)/2;}});
 stopImages=native.native()?()=>{}:loadVisibleImages(pageRoot,new Map(state.imageMap),options=>native.request(options),site().origin+'/');
}
function cancel(){cancelEpisodePrefetch();controller?.abort();controller=new AbortController();state.epoch++;return {signal:controller.signal,epoch:state.epoch};}
async function load({more=false}={}){const {signal,epoch}=cancel(),c=client(),previousItemCount=state.items.length,previousGroupCount=state.collectionGroups.length;state.loading=true;state.error='';if(!more)state.next='page=1';if(more){const button=pageRoot.querySelector('[data-act="more"]');if(button){button.disabled=true;button.textContent='正在加载…';}}else render();try{if(!c.config&&state.page!=='home')await c.bootstrap(signal);
 if(state.page==='browse'){
  const available=categories(c.config,{includeAdult:state.adultEnabled});if(available.length&&!available.some(item=>item.id===state.channel)){state.channel=available[0].id;restoreFilters();}
  if(c.prepareChannel)await c.prepareChannel(state.channel,signal);
  const definitions=filterDefinitions(),valid={};
  for(const f of definitions){const value=state.filters[f.query]??filterDefault(f);if((f.data||[]).some(o=>String(o.id)===String(value)))valid[f.query]=String(value);}
  state.filters=valid;
 }
 let data;if(state.page==='home')data=await c.home(signal);else if(state.page==='browse')data=await c.channel(state.channel,state.filters,state.next,signal);else if(state.page==='collection')data=await c.collection(state.collection,state.next,signal);else if(state.page==='search')data=await c.search(state.query,state.next,signal);if(epoch!==state.epoch)return;if(state.page==='home')state.sections=homeSections(data);else if(state.page==='collection'){
 const options={includeAdult:state.adultEnabled},items=sectionItems(data?.items||[],options),groups=collectionGroups(data,options);
 state.items=more?[...new Map([...state.items,...items].map(x=>[x.id,x])).values()]:items;
 state.collectionGroups=more?[...state.collectionGroups,...groups]:groups;state.next=pageCursor(data?.next);
 }else if(['browse','search'].includes(state.page)){const items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.items=more?[...new Map([...state.items,...items].map(x=>[x.id,x])).values()]:items;state.next=pageCursor(data?.next);}}catch(error){if(error.name!=='AbortError'&&epoch===state.epoch){state.error=error.message;if(!more&&((state.page==='home'&&!state.sections.length)||(state.page==='browse'&&!state.items.length))){const cached=viewCache.get(viewKey(state.page));if(cached){state.items=cached.items.slice();state.sections=cached.sections.slice();state.next=cached.next;}}}}finally{if(epoch===state.epoch){state.loading=false;if(!state.error)cacheView();if(!more||!appendMoreResults(previousItemCount,previousGroupCount))render();else if(native.native())native.syncPage(nativePageSnapshot());}}}
function appendMoreResults(previousItemCount,previousGroupCount){
 if(state.error)return false;
 if(['browse','search'].includes(state.page)){
  const gridNode=pageRoot.querySelector('.content > .grid');if(!gridNode)return false;
  gridNode.insertAdjacentHTML('beforeend',state.items.slice(previousItemCount).map(item=>card(item)).join(''));
  observeAppendedImages(gridNode);
  const status=pageRoot.querySelector('.results-status');if(status)status.textContent=`已显示 ${state.items.length} 部${state.next?' · 下方可加载更多':' · 已全部显示'}`;
  const button=pageRoot.querySelector('[data-act="more"]');if(button){if(state.next){button.disabled=false;button.textContent='加载更多影片';}else button.remove();}
  return true;
 }
 if(state.page==='collection'&&['topic','channel'].includes(state.collection?.kind)){
  const gridNode=pageRoot.querySelector('.collection-content > .grid');if(!gridNode)return false;
  gridNode.insertAdjacentHTML('beforeend',state.items.slice(previousItemCount).map(item=>card(item)).join(''));
  observeAppendedImages(gridNode);
  const button=pageRoot.querySelector('[data-act="more"]');if(button){if(state.next){button.disabled=false;button.textContent='加载更多';}else button.remove();}
  return true;
 }
 if(state.page==='collection'&&state.collectionGroups.length>previousGroupCount){
  const content=pageRoot.querySelector('.collection-content'),button=content?.querySelector('[data-act="more"]');if(!content)return false;
  const markup=state.collectionGroups.slice(previousGroupCount).map((group,index)=>`<section class="collection-group"><div class="sectiontop row"><h2>${e(group.title)}</h2>${group.route?`<button class="textbutton" data-act="collection-link" data-route="${e(group.route.url)}" data-title="${e(group.title)}">全部影片 ›</button>`:''}</div><div class="shelf collection-shelf" data-shelf="collection:${e(state.collection?.id||'root')}:${previousGroupCount+index}" aria-label="${e(group.title)}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join('');
  if(button)button.insertAdjacentHTML('beforebegin',markup);else content.insertAdjacentHTML('beforeend',markup);
  observeAppendedImages(content);
  const more=content.querySelector('[data-act="more"]');if(more){if(state.next){more.disabled=false;more.textContent='加载更多';}else more.remove();}
  return true;
 }
 return false;
}
async function openDetail(id,source=state.site){if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);if(state.page!=='detail'||!state.detailReturn)state.detailReturn=detailPageSnapshot();saveProgress($('#video')?.currentTime,playbackSession,$('#video')?.duration);cancel();if(source!==state.site){state.site=source;localStorage.setItem('sanyuan:site',source);}state.page='detail';state.detail=null;state.line=0;state.episode=null;state.episodePage=0;state.episodeDesc=false;state.locatedEpisodeIndex=-1;state.pendingEpisodeIndex=0;if(native.native()&&nativeSession&&!nativeSession.kind){nativeSession=null;native.controlPlayer('stop');}state.playURLs=[];state.playError='';state.playLoading=false;state.playLoadingText='';state.playTime=0;state.playDuration=0;state.removedAdSegments=0;state.removedAdSeconds=0;state.playLatencyMs=0;state.playQualityLabel='';state.playBandwidth=0;state.playerMirrored=false;state.nextEpisodeReady=false;cancelEpisodePrefetch();state.loading=true;state.error='';const {signal,epoch}=cancel();render();window.scrollTo(0,0);try{const d=await client().detail(id,signal);if(epoch!==state.epoch)return;state.detail=d;if(!Array.isArray(d.playSources))d.playSources=[];const preferred=d.playSources.findIndex(x=>x.siteId===client().preferredPlaybackSiteId),selected=d.playSources.findIndex(x=>x.selected);state.line=preferred>=0?preferred:selected>=0?selected:0;await loadEpisodes(signal);const resumeInfo=resumeEntryForDetail(d);if(resumeInfo&&resumeInfo.index>=0)state.episodePage=Math.floor(resumeInfo.index/20);}catch(error){if(error.name!=='AbortError'&&epoch===state.epoch)state.error=error.message;}finally{if(epoch===state.epoch){state.loading=false;render();}}}
async function loadEpisodes(signal){const d=state.detail,c=client(),line=d?.playSources?.[state.line];if(!line)return;if(!Array.isArray(line.list)||line.list.length<Number(line.total||0)){const list=await c.episodes(d.id,line,signal);if(Array.isArray(list)&&list.length)line.list=list;}}
function favorite(movie){let list=validSavedRows('favorites');const index=list.findIndex(x=>x.siteId===state.site&&String(x.movie.id)===String(movie.id));if(index>=0){list.splice(index,1);toast('已移出片单');}else{list.push({siteId:state.site,movie:{...movie,id:String(movie.id),imageURLs:posterURLsFor(movie,state.site)},updated:Date.now()});toast('已加入片单');}write('favorites',list);invalidateHomeDOMCache();}
function detailMovie(){const d=state.detail;return {id:String(d.id),title:d.title,imagePath:d.imagePath,imageGroup:d.imageGroup,imageURL:d.imageURL,imageURLs:imageURLsForSource(d,state.site,client().config),channelId:d.channelId,isAdult:d.isAdult===true||Number(d.channelId)===5,labels:(d.labels||[]).map(x=>x.name||x),subtitle:d.bottomLabel||'',badge:d.scoreText||''};}
function nativeMovieCard(movie,source=state.site,subtitle){
 if(!movie)return null;
 const sourceSite=sites.find(item=>item.id===source);
 return {...movie,id:String(movie.id||''),source,subtitle:subtitle||movie.subtitle||'',imageURLs:posterURLsFor(movie,source),imageReferer:sourceSite?.origin?new URL(sourceSite.origin).origin+'/':'',route:movie.route||null};
}
// 播放诊断（K1/K2）：最近 20 条播放事件，记在本机，供详情页诊断行与
// 设置里的“播放诊断”页使用。只记事件不记进度，避免高频写入。
const diagKindLabels={play:'开始播放',ready:'可以播放',failed:'播放失败',cicada:'改用软解',cicadaReady:'软解出画面',audioOnly:'无视频轨道',ended:'播完',switch:'切换线路',stall:'卡顿'};
function recordDiag(kind,detail='',overrides={}){
 const now=new Date(),pad=n=>String(n).padStart(2,'0');
 const entry={t:pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds()),kind,kindLabel:diagKindLabels[kind]||kind,title:overrides.title??(state.detail?.title||''),episode:overrides.episode??(state.episode?.title||''),line:overrides.line??(state.detail?.playSources?.[state.line]?.name||''),quality:overrides.quality??(state.playQualityLabel||''),engine:overrides.engine??(state.diagEngine||'AVPlayer'),detail:String(detail||'').slice(0,120)};
 state.diagnostics=[entry,...(Array.isArray(state.diagnostics)?state.diagnostics:[])].slice(0,20);
 write('diagnostics',state.diagnostics);
 if(native.native())native.syncPage(nativePageSnapshot());
}
function diagLine(){
 const last=Array.isArray(state.diagnostics)?state.diagnostics[0]:null;
 const line=state.detail?.playSources?.[state.line]?.name||'';
 const base=(state.playQualityLabel?state.playQualityLabel+' · ':'')+(state.diagEngine||'AVPlayer')+(line?' · '+line:'');
 if(!last)return state.playURLs.length?base+' · 未播放':'';
 return base+' · 最近：'+(last.kindLabel||last.kind)+(last.detail?' · '+last.detail.slice(0,24):'');
}
function diagnosticsText(){
 const head='三源影视 播放诊断 · '+new Date().toLocaleString('zh-CN');
 const rows=(state.diagnostics||[]).map(entry=>[entry.t,entry.kindLabel||entry.kind,entry.title,entry.episode,entry.line,entry.quality,entry.engine,entry.detail].filter(Boolean).join(' | '));
 return [head,...rows].join('\n');
}
function diagnosticsView(){
 const rows=(state.diagnostics||[]).map(entry=>`<li><strong>${e(entry.t)} · ${e(entry.kindLabel||entry.kind)}</strong><span>${e([entry.title,entry.episode].filter(Boolean).join(' · '))}${e(entry.line?' · '+entry.line:'')}${e(entry.quality?' · '+entry.quality:'')}${e(' · '+(entry.engine||'AVPlayer'))}</span>${entry.detail?`<small>${e(entry.detail)}</small>`:''}</li>`).join('');
 return `<div class="content diagnostics-content"><div class="detailtop"><button class="iconbutton" data-act="page" data-id="me" aria-label="返回我的">‹</button><span class="detailtop-title">播放诊断</span></div><p class="caption">最近 20 条播放事件，仅保存在本机；复制后可发给开发者定位问题。</p><div class="diagnostics-actions"><button type="button" class="secondary" data-act="diagnostics-copy">📋 复制诊断日志</button><button type="button" class="secondary" data-act="diagnostics-clear">清空记录</button></div>${rows?`<ul class="diagnostics-list">${rows}</ul>`:'<p class="caption">暂无播放记录，播放一次视频后这里会显示事件时间线。</p>'}</div>`;
}
function nativePageSnapshot(){
 const source=state.site,detailData=state.detail,origin=site()?.origin||'',posterReferer=/^https:\/\//i.test(origin)?new URL(origin).origin+'/':'',posterKeysBySite=Object.fromEntries(sites.filter(item=>Array.isArray(item.assetKeys)&&item.assetKeys.length).map(item=>[item.id,item.assetKeys])),base={page:state.page,theme:state.theme,site:source,siteName:site().name,posterReferer,posterKeysBySite,sites:sites.map(item=>({id:item.id,name:item.name})),loading:state.loading,error:state.error||'',columns:state.columns,adultEnabled:state.adultEnabled,query:state.query,clearConfirm:nativeClearConfirm,playbackRate:state.playbackRate,playerMuted:state.playerMuted,sleepTimerMode:state.sleepTimerMode,sleepTimerEndAt:state.sleepTimerEndAt||0,siteHealth:state.siteHealth};
 if(state.page==='home'){
  const picks=homePicks(),hero=picks[state.heroIndex%Math.max(1,picks.length)];
  const recent=validSavedRows('history').filter(row=>row.siteId===source&&(state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5))).sort((a,b)=>b.updated-a.updated).slice(0,8).map(row=>nativeMovieCard(row.movie,row.siteId,row.episodeTitle));
  return {...base,categories:categories(client().config,{includeAdult:state.adultEnabled}),hero:nativeMovieCard(hero),picks:picks.map(item=>nativeMovieCard(item)),heroIndex:state.heroIndex,recent,sections:state.sections.map(section=>({title:section.title,route:section.route,items:section.items.map(item=>nativeMovieCard(item))}))};
 }
 if(state.page==='browse'||state.page==='search'){
  const defs=filterDefinitions().map(filter=>({query:filter.query,name:filterName(filter.query),selected:String(state.filters[filter.query]??filterDefault(filter)),options:(filter.data||[]).map(option=>({id:String(option.id),name:option.name}))}));
  const expansionKey=`sanyuan:filters-expanded:${state.site}:${state.channel}`;
  return {...base,title:state.page==='search'?'“'+state.query+'” 的搜索结果':categories(client().config,{includeAdult:state.adultEnabled}).find(item=>item.id===state.channel)?.name||'分类片库',categories:categories(client().config,{includeAdult:state.adultEnabled}),filters:state.page==='browse'?defs:[],filtersExpanded:localStorage.getItem(expansionKey)==='true',items:state.items.map(item=>nativeMovieCard(item)),next:pageCursor(state.next),selectedFilters:state.filters};
 }
 if(state.page==='discover'){
  const groups=state.discoverGroups.map(group=>({title:group.title||'近期更新',items:(group.items||[]).map(item=>nativeMovieCard(item))}));
  const sections=state.discoverSections.map(section=>({title:section.title,route:section.route,items:(section.items||[]).map(item=>nativeMovieCard(item))}));
  return {...base,discoverTabs:discoveryTabs(),discoverTimeline:discoveryProfile().timeline,discoverTab:state.discoverTab,discoverYear:state.discoverYear,discoverMonth:state.discoverMonth,years:Array.from({length:5},(_,i)=>new Date().getFullYear()-i),groups,sections,items:state.discoverItems.map(item=>nativeMovieCard(item)),next:pageCursor(state.discoverNext)};
 }
 if(state.page==='collection'){
  const groups=state.collectionGroups.length?state.collectionGroups:[{title:state.collection?.title||'专题片库',items:state.items}];
  return {...base,title:state.collection?.title||'专题片库',groups:groups.map(group=>({title:group.title,items:(group.items||[]).map(item=>nativeMovieCard(item))})),items:state.items.map(item=>nativeMovieCard(item)),next:pageCursor(state.next),stackDepth:state.collectionStack.length};
 }
 if(state.page==='detail'&&detailData){
  const movie={...detailMovie(),...detailData,id:String(detailData.id),labels:(detailData.labels||[]).map(item=>item.name||item),imageURLs:imageURLsForSource(detailData,source,client().config),actors:(detailData.actors||[]).map(item=>item.name||item).filter(Boolean),metadata:[typeof detailData.year==='object'?(detailData.year.name||detailData.year.text||detailData.year.id||''):detailData.year,...(detailData.area||[]).map(item=>item.name||item),...(detailData.language||[]).map(item=>item.name||item),detailData.channelName].filter(Boolean).join(' · ')};
  const saved=validSavedRows('favorites').some(item=>item.siteId===source&&String(item.movie.id)===String(detailData.id));
  return {...base,movie,detailReady:true,previewPlayback:isPreviewPlayback(),saved,line:state.line,episodePage:state.episodePage,episodeDesc:state.episodeDesc,seasons:(Array.isArray(detailData.seasons)?detailData.seasons:[]).filter(season=>season&&season.id!=null&&String(season.id)).map(season=>({id:String(season.id),title:String(season.title||season.name||'季度'),name:String(season.title||season.name||'季度'),selected:season.selected===true||String(season.id)===String(detailData.id)})),playSources:(detailData.playSources||[]).map((line,index)=>{const mapped=(line.list||[]).map((episode,epIdx)=>({index:epIdx,title:episode.title||'第'+(epIdx+1)+'集',selected:state.episode?.id===episode.id}));return {index,name:line.name||'线路 '+(index+1),siteId:line.siteId,preview:line.preview===true,total:Number(line.total)||line.list?.length||0,selected:index===state.line,episodes:state.episodeDesc?mapped.slice().reverse():mapped};}),episode:state.episode?{title:state.episode.title||'',index:(detailData.playSources?.[state.line]?.list||[]).findIndex(item=>item.id===state.episode.id)}:null,playError:state.playError||'',playStatus:state.playStatus||'',playURLs:state.playURLs.map((item,index)=>({name:item.name||'',url:item.url,selected:index===state.playIndex})),playIndex:state.playIndex,diagLine:diagLine(),playLoading:!!state.playLoading,playLoadingText:state.playLoadingText||'',playTime:state.playTime||0,playDuration:state.playDuration||0,summaryExpanded:!!state.summaryExpanded};
 }
 if(state.page==='me'||state.page==='saved'){
  const tab=state.page==='saved'?state.savedTab:state.meTab,allRows=validSavedRows(tab==='history'?'history':'favorites').filter(row=>state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5)).sort((a,b)=>b.updated-a.updated),sourceIds=[...new Set(allRows.map(r=>r.siteId).filter(Boolean))];
  if(state.savedSourceFilter!=='all'&&!sourceIds.includes(state.savedSourceFilter))state.savedSourceFilter='all';
  const filteredRows=state.savedSourceFilter==='all'?allRows:allRows.filter(r=>r.siteId===state.savedSourceFilter);
  const sourceFilters=sourceIds.length>1?[{id:'all',name:`全部 (${allRows.length})`},...sourceIds.map(sid=>({id:sid,name:`${sites.find(s=>s.id===sid)?.name||sid} (${allRows.filter(r=>r.siteId===sid).length})`}))]:[];
  const list=filteredRows.map(row=>nativeMovieCard(row.movie,row.siteId,tab==='history'?row.episodeTitle:undefined)),c=client();
  return {...base,meTab:state.page==='saved'?'saved':state.meTab,savedTab:tab,savedSourceFilter:state.savedSourceFilter,sourceFilters,items:list,columns:state.columns,showAgeGate:state.showAgeGate,authError:state.authError||'',user:c.user?{nickname:c.user.nickname||c.user.account||'',sessionKind:c.sessionKind}:null,config:c.config&&typeof c.config==='object'?c.config:{},health:c.health||[],preferred:c.preferred||{},cleanHLS:state.cleanHLS,autoNext:state.autoNext,skipIntroSeconds:state.skipIntroSeconds,skipOutroSeconds:state.skipOutroSeconds,aspectMode:state.aspectMode,playbackRate:state.playbackRate,version:"1.0.7"};
 }
 if(state.page==='diagnostics'){
  return {...base,title:'播放诊断',diagnostics:state.diagnostics||[]};
 }
 return {...base};
}
function applyLivePlaybackRate(rate){
 state.playbackRate=rate;write('playbackRate',rate);
 const video=$('#video');if(video)video.playbackRate=rate;
 if(native.native())native.controlPlayer('rate',{rate});
}
function seekActivePlayer(delta){
 const video=$('#video');
 if(video){video.currentTime=Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:Infinity,video.currentTime+delta));}
 if(native.native())native.controlPlayer('seekDelta',{delta});
 showPlayerHUD(delta>0?`快进 +${delta}s`:`快退 ${delta}s`);
}
function cycleAspectMode(){
 const modes=['fit','fill','stretch'],labels={fit:'适应画面',fill:'铺满裁剪',stretch:'全屏拉伸'},shortLabels={fit:'适应',fill:'铺满',stretch:'拉伸'};
 const next=modes[(modes.indexOf(state.aspectMode)+1)%modes.length];
 state.aspectMode=next;localStorage.setItem('sanyuan:aspectMode',next);
 const video=$('#video')||$('#live-video');if(video)video.dataset.aspect=next;
 if(native.native())native.controlPlayer('gravity',{mode:next});
 showPlayerHUD(`画面比例：${labels[next]}`);
 toast(`画面比例已切换为：${labels[next]}`);
 if(state.page==='detail'&&!native.native()&&$('#video')){
  const btn=pageRoot.querySelector('.cockpit-btn[data-act="player-aspect"]');
  if(btn)btn.textContent=`画面: ${shortLabels[next]}`;
  return;
 }
 render({liveFast:state.page==='live'});
}
window.NativePageAction=(action,payload={})=>{
 if(action==='page'&&!['home','discover','browse','live','me','saved','settings','diagnostics'].includes(String(payload.id||'')))return;
 if(action==='search-submit'||action==='actor-search'){const query=String(payload.query||payload.id||'').trim();if(!query)return;rememberSearch(query);state.query=query;state.page='search';state.items=[];load();return;}
 if(action==='login-submit'){const account=String(payload.account||'').trim(),password=String(payload.password||'');if(!account||!password)return;state.authError='';void client().login(account,password).then(()=>toast('登录成功')).catch(error=>{state.authError=error.message;}).finally(()=>render());return;}
 if(action==='toggle-clean-hls'){state.cleanHLS=!state.cleanHLS;write('cleanHLS',state.cleanHLS);toast('已更新，下次播放生效');render();return;}
 if(action==='toggle-auto-next'){state.autoNext=!state.autoNext;write('autoNext',state.autoNext);toast(state.autoNext?'已开启自动连播':'已关闭自动连播');render();return;}
 if(action==='skip-intro-setting'){const sec=Number(payload.id);if([60,90,120].includes(sec)){state.skipIntroSeconds=sec;write('skipIntroSeconds',sec);toast(`跳过片头已设为 ${sec} 秒`);render();}return;}
 if(action==='skip-outro-setting'){const sec=Number(payload.id);if([0,60,90,120].includes(sec)){state.skipOutroSeconds=sec;write('skipOutroSeconds',sec);toast(sec>0?`已开启片尾剩余 ${sec} 秒自动连播`:'已关闭自动跳过片尾');render();}return;}
 if(action==='aspect-setting'){const m=String(payload.id||'');if(['fit','fill','stretch'].includes(m)){state.aspectMode=m;localStorage.setItem('sanyuan:aspectMode',m);if(native.native())native.controlPlayer('gravity',{mode:m});toast('默认画面比例已更新');render();}return;}
 if(action==='playback-rate'){const rate=Number(payload.id);if([0.5,0.75,1,1.25,1.5,2].includes(rate)){applyLivePlaybackRate(rate);toast(`播放倍速已设为 ${rate}×`);render();}return;}
 if(action==='player-seek'){const delta=Number(payload.id||0);if(delta)seekActivePlayer(delta);return;}
 if(action==='player-skip-intro'){seekActivePlayer(state.skipIntroSeconds||90);return;}
 if(action==='player-aspect'){cycleAspectMode();return;}
 if(action==='player-mute'){state.playerMuted=!state.playerMuted;const v=$('#video');if(v)v.muted=state.playerMuted;if(native.native())native.controlPlayer('mute',{muted:state.playerMuted});showPlayerHUD(state.playerMuted?'🔇 已静音':'🔊 已开启声音');render();return;}
 if(action==='player-sleep-timer'){cycleSleepTimer();return;}
 if(action==='player-switch-line'){
  // B3：座舱换线。不等 15 秒宽限耗尽，让恢复流程跳过当前地址与线路。
  if(state.page!=='detail'||!state.episode||!state.playURLs.length)return;
  const session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};
  if(!state.playRecovery||state.playRecovery.key!==sessionKey(session))state.playRecovery={key:sessionKey(session),failedURLs:new Set(),failedLines:new Set(),triedLines:new Set([state.line]),running:false};
  state.playRecovery.failedURLs.add(state.playURLs[state.playIndex]?.url);
  state.playRecovery.failedLines.add(state.line);
  state.playRecovery.triedLines.add(state.line);
  toast('正在换线…');
  void recoverPlayback(session,'用户手动换线');
  return;
 }
 if(action==='sleep-timer-setting'){const mode=String(payload.id||'');if(['off','episode','15','30','60'].includes(mode))applySleepTimer(mode);return;}
 // I3：原生睡眠定时到点后通知 JS 清状态。暂停本身已在原生侧完成，
 // 这里只同步状态；若 JS 的 5 秒定时器先到了，mode 已是 off，直接返回。
 if(action==='sleep-timer-fired'){if(state.sleepTimerMode==='off')return;state.sleepTimerMode='off';state.sleepTimerEndAt=0;toast('🌙 睡眠定时已到，已为你自动暂停播放');render();return;}
 if(action==='episode-order'){state.episodeDesc=!state.episodeDesc;state.episodePage=0;render();return;}
 if(action==='summary-toggle'){state.summaryExpanded=!state.summaryExpanded;render();return;}
 if(action==='play-line'){const index=Number(payload.id);if(!Number.isInteger(index)||!state.playURLs[index])return;saveProgress(undefined);state.playIndex=index;const entry=state.playURLs[index],session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};state.playRecovery={key:sessionKey(session),failedURLs:new Set(),failedLines:new Set(),triedLines:new Set([state.line]),running:false};void verifyMedia(client(),entry.url,controller?.signal,entry.headers,entry.referrerPolicy).then(meta=>{if(meta?.warmPlaylists?.length)entry.warmPlaylists=meta.warmPlaylists;entry.cicadaURL=meta?.variants?.[0]?.href||'';state.playQualityLabel=meta?.qualityLabel||'';state.playBandwidth=meta?.bandwidth||0;render();if(native.native())return launchNativePlayer();return $('#video')?.play().catch(()=>{});}).catch(error=>recoverPlayback(session,error.message));return;}
 if(action==='more'){
  if(!state.loading&&state.next&&['browse','search','collection'].includes(state.page))load({more:true});
  return;
 }
 if(action==='discover-more'){
  if(!state.loading&&state.discoverNext&&state.page==='discover')loadDiscovery({more:true});
  return;
 }
 if(action==='episode-page'){state.episodePage=Math.max(0,Number(payload.id)||0);render();return;}
 const identityKeys=action==='collection-link'?['route','title']:action==='detail'?['id','source']:['id','key','kind','url','route','title'];
 const actualControl=[...navRoot.querySelectorAll('[data-act]'),...pageRoot.querySelectorAll('[data-act]')].find(button=>button.dataset.act===action&&identityKeys.every(key=>payload[key]===undefined||button.dataset[key]===String(payload[key])));
 if(actualControl){actualControl.click();return;}
 if(action==='clear-saved'){const confirmed=nativeClearConfirm;nativeClearConfirm=!nativeClearConfirm;const button=document.createElement('button');button.dataset.act='clear-saved';if(confirmed)button.dataset.confirm='yes';button.hidden=true;root.append(button);button.click();button.remove();native.syncPage(nativePageSnapshot());return;}
 if(action==='probe-all-sites'){void probeAllSites();return;}
 if(action==='clear-site-health'){state.siteHealth={};write('siteHealth',{});render();native.syncPage(nativePageSnapshot());toast('已清空全网片源连通性记录');return;}
 if(action==='diagnostics-copy'){if(!(state.diagnostics||[]).length){toast('暂无诊断记录');return;}native.copyText(diagnosticsText()).then(()=>toast('已复制诊断日志')).catch(error=>toast(error?.message||'复制失败'));return;}
 if(action==='diagnostics-clear'){state.diagnostics=[];write('diagnostics',[]);render();native.syncPage(nativePageSnapshot());toast('已清空诊断记录');return;}
 if(action==='probe-site'){const target=sites.find(s=>s.id===String(payload.id||''));if(target){void probeSite(target).then(()=>{render();native.syncPage(nativePageSnapshot());});}return;}
 if(action==='me-settings'){const button=document.createElement('button');button.dataset.act='me-tab';button.dataset.id='settings';root.append(button);button.click();button.remove();return;}
 const button=document.createElement('button');button.dataset.act=action;for(const [key,value] of Object.entries(payload||{}))if(value!==undefined&&value!==null)button.dataset[key]=String(value);button.hidden=true;root.append(button);button.click();button.remove();
};
window.NativePageRequestState=()=>native.syncPage(nativePageSnapshot());
function episodesPanel(line,episodes){
 const pageSize=20,pageCount=Math.max(1,Math.ceil(episodes.length/pageSize)),page=Math.min(state.episodePage,pageCount-1),start=page*pageSize,current=episodes.findIndex(x=>x.id===state.episode?.id),total=Math.max(episodes.length,Number(line?.total||0));
 const indexed=episodes.map((episode,index)=>({episode,index})),ordered=state.episodeDesc?indexed.slice().reverse():indexed,slice=ordered.slice(start,start+pageSize);
 const rangeStart=slice[0]?slice[0].index+1:start+1,rangeEnd=slice.length?slice[slice.length-1].index+1:Math.min(start+pageSize,episodes.length);
 return `<section class="episode-section"><div class="episodes-heading"><div><h2 class="smallheading">选集</h2><span class="subtle">已载入 ${episodes.length}${total>episodes.length?` / 共 ${total}`:''} 集${current>=0?` · 正在播放 ${e(episodes[current].title||`第${current+1}集`)}`:''}</span></div><div class="episode-steps">${episodes.length>1?`<button type="button" class="secondary episode-order-btn" data-act="episode-order" aria-pressed="${state.episodeDesc}">${state.episodeDesc?'↓ 倒序':'↑ 正序'}</button>`:''}${pageCount>2&&current>=0&&Math.floor((state.episodeDesc?episodes.length-1-current:current)/pageSize)!==page?`<button type="button" class="secondary" data-act="episode-locate" title="跳转到正在播放的集数所在页">定位当前集</button>`:''}${current>=0?`<button class="secondary" data-act="episode-step" data-id="-1" ${current===0?'disabled':''}>上一集</button><button class="secondary" data-act="episode-step" data-id="1" ${current===episodes.length-1?'disabled':''}>下一集</button>`:''}</div></div>${pageCount>1?`<div class="episode-pages" role="group" aria-label="选集分页"><span>页码</span><div class="episode-page-options">${Array.from({length:pageCount},(_,i)=>`<button type="button" class="episode-page-chip ${i===page?'active':''}" data-act="episode-page" data-id="${i}" aria-current="${i===page?'page':'false'}" aria-label="第 ${i+1} 页，第 ${i*pageSize+1} 至 ${Math.min((i+1)*pageSize,episodes.length)} 集">${i+1}</button>`).join('')}</div><small>第 ${page+1} / ${pageCount} 页 · ${rangeStart}–${rangeEnd} 集</small><input type="number" min="1" max="${episodes.length}" class="episode-jump-input" data-episode-jump placeholder="跳集" aria-label="输入集数跳转到对应页"></div>`:''}<div class="episodes">${slice.map(({episode,index:i})=>{const active=state.episode?.id===episode.id,located=i===state.locatedEpisodeIndex;return `<button class="episode ${active?'active':''} ${located?'is-located':''}" data-act="episode" data-id="${i}" aria-current="${active?'true':'false'}" aria-label="${e(episode.title||'第'+(i+1)+'集')}${active?'，正在播放':'，点击播放'}"><span class="episode-title">${e(episode.title||'第'+(i+1)+'集')}</span>${active?'<small>正在播放</small>':''}</button>`;}).join('')}</div></section>`;
}
function saveProgress(time=native.native()?(state.playTime||undefined):$('#video')?.currentTime,session=playbackSession||(!nativeSession?.kind?nativeSession?.session:null),duration=native.native()?(state.playDuration||undefined):$('#video')?.duration){if(!session)return;if(session.preview)time=undefined;const key=sourceKey(session.siteId,session.movie.id);let list=validSavedRows('history'),row=list.find(x=>x.key===key);const prior=row?.episodeId===session.episodeId?row.time:0,priorDuration=row?.episodeId===session.episodeId?row.duration:0;const entry={key,...session,time:Number.isFinite(time)?time:prior||0,...(Number.isFinite(duration)&&duration>0?{duration:Math.round(duration)}:priorDuration>0?{duration:priorDuration}:{}),updated:Date.now()};list=[entry,...list.filter(x=>x.key!==key)].slice(0,100);write('history',list);invalidateHomeDOMCache();}

function playerFrame(){
 const slot=$('#native-player-slot');if(!slot)return {visible:false};
 const rect=slot.getBoundingClientRect();
 return {visible:true,x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:window.innerWidth};
}
function syncNativePlayer(){if(native.native()&&nativeSession&&state.page!=='live')native.layoutPlayer(nativeSession.context,playerFrame());}
window.addEventListener('resize',()=>requestAnimationFrame(syncNativePlayer));
window.addEventListener('scroll',()=>{if(scrollFramePending)return;scrollFramePending=true;requestAnimationFrame(()=>{scrollFramePending=false;if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);$('.detail-shell .detailtop')?.classList.toggle('scrolled',window.scrollY>36);$('.detail-content .playerbox')?.classList.toggle('is-compact',window.scrollY>90);const topBtn=$('#back-to-top');if(topBtn)topBtn.hidden=window.scrollY<=360;syncNativePlayer();});},{passive:true});
async function launchNativePlayer(){
 const entry=state.playURLs[state.playIndex],url=entry?.url;if(!url||!state.episode)return;
 $('#video')?.pause();
 const preview=state.playURLs[state.playIndex]?.preview===true,session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title,preview};
 const context=state.epoch+':'+Date.now();nativeSession={context,session};
 state.diagEngine='AVPlayer';state.playLoading=true;state.playLoadingText='正在加载播放器…';recordDiag('play','开始播放');
 const row=validSavedRows('history').find(x=>x.siteId===session.siteId&&String(x.movie.id)===String(session.movie.id)&&String(x.episodeId)===String(session.episodeId));
 const startAt=computeResumeStartAt({preview,time:row?.time,duration:row?.duration});
 if(startAt>0){state.playTime=startAt;if(row?.duration>0)state.playDuration=row.duration;}
 saveProgress(undefined,session);
 await native.play(url,mediaHeaders(client(),state.playURLs[state.playIndex]),{cleanHLS:state.cleanHLS,warmPlaylists:state.playURLs[state.playIndex]?.warmPlaylists||[],cicadaURL:entry?.cicadaURL||'',context,frame:playerFrame(),startAt,rate:state.playbackRate,muted:state.playerMuted,title:session.movie.title+' · '+(session.episodeTitle||'')});
}
const authorizationFailure=message=>/unauthori[sz]ed|forbidden|HTTP\s*(?:401|403)|(?:401|403)\b|权限|授权|会员|付费|登录|账号|账户/i.test(String(message||''));
const sessionKey=session=>`${session.siteId}:${session.movie.id}:${session.episodeId}`;
async function recoverPlayback(session,message=''){
 const key=sessionKey(session),recovery=state.playRecovery;
 if(state.page!=='detail'||state.site!==session.siteId||String(state.detail?.id)!==session.movie.id||state.episode?.id!==session.episodeId||!recovery||recovery.key!==key||recovery.running)return;
 if(authorizationFailure(message)){state.playError='原站返回了权限或账号限制，请按原站提示处理。';render();return;}
 // 恢复总时限：同一集从第一次失败起 90 秒内没播起来就停手报错。
 // 15 条线路每条都验一遍 + 原生 15 秒宽限 + 软解 10 秒，跑满要
 // 好几分钟，用户看到的只是无尽转圈；时限一到直接给明确结论。
 // 首帧一出就清零（ready 事件里），中途播起来又卡住重新计时。
 if(!recovery.startedAt)recovery.startedAt=Date.now();
 if(Date.now()-recovery.startedAt>90000){state.playLoading=false;state.playError='当前播放线路中断，已尝试可用备用地址和同集线路。可稍后重试或手动换线。'+(message&&!authorizationFailure(message)?' '+message:'');render();recordDiag('failed',message||'恢复超时，已尝试全部备用地址和线路');return;}
 recovery.running=true;recovery.failedURLs.add(state.playURLs[state.playIndex]?.url);recovery.failedLines.add(state.line);recovery.triedLines.add(state.line);
 let lastError=message;
 const stillCurrent=()=>state.playRecovery===recovery&&state.page==='detail'&&state.site===session.siteId&&String(state.detail?.id)===session.movie.id&&state.episode?.id===session.episodeId;
 // C1：同集备用地址两两并行验证（已知死掉的地址已在 failedURLs 里跳过，
 // 已验证过的用 verifiedMeta 不再重复验），先通过的先播。
 const candidates=[];
 for(let index=0;index<Math.min(state.playURLs.length,4);index++){
  const candidate=state.playURLs[index];if(!candidate?.url||recovery.failedURLs.has(candidate.url))continue;
  recovery.failedURLs.add(candidate.url);candidates.push({index,candidate});
 }
 for(let base=0;base<candidates.length;base+=2){
  const batch=candidates.slice(base,base+2);
  if(!stillCurrent())return;
  state.playError='当前地址连接不稳定，正在尝试备用地址…';state.playStatus='正在尝试备用地址…';state.playLoading=true;state.playLoadingText=state.playStatus;render();
  const outcomes=await Promise.all(batch.map(({index,candidate})=>candidate.verifiedMeta?Promise.resolve({index,candidate,meta:candidate.verifiedMeta,error:null}):verifyMedia(client(),candidate.url,controller?.signal,candidate.headers,candidate.referrerPolicy).then(meta=>({index,candidate,meta,error:null}),error=>({index,candidate,meta:null,error}))));
  for(const {index,candidate,meta,error} of outcomes){
   if(!stillCurrent())return;
   if(error){if(error.name==='AbortError'){recovery.running=false;return;}lastError=error.message;if(authorizationFailure(lastError))break;continue;}
   state.playIndex=index;if(meta?.warmPlaylists?.length)candidate.warmPlaylists=meta.warmPlaylists;candidate.cicadaURL=meta?.cicadaURL||meta?.variants?.[0]?.href||'';state.playQualityLabel=meta?.qualityLabel||'';state.playBandwidth=meta?.bandwidth||0;state.playError='';state.playStatus='';recovery.running=false;render();if(native.native())await launchNativePlayer();else await $('#video')?.play().catch(()=>{});return;
  }
  if(authorizationFailure(lastError))break;
 }
 if(authorizationFailure(lastError)){if(stillCurrent()){recovery.running=false;state.playLoading=false;state.playError='原站返回了权限或账号限制，请按原站提示处理。';render();}return;}
 const detail=state.detail,requested=state.episode,lines=detail?.playSources||[],order=orderLinesByHealth(lines,-1,client().preferredPlaybackSiteId,state.lineHealth,state.site);
 let lineTries=0;
 for(const target of order){if(recovery.triedLines.has(target)||recovery.failedLines.has(target)||lines[target]?.preview===true)continue;recovery.triedLines.add(target);const line=lines[target];try{if(!Array.isArray(line.list)||!line.list.length||line.list.length<Number(line.total||0)){const list=await client().episodes(detail.id,line,controller?.signal);if(Array.isArray(list)&&list.length)line.list=list;}if(!stillCurrent())return;const at=matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&lines[state.line]?.list?.length===1,singleEpisodeSource:lines[state.line]?.list?.length===1});if(at<0)continue;lineTries++;state.line=target;state.episodePage=Math.floor(at/20);state.playError='正在切换到另一条同集线路…';state.playStatus='正在试第 '+lineTries+' 条线路…';state.playLoading=true;state.playLoadingText=state.playStatus;render();recordDiag('switch','切换到'+(line.name||('线路 '+(target+1))));toast('原线路连接中断，正在尝试同一集的备用线路');recovery.running=false;await playEpisode(at,{automatic:true});return;}catch(error){if(error.name==='AbortError'){recovery.running=false;return;}lastError=error.message;if(authorizationFailure(lastError))break;}}
 if(!stillCurrent())return;recovery.running=false;state.playLoading=false;state.playError='当前播放线路中断，已尝试可用备用地址和同集线路。可稍后重试或手动换线。'+(lastError&&!authorizationFailure(lastError)?' '+lastError:'');render();recordDiag('failed',lastError||'已尝试全部备用地址和线路');
}
native.onPlaybackEvent=event=>{
 if(event.context!==nativeSession?.context)return;const {session}=nativeSession;
 if(nativeSession.kind==='live'){
  const formatLabel=liveFormatLabel();
  if(event.status==='ready'){state.liveLastPlaybackTime=null;state.livePlaybackProgressAt=Date.now();state.liveStatus='播放已连接，画面加载中';state.liveError='';state.diagEngine='AVPlayer';recordDiag('ready','直播已连接',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='videoTrack'){state.liveVideoFormat={width:Number(event.width)||0,height:Number(event.height)||0,codec:String(event.codec||'')};state.liveStatus=state.liveVideoReady?`正在直播 · ${liveFormatLabel()}`:`检测到视频轨道 · ${liveFormatLabel()||'分辨率未知'}`;render({liveFast:true});}
  else if(event.status==='videoReady'){state.liveVideoReady=true;state.liveRendererRetry=0;state.liveStatus=`正在直播${formatLabel?' · '+formatLabel:''}`;state.liveError='';render({liveFast:true});}
  else if(event.status==='audioOnly'){state.liveVideoReady=false;state.livePlaybackProgressAt=Date.now();state.liveLastPlaybackTime=null;state.liveStatus='该线路没有可识别的视频轨道';state.liveError='已保留当前线路，没有自动切换。可手动选择其他线路，或检查源站是否提供视频流。';recordDiag('audioOnly','无视频轨道',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='videoTrackUnknown'){state.liveVideoReady=false;state.liveStatus='暂时无法确认该线路的视频轨道';state.liveError='当前线路保持播放，未自动切换。请检查网络后重试或手动查看其他线路。';render({liveFast:true});}
  else if(event.status==='rendererAttached'){state.liveStatus='已启用 AVPlayerLayer 直接渲染，等待首帧…';state.liveError='';render({liveFast:true});}
  else if(event.status==='rendererRecovery'){state.liveStatus=`正在重建画面渲染${formatLabel?' · '+formatLabel:''}，当前线路保持不变…`;state.liveError='';render({liveFast:true});}
  else if(event.status==='cicadaFallback'){state.liveVideoReady=false;state.liveStatus='正在尝试软解播放，当前线路保持不变…';state.liveError='';state.livePlaybackProgressAt=Date.now();state.liveLastPlaybackTime=null;state.diagEngine='Cicada';recordDiag('cicada','改用软解',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='cicadaVideoReady'){state.liveVideoReady=true;state.liveRendererRetry=0;state.livePlaybackProgressAt=Date.now();state.liveLastPlaybackTime=null;if(event.width&&event.height)state.liveVideoFormat={width:Number(event.width)||0,height:Number(event.height)||0,codec:'hevc'};state.liveStatus=`正在用软解播放${liveFormatLabel()?' · '+liveFormatLabel():''}`;state.liveError='';recordDiag('cicadaReady','软解出画面',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='rendererFailed'){const retries=(state.liveRendererRetry||0);if(retries<2){state.liveRendererRetry=retries+1;void playLiveVariant(state.liveVariantIndex,{automatic:true,retrySame:true});}else{state.liveVideoReady=false;state.liveStatus=`检测到视频轨道，但 AVPlayer 未输出画面${formatLabel?' · '+formatLabel:''}`;state.liveError='当前线路未自动切换。可手动选择其他线路，或在 VLC 播放以对比设备解码支持。';recordDiag('failed','AVPlayer 未输出画面',{title:liveChannel()?.name||'直播'});render({liveFast:true});}}
  else if(event.status==='progress'){
   if(!state.liveActive||state.page!=='live'||document.visibilityState==='hidden')return;
   const time=Number(event.time),now=Date.now();if(!Number.isFinite(time))return;
   if(state.liveLastPlaybackTime===null||time>state.liveLastPlaybackTime+.2){state.liveLastPlaybackTime=time;state.livePlaybackProgressAt=now;}
   else if(state.livePlaybackProgressAt&&now-state.livePlaybackProgressAt>18000){state.livePlaybackProgressAt=now;void handleLivePlaybackFailure('直播画面停止推进，正在尝试备用线路');}
  }
  else if(event.status==='failed'){recordDiag('failed',event.error||'直播源无法播放',{title:liveChannel()?.name||'直播'});void handleLivePlaybackFailure(event.error||'直播源无法播放');}
  else if(event.status==='ended'){recordDiag('ended','直播流意外结束，正在尝试备用线路',{title:liveChannel()?.name||'直播'});void handleLivePlaybackFailure('直播流意外结束，正在尝试备用线路');}
  return;
 }
 if(event.status==='progress'&&state.playURLs[state.playIndex]?.preview!==true){
  if(Number(event.removedAdSegments)>0){state.removedAdSegments=Number(event.removedAdSegments);state.removedAdSeconds=Number(event.removedAdSeconds)||0;}
  state.playTime=Number(event.time)||0;state.playDuration=Number(event.duration)||state.playDuration||0;
  if(native.native())native.syncProgress(state.playTime,state.playDuration);
  saveProgress(Number(event.time),session,Number(event.duration)||undefined);
  if(shouldAutoSkipOutro({preview:false,outroSkipped:nativeSession.outroSkipped,autoNext:state.autoNext,skipOutroSeconds:state.skipOutroSeconds,duration:state.playDuration,currentTime:state.playTime})){
   const list=state.detail?.playSources?.[state.line]?.list||[],idx=list.findIndex(x=>x.id===session.episodeId);
   if(idx>=0&&idx<list.length-1){nativeSession.outroSkipped=true;toast('已自动跳过片尾，切入下一集');void playEpisode(idx+1);}
  }
 }
 if(event.status==='ready'&&state.playRecovery?.key===sessionKey(session)){state.playRecovery.running=false;state.playRecovery.startedAt=0;if(state.playError){state.playError='';render();}}
 if(event.status==='ready') {state.playLoading=false;recordDiag('ready','首帧已出');const curLine=state.detail?.playSources?.[state.line];if(curLine){state.lineHealth=recordLineOutcome(state.lineHealth,state.site,curLine,{ok:true,latencyMs:state.playLatencyMs||0});write('lineHealth',state.lineHealth);}}
 if(event.status==='cicadaFallback'){state.diagEngine='Cicada';state.playLoading=true;state.playLoadingText='正在尝试软解播放…';state.playError='';if(state.playRecovery)state.playRecovery.running=false;recordDiag('cicada','卡顿后改用软解，清晰度不变');toast('当前线路改用软解播放，清晰度不变');render();}
 // J1：点播流没有视频轨道（Cicada 也起不来时才到这里）。只留声音，
 // 不自动换线——换不换由用户决定，和直播的 audioOnly 一致。
 if(event.status==='audioOnly'){recordDiag('audioOnly','无视频轨道，当前仅播放声音');toast('该视频没有可识别的视频轨道，仅播放声音');render();}
 if(event.status==='failed'){state.playLoading=false;recordDiag('failed',event.error||'播放器无法读取当前线路');const curLine=state.detail?.playSources?.[state.line];if(curLine){state.lineHealth=recordLineOutcome(state.lineHealth,state.site,curLine,{ok:false});write('lineHealth',state.lineHealth);}void recoverPlayback(session,event.error||'播放器无法读取当前线路');}
 if(event.status==='ended'){state.playLoading=false;recordDiag('ended','本集播完');saveProgress(0,session,state.playDuration||undefined);state.playTime=0;if(native.native())native.syncProgress(0,state.playDuration||0);if(state.sleepTimerMode==='episode'){state.sleepTimerMode='off';native.controlPlayer('pause');toast('🌙 本集已播完，睡眠定时已自动暂停播放');render();return;}if(state.autoNext&&state.site===session.siteId&&String(state.detail?.id)===session.movie.id){const list=state.detail?.playSources?.[state.line]?.list||[],index=list.findIndex(x=>x.id===session.episodeId);if(index>=0&&index<list.length-1)playEpisode(index+1);}}
};
function applyResolvedEpisode(d,result,{prefetch=false}={}){
 state.line=result.lineIndex;state.episode=result.episode;state.pendingEpisodeIndex=result.episodeIndex;
 const totalEps=d.playSources?.[result.lineIndex]?.list?.length||0;
 state.episodePage=Math.floor((state.episodeDesc&&totalEps>0?totalEps-1-result.episodeIndex:result.episodeIndex)/20);
 state.playURLs=result.urls.slice(0,4);state.playIndex=0;state.playLatencyMs=prefetch?1:(result.latencyMs||0);state.playQualityLabel=result.qualityLabel||'';state.playBandwidth=result.bandwidth||0;state.playRecovery.triedLines.add(result.lineIndex);if(result.urls[0]?.url)state.playRecovery.failedURLs.add(result.urls[0].url);
 state.loading=false;state.playStatus='';render();
 if(result.switched)toast('已切换至可用线路：'+d.playSources[result.lineIndex].name);
 else if(prefetch)showPlayerHUD('⚡ 已命中下一集预热缓存，秒速起播');
}
async function verifyInBackground(client,detail,lineIndex,episodeIndex,signal,epoch){
 // A1 的后半段：起播后在后台验证候选地址，把画质/软解地址/预热
 // 清单合并到正在播的地址上。正在播的地址验死且首帧未出时，不等
 // 播放器自己超时（15 秒宽限 + 软解重建），直接走恢复流程换线；
 // 已经出画面的不打断——验证失败很可能只是瞬时抖动。
 try{
  const activeLine=Number.isInteger(state.line)?state.line:lineIndex,activeEp=Number.isInteger(state.pendingEpisodeIndex)?state.pendingEpisodeIndex:episodeIndex;
  const result=await resolvePlayableEpisode(client,detail,activeLine,activeEp,signal,()=>{},{excludedLines:[...state.playRecovery.failedLines],initialLineIndex:activeLine,initialUrls:state.playURLs,lineHealth:state.lineHealth});
  if(epoch!==state.epoch)return;
  if(state.page!=='detail'||!state.episode||String(state.detail?.id)!==String(detail.id))return;
  const verifiedByUrl=new Map(result.urls.filter(u=>u.verifiedMeta).map(u=>[u.url,u.verifiedMeta]));
  for(const entry of state.playURLs){const meta=verifiedByUrl.get(entry.url);if(meta){entry.verifiedMeta=meta;entry.cicadaURL=meta.cicadaURL||entry.cicadaURL||'';if(meta.warmPlaylists?.length)entry.warmPlaylists=meta.warmPlaylists;}}
  if(!result.switched){for(const u of result.urls)if(u?.url&&!state.playURLs.some(x=>x.url===u.url)&&state.playURLs.length<4)state.playURLs.push(u);}
  if(result.qualityLabel){state.playQualityLabel=result.qualityLabel;state.playBandwidth=result.bandwidth||0;}
  const playing=state.playURLs[state.playIndex];
  if(playing&&verifiedByUrl.has(playing.url)&&native.native())native.controlPlayer('updateMeta',{cicadaURL:playing.cicadaURL||'',warmPlaylists:playing.warmPlaylists||[]});
  if(playing&&verifiedByUrl.has(playing.url)){render();return;}
  // 后台验证只在“还在等首帧、没进软解回退、恢复流程没在跑”时才
  // 能打断播放：软解回退有自己的 10 秒首帧看门狗，验证中途换线
  // 会直接杀掉它；恢复流程正在跑时也不抢，它自己会按失败集合推进。
  const recovery=state.playRecovery;
  if(playing&&state.playLoading&&state.diagEngine!=='Cicada'&&recovery&&!recovery.running){
   if(result.switched){
    // 换线前把被放弃的线路记死：不记的话，下一次后台验证可能
    // 又切回来，两条时好时坏的线路会在验证里无限对跳（走马上任
    // 就是这么空转的）。每集最多后台换线 2 次，超过就把决定权
    // 还给播放器和恢复流程，不再主动切。
    const abandoned=state.line;
    if((recovery.backgroundSwitches||0)>=2){render();return;}
    recovery.failedLines.add(abandoned);recovery.triedLines.add(abandoned);
    if(playing.url)recovery.failedURLs.add(playing.url);
    recovery.backgroundSwitches=(recovery.backgroundSwitches||0)+1;
    state.line=result.lineIndex;recordDiag('switch','后台验证发现当前线路不可用，已切换到'+(detail.playSources?.[result.lineIndex]?.name||'可用线路'));toast('当前线路验证失败，已切换到可用线路');await playEpisode(result.episodeIndex,{automatic:true});return;}
   const session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};
   recordDiag('failed','当前地址验证失败，正在尝试备用地址');
   void recoverPlayback(session,'当前地址验证失败，正在尝试备用地址');
   return;
  }
  render();
 }catch(error){/* 后台验证失败不打断正在播的画面；播放器自己会报失败 */}
}
async function playEpisode(index,{automatic=false}={}){
 const d=state.detail,selected=state.line,line=d?.playSources?.[selected];if(!line?.list?.[index])return;
 cancelEpisodePrefetch();state.nextEpisodeReady=false;
 const requested=line.list[index],recoveryKey=`${state.site}:${d.id}:${requested.id}`,prefetchKey=`${state.site}:${d.id}:${selected}:${index}`;
 if(!automatic||state.playRecovery?.key!==recoveryKey)state.playRecovery={key:recoveryKey,failedURLs:new Set(),failedLines:new Set(),triedLines:new Set(),running:false};
 const c=client(),{signal,epoch}=cancel();saveProgress($('#video')?.currentTime);if(!automatic){state.playTime=0;state.playDuration=0;}state.playURLs=[];state.episode=null;state.playError='';state.pendingEpisodeIndex=index;
 const cachedPrefetch=!automatic?episodePrefetchCache.get(prefetchKey):null;
 const usePrefetch=cachedPrefetch&&(Date.now()-cachedPrefetch.timestamp<180000);
 if(usePrefetch)episodePrefetchCache.delete(prefetchKey);
 else{state.loading=true;state.playStatus='正在准备播放…';state.playLoading=true;state.playLoadingText=state.playStatus;render();}
 try{
  if(usePrefetch){
   const result=cachedPrefetch.result;
   if(epoch!==state.epoch)return;
   applyResolvedEpisode(d,result,{prefetch:true});
   if(native.native())await launchNativePlayer();else $('#video')?.play().catch(()=>{});
   scheduleNextEpisodePrefetch(d,result.lineIndex,result.episodeIndex+1);
   window.scrollTo({top:0,behavior:'smooth'});
   return;
  }
  // A1 先播后验：先拿第一条基本有效的地址起播，验证在后台并行跑。
  const fast=await resolveFirstCandidate(c,d,selected,index,signal,{excludedLines:automatic?[...state.playRecovery.failedLines]:[],lineHealth:state.lineHealth});
  if(epoch!==state.epoch)return;
  applyResolvedEpisode(d,{...fast,latencyMs:0,qualityLabel:'',bandwidth:0});
  if(native.native())await launchNativePlayer();else $('#video')?.play().catch(()=>{});
  scheduleNextEpisodePrefetch(d,fast.lineIndex,fast.episodeIndex+1);
  window.scrollTo({top:0,behavior:'smooth'});
  void verifyInBackground(c,d,selected,index,signal,epoch);
 }catch(error){if(epoch===state.epoch&&error.name!=='AbortError'){if(state.playRecovery)state.playRecovery.running=false;state.playError=error.message;state.loading=false;state.playLoading=false;state.playStatus='';render();}}
 finally{if(epoch===state.epoch&&state.loading){state.loading=false;state.playStatus='';render();}}
}

function wireVideo(){
 const liveVideo=$('#live-video');
 if(liveVideo&&!native.native()){
  liveVideo.dataset.aspect=state.aspectMode;
  liveVideo.addEventListener('loadedmetadata',()=>{if(state.page==='live'&&state.liveActive){state.liveVideoReady=true;state.liveStatus='正在直播';}});
  liveVideo.addEventListener('error',()=>{if(state.page==='live'&&state.liveActive)void handleLivePlaybackFailure('网页直播流连接中断，正在尝试备用线路');});
 }
 const video=$('#video');if(!video){playbackSession=null;return;}
 video.playbackRate=state.playbackRate;
 video.muted=state.playerMuted;
 video.dataset.aspect=state.aspectMode;
 video.classList.toggle('is-mirrored',state.playerMirrored);
 if(video.dataset.wiredUrl===video.getAttribute('src'))return;
 video.dataset.wiredUrl=video.getAttribute('src')||'';
 const preview=state.playURLs[state.playIndex]?.preview===true,session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title,preview};
 playbackSession=session;saveProgress(undefined,session);
 video.addEventListener('loadedmetadata',()=>{if(preview)return;if(Number.isFinite(video.duration)&&video.duration>0)saveProgress(undefined,session,video.duration);const row=validSavedRows('history').find(x=>x.siteId===session.siteId&&String(x.movie.id)===String(session.movie.id)&&String(x.episodeId)===String(session.episodeId));if(row?.time>3&&row.time<video.duration-5){video.currentTime=row.time;showPlayerHUD('已续播至 '+formatDuration(row.time));}});
 let last=0,outroSkipped=false;video.addEventListener('timeupdate',()=>{if(!preview&&Date.now()-last>5000){saveProgress(video.currentTime,session,video.duration);last=Date.now();}if(shouldAutoSkipOutro({preview,outroSkipped,autoNext:state.autoNext,skipOutroSeconds:state.skipOutroSeconds,duration:video.duration,currentTime:video.currentTime})){const list=state.detail?.playSources?.[state.line]?.list||[],idx=list.findIndex(x=>x.id===state.episode?.id);if(idx>=0&&idx<list.length-1){outroSkipped=true;toast('已自动跳过片尾，切入下一集');playEpisode(idx+1);}}});
 video.addEventListener('error',()=>void recoverPlayback(session,'网页播放器无法读取当前线路'));
 video.addEventListener('ended',()=>{saveProgress(0,session,video.duration);if(state.sleepTimerMode==='episode'){state.sleepTimerMode='off';video.pause();toast('🌙 本集已播完，睡眠定时已自动暂停播放');render();return;}if(!state.autoNext)return;const list=state.detail?.playSources?.[state.line]?.list||[],index=list.findIndex(x=>x.id===state.episode?.id);if(index>=0&&index<list.length-1)playEpisode(index+1);});
 video.addEventListener('dblclick',e=>{
  const rect=video.getBoundingClientRect(),ratio=(e.clientX-rect.left)/Math.max(1,rect.width);
  if(ratio<0.33){e.preventDefault();seekActivePlayer(-15);}
  else if(ratio>0.67){e.preventDefault();seekActivePlayer(15);}
 });
 let holdTimer=null,boosting=false;
 const startHold=()=>{clearTimeout(holdTimer);holdTimer=setTimeout(()=>{if(!video.paused&&video.playbackRate!==2){boosting=true;video.playbackRate=2;showPlayerHUD('⚡ 2.0× 长按倍速播放中');}},420);};
 const endHold=()=>{clearTimeout(holdTimer);if(boosting){boosting=false;video.playbackRate=state.playbackRate;showPlayerHUD(`已恢复 ${state.playbackRate}× 倍速`);}};
 video.addEventListener('pointerdown',startHold,{passive:true});
 video.addEventListener('pointerup',endHold,{passive:true});
 video.addEventListener('pointercancel',endHold,{passive:true});
 video.addEventListener('pointerleave',endHold,{passive:true});
}
root.addEventListener('touchstart',e=>{const hero=e.target.closest('.hero');heroTouchStartX=hero&&e.touches?.[0]?e.touches[0].clientX:null;},{passive:true});
root.addEventListener('touchend',e=>{if(heroTouchStartX===null||state.page!=='home')return;const endX=e.changedTouches?.[0]?.clientX,dx=endX!=null?endX-heroTouchStartX:0;heroTouchStartX=null;if(Math.abs(dx)<45)return;const picks=homePicks();if(picks.length<2)return;lastHeroInteractionAt=Date.now();state.heroIndex=(state.heroIndex+(dx<0?1:picks.length-1))%picks.length;if(!updateHeroCarouselDOM())render();},{passive:true});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if(state.showAgeGate){state.showAgeGate=false;render();return;}
  if(state.page==='live'&&state.liveSheet){state.liveSheet='';state.liveSelectedRoute=null;state.liveSelectedProgram=null;render();return;}
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){document.activeElement.blur();return;}
 }
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
  const searchInput=$('#search-query')||$('#live-search-form input');
  if(searchInput){e.preventDefault();searchInput.focus();searchInput.select?.();return;}
 }
 if(state.page!=='detail'||!state.playURLs.length)return;
 const video=$('#video');
 if(e.key==='ArrowRight'){e.preventDefault();seekActivePlayer(15);}
 else if(e.key==='ArrowLeft'){e.preventDefault();seekActivePlayer(-15);}
 else if(e.key===' '&&video){e.preventDefault();if(video.paused){video.play().catch(()=>{});showPlayerHUD('▶ 播放');}else{video.pause();showPlayerHUD('⏸ 暂停');}}
 else if((e.key==='f'||e.key==='F')&&video){e.preventDefault();video.webkitEnterFullscreen?.()||video.requestFullscreen?.();}
 else if((e.key==='m'||e.key==='M')&&video){e.preventDefault();video.muted=!video.muted;state.playerMuted=video.muted;showPlayerHUD(video.muted?'🔇 已静音':'🔊 已取消静音');}
 else if(e.key==='ArrowUp'&&video){e.preventDefault();video.muted=false;video.volume=Math.min(1,Math.round((video.volume+0.1)*10)/10);showPlayerHUD(`🔊 音量 ${Math.round(video.volume*100)}%`);}
 else if(e.key==='ArrowDown'&&video){e.preventDefault();video.volume=Math.max(0,Math.round((video.volume-0.1)*10)/10);showPlayerHUD(`🔉 音量 ${Math.round(video.volume*100)}%`);}
 else if((e.key==='n'||e.key==='N')){const list=state.detail?.playSources?.[state.line]?.list||[],idx=list.findIndex(x=>x.id===state.episode?.id);if(idx>=0&&idx<list.length-1){e.preventDefault();playEpisode(idx+1);}}
});
root.addEventListener('click',async event=>{const button=event.target.closest('[data-act]');if(!button)return;const {act,id}=button.dataset;try{if(act==='source'){if(!sites.some(item=>item.id===id))return;cacheView();saveProgress($('#video')?.currentTime);cancel();localStorage.setItem('sanyuan:channel:'+state.site,String(state.channel));state.site=id;state.channel=Number(localStorage.getItem('sanyuan:channel:'+id)||1);state.discoverTab=0;state.heroIndex=0;state.collectionStack=[];restoreFilters();localStorage.setItem('sanyuan:site',id);state.detail=null;state.playURLs=[];state.episode=null;state.authError='';if(state.page==='detail')state.page='home';state.sections=[];state.items=[];state.loading=false;if(state.page==='discover')loadDiscovery();else if(!client().config||!restoreView())load();else render();}
else if(act==='page'||act==='account'){if(act==='page'&&!['home','discover','browse','live','me','saved','settings','diagnostics'].includes(id))return;if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);cacheView();if(id==='live'&&state.page!=='live')state.liveReturn={page:state.page,scrollY:window.scrollY};if(state.page==='live'&&id!=='live'){native.closeLive();state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGLoading=false;if(state.liveActive){state.liveResume=true;state.liveActive=false;}}cancel();state.page=act==='account'?'me':id;if(act==='account')state.meTab='settings';state.error='';state.loading=false;window.scrollTo(0,0);if(state.page==='discover')loadDiscovery();else if(['home','browse'].includes(state.page)){if(!client().config||!restoreView())load();else render();}else{render();if(state.page==='live'){native.openLive();liveCacheReady.then(()=>{if(state.page!=='live')return;if(state.liveChannels.length)render();else if(!state.liveCacheFound&&!state.liveInitialAttempted)loadLivePlaylist();});if(state.liveResume&&liveChannel()){state.liveResume=false;state.liveTriedURLs.clear();playLiveVariant(state.liveVariantIndex);}}}}
else if(act==='live-back'){if(state.liveActive){state.liveResume=true;state.liveActive=false;}native.closeLive();state.liveSheet='';state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGLoading=false;const previous=state.liveReturn||{page:'home',scrollY:0};state.liveReturn=null;state.page=previous.page;render();requestAnimationFrame(()=>window.scrollTo({top:previous.scrollY||0,behavior:'instant'}));}
else if(act==='live-import-open'){state.liveImportOpen=!state.liveImportOpen;render();}
else if(act==='live-refresh')loadLivePlaylist();
else if(act==='live-panel'){state.livePanel=id;render();if(id==='programs')loadLiveGuide();}
else if(act==='live-category'){state.liveCategory=id;state.liveSearch='';state.liveVisibleCount=80;state.liveNativeVisibleCount=40;state.liveSelectedRoute=null;if(state.livePanel==='categories')state.livePanel='channels';render();}
else if(act==='live-more'){state.liveVisibleCount+=80;render();}
else if(act==='live-channel'){const index=Number(id),channel=state.liveChannels[index];if(channel){state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGLoading=false;state.liveCurrentIndex=index;state.liveTriedURLs.clear();state.liveVariantIndex=0;state.liveError='';state.livePrograms=[];state.liveProgramDate='';state.liveSelectedRoute=null;await playLiveVariant(0);}}
else if(act==='live-step'){
 if(!state.liveChannels.length)return;
 const step=Number(id)||1,filtered=liveFilteredChannels(),inFiltered=filtered.findIndex(ch=>ch.index===state.liveCurrentIndex);
 const pool=inFiltered>=0&&filtered.length>1?filtered:state.liveChannels,currentPos=pool===filtered?inFiltered:Math.max(0,state.liveCurrentIndex),targetChannel=pool[(currentPos+step+pool.length)%pool.length];
 const next=targetChannel?targetChannel.index:0;
 state.liveCurrentIndex=next;state.liveTriedURLs.clear();state.liveVariantIndex=0;state.liveError='';state.livePrograms=[];state.liveProgramDate='';state.liveSelectedRoute=null;
 toast('已切台：'+(state.liveChannels[next]?.name||'频道'));
 await playLiveVariant(0);
}
else if(act==='live-play'){state.liveTriedURLs.clear();await playLiveVariant(state.liveVariantIndex);}
else if(act==='live-route'){const routes=liveCandidateList(liveChannel()),index=Number(id);if(routes[index]){state.liveSelectedRoute=routes[index];state.liveSheet='route';render();}}
else if(act==='live-route-system'){const route=state.liveSelectedRoute;state.liveSheet='';state.liveSelectedRoute=null;if(route){state.liveTriedURLs.clear();state.liveError='';const index=liveCandidateList(liveChannel()).findIndex(item=>item.url===route.url);if(index>=0)await playLiveVariant(index);}}
else if(act==='live-route-vlc'){const route=state.liveSelectedRoute;state.liveSheet='';render();if(route){try{await native.openExternal(route.url,{live:true});toast('已切换到 VLC');}catch(error){toast(error.message||'未检测到 VLC，请先安装 VLC');}}}
else if(act==='live-route-copy'){const route=state.liveSelectedRoute;state.liveSheet='';render();if(route){if(native.native())await native.copyText(route.url);else if(navigator.clipboard)await navigator.clipboard.writeText(route.url);else throw Error('此设备不允许复制播放地址');toast('已复制播放地址');}}
else if(act==='live-favorite'){const channel=state.liveChannels[Number(id)];if(channel){state.liveFavorites=liveFavorite(channel)?state.liveFavorites.filter(item=>item!==channel.identity):[...state.liveFavorites,channel.identity];write('liveFavorites',state.liveFavorites);render();}}
else if(act==='live-favorite-current'){const channel=liveChannel();if(channel){state.liveFavorites=liveFavorite(channel)?state.liveFavorites.filter(item=>item!==channel.identity):[...state.liveFavorites,channel.identity];write('liveFavorites',state.liveFavorites);render();}}
else if(act==='live-airplay'){if(native.native()){const rect=button.getBoundingClientRect();native.showAirPlay({x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:innerWidth});}else toast('AirPlay 投放需在 iPhone 原生 App 中使用');}
else if(act==='live-channel-info'){state.liveSheet='channel';render();}
else if(act==='live-epg-info'){state.liveSheet='guide';render();}
else if(act==='live-sheet-dismiss'){if(button.classList.contains('live-sheet-backdrop')&&event.target!==button)return;state.liveSheet='';state.liveSelectedRoute=null;render();}
else if(act==='live-date'){state.liveProgramDate=id;render();}
else if(act==='live-program'){const channel=liveChannel(),days=[...new Set(state.livePrograms.map(program=>dayKey(program.start)))],today=dayKey(Date.now()),selectedDate=days.includes(state.liveProgramDate)?state.liveProgramDate:days.includes(today)?today:days[0]||today;state.liveSelectedProgram=state.livePrograms.filter(program=>dayKey(program.start)===selectedDate)[Number(id)]||null;state.liveSheet='program';render();}
else if(act==='live-program-dismiss'){state.liveSelectedProgram=null;state.liveSheet='';render();}
else if(act==='live-epg-refresh'){state.livePrograms=[];loadLiveGuide({force:true});}
else if(act==='live-fullscreen'){if(!native.native())$('#live-video')?.webkitEnterFullscreen?.();}
else if(act==='discover-tab'){state.discoverTab=Number(id);if(!discoveryCache.has(discoveryCacheKey(state.discoverTab)))state.discoverGroups=[];loadDiscovery();}
else if(act==='discover-month'){state.discoverMonth=Number(id);render();}
else if(act==='discover-year'){state.discoverYear=Number(id);render();}
else if(act==='discover-reset-date'){state.discoverYear=new Date().getFullYear();state.discoverMonth=new Date().getMonth()+1;render();}
else if(act==='discover-more')loadDiscovery({more:true});
else if(act==='me-tab'){nativeClearConfirm=false;if(state.meTab!==id)window.scrollTo({top:0,behavior:'instant'});state.page='me';state.meTab=id;if(id==='favorites'||id==='history')state.savedTab=id;render();}
else if(act==='hero-pick'){lastHeroInteractionAt=Date.now();state.heroIndex=Number(id);if(!updateHeroCarouselDOM())render();}
else if(act==='remove-history'){event.stopPropagation();const key=button.dataset.key;write('history',read('history').filter(r=>(r.key||(r.siteId+':'+r.movie.id))!==key));invalidateHomeDOMCache();toast('已移除观看记录');render();}
else if(act==='remove-saved-item'){event.stopPropagation();const key=button.dataset.key;write(state.savedTab,read(state.savedTab).filter(r=>(r.key||(r.siteId+':'+r.movie.id))!==key));invalidateHomeDOMCache();toast('已移除条目');render();}
else if(act==='search-clear'){state.query='';const input=$('#search-query');if(input){input.value='';input.focus();}button.hidden=true;}
else if(act==='search-chip'){const q=button.dataset.query||'';if(q){rememberSearch(q);state.query=q;state.page='search';state.items=[];load();}}
else if(act==='search-history-clear'){state.searchHistory=[];write('searchHistory',[]);render();}
else if(act==='collection-link')openCollection(button.dataset.route,button.dataset.title);
else if(act==='collection-back'){
 cancel();const previous=state.collectionStack.pop();
 if(previous){Object.assign(state,previous,{page:'collection',loading:false,error:''});render();requestAnimationFrame(()=>window.scrollTo({top:previous.scrollY||0,behavior:'instant'}));}
 else{state.page='home';state.loading=false;state.error='';restoreView();render();requestAnimationFrame(()=>window.scrollTo({top:state.homeScroll||0,behavior:'instant'}));}
}
else if(act==='history-all'){state.savedTab='history';state.meTab='history';state.page='me';render();window.scrollTo(0,0);}
else if(act==='filter-option'||act==='filter-clear'||act==='filters-reset'){
 cacheView();
 if(act==='filters-reset')state.filters={};else if(act==='filter-clear')delete state.filters[button.dataset.key];else state.filters[button.dataset.key]=id;
 rememberFilters();state.items=[];if(!restoreView())load();else render();
}
else if(act==='filters-expanded'){const key=`sanyuan:filters-expanded:${state.site}:${state.channel}`;localStorage.setItem(key,localStorage.getItem(key)==='true'?'false':'true');render();}
else if(act==='category'){cacheView();state.channel=Number(id);state.episodePage=0;restoreFilters();state.items=[];state.page='browse';if(!restoreView())load();else render();}
else if(act==='refresh'||act==='refresh-config'){const currentClient=client();if(act==='refresh-config')currentClient.config=null;if(state.page==='detail')openDetail(state.detail?.id);else if(state.page==='discover')loadDiscovery({refresh:true});else load();}
else if(act==='detail')openDetail(id,button.dataset.source||state.site);
else if(act==='season'){if(String(state.detail?.id)!==String(id))await openDetail(id);}
else if(act==='back'){cancel();state.playURLs=[];if(state.detailReturn){const previous=state.detailReturn;restoreDetailPage(previous);}else{state.page='home';state.loading=false;if(!restoreView())load();else render();}}
else if(act==='more')load({more:true});
else if(act==='favorite'){const movie=state.sections.flatMap(x=>x.items).find(x=>x.id===id);if(movie){favorite(movie);updateHeroCarouselDOM();}}
else if(act==='favorite-detail'){favorite(detailMovie());render();}
else if(act==='play-first'){const list=state.detail?.playSources?.[state.line]?.list||[],current=list.findIndex(ep=>ep.id===state.episode?.id),resumeIdx=current<0?(resumeEntryForDetail(state.detail)?.index??-1):-1;if(list.length)await playEpisode(current>=0?current:resumeIdx>=0?resumeIdx:0);else $('#episode-list')?.scrollIntoView({behavior:'smooth',block:'start'});}
else if(act==='scroll-episodes')$('#episode-list')?.scrollIntoView({behavior:'smooth',block:'start'});
else if(act==='saved-tab'){nativeClearConfirm=false;state.savedTab=id;state.meTab=id==='history'?'history':'favorites';state.page='me';render();}
else if(act==='scroll-top'){window.scrollTo({top:0,behavior:'smooth'});}
else if(act==='clear-saved'){if(button.dataset.confirm==='yes'){nativeClearConfirm=false;write(state.savedTab,[]);invalidateHomeDOMCache();toast(state.savedTab==='favorites'?'已清空收藏':'已清空观看记录');render();}else{button.dataset.confirm='yes';button.textContent='⚠️ 再次点击确认清空';setTimeout(()=>{if(button.isConnected&&button.dataset.confirm==='yes'){delete button.dataset.confirm;button.textContent=state.savedTab==='favorites'?'清空收藏':'清空观看记录';}},4000);}}
else if(act==='expand-summary'){const s=$('#summary');if(s){const exp=s.classList.toggle('expanded');button.innerHTML=exp?'收起简介 <span>⌃</span>':'展开简介 <span>⌄</span>';}}
else if(act==='actor-search'){const q=String(id||'').trim();if(q){rememberSearch(q);state.query=q;state.page='search';state.items=[];window.scrollTo(0,0);load();}}
else if(act==='saved-source-filter'){nativeClearConfirm=false;state.savedSourceFilter=id||'all';render();}
else if(act==='live-search-clear'){state.liveSearch='';state.liveVisibleCount=80;render();}
else if(act==='live-reset-default'){const defURL='https://fnipv.69574517.xyz/shiju19880215/interface.m3u';state.liveURL=defURL;const inp=$('#live-playlist-url');if(inp)inp.value=defURL;toast('已填入默认直播源地址');}
else if(act==='skip-outro-setting'){const sec=Number(id);if([0,60,90,120].includes(sec)){state.skipOutroSeconds=sec;write('skipOutroSeconds',sec);toast(sec>0?`已开启片尾剩余 ${sec} 秒自动连播`:'已关闭自动跳过片尾');render();}}
else if(act==='player-mute'){state.playerMuted=!state.playerMuted;const v=$('#video');if(v)v.muted=state.playerMuted;if(native.native())native.controlPlayer('mute',{muted:state.playerMuted});showPlayerHUD(state.playerMuted?'🔇 已静音':'🔊 已开启声音');button.textContent=state.playerMuted?'🔇 已静音':'🔊 声音';button.classList.toggle('accent',state.playerMuted);}
else if(act==='player-mirror'){state.playerMirrored=!state.playerMirrored;const v=$('#video');if(v)v.classList.toggle('is-mirrored',state.playerMirrored);showPlayerHUD(state.playerMirrored?'⇄ 已开启镜像画面':'⇄ 已恢复正常画面');button.classList.toggle('accent',state.playerMirrored);}
else if(act==='adult-toggle'){if(state.adultEnabled){state.adultEnabled=false;localStorage.setItem('sanyuan:adult','false');state.showAgeGate=false;if(state.channel===5){state.channel=1;state.filters={};state.items=[];state.next='page=1';}toast('已隐藏 18+ 分类');render();}else{state.showAgeGate=true;render();}}
else if(act==='age-confirm'){state.adultEnabled=true;state.showAgeGate=false;localStorage.setItem('sanyuan:adult','true');toast('已启用 18+ 分类');render();}
else if(act==='age-cancel'){if(button.classList.contains('agebackdrop')&&event.target!==button)return;state.showAgeGate=false;render();}
else if(act==='columns'){state.columns=id;localStorage.setItem('sanyuan:columns',id);render();}
else if(act==='theme'){state.theme=id==='black'?'black':'white';localStorage.setItem('sanyuan:theme',state.theme);render();}
else if(act==='settings-section'){state.settingsSection=id||'all';render();}
else if(act==='playback-rate-btn'){const r=Number(id);if([0.5,0.75,1,1.25,1.5,2].includes(r)){applyLivePlaybackRate(r);toast(`播放倍速已设为 ${r}×`);render();}}
else if(act==='reset-playback-prefs'){state.cleanHLS=true;state.autoNext=true;state.playbackRate=1;state.skipIntroSeconds=90;state.skipOutroSeconds=0;state.aspectMode='fit';write('cleanHLS',true);write('autoNext',true);write('playbackRate',1);write('skipIntroSeconds',90);write('skipOutroSeconds',0);localStorage.setItem('sanyuan:aspectMode','fit');toast('已恢复默认播放设置');render();}
else if(act==='clear-runtime-cache'){viewCache.clear();discoveryCache.clear();pageDOMCache.clear();pageScrollCache.clear();episodePrefetchCache.clear();toast('已清理内存与页面缓存');render();}
else if(act==='clear-search-history-settings'){state.searchHistory=[];write('searchHistory',[]);toast('已清空搜索记录');render();}
else if(act==='skip-intro-setting'){const sec=Number(id);if([60,90,120].includes(sec)){state.skipIntroSeconds=sec;write('skipIntroSeconds',sec);toast(`跳过片头已设为 ${sec} 秒`);render();}}
else if(act==='aspect-setting'){if(['fit','fill','stretch'].includes(id)){state.aspectMode=id;localStorage.setItem('sanyuan:aspectMode',id);if(native.native())native.controlPlayer('gravity',{mode:id});toast('默认画面比例已更新');render();}}
else if(act==='player-seek'){seekActivePlayer(Number(id)||15);}
else if(act==='player-skip-intro'){seekActivePlayer(state.skipIntroSeconds||90);}
else if(act==='player-aspect'){cycleAspectMode();}
else if(act==='player-sleep-timer'){cycleSleepTimer();}
else if(act==='sleep-timer-setting'){if(['off','episode','15','30','60'].includes(id))applySleepTimer(id);}
else if(act==='player-offline-cache'){
 const entry=state.playURLs[state.playIndex];
 if(!entry?.url||!state.episode){toast('暂无可缓存的视频地址');return;}
 if(!native.native()){toast('离线缓存仅在 iPhone 原生 App 中可用');return;}
 const cacheKey=`${state.site}_${state.detail?.id}_${state.episode.id}`,title=`${state.detail?.title||''} ${state.episode.title||''}`.trim();
 toast('正在缓存播放清单…');
 try{await native.saveOfflineEpisode(cacheKey,title,entry.url,mediaHeaders(client(),entry));toast('已缓存到本地');}catch(err){toast(err.message||'缓存失败');}
}
else if(act==='player-copy-url'){
 const url=state.playURLs[state.playIndex]?.url;
 if(url){await native.copyText(url);toast('已复制当前播放流地址');}
}
else if(act==='player-open-vlc'){
 const url=state.playURLs[state.playIndex]?.url;
 if(url){try{await native.openExternal(url,{live:false});toast('已唤起 VLC 播放');}catch(err){toast(err.message||'未检测到 VLC');}}
}
else if(act==='player-pip'){
 const video=$('#video');
 if(video){
  if(document.pictureInPictureElement)await document.exitPictureInPicture().catch(()=>{});
  else if(video.requestPictureInPicture)await video.requestPictureInPicture().catch(()=>toast('当前浏览器不支持画中画'));
  else if(video.webkitSetPresentationMode)video.webkitSetPresentationMode(video.webkitPresentationMode==='picture-in-picture'?'inline':'picture-in-picture');
 }
}
else if(act==='episode-order'){state.episodeDesc=!state.episodeDesc;state.episodePage=0;render();}
else if(act==='episode-locate'){const list=state.detail?.playSources?.[state.line]?.list||[],cur=list.findIndex(x=>x.id===state.episode?.id);if(cur>=0){state.episodePage=Math.floor((state.episodeDesc?list.length-1-cur:cur)/20);render();}}
else if(act==='saved-sort-toggle'){state.savedSort=state.savedSort==='title'?'recent':'title';render();}
else if(act==='episode-step'){const list=state.detail?.playSources?.[state.line]?.list||[],index=list.findIndex(x=>x.id===state.episode?.id)+Number(id);if(index>=0&&index<list.length)await playEpisode(index);}
else if(act==='episode-page'){state.episodePage=Math.max(0,Number(id)||0);render();}
else if(act==='play-source'){
 const target=Number(id);if(target===state.line)return;
 const requested=state.episode,oldLine=state.detail?.playSources?.[state.line],{signal,epoch}=cancel();
 saveProgress($('#video')?.currentTime);state.line=target;state.episodePage=0;state.playURLs=[];state.episode=null;state.loading=true;state.playError='';state.error='';render();
 try{
  await loadEpisodes(signal);if(epoch!==state.epoch)return;
  const list=state.detail?.playSources?.[target]?.list||[],at=requested?matchingEpisode(requested,list,{singleMovie:Number(state.detail?.channelId)===1&&oldLine?.list?.length===1,singleEpisodeSource:oldLine?.list?.length===1}):-1;
  state.loading=false;
  if(requested&&at>=0){await playEpisode(at);return;}
  if(requested)toast('这条线路没有对应集数，请重新选择选集。');
 }catch(error){if(epoch===state.epoch&&error.name!=='AbortError')state.error=error.message;}
 finally{if(epoch===state.epoch){state.loading=false;render();}}
}
else if(act==='episode')await playEpisode(Number(id));
else if(act==='native-player'){if(!native.native()){$('#video')?.webkitEnterFullscreen?.();return;}await launchNativePlayer();}
else if(act==='retry-play')await playEpisode(state.pendingEpisodeIndex);
else if(act==='anonymous'){state.authError='';button.disabled=true;try{await client().anonymous();toast('访客模式已启用');}catch(error){state.authError=error.message;}render();}
else if(act==='logout'){await client().logout();toast('已退出本站会话');render();}
else if(act==='prefer-line'){client().preferred[button.dataset.kind]=button.dataset.url;toast('优先线路已更新');render();}
else if(act==='probe-all-sites'){await probeAllSites();}
else if(act==='probe-site'){
 const target=sites.find(s=>s.id===id);
 if(target){
  button.disabled=true;
  toast(`正在测试【${target.name}】连通性…`);
  const res=await probeSite(target);
  render();
  if(native.native())native.syncPage(nativePageSnapshot());
  toast(res.ok?`【${target.name}】握手正常 · 延迟 ${res.ms} ms`:`【${target.name}】测试未通过：${res.status}`);
 }
}
else if(act==='clear-site-health'){
 state.siteHealth={};write('siteHealth',{});render();
 if(native.native())native.syncPage(nativePageSnapshot());
 toast('已清空全网片源连通性记录');
}
else if(act==='probe-lines'){button.disabled=true;const c=client();if(site().provider){await c.home();render();toast('当前片库线路检测完成');return;}if(!c.config)await c.bootstrap();let bestMs=Infinity;for(const kind of ['cache','logic']){const urls=(c.config?.urls?.[kind]||[]).filter(u=>{try{return new URL(u).protocol==='https:';}catch{return false;}}).slice(0,5);await Promise.all(urls.map(async url=>{const start=Date.now(),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);try{const r=await native.request({url:url.replace(/\/$/,'')+'/heartbeat.check',method:'GET',headers:{},signal:ctrl.signal});const ms=Date.now()-start,ok=r.status>=200&&r.status<300;c.recordHealth(url,kind,ms,ok);if(ok&&ms<bestMs)bestMs=ms;}catch{c.recordHealth(url,kind,Date.now()-start,false);}finally{clearTimeout(timer);}}));const fastest=c.health.filter(h=>h.kind===kind&&h.ok).sort((a,b)=>a.ms-b.ms)[0];if(fastest&&(!c.preferred[kind]||!c.health.some(h=>h.kind===kind&&h.url===c.preferred[kind]&&h.ok)))c.preferred[kind]=fastest.url;}render();toast(Number.isFinite(bestMs)?`线路检测完成 · 最快 ${bestMs} ms`:'线路检测完成');}
}catch(error){toast(error.message);}});
root.addEventListener('input',event=>{if(event.target.id==='search-query'){const clear=$('.search-clear');if(clear)clear.hidden=!event.target.value;}else if(event.target.closest('#live-search-form')){const clear=$('.live-search-clear');if(clear)clear.hidden=!event.target.value;}});
root.addEventListener('submit',async event=>{event.preventDefault();if(event.target.id==='live-import-form'){await loadLivePlaylist(event.target.elements.url.value);}
else if(event.target.id==='live-search-form'){state.liveSearch=event.target.elements.query.value.trim();state.liveVisibleCount=80;render();}
else if(event.target.id==='search-form'){const query=$('#search-query').value.trim();if(!query)return;rememberSearch(query);state.query=query;state.page='search';state.items=[];load();}else if(event.target.id==='login-form'){const form=event.target,account=form.elements.account.value.trim(),password=form.elements.password.value;if(!account||!password)return;form.querySelector('button').disabled=true;state.authError='';try{await client().login(account,password);form.reset();toast('登录成功');}catch(error){state.authError=error.message;}render();}});
root.addEventListener('change',async event=>{if(event.target.dataset.cleanHls!==undefined){state.cleanHLS=event.target.checked;write('cleanHLS',state.cleanHLS);toast('已更新，下次播放生效');}if(event.target.dataset.autoNext!==undefined){state.autoNext=event.target.checked;write('autoNext',state.autoNext);toast(state.autoNext?'已开启自动连播':'已关闭自动连播');}if(event.target.dataset.gridColumns!==undefined){state.columns=event.target.value;localStorage.setItem('sanyuan:columns',state.columns);render();}if(event.target.dataset.playerRate!==undefined){const rate=Number(event.target.value);if([0.5,0.75,1,1.25,1.5,2].includes(rate)){applyLivePlaybackRate(rate);toast('默认倍速已更新');}}if(event.target.dataset.episodePage!==undefined){state.episodePage=Number(event.target.dataset.episodePage);render();}if(event.target.dataset.episodeJump!==undefined){const num=Math.floor(Number(event.target.value));if(Number.isFinite(num)&&num>=1){const list=state.detail?.playSources?.[state.line]?.list||[];if(list.length){const targetIdx=Math.max(0,Math.min(list.length-1,num-1));state.locatedEpisodeIndex=targetIdx;state.episodePage=Math.floor((state.episodeDesc?list.length-1-targetIdx:targetIdx)/20);render();toast('已定位至第 '+(targetIdx+1)+' 集');requestAnimationFrame(()=>pageRoot.querySelector('.episode[data-id="'+targetIdx+'"]')?.scrollIntoView({behavior:'smooth',block:'nearest'}));}}}if(event.target.dataset.filter){cacheView();state.filters[event.target.dataset.filter]=event.target.value;state.items=[];if(!restoreView())load();else render();}if(event.target.id==='source-line'){root.querySelector('[data-act="play-source"][data-id="'+Number(event.target.value)+'"]')?.click();}if(event.target.id==='play-line'){saveProgress($('#video')?.currentTime);state.playIndex=Number(event.target.value);const entry=state.playURLs[state.playIndex],session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};state.playRecovery={key:sessionKey(session),failedURLs:new Set(),failedLines:new Set(),triedLines:new Set([state.line]),running:false};try{const meta=await verifyMedia(client(),entry.url,controller?.signal,entry.headers,entry.referrerPolicy);if(meta?.warmPlaylists?.length)entry.warmPlaylists=meta.warmPlaylists;entry.cicadaURL=meta?.variants?.[0]?.href||'';state.playQualityLabel=meta?.qualityLabel||'';state.playBandwidth=meta?.bandwidth||0;render();if(native.native())await launchNativePlayer();else $('#video')?.play().catch(()=>{});}catch(error){await recoverPlayback(session,error.message);}}});
window.addEventListener('pagehide',()=>saveProgress($('#video')?.currentTime,playbackSession,$('#video')?.duration));
window.addEventListener('online',()=>{if(!state.error||state.loading)return;toast('网络已恢复，正在重新加载');if(state.page==='discover')loadDiscovery({refresh:true});else if(['home','browse','search','collection'].includes(state.page))load();});
setInterval(()=>{
 if(state.sleepTimerEndAt>0&&Date.now()>=state.sleepTimerEndAt){
  state.sleepTimerEndAt=0;state.sleepTimerMode='off';
  $('#video')?.pause();$('#live-video')?.pause();
  if(native.native()){native.controlPlayer('pause');if(state.page==='live')native.stopLive();}
  state.liveActive=false;
  toast('🌙 睡眠定时已到，已为你自动暂停播放');
  render({liveFast:state.page==='live'});
 }
 if(state.page!=='home'||state.loading||heroTouchStartX!==null||Date.now()-lastHeroInteractionAt<4500||document.visibilityState==='hidden'||document.activeElement?.tagName==='INPUT')return;const picks=homePicks();if(picks.length<2)return;state.heroIndex=(state.heroIndex+1)%picks.length;if(!updateHeroCarouselDOM())render();
},5000);
restoreFilters();render();load();

return {  };
})();
})();
