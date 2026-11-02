import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {playbackURLs} from '../Web/model.mjs';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../Resources/Hongguo/hgtv.js',import.meta.url),'utf8');
function load(root,extra={}){
 const context={require,Buffer,URL,module:{exports:{}},process:{cwd:()=>root},setTimeout,clearTimeout,console,...extra};
 vm.runInNewContext(source+'\nmodule.exports.__test={decryptCenc,verifyMp4,deriveContentKey};',context);
 return context;
}
function encodedKey(key){
 const plain=Buffer.from('x'+key+'x'),raw=Buffer.alloc(plain.length+1);let a=85,b=246;
 for(let i=0;i<plain.length;i++){let pop=0;for(let x=i;x;x>>=1)pop+=x&1;const old=((plain[i]+21+pop)&255)^(i&1?a:b);raw[i+1]=old;if(i&1)a=old;else b=old;}
 raw[0]=raw[1]^raw[2];return raw.toString('base64');
}
test('Hongguo native backend decrypts owned CENC fixture and returns file ranges',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sanyuan-hg-'));
 try{
 const encrypted=fs.readFileSync(new URL('fixtures/hongguo-cenc.mp4',import.meta.url));
 const key='000102030405060708090a0b0c0d0e0f',spade=encodedKey(key);
 const model={video_list:{one:{main_url:'https://media.invalid/fixture',definition:'360p',vwidth:160,vheight:90,encrypt_info:{encrypt:true,spade_a:spade}}}};
 const c=load(root,{__fixtureModel:model,__fixtureBytes:encrypted});
 assert.equal(c.module.exports.__test.deriveContentKey(spade).toString('hex'),key);
 c.__modelCalls=0;vm.runInNewContext('fetchModel=async()=>{__modelCalls++;return __fixtureModel;};httpText=async()=>({status:200,body:__fixtureBytes});',c);
 const response=await c.module.exports.localProxy({url:'cenc://123?q=360p',method:'GET',headers:{Range:'bytes=0-31'}});
 assert.equal(response[0],206,JSON.stringify(response));assert.equal(response[1]['Content-Length'],'32');
 const descriptor=response[2];assert.equal(descriptor.__cctvhostFileResponse,true);assert.equal(descriptor.offset,0);assert.equal(descriptor.length,32);
 assert.ok(c.module.exports.__test.verifyMp4(descriptor.path));
 const decode=spawnSync('ffmpeg',['-v','error','-xerror','-i',descriptor.path,'-f','null','-'],{timeout:10000});
 if(decode.error?.code!=='ENOENT')assert.equal(decode.status,0,decode.stderr?.toString());
 const cached=await c.module.exports.play('官网完整播放','1~123');assert.equal(cached.url,'cenc://123?q=360p');assert.equal(c.__modelCalls,1,'cached media must not require a fresh remote model');
 const head=await c.module.exports.localProxy({url:'cenc://123?q=360p',method:'HEAD'});assert.equal(head[0],200);
 const invalid=await c.module.exports.localProxy({url:'cenc://123?q=360p',headers:{Range:'bytes=999999999-'}});assert.equal(invalid[0],416);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('only marked app-local media addresses survive playback normalization',()=>{
 const url='http://127.0.0.1:12345/hongguo/1234-ABCD.mp4';
 assert.equal(playbackURLs({playUrls:[{url}]}).length,0);
 assert.equal(playbackURLs({playUrls:[{url,localPrepared:true}]}).length,1);
 assert.equal(playbackURLs({playUrls:[{url:url.replace('127.0.0.1','192.168.1.1'),localPrepared:true}]}).length,0);
});

test('model signing uses the authenticated native HTTPS transport when supplied',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sanyuan-model-'));const requests=[];
 try{
  const global={_sanyuanHTTPS:async(url,options)=>{requests.push({url,options});return {status:200,body:Buffer.from(JSON.stringify({code:0,data:{'123':{video_model:{video_list:{one:{main_url:'https://media.invalid/video',definition:'360p'}}}}}}))};}};
  const c=load(root,{global});vm.runInNewContext("httpText=async()=>{throw Error('unexpected Node networking');};",c);
  const result=await c.module.exports.play('官网完整播放','1~123');assert.equal(result.url,'cenc://123?q=360p');assert.equal(requests.length,1);
  const request=requests[0];assert.equal(request.options.method,'POST');assert.equal(new URL(request.url).hostname,'api5-normal-sinfonlineb.fqnovel.com');
  assert.equal(JSON.parse(request.options.body.toString()).mixed_video_id_map['1004'][0],'123');
  assert.match(request.options.headers['x-gorgon'],/^[a-f0-9]+$/);assert.ok(request.options.headers['x-helios']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a protected video track without auxiliary tables is rejected instead of producing audio-only playback',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sanyuan-invalid-'));
 try{
  const bytes=fs.readFileSync(new URL('fixtures/hongguo-cenc.mp4',import.meta.url));const at=bytes.indexOf('saio');assert.ok(at>0);bytes.write('free',at,'ascii');
  const src=path.join(root,'invalid.mp4'),dst=path.join(root,'output.mp4');fs.writeFileSync(src,bytes);
  const c=load(root);assert.throws(()=>c.module.exports.__test.decryptCenc(src,dst,Buffer.from('000102030405060708090a0b0c0d0e0f','hex')),/missing encryption tables/);assert.equal(fs.existsSync(dst),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('an empty native model response can recover through the original Node transport',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sanyuan-model-fallback-'));
 try{
  let nativeCalls=0;const model={code:0,data:{'123':{video_model:{video_list:{one:{main_url:'https://media.invalid/video',definition:'360p'}}}}}};
  const global={_sanyuanHTTPS:async()=>{nativeCalls++;return {status:200,body:Buffer.alloc(0)};}};
  const c=load(root,{global,__model:model});c.nodeCalls=0;
  vm.runInNewContext("httpText=async()=>{nodeCalls++;return {status:200,body:Buffer.from(JSON.stringify(__model))};};",c);
  const result=await c.module.exports.play('官网完整播放','1~123');assert.equal(result.url,'cenc://123?q=360p');assert.equal(nativeCalls,1);assert.equal(c.nodeCalls,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
