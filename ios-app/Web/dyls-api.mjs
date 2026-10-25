import JSEncrypt from '../node_modules/jsencrypt/bin/jsencrypt.min.js';
import {SiteClient,ServiceError} from './site-api.mjs';

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
export function needsDylsParsing(episode,line){
 if(String(episode?.parseUrl||'').trim())return false;
 const declared=bool(line?.need_to_parse??line?.player_need_to_parse??episode?.need_to_parse??episode?.player_need_to_parse);
 return declared===undefined?!episode?.ready_to_play:declared;
}

// The site's public client uses PKCS#1 v1.5 blocks, concatenates ciphertext,
// then Base64URL encodes the complete result. JSON escapes avoid CESU-8 for
// supplementary Unicode characters in JSEncrypt's legacy string encoder.
export function encodeDylsPack(params,publicKey){
 const cipher=new JSEncrypt();cipher.setPublicKey(publicKey);
 const size=Math.ceil(cipher.getKey().n.bitLength()/8)-11;
 const json=JSON.stringify(params).replace(/[\uD800-\uDFFF]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 const encoder=new TextEncoder(),chunks=[];let current='',bytes=0;
 for(const c of json){const count=encoder.encode(c).length;if(bytes+count>size){chunks.push(current);current='';bytes=0;}current+=c;bytes+=count;}
 if(current)chunks.push(current);
 const binary=chunks.map(chunk=>{const encrypted=cipher.encrypt(chunk);if(!encrypted)throw Error('电影猎手请求编码失败');return atob(encrypted);}).join('');
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function decodeDylsResponse(response,protocol){
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

export class DylsClient extends SiteClient {
 constructor(site,transport,storage){super(site,transport,storage);this.protocol=site.protocol||{};this.details=new Map();}
 buildRequest(_base,path,params={}){
  const payload={timestamp:Date.now(),...params},pack=encodeDylsPack(payload,this.protocol.publicKey);
  const url=new URL('/api/v1'+path,this.site.origin);url.searchParams.set('pack',pack);url.searchParams.set('signature',crypto().HmacMD5(pack,this.protocol.signKey).toString());
  return {url:url.href,method:'GET',headers:{Accept:'application/json, text/plain, */*','X-Client-Version':String(this.protocol.clientVersion||3102),'X-Client-Setting':'{"pure-mode":0}','Accept-Language':'en',Referer:this.site.origin+'/'}};
 }
 async api(path,params={},signal){
  abort(signal);const started=Date.now();let response;
  try{response=await this.transport({...this.buildRequest(this.site.origin,path,params),signal});abort(signal);}catch(error){if(error.name!=='AbortError')this.recordHealth(this.site.origin,'cache',Date.now()-started,false);throw error;}
  let data;
  try{data=decodeDylsResponse(response,this.protocol);}catch(error){
   if(response.status>=200&&response.status<300)throw error;
   this.recordHealth(this.site.origin,'cache',Date.now()-started,false);
   const message='电影猎手请求失败（HTTP '+response.status+'）';
   if([401,403].includes(response.status))throw new ServiceError(message,response.status);
   const failure=new Error(message);failure.status=response.status;throw failure;
  }
  const errorCode=Number(data?.errorCode||0);
  this.recordHealth(this.site.origin,'cache',Date.now()-started,response.status>=200&&response.status<300&&!errorCode);
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
  return {title:String(title),url:'vod/detail?vodId='+encodeURIComponent(String(id)),imageURL:https(row.cover||row.image),channelId:row.type_name==='电影'||cat?.text==='电影'?1:0,isAdult,bottomLabel:String(row.dynamic||row.label||''),scoreText:String(row.score||''),labels:[row.type_name?{name:String(row.type_name)}:null].filter(Boolean)};
 }
 async home(signal){
  if(!this.config)await this.bootstrap(signal);
  const blocks=await this.api('/movie/index_recommend',{},signal);if(!Array.isArray(blocks))throw Error('电影猎手首页结构已变化');
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
  const result={id:String(raw.id),title:String(raw.name||'影片'),imageURL:https(raw.cover),channelId:cat?.text==='电影'?1:0,sourceChannelId:raw.type_id,isAdult:adultMovie(raw)||cat?.isAdult===true,channelName:raw.type_name||cat?.text||'',year:raw.year,area:raw.area?[{name:raw.area}]:[],language:[],summary:String(raw.content||''),scoreText:raw.score?String(raw.score)+'分':'',bottomLabel:String(raw.dynamic||''),labels:names(raw.tags),actors:names(array(raw.members).filter(x=>Number(x.type)===1)),directors:names(array(raw.members).filter(x=>Number(x.type)===3)),playSources:array(raw.play_from).map(line=>({siteId:String(line.code),name:String(line.name||line.code),total:Number(line.total)||array(line.list).length,list:array(line.list).map(ep=>this.normalizeEpisode(ep)),sourceLine:line}))};
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
