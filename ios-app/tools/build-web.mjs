import fs from 'node:fs';import {build}from'esbuild';const root=new URL('../',import.meta.url);
fs.writeFileSync(new URL('Web/sites-data.mjs',root),'export default '+fs.readFileSync(new URL('Web/sites.json',root),'utf8').trim()+';\n');
await build({entryPoints:[new URL('Web/app.mjs',root).pathname],bundle:true,format:'iife',target:'safari15',outfile:new URL('Web/app.js',root).pathname,minify:true,legalComments:'eof'});console.log('Built local app interface for iOS 15 WebKit');
