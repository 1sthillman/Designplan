<script>
(function(){
'use strict';
const TENANT='lavora-main', CFG_KEY='lavora_firebase_config';
let auth,db,currentUser,profile,ready=false,settingsSig='',lastLogoData='',lastLogoPath='';
const $=s=>document.querySelector(s);
const authEl=document.createElement('div');authEl.id='lv-auth';
authEl.innerHTML=`<section class="lv-auth-card"><div style="font-weight:800;letter-spacing:.08em;color:#0f766e;margin-bottom:18px">LAVORA DESIGN</div><h2 id="lv-auth-title">Güvenli çalışma alanı</h2><p id="lv-auth-desc">Devam etmek için şirketinizin Firebase bağlantısı ve Google hesabınız gerekir.</p><div id="lv-auth-config" hidden><label class="lv-muted">Firebase Web App yapılandırması (Firebase Console → Project settings → Your apps)</label><textarea id="lv-firebase-json" spellcheck="false" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'></textarea><button id="lv-save-config">Bağlantıyı kaydet</button></div><div id="lv-auth-actions"><button id="lv-google">Google ile giriş yap</button></div><div id="lv-auth-error" class="lv-error" role="alert"></div><p class="lv-muted">Veriler Firebase hesabınızda tutulur. Tarayıcıya proje/defter verisi kalıcı olarak yazılmaz.</p></section>`;
document.body.append(authEl);
const team=document.createElement('div');team.id='lv-team';team.innerHTML=`<section><h2 style="margin:0 0 8px">Ekip ve davetler</h2><p style="font-size:13px;color:var(--mu)">Yeni kullanıcıya tek kullanımlık, süreli bir davet kodu oluşturun. Yönetici rolü bu ekrandan verilemez.</p><label>Verilecek rol</label><select id="lv-invite-role"><option value="employee">Çalışan</option><option value="partner">İş ortağı</option><option value="customer">Müşteri</option></select><label id="lv-invite-project-label">Müşteriye atanacak proje kimliği (yalnızca müşteri)</label><select id="lv-invite-project"><option value="">Proje seçin…</option></select><div style="position:relative;"><div id="lv-invite-output" style="font-weight:800;font-size:20px;letter-spacing:.12em;overflow-wrap:anywhere;margin:12px 0;padding-right:50px"></div><button id="lv-copy-code" style="position:absolute;right:0;top:50%;transform:translateY(-50%);display:none;background:var(--ac);color:var(--onac);border:0;border-radius:10px;padding:8px 14px;font-weight:700;cursor:pointer">Kopyala</button></div><button id="lv-create-invite">Davet kodu oluştur</button><button id="lv-close-team" style="background:var(--s2);color:var(--ink)">Kapat</button><hr style="border:0;border-top:1px solid var(--ln);margin:18px 0"><h3>Google ile giriş yapmış tüm kullanıcılar</h3><div id="lv-users" style="font-size:13px">Yükleniyor…</div></section>`;
document.body.append(team);
function msg(s){$('#lv-auth-error').textContent=s||''}
function showConfig(){ $('#lv-auth-config').hidden=false; $('#lv-auth-actions').hidden=true; }
function loadConfig(){
 // Default config - designwood project (GERÇEK)
 const defaultConfig = {
  apiKey: "AIzaSyBzNQGUVn-1-kGdZVFTdu9Mkor2w0NM6AU",
  authDomain: "designwood.firebaseapp.com",
  databaseURL: "https://designwood-default-rtdb.firebaseio.com",
  projectId: "designwood",
  storageBucket: "designwood.firebasestorage.app",
  messagingSenderId: "1081401100728",
  appId: "1:1081401100728:web:8a3d35290dbe1f279f274d",
  measurementId: "G-Z6XH2W7YM0"
 };
 
 let c;try{c=JSON.parse(localStorage.getItem(CFG_KEY)||'null')}catch(e){}
 if(!c){c=defaultConfig;localStorage.setItem(CFG_KEY,JSON.stringify(c))}
 if(!c.apiKey||!c.authDomain||!c.projectId||!c.storageBucket||!c.appId){showConfig();msg('Firebase yapılandırması eksik.');return false}
 try{if(!firebase.apps.length)firebase.initializeApp(c);auth=firebase.auth();db=firebase.database();return true}catch(e){showConfig();msg('Firebase başlatılamadı: '+e.message);return false}
}
$('#lv-save-config').onclick=()=>{
 try{const c=JSON.parse($('#lv-firebase-json').value);if(!c.apiKey||!c.authDomain||!c.projectId||!c.storageBucket||!c.appId)throw Error('apiKey, authDomain, projectId, storageBucket ve appId zorunludur.');localStorage.setItem(CFG_KEY,JSON.stringify(c));location.reload()}catch(e){msg('Yapılandırma hatası: '+e.message)}
};
function path(col){return db.ref(`tenants/${TENANT}/${col}`)}
function userDoc(uid=currentUser.uid){return path('users').child(uid)}
function role(){return profile&&profile.role}
function err(e){return (e&&e.code?e.code+': ':'')+(e&&e.message||String(e))}
function bytesToDataURL(blob){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(blob)})}
// PHASE 1: SHA-256 helper for client-side invite codes
async function sha256(message){
 const msgBuffer = new TextEncoder().encode(message);
 const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
 const hashArray = Array.from(new Uint8Array(hashBuffer));
 return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
async function uploadValue(store,id,key,value){
 if(value==null)return null;
 // PHASE 1: Base64 inline storage with compression
 let dataURL = typeof value==='string'&&value.startsWith('data:') ? value : await bytesToDataURL(value);
 
 // Compress image if it's an image
 if(dataURL.startsWith('data:image/')){
  try{
   const isThumb = key === 'th';
   const maxDim = isThumb ? 400 : 1920;
   const quality = isThumb ? 0.70 : 0.85;
   dataURL = await compressImage(dataURL, maxDim, quality);
  }catch(e){console.warn('Image compression failed:',e)}
 }
 
 // Check size (5MB limit)
 const sizeBytes = Math.ceil((dataURL.length - 'data:'.length) * 0.75);
 if(sizeBytes > 5 * 1024 * 1024){
  throw new Error('Dosya 5MB limitini aşıyor. Lütfen daha küçük bir dosya seçin.');
 }
 
 return dataURL; // Return Base64 directly, no storage path
}
async function hydrate(store,o){
 if(!o)return o;const x={...o};
 // PHASE 1: Base64 inline - no download needed, data is already in object
 for(const [key,pathKey] of [['img','imgPath'],['th','thPath']]){
  if(x[pathKey]&&typeof x[pathKey]==='string'&&x[pathKey].startsWith('data:')){
   x[key]=x[pathKey]; // Base64 is stored inline
  }
 }
 return x;
}
// PHASE 1: Image compression utility
async function compressImage(dataURL, maxDimension, quality){
 return new Promise((resolve,reject)=>{
  const img = new Image();
  img.onload = ()=>{
   let {width,height} = img;
   if(width > maxDimension || height > maxDimension){
    if(width > height){height = Math.round(height * maxDimension / width); width = maxDimension;}
    else{width = Math.round(width * maxDimension / height); height = maxDimension;}
   }
   const canvas = document.createElement('canvas');
   canvas.width = width; canvas.height = height;
   const ctx = canvas.getContext('2d');
   ctx.drawImage(img, 0, 0, width, height);
   resolve(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = reject;
  img.src = dataURL;
 });
}
function financial(h){return /fiyat|tutar|toplam|bedel|ucret|ücret|price|cost|maliyet|kar|kâr|marj|profit|revenue|gelir|gider|kdv|vergi|iskonto|discount|birim\s*fiyat|net\s*tutar|ara\s*toplam/i.test(String(h||''))}
function stripFinancial(value,parentKey){
 if(Array.isArray(value))return value.map(v=>stripFinancial(v,parentKey));
 if(!value||typeof value!=='object')return value;
 const out={};
 for(const [k,v] of Object.entries(value)){
  // CRITICAL FIX: Preserve workflow stages array and item.st stage ID objects
  if(k==='stages'||parentKey==='st'){
   out[k]=v; // Keep stages and stage IDs intact - DO NOT filter
   continue;
  }
  // CRITICAL FIX: Preserve photo data arrays (phData contains compressed base64 thumbnails)
  if(k==='phData'||k==='ph'){
   out[k]=v; // Keep photo IDs and photo data intact
   continue;
  }
  // Filter only actual financial fields, not stage IDs starting with "pr"
  if(/^(price|fiyat|tutar|maliyet|kar|gelir|gider|kdv|iskonto)$/i.test(k)||/(?:cost|total|amount|pend|profit|margin|revenue|income|expense|tax|vat|discount)/i.test(k))continue;
  out[k]=stripFinancial(v,k);
 }
 return out;
}
function redactText(v){
 return String(v??'').replace(/\b(?:₺|TL|TRY)\s*[\d.,]+/gi,'[tutar gizlendi]')
  .replace(/[\d.,]+\s*(?:₺|TL|TRY)\b/gi,'[tutar gizlendi]')
  .replace(/\b(?:fiyat|tutar|toplam|maliyet|ücret|ucret|kdv|iskonto)\b[^;\n]{0,80}/gi,'[finansal alan gizlendi]');
}
function safeProject(p){
 const x=JSON.parse(JSON.stringify(p||{}));
 const keep=/urun|ürün|product|name|isim|ad\b|aciklama|açıklama|description|miktar|adet|qty|quantity|olcu|ölçü|dimension|ebat|malzeme|material|not\b|note|kod\b|code|termin|due|teslim|durum|status|renk|color|kaplama|finish|oda|room|alan|area|montaj|installation|birim\b|unit|model|seri|brand|marka|tip|type/i;
 const sheets=(x.s||[]).map(sh=>{
  const h=Array.isArray(sh.h)?sh.h:[];
  let cols=h.map((v,i)=>i).filter(i=>!financial(h[i])&&keep.test(String(h[i]||'')));
  if(!cols.length&&h.length&&!financial(h[0]))cols=[0];
  return {n:redactText(sh.n||'Sayfa'),h:cols.map(i=>redactText(h[i]||'')),r:(sh.r||[]).map(row=>cols.map(i=>redactText(row[i]||''))),pre:[]};
 });
 x.w=stripFinancial(x.w||{});
 return {id:x.id,name:redactText(x.name||'Proje'),cust:redactText(x.cust||''),u:x.u||Date.now(),d:x.d||0,meta:stripFinancial(x.meta||{}),s:sheets,w:x.w||{}};
}
function mergeWorkflow(fullW,opsW){
 const out=JSON.parse(JSON.stringify(fullW||{})),src=opsW||{};
 for(const [k,v] of Object.entries(src)){
  if(/price|cost|tut|total|amount|pend|profit|margin|revenue|income|expense|fiyat|maliyet|gelir|gider|kdv|tax|vat|iskonto/i.test(k))continue;
  if(k==='items'&&Array.isArray(v)){
   const old=Array.isArray(out.items)?out.items:[];
   out.items=v.map((item,i)=>{const prior=old.find(z=>z.id&&z.id===item.id)||old.find(z=>z.n&&z.n===item.n&&z.sh===item.sh)||old[i]||{};return {...prior,...item}});
   old.forEach(z=>{if(!out.items.some(n=>n.id&&n.id===z.id))out.items.push(z)});
  }else out[k]=v;
 }
 return out;
}
function mergeOps(full,ops){
 if(!ops)return full;
 const x={...full,w:mergeWorkflow(full.w,ops.w),_opsRevision:Number(ops._revision||0)};
 return x;
}
async function projectDocs(){
 const isEmployee=role()==='employee';
 if(isEmployee){
  const snap=await path('project_ops').once('value');
  const data = snap.val() || {};
  const projects=Object.values(data).filter(p=>!(p.d&&Date.now()-p.d>2592e6));
  // CRITICAL FIX: Restore workflow photos from RTDB base64 to IndexedDB
  for(const p of projects){
   if(p.w && p.w.items){
    for(const item of p.w.items){
     if(item.phData && Array.isArray(item.phData)){
      // CRITICAL: Initialize item.ph array if missing
      if(!Array.isArray(item.ph))item.ph=[];
      for(const photo of item.phData){
       try{
        // Check if photo already exists in IndexedDB
        const existing=await tx('readonly',s=>s.get(photo.id),'wph');
        if(existing)continue;
        // Restore to IndexedDB (thumbnail only, full image will be fetched on demand)
        await tx('readwrite',s=>s.put({id:photo.id,t:Date.now(),img:photo.th,th:photo.th}),'wph');
        WC[photo.id]=photo.th;
        // CRITICAL: Add photo ID to item.ph array so it persists
        if(!item.ph.includes(photo.id))item.ph.push(photo.id);
       }catch(e){
        dbg('Photo restore error: '+photo.id+' - '+(e&&e.message||e));
       }
      }
     }
    }
   }
  }
  return projects;
 }
 const [projectsSnap,opsSnap]=await Promise.all([
  path('projects').once('value'),
  path('project_ops').once('value')
 ]);
 const projects = projectsSnap.val() || {};
 const ops = opsSnap.val() || {};
 const opsMap = new Map(Object.entries(ops));
 const result=Object.values(projects).map(d=>mergeOps(d,opsMap.get(String(d.id)))).filter(p=>!(p.d&&Date.now()-p.d>2592e6));
 // CRITICAL FIX: Restore workflow photos for admin/partner
 for(const p of result){
  if(p.w && p.w.items){
   for(const item of p.w.items){
    if(item.phData && Array.isArray(item.phData)){
     // CRITICAL: Initialize item.ph array if missing
     if(!Array.isArray(item.ph))item.ph=[];
     for(const photo of item.phData){
      try{
       const existing=await tx('readonly',s=>s.get(photo.id),'wph');
       if(existing)continue;
       await tx('readwrite',s=>s.put({id:photo.id,t:Date.now(),img:photo.th,th:photo.th}),'wph');
       WC[photo.id]=photo.th;
       // CRITICAL: Add photo ID to item.ph array so it persists
       if(!item.ph.includes(photo.id))item.ph.push(photo.id);
      }catch(e){
       dbg('Photo restore error: '+photo.id+' - '+(e&&e.message||e));
      }
     }
    }
   }
  }
 }
 return result;
}
async function writeDoc(store,obj){
 const clean=JSON.parse(JSON.stringify(obj));
 // PHASE 1: Base64 image handling
 if(['wph','rcpt','scans'].includes(store)){
  if(clean.img&&((typeof clean.img==='string'&&clean.img.startsWith('data:'))||clean.img instanceof Blob)){clean.imgPath=await uploadValue(store,clean.id,'img',clean.img);delete clean.img}
  if(clean.th&&typeof clean.th==='string'&&clean.th.startsWith('data:')){clean.thPath=await uploadValue(store,clean.id,'th',clean.th);delete clean.th}
 }
 if(store==='p'){
  dbg('writeDoc: Starting photo pack for project '+clean.id);
  // CRITICAL FIX: Upload workflow photos as compressed base64 to RTDB
  if(clean.w && clean.w.items && Array.isArray(clean.w.items)){
   dbg('writeDoc: Found '+clean.w.items.length+' items');
   for(const item of clean.w.items){
    if(!item.ph || !Array.isArray(item.ph)){
     dbg('writeDoc: Item '+item.id+' has no photos');
     continue;
    }
    dbg('writeDoc: Item '+item.id+' has '+item.ph.length+' photos: '+item.ph.join(','));
    const photos=[];
    for(const photoId of item.ph){
     try{
      // Get photo from IndexedDB
      const photo=await tx('readonly',s=>s.get(photoId),'wph');
      if(!photo){
       dbg('writeDoc: Photo '+photoId+' NOT found in IndexedDB');
       continue;
      }
      dbg('writeDoc: Photo '+photoId+' found, size: '+((photo.th||photo.img).length)+' bytes');
      // Store compressed thumbnail as base64 (already compressed by wcv to 260px, 72% quality)
      // Only store thumbnail to save space, full image stays in IndexedDB
      photos.push({id:photoId,th:photo.th||photo.img});
     }catch(e){
      dbg('Photo pack error: '+photoId+' - '+(e&&e.message||e));
     }
    }
    // Store photos as base64 in item
    if(photos.length){
     item.phData=photos;
     dbg('writeDoc: Item '+item.id+' packed '+photos.length+' photos into phData');
    }else{
     dbg('writeDoc: Item '+item.id+' - NO photos packed (all missing from IndexedDB)');
    }
   }
  }
  dbg('writeDoc: Photo packing complete, calling safeProject');
  const op=safeProject(clean);op.updatedBy=currentUser.uid;op.updatedAt=Date.now();
  if(role()==='employee'){
   // RTDB transaction for employee (revision-based optimistic locking)
   const opsRef=path('project_ops').child(String(op.id));
   const result = await opsRef.child('_revision').transaction((current)=>{
    const stored = Number(current || 0);
    const rev = Number(obj._revision || 0);
    if(stored > rev) return; // Abort - conflict detected
    return stored + 1;
   });
   if(!result.committed) throw Error('İş akışı başka bir oturumda değiştirildi. Yenileyip tekrar deneyin; üzerine yazma engellendi.');
   op._revision = result.snapshot.val();
   obj._revision = op._revision;
   await opsRef.set(op);
   return;
  }
  // Admin/Partner: Two separate transactions (RTDB limitation)
  const fullRef=path('projects').child(String(clean.id));
  const opsRef=path('project_ops').child(String(op.id));
  
  // Transaction 1: projects
  const fullResult = await fullRef.child('_revision').transaction((current)=>{
   const stored = Number(current || 0);
   const rev = Number(obj._revision || 0);
   if(stored > rev) return; // Abort
   return stored + 1;
  });
  if(!fullResult.committed) throw Error('Proje başka bir oturumda değiştirildi. Yenileyip tekrar deneyin; üzerine yazma engellendi.');
  
  // Transaction 2: project_ops
  const opsResult = await opsRef.child('_revision').transaction((current)=>{
   const storedOps = Number(current || 0);
   const revOps = Number(obj._opsRevision || 0);
   if(storedOps > revOps) return; // Abort
   return storedOps + 1;
  });
  if(!opsResult.committed){
   // Rollback projects transaction
   await fullRef.child('_revision').set(fullResult.snapshot.val() - 1);
   throw Error('İş akışı başka bir oturumda değiştirildi. Yenileyip tekrar deneyin; üzerine yazma engellendi.');
  }
  
  clean._revision=fullResult.snapshot.val();delete clean._opsRevision;
  op._revision=opsResult.snapshot.val();clean.updatedAt=Date.now();
  obj._revision=clean._revision;obj._opsRevision=op._revision;
  
  await Promise.all([fullRef.set(clean),opsRef.set(op)]);
  return;
 }
 // PHASE 1: Other stores (ledger, receipts, workflow_photos, scans)
 const colName = ({led:'ledger',rcpt:'receipts',wph:'workflow_photos',scans:'scans'})[store]||store;
 await path(colName).child(String(clean.id)).set(clean);
}
async function removeDoc(store,id){
 // PHASE 1: RTDB implementation
 if(store==='p'){
  if(role()==='employee') return path('project_ops').child(String(id)).remove();
  // Remove both projects and project_ops
  await Promise.all([
   path('projects').child(String(id)).remove(),
   path('project_ops').child(String(id)).remove()
  ]);
  return;
 }
 const col=({led:'ledger',rcpt:'receipts',wph:'workflow_photos',scans:'scans'})[store]||store;
 const ref=path(col).child(String(id));
 
 // PHASE 1: Base64 inline, no separate media cleanup needed (data is in the same node)
 // Just remove the entire node
 return ref.remove();
}
async function readStore(store){
 if(store==='p')return projectDocs();
 const name=({led:'ledger',rcpt:'receipts',wph:'workflow_photos',scans:'scans'})[store]||store;
 if(role()==='employee'&&['led','rcpt','scans'].includes(store))throw Error('Bu veriye çalışan rolü erişemez.');
 // PHASE 1: RTDB read
 const snap=await path(name).once('value');
 const data = snap.val() || {};
 return Object.values(data);
}
window.LV_DB={
 tx:async(mode,fn,store='p')=>{
  if(!ready)throw Error('Firebase oturumu hazır değil.');
  let docsPromise=null;const writes=[],deletes=[],requests=[];
  const docs=()=>docsPromise||(docsPromise=readStore(store));
  const req=value=>{const r={result:undefined,onsuccess:null,onerror:null};const p=Promise.resolve(value).then(v=>{r.result=v;if(typeof r.onsuccess==='function')r.onsuccess({target:r});return v},e=>{r.error=e;if(typeof r.onerror==='function')r.onerror({target:r});throw e});requests.push(p);return r};
  const os={
   getAll:()=>req(docs().then(a=>store==='rcpt'?Promise.all(a.map(x=>hydrate(store,x))):a)),
   getAllKeys:()=>req(docs().then(a=>a.map(x=>x.id))),
   get:id=>req(docs().then(a=>{const x=a.find(v=>String(v.id)===String(id));return x?hydrate(store,x):null})),
   put:o=>{if(mode!=='readwrite')throw Error('Salt okunur işlem.');writes.push(Promise.resolve().then(()=>writeDoc(store,o)));return {result:o}},
   delete:id=>{if(mode!=='readwrite')throw Error('Salt okunur işlem.');deletes.push(Promise.resolve().then(()=>removeDoc(store,id)));return {result:id}}
  };
  const q=fn(os);
  await Promise.all(requests);
  await new Promise(r=>setTimeout(r,0));
  await Promise.all([...writes,...deletes]);
  return q&&q.result;
 },
 saveSettings:async s=>{
  if(!['admin','partner'].includes(role()))return;
  const x={...s};delete x.ak;delete x.key;
  const sig=JSON.stringify(x);if(sig===settingsSig)return;
  // PHASE 1: Base64 inline logo storage
  if(typeof x.logo==='string'&&x.logo.startsWith('data:')){
   if(x.logo!==lastLogoData){
    // Compress logo
    try{x.logo = await compressImage(x.logo, 400, 0.85)}catch(e){console.warn('Logo compression failed:',e)}
    lastLogoData=x.logo;
   }
   // Store inline in settings
  }else if(x.logo===''){lastLogoData='';x.logo=''}
  await path('settings').child('main').set(x);
  settingsSig=sig;
 },
 loadSettings:async()=>{
  if(!['admin','partner'].includes(role()))return {};
  const snap=await path('settings').child('main').once('value');
  if(!snap.exists())return {};
  const x=snap.val();
  if(x.logo&&typeof x.logo==='string'&&x.logo.startsWith('data:')){lastLogoData=x.logo}
  settingsSig=JSON.stringify(x);return x;
 },
 subscribe:callback=>{
  let queued=false,closed=false;
  const schedule=()=>{if(queued||closed)return;queued=true;setTimeout(async()=>{queued=false;if(closed)return;try{callback(await projectDocs())}catch(e){console.warn('Lavora sync:',e)}},180)};
  const unsubs=[];
  // PHASE 1: RTDB on() listeners
  const projectsRef = path(role()==='employee'?'project_ops':'projects');
  const projectsListener = projectsRef.on('value',schedule,(e)=>console.warn('Lavora project sync:',e));
  unsubs.push(()=>projectsRef.off('value',projectsListener));
  
  if(role()!=='employee'){
   const opsRef = path('project_ops');
   const opsListener = opsRef.on('value',schedule,(e)=>console.warn('Lavora workflow sync:',e));
   unsubs.push(()=>opsRef.off('value',opsListener));
  }
  return ()=>{closed=true;unsubs.forEach(f=>f())};
 },
 audio:{
  get:async id=>{
   // PHASE 1: Base64 inline audio (stored in voice_clips node)
   const snap=await path('voice_clips').child(String(id)).once('value');
   if(!snap.exists())return null;
   const data = snap.val();
   if(!data.audio||!data.audio.startsWith('data:'))return null;
   // Convert Base64 to Blob
   const res = await fetch(data.audio);
   return await res.blob();
  },
  put:async(id,b)=>{
   // PHASE 1: Base64 inline audio
   const dataURL = await bytesToDataURL(b);
   await path('voice_clips').child(String(id)).set({
    id:String(id),
    uid:currentUser.uid,
    audio:dataURL,
    updatedAt:Date.now()
   });
  },
  all:async()=>{
   const snap=await path('voice_clips').orderByChild('uid').equalTo(currentUser.uid).once('value');
   const data = snap.val() || {};
   return Object.keys(data);
  },
  clear:async()=>{
   const snap=await path('voice_clips').orderByChild('uid').equalTo(currentUser.uid).once('value');
   const data = snap.val() || {};
   await Promise.all(Object.keys(data).map(id=>path('voice_clips').child(id).remove()));
  }
 }
};
window.LV_ROLE='';
window.LV_USER=null;
function appRoot(on){document.querySelector('header').style.visibility=on?'visible':'hidden';document.querySelector('main').style.visibility=on?'visible':'hidden';document.querySelector('nav').style.visibility=on?'visible':'hidden';}
function authView(title,desc,html=''){
 $('#lv-auth-title').textContent=title;$('#lv-auth-desc').textContent=desc;
 $('#lv-auth-actions').innerHTML=html||'<button id="lv-google">Google ile giriş yap</button>';
 const g=$('#lv-google');if(g)g.onclick=()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>msg(err(e)));
}
function enrollment(){
 authEl.hidden=false;appRoot(false);
 authView('Hesap yetkilendirmesi','Bu Google hesabına henüz Lavora rolü atanmamış. Yönetici davet kodunu girin veya ilk yönetici kurulumunu tamamlayın.',
 `<input id="lv-code" autocomplete="one-time-code" placeholder="Tek kullanımlık davet kodu"><button id="lv-redeem">Davet kodunu kullan</button><hr><p class="lv-muted">İlk kurulumda yalnızca bir kez, manuel kurulum gerekir. Firebase Console'dan admin kullanıcısını oluşturun.</p><button class="secondary" id="lv-signout">Başka Google hesabı</button>`);
 // PHASE 1: Client-side invite redemption
 $('#lv-redeem').onclick=async()=>{
  msg('');
  try{
   const code=$('#lv-code').value.trim();
   if(!code) throw new Error('Davet kodu gerekli');
   const hash = await sha256(code);
   
   // ATOMIC: RTDB transaction to consume invite
   const inviteRef = path('invites').child(hash);
   const result = await inviteRef.child('usedBy').transaction((current)=>{
    if(current !== null) return; // Already used, abort
    return currentUser.uid; // Claim it
   });
   
   if(!result.committed) throw new Error('Bu davet kodu zaten kullanılmış');
   
   // Read invite data after claiming
   const inviteSnap = await inviteRef.once('value');
   if(!inviteSnap.exists()) throw new Error('Davet kodu geçersiz');
   const invite = inviteSnap.val();
   
   if(invite.expiresAt && invite.expiresAt < Date.now()){
    // Rollback
    await inviteRef.child('usedBy').remove();
    throw new Error('Davet kodu süresi dolmuş');
   }
   
   // Create user document (only uid, email, createdAt - role set by Security Rules)
   await userDoc(currentUser.uid).child('uid').set(currentUser.uid);
   await userDoc(currentUser.uid).child('email').set(currentUser.email||'');
   await userDoc(currentUser.uid).child('createdAt').set(Date.now());
   
   // Admin sets role and projectId
   await userDoc(currentUser.uid).child('role').set(invite.role);
   if(invite.projectId) await userDoc(currentUser.uid).child('projectId').set(invite.projectId);
   
   // Mark used timestamp
   await inviteRef.child('usedAt').set(Date.now());
   location.reload();
  }catch(e){msg('Davet kullanılamadı: '+err(e))}
 };
 $('#lv-signout').onclick=()=>auth.signOut();
}
function customerPortal(){
 document.body.classList.remove('lv-employee');authEl.hidden=true;appRoot(true);
 document.querySelector('nav').style.display='none';
 const out=document.createElement('button');out.id='lv-customer-signout';out.className='hb';out.textContent='Çıkış';out.onclick=async()=>{await auth.signOut();location.reload()};document.querySelector('header').append(out);
 $('#t').textContent='Müşteri Proje Takibi';$('#sb').textContent=currentUser.email||'';
 $('#app').innerHTML='<div style="padding:20px 16px"><h2>Projelerim</h2><p style="color:var(--mu)">Yalnızca hesabınıza atanmış projelerin durumunu görebilirsiniz.</p><div id="lv-customer-projects">Yükleniyor…</div></div>';
 path('customer_projects').child(currentUser.uid).on('value',snap=>{
  const data = snap.val() || {};
  const a=Object.values(data);$('#lv-customer-projects').innerHTML=a.length?a.map(p=>`<article style="background:var(--s);border:1px solid var(--ln);padding:16px;border-radius:16px;margin:12px 0"><b>${String(p.projectName||'Proje').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</b><p>${String(p.status||'Devam ediyor')}</p><div style="height:9px;background:var(--s2);border-radius:9px;overflow:hidden"><i style="display:block;height:100%;width:${Math.max(0,Math.min(100,+p.progress||0))}%;background:var(--ac)"></i></div><small style="display:block;margin-top:6px">${Math.max(0,Math.min(100,+p.progress||0))}% tamamlandı</small><p style="font-size:13px;color:var(--mu)">${String(p.updatedAt?new Date(p.updatedAt).toLocaleString('tr-TR'):'')}</p></article>`).join(''):'Henüz hesabınıza atanmış proje yok.';
 },(e)=>$('#lv-customer-projects').textContent='Projeler yüklenemedi: '+err(e));
}
function teamButton(){
 const b=document.createElement('button');b.id='lv-team-open';b.className='hb';b.title='Ekip ve davetler';b.textContent='Ekip';b.style.width='auto';b.style.padding='0 10px';
 b.onclick=async()=>{
  team.style.display='grid';$('#lv-invite-output').textContent='';
  try{
   // PHASE 1: RTDB queries
   const [ps,us]=await Promise.all([path('projects').once('value'),path('users').once('value')]);
   const sel=$('#lv-invite-project');sel.innerHTML='<option value="">Proje seçin…</option>';
   const projectsData = ps.val() || {};
   const projectOpts=Object.entries(projectsData).map(([id,data])=>({id,name:data.name||id}));
   projectOpts.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.append(o)});
   const list=$('#lv-users');list.innerHTML='';
   const usersData = us.val() || {};
   if(!Object.keys(usersData).length){list.textContent='Henüz kullanıcı yok.';return;}
   Object.entries(usersData).forEach(([uid,u])=>{
    const row=document.createElement('div');
    row.style.cssText='border:1px solid var(--ln);border-radius:12px;padding:12px;margin:8px 0;background:var(--s)';
    
    // User info header
    const header=document.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:start;margin-bottom:10px';
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
    const emailDiv=document.createElement('div');emailDiv.textContent=u.email||'Email yok';emailDiv.style.cssText='font-weight:800;font-size:15px;overflow-wrap:anywhere;margin-bottom:4px;color:var(--ink)';
    const uidDiv=document.createElement('div');uidDiv.textContent='UID: '+uid;uidDiv.style.cssText='font-size:11px;color:var(--mu);font-family:monospace;overflow-wrap:anywhere';
    info.append(emailDiv,uidDiv);
    
    // Ban status badge
    const badge=document.createElement('span');
    badge.style.cssText='padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap';
    if(u.banned){
     badge.textContent='BANLI';
     badge.style.background='#DC262620';
     badge.style.color='var(--dg)';
     row.style.opacity='0.5';
    }else{
     badge.textContent='AKTİF';
     badge.style.background='var(--act)';
     badge.style.color='var(--ac)';
    }
    header.append(info,badge);
    row.append(header);
    
    const current=document.createElement('div');
    current.textContent='Mevcut rol: '+({admin:'Admin',partner:'İş Ortağı',employee:'Çalışan',customer:'Müşteri'}[u.role]||u.role);
    current.style.cssText='font-size:13px;color:var(--ink);margin-bottom:8px;font-weight:600';
    row.append(current);
    
    if(u.role==='admin'){
     const lock=document.createElement('small');
     lock.textContent='⚠️ Tek yönetici hesabı — değiştirilemez';
     lock.style.cssText='color:var(--mu);display:block;margin-top:8px';
     row.append(lock);
     list.append(row);
     return;
    }
    
    // Role selector
    const roleLabel=document.createElement('label');roleLabel.textContent='Rolü değiştir:';roleLabel.style.cssText='display:block;font-size:12px;color:var(--mu);font-weight:700;margin-top:10px;margin-bottom:4px';
    const r=document.createElement('select');
    r.style.cssText='width:100%;padding:10px;border:1.5px solid var(--ln);border-radius:10px;background:var(--s2);font-weight:600;margin-bottom:8px';
    ['partner','employee','customer'].forEach(v=>{
     const o=document.createElement('option');
     o.value=v;
     o.textContent=({partner:'İş Ortağı',employee:'Çalışan',customer:'Müşteri'})[v];
     r.append(o);
    });
    r.value=['partner','employee','customer'].includes(u.role)?u.role:'employee';
    
    // Project selector for customers
    const pLabel=document.createElement('label');pLabel.textContent='Müşteri projesi:';pLabel.style.cssText='display:block;font-size:12px;color:var(--mu);font-weight:700;margin-bottom:4px';
    const p=document.createElement('select');
    p.style.cssText='width:100%;padding:10px;border:1.5px solid var(--ln);border-radius:10px;background:var(--s2);font-weight:600;margin-bottom:8px';
    const blank=document.createElement('option');blank.value='';blank.textContent='Proje seçin';p.append(blank);
    projectOpts.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;p.append(o)});
    if(u.projectId)p.value=u.projectId;
    pLabel.style.display=r.value==='customer'?'block':'none';
    p.style.display=r.value==='customer'?'block':'none';
    r.onchange=()=>{pLabel.style.display=r.value==='customer'?'block':'none';p.style.display=r.value==='customer'?'block':'none'};
    
    row.append(roleLabel,r,pLabel,p);
    
    // Action buttons container
    const actions=document.createElement('div');
    actions.style.cssText='display:flex;gap:8px;margin-top:12px;flex-wrap:wrap';
    
    // Save role button
    const save=document.createElement('button');
    save.textContent='Rolü Kaydet';
    save.style.cssText='flex:1;min-width:120px;background:var(--ac);color:var(--onac);border:0;border-radius:10px;padding:10px;font-weight:700;cursor:pointer';
    save.onclick=async()=>{
     try{
      const updates={role:r.value};
      if(r.value==='customer'&&p.value)updates.projectId=p.value;
      else if(r.value!=='customer')updates.projectId=null;
      await userDoc(uid).update(updates);
      current.textContent='Mevcut rol: '+({admin:'Admin',partner:'İş Ortağı',employee:'Çalışan',customer:'Müşteri'}[r.value]||r.value);
      save.textContent='✓ Kaydedildi';
      setTimeout(()=>save.textContent='Rolü Kaydet',2000);
      if(r.value!=='customer')p.value='';
     }catch(e){alert('Hata: '+err(e))}
    };
    
    // Ban/Unban button
    const ban=document.createElement('button');
    ban.textContent=u.banned?'Ban Kaldır':'Kullanıcıyı Banla';
    ban.style.cssText='flex:1;min-width:120px;background:'+(u.banned?'var(--s2)':'var(--dg)')+';color:'+(u.banned?'var(--ink)':'#fff')+';border:0;border-radius:10px;padding:10px;font-weight:700;cursor:pointer';
    ban.onclick=async()=>{
     if(!confirm((u.banned?'Ban kaldırılsın mı?':'Kullanıcı banlanacak, giriş yapamayacak. Emin misiniz?')))return;
     try{
      await userDoc(uid).update({banned:u.banned?null:true});
      u.banned=!u.banned;
      badge.textContent=u.banned?'BANLI':'AKTİF';
      badge.style.background=u.banned?'#DC262620':'var(--act)';
      badge.style.color=u.banned?'var(--dg)':'var(--ac)';
      row.style.opacity=u.banned?'0.5':'1';
      ban.textContent=u.banned?'Ban Kaldır':'Kullanıcıyı Banla';
      ban.style.background=u.banned?'var(--s2)':'var(--dg)';
      ban.style.color=u.banned?'var(--ink)':'#fff';
     }catch(e){alert('Hata: '+err(e))}
    };
    
    actions.append(save,ban);
    row.append(actions);
    list.append(row);
   });
  }catch(e){$('#lv-users').textContent='Kullanıcılar yüklenemedi: '+err(e)}
 };
 document.querySelector('header').append(b);
 $('#lv-close-team').onclick=()=>{team.style.display='none'};
 $('#lv-invite-role').onchange=()=>{$('#lv-invite-project-label').style.display=$('#lv-invite-role').value==='customer'?'block':'none';$('#lv-invite-project').style.display=$('#lv-invite-role').value==='customer'?'block':'none'};
 $('#lv-invite-role').dispatchEvent(new Event('change'));
 $('#lv-create-invite').onclick=async()=>{
  const role=$('#lv-invite-role').value,projectId=$('#lv-invite-project').value.trim();
  try{
   // PHASE 1: Client-side invite creation
   if(!['employee','partner','customer'].includes(role)) throw new Error('Geçersiz rol');
   if(role==='customer'&&!projectId) throw new Error('Müşteri için proje kimliği gerekli');
   
   // Generate random code (12 chars alphanumeric)
   const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
   let code = '';
   for(let i=0; i<12; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
   
   const hash = await sha256(code);
   const invite = {
    role,
    projectId: role==='customer' ? projectId : null,
    createdBy: currentUser.uid,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    usedBy: null,
    usedAt: null
   };
   
   await path('invites').child(hash).set(invite);
   $('#lv-invite-output').textContent=code;
   $('#lv-invite-output').title='Bu kodu kullanıcıya güvenli kanaldan iletin. Yalnızca bir kez gösterilir.';
   $('#lv-copy-code').style.display='block';
   $('#lv-copy-code').onclick=()=>{
    navigator.clipboard.writeText(code).then(()=>{
     $('#lv-copy-code').textContent='✓ Kopyalandı';
     setTimeout(()=>$('#lv-copy-code').textContent='Kopyala',2000);
    }).catch(()=>{
     try{const t=document.createElement('textarea');t.value=code;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();$('#lv-copy-code').textContent='✓ Kopyalandı';setTimeout(()=>$('#lv-copy-code').textContent='Kopyala',2000);}catch(e){alert('Kopyalanamadı: '+code)}
    });
   };
  }catch(e){$('#lv-invite-output').textContent='Hata: '+err(e);$('#lv-copy-code').style.display='none';}
 };
}
async function startForUser(user){
 if(window.LV_UNSUB){window.LV_UNSUB();window.LV_UNSUB=null}
 settingsSig='';lastLogoData='';lastLogoPath='';
 currentUser=user;
 try{
  const snap=await userDoc(user.uid).once('value');if(!snap.exists()){enrollment();return}
  profile=snap.val();if(!['admin','partner','employee','customer'].includes(profile.role)){enrollment();return}
  window.LV_ROLE=profile.role;window.LV_USER={uid:user.uid,email:user.email||'',role:profile.role};
  if(profile.role==='customer'){customerPortal();return}
  ready=true;authEl.hidden=true;appRoot(true);
  document.querySelector('nav').style.display='';
  if(profile.role==='employee'){document.body.classList.add('lv-employee');const gs=document.querySelector('#gs');if(gs)gs.style.display='none'}else{document.body.classList.remove('lv-employee');const gs=document.querySelector('#gs');if(gs)gs.style.display=''}
  if(profile.role==='admin')teamButton();
  const set=await window.LV_DB.loadSettings();if(set&&Object.keys(set).length){Object.assign(window.S||{},set);try{localStorage.setItem('lvr_s',JSON.stringify({...set,ak:undefined,key:undefined}))}catch(e){}}
  if(typeof window.LV_APP_START==='function')await window.LV_APP_START();
  const sign=document.createElement('button');sign.id='lv-signout';sign.className='hb';sign.title='Oturumu kapat';sign.textContent='Çıkış';sign.onclick=async()=>{await auth.signOut();location.reload()};document.querySelector('header').append(sign);
 }catch(e){authEl.hidden=false;msg('Hesap verileri okunamadı: '+err(e));}
}
appRoot(false);
document.addEventListener('click',e=>{
 if(window.LV_ROLE!=='employee')return;
 const b=e.target.closest&&e.target.closest('[data-a]');if(!b)return;
 const a=b.dataset.a||'';
 const allowed=new Set(['home','open','tab','view','lm','mic','theme','w:all','w:open','w:item','w:newi','w:chk','w:td','w:su','w:done','w:allok','w:addph','w:dupi','w:delph','w:tx','w:tt','w:s','w:f','w:sa','w:s0','w:back','w:pv','w:incgo','w:incref','w:reset','w:stc','w:stp','w:filter','w:sort']);
 if(!allowed.has(a)&&!a.startsWith('w:')){e.preventDefault();e.stopImmediatePropagation();return}
 if(['w:newp','w:imp','w:xl','w:xls','w:json'].includes(a)){e.preventDefault();e.stopImmediatePropagation()}
},true);
document.addEventListener('input',e=>{
 if(window.LV_ROLE!=='employee')return;
 const t=e.target;if(t.dataset.i!=null||t.dataset.m||t.dataset.set){e.preventDefault();e.stopImmediatePropagation()}
},true);
if(loadConfig()){
 authEl.hidden=false;
 authView('Lavora çalışma alanı','İşletme hesabınızla güvenli şekilde giriş yapın.');
 auth.onAuthStateChanged(u=>{if(u)startForUser(u);else{if(window.LV_UNSUB){window.LV_UNSUB();window.LV_UNSUB=null}ready=false;profile=null;currentUser=null;window.LV_ROLE='';window.LV_USER=null;document.querySelectorAll('#lv-team-open,#lv-signout,#lv-customer-signout').forEach(x=>x.remove());team.style.display='none';authEl.hidden=false;appRoot(false);authView('Güvenli çalışma alanı','Google hesabınızla giriş yapın.')}})
}else{authEl.hidden=false}
})();
</script>