import fs from 'node:fs';
import path from 'node:path';
const valid=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]*$/.test(id);
export function loadTemplateManifest(root){
 const read=file=>JSON.parse(fs.readFileSync(path.join(root,'universal',file),'utf8'));
 const source=read('manifest.json'),{templateFiles,behaviorProfiles,...metadata}=source;
 if(!Array.isArray(templateFiles)||new Set(templateFiles).size!==templateFiles.length||!templateFiles.every(valid))throw Error('Invalid template file list');
 if(!Array.isArray(behaviorProfiles)||new Set(behaviorProfiles).size!==behaviorProfiles.length||!behaviorProfiles.every(valid))throw Error('Invalid behavior profile list');
 const profiles=new Map(behaviorProfiles.map(id=>{const p=read('profiles/'+id+'.json');if(p.id!==id||!p.actions||!p.defaults||!p.jsHelpers)throw Error('Invalid behavior profile');return[id,p];}));
 function expand(action,profile){
  if(!action.behavior)return action;
  if(Object.keys(action).some(k=>!['behavior','parameters','pathPattern'].includes(k)))throw Error('Unknown behavior override');
  const [id,key,...rest]=action.behavior.split('/');if(rest.length||id!==profile?.id||!Object.hasOwn(profile.actions,key))throw Error('Unknown action behavior');
  const params=action.parameters;if(!params||typeof params!=='object'||Array.isArray(params))throw Error('Invalid behavior parameters');
  const used=new Set();
  function visit(value){
   if(typeof value==='string')return value.replace(/\{\{(v\d+)\}\}/g,(_,name)=>{used.add(name);if(!Object.hasOwn(params,name)||!/^_0x[0-9a-f]+$/.test(params[name]))throw Error('Invalid or missing behavior parameter');return params[name];});
   if(Array.isArray(value))return value.map(visit);
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
   return value;
  }
  const resolved=visit(profile.actions[key]);if(Object.keys(params).some(k=>!used.has(k)))throw Error('Unused behavior parameter');
  if(action.pathPattern!==undefined)resolved.pathPattern=action.pathPattern;
  return resolved;
 }
 const templates=templateFiles.map(id=>{
  const t=read('templates/'+id+'.json');if(t.id!==id)throw Error('Template ID/file mismatch');
  const {behaviorProfile,...local}=t,p=behaviorProfile===undefined?null:profiles.get(behaviorProfile);
  if(behaviorProfile!==undefined&&!p)throw Error('Unknown behavior profile');
  return {...(p?.defaults||{}),...local,...(t.jsHelpers?{jsHelpers:{...t.jsHelpers,...(p?.jsHelpers||{})}}:{}),...(t.actions?{actions:t.actions.map(a=>expand(a,p))}:{})};
 });
 return {...metadata,templates};
}
