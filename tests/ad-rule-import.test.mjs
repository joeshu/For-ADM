import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {validateSourcePath,parseRuleImport,validateGeneratedRules} from '../scripts/lib/rule-import.mjs';
const host=['api.example.com'];
const good='#!name = Fixture\n^https://api\\.example\\.com/ad$ url reject-dict\nhostname = api.example.com\n';
test('import parsing retains original rules and metadata with LF and CRLF',()=>{
 for(const s of [good,good.replaceAll('\n','\r\n')])assert.deepEqual(parseRuleImport(s,host),{lines:['^https://api\\.example\\.com/ad$ url reject-dict'],metadata:['#!name = Fixture']});
 const s=fs.readFileSync(new URL('../guazi-app/upstream/TilingSales_ad_remove.snippet',import.meta.url),'utf8');
 assert.equal(parseRuleImport(s,s.match(/^hostname = (.*)$/m)[1].split(', ')).lines.length,23);
});
test('unsupported, malformed, duplicate and missing import entries fail visibly',()=>{
 for(const s of [good+'unknown = ignored-before\n',good.replace('reject-dict','reject-array'),good.replace('^https:','[broken'),good+good.split('\n')[1]+'\n',good+'hostname = api.example.com\n',good.replace('api.example.com\n','different.example\n'),'hostname = api.example.com\n'])assert.throws(()=>parseRuleImport(s,host));
 assert.throws(()=>parseRuleImport(good,['other.example']));
});
test('source paths reject traversal before reads and generated rule collisions fail',()=>{
 assert.equal(validateSourcePath('guazi-app/upstream/source.snippet'),'guazi-app/upstream/source.snippet');
 for(const p of ['/tmp/source.snippet','../source.snippet','a/../source.snippet','a\\..\\source.snippet','a//source.snippet','source.js',undefined])assert.throws(()=>validateSourcePath(p));
 const a='^https://example/ad url reject-dict';assert.doesNotThrow(()=>validateGeneratedRules([a]));
 assert.throws(()=>validateGeneratedRules([a,a]));assert.throws(()=>validateGeneratedRules([a,'^https://example/ad url script-response-body https://example/script.js']));
});
