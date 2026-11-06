// Firebase Security Rules REST API deployment
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});

async function deployRules() {
  console.log('Firebase Security Rules deploy ediliyor...');
  
  try {
    // Get access token
    const credential = cert(serviceAccount);
    const accessToken = await credential.getAccessToken();
    
    // Read rules file
    const rulesContent = readFileSync('./database.rules.json', 'utf8');
    
    const url = 'https://designwood-default-rtdb.firebaseio.com/.settings/rules.json';
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json'
      },
      body: rulesContent
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deploy hatası:', response.status, response.statusText);
      console.error('Detay:', errorText);
      process.exit(1);
    }
    
    const result = await response.json();
    console.log('✓ Security Rules başarıyla deploy edildi!');
    console.log('✓ Rules aktif:', result);
    console.log('\n✓✓✓ ŞİMDİ LOCALHOST:3000 SAYFASINI YENILEYIN (Ctrl+Shift+R) ✓✓✓');
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

deployRules();
