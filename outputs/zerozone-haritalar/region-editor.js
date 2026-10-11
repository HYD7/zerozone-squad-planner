import {paletteFor} from './accessibility.js';
import {cleanRegions,validPolygon,RegionHistory} from './region-model.js';
import {readableLayer} from './workspace-model.js';
const clone=v=>JSON.parse(JSON.stringify(v));
export function createRegionEditor({map,readStore,store,toast,escape:esc,getTab,getExtras=()=>''}){
  const L=map.L,handles=L.layerGroup().addTo(map.map),preview=L.layerGroup().addTo(map.map);
  let layerId='',source={},history,selected=null,points=[],replacement=null,active=false;
  const bar=document.createElement('div');bar.className='region-drawbar';bar.hidden=true;document.querySelector('#map-stage').append(bar);
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
  const api={get active(){return active;},get drawing(){return !!points.length||replacement!==null;},load,render,enter,leave,data,handlePoint,handleMove,setVisible,undo,redo,snapshot:()=>cleanRegions(history.value),restore};
  map.regionEditor=api;
  function load(id,base){
    cancel();handles.clearLayers();layerId=id;source=clone(base||{regions:[]});selected=null;
    const defaults=initial();
    try{history=new RegionHistory(readStore('regions:'+id,defaults));}catch{history=new RegionHistory(defaults);toast('Kayıtlı bölgeler okunamadı; başlangıç sınırları açıldı.');}
    active=getTab()==='regions';
    syncSwitch();
  }
  function initial(){return {visible:true,hatch:true,regions:(source.regions||[]).map((r,i)=>({...r,name:r.name||`Takım ${r.team} sınırı`,visible:true}))};}
  function data(){return {...source,regions:history?.value.regions||[],playableBoundary:history?.value.hatch===false?undefined:source.playableBoundary};}
  function syncSwitch(){if(!history)return;map.overlays.redZones=history.value.visible;const toggle=document.querySelector('[data-overlay="redZones"]');if(toggle)toggle.checked=history.value.visible;}
  function refresh(save=true){
    if(save)store('regions:'+layerId,history.value);
    syncSwitch();if(map.config){map.config.redZones=data();map._renderRedZones();}
    renderHandles();render();
  }
  function change(next){try{if(history.commit(next))refresh();}catch(e){toast(e.message);renderHandles();}}
  function setVisible(visible){if(history)change({...history.value,visible});}
  function restore(value){const clean=cleanRegions(value);cancel();selected=null;change(clean);}
  function enter(){active=true;map.setTool('pan');map.map.doubleClickZoom.disable();renderHandles();render();}
  function leave(){active=false;cancel();handles.clearLayers();if(map.tool==='pan')map.map.doubleClickZoom.enable();}
  function cancel(){points=[];replacement=null;preview.clearLayers();bar.hidden=true;}
  function select(id){active=true;map.setTool('pan');map.map.doubleClickZoom.disable();cancel();selected=id;if(!history.value.visible)setVisible(true);const r=history.value.regions.find(r=>r.id===id);if(r&&!r.visible)change({...history.value,regions:history.value.regions.map(r=>r.id===id?{...r,visible:true}:r)});renderHandles();render();}
  function start(id=null){
    if(history.value.regions.length>=100&&!id){toast('En fazla 100 alan oluşturabilirsin.');return;}
    active=true;map.setTool('pan');map.map.doubleClickZoom.disable();cancel();selected=id;replacement=id||'';
    if(!history.value.visible)setVisible(true);
    handles.clearLayers();drawPreview();render();bar.scrollIntoView({block:'nearest'});
  }
  function drawPreview(cursor){
    preview.clearLayers();bar.hidden=replacement===null;
    if(bar.hidden)return;
    const path=cursor?[...points,cursor]:points;
    if(path.length>1)L.polyline(path.map(p=>map._latLng(p)),{color:paletteFor(map.colorMode).danger,weight:2,dashArray:'5 5',interactive:false}).addTo(preview);
    if(path.length>2)L.polygon(path.map(p=>map._latLng(p)),{color:'#f42538',weight:1,fillOpacity:.13,interactive:false}).addTo(preview);
    points.forEach((p,i)=>{const m=L.circleMarker(map._latLng(p),{radius:5,color:'#fff',fillColor:paletteFor(map.colorMode).danger,fillOpacity:1,weight:2}).addTo(preview);if(i===0&&points.length>=3)m.on('click',e=>{L.DomEvent.stopPropagation(e);finish();});});
    bar.innerHTML=`<span>${points.length} köşe</span><button data-region-action="finish" ${points.length<3?'disabled':''}>Çizimi bitir</button><button data-region-action="point-undo" ${points.length?'':'disabled'}>Son köşeyi sil</button><button data-region-action="cancel">Vazgeç</button>`;
  }
  function handlePoint(p){
    if(!active)return false;
    if(replacement!==null){if(points.length>=500){toast('En fazla 500 köşe.');return true;}if(!points.length||Math.hypot(points.at(-1).x-p.x,points.at(-1).y-p.y)>1e-5)points.push({x:p.x,y:p.y});drawPreview();}
    return true;
  }
  function handleMove(p){if(!active||replacement===null)return false;drawPreview(p);return true;}
  function finish(){
    if(!validPolygon(points)){toast('En az üç köşe seç; sınır çizgileri birbirini kesmesin.');return;}
    const existing=history.value.regions.find(r=>r.id===replacement);
    const region={...(existing||{id:'custom-'+crypto.randomUUID(),name:`Yeni alan ${history.value.regions.length+1}`,team:1}),visible:true,points:clone(points)};
    const regions=existing?history.value.regions.map(r=>r.id===existing.id?region:r):[...history.value.regions,region];
    cancel();selected=region.id;change({...history.value,regions});toast('Bölge bu katman için kaydedildi.');
  }
  function renderHandles(){
    handles.clearLayers();if(!active||replacement!==null||!history?.value.visible)return;
    const region=history.value.regions.find(r=>r.id===selected&&r.visible);if(!region)return;
    const commitPoints=vertices=>change({...history.value,regions:history.value.regions.map(r=>r.id===region.id?{...r,points:vertices}:r)});
    region.points.forEach((p,i)=>{
      const marker=L.marker(map._latLng(p),{draggable:true,zIndexOffset:1500,icon:L.divIcon({html:'<span class="region-vertex"></span>',className:'zz-div-icon region-handle',iconSize:[20,20],iconAnchor:[10,10]}),title:`Köşe ${i+1}: sürükle; sağ tık veya Delete ile sil`}).addTo(handles);
      marker.getElement()?.setAttribute('aria-label',`Bölge köşesi ${i+1}`);
      marker.on('dragend',()=>{const p=map._point(marker.getLatLng()),vertices=clone(region.points);vertices[i]={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};commitPoints(vertices);});
      const remove=e=>{L.DomEvent.stopPropagation(e);if(region.points.length<=3){toast('Bir alan en az üç köşeden oluşmalı.');return;}commitPoints(region.points.filter((_,j)=>j!==i));};
      marker.on('contextmenu',remove);
      marker.getElement()?.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove(e);focusVertex(Math.min(i,region.points.length-2));}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();const step=e.shiftKey?10:1,vertices=clone(region.points),p=vertices[i];p.x=Math.max(0,Math.min(1,p.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)/map.width));p.y=Math.max(0,Math.min(1,p.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)/map.height));commitPoints(vertices);focusVertex(i);}});
      const next=region.points[(i+1)%region.points.length],mid={x:(p.x+next.x)/2,y:(p.y+next.y)/2};
      const add=L.marker(map._latLng(mid),{zIndexOffset:1400,icon:map._icon('<span class="region-midpoint">+</span>'),title:`${i+1}. kenara köşe ekle`}).addTo(handles);
      add.on('click',e=>{L.DomEvent.stopPropagation(e);const vertices=clone(region.points);vertices.splice(i+1,0,mid);commitPoints(vertices);});
    });
  }
  function focusVertex(index){map.element.querySelector(`[aria-label="Bölge köşesi ${index+1}"]`)?.focus({preventScroll:true});}
  function render(){
    if(getTab()!=='regions'||!history)return;
    const v=history.value,r=v.regions.find(r=>r.id===selected);
    document.querySelector('#side-content').innerHTML=`<div class="region-editor"><div class="section-caption">KIRMIZI BÖLGELER</div><p class="side-note"><strong>${esc(readableLayer(layerId))}</strong><br>Değişiklikler bu katman için cihazında otomatik saklanır.</p><label class="region-toggle"><input type="checkbox" data-region-visible ${v.visible?'checked':''}> Tüm kırmızı alanları göster</label>${source.playableBoundary?`<label class="region-toggle"><input type="checkbox" data-region-hatch ${v.hatch?'checked':''}> Sınır dışı taramayı göster</label>`:''}<button class="button primary compact" data-region-action="new">+ Yeni bölge çiz</button><details class="region-help"><summary>Düzenleme ipuçları</summary><p class="side-note">Haritaya tıklayarak köşeleri ekle, ardından “Çizimi bitir”e bas. Mevcut alanı seçip köşelerini sürükleyebilirsin. Kenardaki + yeni köşe ekler; köşeye sağ tık onu siler. Enter çizimi tamamlar, Esc vazgeçer.</p></details><div class="plan-tools"><button class="button secondary compact" data-region-action="undo" ${history.past.length?'':'disabled'}>Geri al</button><button class="button secondary compact" data-region-action="redo" ${history.future.length?'':'disabled'}>Yinele</button></div><div class="region-list">${v.regions.map(z=>`<div class="region-row ${z.id===selected?'selected':''}"><input type="checkbox" data-region-toggle="${esc(z.id)}" aria-label="${esc(z.name)} görünürlüğü" ${z.visible?'checked':''}><button data-region-select="${esc(z.id)}" aria-pressed="${z.id===selected}">${esc(z.name)}<small>${z.points.length} köşe</small></button></div>`).join('')||'<p class="side-note">Bu katman boş. Yeni bölge çizerek başlayabilirsin.</p>'}</div>${r?`<div class="region-settings"><label class="form-label" for="region-name">Alan adı</label><input class="side-select" id="region-name" maxlength="80" value="${esc(r.name)}"><div class="plan-tools"><button class="button secondary compact" data-region-action="redraw">Yeniden çiz</button><button class="button secondary compact" data-region-action="delete">Alanı sil</button></div><p class="side-note">Köşeler: ok tuşları 1 m, Shift + ok 10 m. Delete köşeyi siler.</p></div>`:''}<div class="plan-tools"><button class="button secondary compact" data-region-action="export">Yedeği indir</button><button class="button secondary compact" data-region-action="import">Yedeği yükle</button></div><button class="button secondary compact" data-region-action="restore">Başlangıç sınırlarına dön</button><p class="side-note">Silme ve başlangıca dönme işlemleri “Geri al” ile geri alınabilir.</p>${getExtras()}</div>`;
  }
  function undo(){if(!history)return;cancel();history.undo();selected=null;refresh();}
  function redo(){if(!history)return;cancel();history.redo();selected=null;refresh();}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-region-action],[data-region-select]');if(!b||!history)return;
    if(b.hasAttribute('data-region-select')){select(b.dataset.regionSelect);return;}
    const a=b.dataset.regionAction;
    if(a==='new')start();if(a==='redraw'&&selected)start(selected);if(a==='finish')finish();
    if(a==='cancel'){cancel();renderHandles();render();}
    if(a==='point-undo'){points.pop();drawPreview();}
    if(a==='undo')undo();if(a==='redo')redo();
    if(a==='delete'){const id=selected;selected=null;cancel();change({...history.value,regions:history.value.regions.filter(r=>r.id!==id)});}
    if(a==='restore'){cancel();selected=null;change(initial());toast('Başlangıç sınırları yüklendi; geri alabilirsin.');}
    if(a==='export'){const blob=new Blob([JSON.stringify({schema:1,layer:layerId,...history.value},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=layerId+'-kirmizi-bolgeler.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(a==='import')input.click();
  });
  document.addEventListener('input',e=>{
    const t=e.target;if(t.id!=='region-name'||!history)return;
    const next={...history.value,regions:history.value.regions.map(r=>r.id===selected?{...r,name:t.value.trim()||'Kırmızı alan'}:r)};
    if(!t.dataset.editStarted){history.commit(next);t.dataset.editStarted='1';}else{history.value=cleanRegions(next);history.future=[];}
    store('regions:'+layerId,history.value);
    const label=document.querySelector('.region-row.selected button');if(label?.firstChild)label.firstChild.textContent=t.value.trim()||'Kırmızı alan';
    const undoButton=document.querySelector('[data-region-action="undo"]'),redoButton=document.querySelector('[data-region-action="redo"]');if(undoButton)undoButton.disabled=false;if(redoButton)redoButton.disabled=true;
  });
  document.addEventListener('focusout',e=>{if(e.target.id==='region-name')delete e.target.dataset.editStarted;});
  document.addEventListener('change',e=>{
    const t=e.target;if(!history)return;
    if(t.hasAttribute('data-region-visible'))setVisible(t.checked);
    if(t.hasAttribute('data-region-hatch'))change({...history.value,hatch:t.checked});
    if(t.hasAttribute('data-region-toggle'))change({...history.value,regions:history.value.regions.map(r=>r.id===t.dataset.regionToggle?{...r,visible:t.checked}:r)});
    if(t.id==='region-name')change({...history.value,regions:history.value.regions.map(r=>r.id===selected?{...r,name:t.value.trim()||'Kırmızı alan'}:r)});
  });
  input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;try{if(file.size>2e6)throw Error('Yedek en fazla 2 MB olabilir.');const value=JSON.parse(await file.text());if(value.schema!==1||value.layer!==layerId)throw Error('Yedek bu katman ile eşleşmiyor. Önce yedeğin ait olduğu katmanı aç.');const clean=cleanRegions(value);cancel();selected=null;change(clean);toast('Bölge yedeği yüklendi.');}catch(e){toast(e.message);}finally{input.value='';}});
  document.addEventListener('keydown',e=>{
    if(!active||e.target.matches('input,textarea,select')||e.target.closest('dialog'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();e.shiftKey?redo():undo();}
    else if(e.key==='Escape'){cancel();renderHandles();render();}
    else if(e.key==='Enter'&&replacement!==null){e.preventDefault();e.stopImmediatePropagation();finish();}
  },true);
  return api;
}
