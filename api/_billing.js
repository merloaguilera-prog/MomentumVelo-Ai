function isPremiumPrice(price) {
  return Boolean(price && price.currency === "eur" && price.unit_amount === 4900
    && price.recurring?.interval === "month" && price.recurring?.interval_count === 1);
}

function isPremiumSubscription(subscription) {
  return Boolean(subscription?.items?.data?.some((item) => isPremiumPrice(item.price)));
}

function hasPremiumAccess(subscription) {
  if (!isPremiumSubscription(subscription)) return false;
  return subscription.status === "active" && subscription.latest_invoice?.status === "paid";
}

function stripeId(value, prefix) {
  const id = typeof value === "string" ? value : value?.id;
  return typeof id === "string" && id.startsWith(prefix) ? id : null;
}

module.exports = { isPremiumPrice, isPremiumSubscription, hasPremiumAccess, stripeId };
