// VOD segment state snapshots. No media or key requests and no URI rewriting.
function admHlsUri(uri,base) {
  if(typeof uri!=='string'||!uri||/[\s#\\]/.test(uri))return null;
  var parent=base.match(/^https?:\/\/([^/:?#]+)(\/[^?#]*)/i),m=uri.match(/^(?:https?:)?\/\/([^/:?#]+)(\/[^#]*)?$/i),host,path;
  if(!parent)return null;
  if(m){host=m[1].toLowerCase();path=(m[2]||'/').split('?')[0];}
  else {if(/^[a-z][a-z0-9+.-]*:/i.test(uri)||uri.indexOf('//')===0)return null;host=parent[1].toLowerCase();path=uri.split('?')[0];if(path[0]!=='/')path=parent[2].slice(0,parent[2].lastIndexOf('/')+1)+path;}
  if(/(?:^|\/)\.{1,2}(?:\/|$)/.test(path))return null;
  return {host:host,path:path};
}
function admHlsKey(line,base) {
  var text=line.slice('#EXT-X-KEY:'.length),attrs={},pos=0;if(!text||text[text.length-1]===',')return null;
  while(pos<text.length){var m=text.slice(pos).match(/^([A-Z0-9-]+)=("[^"\r\n]*"|[^,\s"]+)(?:,|$)/);if(!m||Object.prototype.hasOwnProperty.call(attrs,m[1]))return null;attrs[m[1]]=m[2];pos+=m[0].length;}
  if(Object.keys(attrs).some(function(k){return ['METHOD','URI','IV','KEYFORMAT','KEYFORMATVERSIONS'].indexOf(k)<0;}))return null;
  if(attrs.METHOD==='NONE')return Object.keys(attrs).length===1?{method:'NONE',raw:line}:null;
  if(attrs.METHOD!=='AES-128'||!/^"[^"\r\n]+"$/.test(attrs.URI||'')||!admHlsUri(attrs.URI.slice(1,-1),base))return null;
  if(attrs.KEYFORMAT&&attrs.KEYFORMAT!=='"identity"'||attrs.KEYFORMATVERSIONS&&attrs.KEYFORMATVERSIONS!=='"1"'||attrs.IV&&!/^0x[0-9a-f]{1,32}$/i.test(attrs.IV))return null;
  return {method:'AES-128',raw:line,implicit:!attrs.IV};
}
function admHlsStatefulClean(body,policy,url,audit) {
  function unchanged(reason){if(audit)audit.reason=reason;return body;}
  if(typeof body!=='string'||body.length>3*1024*1024)return unchanged('body-size');
  var newline=body.indexOf('\r\n')>=0?'\r\n':'\n',lines=body.split(newline),header=[],seen={},segments=[],key={method:'NONE',raw:null},pending=null,disc=0,discTotal=0,seq=0,discBase=0,target=0,end=false;
  if(lines[0]!=='#EXTM3U'||body.replace(/\r\n/g,'').indexOf('\r')>=0)return unchanged('not-supported-playlist');
  header.push(lines[0]);
  for(var i=1;i<lines.length;i++) {
    var line=lines[i].trim(),m;if(!line)continue;if(line!==lines[i]||end)return unchanged('malformed-playlist');
    if(line==='#EXT-X-ENDLIST'){if(pending||disc||!segments.length)return unchanged('malformed-end');end=true;continue;}
    if(line==='#EXT-X-DISCONTINUITY'){if(pending)return unchanged('segment-tag-order');disc++;discTotal++;if(!Number.isSafeInteger(discBase+discTotal))return unchanged('integer-overflow');continue;}
    if(line.indexOf('#EXT-X-KEY:')===0){if(pending)return unchanged('segment-tag-order');key=admHlsKey(line,url);if(!key)return unchanged('unsupported-key');continue;}
    if((m=line.match(/^#EXTINF:(\d+(?:\.\d+)?),.*$/))){if(pending||!(Number(m[1])>0))return unchanged('malformed-duration');pending={raw:lines[i],duration:Number(m[1])};continue;}
    if(line[0]==='#'){
      m=line.match(/^#(EXT-X-(?:VERSION|TARGETDURATION|MEDIA-SEQUENCE|DISCONTINUITY-SEQUENCE)):(\d+)$/);
      var name=m?m[1]:line==='#EXT-X-PLAYLIST-TYPE:VOD'?'type':line==='#EXT-X-INDEPENDENT-SEGMENTS'?'independent':null;
      if(!name||segments.length||pending||discTotal||seen[name])return unchanged('unsupported-tag');
      if(m){var value=Number(m[2]);if(!Number.isSafeInteger(value))return unchanged('integer-overflow');if(name==='EXT-X-MEDIA-SEQUENCE')seq=value;if(name==='EXT-X-DISCONTINUITY-SEQUENCE')discBase=value;if(name==='EXT-X-TARGETDURATION'){target=value;if(!target)return unchanged('invalid-target');}if(name==='EXT-X-VERSION'&&!value)return unchanged('invalid-version');}
      seen[name]=true;header.push(lines[i]);continue;
    }
    var uri=admHlsUri(line,url);if(!pending||!uri||!/\.(?:ts|jpg)$/i.test(uri.path)||!Number.isSafeInteger(seq+segments.length))return unchanged('unsupported-segment');
    var ad=new RegExp(policy.adPath).test(uri.path)&&uri.host===url.match(/^https?:\/\/([^/:?#]+)/i)[1].toLowerCase();
    if(!ad&&(!policy.contentHosts.some(function(h){return new RegExp('^'+h+'$','i').test(uri.host);})||!new RegExp(policy.contentPath).test(uri.path)))return unchanged('unknown-content-path');
    segments.push({uri:lines[i],duration:pending.duration,extinf:pending.raw,key:key,disc:disc,absoluteDisc:discTotal,sequence:seq+segments.length,ad:ad});pending=null;disc=0;
  }
  if(!end||!target||segments.some(function(s){return Math.round(s.duration)>target;}))return unchanged('not-complete-vod');
  var groups=[],group=[];segments.forEach(function(s){if(s.disc&&group.length){groups.push(group);group=[];}group.push(s);});if(group.length)groups.push(group);
  var removed=[],seconds=0,total=segments.reduce(function(n,s){return n+s.duration;},0);
  groups.forEach(function(g,index){
    var before=groups[index-1],after=groups[index+1],sum=g.reduce(function(n,s){return n+s.duration;},0);
    if(after&&after[0].disc&&after.every(function(s){return !s.ad;})&&(policy.allowPrefix&&index===0||before&&g[0].disc&&before.every(function(s){return !s.ad;}))&&g.every(function(s){return s.ad&&s.key.method==='NONE';})&&(!policy.requireFollowingAES||after[0].key.method==='AES-128')&&sum<=policy.maxAdSeconds){g.forEach(function(s){removed.push(s);});seconds+=sum;}
  });
  if(!removed.length)return unchanged('no-confirmed-ad-run');
  var keep=segments.filter(function(s){return removed.indexOf(s)<0;});
  if(seconds/total>policy.maxRemovedFraction||keep.length<2)return unchanged('removal-budget');
  // Prefix deletion advances the first media sequence; internal deletion pins
  // original sequence-derived AES IVs on each retained encrypted segment.
  var output=header.map(function(line){return line.indexOf('#EXT-X-MEDIA-SEQUENCE:')===0?'#EXT-X-MEDIA-SEQUENCE:'+keep[0].sequence:line;});
  if(!seen['EXT-X-MEDIA-SEQUENCE'])output.push('#EXT-X-MEDIA-SEQUENCE:'+keep[0].sequence);
  var lastDisc=0,lastKey=null;
  var requiredVersion=1;keep.forEach(function(s,index){if(s.extinf.split(',')[0].indexOf('.')>=0)requiredVersion=Math.max(requiredVersion,3);if(s.key.method==='AES-128'&&(s.key.raw.indexOf('IV=')>=0||s.key.implicit&&s.sequence!==keep[0].sequence+index))requiredVersion=Math.max(requiredVersion,2);if(s.key.raw&&/KEYFORMAT(?:VERSIONS)?=/.test(s.key.raw))requiredVersion=Math.max(requiredVersion,5);});
  var versionIndex=output.findIndex(function(line){return line.indexOf('#EXT-X-VERSION:')===0;});if(versionIndex<0&&requiredVersion>1)output.splice(1,0,'#EXT-X-VERSION:'+requiredVersion);else if(versionIndex>=0)output[versionIndex]='#EXT-X-VERSION:'+Math.max(requiredVersion,Number(output[versionIndex].split(':')[1]));
  keep.forEach(function(s,index){
    var discontinuities=s.absoluteDisc-lastDisc;for(var j=0;j<discontinuities;j++)output.push('#EXT-X-DISCONTINUITY');lastDisc=s.absoluteDisc;
    var nextKey=s.key.raw;if(s.key.implicit&&s.sequence!==keep[0].sequence+index){nextKey+=',IV=0x'+('00000000000000000000000000000000'+s.sequence.toString(16)).slice(-32);}
    if(nextKey&&(nextKey!==lastKey||discontinuities))output.push(nextKey);
    else if(!nextKey&&lastKey&&lastKey.indexOf('METHOD=AES-128')>=0){nextKey='#EXT-X-KEY:METHOD=NONE';output.push(nextKey);}
    lastKey=nextKey;output.push(s.extinf,s.uri);
  });
  output.push('#EXT-X-ENDLIST');if(lines[lines.length-1]==='')output.push('');
  var rendered=output.join(newline);if(rendered.length>3*1024*1024)return unchanged('output-size');
  if(audit){audit.removedSegments=removed.length;audit.removedSeconds=seconds;audit.retainedSegments=keep.length;audit.reason='confirmed-ad-runs';}
  return rendered;
}
