/* GENERATED from universal/templates.json and universal/src; revision b64a9d4a7d64. Do not edit. */
(function(){
// Shared operations. No host discovery, logging, network calls or player interception.
function __admRead(root, path) {
  var parts = path ? path.split('.') : [], value = root;
  for (var i=0;i<parts.length;i++) {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value,parts[i])) return undefined;
    value=value[parts[i]];
  }
  return value;
}
function __admGuard(root, guard) {
  if (!guard) return true;
  if (guard.all) return guard.all.every(function(g){return __admGuard(root,g);});
  if (guard.any) return guard.any.some(function(g){return __admGuard(root,g);});
  var value=__admRead(root,guard.path);
  if (guard.type==='array' && !Array.isArray(value)) return false;
  if (guard.type==='object' && (!value || typeof value!=='object' || Array.isArray(value))) return false;
  if (guard.exists!==undefined && (value!==undefined)!==guard.exists) return false;
  if (Object.prototype.hasOwnProperty.call(guard,'equals') && value!==guard.equals) return false;
  return true;
}
function __admWrite(root, path, value, create) {
  var parts=path.split('.');
  function put(node,i) {
    if (!node || typeof node!=='object') {if (!create || node!==undefined) return node; node={};}
    var key=parts[i];
    if (key==='__proto__'||key==='constructor'||key==='prototype') return node;
    var own=Object.prototype.hasOwnProperty.call(node,key), prev=own?node[key]:undefined;
    if (!own&&!create) return node;
    var next=i===parts.length-1?value:put(prev,i+1);
    if (next===prev || (own && JSON.stringify(next)===JSON.stringify(prev))) return node;
    var copy=Array.isArray(node)?node.slice():Object.assign({},node);copy[key]=next;return copy;
  }
  return put(root,0);
}
function __admOps(root, operations) {
  var next=root;
  operations.forEach(function(op){
    if (!__admGuard(next,op.when)) return;
    var prev=__admRead(next,op.path), value;
    if (op.op==='set') value=op.value;
    else if (op.op==='clearArray') {if (!Array.isArray(prev)||!prev.length) return;value=[];}
    else if (op.op==='filterArray') {
      if (!Array.isArray(prev)) return;
      value=prev.filter(function(item){var field=__admRead(item,op.field);if(op.numeric)field=Number(field);return op.exclude.indexOf(field)<0;});
      if(value.length===prev.length)return;
    } else if (op.op==='mapArray') {
      if (!Array.isArray(prev)) return;
      value=prev.map(function(item){return __admGuard(item,op.itemWhen)?__admOps(item,op.ops||[]):item;});
      if(value.every(function(item,i){return item===prev[i];}))return;
    } else return;
    next=__admWrite(next,op.path,value,!!op.create);
  });return next;
}
function __admEnvelope(raw, endpoint, policies, rootGuard) {
  var root=typeof raw==='string'?JSON.parse(raw):raw;
  if(!root||typeof root!=='object'||(rootGuard?!__admGuard(root,rootGuard):(root.result!==true||!root.data)))return root;
  var path=endpoint.split('?')[0];
  for(var i=0;i<policies.length;i++) {
    var policy=policies[i];
    if(new RegExp(policy.endpoint).test(path)&&__admGuard(root,policy.when))return __admOps(root,policy.ops);
  }
  return root;
}
function admVisit(root, test, ops, depth) {
  if(!root||typeof root!=='object'||depth>12)return root;
  var next=__admGuard(root,test)?__admOps(root,ops):root;
  Object.keys(next).forEach(function(key){
    var value=admVisit(next[key],test,ops,depth+1);
    if(value!==next[key]) {var copy=Array.isArray(next)?next.slice():Object.assign({},next);copy[key]=value;next=copy;}
  });return next;
}
function admGroup(source, pairs) {
  if(!pairs.every(function(p){return source.split(p[0]).length-1===(p[2]||1);}))return source;
  return pairs.reduce(function(s,p){return s.split(p[0]).join(p[1]);},source);
}
function admHas(source, markers) {return (markers||[]).every(function(s){return source.indexOf(s)>=0;});}
// Scan actual HTML tags. Quoted attributes, comments and raw-text contents are
// never treated as markup. An unfinished token leaves the response untouched.
function admHtmlTokens(body) {
  var tokens=[], pos=0, stacks={}, raw={script:1,style:1,textarea:1,title:1};
  while(pos<body.length) {
    var start=body.indexOf('<',pos);if(start<0)break;
    if(body.slice(start,start+4)==='<!--') {var commentEnd=body.indexOf('-->',start+4);if(commentEnd<0)return null;pos=commentEnd+3;continue;}
    var head=body.slice(start).match(/^<(\/?)([a-z][\w:-]*)(?=[\s/>])/i);
    if(!head){pos=start+1;continue;}
    var quote='', end=start+head[0].length;
    for(;end<body.length;end++) {var ch=body.charAt(end);if(quote){if(ch===quote)quote='';}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='>')break;}
    if(end===body.length)return null;
    var token={start:start,end:end+1,name:head[2].toLowerCase(),close:!!head[1],attrs:[]};
    if(!token.close) {
      var at=start+head[0].length;
      while(at<end) {
        var tail=body.slice(at,end);if(/^\s*\/?\s*$/.test(tail))break;
        var attr=tail.match(/^\s*([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/);
        if(!attr)return null;
        token.attrs.push({name:attr[1].toLowerCase(),value:attr[2]!==undefined?attr[2]:attr[3]!==undefined?attr[3]:attr[4]||'',start:at,end:at+attr[0].length});at+=attr[0].length;
      }
    }
    tokens.push(token);pos=token.end;
    if(raw[token.name]&&!token.close) {
      var closeRe=new RegExp('</'+token.name+'\\s*>','ig');closeRe.lastIndex=pos;var close=closeRe.exec(body);if(!close)return null;
      token.stop=closeRe.lastIndex;pos=token.stop;continue;
    }
    var stack=stacks[token.name]||(stacks[token.name]=[]);
    if(token.close){if(stack.length)stack.pop().stop=token.end;}
    else if(!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(token.name))stack.push(token);
  }return tokens;
}
function admHtmlAttr(token,name) {
  for(var i=0;i<token.attrs.length;i++)if(token.attrs[i].name===name)return token.attrs[i].value;
  return null;
}
function admHtmlMatch(token,selector) {
  if(token.close||token.name!==selector.tag)return false;
  var value=admHtmlAttr(token,selector.attr);if(value===null)return false;
  if(selector.token!==undefined)return value.split(/\s+/).indexOf(selector.token)>=0;
  if(selector.exact!==undefined)return value===selector.exact;
  return !!selector.pattern&&new RegExp(selector.pattern,'i').test(value);
}
function admCutRanges(body,ranges) {
  ranges.sort(function(a,b){return a.start-b.start||b.end-a.end;});var pos=0,out='';
  ranges.forEach(function(r){if(r.start<pos)return;out+=body.slice(pos,r.start)+(r.value===undefined?'':r.value);pos=r.end;});return out+body.slice(pos);
}
function admHtmlAction(body,rule) {
  var tokens=admHtmlTokens(body);if(!tokens)return body;var ranges=[];
  tokens.forEach(function(t){
    if(rule.op==='removeInlineScripts'&&!t.close&&t.name==='script'&&t.stop&&admHtmlAttr(t,'src')===null&&admHas(body.slice(t.end,t.stop),rule.scriptRequires))ranges.push({start:t.start,end:t.stop});
    if(rule.op==='replaceInlineScripts'&&!t.close&&t.name==='script'&&t.stop&&admHtmlAttr(t,'src')===null) {
      var source=body.slice(t.end,t.stop);
      if(admHas(source,rule.scriptRequires)){var next=admGroup(source,rule.pairs);if(next!==source)ranges.push({start:t.end,end:t.stop,value:next});}
    }
    if(rule.op==='removeElements'&&admHtmlMatch(t,rule.selector)&&t.stop)ranges.push({start:t.start,end:t.stop});
    if(rule.op==='removeAttributes'&&!t.close)t.attrs.forEach(function(a){if(new RegExp(rule.attributePattern,'i').test(a.name))ranges.push({start:a.start,end:a.end});});
  });return ranges.length?admCutRanges(body,ranges):body;
}
function cleanDeclarative(ctx,template) {
  var body=ctx.body,helpers=[];
  if(ctx.kind==='json') {
    if(!admHas(body,template.jsonRequires))return body;
    var original=JSON.parse(body),cleaned=__admEnvelope(original,ctx.path,template.jsonPolicies||[],template.jsonRootGuard);
    return cleaned===original?body:JSON.stringify(cleaned);
  }
  (template.actions||[]).forEach(function(rule){
    if(rule.kind!==ctx.kind||!admHas(body,rule.requires)||(rule.bodyPattern&&!new RegExp(rule.bodyPattern,'i').test(body)))return;
    if(rule.op==='replaceRegex')body=body.replace(new RegExp(rule.pattern,rule.flags||'g'),rule.value);
    else if(rule.op==='replaceGroup'){var next=admGroup(body,rule.pairs);if(next!==body&&rule.helper&&helpers.indexOf(rule.helper)<0)helpers.push(rule.helper);body=next;}
    else if(rule.op==='removeElements'||rule.op==='removeAttributes'||rule.op==='removeInlineScripts'||rule.op==='replaceInlineScripts')body=admHtmlAction(body,rule);
    else if(rule.op==='setBody')body=rule.value;
  });
  if(ctx.kind==='js')helpers.forEach(function(name){var helper=template.jsHelpers&&template.jsHelpers[name];if(helper&&body.indexOf(helper.marker)<0)body=helper.source+'\n'+body;});
  return body;
}
function admResponseAllowed(kind,body,response) {
  var rawStatus=response.statusCode!==undefined?response.statusCode:response.status;
  var code=typeof rawStatus==='number'?rawStatus:typeof rawStatus==='string'?(rawStatus.match(/^(?:HTTP\/\S+\s+)?(\d{3})(?:\s|$)/)||[])[1]:undefined;
  if(code!==undefined&&(+code<200||+code>=300))return false;
  var headers=response.headers||{},type='';Object.keys(headers).forEach(function(k){if(k.toLowerCase()==='content-type')type=String(headers[k]).toLowerCase();});
  var prefix=body.replace(/^\s*\uFEFF?/,'');
  // Gateways can put comments in front of their HTML error documents.
  while(true){var comment=prefix.match(/^(?:<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))\s*/);if(!comment)break;prefix=prefix.slice(comment[0].length);}
  var html=/^<(?:!doctype\s+html|html|head|body)(?:[\s>])/i.test(prefix);
  if(kind==='js')return !html&&!/html|json|xml/.test(type);
  if(kind==='json')return !html&&!/html|javascript|ecmascript/.test(type)&&/^[\[{]/.test(prefix);
  return !/json|javascript|ecmascript/.test(type)&&!/^\s*[\[{]/.test(prefix);
}
function admJsonRuntime(policies) {
  return [__admRead,__admGuard,__admWrite,__admOps,__admEnvelope].map(function(f){return f.toString();}).join('\n')+
    '\nvar __forAdmYqkPolicies='+JSON.stringify(policies)+';\nfunction __forAdmYqkClean(raw,endpoint){return __admEnvelope(raw,endpoint,__forAdmYqkPolicies);}\n';
}
function admRun(templates,processors) {
  var original=$response.body||'', output=original;
  try {
    var url=($request&&$request.url)||'',method=String(($request&&$request.method)||'').toUpperCase();
    var status=$response.statusCode;
    var match=url.match(/^https?:\/\/([^/:?#]+)(?:\:\d+)?(\/[^#]*)?/i);
    if(match&&original&&method!=='OPTIONS'&&method!=='HEAD'&&!(typeof status==='number'&&status>=400)) {
      var host=match[1].toLowerCase(),path=match[2]||'/',selected=null;
      for(var i=0;i<templates.length&&!selected;i++)for(var j=0;j<templates[i].bindings.length&&!selected;j++) {
        var b=templates[i].bindings[j];if(!new RegExp('^'+b.host+'$','i').test(host))continue;
        for(var k=0;k<b.routes.length;k++)if(new RegExp('^'+b.routes[k].path,'i').test(path)){selected={template:templates[i],kind:b.routes[k].kind};break;}
      }
      if(selected&&admResponseAllowed(selected.kind,original,$response))output=processors[selected.template.adapter]({body:original,url:url,host:host,path:path,kind:selected.kind},selected.template);
    }
  }catch(_){output=original;}
  $done(typeof output==='string'&&output!==original?{body:output}:{});
}

admRun([{"id":"dyls","adapter":"declarative","output":{"script":"dyls/ad-clean.js","conf":"dyls/quantumult-x-snippet.conf"},"jsonRootGuard":{"all":[{"path":"msg","equals":"获取成功"},{"path":"data","type":"array"}]},"jsonPolicies":[{"endpoint":"^/api/v[0-9]+/[^?#]+$","when":{"path":"data","type":"array"},"ops":[{"op":"filterArray","path":"data","field":"layout","exclude":["advert_self"]},{"op":"mapArray","path":"data","itemWhen":{"all":[{"path":"layout","equals":"index_recommend_carousel"},{"path":"list","type":"array"}]},"ops":[{"op":"filterArray","path":"list","field":"type","exclude":[3]}]}]}],"actions":[{"kind":"js","op":"replaceGroup","requires":["landing-ad-image","function Rt({dispatch:e,panding:t,cachedLandingAds:n","app-shell-root relative","x.hasSeenLanding"],"pairs":[["function vt(e){return e?.data?.start?.find(e=>e?.data?.image)||null}","function vt(e){return null}",1],["vt(n)&&e(re(!0))","e(re(!1))",1],["panding:o,isShowingDetails:s}=n(e=>e.model),[c]","panding:__forAdmLandingState,isShowingDetails:s}=n(e=>e.model),o=!1,[c]",1],["navigator.serviceWorker.register(t,{scope:`/`,updateViaCache:`none`}).catch(()=>{})","navigator.serviceWorker.register(t+`&for_adm=dyls-v1`,{scope:`/`,updateViaCache:`none`}).then(e=>e.update()).catch(()=>{})",1]]},{"kind":"js","op":"replaceGroup","requires":["`/advert/config`","cacheKey:o.adsQuery","fetcher:dt","refetchAds:e.refetch"],"pairs":[["export{_t as a,X as i,yt as n,ht as o,gt as r,bt as s,vt as t};","function __forAdmLoadAds(){return Promise.resolve({msg:`获取成功`,data:{}})}function __forAdmAdsHook(){return{data:{msg:`获取成功`,data:{}},isLoading:!1,isFetching:!1,error:null,refetchAds:__forAdmLoadAds}}export{__forAdmAdsHook as a,X as i,yt as n,ht as o,gt as r,bt as s,__forAdmLoadAds as t};",1]]},{"kind":"js","op":"replaceGroup","requires":["AdGridCard","AdGridSkeleton","cacheKey:`section:${e}`","pauseGifInPseudoLandscape"],"pairs":[["export{T as n,E as t};","function __forAdmNoAds(){return null}export{__forAdmNoAds as n,__forAdmNoAds as t};",1]]},{"kind":"js","op":"replaceGroup","requires":["workbox:core:7.4.0","DylsWarmAdImages","cacheName:Q(`pages`)","runtime-assets"],"pairs":[["try{self[`workbox:core:7.4.0`]&&_()}catch{}","/* For-ADM: dyls targeted JS cache v1. */\n(function(){\nvar target=/^\\/assets\\/(?:index|helperService|NewAds|home|explorer|Main|search|playerService|player)-[A-Za-z0-9_-]+\\.js$/;\nfunction known(url){try{var u=new URL(url,self.location.origin);return u.origin===self.location.origin&&target.test(u.pathname)}catch(e){return false}}\nself.addEventListener('activate',function(event){event.waitUntil(caches.keys().then(function(names){return Promise.all(names.map(function(name){return caches.open(name).then(function(cache){return cache.keys().then(function(keys){return Promise.all(keys.filter(function(key){return known(key.url)}).map(function(key){return cache.delete(key)}))})})}))}).catch(function(){}))});\nself.addEventListener('fetch',function(event){if(event.request.method!=='GET'||!known(event.request.url))return;event.stopImmediatePropagation();event.respondWith((async function(){try{var response=await fetch(event.request,{cache:'no-cache'});if(!response.ok)throw Error('Dyls module response '+response.status);if(/javascript|ecmascript/i.test(response.headers.get('content-type')||'')){try{var cache=await caches.open('for-adm-dyls-js-v1');await cache.put(event.request,response.clone())}catch(e){}}return response}catch(error){var cached=await caches.match(event.request);if(cached)return cached;throw error}})())});\n})();\ntry {self[`workbox:core:7.4.0`]&&_()}catch{}",1]]},{"kind":"js","op":"replaceGroup","requires":["home:advert_self","index_recommend_carousel","topic_movies_top","NewAds-CtNp18Uc.js"],"pairs":[["C=(0,K.useMemo)(()=>Array.isArray(e)?e:[],[e])","C=(0,K.useMemo)(()=>Array.isArray(e)?e.filter(e=>e?.type!==3):[],[e])",1],["if(e?.layout===`advert_self`)return(0,J.jsx)(Hn,{data:e?.data,isLoading:t||r},a);","if(e?.layout===`advert_self`)return null;",1],["(0,J.jsx)(`div`,{className:`mt-4`,children:(0,J.jsx)(W,{section:`topic_movies_top`})})","null",1]]},{"kind":"js","op":"replaceGroup","requires":["NewAds-CtNp18Uc.js","zhuiju_weektable_under","section:`ranking`","topic_movies_top"],"pairs":[["M=B.useMemo(()=>(0,V.jsx)(P,{section:`topic_movies_top`}),[])","M=B.useMemo(()=>null,[])",1],["(0,V.jsx)(`div`,{className:`relative z-0 mb-5 mt-3`,children:M})","null",1],["(0,V.jsx)(`div`,{className:`relative z-0 mt-3`,children:(0,V.jsx)(Z,{section:`zhuiju_weektable_under`})})","null",1],["(0,V.jsx)(`div`,{className:`relative z-0 mt-3`,children:(0,V.jsx)(P,{section:`ranking`})})","null",1]]},{"kind":"js","op":"replaceGroup","requires":["NewAds-CtNp18Uc.js","search-result-ad-slot","search_result_up","itemHeight:176"],"pairs":[["(0,x.jsx)(`div`,{className:`search-result-ad-slot`,children:(0,x.jsx)(m,{section:`search_result_up`})})","null",1]]},{"kind":"js","op":"replaceGroup","requires":["NewAds-CtNp18Uc.js","search_input_under","app-content-below-top-nav","searchDiscovery"],"pairs":[["(0,_.jsx)(`div`,{className:`app-content-below-top-nav`,children:(0,_.jsx)(`div`,{className:`pt-3`,children:(0,_.jsx)(p,{section:`search_input_under`})})})","null",1]]},{"kind":"js","op":"replaceGroup","requires":["NewAds-CtNp18Uc.js","section:`player_episode_up`","player-detail-page","warning-content"],"pairs":[["(0,$.jsx)(`div`,{className:`mt-4`,children:(0,$.jsx)(We,{section:`player_episode_up`,fromMovie:!0})})","null",1]]},{"kind":"js","op":"replaceGroup","requires":["globalSourceStats","contextSourceStats","function ae(e,t,n,r)","dyls:local-playback-history:v1"],"pairs":[["return r+i+l+u-a-o-s-c-d+f","let __forAdmLast=Math.max(Number(e.lastUsedAt)||0,Number(e.lastSuccessAt)||0,Number(e.lastFailureAt)||0),__forAdmAge=__forAdmLast?Math.max(0,Date.now()-__forAdmLast)/864e5:0;return (r+i+l+u-a-o-s-c-d+f)*Math.pow(.5,__forAdmAge/14)",1],["return v(i)+v(a)*(a.successCount","let __forAdmFailed=Math.max(Number(i.lastFailureAt)||0,Number(a.lastFailureAt)||0),__forAdmSucceeded=Math.max(Number(i.lastSuccessAt)||0,Number(a.lastSuccessAt)||0);if(__forAdmFailed>__forAdmSucceeded&&Date.now()-__forAdmFailed<600000)return -1e6-t*.01;return v(i)+v(a)*(a.successCount",1]]},{"kind":"js","op":"replaceGroup","requires":["function Uc(e)","function Fc({movieId:e","Error probing playback source:","source-manual","resumeAppliedRef","currentEpisodeNumber"],"pairs":[["c=(0,Q.useRef)(0),u=(0,Q.useRef)({generation:0,status:`idle`,candidate:null})","c=(0,Q.useRef)(0),__forAdmAutoAttempts=(0,Q.useRef)(0),u=(0,Q.useRef)({generation:0,status:`idle`,candidate:null})",1],["he=(0,Q.useMemo)(()=>me.some","he=(0,Q.useMemo)(()=>__forAdmAutoAttempts.current<3&&me.some",1],["De=()=>{c.current+=1,","De=()=>{__forAdmAutoAttempts.current=0,c.current+=1,",1],["Ce(),qe(``,`movie-load`)","__forAdmAutoAttempts.current=0,Ce(),qe(``,`movie-load`)",1],["for(let r of me){if(e!==c.current||t?.aborted)return null;","let __forAdmProbes=0;for(let r of me){if(__forAdmProbes>=3||e!==c.current||t?.aborted)return null;",1],["if(!n.has(r.code)){try{let n=await We(r,_,t);","if(!n.has(r.code)){__forAdmProbes++;try{let n=await We(r,_,t,a.current>0?a.current:N||0);",1],["if(n)return n}catch(e){if(Ae(e)||t?.aborted)return null;console.error(`Error probing playback source:`,e)}","if(n&&n.preferredEpisodeIndex===_)return n}catch(e){if(Ae(e)||t?.aborted)return null;console.error(`Error probing playback source:`,e)}",1],["$e=e=>He(e,je(`source-auto`,e.sourceCode))?(Ce(),I(!1),","$e=e=>He(e,je(`source-auto`,e.sourceCode))?(__forAdmAutoAttempts.current+=1,Ce(),I(!1),",1],["handlePlaybackTimeChange:e=>{a.current=e}","handlePlaybackTimeChange:e=>{Number.isFinite(e)&&e>=0&&(a.current=e)}",1],["E.currentTime=zt(r,e),a.current=!0","E.currentTime=zt(r,e>0?Math.max(.01,e-2):e),a.current=!0",1]]}],"bindings":[{"host":"(?:dyls1\\.mbxqnb\\.cn)","routes":[{"kind":"json","path":"/api/v[0-9]+/[^?#]+(?:\\?.*)?$"},{"kind":"js","path":"/assets/(?:index|helperService|NewAds|home|explorer|Main|search|playerService|player)-[A-Za-z0-9_-]+\\.js(?:\\?.*)?$"},{"kind":"js","path":"/sw\\.js(?:\\?.*)?$"}]}]}],{declarative:cleanDeclarative});
})();
