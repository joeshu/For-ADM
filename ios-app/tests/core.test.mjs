import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import {collectMovies,homeSections,categories,imageURLs,playbackURLs,escapeHTML} from '../Web/model.mjs';
import {SiteClient,ServiceError,canonicalQuery,decodeResponse} from '../Web/site-api.mjs';
globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const site={id:'test',appId:'public-app',origin:'https://origin.example',version:'1',signKey:'test-key',responseKeys:[{index:1,key:'12345678901234567890123456789012',iv:'1234567890123456'}]};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map};};
const response=data=>({status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')});
const movie={title:'影片',url:'vod/detail?vodId=123',channelId:1};
test('Home only renders internal movie cards, excludes advertisement containers and external routes',()=>{
 assert.equal(collectMovies([{...movie,id:123},{...movie}, {...movie,url:'https://ads.example'}, {_vod:'ad_home',data:[{...movie,url:'vod/detail?vodId=456'}]}]).length,1);
 assert.equal(homeSections({blocks:[{_vod:'ad_home',data:[movie]},{header:{title:'电影'},data:[movie]}]}).length,1);
 assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');
});
test('Dynamic categories and resource domains retain paths and only accept HTTPS playback',()=>{
 assert.deepEqual(categories({vodTabs:[{type:'category',channelId:1,text:'电影'},{type:'nav',channelId:2}]}),[{id:1,name:'电影'}]);
 assert.deepEqual(imageURLs({imageGroup:'vod1',imagePath:'/a.jpg'},{groups:[{id:'vod1',url:[{domain:'https://img.example/vod1'}]}]}),['https://img.example/vod1/a.jpg']);
 assert.deepEqual(playbackURLs({playUrls:[{url:'http://x.test/a'},{url:'javascript:alert(1)'},{url:'https://x.test/a'}]}),[{url:'https://x.test/a'}]);
});
test('Request signature matches independent HMAC implementation, public queries and API version',()=>{
 const c=new SiteClient(site,()=>{},storage()),r=c.buildRequest('https://api.example','/test',{k:'a&b 中文'});
 const query={os:'webapp',appId:site.appId,userLevel:'0',k:'a&b 中文'};
 const session=`appId=${site.appId}&deviceCreatedAt=${c.device.created}&deviceId=${c.device.id}&st=2`;
 const expected=createHmac('sha1',site.signKey).update(`get|/test|${canonicalQuery(query)}|${r.headers.ts}|${session}|`).digest('hex');
 assert.equal(r.headers.sign,expected);assert.equal(new URL(r.url).searchParams.get('k'),'a&b 中文');
 assert.equal(c.buildRequest(site.origin,'/user/anonymous',{},'post').headers.apiVer,'v2');
});
test('Encrypted responses use the configured AES key and reject schema changes',()=>{
 const C=globalThis.CryptoJS,key=site.responseKeys[0];const body=C.AES.encrypt(JSON.stringify({data:[1]}),C.enc.Utf8.parse(key.key),{iv:C.enc.Utf8.parse(key.iv)}).ciphertext.toString(C.enc.Base64);
 assert.deepEqual(decodeResponse({bodyBase64:body},site),{data:[1]});
 assert.throws(()=>decodeResponse({bodyBase64:Buffer.from('invalid').toString('base64')},site),ServiceError);
});
test('Network failures retry a backup, business denials never retry',async()=>{
 let calls=0;const c=new SiteClient(site,async()=>{if(++calls===1)throw Error('offline');return response({data:{ok:true},code:200});},storage());
 c.config={urls:{cache:['https://one.example','https://two.example']}};
 assert.deepEqual(await c.request('/test'),{ok:true});assert.equal(calls,2);
 calls=0;c.transport=async()=>{calls++;return response({code:40401,message:'请登录'});};
 await assert.rejects(c.request('/test'),{code:40401});assert.equal(calls,1);
});
test('Episode API retains source identifiers; abort prevents network requests',async()=>{
 let request;const c=new SiteClient(site,async r=>{request=r;return response([]);},storage());c.config={urls:{cache:['https://api.example']}};
 await c.episodes('123',{siteId:77,episodeVodId:88});const url=new URL(request.url);assert.equal(url.searchParams.get('vodId'),'123');assert.equal(url.searchParams.get('siteId'),'77');assert.equal(url.searchParams.get('episodeVodId'),'88');
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(c.home(ctrl.signal),{name:'AbortError'});
});
test('Sessions use the vault, do not leak into localStorage, remain isolated by source',async()=>{
 const saved=new Map(),store=storage();globalThis.NativeTransport={vault:{get:async k=>saved.get(k)||null,put:async(k,v)=>saved.set(k,v),remove:async k=>saved.delete(k)}};
 const c=new SiteClient(site,async()=>response({id:1,token:'test-only-token'}),store);c.config={urls:{logic:['https://api.example']}};
 await c.anonymous();assert.equal(saved.get('test').token,'test-only-token');assert.ok([...store.map.values()].every(v=>!v.includes('token')));
 const other=new SiteClient({...site,id:'other'},()=>{},store);assert.equal(other.user,null);await c.logout();assert.equal(c.user,null);assert.equal(saved.size,0);delete globalThis.NativeTransport;
});
test('Image decoder accepts real image headers, rejects HTML and oversized bodies',async()=>{
 const {imageData}=await import('../Web/image-loader.mjs');
 assert.match(imageData({status:200,bodyBase64:Buffer.from('RIFF1234WEBP123456789012345').toString('base64')}),/^data:image\/webp;base64,/);
 assert.throws(()=>imageData({status:200,bodyBase64:Buffer.from('<html>advertisement</html>').toString('base64')}));
 assert.throws(()=>imageData({status:403,bodyBase64:'/9j/'}));
});
test('Closed episodes require server authorization even if a cached URL exists',async()=>{
 const {resolvePlayback}=await import('../Web/playback.mjs');let calls=0;const episode={id:9,open:false,playUrls:[{url:'https://old.example/v.m3u8'}]},line={siteId:4};
 const c={play:async p=>{calls++;assert.deepEqual(p,{vodId:3,siteId:4,episodeId:9});throw new ServiceError('需要登录',40401);}};
 await assert.rejects(resolvePlayback(c,3,line,episode),{code:40401});assert.equal(calls,1);
 c.play=async()=>({playUrls:[{url:'https://authorized.example/v.m3u8'}]});assert.equal((await resolvePlayback(c,3,line,episode))[0].url,'https://authorized.example/v.m3u8');assert.equal(episode.open,false);
 c.play=()=>{throw Error('Must not request again for explicitly open episode');};assert.equal((await resolvePlayback(c,3,line,{...episode,open:true}))[0].url,'https://old.example/v.m3u8');
});
