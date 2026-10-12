import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {test} from 'node:test';import {auditModule} from '../scripts/audit-media-sites.mjs';
const root=new URL('../',import.meta.url).pathname;
test('auditing no applicable JS actions cannot claim PASS',()=>{assert.equal(auditModule('anything',[]).status,'NOT_RUN');assert.equal(auditModule('anything',[[0,{kind:'html'}]]).status,'NOT_RUN');});
test('missing offline module sources return PARTIAL and nonzero status',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adm-audit-'));try{const r=spawnSync(process.execPath,['scripts/audit-media-sites.mjs','--site=ncat','--source-dir='+dir],{cwd:root,encoding:'utf8'});assert.equal(r.status,2,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.sites[0].status,'PARTIAL');assert.ok(report.sites[0].counts.NOT_RUN>0);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unknown module requests and missing option values reject without network access',()=>{
 for(const options of [['--files=unknown.js'],['--files']]){const r=spawnSync(process.execPath,['scripts/audit-media-sites.mjs','--site=ncat','--source-dir=/tmp',...options],{cwd:root,encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/not registered|nonempty values/);}
});
