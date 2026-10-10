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
      var count=0,patched=bounds.text;
      r.pairs.forEach(function(pair){var pieces=patched.split(pair[0]);count+=pieces.length-1;patched=pieces.join(pair[1]);});
      if(count>=r.minimum)source=source.slice(0,bounds.start)+patched+source.slice(bounds.end);
    }
  }
  return source;
}
