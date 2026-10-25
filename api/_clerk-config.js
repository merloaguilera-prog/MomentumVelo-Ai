// Select the complete pair together: never mix the independent application
// with credentials managed by the legacy Marketplace integration.
function clerkKeys(env = process.env) {
  const direct = env.CLERK_USE_PROXY === "false";
  return {
    secretKey: (direct ? env.MOMENTUM_CLERK_SECRET_KEY : env.CLERK_SECRET_KEY) || "",
    publishableKey: (direct ? env.NEXT_PUBLIC_MOMENTUM_CLERK_PUBLISHABLE_KEY : env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) || ""
  };
}

module.exports = { clerkKeys };
