const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../api/auth-config");
const env = { CLERK_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_PREMIUM_PRICE_ID: "price_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture", VERCEL_ENV: "preview", VERCEL_URL: "momentum-test.vercel.app",
  PREMIUM_SALES_ENABLED: "true" };

test("public Premium flag requires an explicit opening, complete billing and matching modes", async () => {
  const previous = { ...process.env };
  try {
    for (const changes of [{ PREMIUM_SALES_ENABLED: "false" }, { PREMIUM_SALES_ENABLED: "1" },
      { STRIPE_PREMIUM_PRICE_ID: "" }, { STRIPE_WEBHOOK_SECRET: "" },
      { STRIPE_SECRET_KEY: "sk_live_fixture" }, { VERCEL_URL: "" }, {}]) {
      Object.assign(process.env, env, changes);
      const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
      await config({ method: "GET" }, response);
      assert.equal(response.code, 200);
      assert.equal(response.body.enabled, true);
      assert.equal(response.body.premiumSalesEnabled, Object.keys(changes).length === 0);
      assert.doesNotMatch(JSON.stringify(response.body), /sk_test|sk_live|whsec|price_fixture/);
    }
  } finally { process.env = previous; }
});
