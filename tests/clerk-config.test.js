const { test } = require("node:test");
const assert = require("node:assert/strict");
const { clerkKeys } = require("../api/_clerk-config");
const { billingMode } = require("../api/_billing");
const authConfig = require("../api/auth-config");

const legacy = { CLERK_SECRET_KEY: "sk_test_legacy", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_legacy" };
const independent = { MOMENTUM_CLERK_SECRET_KEY: "sk_live_direct", NEXT_PUBLIC_MOMENTUM_CLERK_PUBLISHABLE_KEY: "pk_live_direct" };

test("direct migration selects both independent credentials and preserves the legacy pair", () => {
  const env = { ...legacy, ...independent, CLERK_USE_PROXY: "false" };
  assert.deepEqual(clerkKeys(env), { secretKey: independent.MOMENTUM_CLERK_SECRET_KEY, publishableKey: independent.NEXT_PUBLIC_MOMENTUM_CLERK_PUBLISHABLE_KEY });
  for (const flag of [undefined, "true", ""]) {
    assert.deepEqual(clerkKeys({ ...env, CLERK_USE_PROXY: flag }), { secretKey: legacy.CLERK_SECRET_KEY, publishableKey: legacy.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
  }
  assert.equal(env.CLERK_SECRET_KEY, legacy.CLERK_SECRET_KEY);
});

test("incomplete direct migration never falls back to legacy identities or local accounts", async () => {
  const previous = { ...process.env };
  try {
    for (const missing of ["MOMENTUM_CLERK_SECRET_KEY", "NEXT_PUBLIC_MOMENTUM_CLERK_PUBLISHABLE_KEY", "both"]) {
      Object.assign(process.env, legacy, independent, { CLERK_USE_PROXY: "false" });
      if (missing === "both") {
        delete process.env.MOMENTUM_CLERK_SECRET_KEY;
        delete process.env.NEXT_PUBLIC_MOMENTUM_CLERK_PUBLISHABLE_KEY;
      } else delete process.env[missing];
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
      await authConfig({ method: "GET" }, res);
      assert.equal(res.code, 503);
      assert.equal(res.body.publishableKey, undefined);
      assert.doesNotMatch(JSON.stringify(res.body), /sk_live|sk_test|pk_test/);
    }
  } finally { process.env = previous; }
});

test("login configuration and billing use the same independent Clerk instance", async () => {
  const env = { ...legacy, ...independent, CLERK_USE_PROXY: "false", VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_live_fixture", PREMIUM_SALES_ENABLED: "false" };
  assert.equal(billingMode(env), true);
  assert.equal(billingMode({ ...env, VERCEL_ENV: "preview" }), null);
  assert.equal(billingMode({ ...env, MOMENTUM_CLERK_SECRET_KEY: "" }), null);
  const previous = { ...process.env };
  try {
    Object.assign(process.env, env);
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await authConfig({ method: "GET" }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.publishableKey, independent.NEXT_PUBLIC_MOMENTUM_CLERK_PUBLISHABLE_KEY);
    assert.equal(res.body.proxyEnabled, false);
    assert.equal(res.body.premiumSalesEnabled, false);
    assert.doesNotMatch(JSON.stringify(res.body), /sk_live|sk_test|pk_test_legacy/);
  } finally { process.env = previous; }
});
