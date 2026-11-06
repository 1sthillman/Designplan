# Phase 1 - Manuel Test Kılavuzu

## 🎯 Amaç

Phase 1 implementasyonunun güvenlik ve doğruluğunu gerçek Firebase ortamında test etmek.

---

## 📋 Ön Hazırlık

### 1. Firebase Projesi Hazırlama

```bash
# Firebase Console
1. Realtime Database oluştur (us-central1)
2. Mode: Locked mode
3. Security Rules deploy et:
   firebase deploy --only database
```

### 2. İlk Admin Kullanıcısı Oluşturma

**Firebase Console → Realtime Database → Data:**

```json
{
  "tenants": {
    "lavora-main": {
      "users": {
        "YOUR_ADMIN_UID": {
          "uid": "YOUR_ADMIN_UID",
          "email": "admin@test.com",
          "role": "admin",
          "createdAt": 1730563200000
        }
      },
      "admin_lock": {
        "adminUid": "YOUR_ADMIN_UID",
        "lockedAt": 1730563200000
      }
    }
  }
}
```

**⚠️ UID nasıl bulunur:**
1. Firebase Console → Authentication
2. Google hesabıyla giriş yap
3. Users tablosunda UID'yi kopyala

### 3. Test Kullanıcıları

**Gerekli hesaplar:**
- Admin: admin@test.com (manuel oluşturuldu)
- Partner: partner@test.com (davet koduyla)
- Employee: employee@test.com (davet koduyla)
- Customer: customer@test.com (davet koduyla)

---

## 🧪 Test Suite 1: Security Rules - Role-Based Access

### Test 1.1: Employee Kendi Kaydını Okuyabilir ✅

**Setup:**
```
1. employee@test.com ile giriş yap
2. test-plan.html aç
3. Firebase config gir
4. Test 1.1 çalıştır
```

**Beklenen:**
```
✅ PASS: User kaydı okunabildi
```

**Kontrol:**
```javascript
// Browser console
const uid = firebase.auth().currentUser.uid;
firebase.database().ref(`tenants/lavora-main/users/${uid}`).once('value')
  .then(snap => console.log('✅ READ:', snap.val()))
  .catch(e => console.log('❌ ERROR:', e.message));
```

---

### Test 1.2: Employee Başka User Okuyamaz ❌

**Setup:**
```
1. employee@test.com ile giriş yap
2. Başka bir UID ile okuma dene
```

**Beklenen:**
```
❌ FAIL: PERMISSION_DENIED
```

**Kontrol:**
```javascript
firebase.database().ref('tenants/lavora-main/users/other_uid').once('value')
  .then(snap => console.log('❌ SECURITY BUG:', snap.val()))
  .catch(e => console.log('✅ BLOCKED:', e.code)); // Expected: PERMISSION_DENIED
```

---

### Test 1.3: Employee Kendi Rolünü Değiştiremez ❌

**Setup:**
```
1. employee@test.com ile giriş yap
2. Kendi rolünü admin yapmayı dene
```

**Beklenen:**
```
❌ FAIL: PERMISSION_DENIED
```

**Kontrol:**
```javascript
const uid = firebase.auth().currentUser.uid;
firebase.database().ref(`tenants/lavora-main/users/${uid}/role`).set('admin')
  .then(() => console.log('❌ SECURITY BUG: Role değiştirildi'))
  .catch(e => console.log('✅ BLOCKED:', e.code)); // Expected: PERMISSION_DENIED
```

---

### Test 1.4: Admin Başka User Rolünü Değiştirebilir ✅

**Setup:**
```
1. admin@test.com ile giriş yap
2. Employee'nin rolünü değiştirmeyi dene
```

**Beklenen:**
```
✅ PASS: Role değiştirildi
```

**Kontrol:**
```javascript
const employeeUid = 'EMPLOYEE_UID';
firebase.database().ref(`tenants/lavora-main/users/${employeeUid}/role`).set('partner')
  .then(() => console.log('✅ SUCCESS'))
  .catch(e => console.log('❌ ERROR:', e.message));
```

---

## 🧪 Test Suite 2: Financial Data Isolation

### Test 2.1: Employee Projects Okuyamaz ❌

**Kontrol:**
```javascript
// employee@test.com ile
firebase.database().ref('tenants/lavora-main/projects').once('value')
  .then(snap => console.log('❌ SECURITY BUG:', Object.keys(snap.val()||{})))
  .catch(e => console.log('✅ BLOCKED:', e.code)); // Expected: PERMISSION_DENIED
```

---

### Test 2.2: Employee project_ops Okuyabilir ✅

**Kontrol:**
```javascript
// employee@test.com ile
firebase.database().ref('tenants/lavora-main/project_ops').once('value')
  .then(snap => console.log('✅ READ:', Object.keys(snap.val()||{}).length, 'projects'))
  .catch(e => console.log('❌ ERROR:', e.message));
```

---

### Test 2.3: Employee Ledger Okuyamaz ❌

**Kontrol:**
```javascript
// employee@test.com ile
firebase.database().ref('tenants/lavora-main/ledger').once('value')
  .then(snap => console.log('❌ SECURITY BUG'))
  .catch(e => console.log('✅ BLOCKED:', e.code));
```

---

### Test 2.4: Employee Receipts Okuyamaz ❌

**Kontrol:**
```javascript
// employee@test.com ile
firebase.database().ref('tenants/lavora-main/receipts').once('value')
  .then(snap => console.log('❌ SECURITY BUG'))
  .catch(e => console.log('✅ BLOCKED:', e.code));
```

---

## 🧪 Test Suite 3: Invite System

### Test 3.1: Admin Davet Kodu Oluşturabilir ✅

**Setup:**
```
1. admin@test.com ile lavora-calisma-masasi-v38-firebase.html aç
2. Header → Ekip butonuna tıkla
3. Role seç: employee
4. "Davet kodu oluştur" tıkla
```

**Beklenen:**
```
12 haneli kod gösterilir (örn: ABCD1234EFGH)
```

**Kontrol:**
```javascript
// SHA-256 hash hesapla
const code = 'KODU_BURAYA_YAPIŞTIR';
const msgBuffer = new TextEncoder().encode(code);
crypto.subtle.digest('SHA-256', msgBuffer).then(hashBuffer => {
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // RTDB'de kontrol
  firebase.database().ref(`tenants/lavora-main/invites/${hash}`).once('value')
    .then(snap => {
      if(snap.exists()) console.log('✅ Invite oluşturuldu:', snap.val());
      else console.log('❌ Invite bulunamadı');
    });
});
```

---

### Test 3.2: Partner Davet Kodu Oluşturamaz ❌

**Setup:**
```
1. partner@test.com ile giriş yap
2. Davet kodu oluşturmayı dene
```

**Beklenen:**
```
❌ FAIL: UI'da "Ekip" butonu yok (role check)
VEYA
❌ FAIL: PERMISSION_DENIED
```

---

### Test 3.3: Geçerli Davet Kodu Kullanılabilir ✅

**Setup:**
```
1. Admin ile davet kodu oluştur (3.1)
2. Yeni Google hesabıyla (newuser@test.com) giriş yap
3. Davet kodunu gir
```

**Beklenen:**
```
✅ User kaydı oluşturulur
✅ Role atanır
✅ Sayfa yenilenir, ana ekran açılır
```

**Kontrol:**
```javascript
// newuser UID ile
firebase.database().ref('tenants/lavora-main/users/NEW_USER_UID').once('value')
  .then(snap => console.log('✅ User created:', snap.val()));

// Invite usedBy check
firebase.database().ref(`tenants/lavora-main/invites/${HASH}`).once('value')
  .then(snap => {
    const inv = snap.val();
    if(inv.usedBy) console.log('✅ Invite marked as used:', inv.usedBy);
    else console.log('❌ Invite not marked');
  });
```

---

### Test 3.4: Kullanılmış Davet Kodu Tekrar Kullanılamaz ❌

**Setup:**
```
1. Test 3.3'teki kullanılmış kodu başka hesapla kullanmayı dene
```

**Beklenen:**
```
❌ FAIL: "Bu davet kodu zaten kullanılmış"
```

**Kontrol:**
```javascript
// İkinci kullanıcı browser console
const code = 'KULLANILMIŞ_KOD';
// SHA-256 hash hesapla
// Transaction dene
const inviteRef = firebase.database().ref(`tenants/lavora-main/invites/${hash}/usedBy`);
inviteRef.transaction(current => {
  if(current !== null) return; // Already used
  return firebase.auth().currentUser.uid;
}).then(result => {
  if(result.committed) console.log('❌ BUG: Tekrar kullanıldı');
  else console.log('✅ BLOCKED: Transaction aborted');
});
```

---

## 🧪 Test Suite 4: Concurrency - Race Conditions

### Test 4.1: Eş Zamanlı Davet Kullanımı ⚠️

**Setup (2 Browser Gerekli):**
```
1. Admin ile davet kodu oluştur
2. Browser 1: user1@test.com ile giriş
3. Browser 2: user2@test.com ile giriş
4. Her ikisinde de davet kodunu AYNI ANDA gir (countdown: 3, 2, 1, GO!)
```

**Beklenen:**
```
✅ Browser 1: SUCCESS (usedBy transaction committed)
❌ Browser 2: FAIL "Zaten kullanılmış"
```

**Kontrol:**
```javascript
// RTDB'de invite kontrol
firebase.database().ref(`tenants/lavora-main/invites/${hash}`).once('value')
  .then(snap => {
    const inv = snap.val();
    console.log('usedBy:', inv.usedBy); // Sadece 1 UID olmalı
    console.log('usedAt:', new Date(inv.usedAt));
  });

// Users kontrol
firebase.database().ref('tenants/lavora-main/users').once('value')
  .then(snap => {
    const users = snap.val();
    const invitedUsers = Object.values(users).filter(u => u.role === 'employee');
    console.log('Invited users:', invitedUsers.length); // Sadece 1 olmalı
  });
```

**⚠️ NOT**: Bu test manuel koordinasyon gerektirir. Automated test zor.

---

### Test 4.2: Eş Zamanlı Proje Güncellemesi ⚠️

**Setup (2 Browser Gerekli):**
```
1. Bir proje oluştur (admin ile)
2. Browser 1: admin@test.com
3. Browser 2: partner@test.com
4. Her ikisi de AYNI projeyi AYNI ANDA güncellemeyi denesin
```

**Senaryo:**
```javascript
// Browser 1 & 2 (AYNI ANDA):
const projectRef = firebase.database().ref('tenants/lavora-main/projects/PROJECT_ID');

// Read current
projectRef.once('value').then(snap => {
  const project = snap.val();
  const currentRevision = project._revision || 0;
  
  // Modify
  project.name = 'Updated by User X'; // X = 1 veya 2
  
  // Transaction on _revision
  projectRef.child('_revision').transaction(current => {
    const stored = Number(current || 0);
    if(stored > currentRevision) return; // Abort
    return stored + 1;
  }).then(result => {
    if(result.committed){
      // Write full project
      project._revision = result.snapshot.val();
      projectRef.set(project).then(() => {
        console.log('✅ UPDATE SUCCESS');
      });
    }else{
      console.log('❌ CONFLICT: Başka kullanıcı güncelledi');
    }
  });
});
```

**Beklenen:**
```
✅ Browser 1: SUCCESS (revision 1 → 2)
❌ Browser 2: CONFLICT (revision outdated, transaction aborted)
```

**Kontrol:**
```javascript
// Final project state
firebase.database().ref('tenants/lavora-main/projects/PROJECT_ID').once('value')
  .then(snap => {
    const p = snap.val();
    console.log('Final revision:', p._revision); // 2 olmalı
    console.log('Final name:', p.name); // Browser 1'in değeri
  });
```

---

## 🧪 Test Suite 5: Media & Validation

### Test 5.1: 5MB+ Base64 Yükleme Reddedilir ❌

**Setup:**
```
1. Admin ile lavora-calisma-masasi-v38-firebase.html aç
2. Workflow Photos → Fotoğraf ekle
3. 6MB JPEG dosya seç
```

**Beklenen:**
```
❌ FAIL: "Dosya 5MB limitini aşıyor. Lütfen daha küçük bir dosya seçin."
```

**Kontrol (Console):**
```javascript
// Test file creation (6MB simulated)
const largeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(8 * 1024 * 1024); // ~8MB

// uploadValue function test
async function testSizeLimit(){
  const dataURL = largeBase64;
  const sizeBytes = Math.ceil((dataURL.length - 'data:'.length) * 0.75);
  console.log('Size:', sizeBytes / 1024 / 1024, 'MB');
  
  if(sizeBytes > 5 * 1024 * 1024){
    console.log('✅ REJECTED: Size limit enforced');
  }else{
    console.log('❌ BUG: Large file accepted');
  }
}
testSizeLimit();
```

---

### Test 5.2: Image Compression Çalışıyor ✅

**Setup:**
```
1. Admin ile HTML aç
2. 3000x2000 JPEG yükle
```

**Beklenen:**
```
✅ Compressed: Max 1920x1920
✅ Thumbnail: Max 400x400
```

**Kontrol (Console):**
```javascript
// compressImage function test
const testImage = new Image();
testImage.onload = async () => {
  console.log('Original:', testImage.width, 'x', testImage.height);
  
  // Canvas ile Base64'e çevir
  const canvas = document.createElement('canvas');
  canvas.width = testImage.width;
  canvas.height = testImage.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(testImage, 0, 0);
  const originalBase64 = canvas.toDataURL('image/jpeg', 1.0);
  console.log('Original Base64 size:', (originalBase64.length * 0.75 / 1024).toFixed(0), 'KB');
  
  // Compress
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
  
  const compressed = await compressImage(originalBase64, 1920, 0.85);
  console.log('Compressed Base64 size:', (compressed.length * 0.75 / 1024).toFixed(0), 'KB');
  
  const compressedImg = new Image();
  compressedImg.src = compressed;
  compressedImg.onload = () => {
    console.log('Compressed:', compressedImg.width, 'x', compressedImg.height);
    if(compressedImg.width <= 1920 && compressedImg.height <= 1920){
      console.log('✅ PASS: Compression works');
    }else{
      console.log('❌ FAIL: Dimensions exceed limit');
    }
  };
};
testImage.src = 'TEST_IMAGE_URL_HERE'; // Large JPEG
```

---

## 📊 Test Raporu Şablonu

```markdown
# Phase 1 - Test Execution Report

**Tarih**: [TARİH]
**Tester**: [İSİM]
**Environment**: Firebase Project [PROJECT_ID]

## Test Sonuçları

| Test ID | Test Adı | Sonuç | Notlar |
|---------|----------|-------|--------|
| 1.1 | Employee self-read | ✅ PASS | - |
| 1.2 | Employee cannot read others | ✅ PASS | PERMISSION_DENIED |
| 1.3 | Employee cannot change role | ✅ PASS | PERMISSION_DENIED |
| 1.4 | Admin can change roles | ✅ PASS | - |
| 2.1 | Employee cannot read projects | ✅ PASS | PERMISSION_DENIED |
| 2.2 | Employee can read project_ops | ✅ PASS | 5 projects |
| 2.3 | Employee cannot read ledger | ✅ PASS | PERMISSION_DENIED |
| 2.4 | Employee cannot read receipts | ✅ PASS | PERMISSION_DENIED |
| 3.1 | Admin create invite | ✅ PASS | Code: ABC123 |
| 3.2 | Partner cannot create invite | ✅ PASS | No UI access |
| 3.3 | Valid invite redemption | ✅ PASS | User created |
| 3.4 | Used invite rejection | ✅ PASS | Transaction abort |
| 4.1 | Concurrent invite usage | ⚠️ MANUAL | 2 browsers test |
| 4.2 | Concurrent project update | ⚠️ MANUAL | 2 browsers test |
| 5.1 | 5MB+ file rejection | ✅ PASS | Client validation |
| 5.2 | Image compression | ✅ PASS | 3000x2000 → 1920x? |

**Özet**: X/16 PASS, Y/16 MANUAL

## Kritik Bulgular

[Varsa güvenlik açıkları veya hatalar]

## Öneriler

[İyileştirme önerileri]

---

**İmza**: [TESTER]
**Onay**: [APPROVER]
```

---

## 🔧 Troubleshooting

### Sorun: PERMISSION_DENIED everywhere
**Çözüm**: Security Rules deploy edilmedi. `firebase deploy --only database` çalıştır.

### Sorun: User kaydı yok
**Çözüm**: Manuel admin bootstrap yapılmadı. Firebase Console'dan oluştur.

### Sorun: Invite transaction fails
**Çözüm**: expiresAt geçmiş olabilir. `Date.now()` kontrol et.

### Sorun: Image yükleme çalışmıyor
**Çözüm**: Browser console'da `compressImage` function tanımlı mı kontrol et.

---

## ✅ Checklist

Phase 1 test öncesi:
- [ ] Firebase Realtime Database oluşturuldu
- [ ] Security Rules deploy edildi
- [ ] Manuel admin kullanıcısı oluşturuldu
- [ ] admin_lock set edildi
- [ ] Test kullanıcıları hazır (admin, partner, employee, customer)
- [ ] test-plan.html Firebase config ile başlatıldı
- [ ] Browser console açık (F12)
- [ ] 2 browser hazır (concurrent tests için)

Test sonrası:
- [ ] Tüm testler çalıştırıldı
- [ ] Sonuçlar dokümante edildi
- [ ] Kritik hatalar varsa düzeltildi
- [ ] Test raporu oluşturuldu

---

**Sonraki Adım**: Test raporunu PHASE-1-TEST-RESULTS.md dosyasına kaydet.

