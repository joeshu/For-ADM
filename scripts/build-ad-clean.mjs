import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateSourcePath,parseRuleImport,validateGeneratedRules} from './lib/rule-import.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('universal/templates.json'));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function domains(d){
 const prefixes=d.prefixes||[''];
 let base,mitm;
 if(d.type==='exact'){base='(?:'+d.names.map(escape).join('|')+')';mitm=d.names;}
 else if(d.type==='numbered'){base='(?:'+d.brands.map(escape).join('|')+')\\d+\\.'+escape(d.tld);mitm=d.brands.map(b=>b+'*.'+d.tld);}
 else if(d.type==='dated'){base=d.prefix+'\\.(?:'+d.suffixes.map(escape).join('|')+')';mitm=d.suffixes.map(s=>d.wildcard+'.'+s);}
 else throw Error('Unknown domain type');
 const p=prefixes.map(s=>escape(s)+(s?'\\.':''));
 return {host:(p.length>1?'(?:'+p.join('|')+')':p[0])+base,mitm:prefixes.flatMap(p=>mitm.map(s=>(p?p+'.':'')+s))};
}
const sources=['universal/src/engine.js','universal/src/function-tools.js','universal/src/souju.js','universal/src/yqk.js'];
const source=sources.map(read).join('\n');
const revision=crypto.createHash('sha256').update(read('universal/templates.json')+source+(manifest.requestRules||[]).map(r=>r.sourceFile?read(validateSourcePath(r.sourceFile)):'').join('')+read('scripts/build-ad-clean.mjs')+read('scripts/lib/rule-import.mjs')).digest('hex').slice(0,12);
const templates=manifest.templates.map(t=>({...t,bindings:t.bindings.map(b=>({...b,...domains(b.domains)}))}));
const ids=new Set();
const outputPaths=new Set();
function validatePairs(pairs){
 if(!Array.isArray(pairs)||!pairs.length)throw Error('Empty JS modification group');
 for(const p of pairs)if(typeof p[0]!=='string'||!p[0]||typeof p[1]!=='string'||(p[2]!==undefined&&(!Number.isInteger(p[2])||p[2]<1)))throw Error('Invalid JS replacement/count');
}
for(const t of templates){
 if(ids.has(t.id))throw Error('Duplicate template ID');ids.add(t.id);
 if(!['souju','yqk','declarative'].includes(t.adapter))throw Error('Unknown adapter');
 for(const p of Object.values(t.output)){
  if(typeof p!=='string'||path.isAbsolute(p)||p.split(/[\\/]/).some(s=>!s||s==='..'||s==='.')||!p.endsWith('.js')&&!p.endsWith('.conf'))throw Error('Invalid output path');
  if(outputPaths.has(p))throw Error('Duplicate output path');outputPaths.add(p);
 }
 for(const b of t.bindings){new RegExp('^'+b.host+'$');for(const r of b.routes){if(!r.path.startsWith('/')||!['html','js','json'].includes(r.kind))throw Error('Invalid route');new RegExp('^'+r.path);}}
 for(const a of t.actions||[]){
  if(a.requires&&(!Array.isArray(a.requires)||!a.requires.every(s=>typeof s==='string'&&s)))throw Error('Invalid source fingerprints');
  if(a.bodyPattern)new RegExp(a.bodyPattern);
  if(a.kind==='html'){
   if(a.op==='removeElements'){
    const s=a.selector;if(!s||!s.tag||!s.attr||[s.token,s.exact,s.pattern].filter(x=>x!==undefined).length!==1)throw Error('Invalid HTML selector');
    if(s.pattern){if(!s.pattern.startsWith('^')||!s.pattern.endsWith('$'))throw Error('HTML attribute pattern must be anchored');new RegExp(s.pattern);}
   }else if(a.op==='removeInlineScripts'||a.op==='replaceInlineScripts'){
    if(!Array.isArray(a.scriptRequires)||a.scriptRequires.length<3||!a.scriptRequires.every(s=>typeof s==='string'&&s))throw Error('Inline script removal requires at least three source fingerprints');
    if(a.op==='replaceInlineScripts')validatePairs(a.pairs);
   }else if(a.op==='removeAttributes')new RegExp(a.attributePattern);
   else throw Error('HTML must use tag-aware operations');
  }else if(a.kind==='js'){
   if(a.op==='replaceRegex')new RegExp(a.pattern,a.flags||'g');
   else if(a.op==='replaceGroup'){validatePairs(a.pairs);if(!a.requires?.length)throw Error('JS group requires source fingerprints');}
   else if(a.op!=='setBody')throw Error('Invalid JS operation');
  }else throw Error('Invalid action kind');
 }
 if(t.runtime)validatePairs(t.runtime.pairs);
 for(const rule of t.jsRules||[]){for(const group of rule.groups||[])validatePairs(group);if(rule.inject)validatePairs(rule.inject);}
 for(const policy of t.jsonPolicies||[]){
  new RegExp(policy.endpoint);
  for(const op of policy.ops){
   if(!['set','clearArray','filterArray'].includes(op.op)||!op.path||op.path.split('.').some(s=>['__proto__','prototype','constructor'].includes(s)))throw Error('Invalid JSON operation/path');
  }
 }
}
const requestRules=(manifest.requestRules||[]).map(r=>({...r,...domains(r.domains)}));
for(const r of requestRules){
 if(ids.has(r.id))throw Error('Duplicate request rule ID');ids.add(r.id);
 if(r.domains.type!=='exact'||!r.domains.names.length||r.domains.names.some(h=>!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)))throw Error('Request rejects require exact hosts');
 if(r.mode==='verbatim'){
  Object.assign(r,parseRuleImport(read(validateSourcePath(r.sourceFile)),r.domains.names));
 }else if(r.action!=='reject-dict'||!Array.isArray(r.endpoints)||!r.endpoints.length||new Set(r.endpoints).size!==r.endpoints.length||r.endpoints.some(p=>!/^\/App\/(?:Ad|ad|IndexList|Resource)\/[A-Za-z/]+$/.test(p)))throw Error('Invalid advertising request endpoints');
 const p=r.output?.conf;
 if(typeof p!=='string'||path.isAbsolute(p)||p.split(/[\\/]/).some(s=>!s||s==='..'||s==='.')||!p.endsWith('.conf')||outputPaths.has(p))throw Error('Invalid request rule output');
 outputPaths.add(p);
}
function requestLines(r){if(r.mode==='verbatim')return r.lines;return r.endpoints.map(p=>'^https?://'+r.host+escape(p)+'(?:\\?.*)?$ url '+r.action);}
const generated=new Map();
function generate(selected,scriptPath,confPath,includeRequests=false){
 const runtime=selected.map(({bindings,...t})=>({...t,bindings:bindings.map(({host,routes})=>({host,routes}))}));
 const header='/* GENERATED from universal/templates.json and universal/src; revision '+revision+'. Do not edit. */\n';
 // One runtime owns $done. Adapters return a body; no nested Quantumult globals.
 const adapters=[...new Set(selected.map(t=>t.adapter))];
 const selectedSource=read('universal/src/engine.js')+(adapters.includes('souju')?'\n'+read('universal/src/function-tools.js')+'\n'+read('universal/src/souju.js'):'')+(adapters.includes('yqk')?'\n'+read('universal/src/yqk.js'):'');
 const names={souju:'cleanSouju',yqk:'cleanYqk',declarative:'cleanDeclarative'};
 const processors='{'+adapters.map(a=>a+':'+names[a]).join(',')+'}';
 const code=header+'(function(){\n'+selectedSource+'\nadmRun('+JSON.stringify(runtime)+','+processors+');\n})();\n';
 const url=manifest.rawBase+'/'+scriptPath+'?v='+revision;
 const rules=selected.flatMap(t=>t.bindings.flatMap(b=>b.routes.map(r=>'^https?://'+b.host+r.path+' url script-response-body '+url)));
 const groups=selected.map(t=>'# '+t.id+'\n'+t.bindings.flatMap(b=>b.routes.map(r=>'^https?://'+b.host+r.path+' url script-response-body '+url)).join('\n')); 
 if(includeRequests){rules.push(...requestRules.flatMap(requestLines));groups.push(...requestRules.map(r=>'# '+r.id+(r.mode==='verbatim'?' — complete upstream rules; original host matching and external script references':'')+'\n'+requestLines(r).join('\n')));}
 validateGeneratedRules(rules);
 const mitm=[...new Set([...selected.flatMap(t=>t.bindings.flatMap(b=>b.mitm)),...(includeRequests?requestRules.flatMap(r=>r.mitm):[])])];
 generated.set(scriptPath,code);generated.set(confPath,(includeRequests?'#!name = For-ADM 统一去广告\n#!desc = 网站适配与瓜子完整原规则；更新后刷新脚本缓存\n':'')+'# GENERATED; revision '+revision+'\n[rewrite_local]\n'+groups.join('\n\n')+'\n\n[mitm]\nhostname = '+mitm.join(', ')+'\n');
}
generate(templates,'universal/ad-clean.js','universal/quantumult-x-snippet.conf',true);
for(const r of requestRules)generated.set(r.output.conf,(r.metadata?.join('\n')||'')+'\n# GENERATED; revision '+revision+'\n[rewrite_local]\n'+requestLines(r).join('\n')+'\n\n[mitm]\nhostname = '+r.mitm.join(', ')+'\n');
for(const t of templates)generate([t],t.output.script,t.output.conf);
const checking=process.argv.includes('--check');
for(const [p,text]of generated){if(checking){if(!fs.existsSync(path.join(root,p))||read(p)!==text)throw Error('Stale generated file: '+p);}else{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),text);}}
console.log((checking?'Verified':'Generated')+' '+generated.size+' artifacts, revision '+revision);
