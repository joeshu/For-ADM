const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Compact numbered labels without adding any unregistered hostname.
export function exactHostPattern(names){
 if(!Array.isArray(names)||!names.length||names.some(h=>typeof h!=='string'||!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)))throw Error('Exact hosts require a nonempty valid hostname list');
 const groups=new Map();
 for(const host of [...new Set(names)]){
  const match=host.match(/^(.*?)(\d+)(\.[a-z0-9.-]+)$/);
  const key=match?JSON.stringify([match[1],match[3]]):JSON.stringify([host,null]);
  if(!groups.has(key))groups.set(key,{prefix:match?match[1]:host,suffix:match?match[3]:null,hosts:[],numbers:[]});
  const group=groups.get(key);group.hosts.push(host);if(match)group.numbers.push(match[2]);
 }
 const patterns=[...groups.values()].map(g=>{
  const expanded=g.hosts.map(escape).join('|');
  if(g.numbers.length<2)return expanded;
  const compact=escape(g.prefix)+'(?:'+g.numbers.join('|')+')'+escape(g.suffix);
  return compact.length<expanded.length?compact:expanded;
 });
 return '(?:'+patterns.join('|')+')';
}
