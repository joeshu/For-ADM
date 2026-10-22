// Independently implemented conservative adaptation of clean_m3u8.js's segment signatures.
// Reference and deliberately excluded broad patterns are documented in docs/hls-cleaning.md.
const signatures=['UoK3btd2','10115kb','9gWW64MM','DoMaUgPr','2075kb','nlfRR6gH','RCP0FQBQ','7Lzh4PuW','V2C7MJhC','ymO7zGr9','Bjf6z0RU','jHKrrx6s','2078kb','a3a6eda11cbfa352','2f1563ca37e75212','2db1cf28fb771e0d','de820e92881bd4d1','6aa3d5aa8e8c1ac11479d82a','GB1mnQDZ','10152kb','9622kb','9641kb','10141kb','30EjJFTT','W7fqTmbJ','JKyp1S2D','5568049a638c79f9','ec5db3bbf268dd34','7e14ee319bf8017d','ac080df0b161b6fb','ea6bb8a311db9dd0','1f1d60431202f328','39803bb0fa0ec24b','787de3b9178c4058','0916de7dab851cd8','65e7a9371db1b651','Zse0Tpg8','a6b9d4136946ad41','8jlf67z19','C7bAbClC'].map(s=>s.toLowerCase());
export function cleanPlaylist(body,{enabled=true}={}){
 const unchanged=reason=>({body,removed:0,seconds:0,reason});
 if(!enabled)return unchanged('disabled');
 if(typeof body!=='string'||!body.trimStart().startsWith('#EXTM3U'))return unchanged('not-hls');
 if(/#EXT-X-(?:STREAM-INF|I-FRAME-STREAM-INF):/.test(body))return unchanged('master');
 // Live/LL-HLS, implicit AES IVs and byte offsets need sequence-aware rewriting.
 // Leave these unchanged rather than risk a damaged timeline or decryption failure.
 if(!/#EXT-X-ENDLIST/.test(body))return unchanged('live');
 if(/#EXT-X-(?:BYTERANGE|PART|PRELOAD-HINT|SKIP):/.test(body)||/#EXT-X-KEY:[^\n]*METHOD=(?!NONE(?:,|\s|$))/i.test(body))return unchanged('complex-media');
 const lines=body.replace(/\r\n?/g,'\n').split('\n'),segments=[];let pending=-1,duration=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(line.startsWith('#EXTINF:')){if(pending>=0)return unchanged('malformed');pending=i;duration=Number(line.slice(8).split(',')[0]);if(!Number.isFinite(duration)||duration<0)return unchanged('malformed');}
  else if(line&&!line.startsWith('#')){
   if(pending<0)return unchanged('unsupported-uri');
   // Inspect only path tokens, never query strings, hostnames or arbitrary numeric IDs.
   let path=line.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/i,'').toLowerCase();
   const ad=signatures.some(s=>path.split('/').some(part=>part===s||part.startsWith(s+'.')||part.startsWith(s+'_')||part.startsWith(s+'-')))||/\/(?:video\/adjump|mov\/ad)(?:\/|$)/i.test(path);
   segments.push({start:pending,end:i,duration,ad});pending=-1;
  }
 }
 if(pending>=0||!segments.length)return unchanged('malformed');
 const ads=segments.filter(s=>s.ad),seconds=ads.reduce((n,s)=>n+s.duration,0),total=segments.reduce((n,s)=>n+s.duration,0);
 if(!ads.length)return unchanged('no-match');
 if(seconds>120||seconds>total*0.2||total-seconds<30)return unchanged('safety-limit');
 const removedLines=new Set(),boundaries=new Set();
 let gap=false;
 for(const segment of segments){
  if(segment.ad){
   // Only remove per-segment tags; retain keys (including METHOD=NONE), maps and metadata.
   removedLines.add(segment.start);removedLines.add(segment.end);
   for(let i=segment.start+1;i<segment.end;i++)if(/^#EXT-X-(?:PROGRAM-DATE-TIME|GAP)(?::|$)/.test(lines[i].trim()))removedLines.add(i);
   gap=true;
  }else if(gap){boundaries.add(segment.start);gap=false;}
 }
 const out=[];
 for(let i=0;i<lines.length;i++){if(removedLines.has(i))continue;if(boundaries.has(i)&&!out.slice(-2).some(x=>x.trim()==='#EXT-X-DISCONTINUITY'))out.push('#EXT-X-DISCONTINUITY');out.push(lines[i]);}
 return {body:out.join('\n'),removed:ads.length,seconds,reason:'matched'};
}
