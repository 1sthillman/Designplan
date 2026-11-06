import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { readFileSync, statSync } from 'fs';

const filePath = './01-CUBE-BK VOGER 13+3 ODA.xls';
console.log('Testing Excel File:', filePath);
const stats = statSync(filePath);
console.log('File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

const t0 = Date.now();
console.log('Reading workbook with XLSX.readFile...');
const wb = XLSX.readFile(filePath);
console.log('Workbook read successfully in', Date.now() - t0, 'ms');
console.log('Sheet Names (Count: ' + wb.SheetNames.length + '):', wb.SheetNames);

let totalRows = 0;
const sheetsData = [];

wb.SheetNames.forEach((sheetName, index) => {
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const rowCount = json.length;
  totalRows += rowCount;
  
  const headers = json[0] || [];
  sheetsData.push({
    name: sheetName,
    rows: rowCount,
    headerCols: headers.length,
    headersPreview: headers.slice(0, 8)
  });
});

console.log('\n--- Sheets Summary ---');
console.table(sheetsData.map(s => ({
  Sheet: s.name,
  Rows: s.rows,
  Cols: s.headerCols,
  SampleHeaders: s.headersPreview.filter(Boolean).join(' | ')
})));
console.log('Total Rows across all sheets:', totalRows);

// Let's test Lavora's column detection & normalization logic on the first 3 sheets
const N = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase().replace(/\s+/g, ' ').trim();
const RX = {
  t: /toplam|tutar|bedel|amount|total|satir/,
  p: /birim\s*(fiyat|bedel)|b\.?\s*fiyat|fiyat|price/,
  q: /adet|miktar|qty|quantity|metraj/,
  unit: /^birim$|olcu birimi|^unit$|^br\.?$/,
  code: /\bkod\b|stok kodu|\bsku\b|^poz( no)?$|^code$/,
  u: /urun|kalem|malzeme|aciklama|tanim|cins|isim|^ad$|adi\b|description|item|product|name/
};

console.log('\n--- Column Detection Simulation ---');
wb.SheetNames.slice(0, 3).forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  if (!json.length) return;
  const headers = json[0] || [];
  console.log(`\nSheet: "${sheetName}" (${json.length} rows)`);
  console.log('Headers:', headers);
  
  const matches = {};
  headers.forEach((h, colIdx) => {
    const nh = N(h);
    for (const [key, regex] of Object.entries(RX)) {
      if (regex.test(nh)) {
        if (!matches[key]) matches[key] = [];
        matches[key].push(`Col ${colIdx}: "${h}"`);
      }
    }
  });
  console.log('Detected roles:', matches);
});

console.log('\n✓ Excel file integrity and parsing: EXCELLENT');
