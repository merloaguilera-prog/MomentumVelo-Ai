const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const env = { PREMIUM_SALES_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_PREMIUM_PRICE_ID: "price_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  CLERK_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
  VERCEL_ENV: "preview", VERCEL_URL: "momentum-test.vercel.app" };
async function environment(run, changes = {}) {
  const old = { ...process.env };
  try { Object.assign(process.env, env, changes); await run(); } finally { process.env = old; }
}
function load(name, dependencies) {
  const filename = require.resolve(`../api/${name}`), original = Module._load;
  delete require.cache[filename];
  Module._load = function(request, parent, main) {
    if (parent?.filename === filename && request in dependencies) return dependencies[request];
    return original.call(this, request, parent, main);
  };
  try { return require(filename); } finally { Module._load = original; }
}
function fixture() {
  const f = { customerId: null, customerCreates: 0, sessionCreates: 0, clients: 0,
    sessions: [], subscriptions: [], requests: [], customerKeys: new Map(), sessionKeys: new Map() };
  const page = (items, params) => {
    const offset = params.starting_after ? items.findIndex(x => x.id === params.starting_after) + 1 : 0;
    return { data: items.slice(offset, offset + params.limit), has_more: items.length > offset + params.limit };
  };
  class FakeStripe {
    constructor() {
      f.clients++;
      this.prices = { retrieve: async () => ({ id: "price_fixture", livemode: false,
        active: true, currency: "eur", unit_amount: f.amount || 4900, recurring: { interval: "month", interval_count: 1 } }) };
      this.customers = {
        create: async (args, options) => {
          assert.ok(options.idempotencyKey);
          if (!f.customerKeys.has(options.idempotencyKey)) {
            f.customerCreates++;
            f.customerKeys.set(options.idempotencyKey, { id: "cus_fixture", livemode: false, metadata: args.metadata });
          }
          return f.customerKeys.get(options.idempotencyKey);
        },
        retrieve: async () => ({ id: "cus_fixture", livemode: false, metadata: { clerkUserId: "user_fixture" } })
      };
      this.subscriptions = {
        list: async params => page(f.subscriptions, params),
        retrieve: async () => ({ id: "sub_previous", status: f.currentStatus || "active" })
      };
      this.checkout = { sessions: {
        list: async params => page(params.status ? f.sessions.filter(x => x.status === params.status) : f.sessions, params),
        create: async (args, options) => {
          assert.ok(options.idempotencyKey);
          if (f.keyBusy) { f.keyBusy = false; throw Object.assign(new Error("concurrent fixture"), { code: "idempotency_key_in_use" }); }
          if (!f.sessionKeys.has(options.idempotencyKey)) {
            f.sessionCreates++; f.requests.push({ args, options });
            const result = { ...args, id: `cs_test_${f.sessionCreates}`, status: "open", livemode: false,
              url: `https://checkout.stripe.com/c/pay/cs_test_${f.sessionCreates}` };
            f.sessionKeys.set(options.idempotencyKey, result); f.sessions.unshift(result);
          } else assert.deepEqual(args, f.requests.find(x => x.options.idempotencyKey === options.idempotencyKey).args);
          if (f.loseResponse) { f.loseResponse = false; throw new Error("response lost after fixture creation"); }
          return f.sessionKeys.get(options.idempotencyKey);
        }
      } };
    }
  }
  const clerk = {
    getAuthenticatedUser: async () => ({ userId: "user_fixture" }),
    getUserStripeCustomerId: async () => f.customerId,
    setUserStripeCustomerId: async (_user, id) => { if (f.writeFailure) throw new Error("metadata fixture unavailable"); f.customerId = id; return true; }
  };
  // Separate handler loads share only the fake remote Stripe/Clerk services, not a local lock.
  const a = load("checkout", { stripe: FakeStripe, "./_clerk": clerk });
  const b = load("checkout", { stripe: FakeStripe, "./_clerk": clerk });
  f.send = async (handler = a, body = {}) => {
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: "POST", body, headers: {} }, res); return res;
  };
  f.other = b;
  return f;
}

test("simultaneous first checkouts across handlers create one linked customer and session", () => environment(async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.send(undefined, { email: "first@example.com" }), f.send(f.other, { email: "other@example.com", customer: "cus_attacker" })]);
  assert.deepEqual([a.code, b.code], [200, 200]);
  assert.equal(a.body.url, b.body.url);
  assert.equal(f.customerCreates, 1); assert.equal(f.sessionCreates, 1);
  assert.equal(f.customerId, "cus_fixture");
  assert.equal(f.requests[0].args.customer, "cus_fixture");
  assert.equal(f.requests[0].args.customer_email, undefined);
  assert.equal(f.requests[0].args.client_reference_id, "user_fixture");
  assert.doesNotMatch(f.requests[0].options.idempotencyKey, /user_fixture|example.com/);
}));

test("retry after a lost response reuses the pending Checkout without a second session", () => environment(async () => {
  const f = fixture(); f.loseResponse = true;
  assert.equal((await f.send()).code, 502);
  const retry = await f.send(f.other);
  assert.equal(retry.code, 200); assert.equal(retry.body.reused, true);
  assert.equal(f.sessionCreates, 1); assert.equal(f.customerCreates, 1);
}));

test("expired attempts permit a new session with a new key and the same durable customer", () => environment(async () => {
  const f = fixture(); await f.send(); f.sessions[0].status = "expired";
  const next = await f.send(f.other);
  assert.equal(next.code, 200); assert.equal(f.sessionCreates, 2); assert.equal(f.customerCreates, 1);
  assert.notEqual(f.requests[0].options.idempotencyKey, f.requests[1].options.idempotencyKey);
}));

test("ongoing subscriptions direct accounts to management instead of starting another subscription", () => environment(async () => {
  for (const status of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]) {
    const f = fixture(); f.customerId = "cus_fixture"; f.subscriptions = [{ id: "sub_existing", status }];
    const result = await f.send();
    assert.equal(result.code, 409, status); assert.equal(result.body.manageSubscription, true);
    assert.equal(f.sessionCreates, 0); assert.equal(f.customerCreates, 0);
  }
}));

test("a subscription on a later Stripe page also prevents new Checkout", () => environment(async () => {
  const f = fixture(); f.customerId = "cus_fixture";
  f.subscriptions = [...Array.from({ length: 100 }, (_, i) => ({ id: `sub_old_${i}`, status: "canceled" })), { id: "sub_active", status: "active" }];
  assert.equal((await f.send()).code, 409); assert.equal(f.sessionCreates, 0);
}));

test("pending sessions with another owner, price or return origin are never reused", () => environment(async () => {
  for (const field of ["owner", "price", "origin"]) {
    const f = fixture(); await f.send();
    if (field === "owner") f.sessions[0].client_reference_id = "user_other";
    if (field === "price") f.sessions[0].metadata.premiumPriceId = "price_other";
    if (field === "origin") f.sessions[0].success_url = "https://momentumvelo.app/success";
    const result = await f.send();
    assert.equal(result.code, 409); assert.equal(result.body.url, undefined); assert.equal(f.sessionCreates, 1);
  }
}));

test("completion between lists is checked against the current subscription before rotating attempts", () => environment(async () => {
  const f = fixture(); await f.send(); f.sessions[0].status = "complete"; f.sessions[0].subscription = "sub_previous";
  assert.equal((await f.send()).code, 409); assert.equal(f.sessionCreates, 1);
  f.currentStatus = "canceled";
  assert.equal((await f.send()).code, 200); assert.equal(f.sessionCreates, 2);
}));

test("failure to persist customer association prevents Checkout and recovery keeps that customer", () => environment(async () => {
  const f = fixture(); f.writeFailure = true;
  assert.equal((await f.send()).code, 502); assert.equal(f.sessionCreates, 0);
  f.writeFailure = false;
  assert.equal((await f.send(f.other)).code, 200); assert.equal(f.customerCreates, 1); assert.equal(f.sessionCreates, 1);
}));

test("provider idempotency contention is retryable and does not change the attempt key", () => environment(async () => {
  const f = fixture(); f.keyBusy = true;
  const first = await f.send(); assert.equal(first.code, 409); assert.equal(first.body.retryable, true);
  assert.equal((await f.send()).code, 200); assert.equal(f.sessionCreates, 1);
}));

test("closed sales and invalid price cannot create a customer or Checkout", async () => {
  await environment(async () => {
    const f = fixture(); assert.equal((await f.send()).code, 503); assert.equal(f.clients, 0);
  }, { PREMIUM_SALES_ENABLED: "false" });
  await environment(async () => {
    const f = fixture(); f.amount = 5900;
    assert.equal((await f.send()).code, 503); assert.equal(f.customerCreates, 0); assert.equal(f.sessionCreates, 0);
  });
});

test("customer metadata binding never overwrites another customer or the subscription fields", () => environment(async () => {
  const current = { privateMetadata: { stripeCustomerId: "cus_existing", stripeSubscriptionId: "sub_current", unrelated: "kept" } };
  const writes = [];
  const clerk = load("_clerk", { "@clerk/backend": { createClerkClient: () => ({ users: {
    getUser: async () => current, updateUserMetadata: async (_id, args) => writes.push(args)
  } }) } });
  await assert.rejects(() => clerk.setUserStripeCustomerId("user_fixture", "cus_other"));
  assert.equal(writes.length, 0);
  delete current.privateMetadata.stripeCustomerId;
  assert.equal(await clerk.setUserStripeCustomerId("user_fixture", "cus_new"), true);
  assert.deepEqual(writes, [{ privateMetadata: { stripeCustomerId: "cus_new" } }]);
  assert.equal(current.privateMetadata.stripeSubscriptionId, "sub_current");
}));
