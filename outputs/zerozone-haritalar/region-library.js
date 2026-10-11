import {cleanRegions} from './region-model.js';
import {cleanSets,copyRegions,readableLayer} from './workspace-model.js';
export function createRegionLibrary({editor,getContext,readStore,store,escape:esc,toast}){
  let preview=null;
  const context=()=>getContext();
  function sets(){try{return cleanSets(readStore('region-sets:'+context().layer,[]));}catch{toast('Sınır setleri okunamadı.');return [];}}
  const svg=state=>`<svg viewBox="0 0 100 100" role="img" aria-label="Bölge sınırları karşılaştırması">${state.regions.map(r=>`<polygon points="${r.points.map(p=>`${p.x*100},${p.y*100}`).join(' ')}" fill="#ef334044" stroke="#ef3340" stroke-width=".5"/>`).join('')}</svg>`;
  function html(){
    const c=context();if(!c.layer)return '';
    if(preview?.layer!==c.layer)preview=null;
    return `<details class="region-library"><summary>Sınır setleri ve katmandan kopyalama</summary><label class="form-label" for="region-set-name">Yeni set adı</label><input id="region-set-name" maxlength="80" placeholder="Normal maç / etkinlik"><button class="button secondary compact" data-region-library="save">Mevcut sınırları set olarak sakla</button><label class="form-label" for="region-set">Kayıtlı setler</label><select class="side-select" id="region-set"><option value="">Set seç</option>${sets().map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><button class="button secondary compact" data-region-library="set-preview">Seti önizle</button><label class="form-label" for="region-source-layer">Aynı haritada kaynak layer</label><select class="side-select" id="region-source-layer">${c.layers.filter(l=>l.id!==c.layer).map(l=>`<option value="${esc(l.id)}">${esc(readableLayer(l.id))}</option>`).join('')}</select><button class="button secondary compact" data-region-library="copy-preview">Kopyalamayı önizle</button><p class="side-note">Setler kaydettiğin anın kopyasıdır. Kopyalama hedefleri ve üsleri taşımaz; sınırları bu katmana göre kontrol et.</p></details>${preview?`<div class="region-copy-preview"><strong>${esc(preview.name)}</strong><div class="region-compare"><div>Mevcut (${editor.snapshot().regions.length})${svg(editor.snapshot())}</div><div>Gelen (${preview.state.regions.length})${svg(preview.state)}</div></div>${preview.type==='copy'?'<label class="form-label" for="region-copy-mode">Uygulama yöntemi</label><select class="side-select" id="region-copy-mode"><option value="append">Mevcut alanlara ekle</option><option value="replace">Mevcut alanların yerine koy</option></select>':''}<button class="button primary compact" data-region-library="apply">${preview.type==='copy'?'Kopyalamayı uygula':'Seti uygula'}</button><button class="button secondary compact" data-region-library="cancel">Vazgeç</button><p class="side-note">Uygulamadan sonra Geri al ile önceki sınırlarına dönebilirsin.</p></div>`:''}`;
  }
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-region-library]')?.dataset.regionLibrary;if(!action)return;
    try{
      const c=context();
      if(action==='save'){
        const name=document.querySelector('#region-set-name').value.trim();if(!name)throw Error('Set için bir ad yaz.');
        const list=sets();list.push({id:crypto.randomUUID(),name,state:editor.snapshot()});store('region-sets:'+c.layer,cleanSets(list));toast('Yeni sınır seti kaydedildi.');
      }
      if(action==='set-preview'){
        const s=sets().find(s=>s.id===document.querySelector('#region-set').value);if(!s)throw Error('Bir set seç.');
        preview={layer:c.layer,type:'set',name:s.name,state:s.state};
      }
      if(action==='copy-preview'){
        const id=document.querySelector('#region-source-layer').value;
        if(!c.layers.some(l=>l.id===id&&id!==c.layer))throw Error('Aynı haritadan farklı bir katman seç.');
        const base=c.base(id)||{regions:[]};preview={layer:c.layer,type:'copy',name:id,state:cleanRegions(readStore('regions:'+id,base))};
      }
      if(action==='apply'){
        if(!preview||preview.layer!==c.layer)throw Error('Önce bu katman için önizleme aç.');
        const next=preview.type==='copy'?copyRegions(preview.state,editor.snapshot(),document.querySelector('#region-copy-mode').value):preview.state;
        editor.restore(next);preview=null;toast('Sınırlar uygulandı; Geri al ile geri dönebilirsin.');
      }
      if(action==='cancel')preview=null;
      editor.render();
    }catch(error){toast(error.message);}
  });
  return {html,sets,restoreSets:value=>store('region-sets:'+context().layer,cleanSets(value))};
}
