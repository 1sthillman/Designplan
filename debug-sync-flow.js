import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount), databaseURL: 'https://designwood-default-rtdb.firebaseio.com' });
const auth = getAuth();

async function run() {
  const adminToken = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2');
  const partnerToken = await auth.createCustomToken('wpS6BImMQ9cEpGxZG0onlBC5owg1');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });

  const ctxAdmin = await browser.createBrowserContext();
  const ctxPartner = await browser.createBrowserContext();

  const pageAdmin = await ctxAdmin.newPage();
  const pagePartner = await ctxPartner.newPage();

  pageAdmin.on('console', msg => console.log('  [ADMIN]', msg.text()));
  pagePartner.on('console', msg => console.log('  [PARTNER]', msg.text()));
  pageAdmin.on('pageerror', err => console.error('  [ADMIN ERR]', err.message));
  pagePartner.on('pageerror', err => console.error('  [PARTNER ERR]', err.message));

  console.log('Navigating to localhost:3000...');
  await Promise.all([
    pageAdmin.goto('http://localhost:3000', { waitUntil: 'networkidle2' }),
    pagePartner.goto('http://localhost:3000', { waitUntil: 'networkidle2' })
  ]);

  console.log('Logging in...');
  await Promise.all([
    pageAdmin.evaluate(t => firebase.auth().signInWithCustomToken(t), adminToken),
    pagePartner.evaluate(t => firebase.auth().signInWithCustomToken(t), partnerToken)
  ]);

  await Promise.all([
    pageAdmin.waitForFunction(() => !!window.LV_ROLE && window.P?.length > 0),
    pagePartner.waitForFunction(() => !!window.LV_ROLE && window.P?.length > 0)
  ]);

  console.log('Both logged in. Opening project mw2g44bdoge on both...');
  await Promise.all([
    pageAdmin.evaluate(() => {
      const p = window.P.find(x => x.id === 'mw2g44bdoge');
      if (p) window.__lv.wshow(p);
    }),
    pagePartner.evaluate(() => {
      const p = window.P.find(x => x.id === 'mw2g44bdoge');
      if (p) window.__lv.wshow(p);
    })
  ]);

  await new Promise(r => setTimeout(r, 1000));

  // Instrument Partner to log when RTDB listeners fire or LV_APPLY_REMOTE runs
  await pagePartner.evaluate(() => {
    console.log('[PARTNER INSTRUMENT] Instrumenting Partner sync...');
    const origApply = window.LV_APPLY_REMOTE;
    window.LV_APPLY_REMOTE = function(arr) {
      console.log('[PARTNER INSTRUMENT] LV_APPLY_REMOTE CALLED with ' + (arr?.length) + ' projects!');
      const p = arr?.find(x => x.id === 'mw2g44bdoge');
      console.log('[PARTNER INSTRUMENT] Remote mw2g44bdoge rev: ' + p?._revision + ' item0 st: ' + JSON.stringify(p?.w?.items?.[0]?.st));
      const res = origApply.apply(this, arguments);
      const curWp = window.getWp();
      console.log('[PARTNER INSTRUMENT] After LV_APPLY_REMOTE, Partner wp item0 st: ' + JSON.stringify(curWp?.w?.items?.[0]?.st));
      return res;
    };
  });

  // Admin toggles stage
  console.log('--- ADMIN CLICKING STAGE ---');
  const stageInfo = await pageAdmin.evaluate(() => {
    const wp = window.getWp();
    const it = wp.w.items[0];
    const s = wp.w.stages.find(st => (it.st[st.id] || 0) !== 2);
    const targetStage = s || wp.w.stages[0];
    const newVal = (targetStage === s) ? 2 : 0;
    targetStageVal = newVal;
    it.st[targetStage.id] = newVal;
    window.__wl = { id: it.id, s: targetStage.id };
    console.log('[ADMIN INSTRUMENT] Set stage ' + targetStage.n + ' to ' + newVal + ', calling wtt()');
    window.wtt?.();
    window.wrender?.();
    return { stageId: targetStage.id, stageName: targetStage.n, newVal };
  });
  console.log('Stage changed by Admin:', stageInfo);

  console.log('Waiting 10 seconds to observe Partner response...');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const pSt = await pagePartner.evaluate((sId) => {
      const it = window.getWp()?.w?.items?.[0];
      return it?.st?.[sId];
    }, stageInfo.stageId);
    if (pSt === stageInfo.newVal) {
      console.log(` SUCCESS! Partner received stage update at ${(i + 1) * 500}ms! Partner val: ${pSt}`);
      break;
    }
  }

  await browser.close();
}

run().catch(console.error);
