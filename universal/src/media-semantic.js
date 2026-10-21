// Static syntax inspection only. No page function or API response is executed.
function admMediaSemantic(body,audit,siteId,adReadsRemaining){
  var result={body:body,helpers:[]},started=Date.now(),visited=0,units=0,downloads=0,adFunctions=0,edits=[];
  function done(status){if(audit){audit.semanticStatus=status;audit.semanticUnits=units;audit.semanticDownloadGroups=downloads;audit.semanticAdFunctions=adFunctions;audit.semanticEdits=edits.length;}return result;}
  if(body.length>2097152)return done('size-limit');
  var brand={kkapp:'可可影视',ncat:'网飞猫',happ:'好好看'}[siteId],adProbe=brand&&adReadsRemaining!==false&&body.indexOf('appAdvertisements')>=0&&body.indexOf('getAdvertiseById')>=0;
  if(body.indexOf('webpackChunkmovie')<0||(!adProbe&&body.indexOf('/v2/config/units.capi')<0&&body.indexOf('ad_last_shown_time')<0))return done('not-applicable');
  function fn(n){return n&&(n.type==='FunctionExpression'||n.type==='ArrowFunctionExpression'||n.type==='FunctionDeclaration');}
  function walk(root,visit,own){
    var stack=[root];while(stack.length){var node=stack.pop();if(!node||typeof node!=='object')continue;
      if(++visited%512===0&&(visited>500000||Date.now()-started>600))throw Error('budget');
      if(own&&fn(node))continue;
      if(node.type)visit(node);
      Object.keys(node).forEach(function(k){var v=node[k];if(!v||typeof v!=='object')return;if(Array.isArray(v))for(var i=v.length-1;i>=0;i--)stack.push(v[i]);else stack.push(v);});
    }
  }
  function nodes(root,predicate,own){var out=[];walk(root,function(n){if(predicate(n))out.push(n);},own);return out;}
  function prop(n){return n&&((n.type==='Property'||n.type==='MemberExpression')?(n.computed||n.key&&n.key.type==='Literal'||n.property&&n.property.type==='Literal'?(n.key||n.property).value:(n.key||n.property).name):undefined);}
  function chain(n){var keys=[];while(n&&n.type==='MemberExpression'){var k=prop(n);if(typeof k!=='string')return null;keys.unshift(k);n=n.object;}return n&&n.type==='Identifier'?{name:n.name,keys:keys}:null;}
  function isPath(n,name,keys){var p=chain(n);return p&&p.name===name&&p.keys.join('.')===keys.join('.');}
  function literal(n,value){return n&&n.type==='Literal'&&n.value===value;}
  function value(n){if(n&&n.type==='Literal')return n.value;if(n&&n.type==='UnaryExpression'&&n.operator==='!')return !value(n.argument);}
  function calls(root,predicate,own){return nodes(root,function(n){return n.type==='CallExpression'&&predicate(n);},own);}
  function directDeclarations(f){var map=Object.create(null);if(!f.body||f.body.type!=='BlockStatement')return map;
    f.body.body.forEach(function(s){if(s.type==='VariableDeclaration')s.declarations.forEach(function(d){if(d.id.type==='Identifier'){map[d.id.name]=map[d.id.name]?{ambiguous:true}:d;}});});return map;}
  function factoryKey(n){
    if(!n||n.type!=='CallExpression'||n.optional)return null;
    var callee=n.callee,unbound=false;
    if(callee.type==='SequenceExpression'){
      if(callee.expressions.length!==2||!literal(callee.expressions[0],0))return null;
      callee=callee.expressions[1];unbound=true;
    }
    var p=chain(callee);return p?JSON.stringify([unbound,p.name,p.keys]):null;
  }
  function sameFactory(a,b){var key=factoryKey(a);return key!==null&&key===factoryKey(b);}

  function ident(n,name){return n&&n.type==='Identifier'&&n.name===name;}
  function zero(n){return literal(n,0);}
  function lengthPositive(n,name){return n&&n.type==='BinaryExpression'&&n.operator==='>'&&isPath(n.left,name,['length'])&&zero(n.right);}
  function sameId(callback,id){
    if(!fn(callback)||callback.async||callback.generator||callback.params.length!==1||callback.params[0].type!=='Identifier')return false;
    var item=callback.params[0].name;if(item===id||callback.id&&[id,item].indexOf(callback.id.name)>=0)return false;
    var expression=callback.body;
    if(expression.type==='BlockStatement'){
      if(expression.body.length!==1||expression.body[0].type!=='ReturnStatement')return false;
      expression=expression.body[0].argument;
    }
    return expression&&expression.type==='BinaryExpression'&&['==','==='].indexOf(expression.operator)>=0&&
      ((isPath(expression.left,item,['id'])&&ident(expression.right,id))||(isPath(expression.right,item,['id'])&&ident(expression.left,id)));
  }
  function adLookup(n,list,method,id){return n&&n.type==='CallExpression'&&!n.optional&&isPath(n.callee,list,[method])&&n.arguments.length===1&&sameId(n.arguments[0],id);}
  function conjunction(n){return n&&n.type==='LogicalExpression'&&n.operator==='&&'?conjunction(n.left).concat(conjunction(n.right)):[n];}
  function adPredicate(f){
    var statements=f.body.body;if(statements.length<2||statements.length>3||statements[statements.length-1].type!=='ReturnStatement')return null;
    var declarations=[];
    for(var i=0;i<statements.length-1;i++){
      if(statements[i].type!=='VariableDeclaration')return null;
      declarations=declarations.concat(statements[i].declarations);
    }
    if(declarations.length!==2||declarations.some(function(d){return d.id.type!=='Identifier'||!d.init;}))return null;
    var id=f.params[0].name,store=declarations[0],ads=declarations[1],key=factoryKey(store.init);
    if(!key||store.init.arguments.length!==0||!isPath(ads.init,store.id.name,['appAdvertisements'])||
      (id===store.id.name||id===ads.id.name||store.id.name===ads.id.name)||[store.id.name,ads.id.name].indexOf(JSON.parse(key)[1])>=0)return null;
    var returned=statements[statements.length-1].argument;
    if(!returned||returned.type!=='LogicalExpression'||returned.operator!=='&&'||!adLookup(returned.right,ads.id.name,'some',id))return null;
    var test=returned.left;
    if(test.type!=='UnaryExpression'||test.operator!=='!'||test.argument.type!=='UnaryExpression'||test.argument.operator!=='!')return null;
    var terms=conjunction(test.argument.argument);
    if(terms.length!==4||!ident(terms[0],ads.id.name)||!lengthPositive(terms[1],ads.id.name)||!ident(terms[2],id)||!lengthPositive(terms[3],id))return null;
    // Keep the original store call: its shared initialization is not proven
    // ad-exclusive. Remove only the confirmed advertisement read/lookup.
    return '{'+body.slice(store.init.start,store.init.end)+';return false;}';
  }
  function lengthCompare(n,id,operators){return n&&n.type==='BinaryExpression'&&operators.indexOf(n.operator)>=0&&
    ((zero(n.left)&&isPath(n.right,id,['length']))||(isPath(n.left,id,['length'])&&zero(n.right)));}
  function adGetter(f){
    var statements=f.body.body,id=f.params[0].name,guard=statements[0];if(!guard||guard.type!=='IfStatement'||guard.alternate)return null;
    if(statements.length===1){
      if(guard.test.type!=='LogicalExpression'||guard.test.operator!=='&&'||!ident(guard.test.left,id)||!lengthCompare(guard.test.right,id,['!=','!=='])||guard.consequent.type!=='BlockStatement')return null;
      statements=guard.consequent.body;
    }else{
      if(statements.length!==3||guard.test.type!=='LogicalExpression'||guard.test.operator!=='||'||guard.test.left.type!=='UnaryExpression'||guard.test.left.operator!=='!'||!ident(guard.test.left.argument,id)||!lengthCompare(guard.test.right,id,['==','==='])||guard.consequent.type!=='ReturnStatement'||guard.consequent.argument)return null;
      statements=statements.slice(1);
    }
    if(statements.length!==2||statements[0].type!=='VariableDeclaration'||statements[0].declarations.length!==1||statements[1].type!=='ReturnStatement')return null;
    var declaration=statements[0].declarations[0],read=declaration.init,returned=statements[1].argument;
    if(declaration.id.type!=='Identifier'||declaration.id.name===id||!read||read.type!=='MemberExpression'||read.object.type!=='ThisExpression'||prop(read)!=='appAdvertisements'||!returned||returned.type!=='ConditionalExpression')return null;
    var list=declaration.id.name,terms=conjunction(returned.test),fallback=returned.alternate;
    if(terms.length!==2||!ident(terms[0],list)||!lengthPositive(terms[1],list)||!adLookup(returned.consequent,list,'find',id)||!fallback||fallback.type!=='UnaryExpression'||fallback.operator!=='void'||!zero(fallback.argument))return null;
    return '{return void 0;}';
  }
  function shadows(f,names){return f.id&&names.indexOf(f.id.name)>=0||(f.params||[]).some(function(p){return p.type!=='Identifier'||names.indexOf(p.name)>=0;})||nodes(f.body,function(n){return (n.type==='VariableDeclarator'||n.type==='FunctionDeclaration')&&n.id&&n.id.type==='Identifier'&&names.indexOf(n.id.name)>=0;},false).length>0;}
  function patch(node,text){edits.push({s:node.start,e:node.end,r:text});}
  try{
    var ast=admMediaAcorn().parse(body,{ecmaVersion:'latest'}),functions=[],webpack=false,adGetters=[],brandFound=false,adWords=Object.create(null);
    walk(ast,function(n){if(fn(n))functions.push(n);
      if(adProbe){
        if(n.type==='Property'&&!n.computed&&prop(n)==='appName'&&literal(n.value,brand))brandFound=true;
        if(n.type==='Literal'&&typeof n.value==='string')adWords[n.value]=true;
        if((n.type==='Property'||n.type==='MemberExpression')&&typeof prop(n)==='string')adWords[prop(n)]=true;
        if(n.type==='Property'&&!n.computed&&n.kind==='init'&&prop(n)==='getAdvertiseById'&&fn(n.value))adGetters.push(n.value);
      }if(n.type==='MemberExpression'&&n.object.type==='Identifier'&&n.object.name==='self'&&prop(n)==='webpackChunkmovie')webpack=true;});
    if(!webpack)return done('not-applicable');
    var adGuard=adProbe&&brandFound&&adGetters.length>0&&adWords.FLOATING_WINDOW&&adWords.VOD_START;
    functions.forEach(function(f){
      if(adGuard&&!f.async&&!f.generator&&f.body.type==='BlockStatement'&&f.params.length===1&&f.params[0].type==='Identifier'){
        var replacement=adGetters.indexOf(f)>=0?adGetter(f):adPredicate(f);
        if(replacement){patch(f.body,replacement);adFunctions++;return;}
      }
      if(f.async||f.generator||f.type==='FunctionDeclaration'||f.body.type!=='BlockStatement')return;
      var text=body.slice(f.body.start,f.body.end);
      if(text.indexOf('/v2/config/units.capi')<0&&text.indexOf('ad_last_shown_time')<0)return;
      var own=nodes(f.body,function(){return true;},true),bindings=directDeclarations(f);
      // Locate the actual HTTP function through its own URL/method bindings,
      // never through a webpack export alias such as "so".
      var urls=Object.keys(bindings).filter(function(k){return literal(bindings[k].init,'/v2/config/units.capi');});
      var methods=Object.keys(bindings).filter(function(k){return literal(bindings[k].init,'get');});
      if(urls.length===1&&methods.length===1){
        var requests=own.filter(function(n){if(n.type!=='CallExpression'||n.arguments.length!==1||n.arguments[0].type!=='ObjectExpression')return false;
          var p=Object.create(null),valid=true;n.arguments[0].properties.forEach(function(q){var key=prop(q);if(q.type!=='Property'||q.computed||q.method||q.kind!=='init'||p[key]||['baseURL','url','method','headers','data','params'].indexOf(key)<0)valid=false;else p[key]=q.value;});if(!valid)return false;
          return p.url&&p.url.type==='Identifier'&&p.url.name===urls[0]&&p.method&&p.method.type==='Identifier'&&p.method.name===methods[0]&&p.headers&&p.baseURL&&nodes(p.baseURL,function(x){return x.type==='MemberExpression'&&prop(x)==='getCacheUrl';},true).length===1;
        });
        var mutated=own.some(function(n){return (n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&[urls[0],methods[0]].indexOf(n.left.name)>=0)||(n.type==='UpdateExpression'&&n.argument.type==='Identifier'&&[urls[0],methods[0]].indexOf(n.argument.name)>=0);});
        var endpoints=own.filter(function(n){return n.type==='Literal'&&typeof n.value==='string'&&/^\/.*\.capi$/.test(n.value);});
        if(requests.length===1&&!mutated&&endpoints.length===1){patch(f.body,'{return Promise.resolve({data:[]});}');units++;}
      }
      var cache=Object.keys(bindings).filter(function(k){return literal(bindings[k].init,'ad_last_shown_time');});
      if(cache.length!==1)return;
      var returns=f.body.body.filter(function(n){return n.type==='ReturnStatement';});if(returns.length!==1)return;
      var returned=returns[0].argument;if(returned&&returned.type==='SequenceExpression')returned=returned.expressions[returned.expressions.length-1];
      if(!returned||returned.type!=='ObjectExpression')return;
      var fields=Object.create(null),returnKeys=Object.create(null),validReturn=true;returned.properties.forEach(function(p){var key=prop(p);if(p.type!=='Property'||p.computed||p.method||p.kind!=='init'||returnKeys[key])validReturn=false;else{returnKeys[key]=true;if(p.value.type==='Identifier')fields[key]=p.value.name;}});if(!validReturn)return;
      if(!['data','isAdVisible','countdown','onClickRight','onClickAtMagnet','rightText'].every(function(k){return fields[k]&&bindings[fields[k]];}))return;
      var data=fields.data,visible=fields.isAdVisible,count=fields.countdown;
      var dataInit=bindings[data].init,visibleInit=bindings[visible].init,countInit=bindings[count].init;
      if(!sameFactory(dataInit,visibleInit)||!sameFactory(dataInit,countInit)||dataInit.arguments.length!==0||visibleInit.arguments.length!==1||value(visibleInit.arguments[0])!==false||countInit.arguments.length!==1||typeof value(countInit.arguments[0])!=='number'||value(countInit.arguments[0])<0||value(countInit.arguments[0])>60)return;
      var locals=Object.keys(bindings).filter(function(k){var v=bindings[k].init;return fn(v)&&v.body.type==='BlockStatement'&&!v.async&&!v.generator;});
      var stops=locals.filter(function(k){var v=bindings[k].init,all=calls(v.body,function(){return true;},true);if(all.length!==1)return false;
        var c=all[0];if(c.callee.type!=='Identifier'||c.callee.name!=='clearInterval'||c.arguments.length!==1)return false;
        var timer=chain(c.arguments[0]),assignments=nodes(v.body,function(n){return n.type==='AssignmentExpression';},true);
        return timer&&timer.keys.join('.')==='value'&&bindings[timer.name]&&sameFactory(dataInit,bindings[timer.name].init)&&bindings[timer.name].init.arguments.length===0&&assignments.length===1&&isPath(assignments[0].left,timer.name,['value'])&&(literal(assignments[0].right,null)||assignments[0].right.type==='UnaryExpression'&&assignments[0].right.operator==='void')&&nodes(v.body,function(n){return n.type==='UpdateExpression';},true).length===0;
      });if(stops.length!==1)return;
      var stop=stops[0],protectedNames=[data,visible,count,stop];
      if(nodes(f.body,function(n){return n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&protectedNames.indexOf(n.left.name)>=0;},false).length)return;
      var initializers=locals.filter(function(k){var v=bindings[k].init;if(v.params.length!==1||v.params[0].type!=='Identifier'||shadows(v,protectedNames))return false;var name=v.params[0].name;
        return ['splash','video','dhz','interval'].every(function(key){return nodes(v.body,function(n){return isPath(n,name,['units',key]);},true).length>0;})&&calls(v.body,function(c){return c.callee.type==='Identifier'&&c.callee.name===stop;},true).length>0&&calls(v.body,function(c){return isPath(c.callee,'localStorage',['getItem'])&&c.arguments.length===1&&c.arguments[0].type==='Identifier'&&c.arguments[0].name===cache[0];},true).length===1;
      });
      var dispatchers=locals.filter(function(k){var v=bindings[k].init;if(v.params.length!==2||v.params[1].type!=='Identifier'||shadows(v,protectedNames))return false;var name=v.params[1].name;
        return ['type','splash','video','dhz'].every(function(key){return nodes(v.body,function(n){return isPath(n,name,[key]);},true).length>0;})&&nodes(v.body,function(n){return n.type==='SwitchStatement'&&['splash','video','dhz'].every(function(key){return n.cases.some(function(c){return literal(c.test,key);});});},true).length===1&&nodes(v.body,function(n){return n.type==='AssignmentExpression'&&isPath(n.left,visible,['value'])&&value(n.right)===false;},true).length>0;
      });if(initializers.length!==1||dispatchers.length!==1||initializers[0]===dispatchers[0])return;
      // The fetched resource envelope must feed both the exposed data ref and
      // setNetdisks inside the same .then callback. No account/API guessing.
      var responses=[];
      Object.keys(bindings).forEach(function(k){var v=bindings[k].init;if(!fn(v))return;
        calls(v.body,function(c){if(c.callee.type!=='MemberExpression'||prop(c.callee)!=='then'||c.arguments.length!==1||!fn(c.arguments[0]))return false;
          var cb=c.arguments[0];if(cb.async||cb.generator||cb.params.length!==1||cb.params[0].type!=='Identifier'||shadows(cb,[data]))return false;var name=cb.params[0].name;
          var assigns=nodes(cb.body,function(n){return n.type==='AssignmentExpression'&&isPath(n.left,data,['value'])&&isPath(n.right,name,['data']);},true);
          var netdisks=calls(cb.body,function(call){return call.callee.type==='MemberExpression'&&prop(call.callee)==='setNetdisks'&&call.arguments.length===1&&isPath(call.arguments[0],name,['data','netdisk']);},true);
          if(assigns.length===1&&netdisks.length===1)responses.push(assigns[0].right);return false;
        },false);
      });if(responses.length!==1)return;
      var reset='{'+visible+'.value=false;'+count+'.value=0;'+stop+'();}';
      patch(bindings[initializers[0]].init.body,reset);patch(bindings[dispatchers[0]].init.body,reset);
      patch(countInit.arguments[0],'0');patch(responses[0],'__forAdmDownloadData('+body.slice(responses[0].start,responses[0].end)+')');
      if(result.helpers.indexOf('download')<0)result.helpers.push('download');downloads++;
    });
    if(Date.now()-started>600)throw Error('budget');
    edits.sort(function(a,b){return a.s-b.s;});for(var i=1;i<edits.length;i++)if(edits[i].s<edits[i-1].e)throw Error('overlap');
    var out=body;for(var j=edits.length-1;j>=0;j--)out=out.slice(0,edits[j].s)+edits[j].r+out.slice(edits[j].e);
    result.body=out;return done(edits.length?'modified':'no-match');
  }catch(error){result.helpers=[];units=0;downloads=0;adFunctions=0;edits=[];return done(error.message==='budget'?'budget-limit':'rejected');}
}
