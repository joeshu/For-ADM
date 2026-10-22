export class ServiceError extends Error {constructor(message,code){super(message);this.code=code;}}
export const canonicalQuery = params => Object.keys(params).sort().map(key=>key+'='+params[key]).join('&');
const C=()=>{if(!globalThis.CryptoJS)throw Error('加密组件未加载');return globalThis.CryptoJS;};
const read=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}};
export function decodeResponse(response,site){
  const crypto=C(),raw=crypto.enc.Base64.parse(response.bodyBase64),text=crypto.enc.Utf8;
  try{return JSON.parse(text.stringify(raw));}catch{}
  const entry=site.responseKeys.find(x=>x.index===1);if(!entry)throw new ServiceError('缺少数据解码配置');
  try {return JSON.parse(crypto.AES.decrypt({ciphertext:raw},crypto.enc.Utf8.parse(entry.key),{iv:crypto.enc.Utf8.parse(entry.iv),mode:crypto.mode.CBC,padding:crypto.pad.Pkcs7}).toString(text));}
  catch{throw new ServiceError('数据格式已变化，请更新站点适配配置');}
}
export function unwrap(data){
  if(data&&typeof data==='object'&&'code'in data){if(data.code&&data.code!==200&&data.code!=='200')throw new ServiceError(data.message||'服务拒绝了请求',data.code);return data.data;}
  return data;
}
export class SiteClient {
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
  search(k,next='page=1',signal){return this.sessionRequest('/vod/search/query',{k,type:'title',channelId:0,next},signal);}
  detail(id,signal){return this.request('/v2/vod/detail.capi',{vodId:id},'cache',signal);}
  episodes(id,source,signal){return this.request('/v2/vod/episodes.capi',{vodId:id,siteId:source.siteId,episodeVodId:source.episodeVodId||0},'cache',signal);}
  play(params,signal){return this.sessionRequest('/vod/episodePlayUrl',params,signal);}
  async login(account,password,signal){const user=await this.request('/user/loginAccount',{account,password},'logic',signal,'post');this.user=user;await this.saveSession('account');return user;}
  async logout(){this.user=null;this.sessionKind='none';if(this.vault)await this.vault.remove(this.site.id);}
  async anonymous(signal){this.user=await this.request('/user/anonymous',{},'logic',signal,'post');await this.saveSession('guest');return this.user;}
}
