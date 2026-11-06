import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const sa = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
const fbApp = initializeApp({
  credential: cert(sa),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});
const auth = getAuth();
const db = getDatabase();

async function debugUpload() {
  const adminToken = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2');
  
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => console.log('  [Browser]', msg.text()));
  page.on('pageerror', err => console.error('  [PageError]', err.message));

  console.log('Navigating to http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });

  console.log('Logging in...');
  await page.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, adminToken);

  await page.waitForFunction(() => {
    const authEl = document.querySelector('#lv-auth');
    const header = document.querySelector('header');
    return authEl && authEl.hidden && header && header.style.visibility === 'visible';
  }, { timeout: 15000 });

  console.log('Logged in! Uploading 01-CUBE-BK VOGER 13+3 ODA.xls ...');
  const fileInput = await page.$('input#fu');
  await fileInput.uploadFile('c:\\lavorasync\\01-CUBE-BK VOGER 13+3 ODA.xls');

  console.log('Waiting 15 seconds for upload and photo processing...');
  await new Promise(r => setTimeout(r, 15000));

  const stateBeforeRefresh = await page.evaluate(() => {
    const wpObj = window.wp || window.cur;
    return {
      wpId: wpObj?.id,
      itemsCount: wpObj?.w?.items?.length,
      itemsWithPh: wpObj?.w?.items?.filter(i => i.ph && i.ph.length).length,
      itemsWithPhData: wpObj?.w?.items?.filter(i => i.phData && i.phData.length).length,
      samplePh: wpObj?.w?.items?.[0]?.ph,
      samplePhData: wpObj?.w?.items?.[0]?.phData?.map(x => ({ id: x.id, thPrefix: x.th?.substring(0, 30) })),
      wcKeys: Object.keys(window.WC || {}).length,
      wcSampleKeys: Object.keys(window.WC || {}).slice(0, 5)
    };
  });
  console.log('State BEFORE refresh:', JSON.stringify(stateBeforeRefresh, null, 2));

  console.log('Reloading page...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  const stateAfterRefresh = await page.evaluate(() => {
    const P = window.P || [];
    const p = P[0];
    return {
      PCount: P.length,
      pId: p?.id,
      itemsCount: p?.w?.items?.length,
      itemsWithPh: p?.w?.items?.filter(i => i.ph && i.ph.length).length,
      itemsWithPhData: p?.w?.items?.filter(i => i.phData && i.phData.length).length,
      samplePh: p?.w?.items?.[0]?.ph,
      samplePhData: p?.w?.items?.[0]?.phData,
      wcKeys: Object.keys(window.WC || {}).length
    };
  });
  console.log('State AFTER refresh:', JSON.stringify(stateAfterRefresh, null, 2));

  await browser.close();
  process.exit(0);
}

debugUpload().catch(e => { console.error('Error:', e); process.exit(1); });
