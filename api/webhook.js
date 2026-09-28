const Stripe = require("stripe");
const { updateUserPlan } = require("./_clerk");
const { hasPremiumAccess, stripeId } = require("./_billing");

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function subscriptionFromEvent(event) {
  const object = event.data.object;
  if (event.type.startsWith("customer.subscription.")) return stripeId(object, "sub_");
  if (event.type.startsWith("checkout.session.")) return stripeId(object.subscription, "sub_");
  if (event.type.startsWith("invoice.")) {
    return stripeId(object.parent?.subscription_details?.subscription, "sub_")
      || stripeId(object.subscription, "sub_");
  }
  return null;
}

const handledEvents = new Set([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"
]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.CLERK_SECRET_KEY) {
    return res.status(503).json({ error: "Webhook de suscripciones no configurado." });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await readRawBody(req), req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("stripe_webhook_error", { message: error instanceof Error ? error.message : String(error) });
    return res.status(400).json({ error: "Firma de webhook no válida." });
  }

  try {
    if (handledEvents.has(event.type)) {
      const session = event.type.startsWith("checkout.session.") ? event.data.object : null;
      // A completed Checkout can precede an asynchronous payment. Wait for the paid event.
      if (!session || session.payment_status === "paid" || event.type === "checkout.session.async_payment_failed") {
        const subscriptionId = subscriptionFromEvent(event);
        if (subscriptionId) {
          // Re-read Stripe: webhooks can arrive twice or out of order.
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price", "latest_invoice"]
          });
          const userId = subscription.metadata?.clerkUserId;
          if (userId && subscription.metadata?.plan === "premium-monthly") {
            const active = hasPremiumAccess(subscription);
            await updateUserPlan(userId, active ? "premium" : "free", {
              status: subscription.status,
              customerId: stripeId(subscription.customer, "cus_"),
              subscriptionId: subscription.id
            });
          }
        }
      }
      console.info("stripe_subscription_event", { id: event.id, type: event.type });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_processing_error", {
      eventId: event.id, message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: "El evento se volverá a procesar." });
  }
};
module.exports.config = { api: { bodyParser: false } };
