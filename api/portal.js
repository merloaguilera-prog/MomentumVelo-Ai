const Stripe = require("stripe");
const { getAuthenticatedUser, getUserStripeCustomerId } = require("./_clerk");
function getSiteUrl() { if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, ""); if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`; return "https://momentum-velo.vercel.app"; }
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe no está configurado." });
  if (!process.env.CLERK_SECRET_KEY) return res.status(503).json({ error: "La gestión de Premium todavía no está configurada." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) return res.status(401).json({ error: "Inicia sesión para gestionar Premium." });
    const customerId = await getUserStripeCustomerId(authenticatedUser.userId);
    if (!customerId) return res.status(404).json({ error: "No encontramos una suscripción vinculada a esta cuenta." });
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${getSiteUrl()}/login?mode=account` });
    return res.status(200).json({ url: portal.url });
  } catch (error) { console.error("billing_portal_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(500).json({ error: "No se ha podido abrir la gestión de la suscripción." }); }
};
