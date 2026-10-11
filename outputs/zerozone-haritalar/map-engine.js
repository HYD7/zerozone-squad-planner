import {squadSymbol} from './squad-visuals.js';
import {paletteFor,mapImageFilter,annotationAppearance} from './accessibility.js';
/* ZeroZone private tactical planning canvas. Leaflet 1.9.4 (BSD-2-Clause). */
import { DRAW_TOOLS, cleanStyle, cleanMortarSettings, normalizeAnnotations, SYMBOLS, fobRadii } from './planning-model.js';
const STYLE_ID = 'zz-tactical-map-styles';
const ACCENT = '#b5e8fa';
const TOOLS = new Set(['pan', ...DRAW_TOOLS]);
const toolNames = { pan: 'Haritayı sürükle', measure: 'Mesafe ölç', arrow: 'Hareket oku', pin: 'İşaret yerleştir', hab: 'HAB planla', mortar: 'Havan hattı',line:'Çizgi çiz',circle:'Daire çiz',rectangle:'Alan çiz',brush:'Serbest çizim · basılı tutarak çiz' };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = value => Math.max(0, Math.min(1, value));
const clone = value => JSON.parse(JSON.stringify(value));

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* İşaret içi yazılar disk ölçüsüne bağlıdır; 12px taban kuralından muaf. */
    .zz-tactical-map{position:relative;z-index:0;isolation:isolate;background:var(--zz-map-bg,#101314);font-family:Montserrat,Arial,sans-serif;outline:none;width:100%;height:100%;min-height:200px}
    .zz-tactical-map:focus-visible{outline:2px solid var(--zs-accent,${ACCENT});outline-offset:-3px}
    .zz-tactical-map.zz-draw,.zz-tactical-map.zz-draw .leaflet-interactive{cursor:crosshair}
    .zz-tactical-map .leaflet-control-attribution{border-radius:var(--zz-radius-xs,6px) 0 0 0;padding:2px 8px;background:var(--zz-surface-solid,var(--zs-surface-2,rgba(12,15,17,.8)));color:var(--zs-text-3,#9fa8ac);font-size:var(--zs-fs-xs,12px)}
    .zz-tactical-map .leaflet-control-attribution a{color:var(--zs-accent,#c7dde5)}
    .zz-tactical-map .leaflet-image-layer{image-rendering:auto}
    .zz-tactical-map .zz-div-icon{background:transparent;border:0}
    .zz-tactical-map .zz-objective{display:flex;flex-direction:column;align-items:center;gap:5px;transform:translate(-50%,-15px);width:max-content;max-width:220px;user-select:none;pointer-events:none}
    .zz-tactical-map .zz-objective-disc{pointer-events:auto}
    .zz-tactical-map .zz-objective.is-dense{transform:translate(-50%,-11px)}
    .zz-tactical-map .zz-objective-disc{display:grid;place-items:center;width:29px;height:29px;border:2px solid var(--zs-accent,#d2eff8);border-radius:50%;background:var(--zz-map-surface,#152831dc);color:var(--zs-text,#fff);font-size:11px;font-weight:800;box-shadow:0 2px 14px var(--zz-shadow,#000a)}
    .zz-tactical-map .zz-objective-disc.is-main{border-radius:var(--zz-radius-xs,6px);transform:rotate(45deg);background:var(--zz-team1-bg,#0d345ce6);border-color:var(--zz-team1,#8fcafb);width:32px;height:32px}
    .zz-tactical-map .zz-objective-disc.is-main span{transform:rotate(-45deg);font-size:17px}
    .zz-tactical-map .zz-objective-disc.team-red{background:var(--zz-team2-bg,#632932e6);border-color:var(--zz-team2,#f19aa4)}
    .zz-tactical-map .zz-objective-disc.dense{width:21px;height:21px;font-size:8px;border-width:1.5px}
    .zz-tactical-map .zz-objective-disc.capture-selected{background:var(--zz-ok-bg,#255441);border-color:var(--zz-ok,#addeb2);color:var(--zs-text,#effff5)}
    .zz-tactical-map .zz-objective-disc.capture-next{background:var(--zz-next-bg,#173c4c);border-color:var(--zs-accent,#b5e8fa);box-shadow:0 0 0 4px color-mix(in srgb,var(--zs-accent,#b5e8fa) 12%,transparent),0 2px 10px var(--zz-shadow,#0009)}
    .zz-tactical-map .zz-objective.capture-future{opacity:.5}
    .zz-tactical-map .zz-capture-chance{color:var(--zs-accent,#b5e8fa);background:var(--zs-surface-2,#101619ed);border:1px solid color-mix(in srgb,var(--zs-accent,#b5e8fa) 31%,transparent);border-radius:var(--zz-radius-xs,6px);padding:2px 5px;font-size:var(--zs-fs-xs,12px);font-weight:700;line-height:1.3}
    .zz-tactical-map .zz-objective-name{font-size:var(--zs-fs-xs,12px);line-height:1.35;font-weight:700;color:var(--zs-text,#fff);text-shadow:0 1px 4px var(--zz-text-shadow,#000),0 0 7px var(--zz-text-shadow,#000);padding:3px 7px;border-radius:var(--zz-radius-xs,6px);background:var(--zs-surface-2,#121619c7);max-width:210px;text-align:center;white-space:nowrap}
    .zz-tactical-map .zz-labels-pane{pointer-events:none}
    .zz-tactical-map .zz-label-box{display:block;width:max-content;pointer-events:auto;cursor:pointer}
    .zz-tactical-map .zz-label-box .zz-objective-name{display:block;width:max-content}
    .zz-tactical-map .zz-grid-label{color:var(--zs-text,#e9f2f0);font-size:var(--zs-fs-xs,12px);font-weight:700;line-height:var(--zs-lh-xs,16px);text-shadow:0 1px 4px var(--zz-text-shadow,#000),0 0 5px var(--zz-text-shadow,#000);white-space:nowrap;pointer-events:none}
    .zz-tactical-map .zz-map-tooltip{border:1px solid var(--zs-line-2,#ffffff25);border-radius:var(--zz-radius-xs,6px);background:var(--zs-surface-2,#111619ed);color:var(--zs-text,#e7f7fc);font:600 var(--zs-fs-xs,12px)/1.5 Montserrat,Arial,sans-serif;padding:5px 8px;box-shadow:0 3px 12px var(--zz-shadow,#0007);white-space:nowrap}
    .zz-tactical-map .zz-map-tooltip::before{display:none}
    .zz-tactical-map .zz-pin{width:27px;height:34px;filter:drop-shadow(0 2px 5px var(--zz-shadow,#0008));transform:translate(-50%,-100%)}
    .zz-tactical-map .zz-hab{display:grid;place-items:center;width:31px;height:31px;border:2px solid var(--zs-accent,#b5e8fa);background:var(--zz-map-surface,#14282fe8);color:var(--zs-accent,#b5e8fa);border-radius:var(--zz-radius-xs,6px);transform:translate(-50%,-50%);box-shadow:0 2px 8px var(--zz-shadow,#000a);font-size:18px}
    .zz-tactical-map .zz-arrow-head{width:24px;height:24px;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 3px var(--zz-shadow,#0008))}
    .zz-tactical-map .zz-mortar{display:grid;place-items:center;width:28px;height:28px;border:2px solid var(--zz-warn,#f4c27b);color:var(--zz-warn,#f4c27b);background:var(--zz-map-surface,#32281ced);border-radius:50%;font-size:17px;font-weight:700;transform:translate(-50%,-50%)}
    .zz-tactical-map .zz-text-label{width:max-content;transform:translate(-50%,6px);color:var(--zs-text,#eaf9ff);background:var(--zs-surface-2,#101619df);border:1px solid var(--zs-line-2,#ffffff20);padding:4px 7px;border-radius:var(--zz-radius-xs,6px);font-size:var(--zs-fs-xs,12px);font-weight:600;line-height:1.45;text-align:center;white-space:nowrap;box-shadow:0 2px 8px var(--zz-shadow,#0005);pointer-events:none}
    .zz-tactical-map .zz-map-loading{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:800;padding:12px 18px;border:1px solid color-mix(in srgb,var(--zs-accent,#b5e8fa) 21%,transparent);background:var(--zs-surface-2,#101619ec);border-radius:var(--zs-radius,10px);color:var(--zs-text,#d5ebf3);font:500 var(--zs-fs-xs,12px)/1.5 Montserrat,Arial,sans-serif;pointer-events:none;text-align:center}
    .zz-tactical-map .leaflet-tooltip{pointer-events:none}
    .zz-tactical-map .zz-preview-dot{box-shadow:0 0 0 5px color-mix(in srgb,var(--zs-accent,#b5e8fa) 14%,transparent)}
  `;
  document.head.appendChild(style);
}

/** All public point coordinates are normalized 0..1 from the upper left. */
export class TacticalMap {
  constructor(element, { onChange = () => {}, onSelect = () => {}, onStatus = () => {}, onAnnotation = () => {} } = {}) {
    const L = globalThis.L;
    if (!L?.map) throw new Error('Leaflet yüklenemedi. assets/vendor/leaflet.js dosyasını kontrol edin.');
    this.L = L;
    this.element = typeof element === 'string' ? document.querySelector(element) : element;
    if (!this.element) throw new Error('Harita alanı bulunamadı.');
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onStatus = onStatus;
    this.onAnnotation = onAnnotation;
    this.style = cleanStyle();
    this.visuals = {opacity:1,brightness:1,grayscale:false};
    this._history = []; this._future = []; this.selectedId = null;
    this.tool = 'pan';
    this.annotations = [];
    this.overlays = { grid: true, objectives: true, labels: true, ranges: true, zones:true, redZones:true };
    this._pending = null;
    this.mortarOrigin = null;
    this.mortarOriginReset = false;
    this.mortarSettings = cleanMortarSettings();
    this._counter = 0;
    this._destroyed = false;
    injectStyles();
    this.element.classList.add('zz-tactical-map');
    this.element.setAttribute('tabindex', '0');
    this.element.setAttribute('role', 'application');
    this.element.setAttribute('aria-label', 'Taktik harita. Ok tuşlarıyla kaydırın, artı ve eksiyle yakınlaştırın.');
    this.map = L.map(this.element, {
      crs: L.CRS.Simple, zoomControl: false, attributionControl: true,
      minZoom: -6, maxZoom: 3, zoomSnap: 0, zoomDelta: 0.5,
      wheelPxPerZoomLevel: 95, doubleClickZoom: true, keyboard: true,
      maxBoundsViscosity: 0.75, fadeAnimation: true
    });
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    this.map.createPane('zz-base');
    this.map.getPane('zz-base').style.zIndex='200';
    this.map.getPane('zz-base').style.pointerEvents='none';
    this.map.createPane('zz-red-zones');
    this.map.getPane('zz-red-zones').style.zIndex='350';
    this.map.getPane('zz-red-zones').style.pointerEvents='none';
    this.redZoneLayer = L.layerGroup().addTo(this.map);
    this.map.createPane('zz-grid');
    this.map.getPane('zz-grid').style.zIndex = '410';
    this.map.getPane('zz-grid').style.pointerEvents = 'none';
    this.map.createPane('zz-labels');
    this.map.getPane('zz-labels').style.zIndex = '650';
    this.map.getPane('zz-labels').style.pointerEvents = 'none';
    this.L.DomUtil.addClass(this.map.getPane('zz-labels'), 'zz-labels-pane');
    this.map.createPane('zz-ranges');
    this.map.getPane('zz-ranges').style.zIndex = '420';
    this.map.getPane('zz-ranges').style.pointerEvents = 'none';
    this.gridLayer = L.layerGroup().addTo(this.map);
    this.objectivesLayer = L.layerGroup().addTo(this.map);
    this.annotationLayer = L.layerGroup().addTo(this.map);
    this.rangeLayer = L.layerGroup().addTo(this.map);
    this.firePreviewLayer = L.layerGroup().addTo(this.map);
    this.previewLayer = L.layerGroup().addTo(this.map);
    this.editLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', event => this._click(event.latlng));
    this.map.on('mousemove', event => this._move(event.latlng));
    this.map.on('zoomend', () => {this._renderGrid();this._renderObjectives();});
    this._keyHandler = event => {
      if (event.key === 'Escape') {
        this.pointPicker=null;
        this.cancelPending();
        this._status({ text: 'İşlem iptal edildi. ' + toolNames[this.tool] });
      }
    };
    this.element.addEventListener('keydown', this._keyHandler);
    this._brushHandlers = {
      pointerdown: event => {
        if(this.tool!=='brush'||event.button!==0||!this.config)return;
        const p=this._point(this.map.mouseEventToLatLng(event));if(!this._validPoint(p))return;
        event.preventDefault();this._stroke=[p];this.element.setPointerCapture(event.pointerId);
      },
      pointermove: event => {
        if(!this._stroke)return;
        const p=this._point(this.map.mouseEventToLatLng(event));
        if(!this._validPoint(p)||this._stroke.length>=2000)return;
        if(this._geometry(this._stroke.at(-1),p).distance*this.map.options.crs.scale(this.map.getZoom())<3)return;
        this._stroke.push(p);this.previewLayer.clearLayers();
        L.polyline(this._stroke.map(p=>this._latLng(p)),{color:annotationAppearance(this.colorMode||'none',this.style.color).color,weight:this.style.weight,interactive:false}).addTo(this.previewLayer);
      },
      pointerup: () => {
        if(!this._stroke)return;
        const points=this._stroke;this._stroke=null;this.previewLayer.clearLayers();
        if(points.length>1&&this.annotations.length<500)this._commit([...this.annotations,this._newAnnotation('brush',points)]);
      },
      pointercancel:()=>this.cancelPending()
    };
    for(const [name,handler] of Object.entries(this._brushHandlers))this.element.addEventListener(name,handler);
    if (typeof ResizeObserver !== 'undefined') {
      this._observer = new ResizeObserver(() => {if(this.config)this.fit();else this.invalidateSize();});
      this._observer.observe(this.element);
    }
  }

  setMap(config) {
    this.pointPicker=null;
    if (!config || !finite(config.widthMeters) || !finite(config.heightMeters) || config.widthMeters <= 0 || config.heightMeters <= 0) {
      throw new Error('Harita ölçüleri metre cinsinden pozitif sayı olmalı.');
    }
    this.firePreviewLayer?.clearLayers();
    this.config = { ...config, points: config.points || [], mains: config.mains || [], links: config.links || [] };
    this.width = config.widthMeters;
    this.height = config.heightMeters;
    this.bounds = this.L.latLngBounds([[-this.height, 0], [0, this.width]]);
    this.map.setMaxBounds(this.bounds.pad(0.24));
    this.cancelPending();
    this.mortarOrigin = null;
    this.mortarOriginReset = false;
    this.mortarSettings = cleanMortarSettings();
    this.annotations = [];
    this._history=[];this._future=[];this.selectedId=null;this.editLayer.clearLayers();
    this.annotationLayer.clearLayers();
    this.rangeLayer.clearLayers();
    this.setBaseImage(config.image);
    this.fit();
    this._renderObjectives();
    this._renderRedZones();
    this._renderGrid();
    this._status({ text: `${config.name || 'Harita'} · ${Math.round(this.width)} × ${Math.round(this.height)} m` });
    return this;
  }

  setBaseImage(url) {
    if (!this.bounds) return this;
    if (this.baseImage) this.map.removeLayer(this.baseImage);
    this._loading?.remove();
    if (!url) return this;
    const loading = document.createElement('div');
    loading.className = 'zz-map-loading';
    loading.textContent = 'Harita yükleniyor…';
    this.element.appendChild(loading);
    this._loading = loading;
    const image = this.L.imageOverlay(url, this.bounds, { pane:'zz-base', interactive: false, alt: this.config?.name || 'Squad taktik haritası' });
    this.baseImage = image;
    image.on('load', () => { if (this.baseImage === image) {loading.remove();this.setVisuals(this.visuals);} });
    image.on('error', () => {
      if (this.baseImage !== image) return;
      loading.textContent = 'Harita görseli yüklenemedi. Yerel dosyayı kontrol edin.';
      this._status({ text: 'Harita görseli yüklenemedi.' });
    });
    image.addTo(this.map);
    return this;
  }

  setTool(tool) {
    if (!TOOLS.has(tool)) return this;
    this.pointPicker=null;
    this.tool = tool;
    this.cancelPending();
    if(tool==='mortar'&&!this.mortarOrigin&&!this.mortarOriginReset){const last=this.annotations.filter(a=>a.tool==='mortar').at(-1);if(last)this.useMortarOrigin(last);}
    if(tool==='brush')this.map.dragging.disable();else this.map.dragging.enable();
    this.element.style.touchAction=tool==='brush'?'none':'';
    if(tool!=='pan'){this.selectedId=null;this.editLayer.clearLayers();}
    this.element.classList.toggle('zz-draw', tool !== 'pan');
    if (tool === 'pan') this.map.doubleClickZoom.enable();
    else this.map.doubleClickZoom.disable();
    const suffix = tool==='mortar'?(this.mortarOrigin?' · Hedefi seçin.':' · Havanın konumunu seçin.'):['measure', 'arrow','line','circle','rectangle'].includes(tool) ? ' · Başlangıç noktasını seçin.' : ['pan','brush'].includes(tool) ? '' : ' · Haritaya tıklayın.';
    this._status({ text: toolNames[tool] + suffix });
    return this;
  }


  pickPoint(callback){this.setTool('pan');this.pointPicker=callback;this._status({text:'Gözlemci için haritaya tıkla · Esc: iptal'});}
  setFirePreview(value){
    this.firePreview=value;this.firePreviewLayer?.clearLayers();if(!value||!this.firePreviewLayer)return;
    this.firePreview=value;const palette=paletteFor(this.colorMode);const {analysis:a,origin,weapon:w,options,polygon}=value,L=this.L,base={pane:'zz-ranges',interactive:false,weight:1.5,fillOpacity:.04};
    if(origin&&options.range){L.circle(this._latLng(origin),{...base,radius:w.speed*w.speed/w.gravity,color:palette.ground,dashArray:'7 6'}).addTo(this.firePreviewLayer);if(w.minRange)L.circle(this._latLng(origin),{...base,radius:w.minRange,color:palette.team2}).addTo(this.firePreviewLayer);}
    if(a&&options.spread&&polygon.length)L.polygon(polygon.map(p=>this._latLng(p)),{...base,color:palette.flight,fillOpacity:.2,dashArray:'2 3'}).addTo(this.firePreviewLayer);
    if(a&&options.grad&&w.name.includes('Grad')){const width=this.config.widthMeters,height=this.config.heightMeters,dx=a.b.x-a.a.x,dy=a.b.y-a.a.y;L.polyline([this._latLng(a.a),this._latLng(a.b)],{...base,color:palette.flight}).addTo(this.firePreviewLayer);for(let d=100;d<a.distance;d+=100){const t=d/a.distance,c={x:a.a.x+dx*t,y:a.a.y+dy*t},ox=-(dy*height)/a.distance*12/width,oy=(dx*width)/a.distance*12/height;L.polyline([this._latLng({x:c.x-ox,y:c.y-oy}),this._latLng({x:c.x+ox,y:c.y+oy})],{...base,color:palette.flight}).addTo(this.firePreviewLayer);if(d%500===0)L.marker(this._latLng(c),{interactive:false,icon:this._icon('<span class="zz-grad-distance">'+d+' m</span>')}).addTo(this.firePreviewLayer);}}
    if(a&&options.blast)L.circle(this._latLng(a.b),{...base,radius:w.blast,color:palette.team2,dashArray:'3 4'}).addTo(this.firePreviewLayer);
  }
  setStyle(style) {this.style=cleanStyle({...this.style,...style});return this;}
  useMortarOrigin(item){this.mortarOriginReset=false;this.mortarOrigin=clone(item.points[0]);this.mortarSettings=cleanMortarSettings(item.mortar);return this;}
  resetMortarOrigin(){this.mortarOriginReset=true;this.mortarOrigin=null;this.mortarSettings={...cleanMortarSettings(this.mortarSettings),targetOffset:0};this.cancelPending();this._status({text:'Yeni havan konumunu seçin.'});}
  setVisuals(options) {
    this.visuals={...this.visuals,...options};
    const image=this.baseImage?.getElement();
    if(image){image.style.opacity=String(this.visuals.opacity);image.style.filter=`brightness(${this.visuals.brightness}) grayscale(${this.visuals.grayscale?1:0}) ${mapImageFilter(this.colorMode,this.colorIntensity).replace('none','')}`;}
    return this;
  }
  updateObjectives(config) {Object.assign(this.config,config);this._renderObjectives();this._renderRedZones();return this;}
  _commit(items) {
    this._history.push(this.exportPlan());if(this._history.length>60)this._history.shift();this._future=[];
    this.annotations=normalizeAnnotations(items);this._renderAnnotations();this._changed();return this;
  }
  selectAnnotation(id) {
    this.selectedId=id;this._renderEditHandles();const item=this.annotations.find(a=>a.id===id);if(item)this.onAnnotation(clone(item));return this;
  }
  updateLabel(id,label,checkpoint=true){
    const item=this.annotations.find(a=>a.id===id);if(!item)return;
    if(checkpoint){this._history.push(this.exportPlan());if(this._history.length>60)this._history.shift();}
    this._future=[];item.label=String(label).slice(0,120);this._renderAnnotations();this._changed();
  }
  _renderEditHandles() {
    this.editLayer.clearLayers();const item=this.annotations.find(a=>a.id===this.selectedId);if(!item||this.tool!=='pan')return;
    const ids=item.tool==='brush'?[0,item.points.length-1]:item.points.map((_,i)=>i);
    for(const i of ids){const marker=this.L.marker(this._latLng(item.points[i]),{draggable:true,icon:this._icon('<span style="display:block;width:14px;height:14px;background:#fff;border:3px solid #1e5365;border-radius:50%;transform:translate(-50%,-50%)"></span>'),title:'Noktayı sürükle'}).addTo(this.editLayer);
      marker.on('dragend',()=>{const p=this._point(marker.getLatLng());const items=this.exportPlan(),target=items.find(a=>a.id===item.id);target.points[i]={x:clamp(p.x),y:clamp(p.y)};this._commit(items);});
    }
  }

  setOverlay(name, visible) {
    if (!(name in this.overlays)) return this;
    this.overlays[name] = Boolean(visible);
    if (name === 'grid') this._renderGrid();
    if (name === 'redZones') this._renderRedZones();
    if (name === 'objectives' || name === 'labels' || name === 'zones') this._renderObjectives();
    if (name === 'ranges' || name === 'labels') this._renderAnnotations();
    return this;
  }

  zoomIn() { this.map.zoomIn(0.5); return this; }
  zoomOut() { this.map.zoomOut(0.5); return this; }
  fit() {
    if (this.bounds) {
      this.map.invalidateSize({ animate: false });
      const fitZoom = this.map.getBoundsZoom(this.bounds, false, [136, 120]);
      this.map.setMinZoom(Math.min(-1, fitZoom - 1));
      this.map.fitBounds(this.bounds, { paddingTopLeft: [72, 64], paddingBottomRight: [64, 56], animate: false });
    }
    return this;
  }
  invalidateSize() { if (!this._destroyed) this.map.invalidateSize({ animate: false, pan: false }); }
  cancelPending() { this._pending = null; this._stroke=null;this.previewLayer.clearLayers(); return this; }
  undo() {
    if (this._pending) { this.cancelPending(); return this; }
    if (this._history.length) {
      this._future.push(this.exportPlan());this.annotations=this._history.pop();
      this._renderAnnotations();
      this._changed();
    }
    return this;
  }
  redo() {if(this._future.length){this._history.push(this.exportPlan());this.annotations=this._future.pop();this._renderAnnotations();this._changed();}return this;}
  clear() {
    this.cancelPending();
    this._commit([]);
    this._status({ text: 'Plan temizlendi.' });
    return this;
  }
  exportPlan() { return clone(this.annotations); }
  importPlan(annotations, {history=true}={}) {
    const clean=normalizeAnnotations(annotations);
    this.cancelPending();
    if(history)return this._commit(clean);
    this.annotations=clean;
    this._renderAnnotations();
    this._changed();
    return this;
  }
  /** In two-point tools, call twice: origin then destination. */
  addPoint(point, tool = this.tool) {
    if (!this.config || !this._validPoint(point)) throw new Error('Koordinatlar 0 ile 1 arasında olmalı.');
    if (!TOOLS.has(tool)) throw new Error('Geçersiz harita aracı.');
    if (tool !== this.tool) this.setTool(tool);
    this._acceptPoint({ x: point.x, y: point.y });
    return this;
  }
  getGrid(point) {
    if (!this.config || !this._validPoint(point)) return '';
    const mx = Math.min(point.x * this.width, this.width - 0.001);
    const my = Math.min(point.y * this.height, this.height - 0.001);
    const col = Math.floor(mx / 300);
    const row = Math.floor(my / 300) + 1;
    const inX = mx % 300, inY = my % 300;
    const keypad = (2 - Math.floor(inY / 100)) * 3 + Math.floor(inX / 100) + 1;
    const sub = (2 - Math.min(2, Math.floor((inY % 100) / (100 / 3)))) * 3 + Math.min(2, Math.floor((inX % 100) / (100 / 3))) + 1;
    return `${this._columnName(col)}${row}-${keypad}-${sub}`;
  }
  destroy() {
    this._destroyed = true;
    this._observer?.disconnect();
    this.element.removeEventListener('keydown', this._keyHandler);
    for(const [name,handler]of Object.entries(this._brushHandlers))this.element.removeEventListener(name,handler);
    this._loading?.remove();
    this.map.remove();
  }

  _validPoint(p) { return p && finite(p.x) && finite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; }
  _latLng(p) { return this.L.latLng(-p.y * this.height, p.x * this.width); }
  _point(latlng) { return { x: latlng.lng / this.width, y: -latlng.lat / this.height }; }
  _columnName(index) {
    let result = '', n = index + 1;
    while (n > 0) { n--; result = String.fromCharCode(65 + n % 26) + result; n = Math.floor(n / 26); }
    return result;
  }
  _geometry(a, b) {
    const dx = (b.x - a.x) * this.width;
    const dy = (b.y - a.y) * this.height;
    return { distance: Math.hypot(dx, dy), bearing: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360 };
  }
  _status(status) { if (!this._destroyed) this.onStatus(status); }
  _changed() { this.onChange(this.exportPlan()); }
  _click(latlng) {
    if (!this.config) return;
    const point = this._point(latlng);
    if (!this._validPoint(point)) return;
    if(this.pointPicker){const callback=this.pointPicker;this.pointPicker=null;callback(point);return;}
    this._acceptPoint(point);
  }
  _acceptPoint(point) {
    if(this.regionEditor?.handlePoint(point))return;
    if(this.tool==='brush')return;
    if (this.tool === 'pan') {
      this._status({ text: `Koordinat: ${this.getGrid(point)}`, grid: this.getGrid(point), point });
      return;
    }
    if (this.annotations.length >= 500) { this._status({ text: 'Plan işaret sınırına ulaşıldı (500).' }); return; }
    const before=this.exportPlan();
    if(this.tool==='mortar'){
      if(!this.mortarOrigin){this.mortarOriginReset=false;this.mortarOrigin=clone(point);this.L.circleMarker(this._latLng(point),{radius:5,color:ACCENT,weight:2,fillColor:'#152a34',fillOpacity:1,interactive:false}).addTo(this.previewLayer);this._status({text:'Havan konumu sabit. Şimdi hedefi seçin.',grid:this.getGrid(point)});this._changed();return;}
      const geometry=this._geometry(this.mortarOrigin,point);
      if(geometry.distance<1){this._status({text:'Hedef havandan en az 1 m uzakta olmalı.'});return;}
      const item=this._newAnnotation('mortar',[this.mortarOrigin,point]);item.mortar={...this.mortarSettings,targetOffset:0};
      this.cancelPending();this._commit([...this.annotations,item]);this._status({text:'Hedef eklendi. Aynı havandan başka bir hedef seçebilirsin.',grid:this.getGrid(point)});return;
    }
    if (['arrow', 'measure','line','circle','rectangle'].includes(this.tool)) {
      if (!this._pending) {
        this._pending = point;
        this.L.circleMarker(this._latLng(point), { radius: 5, color: ACCENT, weight: 2, fillColor: '#152a34', fillOpacity: 1, interactive: false }).addTo(this.previewLayer);
        this._status({ text: 'Bitiş noktasını seçin · Esc: iptal', grid: this.getGrid(point) });
        return;
      }
      const geometry = this._geometry(this._pending, point);
      if (geometry.distance < 1) { this._status({ text: 'Bitiş noktası başlangıçtan en az 1 m uzakta olmalı.' }); return; }
      const annotation = this._newAnnotation(this.tool, [this._pending, point]);
      this.cancelPending();
      this.annotations.push(annotation);
      this._status({ text: `${Math.round(geometry.distance)} m · ${Math.round(geometry.bearing) % 360}°`, ...geometry, grid: this.getGrid(point) });
    } else {
      this.annotations.push(this._newAnnotation(this.tool, [point]));
      this._status({ text: `${this.tool === 'hab' ? 'HAB planı' : 'İşaret'} eklendi · ${this.getGrid(point)}`, grid: this.getGrid(point) });
    }
    this._history.push(before);if(this._history.length>60)this._history.shift();this._future=[];
    this._renderAnnotations();
    this._changed();
  }
  _newAnnotation(tool, points) { return { id: `zz-${Date.now().toString(36)}-${++this._counter}`, tool, points: clone(points), label: tool==='pin'&&this.style.symbol!=='pin'?SYMBOLS[this.style.symbol]:'', createdAt: new Date().toISOString(),style:clone(this.style) }; }
  _move(latlng) {
    if (!this.config) return;
    const point = this._point(latlng);
    if (!this._validPoint(point)) return;
    if(this.regionEditor?.handleMove(point))return;
    const origin=this.tool==='mortar'?this.mortarOrigin:this._pending;
    if (origin) {
      this.previewLayer.clearLayers();
      const geometry = this._geometry(origin, point);
      this.L.circleMarker(this._latLng(origin), { radius: 5, color: ACCENT, weight: 2, fillColor: '#152a34', fillOpacity: 1, interactive: false }).addTo(this.previewLayer);
      this.L.polyline([this._latLng(origin), latlng], { color: paletteFor(this.colorMode).ground, weight: 2, dashArray: '5 6', opacity: 0.8, interactive: false }).addTo(this.previewLayer);
      this._status({ text: `${Math.round(geometry.distance)} m · ${Math.round(geometry.bearing) % 360}° · ${this.tool==='mortar'?'Hedefi':'Bitiş noktasını'} seçin`, ...geometry, grid: this.getGrid(point) });
    } else this._status({ text: `${toolNames[this.tool]} · ${this.getGrid(point)}`, grid: this.getGrid(point), point });
  }

  _icon(html, className = '') { return this.L.divIcon({ html, className: `zz-div-icon ${className}`, iconSize: [0, 0], iconAnchor: [0, 0] }); }
  _label(point, html, layer = this.annotationLayer) {
    return this.L.marker(this._latLng(point), { icon: this._icon(`<div class="zz-text-label">${html}</div>`), interactive: false, keyboard: false, zIndexOffset: 250 }).addTo(layer);
  }
  _renderRedZones() {
    this.redZoneLayer.clearLayers();
    if (!this.config || !this.overlays.redZones) return;
    const options={pane:'zz-red-zones',interactive:false,color:'#f42538',weight:2,opacity:.95,fillColor:'#ed2638',fillOpacity:.26,smoothFactor:0};
    for(const region of this.config.redZones?.regions||[]) {
      if(region.visible===false)continue;
      const shape=this.L.polygon(region.points.map(p=>this._latLng(p)),{...options,...(this.colorBlind?{color:paletteFor(this.colorMode).danger,fillColor:region.team===2?paletteFor(this.colorMode).team2:paletteFor(this.colorMode).team1,weight:2.5,dashArray:region.team===1?'10 5':'2 5',fillOpacity:.08}:{}),className:'zz-red-region'}).addTo(this.redZoneLayer);
      const el=shape.getElement();
      if(el){el.setAttribute('role','img');el.setAttribute('aria-label',`Takım ${region.team} çevresindeki kırmızı sınır bölgesi`);}
    }
    const boundary=this.config.redZones?.playableBoundary;
    if(boundary?.length>2) {
      const outer=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
      const shape=this.L.polygon([outer.map(p=>this._latLng(p)),boundary.map(p=>this._latLng(p))],{...options,stroke:false,fillRule:'evenodd',fillOpacity:1,className:'zz-boundary-hatch'}).addTo(this.redZoneLayer);
      const el=shape.getElement(),svg=el?.ownerSVGElement;
      if(svg){
        const ns='http://www.w3.org/2000/svg',id=`${this.element.id}-red-hatch`;
        svg.querySelector('defs')?.remove();{
          const defs=document.createElementNS(ns,'defs'),pattern=document.createElementNS(ns,'pattern');
          pattern.setAttribute('id',id);pattern.setAttribute('width','12');pattern.setAttribute('height','12');pattern.setAttribute('patternUnits','userSpaceOnUse');pattern.setAttribute('patternTransform','rotate(40)');
          for(const [width,opacity] of [['12','.09'],['5','.24']]){const stripe=document.createElementNS(ns,'rect');stripe.setAttribute('width',width);stripe.setAttribute('height','12');stripe.setAttribute('fill',this.colorBlind?'#ffffff':'#f42538');stripe.setAttribute('fill-opacity',opacity);pattern.appendChild(stripe);}
          defs.appendChild(pattern);svg.prepend(defs);
        }
        el.setAttribute('fill',`url(#${id})`);el.setAttribute('role','img');el.setAttribute('aria-label','Oynanabilir alan dışı kırmızı tarama');
      }
    }
  }

  _renderObjectives() {
    this.objectivesLayer.clearLayers();
    if (!this.config || !this.overlays.objectives) return;
    const L = this.L;
    const palette=paletteFor(this.colorMode);const all = [...this.config.points, ...this.config.mains];
    for (const link of this.config.links) {
      const from = all.find(point => point.id === link.from);
      const to = all.find(point => point.id === link.to);
      if (this._validPoint(from) && this._validPoint(to)) L.polyline([this._latLng(from), this._latLng(to)], { color: link.captured?palette.selected:'#d4e4ea', weight: link.captured?3:2, dashArray: link.captured?null:'5 8', opacity: 0.75, interactive: false }).addTo(this.objectivesLayer);
    }
    const cssPx=(name,fallback)=>{const v=parseFloat(getComputedStyle(this.element).getPropertyValue(name));return Number.isFinite(v)&&v>0?v:fallback;};
    const markerSize=cssPx('--marker-size',29),labelSize=cssPx('--label-size',12);
    // Disk yarıçapı gerçek --marker-size'dan türer (ana üs 1.1x, yoğun 0.73x; CSS ile aynı oranlar) + 2px çerçeve.
    const discRadius=point=>markerSize*(this.config.mains.includes(point)?1.1:(this.config.points.length>12&&!['selected','next'].includes(point.captureStatus)?.73:1))/2+2;
    const screen=all.filter(point=>this._validPoint(point)&&!point.isHex).map(point=>{const c=this.map.latLngToContainerPoint(this._latLng(point));return {point,x:c.x,y:c.y,r:discRadius(point)};});
    const hits=(self,box)=>screen.some(o=>o.point!==self&&o.x+o.r>box.l&&o.x-o.r<box.r&&o.y+o.r>box.t&&o.y-o.r<box.b);
    const render = (point, index, isMain) => {
      if (!this._validPoint(point)) return;
      if(point.isHex){
        const vertices=[[1,0],[.5,1],[-.5,1],[-1,0],[-.5,-1],[.5,-1]].map(([dx,dy])=>this._latLng({x:point.x+dx*point.rx,y:point.y+dy*point.ry}));
        const color=point.team===1?palette.team1:point.team===2?palette.team2:'#d2eff8';
        const polygon=L.polygon(vertices,{color,weight:this.colorBlind?2:1,dashArray:this.colorBlind&&point.team===2?'3 4':null,fillColor:color,fillOpacity:.16}).addTo(this.objectivesLayer);
        polygon.on('click',event=>{L.DomEvent.stopPropagation(event);if(this.pointPicker){const callback=this.pointPicker;this.pointPicker=null;callback(event.latlng?this._point(event.latlng):point);return;}this.onSelect(point);});
        polygon.bindTooltip(escapeHTML(point.name),{className:'zz-map-tooltip'});
        return;
      }
      const red = point.team === 'red' || point.team === 2 || point.team === '2' || point.team === 'team2';
      const title = escapeHTML(point.name || (isMain ? 'Ana üs' : `Hedef ${index + 1}`));
      const state=point.captureStatus,active=['selected','next'].includes(state);
      const dense=this.config.points.length>12&&!isMain&&!active;
      const showName=this.overlays.labels&&(active||!dense||this.map.getZoom()>this.map.getBoundsZoom(this.bounds,false,[20,20])+.8+Math.log2(Math.max(1,(markerSize/29+labelSize/12)/2)));
      const inside = isMain ? (this.colorBlind?`<span>${red?'T2':'T1'}</span>`:'<span>⌂</span>') : state==='selected'?'⚑':escapeHTML(point.order ?? index + 1);
      const chance=state==='next'?`<span class="zz-capture-chance">%${Math.round(point.probability*100)}</span>`:'';
      const icon = this._icon(`<div class="zz-objective${state?' capture-'+state:''}${dense?' is-dense':''}"><span class="zz-objective-disc${isMain ? ' is-main' : ''}${red ? ' team-red' : ''}${dense?' dense':''}${state?' capture-'+state:''}">${inside}</span>${chance}${this.colorBlind&&active?`<span class="zz-cb-state">${state==='selected'?'✓ Seçili':'→ Sıradaki'}</span>`:''}</div>`);
      const name=`${point.name||'Hedef'}${state==='selected'?' · Seçili bayrak, bu adımdan geri al':state==='next'?` · ${point.order}. hedef · %${Math.round(point.probability*100)}`:state==='future'?` · ${point.order}. hedef, ileride`:''}`;
      const activate=event=>{L.DomEvent.stopPropagation(event);if(this.pointPicker){const callback=this.pointPicker;this.pointPicker=null;callback(point);return;}if(this.regionEditor?.handlePoint(point))return;if(this.tool!=='pan'){this._acceptPoint(point);return;}this._status({text:`${point.name||'Hedef'} · ${this.getGrid(point)}`,grid:this.getGrid(point)});this.onSelect({...point,isMain});};
      if(this.overlays.zones&&!isMain)for(const zone of point.zones||[]){
        const colour=state==='selected'?palette.selected:state==='next'?palette.next:'#d4e4ea';
        const options={color:colour,weight:this.colorBlind?2.5:active?1.5:1,dashArray:this.colorBlind&&state==='next'?'8 5':null,fillColor:colour,fillOpacity:active?.14:.035,opacity:active?.9:.3,bubblingMouseEvents:false};
        const shape=zone.type==='circle'?L.circle(this._latLng(zone),{...options,radius:zone.radius}):L.polygon(zone.points.map(p=>this._latLng(p)),options);
        shape.addTo(this.objectivesLayer).on('click',activate).bindTooltip(escapeHTML(name),{className:'zz-map-tooltip'});
        const element=shape.getElement();if(element){element.setAttribute('role','button');element.setAttribute('tabindex','0');element.setAttribute('aria-label',`${name} · ele geçirme bölgesi`);element.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e);}});}
      }
      const marker = L.marker(this._latLng(point), { icon, title: point.name || 'Hedef', alt:name, keyboard: true, riseOnHover: true, zIndexOffset:active?300:0 }).addTo(this.objectivesLayer);
      marker.getElement()?.setAttribute('aria-label',name);
      marker.on('click',activate);
      if (showName) {
        // Etiket ayrı zz-labels panesinde; komşu disk altındaki kutuya biniyorsa etiket diskin üstüne alınır (zoomend'de yeniden hesaplanır).
        const me=screen.find(o=>o.point===point),r=me.r,extra=(state==='next'?26:0)+(this.colorBlind&&active?22:0),w=Math.min(210,Math.ceil(String(point.name||'Hedef').length*.62*labelSize)+16),h=Math.ceil(labelSize*1.35)+8;
        const tl=this.map.latLngToContainerPoint(this._latLng({x:0,y:0})),edge=box=>box.t<tl.y+24||box.l<tl.x+26;
        const below={l:me.x-w/2,r:me.x+w/2,t:me.y+r+4+extra,b:me.y+r+4+extra+h},up={l:below.l,r:below.r,t:me.y-r-4-h,b:me.y-r-4},side={l:me.x+r+6,r:me.x+r+6+w,t:me.y-h/2,b:me.y+h/2};
        const free=box=>!hits(point,box)&&!edge(box);
        const place=free(below)?'below':free(up)?'above':free(side)?'side':!hits(point,below)?'below':!hits(point,up)?'above':'below';
        const transform=place==='above'?`translate(-50%,calc(-100% - ${r+4}px))`:place==='side'?`translate(${r+6}px,-50%)`:`translate(-50%,${r+4+extra}px)`;
        L.marker(this._latLng(point),{icon:this._icon(`<span class="zz-label-box" style="transform:${transform}"><span class="zz-objective-name">${title}</span></span>`,'zz-label-icon'),pane:'zz-labels',interactive:true,keyboard:false,bubblingMouseEvents:false}).addTo(this.objectivesLayer).on('click',activate);
      }
      if (!showName) marker.bindTooltip(escapeHTML(name), { className: 'zz-map-tooltip', direction: 'top', offset: [0, -20] });
    };
    this.config.points.forEach((point, index) => render(point, index, false));
    this.config.mains.forEach((point, index) => render(point, index, true));
  }

  _renderGrid() {
    this.gridLayer.clearLayers();
    if (!this.config || !this.overlays.grid) return;
    const L = this.L;
    const pxPer300 = 300 * this.map.options.crs.scale(this.map.getZoom());
    const minor = pxPer300 >= 120;
    const step = minor ? 100 : 300;
    for (let x = 0; x <= this.width; x += step) {
      const major = x % 300 === 0;
      L.polyline([[0, x], [-this.height, x]], { pane: 'zz-grid', color: '#d7e3dd', opacity: major ? 0.3 : 0.13, weight: major ? 0.8 : 0.6, dashArray: major ? null : '3 5', interactive: false }).addTo(this.gridLayer);
    }
    for (let y = 0; y <= this.height; y += step) {
      const major = y % 300 === 0;
      L.polyline([[-y, 0], [-y, this.width]], { pane: 'zz-grid', color: '#d7e3dd', opacity: major ? 0.3 : 0.13, weight: major ? 0.8 : 0.6, dashArray: major ? null : '3 5', interactive: false }).addTo(this.gridLayer);
    }
    if (pxPer300 < 27) return;
    const scale=this.map.options.crs.scale(this.map.getZoom());
    const gridLabel=(x,y,label)=>L.marker([-y-8/scale,x+5/scale],{pane:'zz-grid',icon:this._icon(`<span class="zz-grid-label" aria-hidden="true">${label}</span>`),interactive:false,keyboard:false}).addTo(this.gridLayer);
    if(pxPer300<95){
      for(let x=0;x<this.width;x+=300)gridLabel(x+100,0,this._columnName(Math.floor(x/300)));
      for(let y=300;y<this.height;y+=300)gridLabel(0,y,String(Math.floor(y/300)+1));
    }else{
      for(let x=0;x<this.width;x+=300)for(let y=0;y<this.height;y+=300)gridLabel(x,y,`${this._columnName(Math.floor(x/300))}${Math.floor(y/300)+1}`);
    }
  }

  _renderAnnotations() {
    this.annotationLayer.clearLayers();
    this.rangeLayer.clearLayers();
    if (!this.config) return;
    const L = this.L;
    let pinIndex = 0;
    for (const item of this.annotations) {
      const a = item.points[0], b = item.points[1];
      const latA = this._latLng(a);
      const style=cleanStyle(item.style),appearance=annotationAppearance(this.colorMode||'none',style.color),colour=appearance.color;
      if(appearance.code&&!['mortar','measure'].includes(item.tool))L.marker(latA,{icon:this._icon(`<span class="zz-draw-code">${appearance.code}</span>`,'zz-category-marker'),interactive:false,keyboard:false,zIndexOffset:400}).addTo(this.annotationLayer);
      const selectable=layer=>{layer.addTo(this.annotationLayer);layer.on('click',e=>{L.DomEvent.stopPropagation(e);if(this.pointPicker&&e.latlng)this._click(e.latlng);else if(this.tool==='pan')this.selectAnnotation(item.id);else if(e.latlng)this._click(e.latlng);});return layer;};
      if(['circle','rectangle','line','brush'].includes(item.tool)){
        const options={color:colour,weight:style.weight,dashArray:appearance.dash||(style.dashed?'7 6':null),fillColor:colour,fillOpacity:.12};
        const latB=this._latLng(b),geometry=this._geometry(a,b);
        if(item.tool==='circle')selectable(L.circle(latA,{...options,radius:geometry.distance}));
        else if(item.tool==='rectangle')selectable(L.rectangle(L.latLngBounds(latA,latB),options));
        else selectable(L.polyline(item.points.map(p=>this._latLng(p)),options));
        if(this.overlays.labels&&item.label)this._label(a,escapeHTML(item.label));
        else if(this.overlays.labels&&item.tool==='circle')this._label(a,`r = ${Math.round(geometry.distance)} m`);
        continue;
      }
      if (item.tool === 'pin') {
        pinIndex++;
        const svg=style.symbol==='pin'?`<svg class="zz-pin" viewBox="0 0 27 34" aria-hidden="true"><path d="M13.5 33S1 21 1 13.5a12.5 12.5 0 1 1 25 0C26 21 13.5 33 13.5 33Z" fill="${colour}" style="stroke:var(--zz-map-bg,#101619)" stroke-width="2"/><circle cx="13.5" cy="13" r="4" style="fill:var(--zz-surface-solid,#14242c)"/></svg>`:squadSymbol(style.symbol,colour);
        selectable(L.marker(latA, { icon: this._icon(svg), title:item.label||SYMBOLS[style.symbol] }));
        if (this.overlays.labels) this._label(a, escapeHTML(item.label || `İşaret ${pinIndex}`));
      } else if (item.tool === 'hab') {
        const radii=fobRadii(this.config.id);
        selectable(L.marker(latA, { icon: this._icon(squadSymbol('hab',colour)),title:item.label||'HAB' }));
        if (this.overlays.labels) this._label(a, escapeHTML(item.label || 'HAB') + `<br><span style="opacity:.7">FOB telsizi: ${radii.build} / ${radii.exclusion} m</span>`);
        if (this.overlays.ranges) {
          L.circle(latA, { pane: 'zz-ranges', radius: radii.exclusion, color: paletteFor(this.colorMode).flight, weight: 1.5, opacity: 0.7, dashArray: '6 6', fillColor: paletteFor(this.colorMode).flight, fillOpacity: 0.035, interactive: false }).addTo(this.rangeLayer);
          L.circle(latA, { pane: 'zz-ranges', radius: radii.build, color: paletteFor(this.colorMode).ground, weight: 1.5, opacity: 0.8, fillColor: paletteFor(this.colorMode).ground, fillOpacity: 0.10, interactive: false }).addTo(this.rangeLayer);
        }
      } else if (b) {
        const geometry = this._geometry(a, b);
        const color = item.tool === 'mortar' ? paletteFor(this.colorMode).flight : colour;
        const latB = this._latLng(b);
        selectable(L.polyline([latA, latB], { color, weight: style.weight, opacity: 0.95, dashArray: appearance.dash||(item.tool === 'arrow'&&!style.dashed ? null : '7 5') }));
        if (item.tool === 'arrow') {
          const svg = `<div class="zz-arrow-head"><svg width="24" height="24" viewBox="0 0 24 24" style="transform:rotate(${geometry.bearing}deg)"><path d="M12 1L23 23L12 17L1 23Z" fill="${color}" style="stroke:var(--zz-map-surface,#21323a)" stroke-width="1"/></svg></div>`;
          L.marker(latB, { icon: this._icon(svg), interactive: false, keyboard: false }).addTo(this.annotationLayer);
        } else {
          L.circleMarker(latB, { radius: 5, color, weight: 2, fillColor: '#172129', fillOpacity: 1, interactive: false }).addTo(this.annotationLayer);
        }
        if (item.tool === 'mortar') L.marker(latA, { icon: this._icon(squadSymbol(({grad:'grad',hell:'hell',m121:'m121',m121_air:'m121'})[item.mortar?.weapon]||'mortar',color)), interactive: false, keyboard: false }).addTo(this.annotationLayer);
        else L.circleMarker(latA, { radius: 3.5, color, weight: 2, fillColor: '#172129', fillOpacity: 1, interactive: false }).addTo(this.annotationLayer);
        if (this.overlays.labels) {
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          this._label(mid, `${item.label?escapeHTML(item.label)+'<br>':''}${Math.round(geometry.distance).toLocaleString('tr-TR')} m <span style="opacity:.45">/</span> ${Math.round(geometry.bearing) % 360}°${item.tool === 'mortar' ? '<br><span style="opacity:.65">Havan hattı · hesap için tıkla</span>' : ''}`);
        }
      }
    }
    this._renderEditHandles();
  }
}
