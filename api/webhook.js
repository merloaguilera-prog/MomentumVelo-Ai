const Stripe = require("stripe");
exports.config = { api: { bodyParser: false } };
async function readRawBody(req) { const chunks = []; for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks); }
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Método no permitido." }); }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook de Stripe no configurado." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" }); const signature = req.headers["stripe-signature"]; const event = stripe.webhooks.constructEvent(await readRawBody(req), signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (["checkout.session.completed", "invoice.payment_succeeded", "customer.subscription.deleted"].includes(event.type)) console.info("stripe_subscription_event", { id: event.id, type: event.type, objectId: event.data.object.id });
    return res.status(200).json({ received: true });
  } catch (error) { console.error("stripe_webhook_error", { message: error instanceof Error ? error.message : String(error) }); return res.status(400).json({ error: "Firma de webhook no válida." }); }
};
