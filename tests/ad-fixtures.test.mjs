import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {readJSON,fixtureChecks} from '../scripts/lib/ad-sites.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=readJSON(path.join(root,'universal/templates.json'));
const fixtures=fs.readdirSync(path.join(root,'universal/fixtures')).filter(p=>p.endsWith('.json')).map(p=>readJSON(path.join(root,'universal/fixtures',p)));
test('each registered template has a reusable playback protection fixture',()=>{
 for(const t of manifest.templates)assert(fixtures.some(f=>f.template===t.id),'Missing fixture for '+t.id);
});
for(const fixture of fixtures)test('fixture: '+fixture.template+' '+new URL(fixture.url).pathname,()=>{
 const t=manifest.templates.find(t=>t.id===fixture.template);assert(t,'Unknown fixture template');
 const unified=fs.readFileSync(path.join(root,'universal/ad-clean.js'),'utf8');
 const independent=fs.readFileSync(path.join(root,t.output.script),'utf8');
 assert.equal(fixtureChecks(unified,fixture),fixtureChecks(independent,fixture),'Unified and independent outputs differ');
});
