import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('hls-video/templates.json')),source=read('hls-video/src/clean.js');
for(const t of manifest.templates){new RegExp('^'+t.host+'$');new RegExp('^'+t.path);new RegExp(t.adPath);if(!t.path.startsWith('/')||!(t.maxAdSeconds>0)||!(t.maxRemovedFraction>0&&t.maxRemovedFraction<1))throw Error('Invalid HLS policy');}
const revision=crypto.createHash('sha256').update(read('hls-video/templates.json')+source+read('scripts/build-hls-clean.mjs')).digest('hex').slice(0,12);
const banner='GENERATED experimental HLS cleaner; revision '+revision;
const url=manifest.rawBase+'/hls-video/ad-clean.js?v='+revision;
const files=new Map([
 ['hls-video/ad-clean.js','/* '+banner+' */\n(function(){\n'+source+'\nadmHlsRun('+JSON.stringify(manifest.templates)+');\n})();\n'],
 ['hls-video/quantumult-x-snippet.conf','# '+banner+'\n# Optional: separate from webpage ad rules.\n[rewrite_local]\n'+manifest.templates.map(t=>'^https?://'+t.host+t.path+' url script-response-body '+url).join('\n')+'\n\n[mitm]\nhostname = '+[...new Set(manifest.templates.flatMap(t=>t.mitm))].join(', ')+'\n']
]);
for(const [p,body]of files){if(process.argv.includes('--check')){if(read(p)!==body)throw Error('Stale generated artifact: '+p);}else fs.writeFileSync(path.join(root,p),body);}
console.log('HLS artifacts '+(process.argv.includes('--check')?'verified':'generated')+', revision '+revision);
