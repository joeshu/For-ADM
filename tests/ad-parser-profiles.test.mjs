import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveParserProfile,parserProfiles} from '../scripts/lib/parser-profiles.mjs';
import {readJSON,draftCode,fixtureChecks} from '../scripts/lib/ad-sites.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=readJSON(path.join(root,'universal/templates.json'));
test('Registered parser strategies resolve independently with unchanged runtime output',()=>{
 for(const id of ['qlplayer','qingning-player']){
  const t=manifest.templates.find(t=>t.id===id);assert(t.parserProfile);assert(!t.actions);
  const resolved=resolveParserProfile(t,manifest);assert(!resolved.parserProfile);assert(resolved.actions.length);
  const fixture=readJSON(path.join(root,'universal/fixtures',id==='qlplayer'?'qlplayer.json':'qingning-player-0.json'));
  const unified=fs.readFileSync(path.join(root,'universal/ad-clean.js'),'utf8');assert.equal(fixtureChecks(unified,fixture),fixtureChecks(draftCode(root,t),fixture));
  resolved.actions[0].requires[0]='mutated';assert.notEqual(resolveParserProfile(t,manifest).actions[0].requires[0],'mutated');
 }
});
test('Same profile can be reused on a new exact host while profile boundaries remain guarded',()=>{
 const original=manifest.templates.find(t=>t.id==='qlplayer');const copy=structuredClone(original);copy.id='fixture-parser';copy.bindings[0].domains.names=['parser.fixture.example'];
 const fixture=readJSON(path.join(root,'universal/fixtures/qlplayer.json'));fixture.template=copy.id;fixture.url=fixture.url.replace('svip.qlplayer.cyou','parser.fixture.example');fixtureChecks(draftCode(root,copy),fixture);
 for(const changed of [{...copy,parserProfile:'unknown'},{...copy,actions:[]},{...copy,adapter:'souju'},{...copy,bindings:[{domains:{type:'numbered'},routes:copy.bindings[0].routes}]},{...copy,bindings:[{domains:copy.bindings[0].domains,routes:[{kind:'json',path:'/api'}]}]}])assert.throws(()=>resolveParserProfile(changed,manifest));
 assert.throws(()=>parserProfiles({...manifest,parserProfiles:[...manifest.parserProfiles,manifest.parserProfiles[0]]}));
 assert.throws(()=>parserProfiles({parserProfiles:[{id:'bad',hosts:['*'],actions:[{}]}]}));
});
test('Draft tool reuses parser profile and rejects mismatched source before writing',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'parser-profile-draft-'));
 try{
  const fixture=readJSON(path.join(root,'universal/fixtures/qlplayer.json'));fs.writeFileSync(path.join(dir,'sample.js'),fixture.body);
  const spec={id:'fixture-parser',url:'https://parser.fixture.example/assets/player.js',kind:'js',sample:'sample.js',operation:'profile',parserProfile:'qlplayer',removed:fixture.removed,preserved:fixture.preserved};fs.writeFileSync(path.join(dir,'spec.json'),JSON.stringify(spec));
  execFileSync(process.execPath,['scripts/new-ad-site.mjs','--spec',path.join(dir,'spec.json'),'--out',path.join(dir,'draft')],{cwd:root,stdio:'pipe'});
  const generated=readJSON(path.join(dir,'draft/template.json'));assert.equal(generated.parserProfile,'qlplayer');assert.equal(generated.actions,undefined);assert.deepEqual(generated.bindings[0].domains.names,['parser.fixture.example']);
  fs.writeFileSync(path.join(dir,'sample.js'),fixture.body.replace('function showPreRoll()','function changed()'));
  assert.throws(()=>execFileSync(process.execPath,['scripts/new-ad-site.mjs','--spec',path.join(dir,'spec.json'),'--out',path.join(dir,'failed')],{cwd:root,stdio:'pipe'}));assert(!fs.existsSync(path.join(dir,'failed')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
