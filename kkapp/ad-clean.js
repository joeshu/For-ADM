/* GENERATED from universal/templates.json and universal/src; revision 5f20bf2ffa1d. Do not edit. */
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
  var body=ctx.body;
  if(ctx.kind==='json') {
    if(!admHas(body,template.jsonRequires))return body;
    var original=JSON.parse(body),cleaned=__admEnvelope(original,ctx.path,template.jsonPolicies||[],template.jsonRootGuard);
    return cleaned===original?body:JSON.stringify(cleaned);
  }
  (template.actions||[]).forEach(function(rule){
    if(rule.kind!==ctx.kind||!admHas(body,rule.requires)||(rule.bodyPattern&&!new RegExp(rule.bodyPattern,'i').test(body)))return;
    if(rule.op==='replaceRegex')body=body.replace(new RegExp(rule.pattern,rule.flags||'g'),rule.value);
    else if(rule.op==='replaceGroup')body=admGroup(body,rule.pairs);
    else if(rule.op==='removeElements'||rule.op==='removeAttributes'||rule.op==='removeInlineScripts'||rule.op==='replaceInlineScripts')body=admHtmlAction(body,rule);
    else if(rule.op==='setBody')body=rule.value;
  });return body;
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

admRun([{"id":"kkapp","adapter":"declarative","output":{"script":"kkapp/ad-clean.js","conf":"kkapp/quantumult-x-snippet.conf"},"actions":[{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x451760=_0x118a69['appAdvertisements']","_0x451760=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x58a9e7=_0x56f08a['appAdvertisements']","_0x58a9e7=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x35bf1e=_0x16e2cd['appAdvertisements']","_0x35bf1e=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x4c4f1b=_0x5d3eea['appAdvertisements']","_0x4c4f1b=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x1e61f7=_0x459a71['appAdvertisements']","_0x1e61f7=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x35492e;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x48ddda;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x2fdb3b=_0x2d2587['appAdvertisements']","_0x2fdb3b=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x26c3eb=_0x1a46ce['appAdvertisements']","_0x26c3eb=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x3309f9=_0x77f034['appAdvertisements']","_0x3309f9=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x2314e7=_0x2c9a5b['appAdvertisements']","_0x2314e7=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x57ec68=_0x48f4d2['appAdvertisements']","_0x57ec68=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x5a3190=_0xf06c32['appAdvertisements']","_0x5a3190=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x3cd747=_0x30ec25['appAdvertisements']","_0x3cd747=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x3af76=_0x29cb38['appAdvertisements']","_0x3af76=[]",1],["_0x2bf48a=_0x487989['appAdvertisements']","_0x2bf48a=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x4d8136=_0x4de61a['appAdvertisements']","_0x4d8136=[]",1],["_0x12b684=_0x1bb94a['appAdvertisements']","_0x12b684=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x3497a2=_0x2a8b7a['appAdvertisements']","_0x3497a2=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x476fdb=_0x247a8a['appAdvertisements']","_0x476fdb=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x3c7f89;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x383845;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x5076a6;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x5e09ab;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0xb6b0b=_0x50a477['appAdvertisements']","_0xb6b0b=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x20e0ec=_0x4cd9f7['appAdvertisements']","_0x20e0ec=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x53fb8a;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x4e26cc;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x44db79;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x173f26;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["getAdvertiseById","['ads']['find']","player"],"pairs":[["_0x970721=function(_0x11d4ca,_0x174d79){if(_0x174d79){var _0x417259=_0x174d79['ads']['find'](function(_0x460e5e){return _0x460e5e['id']==_0x11d4ca;});if(_0x417259){var _0xb594d6=_0x5bc0ac['getAdvertiseById'](_0x417259['id']);_0xb594d6&&(_0x417259['items']=_0xb594d6['items']);}return _0x417259&&_0x417259['items']&&_0x417259['items']['length']>0x0?_0x417259:void 0x0;}}","_0x970721=function(_0x11d4ca,_0x174d79){return void 0x0;}",1],["_0x18a3dd=function(_0x398509,_0x180b38){if(_0x180b38){var _0x527a52=_0x180b38['ads']['find'](function(_0x5e93f2){return _0x5e93f2['id']==_0x398509;});if(_0x527a52){var _0x5b9235=_0x56caf9['getAdvertiseById'](_0x527a52['id']);_0x5b9235&&(_0x527a52['items']=_0x5b9235['items']);}return _0x527a52&&_0x527a52['items']&&_0x527a52['items']['length']>0x0?_0x527a52:void 0x0;}}","_0x18a3dd=function(_0x398509,_0x180b38){return void 0x0;}",1]]},{"kind":"js","op":"replaceGroup","requires":["getAdvertiseById","['ads']['find']","player"],"pairs":[["_0x3abebe=(_0x3d2f22,_0x180b79)=>{if(!_0x180b79)return;const _0x29e479=_0x180b79['ads']['find'](_0x1edd9f=>_0x1edd9f['id']==_0x3d2f22);if(_0x29e479){const _0x530e8b=_0x1b452a['getAdvertiseById'](_0x29e479['id']);_0x530e8b&&(_0x29e479['items']=_0x530e8b['items']);}return _0x29e479&&_0x29e479['items']&&_0x29e479['items']['length']>0x0?_0x29e479:void 0x0;}","_0x3abebe=(_0x3d2f22,_0x180b79)=>{return void 0x0;}",1],["_0x2aa3b2=(_0x2315cf,_0x429a64)=>{if(!_0x429a64)return;const _0x1b4cb0=_0x429a64['ads']['find'](_0x5c1e78=>_0x5c1e78['id']==_0x2315cf);if(_0x1b4cb0){const _0x126712=_0x599630['getAdvertiseById'](_0x1b4cb0['id']);_0x126712&&(_0x1b4cb0['items']=_0x126712['items']);}return _0x1b4cb0&&_0x1b4cb0['items']&&_0x1b4cb0['items']['length']>0x0?_0x1b4cb0:void 0x0;}","_0x2aa3b2=(_0x2315cf,_0x429a64)=>{return void 0x0;}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0xa29854;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0xbc162a=_0x4a9119['appAdvertisements']","_0xbc162a=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x175f8d=_0x476a14['appAdvertisements']","_0x175f8d=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x22e09d=_0x26cb7b['appAdvertisements']","_0x22e09d=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x30fb23=_0x5485d2['appAdvertisements']","_0x30fb23=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x183b17=_0x328001['appAdvertisements']","_0x183b17=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x19f111=_0xdf5735['appAdvertisements']","_0x19f111=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x3070dc=_0x148f25['appAdvertisements']","_0x3070dc=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["getAdvertiseById","['ads']['find']","player"],"pairs":[["_0x1a02e5=function(){if(_0x349d67['detail']&&_0x349d67['detail']['ads']){var _0x54dd81=_0x349d67['detail']['ads']['find'](function(_0x3c7460){return _0x3c7460['id']==_0x34c74a['BA']['VOD_START'];});if(_0x54dd81){var _0x277860=_0x16a0cc['getAdvertiseById'](_0x54dd81['id']);_0x277860&&(_0x54dd81['items']=_0x277860['items']);}return _0x54dd81&&_0x54dd81['items']&&_0x54dd81['items']['length']>0x0?_0x54dd81:void 0x0;}}","_0x1a02e5=function(){return void 0x0;}",1],["_0x5ab38e=function(){if(_0x349d67['detail']&&_0x349d67['detail']['ads']){var _0x16f24e=_0x349d67['detail']['ads']['find'](function(_0x5ed1c4){return _0x5ed1c4['id']==_0x34c74a['BA']['VOD_PAUSE'];});if(_0x16f24e){var _0x120bfd=_0x16a0cc['getAdvertiseById'](_0x16f24e['id']);_0x120bfd&&(_0x16f24e['items']=_0x120bfd['items']);}return _0x16f24e&&_0x16f24e['items']&&_0x16f24e['items']['length']>0x0?_0x16f24e:void 0x0;}}","_0x5ab38e=function(){return void 0x0;}",1]]},{"kind":"js","op":"replaceGroup","requires":["getAdvertiseById","['ads']['find']","player"],"pairs":[["_0x3990b0=()=>{if(!_0x53e7f8['detail']||!_0x53e7f8['detail']['ads'])return;const _0x8b268d=_0x53e7f8['detail']['ads']['find'](_0x4d4164=>_0x4d4164['id']==_0x21751f['BA']['VOD_START']);if(_0x8b268d){const _0xea6ec4=_0xbef34['getAdvertiseById'](_0x8b268d['id']);_0xea6ec4&&(_0x8b268d['items']=_0xea6ec4['items']);}return _0x8b268d&&_0x8b268d['items']&&_0x8b268d['items']['length']>0x0?_0x8b268d:void 0x0;}","_0x3990b0=()=>{return void 0x0;}",1],["_0x30ebec=()=>{if(!_0x53e7f8['detail']||!_0x53e7f8['detail']['ads'])return;const _0x224e3b=_0x53e7f8['detail']['ads']['find'](_0x135b86=>_0x135b86['id']==_0x21751f['BA']['VOD_PAUSE']);if(_0x224e3b){const _0x30d91f=_0xbef34['getAdvertiseById'](_0x224e3b['id']);_0x30d91f&&(_0x224e3b['items']=_0x30d91f['items']);}return _0x224e3b&&_0x224e3b['items']&&_0x224e3b['items']['length']>0x0?_0x224e3b:void 0x0;}","_0x30ebec=()=>{return void 0x0;}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x5377c3;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x1b5a9d;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["0x3e71:function","/v2/config/units.capi","/app/announcements","getCacheUrl"],"pairs":[["'so':function(){return _0x43c8de;}","'so':function(){return function(){return Promise.resolve({data:[]});};}",1]]},{"kind":"js","op":"replaceGroup","requires":["appAdvertisements","click_advert_","FSImage","'banner'"],"pairs":[["_0x39a1ae=_0x2ef15b['appAdvertisements']","_0x39a1ae=[]",1]]},{"kind":"js","op":"replaceGroup","requires":["'appName':'可可影视'","'appVersion':'2.5.14'","'getAdvertiseById'","'FLOATING_WINDOW'","'VOD_START'"],"pairs":[["'getAdvertiseById':function(_0x1959cc){if(_0x1959cc&&0x0!=_0x1959cc['length']){var _0x469999=this['appAdvertisements'];return _0x469999&&_0x469999['length']>0x0?_0x469999['find'](function(_0x594149){return _0x594149['id']==_0x1959cc;}):void 0x0;}}","'getAdvertiseById':function(_0x1959cc){return void 0x0;}",1],["_0x2d2bb0=function(_0x37c8fb){var _0x22f04c=(0x0,_0x304591['P'])(),_0x2c7174=_0x22f04c['appAdvertisements'];return!!(_0x2c7174&&_0x2c7174['length']>0x0&&_0x37c8fb&&_0x37c8fb['length']>0x0)&&_0x2c7174['some'](function(_0x59c056){return _0x59c056['id']==_0x37c8fb;});}","_0x2d2bb0=function(_0x37c8fb){return false;}",1]]},{"kind":"js","op":"replaceGroup","requires":["'appName':'可可影视'","'appVersion':'2.5.14'","'getAdvertiseById'","'FLOATING_WINDOW'","'VOD_START'"],"pairs":[["'getAdvertiseById'(_0x581bae){if(!_0x581bae||0x0==_0x581bae['length'])return;const _0x124433=this['appAdvertisements'];return _0x124433&&_0x124433['length']>0x0?_0x124433['find'](_0x2d775a=>_0x2d775a['id']==_0x581bae):void 0x0;}","'getAdvertiseById'(_0x581bae){return void 0x0;}",1],["_0x427b67=_0x3cdfa8=>{const _0x13af61=(0x0,_0x4ec8d6['P'])(),_0x6b8ea4=_0x13af61['appAdvertisements'];return!!(_0x6b8ea4&&_0x6b8ea4['length']>0x0&&_0x3cdfa8&&_0x3cdfa8['length']>0x0)&&_0x6b8ea4['some'](_0x2c03f5=>_0x2c03f5['id']==_0x3cdfa8);}","_0x427b67=_0x3cdfa8=>{return false;}",1]]}],"bindings":[{"host":"(?:a\\.kkapp06\\.com)","routes":[{"kind":"js","path":"/static/v[0-9]+/js/(?:app(?:-legacy)?|[0-9]+(?:-legacy)?)\\.[a-f0-9]{8}\\.js(?:\\?.*)?$"}]}]}],{declarative:cleanDeclarative});
})();
