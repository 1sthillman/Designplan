import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const CF_ACCOUNT_ID = '5884faaabbba129c726403c97e0511ed';

// ─── SELF-HEALING TOKEN POOL ────────────────────────────────────────────────
// Birden fazla Cloudflare API token tanımla.
// Bir token 10.000 nöron limitine ulaşınca sistem otomatik bir sonrakine geçer.
// Gece yarısı (UTC 00:00) tüm tokenlar sıfırlanır — exhaustedUntil ile takip edilir.
const CF_TOKENS = [
  process.env.CF_API_TOKEN || Buffer.from('Y2Z1dF9KMGY5Y0ZvdFhmOVVFOGZ2YlVocmZ0U0NUcmNiOGdsZWlVSmhSeUZ4YmRkODQ2YzE=', 'base64').toString('utf8'),
  Buffer.from('Y2Z1dF93UkFtRUxnR1R2SVJ4NVdXWlBMMm5aa2drbjlTN2g5U0thOW0xVVZNMjg1MDY1ZjA=', 'base64').toString('utf8'),
  Buffer.from('Y2Z1dF8zOGNnQ1lMQVl2RENocVdBRk9kMmRkZGxUWjlTNE9sYzJCMnIwajE5Nzg4ZTE5YzA=', 'base64').toString('utf8')
];

// Hangi tokenların ne zamana kadar tükendiğini tutar (timestamp ms)
const tokenExhaustedUntil = new Array(CF_TOKENS.length).fill(0);

// Aktif, kullanılabilir token döndürür. Hepsi tükenmişse null döner.
function getActiveToken() {
  const now = Date.now();
  for (let i = 0; i < CF_TOKENS.length; i++) {
    if (tokenExhaustedUntil[i] <= now) return { token: CF_TOKENS[i], idx: i };
  }
  return null;
}

// Bir tokeni tükenmiş olarak işaretle (gece yarısı UTC'ye kadar)
function markTokenExhausted(idx) {
  const now = new Date();
  // UTC gece yarısı + 10 dakika buffer
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 10, 0));
  tokenExhaustedUntil[idx] = midnight.getTime();
  console.log(`[TokenPool] Token #${idx + 1} tükendi. Sıfırlanma: ${midnight.toISOString()}. Kalan aktif token: ${CF_TOKENS.length - tokenExhaustedUntil.filter(t => t > Date.now()).length}/${CF_TOKENS.length}`);
}

// CF API isteği atar — tüm tokenleri sırayla dener
async function cfFetch(model, cfPayload) {
  let lastErr = null;
  for (let attempt = 0; attempt < CF_TOKENS.length; attempt++) {
    const active = getActiveToken();
    if (!active) break; // Hepsi tükendi
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${active.token}`,
            'Content-Type': 'application/json'
          },
          body: cfPayload
        }
      );
      const contentType = cfRes.headers.get('content-type') || 'application/json';
      if (contentType.includes('json')) {
        const json = await cfRes.json();
        // Nöron limiti (4006) veya auth hatası → bu tokeni tüket, sonrakine geç
        const isNeuronLimit = json.errors?.some(e => e.code === 4006 || /neurons|daily|limit/i.test(e.message || ''));
        const isAuthErr = json.errors?.some(e => e.code === 10000 || /auth/i.test(e.message || ''));
        if (isNeuronLimit || isAuthErr) {
          markTokenExhausted(active.idx);
          continue; // Sonraki tokeni dene
        }
        return { ok: cfRes.ok, json, binary: null };
      } else {
        const binary = Buffer.from(await cfRes.arrayBuffer());
        return { ok: cfRes.ok, json: null, binary };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Tüm Cloudflare tokenları tükendi');
}
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // Handle Cloudflare AI Proxy with Seamless High-Availability Fallback
  if (req.url.startsWith('/api/ai/')) {
    const endpoint = req.url.replace('/api/ai/', '');
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', async () => {
      let parsedBody = {};
      try { parsedBody = JSON.parse(bodyData || '{}'); } catch(e) {}

      // Helper function for fallback when Cloudflare has errors (e.g. daily neuron limit 4006)
      const executeFallback = async (reason) => {
        console.log(`[AI-Proxy] Falling back for endpoint "${endpoint}" due to:`, reason);
        try {
          if (endpoint === 'text') {
            const pollRes = await fetch('https://text.pollinations.ai/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: parsedBody.messages || [],
                model: 'openai'
              })
            });
            const pollText = await pollRes.text();
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
              success: true,
              result: { response: pollText }
            }));
            return true;
          } else if (endpoint === 'image') {
            const p = parsedBody.prompt || 'bespoke luxury furniture';
            // Pollinations.ai fallback with GET-based URL (no rate-limit per session when using unique seed)
            const seed = Math.floor(Math.random() * 999999);
            const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?nologo=true&width=1024&height=1024&seed=${seed}`;
            let imgRes;
            try { imgRes = await fetch(imgUrl); } catch(_) {}
            // If rate-limited, wait 10 seconds and retry once
            if (imgRes && imgRes.status === 402) {
              console.log('[AI-Proxy] Pollinations rate-limit 402, waiting 12s...');
              await new Promise(r => setTimeout(r, 12000));
              try { imgRes = await fetch(imgUrl + '&r=' + Date.now()); } catch(_) {}
            }
            if (imgRes && imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const b64 = buf.toString('base64');
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({
                success: true,
                result: { image: b64 }
              }));
              return true;
            }
          }
        } catch(fallbackErr) {
          console.error('[AI-Proxy] Fallback error:', fallbackErr);
        }
        return false;
      };

      try {
        let model = '@cf/meta/llama-3.1-8b-instruct';
        let cfPayload = bodyData;
        if (endpoint === 'image') {
          model = '@cf/black-forest-labs/flux-1-schnell';
          cfPayload = JSON.stringify({
            prompt: parsedBody.prompt || 'luxury bespoke furniture',
            steps: parsedBody.steps || parsedBody.num_steps || 4
          });
        } else if (endpoint === 'inpaint') {
          model = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
        } else if (endpoint === 'vision') {
          model = '@cf/llava-hf/llava-1.5-7b-hf';
        } else if (endpoint === 'text') {
          model = '@cf/meta/llama-3.1-8b-instruct';
        }

        // Self-healing token pool ile CF isteği
        const cfResult = await cfFetch(model, cfPayload);

        if (cfResult.json !== null) {
          const json = cfResult.json;
          // Hala hata varsa (bad input vb.) fallback
          if (!cfResult.ok || (json.errors && json.errors.length > 0)) {
            const errMsg = json.errors?.[0]?.message || 'CF error';
            console.log('[AI-Proxy] CF error after token pool:', errMsg);
            const handled = await executeFallback(errMsg);
            if (handled) return;
          }
          res.writeHead(cfResult.ok ? 200 : 400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(json));
        } else {
          if (!cfResult.ok) {
            const handled = await executeFallback('CF binary error');
            if (handled) return;
          }
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(cfResult.binary);
        }
      } catch (err) {
        const handled = await executeFallback(err.message);
        if (!handled) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }
    });
    return;
  }

  const urlPath = req.url.split('?')[0];
  let relativePath = decodeURIComponent(urlPath);
  
  if (relativePath === '/' || relativePath === '/index.html') {
    relativePath = '/lavora-calisma-masasi-v38-firebase.html';
  }
  
  const safePath = path.normalize(path.join(__dirname, relativePath));
  
  // Security check: ensure path stays within project directory
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }
  
  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + relativePath);
      return;
    }
    
    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    
    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`Lavora v38 Local Server running at:`);
  console.log(`  > Local:   http://localhost:${PORT}/`);
  console.log(`  > Network: http://127.0.0.1:${PORT}/`);
  console.log('====================================================');
});
