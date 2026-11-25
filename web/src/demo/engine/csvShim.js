// Minimal browser stand-in for csv-parse/sync (only the options the app uses).
export function parse(input, opts = {}) {
  const text = String(input).replace(/^﻿/, '');
  const rows = [];
  let row = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const clean = rows.map((r) => (opts.trim ? r.map((x) => x.trim()) : r)).filter((r) => !(opts.skip_empty_lines && r.every((x) => x === '')));
  if (!clean.length) return [];
  const header = typeof opts.columns === 'function' ? opts.columns(clean[0]) : clean[0];
  return clean.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
