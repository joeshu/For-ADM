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
