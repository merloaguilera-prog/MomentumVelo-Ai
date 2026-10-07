const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { billingMode, getBillingSiteUrl } = require("../api/_billing");
const { preflight } = require("../scripts/stripe-sandbox-preflight");
const { STRIPE_API_VERSION, PREMIUM_WEBHOOK_EVENTS } = require("../api/_stripe-config");
const testEnv = { STRIPE_SECRET_KEY: "sk_test_fixture", CLERK_SECRET_KEY: "sk_test_fixture",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture", STRIPE_PREMIUM_PRICE_ID: "price_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture", STRIPE_WEBHOOK_ENDPOINT_ID: "we_fixture",
  VERCEL_ENV: "preview", VERCEL_URL: "momentum-test.vercel.app" };
const testEndpoint = () => ({ id: "we_fixture", livemode: false, status: "enabled",
  url: "https://momentum-test.vercel.app/api/webhook", api_version: STRIPE_API_VERSION,
  enabled_events: [...PREMIUM_WEBHOOK_EVENTS] });

test("Preview refuses live keys and mixed Stripe/Clerk identities before any SDK call", async () => {
  const handlers = [require("../api/checkout"), require("../api/portal"), require("../api/subscription"), require("../api/webhook")];
  const old = { ...process.env };
  try {
    for (const keys of [
      { STRIPE_SECRET_KEY: "sk_live_fixture", CLERK_SECRET_KEY: "sk_live_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" },
      { STRIPE_SECRET_KEY: "sk_test_fixture", CLERK_SECRET_KEY: "sk_live_fixture" },
      { STRIPE_SECRET_KEY: "sk_live_fixture", CLERK_SECRET_KEY: "sk_test_fixture" },
      { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" }
    ]) {
      Object.assign(process.env, testEnv, keys, { PREMIUM_SALES_ENABLED: "true" });
      for (const [index, handler] of handlers.entries()) {
        const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
        // No body stream and no bearer token: rejection must happen before any read or SDK request.
        await handler({ method: index === 2 ? "GET" : "POST", headers: {}, query: { session_id: "cs_test_fixture" }, body: {} }, res);
        assert.equal(res.code, 503);
        assert.equal(res.body.url, undefined);
      }
    }
  } finally { process.env = old; }
});

test("matching live keys remain valid in production and restricted test keys work in Preview", () => {
  assert.equal(billingMode({ ...testEnv, STRIPE_SECRET_KEY: "rk_test_fixture" }), false);
  assert.equal(billingMode({ ...testEnv, VERCEL_ENV: "production", STRIPE_SECRET_KEY: "rk_live_fixture",
    CLERK_SECRET_KEY: "sk_live_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" }), true);
  assert.equal(billingMode({ ...testEnv, STRIPE_SECRET_KEY: "unknown" }), null);
});

test("Preview Checkout and portal returns use the Preview origin even with a production site variable", () => {
  assert.equal(getBillingSiteUrl({ ...testEnv, PUBLIC_SITE_URL: "https://momentumvelo.app" }), "https://momentum-test.vercel.app");
  assert.throws(() => getBillingSiteUrl({ ...testEnv, VERCEL_URL: "" }));
  assert.throws(() => getBillingSiteUrl({ ...testEnv, VERCEL_ENV: "development", PUBLIC_SITE_URL: "https://momentumvelo.app" }));
  assert.equal(getBillingSiteUrl({ ...testEnv, VERCEL_ENV: "development", PUBLIC_SITE_URL: "http://localhost:3000" }), "http://localhost:3000");
  assert.throws(() => getBillingSiteUrl({ ...testEnv, VERCEL_ENV: "development", PUBLIC_SITE_URL: "https://user:password@example.com" }));
});

test("preflight rejects live mode before making network calls", async () => {
  let calls = 0;
  await assert.rejects(() => preflight({ ...testEnv, VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_live_fixture",
    CLERK_SECRET_KEY: "sk_live_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" }, () => { calls++; }));
  assert.equal(calls, 0);
});

test("preflight verifies registration without claiming signed delivery or entitlement writes", async () => {
  let livePrice = false;
  const sdk = () => ({ balance: { retrieve: async () => ({ livemode: false }) },
    prices: { retrieve: async () => ({ id: "price_fixture", livemode: livePrice, active: true, currency: "eur", unit_amount: 4900,
      recurring: { interval: "month", interval_count: 1 }, tax_behavior: "inclusive" }) },
    webhookEndpoints: { retrieve: async id => { assert.equal(id, "we_fixture"); return testEndpoint(); } } });
  const report = await preflight(testEnv, sdk);
  assert.equal(report.stripeMode, "test");
  assert.equal(report.signedDeliveryVerified, false);
  assert.equal(report.entitlementWriteVerified, false);
  assert.equal(report.webhookRegistrationVerified, true);
  assert.equal(JSON.stringify(report).includes("sk_test"), false);
  livePrice = true;
  await assert.rejects(() => preflight(testEnv, sdk));
});

test("preflight refuses an absent endpoint ID before contacting Stripe", async () => {
  let calls = 0;
  await assert.rejects(() => preflight({ ...testEnv, STRIPE_WEBHOOK_ENDPOINT_ID: "" }, () => { calls++; }));
  assert.equal(calls, 0);
});

test("preflight rejects disabled, live, wrong-target or incomplete webhook registrations", async () => {
  let endpoint = testEndpoint();
  const sdk = () => ({ balance: { retrieve: async () => ({ livemode: false }) },
    prices: { retrieve: async () => ({ id: "price_fixture", livemode: false, active: true, currency: "eur",
      unit_amount: 4900, recurring: { interval: "month", interval_count: 1 } }) },
    webhookEndpoints: { retrieve: async () => endpoint } });
  for (const changes of [
    { id: "we_other" }, { livemode: true }, { status: "disabled" },
    { url: "https://momentumvelo.app/api/webhook" }, { url: "https://momentum-test.vercel.app/wrong" },
    { api_version: "2020-08-27" }, { api_version: null },
    { enabled_events: PREMIUM_WEBHOOK_EVENTS.filter(type => type !== "invoice.paid") },
    { enabled_events: PREMIUM_WEBHOOK_EVENTS.filter(type => type !== "checkout.session.async_payment_failed") }
  ]) {
    endpoint = { ...testEndpoint(), ...changes };
    await assert.rejects(() => preflight(testEnv, sdk));
  }
  endpoint = { ...testEndpoint(), url: "https://momentum-test.vercel.app/api/webhook?x-vercel-protection-bypass=fixture-private" };
  const report = await preflight(testEnv, sdk);
  assert.equal(report.webhookRegistrationVerified, true);
  assert.equal(JSON.stringify(report).includes("fixture-private"), false);
});

test("test Checkout and portal send Preview return URLs to Stripe and reject a live price", async () => {
  const old = { ...process.env };
  const calls = []; let livePrice = false;
  class FakeStripe {
    constructor() {
      this.prices = { retrieve: async () => ({ id: "price_fixture", livemode: livePrice, active: true, currency: "eur",
        unit_amount: 4900, recurring: { interval: "month", interval_count: 1 } }) };
      this.checkout = { sessions: { create: async args => { calls.push(args); return { url: "https://checkout.stripe.com/test-fixture" }; } } };
      this.billingPortal = { sessions: { create: async args => { calls.push(args); return { url: "https://billing.stripe.com/test-fixture" }; } } };
    }
  }
  const clerk = { getAuthenticatedUser: async () => ({ userId: "user_fixture" }), getUserStripeCustomerId: async () => "cus_fixture" };
  const original = Module._load;
  const load = name => {
    const filename = require.resolve(`../api/${name}`); delete require.cache[filename];
    Module._load = function(request, parent, main) {
      if (parent?.filename === filename && request === "stripe") return FakeStripe;
      if (parent?.filename === filename && request === "./_clerk") return clerk;
      return original.call(this, request, parent, main);
    };
    try { return require(filename); } finally { Module._load = original; }
  };
  const checkout = load("checkout"), portal = load("portal");
  const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
  try {
    Object.assign(process.env, testEnv, { PREMIUM_SALES_ENABLED: "true", PUBLIC_SITE_URL: "https://momentumvelo.app" });
    let res = response(); await checkout({ method: "POST", body: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(calls[0].success_url, "https://momentum-test.vercel.app/success?session_id={CHECKOUT_SESSION_ID}");
    assert.equal(calls[0].cancel_url, "https://momentum-test.vercel.app/cancel");
    assert.equal(calls[0].payment_method_types, undefined);
    res = response(); await portal({ method: "POST", body: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(calls[1].return_url, "https://momentum-test.vercel.app/login?mode=account");
    livePrice = true; res = response(); await checkout({ method: "POST", body: {} }, res);
    assert.equal(res.code, 503);
    assert.equal(calls.length, 2);
  } finally { process.env = old; }
});
