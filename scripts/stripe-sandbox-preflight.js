const Stripe = require("stripe");
const { billingMode, getBillingSiteUrl, isPremiumPrice } = require("../api/_billing");

async function preflight(env = process.env, makeStripe = key => new Stripe(key, { apiVersion: "2026-07-29.dahlia" })) {
  // Check before instantiating Stripe: this script must never contact a live account.
  if (billingMode(env) !== false) throw new Error("Se requieren claves de pruebas de Stripe y Clerk del mismo entorno.");
  const siteUrl = getBillingSiteUrl(env);
  if (!env.STRIPE_PREMIUM_PRICE_ID || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Falta el precio o el secreto del webhook del entorno de pruebas.");
  }
  const stripe = makeStripe(env.STRIPE_SECRET_KEY);
  const balance = await stripe.balance.retrieve();
  if (balance.livemode !== false) throw new Error("Stripe no confirmó el modo de pruebas.");
  const price = await stripe.prices.retrieve(env.STRIPE_PREMIUM_PRICE_ID);
  if (price.livemode !== false || !isPremiumPrice(price, env.STRIPE_PREMIUM_PRICE_ID)) {
    throw new Error("El precio de pruebas no corresponde a 49 EUR por mes.");
  }
  return {
    stripeMode: "test", clerkMode: "test", priceId: price.id,
    amount: 4900, currency: "eur", interval: "month", taxBehavior: price.tax_behavior,
    siteUrl, salesEnabled: env.PREMIUM_SALES_ENABLED === "true",
    signedDeliveryVerified: false, entitlementWriteVerified: false,
    note: "Esta comprobación solo hace lecturas. No acredita una entrega firmada ni una actualización en Clerk."
  };
}

if (require.main === module) {
  preflight().then(report => console.log(JSON.stringify(report, null, 2))).catch(() => {
    // Never print vendor errors: request details could include credentials or customer data.
    console.error("No se ha validado el entorno de pruebas. Revisa las claves test, la URL separada, el precio de 49 EUR/mes y el secreto del webhook. No se ha creado ningún pago.");
    process.exitCode = 1;
  });
}
module.exports = { preflight };
