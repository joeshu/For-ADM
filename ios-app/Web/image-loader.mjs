// Images travel through the same HTTPS bridge so file:// origins do not lose the site's Referer.
const cache=new Map(),queue=[];let active=0,cacheBytes=0;
const cacheLimit=20*1024*1024,maxCacheItems=36;
export function imageData(response){
 if(response.status!==200||response.bodyBase64?.length>2800000)throw Error('图片不可用');
 const b=response.bodyBase64||'',prefix=atob(b.slice(0,24));
 const mime=b.startsWith('/9j/')?'image/jpeg':b.startsWith('iVBORw0KGgo')?'image/png':b.startsWith('R0lGOD')?'image/gif':prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP'?'image/webp':'';
 if(!mime)throw Error('图片格式不支持');return 'data:'+mime+';base64,'+b;
}
function pump(){while(active<4&&queue.length){const job=queue.shift();if(!job.img.isConnected)continue;active++;job.run().finally(()=>{active--;pump();});}}
export function loadVisibleImages(root,imageMap,request,referer){
 const controller=new AbortController(),jobs=new Set();let stopped=false;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);enqueue(entry.target);}}, {rootMargin:'240px'});
 function enqueue(img){const urls=imageMap.get(img.dataset.image)||[],job={img,owner:jobs,run:async()=>{for(const url of urls.slice(0,3)){if(stopped||!img.isConnected)return;try{let entry=cache.get(url),data=entry?.data;if(entry){cache.delete(url);cache.set(url,entry);}else{data=imageData(await request({url,method:'GET',headers:{Referer:referer},signal:controller.signal}));const size=data.length*2;if(size<=4*1024*1024){entry={data,size};cache.set(url,entry);cacheBytes+=size;while(cache.size>maxCacheItems||cacheBytes>cacheLimit){const [oldest,value]=cache.entries().next().value;cache.delete(oldest);cacheBytes-=value.size;}}}if(!stopped&&img.isConnected)img.src=data;return;}catch(error){if(error.name==='AbortError')return;}}if(!stopped&&img.isConnected)img.remove();}};jobs.add(job);queue.push(job);pump();}
 function observe(container=root){for(const img of container.querySelectorAll('img[data-image]'))if(!img.hasAttribute('src'))observer.observe(img);}
 observe(root);
 // Observers are disconnected on the next render to avoid retaining removed DOM nodes.
 const stop=()=>{stopped=true;observer.disconnect();controller.abort();for(const job of jobs){const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);}jobs.clear();};
 stop.observe=(container,nextImageMap)=>{if(stopped)return;if(nextImageMap instanceof Map)imageMap=nextImageMap;observe(container);};
 return stop;
}
