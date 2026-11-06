import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(fs.readFileSync('./designwood-firebase-adminsdk-fbsvc-c90f45263a.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://designwood-default-rtdb.firebaseio.com'
});
const auth = getAuth();

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/lavora-calisma-masasi-v38-firebase.html';
  const filePath = path.join(process.cwd(), reqUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3002);

async function debug() {
  const adminToken = await auth.createCustomToken('ZXgrt2of21T03usxwN4RBbQsS2R2');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,900']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:3002');
  await page.evaluate(token => firebase.auth().signInWithCustomToken(token), adminToken);
  await page.waitForFunction(() => !!document.querySelector('#lv-team-open'), { timeout: 10000 });

  await page.click('#lv-team-open');
  await new Promise(r => setTimeout(r, 1000));

  console.log('Testing invite click and waiting up to 10s...');
  const res = await page.evaluate(async () => {
    const btn = document.querySelector('#lv-create-invite');
    console.log('Clicking button...');
    btn.click();
    
    // Check every 200ms for up to 10 seconds
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 200));
      const text = document.querySelector('#lv-invite-output')?.textContent;
      if (text) return { success: true, text, elapsed: (i+1)*200 };
    }
    return { success: false, text: document.querySelector('#lv-invite-output')?.textContent };
  });

  console.log('Result:', res);
  await browser.close();
  server.close();
  process.exit(0);
}
debug().catch(console.error);
