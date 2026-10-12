import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {test} from 'node:test';import {runCleaner} from '../scripts/lib/ad-sites.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('guazi-app/upstream/TilingSales_getNav.js');
const priv=[...source.match(/var PRIV = ([\s\S]*?);/)[1].matchAll(/'([^']*)'/g)].map(m=>m[1].replaceAll('\\n','\n')).join('');
const key='12345678901234567890123456789012',iv='1234567890123456';
const keys=crypto.publicEncrypt({key:crypto.createPublicKey(priv),padding:crypto.constants.RSA_PKCS1_PADDING},Buffer.from(JSON.stringify({key,iv}))).toString('base64');
function cipher(obj){const c=crypto.createCipheriv('aes-256-cbc',Buffer.from(key),Buffer.from(iv));return Buffer.concat([c.update(JSON.stringify(obj),'utf8'),c.final()]).toString('hex').toUpperCase();}
function envelope(obj){return JSON.stringify({code:200,msg:'请求成功',data:{keys,response_key:cipher(obj),keep:'unchanged'},other:'keep'});}
function plain(body){const r=JSON.parse(body);assert.equal(r.data.keys,keys);assert.equal(r.other,'keep');assert.equal(r.data.keep,'unchanged');const d=crypto.createDecipheriv('aes-256-cbc',Buffer.from(key),Buffer.from(iv));return JSON.parse(Buffer.concat([d.update(Buffer.from(r.data.response_key,'hex')),d.final()]).toString());}
const unified=read('universal/ad-clean.js'),standalone=read('guazi-app/ad-clean.js');
const url=p=>'https://api.mxtxqe.com'+p;
function both(path,body){assert.equal(runCleaner(unified,url(path),body),body);const a=runCleaner(standalone,url(path),body);assert.equal(runCleaner(standalone,url(path),a),a);return a;}
test('Guazi RSA/AES round trips preserve all six upstream transformations',()=>{
 assert.deepEqual(plain(both('/App/Resource/Config/getNav',envelope([{type:'vod',id:1},{type:'read'},{type:'game'},{type:'micro'},{type:'music'}]))),[{type:'vod',id:1}]);
 for(const [path,out]of [['/App/Ad/barsPlayAdInfo',[]],['/App/Ad/playAdInfo',{}],['/App/IndexPlay/vodAdvertisement',[]]])assert.deepEqual(plain(both(path,envelope({ad:'fixture'}))),out);
 const detail=plain(both('/App/Resource/Vod/showOne',envelope({vip:'1',vip_btn:'buy',hdr_tag:'vip',top_tag:'vip',show_type:'1',movie:'keep',vurl_clouds:[{id:1,url:'keep.m3u8'},{state:1},{name:'invalid'}]})));
 assert.equal(detail.vip,'0');assert.equal(detail.vip_btn,'');assert.equal(detail.hdr_tag,'');assert.equal(detail.top_tag,'');assert.equal(detail.show_type,'0');assert.equal(detail.collect_id,'0');assert.equal(detail.collected,'0');assert.equal(detail.movie,'keep');assert.deepEqual(detail.vurl_clouds,[{id:1,url:'keep.m3u8'},{state:1}]);
 const list=plain(both('/App/Resource/Vod/vurlDetail?vid=1',envelope([{name:'会员720P',resolution:'720P',url:'one'},{name:'付费1080P',resolution:'1080p',url:'two'}])));
 assert.deepEqual(list,[{name:'1080P',resolution:'1080',url:'two'},{name:'720P',resolution:'720',url:'one'}]);
});
test('Guazi invalid ciphertext, auth errors, HTML and unrelated interfaces pass through',()=>{
 const body=envelope({keep:'all'}),path='/App/Resource/Vod/showOne';
 for(const p of ['/App/Resource/AppUserVod/showOne','/other','/movie.m3u8',path+'Extra'])assert.equal(runCleaner(standalone,url(p),body),body);
 for(const s of ['<html>error</html>','{}','{"code":200,"data":{"keys":"invalid","response_key":"00"}}',body.replace('"code":200','"code":403')])assert.equal(both(path,s),s);
 for(const statusCode of [401,403,500])assert.equal(runCleaner(standalone,url(path),body,{statusCode}),body);
 // Original snippet matches any hostname: retain it when QX decrypts a matching API URL.
 assert.deepEqual(plain(runCleaner(standalone,'https://another-host.example/App/Ad/barsPlayAdInfo',body)),[]);
 assert.equal(runCleaner(standalone,url(path),body,{headers:{'Content-Type':'text/html'}}),body);
});

test('Guazi unknown decrypted schemas are preserved without re-encryption',()=>{
 for(const [p,value]of [['/App/Resource/Config/getNav',{unknown:1}],['/App/Resource/Vod/showOne',[]],['/App/Resource/Vod/showOne',null],['/App/Resource/Vod/vurlDetail',{unknown:1}]]){const body=envelope(value);assert.equal(both(p,body),body);}
});

test('Unified subscription routes Guazi to independent crypto script and other sites to independent engines',()=>{
 assert(!unified.includes('JSEncrypt'));assert(!unified.includes('CryptoJS'));assert(!unified.includes('admGetGuaziLibrary'));
 assert(standalone.includes('JSEncrypt'));assert(standalone.includes('CryptoJS'));
 const conf=read('universal/quantumult-x-snippet.conf'),scripts=conf.split('\n').filter(l=>l.includes(' url script-response-body '));
 const guazi=scripts.filter(l=>l.includes('/guazi-app/ad-clean.js?v='));assert.equal(guazi.length,6);
 for(const path of ['/App/Resource/Config/getNav','/App/Ad/barsPlayAdInfo','/App/Ad/playAdInfo','/App/IndexPlay/vodAdvertisement','/App/Resource/Vod/showOne','/App/Resource/Vod/vurlDetail']){const line=scripts.find(l=>new RegExp(l.split(' url ')[0]).test(url(path)));assert(line?.includes('/guazi-app/ad-clean.js?v='));}
 for(const line of scripts.filter(l=>!guazi.includes(l)))assert(!line.includes('/universal/ad-clean.js?v='));
});

test('Guazi minimal AES vendor has verified provenance and excludes unrelated algorithms',()=>{
 const vendor=read('guazi-app/vendor/cryptojs-aes.min.js'),info=JSON.parse(read('guazi-app/vendor/cryptojs-aes.json'));
 assert.equal(crypto.createHash('sha256').update(vendor).digest('hex'),info.sha256);
 const ctx={};vm.runInNewContext(vendor,ctx);assert.deepEqual(Object.keys(ctx.CryptoJS.algo),['AES']);assert.deepEqual(Object.keys(ctx.CryptoJS.mode),['CBC']);
});
test('Guazi handles Chinese and large responses while rejecting invalid padding and keys',()=>{
 const detail={vip:'1',title:'凡人修仙传😀',description:'中文内容'.repeat(6000),vurl_clouds:[{id:1,url:'https://fixture.example/视频.m3u8?token=keep'}]};
 const out=plain(both('/App/Resource/Vod/showOne',envelope(detail)));assert.equal(out.title,detail.title);assert.equal(out.description,detail.description);assert.deepEqual(out.vurl_clouds,detail.vurl_clouds);
 const raw=Buffer.alloc(16,0);Buffer.from('{"vip":"1"}').copy(raw);raw[15]=5;
 const c=crypto.createCipheriv('aes-256-cbc',Buffer.from(key),Buffer.from(iv));c.setAutoPadding(false);
 const root=JSON.parse(envelope(detail));root.data.response_key=Buffer.concat([c.update(raw),c.final()]).toString('hex');
 let b=JSON.stringify(root);assert.equal(both('/App/Resource/Vod/showOne',b),b);
 for(const hex of ['','00','x'.repeat(32),'AA'.repeat(17)]){root.data.response_key=hex;b=JSON.stringify(root);assert.equal(both('/App/Resource/Vod/showOne',b),b);}
 for(const [badKey,badIv]of [['short',iv],[key,'short'],['x'.repeat(32),iv]]){
  root.data.response_key=cipher(detail);root.data.keys=crypto.publicEncrypt({key:crypto.createPublicKey(priv),padding:crypto.constants.RSA_PKCS1_PADDING},Buffer.from(JSON.stringify({key:badKey,iv:badIv}))).toString('base64');
  b=JSON.stringify(root);assert.equal(both('/App/Resource/Vod/showOne',b),b);
 }
});
test('Guazi and website cache versions change only for their own generated script content',()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'guazi-version-'));
 try{
  for(const dir of ['scripts','universal','guazi-app'])fs.cpSync(path.join(root,dir),path.join(tmp,dir),{recursive:true});
  const build=()=>execFileSync(process.execPath,['scripts/build-ad-clean.mjs'],{cwd:tmp,stdio:'pipe'});
  const version=file=>fs.readFileSync(path.join(tmp,file),'utf8').split('\n')[0];
  build();const g=version('guazi-app/ad-clean.js'),w=version('universal/ad-clean.js');
  fs.appendFileSync(path.join(tmp,'universal/src/yqk.js'),'\n// website-only version fixture\n');build();const w2=version('universal/ad-clean.js');assert.notEqual(w2,w);assert.equal(version('guazi-app/ad-clean.js'),g);
  fs.appendFileSync(path.join(tmp,'universal/src/guazi.js'),'\n// guazi-only version fixture\n');build();assert.notEqual(version('guazi-app/ad-clean.js'),g);assert.equal(version('universal/ad-clean.js'),w2);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('Guazi retains AES-128, AES-192 and AES-256 response compatibility',()=>{
 for(const size of [16,24,32]){
  const aesKey='k'.repeat(size),data={vip:'1',title:'中文片名',vurl_clouds:[{id:1,url:'keep'}]};
  const enc=crypto.createCipheriv('aes-'+size*8+'-cbc',Buffer.from(aesKey),Buffer.from(iv));
  const encrypted=Buffer.concat([enc.update(JSON.stringify(data)),enc.final()]).toString('hex');
  const rsa=crypto.publicEncrypt({key:crypto.createPublicKey(priv),padding:crypto.constants.RSA_PKCS1_PADDING},Buffer.from(JSON.stringify({key:aesKey,iv}))).toString('base64');
  const body=JSON.stringify({code:200,data:{keys:rsa,response_key:encrypted}}),out=JSON.parse(both('/App/Resource/Vod/showOne',body));
  assert.equal(out.data.keys,rsa);const dec=crypto.createDecipheriv('aes-'+size*8+'-cbc',Buffer.from(aesKey),Buffer.from(iv));
  const plain=JSON.parse(Buffer.concat([dec.update(Buffer.from(out.data.response_key,'hex')),dec.final()]).toString());assert.equal(plain.vip,'0');assert.equal(plain.title,data.title);assert.deepEqual(plain.vurl_clouds,data.vurl_clouds);
 }
});
