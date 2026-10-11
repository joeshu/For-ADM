import assert from 'node:assert/strict';
import {test} from 'node:test';
import {exactHostPattern} from '../scripts/lib/host-pattern.mjs';
import {readJSON} from '../scripts/lib/ad-sites.mjs';
test('Numbered exact hosts compact without widening host boundaries',()=>{
 const hosts=readJSON(new URL('../universal/templates.json',import.meta.url)).templates.find(t=>t.id==='yxxq').bindings[0].domains.names;
 const pattern=exactHostPattern(hosts);assert(pattern.length<hosts.join('|').length/2);assert(!pattern.includes('\\d'));
 const re=new RegExp('^'+pattern+'$');
 for(let n=0;n<200;n++)for(const prefix of ['www.',''])assert.equal(re.test(prefix+'yxxq'+n+'.cc'),hosts.includes(prefix+'yxxq'+n+'.cc'));
 for(const host of hosts){assert(re.test(host));for(const changed of [host+'.invalid',host.replace('.cc','.com'),'bad.'+host,host.replace('www.','www2.'),host.replace(/(\d+)/,'0$1')])assert(!re.test(changed));}
});
test('Exact host grouping retains separate brands, multiple numbers and leading zero distinctions',()=>{
 const hosts=['tv.qingning77.com','tv.qingning88.com','www.yxxq35.cc','www.yxxq65.cc','www.yxxq035.cc','cdn12.a3.com','cdn14.a3.com','plain.example.com'];
 const re=new RegExp('^'+exactHostPattern([...hosts,hosts[0]])+'$');
 for(const host of hosts)assert(re.test(host));
 for(const host of ['tv.qingning35.com','www.yxxq77.cc','www.yxxq0035.cc','cdn13.a3.com','cdn12.a4.com','plain.example.com.invalid'])assert(!re.test(host));
 for(const names of [[],['invalid'],['www.a.com|.*'],['www.a.com',null]])assert.throws(()=>exactHostPattern(names));
});
