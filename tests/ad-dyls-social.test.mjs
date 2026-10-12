import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const t=readJSON(new URL('../universal/templates.json',import.meta.url)).templates.find(t=>t.id==='dyls');
const action=t.actions.find(a=>a.requires.includes('social-immersive-ad-panel'));
const url='https://dyls1.mbxqnb.cn/assets/social-CZSyTrLH.js';
const original=action.requires.join(';');
test('social feed excludes image and video promotions while retaining video and audio posts',()=>{
 const out=runCleaner(code,url,original);assert.notEqual(out,original);assert.equal(runCleaner(code,url,out),out);
 const context=vm.createContext({});vm.runInContext(out.split(';').filter(s=>s.startsWith('function ')).join(';'),context);
 for(const ad of [{type:'ads',file_type:'image'},{type:'ads',file_type:'video'},{ads_info:{jump_url:'https://5432.com'},file_type:'audio'}])assert.equal(context.B(ad),false);
 for(const post of [{file_type:'video'},{file_type:'audio',ads_info:null}])assert.equal(context.B(post),true);
 assert.equal(context.B(null),false);
});
test('social source mismatch preserves input; route supports query parameters',()=>{
 assert.equal(runCleaner(code,url,original.replace('social-immersive-ad-cta','unknown')),original.replace('social-immersive-ad-cta','unknown'));
 assert.notEqual(runCleaner(code,url+'?probe=1',original),original);
 assert.equal(runCleaner(code,url.replace('social-','unknown-'),original),original);
});
test('social module shares targeted worker cache protection',()=>{
 const action=t.actions.find(a=>a.requires.includes('DylsWarmAdImages')&&a.requires.includes('runtime-assets'));
 assert.ok(action.pairs[0][1].includes('|social)'));
 assert.ok(action.pairs[0][1].includes('for-adm-dyls-js-v2-__ADM_CACHE_REVISION__'));
});
