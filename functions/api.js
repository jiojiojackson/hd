// functions/api.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 获取 KV 绑定 (需要在 Pages 设置中绑定 NAV_KV)
  const KV = env.NAV_KV;
  
  // 获取环境变量中的密码 (需要在 Pages 设置中添加 ADMIN_PASSWORD)
  const PASSWORD = env.ADMIN_PASSWORD || "admin123";

  // 1. GET 请求：获取数据
  if (request.method === "GET") {
    const data = await KV.get("data");
    return new Response(data || '{"categories":[], "items":[]}', {
      headers: { "Content-Type": "application/json" },
    });
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
      return new Response("Error parsing JSON", { status: 400 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
