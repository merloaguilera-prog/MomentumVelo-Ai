const { createHash } = require("node:crypto");

const ongoingStatuses = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
const key = (...parts) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const id = value => typeof value === "string" ? value : value?.id;

function conflict(message, manageSubscription = false) {
  return { error: message, manageSubscription, status: 409 };
}

async function findInPages(list, parameters, matches) {
  let cursor;
  for (;;) {
    const page = await list({ ...parameters, ...(cursor ? { starting_after: cursor } : {}) });
    if (!Array.isArray(page.data)) throw new Error("No se pudo comprobar la facturación existente.");
    const found = page.data.find(matches);
    if (found) return found;
    if (!page.has_more) return null;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error("No se pudo recorrer la facturación existente.");
    cursor = next;
  }
}

function pendingCheckout(session, userId, customerId, priceId, siteUrl, mode) {
  const matches = session.livemode === mode && session.mode === "subscription"
    && session.client_reference_id === userId && session.metadata?.clerkUserId === userId
    && session.metadata?.plan === "premium-monthly" && session.metadata?.premiumPriceId === priceId
    && id(session.customer) === customerId && session.url
    && session.success_url === `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`
    && session.cancel_url === `${siteUrl}/cancel`;
  return matches ? { session, reused: true }
    : conflict("Hay una contratación pendiente. Revisa su estado antes de iniciar otra.", true);
}

async function prepareCheckout(stripe, { userId, priceId, siteUrl, mode }, clerk) {
  let customerId = await clerk.getUserStripeCustomerId(userId);
  if (!customerId) {
    // Stable parameters and a provider-side key also cover separate server instances.
    const customer = await stripe.customers.create({ metadata: { clerkUserId: userId } }, {
      idempotencyKey: `momentumvelo-customer-v1-${key(userId)}`
    });
    if (customer.deleted || customer.livemode !== mode || !customer.id?.startsWith("cus_")) {
      throw new Error("El cliente de facturación no corresponde a este entorno.");
    }
    // Do not create Checkout if the durable user/customer association cannot be saved.
    if (await clerk.setUserStripeCustomerId(userId, customer.id) !== true) {
      throw new Error("No se pudo guardar la vinculación de facturación.");
    }
    customerId = customer.id;
  } else {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || customer.livemode !== mode
        || (customer.metadata?.clerkUserId && customer.metadata.clerkUserId !== userId)) {
      throw new Error("La vinculación del cliente de facturación no es válida.");
    }
  }

  const existing = await findInPages(args => stripe.subscriptions.list(args),
    { customer: customerId, status: "all", limit: 100 }, sub => ongoingStatuses.has(sub.status));
  if (existing) return conflict("Ya tienes una suscripción activa o pendiente. Puedes gestionarla desde tu cuenta.", true);

  const open = await findInPages(args => stripe.checkout.sessions.list(args),
    { customer: customerId, status: "open", limit: 100 }, session => session.mode === "subscription");
  if (open) return pendingCheckout(open, userId, customerId, priceId, siteUrl, mode);

  const history = await stripe.checkout.sessions.list({ customer: customerId, limit: 1 });
  if (!Array.isArray(history.data)) throw new Error("No se pudo comprobar el intento anterior.");
  const previous = history.data[0];
  // Another worker may have opened or completed Checkout since the first lists.
  if (previous?.status === "open") return pendingCheckout(previous, userId, customerId, priceId, siteUrl, mode);
  if (previous?.mode === "subscription" && previous.status === "complete") {
    const subscriptionId = id(previous.subscription);
    if (!subscriptionId) return conflict("La contratación anterior sigue pendiente de confirmación.", true);
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    if (!["canceled", "incomplete_expired"].includes(current.status)) {
      return conflict("Ya tienes una suscripción activa o pendiente. Puedes gestionarla desde tu cuenta.", true);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription", customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cancel`,
    client_reference_id: userId,
    metadata: { plan: "premium-monthly", clerkUserId: userId, premiumPriceId: priceId },
    subscription_data: { metadata: { plan: "premium-monthly", clerkUserId: userId } },
    integration_identifier: "momentumvelo_web_qmztrkpa"
  }, {
    // Rotate only after a previous attempt ends, never for a click or a random request body.
    idempotencyKey: `momentumvelo-checkout-v1-${key(userId, customerId, priceId, siteUrl, mode, previous?.id || "first")}`
  });
  if (!session.url) throw new Error("No se pudo obtener la página de pago.");
  return { session, reused: false };
}

module.exports = { prepareCheckout };
