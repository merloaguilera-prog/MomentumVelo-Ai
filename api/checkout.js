const Stripe = require("stripe");
const clerk = require("./_clerk");
const { getAuthenticatedUser } = clerk;
const { billingMode, getBillingSiteUrl } = require("./_billing");
const { prepareCheckout } = require("./_checkout");
const { STRIPE_API_VERSION } = require("./_stripe-config");

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
  const mode = billingMode();
  if (mode === null) return res.status(503).json({ error: "La configuración de facturación no corresponde a este entorno." });
  const managedAuthRequired = Boolean(process.env.CLERK_SECRET_KEY);
  const authenticatedUser = managedAuthRequired ? await getAuthenticatedUser(req) : null;

  if (managedAuthRequired && !authenticatedUser) {
    return res.status(401).json({
      error: "Inicia sesión en tu cuenta antes de activar Premium."
    });
  }

  if (!managedAuthRequired || !authenticatedUser || !secretKey || !priceId || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({
      error: "La contratación Premium aún no está configurada para vincular el pago a una cuenta.",
      helpUrl: "/ayuda?tema=premium#contacto"
    });
  }

  try {
    const siteUrl = getBillingSiteUrl();
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
    const price = await stripe.prices.retrieve(priceId);
    if (price.id !== priceId || price.livemode !== mode || price.active !== true || price.currency !== "eur" || price.unit_amount !== 4900 || price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1) {
      return res.status(503).json({
        error: "El precio Premium configurado no corresponde a 49 € al mes. La contratación sigue cerrada.",
        helpUrl: "/ayuda?tema=premium#contacto"
      });
    }
    const prepared = await prepareCheckout(stripe, {
      userId: authenticatedUser.userId, priceId, siteUrl, mode
    }, clerk);
    if (prepared.error) return res.status(prepared.status).json({
      error: prepared.error, manageSubscription: prepared.manageSubscription
    });
    const { session } = prepared;
    return res.status(200).json({
      url: session.url,
      mode: "subscription",
      plan: "premium-monthly",
      source: "checkout-session",
      reused: prepared.reused
    });
  } catch (error) {
    if (error?.code === "idempotency_key_in_use" || error?.statusCode === 409) {
      return res.status(409).json({ retryable: true,
        error: "Tu contratación se está preparando. Vuelve a comprobarla en unos segundos." });
    }
    console.error("checkout_session_error", {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(502).json({
      error: "No se ha podido preparar el pago seguro. Inténtalo de nuevo en unos instantes."
    });
  }
};
