function __forAdmKKCleanV2(value,depth){
 depth=depth||0;if(depth>8||!value||typeof value!=='object')return value;
 function ad(item){
  if(!item||typeof item!=='object')return false;
  if(item.post&&typeof item.post==='object')item=item.post;
  if(item.text==='精彩应用'&&typeof item.url==='string'&&item.url)return true;
  if(['ad','ad_mp4','ad_h264'].indexOf(item.type)>=0||['ad_home','ad_home2','ad_topic','ad_netflix','ad_netflix_topic'].indexOf(item._vod)>=0)return true;

  if(!('title'in item||'name'in item||'coverPath'in item||'imagePath'in item||'image'in item||'text'in item||'summary'in item))return false;
  var link=item.url;if(typeof link!=='string')return false;
  if(/^(?:web|browser)\?/.test(link)){try{var params=new URLSearchParams(link.slice(link.indexOf('?')+1));link=params.get('url')||params.get('urls')||'';for(var round=0;round<2&&/%[0-9a-f]{2}/i.test(link);round++){try{var decoded=decodeURIComponent(link);if(decoded===link)break;link=decoded}catch(ignore){break}}}catch(e){return false}}
  if(!/^https?:\/\//i.test(link))return false;
  if(['video','mp4','h264'].indexOf(item.type)>=0&&/\.(?:mp4|m3u8|mpd|m4v|webm)(?:[?#]|$)/i.test(link))return false;
  try{var urls=link.split('|');return urls.every(function(entry){var parsed=new URL(entry);return parsed.origin!==location.origin&&!__forAdmMediaAllowedHosts.some(function(pattern){return new RegExp('^'+pattern+'$','i').test(parsed.hostname)});});}catch(e){return false}
 }
 if(Array.isArray(value)){var changed=false,out=[];value.forEach(function(item){if(ad(item)){changed=true;return}var next=__forAdmKKCleanV2(item,depth+1);if(next!==item)changed=true;if(next!==item&&next&&/^section[0-9]+$/.test(next._vod||'')&&Array.isArray(item.data)&&item.data.length>0&&Array.isArray(next.data)&&next.data.length===0){changed=true;return}out.push(next)});return changed?out:value;}
 var copy=value;['data','blocks','items','list','reco','banners','hd','trailer','vods'].forEach(function(key){var child=value[key];if(!child||typeof child!=='object')return;var next=__forAdmKKCleanV2(child,depth+1);if(next!==child){if(copy===value){copy={};Object.keys(value).forEach(function(k){if(k!=='__proto__'&&k!=='constructor'&&k!=='prototype')copy[k]=value[k]});}copy[key]=next;}});return copy;
}
