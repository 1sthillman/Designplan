const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');
const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
let m, scripts = [], errors = 0;
while ((m = scriptRegex.exec(html)) !== null) {
  if (!m[0].includes('src=') && !m[0].includes('type="importmap"') && !m[0].includes('type="application/json"') && m[1].trim()) {
    scripts.push(m[1]);
  }
}
scripts.forEach(function(code, idx) {
  try { new vm.Script(code); } catch(e) { console.error('Script #' + (idx+1) + ' error:', e.message); errors++; }
});
if (errors === 0) {
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('OK: ' + scripts.length + ' scripts valid. index.html synced.');
} else {
  console.error('FAILED: ' + errors + ' script errors');
  process.exit(1);
}
