import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const ids=['kkapp','ncat','happ','yqk','qntv','dyls','souju','kanju'];
const adapter=fs.readFileSync(path.join(root,'catvod-adapter.template.js'),'utf8');
for(const id of ids){
  const originalPath=path.join(root,'widget',id+'.js');
  if(!fs.existsSync(originalPath))throw new Error('missing widget source '+id);
  let source=fs.readFileSync(originalPath,'utf8');
  source=source
    .replace(/\bWidgetMetadata\b/g,'CCTVHostMetadata')
    .replace(/\bWidget\.http\b/g,'CCTVHttp')
    .replace(/\bWidget\.storage\b/g,'CCTVStorage')
    .replace(/\bWidget\.log\b/g,'console')
    .replace(/\bloadResource\b/g,'resolveResource');
  if(/\bWidgetMetadata\b|Widget\.http|Widget\.storage|(?:async\s+)?function\s+loadResource\s*\(/.test(source))
    throw new Error('legacy Widget importer markers remain in '+id);
  fs.writeFileSync(path.join(root,id+'.js'),source.trimEnd()+'\n\n'+adapter);
}
