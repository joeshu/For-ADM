import fs from 'node:fs';import {build}from'esbuild';const root=new URL('../',import.meta.url);
fs.writeFileSync(new URL('Web/sites-data.mjs',root),'export default '+fs.readFileSync(new URL('Web/sites.json',root),'utf8').trim()+';\n');
await build({entryPoints:[new URL('Web/app.mjs',root).pathname],bundle:true,format:'iife',target:'safari15',outfile:new URL('Web/app.js',root).pathname,minify:true,legalComments:'eof'});console.log('Built local app interface for iOS 15 WebKit');
await build({entryPoints:[new URL('Web/hls-cleaner.mjs',root).pathname],bundle:true,format:'iife',globalName:'SYHLS',target:'safari15',outfile:new URL('Web/hls-cleaner.js',root).pathname,minify:true});
await build({entryPoints:[new URL('Node/fetch-entry.mjs',root).pathname],bundle:true,platform:'node',format:'cjs',target:'node18',outfile:new URL('Node/node-fetch.bundle.cjs',root).pathname,minify:true});
