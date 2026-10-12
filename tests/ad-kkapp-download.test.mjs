import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {test} from 'node:test';import {readJSON,runCleaner} from '../scripts/lib/ad-sites.mjs';
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url)),t=manifest.templates.find(t=>t.id==='kkapp'),sources=readJSON(new URL('./kkapp-download-sources.json',import.meta.url)),code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
test('KKAPP download ad init and dispatcher clear the overlay/timer while leaving genuine resources intact',()=>{
 for(const info of sources){let stopped=0;const visible={value:true},countdown={value:3},context=vm.createContext({[info.visible]:visible,[info.countdown]:countdown,[info.stop]:()=>{stopped++;}}),action=t.actions[info.action];vm.runInContext(action.pairs.map(p=>'var '+p[1]+';').join('\n'),context);
 const data={units:{type:'dhz',countdown:3,dhz:[{title:'promotion',url:'https://promo.example/'}]},magnets:[{quality:'1080P',items:[{id:'real-id',fileName:'film',fileSize:'1 GB'}]}],netdisk:[{name:'real-provider',url:'https://drive.example/file'}]},snapshot=JSON.stringify(data);
 context[info.functions[0]](data);assert.equal(visible.value,false);assert.equal(countdown.value,0);assert.equal(stopped,1);assert.equal(JSON.stringify(data),snapshot);
 visible.value=true;countdown.value=5;context[info.functions[1]]({},data.units);assert.equal(visible.value,false);assert.equal(countdown.value,0);assert.equal(stopped,2);assert.equal(JSON.stringify(data),snapshot);
 }
});
test('KKAPP download patches are source-guarded and do not affect malformed or error responses',()=>{
 for(const info of sources){const f=readJSON(new URL('../universal/fixtures/kkapp-download-'+info.action+'.json',import.meta.url)),action=t.actions[info.action],out=runCleaner(code,f.url,f.body);assert.notEqual(out,f.body);assert.equal(runCleaner(code,f.url,out),out);
 for(const marker of action.requires){const body=f.body.replaceAll(marker,'changed-marker');assert.equal(runCleaner(code,f.url,body),body);}
 for(const [old] of action.pairs)for(const body of [f.body.replace(old,'source-changed'),f.body+'\n'+old])assert.equal(runCleaner(code,f.url,body),body);
 for(const url of [f.url.replace('a.kkapp06.com','other.kkapp06.com'),f.url.replace('/static/v20514/js/','/unrelated/')])assert.equal(runCleaner(code,url,f.body),f.body);assert.equal(runCleaner(code,f.url,f.body,{statusCode:403}),f.body);
 }
});
