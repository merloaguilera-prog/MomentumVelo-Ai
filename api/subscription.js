const Stripe = require("stripe");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe no está configurado." });
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!/^cs_(test_|live_)/.test(sessionId)) return res.status(400).json({ error: "Referencia de pago no válida." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription", "line_items.data.price"] });
    const subscriptionStatus = typeof session.subscription === "object" ? session.subscription.status : null;
    const premiumLine = session.line_items?.data?.some((item) => item.price?.currency === "eur" && item.price?.unit_amount === 4900 && item.price?.recurring?.interval === "month");
    const active = session.status === "complete" && session.metadata?.plan === "premium-monthly" && premiumLine && ["active", "trialing"].includes(subscriptionStatus);
    if (!active) return res.status(402).json({ active: false, error: "La suscripción todavía no figura como activa." });
    return res.status(200).json({ active: true, email: session.customer_details?.email || null, telegramUrl: process.env.TELEGRAM_PREMIUM_INVITE_URL || null });
  } catch (error) { console.error("subscription_verification_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(500).json({ error: "No se ha podido verificar la suscripción." }); }
};
