// functions/api.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 获取 KV 绑定 (需要在 Pages 设置中绑定 NAV_KV)
  const KV = env.NAV_KV;
  
  // 检查 KV 是否存在
  if (!KV) {
    return new Response(JSON.stringify({ error: "KV binding 'NAV_KV' not found. Please check your configuration." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 获取环境变量中的密码 (需要在 Pages 设置中添加 ADMIN_PASSWORD)
  const PASSWORD = env.ADMIN_PASSWORD || "admin123";

  // 1. GET 请求：获取数据
  if (request.method === "GET") {
    try {
      const data = await KV.get("data");
      return new Response(data || '{"categories":[], "items":[]}', {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to read from KV", details: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // 2. POST 请求：保存数据
  if (request.method === "POST") {
    const authHeader = request.headers.get("Authorization");
    
    // 简单验证
    if (authHeader !== `Bearer ${PASSWORD}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = await request.json();
      // 将数据存入 KV
      await KV.put("data", JSON.stringify(body));
      return new Response("Saved", { status: 200 });
    } catch (err) {
      return new Response(`Error saving data: ${err.message}`, { status: 400 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
