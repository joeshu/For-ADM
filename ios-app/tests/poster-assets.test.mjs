import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sites from '../Web/sites-data.mjs';

const CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const encryptedFixture='UirodFy8rJdy9weMp3zV14Brkzd6m4YHITwrBjbPlEnQsqs6HMV6se8qQrDJ0JwbjezFVF4kyuXLEx9X1k5smLh5ODdMK+FdiKr7l0Edsus=';

test('bundled protected-poster keys decode the encrypted WebP fixture',()=>{
 const ciphertext=CryptoJS.enc.Base64.parse(encryptedFixture);
 for(const id of ['kkapp','ncat','happ']){
  const site=sites.find(item=>item.id===id),entry=site?.assetKeys?.find(item=>item.index===1);
  assert.ok(entry,id+' must retain its image key');
  const plain=CryptoJS.AES.decrypt({ciphertext},CryptoJS.enc.Utf8.parse(entry.key),{iv:CryptoJS.enc.Utf8.parse(entry.iv),mode:CryptoJS.mode.CBC,padding:CryptoJS.pad.Pkcs7});
  const bytes=Buffer.from(plain.toString(CryptoJS.enc.Hex),'hex');
  assert.equal(bytes.subarray(0,4).toString(),'RIFF',id);
  assert.equal(bytes.subarray(8,12).toString(),'WEBP',id);
 }
});
