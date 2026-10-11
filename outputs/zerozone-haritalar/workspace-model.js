import {cleanPinnedTimers} from './planning-model.js';
import {displayMode} from './accessibility.js';
import {cleanRegions} from './region-model.js';
export const DATA_VERSION='2026-10-05';
export function cleanDisplay(value={}){
  const size=(v,f,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
  return {colorIntensity:size(value.colorIntensity,70,0,100),colorMode:displayMode(value),colorBlind:displayMode(value)!=='none',markerSize:size(value.markerSize,29,22,44),labelSize:size(value.labelSize,12,11,16)};
}
export function cleanSets(value=[]){
  if(!Array.isArray(value)||value.length>20)throw Error('En fazla 20 sınır seti saklanabilir.');
  const ids=new Set();
  return value.map(v=>{
    if(!v||typeof v.id!=='string'||!v.id||v.id.length>100||ids.has(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>80)throw Error('Sınır seti geçersiz.');
    ids.add(v.id);return {id:v.id,name:v.name.trim(),state:cleanRegions(v.state)};
  });
}
export function cleanBundle(value,catalog){
  if(!value||value.schema!==2||value.kind!=='zerozone-workspace'||!value.plan)throw Error('Birleşik yedek geçersiz.');
  const p=value.plan;
  if(!catalog.some(m=>m.id===p.map&&m.layers.some(l=>l.id===p.layer)))throw Error('Yedek harita/katman eşleşmesi geçersiz.');
  const timerPins=value.timerPins===undefined?undefined:cleanPinnedTimers(value.timerPins,p.layer);if(timerPins?.length>3)throw Error('Bir katmanda en fazla üç sayaç olabilir.');
  return {...value,timerPins,regions:cleanRegions(value.regions),sets:cleanSets(value.sets),display:cleanDisplay(value.display)};
}
export function copyRegions(source,current,mode='append',idFactory=()=>crypto.randomUUID()){
  const incoming=cleanRegions(source),target=cleanRegions(current);
  if(!['append','replace'].includes(mode))throw Error('Kopyalama yöntemi geçersiz.');
  const regions=incoming.regions.map(r=>({...r,id:'copy-'+idFactory()}));
  return cleanRegions({...target,regions:mode==='replace'?regions:[...target.regions,...regions]});
}
export function readableLayer(id){const p=String(id??'').split('_');return p.length<2?String(id??''):p[0]+' · '+p.slice(1).join(' ');}
