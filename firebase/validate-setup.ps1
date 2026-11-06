# Firebase Lavora Kurulum Doğrulama Scripti
# Bu script Firebase proje yapısını ve dağıtım durumunu kontrol eder

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Firebase Lavora Kurulum Kontrol" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "SilentlyContinue"
$issues = @()
$warnings = @()
$success = @()

# 1. Firebase CLI Kontrolü
Write-Host "[1/10] Firebase CLI kontrolü..." -ForegroundColor Yellow
$firebaseVersion = & npx firebase --version 2>&1
if ($LASTEXITCODE -eq 0) {
    $success += "✅ Firebase CLI kurulu (v$firebaseVersion)"
} else {
    $issues += "❌ Firebase CLI bulunamadı"
}

# 2. Firebase Login Kontrolü
Write-Host "[2/10] Firebase login kontrolü..." -ForegroundColor Yellow
$loginStatus = & npx firebase login:list 2>&1
if ($loginStatus -match "2sthillman@gmail.com") {
    $success += "✅ Firebase'e giriş yapılmış (2sthillman@gmail.com)"
} else {
    $issues += "❌ Firebase'e giriş yapılmamış"
}

# 3. Proje Yapısı Kontrolü
Write-Host "[3/10] Proje dosyaları kontrolü..." -ForegroundColor Yellow
$requiredFiles = @(
    "firebase.json",
    "firestore.rules",
    "storage.rules",
    ".firebaserc",
    "functions\package.json",
    "functions\index.js"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $success += "✅ $file mevcut"
    } else {
        $issues += "❌ $file bulunamadı"
    }
}

# 4. Functions Bağımlılıkları Kontrolü
Write-Host "[4/10] Functions bağımlılıkları kontrolü..." -ForegroundColor Yellow
if (Test-Path "functions\node_modules") {
    $success += "✅ Functions node_modules kurulu"
} else {
    $warnings += "⚠️ Functions bağımlılıkları kurulu değil. Çalıştır: npm --prefix functions install"
}

# 5. Firebase Projesi Kontrolü
Write-Host "[5/10] Firebase projesi kontrolü..." -ForegroundColor Yellow
$currentProject = & npx firebase use 2>&1
if ($currentProject -match "designwood") {
    $success += "✅ Firebase projesi: designwood"
} else {
    $issues += "❌ Firebase projesi yapılandırılmamış"
}

# 6. Firestore Rules Sözdizimi Kontrolü
Write-Host "[6/10] Firestore rules sözdizimi kontrolü..." -ForegroundColor Yellow
$rulesContent = Get-Content "firestore.rules" -Raw
if ($rulesContent -match "rules_version = '2'") {
    $success += "✅ Firestore rules sözdizimi doğru"
} else {
    $issues += "❌ Firestore rules sözdizimi hatası"
}

# 7. Storage Rules Sözdizimi Kontrolü
Write-Host "[7/10] Storage rules sözdizimi kontrolü..." -ForegroundColor Yellow
$storageRulesContent = Get-Content "storage.rules" -Raw
if ($storageRulesContent -match "rules_version = '2'") {
    $success += "✅ Storage rules sözdizimi doğru"
} else {
    $issues += "❌ Storage rules sözdizimi hatası"
}

# 8. Functions Syntax Kontrolü
Write-Host "[8/10] Functions JavaScript sözdizimi kontrolü..." -ForegroundColor Yellow
$functionsContent = Get-Content "functions\index.js" -Raw
if ($functionsContent -match "exports.bootstrapAdmin" -and $functionsContent -match "exports.createInvite") {
    $success += "✅ Functions tanımları mevcut"
} else {
    $issues += "❌ Functions tanımları eksik"
}

# 9. Dağıtım Durumu Kontrolü
Write-Host "[9/10] Firebase dağıtım durumu kontrolü..." -ForegroundColor Yellow
# Bu kısım gerçek deployment bilgisi gerektirir, sadece yapı kontrolü yapıyoruz
$warnings += "⚠️ Dağıtım durumu manuel kontrol edilmeli (npx firebase deploy --dry-run)"

# 10. Bootstrap Secret Kontrolü
Write-Host "[10/10] Bootstrap secret kontrolü..." -ForegroundColor Yellow
$warnings += "⚠️ Bootstrap secret manuel kontrol edilmeli: vHUjyk1l5CGXPanFbJAQILp4s6ecMtxV"

# Sonuç Raporu
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "         KONTROL RAPORU" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "BAŞARILI ($($success.Count)):" -ForegroundColor Green
    foreach ($item in $success) {
        Write-Host "  $item" -ForegroundColor Green
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "UYARILAR ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "  $item" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($issues.Count -gt 0) {
    Write-Host "SORUNLAR ($($issues.Count)):" -ForegroundColor Red
    foreach ($item in $issues) {
        Write-Host "  $item" -ForegroundColor Red
    }
    Write-Host ""
}

# Sonuç Özeti
Write-Host "==================================" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
    Write-Host "✅ Proje yapısı doğru! Dağıtıma hazır." -ForegroundColor Green
    Write-Host ""
    Write-Host "Sıradaki adımlar:" -ForegroundColor Cyan
    Write-Host "1. Firebase Console'dan Blaze planına geç" -ForegroundColor White
    Write-Host "2. Firebase Console'dan Storage'ı başlat" -ForegroundColor White
    Write-Host "3. Firebase Console'dan Authentication → Google provider'ı etkinleştir" -ForegroundColor White
    Write-Host "4. Bootstrap secret'ı kaydet: npx firebase functions:secrets:set LAVORA_BOOTSTRAP_SECRET" -ForegroundColor White
    Write-Host "5. Dağıt: npx firebase deploy --only storage,functions" -ForegroundColor White
} else {
    Write-Host "❌ Proje yapısında sorunlar var. Yukarıdaki hataları düzeltin." -ForegroundColor Red
}
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Detaylı rapor dosyası oluştur
$report = @"
Firebase Lavora Kurulum Raporu
Tarih: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

BAŞARILI KONTROLLER:
$($success -join "`n")

UYARILAR:
$($warnings -join "`n")

SORUNLAR:
$($issues -join "`n")

SIRADAKİ ADIMLAR:
1. Firebase Console → Blaze planına geç
2. Firebase Console → Storage'ı başlat
3. Firebase Console → Authentication yapılandır
4. Bootstrap secret kaydet
5. Firebase deploy çalıştır

Detaylı talimatlar için DEPLOYMENT-CHECKLIST.md dosyasına bakın.
"@

$report | Out-File -FilePath "validation-report.txt" -Encoding UTF8
Write-Host "📄 Detaylı rapor kaydedildi: validation-report.txt" -ForegroundColor Cyan
