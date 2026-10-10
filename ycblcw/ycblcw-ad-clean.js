/* GENERATED from universal/templates.json and universal/src; revision f46880bc7e22. Do not edit. */
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
    } else return;
    next=__admWrite(next,op.path,value,!!op.create);
  });return next;
}
function __admEnvelope(raw, endpoint, policies) {
  var root=typeof raw==='string'?JSON.parse(raw):raw;
  if(!root||root.result!==true||!root.data)return root;
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
function admRemoveDivs(body, pattern) {
  var start=new RegExp(pattern,'ig'),match;
  while((match=start.exec(body))) {
    var tags=/<\/?div\b[^>]*>/ig;tags.lastIndex=start.lastIndex;
    var depth=1,tag,end=-1;
    while((tag=tags.exec(body))) {depth+=/^<\/div/i.test(tag[0])?-1:1;if(!depth){end=tags.lastIndex;break;}}
    if(end<0)break;
    body=body.slice(0,match.index)+body.slice(end);start.lastIndex=match.index;
  }return body;
}
function cleanDeclarative(ctx,template) {
  var body=ctx.body;
  (template.actions||[]).forEach(function(rule){
    if(rule.kind!==ctx.kind||!admHas(body,rule.requires)||(rule.bodyPattern&&!new RegExp(rule.bodyPattern,'i').test(body)))return;
    if(rule.op==='replaceRegex')body=body.replace(new RegExp(rule.pattern,rule.flags||'g'),rule.value);
    else if(rule.op==='removeDivs')body=admRemoveDivs(body,rule.pattern);
    else if(rule.op==='setBody')body=rule.value;
  });return body;
}
function admJsonRuntime(policies) {
  return [__admRead,__admGuard,__admWrite,__admOps,__admEnvelope].map(function(f){return f.toString();}).join('\n')+
    '\nvar __forAdmYqkPolicies='+JSON.stringify(policies)+';\nfunction __forAdmYqkClean(raw,endpoint){return __admEnvelope(raw,endpoint,__forAdmYqkPolicies);}\n';
}
function admRun(templates,processors) {
  var original=$response.body||'', output=original;
  try {
    var url=($request&&$request.url)||'',method=($request&&$request.method)||'';
    var status=$response.statusCode;
    var match=url.match(/^https?:\/\/([^/:?#]+)(?:\:\d+)?(\/[^#]*)?/i);
    if(match&&original&&method!=='OPTIONS'&&method!=='HEAD'&&!(typeof status==='number'&&status>=400)) {
      var host=match[1].toLowerCase(),path=match[2]||'/',selected=null;
      for(var i=0;i<templates.length&&!selected;i++)for(var j=0;j<templates[i].bindings.length&&!selected;j++) {
        var b=templates[i].bindings[j];if(!new RegExp('^'+b.host+'$','i').test(host))continue;
        for(var k=0;k<b.routes.length;k++)if(new RegExp('^'+b.routes[k].path,'i').test(path)){selected={template:templates[i],kind:b.routes[k].kind};break;}
      }
      if(selected)output=processors[selected.template.adapter]({body:original,url:url,host:host,path:path,kind:selected.kind},selected.template);
    }
  }catch(_){output=original;}
  $done(typeof output==='string'&&output!==original?{body:output}:{});
}

admRun([{"id":"ycblcw","adapter":"declarative","output":{"script":"ycblcw/ycblcw-ad-clean.js","conf":"ycblcw/quantumult-x-snippet.conf"},"actions":[{"kind":"js","op":"setBody","value":"/* Dedicated click-overlay and redirect advertising disabled. */"},{"kind":"html","op":"replaceRegex","requires":["/template/buka/"],"bodyPattern":"<html[\\s>]","pattern":"<script\\b[^>]*\\bsrc\\s*=\\s*[\"\\'](?:https?:)?(?:\\/\\/(?:www\\.|m\\.)?ycblcw\\.com)?\\/dedg\\/cs13341\\.js(?:\\?[^\"\\']*)?[\"\\'][^>]*>[\\s\\S]*?<\\/script\\s*>","flags":"ig","value":""},{"kind":"html","op":"replaceRegex","requires":["/template/buka/"],"bodyPattern":"<html[\\s>]","pattern":"<a\\b[^>]*\\bhref\\s*=\\s*[\"\\'](?:https?:)?\\/\\/app2\\.zstv47\\.com(?:[/?][^\"\\']*)?[\"\\'][^>]*>[\\s\\S]*?<\\/a\\s*>","flags":"ig","value":""}],"bindings":[{"host":"(?:|www\\.|m\\.)(?:ycblcw\\.com)","routes":[{"kind":"js","path":"/dedg/cs13341\\.js(?:\\?.*)?$"},{"kind":"html","path":"/(?:[^?#]*\\.html)?(?:\\?.*)?$"}]}]}],{declarative:cleanDeclarative});
})();
