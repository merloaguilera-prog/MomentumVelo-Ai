const Stripe = require("stripe");
const MONTHLY_PRICE_EUR = 4900;

function getSiteUrl(req) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function validPaymentLink(value) {
  if (!value) return null;
  try { const url = new URL(value); return ["buy.stripe.com", "checkout.stripe.com"].includes(url.hostname) ? url.toString() : null; }
  catch { return null; }
}

async function findPremiumPrice(stripe) {
  if (process.env.STRIPE_PREMIUM_PRICE_ID) return process.env.STRIPE_PREMIUM_PRICE_ID;
  const prices = await stripe.prices.list({ active: true, type: "recurring", limit: 100, expand: ["data.product"] });
  const matches = prices.data.filter((price) => {
    const productName = typeof price.product === "object" ? price.product.name || "" : "";
    return price.currency === "eur" && price.unit_amount === MONTHLY_PRICE_EUR && price.recurring?.interval === "month" && /momentum\s*velo|premium/i.test(productName);
  });
  if (matches.length === 1) return matches[0].id;
  throw new Error("Configura STRIPE_PREMIUM_PRICE_ID con el precio mensual de 49 € de MomentumVelo Premium.");
}

function getConfigurationMessage(error) {
  if (!(error instanceof Error)) return null;
  if (error.message.startsWith("Configura STRIPE_PREMIUM_PRICE_ID")) return error.message;
  if (error.type === "StripeAuthenticationError") {
    return "La clave privada de Stripe configurada en Vercel no es válida. Revisa STRIPE_SECRET_KEY.";
  }
  if (error.type === "StripeInvalidRequestError" && error.code === "resource_missing") {
    return "El precio configurado no existe en esta cuenta de Stripe. Revisa STRIPE_PREMIUM_PRICE_ID.";
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido." }); }
  const paymentLink = validPaymentLink(process.env.STRIPE_PAYMENT_LINK_URL);
  if (paymentLink) return res.status(200).json({ url: paymentLink });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "El pago está pendiente de conectar con Stripe. Inténtalo de nuevo en unos minutos." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceId = await findPremiumPrice(stripe);
    const siteUrl = getSiteUrl(req);
    const session = await stripe.checkout.sessions.create({ mode: "subscription", line_items: [{ price: priceId, quantity: 1 }], success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${siteUrl}/cancel`, locale: "es", allow_promotion_codes: true, billing_address_collection: "auto", metadata: { plan: "premium-monthly", product: "MomentumVelo-AI" }, subscription_data: { metadata: { plan: "premium-monthly", product: "MomentumVelo-AI" } } });
    if (!session.url) throw new Error("Stripe no devolvió una URL de pago.");
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("checkout_session_error", { message: error instanceof Error ? error.message : String(error) });
    const configurationMessage = getConfigurationMessage(error);
    return res.status(configurationMessage ? 503 : 500).json({ error: configurationMessage || "Stripe no ha podido iniciar el pago. Inténtalo de nuevo." });
  }
};
