const fs = require('fs');
let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');
const lines = html.split('\n');

const startIndex = lines.findIndex(l => l.includes('// --- SETTINGS TAB ACTIONS (100% FUNCTIONAL) ---'));
const endIndex = lines.findIndex(l => l.includes('// --- TEAM TAB ACTIONS (RELIABLE ROLE PERSISTENCE) ---'));

console.log('startIndex:', startIndex, 'endIndex:', endIndex);

const newLines = [
  " // --- SETTINGS TAB ACTIONS (100% FUNCTIONAL) ---",
  " const syncSettingsInputs=()=>{",
  "  const curS=(typeof S!=='undefined'&&S)||(window.S)||{};",
  "  const elF=document.getElementById('_lv-set-firm');if(elF)elF.value=curS.firm||'';",
  "  const elT=document.getElementById('_lv-set-tel');if(elT)elT.value=curS.tel||'';",
  "  const elV=document.getElementById('_lv-set-valid');if(elV)elV.value=curS.valid||15;",
  "  const elA=document.getElementById('_lv-set-adr');if(elA)elA.value=curS.adr||'';",
  "  const elTr=document.getElementById('_lv-set-terms');if(elTr)elTr.value=curS.terms||'';",
  "  const elI=document.getElementById('_lv-set-iban');if(elI)elI.value=curS.iban||'';",
  " };",
  " syncSettingsInputs();",
  "",
  " document.getElementById('_lv-save-brand-btn').onclick=async()=>{",
  "  const btn=document.getElementById('_lv-save-brand-btn');",
  "  btn.disabled=true;btn.textContent='Kaydediliyor…';",
  "  try{",
  "   const sObj=(typeof S!=='undefined'?S:(window.S||{}));",
  "   sObj.firm=(document.getElementById('_lv-set-firm').value||'').trim();",
  "   sObj.tel=(document.getElementById('_lv-set-tel').value||'').trim();",
  "   sObj.adr=(document.getElementById('_lv-set-adr').value||'').trim();",
  "   sObj.valid=+(document.getElementById('_lv-set-valid').value||15);",
  "   sObj.terms=(document.getElementById('_lv-set-terms').value||'').trim();",
  "   sObj.iban=(document.getElementById('_lv-set-iban').value||'').trim();",
  "   window.S=sObj;if(typeof S!=='undefined')Object.assign(S,sObj);",
  "   try{localStorage.setItem('lvr_s',JSON.stringify(sObj))}catch(e){}",
  "   if(window.LV_DB&&window.LV_DB.saveSettings)await window.LV_DB.saveSettings(sObj);",
  "   if(typeof save==='function')save();",
  "   if(typeof render==='function')render();",
  "   btn.disabled=false;btn.textContent='✓ Kaydedildi';",
  "   if(typeof toast==='function')toast('✓ Şirket ayarları başarıyla kaydedildi');",
  "   setTimeout(()=>{btn.textContent='Ayarları Kaydet';},2000);",
  "  }catch(e){",
  "   btn.disabled=false;btn.textContent='Ayarları Kaydet';",
  "   if(typeof toast==='function')toast('Hata: '+err(e));",
  "  }",
  " };",
  " ",
  " document.getElementById('_lv-btn-set-backup').onclick=()=>{",
  "  md.remove();",
  "  if(typeof window.bkAll==='function')window.bkAll();",
  "  else if(typeof bkAll==='function')bkAll();",
  "  else if(typeof toast==='function')toast('Yedek hazırlanıyor…');",
  " };",
  " ",
  " document.getElementById('_lv-btn-set-ledger').onclick=()=>{",
  "  md.remove();",
  "  const navLed=document.querySelector('nav [data-a=\"led\"]')||document.querySelector('[data-a=\"led\"]');",
  "  if(navLed){navLed.click();}else{window.led=true;window.cur=null;if(typeof close==='function')close();if(typeof render==='function')render();}",
  " };",
  " "
];

lines.splice(startIndex, endIndex - startIndex, ...newLines);
html = lines.join('\n');
fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html, 'utf8');
fs.writeFileSync('index.html', html, 'utf8');
console.log('SUCCESS: Admin settings tab replaced and saved!');
