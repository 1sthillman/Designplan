// Firebase Security Rules deployment scripti
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

const serviceAccount = JSON.parse(
  readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8')
);

// Firebase Admin SDK başlat
const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});

async function deployRules() {
  console.log('Firebase Security Rules deploy ediliyor...');
  
  // Service account'tan access token al
  const credential = cert(serviceAccount);
  const accessToken = await credential.getAccessToken();
  
  const rulesContent = readFileSync('./database.rules.json', 'utf8');
  const url = 'https://designwood-default-rtdb.firebaseio.com/.settings/rules.json';
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json'
      },
      body: rulesContent
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Deploy hatası:', error);
      process.exit(1);
    }
    
    console.log('✓ Security Rules başarıyla deploy edildi!');
    console.log('\nŞimdi localhost:3000 sayfasını HARD REFRESH yapın:');
    console.log('  - Chrome/Edge: Ctrl + Shift + R');
    console.log('  - veya DevTools açıkken Ctrl + F5');
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
}

deployRules();
