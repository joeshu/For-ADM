// Synthetic container metadata only; no third-party media or protection keys.
const box=(type,...parts)=>{const body=Buffer.concat(parts),header=Buffer.alloc(8);header.writeUInt32BE(body.length+8);header.write(type,4);return Buffer.concat([header,body]);};
export function mp4Init({video='avc1',audio='mp4a',payload=''}={}){
 const track=codec=>box('trak',box('mdia',box('minf',box('stbl',box('stsd',Buffer.from([0,0,0,0,0,0,0,1]),box(codec,Buffer.alloc(8)))))));
 return Buffer.concat([box('ftyp',Buffer.from('isom\0\0\0\0isom')),box('moov',track(video),...(audio?[track(audio)]:[])),box('mdat',Buffer.from(payload))]);
}
