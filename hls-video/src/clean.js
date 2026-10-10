// Experimental VOD/TS subset. Unknown HLS state passes through unchanged.
function admHlsClean(body, policy) {
  if (typeof body!=='string' || body.length>2*1024*1024) return body;
  var newline=body.indexOf('\r\n')>=0?'\r\n':'\n',lines=body.split(newline);
  if(lines[0]!=='#EXTM3U')return body;
  var segments=[],endlist=-1,pending=-1,duration=null,discontinuity=false,seen={},target=0;
  for(var i=1;i<lines.length;i++) {
    var line=lines[i].trim(),match;
    if(!line)continue;
    if(endlist>=0)return body;
    if(line==='#EXT-X-ENDLIST') {
      if(pending>=0||!segments.length)return body;
      endlist=i;continue;
    }
    if(line==='#EXT-X-DISCONTINUITY') {
      if(discontinuity||duration!==null)return body;
      pending=i;discontinuity=true;continue;
    }
    if((match=line.match(/^#EXTINF:(\d+(?:\.\d+)?),.*$/))) {
      if(duration!==null)return body;
      duration=Number(match[1]);if(!(duration>0))return body;
      if(pending<0)pending=i;continue;
    }
    if(line[0]==='#') {
      // In particular: KEY/MAP/BYTERANGE/PART/PROGRAM-DATE-TIME/STREAM-INF are unsupported.
      match=line.match(/^#(EXT-X-(?:VERSION|TARGETDURATION|MEDIA-SEQUENCE|DISCONTINUITY-SEQUENCE)):(\d+)$/);
      var name=match?match[1]:line==='#EXT-X-PLAYLIST-TYPE:VOD'?'type':line==='#EXT-X-INDEPENDENT-SEGMENTS'?'independent':null;
      if(!name||segments.length||pending>=0||seen[name])return body;
      if(name==='EXT-X-TARGETDURATION'){target=Number(match[2]);if(!target)return body;}
      seen[name]=true;continue;
    }
    if(duration===null||pending<0)return body;
    // Recognize ordinary absolute, scheme-relative and relative TS URIs without changing them.
    var path=line.split('?')[0];
    if(/^[a-z][a-z0-9+.-]*:/i.test(path)&&!/^https?:\/\//i.test(path))return body;
    path=path.replace(/^(?:https?:)?\/\/[^/]+/i,'');
    if(!/\.ts$/i.test(path)||/[#\\\s]/.test(path))return body;
    segments.push({start:pending,end:i,uri:line,duration:duration,disc:discontinuity,ad:new RegExp(policy.adPath).test(path)});
    pending=-1;duration=null;discontinuity=false;
  }
  if(endlist<0||!target||pending>=0||segments.some(function(s){return Math.round(s.duration)>target;}))return body;
  var groups=[],group=[];
  segments.forEach(function(segment){if(segment.disc&&group.length){groups.push(group);group=[];}group.push(segment);});
  if(group.length)groups.push(group);
  var removed=[],adSeconds=0,totalSeconds=segments.reduce(function(n,s){return n+s.duration;},0);
  groups.forEach(function(g,index){
    // Only complete ad runs bounded by discontinuities, with content on both sides.
    var seconds=g.reduce(function(n,s){return n+s.duration;},0);
    if(index>0&&index<groups.length-1&&g[0].disc&&groups[index+1][0].disc&&g.every(function(s){return s.ad;})&&groups[index-1].every(function(s){return !s.ad;})&&groups[index+1].every(function(s){return !s.ad;})&&seconds<=policy.maxAdSeconds) {
      removed.push(g);adSeconds+=seconds;
    }
  });
  if(!removed.length||adSeconds/totalSeconds>policy.maxRemovedFraction)return body;
  var count=removed.reduce(function(n,g){return n+g.length;},0);
  if(segments.length-count<2)return body;
  var drop={};removed.forEach(function(g){for(var j=g[0].start;j<=g[g.length-1].end;j++)drop[j]=true;});
  // Retain the following discontinuity and all content URI/header bytes.
  return lines.filter(function(_,index){return !drop[index];}).join(newline);
}
function admHlsRun(templates) {
  var original=$response.body,output=original;
  try {
    var url=$request.url||'',method=($request.method||'GET').toUpperCase(),status=$response.statusCode;
    var match=url.match(/^https?:\/\/([^/:?#]+)(\/[^#]*)$/i);
    if(match&&method==='GET'&&!(typeof status==='number'&&status>=400)) {
      var policy=templates.filter(function(t){return new RegExp('^'+t.host+'$','i').test(match[1])&&new RegExp('^'+t.path).test(match[2]);})[0];
      if(policy)output=admHlsClean(original,policy);
    }
  }catch(_){output=original;}
  $done(typeof output==='string'&&output!==original?{body:output}:{});
}
