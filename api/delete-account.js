const { createClerkClient } = require("@clerk/backend");
const Stripe = require("stripe");
const { getAuthenticatedUser, authorizedParties } = require("./_clerk");
const { billingMode, stripeId } = require("./_billing");
const { STRIPE_API_VERSION } = require("./_stripe-config");

const recent = age => Number.isInteger(age) && age >= 0 && age < 10;
function accountMode() {
  const mode = /^sk_(test|live)_/.exec(process.env.CLERK_SECRET_KEY || "")?.[1];
  if (!mode || (["preview", "development"].includes(process.env.VERCEL_ENV) && mode !== "test")) return null;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith(`pk_${mode}_`)) return null;
  return mode;
}

async function listAll(list, parameters) {
  const items = [];
  let cursor;
  // Fail closed on malformed pagination or an unexpectedly large history.
  for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
    const page = await list({ ...parameters, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    if (!Array.isArray(page.data)) throw new Error("invalid_billing_page");
    items.push(...page.data);
    if (!page.has_more) return items;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error("invalid_billing_cursor");
    cursor = next;
  }
  throw new Error("billing_history_too_large");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
    return res.status(415).json({ error: "Envía la confirmación desde la página de eliminación." });
  }
  if (!authorizedParties().includes(req.headers.origin) || req.headers["sec-fetch-site"] === "cross-site") {
    return res.status(403).json({ error: "Utiliza la página de eliminación de MomentumVelo." });
  }
  if (!accountMode()) return res.status(503).json({ error: "El acceso seguro no está disponible en este entorno." });
  if (req.body?.confirmation !== "ELIMINAR" || req.body?.acceptConsequences !== true) {
    return res.status(400).json({ error: "Escribe ELIMINAR y confirma que entiendes las consecuencias." });
  }
  const identity = await getAuthenticatedUser(req, { includeSessionClaims: true });
  if (!identity) return res.status(401).json({ error: "Identifícate para eliminar tu cuenta." });
  if (identity.actor || !identity.sessionId || !recent(identity.factorVerificationAge?.[0])) {
    return res.status(403).json({ code: "REAUTHENTICATION_REQUIRED", error: "Por seguridad, vuelve a identificarte antes de eliminar tu cuenta." });
  }

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  let stage = "account";
  try {
    let user;
    try { user = await clerk.users.getUser(identity.userId); }
    catch (error) {
      // A retry with the same still-valid signed identity may follow a lost
      // success response. No new mutation is performed for an absent user.
      if (error?.status === 404) return res.status(200).json({ deleted: true });
      throw error;
    }
    let session;
    try { session = await clerk.sessions.getSession(identity.sessionId); }
    catch (error) {
      if (error?.status === 404) return res.status(401).json({ error: "Tu sesión ya no está activa. Vuelve a identificarte." });
      throw error;
    }
    if (user.id !== identity.userId || session.userId !== identity.userId || session.status !== "active") {
      return res.status(401).json({ error: "Tu sesión ya no está activa. Vuelve a identificarte." });
    }
    if (user.twoFactorEnabled && !recent(identity.factorVerificationAge?.[1])) {
      return res.status(403).json({ code: "REAUTHENTICATION_REQUIRED", error: "Vuelve a identificarte con tu segundo factor antes de continuar." });
    }
    const primaryEmail = user.emailAddresses?.find(email => email.id === user.primaryEmailAddressId)?.emailAddress;
    if (!primaryEmail || typeof req.body.email !== "string"
        || req.body.email.trim().toLowerCase() !== primaryEmail.toLowerCase()) {
      return res.status(400).json({ error: "Escribe el correo principal de la cuenta que quieres eliminar." });
    }

    const customerId = user.privateMetadata?.stripeCustomerId;
    let stripe, customer, openSessions = [];
    if (customerId) {
      stage = "billing_verification";
      const mode = billingMode();
      if (!/^cus_[A-Za-z0-9]+$/.test(customerId) || mode === null) {
        return res.status(503).json({ error: "No podemos comprobar la baja de Premium. Tu cuenta se conserva; vuelve a intentarlo o solicita ayuda." });
      }
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION, timeout: 8000, maxNetworkRetries: 1 });
      customer = await stripe.customers.retrieve(customerId);
      if (customer.id !== customerId || (!customer.deleted
          && (customer.livemode !== mode || customer.metadata?.clerkUserId !== identity.userId))) {
        return res.status(409).json({ error: "La vinculación de Premium requiere una revisión. Tu cuenta no se ha eliminado; solicita ayuda." });
      }
      if (!customer.deleted) {
        const subscriptions = await listAll(args => stripe.subscriptions.list(args), { customer: customerId, status: "all" });
        openSessions = await listAll(args => stripe.checkout.sessions.list(args), { customer: customerId, status: "open" });
        const owned = item => stripeId(item.customer, "cus_") === customerId
          && item.livemode === mode && item.metadata?.clerkUserId === identity.userId
          && item.metadata?.plan === "premium-monthly";
        if (subscriptions.some(item => !owned(item)) || openSessions.some(item => !owned(item) || item.mode !== "subscription")) {
          return res.status(409).json({ error: "Hay referencias de facturación que requieren una revisión. Solicita ayuda antes de eliminar la cuenta." });
        }
      }
    } else if (user.privateMetadata?.stripeSubscriptionId || user.publicMetadata?.plan === "premium"
        || ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(user.publicMetadata?.premiumStatus)) {
      return res.status(409).json({ error: "Debemos comprobar la baja de Premium antes de eliminar tu cuenta. Solicita ayuda." });
    }

    stage = "deletion_start";
    await clerk.users.updateUserMetadata(identity.userId, { privateMetadata: {
      accountDeletionStartedAt: user.privateMetadata?.accountDeletionStartedAt || new Date().toISOString()
    } });
    if (customerId && !customer.deleted) {
      stage = "billing_deletion";
      // Expire the existing purchase links before closing this app's dedicated
      // customer. Deleting it cancels subscriptions and removes card details.
      for (const checkout of openSessions) await stripe.checkout.sessions.expire(checkout.id);
      const removed = await stripe.customers.del(customerId);
      if (removed.id !== customerId || removed.deleted !== true) throw new Error("billing_deletion_unconfirmed");
    }
    stage = "identity_deletion";
    try { await clerk.users.deleteUser(identity.userId); }
    catch (error) { if (error?.status !== 404) throw error; }
    return res.status(200).json({ deleted: true });
  } catch (error) {
    // Do not log vendor messages, account identifiers, emails or credentials.
    console.warn("account_deletion_incomplete", { stage, status: Number.isInteger(error?.status) ? error.status : null });
    return res.status(503).json({ error: "No hemos podido completar la eliminación. Puede haber pasos ya realizados. Vuelve a intentarlo con la misma cuenta o solicita ayuda; no se ha confirmado una eliminación completa." });
  }
};
