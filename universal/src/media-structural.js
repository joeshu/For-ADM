// The tokenizer is lazy and bundled locally; no site code is executed here.
function admMediaStructural(body,config,audit){
  var result={body:body,helpers:[]},started=Date.now(),budget=700;
  function done(status,pairs){if(audit){audit.structuralStatus=status;audit.structuralPairs=pairs||0;}return result;}
  if(body.length>2097152)return done('size-limit');
  if(body.indexOf('webpackChunkmovie')<0||!config.probes.some(function(p){return body.indexOf(p)>=0;}))return done('not-applicable');
  try{
    var lexer=admMediaAcorn().tokenizer(body,{ecmaVersion:'latest'}),tokens=[],index=Object.create(null),texts=[],token;
    function append(label,value,start,end){
      var key=label+':'+JSON.stringify(value),at=tokens.length;
      if(!index[key])index[key]=[];index[key].push(at);
      tokens.push({k:key,n:label==='name'?value:null,s:start,e:end});
      if((label==='name'||label==='string')&&typeof value==='string')texts.push(value);
    }
    var dot=null;
    while((token=lexer.getToken()).type.label!=='eof'){
      if(tokens.length>=250000||tokens.length%1024===0&&Date.now()-started>budget)return done('budget-limit');
      // A non-optional .IdentifierName and ["IdentifierName"] use the same
      // lookup. Normalize matching tokens only; retain original byte ranges.
      // Private fields, dynamic keys and optional chains are not generalized.
      if(dot){
        if(token.type.label==='name'||token.type.keyword){
          append('[',undefined,dot.start,dot.end);
          append('string',token.value,token.start,token.end);
          append(']',undefined,token.end,token.end);dot=null;continue;
        }
        append('.',undefined,dot.start,dot.end);dot=null;
      }
      if(token.type.label==='.'){dot=token;continue;}
      var value=token.type.label==='regexp'?[token.value.pattern,token.value.flags]:token.value;
      append(token.type.label,value,token.start,token.end);
    }
    if(dot)append('.',undefined,dot.start,dot.end);
    // Genuine webpack membership is required, not a marker in comments or strings.
    var movie=index['string:"webpackChunkmovie"']||[],module=false;
    movie.forEach(function(i){if(i>=2&&tokens[i-2].n==='self'&&tokens[i-1].k==='[:undefined'&&tokens[i+1]&&tokens[i+1].k===']:undefined')module=true;});
    if(!module)return done('not-applicable');
    function occurrences(pattern){
      var anchor=-1;
      for(var i=0;i<pattern.length;i++)if(typeof pattern[i]==='string'&&(anchor<0||(index[pattern[i]]||[]).length<(index[pattern[anchor]]||[]).length))anchor=i;
      var hits=[],positions=index[pattern[anchor]]||[];
      for(var a=0;a<positions.length;a++){
        if(a%128===0&&Date.now()-started>budget)throw Error('budget');
        var begin=positions[a]-anchor;if(begin<0||begin+pattern.length>tokens.length)continue;
        var names=Object.create(null),inverse=Object.create(null),ok=true;
        for(var offset=0;offset<pattern.length;offset++){
          var want=pattern[offset],actual=tokens[begin+offset];
          if(typeof want==='string'){if(want!==actual.k){ok=false;break;}}
          else{var id='$'+want,n=actual.n;if(!n||(names[id]&&names[id].n!==n)||(inverse['$'+n]&&inverse['$'+n]!==id)){ok=false;break;}names[id]={n:n,raw:body.slice(actual.s,actual.e)};inverse['$'+n]=id;}
        }
        if(ok)hits.push({s:tokens[begin].s,e:tokens[begin+pattern.length-1].e,n:names});
      }
      return hits;
    }
    var guards=Object.create(null),edits=Object.create(null),all=[];
    function guarded(marker){var k=JSON.stringify(marker);if(guards[k]!==undefined)return guards[k];return guards[k]=marker.t?occurrences(marker.t).length>0:texts.some(function(t){return t.indexOf(marker.v)>=0;});}
    config.rules.forEach(function(rule){
      if(!rule.g.some(function(group){return group.every(guarded);}))return;
      occurrences(rule.p).forEach(function(hit){
        var replacement=rule.r.map(function(part){if(typeof part==='string')return part;var bound=hit.n['$'+part];if(!bound)throw Error('binding');return bound.raw;}).join('');
        var k=hit.s+':'+hit.e;
        if(edits[k]&&edits[k].r!==replacement)throw Error('conflict');
        if(!edits[k]){var edit={s:hit.s,e:hit.e,r:replacement};edits[k]=edit;all.push(edit);}
        if(rule.h&&result.helpers.indexOf(rule.h)<0)result.helpers.push(rule.h);
      });
    });
    if(Date.now()-started>budget)throw Error('budget');
    all.sort(function(a,b){return a.s-b.s;});
    for(var j=1;j<all.length;j++)if(all[j].s<all[j-1].e)throw Error('overlap');
    // A completed token scan can prove there are no remaining static ad
    // collection reads. Assignments and object definitions are not reads.
    // Covered ranges count only when the replacement drops the field too.
    var adReads=index['string:"appAdvertisements"']||[];
    var adReadsRemaining=adReads.some(function(at,i){
      if(i%64===0&&Date.now()-started>budget)throw Error('budget');
      if(!tokens[at-1]||tokens[at-1].k!=='[:undefined'||!tokens[at+1]||tokens[at+1].k!==']:undefined')return false;
      if(tokens[at+2]&&tokens[at+2].k==='=:'+JSON.stringify('='))return false;
      return !all.some(function(edit){return edit.s<=tokens[at].s&&edit.e>=tokens[at].e&&edit.r.indexOf('appAdvertisements')<0;});
    });
    var out=body;for(var n=all.length-1;n>=0;n--)out=out.slice(0,all[n].s)+all[n].r+out.slice(all[n].e);
    if(Date.now()-started>budget)throw Error('budget');
    result.adReadsRemaining=adReadsRemaining;result.body=out;
    return done(all.length?'modified':'no-match',all.length);
  }catch(error){result.helpers=[];return done(error.message==='budget'?'budget-limit':'rejected');}
}
