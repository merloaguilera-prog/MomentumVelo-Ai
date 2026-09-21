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
    "https://momentum-velo.vercel.app"
  ];
  return [...new Set(values.filter(Boolean).map((value) => value.replace(/\/$/, "")))];
}

async function getAuthenticatedUser(req) {
  if (!process.env.CLERK_SECRET_KEY) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: authorizedParties()
    });
    return payload && payload.sub ? { userId: payload.sub, sessionId: payload.sid || null } : null;
  } catch (_error) {
    return null;
  }
}

async function updateUserPlan(userId, plan, details = {}) {
  if (!process.env.CLERK_SECRET_KEY || !userId) return false;
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
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
  const customerId = user.privateMetadata?.stripeCustomerId;
  return typeof customerId === "string" && customerId.startsWith("cus_") ? customerId : null;
}

module.exports = { getAuthenticatedUser, getUserStripeCustomerId, updateUserPlan };
