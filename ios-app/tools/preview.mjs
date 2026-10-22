import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../Web/',import.meta.url)),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{try{if(req.url==='/__transport'&&req.method==='POST'){
 if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`&&req.headers.origin!==`http://localhost:${port}`)throw Error('Unknown preview origin');
 let text='';for await(const part of req){text+=part;if(text.length>1048576)throw Error('Request too large');}const data=JSON.parse(text),url=new URL(data.url);
 if(url.protocol!=='https:'||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\])/i.test(url.hostname)||!['GET','POST','HEAD'].includes(data.method))throw Error('Unsupported request');
 const r=await fetch(url,{method:data.method,headers:data.headers,body:data.method==='POST'?data.body:undefined,signal:AbortSignal.timeout(20000)}),body=Buffer.from(await r.arrayBuffer());if(body.length>12*1024*1024)throw Error('Response too large');
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:r.status,headers:Object.fromEntries(r.headers),bodyBase64:body.toString('base64')}));return;
 }
 const filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!filename.startsWith(root)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(filename).pipe(res);
 }catch(error){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));
