/* GENERATED from universal/templates.json and universal/src; revision e11a70e6c981. Do not edit. */
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
    if(rule.op==='setQueryParameter'&&admHtmlMatch(t,rule.selector)&&!t.close)t.attrs.forEach(function(a){if(a.name.toLowerCase()!==rule.selector.attr)return;var value=a.value.replace(/&amp;/g,'&'),query=new RegExp('([?&])'+rule.key+'=[^&]*'),part=rule.key+'='+encodeURIComponent(rule.value),next=query.test(value)?value.replace(query,'$1'+part):value+(value.indexOf('?')<0?'?':'&')+part;if(next!==value)ranges.push({start:a.start,end:a.end,value:' '+a.name+'="'+next.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"'});});
    if(rule.op==='removeAttributes'&&!t.close)t.attrs.forEach(function(a){if(new RegExp(rule.attributePattern,'i').test(a.name))ranges.push({start:a.start,end:a.end});});
  });return ranges.length?admCutRanges(body,ranges):body;
}
function cleanDeclarative(ctx,template) {
  var body=ctx.body,helpers=[];
  var audit=ctx.audit; if(audit){audit.groups=0;audit.changedGroups=0;audit.pairs=0;audit.failedGroups=0;}
  if(ctx.kind==='json') {
    if(!admHas(body,template.jsonRequires))return body;
    var original=JSON.parse(body),cleaned=__admEnvelope(original,ctx.path,template.jsonPolicies||[],template.jsonRootGuard);
    return cleaned===original?body:JSON.stringify(cleaned);
  }
  (template.actions||[]).forEach(function(rule){
    if(rule.kind!==ctx.kind||!admHas(body,rule.requires)||(rule.bodyPattern&&!new RegExp(rule.bodyPattern,'i').test(body)))return;
    var before=body;if(audit)audit.groups++;
    if(rule.op==='replaceRegex')body=body.replace(new RegExp(rule.pattern,rule.flags||'g'),rule.value);
    else if(rule.op==='replaceGroup'){var next=admGroup(body,rule.pairs);if(next!==body&&rule.helper&&helpers.indexOf(rule.helper)<0)helpers.push(rule.helper);body=next;}
    else if(rule.op==='setQueryParameter'||rule.op==='removeElements'||rule.op==='removeAttributes'||rule.op==='removeInlineScripts'||rule.op==='replaceInlineScripts')body=admHtmlAction(body,rule);
    else if(rule.op==='setBody')body=rule.value;
    if(audit){if(body!==before){audit.changedGroups++;if(rule.pairs)audit.pairs+=rule.pairs.length;}else if(rule.op==='replaceGroup')audit.failedGroups++;}
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
function admRun(templates,processors,revision) {
  var original=$response.body||'', output=original,debug=false,report=null;
  try{debug=typeof $prefs!=='undefined'&&Number($prefs.valueForKey('ForADM.DebugUntil'))>Date.now();}catch(ignore){}
  try {
    var url=($request&&$request.url)||'',method=String(($request&&$request.method)||'').toUpperCase();
    var status=$response.statusCode;
    var match=url.match(/^https?:\/\/([^/:?#]+)(?:\:(\d+))?(\/[^#]*)?/i);
    if(match&&original&&method!=='OPTIONS'&&method!=='HEAD'&&!(typeof status==='number'&&status>=400)) {
      var host=match[1].toLowerCase(),port=match[2]?Number(match[2]):null,path=match[3]||'/',selected=null;
      for(var i=0;i<templates.length&&!selected;i++)for(var j=0;j<templates[i].bindings.length&&!selected;j++) {
        var b=templates[i].bindings[j];if(b.ports&&port!==null&&b.ports.indexOf(port)<0)continue;if(!new RegExp('^'+b.host+'$','i').test(host))continue;
        for(var k=0;k<b.routes.length;k++)if(new RegExp('^'+b.routes[k].path,'i').test(path)){selected={template:templates[i],kind:b.routes[k].kind};break;}
      }
      if(selected){
        var allowed=admResponseAllowed(selected.kind,original,$response),audit=debug?{}:null;
        if(allowed)output=processors[selected.template.adapter]({body:original,url:url,host:host,path:path,kind:selected.kind,audit:audit},selected.template);
        if(debug&&(selected.template.id==='kkapp'||selected.template.id==='ncat'))report={checkedAt:Date.now(),site:selected.template.id,revision:revision,host:host,path:path.split('?')[0],probe:/(?:[?&])for_adm_probe=/.test(path),kind:selected.kind,status:allowed?(output!==original?'modified':'unchanged'):'response-preserved',groups:audit&&audit.groups||0,changedGroups:audit&&audit.changedGroups||0,pairs:audit&&audit.pairs||0,failedGroups:audit&&audit.failedGroups||0,downloadProtection:output.indexOf('function __forAdmDownloadData(')>=0};
      }
    }
  }catch(_){output=original;if(debug)report={status:'runtime-error',revision:revision};}
  if(report)try{console.log('[For-ADM] '+JSON.stringify(report));if(report.site){$prefs.setValueForKey(JSON.stringify(report),'ForADM.Debug.'+report.site);var historyKey='ForADM.DebugHistory.'+report.site,history=[];try{history=JSON.parse($prefs.valueForKey(historyKey)||'[]');if(!Array.isArray(history))history=[];}catch(ignore){}history=history.filter(function(item){return item&&!(item.path===report.path&&item.probe===report.probe);});history.push(report);$prefs.setValueForKey(JSON.stringify(history.slice(-16)),historyKey);}}catch(ignore){}
  $done(typeof output==='string'&&output!==original?{body:output}:{});
}

// Shared JSON policy runner; the same policy is injected into verified Nuxt entry bundles.
function cleanYqk(ctx, template) {
  var source=ctx.body;
  if(ctx.kind==='json') {
    var payload=JSON.parse(source),next=__admEnvelope(payload,ctx.path,template.jsonPolicies);
    return next===payload?source:JSON.stringify(next);
  }
  var asset=ctx.path.match(/^\/_nuxt\/(entry|_play_)\./i);
  if(!asset)return source;
  var rule=template.jsRules.filter(function(r){return r.asset===asset[1].toLowerCase();})[0];
  if(!rule||!admHas(source,rule.requires))return source;
  rule.groups.forEach(function(group){source=admGroup(source,group);});
  if(rule.inject&&source.indexOf('__forAdmYqkClean')<0) {
    var patched=admGroup(source,rule.inject);
    if(patched!==source)source=patched+'\n'+admJsonRuntime(template.jsonPolicies);
  }
  return source;
}

admRun([{"id":"yqk-qntv","adapter":"yqk","output":{"script":"yqk-qntv/ad-clean.js","conf":"yqk-qntv/quantumult-x-snippet.conf"},"jsonPolicies":[{"endpoint":"/adInfo/getPageAd$","when":{"path":"data","type":"object"},"ops":[{"op":"set","path":"data.floatAd","value":null,"create":true},{"op":"set","path":"data.popupAd","value":null,"create":true}]},{"endpoint":"/adInfo/getChatAd$","when":{"path":"data","type":"array"},"ops":[{"op":"clearArray","path":"data"}]},{"endpoint":"/adInfo/getTopicAd$","when":{"path":"data.topicAdList","type":"array"},"ops":[{"op":"clearArray","path":"data.topicAdList"}]},{"endpoint":"/(?:vodInfo/getVodPauseAd|adInfo/getTextAd)$","when":null,"ops":[{"op":"set","path":"data","value":null,"create":true}]},{"endpoint":"/(?:vodInfo/getVodBodyAd|adInfo/(?:getSearchAd|getUserCenterAd))$","when":{"path":"data","type":"array"},"ops":[{"op":"clearArray","path":"data"}]},{"endpoint":"/vodInfo/index$","when":{"path":"data.playerList","type":"array"},"ops":[{"op":"set","path":"data.startAd","value":null,"create":true}]},{"endpoint":"/basic/init$","when":{"path":"data.startAdList","type":"array"},"ops":[{"op":"clearArray","path":"data.startAdList"},{"op":"set","path":"data.startAdShowTime","value":0,"create":true}]},{"endpoint":"/home/body$","when":{"path":"data.adList","type":"array"},"ops":[{"op":"clearArray","path":"data.adList"}]},{"endpoint":"/home/firstScreen$","when":{"any":[{"path":"data.focusAdList","type":"array"},{"path":"data.hotMudleList","type":"array"}]},"ops":[{"op":"set","path":"data.focusAdList","value":[],"create":true},{"op":"filterArray","path":"data.hotMudleList","field":"adAction","numeric":true,"exclude":[1,2,8,10,11]}]}],"jsRules":[{"asset":"entry","requires":["class:\"startup-ad\"","/adInfo/getPageAd","useHttp={get:"],"groups":[[["m.value=X.value.data.startAdList||[]","m.value=[]"],["z.floatAd&&R.name!=\"play-play\"","false&&R.name!=\"play-play\""]]],"inject":[["transform:r=>typeof r==\"string\"?JSON.parse(r):r","transform:r=>__forAdmYqkClean(r,e)",3]]},{"asset":"_play_","requires":["name:\"VideoStartAd\"","getVodPauseAd({vodId:T","getVideoDetail({vodId:T"],"groups":[[["N.value=t.value.data,m.value","N.value=t.value.data,N.value.startAd=null,m.value",2],["Ga.value=t.value.data,ta.value=!!t.value.data","Ga.value=null,ta.value=!1"],["e.result&&(Nt.value=t.value.data)},jt=i()","e.result&&(Nt.value=[])},jt=i()"],["e.result&&(jt.value=t.value.data)};let ga=","e.result&&(jt.value=null)};let ga="]]]}],"bindings":[{"host":"yz(?:y)?\\d{4,6}\\.(?:bzy42ezt\\.com|zazy3mc5\\.com|7k5jb8t9\\.com|3nyk7h9o\\.com|jba2yo1c\\.com|hzkeka49\\.com|q8nsderug\\.com|o5r52at9v\\.com|tgs2hl4ut\\.com|goi6lhmry\\.com|6vh3qyu9x\\.com)","routes":[{"kind":"json","path":"/v[12]/api/(?:basic/init|home/(?:body|firstScreen)|adInfo/(?:getPageAd|getTextAd|getSearchAd|getUserCenterAd|getChatAd|getTopicAd)|vodInfo/(?:index|getVodBodyAd|getVodPauseAd))(?:\\?.*)?$"}]},{"host":"(?:|www\\.)(?:yqk|qntv)\\d+\\.app","routes":[{"kind":"js","path":"/_nuxt/(?:entry|_play_)\\.[a-zA-Z0-9]+\\.js(?:\\?.*)?$"}]}]}],{yqk:cleanYqk},"e11a70e6c981");
})();
