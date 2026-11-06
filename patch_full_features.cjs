const fs = require('fs');

let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');

// 1. Ensure window.S is always attached to S
const oldSDecl = "let S=ld('lvr_s',{logo:'',key:'',firm:'Lavora Design',tel:'',adr:''}),P=[],cur=null,si=0,view='cards',fq='',q='',opn=new Set(),tm,";
const newSDecl = "let S=ld('lvr_s',{logo:'',key:'',firm:'Lavora Design',tel:'',adr:''});window.S=S;let P=[],cur=null,si=0,view='cards',fq='',q='',opn=new Set(),tm,";
if (html.includes(oldSDecl)) {
  html = html.replace(oldSDecl, newSDecl);
  console.log('1. Attached window.S = S successfully');
} else {
  console.log('1. WARNING: oldSDecl not found directly');
}

// 2. Fix bkAll() performance, timeout, and expose to window.bkAll
const oldBkAll = `async function bkAll(){try{toast('Yedek hazırlanıyor…',9e5);const ids=new Set(P.flatMap(p=>(p.w?.items||[]).flatMap(i=>i.ph||[]))),ph=[];for(const id of ids){const o=await tx('readonly',s=>s.get(id),'wph').catch(()=>null);if(o)ph.push(o)}
const rc=[];for(const o of(await tx('readonly',s=>s.getAll(),'rcpt'))||[])rc.push({id:o.id,img:await sr(o)});const led=(await tx('readonly',s=>s.getAll(),'led'))||[];
const scanMeta=(await tx('readonly',s=>s.getAll(),'scans'))||[],scans=[];for(const o of scanMeta){const full=await tx('readonly',s=>s.get(o.id),'scans').catch(()=>null);if(full)scans.push(full)}
const voice=window.LV_AUDIO_EXPORT?await window.LV_AUDIO_EXPORT():[],{ak,key,...S2}=S;
dl(new Blob([JSON.stringify({app:'lavora-tam-yedek',v:2,t:Date.now(),S:S2,P,ph,rc,led,scans,voice})],{type:'application/json'}),'lavora-tam-yedek-'+today()+'.json');S.fb=Date.now();save();document.querySelector('.toast')?.remove();toast(\`Yedek indirildi: \${P.length} proje, \${ph.length} iş fotoğrafı, \${rc.length} fiş, \${scans.length} tarama, \${led.length} defter kaydı, \${voice.length} özel ses\`,7e3)}catch(x){document.querySelector('.toast')?.remove();dbg('Tam yedek: '+(x?.message||x));toast('Yedek alınamadı')}}`;

const newBkAll = `async function bkAll(){try{toast('Yedek hazırlanıyor…',9e5);const ids=new Set(P.flatMap(p=>(p.w?.items||[]).flatMap(i=>i.ph||[])));
const allPh=(await tx('readonly',s=>s.getAll(),'wph').catch(()=>[]))||[];const phMap=new Map((allPh||[]).map(x=>[String(x.id),x]));const ph=[...ids].map(id=>phMap.get(String(id))).filter(Boolean);
const rc=[];for(const o of(await tx('readonly',s=>s.getAll(),'rcpt').catch(()=>[]))||[]){try{rc.push({id:o.id,img:await sr(o)})}catch(e){if(o.img)rc.push({id:o.id,img:o.img})}}
const led=(await tx('readonly',s=>s.getAll(),'led').catch(()=>[]))||[];
const scanMeta=(await tx('readonly',s=>s.getAll(),'scans').catch(()=>[]))||[],scans=[];for(const o of scanMeta){const full=await tx('readonly',s=>s.get(o.id),'scans').catch(()=>null);if(full)scans.push(full)}
const voice=window.LV_AUDIO_EXPORT?await window.LV_AUDIO_EXPORT():[],{ak,key,...S2}=(typeof S!=='undefined'?S:(window.S||{}));
dl(new Blob([JSON.stringify({app:'lavora-tam-yedek',v:2,t:Date.now(),S:S2,P,ph,rc,led,scans,voice})],{type:'application/json'}),'lavora-tam-yedek-'+today()+'.json');if(typeof S!=='undefined')S.fb=Date.now();if(typeof save==='function')save();document.querySelector('.toast')?.remove();toast(\`Yedek indirildi: \${P.length} proje, \${ph.length} iş fotoğrafı, \${rc.length} fiş, \${scans.length} tarama, \${led.length} defter kaydı, \${voice.length} özel ses\`,7e3)}catch(x){document.querySelector('.toast')?.remove();dbg('Tam yedek: '+(x?.message||x));toast('Yedek alınamadı: '+(x?.message||'hata'))}};window.bkAll=bkAll;`;

if (html.includes(oldBkAll)) {
  html = html.replace(oldBkAll, newBkAll);
  console.log('2. Fixed bkAll() performance & exposed window.bkAll');
} else {
  console.log('2. WARNING: oldBkAll not found directly');
}

// 3. Fix lexp() (Defteri yedekle) and expose window.lexp, window.lfj, window.fr
const oldLexp = `async function lexp(){try{const[A,B]=await Promise.all([tx('readonly',s=>s.getAll(),'led'),tx('readonly',s=>s.getAll(),'rcpt')]),R=[];for(const o of B)R.push({id:o.id,img:await sr(o)});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'lavora-defter',v:1,t:Date.now(),led:A,rcpt:R,cg:S.cg||[],ci:S.ci||[]})],{type:'application/json'}));a.download='defter-yedek-'+today()+'.json';document.body.append(a);a.click();a.remove();S.lb=Date.now();save();render();toast(\`Yedek indirildi: \${A.length} kayıt, \${R.length} fiş\`,4e3)}catch(x){dbg('Yedek hatası: '+(x?.message||x));toast('Yedek alınamadı')}}`;

const newLexp = `async function lexp(){try{const[A,B]=await Promise.all([tx('readonly',s=>s.getAll(),'led').catch(()=>[]),tx('readonly',s=>s.getAll(),'rcpt').catch(()=>[])]),R=[];for(const o of(B||[])){try{R.push({id:o.id,img:await sr(o)})}catch(e){if(o&&o.img)R.push({id:o.id,img:o.img})}}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'lavora-defter',v:1,t:Date.now(),led:A||[],rcpt:R,cg:(typeof S!=='undefined'&&S.cg)||[],ci:(typeof S!=='undefined'&&S.ci)||[]})],{type:'application/json'}));a.download='defter-yedek-'+today()+'.json';document.body.append(a);a.click();setTimeout(()=>a.remove(),2000);if(typeof S!=='undefined')S.lb=Date.now();if(typeof save==='function')save();if(typeof render==='function')render();toast(\`Yedek indirildi: \${(A||[]).length} kayıt, \${R.length} fiş\`,4e3)}catch(x){dbg('Yedek hatası: '+(x?.message||x));toast('Yedek alınamadı: '+(x?.message||'hata'))}};window.lexp=lexp;window.lfj=lfj;`;

if (html.includes(oldLexp)) {
  html = html.replace(oldLexp, newLexp);
  console.log('3. Fixed lexp() (Defteri yedekle) successfully');
} else {
  console.log('3. WARNING: oldLexp not found directly');
}

// 4. Fix fimg accept attribute and expose window.fimg
const oldFimg = "const fimg=document.createElement('input');fimg.type='file';fimg.accept='.xlsx';fimg.hidden=true;document.body.append(fimg);";
const newFimg = "const fimg=document.createElement('input');fimg.type='file';fimg.accept='.xlsx,.xls';fimg.hidden=true;document.body.append(fimg);window.fimg=fimg;";
if (html.includes(oldFimg)) {
  html = html.replace(oldFimg, newFimg);
  console.log('4. Updated fimg.accept to .xlsx,.xls');
} else {
  console.log('4. WARNING: oldFimg not found directly');
}

// 5. Fix Admin Ayarlar panel inputs & actions
const oldAdminHubSettingsAction = `  // --- SETTINGS TAB ACTIONS (100% FUNCTIONAL) ---
  document.getElementById('_lv-save-brand-btn').onclick=async()=>{
   const btn=document.getElementById('_lv-save-brand-btn');
   btn.disabled=true;btn.textContent='Kaydediliyor…';
   try{
    if(!window.S) window.S={};
    window.S.firm=(document.getElementById('_lv-set-firm').value||'').trim();
    window.S.tel=(document.getElementById('_lv-set-tel').value||'').trim();
    window.S.adr=(document.getElementById('_lv-set-adr').value||'').trim();
    window.S.valid=+(document.getElementById('_lv-set-valid').value||15);
    window.S.terms=(document.getElementById('_lv-set-terms').value||'').trim();
    window.S.iban=(document.getElementById('_lv-set-iban').value||'').trim();
    if(window.LV_DB && window.LV_DB.saveSettings) await window.LV_DB.saveSettings(window.S);
    if(typeof save==='function') save();
    btn.disabled=false;btn.textContent='✓ Kaydedildi';
    if(typeof toast==='function') toast('✓ Şirket ayarları başarıyla kaydedildi');
    setTimeout(()=>{btn.textContent='Ayarları Kaydet';},2000);
   }catch(e){
    btn.disabled=false;btn.textContent='Ayarları Kaydet';
    if(typeof toast==='function')toast('Hata: '+err(e));
   }
  };
  
  document.getElementById('_lv-btn-set-backup').onclick=()=>{
   md.remove();
   if(typeof bkAll==='function') bkAll();
   else if(typeof toast==='function') toast('Yedekleme fonksiyonu hazır');
  };
  
  document.getElementById('_lv-btn-set-ledger').onclick=()=>{
   md.remove();
   led=true;cur=null;
   if(typeof close==='function')close();
   if(typeof render==='function')render();
  };`;

const newAdminHubSettingsAction = `  // --- SETTINGS TAB ACTIONS (100% FUNCTIONAL) ---
  // Populate current settings dynamically on tab display
  const syncSettingsInputs=()=>{
   const curS=(typeof S!=='undefined'&&S)||(window.S)||{};
   const elF=document.getElementById('_lv-set-firm');if(elF)elF.value=curS.firm||'';
   const elT=document.getElementById('_lv-set-tel');if(elT)elT.value=curS.tel||'';
   const elV=document.getElementById('_lv-set-valid');if(elV)elV.value=curS.valid||15;
   const elA=document.getElementById('_lv-set-adr');if(elA)elA.value=curS.adr||'';
   const elTr=document.getElementById('_lv-set-terms');if(elTr)elTr.value=curS.terms||'';
   const elI=document.getElementById('_lv-set-iban');if(elI)elI.value=curS.iban||'';
  };
  syncSettingsInputs();

  document.getElementById('_lv-save-brand-btn').onclick=async()=>{
   const btn=document.getElementById('_lv-save-brand-btn');
   btn.disabled=true;btn.textContent='Kaydediliyor…';
   try{
    const sObj=(typeof S!=='undefined'?S:(window.S||{}));
    sObj.firm=(document.getElementById('_lv-set-firm').value||'').trim();
    sObj.tel=(document.getElementById('_lv-set-tel').value||'').trim();
    sObj.adr=(document.getElementById('_lv-set-adr').value||'').trim();
    sObj.valid=+(document.getElementById('_lv-set-valid').value||15);
    sObj.terms=(document.getElementById('_lv-set-terms').value||'').trim();
    sObj.iban=(document.getElementById('_lv-set-iban').value||'').trim();
    window.S=sObj;if(typeof S!=='undefined')Object.assign(S,sObj);
    try{localStorage.setItem('lvr_s',JSON.stringify(sObj))}catch(e){}
    if(window.LV_DB&&window.LV_DB.saveSettings)await window.LV_DB.saveSettings(sObj);
    if(typeof save==='function')save();
    if(typeof render==='function')render();
    btn.disabled=false;btn.textContent='✓ Kaydedildi';
    if(typeof toast==='function')toast('✓ Şirket ayarları başarıyla kaydedildi');
    setTimeout(()=>{btn.textContent='Ayarları Kaydet';},2000);
   }catch(e){
    btn.disabled=false;btn.textContent='Ayarları Kaydet';
    if(typeof toast==='function')toast('Hata: '+err(e));
   }
  };
  
  document.getElementById('_lv-btn-set-backup').onclick=()=>{
   md.remove();
   if(typeof window.bkAll==='function')window.bkAll();
   else if(typeof bkAll==='function')bkAll();
   else if(typeof toast==='function')toast('Yedek hazırlanıyor…');
  };
  
  document.getElementById('_lv-btn-set-ledger').onclick=()=>{
   md.remove();
   const navLed=document.querySelector('nav [data-a=\"led\"]')||document.querySelector('[data-a=\"led\"]');
   if(navLed){navLed.click();}else{window.led=true;window.cur=null;if(typeof close==='function')close();if(typeof render==='function')render();}
  };`;

if (html.includes(oldAdminHubSettingsAction)) {
  html = html.replace(oldAdminHubSettingsAction, newAdminHubSettingsAction);
  console.log('5. Fixed Admin Settings Tab successfully');
} else {
  console.log('5. WARNING: oldAdminHubSettingsAction not found directly');
}

// 6. Fix Mobile Swipe Gestures (.pc, .wit, .lxr)
// Fix threshold: Math.max(48, Math.min(72, el.offsetWidth * .22))
// Fix cancel release
const oldSwipeBlock = `let g=null,sup=0;const TH=el=>Math.min(104,el.offsetWidth*.3);
document.addEventListener('pointerdown',e=>{if(g||(e.pointerType=='mouse'&&e.button))return;if(e.target.closest('input,textarea,select,.mc,[contenteditable]'))return;
for(const c of SWC){const el=e.target.closest(c.s);if(el){if(c.h&&!e.target.closest(c.h))return;g={c,el,x:e.clientX,y:e.clientY,id:e.pointerId,on:0,dx:0};return}}},{passive:true});
function begin(){const el=g.el,r=el.getBoundingClientRect(),o=document.createElement('div');g.on=1;o.className='swr';o.style.cssText=\`left:\${r.left}px;top:\${r.top}px;width:\${r.width}px;height:\${r.height}px;border-radius:\${getComputedStyle(el).borderRadius}\`;
o.innerHTML=\`<span class="l">\${ic(TR)}Sil</span><span class="r">Düzenle\${ic(PE)}</span>\`;document.body.append(o);g.ov=o;el.style.transition='none';el.style.willChange='transform';try{el.setPointerCapture(g.id)}catch(e){}}
document.addEventListener('pointermove',e=>{if(!g||e.pointerId!=g.id)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;
if(!g.on){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*.7){g=null;return}if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.5)return;begin()}
g.dx=dx;const T=TH(g.el),a=Math.abs(dx),x=Math.sign(dx)*(a<=T?a:T+(a-T)*.3);g.el.style.transform=\`translateX(\${x}px)\`;
g.ov.className='swr '+(dx>0?'del':'edit')+(a>=T?' go':'');g.ov.style.setProperty('--swp',Math.min(1,a/T));
if(a>=T&&!g.hit){g.hit=1;navigator.vibrate&&navigator.vibrate(12)}if(a<T)g.hit=0},{passive:true});
function end(cancel){if(!g)return;const G=g,el=G.el;g=null;if(!G.on)return;sup=Date.now()+450;const go=!cancel&&Math.abs(G.dx)>=TH(el);
el.style.transition='transform .24s cubic-bezier(.2,.9,.3,1)';el.style.transform='';G.ov.style.transition='opacity .25s';G.ov.style.opacity=0;
setTimeout(()=>{G.ov.remove();el.style.transition='';el.style.willChange=''},260);try{el.releasePointerCapture(G.id)}catch(e){}
if(go)setTimeout(()=>{sup=0;try{(G.dx>0?G.c.d:G.c.e)(el)}catch(x){console.warn(x)}},120)}
document.addEventListener('pointerup',e=>{if(g&&e.pointerId==g.id)end(0)},true);document.addEventListener('pointercancel',e=>{if(g&&e.pointerId==g.id)end(1)},true);`;

const newSwipeBlock = `let g=null,sup=0;const TH=el=>Math.max(48,Math.min(74,el.offsetWidth*.22));
document.addEventListener('pointerdown',e=>{if(g||(e.pointerType=='mouse'&&e.button))return;if(e.target.closest('input,textarea,select,.mc,[contenteditable]'))return;
for(const c of SWC){const el=e.target.closest(c.s);if(el){if(c.h&&!e.target.closest(c.h))return;g={c,el,x:e.clientX,y:e.clientY,id:e.pointerId,on:0,dx:0};try{el.setPointerCapture(e.pointerId)}catch(x){}return}}},{passive:true});
function begin(){const el=g.el,r=el.getBoundingClientRect(),o=document.createElement('div');g.on=1;o.className='swr';o.style.cssText=\`left:\${r.left}px;top:\${r.top}px;width:\${r.width}px;height:\${r.height}px;border-radius:\${getComputedStyle(el).borderRadius}\`;
o.innerHTML=\`<span class="l">\${ic(TR)}Sil</span><span class="r">Düzenle\${ic(PE)}</span>\`;document.body.append(o);g.ov=o;el.style.transition='none';el.style.willChange='transform';try{el.setPointerCapture(g.id)}catch(e){}}
document.addEventListener('pointermove',e=>{if(!g||e.pointerId!=g.id)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;
if(!g.on){if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*.75){g=null;return}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;begin()}
g.dx=dx;const T=TH(g.el),a=Math.abs(dx),x=Math.sign(dx)*(a<=T?a:T+(a-T)*.3);g.el.style.transform=\`translateX(\${x}px)\`;
g.ov.className='swr '+(dx>0?'del':'edit')+(a>=T?' go':'');g.ov.style.setProperty('--swp',Math.min(1,a/T));
if(a>=T&&!g.hit){g.hit=1;navigator.vibrate&&navigator.vibrate(12)}if(a<T)g.hit=0},{passive:true});
function end(cancel){if(!g)return;const G=g,el=G.el;g=null;if(!G.on)return;sup=Date.now()+450;const go=Math.abs(G.dx)>=TH(el);
el.style.transition='transform .24s cubic-bezier(.2,.9,.3,1)';el.style.transform='';G.ov.style.transition='opacity .25s';G.ov.style.opacity=0;
setTimeout(()=>{G.ov.remove();el.style.transition='';el.style.willChange=''},260);try{el.releasePointerCapture(G.id)}catch(e){}
if(go)setTimeout(()=>{sup=0;try{(G.dx>0?G.c.d:G.c.e)(el)}catch(x){console.warn(x)}},90)}
document.addEventListener('pointerup',e=>{if(g&&e.pointerId==g.id)end(0)},true);document.addEventListener('pointercancel',e=>{if(g&&e.pointerId==g.id)end(0)},true);`;

if (html.includes(oldSwipeBlock)) {
  html = html.replace(oldSwipeBlock, newSwipeBlock);
  console.log('6. Fixed Mobile Swipe Gestures successfully');
} else {
  console.log('6. WARNING: oldSwipeBlock not found directly');
}

// 7. Touch action CSS fix: make sure .pc, .wit, .lxr have touch-action: pan-y !important
const oldTouchCSS = "button,summary,.pc,.opt,.nxr,.wit{touch-action:manipulation}";
const newTouchCSS = "button,summary,.opt,.nxr{touch-action:manipulation}.pc,.wit,.lxr{touch-action:pan-y !important;-webkit-user-select:none;user-select:none}";
if (html.includes(oldTouchCSS)) {
  html = html.replace(oldTouchCSS, newTouchCSS);
  console.log('7. Fixed touch-action CSS to pan-y !important');
} else {
  console.log('7. WARNING: oldTouchCSS not found directly');
}

// 8. Make sure window.fr is accessible
if (html.includes("const fr=document.createElement('input');fr.type='file';fr.accept='.json,application/json';fr.hidden=true;document.body.append(fr);")) {
  html = html.replace(
    "const fr=document.createElement('input');fr.type='file';fr.accept='.json,application/json';fr.hidden=true;document.body.append(fr);",
    "const fr=document.createElement('input');fr.type='file';fr.accept='.json,application/json';fr.hidden=true;document.body.append(fr);window.fr=fr;"
  );
  console.log('8. Exposed window.fr successfully');
}

fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html, 'utf8');
fs.writeFileSync('index.html', html, 'utf8');
console.log('ALL FIXES WRITTEN to lavora-calisma-masasi-v38-firebase.html and index.html');
