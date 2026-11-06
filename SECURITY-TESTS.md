# 🛡️ Lavora Firebase Güvenlik ve Dağıtım Test Planı

## 📋 Durum Özeti

✅ **Tamamlanan:**
- Firebase CLI kuruldu
- Firebase proje yapısı oluşturuldu
- Firestore Security Rules yazıldı ve dağıtıldı
- Storage Security Rules yazıldı (dağıtım bekliyor)
- Cloud Functions yazıldı (dağıtım bekliyor)
- Bootstrap secret oluşturuldu: `vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV`
- Firebase projesi: `designwood` (Project ID: designwood)

⚠️ **Bekleyen Manuel Adımlar:**

1. **Firebase Console'dan Blaze planına yükselt:**
   - URL: https://console.firebase.google.com/project/designwood/usage/details
   - Cloud Functions ve Secret Manager için gerekli

2. **Firebase Console'dan Storage'ı başlat:**
   - URL: https://console.firebase.google.com/project/designwood/storage
   - "Get Started" butonuna tıkla

3. **Firebase Console'dan Authentication'ı yapılandır:**
   - URL: https://console.firebase.google.com/project/designwood/authentication
   - Google Sign-in provider'ı etkinleştir
   - Authorized domains'e deployment domain'ini ekle

4. **Dağıtım tamamlanması:**
   ```bash
   cd c:\lavorasync\firebase
   
   # Secret'ı kaydet (manuel - interactive)
   npx firebase functions:secrets:set LAVORA_BOOTSTRAP_SECRET
   # Secret: vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV
   
   # Storage ve Functions'ı dağıt
   npx firebase deploy --only storage,functions
   ```

---

## 🧪 Güvenlik Testleri (Dağıtım Sonrası)

### Test 1: İlk Admin Kurulumu
**Hedef:** Yalnızca bir admin hesabı oluşturulabilmeli

**Adımlar:**
1. HTML'i aç ve Firebase config'i gir
2. Google hesabı 1 ile giriş yap
3. Bootstrap secret'ı gir: `vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV`
4. "İlk Yöneticiyi Oluştur" butonuna tıkla
5. ✅ Başarılı mesajı görülmeli
6. Google hesabı 2 ile çıkış yap ve giriş yap
7. Aynı secret'la tekrar admin oluşturmayı dene
8. ❌ "Yönetici zaten mevcut" hatası alınmalı

**Beklenen Sonuç:** İkinci hesap admin olamaz

---

### Test 2: Davet Kodu Oluşturma ve Kullanma
**Hedef:** Davet kodları yalnızca admin tarafından oluşturulabilmeli ve tek kullanımlık olmalı

#### 2a. Admin Davet Oluşturur
1. Admin hesabıyla giriş yap
2. "Kullanıcı Yönetimi" → "Davet Oluştur"
3. Rol seç: Partner
4. Süre: 7 gün
5. ✅ 12 haneli kod üretilmeli (örn: `XKJH2P9L4RTN`)

#### 2b. Daveti Kullanma
1. Yeni Google hesabı ile giriş yap
2. "Davet Kodu" alanına kodu gir
3. ✅ Başarılı mesaj ve partner rolü verilmeli

#### 2c. Tekrar Kullanım Testi
1. Başka bir hesapla aynı kodu kullanmayı dene
2. ❌ "Geçersiz veya kullanılmış kod" hatası alınmalı

#### 2d. Süre Dolmuş Kod Testi
1. 7 günden eski bir kod oluştur (test için Functions'da süreyi 5 saniyeye düşür)
2. Kodu kullanmayı dene
3. ❌ "Davet kodu süresi dolmuş" hatası alınmalı

---

### Test 3: Rol Değiştirme
**Hedef:** Yalnızca admin rol değiştirebilmeli; admin rolü değiştirilememeli

#### 3a. Admin Başka Kullanıcının Rolünü Değiştirir
1. Admin hesabıyla giriş yap
2. "Kullanıcı Yönetimi" → kullanıcı listesi
3. Partner olan bir kullanıcıyı Employee olarak değiştir
4. ✅ Başarılı mesaj alınmalı
5. O kullanıcı ile giriş yapıp rolün değiştiğini kontrol et

#### 3b. Admin Kendi Rolünü Değiştirmeyi Dener
1. Admin hesabıyla kendi UID'sini partner yapmayı dene
2. ❌ "Kendi rolünüzü değiştiremezsiniz" hatası alınmalı

#### 3c. Partner Rol Değiştirmeyi Dener
1. Partner hesabıyla giriş yap
2. "Kullanıcı Yönetimi" butonu görünmemeli
3. Doğrudan callable function çağrısı yapmayı dene (geliştirici konsolundan)
4. ❌ "Sadece yönetici rol değiştirebilir" hatası alınmalı

---

### Test 4: Partner Erişim Kontrolü
**Hedef:** Partner tüm verileri görebilmeli ama kullanıcı yönetimi yapamamalı

1. Partner hesabıyla giriş yap
2. ✅ Projeler görüntülenebilmeli
3. ✅ Finans defteri görüntülenebilmeli
4. ✅ Fişler, taramalar görüntülenebilmeli
5. ✅ Yeni proje oluşturulabilmeli
6. ❌ "Kullanıcı Yönetimi" butonu görünmemeli
7. ❌ Firestore Console'dan `invites` koleksiyonu okuma denemesi `permission-denied` dönmeli

---

### Test 5: Employee Erişim Kısıtlamaları
**Hedef:** Employee finansal verilere erişememeli

#### 5a. Firestore Erişim Testi
1. Employee hesabıyla giriş yap
2. Browser DevTools → Console aç
3. Şu komutları dene:

```javascript
// ❌ Bu sorgular permission-denied dönmeli
firebase.firestore().collection('projects').get()
firebase.firestore().collection('ledger').get()
firebase.firestore().collection('receipts').get()
firebase.firestore().collection('scans').get()
firebase.firestore().collection('settings').get()

// ✅ Bu sorgular başarılı olmalı
firebase.firestore().collection('project_ops').get()
firebase.firestore().collection('workflow_photos').get()
```

#### 5b. UI Finansal Alan Testi
1. Employee hesabıyla proje listesini aç
2. ❌ Fiyat, toplam, ödeme sütunları görünmemeli
3. İş akışı detayını aç
4. ❌ Fiyat, maliyet alanları görünmemeli
5. ✅ İş akışı adımları, durum, notlar görünmeli

#### 5c. Storage Erişim Testi
```javascript
// ❌ Bu indirmeler permission-denied dönmeli
firebase.storage().ref('receipts/makbuz123.jpg').getDownloadURL()
firebase.storage().ref('scans/tarama456.pdf').getDownloadURL()

// ✅ Bu indirmeler başarılı olmalı
firebase.storage().ref('workflow_photos/photo789.jpg').getDownloadURL()
firebase.storage().ref('custom_sounds/sound111.mp3').getDownloadURL()
```

---

### Test 6: Customer Erişim Kısıtlamaları
**Hedef:** Customer yalnızca kendine atanan proje özetlerini görebilmeli

#### 6a. Müşteri Daveti ve Proje Ataması
1. Admin hesabıyla müşteri daveti oluştur
2. Müşteri Google hesabıyla daveti kullan
3. Admin veya partner hesabıyla yeni proje oluştur
4. Projeyi müşteri UID'sine ata (customerId alanı)

#### 6b. Müşteri Erişim Testi
1. Müşteri hesabıyla giriş yap
2. ✅ Kendisine atanan proje özeti görünmeli
3. ✅ Proje adı, tip, durum, tarih görünmeli
4. ❌ Fiyat, ödeme, finansal bilgiler görünmemeli
5. Başka bir müşteriye atanan projeyi görmeyi dene
6. ❌ Liste boş görünmeli veya erişim reddedilmeli

#### 6c. Firestore Doğrudan Erişim
```javascript
// ✅ Kendi customer_projects belgesini okuyabilmeli
firebase.firestore().collection('customer_projects').doc(auth.currentUser.uid).get()

// ❌ Başka müşterinin belgesini okuyamamalı
firebase.firestore().collection('customer_projects').doc('başka_uid').get()

// ❌ Ana proje koleksiyonunu okuyamamalı
firebase.firestore().collection('projects').get()
```

---

### Test 7: Eşzamanlı Düzenleme ve Revision Kontrolü
**Hedef:** Çakışan güncellemeler revision hatası vermeli

1. İki tarayıcı/sekme aç, admin/partner ile giriş yap
2. Her iki sekmede aynı projeyi aç
3. Sekme 1'de proje ismini değiştir ve kaydet
4. ✅ Başarılı kaydedilmeli (revision: 1 → 2)
5. Sekme 2'de (hala revision: 1 gözüküyor) başka bir alan değiştir ve kaydet
6. ❌ "Çakışma: proje başka bir oturumda değiştirilmiş" uyarısı çıkmalı
7. Sekme 2'yi yenile ve tekrar dene
8. ✅ Şimdi başarılı kaydedilmeli

---

### Test 8: Dosya Yükleme ve Erişim
**Hedef:** Storage kuralları rolüne göre erişimi kısıtlamalı

#### 8a. Partner Fiş Yükleme
1. Partner hesabıyla giriş yap
2. Fiş yükle (örn: makbuz.jpg)
3. ✅ Storage'a `receipts/{receiptId}/makbuz.jpg` yüklenebilmeli
4. ✅ Fişi listeleyip görüntüleyebilmeli

#### 8b. Employee Fiş Erişimi
1. Employee hesabıyla giriş yap
2. Doğrudan URL ile fiş indirmeyi dene
3. ❌ `permission-denied` hatası alınmalı

#### 8c. Employee Workflow Fotoğrafı
1. Employee hesabıyla iş akışı fotoğrafı yükle
2. ✅ Başarılı yüklenebilmeli
3. ✅ Fotoğrafı görüntüleyebilmeli

---

### Test 9: Yedekleme ve Geri Yükleme
**Hedef:** Tam yedekleme tüm verileri içermeli

1. Admin veya partner hesabıyla giriş yap
2. "Dosya" → "Tüm Verileri Yedekle"
3. ✅ JSON dosyası indirilmeli
4. JSON'ı aç ve şunları kontrol et:
   - Projeler
   - Finans defteri
   - Fişler (URL'ler)
   - Taramalar (URL'ler)
   - Workflow fotoğrafları (URL'ler)
   - Özel sesler (URL'ler)
   - Ayarlar
5. "Geri Yükle" ile JSON'u içe aktar
6. ✅ Tüm veriler başarıyla geri yüklenebilmeli

---

### Test 10: Legacy Veri Taşıma
**Hedef:** Eski IndexedDB verisi Firebase'e taşınmalı

1. Eski Lavora'nın çalıştığı origin'de `legacy-migrate.html` aç
2. ✅ IndexedDB'den eski projeler bulunmalı
3. "Firebase'e Aktar" butonuna tıkla
4. ✅ Tüm kayıtlar başarıyla aktarılmalı
5. Ana uygulamada verileri kontrol et
6. ✅ Projeler, fişler, sesler görünmeli

---

## 🎯 Test Başarı Kriterleri

| Test | Kategori | Kritik | Durum |
|------|----------|--------|-------|
| 1 | Admin Kurulumu | 🔴 Kritik | ⏳ Bekliyor |
| 2 | Davet Sistemi | 🔴 Kritik | ⏳ Bekliyor |
| 3 | Rol Değiştirme | 🔴 Kritik | ⏳ Bekliyor |
| 4 | Partner Erişim | 🟡 Önemli | ⏳ Bekliyor |
| 5 | Employee Kısıtlama | 🔴 Kritik | ⏳ Bekliyor |
| 6 | Customer Kısıtlama | 🔴 Kritik | ⏳ Bekliyor |
| 7 | Revision Kontrolü | 🟡 Önemli | ⏳ Bekliyor |
| 8 | Storage Erişim | 🔴 Kritik | ⏳ Bekliyor |
| 9 | Yedekleme | 🟡 Önemli | ⏳ Bekliyor |
| 10 | Legacy Taşıma | 🟢 Opsiyonel | ⏳ Bekliyor |

**Notlar:**
- 🔴 Kritik: Üretime alınmadan önce mutlaka başarılı olmalı
- 🟡 Önemli: Başarısız olursa veri bütünlüğü risk altında
- 🟢 Opsiyonel: Yalnızca eski verisi olanlar için gerekli

---

## 📝 Test Sonuçlarını Kaydetme

Her test için şu bilgileri kaydet:

```markdown
### Test X: [Test Adı]
- **Tarih:** [YYYY-MM-DD HH:MM]
- **Test Eden:** [Adınız]
- **Hesaplar:** [Kullanılan test hesapları]
- **Sonuç:** ✅ Başarılı / ❌ Başarısız / ⚠️ Kısmen Başarılı
- **Notlar:** [Gözlemler, hatalar, beklenmedik davranışlar]
- **Ekran Görüntüleri:** [Varsa]
```

---

## 🚀 Dağıtım Sonrası Kontrol Listesi

### Manuel Yapılandırma (Firebase Console)
- [ ] Blaze planına yükseltildi
- [ ] Storage başlatıldı
- [ ] Authentication → Google provider etkinleştirildi
- [ ] Authentication → Authorized domains güncellendi
- [ ] Firestore Database oluşturuldu
- [ ] Storage bucket oluşturuldu

### Dağıtım Komutları
- [x] Firestore Rules dağıtıldı
- [ ] Storage Rules dağıtılacak (Storage başlatıldıktan sonra)
- [ ] Cloud Functions dağıtılacak (Blaze'e geçildikten sonra)
- [ ] Bootstrap secret kaydedildi: `vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV`

### HTML Yapılandırması
- [ ] Firebase config HTML'e girildi
- [ ] İlk admin hesabı oluşturuldu
- [ ] HTTPS üzerinden yayınlandı

### Güvenlik Testleri
- [ ] Test 1-10 tamamlandı
- [ ] Tüm kritik testler başarılı
- [ ] Test sonuçları dokümante edildi

---

## 🔧 Sorun Giderme

### "Permission Denied" Hatası
1. Firestore/Storage kurallarının dağıtıldığından emin ol
2. Kullanıcının Firestore'da `users/{uid}` belgesi olduğundan emin ol
3. Rol bilgisinin doğru yazıldığından emin ol

### "Function Not Found" Hatası
1. Functions'ın başarıyla dağıtıldığından emin ol
2. Firebase Console'dan Functions loglarını kontrol et

### Revision Çakışması
1. Sayfayı yenile ve tekrar dene
2. Birden fazla sekme/cihazda aynı anda düzenleme yapma

---

## 📞 Destek İçin

Testler sırasında sorun yaşarsan:
1. Firebase Console → Functions → Logs
2. Browser DevTools → Console
3. Network sekmesinde Firebase isteklerini kontrol et
4. Bu dokümandaki beklenen sonuçlarla karşılaştır

---

**Son Güncelleme:** 2 Kasım 2026
**Hazırlayan:** Kiro AI Assistant
