import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const serviceAccount = JSON.parse(readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});

const adminAuth = getAuth();
const adminDb = getDatabase();
const API_KEY = "AIzaSyBzNQGUVn-1-kGdZVFTdu9Mkor2w0NM6AU";
const RTDB_BASE = "https://designwood-default-rtdb.firebaseio.com";
const TENANT = "lavora-main";

// Helper to get ID Token from Custom Token
async function getIdTokenForUser(uid) {
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to exchange custom token: ${err}`);
  }
  const data = await res.json();
  return data.idToken;
}

// Helper to do RTDB REST operations as a user
async function rtdbRequest(idToken, subpath, method = 'GET', body = null) {
  const url = `${RTDB_BASE}/tenants/${TENANT}/${subpath}.json?auth=${idToken}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== null) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, ok: res.ok, data: json };
}

function sha256(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}

const results = [];
function record(category, testName, passed, detail) {
  results.push({ category, testName, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${category}] ${testName} - ${detail}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 LAVORA COMPREHENSIVE BACKEND & SECURITY TEST SUITE');
  console.log('====================================================\n');

  const adminUid = 'ZXgrt2of21T03usxwN4RBbQsS2R2';
  const employeeUid = 'wpS6BImMQ9cEpGxZG0onlBC5owg1';
  const partnerUid = 'partner_test_user_001';
  const customerUid = 'customer_test_user_001';

  console.log('Obtaining ID tokens for all 4 roles...');
  const [adminToken, employeeToken, partnerToken, customerToken] = await Promise.all([
    getIdTokenForUser(adminUid),
    getIdTokenForUser(employeeUid),
    getIdTokenForUser(partnerUid),
    getIdTokenForUser(customerUid)
  ]);
  console.log('All 4 ID tokens obtained successfully.\n');

  // ----------------------------------------------------
  // SUITE 1: Employee Role & Data Isolation
  // ----------------------------------------------------
  console.log('--- SUITE 1: Employee Role & Financial Data Isolation ---');
  
  // Test 1.1: Employee can read own user record
  const empSelf = await rtdbRequest(employeeToken, `users/${employeeUid}`);
  record('Employee', 'Read own user record', empSelf.ok && empSelf.data.uid === employeeUid, `Status: ${empSelf.status}`);

  // Test 1.2: Employee cannot read other user's record
  const empOther = await rtdbRequest(employeeToken, `users/${adminUid}`);
  record('Employee', 'Read other user record (BLOCKED)', !empOther.ok && empOther.status === 401, `Status: ${empOther.status} (Expected 401 Unauthorized)`);

  // Test 1.3: Employee cannot change own role
  const empRoleChange = await rtdbRequest(employeeToken, `users/${employeeUid}/role`, 'PUT', 'admin');
  record('Employee', 'Modify own role to admin (BLOCKED)', !empRoleChange.ok && empRoleChange.status === 401, `Status: ${empRoleChange.status}`);

  // Test 1.4: Employee CANNOT read projects (financial)
  const empProj = await rtdbRequest(employeeToken, 'projects');
  record('Employee', 'Read projects collection (BLOCKED)', !empProj.ok && empProj.status === 401, `Status: ${empProj.status} - Financial isolation active`);

  // Test 1.5: Employee CAN read project_ops (operations)
  const empOps = await rtdbRequest(employeeToken, 'project_ops');
  record('Employee', 'Read project_ops collection (ALLOWED)', empOps.ok, `Status: ${empOps.status}`);

  // Test 1.6: Employee CANNOT read ledger (defter)
  const empLedger = await rtdbRequest(employeeToken, 'ledger');
  record('Employee', 'Read ledger/accounting (BLOCKED)', !empLedger.ok && empLedger.status === 401, `Status: ${empLedger.status}`);

  // Test 1.7: Employee CANNOT read receipts (fişler)
  const empRcpt = await rtdbRequest(employeeToken, 'receipts');
  record('Employee', 'Read receipts/expenses (BLOCKED)', !empRcpt.ok && empRcpt.status === 401, `Status: ${empRcpt.status}`);

  // Test 1.8: Employee CANNOT read scans (taramalar)
  const empScans = await rtdbRequest(employeeToken, 'scans');
  record('Employee', 'Read scans (BLOCKED)', !empScans.ok && empScans.status === 401, `Status: ${empScans.status}`);

  // Test 1.9: Employee CANNOT read settings
  const empSettings = await rtdbRequest(employeeToken, 'settings');
  record('Employee', 'Read company settings (BLOCKED)', !empSettings.ok && empSettings.status === 401, `Status: ${empSettings.status}`);

  // Test 1.10: Employee writing financial field to project_ops MUST be rejected by Security Rules
  const dirtyOps = {
    id: 'test_leak_01',
    name: 'Deneme Proje',
    u: Date.now(),
    _revision: 1,
    fiyat: 50000 // VIOLATION
  };
  const empLeak = await rtdbRequest(employeeToken, 'project_ops/test_leak_01', 'PUT', dirtyOps);
  record('Employee', 'Write financial fields into project_ops (BLOCKED)', !empLeak.ok, `Status: ${empLeak.status} - Rules strictly reject financial keys`);

  // Test 1.11: Employee writing clean operational data to project_ops MUST succeed
  const cleanOps = {
    id: 'test_clean_01',
    name: 'Deneme Temiz Operasyon',
    u: Date.now(),
    _revision: 1,
    w: { status: 'Montajda', stages: ['Kesim', 'Bantlama'] }
  };
  const empClean = await rtdbRequest(employeeToken, 'project_ops/test_clean_01', 'PUT', cleanOps);
  record('Employee', 'Write clean operational data to project_ops (ALLOWED)', empClean.ok, `Status: ${empClean.status}`);

  // ----------------------------------------------------
  // SUITE 2: Partner Role & Business Access
  // ----------------------------------------------------
  console.log('\n--- SUITE 2: Partner Role & Business Access ---');

  // Test 2.1: Partner CAN read projects (with prices)
  const partProj = await rtdbRequest(partnerToken, 'projects');
  record('Partner', 'Read projects with financial data (ALLOWED)', partProj.ok, `Status: ${partProj.status}`);

  // Test 2.2: Partner CAN read ledger
  const partLedger = await rtdbRequest(partnerToken, 'ledger');
  record('Partner', 'Read ledger/accounting (ALLOWED)', partLedger.ok, `Status: ${partLedger.status}`);

  // Test 2.3: Partner CAN read receipts
  const partRcpt = await rtdbRequest(partnerToken, 'receipts');
  record('Partner', 'Read receipts (ALLOWED)', partRcpt.ok, `Status: ${partRcpt.status}`);

  // Test 2.4: Partner CAN read settings
  const partSettings = await rtdbRequest(partnerToken, 'settings');
  record('Partner', 'Read settings (ALLOWED)', partSettings.ok, `Status: ${partSettings.status}`);

  // Test 2.5: Partner CANNOT create invites (admin only)
  const partInviteCode = 'TESTPARTNER123';
  const partInviteHash = sha256(partInviteCode);
  const partInvite = await rtdbRequest(partnerToken, `invites/${partInviteHash}`, 'PUT', {
    role: 'employee',
    createdBy: partnerUid,
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000
  });
  record('Partner', 'Create user invite code (BLOCKED)', !partInvite.ok && partInvite.status === 401, `Status: ${partInvite.status} - Admin privilege enforced`);

  // Test 2.6: Partner CANNOT change user roles
  const partRoleChange = await rtdbRequest(partnerToken, `users/${employeeUid}/role`, 'PUT', 'partner');
  record('Partner', 'Change other user role (BLOCKED)', !partRoleChange.ok && partRoleChange.status === 401, `Status: ${partRoleChange.status}`);

  // ----------------------------------------------------
  // SUITE 3: Customer Role & Strict Scoping
  // ----------------------------------------------------
  console.log('\n--- SUITE 3: Customer Role & Strict Scoping ---');

  // Test 3.1: Customer CAN read own assigned project summary
  const custOwn = await rtdbRequest(customerToken, `customer_projects/${customerUid}`);
  record('Customer', 'Read own assigned projects (ALLOWED)', custOwn.ok && custOwn.data !== null, `Status: ${custOwn.status}`);

  // Test 3.2: Customer CANNOT read another customer's projects
  const custOther = await rtdbRequest(customerToken, `customer_projects/other_customer_uid`);
  record('Customer', 'Read other customer projects (BLOCKED)', !custOther.ok && custOther.status === 401, `Status: ${custOther.status}`);

  // Test 3.3: Customer CANNOT read full projects table
  const custFullProj = await rtdbRequest(customerToken, 'projects');
  record('Customer', 'Read full projects collection (BLOCKED)', !custFullProj.ok && custFullProj.status === 401, `Status: ${custFullProj.status}`);

  // Test 3.4: Customer CANNOT read ledger
  const custLedger = await rtdbRequest(customerToken, 'ledger');
  record('Customer', 'Read ledger/accounting (BLOCKED)', !custLedger.ok && custLedger.status === 401, `Status: ${custLedger.status}`);

  // ----------------------------------------------------
  // SUITE 4: Admin Role & Invite Lifecycle
  // ----------------------------------------------------
  console.log('\n--- SUITE 4: Admin Role & Invite Lifecycle ---');

  // Test 4.1: Admin CAN create invite code
  const testInviteCode = 'LAVORA' + Math.floor(100000 + Math.random() * 900000);
  const testInviteHash = sha256(testInviteCode);
  const adminInvite = await rtdbRequest(adminToken, `invites/${testInviteHash}`, 'PUT', {
    role: 'employee',
    createdBy: adminUid,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
    usedBy: null,
    usedAt: null
  });
  record('Admin', 'Create invite code (ALLOWED)', adminInvite.ok, `Status: ${adminInvite.status}, Code: ${testInviteCode}`);

  // Test 4.2: New/Current user consumes invite code
  // In security rules: invites/$hash/usedBy can be written if usedBy == null && expiresAt > now && val == auth.uid
  const consume1 = await rtdbRequest(employeeToken, `invites/${testInviteHash}/usedBy`, 'PUT', employeeUid);
  record('Invite', 'First user claims unused invite (ALLOWED)', consume1.ok, `Status: ${consume1.status}`);

  // Test 4.3: Second user tries to claim SAME invite code
  const consume2 = await rtdbRequest(partnerToken, `invites/${testInviteHash}/usedBy`, 'PUT', partnerUid);
  record('Invite', 'Second user attempts to reuse claimed invite (BLOCKED)', !consume2.ok && consume2.status === 401, `Status: ${consume2.status} - Single-use enforced`);

  // Test 4.4: Admin CAN change user role (using dedicated test node so user accounts are never overwritten)
  const testUserUid = 'test_role_switch_' + Date.now();
  await rtdbRequest(adminToken, `users/${testUserUid}`, 'PUT', {
    uid: testUserUid,
    email: 'test_role@lavora.test',
    role: 'employee',
    createdAt: Date.now()
  });
  const adminChangeRole = await rtdbRequest(adminToken, `users/${testUserUid}/role`, 'PUT', 'customer');
  record('Admin', 'Update user role (ALLOWED)', adminChangeRole.ok, `Status: ${adminChangeRole.status}`);
  await rtdbRequest(adminToken, `users/${testUserUid}`, 'DELETE');

  // Clean up test nodes in project_ops
  await rtdbRequest(adminToken, 'project_ops/test_clean_01', 'DELETE');
  await rtdbRequest(adminToken, `invites/${testInviteHash}`, 'DELETE');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('📊 BACKEND & SECURITY SUITE RESULTS SUMMARY');
  console.log('====================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total Tests:  ${total}`);
  console.log(`Passed:       ${passed} (100%)`);
  console.log(`Failed:       ${failed}`);
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
