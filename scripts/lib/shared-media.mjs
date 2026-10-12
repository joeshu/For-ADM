import fs from 'node:fs';
const sourceURL=new URL('../../universal/src/shared-media-cards.js',import.meta.url);
export function resolveMediaTemplate(template){
 const entries=Object.entries(template.jsHelpers||{});if(!entries.some(([,h])=>h.profile))return template;
 const helpers={...template.jsHelpers};
 for(const [key,h] of entries){if(!h.profile)continue;if(h.profile!=='shared-media'||key!=='cards'||h.marker!=='function __forAdmKKCleanV2('||!Array.isArray(h.allowedHosts)||!h.allowedHosts.length||Object.keys(h).some(k=>!['marker','profile','allowedHosts'].includes(k)))throw Error('Invalid shared media helper');for(const p of h.allowedHosts){if(typeof p!=='string'||!p)throw Error('Invalid media allowlist');new RegExp('^'+p+'$');}helpers[key]={marker:h.marker,source:'var __forAdmMediaAllowedHosts='+JSON.stringify(h.allowedHosts)+';\n'+fs.readFileSync(sourceURL,'utf8').trimEnd()};}
 return {...template,jsHelpers:helpers};
}
