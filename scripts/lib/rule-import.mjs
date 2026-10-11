import path from 'node:path';
export function validateSourcePath(file){
 if(typeof file!=='string'||path.isAbsolute(file)||file.split(/[\\/]/).some(s=>!s||s==='..'||s==='.')||!file.endsWith('.snippet'))throw Error('Invalid verbatim source path');
 return file;
}
export function parseRuleImport(text,expectedHosts){
 const rules=[],metadata=[];let hosts;const patterns=new Set();
 for(const [i,raw]of text.split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||line.startsWith('#')){if(line.startsWith('#!'))metadata.push(line);continue;}
  if(line.startsWith('hostname = ')){
   if(hosts)throw Error('Duplicate imported hostname line');hosts=line.slice(11).split(', ');continue;
  }
  const m=line.match(/^(\^\S+) url (reject-dict|script-response-body https:\/\/raw\.githubusercontent\.com\/[^\s]+)$/);
  if(!m)throw Error('Unsupported import line '+(i+1));new RegExp(m[1]);
  if(patterns.has(m[1]))throw Error('Duplicate imported URL pattern');patterns.add(m[1]);rules.push(raw);
 }
 if(!rules.length)throw Error('Empty imported rules');
 if(JSON.stringify(hosts)!==JSON.stringify(expectedHosts))throw Error('Verbatim MITM differs from manifest');
 return {lines:rules,metadata};
}
export function validateGeneratedRules(rules){
 const seen=new Set();for(const line of rules){const pattern=line.split(' url ')[0];if(seen.has(pattern))throw Error('Duplicate generated URL pattern: '+pattern);seen.add(pattern);}
}
