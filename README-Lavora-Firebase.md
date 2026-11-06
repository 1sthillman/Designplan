# Lavora Firebase sürümü — v38

Bu paket, mevcut tek HTML uygulamasını Firebase Auth + Cloud Firestore + Cloud Storage + Cloud Functions ile çalışacak şekilde dönüştürür. HTML içinde yönetici UID'si veya servis hesabı anahtarı bulunmaz.

## Dosyalar

- `lavora-calisma-masasi-v38-firebase.html`: Firebase oturum açma, rol bazlı uygulama ve Firebase veri katmanı entegre edilmiş ana uygulama.
- `firebase/firestore.rules`: Firestore erişim kuralları.
- `firebase/storage.rules`: Dosya ve görsel erişim kuralları.
- `firebase/functions/index.js`: Tek yönetici ilk kurulumu, davet kodu üretme/kullanma, mevcut kullanıcı rolünü değiştirme ve müşteri proje özeti senkronizasyonu.
- `firebase/firebase.json`: Firebase CLI dağıtım tanımı.

## Güvenlik ve rol modeli

- **Admin:** Tek yönetici. İlk yönetici yalnızca sunucu tarafındaki tek kullanımlık kurulum kilidi ile oluşturulur. Rol atama ve davet yönetimi yalnızca admin callable function üzerinden yapılır.
- **Partner:** Proje, finans/defter, fiş, tarama ve şirket ayarlarını görür/yönetir; kullanıcı rolü atayamaz.
- **Employee:** `projects`, `ledger`, `receipts`, `scans` ve `settings` koleksiyonlarını okuyamaz. Yalnızca `project_ops` operasyon izdüşümünü ve iş akışı fotoğraflarını kullanır. Proje/iş akışı izdüşümünde finansal alanlar sunucuya yazılmadan önce ayrıştırılır; fiyatla ilgili sütunlar çalışan izdüşümüne taşınmaz.
- **Customer:** Yalnızca UID'sine atanmış `customer_projects` özetlerini okuyabilir. Tam proje dokümanlarına, diğer müşterilere veya finans verilerine erişemez.

Rol bilgisi Firestore `users/{uid}` belgesinde tutulur; istemci bu belgeyi yazamaz. Kurallar, istemci arayüzünden bağımsız olarak erişimi sınırlar. Davet kodları 96-bit rastgele, SHA-256 özeti saklanan, tek kullanımlık ve 7 gün süreli kodlardır.

## Firebase projesini hazırlama

Firebase Console'da yeni bir proje oluşturun veya mevcut projenizi seçin:

1. **Authentication → Sign-in method** bölümünden Google sağlayıcısını etkinleştirin.
2. Authentication → Settings → Authorized domains bölümüne uygulamanın çalışacağı alan adını ekleyin. Yerel test için `localhost` kullanılabilir.
3. **Firestore Database** oluşturun. Bölgeyi dikkatle seçin; sonradan değiştirmek kolay değildir.
4. **Storage** bucket'ı oluşturun.
5. Firebase Console → Project settings → General → Your apps bölümünden bir **Web App** oluşturup Web yapılandırma nesnesini alın.
6. HTML dosyasını açın. İlk ekranda bu Web yapılandırma nesnesini JSON olarak girip kaydedin. Bu nesne Firebase istemci yapılandırmasıdır; servis hesabı anahtarı değildir.
7. Firebase CLI ile `firebase` klasörünü proje kökü olarak kullanın. `firebase use --add` ile doğru Firebase proje kimliğini seçin.

> Bu paket Cloud Functions ve Cloud Storage kullandığı için Firebase projesini Blaze (kullandıkça öde) planına geçirmeniz gerekir. Kullanım öncesi Firebase fiyatlandırmasını ve bütçe uyarılarını mutlaka kontrol edin. Firestore ücretsiz kotası olsa bile yoğun görsel/ek dosya trafiği maliyet doğurabilir.

## Dağıtım

Firebase CLI kurulu ve doğru projeye bağlıyken:

```bash
cd firebase
npm --prefix functions install
firebase functions:secrets:set LAVORA_BOOTSTRAP_SECRET
firebase deploy --only firestore:rules,storage,functions
```

Secret sorulduğunda uzun, rastgele ve başka yerde kullanılmayan bir kurulum anahtarı girin. Bu anahtar HTML'e, Git deposuna veya istemciye yazılmaz. İlk girişte Google hesabınızla oturum açın ve **İlk yöneticiyi oluştur** alanına aynı anahtarı girin. Başarılı ilk kurulumdan sonra bu callable function ikinci bir yönetici oluşturmayı reddeder. Secret'ı güvenli yerde saklayın; kaybolursa yönetici kurtarma işlemi Firebase Console/operasyon prosedürü gerektirir.

Dağıtım tamamlandıktan sonra HTML'i HTTPS üzerinden yayınlayın. `file://` üzerinden Google popup, Storage ve güvenli origin gereksinimleri nedeniyle üretim kullanımı yapmayın.

## Eski sürüm verilerini taşıma

Ana uygulama (`lavora-calisma-masasi-v38-firebase.html`) IndexedDB kullanmaz. Ancak eski sürümün proje/defter/tarama/fotoğraf/özel ses verileri eski tarayıcı IndexedDB'sinde duruyor olabilir. Bu nedenle paketteki **`legacy-migrate.html` ayrı bir, tek seferlik ve salt-okunur geçiş aracıdır**; ana uygulamanın veri katmanı değildir.

1. Önce Firebase projesini hazırlayıp kuralları/Functions'ı dağıtın; ana HTML'de Firebase Web yapılandırmasını girin, Google hesabınızla giriş yapın ve ilk admin hesabını oluşturun.
2. `legacy-migrate.html` dosyasını **eski Lavora'nın çalıştığı tam aynı origin'de** (aynı protokol + alan adı + port) HTTPS üzerinden açın. IndexedDB origin'e bağlıdır; migratörü yeni uygulamanın farklı alan adında açarsanız eski kayıtları bulamaz. Farklı alan adına geçiyorsanız migratörü geçici olarak eski uygulamanın alan adında yayınlayın.
3. Migratör Firebase yapılandırmasını aynı origin'deki `localStorage` alanından alır. Farklı origin kullanıyorsanız yapılandırma JSON'unu migratör ekranına ayrıca girin. Google hesabıyla tekrar giriş yapıp admin veya partner rolünüzü doğrulayın.
4. **Eski verileri tara** ile `lavora` ve varsa `lvr_voice_db` veritabanlarını okuyun. Araç eski verileri silmez veya değiştirmez.
5. Bulunan proje, tarama, defter, fiş, iş akışı fotoğrafı, ayar ve özel ses sayılarını kontrol edin.
6. **Eksik kayıtları Firebase'e aktar** düğmesine basın. Aynı kimliğe sahip Firebase kayıtlarının üzerine yazılmaz; işlem yarıda kalırsa tekrar çalıştırılabilir.
7. Yeni ana uygulamaya dönün; projeleri, iş akışlarını, defter kayıtlarını, fişleri, taramaları ve sesleri örnekleyerek doğrulayın.
8. Ayrıca yeni uygulamanın **Dosya → Tüm verileri yedekle** özelliğini kullanarak Firebase verilerinin bir dış yedeğini alın.

Eski veritabanı, doğrulama tamamlanana kadar tarayıcıda bırakılır. Silme/temizleme işlemini ancak Firebase'deki sayılar ve örnek dosyalar doğrulandıktan sonra kendiniz yapın. Yeni ana uygulamanın kendisi IndexedDB'ye başvurmaz; geçiş aracı yalnızca eski veriyi bir defaya mahsus okur. HTML içine gömülü 72 varsayılan ses korunmuştur.

## Veri saklama ve eşzamanlama

- Projeler ve finansal defter Firestore'dadır.
- Fotoğraflar, fişler, tarama görselleri ve kullanıcı ses klipleri Cloud Storage'dadır; Firestore'da dosya metaverisi/yolu tutulur.
- Proje ve iş akışı değişiklikleri Firestore snapshot dinleyicileriyle diğer oturumlara iletilir.
- Proje/operasyon belgelerinde revision kontrolü vardır; eski revision ile gelen yazma çakışma hatası verir ve sessizce üzerine yazmaz.
- `localStorage` yalnızca Firebase web yapılandırması, küçük ayar önbelleği ve arayüz tercihleri için kullanılır. Firestore çevrimdışı kalıcı önbelleği etkinleştirilmemiştir; internet bağlantısı olmadan buluta kayıt garantisi yoktur.
- Uygulama çevrimiçi çalışacak şekilde tasarlanmıştır. Büyük dosyalar localStorage'a yazılmaz.

## Üretime almadan önce zorunlu kabul testleri

1. İlk admin kurulumu iki farklı Google hesabıyla denenmeli; ikinci hesap admin olamamalı.
2. Admin çalışan/partner/müşteri daveti oluşturmalı; kod ikinci kez ve süresi dolduktan sonra kullanılamamalı.
3. Admin mevcut kullanıcının rolünü değiştirebilmeli; kendisini veya tek admin rolünü değiştirememeli.
4. Partner tüm proje/defter verisini görmeli ama ekip/rol yönetimi butonunu görmemeli.
5. Employee hesabıyla Firestore doğrudan sorgusunda `projects`, `ledger`, `receipts`, `scans`, `settings` okumaları `permission-denied` dönmeli; `project_ops` ve iş akışı fotoğrafları çalışmalı.
6. Employee hesabıyla proje finans sütunları ve iş akışı fiyat/tutar alanları görünmemeli.
7. Customer hesabı yalnızca kendisine atanmış proje özetini görmeli; başka UID'ye ait atama sorgusu reddedilmeli.
8. İki oturumda aynı projeyi eşzamanlı düzenleyip revision çakışması doğrulanmalı.
9. Dosya yükleme/indirme, fiş, tarama, workflow fotoğrafı ve özel ses klibi test edilmeli.
10. Tam yedek al/geri yükle ve eski sürümden içe aktarma test edilmeli.

**Önemli:** Bu ortamda Firebase projenize erişimim olmadığı için kuralları sizin projenize dağıtamam, Google sağlayıcısını etkinleştiremem veya canlı kullanıcılarla uçtan uca test yapamam. Bu paket, proje yapılandırması ve dağıtım adımları tamamlandıktan sonra çalıştırılmak üzere hazırlanmıştır. Canlıya almadan önce yukarıdaki kabul testlerini uygulayın.
npm install firebase // Import the functions you need from the SDKs you need 
npm install -g firebase-tools  
C:\lavorasync\designwood-firebase-adminsdk-fbsvc-c90f45263a.json
import { initializeApp } from "firebase/app";

import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {

  apiKey: "AIzaSyBzNQGUVn-1-kGdZVFTdu9Mkor2w0NM6AU",

  authDomain: "designwood.firebaseapp.com",

  databaseURL: "https://designwood-default-rtdb.firebaseio.com",

  projectId: "designwood",

  storageBucket: "designwood.firebasestorage.app",

  messagingSenderId: "1081401100728",

  appId: "1:1081401100728:web:8a3d35290dbe1f279f274d",

  measurementId: "G-Z6XH2W7YM0"

};

// Initialize Firebase

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);