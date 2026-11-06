# Lavora v38 — Mevcut Sistem Analizi

## 🔍 Genel Bakış

**Mevcut Mimari:** Cloud Firestore + Cloud Storage + Cloud Functions + Secret Manager  
**Hedef Mimari:** Realtime Database + Base64 Encoded Media (Spark planı uyumlu)  
**Firebase Planı:** Blaze (ücretli) → Spark (ücretsiz)

---

## 📊 Veri Koleksiyonları ve Yapısı

### 1. Users (`users/{uid}`)
**Amaç:** Kullanıcı profilleri ve rol yönetimi  
**Mevcut Depolama:** Firestore  
**Hedef Depolama:** Realtime Database

**Alan yapısı:**
```javascript
{
  uid: string,
  email: string,
  role: 'admin' | 'partner' | 'employee' | 'customer',
  createdAt: timestamp,
  roleChangedAt: timestamp (opsiyonel)
}
```

**Erişim Kuralları:**
- Okuma: Yalnızca kendi kaydını okuyabilir
- Yazma: Sadece Cloud Functions (⚠️ SORUN: Spark'ta yok)

**Kullanım Yerleri:**
- `auth.onAuthStateChanged` → rol kontrolü
- `userDoc(uid).get()` → profil bilgisi
- `changeUserRole` function → rol güncelleme (⚠️ Cloud Function)

---

### 2. Projects (`projects/{projectId}`)
**Amaç:** Ana proje verileri (tam veri, finans içerir)  
**Mevcut Depolama:** Firestore  
**Hedef Depolama:** Realtime Database

**Alan yapısı:**
```javascript
{
  id: string,
  name: string,
  cust: string, // müşteri adı
  customerId: string, // müşteri UID'si (opsiyonel)
  kdv: number,
  u: timestamp, // updated at
  s: [...], // sheets - tablo verileri
  w: { // workflow
    items: [{
      n: string, // name
      dim: string,
      mat: string,
      note: string,
      price: number,
      cost: number,
      total: number,
      st: string, // status
      ...
    }]
  },
  _revision: number // çakışma kontrolü
}
```

**Erişim Kuralları:**
- Admin & Partner: Tam erişim
- Employee: Erişim yok (⚠️ finans içerir)
- Customer: Erişim yok (customer_projects üzerinden özet görür)

**Kullanım Yerleri:**
- `writeDoc('p', project)` → proje kaydet
- `removeDoc('p', id)` → proje sil
- `docs()` → tüm projeler

---

### 3. Project Ops (`project_ops/{projectId}`)
**Amaç:** Çalışan için finanssız proje izdüşümü  
**Mevcut Depolama:** Firestore  
**Hedef Depolama:** Realtime Database

**Alan yapısı:**
```javascript
{
  // projects/{id} ile aynı ama finans alanları çıkarılmış
  id: string,
  name: string,
  status: string,
  w: { // workflow - fiyat/maliyet alanları olmadan
    items: [{
      n: string,
      dim: string,
      mat: string,
      note: string,
      st: string
      // price, cost, total yok!
    }]
  },
  _revision: number
}
```

**Erişim Kuralları:**
- Admin & Partner: Tam erişim
- Employee: Tam erişim
- Customer: Erişim yok

**Senkronizasyon:**
- ⚠️ `syncEmployeeProjection` Cloud Function ile otomatik
- Her `projects/` değişikliğinde `project_ops/` güncellenir

---

### 4. Customer Projects (`customer_projects/{uid}`)
**Amaç:** Müşteri için proje özetleri  
**Mevcut Depolama:** Firestore  
**Hedef Depolama:** Realtime Database

**Alan yapısı:**
```javascript
{
  projects: {
    [projectId]: {
      projectName: string,
      projectType: string,
      status: string,
      startDate: timestamp,
      endDate: timestamp,
      description: string,
      updatedAt: timestamp
      // Fiyat, ödeme, finans bilgileri yok
    }
  }
}
```

**Erişim Kuralları:**
- Yalnızca kendi UID'sine ait dokümanı okuyabilir
- Yazma: Sadece Cloud Functions (⚠️ syncCustomerProject)

---

### 5. Ledger (`ledger/{entryId}`)
**Amaç:** Gelir/gider defteri  
**Mevcut Depolama:** Firestore  
**Hedef Depolama:** Realtime Database

**Alan yapısı:**
```javascript
{
  id: string,
  date: timestamp,
  type: 'income' | 'expense',
  amount: number,
  category: string,
  description: string,
  createdBy: uid
}
```

**Erişim Kuralları:**
- Admin & Partner: Tam erişim
- Employee: Erişim yok
- Customer: Erişim yok

---

### 6. Receipts (`receipts/{receiptId}`)
**Amaç:** Makbuz/fiş görselleri  
**Mevcut Depolama:** Firestore (metadata) + Cloud Storage (görsel)  
**Hedef Depolama:** Realtime Database (metadata + Base64 görsel)

**Alan yapısı:**
```javascript
{
  id: string,
  title: string,
  date: timestamp,
  amount: number,
  imgPath: string, // ⚠️ Storage path
  thPath: string, // ⚠️ thumbnail path
  // Hedef:
  img: string, // Base64 data URL
  th: string // Base64 thumbnail
}
```

**Storage Kullanımı:**
- ⚠️ `saveAttachment('rcpt', id, 'img', dataURL)` → Cloud Storage'a yükler
- ⚠️ `hydrate('rcpt', obj)` → Storage'dan indirir ve data URL'e çevirir

**Erişim Kuralları:**
- Admin & Partner: Tam erişim
- Employee: Erişim yok
- Customer: Erişim yok

---

### 7. Scans (`scans/{scanId}`)
**Amaç:** Taranmış belgeler  
**Mevcut Depolama:** Firestore + Cloud Storage  
**Hedef Depolama:** Realtime Database (Base64)

**Alan yapısı:**
```javascript
{
  id: string,
  t: timestamp,
  eng: boolean, // engineered
  L: array, // lines
  table: array,
  raw: string,
  title: string,
  img: string, // ⚠️ Storage'da, Base64'e dönecek
  imgPath: string
}
```

---

### 8. Workflow Photos (`workflow_photos/{photoId}`)
**Amaç:** İş akışı fotoğrafları  
**Mevcut Depolama:** Firestore + Cloud Storage  
**Hedef Depolama:** Realtime Database (Base64)

**Alan yapısı:**
```javascript
{
  id: string,
  projectId: string,
  img: string, // ⚠️ Storage'da
  th: string, // thumbnail
  imgPath: string,
  thPath: string,
  note: string,
  createdAt: timestamp,
  createdBy: uid
}
```

**Erişim Kuralları:**
- Admin, Partner, Employee: Tam erişim
- Customer: Erişim yok

---

### 9. Custom Sounds (`voice_clips/{soundId}`)
**Amaç:** Kullanıcı ses klipleri  
**Mevcut Depolama:** Firestore (metadata) + Cloud Storage (audio blob)  
**Hedef Depolama:** Realtime Database (Base64 audio)

**Alan yapısı:**
```javascript
{
  id: string,
  uid: string,
  path: string, // ⚠️ Storage path
  updatedAt: timestamp
}
```

**Erişim Kuralları:**
- Admin, Partner, Employee: Tam erişim
- Customer: Erişim yok

---

### 10. Invites (`invites/{inviteId}`)
**Amaç:** Davet kodları  
**Mevcut Depolama:** Firestore  
**Hedef Depolama:** Realtime Database

**Alan yapısı:**
```javascript
{
  codeHash: string, // SHA-256 hash
  role: 'partner' | 'employee' | 'customer',
  used: boolean,
  createdBy: uid,
  createdAt: timestamp,
  expiresAt: timestamp,
  usedBy: uid (opsiyonel),
  usedAt: timestamp (opsiyonel),
  assignedProjectId: string (customer için, opsiyonel)
}
```

**Cloud Functions:**
- ⚠️ `createInvite` → kod oluştur (admin only)
- ⚠️ `useInvite` → kodu kullan

**Erişim Kuralları:**
- Admin: Tam erişim
- Diğerleri: Erişim yok

---

### 11. Settings (`settings/main`)
**Amaç:** Uygulama ayarları ve logo  
**Mevcut Depolama:** Firestore + Cloud Storage (logo)  
**Hedef Depolama:** Realtime Database (logo Base64)

**Alan yapısı:**
```javascript
{
  logo: string, // Base64 data URL
  logoPath: string, // ⚠️ Storage path
  key: string,
  firm: string,
  tel: string,
  adr: string
}
```

---

## 🔐 Güvenlik Katmanları

### Mevcut Güvenlik
1. **Firebase Authentication** - Google OAuth
2. **Firestore Security Rules** - Koleksiyon seviyesi erişim
3. **Cloud Functions** - Sunucu taraflı rol yönetimi
4. **Storage Security Rules** - Dosya seviyesi erişim

### Güvenlik Sorunları (Functions olmadan)

#### ⚠️ KRİTİK SORUN 1: İlk Admin Oluşturma
**Mevcut:** `bootstrapAdmin` Cloud Function + Secret Manager  
**Sorun:** Secret Manager ve Functions kullanılamaz  
**Çözüm Gerekliliği:** Manuel veya güvenli alternatif

#### ⚠️ KRİTİK SORUN 2: Rol Değiştirme
**Mevcut:** `changeUserRole` Cloud Function  
**Sorun:** Kullanıcı kendi role alanını yazabiliyor mu? (Hayır, şu an Functions-only)  
**Çözüm Gerekliliği:** Rules-based güvenli kontrol

#### ⚠️ KRİTİK SORUN 3: Davet Sistemi
**Mevcut:** `createInvite` ve `useInvite` Cloud Functions  
**Sorun:** Hash doğrulama ve atomik işlem sunucu tarafında  
**Çözüm Gerekliliği:** İstemci taraflı güvenli implementasyon veya basitleştirme

#### ⚠️ KRİTİK SORUN 4: Projeksiyon Senkronizasyonu
**Mevcut:** `syncEmployeeProjection` ve `syncCustomerProject` Cloud Functions  
**Sorun:** Otomatik trigger yok  
**Çözüm Gerekliliği:** İstemci taraflı manuel senkronizasyon

---

## 📦 Cloud Storage Kullanımı

### Mevcut Storage Yapısı
```
tenants/{tenantId}/
  ├── attachments/
  │   ├── rcpt/{uid}/{id}/img
  │   ├── rcpt/{uid}/{id}/th
  │   ├── wph/{uid}/{id}/img
  │   ├── wph/{uid}/{id}/th
  │   └── scans/{uid}/{id}/img
  ├── settings/{uid}/logo
  └── voice-clips/{uid}/{clipId}
```

### Boyut ve Kota Analizi

**Tipik Dosya Boyutları:**
- Makbuz fotoğrafı (orijinal): 1-3 MB
- Makbuz thumbnail: 50-150 KB
- Workflow fotoğrafı: 1-5 MB
- Workflow thumbnail: 50-200 KB
- Tarama görseli: 500 KB - 2 MB
- Logo: 50-300 KB
- Ses klibi: 10-100 KB (kısa klip)

**Spark Plan Limitleri:**
- Realtime Database: 1 GB depolama
- Realtime Database: 10 GB/ay download
- Realtime Database: 50K eşzamanlı bağlantı
- Storage: YOK (Cloud Storage Spark'ta kullanılamaz)

**Base64 Overhead:**
- Base64 ~33% daha büyük
- 1 MB görsel → ~1.33 MB Base64
- 10 makbuz fotoğrafı → ~13 MB
- 50 workflow fotoğrafı → ~65 MB
- Toplam: ~100-200 MB veri (1 GB limit dahilinde)

---

## 🔄 Veri Akışı ve Fonksiyonlar

### 1. Proje İşlemleri
```javascript
// Okuma
docs() → Firestore'dan tüm projeler (admin/partner)
       → project_ops'dan projeler (employee)
       
// Yazma
writeDoc('p', project)
  → Admin/Partner: projects/{id} + project_ops/{id}
  → Employee: sadece project_ops/{id}
  → Transaction ile revision kontrolü
```

### 2. Fotoğraf İşlemleri
```javascript
// Yükleme
saveAttachment('wph', id, 'img', dataURL)
  → Storage'a yükle: tenants/{tenant}/attachments/wph/{uid}/{id}/img
  → Firestore metadata kaydet

// İndirme
hydrate('wph', {imgPath: '...'})
  → Storage'dan indir: getDownloadURL()
  → Blob → data URL dönüşümü
```

### 3. Ses İşlemleri
```javascript
// Kaydetme
window.LV_DB.audio.put(id, blob)
  → Storage: tenants/{tenant}/voice-clips/{uid}/{id}
  → Firestore: voice_clips/{id}

// Okuma
window.LV_DB.audio.get(id)
  → Firestore'dan path al
  → Storage'dan blob indir
```

---

## 🚨 Cloud Functions Bağımlılıkları

### Kullanılan Functions

1. **`bootstrapAdmin`** (onCall)
   - İlk admin oluşturma
   - Secret doğrulama
   - Tek admin kontrolü

2. **`createInvite`** (onCall)
   - Davet kodu üretme
   - SHA-256 hash
   - Admin kontrolü

3. **`useInvite`** (onCall)
   - Davet kodu doğrulama
   - Expiry kontrolü
   - Atomik kullanım işareti

4. **`changeUserRole`** (onCall)
   - Rol değiştirme
   - Admin kontrolü
   - Self-edit engelleme

5. **`syncEmployeeProjection`** (onDocumentWritten)
   - Otomatik trigger: projects/{id}
   - Finanssız izdüşüm oluşturma
   - workflow item filtering

6. **`syncCustomerProject`** (onDocumentWritten)
   - Otomatik trigger: projects/{id}
   - Müşteri özeti oluşturma
   - customerId kontrolü

---

## 📝 Mevcut Kod Analizi

### JavaScript Fonksiyon Listesi

**Veri Yönetimi:**
- `newP(name, sheets, cust)` - yeni proje
- `save()` - localStorage + Firestore sync
- `writeDoc(store, obj)` - Firestore yazma
- `removeDoc(store, id)` - Firestore silme
- `docs()` - Firestore okuma
- `hydrate(store, obj)` - Storage'dan görsel indir

**Kullanıcı Arayüzü:**
- `render()` - ana render
- `toast(msg, ms)` - bildirim
- `dlg(opts)` - dialog
- `sheet(html)` - bottom sheet
- `theme()` - tema değiştir

**Firebase:**
- `initFirebase()` - Firebase başlatma
- `path(col)` - koleksiyon referansı
- `userDoc(uid)` - kullanıcı referansı
- `role()` - mevcut rol
- `saveAttachment(store, id, key, value)` - Storage yükleme

**İş Akışı:**
- `newP()` - yeni proje
- `projTotal(p)` - proje toplamı
- `sanitizeP(projects)` - veri temizleme

---

## 🎯 Geçiş Görevleri

### 1. Veri Modeli Dönüşümü
- [x] Firestore → Realtime Database şema tasarımı
- [ ] Base64 encoding/decoding utility
- [ ] Görsel sıkıştırma (Canvas API)
- [ ] Kota takip sistemi

### 2. Storage Eliminasyonu
- [ ] `saveAttachment` → Base64 kaydetme
- [ ] `hydrate` → Base64 okuma
- [ ] Logo yönetimi (Base64)
- [ ] Ses klipleri (Base64)

### 3. Functions Eliminasyonu
- [ ] İlk admin: Manuel Console işlemi
- [ ] Davet sistemi: Basitleştirilmiş istemci tarafı
- [ ] Rol değiştirme: Rules-based
- [ ] Projeksiyon sync: Manuel/istemci tarafı

### 4. Security Rules
- [ ] Realtime Database Rules yazımı
- [ ] Rol bazlı erişim
- [ ] Employee finans engelleme
- [ ] Customer izolasyonu
- [ ] Write validation

### 5. Test
- [ ] Rol bazlı erişim testleri
- [ ] Veri sync testleri
- [ ] Çakışma kontrolü testleri
- [ ] Kota limit testleri

---

## ⚠️ Bilinen Riskler

1. **Kota Aşımı:** Base64 ile veri boyutu artacak
2. **Performans:** Büyük Base64 stringleri yavaş olabilir
3. **Güvenlik:** Functions olmadan bazı işlemler riskli
4. **Veri Kaybı:** Migration sırasında dikkat
5. **Çevrimdışı:** Realtime DB offline support sınırlı

---

**Son Güncelleme:** 2 Kasım 2026  
**Durum:** Analiz tamamlandı, implementasyon başlayacak
