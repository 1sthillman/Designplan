# Lavora Design - v39 Kurulum Rehberi

Bu rehber, Lavora Çalışma Masası v39'u Cloudflare Workers AI desteğiyle çalıştırmak için gereken adımları anlatır.

## Gereksinimler

- Node.js 18 veya üzeri
- Cloudflare hesabı (minifinise veya kendi hesabınız)
- Wrangler CLI

## 1. Wrangler Kurulumu

```bash
npm install -g wrangler
wrangler login
```

Tarayıcıda Cloudflare hesabınıza giriş yapın.

## 2. Worker Kaynaklarına Geçin

```bash
cd worker
```

## 3. Gizli Değerleri Ayarlayın

```bash
wrangler secret put FIREBASE_PROJECT_ID
# Sor: designwood

wrangler secret put DEV_SECRET
# Sor: test ortamı icin rastgele bir deger girin (ornegin: dev-abc-123)
```

> DEV_SECRET yalnizca yerel test icin kullanilir. Uretimde kullanmayiniz.

## 4. Worker'i Deploy Edin

```bash
wrangler deploy
```

Cikti sunun gibi gorunmelidir:
```
Published designplan (X.XXs)
  https://designplan.minifinise.workers.dev
```

## 5. Saglik Kontrolu

Tarayicida su adrese gidin:

```
https://designplan.minifinise.workers.dev/health
```

Beklenen yanit:
```json
{"status":"ok","service":"Lavora Cloudflare Workers AI Gateway"}
```

## 6. Lavora Uygulamasinda Worker Adresini Girin

1. `lavora-calisma-masasi-v39.html` dosyasini acin
2. Admin olarak giris yapin
3. Saga cekip Ayarlar'i acin
4. "Yapay Zeka Durumu ve Ozellikleri (v39)" butonuna tiklayin
5. Worker URL alanina girin: `https://designplan.minifinise.workers.dev`
6. "Baglanti Testi" butonuna basin
7. Gecikme ve durum gosterilmelidir

## 7. Ozellik Anahtarlari

Ayarlar > Yapay Zeka ekraninda su anahtarlar bulunur:

| Anahtar | Aciklama |
|---|---|
| Sesle Guncelleme | Ses kaydinden asama ve not guncelleme |
| Fis Tarama | Kameradan fis/fatura okuma ve deftere ekleme |
| Gunluk Ozet | Her sabah proje ozeti ve oncelikler |
| Soru-Cevap | Proje verisi uzerinde dogal dil sorgusu |
| Teklif Zenginlestirme | Kalemlere profesyonel teknik aciklama ekleme |
| Olay Gunlugu | Asama degisikliklerini goruntuleme |

Tum anahtarlar varsayilan olarak kapali gelir. Acmak icin ilgili satirdaki toggle'a tiklayin.

## 8. Yerel Test (Istege Bagli)

```bash
cd worker
wrangler dev
```

Worker `http://localhost:8787` adresinde calisir. Test komutlari:

```bash
cd test
node --experimental-vm-modules worker-smoke.test.mjs
```

Beklenen: 10/10 PASS

## 9. GitHub Pages ile Kullanim

`lavora-calisma-masasi-v39.html` dosyasini `https://1sthillman.github.io/Designplan/lavora-calisma-masasi-v39.html` adresinde kullanabilirsiniz.

Musteriler hala `index.html` (v38) veya `Designplan/` adresi uzerinden erisir. V39 yalnizca atölye ekibine acik tutulabilir.

## Mimari Ozeti

```
Tarayici (v39)
  |
  | Firebase ID Token (JWT)
  v
Cloudflare Worker (designplan.minifinise.workers.dev)
  |-- Firebase JWT dogrulama (Google JWK ile)
  |-- Rol kontrolu (musteri -> 403)
  |-- Hiz sinirlama (kullanici basina KV)
  |-- AI Gateway
  v
Cloudflare Workers AI
  |-- Metin: llama-3.1-8b-instruct-fp8
  |-- Ses: whisper-large-v3-turbo
  |-- Gorsel: llama-3.2-11b-vision-instruct
  |-- Embedding: bge-m3
```

## Bilinen Kisitlamalar

- Cevrimdisi modda yapay zeka ozellikleri devre disi kalir; uygulama tam calisir
- Ses kaydi maksimum 5 dakika ile sinirlidir (10MB)
- Gorsel dosyalari maksimum 4MB
- Musteri rolundeki kullanicilar hicbir v39 ozelligine erisemez
- Firebase ID Token her istekte yenilenir (60 dakika gecerli)
