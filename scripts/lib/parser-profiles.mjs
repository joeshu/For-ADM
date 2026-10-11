// Build-time reuse only: no host discovery or runtime profile requests.
export function parserProfiles(manifest){
 const profiles=manifest.parserProfiles??[];
 if(!Array.isArray(profiles))throw Error('Parser profiles must be an array');
 const result=new Map();
 for(const profile of profiles){
  if(!profile||!/^[a-z0-9][a-z0-9-]*$/.test(profile.id)||result.has(profile.id)||!Array.isArray(profile.actions)||!profile.actions.length)throw Error('Invalid or duplicate parser profile');
  if(Object.keys(profile).some(k=>!['id','name','actions'].includes(k)))throw Error('Profiles define actions only; hosts and routes belong to bindings');
  for(const action of profile.actions){
   if(!['html','js'].includes(action.kind)||!Array.isArray(action.requires)||action.requires.length<3||action.requires.some(s=>typeof s!=='string'||!s))throw Error('Parser actions require at least three source fingerprints');
  }
  result.set(profile.id,profile);
 }
 return result;
}
export function resolveParserProfile(template,manifest){
 const profiles=parserProfiles(manifest);
 if(template.parserProfile===undefined)return template;
 const profile=profiles.get(template.parserProfile);
 if(!profile)throw Error('Unknown parser profile: '+template.parserProfile);
 if(template.adapter!=='declarative'||template.actions!==undefined||template.jsonPolicies!==undefined||template.jsRules!==undefined||template.runtime!==undefined)throw Error('Parser profile cannot be mixed with local actions or adapters');
 if(!Array.isArray(template.bindings)||!template.bindings.length||template.bindings.some(b=>b.domains?.type!=='exact'||!Array.isArray(b.routes)||!b.routes.length||b.routes.some(r=>!profile.actions.some(a=>a.kind===r.kind))))throw Error('Parser profile bindings require exact hosts and supported route kinds');
 const {parserProfile,...resolved}=template;
 return {...resolved,actions:JSON.parse(JSON.stringify(profile.actions))};
}
