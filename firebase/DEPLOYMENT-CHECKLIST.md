# 🚀 Lavora Firebase Dağıtım Kontrol Listesi

## 📦 Proje Bilgileri

- **Proje ID:** designwood
- **Proje Numarası:** 1081401100728
- **Bootstrap Secret:** `vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV` (güvenli yerde sakla!)
- **Firebase Config:**
```json
{
  "apiKey": "AIzaSyBzNQGUVn-1-kGdZVFTdu9Mkor2w0NM6AU",
  "authDomain": "designwood.firebaseapp.com",
  "databaseURL": "https://designwood-default-rtdb.firebaseio.com",
  "projectId": "designwood",
  "storageBucket": "designwood.firebasestorage.app",
  "messagingSenderId": "1081401100728",
  "appId": "1:1081401100728:web:8a3d35290dbe1f279f274d",
  "measurementId": "G-Z6XH2W7YM0"
}
```

---

## ✅ 1. Firebase Console Yapılandırması

### 1.1 Blaze Planına Geç
- [ ] https://console.firebase.google.com/project/designwood/usage/details adresine git
- [ ] "Upgrade to Blaze" butonuna tıkla
- [ ] Kredi kartı bilgilerini gir
- [ ] Bütçe uyarısı ayarla (örn: $10/ay)

⚠️ **Önemli:** Blaze planı olmadan Cloud Functions ve Secret Manager çalışmaz!

---

### 1.2 Authentication Yapılandır
- [ ] https://console.firebase.google.com/project/designwood/authentication/providers adresine git
- [ ] "Get Started" butonuna tıkla (ilk kez açıyorsan)
- [ ] "Google" provider'ını bul ve tıkla
- [ ] "Enable" toggle'ını aç
- [ ] "Project support email" seç
- [ ] "Save" butonuna tıkla

**Authorized Domains:**
- [ ] "Settings" sekmesine git
- [ ] "Authorized domains" bölümünü bul
- [ ] Production domain'ini ekle (örn: `lavora.designwood.com`)
- [ ] Geliştirme için `localhost` zaten ekli olmalı

---

### 1.3 Firestore Database Oluştur
- [x] https://console.firebase.google.com/project/designwood/firestore adresine git
- [x] ✅ Database zaten oluşturulmuş (Rules dağıtımı sırasında otomatik yapıldı)

**Veritabanı Ayarları:**
- **Mode:** Production (Security Rules aktif)
- **Location:** Değiştirilemez (Rules dağıtımında otomatik seçildi)

---

### 1.4 Storage Başlat
- [ ] https://console.firebase.google.com/project/designwood/storage adresine git
- [ ] "Get Started" butonuna tıkla
- [ ] "Production mode" seç (Rules'u kod ile dağıtacağız)
- [ ] Location seç (Firestore ile aynı bölge önerilir)
- [ ] "Done" butonuna tıkla

---

## 🔐 2. Secret Manager Yapılandırması

### 2.1 Bootstrap Secret'ı Kaydet

Terminalde şunu çalıştır:

```powershell
cd c:\lavorasync\firebase
npx firebase functions:secrets:set LAVORA_BOOTSTRAP_SECRET
```

Sorulduğunda gir: `vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV`

**✅ Kontrol:**
```powershell
npx firebase functions:secrets:access LAVORA_BOOTSTRAP_SECRET
```

---

## 📤 3. Firebase Dağıtımı

### 3.1 Firestore Rules (Tamamlandı)
- [x] ✅ Dağıtıldı

Gerekirse tekrar dağıt:
```powershell
cd c:\lavorasync\firebase
npx firebase deploy --only firestore:rules
```

---

### 3.2 Storage Rules
- [ ] Storage başlatıldıktan sonra çalıştır:

```powershell
cd c:\lavorasync\firebase
npx firebase deploy --only storage
```

**Beklenen Çıktı:**
```
✓ storage: released rules storage.rules to firebase.storage/...
✓ Deploy complete!
```

---

### 3.3 Cloud Functions
- [ ] Blaze planına geçtikten ve secret'ı kaydettikten sonra çalıştır:

```powershell
cd c:\lavorasync\firebase
npx firebase deploy --only functions
```

**Dağıtılacak Functions:**
- `bootstrapAdmin` - İlk admin kurulumu
- `createInvite` - Davet kodu oluşturma
- `useInvite` - Davet kodunu kullanma
- `changeUserRole` - Rol değiştirme
- `syncCustomerProject` - Müşteri proje özeti senkronizasyonu
- `syncEmployeeProjection` - Çalışan izdüşümü senkronizasyonu

**Beklenen Çıktı:**
```
✓ functions[...]: Successful create operation.
✓ Deploy complete!
```

**✅ Kontrol:**
```powershell
npx firebase functions:list
```

---

## 🌐 4. HTML Uygulaması Yapılandırması

### 4.1 Firebase Config'i HTML'e Gir
- [ ] `lavora-calisma-masasi-v38-firebase.html` dosyasını HTTPS üzerinden aç
- [ ] İlk ekrandaki Firebase config alanına yukarıdaki JSON'u yapıştır
- [ ] "Kaydet" butonuna tıkla
- [ ] Config localStorage'a kaydedilir

---

### 4.2 İlk Admin Hesabı Oluştur
- [ ] Google hesabınla giriş yap
- [ ] "İlk Yönetici Oluştur" ekranı açılır
- [ ] Bootstrap secret gir: `vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV`
- [ ] "Oluştur" butonuna tıkla
- [ ] ✅ "İlk yönetici başarıyla oluşturuldu" mesajı görülmeli

**⚠️ Önemli:**
- Bu işlem yalnızca bir kez çalışır
- İkinci denemede "Yönetici zaten mevcut" hatası alınır
- Secret'ı kaybedersen Firebase Console'dan manuel müdahale gerekir

---

## 🧪 5. Temel İşlevsellik Testi

### 5.1 Admin Paneli
- [ ] "Kullanıcı Yönetimi" butonu görünüyor
- [ ] "Davet Oluştur" çalışıyor
- [ ] Üretilen davet kodu 12 karakter
- [ ] Kod panoda kopyalanabiliyor

### 5.2 Partner Daveti
- [ ] Partner daveti oluştur
- [ ] Başka bir Google hesabıyla giriş yap
- [ ] Davet kodunu kullan
- [ ] Kullanıcı listesinde partner rolü görünüyor
- [ ] Partner hesabıyla projeler, finans görülebiliyor
- [ ] Partner "Kullanıcı Yönetimi" butonunu görmüyor

### 5.3 Employee Daveti
- [ ] Employee daveti oluştur
- [ ] Davet kodunu kullan
- [ ] Employee finans menülerini göremiyor
- [ ] Employee iş akışı operasyonlarını yapabiliyor

### 5.4 Customer Daveti
- [ ] Customer daveti oluştur
- [ ] Davet kodunu kullan
- [ ] Admin/partner ile proje oluştur
- [ ] Projeyi customer UID'sine ata
- [ ] Customer yalnızca kendi projesini görüyor

---

## 🔍 6. Güvenlik Doğrulama

### 6.1 Firestore Rules Testi
Browser DevTools Console'da test et:

```javascript
// Admin/Partner ile:
await firebase.firestore().collection('projects').get(); // ✅ Başarılı

// Employee ile:
await firebase.firestore().collection('projects').get(); // ❌ permission-denied
await firebase.firestore().collection('project_ops').get(); // ✅ Başarılı

// Customer ile:
await firebase.firestore().collection('customer_projects').doc(uid).get(); // ✅ Kendi belgesi
await firebase.firestore().collection('projects').get(); // ❌ permission-denied
```

### 6.2 Storage Rules Testi
```javascript
// Admin/Partner ile:
await firebase.storage().ref('receipts/test.jpg').getDownloadURL(); // ✅ Başarılı

// Employee ile:
await firebase.storage().ref('receipts/test.jpg').getDownloadURL(); // ❌ permission-denied
await firebase.storage().ref('workflow_photos/test.jpg').getDownloadURL(); // ✅ Başarılı
```

### 6.3 Functions Güvenlik Testi
```javascript
// Partner ile rol değiştirme denemesi:
const changeFn = firebase.functions().httpsCallable('changeUserRole');
await changeFn({ targetUid: 'someUid', newRole: 'customer' }); // ❌ permission-denied
```

---

## 📊 7. Performans ve Maliyet Kontrolü

### 7.1 Firestore Kullanım İzleme
- [ ] https://console.firebase.google.com/project/designwood/firestore/usage adresine git
- [ ] Günlük okuma/yazma sayılarını kontrol et
- [ ] Ücretsiz kotayı aşıyor mu?

**Ücretsiz Kota:**
- 50,000 okuma/gün
- 20,000 yazma/gün
- 20,000 silme/gün
- 1 GB depolama

### 7.2 Storage Kullanım İzleme
- [ ] https://console.firebase.google.com/project/designwood/storage/usage adresine git
- [ ] Toplam depolama boyutunu kontrol et
- [ ] İndirme trafiğini kontrol et

**Ücretsiz Kota:**
- 5 GB depolama
- 1 GB indirme/gün

### 7.3 Functions Kullanım İzleme
- [ ] https://console.firebase.google.com/project/designwood/functions/usage adresine git
- [ ] Çağrı sayılarını kontrol et
- [ ] Hata oranlarını kontrol et

**Ücretsiz Kota:**
- 125,000 çağrı/ay
- 40,000 GB-saniye/ay
- 200,000 CPU-saniye/ay

---

## 🎯 8. Üretim Hazırlığı

### 8.1 Domain Ayarları
- [ ] Production domain DNS ayarlandı
- [ ] SSL sertifikası aktif
- [ ] Firebase Hosting kullanılacaksa dağıtıldı

### 8.2 Yedekleme Stratejisi
- [ ] Firestore Export işlemi test edildi
- [ ] Storage bucket backup'ı ayarlandı
- [ ] Uygulama içi yedekleme/geri yükleme test edildi

### 8.3 İzleme ve Alarm
- [ ] Firebase Console'da bütçe uyarısı ayarlandı
- [ ] Cloud Monitoring aktif
- [ ] Hata bildirim e-postaları aktif

---

## ✔️ Final Checklist

Üretim ortamına almadan önce kontrol et:

- [ ] Tüm Firebase servisleri aktif
- [ ] Blaze planı aktif ve bütçe limiti ayarlı
- [ ] Firestore, Storage, Functions dağıtıldı
- [ ] Bootstrap secret kaydedildi ve saklandı
- [ ] İlk admin hesabı oluşturuldu
- [ ] Temel güvenlik testleri başarılı
- [ ] En az 1 admin, 1 partner, 1 employee, 1 customer hesabı test edildi
- [ ] Dosya yükleme/indirme test edildi
- [ ] Yedekleme/geri yükleme test edildi
- [ ] Production domain yapılandırıldı
- [ ] SSL sertifikası aktif
- [ ] Kullanıcı dokümantasyonu hazır
- [ ] `SECURITY-TESTS.md` tüm testleri tamamlandı

---

## 🚨 Sorun Giderme

### "PERMISSION_DENIED: Missing or insufficient permissions"
1. Rules doğru dağıtıldı mı? `npx firebase deploy --only firestore:rules`
2. Kullanıcının `users/{uid}` belgesi var mı?
3. Rol bilgisi doğru mu? Firestore Console'dan kontrol et

### "Function failed on loading user code"
1. Node modülleri kurulu mu? `npm --prefix functions install`
2. Functions syntax hatası var mı? `npm --prefix functions run lint`
3. Secret doğru ayarlandı mı? `npx firebase functions:secrets:access LAVORA_BOOTSTRAP_SECRET`

### "Storage object does not exist"
1. Storage başlatıldı mı?
2. Storage rules dağıtıldı mı?
3. Dosya yükleme başarılı oldu mu? Console loglarını kontrol et

---

## 📞 Destek

- Firebase Dokümantasyon: https://firebase.google.com/docs
- Stack Overflow: https://stackoverflow.com/questions/tagged/firebase
- Firebase Support: https://firebase.google.com/support

---

**Hazırlayan:** Kiro AI Assistant  
**Tarih:** 2 Kasım 2026  
**Versiyon:** 1.0
