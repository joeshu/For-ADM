import fs from 'node:fs';
import {build} from 'esbuild';
import {validateSiteManifest} from '../Web/source-contract.mjs';

const root = new URL('../', import.meta.url);
// App version is the single source of truth in package.json; it is injected
// into the web bundle at build time so the UI never hardcodes a version.
const version = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8')).version;
const siteText = fs.readFileSync(new URL('Web/sites.json', root), 'utf8').trim();
validateSiteManifest(JSON.parse(siteText));
fs.writeFileSync(new URL('Web/sites-data.mjs', root), 'export default ' + siteText + ';\n');
await build({
  entryPoints: [new URL('Web/app.mjs', root).pathname],
  bundle: true,
  format: 'iife',
  target: 'safari15',
  outfile: new URL('Web/app.js', root).pathname,
  minify: true,
  legalComments: 'eof',
  define: {'__SANYUAN_VERSION__': JSON.stringify(version)},
});
console.log('Built local app interface for iOS 15 WebKit');
await build({
  entryPoints: [new URL('Web/hls-cleaner.mjs', root).pathname],
  bundle: true,
  format: 'iife',
  globalName: 'SYHLS',
  target: 'safari15',
  outfile: new URL('Web/hls-cleaner.js', root).pathname,
  minify: true,
});
