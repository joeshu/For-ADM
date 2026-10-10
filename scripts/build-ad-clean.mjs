import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
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
const revision=crypto.createHash('sha256').update(read('universal/templates.json')+source+read('scripts/build-ad-clean.mjs')).digest('hex').slice(0,12);
const templates=manifest.templates.map(t=>({...t,bindings:t.bindings.map(b=>({...b,...domains(b.domains)}))}));
const ids=new Set();
for(const t of templates){
 if(ids.has(t.id))throw Error('Duplicate template ID');ids.add(t.id);
 if(!['souju','yqk','declarative'].includes(t.adapter))throw Error('Unknown adapter');
 for(const b of t.bindings){new RegExp('^'+b.host+'$');for(const r of b.routes){if(!r.path.startsWith('/'))throw Error('Route must start at root');new RegExp('^'+r.path);}}
}
const generated=new Map();
function generate(selected,scriptPath,confPath){
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
 const mitm=[...new Set(selected.flatMap(t=>t.bindings.flatMap(b=>b.mitm)))];
 generated.set(scriptPath,code);generated.set(confPath,'# GENERATED; revision '+revision+'\n[rewrite_local]\n'+rules.join('\n')+'\n\n[mitm]\nhostname = '+mitm.join(', ')+'\n');
}
generate(templates,'universal/ad-clean.js','universal/quantumult-x-snippet.conf');
for(const t of templates)generate([t],t.output.script,t.output.conf);
const checking=process.argv.includes('--check');
for(const [p,text]of generated){if(checking){if(!fs.existsSync(path.join(root,p))||read(p)!==text)throw Error('Stale generated file: '+p);}else{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),text);}}
console.log((checking?'Verified':'Generated')+' '+generated.size+' artifacts, revision '+revision);
