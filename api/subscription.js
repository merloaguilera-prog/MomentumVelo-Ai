const Stripe = require("stripe");
const { getAuthenticatedUser } = require("./_clerk");
const { isPremiumSubscription, hasPremiumAccess, billingMode } = require("./_billing");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PREMIUM_PRICE_ID) return res.status(503).json({ error: "Stripe no está configurado." });
  if (!process.env.CLERK_SECRET_KEY) return res.status(503).json({ error: "La verificación de cuenta no está configurada." });
  const mode = billingMode();
  if (mode === null) return res.status(503).json({ error: "La configuración de facturación no corresponde a este entorno." });
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!/^cs_(test_|live_)/.test(sessionId)) return res.status(400).json({ error: "Referencia de pago no válida." });
  if (!sessionId.startsWith(mode ? "cs_live_" : "cs_test_")) return res.status(400).json({ error: "La referencia de pago no corresponde a este entorno." });
  const authenticatedUser = await getAuthenticatedUser(req);
  if (!authenticatedUser) return res.status(401).json({ active: false, error: "Inicia sesión para verificar tu suscripción." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.client_reference_id !== authenticatedUser.userId) {
      return res.status(403).json({ active: false, error: "Inicia sesión con la cuenta que realizó el pago." });
    }
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const subscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price", "latest_invoice"] })
      : null;
    const sessionCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscriptionCustomerId = typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id;
    const matches = session.livemode === mode && subscription?.livemode === mode
      && session.status === "complete" && session.mode === "subscription"
      && session.metadata?.clerkUserId === authenticatedUser.userId
      && subscription?.metadata?.clerkUserId === authenticatedUser.userId
      && subscription?.metadata?.plan === "premium-monthly"
      && Boolean(sessionCustomerId && sessionCustomerId === subscriptionCustomerId)
      && isPremiumSubscription(subscription, process.env.STRIPE_PREMIUM_PRICE_ID);
    if (matches && session.payment_status === "unpaid"
        && ["active", "incomplete"].includes(subscription.status)
        && subscription.latest_invoice?.status === "open") {
      return res.status(202).json({ active: false, pending: true,
        message: "Tu pago sigue pendiente de confirmación. Premium se activará cuando Stripe lo confirme." });
    }
    const active = matches && session.payment_status === "paid"
      && hasPremiumAccess(subscription, process.env.STRIPE_PREMIUM_PRICE_ID);
    if (!active) return res.status(402).json({ active: false, error: "La suscripción todavía no figura como activa." });
    return res.status(200).json({ active: true, email: session.customer_details?.email || null, telegramUrl: process.env.TELEGRAM_PREMIUM_INVITE_URL || null });
  } catch (error) { console.error("subscription_verification_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(500).json({ error: "No se ha podido verificar la suscripción." }); }
};
