import fs from 'node:fs';import {build}from'esbuild';import {validateSiteManifest}from'../Web/source-contract.mjs';const root=new URL('../',import.meta.url),siteText=fs.readFileSync(new URL('Web/sites.json',root),'utf8').trim();
validateSiteManifest(JSON.parse(siteText));
fs.writeFileSync(new URL('Web/sites-data.mjs',root),'export default '+siteText+';\n');
await build({entryPoints:[new URL('Web/app.mjs',root).pathname],bundle:true,format:'iife',target:'safari15',outfile:new URL('Web/app.js',root).pathname,minify:true,legalComments:'eof'});console.log('Built local app interface for iOS 15 WebKit');
await build({entryPoints:[new URL('Web/hls-cleaner.mjs',root).pathname],bundle:true,format:'iife',globalName:'SYHLS',target:'safari15',outfile:new URL('Web/hls-cleaner.js',root).pathname,minify:true});
