module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  return res.status(200).json({
    enabled: Boolean(publishableKey && process.env.CLERK_SECRET_KEY),
    publishableKey: publishableKey || null
  });
};
