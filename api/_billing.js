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

module.exports = { isPremiumPrice, isPremiumSubscription, hasPremiumAccess, stripeId };
