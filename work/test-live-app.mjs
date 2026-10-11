import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=path.resolve('outputs/zerozone-haritalar');
const settle=async()=>{for(let i=0;i<40;i++)await new Promise(r=>setImmediate(r));};
const liveBody=(layerId,mapName,mode,u1,u2)=>({ok:true,online:true,layerId,mapName,mode,teams:[{index:1,faction:u1.split('_')[0],unit:u1},{index:2,faction:u2.split('_')[0],unit:u2}],nextLayerId:null,updatedAt:'2026-10-11T00:00:00Z'});
const INVASION=()=>liveBody('Gorodok_Invasion_v3','Gorodok','Invasion','AFU_LO_Armored','IMF_LD_CombinedArms');
const RAAS2=()=>liveBody('Gorodok_RAAS_v2','Gorodok','RAAS','USMC_LO_CombinedArms','VDV_LO_CombinedArms');

async function boot({search='',storageInit={},live}){
  const storage=new Map(Object.entries(storageInit).map(([k,v])=>['zerozone-maps-v1:'+k,v])),nodes=new Map(),errors=[],handlers={};
  const node=()=>({value:'',dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},append(){},insertAdjacentHTML(pos,html){this.innerHTML=(this.innerHTML||'')+html;},focus(){},close(){},showModal(){}});
  const document={querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];},createElement:node,body:node(),addEventListener(type,fn){(handlers[type]||=[]).push(fn);}};
  const env={live,gate:null},urls=[];
  class FakeImg{constructor(){this.cls=new Set();this.classList={contains:c=>this.cls.has(c),add:c=>this.cls.add(c)};}}
  const fetchImpl=async url=>{
    if(url==='/api/haritalar/canli'){
      if(env.live==null)return {ok:false,status:404,headers:{get:()=>null},json:async()=>({})};
      const body=typeof env.live==='function'?env.live():env.live;
      return {ok:true,status:200,headers:{get:()=>null},json:async()=>JSON.parse(JSON.stringify(body))};
    }
    if(env.gate&&url===env.gate.url)await env.gate.promise;
    return {ok:true,status:200,headers:{get:()=>null},json:async()=>JSON.parse(await fs.readFile(path.join(root,url),'utf8'))};
  };
  const location={href:'http://127.0.0.1:4173/haritalar/'+search,search};
  const context=vm.createContext({document,console:{...console,error:e=>errors.push(e),debug(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},location,history:{replaceState(_a,_b,u){urls.push(String(u));}},HTMLImageElement:FakeImg,URL,URLSearchParams,crypto:webcrypto,Blob,setTimeout:()=>0,clearTimeout(){},fetch:fetchImpl});
  const modules=new Map();
  async function load(file){
    if(modules.has(file))return modules.get(file);
    let source;
    if(file.endsWith('map-engine.js'))source=`export class TacticalMap{constructor(element,callbacks){this.element=element;this.callbacks=callbacks;this.annotations=[];this.overlays={};this.tool='pan';this.map={doubleClickZoom:{enable(){},disable(){}}};this.L={layerGroup:()=>({addTo(){return this},clearLayers(){}})};}setVisuals(){}setTool(v){this.tool=v;}setMap(c){this.config=c;this.annotations=[];}updateObjectives(c){Object.assign(this.config,c);}exportPlan(){return this.annotations;}importPlan(a){if(!Array.isArray(a))throw Error('invalid annotations');this.annotations=a;this.callbacks.onChange(a);} _renderObjectives(){} _renderRedZones(){} _renderAnnotations(){} getGrid(){return 'A1';}}`;
    else if(file.endsWith('planning-tools.js'))source=`export function createPlanningTools(){return {render(){},compare(){},timerPins(){return [];},restoreTimerPins(){}}}`;
    else source=await fs.readFile(file,'utf8');
    if(file.endsWith('app.js'))source+='\nexport {actions,liveSync,map};\nexport const dbg=()=>({units:chosenUnits.slice(),layer:currentLayer.id,map:currentMap.id,follow:liveFollow,solved:liveSolved});';
    const m=new vm.SourceTextModule(source,{context,identifier:file});modules.set(file,m);
    return m;
  }
  const app=await load(path.join(root,'app.js'));await app.link((spec,ref)=>load(path.resolve(path.dirname(ref.identifier),spec)));await app.evaluate();
  await settle();
  const click=async dataset=>{const b={dataset,hasAttribute:()=>false};for(const fn of handlers.click||[])await fn({target:{closest:()=>b}});await settle();};
  return {env,urls,handlers,FakeImg,api:app.namespace,nodes,storage,errors,click,badge:()=>nodes.get('#live-badge'),poll:async()=>{await app.namespace.liveSync.pollNow();await settle();}};
}

// (1) canli yanitla acilis
{
  const t=await boot({live:INVASION});
  const s=t.api.dbg();
  assert.equal(s.map,'Gorodok');assert.equal(s.layer,'Gorodok_Invasion_v3');assert.equal(s.follow,true);
  assert.deepEqual(s.units,['AFU_LO_Armored','IMF_LD_CombinedArms']);
  assert.equal(t.badge().hidden,false);
  assert.match(t.badge().innerHTML,/CANLI · Gorodok Invasion v3 — AFU vs IMF/);
  assert.equal(t.storage.get('zerozone-maps-v1:live-follow'),'1');
  assert.deepEqual(t.errors,[]);
  // (7) bayraklar
  assert.match(t.nodes.get('#matchup').innerHTML,/<img class="zz-flag" src="assets\/squad\/flags\/AFU\.webp" width="28" height="28" alt="[^"]+"/);
  assert.match(t.nodes.get('#matchup').innerHTML,/flags\/IMF\.webp/);
  assert.match(t.nodes.get('#matchup').innerHTML,/faction-code/,'kod rozeti flag yaninda kalir');
  const side=t.nodes.get('#side-content').innerHTML;
  assert.match(side,/src="assets\/squad\/flags\/AFU\.webp" width="20" height="20" alt=""/);
  assert.match(side,/<span class="faction-code">AFU<\/span>/,'renk koru icin kod rozeti kalir');
  console.log('PASS 1+7: live open selects layer/units/badge; flags in matchup and layer cards.');

  // (3) elle katman secimi takibi kapatir
  await t.click({layer:'Gorodok_RAAS_v1'});
  assert.equal(t.api.dbg().layer,'Gorodok_RAAS_v1');assert.equal(t.api.dbg().follow,false);
  assert.equal(t.storage.get('zerozone-maps-v1:live-follow'),'0');
  assert.match(t.badge().innerHTML,/○|Canlı: Gorodok Invasion v3/);assert.match(t.badge().innerHTML,/Canlıya dön/);assert.doesNotMatch(t.badge().innerHTML,/CANLI ·/);
  console.log('PASS 3: manual layer click turns follow off.');

  // (4) Canliya don
  await t.api.actions['live-return']();await settle();
  assert.equal(t.api.dbg().layer,'Gorodok_Invasion_v3');assert.equal(t.api.dbg().follow,true);
  assert.deepEqual(t.api.dbg().units,['AFU_LO_Armored','IMF_LD_CombinedArms']);
  assert.match(t.badge().innerHTML,/CANLI ·/);assert.doesNotMatch(t.badge().innerHTML,/Canlıya dön/);
  console.log('PASS 4: "Canlıya dön" returns to live layer with follow on.');
}

// (5) cizim varken guncelleme: otomatik gecmez, toast
{
  let body=INVASION();
  const t=await boot({live:()=>body});
  assert.equal(t.api.dbg().layer,'Gorodok_Invasion_v3');
  t.api.map.importPlan([{id:'a1',type:'pin'}]);
  body=RAAS2();await t.poll();
  assert.equal(t.api.dbg().layer,'Gorodok_Invasion_v3','cizim varken otomatik gecmez');
  const toast=t.nodes.get('#toast');
  assert.equal(toast.hidden,false);assert.match(toast.textContent,/Sunucuda harita değişti: Gorodok RAAS v2 — USMC vs VDV/);assert.match(toast.innerHTML,/data-action="live-switch"/);
  assert.match(t.badge().innerHTML,/CANLI · Gorodok RAAS v2/,'rozet yeni canliyi gosterir');
  await t.api.actions['live-switch']();await settle();
  assert.equal(t.api.dbg().layer,'Gorodok_RAAS_v2');assert.equal(t.api.dbg().follow,true);
  assert.deepEqual(t.api.dbg().units,['USMC_LO_CombinedArms','VDV_LO_CombinedArms']);
  // cizim yokken otomatik gec
  body=INVASION();await t.poll();
  assert.equal(t.api.dbg().layer,'Gorodok_Invasion_v3','cizim yokken otomatik gecer');
  assert.deepEqual(t.errors,[]);
  console.log('PASS 5: with drawings live change shows toast, no auto switch; switch keeps follow; without drawings auto switches.');
}

// (2) ?map= ile acilis: takip kapali
{
  const t=await boot({search:'?map=Gorodok&layer=Gorodok_RAAS_v1',live:INVASION});
  assert.equal(t.api.dbg().layer,'Gorodok_RAAS_v1');assert.equal(t.api.dbg().follow,false);
  assert.equal(t.badge().hidden,false);
  assert.equal(t.storage.has('zerozone-maps-v1:live-follow'),false,'?map= acilisi live-follow yazmaz');
  assert.match(t.badge().innerHTML,/Canlı: Gorodok Invasion v3/);assert.match(t.badge().innerHTML,/data-action="live-return"[^>]*>Canlıya dön/);
  console.log('PASS 2: ?map= start keeps follow off, badge and return button visible.');
}

// katalogda olmayan canli katman
{
  const t=await boot({live:liveBody('Nonexistent_AAS_v1','Nonexistent','AAS','AFU_LO_CombinedArms','RGF_LO_CombinedArms')});
  assert.equal(t.badge().hidden,false);assert.match(t.badge().innerHTML,/Canlı: Nonexistent_AAS_v1 \(planlayıcıda yok\)/);assert.doesNotMatch(t.badge().innerHTML,/Canlıya dön/);
  assert.equal(t.api.dbg().layer,'Gorodok_AAS_v1','eski davranis');
  console.log('PASS: unknown live layer shows "planlayicida yok" without button.');
}

// (6) 404: rozet gizli, gurultu yok
{
  const t=await boot({live:null});
  assert.equal(t.badge().hidden,true);assert.deepEqual(t.errors,[]);assert.equal(t.api.dbg().layer,'Gorodok_AAS_v1');
  console.log('PASS 6: 404 hides badge without errors, legacy open behavior.');
}
// (a) canli uc 404 olunca URL'ye map/layer geri yazilir, liveSolved null
{
  const t=await boot({live:INVASION});
  assert.equal(t.api.dbg().follow,true);assert.ok(t.api.dbg().solved);
  const u=new URL(t.urls.at(-1));assert.equal(u.searchParams.has('map'),false,'takipte URL haritasiz');
  t.env.live=null;await t.poll();
  const v=new URL(t.urls.at(-1));
  assert.equal(v.searchParams.get('map'),'Gorodok');assert.equal(v.searchParams.get('layer'),'Gorodok_Invasion_v3');
  assert.equal(t.api.dbg().solved,null);assert.equal(t.badge().hidden,true);
  console.log('PASS a: 404 after follow restores ?map=&layer= and clears liveSolved.');
}
// takip kapaninca URL aninda guncellenir + Takibi kapat
{
  const t=await boot({live:INVASION});
  assert.match(t.badge().innerHTML,/data-action="live-unfollow"[^>]*>Takibi kapat/);
  await t.click({layer:'Gorodok_RAAS_v1'});
  const u=new URL(t.urls.at(-1));assert.equal(u.searchParams.get('map'),'Gorodok');assert.equal(u.searchParams.get('layer'),'Gorodok_RAAS_v1');
  const t2=await boot({live:INVASION});
  assert.equal(new URL(t2.urls.at(-1)).searchParams.has('layer'),false);
  await t2.api.actions['live-unfollow']();await settle();
  assert.equal(t2.storage.get('zerozone-maps-v1:live-follow'),'0');
  assert.match(t2.badge().innerHTML,/Canlı: /);assert.match(t2.badge().innerHTML,/Canlıya dön/);assert.doesNotMatch(t2.badge().innerHTML,/Takibi kapat/);
  assert.equal(new URL(t2.urls.at(-1)).searchParams.get('layer'),'Gorodok_Invasion_v3');
  console.log('PASS b: unfollow updates URL and badge.');
}
// (a2) online:false
{
  let body=INVASION();const t=await boot({live:()=>body});
  body={...INVASION(),online:false};await t.poll();
  const v=new URL(t.urls.at(-1));assert.equal(v.searchParams.get('layer'),'Gorodok_Invasion_v3');assert.equal(t.api.dbg().solved,null);
  console.log('PASS a2: online:false restores URL and clears liveSolved.');
}
// (b) ?map= ile ve 'Canliya don' sonrasi yazim
{
  const t=await boot({search:'?map=Gorodok&layer=Gorodok_RAAS_v1',live:INVASION});
  assert.equal(t.storage.has('zerozone-maps-v1:live-follow'),false);
  await t.api.actions['live-return']();await settle();
  assert.equal(t.storage.get('zerozone-maps-v1:live-follow'),'1');
  console.log('PASS b: pinned open does not write live-follow; return writes 1.');
}
// (c) goLive sirasinda kullanici baska katman secerse birlikler yanlis katmana yazilmaz
{
  const catalog=JSON.parse(await fs.readFile(path.join(root,'data/catalog.json'),'utf8'));
  const other=catalog.find(m=>m.id!=='Gorodok'),od=JSON.parse(await fs.readFile(path.join(root,`data/${other.id}.json`),'utf8')),ol=od[0];
  const gor=JSON.parse(await fs.readFile(path.join(root,'data/Gorodok.json'),'utf8')),raas=gor.find(l=>l.id==='Gorodok_RAAS_v1');
  let body=INVASION();const t=await boot({live:()=>body});
  let release;t.env.gate={url:`data/${other.id}.json`,promise:new Promise(r=>{release=r;})};
  body=liveBody(ol.id,other.id,ol.mode,ol.teams[0].unit,ol.teams[1].unit);await t.poll();
  await t.click({layer:'Gorodok_RAAS_v1'});
  release();await settle();
  const s=t.api.dbg();
  assert.equal(s.layer,'Gorodok_RAAS_v1');assert.equal(s.map,'Gorodok');assert.equal(s.follow,false);
  assert.deepEqual(s.units,raas.teams.map(x=>x.unit),'birlikler kullanicinin sectigi katmanin');
  assert.deepEqual(t.errors,[]);
  console.log('PASS c: goLive race does not write units to the wrong layer.');
}
// (d) bayrak hata olayi
{
  const t=await boot({live:INVASION});
  const {flagImg}=await import('../outputs/zerozone-haritalar/faction-flags.js');
  assert.ok(!flagImg('AFU').includes('onerror'));
  const img=new t.FakeImg();img.cls.add('zz-flag');
  for(const fn of t.handlers.error||[])fn({target:img});
  assert.ok(img.cls.has('is-missing'));
  const other=new t.FakeImg();for(const fn of t.handlers.error||[])fn({target:other});assert.equal(other.cls.has('is-missing'),false);
  console.log('PASS d: error event marks .zz-flag is-missing, no inline onerror.');
}
console.log('PASS: live follow, badge, toast and flag rendering in the actual app (DOM/map substitutes).');
