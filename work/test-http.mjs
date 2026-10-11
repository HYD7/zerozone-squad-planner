import assert from 'node:assert/strict';import {spawn}from'node:child_process';import net from'node:net';import http from'node:http';
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,['outputs/zerozone-haritalar/server.cjs'],{env:{...process.env,ZEROZONE_PREVIEW_PORT:String(port)},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);
const request=(path,method='GET')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path,method},res=>{let bytes=0;res.on('data',b=>bytes+=b.length);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes}));});req.on('error',reject);req.setTimeout(5000,()=>req.destroy(Error('timeout')));req.end();});
let mock=null;
try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('server start timeout')),5000);child.stdout.once('data',()=>{clearTimeout(t);resolve();});child.once('exit',()=>reject(Error('server exited '+errors)));});
for(const path of ['/haritalar/','/haritalar/armor.html','/haritalar/app.js','/haritalar/armor-app.js','/haritalar/armor-exterior.js','/haritalar/data/catalog.json','/haritalar/data/armor/catalog.json','/haritalar/assets/brand/favicon.png','/haritalar/assets/vendor/draco/draco_decoder.wasm','/haritalar/data/armor/exterior/BP_M1A2.glb']){const r=await request(path,'HEAD');assert.equal(r.status,200,path);assert.equal(r.bytes,0);assert.equal(r.headers['x-content-type-options'],'nosniff');assert.match(r.headers['content-security-policy'],/worker-src 'self' blob:/);}
for(const [from,code,to] of [['/',302,'/haritalar/'],['/haritalar',301,'/haritalar/'],['/haritalar?map=Harju',301,'/haritalar/?map=Harju'],['/zirh',302,'/haritalar/armor.html'],['/zirh/',302,'/haritalar/armor.html'],['/zirh?x=1',302,'/haritalar/armor.html?x=1']]){const r=await request(from);assert.equal(r.status,code,from);assert.equal(r.headers.location,to,from);}
for(const path of ['/haritalar/missing.js','/haritalar/../package.json','/haritalar/%2e%2e%5cpackage.json','/haritalar/server.cjs','/haritalar/data/','/app.js','/armor.html','/data/catalog.json','/server.cjs'])assert.equal((await request(path)).status,404,path);
assert.equal((await request('/haritalar/armor.html','POST')).status,405);assert.equal((await request('/%ZZ')).status,400);
assert.equal((await request('/%00.json')).status,400);assert.equal((await request('/haritalar/armor.html','HEAD')).status,200,'server remains alive after malformed URL');
assert.equal((await request('/haritalar/assets/vendor/draco/draco_decoder.wasm','HEAD')).headers['content-type'],'application/wasm');
console.log('PASS: isolated HTTP server routes, HEAD, MIME, security headers, redirect query, method rejection, traversal, malformed/NUL URL and continued availability.');
assert.equal((await request('/api/haritalar/canli')).status,404,'live mock off by default');
const mport=await new Promise(r=>{const p=net.createServer();p.listen(0,'127.0.0.1',()=>{const x=p.address().port;p.close(()=>r(x));});});
mock=spawn(process.execPath,['outputs/zerozone-haritalar/server.cjs'],{env:{...process.env,ZEROZONE_PREVIEW_PORT:String(mport),ZEROZONE_LIVE_MOCK:'Gorodok_AAS_v1|AFU_LO_CombinedArms|RGF_LO_CombinedArms'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('mock start timeout')),5000);mock.stdout.once('data',()=>{clearTimeout(t);resolve();});});
const body=await new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:mport,path:'/api/haritalar/canli'},res=>{let t='';res.on('data',d=>t+=d);res.on('end',()=>resolve({status:res.statusCode,etag:res.headers.etag,json:JSON.parse(t)}));}).on('error',reject));
assert.equal(body.status,200);assert.ok(body.etag);assert.equal(body.json.layerId,'Gorodok_AAS_v1');assert.equal(body.json.teams[1].faction,'RGF');assert.equal(body.json.online,true);
console.log('PASS: live mock endpoint off by default (404) and ZEROZONE_LIVE_MOCK returns JSON with ETag.');
}finally{child.kill();if(mock)mock.kill();}
