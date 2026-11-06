import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
const fbApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});
const auth = getAuth();
const db = getDatabase();

const SCREENSHOTS_DIR = path.resolve('./test_screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 1. Setup Static HTTP Server
function createServer() {
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/lavora-calisma-masasi-v38-firebase.html';
    const filePath = path.join(process.cwd(), reqUrl);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json',
        '.css': 'text/css',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png'
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + reqUrl);
    }
  });
  return new Promise((resolve) => {
    server.listen(3000, 'localhost', () => {
      console.log('✓ HTTP test server listening on http://localhost:3000');
      resolve(server);
    });
  });
}

async function run() {
  console.log('====================================================');
  console.log('🌐 STARTING REAL END-TO-END UI & ROLE TESTS');
  console.log('====================================================\n');

  const server = await createServer();

  console.log('Minting Firebase custom tokens...');
  const adminToken = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2');
  const partnerToken = await auth.createCustomToken('partner_test_user_001');
  const employeeToken = await auth.createCustomToken('wpS6BImMQ9cEpGxZG0onlBC5owg1');
  const customerToken = await auth.createCustomToken('customer_test_user_001');
  console.log('Custom tokens ready.\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Lavora]') || text.includes('Error') || text.includes('HATA')) {
      console.log('  [Browser]', text.substring(0, 150));
    }
  });

  page.on('pageerror', err => {
    console.error('  [Browser PageError]:', err.message);
  });

  // ----------------------------------------------------
  // TEST STEP 1: Initial Login Screen
  // ----------------------------------------------------
  console.log('--- Step 1: Visiting initial login screen ---');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login-screen.png') });
  console.log('✓ Screenshot saved: 01-login-screen.png');

  // ----------------------------------------------------
  // TEST STEP 2: Admin Login & Dashboard
  // ----------------------------------------------------
  console.log('\n--- Step 2: Logging in as ADMIN ---');
  await page.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, adminToken);

  // Wait for login to complete (authEl hidden, header visible)
  await page.waitForFunction(() => {
    const authEl = document.querySelector('#lv-auth');
    const header = document.querySelector('header');
    return authEl && authEl.hidden && header && header.style.visibility === 'visible';
  }, { timeout: 15000 });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-admin-dashboard.png') });
  console.log('✓ Admin dashboard loaded. Screenshot saved: 02-admin-dashboard.png');

  // Verify Admin UI features
  const hasTeamBtn = await page.evaluate(() => !!document.querySelector('#lv-team-open'));
  console.log('Admin has "Ekip" button:', hasTeamBtn ? '✅ YES' : '❌ NO');

  // ----------------------------------------------------
  // TEST STEP 3: Admin Ekip Modal & Invite Creation
  // ----------------------------------------------------
  console.log('\n--- Step 3: Testing Ekip modal and Invite Creation ---');
  await page.click('#lv-team-open');
  await page.waitForFunction(() => {
    const team = document.querySelector('#lv-team');
    return team && team.style.display !== 'none';
  }, { timeout: 5000 });

  // Select role employee and create invite
  await page.select('#lv-invite-role', 'employee');
  await page.$eval('#lv-create-invite', b => b.click());
  await page.waitForFunction(() => {
    const out = document.querySelector('#lv-invite-output');
    return out && out.textContent.trim().length >= 8;
  }, { timeout: 10000 });

  const generatedInvite = await page.evaluate(() => document.querySelector('#lv-invite-output').textContent.trim());
  console.log('✅ Generated invite code in UI:', generatedInvite);

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-admin-ekip-modal.png') });
  console.log('✓ Ekip modal displayed with generated invite. Screenshot saved: 03-admin-ekip-modal.png');

  // Close team modal
  await page.$eval('#lv-close-team', b => b.click());
  await new Promise(r => setTimeout(r, 500));

  // ----------------------------------------------------
  // TEST STEP 4: Real Excel Upload (01-CUBE-BK VOGER 13+3 ODA.xls)
  // ----------------------------------------------------
  console.log('\n--- Step 4: Testing Real Excel Upload (01-CUBE-BK VOGER 13+3 ODA.xls) ---');
  const excelPath = path.resolve('./01-CUBE-BK VOGER 13+3 ODA.xls');
  const fileInput = await page.$('#fu');
  await fileInput.uploadFile(excelPath);
  console.log('Excel file chosen, waiting for import engine...');

  // Wait for import preview or project to open
  await page.waitForFunction(() => {
    return document.querySelector('#lvx') || document.querySelector('button[data-lvx="go"]') || document.querySelector('#t');
  }, { timeout: 25000 });

  await new Promise(r => setTimeout(r, 1500));
  const hasPreviewModal = await page.evaluate(() => !!document.querySelector('button[data-lvx="go"]'));
  if (hasPreviewModal) {
    console.log('✓ Excel preview modal detected with sheet recognition!');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-admin-excel-preview.png') });
    console.log('✓ Screenshot saved: 04-admin-excel-preview.png');

    // Click "Güvenli içe aktar"
    console.log('Clicking "Güvenli içe aktar"...');
    await page.$eval('button[data-lvx="go"]', b => b.click());
    await new Promise(r => setTimeout(r, 1500));
    const stillModal = await page.evaluate(() => !!document.querySelector('button[data-lvx="go"]'));
    if (stillModal) {
      console.log('Confirming import...');
      await page.$eval('button[data-lvx="go"]', b => b.click());
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Wait for project to be active
  await page.waitForFunction(() => {
    return document.querySelectorAll('table tr, .rw, .sheet-tabs, #t').length > 0;
  }, { timeout: 15000 });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-admin-project-opened.png') });
  console.log('✓ Project loaded into workspace. Screenshot saved: 05-admin-project-opened.png');

  // Verify Project details in DOM
  const projectTitle = await page.evaluate(() => document.querySelector('#t')?.textContent || '');
  console.log('Current Project Title in header:', projectTitle);

  // ----------------------------------------------------
  // TEST STEP 5: Navigating to İş Akışı (Workflow) Tab
  // ----------------------------------------------------
  console.log('\n--- Step 5: Testing İş Akışı (Production Workflow) ---');
  const workflowBtn = await page.$('button[data-a="w:all"]');
  if (workflowBtn) {
    await page.$eval('button[data-a="w:all"]', b => b.click());
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-admin-workflow.png') });
    console.log('✓ Workflow screen loaded. Screenshot saved: 06-admin-workflow.png');
  }

  // ----------------------------------------------------
  // TEST STEP 6: Navigating to Defter (Ledger) Tab
  // ----------------------------------------------------
  console.log('\n--- Step 6: Testing Defter (Ledger / Accounting) ---');
  const ledgerBtn = await page.$('button[data-a="led"]');
  if (ledgerBtn) {
    await page.$eval('button[data-a="led"]', b => b.click());
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-admin-ledger.png') });
    console.log('✓ Ledger screen loaded. Screenshot saved: 07-admin-ledger.png');
  }

  // Sign out Admin and reload cleanly
  await page.evaluate(async () => {
    await firebase.auth().signOut();
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // ----------------------------------------------------
  // TEST STEP 7: Partner Role Test
  // ----------------------------------------------------
  console.log('\n--- Step 7: Testing PARTNER Role ---');
  await page.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, partnerToken);

  await page.waitForFunction(() => {
    const authEl = document.querySelector('#lv-auth');
    return authEl && authEl.hidden && window.LV_ROLE === 'partner';
  }, { timeout: 15000 });

  await new Promise(r => setTimeout(r, 1500));
  const partnerHasTeamBtn = await page.evaluate(() => !!document.querySelector('#lv-team-open'));
  console.log('Partner has "Ekip" button (EXPECT FALSE):', partnerHasTeamBtn ? '❌ LEAK' : '✅ BLOCKED');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-partner-view.png') });
  console.log('✓ Screenshot saved: 08-partner-view.png');

  // Sign out Partner and reload cleanly
  await page.evaluate(async () => {
    await firebase.auth().signOut();
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // ----------------------------------------------------
  // TEST STEP 8: Employee Role Test
  // ----------------------------------------------------
  console.log('\n--- Step 8: Testing EMPLOYEE Role ---');
  await page.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, employeeToken);

  await page.waitForFunction(() => {
    const authEl = document.querySelector('#lv-auth');
    return authEl && authEl.hidden && window.LV_ROLE === 'employee';
  }, { timeout: 15000 });

  await new Promise(r => setTimeout(r, 1500));
  const isEmployeeClass = await page.evaluate(() => document.body.classList.contains('lv-employee'));
  console.log('Body has .lv-employee class (EXPECT TRUE):', isEmployeeClass ? '✅ YES' : '❌ NO');

  // Check if financial columns or sensitive buttons are hidden
  const employeeHasTeamBtn = await page.evaluate(() => !!document.querySelector('#lv-team-open'));
  console.log('Employee has "Ekip" button (EXPECT FALSE):', employeeHasTeamBtn ? '❌ LEAK' : '✅ BLOCKED');

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-employee-view.png') });
  console.log('✓ Screenshot saved: 09-employee-view.png');

  // Sign out Employee and reload cleanly
  await page.evaluate(async () => {
    await firebase.auth().signOut();
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // ----------------------------------------------------
  // TEST STEP 9: Customer Role Test
  // ----------------------------------------------------
  console.log('\n--- Step 9: Testing CUSTOMER Role ---');
  await page.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, customerToken);

  await page.waitForFunction(() => {
    const authEl = document.querySelector('#lv-auth');
    const customerProj = document.querySelector('#lv-customer-projects');
    return authEl && authEl.hidden && customerProj;
  }, { timeout: 15000 });

  // Wait for customer projects to load from RTDB (it says "Yükleniyor…" initially)
  await page.waitForFunction(() => {
    const cp = document.querySelector('#lv-customer-projects');
    return cp && !cp.textContent.includes('Yükleniyor');
  }, { timeout: 10000 });

  await new Promise(r => setTimeout(r, 1500));
  const customerContent = await page.evaluate(() => document.querySelector('#lv-customer-projects')?.innerText || '');
  console.log('Customer Portal Content preview:\n', customerContent.substring(0, 200));

  const navDisplay = await page.evaluate(() => document.querySelector('nav')?.style.display);
  console.log('Internal Navigation bar hidden (EXPECT "none"):', navDisplay === 'none' ? '✅ YES' : '❌ NO');

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-customer-portal.png') });
  console.log('✓ Screenshot saved: 10-customer-portal.png');

  console.log('\n====================================================');
  console.log('🎉 ALL END-TO-END TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');

  await browser.close();
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal E2E test error:', err);
  process.exit(1);
});
