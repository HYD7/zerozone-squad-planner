// Canli sunucu esitleme: /api/haritalar/canli yanitini planlayici katalogundaki katman/birlige cevirir.
// Tarayicida ve Node'da import edilebilir; DOM yalnizca parametreyle (doc) verilir.

// Alias tablosu: normalize edilmis on ek -> katalogdaki on ek (SquadJS ile katalog adlandirma farklari).
export const LAYER_ALIASES = [
  ['jensensrange_', 'jensens_range_'], // SquadJS: JensensRange_USA-RGF, katalog: Jensens_Range_USA-PLA
  ['manic_', 'manicouagan_'],
  ['sanxianislands_', 'sanxian_'], // harita id (Sanxian_Islands) katman on ekinden (Sanxian_) farkli
  ['sanxian_islands_', 'sanxian_'],
];

// Kucuk harf, '-' ve bosluk -> '_', surum sifir dolgusu (_v01 -> _v1), alias on ekleri.
export function normalizeLayerId(s) {
  let v = String(s == null ? '' : s).trim().toLowerCase().replace(/[-\s]+/g, '_');
  v = v.replace(/_v0+(\d)/g, '_v$1');
  for (const [from, to] of LAYER_ALIASES) {
    if (v.startsWith(from)) { v = to + v.slice(from.length); break; }
  }
  return v;
}

const stripCl = (n) => n.replace(/_cl$/, '');
const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const normVer = (s) => String(s || '').toLowerCase().replace(/^v0+(\d)/, 'v$1');
const indexCache = new WeakMap();

function getIndex(catalog) {
  const maps = Array.isArray(catalog) ? catalog : (catalog && catalog.maps) || [];
  let idx = indexCache.get(maps);
  if (idx) return idx;
  idx = { maps, byId: new Map(), byNorm: new Map(), byNormNoCl: new Map() };
  for (const map of maps) {
    for (const layer of map.layers || []) {
      const e = { map, layer };
      idx.byId.set(layer.id, e);
      const n = normalizeLayerId(layer.id);
      if (!idx.byNorm.has(n)) idx.byNorm.set(n, e);
      const nc = stripCl(n);
      if (!idx.byNormNoCl.has(nc)) idx.byNormNoCl.set(nc, e);
    }
  }
  indexCache.set(maps, idx);
  return idx;
}

function parseLayerId(id) {
  const m = /^(.*?)_(AAS|RAAS|Invasion|Seed|Skirmish|TC|TA|Destruction|Training)_(v\d+\w*)$/i.exec(String(id || ''));
  return m ? { map: m[1], mode: m[2], version: m[3] } : null;
}

function findLayer(payload, catalog) {
  const idx = getIndex(catalog);
  const id = payload.layerId;
  if (id) {
    if (idx.byId.has(id)) return { ...idx.byId.get(id), exact: true, via: 'id' };
    const n = normalizeLayerId(id);
    if (idx.byNorm.has(n)) return { ...idx.byNorm.get(n), exact: true, via: 'normalize' };
    const nc = stripCl(n);
    if (idx.byNormNoCl.has(nc)) return { ...idx.byNormNoCl.get(nc), exact: false, via: 'cl' };
  }
  // Son care: harita adi + mod + surum
  const p = parseLayerId(id);
  const mapKey = flat(payload.mapName || (p && p.map));
  const mode = String(payload.mode || (p && p.mode) || '').toLowerCase();
  const version = normVer(p && p.version);
  if (!mapKey) return null;
  const map = idx.maps.find((m) => flat(m.name) === mapKey || flat(m.id) === mapKey || flat(m.slug) === mapKey)
    || idx.maps.find((m) => flat(m.id).startsWith(mapKey) || mapKey.startsWith(flat(m.id)));
  if (!map) return null;
  const cand = (map.layers || []).filter((l) =>
    (!mode || String(l.mode || '').toLowerCase() === mode) &&
    (!version || normVer(l.version) === version));
  if (cand.length !== 1) return null;
  return { map, layer: cand[0], exact: false, via: 'fallback' };
}

function pickUnit(liveTeam, layerTeam, units) {
  const known = units && units.units ? units.units : {};
  if (liveTeam && liveTeam.unit && known[liveTeam.unit]) {
    return { unit: liveTeam.unit, faction: liveTeam.faction || known[liveTeam.unit].faction || (layerTeam && layerTeam.faction) || null, source: 'live' };
  }
  if (liveTeam && liveTeam.faction && layerTeam) {
    const opt = (layerTeam.options || []).find((o) => o.faction === liveTeam.faction && o.units && o.units.length);
    if (opt) return { unit: opt.units[0], faction: liveTeam.faction, source: 'option' };
  }
  if (layerTeam && layerTeam.unit) {
    return { unit: layerTeam.unit, faction: (liveTeam && liveTeam.faction) || layerTeam.faction || null, source: 'default' };
  }
  return { unit: null, faction: (liveTeam && liveTeam.faction) || null, source: 'none' };
}

export function resolveLive(payload, catalog, units) {
  if (!payload || payload.ok !== true || payload.online !== true) return null;
  const found = findLayer(payload, catalog);
  if (!found) return null;
  const { map, layer } = found;
  const live = Array.isArray(payload.teams) ? payload.teams : [];
  const picks = [1, 2].map((index) => {
    const lt = live.find((t) => t && t.index === index) || live[index - 1] || null;
    const ct = (layer.teams || []).find((t) => t.index === index) || (layer.teams || [])[index - 1] || null;
    return pickUnit(lt, ct, units);
  });
  const [a, b] = picks;
  return {
    mapId: map.id,
    layerId: layer.id,
    units: [a.unit, b.unit],
    factions: [a.faction, b.faction],
    unitSources: [a.source, b.source],
    unitSource: picks.some((p) => p.source === 'live') ? 'live' : 'fallback',
    label: `${layer.name || layer.id} — ${a.faction || '?'} vs ${b.faction || '?'}`,
    exact: found.exact,
    matchedBy: found.via,
  };
}

function signatureOf(p) {
  if (!p || p.ok !== true || p.online !== true) return 'offline';
  const t = Array.isArray(p.teams) ? p.teams : [];
  const side = (i) => { const x = t.find((q) => q && q.index === i) || {}; return `${x.faction || ''}/${x.unit || ''}`; };
  return [p.layerId || '', side(1), side(2)].join('|');
}

export function createLiveSync({
  fetchImpl, intervalMs = 20000, url = '/api/haritalar/canli', onUpdate, onDisable, doc, timers,
} = {}) {
  const T = timers || { setTimeout: (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: (h) => globalThis.clearTimeout(h) };
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  const state = {
    running: false, paused: false, disabled: false, reason: null,
    etag: null, signature: null, failures: 0, lastPayload: null, nextDelay: null,
  };
  let timer = null;
  let inflight = null;
  let visHandler = null;

  const clear = () => { if (timer != null) { T.clearTimeout(timer); timer = null; } };
  const schedule = (ms) => {
    clear();
    if (!state.running || state.paused) return;
    state.nextDelay = ms;
    timer = T.setTimeout(() => { timer = null; pollNow(); }, ms);
  };
  const disable = (reason) => {
    stop();
    state.disabled = true; state.reason = reason;
    if (onDisable) onDisable(reason);
  };

  function networkFail(reason) {
    if (!state.running) return 'stopped';
    state.failures += 1;
    if (state.failures >= 3) { disable(reason); return 'disabled'; }
    schedule(Math.min(intervalMs, 1000 * 2 ** (state.failures - 1)));
    return 'retry';
  }

  async function run() {
    const headers = { Accept: 'application/json' };
    if (state.etag) headers['If-None-Match'] = state.etag;
    let res;
    try {
      res = await doFetch(url, { headers, cache: 'no-store' });
    } catch (e) {
      return networkFail('network');
    }
    if (!state.running) return 'stopped';
    const status = res.status;
    if (status === 404) { disable('404'); return 'disabled'; }
    if (status === 429) {
      const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
      const ms = Number.isFinite(ra) && ra >= 0 ? ra * 1000 : intervalMs;
      schedule(ms); return 'rate-limited';
    }
    if (status === 304) { state.failures = 0; schedule(intervalMs); return 'not-modified'; }
    if (status < 200 || status >= 300) return networkFail('http-' + status);
    let body;
    try { body = await res.json(); } catch (e) { disable('bad-json'); return 'disabled'; }
    if (!state.running) return 'stopped';
    if (!body || typeof body !== 'object') { disable('bad-json'); return 'disabled'; }
    state.failures = 0;
    const et = res.headers && res.headers.get && res.headers.get('etag');
    if (et) state.etag = et;
    state.lastPayload = body;
    const sig = signatureOf(body);
    let changed = false;
    if (sig !== state.signature) {
      state.signature = sig; changed = true;
      if (onUpdate) onUpdate(body, { signature: sig });
    }
    schedule(intervalMs);
    return changed ? 'updated' : 'unchanged';
  }

  function pollNow() {
    if (!state.running) return Promise.resolve('stopped');
    if (inflight) return inflight;
    clear();
    inflight = run().finally(() => { inflight = null; });
    return inflight;
  }

  function start() {
    if (globalThis.__ZZ_LIVE__ === false || state.running) return;
    state.running = true; state.disabled = false; state.reason = null;
    if (doc && doc.addEventListener) {
      visHandler = () => {
        if (!state.running) return;
        if (doc.visibilityState === 'hidden') { state.paused = true; clear(); }
        else if (state.paused) { state.paused = false; pollNow(); }
      };
      doc.addEventListener('visibilitychange', visHandler);
    }
    if (doc && doc.visibilityState === 'hidden') { state.paused = true; return; }
    pollNow();
  }

  function stop() {
    state.running = false; state.paused = false;
    clear();
    if (doc && visHandler && doc.removeEventListener) doc.removeEventListener('visibilitychange', visHandler);
    visHandler = null;
  }

  return { start, stop, pollNow, state };
}
