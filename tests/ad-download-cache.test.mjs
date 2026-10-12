import fs from 'node:fs';import assert from 'node:assert/strict';import {test} from 'node:test';import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8'),templates=readJSON(new URL('../universal/templates.json',import.meta.url)).templates;
for(const [id,host,version,hash] of [['kkapp','a.kkapp06.com','20514','ef89c5cb'],['ncat','a.napp03.com:51111','20529','e102418a']])test(id+' download direct entries refresh only main scripts with the same chunk revision',()=>{
 const t=templates.find(t=>t.id===id),title=id==='kkapp'?'可可影视':'网飞猫',html='<title>'+title+'</title><script src="static/v'+version+'/js/app.'+hash+'.js"></script><script src="static/v'+version+'/js/chunk-vendors.12345678.js"></script><div id="app"></div>';
 let tag;for(const path of ['/?_c=test','/vod/magnets?id=film','/vod/magnet/detail?magnetId=real']){const out=runCleaner(code,'https://'+host+path,html);assert.notEqual(out,html);const m=out.match(/for_adm=([^"&]+)/);assert.ok(m);tag=m[1];assert.ok(out.includes('src="static/v'+version+'/js/chunk-vendors.12345678.js"'));assert.equal(runCleaner(code,'https://'+host+path,out),out);}
 for(const a of t.actions.filter(a=>a.kind==='js'&&a.pairs?.some(p=>p[1].includes('for_adm=')))){const input='/* '+a.requires.join(' ; ')+' */'+a.pairs[0][0];assert.ok(runCleaner(code,'https://'+host+'/static/v'+version+'/js/app.'+hash+'.js',input).includes('for_adm='+tag));}
 assert.equal(runCleaner(code,'https://'+host+'/api/unknown',html),html);
});
