// Admin kullanıcı oluşturma scripti
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8')
);

// Firebase Admin SDK başlat
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});

const db = getDatabase();

async function createAdminUser() {
  const userId = 'ZXgrt2of21T03usxwN4RBbQsS2R2';
  const email = 'minifinise@gmail.com';
  const tenantId = 'lavora-main';
  
  console.log('Admin kullanıcı oluşturuluyor...');
  console.log('Email:', email);
  console.log('UID:', userId);
  console.log('Tenant:', tenantId);
  
  const tenantRef = db.ref(`tenants/${tenantId}`);
  
  // Admin kullanıcı verisi
  const adminData = {
    users: {
      [userId]: {
        email: email,
        role: 'admin',
        createdAt: Date.now(),
        displayName: email.split('@')[0]
      }
    },
    admin_lock: {
      adminUid: userId,
      lockedAt: Date.now()
    }
  };
  
  try {
    await tenantRef.update(adminData);
    console.log('✓ Admin kullanıcı başarıyla oluşturuldu!');
    console.log('✓ Admin lock ayarlandı');
    
    // Verify the write
    const snapshot = await db.ref(`tenants/${tenantId}/users/${userId}`).once('value');
    console.log('\nDoğrulama - Database\'den okunan veri:');
    console.log(JSON.stringify(snapshot.val(), null, 2));
    
    if (snapshot.val()) {
      console.log('\n✓ Veri başarıyla yazıldı ve doğrulandı!');
      console.log('\nŞimdi localhost:3000 sayfasını yenileyin.');
    } else {
      console.log('\n✗ HATA: Veri yazıldı ama okunamadı!');
    }
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error);
    console.error('Hata detayı:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createAdminUser();
