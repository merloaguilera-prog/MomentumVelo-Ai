const Stripe = require("stripe");
const { updateUserPlan } = require("./_clerk");
exports.config = { api: { bodyParser: false } };
async function readRawBody(req) { const chunks = []; for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks); }
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook de Stripe no configurado." });
  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(await readRawBody(req), signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) { console.error("stripe_webhook_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(400).json({ error: "Firma de webhook no válida." }); }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.clerkUserId || session.client_reference_id;
      if (userId) {
        await updateUserPlan(userId, "premium", {
          status: "active",
          customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id
        });
      }
    }

    if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = event.data.object;
      const userId = subscription.metadata?.clerkUserId;
      if (userId) {
        const keepsAccess = event.type !== "customer.subscription.deleted"
          && ["active", "trialing", "past_due"].includes(subscription.status);
        await updateUserPlan(userId, keepsAccess ? "premium" : "free", {
          status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
          customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
          subscriptionId: subscription.id
        });
      }
    }

    if (["checkout.session.completed", "invoice.payment_succeeded", "invoice.payment_failed", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      console.info("stripe_subscription_event", { id: event.id, type: event.type, objectId: event.data.object.id });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_processing_error", {
      eventId: event.id,
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: "El evento se volverá a procesar." });
  }
};
