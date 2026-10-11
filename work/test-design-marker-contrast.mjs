// Harita isaret zemini kontrast testi. Calistir: node work/test-design-marker-contrast.mjs (ZS_TOKENS_DIR ile dizin degistirilebilir)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve(process.env.ZS_TOKENS_DIR || 'outputs/zerozone-haritalar');
const js = fs.readFileSync(path.join(dir, 'map-engine.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');

// injectStyles sablonu
const fnAt = js.indexOf('function injectStyles()');
assert.ok(fnAt >= 0, 'injectStyles bulunamadi');
const a = js.indexOf('style.textContent = `', fnAt);
assert.ok(a >= 0, 'style.textContent sablonu bulunamadi');
const tpl = js.slice(a + 'style.textContent = `'.length, js.indexOf('`;', a));

function rules(src) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(src))) out.push({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] });
  return out;
}
const tr = rules(tpl);
const BS = String.fromCharCode(92);
const decl = (body, prop) => { const m = new RegExp('(?:^|;)' + BS + 's*' + prop + BS + 's*:' + BS + 's*([^;]+)', 'i').exec(body); return m && m[1].trim(); };
const find = (suffix) => {
  const rs = tr.filter((x) => x.sel === '.zz-tactical-map .zz-objective-disc' + suffix);
  assert.ok(rs.length, 'kural yok: ' + suffix); return { body: rs.map((x) => x.body).join(';') };
};

// 1) Sablon: arka plan --zz-*-bg, yazi rengi --zs-text
const base = find('');
assert.match(decl(base.body, 'color') || '', /^var\(--zs-text\b/, 'taban isaret color --zs-text olmali');
const expectBg = { '.is-main': '--zz-team1-bg', '.team-red': '--zz-team2-bg', '.capture-selected': '--zz-ok-bg', '.capture-next': '--zz-next-bg' };
for (const [sfx, tok] of Object.entries(expectBg)) {
  const r = find(sfx);
  const bg = decl(r.body, 'background') || '';
  assert.ok(bg.startsWith('var(' + tok + ','), `${sfx} background ${tok} kullanmali, gelen: ${bg}`);
  const col = decl(r.body, 'color');
  if (col) assert.match(col, /^var\(--zs-text\b/, `${sfx} color --zs-text olmali, gelen: ${col}`);
}

// 2) :root degerleri ve sablon yedek degerleri, #f4f3ef ile >= 4.5
const root = { body: rules(css).filter((r) => r.sel === ':root').map((r) => r.body).join(';') };
assert.ok(root.body, ':root yok');
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; };
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
const contrast = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
const mapBg = hex(decl(root.body, '--zz-map-bg'));
const text = hex('#f4f3ef');
for (const tok of Object.values(expectBg)) {
  const v = decl(root.body, tok);
  assert.match(v || '', /^#[0-9a-f]{6}([0-9a-f]{2})?$/i, tok + ' hex olmali: ' + v);
  const c = contrast(text, over(hex(v), mapBg));
  assert.ok(c >= 4.5, `${tok}=${v} kontrast ${c.toFixed(2)} < 4.5`);
  const fb = new RegExp('var' + BS + '(' + tok + ',' + BS + 's*(#[0-9a-fA-F]+)' + BS + ')').exec(tpl);
  assert.ok(fb, tok + ' yedek degeri yok');
  const c2 = contrast(text, over(hex(fb[1]), mapBg));
  assert.ok(c2 >= 4.5, `${tok} yedek ${fb[1]} kontrast ${c2.toFixed(2)} < 4.5`);
}
console.log('design-marker-contrast OK');
