const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const Module = require("node:module");
const Stripe = require("stripe");
const fs = require("node:fs");
const vm = require("node:vm");
const { hasPremiumAccess } = require("../api/_billing");

const env = { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PREMIUM_PRICE_ID: "price_fixture", CLERK_SECRET_KEY: "sk_test_clerk_fixture" };
const price = { id: "price_fixture", currency: "eur", unit_amount: 4900, active: true,
  recurring: { interval: "month", interval_count: 1 } };
const subscription = (status = "active") => ({ id: "sub_fixture", customer: "cus_fixture", status,
  metadata: { plan: "premium-monthly", clerkUserId: "user_fixture" },
  items: { data: [{ price }] }, latest_invoice: { id: "in_fixture", status: status === "active" ? "paid" : "open" } });
const session = { id: "cs_test_fixture", mode: "subscription", status: "complete", payment_status: "paid",
  customer: "cus_fixture", subscription: "sub_fixture", client_reference_id: "user_fixture",
  metadata: { plan: "premium-monthly", clerkUserId: "user_fixture" } };

async function environment(run, override = {}) {
  const old = { ...process.env };
  try { Object.assign(process.env, env, override); return await run(); }
  finally { process.env = old; }
}
function load(name, dependencies) {
  const filename = require.resolve(`../api/${name}`);
  const original = Module._load;
  delete require.cache[filename];
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === filename && request in dependencies) return dependencies[request];
    return original.call(this, request, parent, isMain);
  };
  try { return require(filename); } finally { Module._load = original; }
}
function response() { return { headers: {}, code: 200,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function fixture() {
  const f = { current: subscription(), checkout: { ...session }, writes: [], reads: 0, result: true, user: "user_fixture" };
  const sdk = new Stripe(env.STRIPE_SECRET_KEY);
  class FakeStripe {
    constructor() {
      this.webhooks = sdk.webhooks;
      this.subscriptions = { retrieve: async () => { f.reads++; return f.current; } };
      this.checkout = { sessions: { retrieve: async () => { f.reads++; return f.checkout; } } };
    }
  }
  const clerk = {
    getAuthenticatedUser: async () => f.user ? { userId: f.user } : null,
    updateUserPlan: async (...args) => { if (f.error) throw f.error; f.writes.push(args); return f.result; }
  };
  f.webhook = load("webhook", { stripe: FakeStripe, "./_clerk": clerk });
  f.verify = load("subscription", { stripe: FakeStripe, "./_clerk": clerk });
  f.send = async (type, object, invalidSignature = false) => {
    const payload = JSON.stringify({ id: "evt_fixture", type, data: { object } });
    const req = Readable.from([Buffer.from(payload)]);
    req.method = "POST";
    req.headers = { "stripe-signature": sdk.webhooks.generateTestHeaderString({ payload,
      secret: invalidSignature ? "whsec_wrong" : env.STRIPE_WEBHOOK_SECRET }) };
    const res = response(); await f.webhook(req, res); return res;
  };
  f.check = async () => { const res = response();
    await f.verify({ method: "GET", query: { session_id: session.id } }, res); return res; };
  return f;
}

test("unpaid Checkout waits for asynchronous success without granting Premium", () => environment(async () => {
  const f = fixture();
  assert.equal((await f.send("checkout.session.completed", { ...session, payment_status: "unpaid" })).code, 200);
  assert.equal(f.writes.length, 0);
  assert.equal((await f.send("checkout.session.async_payment_succeeded", session)).code, 200);
  assert.equal(f.writes[0][1], "premium");
}));

test("invoice success, failure and recovery reconcile the current subscription", () => environment(async () => {
  const f = fixture(); const invoice = { id: "in_fixture", parent: { subscription_details: { subscription: "sub_fixture" } } };
  await f.send("invoice.payment_succeeded", invoice);
  assert.equal(f.writes.at(-1)[1], "premium");
  f.current = subscription("past_due");
  await f.send("invoice.payment_failed", invoice);
  assert.equal(f.writes.at(-1)[1], "free");
  f.current = subscription();
  await f.send("invoice.paid", invoice);
  assert.equal(f.writes.at(-1)[1], "premium");
}));

test("a delayed paid Checkout cannot reactivate a canceled subscription", () => environment(async () => {
  const f = fixture(); f.current = subscription("canceled");
  await f.send("customer.subscription.deleted", f.current);
  await f.send("checkout.session.async_payment_succeeded", session);
  assert.deepEqual(f.writes.map(x => x[1]), ["free", "free"]);
}));

test("an old past_due snapshot does not revoke a currently recovered subscription", () => environment(async () => {
  const f = fixture();
  await f.send("customer.subscription.updated", subscription("past_due"));
  assert.equal(f.writes.at(-1)[1], "premium");
  await f.send("customer.subscription.updated", subscription("past_due"));
  assert.equal(f.writes.at(-1)[1], "premium");
}));

test("real Stripe signature verification rejects a wrong secret before any read or write", () => environment(async () => {
  const f = fixture(); const res = await f.send("checkout.session.completed", session, true);
  assert.equal(res.code, 400); assert.equal(f.reads, 0); assert.equal(f.writes.length, 0);
  assert.equal(f.webhook.config.api.bodyParser, false);
}));

test("Clerk write failures and false results are retried instead of acknowledged", () => environment(async () => {
  const f = fixture(); f.result = false;
  assert.equal((await f.send("checkout.session.completed", session)).code, 500);
  f.error = new Error("Clerk temporarily unavailable");
  assert.equal((await f.send("checkout.session.completed", session)).code, 500);
  f.error = null; f.result = true;
  assert.equal((await f.send("checkout.session.completed", session)).code, 200);
}));

test("missing Clerk or price configuration keeps the webhook unavailable", () => environment(async () => {
  const f = fixture(); delete process.env.CLERK_SECRET_KEY;
  assert.equal((await f.send("checkout.session.completed", session)).code, 503);
  process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY; delete process.env.STRIPE_PREMIUM_PRICE_ID;
  assert.equal((await f.send("checkout.session.completed", session)).code, 503);
  assert.equal(f.writes.length, 0);
}));

test("Checkout owner or customer mismatch cannot change another account", () => environment(async () => {
  const f = fixture();
  await f.send("checkout.session.completed", { ...session, client_reference_id: "user_other" });
  await f.send("checkout.session.completed", { ...session, customer: "cus_other" });
  assert.equal(f.writes.length, 0);
}));

test("access requires the configured exact monthly price, active status and a paid invoice", () => {
  const sub = subscription(); assert.equal(hasPremiumAccess(sub, price.id), true);
  assert.equal(hasPremiumAccess(sub, "price_other"), false);
  assert.equal(hasPremiumAccess(subscription("past_due"), price.id), false);
  assert.equal(hasPremiumAccess({ ...sub, latest_invoice: { status: "open" } }, price.id), false);
  assert.equal(hasPremiumAccess({ ...sub, items: { data: [{ price: { ...price, recurring: { interval: "month", interval_count: 2 } } }] } }, price.id), false);
  assert.equal(hasPremiumAccess({ ...sub, items: { data: [{ price: { ...price, active: false } }] } }, price.id), true);
});

test("return authenticates before Stripe reads and refuses a different owner", () => environment(async () => {
  const f = fixture(); f.user = null;
  assert.equal((await f.check()).code, 401); assert.equal(f.reads, 0);
  f.user = "user_other"; assert.equal((await f.check()).code, 403);
}));

test("return distinguishes pending payment from paid Premium and past_due", () => environment(async () => {
  const f = fixture(); f.checkout.payment_status = "unpaid";
  f.current.latest_invoice.status = "open";
  const pending = await f.check(); assert.equal(pending.code, 202);
  assert.equal(pending.body.pending, true); assert.equal(pending.body.active, false);
  f.current = subscription(); f.checkout.payment_status = "paid";
  assert.equal((await f.check()).body.active, true);
  f.current = subscription("past_due"); assert.equal((await f.check()).code, 402);
  f.current = { ...subscription(), customer: "cus_other" }; assert.equal((await f.check()).code, 402);
  f.current = subscription(); f.checkout.payment_status = "unpaid";
  assert.equal((await f.check()).body.active, false);
}));

test("Clerk metadata failures throw while late old-subscription events preserve the current plan", () => environment(async () => {
  const writes = []; const current = { publicMetadata: { plan: "premium" }, privateMetadata: { stripeSubscriptionId: "sub_current" } };
  const clerk = load("_clerk", { "@clerk/backend": { createClerkClient: () => ({ users: {
    getUser: async () => current, updateUserMetadata: async (...args) => writes.push(args)
  } }) } });
  delete process.env.CLERK_SECRET_KEY;
  await assert.rejects(() => clerk.updateUserPlan("user_fixture", "premium"));
  process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
  assert.equal(await clerk.updateUserPlan("user_fixture", "free", { subscriptionId: "sub_old" }), true);
  assert.equal(writes.length, 0);
  assert.equal(await clerk.updateUserPlan("user_fixture", "free", { subscriptionId: "sub_current" }), true);
  assert.equal(writes.length, 1);
}));

test("pending payment screen offers retry and never claims payment confirmed", async () => {
  const nodes = {};
  for (const id of ["verification-message", "result-status", "portal-button", "retry-button"]) {
    nodes[id] = { hidden: true, textContent: "", classList: { add() {}, remove() {} },
      addEventListener(name, fn) { this[name] = fn; } };
  }
  let paid = false;
  const ready = vm.runInNewContext(fs.readFileSync(require.resolve("../success.js"), "utf8"), {
    document: { getElementById: id => nodes[id] }, URLSearchParams, encodeURIComponent, Error,
    window: { location: { search: "?session_id=cs_test_fixture" }, MomentumVeloAuthReady: Promise.resolve("managed"),
      Clerk: { session: { getToken: async () => "fixture-token" } } },
    fetch: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      return { status: paid ? 200 : 202, ok: true,
        json: async () => paid ? { active: true } : { active: false, pending: true, message: "Pago pendiente." } };
    }
  });
  await ready;
  assert.match(nodes["verification-message"].textContent, /pendiente/);
  assert.equal(nodes["portal-button"].hidden, true); assert.equal(nodes["retry-button"].hidden, false);
  assert.doesNotMatch(nodes["result-status"].textContent, /Pago confirmado/);
  paid = true; await nodes["retry-button"].click();
  assert.match(nodes["result-status"].textContent, /Pago confirmado/);
  assert.equal(nodes["portal-button"].hidden, false); assert.equal(nodes["retry-button"].hidden, true);
});

test("an unavailable Clerk connection never uses a leftover session token on return", async () => {
  const nodes = {};
  for (const id of ["verification-message", "result-status", "portal-button", "retry-button"]) {
    nodes[id] = { hidden: true, textContent: "", classList: { add() {}, remove() {} },
      addEventListener(name, fn) { this[name] = fn; } };
  }
  let tokenReads = 0;
  await vm.runInNewContext(fs.readFileSync(require.resolve("../success.js"), "utf8"), {
    document: { getElementById: id => nodes[id] }, URLSearchParams, encodeURIComponent, Error,
    window: { location: { search: "?session_id=cs_test_fixture" }, MomentumVeloAuthReady: Promise.resolve("unavailable"),
      Clerk: { session: { getToken: async () => { tokenReads++; return "stale-token"; } } } },
    fetch: async (_url, options) => {
      assert.equal(options.headers.Authorization, undefined);
      return { status: 401, ok: false, json: async () => ({ error: "Inicia sesión para verificar tu suscripción." }) };
    }
  });
  assert.equal(tokenReads, 0);
  assert.equal(nodes["portal-button"].hidden, true);
  assert.equal(nodes["retry-button"].hidden, false);
  assert.doesNotMatch(nodes["result-status"].textContent, /Pago confirmado/);
});
