import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const sites=JSON.parse(fs.readFileSync(path.join(root,'../ios-app/Web/sites.json'),'utf8'));
const template=fs.readFileSync(path.join(root,'generic-site.template.js'),'utf8');
for(const id of ['kkapp','ncat','happ']){
  const site=sites.find(item=>item.id===id);
  if(!site)throw Error('missing source '+id);
  const source={id:site.id,name:site.name,origin:site.origin,version:site.version,appId:site.appId,signKey:site.signKey,responseKeys:site.responseKeys};
  fs.writeFileSync(path.join(root,id+'.js'),template.replace('__SOURCE__',JSON.stringify(source)));
}
