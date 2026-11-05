import {test} from 'node:test';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const run=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
// The three Web bundles are build products, not committed source: build:web
// must regenerate them from the .mjs sources + sites.json on any checkout.
test('build:web regenerates app.js, hls-cleaner.js and sites-data.mjs',async()=>{
 await run(process.execPath,['tools/build-web.mjs'],{cwd:root});
 const app=fs.readFileSync(path.join(root,'Web/app.js'),'utf8');
 assert.ok(app.includes(version),`app.js must embed version ${version}`);
 assert.ok(!app.includes('__SANYUAN_VERSION__'),'no version placeholder may survive the build');
 const cleaner=fs.readFileSync(path.join(root,'Web/hls-cleaner.js'),'utf8');
 assert.ok(cleaner.includes('SYHLS'),'hls-cleaner.js must expose the SYHLS global');
 const sitesText=fs.readFileSync(path.join(root,'Web/sites-data.mjs'),'utf8');
 assert.ok(sitesText.startsWith('export default '),'sites-data.mjs must be an ES module default export');
 const sites=JSON.parse(sitesText.replace(/^export default /,'').replace(/;\s*$/,''));
 assert.ok(Array.isArray(sites)&&sites.length>0,'sites-data.mjs must carry the site manifest');
 for(const site of sites)assert.ok(typeof site.id==='string'&&site.id.length,'each site needs an id');
});
