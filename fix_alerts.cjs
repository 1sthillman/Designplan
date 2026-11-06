const fs = require('fs');
let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');
let changes = 0;

// Replace alert() calls with toast() where possible (non-confirmation alerts)
const replacements = [
  // Invite code generation error
  {
    from: `}catch(e){btn.disabled=false;btn.textContent='Kod Üret';alert('Hata: '+err(e));}`,
    to:   `}catch(e){btn.disabled=false;btn.textContent='Kod Üret';if(typeof toast==='function')toast('Hata: '+err(e));}`
  },
  // Customer project required for invite
  {
    from: `if(role==='customer'&&!projId){alert('Lütfen müşteri için bir proje seçin.');return;}`,
    to:   `if(role==='customer'&&!projId){if(typeof toast==='function')toast('Müşteri için bir proje seçmelisiniz.');return;}`
  },
  // Role save customer project required
  {
    from: `if(selRole==='customer'&&!selProj){alert('Lütfen müşteri için bir proje seçin.');return;}`,
    to:   `if(selRole==='customer'&&!selProj){if(typeof toast==='function')toast('Müşteri için bir proje seçmelisiniz.');return;}`
  },
  // Role save error
  {
    from: `}catch(e){saveRoleBtn.disabled=false;saveRoleBtn.textContent='Rolü Kaydet';alert('Rol kaydedilemedi: '+err(e));}`,
    to:   `}catch(e){saveRoleBtn.disabled=false;saveRoleBtn.textContent='Rolü Kaydet';if(typeof toast==='function')toast('Rol kaydedilemedi: '+err(e));}`
  },
  // Ban error
  {
    from: `     }catch(e){alert('Hata: '+err(e));\n     }\n    };\n    \n    actRow`,
    to:   `     }catch(e){if(typeof toast==='function')toast('Hata: '+err(e));\n     }\n    };\n    \n    actRow`
  },
  // Settings save error
  {
    from: `    btn.disabled=false;btn.textContent='Ayarları Kaydet';\n    alert('Hata: '+err(e));`,
    to:   `    btn.disabled=false;btn.textContent='Ayarları Kaydet';\n    if(typeof toast==='function')toast('Hata: '+err(e));`
  },
];

for (const r of replacements) {
  if (html.includes(r.from)) {
    html = html.replaceAll(r.from, r.to);
    changes++;
    console.log('Fixed:', r.from.slice(0, 60));
  } else {
    console.log('NOT FOUND:', r.from.slice(0, 60));
  }
}

// Fix remaining alert calls in settings/backup area (lines ~4381, 4400)
// These are catch blocks with single alert
const remaining = [];
const lines = html.split('\n');
lines.forEach((l, i) => {
  if (l.includes('alert(') && !l.includes('confirm(')) {
    remaining.push({ line: i+1, text: l.trim().slice(0, 100) });
  }
});
console.log('\nRemaining alert() calls:', remaining.length);
remaining.forEach(r => console.log(' ', r.line, r.text));

fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html);
console.log('\nTotal changes made:', changes);
