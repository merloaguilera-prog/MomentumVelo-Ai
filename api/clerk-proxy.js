function decodeFrontendApiDomain(publishableKey) {
  try {
    const encoded = String(publishableKey || "").split("_")[2] || "";
    return Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  } catch (_error) {
    return "";
  }
}

function originalClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

module.exports = async function handler(req, res) {
  const secretKey = process.env.CLERK_SECRET_KEY || "";
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const frontendApiDomain = decodeFrontendApiDomain(publishableKey);

  if (!secretKey || !frontendApiDomain) {
    return res.status(503).json({ error: "Clerk proxy is not configured." });
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path || "");
  const search = new URL(req.url, "https://proxy.local").searchParams;
  search.delete("path");
  const query = search.toString();
  const target = `https://${frontendApiDomain}/${path}${query ? `?${query}` : ""}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (["host", "content-length", "connection"].includes(lower) || value == null) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "momentum-velo.vercel.app");
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  headers["Clerk-Proxy-Url"] = `${proto}://${host}/__clerk`;
  headers["Clerk-Secret-Key"] = secretKey;
  headers["X-Forwarded-For"] = originalClientIp(req);

  const method = String(req.method || "GET").toUpperCase();
  const init = { method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    init.body = Buffer.concat(chunks);
  }

  const upstream = await fetch(target, init);
  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const location = upstream.headers.get("location");
  if (location && location.startsWith(`https://${frontendApiDomain}/`)) {
    res.setHeader("location", location.replace(`https://${frontendApiDomain}`, `${proto}://${host}/__clerk`));
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  return res.end(body);
};
