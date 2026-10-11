import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=path.resolve('outputs/zerozone-haritalar');
const settle=async()=>{for(let i=0;i<40;i++)await new Promise(r=>setImmediate(r));};
const liveBody=(layerId,mapName,mode,u1,u2)=>({ok:true,online:true,layerId,mapName,mode,teams:[{index:1,faction:u1.split('_')[0],unit:u1},{index:2,faction:u2.split('_')[0],unit:u2}],nextLayerId:null,updatedAt:'2026-10-11T00:00:00Z'});
const units=JSON.parse(await fs.readFile(path.join(root,'data/units.json'),'utf8'));

async function boot({live,status=200,retryAfter=null}){
  const storage=new Map(),nodes=new Map(),errors=[],handlers={},timers=[],calls={live:0};
  const node=()=>({value:'',dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},append(){},insertAdjacentHTML(pos,html){this.innerHTML=(this.innerHTML||'')+html;},focus(){},close(){},showModal(){}});
  const document={querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];},createElement:node,body:node(),addEventListener(type,fn){(handlers[type]||=[]).push(fn);}};
  const fetchImpl=async url=>{
    if(url==='/api/haritalar/canli'){
      calls.live++;
      if(status!==200)return {ok:false,status,headers:{get:h=>h==='retry-after'?retryAfter:null},json:async()=>({})};
      return {ok:true,status:200,headers:{get:()=>null},json:async()=>JSON.parse(JSON.stringify(live))};
    }
    return {ok:true,status:200,headers:{get:()=>null},json:async()=>JSON.parse(await fs.readFile(path.join(root,url),'utf8'))};
  };
  const location={href:'http://127.0.0.1:4173/haritalar/',search:''};
  const context=vm.createContext({document,console:{...console,error:e=>errors.push(e),debug(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},location,history:{replaceState(){}},URL,URLSearchParams,crypto:webcrypto,Blob,
    setTimeout:(fn,ms)=>{const t={fn,ms,done:false};timers.push(t);return timers.length;},clearTimeout:h=>{if(timers[h-1])timers[h-1].done=true;},fetch:fetchImpl});
  const modules=new Map();
  async function load(file){
    if(modules.has(file))return modules.get(file);
    let source;
    if(file.endsWith('map-engine.js'))source=`export class TacticalMap{constructor(element,callbacks){this.element=element;this.callbacks=callbacks;this.annotations=[];this.overlays={};this.tool='pan';this.map={doubleClickZoom:{enable(){},disable(){}}};this.L={layerGroup:()=>({addTo(){return this},clearLayers(){}})};}setVisuals(){}setTool(v){this.tool=v;}setMap(c){this.config=c;this.annotations=[];}updateObjectives(c){Object.assign(this.config,c);}exportPlan(){return this.annotations;}importPlan(a){this.annotations=a;this.callbacks.onChange(a);} _renderObjectives(){} _renderRedZones(){} _renderAnnotations(){} getGrid(){return 'A1';}}`;
    else if(file.endsWith('planning-tools.js'))source=`export function createPlanningTools(){return {render(){},compare(){},timerPins(){return [];},restoreTimerPins(){}}}`;
    else source=await fs.readFile(file,'utf8');
    if(file.endsWith('app.js'))source+='\nexport {actions,liveSync};\nexport const dbg=()=>({layer:currentLayer.id,map:currentMap.id,follow:liveFollow});';
    const m=new vm.SourceTextModule(source,{context,identifier:file});modules.set(file,m);return m;
  }
  const app=await load(path.join(root,'app.js'));await app.link((spec,ref)=>load(path.resolve(path.dirname(ref.identifier),spec)));await app.evaluate();await settle();
  const click=async dataset=>{const b={dataset,hasAttribute:()=>false};for(const fn of handlers.click||[])await fn({target:{closest:()=>b}});await settle();};
  return {api:app.namespace,nodes,storage,errors,timers,calls,click,badge:()=>nodes.get('#live-badge')};
}

// (1) katalogda olmayan katman: rozet metni, dugme yok, secim degismez
{
  const t=await boot({live:liveBody('Sanxian_Invasion_v9','Sanxian','Invasion','AFU_LO_CombinedArms','RGF_LO_CombinedArms')});
  assert.equal(t.badge().hidden,false);
  assert.match(t.badge().innerHTML,/planlayıcıda yok/);
  assert.match(t.badge().innerHTML,/Sanxian_Invasion_v9/);
  assert.doesNotMatch(t.badge().innerHTML,/<button|live-return/);
  assert.deepEqual([t.api.dbg().map,t.api.dbg().layer],['Gorodok','Gorodok_AAS_v1']);
  assert.deepEqual(t.errors,[]);
  console.log('PASS 1: unknown layer -> "planlayicida yok", no button, selection unchanged.');
}
// (2) online:false -> rozet hidden
{
  const t=await boot({live:{ok:true,online:false}});
  assert.equal(t.badge().hidden,true);
  assert.equal(t.api.dbg().layer,'Gorodok_AAS_v1');assert.deepEqual(t.errors,[]);
  console.log('PASS 2: online:false hides badge.');
}
// (3) takip localStorage
{
  const t=await boot({live:liveBody('Gorodok_Invasion_v3','Gorodok','Invasion','AFU_LO_Armored','IMF_LD_CombinedArms')});
  assert.equal(t.storage.get('zerozone-maps-v1:live-follow'),'1');
  assert.equal(t.api.dbg().follow,true);
  await t.click({layer:'Gorodok_RAAS_v1'});
  assert.equal(t.api.dbg().layer,'Gorodok_RAAS_v1');
  assert.equal(t.storage.get('zerozone-maps-v1:live-follow'),'0');
  assert.equal(t.api.dbg().follow,false);
  console.log('PASS 3: live-follow 1 -> 0 on manual layer pick.');
}
// (5) bayrak img alt = fraksiyon adi, src dogru yol
{
  const t=await boot({live:liveBody('Gorodok_Invasion_v3','Gorodok','Invasion','AFU_LO_Armored','IMF_LD_CombinedArms')});
  const html=t.nodes.get('#matchup').innerHTML;
  const imgs=[...html.matchAll(/<img class="zz-flag" src="([^"]+)"[^>]*alt="([^"]*)"/g)].map(m=>({src:m[1],alt:m[2]}));
  assert.equal(imgs.length,2);
  for(const [i,code] of ['AFU','IMF'].entries()){
    assert.equal(imgs[i].src,`assets/squad/flags/${code}.webp`);
    assert.equal(imgs[i].alt,units.factions[code].name);
    assert.notEqual(imgs[i].alt,code);
    await fs.access(path.join(root,imgs[i].src));
  }
  console.log('PASS 5: flag alt = faction name, src correct and file exists.');
}
// (4) 429 + retry-after:5 -> bekleme boyunca istek yok
{
  const t=await boot({status:429,retryAfter:'5'});
  assert.equal(t.calls.live,1);
  const waits=t.timers.filter(x=>!x.done&&x.ms===5000);
  assert.equal(waits.length,1,'tek bekleme zamanlayicisi 5000 ms');
  await settle();await settle();
  assert.equal(t.calls.live,1,'bekleme suresince istek artmaz');
  assert.equal(t.badge().hidden,true);
  waits[0].done=true;waits[0].fn();await settle();
  assert.equal(t.calls.live,2,'sure dolunca tek istek');
  console.log('PASS 4: 429 retry-after:5 -> no requests until 5s timer fires, then exactly one.');
}
// (6) CSS / HTML
{
  const css=await fs.readFile(path.join(root,'styles.css'),'utf8'),html=await fs.readFile(path.join(root,'index.html'),'utf8');
  const rule=/#plan-count\s*\{([^}]*)\}/g;let m,found=false;
  while((m=rule.exec(css))){found=true;assert.match(m[1],/position\s*:\s*static/);}
  assert.ok(found,'#plan-count kurali var');
  assert.match(html,/class="page-heading-actions"/);
  console.log('PASS 6: #plan-count position:static; .page-heading-actions present.');
}
console.log('PASS: live UI states.');
