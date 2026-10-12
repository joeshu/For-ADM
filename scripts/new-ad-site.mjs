import {loadTemplateManifest} from './lib/template-manifest.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readJSON,escapeRE,draftCode,fixtureChecks} from './lib/ad-sites.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('node scripts/new-ad-site.mjs --spec /path/site.json [--out /path/draft]\nOffline only. Generates a checked draft; never modifies active templates or domains. See universal/EXTENDING.md.');process.exit(0);
}
const options={};
for(let i=0;i<args.length;i+=2){assert(['--spec','--out'].includes(args[i])&&args[i+1]&&!options[args[i]],'Expected --spec file [--out directory]');options[args[i]]=args[i+1];}
assert(options['--spec'],'Missing --spec; use --help');
const specPath=path.resolve(options['--spec']),spec=readJSON(specPath);
assert(/^[a-z0-9][a-z0-9-]*$/.test(spec.id),'Invalid ID');
const manifest=loadTemplateManifest(root);
assert(!manifest.templates.some(t=>t.id===spec.id),'Template ID already registered; reuse its existing binding instead');
const url=new URL(spec.url);
assert(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.port,'Expected HTTP(S) URL without credentials or port');
assert(/^[a-z0-9.-]+$/.test(url.hostname)&&!url.hostname.includes('..'),'Invalid hostname');
assert(['html','js','json'].includes(spec.kind),'Invalid kind');
assert(!/\.(?:m3u8|ts|m4s|mp4|mpd|aac)(?:$|\/)/i.test(url.pathname),'Media routes are not supported');
const body=fs.readFileSync(path.resolve(path.dirname(specPath),spec.sample),'utf8');
const requires=spec.requires;
if(!spec.parserProfile)assert(Array.isArray(requires)&&requires.length&&requires.every(s=>typeof s==='string'&&s&&body.includes(s)),'Source fingerprint(s) must exist in sample');
const t={id:spec.id,adapter:'declarative',output:{script:spec.id+'/ad-clean.js',conf:spec.id+'/quantumult-x-snippet.conf'},bindings:[{domains:{type:'exact',names:[url.hostname]},routes:[{kind:spec.kind,path:escapeRE(url.pathname)+'(?:\\?.*)?$'}]}]};
const action={kind:spec.kind,requires};
if(spec.parserProfile){
 assert(spec.operation==='profile'&&!spec.target&&!spec.replacement&&!spec.requires,'Profile reuse takes fingerprints and actions from the registered profile');
 t.parserProfile=spec.parserProfile;
}else if(spec.kind==='html'){
 assert(['container','script'].includes(spec.operation),'HTML operation must be container or script');
 if(spec.operation==='container'){
  assert(/^[a-z][a-z0-9-]*$/.test(spec.tag||'div')&&typeof spec.target==='string'&&/^\S+$/.test(spec.target),'Expected tag and one exact class token');
  action.selector={tag:spec.tag||'div',attr:'class',token:spec.target};
 }else{
  assert(typeof spec.target==='string'&&spec.target,'Expected exact ad script src');
  action.selector={tag:'script',attr:'src',exact:spec.target};
 }
 action.op='removeElements';t.actions=[action];
}else if(spec.kind==='js'){
 assert(spec.operation==='replace','JS operation must be replace');
 assert(typeof spec.target==='string'&&spec.target&&typeof spec.replacement==='string'&&spec.target!==spec.replacement,'Expected source and replacement strings');
 const count=spec.count??1;assert(Number.isInteger(count)&&count>0,'Expected positive replacement count');
 assert.equal(body.split(spec.target).length-1,count,'JS source count differs from expected count');
 action.op='replaceGroup';action.pairs=[[spec.target,spec.replacement,count]];t.actions=[action];
}else{
 assert(spec.operation==='clearArray','JSON scaffold supports clearArray in a result:true/data envelope');
 assert(typeof spec.target==='string'&&/^data(?:\.[a-zA-Z_$][\w$]*)+$/.test(spec.target)&&!spec.target.split('.').some(p=>['__proto__','constructor','prototype'].includes(p)),'Expected explicit data.field path');
 const sample=JSON.parse(body);assert.equal(sample.result,true,'Expected result:true envelope');
 t.jsonPolicies=[{endpoint:'^'+escapeRE(url.pathname)+'$',when:{path:spec.target,type:'array'},ops:[{op:'clearArray',path:spec.target}]}];
 // All declared JSON fingerprints are checked on the original raw response.
 t.jsonRequires=requires;
}
const fixture={template:spec.id,url:url.href,body,removed:spec.removed,preserved:spec.preserved};
const cleaned=fixtureChecks(draftCode(root,t),fixture);
if(spec.kind==='js')execFileSync(process.execPath,['--check','--input-type=module'],{input:cleaned,stdio:['pipe','pipe','pipe']});
const entry={id:spec.id,name:spec.name||spec.id,template:null,status:'pending',releasePages:spec.releasePages||[],testUrls:[url.href],notes:'草稿样本通过；尚未加入正式规则或完成设备测试。'};
for(const value of entry.releasePages)assert(['http:','https:'].includes(new URL(value).protocol));
const dest=path.resolve(options['--out']||path.join(root,'universal/drafts',spec.id));
assert(!fs.existsSync(dest),'Refusing to overwrite an existing draft');
fs.mkdirSync(dest,{recursive:true});
for(const [name,value]of Object.entries({'template.json':t,'site.json':entry,'fixture.json':fixture}))fs.writeFileSync(path.join(dest,name),JSON.stringify(value,null,2)+'\n');
fs.writeFileSync(path.join(dest,'README.md'),'# '+spec.id+' 草稿\n\n样本已通过广告删除、播放内容保留、幂等性、未知域名及错误响应检查。仅覆盖 '+url.hostname+' 的精确路径，不自动添加 www、子域名、哈希文件族或媒体规则。\n\n1. 确认样本已去除账号、令牌及私人内容；检查 template.json 的域名、路径和广告特征。\n2. 将模板保存到 universal/templates/模板ID.json，并将模板 ID 追加到 universal/manifest.json 的 templateFiles，将 site.json 改为 source-verified 并设置 template 为模板 ID，再追加到 universal/sites.json 的 sites。\n3. 将 fixture.json 复制到 universal/fixtures/'+spec.id+'.json。\n4. 运行 node scripts/build-ad-clean.mjs 和 node scripts/site-registry.mjs，再运行 node scripts/check-ad-clean.mjs。\n5. 手机端验证首页、播放、选集和切换线路后才标为 device-verified。\n\n草稿不会自动启用或发布。\n');
console.log('Checked draft created: '+dest+'; active rules unchanged');
