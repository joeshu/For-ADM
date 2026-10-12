import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const args of [['scripts/build-ad-clean.mjs','--check'],['scripts/site-registry.mjs','--check'],['--test','tests/ad-clean.test.mjs','tests/ad-site-tools.test.mjs','tests/ad-fixtures.test.mjs','tests/ad-rule-import.test.mjs','tests/ad-guazi.test.mjs','tests/ad-yxxq.test.mjs','tests/ad-qlplayer.test.mjs','tests/ad-qingning.test.mjs','tests/ad-555.test.mjs','tests/ad-dyls.test.mjs','tests/ad-dyls-enhanced.test.mjs','tests/ad-dyls-v2.test.mjs','tests/ad-kkapp.test.mjs','tests/ad-kkapp-cards.test.mjs','tests/ad-kkapp-download.test.mjs','tests/ad-ncat.test.mjs','tests/ad-happ.test.mjs','tests/ad-ncat-leaks.test.mjs','tests/ad-ncat-download.test.mjs','tests/ad-download-cache.test.mjs','tests/ad-download-hardening.test.mjs','tests/ad-media-optimizations.test.mjs','tests/ad-diagnostic-history.test.mjs','tests/ad-host-pattern.test.mjs','tests/ad-parser-profiles.test.mjs']]){
 execFileSync(process.execPath,args,{cwd:root,stdio:'inherit'});
}
console.log('All webpage ad-clean checks passed. No network requests or HLS checks.');
