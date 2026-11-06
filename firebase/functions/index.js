const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const db = admin.firestore();
const BOOTSTRAP_SECRET = defineSecret('LAVORA_BOOTSTRAP_SECRET');

// Helper: generate random invite code
function generateInviteCode() {
  return Array.from({ length: 12 }, () => 
    '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 32)]
  ).join('');
}

// Helper: hash invite code with SHA-256
async function hashCode(code) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(code).digest('hex');
}

// ===== 1. Bootstrap first admin =====
exports.bootstrapAdmin = onCall({ secrets: [BOOTSTRAP_SECRET] }, async (request) => {
  const { secret } = request.data;
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Giriş yapmalısınız');
  }

  if (secret !== BOOTSTRAP_SECRET.value()) {
    throw new HttpsError('permission-denied', 'Geçersiz kurulum anahtarı');
  }

  // Check if admin already exists
  const admins = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  if (!admins.empty) {
    throw new HttpsError('already-exists', 'Yönetici zaten mevcut');
  }

  // Create first admin
  await db.collection('users').doc(uid).set({
    role: 'admin',
    email: request.auth.token.email || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: 'İlk yönetici başarıyla oluşturuldu' };
});

// ===== 2. Create invite =====
exports.createInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Giriş yapmalısınız');
  }

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Sadece yönetici davet oluşturabilir');
  }

  const { role, expiresInDays = 7 } = request.data;
  
  if (!['partner', 'employee', 'customer'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Geçersiz rol');
  }

  const code = generateInviteCode();
  const hashedCode = await hashCode(code);
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  );

  await db.collection('invites').add({
    codeHash: hashedCode,
    role,
    used: false,
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt
  });

  return { code, expiresAt: expiresAt.toMillis() };
});

// ===== 3. Use invite =====
exports.useInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Giriş yapmalısınız');
  }

  const { code } = request.data;
  if (!code) {
    throw new HttpsError('invalid-argument', 'Davet kodu gerekli');
  }

  const hashedCode = await hashCode(code);

  // Find invite
  const invitesSnapshot = await db.collection('invites')
    .where('codeHash', '==', hashedCode)
    .where('used', '==', false)
    .limit(1)
    .get();

  if (invitesSnapshot.empty) {
    throw new HttpsError('not-found', 'Geçersiz veya kullanılmış davet kodu');
  }

  const inviteDoc = invitesSnapshot.docs[0];
  const inviteData = inviteDoc.data();

  // Check expiration
  if (inviteData.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'Davet kodu süresi dolmuş');
  }

  // Mark invite as used
  await inviteDoc.ref.update({ used: true, usedBy: uid, usedAt: admin.firestore.FieldValue.serverTimestamp() });

  // Create or update user record
  await db.collection('users').doc(uid).set({
    role: inviteData.role,
    email: request.auth.token.email || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true, role: inviteData.role };
});

// ===== 4. Change user role =====
exports.changeUserRole = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) {
    throw new HttpsError('unauthenticated', 'Giriş yapmalısınız');
  }

  const adminDoc = await db.collection('users').doc(adminUid).get();
  if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Sadece yönetici rol değiştirebilir');
  }

  const { targetUid, newRole } = request.data;
  
  if (!targetUid || !newRole) {
    throw new HttpsError('invalid-argument', 'Hedef kullanıcı ve yeni rol gerekli');
  }

  if (!['partner', 'employee', 'customer'].includes(newRole)) {
    throw new HttpsError('invalid-argument', 'Geçersiz rol');
  }

  // Cannot change admin's own role
  if (targetUid === adminUid) {
    throw new HttpsError('permission-denied', 'Kendi rolünüzü değiştiremezsiniz');
  }

  // Cannot change another admin's role (only one admin allowed)
  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (targetDoc.exists && targetDoc.data().role === 'admin') {
    throw new HttpsError('permission-denied', 'Admin rolü değiştirilemez');
  }

  await db.collection('users').doc(targetUid).update({
    role: newRole,
    roleChangedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

// ===== 5. Sync customer project summary =====
// When a project is created/updated, sync customer summary if customerId exists
exports.syncCustomerProject = onDocumentWritten('projects/{projectId}', async (event) => {
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();

  // Deleted
  if (!afterData) {
    if (beforeData?.customerId) {
      const customerDocRef = db.collection('customer_projects').doc(beforeData.customerId);
      const customerDoc = await customerDocRef.get();
      if (customerDoc.exists) {
        const projects = customerDoc.data().projects || {};
        delete projects[event.params.projectId];
        await customerDocRef.update({ projects });
      }
    }
    return;
  }

  // Created or updated
  if (afterData.customerId) {
    const customerDocRef = db.collection('customer_projects').doc(afterData.customerId);
    
    // Create customer projection (no financial data)
    const customerProjection = {
      projectName: afterData.projectName || '',
      projectType: afterData.projectType || '',
      status: afterData.status || '',
      startDate: afterData.startDate || null,
      endDate: afterData.endDate || null,
      description: afterData.description || '',
      // No pricing, payments, or financial fields
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await customerDocRef.set({
      projects: {
        [event.params.projectId]: customerProjection
      }
    }, { merge: true });
  }
});

// ===== 6. Employee projection sync =====
// When a project is created/updated, create employee-safe projection in project_ops
exports.syncEmployeeProjection = onDocumentWritten('projects/{projectId}', async (event) => {
  const afterData = event.data?.after?.data();

  // Deleted
  if (!afterData) {
    await db.collection('project_ops').doc(event.params.projectId).delete();
    return;
  }

  // Filter out financial fields for employee view
  const employeeProjection = {
    projectName: afterData.projectName || '',
    projectType: afterData.projectType || '',
    status: afterData.status || '',
    startDate: afterData.startDate || null,
    endDate: afterData.endDate || null,
    description: afterData.description || '',
    workflow: afterData.workflow || [],
    // Exclude: price, payments, totalCost, profit, etc.
    revision: afterData.revision || 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // If workflow exists, strip price fields from workflow items
  if (employeeProjection.workflow && Array.isArray(employeeProjection.workflow)) {
    employeeProjection.workflow = employeeProjection.workflow.map(item => {
      const { price, cost, total, ...safe } = item;
      return safe;
    });
  }

  await db.collection('project_ops').doc(event.params.projectId).set(employeeProjection);
});
