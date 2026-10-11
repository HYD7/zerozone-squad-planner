import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeLayerId, resolveLive, createLiveSync } from '../outputs/zerozone-haritalar/live-sync.js';

const dir = new URL('../outputs/zerozone-haritalar/data/', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('catalog.json', dir), 'utf8'));
const units = JSON.parse(fs.readFileSync(new URL('units.json', dir), 'utf8'));

const live = (over = {}) => ({
  ok: true, online: true, layerId: 'Gorodok_AAS_v1', mapName: 'Gorodok', mode: 'AAS',
  teams: [{ index: 1, faction: 'AFU', unit: 'AFU_LO_CombinedArms' }, { index: 2, faction: 'RGF', unit: 'RGF_LO_CombinedArms' }],
  nextLayerId: null, updatedAt: 1, ...over,
});

// --- resolveLive ---
{
  const r = resolveLive(live(), catalog, units);
  assert.equal(r.mapId, 'Gorodok');
  assert.equal(r.layerId, 'Gorodok_AAS_v1');
  assert.deepEqual(r.factions, ['AFU', 'RGF']);
  assert.deepEqual(r.units, ['AFU_LO_CombinedArms', 'RGF_LO_CombinedArms']);
  assert.equal(r.exact, true);
  assert.match(r.label, /Gorodok AAS v1 — AFU vs RGF/);
}
{ // buyuk/kucuk harf ve ayirici
  const r = resolveLive(live({ layerId: 'gorodok_aas_v1' }), catalog, units);
  assert.equal(r.layerId, 'Gorodok_AAS_v1');
  assert.equal(r.matchedBy, 'normalize');
}
{ // alias
  assert.equal(normalizeLayerId('JensensRange_USA-PLA'), normalizeLayerId('Jensens_Range_USA-PLA'));
  assert.equal(normalizeLayerId('Manic_AAS_v1'), 'manicouagan_aas_v1');
  assert.equal(normalizeLayerId('Kohat_RAAS_v01'), 'kohat_raas_v1');
  const r = resolveLive(live({ layerId: 'JensensRange_USA-PLA', mapName: "Jensen's Range", mode: 'Training', teams: [] }), catalog, units);
  assert.equal(r.layerId, 'Jensens_Range_USA-PLA');
  assert.equal(r.mapId, 'JensensRange');
  const m = resolveLive(live({ layerId: 'Manic_AAS_v1', mapName: 'Manicouagan' }), catalog, units);
  assert.equal(m.layerId, 'Manicouagan_AAS_v1');
}
{ // Sanxian: harita id katmandan turetilemez
  const r = resolveLive(live({ layerId: 'Sanxian_AAS_v1', mapName: 'Sanxian Islands', teams: [] }), catalog, units);
  assert.equal(r.mapId, 'Sanxian_Islands');
  assert.equal(r.layerId, 'Sanxian_AAS_v1');
}
{ // son care: mapName+mode+surum
  const r = resolveLive(live({ layerId: 'Gorodok_AAS_v1_XYZ', mapName: 'Gorodok', mode: 'AAS' }), catalog, units);
  assert.equal(r, null); // surum cikarilamaz, birden fazla aday
  const r2 = resolveLive(live({ layerId: 'Sanxian_Islands_AAS_v2', mapName: 'Sanxian Islands', mode: 'AAS' }), catalog, units);
  assert.equal(r2.layerId, 'Sanxian_AAS_v2');
  assert.equal(r2.matchedBy, 'normalize'); // Sanxian_Islands_ on eki alias ile
  const r3 = resolveLive(live({ layerId: null, mapName: 'Sanxian Islands', mode: 'Skirmish', teams: [] }), catalog, units);
  assert.equal(r3.layerId, 'Sanxian_Skirmish_v1');
  assert.equal(r3.exact, false);
  assert.equal(r3.matchedBy, 'fallback');
}
{ // _CL soneki yok -> exact:false
  const r = resolveLive(live({ layerId: 'Harju_RAAS_v3', mapName: 'Harju', teams: [] }), catalog, units);
  assert.ok(r.layerId.startsWith('Harju_RAAS_v3'));
}
{ // options disi ama units.json'da bulunan birlik
  const layer = catalog.find((m) => m.id === 'Gorodok').layers.find((l) => l.id === 'Gorodok_AAS_v1');
  const allowed = new Set(layer.teams.flatMap((t) => t.options.flatMap((o) => o.units)));
  const outside = Object.keys(units.units).find((u) => !allowed.has(u) && units.units[u].faction === 'AFU');
  assert.ok(outside, 'options disi AFU birligi bulunmali');
  const r = resolveLive(live({ teams: [{ index: 1, faction: 'AFU', unit: outside }, { index: 2, faction: 'RGF', unit: null }] }), catalog, units);
  assert.equal(r.units[0], outside);
  assert.equal(r.unitSource, 'live');
  assert.equal(r.unitSources[0], 'live');
  assert.equal(r.unitSources[1], 'option');
}
{ // bilinmeyen birlik -> ayni fraksiyonun options'taki ilk birligi
  const r = resolveLive(live({ teams: [{ index: 1, faction: 'AFU', unit: 'AFU_YOK_Birlik' }, { index: 2, faction: 'RGF', unit: null }] }), catalog, units);
  assert.equal(r.unitSources[0], 'option');
  assert.ok(units.units[r.units[0]], 'yedek birlik units.json icinde olmali');
  assert.equal(units.units[r.units[0]].faction, 'AFU');
  // fraksiyon da bilinmiyorsa katman varsayilani
  const d = resolveLive(live({ teams: [] }), catalog, units);
  assert.equal(d.unitSources[0], 'default');
  assert.ok(d.units[0]);
}
// cevrimdisi / bozuk
assert.equal(resolveLive(live({ online: false }), catalog, units), null);
assert.equal(resolveLive(live({ ok: false }), catalog, units), null);
assert.equal(resolveLive(null, catalog, units), null);
assert.equal(resolveLive(live({ layerId: 'Yok_AAS_v1', mapName: 'Yok' }), catalog, units), null);

// --- createLiveSync ---
const resp = (status, body, headers = {}) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => { if (body === 'BAD') throw new SyntaxError('x'); return body; },
});
const mkTimers = () => {
  const q = []; let id = 0;
  return {
    q,
    setTimeout: (fn, ms) => { q.push({ id: ++id, fn, ms }); return id; },
    clearTimeout: (h) => { const i = q.findIndex((t) => t.id === h); if (i >= 0) q.splice(i, 1); },
    async fire() { const t = q.shift(); await t.fn(); await tick(); },
  };
};
const tick = () => new Promise((r) => setImmediate(r));
const mkDoc = (vs = 'visible') => {
  const d = { visibilityState: vs, l: new Set(), addEventListener: (e, f) => d.l.add(f), removeEventListener: (e, f) => d.l.delete(f) };
  d.set = (v) => { d.visibilityState = v; d.l.forEach((f) => f()); };
  return d;
};
const harness = (responses, opts = {}) => {
  const calls = [], updates = [], disables = [];
  const timers = mkTimers();
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r;
  };
  const s = createLiveSync({ fetchImpl, timers, onUpdate: (p) => updates.push(p), onDisable: (r) => disables.push(r), intervalMs: 20000, ...opts });
  return { s, calls, updates, disables, timers };
};

{ // ilk istek hemen, ETag, 304, ayni imza
  const p1 = live();
  const h = harness([resp(200, p1, { etag: '"a"' }), resp(304, null), resp(200, live({ updatedAt: 2 }), { etag: '"b"' }), resp(200, live({ layerId: 'Gorodok_AAS_v2' }), { etag: '"c"' })]);
  h.s.start(); await tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, '/api/haritalar/canli');
  assert.equal(h.updates.length, 1);
  assert.equal(h.timers.q[0].ms, 20000);
  await h.timers.fire();
  assert.equal(h.calls[1].headers['If-None-Match'], '"a"');
  assert.equal(h.updates.length, 1, '304: onUpdate yok');
  await h.timers.fire();
  assert.equal(h.updates.length, 1, 'ayni imza: onUpdate yok');
  await h.timers.fire();
  assert.equal(h.updates.length, 2, 'imza degisti');
  h.s.stop();
  assert.equal(h.timers.q.length, 0);
}
{ // 404 -> hemen onDisable, durur
  const h = harness([resp(404, null)]);
  h.s.start(); await tick();
  assert.deepEqual(h.disables, ['404']);
  assert.equal(h.timers.q.length, 0);
  assert.equal(h.s.state.running, false);
  await h.s.pollNow(); assert.equal(h.calls.length, 1);
}
{ // bozuk JSON
  const h = harness([resp(200, 'BAD')]);
  h.s.start(); await tick();
  assert.deepEqual(h.disables, ['bad-json']);
  assert.equal(h.timers.q.length, 0);
}
{ // ag hatasi: 3 deneme ustel geri cekilme sonra durur
  const h = harness([new Error('a'), new Error('b'), new Error('c')]);
  h.s.start(); await tick();
  assert.equal(h.timers.q[0].ms, 1000);
  await h.timers.fire();
  assert.equal(h.timers.q[0].ms, 2000);
  assert.equal(h.disables.length, 0);
  await h.timers.fire();
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.disables, ['network']);
  assert.equal(h.timers.q.length, 0);
}
{ // ag hatasi sonrasi basari sayaci sifirlar
  const h = harness([new Error('a'), resp(200, live()), new Error('b'), new Error('c'), resp(200, live())]);
  h.s.start(); await tick(); await h.timers.fire(); await h.timers.fire(); await h.timers.fire();
  assert.equal(h.disables.length, 0);
  h.s.stop();
}
{ // 429 retry-after
  const h = harness([resp(429, null, { 'retry-after': '7' }), resp(200, live())]);
  h.s.start(); await tick();
  assert.equal(h.timers.q[0].ms, 7000);
  assert.equal(h.disables.length, 0);
  await h.timers.fire();
  assert.equal(h.updates.length, 1);
  h.s.stop();
}
{ // gizli sekmede duraklat, gorunur olunca hemen yokla
  const doc = mkDoc('visible');
  const h = harness([resp(200, live()), resp(200, live({ layerId: 'Gorodok_AAS_v2' }))], { doc });
  h.s.start(); await tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.q.length, 1);
  doc.set('hidden');
  assert.equal(h.timers.q.length, 0, 'hidden: zamanlayici iptal');
  doc.set('visible'); await tick();
  assert.equal(h.calls.length, 2, 'visible: hemen yoklar');
  assert.equal(h.updates.length, 2);
  h.s.stop();
  assert.equal(doc.l.size, 0);
  // gizli baslangic
  const doc2 = mkDoc('hidden');
  const h2 = harness([resp(200, live())], { doc: doc2 });
  h2.s.start(); await tick();
  assert.equal(h2.calls.length, 0);
  doc2.set('visible'); await tick();
  assert.equal(h2.calls.length, 1);
  h2.s.stop();
}
{ // __ZZ_LIVE__ === false
  globalThis.__ZZ_LIVE__ = false;
  const h = harness([resp(200, live())]);
  h.s.start(); await tick();
  assert.equal(h.calls.length, 0);
  assert.equal(h.s.state.running, false);
  delete globalThis.__ZZ_LIVE__;
}

console.log('live-sync: PASS');
