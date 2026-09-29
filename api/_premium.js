function isPremiumPrice(price, configuredPriceId, requireActive = true) {
  return Boolean(
    price
    && price.id === configuredPriceId
    && (!requireActive || price.active === true)
    && price.currency === "eur"
    && price.unit_amount === 4900
    && price.recurring?.interval === "month"
    && price.recurring?.interval_count === 1
  );
}

function isPremiumSubscription(subscription, configuredPriceId, allowedStatuses = ["active", "trialing"]) {
  return Boolean(
    subscription
    && allowedStatuses.includes(subscription.status)
    && subscription.items?.data?.some((item) => isPremiumPrice(item.price, configuredPriceId, false))
  );
}

module.exports = { isPremiumPrice, isPremiumSubscription };
