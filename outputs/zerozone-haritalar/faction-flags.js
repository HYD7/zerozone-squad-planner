export const FLAG_DIR = 'assets/squad/flags/';
export const FLAG_EXT = '.webp';
export const FACTION_CODES = Object.freeze(['ADF', 'AFU', 'BAF', 'CAF', 'CIV', 'CRF', 'GFI', 'IMF', 'MEI', 'PLA', 'PLAAGF', 'PLANMC', 'RGF', 'TLF', 'USA', 'USMC', 'VDV', 'WPMC']);
export const FACTION_ALIASES = Object.freeze({ MEA: 'MEI', RUS: 'RGF', INS: 'IMF' });
const KNOWN = new Set(FACTION_CODES);

export function normalizeFactionCode(code) {
  if (typeof code !== 'string') return null;
  const value = code.trim().toUpperCase();
  if (!/^[A-Z]{2,8}$/.test(value)) return null;
  return FACTION_ALIASES[value] || value;
}

function esc(value) {
  return String(value).replace(/[&<>"'`]/g, ch => `&#${ch.charCodeAt(0)};`);
}

export function flagUrl(code) {
  const c = normalizeFactionCode(code);
  return c && KNOWN.has(c) ? `${FLAG_DIR}${c}${FLAG_EXT}` : null;
}

export function flagImg(code, { size = 20, label, className = 'zz-flag' } = {}) {
  const url = flagUrl(code);
  if (!url) return '<span class="zz-flag zz-flag-missing" aria-hidden="true"></span>';
  const c = normalizeFactionCode(code);
  const n = Number.isFinite(Number(size)) && Number(size) > 0 ? Math.round(Number(size)) : 20;
  const alt = label == null || label === '' ? c : label;
  return `<img class="${esc(className)}" src="${esc(url)}" width="${n}" height="${n}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.classList.add('is-missing')">`;
}

export function factionLabel(code, units) {
  const c = normalizeFactionCode(code);
  if (!c) return '';
  const f = units && units.factions && units.factions[c];
  return (f && (f.name_tr || f.name)) || c;
}
