import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
import {tokenize,compile,indexTokens,findMatches,applyEdits} from './structural.mjs';
import {loadTemplateManifest} from '../../scripts/lib/template-manifest.mjs';import {resolveMediaTemplate} from '../../scripts/lib/shared-media.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const [k,...v]=s.replace(/^--/,'').split('=');return [k,v.join('=')];}));
if(!args.before||!args.after||!args.baseline||!args.out)throw Error('Use --before=DIR --after=DIR --baseline=DIR --out=FILE');
const root=new URL('../../',import.meta.url).pathname,profile=JSON.parse(fs.readFileSync(root+'/universal/profiles/media-structural.json')),manifest=loadTemplateManifest(root),report={checkedAt:new Date().toISOString(),unchangedCompatibility:0,syntheticModules:0,syntheticRanges:0,syntaxChecked:0,failures:[],timings:[]};
function files(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):e.name.endsWith('.js')?[path.join(d,e.name)]:[])}
function run(script,url,body){let result;const start=performance.now();script.runInNewContext({$request:{url},$response:{body},$done:r=>{result=r;},console:{log() {}}},{timeout:2500});report.timings.push(performance.now()-start);if(!result)throw Error('done absent');return result.body??body;}
const normalize=s=>s.replace(/for_adm=(?:kkapp|ncat|happ)-v3-[a-f0-9]{12}/g,'for_adm=SITE_REVISION');
for(const [id,host] of [['kkapp','a.kkapp06.com'],['ncat','a.napp03.com:51111'],['happ','a.happ3.com:51111']]){
 const script=new vm.Script(fs.readFileSync(root+'/'+id+'/ad-clean.js','utf8')),baseline=new vm.Script(fs.readFileSync(path.join(args.baseline,id,'ad-clean.js'),'utf8'));const template=resolveMediaTemplate(manifest.templates.find(t=>t.id===id));
 const html='<title>'+profile.brands[id]+'</title><script src="static/v99999/js/app.ffffffff.js"></script><div id="app"></div>',tag=run(script,'https://'+host+'/',html).match(/for_adm=([^"&]+)/)[1],hash=tag.split('-').at(-1);
 const rules=profile.rules.map(r=>({...compile(r.before,r.after.replaceAll('{{siteId}}',id).replaceAll('__ADM_CACHE_REVISION__',hash)),guards:r.guards.map(g=>g.map(s=>s.replaceAll('{{appName}}',profile.brands[id]))),helper:r.helper}));
 for(const stage of ['before','current'])for(const file of files(path.join(stage==='before'?args.before:args.after,id))){
  const source=fs.readFileSync(file,'utf8');const url=stage==='current'?new URL(path.basename(file),JSON.parse(fs.readFileSync(root+'/tests/media-current-sources.json')).find(i=>i.template===id).url).href:JSON.parse(fs.readFileSync(root+'/universal/fixtures/'+id+'-0.json')).url.replace(/[^/]+$/,path.basename(file));
  const oldOut=run(baseline,url,source),out=run(script,url,source);
  if(normalize(oldOut)!==normalize(out))report.failures.push({id,stage,file:path.basename(file),type:'baseline differs'});else report.unchangedCompatibility++;
  try{new vm.Script(out);report.syntaxChecked++;}catch(e){report.failures.push({id,stage,file:path.basename(file),type:'syntax',message:e.message});}
  if(stage!=='current')continue;
  // Entire-site execution is not attempted: this is a syntax/structure mutation corpus.
  let future='',cursor=0,names=new Map();for(const t of tokenize(source)){if(t.name&&/^_0x[0-9a-f]+$/.test(t.name)){if(!names.has(t.name))names.set(t.name,'future'+names.size);future+=source.slice(cursor,t.start)+names.get(t.name);cursor=t.end;}}future+=source.slice(cursor);future=future.replace(/'appVersion':'[0-9.]+'/g,"'appVersion':'9.9.99'");
  const tokens=tokenize(future),index=indexTokens(tokens),edits=[],helpers=[];
  for(const rule of rules){if(!rule.guards.some(g=>g.every(s=>future.includes(s))))continue;const hits=findMatches(future,tokens,index,rule);edits.push(...hits);if(hits.length&&rule.helper&&!helpers.includes(rule.helper))helpers.push(rule.helper);}
  let expected;try{expected=applyEdits(future,edits);for(const helper of helpers)expected=template.jsHelpers[helper].source+'\n'+expected;}catch(e){report.failures.push({id,file:path.basename(file),type:'oracle conflict',message:e.message});continue;}
  const futureURL='https://'+host+'/static/v99999/js/'+(path.basename(file).startsWith('app')?(path.basename(file).includes('-legacy')?'app-legacy':'app'):path.basename(file).split('.')[0])+'.ffffffff.js';
  const actual=run(script,futureURL,future);
  if(actual!==expected)report.failures.push({id,file:path.basename(file),type:'synthetic differs',expectedEdits:edits.length,actualChanged:actual!==future});
  try{new vm.Script(actual);}catch(e){report.failures.push({id,file:path.basename(file),type:'synthetic syntax',message:e.message});}
  report.syntheticModules++;report.syntheticRanges+=new Set(edits.map(e=>e.start+':'+e.end)).size;
 }
 console.log(id,'done',report.failures.length,'failures',report.unchangedCompatibility,'actual',report.syntheticModules,'synthetic');
}
report.timings.sort((a,b)=>a-b);report.timingMs={median:+report.timings[Math.floor(report.timings.length/2)].toFixed(2),max:+report.timings.at(-1).toFixed(2)};delete report.timings;fs.writeFileSync(args.out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;
