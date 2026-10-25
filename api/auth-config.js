const { clerkKeys } = require("./_clerk-config");
const { billingMode, getBillingSiteUrl } = require("./_billing");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const publishableKey = clerkKeys().publishableKey || "";
  const secretKey = clerkKeys().secretKey || "";
  if (Boolean(publishableKey) !== Boolean(secretKey)
      || (process.env.CLERK_USE_PROXY === "false" && (!publishableKey || !secretKey))) {
    return res.status(503).json({ error: "La configuración de acceso seguro está incompleta." });
  }
  if (publishableKey && secretKey) {
    const publicMode = /^pk_(live|test)_/.exec(publishableKey)?.[1];
    const secretMode = /^sk_(live|test)_/.exec(secretKey)?.[1];
    if (!publicMode || !secretMode || publicMode !== secretMode) {
      return res.status(503).json({ error: "La configuración de acceso seguro no es coherente." });
    }
  }
  let premiumSalesEnabled = false;
  if (publishableKey && secretKey && process.env.PREMIUM_SALES_ENABLED === "true"
      && process.env.STRIPE_PREMIUM_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET
      && billingMode() !== null) {
    try { getBillingSiteUrl(); premiumSalesEnabled = true; } catch (_error) {}
  }
  return res.status(200).json({
    enabled: Boolean(publishableKey && secretKey),
    publishableKey: publishableKey || null,
    proxyEnabled: process.env.CLERK_USE_PROXY !== "false",
    premiumSalesEnabled
  });
};
