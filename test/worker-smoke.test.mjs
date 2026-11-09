import assert from "node:assert";
import worker from "../worker/src/index.js";

console.log("=== WORKER SMOKE & SECURITY TESTS ===");

const mockEnv = {
  FIREBASE_PROJECT_ID: "designwood",
  DEV_SECRET: "test_dev_secret_12345",
  AI: {
    async run(model, input) {
      if (model.includes("whisper")) {
        return { text: "Gardrop boya aşamasına geçti montaj bekliyor" };
      }
      if (model.includes("bge")) {
        return { data: [[0.12, 0.45, -0.22, 0.89]] };
      }
      // Text generation
      const promptStr = JSON.stringify(input);
      if (promptStr.includes("sesli komut") || promptStr.includes("voice_update")) {
        return {
          response: JSON.stringify({
            project: "01-CUBE-BK VOGER 13+3 ODA",
            item: "GARDROP",
            stage: "Boya/Kaplama",
            status: 2,
            note: "Montaja hazır",
            todo: "",
            due: "",
            confidence: 0.95
          })
        };
      }
      if (promptStr.includes("muhasebe") || promptStr.includes("receipt") || promptStr.includes("Fiş/Fatura")) {
        return {
          response: JSON.stringify({
            date: "2026-11-08",
            subtotal: 1000.0,
            vat: 200.0,
            amount: 1200.0,
            supplier: "Yıldız Sunta MDF A.Ş.",
            receiptNo: "FAT-2026-881",
            category: "Malzeme",
            project: "Voger",
            confidence: 0.98
          })
        };
      }
      if (promptStr.includes("brifing") || promptStr.includes("Günün Atölye Verileri")) {
        return {
          response: "- Gardrop boya aşamasını tamamladı, montaj bekliyor.\n- 2 adet ürün için malzeme siparişi bekleniyor.\n- Bu hafta kasa dengesi pozitif."
        };
      }
      return { response: "Lavora atölye asistanı yanıtı." };
    }
  }
};

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Health check
  await test("GET /health returns 200 OK and model catalog without auth", async () => {
    const req = new Request("https://lavora.workers.dev/health", { method: "GET" });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.ok(data.models && data.models.text);
  });

  // 2. Unauthenticated request rejected
  await test("POST /extract without Authorization returns 401", async () => {
    const req = new Request("https://lavora.workers.dev/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "voice_update", text: "deneme" })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 401);
  });

  // 3. Invalid token rejected
  await test("POST /extract with invalid token returns 401", async () => {
    const req = new Request("https://lavora.workers.dev/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer invalid.fake.token"
      },
      body: JSON.stringify({ mode: "voice_update", text: "deneme" })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 401);
  });

  // 4. Customer role blocked from staff endpoint
  await test("POST /extract by Customer role returns 403 Forbidden", async () => {
    const req = new Request("https://lavora.workers.dev/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "customer"
      },
      body: JSON.stringify({ mode: "voice_update", text: "deneme" })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes("Yetkisiz erisim"));
  });

  // 5. Customer role permitted on /text (legacy customer chat)
  await test("POST /text by Customer role returns 200 OK", async () => {
    const req = new Request("https://lavora.workers.dev/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "customer"
      },
      body: JSON.stringify({ prompt: "Merhaba" })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200);
  });

  // 6. Staff role permitted on /extract (structured voice update)
  await test("POST /extract by Staff role returns structured data", async () => {
    const req = new Request("https://lavora.workers.dev/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "staff"
      },
      body: JSON.stringify({
        mode: "voice_update",
        text: "Voger projesinde gardrop boya bitti montaja geçtik"
      })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.item, "GARDROP");
    assert.strictEqual(data.data.stage, "Boya/Kaplama");
  });

  // 7. Receipt OCR & parsing extraction
  await test("POST /extract mode receipt returns parsed finance data", async () => {
    const req = new Request("https://lavora.workers.dev/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "admin"
      },
      body: JSON.stringify({
        mode: "receipt",
        text: "Yıldız Sunta MDF A.Ş. 08.11.2026 Toplam: 1.200 TL KDV: 200 TL"
      })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.data.amount, 1200.0);
    assert.strictEqual(data.data.vat, 200.0);
    assert.strictEqual(data.data.supplier, "Yıldız Sunta MDF A.Ş.");
  });

  // 8. Daily briefing endpoint (/brief)
  await test("POST /brief returns narrative summary", async () => {
    const req = new Request("https://lavora.workers.dev/brief", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "master"
      },
      body: JSON.stringify({
        facts: {
          overdueOrNear: ["Gardrop"],
          waitingMaterial: ["Masa tablası"],
          troubled: [],
          weeklyFinancials: { income: 50000, expense: 22000 }
        }
      })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.briefing.length > 10);
  });

  // 9. Semantic Embeddings (/embed)
  await test("POST /embed returns vector array", async () => {
    const req = new Request("https://lavora.workers.dev/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "staff"
      },
      body: JSON.stringify({ texts: ["Masif meşe çalışma masası"] })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.vectors));
  });

  // 10. Payload size limit
  await test("POST /extract with payload > 20000 chars returns 413", async () => {
    const hugeText = "a".repeat(25000);
    const req = new Request("https://lavora.workers.dev/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lavora-Dev-Key": "test_dev_secret_12345",
        "X-Lavora-Role": "admin"
      },
      body: JSON.stringify({ mode: "voice_update", text: hugeText })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.strictEqual(res.status, 413);
  });

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
