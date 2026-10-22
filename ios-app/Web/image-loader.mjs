// Images travel through the same HTTPS bridge so file:// origins do not lose the site's Referer.
const cache=new Map(),queue=[];let active=0;
export function imageData(response){
 if(response.status!==200||response.bodyBase64?.length>2800000)throw Error('图片不可用');
 const b=response.bodyBase64||'',prefix=atob(b.slice(0,24));
 const mime=b.startsWith('/9j/')?'image/jpeg':b.startsWith('iVBORw0KGgo')?'image/png':b.startsWith('R0lGOD')?'image/gif':prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP'?'image/webp':'';
 if(!mime)throw Error('图片格式不支持');return 'data:'+mime+';base64,'+b;
}
function pump(){while(active<4&&queue.length){const job=queue.shift();if(!job.img.isConnected)continue;active++;job.run().finally(()=>{active--;pump();});}}
export function loadVisibleImages(root,imageMap,request,referer){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);enqueue(entry.target);}}, {rootMargin:'240px'});
 function enqueue(img){const urls=imageMap.get(img.dataset.image)||[];queue.push({img,run:async()=>{for(const url of urls.slice(0,3)){if(!img.isConnected)return;try{let data=cache.get(url);if(!data){data=imageData(await request({url,method:'GET',headers:{Referer:referer}}));cache.set(url,data);while(cache.size>100)cache.delete(cache.keys().next().value);}if(img.isConnected)img.src=data;return;}catch{}}if(img.isConnected)img.remove();}});pump();}
 for(const img of root.querySelectorAll('img[data-image]'))observer.observe(img);
 // Observers are disconnected on the next render to avoid retaining removed DOM nodes.
 return ()=>observer.disconnect();
}
