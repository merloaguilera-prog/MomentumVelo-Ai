const Stripe = require("stripe");
const { getAuthenticatedUser } = require("./_clerk");

const VERIFIED_PAYMENT_LINK = "https://buy.stripe.com/5kQdR89oW8fA3Mn7Tm2VG01";

function getSiteUrl() {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
  }
  return "https://momentum-velo.vercel.app";
}

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const paymentLink = process.env.STRIPE_PAYMENT_LINK_URL || VERIFIED_PAYMENT_LINK;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  const managedAuthRequired = Boolean(process.env.CLERK_SECRET_KEY);
  const authenticatedUser = managedAuthRequired ? await getAuthenticatedUser(req) : null;

  if (managedAuthRequired && !authenticatedUser) {
    return res.status(401).json({
      error: "Inicia sesión en tu cuenta antes de activar Premium."
    });
  }

  if (!secretKey || !priceId) {
    return res.status(200).json({
      url: paymentLink,
      mode: "subscription",
      plan: "premium-monthly",
      source: "verified-payment-link"
    });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
    const siteUrl = getSiteUrl();
    const email = validEmail(req.body?.email);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel`,
      customer_email: email || undefined,
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
      },
      integration_identifier: "momentumvelo_web_qmztrkpa"
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
