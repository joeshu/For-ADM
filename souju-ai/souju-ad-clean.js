/* GENERATED from universal/templates.json and universal/src; revision a14a0317c30e. Do not edit. */
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
        var attr=tail.match(/^\s*([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/);
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
    var original=JSON.parse(body),cleaned=__admEnvelope(original,ctx.path,template.jsonPolicies||[]);
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

// Function patches remain guarded by explicit template markers.
  function admFunctionBounds(source, name, fromIndex) {
    const matcher = new RegExp("\\bfunction\\s+" + name + "\\s*\\(", "g");
    matcher.lastIndex = fromIndex || 0;
    const match = matcher.exec(source);
    if (!match) return null;

    let parameterDepth = 1;
    let parameterQuote = "";
    let parameterEscape = false;
    let parameterLineComment = false;
    let parameterBlockComment = false;
    let parameterEnd = -1;

    for (let i = matcher.lastIndex; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];

      if (parameterLineComment) {
        if (ch === "\n") parameterLineComment = false;
        continue;
      }
      if (parameterBlockComment) {
        if (ch === "*" && next === "/") {
          parameterBlockComment = false;
          i++;
        }
        continue;
      }
      if (parameterQuote) {
        if (parameterEscape) {
          parameterEscape = false;
          continue;
        }
        if (ch === "\\") {
          parameterEscape = true;
          continue;
        }
        if (ch === parameterQuote) parameterQuote = "";
        continue;
      }
      if (ch === "/" && next === "/") {
        parameterLineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        parameterBlockComment = true;
        i++;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        parameterQuote = ch;
        continue;
      }
      if (ch === "(") parameterDepth++;
      if (ch === ")" && --parameterDepth === 0) {
        parameterEnd = i;
        break;
      }
    }

    if (parameterEnd < 0) return null;
    const open = source.indexOf("{", parameterEnd + 1);
    if (open < 0) return null;

    let depth = 0;
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (let i = open; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];

      if (lineComment) {
        if (ch === "\n") lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === "*" && next === "/") {
          blockComment = false;
          i++;
        }
        continue;
      }
      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === "/" && next === "/") {
        lineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        blockComment = true;
        i++;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}" && --depth === 0) {
        return { start: match.index, end: i + 1, text: source.slice(match.index, i + 1) };
      }
    }
    return null;
  }

  function admReplaceFunction(source, name, predicate, replacement) {
    let cursor = 0;
    while (cursor < source.length) {
      const bounds = admFunctionBounds(source, name, cursor);
      if (!bounds) return { source, changed: false };
      if (predicate(bounds.text)) {
        return {
          source: source.slice(0, bounds.start) + replacement + source.slice(bounds.end),
          changed: true
        };
      }
      cursor = bounds.end;
    }
    return { source, changed: false };
  }


// Custom function boundaries; field operations and fingerprints live in the manifest.
function cleanSouju(ctx, template) {
  var source=ctx.body;
  if(ctx.kind==='json') {
    var payload=JSON.parse(source),next=admVisit(payload,template.snapshotWhen,template.snapshotOps,0);
    return next===payload?source:JSON.stringify(next);
  }
  var match=ctx.path.match(/^\/assets\/(global-player-host-[^/?]+|movie-card-runtime-[^/?]+|main-[^/?]+)\.js(?:[?#].*)?$/i);
  if(!match)return source;
  var asset=match[1];
  template.components.forEach(function(c){
    if(asset.indexOf(c.prefix)!==0)return;
    source=admReplaceFunction(source,c.name,function(text){return admHas(text,c.requires);},c.replacement||'function '+c.name+'(){return null}').source;
  });
  var r=template.runtime;
  if(asset.indexOf(r.prefix)===0) {
    var bounds=admFunctionBounds(source,r.name,0);
    while(bounds&&!admHas(bounds.text,r.requires))bounds=admFunctionBounds(source,r.name,bounds.end);
    if(bounds) {
      var patched=admGroup(bounds.text,r.pairs);
      if(patched!==bounds.text)source=source.slice(0,bounds.start)+patched+source.slice(bounds.end);
    }
  }
  return source;
}

admRun([{"id":"souju-ai","adapter":"souju","output":{"script":"souju-ai/souju-ad-clean.js","conf":"souju-ai/quantumult-x-snippet.conf"},"snapshotWhen":{"all":[{"path":"object","equals":"app.experience_snapshot"},{"path":"placements","type":"object"}]},"snapshotOps":[{"op":"clearArray","path":"placements.splash_screen.items"},{"op":"clearArray","path":"placements.showcase_grid.items"},{"op":"set","path":"placements.player_info.enabled","value":false,"create":true,"when":{"path":"placements.player_info","type":"object"}},{"op":"set","path":"placements.player_info.default_ad_targeting.enabled","value":false,"create":true,"when":{"path":"placements.player_info","type":"object"}},{"op":"clearArray","path":"placements.player_info.items"},{"op":"clearArray","path":"placements.player_info.banner_items"},{"op":"clearArray","path":"placements.player_info.grid_items"}],"components":[{"prefix":"global-player-host-","name":"Cp","requires":["qr(\"player_info\")","creative_daily_rotation_limit"]},{"prefix":"global-player-host-","name":"ti","requires":["movie-player-info-ad-grid"]},{"prefix":"global-player-host-","name":"qu","requires":["movie-player-info-ad-banner-shell"]},{"prefix":"main-","name":"T0","requires":["app-startup-ad","跳过"]},{"prefix":"global-player-host-","name":"Sp","requires":["qr(\"player_info\")","movie-player-info-flip","i.jsx(\"div\",{className:s,\"data-backdrop-effect\":r,children:e})"],"replacement":"function Sp({children:e,frontBackdropEffect:r,frontClassName:s}){return i.jsx(\"div\",{className:s,\"data-backdrop-effect\":r,children:e})}"},{"prefix":"global-player-host-","name":"em","requires":["movie-player-top-grid-ad","播放器顶部广告"]}],"runtime":{"prefix":"movie-card-runtime-","name":"As","requires":["splash_screen","player_info","showcase_grid"],"pairs":[["n=en(t.splash_screen,\"banner\")","n=en({...t.splash_screen,items:[]},\"banner\")",1],["o=en(t.showcase_grid,\"grid\")","o=en({...t.showcase_grid,items:[]},\"grid\")",1],["u=en({...a,layout:c===\"grid\"?\"grid\":\"banner\"})","u=en({...a,items:[],layout:c===\"grid\"?\"grid\":\"banner\"})",1],["enabled:a.enabled!==!1","enabled:!1",1],["banner_items:un(a.banner_items)??u.items","banner_items:[]",1],["grid_items:un(a.grid_items)??u.items","grid_items:[]",1]]},"bindings":[{"host":"(?:ai\\.baipiaozhe\\.com|souju\\.ai|kanju3\\.com|www\\.kanju3\\.com)","routes":[{"kind":"json","path":"/v1/[^?#]*(?:[?#].*)?$"},{"kind":"js","path":"/assets/(?:global-player-host-[^/?]+|movie-card-runtime-[^/?]+|main-[^/?]+)\\.js(?:[?#].*)?$"}]}]}],{souju:cleanSouju});
})();
