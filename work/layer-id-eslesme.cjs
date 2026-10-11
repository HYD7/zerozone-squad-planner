// Katalog katman id'lerini SquadJS (finished.json) katman adlariyla karsilastirir.
// normalizeLayerId outputs/.../live-sync.js'den gelir (ES modulu -> dinamik import).
// Kullanim: node work/layer-id-eslesme.cjs [layers.json]
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const TMP = 'C:/Users/hubey/AppData/Local/Temp/orkestra';
const src = process.argv[2] || path.join(TMP, 'layers.json');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../outputs/zerozone-haritalar/data/catalog.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
const sq = (raw.Maps || raw).map(m => ({ id: m.rawName || m.Name, mapId: m.mapId, name: m.Name }));
const cat = catalog.flatMap(m => m.layers.map(l => ({ id: l.id, mapId: m.id })));
(async () => {
const { normalizeLayerId: norm } = await import(pathToFileURL(path.join(__dirname, '../outputs/zerozone-haritalar/live-sync.js')).href);
const sqSet = new Set(sq.map(x => x.id)), sqNorm = new Map(sq.map(x => [norm(x.id), x.id]));
const stripCl = n => n.replace(/_cl$/, '');
const sqNormNoCl = new Map(sq.map(x => [stripCl(norm(x.id)), x.id]));
const exact = [], viaNorm = [], viaCl = [], none = [];
for (const c of cat) {
  if (sqSet.has(c.id)) exact.push(c.id);
  else if (sqNorm.has(norm(c.id))) viaNorm.push([c.id, sqNorm.get(norm(c.id))]);
  else if (sqNormNoCl.has(stripCl(norm(c.id)))) viaCl.push([c.id, sqNormNoCl.get(stripCl(norm(c.id)))]);
  else none.push(c.id);
}
const catNorm = new Set(cat.map(c => norm(c.id)));
const sqOnly = sq.filter(x => !catNorm.has(norm(x.id))).map(x => x.id);
const mapPairs = {};
for (const c of cat) { const s = sq.find(x => norm(x.id) === norm(c.id)); if (s && s.mapId !== c.mapId) mapPairs[c.mapId] = s.mapId; }
const out = { katalogKatman: cat.length, squadjsKatman: sq.length, tam: exact.length, normalizeIle: viaNorm, clSoneki: viaCl, eslesmeyen: none, squadjsdeVarKatalogdaYok: sqOnly, harita_id_farklari: mapPairs };
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(path.join(TMP, 'layer-id-eslesme-sonuc.json'), JSON.stringify(out, null, 1));
console.log(`katalog ${cat.length} | squadjs ${sq.length} | tam ${exact.length} | normalize ${viaNorm.length} | _CL soneki ${viaCl.length} | eslesmeyen ${none.length}`);
console.log('normalize ile:', viaNorm);
console.log('_CL soneki atilarak:', viaCl);
console.log('eslesmeyen:', none);
console.log('harita id farklari:', mapPairs);
console.log('squadjs-de olup katalogda olmayan:', sqOnly.length, sqOnly.slice(0, 40));
})();
