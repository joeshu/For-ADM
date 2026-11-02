import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertSourceClientContract,validateSiteManifest,SOURCE_ADAPTER_PROVIDERS,SOURCE_CLIENT_METHODS} from '../Web/source-contract.mjs';
import {createSourceClient,sourceAdapterRegistry} from '../Web/source-clients.mjs';

const sites=JSON.parse(await readFile(new URL('../Web/sites.json',import.meta.url),'utf8'));
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
const noNetwork=async()=>{throw Error('network must not be used during adapter construction');};

test('bundled source manifest is valid and every provider has an explicit adapter',()=>{
 assert.equal(validateSiteManifest(sites),sites);
 for(const site of sites){
  assert.ok(site.provider==null||SOURCE_ADAPTER_PROVIDERS.includes(site.provider));
  const client=createSourceClient(site,noNetwork,storage());
  for(const method of SOURCE_CLIENT_METHODS)assert.equal(typeof client[method],'function',site.id+' '+method);
  const profile=client.discoveryProfile(),ids=profile.tabs.map(tab=>String(tab.id));
  assert.equal(new Set(ids).size,ids.length,site.id+' duplicate discovery tab');
  assert.ok(profile.tabs.every(tab=>tab.name.trim()&&tab.mode.trim()),site.id+' missing discovery metadata');
 }
});

test('provider registry is explicit and unknown providers fail closed',()=>{
 assert.deepEqual(Object.keys(sourceAdapterRegistry).sort(),[...SOURCE_ADAPTER_PROVIDERS].sort());
 assert.throws(()=>createSourceClient({...sites[0],provider:'typo'},noNetwork,storage()),/未注册的片源适配器/);
 assert.throws(()=>createSourceClient({...sites[0],provider:'__proto__'},noNetwork,storage()),/未注册的片源适配器/);
});

test('adapter contract rejects incomplete clients and invalid discovery profiles',()=>{
 const site=sites[0],client=createSourceClient(site,noNetwork,storage());
 const override=values=>new Proxy(client,{get(target,key,receiver){return Object.hasOwn(values,key)?values[key]:Reflect.get(target,key,receiver);}});
 assert.throws(()=>assertSourceClientContract(site,override({play:undefined})),/缺少统一接口/);
 assert.throws(()=>assertSourceClientContract(site,override({discoveryProfile:()=>({timeline:true,timelineTab:'9',tabs:[{id:'0',name:'上映表',mode:'timeline'}]})})),/timelineTab/);
 assert.throws(()=>assertSourceClientContract(site,override({discoveryProfile:()=>({timeline:false,tabs:[{id:'0',name:'一',mode:'custom'},{id:'0',name:'重复',mode:'home'}]})})),/栏目必须/);
});

test('manifest validation catches duplicates, malformed origins, and unknown providers',()=>{
 assert.throws(()=>validateSiteManifest([sites[0],{...sites[0]}]),/id 重复/);
 assert.throws(()=>validateSiteManifest([{...sites.at(-1),provider:'unknown'}]),/provider 未注册/);
 assert.throws(()=>validateSiteManifest([{...sites[0],origin:'http://example.test'}]),/allowInsecureOrigin/);
 assert.throws(()=>validateSiteManifest([{...sites[0],origin:'https://user:pass@example.test'}]),/origin 必须/);
 assert.throws(()=>validateSiteManifest([{...sites.at(-1),protocol:{...sites.at(-1).protocol,apiOrigins:['https://ok.example','https://ok.example']} }]),/apiOrigins/);
});

test('HTTP origins require an explicit per-site opt-in',()=>{
 const plain={id:'test-http',name:'测试站',version:'1.0',origin:'http://example.test',appId:'test',signKey:'sign',initKey:'init',initIV:'iv',responseKeys:[{index:1,key:'key',iv:'iv'}]};
 assert.throws(()=>validateSiteManifest([plain]),/allowInsecureOrigin/);
 assert.equal(validateSiteManifest([{...plain,allowInsecureOrigin:true}]).length,1);
});
