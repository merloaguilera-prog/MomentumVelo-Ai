const { createClerkClient, verifyToken } = require("@clerk/backend");

function getBearerToken(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function authorizedParties() {
  const values = [
    process.env.PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "https://momentumvelo.app",
    "https://momentum-velo.vercel.app"
  ];
  return [...new Set(values.filter(Boolean).map((value) => value.replace(/\/$/, "")))];
}

async function getAuthenticatedUser(req, { includeSessionClaims = false } = {}) {
  if (!process.env.CLERK_SECRET_KEY) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: authorizedParties()
    });
    if (!payload?.sub) return null;
    const identity = { userId: payload.sub, sessionId: payload.sid || null };
    return includeSessionClaims ? { ...identity, factorVerificationAge: payload.fva, actor: payload.act || null } : identity;
  } catch (_error) {
    return null;
  }
}

async function updateUserPlan(userId, plan, details = {}) {
  if (!process.env.CLERK_SECRET_KEY || !userId) {
    throw new Error("La actualización de Premium requiere una cuenta Clerk configurada.");
  }
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  let user;
  try { user = await clerk.users.getUser(userId); }
  catch (error) {
    // A delayed, signed Stripe event must not recreate or endlessly retry a
    // user who has deleted their account. All other failures remain retryable.
    if (error?.status === 404) return true;
    throw error;
  }
  if (user.privateMetadata?.accountDeletionStartedAt) return true;
  const currentSubscriptionId = user.privateMetadata?.stripeSubscriptionId;
  // Ignore revocation from another subscription, but allow a newly verified paid
  // subscription to replace an old ID whose cancellation delivery is delayed.
  if (plan !== "premium" && user.publicMetadata?.plan === "premium" && currentSubscriptionId
      && details.subscriptionId && currentSubscriptionId !== details.subscriptionId) return true;
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      plan,
      premiumStatus: details.status || (plan === "premium" ? "active" : "inactive"),
      premiumUpdatedAt: new Date().toISOString()
    },
    privateMetadata: {
      stripeCustomerId: details.customerId || null,
      stripeSubscriptionId: details.subscriptionId || null
    }
  });
  return true;
}

async function getUserStripeCustomerId(userId) {
  if (!process.env.CLERK_SECRET_KEY || !userId) return null;
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const user = await clerk.users.getUser(userId);
  if (user.privateMetadata?.accountDeletionStartedAt) throw new Error("La eliminación de esta cuenta está en curso. Continúa desde Eliminar mi cuenta.");
  const customerId = user.privateMetadata?.stripeCustomerId;
  return typeof customerId === "string" && customerId.startsWith("cus_") ? customerId : null;
}

async function setUserStripeCustomerId(userId, customerId) {
  if (!process.env.CLERK_SECRET_KEY || !userId || !customerId?.startsWith("cus_")) {
    throw new Error("La vinculación de facturación requiere una cuenta configurada.");
  }
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const user = await clerk.users.getUser(userId);
  if (user.privateMetadata?.accountDeletionStartedAt) throw new Error("La eliminación de esta cuenta está en curso.");
  const current = user.privateMetadata?.stripeCustomerId;
  if (current && current !== customerId) throw new Error("La cuenta ya tiene otro cliente de facturación.");
  if (!current) await clerk.users.updateUserMetadata(userId, { privateMetadata: { stripeCustomerId: customerId } });
  return true;
}

async function hasUserPremiumEntitlement(userId, customerId, subscriptionId) {
  if (!process.env.CLERK_SECRET_KEY || !userId || !customerId || !subscriptionId) return false;
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const user = await clerk.users.getUser(userId);
  return !user.privateMetadata?.accountDeletionStartedAt && user.publicMetadata?.plan === "premium"
    && user.publicMetadata?.premiumStatus === "active"
    && user.privateMetadata?.stripeCustomerId === customerId
    && user.privateMetadata?.stripeSubscriptionId === subscriptionId;
}

module.exports = { getAuthenticatedUser, authorizedParties, getUserStripeCustomerId, setUserStripeCustomerId, updateUserPlan, hasUserPremiumEntitlement };
