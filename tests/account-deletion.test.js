const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { clearLocalData } = require("../account-data");

function load(filename, substitutions) {
  const path = require.resolve(filename);
  delete require.cache[path];
  const original = Module._load;
  Module._load = function (name, parent, main) {
    if (parent?.filename === path && Object.hasOwn(substitutions, name)) return substitutions[name];
    return original.call(this, name, parent, main);
  };
  try { return require(path); } finally { Module._load = original; }
}

async function scenario(run) {
  const old = { ...process.env };
  Object.assign(process.env, { CLERK_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
    STRIPE_SECRET_KEY: "sk_test_fixture", VERCEL_ENV: "preview", VERCEL_URL: "account-test.vercel.app" });
  const f = {
    calls: [], stripeCalls: [], claims: { sub: "user_alice", sid: "sess_alice", fva: [0, -1] },
    user: { id: "user_alice", primaryEmailAddressId: "id_email", emailAddresses: [{ id: "id_email", emailAddress: "alice@example.com" }],
      twoFactorEnabled: false, privateMetadata: {}, publicMetadata: { plan: "free" } },
    session: { id: "sess_alice", userId: "user_alice", status: "active" },
    customer: { id: "cus_fixture", livemode: false, metadata: { clerkUserId: "user_alice" } },
    subscriptions: [], checkouts: []
  };
  const clerkClient = {
    users: {
      getUser: async id => {
        f.calls.push(["getUser", id]);
        if (f.readFailure) throw f.readFailure;
        if (f.deleted) throw { status: 404 };
        return structuredClone(f.user);
      },
      updateUserMetadata: async (id, data) => {
        f.calls.push(["metadata", id, data]);
        if (f.metadataFailure) throw { status: 503 };
        Object.assign(f.user.privateMetadata, data.privateMetadata);
        Object.assign(f.user.publicMetadata, data.publicMetadata);
      },
      deleteUser: async id => {
        f.calls.push(["deleteUser", id]);
        if (f.identityDeleteFailure) throw { status: 503 };
        f.deleted = true;
        return { id };
      }
    },
    sessions: { getSession: async id => {
      f.calls.push(["getSession", id]);
      if (f.sessionFailure) throw f.sessionFailure;
      return structuredClone(f.session);
    } }
  };
  const sdk = { createClerkClient: () => clerkClient, verifyToken: async (token, options) => {
    f.calls.push(["verify", token, options]);
    if (f.invalidToken) throw new Error("fixture-invalid");
    return structuredClone(f.claims);
  } };
  class FakeStripe {
    constructor() {
      f.stripeCalls.push(["construct"]);
      this.customers = {
        retrieve: async id => { f.stripeCalls.push(["retrieve", id]); if (f.customerFailure) throw { status: 503 }; return structuredClone(f.customer); },
        del: async id => {
          f.stripeCalls.push(["deleteCustomer", id]);
          if (f.billingDeleteFailure) throw { status: 503 };
          f.customer = { id, deleted: true };
          return f.customer;
        }
      };
      this.subscriptions = { list: async args => {
        f.stripeCalls.push(["subscriptions", args]);
        if (f.subscriptionPage) return f.subscriptionPage(args);
        return { data: structuredClone(f.subscriptions), has_more: false };
      } };
      this.checkout = { sessions: {
        list: async args => {
          f.stripeCalls.push(["checkouts", args]);
          return { data: structuredClone(f.checkouts.filter(item => item.status === "open")), has_more: false };
        },
        expire: async id => {
          f.stripeCalls.push(["expire", id]);
          if (f.expireFailure) throw { status: 503 };
          const current = f.checkouts.find(item => item.id === id);
          current.status = "expired";
          return current;
        }
      } };
    }
  }
  f.clerk = load("../api/_clerk", { "@clerk/backend": sdk });
  const handler = load("../api/delete-account", { "@clerk/backend": sdk, stripe: FakeStripe, "./_clerk": f.clerk });
  f.request = async ({ body = {}, headers = {}, ...changes } = {}) => {
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; },
      json(data) { this.body = data; return this; } };
    await handler({ method: "POST", headers: { origin: "https://account-test.vercel.app", "content-type": "application/json",
      authorization: "Bearer fixture-token", ...headers }, body: { email: "alice@example.com", confirmation: "ELIMINAR", acceptConsequences: true, ...body }, ...changes }, res);
    return res;
  };
  f.linkBilling = () => { f.user.privateMetadata.stripeCustomerId = "cus_fixture"; };
  f.subscription = id => ({ id, customer: "cus_fixture", livemode: false, status: "active",
    metadata: { clerkUserId: "user_alice", plan: "premium-monthly" } });
  f.checkout = id => ({ id, customer: "cus_fixture", livemode: false, mode: "subscription", status: "open",
    metadata: { clerkUserId: "user_alice", plan: "premium-monthly" } });
  try { await run(f); } finally { process.env = old; }
}

const mutations = f => f.calls.filter(call => ["metadata", "deleteUser"].includes(call[0]));

test("deletion rejects other methods, untrusted origins, wrong content types and absent confirmation before any vendor access", () => scenario(async f => {
  for (const request of [
    { method: "GET" }, { headers: { origin: "https://attacker.example" } },
    { headers: { origin: undefined } }, { headers: { "sec-fetch-site": "cross-site" } },
    { headers: { "content-type": "text/plain" } }, { headers: { "content-type": "application/jsonp" } },
    { body: { confirmation: "eliminar" } }, { body: { acceptConsequences: "true" } }
  ]) {
    const res = await f.request(request);
    assert.ok([400, 403, 405, 415].includes(res.code));
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.body.deleted, undefined);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.stripeCalls.length, 0);
}));

test("a missing or invalid bearer token cannot read or delete an account", () => scenario(async f => {
  assert.equal((await f.request({ headers: { authorization: "" } })).code, 401);
  f.invalidToken = true;
  assert.equal((await f.request()).code, 401);
  assert.equal(f.calls.filter(call => call[0] === "getUser").length, 0);
  assert.deepEqual(mutations(f), []);
}));

test("recent token issuance is insufficient: a signed, recent credential age and a non-impersonated session are required", () => scenario(async f => {
  for (const age of [undefined, null, [-1, -1], [10, -1], [NaN, -1], ["0", -1]]) {
    f.claims.fva = age;
    f.claims.iat = Math.floor(Date.now() / 1000);
    const res = await f.request();
    assert.equal(res.code, 403);
    assert.equal(res.body.code, "REAUTHENTICATION_REQUIRED");
  }
  f.claims.fva = [0, 0]; f.claims.act = { sub: "user_admin" };
  assert.equal((await f.request()).code, 403);
  f.claims.act = null; f.claims.sid = null;
  assert.equal((await f.request()).code, 403);
  assert.deepEqual(mutations(f), []);
}));

test("a stale second factor or a revoked or mismatched session cannot authorize deletion", () => scenario(async f => {
  f.user.twoFactorEnabled = true;
  const stale = await f.request();
  assert.equal(stale.code, 403);
  f.claims.fva = [0, 0]; f.session.status = "revoked";
  assert.equal((await f.request()).code, 401);
  f.session.status = "active"; f.session.userId = "user_bob";
  assert.equal((await f.request()).code, 401);
  f.session.userId = "user_alice"; f.sessionFailure = { status: 404 };
  assert.equal((await f.request()).code, 401);
  assert.deepEqual(mutations(f), []);
}));

test("confirmation uses the authenticated account's primary email; body user IDs never select another account", () => scenario(async f => {
  assert.equal((await f.request({ body: { email: "bob@example.com", userId: "user_bob" } })).code, 400);
  assert.deepEqual(mutations(f), []);
  const res = await f.request({ body: { email: " ALICE@example.com ", userId: "user_bob", customerId: "cus_bob" } });
  assert.equal(res.code, 200);
  assert.equal(res.body.deleted, true);
  assert.deepEqual(mutations(f).map(call => call.slice(0, 2)), [["metadata", "user_alice"], ["deleteUser", "user_alice"]]);
  assert.equal(f.stripeCalls.length, 0);
  assert.ok(f.calls.find(call => call[0] === "verify")[2].authorizedParties.includes("https://account-test.vercel.app"));
}));

test("Preview refuses live Clerk credentials and billing refuses mixed modes before any deletion", () => scenario(async f => {
  process.env.CLERK_SECRET_KEY = "sk_live_fixture"; process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_fixture";
  assert.equal((await f.request()).code, 503);
  assert.equal(f.calls.length, 0);
  process.env.CLERK_SECRET_KEY = "sk_test_fixture"; process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fixture";
  f.linkBilling(); process.env.STRIPE_SECRET_KEY = "sk_live_fixture";
  assert.equal((await f.request()).code, 503);
  assert.deepEqual(mutations(f), []);
  assert.equal(f.stripeCalls.length, 0);
}));

test("unverified, shared or wrong-mode billing references leave both account and customer intact", () => scenario(async f => {
  f.linkBilling();
  for (const changes of [{ metadata: {} }, { metadata: { clerkUserId: "user_bob" } }, { livemode: true }, { id: "cus_bob" }]) {
    f.customer = { id: "cus_fixture", livemode: false, metadata: { clerkUserId: "user_alice" }, ...changes };
    assert.equal((await f.request()).code, 409);
  }
  f.customer = { id: "cus_fixture", livemode: false, metadata: { clerkUserId: "user_alice" } };
  f.subscriptions = [{ ...f.subscription("sub_other"), metadata: { clerkUserId: "user_bob", plan: "other-app" } }];
  assert.equal((await f.request()).code, 409);
  assert.deepEqual(mutations(f), []);
  assert.equal(f.stripeCalls.some(call => call[0] === "deleteCustomer"), false);
}));

test("every page of billing history is verified before a destructive call", () => scenario(async f => {
  f.linkBilling();
  f.subscriptionPage = args => args.starting_after
    ? { data: [{ ...f.subscription("sub_other"), metadata: { clerkUserId: "user_bob" } }], has_more: false }
    : { data: [f.subscription("sub_first")], has_more: true };
  assert.equal((await f.request()).code, 409);
  assert.deepEqual(mutations(f), []);
  assert.equal(f.stripeCalls.findLast(call => call[0] === "subscriptions")[1].starting_after, "sub_first");
  f.subscriptionPage = () => ({ data: [], has_more: true });
  assert.equal((await f.request()).code, 503);
  assert.deepEqual(mutations(f), []);
}));

test("a linked customer's open purchase links close before customer deletion and the identity is deleted last", () => scenario(async f => {
  f.linkBilling(); f.subscriptions = [f.subscription("sub_fixture")];
  f.checkouts = [f.checkout("cs_test_first"), f.checkout("cs_test_second")];
  let customerRemoved = false;
  const originalPush = f.stripeCalls.push.bind(f.stripeCalls);
  f.stripeCalls.push = (...calls) => { if (calls[0][0] === "deleteCustomer") customerRemoved = true; return originalPush(...calls); };
  const originalCalls = f.calls.push.bind(f.calls);
  f.calls.push = (...calls) => { if (calls[0][0] === "deleteUser") assert.equal(customerRemoved, true); return originalCalls(...calls); };
  const res = await f.request();
  assert.equal(res.code, 200);
  assert.equal(res.body.deleted, true);
  assert.deepEqual(f.stripeCalls.filter(call => ["expire", "deleteCustomer"].includes(call[0])),
    [["expire", "cs_test_first"], ["expire", "cs_test_second"], ["deleteCustomer", "cus_fixture"]]);
}));

test("billing failure never deletes the identity or claims success, and an explicit retry can finish", () => scenario(async f => {
  f.linkBilling(); f.checkouts = [f.checkout("cs_test_fixture")]; f.billingDeleteFailure = true;
  const failed = await f.request();
  assert.equal(failed.code, 503);
  assert.equal(failed.body.deleted, undefined);
  assert.equal(f.calls.some(call => call[0] === "deleteUser"), false);
  assert.ok(f.user.privateMetadata.accountDeletionStartedAt);
  await assert.rejects(() => f.clerk.getUserStripeCustomerId("user_alice"), /eliminación/);
  await assert.rejects(() => f.clerk.setUserStripeCustomerId("user_alice", "cus_new"), /eliminación/);
  f.billingDeleteFailure = false;
  assert.equal((await f.request()).code, 200);
  assert.equal(f.stripeCalls.filter(call => call[0] === "expire").length, 1);
}));

test("a purchase-link failure and a metadata failure leave the billing profile and identity intact", () => scenario(async f => {
  f.linkBilling(); f.checkouts = [f.checkout("cs_test_fixture")]; f.metadataFailure = true;
  assert.equal((await f.request()).code, 503);
  assert.equal(f.stripeCalls.some(call => call[0] === "expire"), false);
  f.metadataFailure = false; f.expireFailure = true;
  assert.equal((await f.request()).code, 503);
  assert.equal(f.stripeCalls.some(call => call[0] === "deleteCustomer"), false);
  assert.equal(f.deleted, undefined);
}));

test("retrying an interrupted identity deletion does not repeat billing deletion; a lost success response is idempotent", () => scenario(async f => {
  f.linkBilling(); f.identityDeleteFailure = true;
  assert.equal((await f.request()).code, 503);
  assert.equal(f.customer.deleted, true);
  f.identityDeleteFailure = false;
  assert.equal((await f.request()).code, 200);
  assert.equal((await f.request()).body.deleted, true);
  assert.equal(f.stripeCalls.filter(call => call[0] === "deleteCustomer").length, 1);
}));

test("a Premium account with missing customer linkage requires assistance and cannot leave a recurring charge orphaned", () => scenario(async f => {
  for (const changes of [{ plan: "premium" }, { premiumStatus: "past_due" }, { premiumStatus: "trialing" }]) {
    f.user.publicMetadata = changes;
    assert.equal((await f.request()).code, 409);
  }
  assert.deepEqual(mutations(f), []);
}));

test("late Stripe events skip deleted or deleting accounts while genuine Clerk outages remain retryable", () => scenario(async f => {
  f.user.privateMetadata.accountDeletionStartedAt = "fixture-date";
  assert.equal(await f.clerk.updateUserPlan("user_alice", "premium"), true);
  assert.equal(await f.clerk.hasUserPremiumEntitlement("user_alice", "cus_fixture", "sub_fixture"), false);
  assert.deepEqual(mutations(f), []);
  f.deleted = true;
  assert.equal(await f.clerk.updateUserPlan("user_alice", "premium"), true);
  f.readFailure = { status: 503 };
  await assert.rejects(() => f.clerk.updateUserPlan("user_alice", "premium"));
  assert.deepEqual(mutations(f), []);
}));

function storage(entries, failOn) {
  const values = new Map(entries);
  return { values, get length() { return values.size; }, key: index => [...values.keys()][index],
    removeItem(key) { if (key === failOn) throw new Error("storage blocked"); values.delete(key); } };
}
test("local cleanup removes only MomentumVelo data, covers both stores and reports failures without false success", () => {
  const local = storage([["momentumvelo.markets.workspace.v1", "private-notes"], ["momentumvelo.practice.portfolio.v1", "diary"], ["another-app", "keep"]]);
  const session = storage([["momentumvelo.compare.transfer.v1", "csv"], ["another-session", "keep"]]);
  assert.deepEqual(clearLocalData([local, session]), { removed: 3, failed: false });
  assert.deepEqual([...local.values], [["another-app", "keep"]]);
  assert.deepEqual([...session.values], [["another-session", "keep"]]);
  const blocked = storage([["momentumvelo.blocked", "keep"], ["momentumvelo.other", "remove"]], "momentumvelo.blocked");
  assert.deepEqual(clearLocalData([blocked]), { removed: 1, failed: true });
  assert.equal(blocked.values.get("momentumvelo.blocked"), "keep");
});
