// Inspect bounded ISO BMFF initialization bytes; never parse sample payloads.
// This identifies container/track protection, not whether a decoder will render.
export function inspectMP4Init(binary){
 if(typeof binary!=='string'||binary.length>65536)throw new Error('Invalid MP4 probe size');
 const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0)),view=new DataView(bytes.buffer),tracks=[];
 let budget=512,ftyp=false,moov=false;
 const text=offset=>binary.slice(offset,offset+4);
 function boxes(start,end,depth=0,samples=false){
  if(depth>10)return;
  for(let at=start;at+8<=end&&budget-->0;){
   let size=view.getUint32(at),header=8;const type=text(at+4);
   if(size===1){if(at+16>end)return;size=view.getUint32(at+8)*4294967296+view.getUint32(at+12);header=16;}
   if(size===0)size=end-at;
   if(!Number.isSafeInteger(size)||size<header)return;
   const finish=Math.min(at+size,end);
   if(samples)tracks.push(type);
   else if(depth===0&&type==='ftyp'&&size>=16&&at+size<=end)ftyp=true;
   if(type==='moov')moov=true;
   if(['moov','trak','mdia','minf','stbl'].includes(type))boxes(at+header,finish,depth+1);
   else if(type==='stsd'&&at+header+8<=finish)boxes(at+header+8,finish,depth+1,true);
   if(type==='mdat'||at+size>end)return;
   at+=size;
  }
 }
 boxes(0,bytes.length);
 return {mp4:ftyp,moov,tracks,encrypted:tracks.some(type=>type==='encv'||type==='enca')};
}
