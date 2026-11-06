import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase().replace(/\s+/g, ' ').trim();
const num = v => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

function fromWbFixed(wb) {
  return wb.SheetNames.map(n => {
    const MG = wb.Sheets[n]['!merges'] || [];
    if (MG.length) {
      const cs = wb.Sheets[n];
      MG.forEach(m => {
        const v = cs[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
        if (!v) return;
        for (let R2 = m.s.r; R2 <= m.e.r; R2++) {
          for (let C2 = m.s.c; C2 <= m.e.c; C2++) {
            const k = XLSX.utils.encode_cell({ r: R2, c: C2 });
            if (!cs[k]) cs[k] = { t: 's', v: String(v.v ?? '') };
          }
        }
      });
    }

    let a = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false, dateNF: 'dd.mm.yyyy' }).map(r => r.map(v => String(v ?? '')));
    const r0 = XLSX.utils.decode_range(wb.Sheets[n]['!ref'] || 'A1').s.r;
    let ra = a.map((r, i) => i + r0);
    {
      const kf = a.map(r => r.some(v => v.trim()));
      a = a.filter((_, i) => kf[i]);
      ra = ra.filter((_, i) => kf[i]);
    }
    if (!a.length) return null;
    let w = Math.max(...a.map(r => r.length));
    a = a.map(r => {
      while (r.length < w) r.push('');
      return r;
    });
    const kp = [...Array(w).keys()].filter(j => a.some(r => r[j].trim()));
    a = a.map(r => kp.map(j => r[j]));
    w = kp.length;
    {
      const dk = [];
      for (let j = 1; j < w; j++) {
        let s2 = 1;
        for (const r of a) {
          if ((r[j] || '').trim() != (r[j - 1] || '').trim()) {
            s2 = 0;
            break;
          }
        }
        if (s2) dk.push(j);
      }
      if (dk.length) {
        a = a.map(r => r.filter((_, j) => !dk.includes(j)));
        w = a[0].length;
      }
    }

    const ne = r => r.filter(v => v.trim()).length,
      mx = Math.max(...a.map(ne)),
      hi0 = Math.max(0, a.findIndex(r => ne(r) >= Math.min(2, w) && ne(r) >= mx * .6)),
      KW = /gorsel|resim|foto|image|urun|kalem|imalat|aciklama|tanim|olcu|ebat|boyut|enboy|adet|miktar|metraj|qty|birim|fiyat|price|tutar|toplam|total|bedel|malzeme|materyal|kaplama|kod|tedarik|poz|sira|marka|stok|mekan|detay|parca|olculer|miktari|bfiyat|fiyati|tutari|ttr|meblag/i;
    let hi = -1,
      bs = 0;
    a.slice(0, 80).forEach((r0, i) => {
      const r = r0.filter((v, j) => !j || String(v).trim() !== String(r0[j - 1]).trim());
      let sc = 0;
      r.forEach(v => {
        const t = norm(v);
        if (t && t.length < 40 && KW.test(t)) sc += /(adet|miktar|fiyat|tutar|toplam|urun|kalem|birim)/i.test(t) ? 2 : 1;
      });
      sc -= r.filter(v => v.trim() && num(v) > 0 && v.trim().length < 18).length * 2;
      if (sc > bs) {
        bs = sc;
        hi = i;
      }
    });

    if (hi < 0 || bs < 4) {
      hi = hi0;
      const k = a.findIndex(r => r.filter(v => /\d/.test(v) && num(v) > 0).length >= 2);
      if (k > 0 && a[k - 1].filter(v => v.trim() && !/\d/.test(v)).length >= 2) hi = k - 1;
    }
    {
      const kc = r => r.filter(v => v.trim() && KW.test(norm(v))).length;
      while (a[hi + 1] && kc(a[hi + 1]) >= 2 && !a[hi + 1].some(v => num(v) > 0) && a[hi + 2] && a[hi + 2].some(v => num(v) > 0)) {
        a[hi + 1] = a[hi + 1].map((v, j) => {
          const u = (a[hi][j] || '').trim(),
            t = v.trim();
          return t && u && norm(t) != norm(u) ? (u + ' ' + t) : (t || u);
        });
        hi++;
      }
    }
    return {
      n: n.slice(0, 31),
      pre: a.slice(0, hi),
      h: a[hi] ? a[hi].map((x, i) => x.trim() || 'Sütun ' + (i + 1)) : [],
      r: a.slice(hi + 1),
      rn: ra.slice(hi + 1)
    };
  }).filter(Boolean);
}

const wb = XLSX.readFile('./01-CUBE-BK VOGER 13+3 ODA.xls');
const sheets = fromWbFixed(wb);
sheets.forEach((s, idx) => {
  console.log(`\n=== Sheet [${idx}]: "${s.n}" ===`);
  console.log('  Headers:', s.h);
  console.log('  Rows count:', s.r.length);
  if (s.r.length) {
    console.log('  Row 1:', s.r[0].filter(Boolean));
  }
});
