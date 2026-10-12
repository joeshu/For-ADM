import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadTemplateManifest} from '../scripts/lib/template-manifest.mjs';
const root=new URL('../',import.meta.url).pathname;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
test('split source expands to the generated audit manifest without unresolved references',()=>{
 const m=loadTemplateManifest(root);assert.deepEqual(m,read('universal/templates.json'));
 assert(!JSON.stringify(m).includes('"behavior":'));assert(!JSON.stringify(m).includes('{{v'));
});
test('every unified site group uses exactly its standalone rules and content revision',()=>{
 const conf=fs.readFileSync(path.join(root,'universal/quantumult-x-snippet.conf'),'utf8');
 for(const t of loadTemplateManifest(root).templates){
  const group=conf.split('# '+t.id+'\n')[1]?.split('\n\n')[0];assert.ok(group,t.id);
  const standalone=fs.readFileSync(path.join(root,t.output.conf),'utf8').split('\n').filter(s=>s.startsWith('^')).join('\n');assert.equal(group,standalone,t.id);
 }
 assert(!conf.includes('/universal/ad-clean.js?'));
});
function isolated(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adm-manifest-'));try{for(const p of ['manifest.json','templates','profiles'])fs.cpSync(path.join(root,'universal',p),path.join(dir,'universal',p),{recursive:true});fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('one shared download behavior edit expands to all three sites with distinct bindings',()=>isolated(dir=>{
 const p=path.join(dir,'universal/profiles/shared-media.json'),profile=JSON.parse(fs.readFileSync(p,'utf8'));profile.jsHelpers.download.source+='\n/* shared-change-test */';fs.writeFileSync(p,JSON.stringify(profile));
 const before=loadTemplateManifest(root),after=loadTemplateManifest(dir);
 for(const id of ['kkapp','ncat','happ']){const a=after.templates.find(t=>t.id===id),b=before.templates.find(t=>t.id===id);assert.ok(a.jsHelpers.download.source.includes('shared-change-test'));assert.deepEqual(a.bindings,b.bindings);assert.deepEqual(a.actions,b.actions);}
 assert.deepEqual(after.templates.find(t=>t.id==='dyls'),before.templates.find(t=>t.id==='dyls'));
}));
test('missing profiles, parameters, duplicate IDs and unsafe source paths fail closed',()=>{
 for(const mutation of [
  t=>{t.behaviorProfile='missing';},
  t=>{const a=t.actions.find(a=>a.behavior&&Object.keys(a.parameters).length);delete a.parameters[Object.keys(a.parameters)[0]];},
  t=>{const a=t.actions.find(a=>a.behavior);a.parameters.extra='_0x123';},
  t=>{const a=t.actions.find(a=>a.behavior);a.parameters[Object.keys(a.parameters)[0]]='evil()';},
 ])isolated(dir=>{const p=path.join(dir,'universal/templates/ncat.json'),t=JSON.parse(fs.readFileSync(p,'utf8'));mutation(t);fs.writeFileSync(p,JSON.stringify(t));assert.throws(()=>loadTemplateManifest(dir));});
 for(const files of [['../outside'],['ncat','ncat']])isolated(dir=>{const p=path.join(dir,'universal/manifest.json'),m=JSON.parse(fs.readFileSync(p,'utf8'));m.templateFiles=files;fs.writeFileSync(p,JSON.stringify(m));assert.throws(()=>loadTemplateManifest(dir));});
});
