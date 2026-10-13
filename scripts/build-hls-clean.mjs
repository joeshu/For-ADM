import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('hls-video/templates.json')),source=read('hls-video/src/stateful.js')+'\n'+read('hls-video/src/clean.js');
const ids=new Set();
for(const t of manifest.templates){
 if(typeof t.id!=='string'||ids.has(t.id))throw Error('Invalid or duplicate HLS policy ID');ids.add(t.id);
 new RegExp('^'+t.host+'$');new RegExp('^'+t.path);new RegExp(t.adPath);
 if(t.mode!==undefined&&t.mode!=='stateful-vod')throw Error('Unknown HLS mode');
 if(!t.path.startsWith('/')||!t.path.endsWith('$')||!Array.isArray(t.mitm)||!t.mitm.length||!(t.maxAdSeconds>0)||!(t.maxRemovedFraction>0&&t.maxRemovedFraction<1))throw Error('Invalid HLS policy');
 if(t.mode==='stateful-vod'){
  if(!Array.isArray(t.contentHosts)||!t.contentHosts.length||!t.contentPath||!t.contentPath.startsWith('^/')||!t.contentPath.endsWith('$')||!t.adPath.startsWith('^/')||!t.adPath.endsWith('$')||typeof t.allowPrefix!=='boolean'||typeof t.requireFollowingAES!=='boolean')throw Error('Invalid stateful HLS policy');
  t.contentHosts.forEach(h=>new RegExp('^'+h+'$'));new RegExp(t.contentPath);
 }
}
const revision=crypto.createHash('sha256').update(read('hls-video/templates.json')+source+read('scripts/build-hls-clean.mjs')).digest('hex').slice(0,12);
const banner='GENERATED experimental HLS cleaner; revision '+revision;
const url=manifest.rawBase+'/hls-video/ad-clean.js?v='+revision;
const patterns=manifest.templates.map(t=>'^https?://'+t.host+t.path);
const hosts=[...new Set(manifest.templates.flatMap(t=>t.mitm))];
const files=new Map([
 ['hls-video/ad-clean.js','/* '+banner+' */\n(function(){\n'+source+'\nadmHlsRun('+JSON.stringify(manifest.templates)+');\n})();\n'],
 ['hls-video/quantumult-x-snippet.conf','# '+banner+'\n# Optional: separate from webpage ad rules.\n[rewrite_local]\n'+manifest.templates.map(t=>'^https?://'+t.host+t.path+' url script-response-body '+url).join('\n')+'\n\n[mitm]\nhostname = '+[...new Set(manifest.templates.flatMap(t=>t.mitm))].join(', ')+'\n']
]);
files.set('hls-video/surge.sgmodule','#!name=For-ADM HLS 切片去广告\n#!desc=独立试用模块，按已登记特征清理 VOD\n[Script]\n'+patterns.map((p,i)=>'ForADM-HLS-'+i+' = type=http-response,pattern='+p+',script-path='+url+',requires-body=true,max-size=3145728,timeout=30').join('\n')+'\n\n[MITM]\nhostname = %APPEND% '+hosts.join(', ')+'\n');
files.set('hls-video/loon.plugin','#!name=For-ADM HLS 切片去广告\n#!desc=独立试用模块，按已登记特征清理 VOD\n[Script]\n'+patterns.map((p,i)=>'http-response '+p+' script-path='+url+', requires-body=true, timeout=30, tag=ForADM-HLS-'+i).join('\n')+'\n\n[Mitm]\nhostname = '+hosts.join(', ')+'\n');
for(const [p,body]of files){if(process.argv.includes('--check')){if(read(p)!==body)throw Error('Stale generated artifact: '+p);}else fs.writeFileSync(path.join(root,p),body);}
console.log('HLS artifacts '+(process.argv.includes('--check')?'verified':'generated')+', revision '+revision);
