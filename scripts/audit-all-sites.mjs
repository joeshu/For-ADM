import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadTemplateManifest} from './lib/template-manifest.mjs';
import {resolveParserProfile} from './lib/parser-profiles.mjs';
import {fixtureChecks,runCleaner} from './lib/ad-sites.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
export function safeProbeURL(url){const u=new URL(url);return u.origin+u.pathname;}
export function summarizeProbes(probes){
 if(probes.some(p=>p.status==='CHANGED'))return 'CHANGED';
 const targets=probes.filter(p=>p.status!=='AVAILABLE');
 if(targets.length&&targets.every(p=>p.status==='PASS'))return 'PASS';
 if(probes.some(p=>p.status==='PASS'))return 'PARTIAL';
 return probes.some(p=>p.status==='UNAVAILABLE')?'UNAVAILABLE':'NOT_RUN';
}
function scriptsIn(body,base){const result=[];for(const m of body.matchAll(/["'`]([^"'`\s<>]+\.js(?:\?[^"'`\s<>]*)?)["'`]/g)){try{const u=new URL(m[1],base);if(/^https?:$/.test(u.protocol))result.push(u.href);}catch{}}return result;}
export async function auditAllSites(options={}){
 const manifest=loadTemplateManifest(root),registry=read('universal/sites.json').sites.filter(s=>s.status!=='pending'),unified=fs.readFileSync(path.join(root,'universal/quantumult-x-snippet.conf'),'utf8');
 const fixtures=fs.readdirSync(path.join(root,'universal/fixtures')).filter(p=>p.endsWith('.json')).map(p=>read('universal/fixtures/'+p));
 const records=manifest.templates.map(t=>{
  const code=fs.readFileSync(path.join(root,t.output.script),'utf8'),conf=fs.readFileSync(path.join(root,t.output.conf),'utf8'),rules=conf.split('\n').filter(l=>l.startsWith('^')),samples=fixtures.filter(f=>f.template===t.id),group=unified.split('# '+t.id+'\n')[1]?.split('\n\n')[0];
  if(!samples.length)throw Error('Missing fixture: '+t.id);for(const f of samples)fixtureChecks(code,f);
  if(group!==rules.join('\n'))throw Error('Unified/standalone route mismatch: '+t.id);
  if(!t.diagnostics)throw Error('Missing diagnostics: '+t.id);
  return {id:t.id,name:registry.find(s=>s.template===t.id)?.name||t.id,offline:'PASS',fixtures:samples.length,ruleCount:rules.length,script:t.output.script,bytes:Buffer.byteLength(code),revision:code.match(/revision ([a-f0-9]+)/)?.[1],diagnostics:true,online:'NOT_RUN',probes:[],_template:resolveParserProfile(t,manifest),_code:code,_rules:rules.map(l=>({re:new RegExp(l.split(' url ')[0])}))};
 });
 for(const r of manifest.requestRules||[]){if(!r.adapter)continue;const code=fs.readFileSync(path.join(root,r.output.script),'utf8');new vm.Script(code);const lines=fs.readFileSync(path.join(root,r.output.conf),'utf8').split('\n').filter(l=>l.startsWith('^'));if(!r.diagnostics||lines.some(l=>!unified.split('\n').includes(l)))throw Error('App routing/diagnostics mismatch: '+r.id);records.push({offlineScope:'路由、诊断登记与脚本语法；加密行为由全量 ad-guazi 回归核验',id:r.id,name:registry.find(s=>s.template===r.id)?.name||r.id,offline:'PASS',fixtures:null,ruleCount:fs.readFileSync(path.join(root,r.output.conf),'utf8').split('\n').filter(l=>l.startsWith('^')).length,script:r.output.script,bytes:Buffer.byteLength(code),revision:code.match(/revision ([a-f0-9]+)/)?.[1],diagnostics:r.diagnostics===true,online:'NOT_RUN',probes:[{status:'NOT_RUN',reason:'App 加密接口需要真实设备响应；未合成账号、签名或播放请求'}]});}
 const report={checkedAt:new Date().toISOString(),coverage:'全部已启用适配；编号域名使用登记样本，未遍历无限编号；线上源码核验不等于手机去广告验证',sites:records};
 if(!options.offline){
  const special=new Set(['dyls','kkapp','ncat','happ']);
  if(!options.skipSpecial){
   const invoke=(script,out)=>{const run=spawnSync(process.execPath,['scripts/'+script,'--out='+out],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});if(!fs.existsSync(out)||![0,1,2].includes(run.status)){const checkedAt=new Date().toISOString(),failed=id=>({id,status:'UNAVAILABLE',entryStatus:'UNAVAILABLE',entryError:'专用源码审计未完成',modules:[{status:'UNAVAILABLE',reason:'超时或进程失败；未判定通过'}],counts:{UNAVAILABLE:1}});return script==='audit-media-sites.mjs'?{checkedAt,sites:['kkapp','ncat','happ'].map(failed)}:{checkedAt,...failed('dyls')};}return JSON.parse(fs.readFileSync(out,'utf8'));};
   const temp=fs.mkdtempSync('/tmp/adm-all-audits-');try{const media=options.mediaReport?JSON.parse(fs.readFileSync(options.mediaReport,'utf8')):invoke('audit-media-sites.mjs',path.join(temp,'media.json'));for(const s of media.sites){const r=records.find(r=>r.id===s.id);r.checkedAt=media.checkedAt;r.online=s.status;r.probes=[{status:s.entryStatus,url:s.entry},...s.modules];r.moduleCounts=s.counts;options.progress?.(s.id,s.status);}
    const dyls=options.dylsReport?JSON.parse(fs.readFileSync(options.dylsReport,'utf8')):invoke('audit-dyls-site.mjs',path.join(temp,'dyls.json'));const r=records.find(r=>r.id==='dyls');r.checkedAt=dyls.checkedAt;r.online=dyls.status;r.probes=[{status:dyls.entryStatus,url:'https://dyls1.mbxqnb.cn/'},...dyls.modules];r.moduleCounts=dyls.counts;options.progress?.('dyls',dyls.status);
   }finally{fs.rmSync(temp,{recursive:true,force:true});}
  }
  const extras={juyeye:['https://www.juyeye.cc/'],ycblcw:['https://www.ycblcw.com/dedg/cs13341.js'],eboyang:['https://www.eboyang.com/dedg/le1008.js'],auete:['tbxf','tbtl','tlbf','dibu','dbtl'].map(n=>'https://www.au1080.top/js/mcenter/'+n+'.js'),'qlplayer':['https://svip.qlplayer.cyou/assets/player.js'],'555-movie':['https://eliteres.fanruan.com/office/2026/09/24/5217868f-8244-4d9f-8eae-1028bcc2c2a7.js']};
  const tasks=records.filter(r=>r._template&&!special.has(r.id));let cursor=0;
  await Promise.all(Array.from({length:6},async()=>{while(cursor<tasks.length){const r=tasks[cursor++],site=registry.find(s=>s.template===r.id),queue=[...(site?.testUrls||[]),...(extras[r.id]||[])],seen=new Set();
   for(let at=0;at<queue.length&&at<32;at++){
    const url=queue[at];if(/\.(?:m3u8|mp4|mpd|ts|m4s|aac)(?:$|[?#])/i.test(new URL(url).pathname))continue;if(seen.has(url))continue;seen.add(url);const probe={url:safeProbeURL(url),status:'NOT_RUN'};r.probes.push(probe);
    try{const response=await fetch(url,{signal:AbortSignal.timeout(options.timeout||15000)});probe.httpStatus=response.status;if(!response.ok){probe.status='UNAVAILABLE';probe.reason='HTTP '+response.status;continue;}const body=await response.text();probe.sha256=crypto.createHash('sha256').update(body).digest('hex');
     const route=r._rules.find(b=>b.re.test(url));const kind=route?(new URL(url).pathname.endsWith('.js')?'js':r._template.bindings.flatMap(b=>b.routes).find(p=>new RegExp('^'+p.path,'i').test(new URL(url).pathname+new URL(url).search))?.kind):null;
     if(route){const headers=Object.fromEntries(response.headers.entries()),out=runCleaner(r._code,url,body,{statusCode:response.status,headers});
      if(out!==body){if(runCleaner(r._code,url,out,{statusCode:response.status,headers})!==out)throw Error('Repeated rewrite differs');if(kind==='js'){try{new vm.Script(out);}catch{const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:out,encoding:'utf8'});if(check.status!==0)throw Error('Patched JavaScript syntax failed');}}probe.status='PASS';probe.reason='完整指纹命中，重写及重复执行通过';}
      else{probe.status=kind==='js'&&!/html|json|xml/i.test(response.headers.get('content-type')||'')&&!/^(?:\s|<!--[\s\S]*?-->)*<(?:!doctype|html)/i.test(body)?'CHANGED':'NOT_RUN';probe.reason=probe.status==='CHANGED'?'已登记 JS 未命中现有替换，需源码复核':'未取得可验证的广告结构或需要真实播放参数';}
     }else{probe.status='AVAILABLE';probe.reason='入口可访问，已继续寻找登记脚本；此入口本身不经过重写';}
     if(!/json/i.test(response.headers.get('content-type')||''))for(const target of scriptsIn(body,response.url||url)){if(r._rules.some(b=>b.re.test(target))&&new URL(target).pathname.endsWith('.js')&&!seen.has(target)&&!queue.includes(target))queue.push(target);}
    }catch(e){probe.status='UNAVAILABLE';probe.reason=e.name==='TimeoutError'?'请求超时':String(e.message).includes('syntax')?'语法核验失败':'网络或响应核验失败';}
   }
   r.online=summarizeProbes(r.probes);options.progress?.(r.id,r.online);
  }}));
 }
 for(const r of records)for(const key of Object.keys(r))if(key.startsWith('_'))delete r[key];
 report.counts={offline:{},online:{}};for(const r of records){report.counts.offline[r.offline]=(report.counts.offline[r.offline]||0)+1;report.counts.online[r.online]=(report.counts.online[r.online]||0)+1;}
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(s=>{const [k,...v]=s.replace(/^--/,'').split('=');return[k,v.join('=')||true];}));if(Object.keys(args).some(k=>!['offline','out','media-report','dyls-report'].includes(k)))throw Error('Use --offline --out=FILE --media-report=FILE --dyls-report=FILE');
 const report=await auditAllSites({offline:!!args.offline,mediaReport:args['media-report'],dylsReport:args['dyls-report'],progress:(id,status)=>console.error(id+': '+status)});const output=JSON.stringify(report,null,2)+'\n';if(args.out)fs.writeFileSync(args.out,output);console.log(output);if(report.sites.some(s=>s.online==='CHANGED'))process.exitCode=1;else if(!args.offline&&report.sites.some(s=>s.online!=='PASS'))process.exitCode=2;
}
