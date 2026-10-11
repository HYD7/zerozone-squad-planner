const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,port=Number(process.env.ZEROZONE_PREVIEW_PORT||4173);
const mime={'.glb':'model/gltf-binary','.wasm':'application/wasm','.bin':'application/octet-stream','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname.includes('\0')){res.writeHead(400);res.end();return;}
 const search=new URL(req.url,'http://localhost').search;
 const redirect=(code,loc)=>{res.writeHead(code,{Location:loc});res.end();};
 if(pathname==='/'){redirect(302,'/haritalar/'+search);return;}
 if(pathname==='/haritalar'){redirect(301,'/haritalar/'+search);return;}
 if(pathname==='/zirh'||pathname==='/zirh/'){redirect(302,'/haritalar/armor.html'+search);return;}
 const liveMock=process.env.ZEROZONE_LIVE_MOCK;
 if(pathname==='/api/haritalar/canli'&&liveMock){
  const [layerId,u1,u2]=liveMock.split('|'),m=/^(.*?)_([A-Za-z]+)_(v\d+\w*)$/.exec(layerId||'');
  if(!m||!/^[\w.-]+$/.test(u1||'')||!/^[\w.-]+$/.test(u2||'')){res.writeHead(404);res.end('Not found');return;}
  const body=JSON.stringify({ok:true,online:true,layerId,mapName:m[1],mode:m[2],teams:[{index:1,faction:u1.split('_')[0],unit:u1},{index:2,faction:u2.split('_')[0],unit:u2}],nextLayerId:null,updatedAt:new Date().toISOString()});
  const etag='"'+crypto.createHash('sha1').update(layerId+'|'+u1+'|'+u2).digest('hex').slice(0,16)+'"';
  if(req.headers['if-none-match']===etag){res.writeHead(304,{ETag:etag,'Cache-Control':'no-store'});res.end();return;}
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),ETag:etag,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);return;
 }
 if(!pathname.startsWith('/haritalar/')){res.writeHead(404);res.end('Not found');return;}
 pathname='/'+(pathname.slice('/haritalar/'.length)||'index.html');
 const file=path.resolve(base,'.'+pathname);if(!file.startsWith(base+path.sep)||!mime[path.extname(file)]){res.writeHead(404);res.end('Not found');return;}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);});
}).listen(port,'127.0.0.1',()=>console.log(`ZeroZone private preview: http://127.0.0.1:${port}/haritalar/`));
