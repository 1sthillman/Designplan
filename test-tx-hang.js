import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});
const auth = getAuth();

async function run() {
  const token = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('  [Console]', msg.text()));
  page.on('pageerror', err => console.error('  [PageError]', err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(async (tok) => {
    await firebase.auth().signInWithCustomToken(tok);
  }, token);

  await page.waitForFunction(() => !!window.LV_ROLE, { timeout: 10000 });
  console.log('Logged in. Now testing transaction directly:');

  const result = await page.evaluate(async () => {
    try {
      const db = firebase.database();
      const ref = db.ref('tenants/lavora-main/projects/mw2g44bdoge/_revision');
      console.log('Path:', ref.toString());
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction TIMED OUT after 5s')), 5000)
      );
      
      const txPromise = ref.transaction(current => {
        console.log('Inside tx callback, current =', current);
        return (current || 0) + 1;
      });
      
      const res = await Promise.race([txPromise, timeoutPromise]);
      return { committed: res.committed, val: res.snapshot.val() };
    } catch(e) {
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('Transaction evaluation result:', result);
  await browser.close();
  process.exit(0);
}

run().catch(console.error);
