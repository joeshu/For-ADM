import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=fs.readdirSync(path.join(root,'tests')).filter(p=>/^ad-.*\.test\.mjs$/.test(p)).sort().map(p=>'tests/'+p);
if(!tests.length)throw Error('No ad-clean tests found');
for(const args of [['scripts/build-ad-clean.mjs','--check'],['scripts/site-registry.mjs','--check'],['--test',...tests]]){
 execFileSync(process.execPath,args,{cwd:root,stdio:'inherit'});
}
console.log('All webpage ad-clean checks passed. No network requests or HLS checks.');
