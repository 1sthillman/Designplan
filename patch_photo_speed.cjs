const fs = require('fs');

let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');

// 1. Optimize wget: check local IndexedDB first, add timeout to Firebase RTDB lookup
const oldWget = `wget=async(id,full)=>{if(!id)return'';if(!full&&(WC[id]||(window.WC&&window.WC[id])))return WC[id]||window.WC[id];let u='';if(!full&&typeof P!=='undefined'&&Array.isArray(P)){try{for(const p of P){if(!p||!p.w||!Array.isArray(p.w.items))continue;for(const it of p.w.items){if(!it||!Array.isArray(it.phData))continue;const f=it.phData.find(x=>x&&x.id===id);if(f&&(f.th||f.dataUrl||f.img)){u=f.th||f.dataUrl||f.img;break}}if(u)break}}catch(e){}}if(!u){try{if(typeof path==='function'){const snap=await path('workflow_photos').child(String(id)).once('value');if(snap.exists()){const o=snap.val();u=full?(o.imgPath||o.img||o.thPath||o.th):(o.thPath||o.th||o.imgPath||o.img)}}}catch(e){}}if(!u){try{const o=await tx('readonly',s=>s.get(id),'wph');if(o)u=full?(o.img||o.th):(o.th||o.img)}catch(e){}}if(!u)u=WC[id]||(window.WC&&window.WC[id])||'';if(u){WC[id]=u;if(window.WC)window.WC[id]=u}return u||''}`;

const newWget = `wget=async(id,full)=>{if(!id)return'';if(!full&&(WC[id]||(window.WC&&window.WC[id])))return WC[id]||window.WC[id];let u='';if(!full){try{const dom=document.querySelector('img[data-wp=\"'+id+'\"]');if(dom&&dom.src&&dom.src.length>20&&!dom.src.endsWith('/'))return dom.src}catch(e){}}if(typeof P!=='undefined'&&Array.isArray(P)){try{for(const p of P){if(!p||!p.w||!Array.isArray(p.w.items))continue;for(const it of p.w.items){if(!it||!Array.isArray(it.phData))continue;const f=it.phData.find(x=>x&&x.id===id);if(f){if(full&&(f.img||f.dataUrl))return f.img||f.dataUrl;if(!full&&(f.th||f.dataUrl||f.img))return f.th||f.dataUrl||f.img}}if(u)break}}catch(e){}}if(!u){try{const o=await tx('readonly',s=>s.get(id),'wph');if(o)u=full?(o.img||o.th):(o.th||o.img)}catch(e){}}if(!u){try{if(typeof path==='function'){const tPromise=new Promise(res=>setTimeout(()=>res(null),2000));const fPromise=path('workflow_photos').child(String(id)).once('value');const snap=await Promise.race([fPromise,tPromise]);if(snap&&snap.exists&&snap.exists()){const o=snap.val();u=full?(o.imgPath||o.img||o.thPath||o.th):(o.thPath||o.th||o.imgPath||o.img)}}}catch(e){}}if(!u)u=WC[id]||(window.WC&&window.WC[id])||'';if(u){WC[id]=u;if(window.WC)window.WC[id]=u}return u||''}`;

if (!html.includes(oldWget)) {
  console.error('ERROR: oldWget pattern not found');
  process.exit(1);
}
html = html.replace(oldWget, newWget);
console.log('1. Replaced wget successfully');

// 2. Modernize case 'pv' to open _lvImgModal instantly with zero delay
const oldPv = `case'pv':{const u=await wget(d.id,1);wpn(\`<h3>Fotoğraf</h3><img src="\${u}" style="width:100%;border-radius:14px;margin-bottom:10px"><button class="opt" data-a="w:back"><b>Geri dön</b></button><button class="opt" data-a="w:delph" data-id="\${d.id}"><b style="color:var(--dg)">Fotoğrafı sil</b></button>\`);break}`;

const newPv = `case'pv':{const clickedId=d.id;const phList=(wi&&Array.isArray(wi.ph)&&wi.ph.length)?wi.ph:[clickedId];const initIdx=Math.max(0,phList.indexOf(clickedId));const photoUrls=phList.map(pid=>{try{const dom=document.querySelector('img[data-wp=\"'+pid+'\"]');if(dom&&dom.src&&dom.src.length>20&&!dom.src.endsWith('/'))return dom.src}catch(e){}if(wi&&Array.isArray(wi.phData)){const f=wi.phData.find(x=>x&&x.id===pid);if(f&&(f.img||f.th||f.dataUrl))return f.img||f.th||f.dataUrl}if(typeof WC!=='undefined'&&WC[pid])return WC[pid];if(window.WC&&window.WC[pid])return window.WC[pid];return''});if(typeof window._lvImgModal==='function'){window._lvImgModal(photoUrls,initIdx,(wi&&wi.n)||'Fotoğraf',{onDelete:(delIdx)=>{const pid=phList[delIdx];if(!pid)return;wi.ph=wi.ph.filter(x=>x!=pid);if(wi.phData)wi.phData=wi.phData.filter(x=>x&&x.id!=pid);wdel(pid);wis()}})}(async()=>{try{const fullUrls=await Promise.all(phList.map(async(pid,idx)=>{const fullU=await wget(pid,1);return fullU||photoUrls[idx]}));if(typeof window._lvImgModalUpdate==='function')window._lvImgModalUpdate(fullUrls)}catch(e){}})();break}`;

if (!html.includes(oldPv)) {
  console.error('ERROR: oldPv pattern not found');
  process.exit(1);
}
html = html.replace(oldPv, newPv);
console.log('2. Replaced case pv successfully');

// 3. Enhance window._lvImgModal to support options (including onDelete and _lvImgModalUpdate)
const oldModalHead = `window._lvImgModal=function(imagesOrSrc,initialIdx,title){
 const existing=document.getElementById('_lv-img-modal');if(existing)existing.remove();
 let list=[];
 if(Array.isArray(imagesOrSrc)){
  list=imagesOrSrc.map(x=>(typeof x==='string'?x:(x.th||x.img||x.src||''))).filter(Boolean);
 }else if(typeof imagesOrSrc==='string'&&imagesOrSrc){
  list=[imagesOrSrc];
 }
 if(!list.length)return;
 let curIdx=Math.max(0,Math.min(list.length-1,Number(initialIdx)||0));

 const ov=document.createElement('div');
 ov.id='_lv-img-modal';
 ov.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(10px);user-select:none';

 // Top header bar
 const topBar=document.createElement('div');
 topBar.style.cssText='position:absolute;top:16px;left:20px;right:20px;display:flex;align-items:center;justify-content:space-between;z-index:10';
 
 const titleEl=document.createElement('div');
 titleEl.style.cssText='color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;gap:10px;text-shadow:0 2px 4px rgba(0,0,0,0.8)';
 titleEl.textContent=title||'Görsel';
 
 const counterPill=document.createElement('span');
 counterPill.style.cssText='background:rgba(255,255,255,0.18);padding:3px 10px;border-radius:12px;font-size:12px;font-weight:800;color:#fff;backdrop-filter:blur(4px);display:'+(list.length>1?'inline-block':'none');
 counterPill.textContent=(curIdx+1)+' / '+list.length;
 titleEl.append(counterPill);

 const closeBtn=document.createElement('button');
 closeBtn.style.cssText='background:rgba(255,255,255,0.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:background .15s';
 closeBtn.onmouseenter=()=>closeBtn.style.background='rgba(255,255,255,0.3)';
 closeBtn.onmouseleave=()=>closeBtn.style.background='rgba(255,255,255,0.15)';
 closeBtn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
 closeBtn.onclick=()=>ov.remove();

 topBar.append(titleEl,closeBtn);
 ov.append(topBar);`;

const newModalHead = `window._lvImgModal=function(imagesOrSrc,initialIdx,title,options){
 const existing=document.getElementById('_lv-img-modal');if(existing)existing.remove();
 let list=[];
 if(Array.isArray(imagesOrSrc)){
  list=imagesOrSrc.map(x=>(typeof x==='string'?x:(x.th||x.img||x.src||''))).filter(Boolean);
 }else if(typeof imagesOrSrc==='string'&&imagesOrSrc){
  list=[imagesOrSrc];
 }
 if(!list.length)return;
 let curIdx=Math.max(0,Math.min(list.length-1,Number(initialIdx)||0));

 const ov=document.createElement('div');
 ov.id='_lv-img-modal';
 ov.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(10px);user-select:none';

 // Top header bar
 const topBar=document.createElement('div');
 topBar.style.cssText='position:absolute;top:16px;left:20px;right:20px;display:flex;align-items:center;justify-content:space-between;z-index:10';
 
 const titleEl=document.createElement('div');
 titleEl.style.cssText='color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;gap:10px;text-shadow:0 2px 4px rgba(0,0,0,0.8)';
 titleEl.textContent=title||'Görsel';
 
 const counterPill=document.createElement('span');
 counterPill.style.cssText='background:rgba(255,255,255,0.18);padding:3px 10px;border-radius:12px;font-size:12px;font-weight:800;color:#fff;backdrop-filter:blur(4px);display:'+(list.length>1?'inline-block':'none');
 counterPill.textContent=(curIdx+1)+' / '+list.length;
 titleEl.append(counterPill);

 const actionsWrap=document.createElement('div');
 actionsWrap.style.cssText='display:flex;align-items:center;gap:10px';

 if(options&&typeof options.onDelete==='function'){
  const delBtn=document.createElement('button');
  delBtn.title='Fotoğrafı Sil';
  delBtn.style.cssText='background:rgba(239,68,68,0.22);border:1px solid rgba(239,68,68,0.4);color:#f87171;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s';
  delBtn.onmouseenter=()=>delBtn.style.background='rgba(239,68,68,0.45)';
  delBtn.onmouseleave=()=>delBtn.style.background='rgba(239,68,68,0.22)';
  delBtn.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
  delBtn.onclick=(e)=>{
   e.stopPropagation();
   if(confirm('Bu fotoğraf silinsin mi?')){
    const delIdx=curIdx;
    options.onDelete(delIdx);
    list.splice(delIdx,1);
    if(!list.length){
     ov.remove();
     if(typeof onKey==='function')document.removeEventListener('keydown',onKey);
    }else{
     curIdx=Math.min(curIdx,list.length-1);
     updateImage(curIdx);
     if(thumbStrip){
      const thumbs=thumbStrip.querySelectorAll('img');
      if(thumbs[delIdx])thumbs[delIdx].remove();
      if(list.length<=1){thumbStrip.style.display='none';}
      updateThumbStrip();
     }
    }
   }
  };
  actionsWrap.append(delBtn);
 }

 const closeBtn=document.createElement('button');
 closeBtn.style.cssText='background:rgba(255,255,255,0.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:background .15s';
 closeBtn.onmouseenter=()=>closeBtn.style.background='rgba(255,255,255,0.3)';
 closeBtn.onmouseleave=()=>closeBtn.style.background='rgba(255,255,255,0.15)';
 closeBtn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
 closeBtn.onclick=()=>{ov.remove();if(typeof onKey==='function')document.removeEventListener('keydown',onKey);};

 actionsWrap.append(closeBtn);
 topBar.append(titleEl,actionsWrap);
 ov.append(topBar);

 window._lvImgModalUpdate=function(newUrls){
  if(Array.isArray(newUrls)){
   newUrls.forEach((u,i)=>{
    if(u&&list[i]){
     list[i]=u;
     if(i===curIdx) img.src=u;
     if(thumbStrip){
      const th=thumbStrip.querySelectorAll('img')[i];
      if(th)th.src=u;
     }
    }
   });
  }
 };`;

if (!html.includes(oldModalHead)) {
  console.error('ERROR: oldModalHead pattern not found');
  process.exit(1);
}
html = html.replace(oldModalHead, newModalHead);
console.log('3. Enhanced _lvImgModal successfully');

fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html, 'utf8');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Saved to lavora-calisma-masasi-v38-firebase.html and index.html');
