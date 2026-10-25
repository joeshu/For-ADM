import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
import {DylsClient,encodeDylsPack,decodeDylsResponse,needsDylsParsing} from '../Web/dyls-api.mjs';

const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:1024});
const protocol={publicKey:publicKey.export({type:'pkcs1',format:'pem'}),signKey:'public-test-sign-key',aesKey:'1234567890123456',aesIV:'abcdefghijklmnop',clientVersion:3102};
const site={id:'dyls-test',origin:'https://catalog.example',protocol};
const store=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
function decryptPack(pack){
 const binary=Buffer.from(pack,'base64url'),blocks=[];
 for(let i=0;i<binary.length;i+=128){const block=crypto.privateDecrypt({key:privateKey,padding:crypto.constants.RSA_NO_PADDING},binary.subarray(i,i+128));assert.equal(block[0],0);assert.equal(block[1],2);const zero=block.indexOf(0,2);assert.ok(zero>=10);blocks.push(block.subarray(zero+1));}
 return JSON.parse(Buffer.concat(blocks).toString('utf8'));
}
const response=(data,status=200)=>({status,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')});
function encrypted(data){const cipher=crypto.createCipheriv('aes-128-cbc',Buffer.from(protocol.aesKey),Buffer.from(protocol.aesIV));const body=Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]).toString('base64url');return {status:200,bodyBase64:Buffer.from(body).toString('base64')};}
const config={index_top_nav:[{id:0,name:'推荐'},{id:1,name:'电影'},{id:36,name:'短剧'},{id:13,name:'福利'}],movie_screen:{filter:[{id:1,name:'电影',class:['类型','Netflix','科幻'],area:['地区','大陆','美国'],year:['年份','2026']},{id:36,name:'短剧',class:['类型','古代']}],sort:[{name:'综合',value:'by_default'},{name:'最新',value:'by_time'}]}};
function fixture(handler){const calls=[],transport=async req=>{
 const url=new URL(req.url),p=decryptPack(url.searchParams.get('pack'));assert.equal(url.searchParams.get('signature'),crypto.createHmac('md5',protocol.signKey).update(url.searchParams.get('pack')).digest('hex'));calls.push({path:url.pathname,p,req});
 if(url.pathname==='/api/v1/app/config')return encrypted({msg:'获取成功',data:config});return handler(url.pathname,p,req);
};const storage=store();return {client:new DylsClient(site,transport,storage),calls,storage};}

test('Dyls public-key chunks preserve long UTF-8 search text and supplementary characters',()=>{
 const payload={keyword:'测试电影💡'.repeat(100),timestamp:123};const pack=encodeDylsPack(payload,protocol.publicKey);
 assert.ok(Buffer.from(pack,'base64url').length>128);assert.deepEqual(decryptPack(pack),payload);
});

test('Dyls AES envelopes and plaintext error objects decode independently of content-type',()=>{
 const value={msg:'获取成功',data:{name:'中文影片'}};assert.deepEqual(decodeDylsResponse(encrypted(value),protocol),value);
 assert.deepEqual(decodeDylsResponse(response({errorCode:993,msg:'拒绝'}),protocol),{errorCode:993,msg:'拒绝'});
 assert.throws(()=>decodeDylsResponse({bodyBase64:Buffer.from('not ciphertext').toString('base64')},protocol),/未知数据格式/);
});

test('Dyls bootstraps taxonomy and filters from source config with isolated storage',async()=>{
 const a=fixture(()=>{throw Error('unexpected')});const c=await a.client.bootstrap();
 assert.deepEqual(c.vodTabs.map(t=>t.channelId),[1,36,13]);assert.deepEqual(c.adultChannelIds,[13]);assert.equal(c.supportsAccount,false);
 assert.deepEqual(c.channelListQuery[0].items.find(x=>x.query==='class').data,[{id:'',name:'全部'},{id:'Netflix',name:'Netflix'},{id:'科幻',name:'科幻'}]);
 assert.equal(a.calls[0].req.headers.Authorization,undefined);assert.equal(a.calls[0].req.headers['X-Client-Version'],'3102');
 const b=new DylsClient({...site,id:'another'},async()=>{},a.storage);assert.notEqual(a.client.device.id,b.device.id);assert.ok(a.storage.map.has('sanyuan:another:device'));
});

test('Dyls category/search pagination retains string IDs and allowlisted source filters',async()=>{
 const {client,calls}=fixture((path,p)=>response({msg:'获取成功',data:{list:[{id:p.page===2?'Ab_C-2':'Ab_C-1',name:'影片',cover:'https://img.example/poster.jpg',type_id:1}],page:p.page,pageSize:1,total:2}}));
 const first=await client.channel(1,{sort:'by_time',class:'Netflix',area:'not-real',query:'bad'});assert.equal(first.next,'page=2');assert.equal(first.items[0].url,'vod/detail?vodId=Ab_C-1');assert.equal(first.items[0].imageURL,'https://img.example/poster.jpg');
 const args=calls[1].p;assert.equal(args.sort,'by_time');assert.equal(args.class,'Netflix');assert.equal(args.area,undefined);assert.equal(args.query,undefined);
 const second=await client.collection({kind:'channel',id:1},first.next);assert.equal(second.next,'');assert.notEqual(first.items[0].url,second.items[0].url);
 await client.search('测试');assert.equal(calls.at(-1).p.res_type,'by_movie_name');assert.equal(calls.at(-1).p.keyword,'测试');
});

test('Dyls homepage drops dedicated ads and only enables explicit category More routes',async()=>{
 const {client,calls}=fixture((path,p)=>path.endsWith('/movie/screen/list')?response({data:{list:[],total:0}}):response({msg:'获取成功',data:[{layout:'advert_self',list:[{id:'Bad',name:'广告'}]},{layout:'index_recommend_carousel',list:[{type:3,title:'外站',click:'https://ad.example'}]},{title:'最新',layout:'movie_list',right:{type:'tabs',data:{index:1,param:{class:'netflix'}}},list:[{id:'A1',name:'电影',cover:'https://img.example/a.jpg'}]},{title:'独家',layout:'movie_list',list:[{id:'B1',name:'福利院里的故事',type_name:'剧集'}]}]}));
 const home=await client.home();assert.equal(home.blocks.length,2);assert.equal(home.blocks[0].header.url,'catalog/channel?channelId=1&class=netflix');assert.equal(home.blocks[1].header.url,undefined);assert.equal(home.blocks[1].data[0].isAdult,false);
 await client.collection({kind:'channel',id:1,url:home.blocks[0].header.url});assert.equal(calls.at(-1).p.class,'Netflix');
});

test('Dyls parser semantics match string flags and source readiness precedence',()=>{
 assert.equal(needsDylsParsing({ready_to_play:false},{player_need_to_parse:'0'}),false);
 assert.equal(needsDylsParsing({ready_to_play:true},{player_need_to_parse:'1'}),true);
 assert.equal(needsDylsParsing({ready_to_play:false},{}),true);
 assert.equal(needsDylsParsing({ready_to_play:true},{}),false);
 assert.equal(needsDylsParsing({parseUrl:'https://ready.example/a.m3u8'},{player_need_to_parse:true}),false);
});

test('Dyls same-episode parsing preserves source headers and refreshes episode addresses',async()=>{
 const {client,calls}=fixture((path,p)=>{
  if(path.endsWith('/movie/detail'))return response({msg:'获取成功',data:{id:'Ab1',name:'测试',type_id:1,members:[{type:1,name:'演员'},{type:3,name:'导演'}],play_from:[{code:'cloud',name:'官方线路',total:1,player_need_to_parse:'true',player_headers:[{name:'Origin',value:'https://cdn.example'},{key:'Bad',value:'x\r\ny'}],player_user_agent:'mobile-user-agent',list:[]}]}});
  if(path.endsWith('/movie_addr/list'))return response({msg:'获取成功',data:[{episode_id:887,episode_name:'第1集',play_url:'https://source.example/opaque?x='+'长'.repeat(200),from_code:'cloud'}]});
  if(path.endsWith('/movie_addr/parse_url')){assert.equal(p.episode_id,887);assert.equal(p.from_code,'cloud');assert.equal(p.type,'play');assert.equal(p.refresh,1);return response({msg:'获取成功',data:{play_url:'https://cdn.example/video.m3u8?sig=source-signed'}});}
  throw Error(path);
 });
 const d=await client.detail('Ab1');assert.deepEqual(d.actors,[{name:'演员'}]);assert.deepEqual(d.directors,[{name:'导演'}]);
 const play=await client.play({vodId:'Ab1',siteId:'cloud',episodeId:887});assert.equal(play[0].url,'https://cdn.example/video.m3u8?sig=source-signed');assert.equal(play[0].headers.Origin,'https://cdn.example');assert.equal(play[0].headers['User-Agent'],'mobile-user-agent');assert.equal(play[0].headers.Bad,undefined);assert.equal(play[0].referrerPolicy,'no-referrer');
 assert.equal(calls.filter(x=>x.path.endsWith('/movie_addr/list')).length,1);
});

test('Dyls direct media retains explicit Referer and service denials are never bypassed',async()=>{
 const {client,calls}=fixture((path,p)=>{
  if(path.endsWith('/movie/detail'))return response({data:{id:'A1',name:'测试',play_from:[{code:'direct',name:'直连',player_need_to_parse:false,player_headers:{Referer:'https://media.example/'}}]}});
  if(path.endsWith('/movie_addr/list'))return response({data:[{episode_id:2,episode_name:'正片',play_url:'https://media.example/a.mp4'}]});
  throw Error('Unexpected parser');
 });
 const urls=await client.play({vodId:'A1',siteId:'direct',episodeId:2});assert.equal(urls[0].referrerPolicy,'source');assert.equal(urls[0].headers.Referer,'https://media.example/');assert.equal(calls.some(x=>x.path.endsWith('/parse_url')),false);
 const denied=fixture(()=>response({errorCode:403,msg:'需要登录'},403));await assert.rejects(denied.client.search('test'),e=>e.name==='Error'&&e.code===403&&/登录/.test(e.message));
 await assert.rejects(denied.client.login('a','b'),/未接入账号/);
});

test('Dyls pre-cancelled requests do not issue network calls',async()=>{
 const {client,calls}=fixture(()=>{throw Error('unexpected')});const c=new AbortController();c.abort();await assert.rejects(client.bootstrap(c.signal),e=>e.name==='AbortError');assert.equal(calls.length,0);
});
