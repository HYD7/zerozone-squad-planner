#!/usr/bin/env node
// Ön sıkıştırma: @fastify/static preCompressed:true için .br/.gz üretir.
// Kullanım: node work/precompress.cjs --kok <dizin> [--gzip] [--kalite 9] [--kuru]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const UZANTILAR = new Set(['.json', '.js', '.css', '.html', '.svg', '.wasm', '.md']);
const ASGARI = 1024;

function argumanlar(argv) {
  const a = { kok: null, gzip: false, kalite: 9, kuru: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--kok') a.kok = argv[++i];
    else if (v === '--gzip') a.gzip = true;
    else if (v === '--kuru') a.kuru = true;
    else if (v === '--kalite') a.kalite = Number(argv[++i]);
    else throw new Error('Bilinmeyen argüman: ' + v);
  }
  if (!a.kok) throw new Error('--kok <dizin> gerekli');
  if (!Number.isInteger(a.kalite) || a.kalite < 0 || a.kalite > 11) throw new Error('--kalite 0-11 arası olmalı');
  return a;
}

function* gez(dizin) {
  for (const e of fs.readdirSync(dizin, { withFileTypes: true })) {
    const p = path.join(dizin, e.name);
    if (e.isDirectory()) yield* gez(p);
    else if (e.isFile()) yield p;
  }
}

function calistir(a) {
  const kok = path.resolve(a.kok);
  const s = { uretilen: 0, atlanan: 0, silinen: 0, once: 0, sonra: 0 };
  // Önceki kesintiden kalan geçici dosyaları temizle
  for (const f of [...gez(kok)]) {
    if (!f.includes('.tmp-')) continue;
    if (!/\.(br|gz)\.tmp-\d+$/.test(f)) continue;
    if (!a.kuru) fs.unlinkSync(f);
  }
  const tum = [...gez(kok)];
  const guncel = (hedef, st) => {
    try { return fs.statSync(hedef).mtimeMs >= st.mtimeMs - 2; } catch { return false; }
  };
  for (const f of tum) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.br' || ext === '.gz') continue;
    if (!UZANTILAR.has(ext)) continue;
    const st = fs.statSync(f);
    if (st.size < ASGARI) { s.atlanan++; continue; }
    const hedefler = [['.br', 'br']];
    if (a.gzip) hedefler.push(['.gz', 'gz']);
    let buf = null;
    for (const [son, tur] of hedefler) {
      const h = f + son;
      if (guncel(h, st)) { s.atlanan++; continue; }
      if (a.kuru) { console.log('[kuru] üretilecek: ' + h); s.uretilen++; continue; }
      buf = buf || fs.readFileSync(f);
      const out = tur === 'br'
        ? zlib.brotliCompressSync(buf, { params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: a.kalite,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
        : zlib.gzipSync(buf, { level: 9 });
      const tmp = h + '.tmp-' + process.pid;
      try {
        fs.writeFileSync(tmp, out);
        const geri = tur === 'br' ? zlib.brotliDecompressSync(fs.readFileSync(tmp)) : zlib.gunzipSync(fs.readFileSync(tmp));
        if (geri.length !== buf.length) throw new Error('Self-check başarısız: ' + h);
        fs.utimesSync(tmp, st.mtimeMs / 1000, st.mtimeMs / 1000);
        fs.renameSync(tmp, h);
      } finally {
        try { fs.unlinkSync(tmp); } catch {}
      }
      s.uretilen++; s.once += buf.length; s.sonra += out.length;
    }
  }
  // Kaynağı silinmiş .br/.gz temizliği
  for (const f of tum) {
    const ext = path.extname(f).toLowerCase();
    if (ext !== '.br' && ext !== '.gz') continue;
    const kaynak = f.slice(0, -ext.length);
    if (!UZANTILAR.has(path.extname(kaynak).toLowerCase())) continue;
    if (fs.existsSync(kaynak)) continue;
    if (a.kuru) console.log('[kuru] silinecek: ' + f);
    else fs.unlinkSync(f);
    s.silinen++;
  }
  console.log(`${a.kuru ? '[kuru] ' : ''}Özet: üretilen=${s.uretilen} atlanan=${s.atlanan} silinen=${s.silinen} önce=${s.once} B sonra=${s.sonra} B`);
  return s;
}

if (require.main === module) {
  try { calistir(argumanlar(process.argv.slice(2))); }
  catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { calistir, argumanlar };
