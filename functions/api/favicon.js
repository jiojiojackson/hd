export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: "Missing url parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    let finalTargetUrl = targetUrl;
    if (!targetUrl.startsWith('http')) {
        finalTargetUrl = 'https://' + targetUrl;
    }

    let hostname;
    try {
        hostname = new URL(finalTargetUrl).hostname;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid URL" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const cacheKey = `icon:${hostname}`;
    const KV = env.NAV_KV;

    // 1. 尝试从 KV 缓存中获取
    if (KV) {
        try {
            const cached = await KV.get(cacheKey);
            if (cached) {
                return new Response(JSON.stringify({ icon: cached, cached: true }), {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    }
                });
            }
        } catch (e) {
            console.error("KV get error:", e);
        }
    }

    // 2. 抓取网站图标
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒压缩

        const response = await fetch(finalTargetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        clearTimeout(timeoutId);
        const html = await response.text();

        // 尝试寻找各种图标标签
        const iconPatterns = [
            /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
            /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
            /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["']/i
        ];

        let iconUrl = "";
        for (const pattern of iconPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                iconUrl = match[1];
                break;
            }
        }

        if (!iconUrl) {
            // 如果没找到，尝试默认的 /favicon.ico
            iconUrl = "/favicon.ico";
        }
        // 处理相对路径
        if (iconUrl && !iconUrl.startsWith('http')) {
            const base = new URL(finalTargetUrl);
            if (iconUrl.startsWith('//')) {
                iconUrl = base.protocol + iconUrl;
            } else if (iconUrl.startsWith('/')) {
                iconUrl = base.origin + iconUrl;
            } else {
                iconUrl = base.origin + '/' + iconUrl;
            }
        }

        // 验证图标是否真实存在 (可选，但建议)
        // 这里我们简单相信它，或者你可以再做一个 head 请求验证

        // 3. 存入 KV 缓存
        if (KV && iconUrl) {
            try {
                await KV.put(cacheKey, iconUrl, { expirationTtl: 60 * 60 * 24 * 30 }); // 缓存30天
            } catch (e) {
                console.error("KV put error:", e);
            }
        }

        return new Response(JSON.stringify({ icon: iconUrl, cached: false }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        // 失败时尝试默认的 favicon.ico
        const base = new URL(finalTargetUrl);
        const fallbackIcon = `${base.origin}/favicon.ico`;

        return new Response(JSON.stringify({ icon: fallbackIcon, error: error.message }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
