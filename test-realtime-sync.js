import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
const fbApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});
const auth = getAuth();
const db = getDatabase();

async function run() {
  console.log('--- Minting Custom Tokens ---');
  const adminToken = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2'); // minifinise (admin)
  const partnerToken = await auth.createCustomToken('wpS6BImMQ9cEpGxZG0onlBC5owg1'); // 2sthillman (partner)
  
  console.log('--- Launching Browser with 2 contexts ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });

  const ctxAdmin = await browser.createBrowserContext();
  const ctxPartner = await browser.createBrowserContext();

  const pageAdmin = await ctxAdmin.newPage();
  const pagePartner = await ctxPartner.newPage();

  pageAdmin.on('console', msg => console.log('  [ADMIN console]', msg.text().slice(0, 160)));
  pagePartner.on('console', msg => console.log('  [PARTNER console]', msg.text().slice(0, 160)));

  pageAdmin.on('pageerror', err => console.error('  [ADMIN error]', err.message));
  pagePartner.on('pageerror', err => console.error('  [PARTNER error]', err.message));

  console.log('--- Navigating both pages to localhost:3000 ---');
  await Promise.all([
    pageAdmin.goto('http://localhost:3000', { waitUntil: 'networkidle2' }),
    pagePartner.goto('http://localhost:3000', { waitUntil: 'networkidle2' })
  ]);

  console.log('--- Signing in Page Admin ---');
  await pageAdmin.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, adminToken);

  console.log('--- Signing in Page Partner ---');
  await pagePartner.evaluate(async (token) => {
    await firebase.auth().signInWithCustomToken(token);
  }, partnerToken);

  // Wait for both to be logged in and projects loaded
  await Promise.all([
    pageAdmin.waitForFunction(() => !!window.LV_ROLE && Array.isArray(window.P) && window.P.length > 0, { timeout: 15000 }),
    pagePartner.waitForFunction(() => !!window.LV_ROLE && Array.isArray(window.P) && window.P.length > 0, { timeout: 15000 })
  ]);

  console.log('Both signed in successfully! Now open Workbench for both on active project');

  const targetProjectId = await pageAdmin.evaluate(() => {
    const p = window.P.find(x => x.w && x.w.items && x.w.items.length) || window.P[0];
    if (p) {
      window.__lv.wshow(p);
      return p.id;
    }
    return null;
  });

  await pagePartner.evaluate((pid) => {
    const p = window.P.find(x => x.id === pid) || window.P[0];
    if (p) window.__lv.wshow(p);
  }, targetProjectId);

  await new Promise(r => setTimeout(r, 1500));

  // Check state on Partner before Admin change
  const partnerInitialState = await pagePartner.evaluate(() => {
    const wp = window.getWp();
    const item0 = wp?.w?.items?.[0];
    const buttonText = document.querySelector('.wnx[data-hold]')?.innerText?.replace(/\s+/g, ' ') || 'NO_BTN';
    return {
      itemId: item0?.id,
      itemName: item0?.n,
      st: item0?.st,
      buttonText
    };
  });
  console.log('Partner INITIAL state on project:', JSON.stringify(partnerInitialState, null, 2));

  console.log('--- Admin now completes next stage of item 0 ---');
  const adminResult = await pageAdmin.evaluate(() => {
    const wp = window.getWp();
    const it = wp.w.items[0];
    const s = wp.w.stages.find(st => (it.st[st.id] || 0) !== 2);
    const targetStage = s || wp.w.stages[0];
    const newVal = (targetStage === s) ? 2 : 0;
    it.st[targetStage.id] = newVal;
    window.__wl = { id: it.id, s: targetStage.id };
    window.wtt?.();
    window.wrender?.();
    return { completedStage: targetStage.n, stageId: targetStage.id, newVal, st: { ...it.st } };
  });
  console.log('Admin completed stage:', adminResult);

  console.log('--- Waiting up to 15 seconds to observe Partner page in real time ---');
  let partnerUpdated = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const partnerCurState = await pagePartner.evaluate((stageId) => {
      const wp = window.getWp();
      const item0 = wp?.w?.items?.[0];
      const buttonText = document.querySelector('.wnx[data-hold]')?.innerText?.replace(/\s+/g, ' ') || 'NO_BTN';
      return {
        val: item0?.st?.[stageId],
        buttonText
      };
    }, adminResult.stageId);
    if (partnerCurState?.val === adminResult.newVal) {
      console.log(`✅ PARTNER UPDATED IN REALTIME at ${(i + 1) * 500}ms! Stage: ${adminResult.completedStage} -> ${adminResult.newVal}. Button text: "${partnerCurState.buttonText}"`);
      partnerUpdated = true;
      break;
    }
  }

  if (!partnerUpdated) {
    console.log('❌ PARTNER DID NOT UPDATE IN REALTIME!');
    const finalPartnerState = await pagePartner.evaluate(() => {
      const wp = window.getWp();
      return {
        wp: wp ? { id: wp.id, u: wp.u, rev: wp._revision, opsRev: wp._opsRevision, item0St: wp?.w?.items?.[0]?.st } : null,
        wm: window.getWm(),
        P_item0St: window.P.find(x => x.id === 'mw2g44bdoge')?.w?.items?.[0]?.st,
        buttonText: document.querySelector('.wnx[data-hold]')?.innerText?.replace(/\s+/g, ' '),
        hasLV_APPLY_REMOTE: typeof window.LV_APPLY_REMOTE === 'function',
        hasLV_UNSUB: typeof window.LV_UNSUB === 'function'
      };
    });
    console.log('Final Partner state inspection:', JSON.stringify(finalPartnerState, null, 2));
  }

  await browser.close();
  process.exit(0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
