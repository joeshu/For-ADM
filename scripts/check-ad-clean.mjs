import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const args of [['scripts/build-ad-clean.mjs','--check'],['scripts/site-registry.mjs','--check'],['--test','tests/ad-clean.test.mjs','tests/ad-site-tools.test.mjs','tests/ad-fixtures.test.mjs']]){
 execFileSync(process.execPath,args,{cwd:root,stdio:'inherit'});
}
console.log('All webpage ad-clean checks passed. No network requests or HLS checks.');
