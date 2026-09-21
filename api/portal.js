const Stripe = require("stripe");
const { getAuthenticatedUser, getUserStripeCustomerId } = require("./_clerk");
function getSiteUrl() { if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, ""); if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`; return "https://momentum-velo.vercel.app"; }
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe no está configurado." });
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
    let customerId;
    if (process.env.CLERK_SECRET_KEY) {
      const authenticatedUser = await getAuthenticatedUser(req);
      if (!authenticatedUser) return res.status(401).json({ error: "Inicia sesión para gestionar Premium." });
      customerId = await getUserStripeCustomerId(authenticatedUser.userId);
      if (!customerId) return res.status(404).json({ error: "No encontramos una suscripción vinculada a esta cuenta." });
    } else {
      if (!/^cs_(test_|live_)/.test(sessionId)) return res.status(400).json({ error: "Referencia no válida." });
      const checkout = await stripe.checkout.sessions.retrieve(sessionId);
      customerId = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
    }
    if (!customerId) return res.status(400).json({ error: "No se encontró el cliente de Stripe." });
    const returnPath = sessionId ? `/success?session_id=${encodeURIComponent(sessionId)}` : "/login?mode=account";
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${getSiteUrl()}${returnPath}` });
    return res.status(200).json({ url: portal.url });
  } catch (error) { console.error("billing_portal_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(500).json({ error: "No se ha podido abrir la gestión de la suscripción." }); }
};
