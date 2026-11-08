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
const CF_API_TOKEN = process.env.CF_API_TOKEN || Buffer.from('Y2Z1dF9KMGY5Y0ZvdFhmOVVFOGZ2YlVocmZ0U0NUcmNiOGdsZWlVSmhSeUZ4YmRkODQ2YzE=', 'base64').toString('utf8');

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
        
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: cfPayload
        });

        const contentType = cfRes.headers.get('content-type') || 'application/json';

        if (contentType.includes('json')) {
          const json = await cfRes.json();
          // Check if Cloudflare returned errors (e.g. 10,000 neurons limit 4006, or bad input)
          const hasErrors = !cfRes.ok || (json.errors && json.errors.length > 0);
          const errMsg = json.errors?.[0]?.message || ('CF HTTP ' + cfRes.status);
          if (hasErrors) {
            console.log('[AI-Proxy] CF error:', errMsg);
            const handled = await executeFallback(errMsg);
            if (handled) return;
          }
          res.writeHead(cfRes.ok ? 200 : cfRes.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(json));
        } else {
          if (!cfRes.ok) {
            const handled = await executeFallback('CF HTTP ' + cfRes.status);
            if (handled) return;
          }
          const buf = Buffer.from(await cfRes.arrayBuffer());
          res.writeHead(cfRes.status, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          res.end(buf);
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
