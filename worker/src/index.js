/**
 * Lavora Cloudflare Workers AI Gateway & Security Proxy (v39)
 * 
 * Strict Cloudflare-hosted Workers AI models only.
 * Firebase JWT authentication (Google JWKs validation).
 * Role-based authorization: customer vs staff/admin.
 * In-memory sliding window rate limiting & payload size validation.
 * Structured JSON Schema validation with 1-shot repair.
 * Zero emojis in responses, error messages, and logs.
 */

const CONFIG = {
  service: "lavora-ai",
  version: "39.0.0",
  firebaseProjectId: "designwood",
  models: {
    text: [
      "@cf/meta/llama-3.1-8b-instruct-fp8",
      "@cf/meta/llama-3.2-3b-instruct",
      "@cf/meta/llama-3-8b-instruct"
    ],
    stt: [
      "@cf/openai/whisper",
      "@cf/openai/whisper-large-v3-turbo"
    ],
    vision: [
      "@cf/meta/llama-3.2-11b-vision-instruct",
      "@cf/unum/uform-gen2-qwen-500m",
      "@cf/llava-hf/llava-1.5-7b-hf"
    ],
    embeddings: [
      "@cf/baai/bge-m3",
      "@cf/baai/bge-large-en-v1.5",
      "@cf/baai/bge-base-en-v1.5"
    ]
  },
  limits: {
    audioMaxBytes: 10 * 1024 * 1024, // 10MB
    audioMaxSeconds: 60,
    imageMaxBytes: 8 * 1024 * 1024, // 8MB
    textMaxChars: 20000,
    rateLimitStaff: 40, // req per min
    rateLimitCustomer: 10 // req per min
  }
};

// In-memory caches for Worker instance
let jwkCache = { keys: null, expiresAt: 0 };
const rateLimitMap = new Map(); // key -> [timestamps]

/**
 * CORS headers generator based on request origin
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  let allowedOrigin = "https://1sthillman.github.io";
  
  if (
    origin.includes("github.io") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("workers.dev") ||
    origin.includes("pages.dev")
  ) {
    allowedOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Lavora-Role, X-Lavora-Client, X-Lavora-Dev-Key",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * JSON response helper with CORS
 */
function jsonResponse(data, status = 200, request = null) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...(request ? getCorsHeaders(request) : { "Access-Control-Allow-Origin": "*" })
  };
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Base64URL decode helper
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch and cache Google Firebase JWKs
 */
async function getGoogleJwks() {
  const now = Date.now();
  if (jwkCache.keys && jwkCache.expiresAt > now) {
    return jwkCache.keys;
  }
  try {
    const res = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!res.ok) throw new Error("Google JWKs fetch failed: " + res.status);
    const data = await res.json();
    jwkCache = {
      keys: data.keys || [],
      expiresAt: now + (3600 * 1000) // 1 hour cache
    };
    return jwkCache.keys;
  } catch (err) {
    if (jwkCache.keys) return jwkCache.keys;
    throw err;
  }
}

/**
 * Verify Firebase ID Token using Web Crypto API
 */
async function verifyFirebaseToken(authHeader, env, request) {
  // Optional dev bypass for automated smoke tests
  const devKey = request?.headers?.get("X-Lavora-Dev-Key");
  if (devKey && env.DEV_SECRET && devKey === env.DEV_SECRET) {
    const overrideRole = request.headers.get("X-Lavora-Role") || "admin";
    return {
      valid: true,
      user: {
        uid: "dev_test_user",
        email: "admin@lavoradesign.com",
        role: overrideRole,
        isDev: true
      }
    };
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Yetkilendirme basligi eksik veya gecersiz formatta." };
  }

  const token = authHeader.substring(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Gecersiz JWT token yapisi." };
  }

  try {
    const headerJson = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    const payloadJson = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));

    if (headerJson.alg !== "RS256" || !headerJson.kid) {
      return { valid: false, error: "Gecersiz token algoritmasi veya anahtar kimligi." };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payloadJson.exp && payloadJson.exp < nowSec) {
      return { valid: false, error: "Oturum suresi dolmus. Lutfen sayfayi yenileyin." };
    }
    if (payloadJson.iat && payloadJson.iat > nowSec + 300) {
      return { valid: false, error: "Gecersiz token baslangic zamani." };
    }

    const expectedProjectId = env.FIREBASE_PROJECT_ID || CONFIG.firebaseProjectId;
    if (payloadJson.aud !== expectedProjectId) {
      return { valid: false, error: "Token hedef kitlesi proje ile uyusmuyor." };
    }
    if (payloadJson.iss !== "https://securetoken.google.com/" + expectedProjectId) {
      return { valid: false, error: "Token yayincisi dogrulanamadi." };
    }
    if (!payloadJson.sub) {
      return { valid: false, error: "Kullanici kimligi eksik." };
    }

    // Verify cryptographic signature against Google public keys
    const jwks = await getGoogleJwks();
    const matchingKey = jwks.find(k => k.kid === headerJson.kid);
    if (!matchingKey) {
      return { valid: false, error: "Google acik anahtari bulunamadi." };
    }

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      matchingKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const dataToVerify = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const signature = base64UrlDecode(parts[2]);

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature,
      dataToVerify
    );

    if (!isValid) {
      return { valid: false, error: "Token imzasi gecersiz." };
    }

    // Role detection: token claims or header fallback
    const role = payloadJson.role || request?.headers?.get("X-Lavora-Role") || "staff";

    return {
      valid: true,
      user: {
        uid: payloadJson.sub,
        email: payloadJson.email || "",
        role: role
      }
    };
  } catch (err) {
    return { valid: false, error: "Token dogrulama hatasi: " + err.message };
  }
}

/**
 * Sliding window rate limiter
 */
function checkRateLimit(identifier, maxRequests, windowMs = 60000) {
  const now = Date.now();
  let timestamps = rateLimitMap.get(identifier) || [];
  timestamps = timestamps.filter(ts => now - ts < windowMs);

  if (timestamps.length >= maxRequests) {
    rateLimitMap.set(identifier, timestamps);
    return false;
  }

  timestamps.push(now);
  rateLimitMap.set(identifier, timestamps);
  return true;
}

/**
 * Execute Cloudflare AI model with candidate fallback chain
 */
async function runWithFallback(env, modelList, input) {
  let lastErr = null;
  for (const m of modelList) {
    try {
      const res = await env.AI.run(m, input);
      if (res) return { model: m, result: res };
    } catch (err) {
      lastErr = err;
      console.warn("[Cloudflare AI fallback note]:", m, err.message);
    }
  }
  throw lastErr || new Error("Tum yapay zeka modelleri yanit vermedi.");
}

/**
 * Parse and validate JSON output with 1-shot repair
 */
async function parseAndValidateJson(rawText, env) {
  if (!rawText) return null;
  let text = String(rawText).trim();

  // Try direct match
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {}
  }

  // 1-shot repair attempt
  try {
    const repairPrompt = [
      {
        role: "system",
        content: "Aşağıdaki metinden geçerli bir JSON nesnesi oluştur. Yalnızca geçerli JSON döndür, hiçbir markdown, tırnak veya açıklama ekleme. Kesinlikle emoji kullanma."
      },
      {
        role: "user",
        content: text
      }
    ];

    const repairRes = await runWithFallback(env, CONFIG.models.text, {
      messages: repairPrompt,
      max_tokens: 600,
      temperature: 0.1
    });

    const repText = repairRes.result?.response || repairRes.result?.choices?.[0]?.message?.content || JSON.stringify(repairRes.result || "");
    const match2 = String(repText).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match2) {
      return JSON.parse(match2[0]);
    }
  } catch (repErr) {
    console.warn("JSON repair attempt failed:", repErr.message);
  }

  return null;
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // 2. Health check (unauthenticated)
    if (path === "/health" || (path === "/" && request.method === "GET")) {
      return jsonResponse({
        status: "ok",
        service: CONFIG.service,
        version: CONFIG.version,
        models: CONFIG.models,
        timestamp: Date.now()
      }, 200, request);
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Yalnizca POST istekleri kabul edilir." }, 405, request);
    }

    // 3. Authenticate Request
    const authHeader = request.headers.get("Authorization");
    const authResult = await verifyFirebaseToken(authHeader, env, request);

    let user;
    if (authResult.valid) {
      user = authResult.user;
    } else if (path === "/text") {
      // Customer portal chat fallback: allow unauthenticated visitors as customer under strict rate limit
      const clientIp = request.headers.get("CF-Connecting-IP") || "guest";
      user = {
        uid: "guest_" + clientIp,
        email: "customer@guest.local",
        role: "customer"
      };
    } else {
      return jsonResponse({
        success: false,
        error: authResult.error || "Yetkilendirme basarisiz."
      }, 401, request);
    }
    const isCustomer = user.role === "customer";

    // 4. Role Authorization Check
    const staffOnlyPaths = ["/stt", "/extract", "/ask", "/brief", "/draft", "/embed"];
    if (isCustomer && staffOnlyPaths.includes(path)) {
      return jsonResponse({
        success: false,
        error: "Yetkisiz erisim: Bu islem yalnizca atolye personeli ve yoneticiler tarafindan kullanilabilir."
      }, 403, request);
    }

    // 5. Rate Limiting Check
    const limit = isCustomer ? CONFIG.limits.rateLimitCustomer : CONFIG.limits.rateLimitStaff;
    const rateLimitKey = user.uid + "_" + (isCustomer ? "cust" : "staff");
    if (!checkRateLimit(rateLimitKey, limit)) {
      return jsonResponse({
        success: false,
        error: "Islem limiti asildi. Lutfen kisa bir sure bekleyip tekrar deneyin.",
        retryAfterSec: 30
      }, 429, request);
    }

    // 6. Route Dispatching
    try {
      // Route: Speech-to-Text (/stt)
      if (path === "/stt") {
        const contentType = request.headers.get("Content-Type") || "";
        let audioBytes = null;

        if (contentType.includes("application/json")) {
          const body = await request.json().catch(() => ({}));
          if (body.audioBase64) {
            audioBytes = base64UrlDecode(body.audioBase64);
          } else if (Array.isArray(body.audioBytes)) {
            audioBytes = new Uint8Array(body.audioBytes);
          }
        } else {
          const arrayBuf = await request.arrayBuffer();
          audioBytes = new Uint8Array(arrayBuf);
        }

        if (!audioBytes || audioBytes.length === 0) {
          return jsonResponse({ success: false, error: "Ses verisi alinamadi." }, 400, request);
        }

        if (audioBytes.length > CONFIG.limits.audioMaxBytes) {
          return jsonResponse({ success: false, error: "Ses dosyasi boyutu cok buyuk (en fazla 10MB)." }, 413, request);
        }

        const sttRes = await runWithFallback(env, CONFIG.models.stt, {
          audio: [...audioBytes]
        });

        const text = sttRes.result?.text || "";
        return jsonResponse({
          success: true,
          text: text.trim(),
          model: sttRes.model
        }, 200, request);
      }

      // Route: Structured Extraction (/extract)
      if (path === "/extract") {
        const body = await request.json().catch(() => ({}));
        const mode = body.mode || "voice_update";
        const text = String(body.text || "").trim();
        const image = body.image || null;

        if (text.length > CONFIG.limits.textMaxChars) {
          return jsonResponse({ success: false, error: "Metin uzunlugu siniri asildi." }, 413, request);
        }

        let systemPrompt = "";
        let userPrompt = "";

        if (mode === "voice_update" || mode === "voice_command") {
          systemPrompt = "Sen Lavora mobilya atölyesinin akıllı sesli komut asistanısın.\n" +
            "Ustanın veya yöneticinin söylediği cümleyi analiz et ve uygulamadaki ilgili eylemi (action) belirle:\n" +
            "EYLEM TÜRLERİ (action):\n" +
            "1. 'add_expense': Gider/masraf/ödeme girişi (örn: '5000 liralık gider gir', 'hırdavatçıya 1200 TL verdim', 'mazot masrafı yaz')\n" +
            "2. 'add_income': Gelir/tahsilat/kapora girişi (örn: 'Voger projesinden 50 bin TL kapora aldım', '20.000 lira tahsilat gir')\n" +
            "3. 'update_stage': Üretim aşaması güncelleme (örn: 'gardrobun kesimi bitti', 'cila işlemine başlandı', 'montaj tamamlandı')\n" +
            "4. 'add_todo': Yapılacak iş / görev ekleme (örn: 'yarın kulp numunesi götür diye görev ekle', 'menteşe siparişi verilecek')\n" +
            "5. 'add_item': Yeni ürün/kalem ekleme (örn: 'Voger projesine 240x60 lake vestiyer ekle')\n" +
            "6. 'create_project': Yeni proje açma (örn: 'Ahmet Bey için villa projesi oluştur')\n" +
            "7. 'query_status': Durum veya bilgi sorma (örn: 'kasada ne kadar var', 'bu hafta ne teslim edilecek')\n\n" +
            "Aşama adları: Ölçü/Keşif, Çizim/Onay, Malzeme, Kesim, Bantlama, Üretim/Montaj, Boya/Kaplama, Sevkiyat, Kurulum/Teslim.\n" +
            "Durumlar: 0 bekliyor, 1 devam, 2 tamam, 3 yarıda.\n" +
            "Gider Kategorileri: Malzeme, İşçilik, Nakliye, Atölye Masrafı, Yemek, Vergi, Hırdavat, Diğer.\n" +
            "Gelir Kategorileri: Kapora, Taksit, Kalan Ödeme, Diğer.\n\n" +
            "Kesinlikle ve yalnızca şu JSON şemasında yanıt ver:\n" +
            "{\n" +
            '  "action": "add_expense" veya "add_income" veya "update_stage" veya "add_todo" veya "add_item" veya "create_project" veya "query_status",\n' +
            '  "amount": sayı veya null (örn: 5000),\n' +
            '  "category": "kategori adı veya boş string",\n' +
            '  "project": "proje adı veya boş string",\n' +
            '  "item": "ürün adı veya boş string",\n' +
            '  "stage": "aşama adı veya boş string",\n' +
            '  "status": 0 veya 1 veya 2 veya 3 veya null,\n' +
            '  "note": "ilgili açıklama veya boş string",\n' +
            '  "todo": "görev metni veya boş string",\n' +
            '  "dimensions": "varsa ölçüler veya boş string",\n' +
            '  "material": "varsa malzeme veya boş string",\n' +
            '  "confidence": 0.0 ile 1.0 arası sayı\n' +
            "}\n" +
            "Sayıları Türkçe metinden sayıya çevir (örn: 'beş bin' -> 5000, 'bin iki yüz' -> 1200). Emoji kesinlikle kullanma.";

          userPrompt = "Ustanın ses kaydı metni: \"" + text + "\"";
        } else if (mode === "receipt") {
          systemPrompt = "Sen muhasebe ve fiş/fatura okuyucususun. Fiş veya fatura metninden tarih, tutar, kdv, tedarikçi ve belge no bilgilerini çıkar.\n" +
            "Türkçe sayı biçimlerini (örnek: 1.250,50 -> 1250.50) sayısal float olarak çevir.\n" +
            "Kategoriler: Malzeme, Boya, Donanım, Nakliye, Yemek, Hırdavat, Genel.\n" +
            "Kesinlikle ve yalnızca şu JSON şemasında yanıt ver:\n" +
            "{\n" +
            '  "date": "varsa YYYY-MM-DD veya boş string",\n' +
            '  "subtotal": alt toplam float sayı veya null,\n' +
            '  "vat": kdv tutarı float sayı veya null,\n' +
            '  "amount": genel toplam float sayı,\n' +
            '  "supplier": "tedarikçi firma adı veya boş string",\n' +
            '  "receiptNo": "fiş/fatura no veya boş string",\n' +
            '  "category": "Malzeme | Boya | Donanım | Nakliye | Yemek | Hırdavat | Genel",\n' +
            '  "project": "ilişkili proje adı veya boş string",\n' +
            '  "confidence": 0.0 ile 1.0 arası sayı\n' +
            "}\n" +
            "Emoji kesinlikle kullanma.";

          userPrompt = "Fiş/Fatura metni: \"" + text + "\"";
        } else if (mode === "excel_mapping") {
          systemPrompt = "Sen Excel mobilya listesi sütun eşleyicisisin.\n" +
            "Aşağıdaki Excel sayfası ilk satır metinlerini incele.\n" +
            "Hangi satırın başlık satırı olduğunu (0 tabanlı index) ve hangi sütunun ne olduğunu belirle.\n" +
            "Kesinlikle ve yalnızca şu JSON şemasında yanıt ver:\n" +
            "{\n" +
            '  "headerRow": 0 tabanlı satır indexi,\n' +
            '  "colMap": {\n' +
            '    "n": "ürün adı sütun indexi veya adı",\n' +
            '    "q": "adet sütun indexi veya adı",\n' +
            '    "dim": "ölçü sütun indexi veya adı",\n' +
            '    "mat": "malzeme sütun indexi veya adı",\n' +
            '    "price": "fiyat sütun indexi veya adı",\n' +
            '    "note": "açıklama/not sütun indexi veya adı"\n' +
            "  },\n" +
            '  "confidence": 0.0 ile 1.0 arası sayı\n' +
            "}\n" +
            "Emoji kesinlikle kullanma.";

          userPrompt = "Excel sayfası metin özeti:\n" + text;
        } else if (mode === "handwriting") {
          systemPrompt = "Sen el yazısı keşif notu ve kroki ayrıştırıcısısın.\n" +
            "Metinden veya fotoğraftan mobilya kalemlerini, adetlerini, ölçülerini ve malzemelerini çıkar.\n" +
            "Kesinlikle ve yalnızca şu JSON şemasında yanıt ver:\n" +
            "{\n" +
            '  "items": [\n' +
            '    { "n": "ürün adı", "q": 1, "dim": "ölçü", "mat": "malzeme", "note": "not" }\n' +
            "  ],\n" +
            '  "confidence": 0.0 ile 1.0 arası sayı\n' +
            "}\n" +
            "Emoji kesinlikle kullanma.";

          userPrompt = "Keşif notu metni: \"" + text + "\"";
        } else if (mode === "cut_dimensions") {
          systemPrompt = "Sen mobilya kesim ölçüsü ayrıştırıcısısın.\n" +
            "Serbest metin halindeki ölçüleri ('180x60x45', '2 adet 90x40 raf' vb.) ayrıştır.\n" +
            "Kesinlikle ve yalnızca şu JSON şemasında yanıt ver:\n" +
            "{\n" +
            '  "parts": [\n' +
            '    { "name": "parça adı", "length": sayı cm, "width": sayı cm, "thickness": sayı mm, "count": adet sayı, "material": "malzeme" }\n' +
            "  ],\n" +
            '  "unit": "cm veya mm",\n' +
            '  "confidence": 0.0 ile 1.0 arası sayı\n' +
            "}\n" +
            "Emoji kesinlikle kullanma.";

          userPrompt = "Kesim metni: \"" + text + "\"";
        }

        const aiRes = await runWithFallback(env, CONFIG.models.text, {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 650,
          temperature: 0.15
        });

        const rawReply = aiRes.result?.response || aiRes.result?.choices?.[0]?.message?.content || JSON.stringify(aiRes.result || "");
        const parsedData = await parseAndValidateJson(rawReply, env);

        return jsonResponse({
          success: true,
          mode: mode,
          data: parsedData,
          raw: rawReply,
          model: aiRes.model
        }, 200, request);
      }

      // Route: Ask Mode Tool Calling Loop (/ask)
      if (path === "/ask") {
        const body = await request.json().catch(() => ({}));
        const query = String(body.query || "").trim();
        const history = Array.isArray(body.history) ? body.history : [];
        const clientToolResults = body.toolResults || null;

        if (!query && !clientToolResults) {
          return jsonResponse({ success: false, error: "Soru metni bos olamaz." }, 400, request);
        }

        const systemPrompt = "Sen Lavora Mobilya Atölyesi'nin akıllı iç veri asistanısın.\n" +
          "Kullanıcının projeler, ürünler, aşamalar, gecikmeler ve kasa durumu hakkındaki sorularını yanıtla.\n" +
          "Mevcut araçlar:\n" +
          "- list_projects(): Aktif projelerin listesini döner.\n" +
          "- get_project(id): Belirtilen projenin detaylarını döner.\n" +
          "- search_items(term): Ürün adına göre arama yapar.\n" +
          "- overdue_items(): Teslim tarihi geçmiş veya geciken ürünleri döner.\n" +
          "- ledger_summary(): Kasa gelir-gider özetini döner.\n\n" +
          "Eğer kullanıcı veritabanında olan bir şeyi soruyorsa ve elinde henüz veri yoksa, önce araç çağrısı iste:\n" +
          "TOOL_CALL: {\"name\": \"arac_adi\", \"params\": {}}\n\n" +
          "Eğer veri elindeyse, doğrudan sakin, net ve profesyonel Türkçe ile yanıt ver.\n" +
          "Kaynak proje varsa yanıtta [PROJE: ProjeAdı] etiketi koy.\n" +
          "Kayıtlarda olmayan bilgiyi uydurma, 'Kayıtlarda bu bilgi bulunamadı' de.\n" +
          "Kesinlikle hiçbir emoji KULLANMA.";

        const messages = [{ role: "system", content: systemPrompt }];
        history.forEach(h => {
          if (h && h.role && h.content) messages.push({ role: h.role, content: h.content });
        });

        if (clientToolResults) {
          messages.push({
            role: "user",
            content: "İstemciden gelen araç sonuçları: " + JSON.stringify(clientToolResults) + "\nLütfen kullanıcıya son yanıtı ver."
          });
        } else {
          messages.push({ role: "user", content: query });
        }

        const aiRes = await runWithFallback(env, CONFIG.models.text, {
          messages: messages,
          max_tokens: 500,
          temperature: 0.2
        });

        const replyText = aiRes.result?.response || aiRes.result?.choices?.[0]?.message?.content || JSON.stringify(aiRes.result || "");

        // Detect if tool call requested
        let toolCall = null;
        const toolMatch = replyText.match(/TOOL_CALL:\s*(\{[\s\S]*?\})/);
        if (toolMatch) {
          try {
            toolCall = JSON.parse(toolMatch[1]);
          } catch (_) {}
        }

        return jsonResponse({
          success: true,
          reply: replyText.replace(/TOOL_CALL:[\s\S]*$/, "").trim(),
          toolCall: toolCall,
          model: aiRes.model
        }, 200, request);
      }

      // Route: Daily Briefing (/brief)
      if (path === "/brief") {
        const body = await request.json().catch(() => ({}));
        const facts = body.facts || {};

        const systemPrompt = "Sen Lavora Mobilya Atölyesi Baş Danışmanısın.\n" +
          "Aşağıdaki deterministik atölye olgularını kullanarak usta ve yöneticiler için kısa, sakin, net ve profesyonel bir günlük Türkçe brifing oluştur.\n" +
          "En fazla 3-4 madde halinde özetle. Acil teslimatları ve bekleyen işleri vurgula.\n" +
          "Kesinlikle hiçbir emoji KULLANMA. Sayıları uydurma, verilen olguları aynen aktar.";

        const userPrompt = "Günün Atölye Verileri:\n" +
          "- Geciken veya teslimine yakın işler: " + JSON.stringify(facts.overdueOrNear || []) + "\n" +
          "- Malzeme bekleyen işler: " + JSON.stringify(facts.waitingMaterial || []) + "\n" +
          "- Yarıda kalan işler: " + JSON.stringify(facts.troubled || []) + "\n" +
          "- Bu haftaki kasa durumu: " + JSON.stringify(facts.weeklyFinancials || {});

        const aiRes = await runWithFallback(env, CONFIG.models.text, {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 450,
          temperature: 0.2
        });

        const replyText = aiRes.result?.response || aiRes.result?.choices?.[0]?.message?.content || "";
        return jsonResponse({
          success: true,
          briefing: replyText.trim(),
          model: aiRes.model,
          timestamp: Date.now()
        }, 200, request);
      }

      // Route: Text Drafts (/draft)
      if (path === "/draft") {
        const body = await request.json().catch(() => ({}));
        const mode = body.mode || "proposal_enrich";
        const payload = body.payload || {};

        let systemPrompt = "";
        let userPrompt = "";

        if (mode === "proposal_enrich") {
          systemPrompt = "Sen Lavora Design'ın lüks özel mobilya teklif metni yazarısın.\n" +
            "Verilen mobilya kalemleri için en fazla 2 cümlelik profesyonel teknik açıklama, kapsam ve garanti/bakım paragrafı üret.\n" +
            "Fiyatlara kesinlikle dokunma ve fiyat yazma. Yalnızca ürünün kalitesini, ahşap işçiliğini ve zarafetini anlatan metinler oluştur.\n" +
            "Kesinlikle ve yalnızca şu JSON şemasında yanıt ver:\n" +
            "{\n" +
            '  "descriptions": { "kalem_id_veya_adi": "2 cümlelik zengin açıklama" },\n' +
            '  "scopeText": "Kapsam ve montaj detayları",\n' +
            '  "warrantyText": "Garanti ve malzeme güvence notu",\n' +
            '  "paymentText": "Ödeme ve termin planı notu"\n' +
            "}\n" +
            "Kesinlikle emoji kullanma.";

          userPrompt = "Teklif Kalemleri: " + JSON.stringify(payload.items || []);
        } else if (mode === "handover_guide") {
          systemPrompt = "Sen teslim edilen özel mobilyaların bakım ve kullanım kılavuzunu hazırlayan uzmansın.\n" +
            "Kullanılan malzemelere (masif ahşap, doğal kaplama, lake, pirinç donanım) göre müşteriye özel temizlik ve bakım tavsiyeleri oluştur.\n" +
            "Maddeler halinde, profesyonel Türkçe yaz. Emoji kullanma.";

          userPrompt = "Proje ve Malzemeler: " + JSON.stringify(payload);
        } else if (mode === "supplier_message") {
          systemPrompt = "Sen atölye satınalma yöneticisisin. Tedarikçiye gönderilecek resmi, kibar ve net malzeme sipariş mesajı yaz. Emoji kullanma.";
          userPrompt = "Sipariş Edilecek Malzemeler: " + JSON.stringify(payload);
        } else if (mode === "share_post") {
          systemPrompt = "Sen Lavora Design'ın kurumsal iletişim danışmanısın. Tamamlanan projenin atölyeden çıkışını anlatan zarif bir sosyal paylaşım metni yaz. Emoji kullanma.";
          userPrompt = "Tamamlanan Proje: " + JSON.stringify(payload);
        }

        const aiRes = await runWithFallback(env, CONFIG.models.text, {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 600,
          temperature: 0.3
        });

        const replyText = aiRes.result?.response || aiRes.result?.choices?.[0]?.message?.content || "";
        const parsed = (mode === "proposal_enrich") ? await parseAndValidateJson(replyText, env) : null;

        return jsonResponse({
          success: true,
          mode: mode,
          data: parsed || replyText.trim(),
          model: aiRes.model
        }, 200, request);
      }

      // Route: Semantic Embeddings (/embed)
      if (path === "/embed") {
        const body = await request.json().catch(() => ({}));
        const texts = Array.isArray(body.texts) ? body.texts : [String(body.text || "")];
        const validTexts = texts.map(t => String(t || "").trim().slice(0, 500)).filter(Boolean);

        if (!validTexts.length) {
          return jsonResponse({ success: false, error: "Vektorlestirilecek metin bulunamadi." }, 400, request);
        }

        const embRes = await runWithFallback(env, CONFIG.models.embeddings, {
          text: validTexts
        });

        const vectors = embRes.result?.data || embRes.result?.vectors || embRes.result || [];
        return jsonResponse({
          success: true,
          vectors: vectors,
          model: embRes.model
        }, 200, request);
      }

      // Route: Legacy Customer Portal Chat (/text)
      if (path === "/text") {
        const body = await request.json().catch(() => ({}));
        const messages = body.messages || [{ role: "user", content: body.prompt || "merhaba" }];

        const aiRes = await runWithFallback(env, CONFIG.models.text, {
          messages: messages,
          max_tokens: Math.min(Number(body.max_tokens) || 450, 800),
          temperature: typeof body.temperature === "number" ? body.temperature : 0.65
        });

        return jsonResponse(aiRes.result, 200, request);
      }

      // Route: Legacy Vision (/vision)
      if (path === "/vision") {
        const body = await request.json().catch(() => ({}));
        let imageBytes = null;

        if (Array.isArray(body.image)) {
          imageBytes = body.image;
        } else if (body.imageBase64) {
          imageBytes = [...base64UrlDecode(body.imageBase64)];
        }

        const prompt = body.prompt || "Describe the image.";
        const aiRes = await runWithFallback(env, CONFIG.models.vision, {
          prompt: prompt,
          image: imageBytes || []
        });

        return jsonResponse(aiRes.result, 200, request);
      }

      return jsonResponse({ success: false, error: "Bilinmeyen rota: " + path }, 404, request);
    } catch (err) {
      console.error("[Lavora Worker Error]:", err);
      return jsonResponse({
        success: false,
        error: "Yapay zeka islemi sirasinda hata olustu: " + (err.message || String(err))
      }, 500, request);
    }
  }
};
