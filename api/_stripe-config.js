const STRIPE_API_VERSION = "2026-07-29.dahlia";
const PREMIUM_WEBHOOK_EVENTS = Object.freeze([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"
]);

module.exports = { STRIPE_API_VERSION, PREMIUM_WEBHOOK_EVENTS };
