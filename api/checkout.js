const Stripe = require("stripe");
const { getAuthenticatedUser, getUserStripeCustomerId } = require("./_clerk");
const { isPremiumPrice, isPremiumSubscription } = require("./_billing");

function getSiteUrl() {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
  }
  return "https://momentum-velo.vercel.app";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const premiumSalesEnabled = process.env.PREMIUM_SALES_ENABLED === "true";
  if (!premiumSalesEnabled) {
    return res.status(503).json({
      error: "Premium está en preparación. La contratación se abrirá cuando sus funciones estén verificadas.",
      helpUrl: "/ayuda?tema=premium#contacto"
    });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!process.env.CLERK_SECRET_KEY || !secretKey || !priceId || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "La contratación Premium todavía no está configurada." });
  }
  const authenticatedUser = await getAuthenticatedUser(req);
  if (!authenticatedUser) {
    return res.status(401).json({
      error: "Inicia sesión en tu cuenta antes de activar Premium."
    });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2026-08-26.dahlia" });
    const price = await stripe.prices.retrieve(priceId);
    if (!isPremiumPrice(price, priceId)) {
      return res.status(503).json({ error: "El precio Premium de 49 €/mes no está configurado correctamente." });
    }
    const customerId = await getUserStripeCustomerId(authenticatedUser.userId);
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      if (subscriptions.data.some((subscription) => isPremiumSubscription(subscription, priceId)
        && ["active", "trialing", "past_due", "incomplete"].includes(subscription.status))) {
        return res.status(409).json({ error: "Ya tienes una suscripción Premium. Puedes gestionarla desde tu cuenta." });
      }
    }
    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel`,
      customer: customerId || undefined,
      client_reference_id: authenticatedUser?.userId || undefined,
      metadata: {
        plan: "premium-monthly",
        clerkUserId: authenticatedUser?.userId || ""
      },
      subscription_data: {
        metadata: {
          plan: "premium-monthly",
          clerkUserId: authenticatedUser?.userId || ""
        }
      }
    });
    return res.status(200).json({
      url: session.url,
      mode: "subscription",
      plan: "premium-monthly",
      source: "checkout-session"
    });
  } catch (error) {
    console.error("checkout_session_error", {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(502).json({
      error: "No se ha podido preparar el pago seguro. Inténtalo de nuevo en unos instantes."
    });
  }
};
