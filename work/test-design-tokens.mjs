// Tasarim belirteci denetimi (G2.4). Harici bagimlilik yok. Calistir: node work/test-design-tokens.mjs (depo kokunden; ZS_TOKENS_DIR / ZS_TOKENS_FIXTURE ile degistirilebilir)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve(process.env.ZS_TOKENS_DIR || 'outputs/zerozone-haritalar');
const fixturePath = path.resolve(process.env.ZS_TOKENS_FIXTURE || 'work/fixtures/frozen-media-baseline.json');

/* ---------- Kucuk CSS tokenizer ---------- */
function clean(src) { // yorumlari bosluga cevir (uzunluk ve satirlar korunur), tirnaklari atla
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i];
    if (q) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === q || c === '\n') q = null;
      i++; continue;
    }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2), end = e < 0 ? src.length : e + 2;
      out += src.slice(i, end).replace(/[^\n]/g, ' '); i = end; continue;
    }
    out += c; i++;
  }
  return out;
}
function parseCss(file) {
  const raw = fs.readFileSync(file, 'utf8'), text = clean(raw);
  const nl = []; for (let i = 0; i < text.length; i++) if (text[i] === '\n') nl.push(i);
  const lineAt = (o) => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < o) lo = m + 1; else hi = m; } return lo + 1; };
  const findClose = (open, limit) => { // '{' konumundan eslesen '}'
    let d = 0, q = null;
    for (let i = open; i < limit; i++) {
      const c = text[i];
      if (q) { if (c === '\\') i++; else if (c === q || c === '\n') q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '{') d++;
      else if (c === '}') { d--; if (d === 0) return i; }
    }
    return limit;
  };
  const parse = (s, e) => {
    const nodes = []; let i = s;
    while (i < e) {
      while (i < e && /\s/.test(text[i])) i++;
      if (i >= e) break;
      if (text[i] === ';') { i++; continue; }
      const start = i; let pd = 0, q = null, stop = -1;
      for (; i < e; i++) {
        const c = text[i];
        if (q) { if (c === '\\') i++; else if (c === q || c === '\n') q = null; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '(' || c === '[') pd++;
        else if (c === ')' || c === ']') pd--;
        else if (pd <= 0 && (c === '{' || c === ';')) { stop = i; break; }
      }
      const prelude = text.slice(start, stop < 0 ? e : stop).trim(), line = lineAt(start);
      if (stop >= 0 && text[stop] === '{') {
        const close = findClose(stop, e), children = parse(stop + 1, close);
        if (prelude.startsWith('@')) {
          const m = prelude.match(/^@([\w-]+)\s*([\s\S]*)$/);
          nodes.push({ kind: 'at', name: m[1].toLowerCase(), prelude: m[2], line, children, body: text.slice(stop + 1, close) });
        } else nodes.push({ kind: 'rule', selector: prelude, line, children });
        i = close + 1;
      } else {
        i = stop < 0 ? e : stop + 1;
        if (!prelude) continue;
        if (prelude.startsWith('@')) {
          const m = prelude.match(/^@([\w-]+)\s*([\s\S]*)$/);
          nodes.push({ kind: 'atstmt', name: m[1].toLowerCase(), prelude: m[2], line });
          continue;
        }
        const ci = prelude.indexOf(':'); if (ci < 0) continue;
        let value = prelude.slice(ci + 1).trim(), important = false;
        const im = value.match(/!\s*important\s*$/i);
        if (im) { important = true; value = value.slice(0, im.index).trim(); }
        nodes.push({ kind: 'decl', prop: prelude.slice(0, ci).trim().toLowerCase(), value, important, line });
      }
    }
    return nodes;
  };
  return { file, name: path.basename(file), raw, text, lineAt, nodes: parse(0, text.length) };
}
const flatten = (css) => { // her bildirim tasiyan blogu duzlestir
  const out = [];
  const walk = (nodes, ctx) => {
    const decls = nodes.filter((n) => n.kind === 'decl');
    if (ctx.sel !== null && decls.length) out.push({ css, selector: ctx.sel, decls, line: ctx.line, frozen: ctx.frozen, at: ctx.at, top: ctx.at.length === 0 });
    for (const n of nodes) {
      if (n.kind === 'rule') walk(n.children, { sel: n.selector.replace(/\s+/g, ' '), line: n.line, frozen: ctx.frozen, at: ctx.at });
      else if (n.kind === 'at') walk(n.children, { sel: n.children.some((c) => c.kind === 'decl') ? '@' + n.name : null, line: n.line, frozen: ctx.frozen || n.frozen === true, at: [...ctx.at, '@' + n.name + ' ' + n.prelude] });
    }
  };
  walk(css.nodes, { sel: null, line: 0, frozen: false, at: [] });
  return out;
};

const CSS = ['styles.css', 'armor.css'].map((f) => parseCss(path.join(dir, f)));
const [styles] = CSS;
const compact = (s) => s.replace(/\s+/g, '').toLowerCase();
const failures = {};
const fail = (rule, msg) => (failures[rule] ??= []).push(msg);
const where = (css, line) => `${css.name}:${line}`;

/* ---------- Kural 3 hazirligi: bloklar once dondurulmus isaretlenir (flatten bunu okur) ---------- */
// (Kural 1 :root'u, Kural 3 ise :root degerlerini kullandigi icin once :root okunur.)
const EXPECT = '--zs-bg:#111112; --zs-surface:rgba(13,14,15,.66); --zs-surface-2:rgba(13,14,15,.86); --zs-overlay:rgba(17,17,18,.98); --zs-accent:#b5e8fa; --zs-accent-soft:rgba(181,232,250,.06); --zs-accent-glow:rgba(181,232,250,.1); --zs-on-accent:#111; --zs-text:#f4f3ef; --zs-text-2:#aaa9a7; --zs-text-3:#8a8987; --zs-line:#ffffff12; --zs-line-2:#ffffff1c; --zs-line-3:#ffffff2e; --zs-radius:10px; --zs-radius-lg:14px; --zs-radius-pill:999px; --zs-fs-xs:12px; --zs-fs-sm:14px; --zs-fs-base:16px; --zs-fs-lg:18px; --zs-fs-h2:20px; --zs-fs-display:36px; --zs-lh-xs:16px; --zs-lh-sm:20px; --zs-lh-base:24px; --zs-lh-lg:28px; --zs-lh-h2:28px; --zs-lh-display:40px; --zs-fw-regular:400; --zs-fw-medium:500; --zs-fw-semibold:600; --zs-fw-bold:700; --zs-sp-2:8px; --zs-sp-3:12px; --zs-sp-4:16px; --zs-sp-5:24px; --zs-sp-6:32px; --zs-sp-7:40px; --zs-sp-8:60px; --zs-sp-9:88px; --zs-gutter:20px; --zs-container:1280px; --zs-bar-h:60px; --zs-bar-gap:12px; --zs-ease:cubic-bezier(.4,0,.2,1); --zs-t:150ms var(--zs-ease)';
const expected = Object.fromEntries(EXPECT.split(/;\s*/).map((p) => { const i = p.indexOf(':'); return [p.slice(0, i), p.slice(i + 1)]; }));
const rootDecls = {}; // prop -> {value,line}
for (const b of flatten(styles)) if (b.selector === ':root' && b.top) for (const d of b.decls) rootDecls[d.prop] = { value: d.value, line: d.line };
const rootLine = (p) => where(styles, rootDecls[p]?.line ?? 1);

/* ---------- Kural 1: :root belirtecleri ---------- */
for (const [p, v] of Object.entries(expected)) {
  const got = rootDecls[p];
  if (!got) fail(1, `${where(styles, 1)} :root icinde ${p} tanimli degil (beklenen ${v})`);
  else if (compact(got.value) !== compact(v)) fail(1, `${rootLine(p)} ${p} = "${got.value}" (beklenen "${v}")`);
}
if (!rootDecls['--zs-font'] || !/^["']?montserrat/i.test(rootDecls['--zs-font'].value.trim())) {
  fail(1, `${rootDecls['--zs-font'] ? rootLine('--zs-font') : where(styles, 1)} --zs-font Montserrat ile baslamali (bulunan "${rootDecls['--zs-font']?.value ?? 'yok'}")`);
}
if (rootDecls['--zs-shadow']) fail(1, `${rootLine('--zs-shadow')} --zs-shadow :root'ta olmamali (sitenin ad alani; --zz-shadow kullanilmali)`);
if (!rootDecls['--zz-shadow']) fail(1, `${where(styles, 1)} :root icinde --zz-shadow tanimli degil (beklenen #000a)`);
else if (compact(rootDecls['--zz-shadow'].value) !== '#000a') fail(1, `${rootLine('--zz-shadow')} --zz-shadow = "${rootDecls['--zz-shadow'].value}" (beklenen "#000a")`);
for (const p of Object.keys(rootDecls)) { // ad alani korumasi
  if (p.startsWith('--zs-') && p !== '--zs-font' && !(p in expected)) fail(1, `${rootLine(p)} ${p} tokens listesinde yok (--zs- ad alani korumali)`);
}
const ZZ_EXPECT = { '--zz-warn': '#f4c27b', '--zz-ok': '#addeb2', '--zz-danger': '#f19aa4', '--zz-map-surface': '#10191e', '--zz-map-bg': '#101314', '--zz-stage-top': '#26303a', '--zz-stage-bottom': '#11151b', '--zz-radius-xs': '6px' };
for (const p of ['--zz-team1', '--zz-team2', '--zz-red-zone', '--zz-surface-solid', '--zz-sidebar-w']) {
  if (!rootDecls[p]) fail(1, `${where(styles, 1)} :root icinde ${p} tanimli degil`);
}
for (const [p, v] of Object.entries(ZZ_EXPECT)) {
  if (!rootDecls[p]) fail(1, `${where(styles, 1)} :root icinde ${p} tanimli degil (beklenen ${v})`);
  else if (compact(rootDecls[p].value) !== v) fail(1, `${rootLine(p)} ${p} = "${rootDecls[p].value}" (beklenen "${v}")`);
}

/* ---------- Kural 2: eski adlar ---------- */
const OLD = { bg: 'zs-bg', surface: 'zs-surface-2', raised: 'zs-surface', line: 'zs-line', line2: 'zs-line-2', accent: 'zs-accent', text: 'zs-text', muted: 'zs-text-2', dim: 'zs-text-3', radius: 'zs-radius' };
for (const [o, n] of Object.entries(OLD)) {
  const d = rootDecls['--' + o];
  if (!d) fail(2, `${where(styles, 1)} :root icinde --${o} tanimli degil (beklenen var(--${n}))`);
  else if (compact(d.value) !== `var(--${n})`) fail(2, `${rootLine('--' + o)} --${o} = "${d.value}" (beklenen "var(--${n})")`);
}
const oldUse = new RegExp(`var\\(\\s*--(${Object.keys(OLD).join('|')})\\s*[,)]`, 'g');
for (const css of CSS) for (const m of css.text.matchAll(oldUse)) fail(2, `${where(css, css.lineAt(m.index))} eski ad kullanimi ${m[0]}`);

/* ---------- Kural 3: dondurulmus bloklar ---------- */
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const zzRoot = Object.fromEntries(Object.entries(rootDecls)
  .filter(([k, v]) => k.startsWith('--zz-') && /^#[0-9a-f]{3,8}$/i.test(v.value.trim()))
  .map(([k, v]) => [k, v.value.trim().toLowerCase()]));
const zsRoot = Object.fromEntries(Object.entries(expected)
  .filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v.trim()))
  .map(([k, v]) => [k, v.trim().toLowerCase()]));
const ORDER = [['zs-bg', 'bg'], ['zs-surface-2', 'surface'], ['zs-surface', 'raised'], ['zs-line-2', 'line2'], ['zs-line', 'line'], ['zs-accent', 'accent'], ['zs-text-2', 'muted'], ['zs-text-3', 'dim'], ['zs-text', 'text'], ['zs-radius', 'radius']];
function normalizeBody(b) {
  let s = compact(b);
  // fallback'li var(): yalnizca :root'ta cozulen deger fallback ile ayniysa indirgenir; degilse oldugu gibi kalir
  s = s.replace(/var\((--(?:zz|zs)-[\w-]+),(#[0-9a-f]{3,8})\)/g, (m, p, fb) => ((p.startsWith('--zz-') ? zzRoot[p] : zsRoot[p]) === fb ? fb : m));
  s = s.replace(/var\((--zz-[\w-]+)\)/g, (m, p) => zzRoot[p] ?? m);
  for (const [a, o] of ORDER) s = s.split(`var(--${a})`).join(`var(--${o})`);
  return s;
}
for (const css of CSS) {
  const key = Object.keys(fixture.files).find((k) => path.basename(k) === css.name);
  const fblocks = key ? fixture.files[key] : [];
  const medias = css.nodes.filter((n) => n.kind === 'at' && n.name === 'media');
  let ptr = 0;
  if (!key) fail(3, `${css.name} fikstürde yok`);
  fblocks.forEach((fb, k) => {
    const q = compact('@media' + fb.query.replace(/^@media\s*/i, ''));
    const fbody = compact(fb.body);
    let found = -1, firstSame = -1;
    for (let j = ptr; j < medias.length; j++) {
      if (compact('@media' + medias[j].prelude) !== q) continue;
      if (firstSame < 0) firstSame = j;
      if (normalizeBody(medias[j].body) === fbody) { found = j; break; }
    }
    if (found >= 0) { medias[found].frozen = true; ptr = found + 1; return; }
    if (firstSame >= 0) {
      const cur = normalizeBody(medias[firstSame].body); let d = 0;
      while (d < cur.length && cur[d] === fbody[d]) d++;
      medias[firstSame].frozen = true; ptr = firstSame + 1;
      fail(3, `${where(css, medias[firstSame].line)} dondurulmus blok #${k + 1} ${fb.query} degismis; ilk fark ofset ${d}: bulunan "...${cur.slice(Math.max(0, d - 20), d + 40)}" beklenen "...${fbody.slice(Math.max(0, d - 20), d + 40)}"`);
    } else fail(3, `${css.name} dondurulmus blok #${k + 1} ${fb.query} sirada bulunamadi (baslangic ${ptr}, toplam @media ${medias.length})`);
  });
}

/* ---------- Kurallar 4-8 icin duzlestirme (dondurulmus isaretler artik hazir) ---------- */
const blocks = CSS.flatMap(flatten);
const live = blocks.filter((b) => !b.frozen);
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const stripUrl = (v) => v.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'url()');
const allowedHex = new Set(['#f5f5f5', '#c3c3c3', '#ffffff30', '#000a']), allowedRgb = new Set();
const COLOR_FN = /(?:rgba?|hsla?)\([^)]*\)/gi;
const firstRoot = blocks.find((b) => b.css === styles && b.selector === ':root' && b.top);
const CB_SEL = /\.colorblind|#map-colorblind|\.high-contrast/;
const customAllowedBlock = (b) => b === firstRoot || (b.css === styles && CB_SEL.test(b.selector));
const addColors = (v) => {
  for (const m of v.match(HEX) ?? []) allowedHex.add(m.toLowerCase());
  for (const m of v.matchAll(COLOR_FN)) allowedRgb.add(compact(m[0]));
};
Object.values(expected).forEach(addColors);
// izinli liste yalniz ilk :root blogu ve colorblind/high-contrast secicilerinden beslenir
for (const b of blocks) if (customAllowedBlock(b)) for (const d of b.decls) if (d.prop.startsWith('--')) addColors(d.value);

/* Kural 4 */
const distinct = new Set();
for (const b of live) for (const d of b.decls) {
  const v = stripUrl(d.value), custom = d.prop.startsWith('--');
  for (const m of v.match(HEX) ?? []) {
    distinct.add(m.toLowerCase());
    if (!custom) fail(4, `${where(b.css, d.line)} ${b.selector} { ${d.prop}: ${d.value} } hex literal ${m}`);
    else if (!customAllowedBlock(b) || !allowedHex.has(m.toLowerCase())) fail(4, `${where(b.css, d.line)} ${d.prop}: ${d.value} izinli listede olmayan hex ${m}`);
  }
  for (const m of v.matchAll(COLOR_FN)) {
    if (!custom) fail(4, `${where(b.css, d.line)} ${b.selector} { ${d.prop}: ${d.value} } rgb/rgba/hsl literal ${m[0]}`);
    else if (!customAllowedBlock(b) || !allowedRgb.has(compact(m[0]))) fail(4, `${where(b.css, d.line)} ${d.prop}: ${d.value} izinli listede olmayan ${m[0]}`);
  }
}
if (distinct.size > 40) fail(4, `iki dosyada (dondurulmus bloklar haric) toplam FARKLI hex sayisi ${distinct.size} (> 40)`);

/* Kural 5 */
for (const css of CSS) {
  const imp = live.filter((b) => b.css === css).flatMap((b) => b.decls.filter((d) => d.important).map((d) => ({ b, d })));
  if (css === styles) {
    const ok = imp.filter(({ b, d }) => b.selector === '[hidden]' && d.prop === 'display' && compact(d.value) === 'none');
    for (const { b, d } of imp) if (!ok.some((o) => o.d === d)) fail(5, `${where(css, d.line)} ${b.selector} { ${d.prop}: ${d.value} !important } yasak`);
    if (ok.length !== 1) fail(5, `${css.name} icinde [hidden]{display:none!important} tam 1 olmali (bulunan ${ok.length})`);
  } else for (const { b, d } of imp) fail(5, `${where(css, d.line)} ${b.selector} { ${d.prop}: ${d.value} !important } armor.css'te !important yasak`);
}

/* Kural 6 */
const topTokens = (v) => {
  const t = []; let cur = '', pd = 0;
  for (const c of v) {
    if (c === '(') pd++;
    if (c === ')') pd--;
    if (/\s/.test(c) && pd === 0) { if (cur) t.push(cur); cur = ''; } else cur += c;
  }
  if (cur) t.push(cur);
  return t;
};
const RADIUS_OK = new Set(['var(--zs-radius)', 'var(--zs-radius-lg)', 'var(--zs-radius-pill)', 'var(--zz-radius-xs)', '50%', '0', 'inherit']);
for (const b of live) for (const d of b.decls) if (/^border(-(top|bottom)-(left|right))?-radius$/.test(d.prop)) {
  const bad = topTokens(d.value).filter((t) => !RADIUS_OK.has(t.replace(/\s+/g, '')));
  if (bad.length || !d.value.trim()) fail(6, `${where(b.css, d.line)} ${b.selector} { ${d.prop}: ${d.value} } izinsiz: ${bad.join(' ')}`);
}

/* Kural 7 */
const sizeOk = (c) => {
  if (c === 'inherit' || /var\(--zs-fs-[\w-]+\)/.test(c) || /var\(--(label|marker)-size/.test(c)) return true;
  const m = c.match(/^(\d*\.?\d+)(px|em|rem|%)$/);
  if (!m) return false;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n >= 12 : m[2] === '%' ? n >= 75 : n >= 0.75;
};
for (const b of live) for (const d of b.decls) {
  const v = d.value.trim();
  if (d.prop === 'font-size') {
    if (!sizeOk(compact(v))) fail(7, `${where(b.css, d.line)} ${b.selector} { font-size: ${v} } 12px alti veya belirtec disi`);
  } else if (d.prop === 'font') {
    if (compact(v) === 'inherit' || /var\(--zs-fs-[\w-]+\)/.test(v)) continue;
    const m = v.match(/(?:^|\s)(\d*\.?\d+)(px|em|rem|%)(?:\/|\s|$)/);
    if (!m || !sizeOk(m[1] + m[2])) fail(7, `${where(b.css, d.line)} ${b.selector} { font: ${v} } 12px alti veya boyut ayiklanamadi`);
  }
}

/* Kural 8 */
{
  const merged = (sel) => {
    const m = {};
    for (const b of live) {
      if (b.css === styles && b.selector.split(',').map((x) => x.trim()).includes(sel) && b.at.every((a) => /^@media\s*\(\s*min-width/i.test(a))) for (const d of b.decls) m[d.prop] = d;
    }
    return m;
  };
  const need = (rule, m, prop, pred, desc) => {
    const d = m[prop];
    if (!d) fail(8, `${where(styles, 1)} ${rule} icinde ${prop} yok (beklenen ${desc})`);
    else if (!pred(compact(d.value))) fail(8, `${where(styles, d.line)} ${rule} { ${prop}: ${d.value} } (beklenen ${desc})`);
  };
  const eq = (...vs) => (c) => vs.includes(c);
  const t = merged('.zs-topbar');
  need('.zs-topbar', t, 'height', eq('var(--zs-bar-h)'), 'var(--zs-bar-h)');
  for (const p of ['top', 'left', 'right']) need('.zs-topbar', t, p, eq('var(--zs-bar-gap)'), 'var(--zs-bar-gap)');
  need('.zs-topbar', t, 'border-radius', eq('var(--zs-radius)'), 'var(--zs-radius)');
  need('.zs-topbar', t, 'background', eq('var(--zs-surface)'), 'var(--zs-surface)');
  need('.zs-topbar', t, 'border', eq('1pxsolidvar(--zs-line)'), '1px solid var(--zs-line)');
  need('.zs-topbar', t, 'backdrop-filter', (c) => c.includes('blur(12px)'), 'blur(12px) icerir');
  need('.zs-topbar', t, '-webkit-backdrop-filter', (c) => c.includes('blur(12px)'), '-webkit-backdrop-filter blur(12px) icerir');
  const n = merged('.zs-nav a');
  need('.zs-nav a', n, 'color', eq('var(--zs-text)'), 'var(--zs-text)');
  need('.zs-nav a', n, 'border', eq('1pxsolidtransparent'), '1px solid transparent');
  const h = merged('.zs-nav a:hover');
  if (!h.background && h['background-color']) h.background = h['background-color'];
  need('.zs-nav a:hover', h, 'background', eq('var(--zs-line)'), 'var(--zs-line)');
  const ac = { ...merged('.zs-nav a[aria-current]'), ...merged('.zs-nav a.active') };
  need('.zs-nav a.active/[aria-current]', ac, 'color', eq('var(--zs-accent)'), 'var(--zs-accent)');
  const lg = merged('.login');
  need('.login', lg, 'text-transform', eq('uppercase'), 'uppercase');
  need('.login', lg, 'line-height', eq('16px', 'var(--zs-lh-xs)'), '16px');
  need('.zs-nav a', n, 'font-size', eq('var(--zs-fs-sm)'), 'var(--zs-fs-sm)');
  need('.zs-nav a', n, 'line-height', eq('var(--zs-lh-xs)', '16px'), 'var(--zs-lh-xs) veya 16px');
  need('.zs-nav a', n, 'font-weight', eq('var(--zs-fw-medium)', '500'), 'var(--zs-fw-medium) veya 500');
}

/* Kural 9: map-engine.js sablon dizgileri */
{
  const src = fs.readFileSync(path.join(dir, 'map-engine.js'), 'utf8');
  const lineOf = (o) => src.slice(0, o).split('\n').length;
  const templates = [];
  const scan = (i, inTpl) => { // inTpl: ${...} icindeyiz, eslesen '}' ile don
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      if (c === '"' || c === "'") { i++; while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; } i++; continue; }
      if (c === '`') { i = tpl(i); continue; }
      if (c === '{') depth++;
      if (c === '}') { if (inTpl && depth === 0) return i + 1; depth--; }
      i++;
    }
    return i;
  };
  const tpl = (i) => {
    const start = i; i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { templates.push({ start, end: i + 1 }); return i + 1; }
      if (c === '$' && src[i + 1] === '{') { i = scan(i + 2, true); continue; }
      i++;
    }
    return i;
  };
  scan(0, false);
  const insideVar = (text, idx) => {
    const st = [];
    for (let k = 0; k < idx; k++) {
      if (text[k] === '(') st.push(text.slice(k - 3, k + 1) === 'var(');
      else if (text[k] === ')') st.pop();
    }
    return st.some(Boolean);
  };
  let n = 0;
  for (const t of templates) {
    const text = src.slice(t.start, t.end);
    for (const m of text.matchAll(/(?<![\w&#])#[0-9a-fA-F]{3,8}(?![\w-])/g)) {
      n++;
      if (!insideVar(text, m.index)) fail(9, `map-engine.js:${lineOf(t.start + m.index)} fallback'siz hex ${m[0]} (var() disinda)`);
    }
  }
  if (!templates.length) fail(9, 'map-engine.js icinde sablon dizgisi bulunamadi (ayristirici hatasi?)');
  console.log(`  [bilgi] map-engine.js: ${templates.length} sablon, ${n} hex eslesmesi`);
}

/* Kural 10 */
for (const css of CSS) {
  const walk = (nodes) => {
    for (const n of nodes) {
      if ((n.kind === 'atstmt' || n.kind === 'at') && n.name === 'import') fail(10, `${where(css, n.line)} @import yasak: @import ${n.prelude}`);
      if (n.children) walk(n.children);
    }
  };
  walk(css.nodes);
}

/* ---------- Rapor ---------- */
const TITLES = { 1: ':root --zs/--zz belirtecleri', 2: 'eski adlar var(--zs-*) takma adi', 3: 'dondurulmus @media bloklari', 4: 'hex/rgb literal + farkli hex <= 40', 5: '!important', 6: 'border-radius kumesi', 7: 'font-size >= 12px / belirtec', 8: '.zs-topbar ve .zs-nav a', 9: 'map-engine.js sablonlarinda ciplak hex', 10: '@import' };
const stat = CSS.map((c) => { const f = flatten(c); return `${c.name}: ${f.length} blok/${f.reduce((a, b) => a + b.decls.length, 0)} bildirim`; }).join('; ');
console.log(`  [bilgi] ayristirici: ${stat}; farkli hex (canli) = ${distinct.size}`);
let red = 0;
for (let r = 1; r <= 10; r++) {
  const f = failures[r] ?? [];
  try {
    assert.equal(f.length, 0, `Kural ${r} (${TITLES[r]}): ${f.length} hata\n    ` + f.slice(0, 8).join('\n    ') + (f.length > 8 ? `\n    ... +${f.length - 8} daha` : ''));
    console.log(`PASS kural ${r} ${TITLES[r]}`);
  } catch (e) { red++; console.log(`FAIL ${e.message}`); }
}
if (red) { console.log(`FAIL design-tokens: ${red}/10 kural kirmizi`); process.exitCode = 1; }
else console.log('PASS design-tokens');
