function isPremiumPrice(price, configuredPriceId, requireActive = true) {
  return Boolean(price && configuredPriceId && price.id === configuredPriceId
    && (!requireActive || price.active === true)
    && price.currency === "eur" && price.unit_amount === 4900
    && price.recurring?.interval === "month" && price.recurring?.interval_count === 1);
}

function isPremiumSubscription(subscription, configuredPriceId) {
  return Boolean(subscription?.items?.data?.some((item) => isPremiumPrice(item.price, configuredPriceId, false)));
}

function hasPremiumAccess(subscription, configuredPriceId) {
  if (!isPremiumSubscription(subscription, configuredPriceId)) return false;
  return subscription.status === "active" && subscription.latest_invoice?.status === "paid";
}

function stripeId(value, prefix) {
  const id = typeof value === "string" ? value : value?.id;
  return typeof id === "string" && id.startsWith(prefix) ? id : null;
}

function billingMode(env = process.env) {
  const stripe = /^(?:sk|rk)_(test|live)_/.exec(env.STRIPE_SECRET_KEY || "");
  const clerk = /^sk_(test|live)_/.exec(env.CLERK_SECRET_KEY || "");
  if (!stripe || !clerk || stripe[1] !== clerk[1]) return null;
  const publicKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (publicKey && !publicKey.startsWith(`pk_${clerk[1]}_`)) return null;
  if (["preview", "development"].includes(env.VERCEL_ENV) && stripe[1] !== "test") return null;
  return stripe[1] === "live";
}

function getBillingSiteUrl(env = process.env) {
  const mode = billingMode(env);
  if (mode === null) throw new Error("La configuración de facturación no corresponde a este entorno.");
  const raw = env.VERCEL_ENV === "preview"
    ? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "")
    : env.PUBLIC_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://momentumvelo.app");
  const url = new URL(raw);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
      || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("La URL de retorno de facturación no es válida.");
  }
  if (!mode && ["momentumvelo.app", "www.momentumvelo.app", "momentum-velo.vercel.app"].includes(url.hostname)) {
    throw new Error("Las pruebas de facturación necesitan una URL separada de producción.");
  }
  return url.origin;
}

module.exports = { isPremiumPrice, isPremiumSubscription, hasPremiumAccess, stripeId, billingMode, getBillingSiteUrl };

