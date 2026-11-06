# Phase 2 - Kota Tracking & Performance

## 📋 Önkoşullar

### Phase 1 Tamamlanma Kriterleri
- [x] Kritik güvenlik açıkları kapatıldı
- [x] RTDB SDK implementasyonu tamamlandı
- [x] Security Rules production-ready
- [x] CRUD fonksiyonları transaction-safe
- [x] Denetim raporu hazırlandı
- [ ] **Gerçek testler tamamlandı** (MANUAL-TEST-GUIDE.md)
- [ ] **Test raporu oluşturuldu** (PHASE-1-TEST-RESULTS.md)

### Kabul Edilen Riskler (Dokümante)
- ⚠️ project_ops nested finansal alanlar (partial validation)
- ⚠️ Multi-path transaction (best-effort rollback)
- ⚠️ Manuel admin bootstrap (one-time)
- ⚠️ Base64 performance (Spark plan limits)

---

## 🎯 Phase 2 Amaçları

### Yüksek Öncelik (Must-Have)
1. **Kota Tracking System**
   - User bazlı Base64 kullanım takibi
   - 900MB soft limit warning (90% of 1GB)
   - 1GB hard limit enforcement
   - Real-time kota gösterimi (UI)

2. **Performance Optimizations**
   - Thumbnail lazy loading (ayrı node)
   - Client-side cache (localStorage)
   - Network bandwidth monitoring

3. **Error Handling İyileştirmeleri**
   - User-friendly error messages
   - Retry logic (transient failures)
   - Offline detection & queueing

### Orta Öncelik (Should-Have)
4. **Monitoring & Analytics**
   - RTDB usage dashboard
   - Read/write operation metrics
   - Concurrent user tracking
   - Error rate monitoring

5. **Nested Financial Validation**
   - Client-side monitoring script
   - Anomaly detection
   - Admin alerts

### Düşük Öncelik (Nice-to-Have)
6. **UI/UX İyileştirmeleri**
   - Loading states
   - Progress indicators
   - Toast notifications standardization

7. **Documentation**
   - API reference
   - Architecture diagrams
   - Deployment automation

---

## 🔧 Phase 2.1: Kota Tracking System

### Hedef
Spark plan 1GB RTDB limitini aşmamak için kullanıcı bazlı kota takibi.

### Tasarım

#### 1. Kota Hesaplama
```javascript
function calculateBase64Size(dataURL){
  if(!dataURL || !dataURL.startsWith('data:')) return 0;
  // Remove data:image/jpeg;base64, prefix
  const base64 = dataURL.split(',')[1] || '';
  // Base64 to bytes: 4 chars = 3 bytes
  return Math.ceil(base64.length * 0.75);
}

function formatBytes(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}
```

#### 2. RTDB Schema
```
quota_tracking/
  {uid}/
    totalBytes: number
    lastUpdated: timestamp
    breakdown: {
      workflow_photos: number
      receipts: number
      scans: number
      voice_clips: number
      settings_logo: number
    }
```

#### 3. Quota Update Function
```javascript
async function updateQuota(uid, collection, delta){
  const quotaRef = path('quota_tracking').child(uid);
  
  // Transaction to update quota
  const result = await quotaRef.transaction((current)=>{
    const quota = current || {
      totalBytes: 0,
      lastUpdated: Date.now(),
      breakdown: {}
    };
    
    quota.totalBytes += delta;
    quota.breakdown[collection] = (quota.breakdown[collection]||0) + delta;
    quota.lastUpdated = Date.now();
    
    // Hard limit check (1GB)
    if(quota.totalBytes > 1024*1024*1024){
      return; // Abort transaction
    }
    
    return quota;
  });
  
  if(!result.committed){
    throw new Error('Kota limiti aşıldı (1GB). Lütfen eski dosyaları silin.');
  }
  
  // Soft limit warning (900MB)
  const quota = result.snapshot.val();
  if(quota.totalBytes > 900*1024*1024){
    toast('⚠️ Kota kullanımı %90\'ı aştı. Lütfen eski dosyaları temizleyin.', 10000);
  }
  
  return quota;
}
```

#### 4. uploadValue Integration
```javascript
async function uploadValue(store,id,key,value){
  if(value==null)return null;
  
  let dataURL = typeof value==='string'&&value.startsWith('data:') ? value : await bytesToDataURL(value);
  
  // Compress
  if(dataURL.startsWith('data:image/')){
    try{
      const isThumb = key === 'th';
      const maxDim = isThumb ? 400 : 1920;
      const quality = isThumb ? 0.70 : 0.85;
      dataURL = await compressImage(dataURL, maxDim, quality);
    }catch(e){console.warn('Compression failed:',e)}
  }
  
  // Size check
  const sizeBytes = calculateBase64Size(dataURL);
  if(sizeBytes > 5 * 1024 * 1024){
    throw new Error('Dosya 5MB limitini aşıyor.');
  }
  
  // Quota check & update
  const collectionMap = {
    'wph': 'workflow_photos',
    'rcpt': 'receipts',
    'scans': 'scans'
  };
  const collection = collectionMap[store] || store;
  await updateQuota(currentUser.uid, collection, sizeBytes);
  
  return dataURL;
}
```

#### 5. UI - Kota Gösterimi
```html
<!-- Header'a ekle -->
<div class="quota-indicator" id="quota-indicator">
  <svg class="i" viewBox="0 0 24 24">
    <path d="M12 2v20M17 7l-5-5-5 5"/>
  </svg>
  <span id="quota-text">Kota: 0 MB / 1 GB</span>
</div>
```

```javascript
async function loadQuota(){
  try{
    const snap = await path('quota_tracking').child(currentUser.uid).once('value');
    if(!snap.exists()) return;
    
    const quota = snap.val();
    const used = quota.totalBytes;
    const total = 1024*1024*1024; // 1GB
    const percent = (used / total * 100).toFixed(1);
    
    $('#quota-text').textContent = `Kota: ${formatBytes(used)} / 1 GB (${percent}%)`;
    
    // Color coding
    const indicator = $('#quota-indicator');
    if(percent > 90) indicator.style.color = '#dc2626'; // Red
    else if(percent > 75) indicator.style.color = '#f59e0b'; // Orange
    else indicator.style.color = '#059669'; // Green
  }catch(e){
    console.warn('Quota load failed:', e);
  }
}

// Auto-refresh every 30 seconds
setInterval(loadQuota, 30000);
```

#### 6. Delete Operation - Quota Decrease
```javascript
async function removeDoc(store,id){
  // Read size before delete
  let removedSize = 0;
  if(['wph','rcpt','scans'].includes(store)){
    const ref = path(({wph:'workflow_photos',rcpt:'receipts',scans:'scans'})[store]).child(String(id));
    const snap = await ref.once('value');
    if(snap.exists()){
      const data = snap.val();
      if(data.imgPath) removedSize += calculateBase64Size(data.imgPath);
      if(data.thPath) removedSize += calculateBase64Size(data.thPath);
    }
  }
  
  // Delete
  if(store==='p'){
    if(role()==='employee') return path('project_ops').child(String(id)).remove();
    await Promise.all([
      path('projects').child(String(id)).remove(),
      path('project_ops').child(String(id)).remove()
    ]);
    return;
  }
  
  const col=({led:'ledger',rcpt:'receipts',wph:'workflow_photos',scans:'scans'})[store]||store;
  await path(col).child(String(id)).remove();
  
  // Update quota (decrease)
  if(removedSize > 0){
    const collection = ({wph:'workflow_photos',rcpt:'receipts',scans:'scans'})[store];
    await updateQuota(currentUser.uid, collection, -removedSize);
  }
}
```

### Security Rules Update
```json
"quota_tracking": {
  "$uid": {
    ".read": "auth.uid == $uid || root.child('tenants/lavora-main/users/' + auth.uid + '/role').val() == 'admin'",
    ".write": "auth.uid == $uid || root.child('tenants/lavora-main/users/' + auth.uid + '/role').val() == 'admin'",
    ".validate": "newData.hasChildren(['totalBytes', 'lastUpdated']) && newData.child('totalBytes').isNumber() && newData.child('totalBytes').val() >= 0 && newData.child('totalBytes').val() <= 1073741824"
  }
}
```

### Testing
1. Upload 100MB fotoğraf
2. Kota gösterimi güncelleniyor mu?
3. 1GB limit aşımı deneme → Hata mesajı
4. 900MB soft limit → Warning toast
5. Delete operation → Kota azalıyor mu?

---

## 🚀 Phase 2.2: Thumbnail Lazy Loading

### Hedef
`workflow_photos` thumbnail'leri ayrı node'a taşıyarak bandwidth tasarrufu.

### Mevcut Sorun
```json
{
  "workflow_photos": {
    "photo1": {
      "id": "photo1",
      "imgPath": "data:image/jpeg;base64,...", // 1MB
      "thPath": "data:image/jpeg;base64,..."   // 50KB
    }
  }
}
```
Her `workflow_photos` read'de FULL download (imgPath + thPath).

### Yeni Yapı
```json
{
  "workflow_photos": {
    "photo1": {
      "id": "photo1",
      "hasImage": true,
      "createdAt": 1730563200000
    }
  },
  "workflow_photos_media": {
    "photo1": {
      "img": "data:image/jpeg;base64,...",  // 1MB
      "th": "data:image/jpeg;base64,..."    // 50KB
    }
  }
}
```

**Avantaj**: List view sadece metadata okur (100 bytes/photo). Media on-demand.

### Implementation
```javascript
// List view: Sadece metadata
async function loadWorkflowPhotos(){
  const snap = await path('workflow_photos').once('value');
  const photos = Object.values(snap.val() || {});
  
  // Render thumbnails (lazy load)
  photos.forEach(photo => {
    const img = document.createElement('img');
    img.dataset.photoId = photo.id;
    img.src = 'placeholder.png'; // Placeholder
    img.onclick = () => loadFullPhoto(photo.id);
    container.append(img);
    
    // Lazy load thumbnail
    loadThumbnail(photo.id).then(th => {
      img.src = th;
    });
  });
}

async function loadThumbnail(photoId){
  const snap = await path('workflow_photos_media').child(photoId).child('th').once('value');
  return snap.val() || 'placeholder.png';
}

async function loadFullPhoto(photoId){
  const snap = await path('workflow_photos_media').child(photoId).child('img').once('value');
  return snap.val() || null;
}
```

### Migration Script
```javascript
// One-time migration: Move media to separate node
async function migrateWorkflowPhotos(){
  const snap = await path('workflow_photos').once('value');
  const photos = snap.val() || {};
  
  for(const [id, photo] of Object.entries(photos)){
    if(photo.imgPath || photo.thPath){
      // Write to media node
      await path('workflow_photos_media').child(id).set({
        img: photo.imgPath || null,
        th: photo.thPath || null
      });
      
      // Remove from main node
      await path('workflow_photos').child(id).update({
        imgPath: null,
        thPath: null,
        hasImage: true
      });
      
      console.log(`Migrated: ${id}`);
    }
  }
  
  console.log('Migration complete');
}
```

### Security Rules Update
```json
"workflow_photos_media": {
  ".read": "auth != null",
  ".write": false,
  "$photoId": {
    ".write": "auth != null",
    ".validate": "newData.hasChildren(['img', 'th']) && newData.child('img').val().length < 5242880 && newData.child('th').val().length < 524288"
  }
}
```

---

## 📊 Phase 2.3: Monitoring Dashboard

### Hedef
Admin için RTDB usage visibility.

### Metrics
1. **Total Storage**: Tüm tenant bytes
2. **User Breakdown**: User bazlı kullanım
3. **Collection Breakdown**: workflow_photos, receipts, etc.
4. **Daily Growth**: Son 7 gün trend
5. **Top Users**: En çok kullanan 5 user

### UI Mockup
```
+----------------------------------+
| 📊 RTDB Kullanım Dashboard       |
+----------------------------------+
| Total: 450 MB / 1 GB (45%)       |
| [=================>          ]   |
+----------------------------------+
| Collection Breakdown:            |
|  - workflow_photos: 300 MB (67%) |
|  - receipts: 100 MB (22%)        |
|  - scans: 50 MB (11%)            |
+----------------------------------+
| Top Users:                       |
|  1. user1@test.com: 200 MB       |
|  2. user2@test.com: 150 MB       |
|  3. user3@test.com: 100 MB       |
+----------------------------------+
| Son 7 Gün Trend:                 |
| [Line chart placeholder]         |
+----------------------------------+
```

### Implementation
Admin-only sayfa: `monitoring.html` veya main HTML'e tab ekle.

---

## 📅 Timeline

| Phase | Görev | Tahmini Süre | Öncelik |
|-------|-------|--------------|---------|
| 2.1.1 | Kota hesaplama utils | 2 saat | P0 |
| 2.1.2 | uploadValue integration | 2 saat | P0 |
| 2.1.3 | removeDoc quota decrease | 1 saat | P0 |
| 2.1.4 | UI kota gösterimi | 2 saat | P0 |
| 2.1.5 | Security Rules update | 1 saat | P0 |
| 2.1.6 | Testing | 2 saat | P0 |
| **2.1 TOTAL** | | **10 saat** | |
| 2.2.1 | Thumbnail lazy load design | 1 saat | P1 |
| 2.2.2 | Migration script | 2 saat | P1 |
| 2.2.3 | UI lazy loading | 3 saat | P1 |
| 2.2.4 | Testing | 2 saat | P1 |
| **2.2 TOTAL** | | **8 saat** | |
| 2.3.1 | Monitoring dashboard UI | 4 saat | P2 |
| 2.3.2 | Metrics calculation | 2 saat | P2 |
| 2.3.3 | Charts integration | 2 saat | P2 |
| **2.3 TOTAL** | | **8 saat** | |

**Phase 2 TOPLAM**: ~26 saat (~3-4 gün)

---

## ✅ Phase 2 Tamamlanma Kriterleri

- [ ] Kota tracking çalışıyor
- [ ] 1GB hard limit enforcement
- [ ] 900MB soft limit warning
- [ ] UI'da kota gösterimi
- [ ] Thumbnail lazy loading implement edildi
- [ ] Bandwidth %50+ azaldı (list view)
- [ ] Monitoring dashboard (admin-only)
- [ ] Tüm Phase 2 testleri başarılı
- [ ] Dokümantasyon güncellendi

---

## 🚀 Phase 3 Ön Bakış

1. **Advanced Analytics**
   - User activity tracking
   - Feature usage metrics
   - Performance profiling

2. **Backup/Restore**
   - JSON export
   - Scheduled backups
   - Restore UI

3. **Multi-Tenant Support**
   - Tenant switcher
   - Cross-tenant admin
   - Isolated data

4. **Cloud Functions (Blaze Plan)**
   - Server-side validation
   - Scheduled tasks
   - Email notifications

---

**Sonraki Adım**: Phase 1 gerçek testlerini tamamla, sonra Phase 2.1'e başla.

