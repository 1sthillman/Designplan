import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const serviceAccount = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
const fbApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
}, 'photo-test-app');
const auth = getAuth(fbApp);
const db = getDatabase(fbApp);

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
    server.listen(3002, 'localhost', () => {
      resolve(server);
    });
  });
}

async function run() {
  console.log('====================================================');
  console.log('🔍 INVESTIGATING EXCEL PHOTO LIFECYCLE & REFRESH');
  console.log('====================================================\n');

  const server = await createServer();
  const adminToken = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    console.log('  [Browser]', msg.text());
  });

  page.on('pageerror', err => {
    console.error('  [PageError]:', err.message);
  });

  // 1. Login
  await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, adminToken);

  await page.waitForFunction(() => {
    const authEl = document.querySelector('#lv-auth');
    return authEl && authEl.hidden;
  }, { timeout: 15000 });

  console.log('✓ Logged in as Admin');

  // 2. Upload Excel
  console.log('\n--- Uploading 01-CUBE-BK VOGER 13+3 ODA.xls ---');
  const excelPath = path.resolve('./01-CUBE-BK VOGER 13+3 ODA.xls');
  const fileInput = await page.$('#fu');
  await fileInput.uploadFile(excelPath);

  // Wait for import preview
  await page.waitForFunction(() => {
    return document.querySelector('button[data-lvx="go"]');
  }, { timeout: 25000 });

  console.log('Clicking "Güvenli içe aktar"...');
  await page.$eval('button[data-lvx="go"]', b => b.click());
  await new Promise(r => setTimeout(r, 1000));
  const stillModal = await page.evaluate(() => !!document.querySelector('button[data-lvx="go"]'));
  if (stillModal) {
    await page.$eval('button[data-lvx="go"]', b => b.click());
  }

  // Wait 6 seconds for project import and photo processing
  console.log('Waiting 6 seconds for import and photo processing...');
  await new Promise(r => setTimeout(r, 6000));

  // 3. Inspect In-Memory Project & Photos
  const memReport = await page.evaluate(async () => {
    const p = typeof cur !== 'undefined' && cur ? cur : (typeof P !== 'undefined' && P.length ? P[P.length - 1] : null);
    if (!p) return { error: 'No project found in P or cur', hasP: typeof P !== 'undefined', pLen: typeof P !== 'undefined' ? P.length : 0 };
    const items = p.w?.items || [];
    const itemsWithPhotos = items.filter(i => i.ph && i.ph.length);
    const photoIds = items.flatMap(i => i.ph || []);
    
    // Check IndexedDB
    let idbPhotos = [];
    try {
      idbPhotos = await window.LV_DB.tx('readonly', s => s.getAllKeys(), 'wph');
    } catch (e) {
      idbPhotos = ['error: ' + e.message];
    }

    return {
      projectId: p.id,
      projectName: p.name,
      totalItems: items.length,
      itemsWithPhotosCount: itemsWithPhotos.length,
      sampleItemsWithPhotos: itemsWithPhotos.slice(0, 5).map(i => ({ name: i.n, sheet: i.sh, ph: i.ph })),
      totalPhotoIds: photoIds.length,
      idbPhotoKeysCount: Array.isArray(idbPhotos) ? idbPhotos.length : idbPhotos
    };
  });

  console.log('\n📊 MEMORY & LOCAL STATE BEFORE REFRESH:');
  console.log(JSON.stringify(memReport, null, 2));

  // 4. Inspect Firebase RTDB directly via Admin SDK
  console.log('\n🔍 INSPECTING FIREBASE REALTIME DATABASE DIRECTLY:');
  const projectsSnap = await db.ref('tenants/lavora-main/projects').once('value');
  const projects = projectsSnap.val() || {};
  const projectList = Object.values(projects);
  console.log(`Total projects in Firebase RTDB: ${projectList.length}`);
  
  const lastProject = projectList[projectList.length - 1];
  if (lastProject) {
    const fbItems = lastProject.w?.items || [];
    const fbItemsWithPh = fbItems.filter(i => i.ph && i.ph.length);
    const fbItemsWithPhData = fbItems.filter(i => i.phData && i.phData.length);
    console.log(`Firebase Last Project: "${lastProject.name}" (ID: ${lastProject.id})`);
    console.log(`  Items count in Firebase: ${fbItems.length}`);
    console.log(`  Items with .ph in Firebase: ${fbItemsWithPh.length}`);
    console.log(`  Items with .phData in Firebase: ${fbItemsWithPhData.length}`);
  }

  const wphSnap = await db.ref('tenants/lavora-main/workflow_photos').once('value');
  const wphData = wphSnap.val() || {};
  console.log(`Total photos stored in tenants/lavora-main/workflow_photos node: ${Object.keys(wphData).length}`);

  // 5. TRIGGER REFRESH (F5) AND OBSERVE!
  console.log('\n🔄 TRIGGERING PAGE REFRESH (F5)...');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait 5 seconds after refresh (remember the 3-second self-heal timeout!)
  console.log('Waiting 5 seconds after refresh for Firebase sync & self-heal...');
  await new Promise(r => setTimeout(r, 5000));

  // 6. Inspect In-Memory Project & Photos AFTER REFRESH
  const afterRefreshReport = await page.evaluate(async () => {
    const p = typeof cur !== 'undefined' && cur ? cur : (typeof P !== 'undefined' && P.length ? P[P.length - 1] : null);
    if (!p) return { error: 'No project found in P or cur', hasP: typeof P !== 'undefined', pLen: typeof P !== 'undefined' ? P.length : 0 };
    const items = p.w?.items || [];
    const itemsWithPhotos = items.filter(i => i.ph && i.ph.length);
    const photoIds = items.flatMap(i => i.ph || []);
    
    let idbPhotos = [];
    try {
      idbPhotos = await window.LV_DB.tx('readonly', s => s.getAllKeys(), 'wph');
    } catch (e) {
      idbPhotos = ['error: ' + e.message];
    }

    // Also check image elements in DOM
    const imgElements = document.querySelectorAll('img[data-wp]');
    const visibleImgs = Array.from(imgElements).filter(img => img.src && !img.src.includes('data:image/svg'));

    return {
      projectName: p.name,
      totalItems: items.length,
      itemsWithPhotosCount: itemsWithPhotos.length,
      sampleItemsWithPhotos: itemsWithPhotos.slice(0, 5).map(i => ({ name: i.n, sheet: i.sh, ph: i.ph })),
      totalPhotoIds: photoIds.length,
      idbPhotoKeysCount: Array.isArray(idbPhotos) ? idbPhotos.length : idbPhotos,
      domImgDataWpCount: imgElements.length,
      domVisibleImgsCount: visibleImgs.length
    };
  });

  console.log('\n📊 MEMORY & LOCAL STATE AFTER REFRESH (F5):');
  console.log(JSON.stringify(afterRefreshReport, null, 2));

  await browser.close();
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
