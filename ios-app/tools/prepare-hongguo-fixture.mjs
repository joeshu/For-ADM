// Modifies only the separately signed simulator bundle, never the device IPA.
import fs from 'node:fs';
import path from 'node:path';
const app=process.argv[2];if(!app||!app.includes('/simulator/'))throw Error('Expected simulator bundle');
const target=path.join(app,'Hongguo/hgtv.js');
const plain=Buffer.from('x000102030405060708090a0b0c0d0e0fx'),raw=Buffer.alloc(plain.length+1);let a=85,b=246;
for(let i=0;i<plain.length;i++){let pop=0;for(let x=i;x;x>>=1)pop+=x&1;const old=((plain[i]+21+pop)&255)^(i&1?a:b);raw[i+1]=old;if(i&1)a=old;else b=old;}
raw[0]=raw[1]^raw[2];
const model={video_list:{one:{main_url:'https://fixture.invalid/generated',definition:'360p',encrypt_info:{encrypt:true,spade_a:raw.toString('base64')}}}};
const bytes=fs.readFileSync(new URL('../tests/fixtures/hongguo-cenc.mp4',import.meta.url)).toString('base64');
fs.copyFileSync(target,target+'.original');
fs.appendFileSync(target,'\n// Simulator-only owned-media fixture.\nfetchModel=async()=>('+JSON.stringify(model)+');\nhttpText=async()=>({status:200,body:Buffer.from('+JSON.stringify(bytes)+',"base64")});\n');
