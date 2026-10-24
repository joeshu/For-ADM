let sequence=0;const pending=new Map(),memory=new Map();
const native=()=>!!globalThis.webkit?.messageHandlers?.native;
function post(type,options={}){
  const id='r'+(++sequence);return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{pending.delete(id);globalThis.webkit?.messageHandlers?.native.postMessage({id,type:'cancel'});reject(Error('请求超时，请切换线路重试'));},25000);
    const abort=()=>{clearTimeout(timeout);pending.delete(id);globalThis.webkit?.messageHandlers?.native.postMessage({id,type:'cancel'});reject(new DOMException('请求取消','AbortError'));};
    if(options.signal?.aborted){abort();return;}
    options.signal?.addEventListener('abort',abort,{once:true});
    pending.set(id,{resolve,reject,timeout,abort,signal:options.signal});
    const {signal,...payload}=options;globalThis.webkit.messageHandlers.native.postMessage({id,type,...payload});
  });
}
export const NativeTransport={
  deliver(message){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timeout);item.signal?.removeEventListener('abort',item.abort);if(message.error){const error=Error(message.error);error.code=message.errorCode;item.reject(error);}else item.resolve(message);},
  async request(options){if(native())return post('request',options);const {signal,...payload}=options;const response=await fetch('/__transport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});if(!response.ok)throw Error('本地预览服务不可用');const data=await response.json();if(data.error)throw Error(data.error);return data;},
  async play(url,headers={},options={}){if(native())return post('play',{url,headers,...options});return false;},
  async copyText(text){if(native())return post('copyText',{text});await navigator.clipboard.writeText(text);return {ok:true};},
  async openExternal(url){if(native())return post('openExternal',{url});throw Error('外部播放器仅在 iPhone 原生 App 中可用');},
  stopLive(){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'live-stop',type:'stopLive'});},
  showAirPlay(frame){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:'airplay',type:'airplay',frame});},
  layoutPlayer(context,frame){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:"layout",type:"playerLayout",context,frame});},
  statusStyle(dark){if(native())globalThis.webkit.messageHandlers.native.postMessage({id:"theme",type:"statusStyle",dark:!!dark});},
  native,
  vault:{async get(key){if(!native())return memory.get(key)||null;const result=await post('vaultGet',{key});try{return JSON.parse(result.value)||null;}catch{return null;}},async put(key,user){if(!native()){memory.set(key,user);return;}await post('vaultPut',{key,value:JSON.stringify(user)});},async remove(key){if(!native()){memory.delete(key);return;}await post('vaultDelete',{key});}},
};
globalThis.NativeTransport=NativeTransport;
