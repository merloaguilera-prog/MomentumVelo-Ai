const Stripe = require("stripe");
const { getAuthenticatedUser, getUserStripeCustomerId } = require("./_clerk");
const { billingMode, getBillingSiteUrl } = require("./_billing");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.CLERK_SECRET_KEY) return res.status(503).json({ error: "La gestión segura de Premium no está configurada." });
  const mode = billingMode();
  if (mode === null) return res.status(503).json({ error: "La configuración de facturación no corresponde a este entorno." });
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) return res.status(401).json({ error: "Inicia sesión para gestionar Premium." });
    const siteUrl = getBillingSiteUrl();
    const customerId = await getUserStripeCustomerId(authenticatedUser.userId);
    if (!customerId) return res.status(404).json({ error: "No encontramos una suscripción vinculada a esta cuenta." });
    if (sessionId) {
      if (!/^cs_(test_|live_)/.test(sessionId)) return res.status(400).json({ error: "Referencia no válida." });
      if (!sessionId.startsWith(mode ? "cs_live_" : "cs_test_")) return res.status(400).json({ error: "La referencia no corresponde a este entorno." });
      const checkout = await stripe.checkout.sessions.retrieve(sessionId);
      const checkoutCustomer = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
      if (checkout.livemode !== mode || checkout.client_reference_id !== authenticatedUser.userId || checkoutCustomer !== customerId) {
        return res.status(403).json({ error: "La referencia no pertenece a esta cuenta." });
      }
    }
    if (!customerId) return res.status(400).json({ error: "No se encontró el cliente de Stripe." });
    const returnPath = sessionId ? `/success?session_id=${encodeURIComponent(sessionId)}` : "/login?mode=account";
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${siteUrl}${returnPath}` });
    return res.status(200).json({ url: portal.url });
  } catch (error) { console.error("billing_portal_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(500).json({ error: "No se ha podido abrir la gestión de la suscripción." }); }
};
