// Erisilebilirlik gecersiz kilmalari: body.colorblind --zs-* belirteclerini ezer, takim renkleri --cb-team1/2 kalir.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve(process.env.ZS_TOKENS_DIR || 'outputs/zerozone-haritalar');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));
const decls = (body) => Object.fromEntries(body.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));

const bodyCb = rules.filter((r) => r.sel === 'body.colorblind');
assert.ok(bodyCb.length >= 1, 'body.colorblind blogu yok');
const d = Object.assign({}, ...bodyCb.map((r) => decls(r.body)));
for (const p of ['--zs-text', '--zs-text-2', '--zs-line', '--zs-line-2']) assert.ok(d[p], `body.colorblind ${p} degerini ezmiyor`);
for (const p of ['--text', '--muted', '--line', '--line2']) assert.equal(d[p], undefined, `body.colorblind eski ad ${p} kullaniyor`);
assert.equal(d['--zs-accent'], 'var(--cb-team1)', 'body.colorblind --zs-accent cb-team1 olmali');

const ws = Object.assign({}, ...rules.filter((r) => r.sel === '.workspace.colorblind').map((r) => decls(r.body)));
assert.equal(ws['--zs-accent'], 'var(--cb-team1)', '.workspace.colorblind --zs-accent');

// .workspace.colorblind altinda takim renkleri --cb-team1/2 kalmali (team-emblem/faction-code).
const find = (re) => rules.filter((r) => r.sel.split(',').some((s) => re.test(s.trim())));
const check = (re, team) => {
  const rs = find(re);
  assert.ok(rs.length, `kural bulunamadi ${re}`);
  const all = rs.map((r) => r.body).join(';');
  assert.ok(all.includes(`var(--cb-team${team})`), `${re} icin var(--cb-team${team}) yok`);
  assert.ok(!/--zz-team[12]|--team[12]|--blue|--red\b/.test(all), `${re} takim rengini --cb-team disindan aliyor`);
};
check(/^\.workspace\.colorblind \.team-emblem$/, 1);
check(/^\.workspace\.colorblind \.team-emblem\.red$/, 2);
check(/^\.workspace\.colorblind \.faction-code\.red$/, 2);
check(/^\.workspace\.colorblind \.legend-dot\.blue$/, 1);
check(/^\.workspace\.colorblind \.legend-dot\.red$/, 2);
// .workspace.colorblind ile baslayan hicbir kuralda renkli ozellikler cb-team disi takim degiskeni kullanmamali
for (const r of rules.filter((r) => /colorblind/.test(r.sel))) {
  assert.ok(!/var\(--zz-team[12]\)/.test(r.body), `${r.sel}: --zz-team kullaniyor`);
}
console.log('PASS design-a11y-overrides');
