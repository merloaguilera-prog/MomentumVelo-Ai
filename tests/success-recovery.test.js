const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../success.js"), "utf8");

function page() {
  const f = { tokenReads: 0, verificationCalls: 0, portalCalls: 0, navigation: [], nodes: {} };
  for (const id of ["verification-message", "result-status", "portal-button", "retry-button"]) {
    f.nodes[id] = { hidden: true, disabled: false, textContent: "", attributes: {},
      classList: { add() {}, remove() {} }, setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, fn) { this[name] = fn; } };
  }
  f.window = { MomentumVeloAuthReady: Promise.resolve("managed"),
    location: { search: "?session_id=cs_test_fixture", assign: url => f.navigation.push(url) },
    setTimeout: fn => setTimeout(fn, 10), clearTimeout,
    Clerk: { isSignedIn: true, session: { getToken: async () => {
      f.tokenReads++; if (f.waitToken) await f.waitToken;
      return f.missingToken ? null : "fixture-token";
    } } } };
  f.run = () => vm.runInNewContext(source, { window: f.window,
    document: { getElementById: id => f.nodes[id] }, URL, URLSearchParams, encodeURIComponent, Error,
    fetch: async (url, options) => {
      const portal = url === "/api/portal";
      if (portal) f.portalCalls++; else f.verificationCalls++;
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      if (portal && f.waitPortal) await f.waitPortal;
      if (!portal && f.waitVerification) await f.waitVerification;
      return { status: f.pending && !portal ? 202 : 200, ok: true, json: async () => {
        if (f.waitBody) await f.waitBody;
        return portal ? { url: f.portalUrl || "https://billing.stripe.com/p/session/test_fixture" }
          : f.pending ? { active: false, pending: true, message: "Pago pendiente." } : { active: true };
      } };
    } });
  return f;
}

async function settles(operation) {
  let timer;
  try { await Promise.race([operation, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Payment return remained blocked")), 150);
  })]); } finally { clearTimeout(timer); }
}

test("return refuses an expired session without querying Stripe and permits retry with a fresh token", async () => {
  const f = page(); f.missingToken = true;
  await f.run();
  assert.equal(f.verificationCalls, 0);
  assert.equal(f.nodes["portal-button"].hidden, true);
  assert.equal(f.nodes["retry-button"].disabled, false);
  assert.match(f.nodes["result-status"].textContent, /sesión/i);
  f.missingToken = false; await f.nodes["retry-button"].click();
  assert.equal(f.verificationCalls, 1);
  assert.match(f.nodes["result-status"].textContent, /Pago confirmado/);
});

test("a stalled auth bootstrap, token, verification request or body permits a later successful retry", async () => {
  for (const stage of ["auth", "waitToken", "waitVerification", "waitBody"]) {
    const f = page(); let release;
    const pending = new Promise(resolve => { release = resolve; });
    if (stage === "auth") f.window.MomentumVeloAuthReady = pending; else f[stage] = pending;
    const run = f.run();
    try {
      await settles(run);
      assert.equal(f.nodes["retry-button"].disabled, false);
      assert.equal(f.nodes["retry-button"].hidden, false);
      assert.equal(f.nodes["portal-button"].hidden, true);
      assert.doesNotMatch(f.nodes["result-status"].textContent, /Pago confirmado/);
    } finally { release("managed"); await run; }
    if (stage !== "auth") f[stage] = null;
    await f.nodes["retry-button"].click();
    assert.match(f.nodes["result-status"].textContent, /Pago confirmado/);
  }
});

test("return portal refuses a missing token and permits a signed-in retry", async () => {
  const f = page(); await f.run();
  f.missingToken = true; await f.nodes["portal-button"].click();
  assert.equal(f.portalCalls, 0);
  assert.equal(f.nodes["portal-button"].disabled, false);
  f.missingToken = false; await f.nodes["portal-button"].click();
  assert.equal(f.portalCalls, 1);
  assert.deepEqual(f.navigation, ["https://billing.stripe.com/p/session/test_fixture"]);
});

test("return portal ignores unsafe redirects and restores the button for a correct retry", async () => {
  const f = page(); await f.run();
  for (const url of ["javascript:alert(1)", "https://other.invalid/", "https://name@billing.stripe.com/",
    "http://billing.stripe.com/", "https://billing.stripe.com:8443/"]) {
    f.portalUrl = url; await f.nodes["portal-button"].click();
    assert.equal(f.navigation.length, 0);
    assert.equal(f.nodes["portal-button"].disabled, false);
  }
  f.portalUrl = null; await f.nodes["portal-button"].click();
  assert.equal(f.navigation.length, 1);
});

test("stalled return portal request or response body restores management after the timeout", async () => {
  for (const stage of ["waitPortal", "waitBody"]) {
    const f = page(); await f.run(); let release;
    f[stage] = new Promise(resolve => { release = resolve; });
    const attempt = f.nodes["portal-button"].click();
    try {
      await settles(attempt);
      assert.equal(f.nodes["portal-button"].disabled, false);
      assert.equal(f.navigation.length, 0);
    } finally { release(); await attempt; }
    f[stage] = null; await f.nodes["portal-button"].click();
    assert.equal(f.navigation.length, 1);
  }
});
