// Checkout estable de MomentumVelo Premium.
// El pago público usa el Payment Link LIVE verificado de Stripe y no depende
// de una clave privada de Vercel para iniciar el cobro.
const LIVE_PREMIUM_CHECKOUT = "https://buy.stripe.com/8x24gy58G8fA82D5Le2VG02";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  return res.status(200).json({
    url: LIVE_PREMIUM_CHECKOUT,
    mode: "subscription",
    plan: "premium-monthly"
  });
};
