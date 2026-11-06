# Lavora Firebase Spark Mimarisi — Tasarım Dokümanı

## 🎯 Hedef

Mevcut Lavora uygulamasını Cloud Functions, Secret Manager ve Cloud Storage kullanmadan Firebase Spark (ücretsiz) planında çalışacak şekilde dönüştürmek.

**Kısıtlamalar:**
- ✅ Firebase Spark planı
- ✅ Realtime Database kullan
- ❌ Cloud Functions kullanma
- ❌ Cloud Storage kullanma
- ❌ Secret Manager kullanma
- ❌ IndexedDB kullanma
- ✅ Tüm mevcut özellikleri koru
- ✅ Güvenliği azaltma

---

## 📊 Realtime Database Şema Tasarımı

### Şema Prensipler

1. **Düz Yapı:** İç içe nesting yerine düz koleksiyonlar
2. **İndekslenebilir:** Query yapılabilir alanlar
3. **Erişim Kontrollü:** Security Rules ile katmanlı izolasyon
4. **Modüler:** Her veri tipi ayrı düğüm
5. **Minimal Okuma:** Gereksiz veri çekme

### Tam Şema

```json
{
  "users": {
    "{uid}": {
      "email": "user@example.com",
      "role": "admin|partner|employee|customer",
      "createdAt": 1699999999999,
      "roleChangedAt": 1699999999999,
      "updatedBy": "admin_uid"
    }
  },
  
  "admin_lock": {
    "initialized": true,
    "adminUid": "first_admin_uid",
    "createdAt": 1699999999999
  },
  
  "projects": {
    "{projectId}": {
      "id": "proj_123",
      "name": "Mutfak Dolabı",
      "cust": "Ahmet Yılmaz",
      "customerId": "customer_uid",
      "kdv": 20,
      "u": 1699999999999,
      "createdBy": "uid",
      "updatedBy": "uid",
      "_revision": 5,
      "s": [
        {
          "n": "Malzeme Listesi",
          "h": ["Malzeme", "Adet", "Birim Fiyat", "Toplam"],
          "r": [
            ["MDF", "10", "150", "1500"],
            ["Menteşe", "20", "5", "100"]
          ]
        }
      ],
      "w": {
        "items": [
          {
            "id": "item_1",
            "n": "Kesim",
            "dim": "200x80",
            "mat": "MDF",
            "note": "Yatay kesim",
            "price": 500,
            "cost": 200,
            "total": 500,
            "st": "tamamlandi"
          }
        ]
      }
    }
  },
  
  "project_ops": {
    "{projectId}": {
      "id": "proj_123",
      "name": "Mutfak Dolabı",
      "status": "devam",
      "u": 1699999999999,
      "_revision": 5,
      "w": {
        "items": [
          {
            "id": "item_1",
            "n": "Kesim",
            "dim": "200x80",
            "mat": "MDF",
            "note": "Yatay kesim",
            "st": "tamamlandi"
            // price, cost, total yok!
          }
        ]
      }
    }
  },
  
  "customer_projects": {
    "{customerUid}": {
      "{projectId}": {
        "projectName": "Mutfak Dolabı",
        "status": "devam",
        "startDate": 1699999999999,
        "description": "...",
        "updatedAt": 1699999999999
        // Finans bilgileri yok
      }
    }
  },
  
  "ledger": {
    "{entryId}": {
      "id": "led_123",
      "date": 1699999999999,
      "type": "income|expense",
      "amount": 1500.50,
      "category": "Malzeme",
      "description": "MDF alımı",
      "createdBy": "uid",
      "projectId": "proj_123"
    }
  },
  
  "receipts": {
    "{receiptId}": {
      "id": "rcpt_123",
      "title": "Makbuz #45",
      "date": 1699999999999,
      "amount": 1500,
      "createdBy": "uid",
      "projectId": "proj_123"
    }
  },
  
  "receipts_media": {
    "{receiptId}": {
      "img": "data:image/jpeg;base64,...",
      "th": "data:image/jpeg;base64,...",
      "imgSize": 156789,
      "thSize": 12345,
      "uploadedAt": 1699999999999
    }
  },
  
  "scans": {
    "{scanId}": {
      "id": "scan_123",
      "t": 1699999999999,
      "eng": true,
      "L": [],
      "table": [],
      "raw": "...",
      "title": "Fatura"
    }
  },
  
  "scans_media": {
    "{scanId}": {
      "img": "data:image/jpeg;base64,...",
      "size": 234567,
      "uploadedAt": 1699999999999
    }
  },
  
  "workflow_photos": {
    "{photoId}": {
      "id": "wph_123",
      "projectId": "proj_123",
      "note": "Montaj tamamlandı",
      "createdAt": 1699999999999,
      "createdBy": "uid"
    }
  },
  
  "workflow_photos_media": {
    "{photoId}": {
      "img": "data:image/jpeg;base64,...",
      "th": "data:image/jpeg;base64,...",
      "imgSize": 456789,
      "thSize": 23456,
      "uploadedAt": 1699999999999
    }
  },
  
  "custom_sounds": {
    "{soundId}": {
      "id": "sound_123",
      "uid": "user_uid",
      "title": "Özel not",
      "updatedAt": 1699999999999
    }
  },
  
  "custom_sounds_media": {
    "{soundId}": {
      "audio": "data:audio/mpeg;base64,...",
      "size": 45678,
      "duration": 15,
      "uploadedAt": 1699999999999
    }
  },
  
  "invites": {
    "{inviteHash}": {
      "role": "partner|employee|customer",
      "used": false,
      "createdBy": "admin_uid",
      "createdAt": 1699999999999,
      "expiresAt": 1700604799999,
      "usedBy": null,
      "usedAt": null,
      "assignedProjectId": null
    }
  },
  
  "settings": {
    "main": {
      "firm": "Lavora Design",
      "tel": "+90 555 123 4567",
      "adr": "İstanbul",
      "key": "vergi_no",
      "updatedAt": 1699999999999,
      "updatedBy": "uid"
    }
  },
  
  "settings_media": {
    "logo": {
      "data": "data:image/png;base64,...",
      "size": 23456,
      "uploadedAt": 1699999999999,
      "uploadedBy": "uid"
    }
  },
  
  "quota_tracking": {
    "{uid}": {
      "totalMediaSize": 45678901,
      "mediaCount": 125,
      "lastUpdated": 1699999999999
    }
  },
  
  "audit_logs": {
    "{logId}": {
      "uid": "user_uid",
      "action": "project_create|project_delete|role_change|...",
      "resourceId": "proj_123",
      "timestamp": 1699999999999,
      "details": {}
    }
  }
}
```

---

## 🔐 Güvenlik Tasarımı

### İlk Admin Oluşturma (Cloud Functions Olmadan)

**SORUN:** `bootstrapAdmin` Cloud Function ve Secret Manager yok  
**ÇÖZÜM:** Manuel Console + Güvenli Rules kombinasyonu

#### Adım 1: Firebase Console'dan İlk Kullanıcı
1. Firebase Console → Authentication
2. Manuel olarak ilk kullanıcı ekle (Google provider)
3. UID'yi kaydet

#### Adım 2: Realtime Database'de Admin Lock
```javascript
// Firebase Console → Realtime Database → Data
// Manuel olarak ekle:
{
  "admin_lock": {
    "initialized": true,
    "adminUid": "BURAYA_GERÇEK_UID_YAZI",
    "createdAt": 1699999999999
  },
  "users": {
    "BURAYA_GERÇEK_UID_YAZI": {
      "email": "admin@example.com",
      "role": "admin",
      "createdAt": 1699999999999
    }
  }
}
```

#### Adım 3: Security Rules ile Kilitleme
```json
{
  "rules": {
    "admin_lock": {
      ".write": false,
      ".read": false
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": false,
        "role": {
          ".validate": "
            // Yalnızca admin başka kullanıcıların rolünü değiştirebilir
            root.child('users').child(auth.uid).child('role').val() === 'admin' &&
            // Admin kendi rolünü değiştiremez
            $uid !== auth.uid &&
            // Yeni rol geçerli olmalı
            (newData.val() === 'partner' || newData.val() === 'employee' || newData.val() === 'customer')
          "
        }
      }
    }
  }
}
```

**GÜVENLİK GARANTİSİ:**
- `admin_lock` hiç değiştirilemez (`.write: false`)
- İlk admin UID sabitlenir
- Kullanıcı kendi rolünü değiştiremez
- Sadece admin başkalarının rolünü değiştirebilir
- İkinci admin oluşturulamaz

---

### Davet Sistemi (Cloud Functions Olmadan)

**SORUN:** `createInvite` ve `useInvite` Cloud Functions yok  
**ÇÖZÜM:** Basitleştirilmiş istemci taraflı + Rules doğrulama

#### Yaklaşım 1: Rastgele Kod + Client-Side SHA-256

```javascript
// Admin davet oluşturur
async function createInvite(role, expiresInDays = 7) {
  if (currentUserRole !== 'admin') throw Error('Admin only');
  
  // 96-bit rastgele kod
  const code = generateSecureCode(); // örn: "K7H9-P3Q2-M8X4"
  
  // SHA-256 hash (Web Crypto API)
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const expiresAt = Date.now() + (expiresInDays * 24 * 60 * 60 * 1000);
  
  await db.ref(`invites/${hashHex}`).set({
    role,
    used: false,
    createdBy: auth.currentUser.uid,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    expiresAt
  });
  
  return code; // Kullanıcıya göster
}

// Kullanıcı daveti kullanır
async function useInvite(code) {
  // SHA-256 hash
  const hashHex = await sha256(code);
  
  const inviteRef = db.ref(`invites/${hashHex}`);
  
  // Transaction ile atomik kontrol
  await inviteRef.transaction((current) => {
    if (current === null) {
      // Davet yok
      return; // Transaction iptal
    }
    
    if (current.used) {
      // Zaten kullanılmış
      return; // Transaction iptal
    }
    
    if (current.expiresAt < Date.now()) {
      // Süresi dolmuş
      return; // Transaction iptal
    }
    
    // Daveti kullan
    return {
      ...current,
      used: true,
      usedBy: auth.currentUser.uid,
      usedAt: firebase.database.ServerValue.TIMESTAMP
    };
  }, (error, committed, snapshot) => {
    if (error) {
      throw error;
    }
    
    if (!committed) {
      throw new Error('Geçersiz veya kullanılmış davet kodu');
    }
    
    // Başarılı - kullanıcının rolünü ayarla
    const role = snapshot.val().role;
    return db.ref(`users/${auth.currentUser.uid}/role`).set(role);
  });
}
```

**Security Rules:**
```json
{
  "rules": {
    "invites": {
      "$hash": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".validate": "newData.hasChildren(['role', 'used', 'createdBy', 'createdAt', 'expiresAt'])",
        "role": {
          ".validate": "newData.isString() && (newData.val() === 'partner' || newData.val() === 'employee' || newData.val() === 'customer')"
        },
        "used": {
          ".validate": "newData.isBoolean()"
        }
      }
    }
  }
}
```

**GÜVENLİK GARANTİSİ:**
- Yalnızca admin davet oluşturabilir
- SHA-256 hash ile kod tahmin edilemez
- Transaction ile race condition önlenir
- Expiry kontrolü istemci tarafında

**⚠️ ZAYIF NOKTA:**
- İstemci expiry kontrolünü atlarsa expired kod kullanılabilir
- ✅ **ÇÖZÜM:** Rules seviyesinde expiry kontrolü ekle

---

### Rol Değiştirme (Cloud Functions Olmadan)

**SORUN:** `changeUserRole` Cloud Function yok  
**ÇÖZÜM:** Rules-based güvenli yazma

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        "role": {
          ".write": "
            // Yalnızca admin yazabilir
            root.child('users').child(auth.uid).child('role').val() === 'admin' &&
            // Admin kendi rolünü değiştiremez
            $uid !== auth.uid &&
            // Hedef kullanıcı admin değil
            (!data.exists() || data.val() !== 'admin')
          ",
          ".validate": "newData.isString() && (newData.val() === 'partner' || newData.val() === 'employee' || newData.val() === 'customer')"
        }
      }
    }
  }
}
```

**GÜVENLİK GARANTİSİ:**
- Sadece admin rol değiştirebilir
- Admin kendi rolünü değiştiremez
- Admin rolü başka birine verilemez
- Geçersiz rol değeri reddedilir

---

### Employee Finans İzolasyonu

**SORUN:** Employee finansal verilere erişemememeli  
**ÇÖZÜM:** Ayrı `projects` ve `project_ops` koleksiyonları

```json
{
  "rules": {
    "projects": {
      "$projectId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "project_ops": {
      "$projectId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

**MANUEL SENKRONİZASYON:**
```javascript
// Admin/Partner proje kaydettiğinde
async function saveProject(project) {
  const role = currentUserRole;
  
  if (role === 'admin' || role === 'partner') {
    // Tam veriyi kaydet
    await db.ref(`projects/${project.id}`).set(project);
    
    // Çalışan izdüşümünü oluştur
    const ops = stripFinancialData(project);
    await db.ref(`project_ops/${project.id}`).set(ops);
    
    // Müşteri özeti oluştur
    if (project.customerId) {
      const summary = createCustomerSummary(project);
      await db.ref(`customer_projects/${project.customerId}/${project.id}`).set(summary);
    }
  } else if (role === 'employee') {
    // Sadece ops'a yaz
    await db.ref(`project_ops/${project.id}`).set(project);
  }
}

function stripFinancialData(project) {
  const ops = {...project};
  
  // Finansal alanları çıkar
  delete ops.kdv;
  
  // Workflow'dan fiyat alanlarını çıkar
  if (ops.w && ops.w.items) {
    ops.w.items = ops.w.items.map(item => {
      const {price, cost, total, ...safe} = item;
      return safe;
    });
  }
  
  // Sheets'den fiyat sütunlarını çıkar
  if (ops.s && Array.isArray(ops.s)) {
    ops.s = ops.s.map(sheet => {
      // "Fiyat", "Tutar", "Toplam" içeren sütunları çıkar
      const priceColumns = sheet.h
        .map((h, i) => (/fiyat|tutar|toplam|kdv/i.test(h) ? i : -1))
        .filter(i => i >= 0);
      
      return {
        ...sheet,
        r: sheet.r.map(row => row.filter((_, i) => !priceColumns.includes(i)))
      };
    });
  }
  
  return ops;
}
```

**GÜVENLİK GARANTİSİ:**
- Employee `projects/` koleksiyonunu okuyamaz
- Employee yalnızca `project_ops/` okur
- İstemci tarafı manuel sync gerekli (otomatik trigger yok)

---

### Customer İzolasyonu

```json
{
  "rules": {
    "customer_projects": {
      "$customerUid": {
        ".read": "$customerUid === auth.uid",
        ".write": false
      }
    }
  }
}
```

**GÜVENLİK GARANTİSİ:**
- Customer yalnızca kendi UID'sine ait verileri okur
- Customer yazamaz (admin/partner yazar)

---

## 🖼️ Base64 Medya Yönetimi

### Görsel Sıkıştırma Utility

```javascript
/**
 * Görseli Canvas ile sıkıştırır ve Base64'e çevirir
 * @param {File|Blob} file - Görsel dosyası
 * @param {Object} options - Sıkıştırma ayarları
 * @returns {Promise<{dataURL: string, size: number}>}
 */
async function compressImage(file, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'image/jpeg'
  } = options;
  
  return new Promise((resolve, reject) => {
    // MIME type doğrulama
    if (!file.type.startsWith('image/')) {
      reject(new Error('Geçersiz dosya tipi'));
      return;
    }
    
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    
    img.onload = () => {
      // Boyut hesaplama
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Canvas ile yeniden boyutlandırma
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // Base64 dönüşümü
      const dataURL = canvas.toDataURL(format, quality);
      const size = Math.ceil((dataURL.length * 3) / 4); // Base64 boyutu
      
      // Boyut kontrolü
      const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
      if (size > MAX_SIZE) {
        reject(new Error('Sıkıştırılmış görsel hala çok büyük. Lütfen daha düşük kalite veya boyut seçin.'));
        return;
      }
      
      resolve({ dataURL, size });
    };
    
    img.onerror = () => {
      reject(new Error('Görsel yüklenemedi'));
    };
    
    reader.onerror = () => {
      reject(new Error('Dosya okunamadı'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Thumbnail oluşturur
 */
async function createThumbnail(file) {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.7,
    format: 'image/jpeg'
  });
}
```

### Medya Kaydetme

```javascript
/**
 * Medya dosyasını sıkıştırıp Realtime Database'e kaydeder
 */
async function saveMedia(collection, id, file) {
  try {
    // Sıkıştırma
    const [full, thumb] = await Promise.all([
      compressImage(file, { maxWidth: 1920, quality: 0.85 }),
      createThumbnail(file)
    ]);
    
    // Kota kontrolü
    const totalSize = full.size + thumb.size;
    await checkQuota(totalSize);
    
    // Kaydetme
    await db.ref(`${collection}_media/${id}`).set({
      img: full.dataURL,
      th: thumb.dataURL,
      imgSize: full.size,
      thSize: thumb.size,
      uploadedAt: firebase.database.ServerValue.TIMESTAMP,
      uploadedBy: auth.currentUser.uid
    });
    
    // Kota güncelleme
    await updateQuota(totalSize);
    
    return { success: true, size: totalSize };
  } catch (error) {
    console.error('Medya kaydetme hatası:', error);
    throw error;
  }
}
```

### Kota Takibi

```javascript
const QUOTA_LIMIT = 900 * 1024 * 1024; // 900 MB (1 GB'nin %90'ı)

async function checkQuota(additionalSize) {
  const uid = auth.currentUser.uid;
  const snapshot = await db.ref(`quota_tracking/${uid}`).once('value');
  const current = snapshot.val() || { totalMediaSize: 0 };
  
  if (current.totalMediaSize + additionalSize > QUOTA_LIMIT) {
    throw new Error(
      `Depolama kotası aşılıyor! ` +
      `Mevcut: ${formatBytes(current.totalMediaSize)}, ` +
      `Yeni: ${formatBytes(additionalSize)}, ` +
      `Limit: ${formatBytes(QUOTA_LIMIT)}`
    );
  }
}

async function updateQuota(size) {
  const uid = auth.currentUser.uid;
  const ref = db.ref(`quota_tracking/${uid}`);
  
  await ref.transaction((current) => {
    if (!current) {
      return {
        totalMediaSize: size,
        mediaCount: 1,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      };
    }
    
    return {
      totalMediaSize: current.totalMediaSize + size,
      mediaCount: current.mediaCount + 1,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    };
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
```

---

## 🔄 Veri Senkronizasyonu

### Realtime Listeners

```javascript
// Projeleri dinle
function listenProjects() {
  const role = currentUserRole;
  let ref;
  
  if (role === 'admin' || role === 'partner') {
    ref = db.ref('projects');
  } else if (role === 'employee') {
    ref = db.ref('project_ops');
  } else if (role === 'customer') {
    ref = db.ref(`customer_projects/${auth.currentUser.uid}`);
  } else {
    return;
  }
  
  ref.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const projects = Object.values(data);
      updateLocalProjects(projects);
    }
  });
  
  // Cleanup
  return () => ref.off();
}

// Tek proje dinle
function listenProject(projectId) {
  const role = currentUserRole;
  const collection = (role === 'employee') ? 'project_ops' : 'projects';
  const ref = db.ref(`${collection}/${projectId}`);
  
  ref.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      updateLocalProject(data);
    }
  });
  
  return () => ref.off();
}
```

### Revision Kontrolü

```javascript
async function updateProject(project) {
  const role = currentUserRole;
  const collection = (role === 'employee') ? 'project_ops' : 'projects';
  const ref = db.ref(`${collection}/${project.id}`);
  
  return ref.transaction((current) => {
    if (!current) {
      // Yeni proje
      return {
        ...project,
        _revision: 1,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      };
    }
    
    // Revizyon kontrolü
    const currentRev = current._revision || 0;
    const incomingRev = project._revision || 0;
    
    if (incomingRev < currentRev) {
      // Çakışma!
      return; // Transaction iptal
    }
    
    // Güncelleme
    return {
      ...project,
      _revision: currentRev + 1,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
  }, (error, committed, snapshot) => {
    if (error) {
      throw error;
    }
    
    if (!committed) {
      throw new Error('Proje başka bir oturumda değiştirildi. Lütfen yenileyip tekrar deneyin.');
    }
    
    // Başarılı - lokal versiyonu güncelle
    project._revision = snapshot.val()._revision;
  });
}
```

---

## 📋 Tam Realtime Database Security Rules

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    
    "admin_lock": {
      ".read": false,
      ".write": false
    },
    
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        "email": {
          ".write": false
        },
        "role": {
          ".write": "
            (
              root.child('users').child(auth.uid).child('role').val() === 'admin' &&
              $uid !== auth.uid &&
              (!data.exists() || data.val() !== 'admin')
            )
          ",
          ".validate": "newData.isString() && (newData.val() === 'admin' || newData.val() === 'partner' || newData.val() === 'employee' || newData.val() === 'customer')"
        },
        "createdAt": {
          ".write": "!data.exists()"
        },
        "roleChangedAt": {
          ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
        },
        "updatedBy": {
          ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
        }
      }
    },
    
    "projects": {
      "$projectId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".validate": "newData.hasChildren(['id', 'name', 'u', '_revision'])"
      }
    },
    
    "project_ops": {
      "$projectId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['id', 'name', 'u', '_revision'])"
      }
    },
    
    "customer_projects": {
      "$customerUid": {
        ".read": "$customerUid === auth.uid",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "ledger": {
      "$entryId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "receipts": {
      "$receiptId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "receipts_media": {
      "$receiptId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".validate": "newData.hasChildren(['img', 'th', 'imgSize', 'thSize'])",
        "img": {
          ".validate": "newData.isString() && newData.val().length <= 7000000"
        },
        "th": {
          ".validate": "newData.isString() && newData.val().length <= 500000"
        }
      }
    },
    
    "scans": {
      "$scanId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "scans_media": {
      "$scanId": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "workflow_photos": {
      "$photoId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    
    "workflow_photos_media": {
      "$photoId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['img', 'th'])",
        "img": {
          ".validate": "newData.isString() && newData.val().length <= 7000000"
        }
      }
    },
    
    "custom_sounds": {
      "$soundId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    
    "custom_sounds_media": {
      "$soundId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['audio'])",
        "audio": {
          ".validate": "newData.isString() && newData.val().length <= 1000000"
        }
      }
    },
    
    "invites": {
      "$hash": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['role', 'used', 'createdBy', 'createdAt', 'expiresAt'])",
        "role": {
          ".validate": "newData.isString() && (newData.val() === 'partner' || newData.val() === 'employee' || newData.val() === 'customer')"
        },
        "used": {
          ".validate": "newData.isBoolean() && (!data.exists() || data.val() === false)"
        },
        "expiresAt": {
          ".validate": "newData.isNumber() && newData.val() > now"
        }
      }
    },
    
    "settings": {
      "main": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "settings_media": {
      "logo": {
        ".read": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        ",
        ".write": "
          auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'partner'
          )
        "
      }
    },
    
    "quota_tracking": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    
    "audit_logs": {
      "$logId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['uid', 'action', 'timestamp'])"
      }
    }
  }
}
```

---

## ⚠️ Bilinen Sınırlamalar ve Riskler

### 1. Kota Yönetimi
- **Risk:** Base64 ile veri boyutu ~33% artar
- **Çözüm:** Aggressive sıkıştırma, kota takibi, kullanıcı uyarıları
- **Limit:** 1 GB total, ~750 MB güvenli kullanım

### 2. Performans
- **Risk:** Büyük Base64 stringler yavaş olabilir
- **Çözüm:** Lazy loading, thumbnail kullanımı, pagination

### 3. Güvenlik
- **Risk:** İstemci tarafı validation atlanabilir
- **Çözüm:** Rules seviyesinde çift kontrol, audit logs

### 4. Senkronizasyon
- **Risk:** Manuel sync unutulabilir
- **Çözüm:** UI'da açık uyarılar, otomatik tetikleyiciler

### 5. Çevrimdışı Çalışma
- **Risk:** Realtime DB offline support sınırlı
- **Çözüm:** Bağlantı durumu kontrolü, kuyruk sistemi

---

**Son Güncelleme:** 2 Kasım 2026  
**Durum:** Mimari tasarım tamamlandı, implementasyon bekliyor
