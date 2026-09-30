const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const Module = require("node:module");
const { isPremiumPrice, isPremiumSubscription, hasPremiumAccess } = require("../api/_billing");

function loadHandler(name, stripe, clerk) {
  const originalLoad = Module._load;
  const path = require.resolve(`../api/${name}`);
  delete require.cache[path];
  Module._load = function (request, parent, isMain) {
    if (request === "stripe" && parent?.filename === path) return stripe;
    if (request === "./_clerk" && parent?.filename === path) return clerk;
    return originalLoad.call(this, request, parent, isMain);
  };
  try { return require(path); } finally { Module._load = originalLoad; }
}

function response() {
  return {
    headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

const price = { id: "price_test", active: true, currency: "eur", unit_amount: 4900, recurring: { interval: "month", interval_count: 1 } };
const subscription = (status = "active") => ({
  id: "sub_one", status, customer: "cus_one", metadata: { clerkUserId: "user_one", plan: "premium-monthly" },
  latest_invoice: { status: status === "active" ? "paid" : "open", created: Math.floor(Date.now() / 1000) },
  items: { data: [{ price }] }
});

test("checkout refuses incomplete setup and the wrong recurring price", async () => {
  const old = { ...process.env };
  try {
    process.env.PREMIUM_SALES_ENABLED = "true";
    process.env.CLERK_SECRET_KEY = "clerk_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_PREMIUM_PRICE_ID = "price_test";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    let created = 0;
    class FakeStripe {
      constructor() {
        this.prices = { retrieve: async () => ({ ...price, unit_amount: 5900 }) };
        this.subscriptions = { list: async () => ({ data: [] }) };
        this.checkout = { sessions: { create: async () => { created++; return { url: "https://checkout.stripe.com/test" }; } } };
      }
    }
    const handler = loadHandler("checkout", FakeStripe, {
      getAuthenticatedUser: async () => ({ userId: "user_one" }), getUserStripeCustomerId: async () => null
    });
    const req = { method: "POST", body: {} };
    const incomplete = response();
    await handler(req, incomplete);
    assert.equal(incomplete.statusCode, 503);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const wrongPrice = response();
    await handler(req, wrongPrice);
    assert.equal(wrongPrice.statusCode, 503);
    assert.equal(created, 0);
  } finally { process.env = old; }
});

test("checkout creates an account-bound 49 euro subscription without restricting payment methods", async () => {
  const old = { ...process.env };
  let options;
  try {
    Object.assign(process.env, {
      PREMIUM_SALES_ENABLED: "true", CLERK_SECRET_KEY: "clerk_test", STRIPE_SECRET_KEY: "sk_test",
      STRIPE_PREMIUM_PRICE_ID: "price_test", STRIPE_WEBHOOK_SECRET: "whsec_test"
    });
    class FakeStripe {
      constructor() {
        this.prices = { retrieve: async () => price };
        this.subscriptions = { list: async () => ({ data: [] }) };
        this.checkout = { sessions: { create: async (input) => {
          options = input;
          return { url: "https://checkout.stripe.com/test" };
        } } };
      }
    }
    const handler = loadHandler("checkout", FakeStripe, {
      getAuthenticatedUser: async () => ({ userId: "user_one" }), getUserStripeCustomerId: async () => "cus_one"
    });
    const res = response();
    await handler({ method: "POST", body: { email: "attacker@example.com" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(options.mode, "subscription");
    assert.equal(options.customer, "cus_one");
    assert.equal(options.client_reference_id, "user_one");
    assert.equal(options.subscription_data.metadata.clerkUserId, "user_one");
    assert.equal(options.line_items[0].price, "price_test");
    assert.equal(Object.hasOwn(options, "payment_method_types"), false);
    assert.equal(Object.hasOwn(options, "integration_identifier"), false);
  } finally { process.env = old; }
});

test("webhook waits for payment and reconciles invoice and cancellation against Stripe", async () => {
  const old = { ...process.env };
  const writes = [];
  let current = subscription();
  try {
    process.env.CLERK_SECRET_KEY = "clerk_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PREMIUM_PRICE_ID = "price_test";
    class FakeStripe {
      constructor() {
        this.webhooks = { constructEvent: (body, signature) => {
          if (signature !== "valid") throw new Error("bad signature");
          return JSON.parse(body.toString());
        } };
        this.subscriptions = { retrieve: async () => current };
      }
    }
    const handler = loadHandler("webhook", FakeStripe, {
      updateUserPlan: async (...args) => writes.push(args)
    });
    assert.equal(handler.config.api.bodyParser, false);
    async function send(type, object) {
      const req = Readable.from([JSON.stringify({ id: "evt_one", type, data: { object } })]);
      req.method = "POST";
      req.headers = { "stripe-signature": "valid" };
      const res = response();
      await handler(req, res);
      assert.equal(res.statusCode, 200);
    }
    const session = { id: "cs_test_one", mode: "subscription", status: "complete", customer: "cus_one",
      client_reference_id: "user_one", metadata: { clerkUserId: "user_one" }, subscription: "sub_one" };
    await send("checkout.session.completed", { ...session, payment_status: "unpaid" });
    assert.equal(writes.length, 0);
    await send("checkout.session.async_payment_succeeded", { ...session, payment_status: "paid" });
    assert.equal(writes[0][1], "premium");
    current = subscription("past_due");
    await send("invoice.payment_failed", { id: "in_failed", parent: { subscription_details: { subscription: "sub_one" } } });
    assert.equal(writes[1][1], "free");
    current = subscription("canceled");
    await send("invoice.paid", { id: "in_one", parent: { subscription_details: { subscription: "sub_one" } } });
    assert.equal(writes[2][1], "free");
  } finally { process.env = old; }
});

test("entitlement requires the configured monthly price and a paid invoice", () => {
  const paid = subscription();
  assert.equal(isPremiumPrice(price, "price_test"), true);
  assert.equal(isPremiumPrice({ ...price, active: false }, "price_test"), false);
  assert.equal(isPremiumSubscription({ ...paid, items: { data: [{ price: { ...price, active: false } }] } }, "price_test"), true);
  assert.equal(hasPremiumAccess(paid, "price_test"), true);
  assert.equal(hasPremiumAccess(paid, "price_other"), false);
  assert.equal(hasPremiumAccess({ ...paid, latest_invoice: { status: "open" } }, "price_test"), false);
  assert.equal(hasPremiumAccess({ ...paid, items: { data: [{ price: { ...price, unit_amount: 5900 } }] } }, "price_test"), false);
});

test("webhook rejects a completed checkout with a different Clerk owner", async () => {
  const old = { ...process.env };
  const writes = [];
  try {
    Object.assign(process.env, { CLERK_SECRET_KEY: "clerk_test", STRIPE_SECRET_KEY: "sk_test",
      STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PREMIUM_PRICE_ID: "price_test" });
    class FakeStripe {
      constructor() {
        this.webhooks = { constructEvent: (body) => JSON.parse(body.toString()) };
        this.subscriptions = { retrieve: async () => subscription() };
      }
    }
    const handler = loadHandler("webhook", FakeStripe, { updateUserPlan: async (...args) => writes.push(args) });
    const req = Readable.from([JSON.stringify({ id: "evt_wrong", type: "checkout.session.completed",
      data: { object: { id: "cs_test_wrong", mode: "subscription", status: "complete", payment_status: "paid",
        subscription: "sub_one", customer: "cus_one", client_reference_id: "user_other",
        metadata: { clerkUserId: "user_one" } } } })]);
    req.method = "POST";
    req.headers = { "stripe-signature": "valid" };
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(writes.length, 0);
  } finally { process.env = old; }
});

test("payment confirmation requires the signed-in owner, matching customer, price and paid invoice", async () => {
  const old = { ...process.env };
  let current = subscription();
  try {
    Object.assign(process.env, { CLERK_SECRET_KEY: "clerk_test", STRIPE_SECRET_KEY: "sk_test",
      STRIPE_PREMIUM_PRICE_ID: "price_test" });
    const session = { id: "cs_test_one", status: "complete", mode: "subscription", payment_status: "paid",
      client_reference_id: "user_one", customer: "cus_one", subscription: "sub_one",
      metadata: { clerkUserId: "user_one" } };
    class FakeStripe {
      constructor() {
        this.checkout = { sessions: { retrieve: async () => session } };
        this.subscriptions = { retrieve: async () => current };
      }
    }
    const handler = loadHandler("subscription", FakeStripe, {
      getAuthenticatedUser: async () => ({ userId: "user_one" })
    });
    async function verify() {
      const res = response();
      await handler({ method: "GET", query: { session_id: "cs_test_one" } }, res);
      return res.statusCode;
    }
    assert.equal(await verify(), 200);
    current = { ...current, customer: "cus_other" };
    assert.equal(await verify(), 402);
    current = { ...subscription(), latest_invoice: { status: "open" } };
    assert.equal(await verify(), 402);
    current = { ...subscription(), items: { data: [{ price: { ...price, id: "price_other" } }] } };
    assert.equal(await verify(), 402);
  } finally { process.env = old; }
});

test("portal requires managed identity, not a checkout reference", async () => {
  const old = { ...process.env };
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    delete process.env.CLERK_SECRET_KEY;
    const handler = loadHandler("portal", class FakeStripe {}, { getAuthenticatedUser: async () => null });
    const res = response();
    await handler({ method: "POST", body: { sessionId: "cs_test_stolen" } }, res);
    assert.equal(res.statusCode, 503);
  } finally { process.env = old; }
});
