const { billingMode, getBillingSiteUrl } = require("./_billing");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const secretKey = process.env.CLERK_SECRET_KEY || "";
  if (Boolean(publishableKey) !== Boolean(secretKey)) {
    return res.status(503).json({ error: "La configuración de acceso seguro está incompleta." });
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
    premiumSalesEnabled
  });
};
