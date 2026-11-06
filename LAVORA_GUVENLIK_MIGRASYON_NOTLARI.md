# Lavora güvenlik düzeltmesi — zorunlu uygulama eşleştirmeleri

Bu paket yalnızca statik dosya hazırlığıdır. Firebase'e dağıtım yapılmadı ve Emulator/gerçek hesap testi yapılmadı.

## Önemli: HTML dosyasıyla birlikte uygulanmadan dağıtmayın

Mevcut HTML'in davet kullanma akışı `inviteHash` alanını kullanıcı kaydına yazmıyor. Yeni kurallar, kullanıcının kendi rolünü yalnızca kullanılmış ve kendisine ait davete bağlayabilmek için `inviteHash` ister. HTML'de daveti tüketip kullanıcı profili oluşturmadan önce `userDoc(uid).child('inviteHash').set(hash)` eklenmeli; rol ve müşteri `projectId` alanları bu işlemden sonra yazılmalı.

Mevcut HTML müşteri daveti kullanıldığında `customer_projects/{uid}/{projectId}` kaydını oluşturmuyor. Müşteri portalı bu düğümü okuduğu için davet sonrası veya proje ataması sırasında admin/partner tarafından şu alanlarla özet yazılmalı: `projectName`, `status`, `progress`, `updatedAt`. Bu özete fiyat, maliyet, ödeme, müşteri finansmanı veya başka finansal alan eklenmemeli.

## Kuralların kapsadığı değişiklikler

- `users` kök listesini yalnızca admin okuyabilir; kullanıcı kendi profilini okuyabilir.
- Rol değerleri uygulama üzerinden `admin` olamaz. İlk admin yalnızca Firebase Console'dan manuel oluşturulmalıdır; mevcut admin rolü uygulama üzerinden değiştirilemez.
- Davet kök listesi okunamaz; yalnızca bilinen hash alt düğümü oturum açmış kullanıcı tarafından okunabilir. Davet kullanımı süresi dolmamış ve henüz kullanılmamış kodla sınırlıdır.
- Finans defteri, fişler, taramalar ve ayarlar yalnızca admin/partner erişimine açıktır.
- Müşteri yalnızca kendi `customer_projects/{uid}` özetlerini okuyabilir.
- `project_ops` ve workflow fotoğrafları müşteri rolüne kapalıdır.

## Bilinen sınır — henüz üretim onayı değildir

Realtime Database kuralları iç içe JSON içinde her derinlikteki alanları otomatik olarak filtrelemez. `project_ops` üzerindeki mevcut `.validate`, yalnızca üst seviyedeki finansal alan adlarını kontrol eder; iç içe `w.items`, sayfa satırları veya başka alt nesnelere finansal veri eklenmesini tek başına engellemez. Mevcut HTML'deki `safeProject()` istemci tarafı temizliği de kötü niyetli istemciye karşı güvenlik sınırı değildir. Çalışanların finansal veriye erişemediğini kesin güvenceye almak için `project_ops` şemasının finansal olmayan alanlar için açık beyaz listeyle yeniden düzenlenmesi ve yazma işlemlerinin bu şemaya göre ayrılması gerekir.

Ayrıca mevcut HTML, projeleri ve operasyon kayıtlarını iki ayrı yazma/transaction akışıyla kaydediyor. Bu akış tek atomik çok-yollu güncelleme veya kontrollü uzlaştırma ile değiştirilmeden tam veri tutarlılığı garantisi verilemez.

## Dağıtım öncesi kontrol

1. Firebase RTDB'den tam JSON yedeği alın.
2. Önce ayrı bir Firebase test projesinde bu kuralları yükleyin.
3. Admin, partner, employee ve customer için ayrı test hesaplarıyla doğrudan RTDB okuma/yazma testleri yapın.
4. Davet kodunun yanlış, süresi geçmiş ve ikinci kez kullanılmış hallerini test edin.
5. Müşterinin başka UID altındaki projeyi okuyamadığını doğrulayın.
6. Çalışanın `projects`, `ledger`, `receipts`, `scans`, `settings` ve finansal verilerin bulunduğu tüm düğümlere doğrudan erişiminin reddedildiğini doğrulayın.
7. Bu testler tamamlanmadan gerçek kullanıcı/finans verisiyle üretime geçmeyin.
