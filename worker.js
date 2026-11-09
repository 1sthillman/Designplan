export default {
  async fetch(request, env) {
    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // 2. Health check
    if (request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", service: "Lavora Cloudflare Workers AI Gateway" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 3. Process AI Request
    try {
      const body = await request.json().catch(() => ({}));
      const prompt = body.prompt || (body.messages && body.messages[body.messages.length - 1]?.content) || "";
      const messages = body.messages || [{ role: "user", content: prompt || "merhaba" }];

      const candidateModels = [
        "@cf/meta/llama-3.1-8b-instruct-fp8",
        "@cf/meta/llama-3.2-3b-instruct",
        "@cf/meta/llama-3-8b-instruct"
      ];

      let lastErr = null;
      for (const m of candidateModels) {
        try {
          const aiResponse = await env.AI.run(m, {
            messages: messages,
            max_tokens: 450,
            temperature: 0.65
          });
          if (aiResponse) {
            return new Response(JSON.stringify(aiResponse), {
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
        } catch (mErr) {
          lastErr = mErr;
        }
      }

      throw lastErr || new Error("All AI models failed");
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
