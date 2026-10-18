import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {test} from 'node:test';import {auditModule} from '../scripts/audit-media-sites.mjs';
const root=new URL('../',import.meta.url).pathname;
test('auditing no applicable JS actions cannot claim PASS',()=>{assert.equal(auditModule('anything',[]).status,'NOT_RUN');assert.equal(auditModule('anything',[[0,{kind:'html'}]]).status,'NOT_RUN');});
test('missing offline module sources return PARTIAL and nonzero status',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adm-audit-'));try{const r=spawnSync(process.execPath,['scripts/audit-media-sites.mjs','--site=ncat','--source-dir='+dir],{cwd:root,encoding:'utf8'});assert.equal(r.status,2,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.sites[0].status,'PARTIAL');assert.ok(report.sites[0].counts.NOT_RUN>0);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unknown module requests and missing option values reject without network access',()=>{
 for(const options of [['--files=unknown.js'],['--files']]){const r=spawnSync(process.execPath,['scripts/audit-media-sites.mjs','--site=ncat','--source-dir=/tmp',...options],{cwd:root,encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/not registered|nonempty values/);}
});
test('offline audit uses the current module inventory and its new source actions',()=>{
 const info=JSON.parse(fs.readFileSync(path.join(root,'tests/media-current-sources.json'),'utf8')).find(i=>i.template==='ncat'&&i.file.startsWith('app.'));
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'universal/fixtures',info.fixture),'utf8'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adm-current-audit-'));
 try{
  fs.writeFileSync(path.join(dir,info.file),fixture.body);
  const r=spawnSync(process.execPath,['scripts/audit-media-sites.mjs','--site=ncat','--source-dir='+dir,'--files='+info.file],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,2,r.stderr);
  const site=JSON.parse(r.stdout).sites[0];
  assert.equal(site.status,'PARTIAL');
  assert.deepEqual(site.modules.map(m=>[m.file,m.status]),[[info.file,'PASS']]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
