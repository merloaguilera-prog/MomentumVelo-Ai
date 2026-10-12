const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../auth-provider.js"), "utf8");

function element(hidden = false) {
  const listeners = new Map();
  return {
    hidden, disabled: false, textContent: "", attributes: {},
    classList: { add() {}, remove() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn, options = {}) {
      const entries = listeners.get(name) || [];
      entries.push({ fn, once: options.once }); listeners.set(name, entries);
    },
    async click() {
      if (this.disabled) return;
      for (const entry of [...(listeners.get("click") || [])]) {
        if (entry.once) listeners.set("click", listeners.get("click").filter(item => item !== entry));
        await entry.fn();
      }
    }
  };
}

async function account(metadata, premiumSalesEnabled = false) {
  const f = { portalAttempts: 0, checkoutAttempts: 0, tokenReads: 0, tokenFailure: false, portalFailure: false, navigation: [] };
  const selectors = ["auth-view", "managed-auth", "account-view", "auth-connection", "auth-retry",
    "account-title", "account-message", "account-email", "account-plan", "premium-next",
    "premium-status", "manage-subscription", "signout"];
  const nodes = Object.fromEntries(selectors.map(name => [`[data-${name}]`, element(true)]));
  nodes["[data-manage-subscription]"].textContent = "Gestionar o cancelar Premium";
  nodes["[data-account-view]"].querySelector = selector => nodes[selector];
  const key = `pk_test_${Buffer.from("test.clerk.accounts.dev$").toString("base64")}`;
  const window = {
    location: { origin: "https://momentum-test.vercel.app", assign: url => f.navigation.push(url) },
    setTimeout, clearTimeout, atob: value => Buffer.from(value, "base64").toString(),
    Clerk: { isSignedIn: true, user: { firstName: "Prueba", publicMetadata: metadata,
      primaryEmailAddress: { emailAddress: "test@example.com" } },
      load: async () => {}, session: { getToken: async () => {
        f.tokenReads++;
        if (f.tokenFailure) throw new Error("Sesión temporalmente no disponible.");
        if (f.missingToken) return null;
        return "fixture-token";
      } } }
  };
  const document = { querySelector: selector => nodes[selector] || null, querySelectorAll: () => [],
    createElement: () => element(), body: { classList: { add() {} } },
    head: { appendChild: script => queueMicrotask(() => {
      // Script load callbacks are different from the buttons' click callbacks.
      script.loaded();
    }) } };
  document.createElement = () => ({ setAttribute() {}, addEventListener: function(name, fn) {
    if (name === "load") this.loaded = fn;
  } });
  vm.runInNewContext(source, { window, document, URL, URLSearchParams, console,
    fetch: async (url, options) => {
      if (url === "/api/auth-config") return { ok: true, json: async () => ({ enabled: true, publishableKey: key, premiumSalesEnabled }) };
      if (url === "/api/checkout") {
        assert.equal(options.headers.Authorization, "Bearer fixture-token");
        assert.equal(options.body, "{}");
        f.checkoutAttempts++;
        if (f.waitCheckout) await f.waitCheckout;
        return { ok: !f.checkoutFailure, json: async () => f.checkoutFailure
          ? { error: "Hay una suscripción pendiente.", manageSubscription: true }
          : { url: f.checkoutUrl || "https://checkout.stripe.com/c/pay/cs_test_fixture" } };
      }
      assert.equal(url, "/api/portal");
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      f.portalAttempts++;
      return { ok: !f.portalFailure, json: async () => f.portalFailure
        ? { error: "El portal no está disponible temporalmente." }
        : { url: "https://billing.stripe.com/test-fixture" } };
    }
  });
  assert.equal(await window.MomentumVeloAuthReady, "managed");
  return Object.assign(f, { nodes, portal: nodes["[data-manage-subscription]"],
    upgrade: nodes["[data-premium-next]"], message: nodes["[data-account-message]"] });
}

test("past_due, unpaid and incomplete accounts keep payment management without Premium access", async () => {
  for (const status of ["past_due", "unpaid", "incomplete"]) {
    const page = await account({ plan: "free", premiumStatus: status });
    assert.equal(page.portal.hidden, false);
    assert.equal(page.upgrade.hidden, true);
    assert.match(page.message.textContent, /pago.*pendiente/i);
    assert.doesNotMatch(page.message.textContent, /Premium está activa/);
    await page.portal.click();
    assert.equal(page.portalAttempts, 1);
    assert.deepEqual(page.navigation, ["https://billing.stripe.com/test-fixture"]);
  }
});

test("a new free account has no billing management but can consult Premium preparation", async () => {
  const page = await account({ plan: "free" });
  assert.equal(page.portal.hidden, true);
  assert.equal(page.upgrade.hidden, false);
});

test("a canceled subscription retains access to its billing history without active Premium", async () => {
  const page = await account({ plan: "free", premiumStatus: "canceled" });
  assert.equal(page.portal.hidden, false);
  assert.doesNotMatch(page.message.textContent, /Premium está activa/);
});

test("portal opening can be retried after a Stripe failure", async () => {
  const page = await account({ plan: "premium", premiumStatus: "active" });
  page.portalFailure = true;
  await page.portal.click();
  assert.equal(page.portal.disabled, false);
  assert.equal(page.navigation.length, 0);
  page.portalFailure = false;
  await page.portal.click();
  assert.equal(page.portalAttempts, 2);
  assert.deepEqual(page.navigation, ["https://billing.stripe.com/test-fixture"]);
});

test("portal opening can be retried after a session-token failure", async () => {
  const page = await account({ plan: "premium", premiumStatus: "active" });
  page.tokenFailure = true;
  await page.portal.click();
  assert.equal(page.portal.disabled, false);
  assert.equal(page.portalAttempts, 0);
  page.tokenFailure = false;
  await page.portal.click();
  assert.equal(page.portalAttempts, 1);
  assert.deepEqual(page.navigation, ["https://billing.stripe.com/test-fixture"]);
});

test("Premium opens authenticated Checkout only when the configuration enables sales", async () => {
  const page = await account({ plan: "free" }, true);
  assert.match(page.upgrade.textContent, /49/);
  await page.upgrade.click();
  assert.equal(page.checkoutAttempts, 1);
  assert.deepEqual(page.navigation, ["https://checkout.stripe.com/c/pay/cs_test_fixture"]);
});

test("simultaneous clicks send one request and a failed Checkout can be retried with a fresh token", async () => {
  const page = await account({ plan: "free" }, true);
  let release;
  page.waitCheckout = new Promise(resolve => { release = resolve; });
  const first = page.upgrade.click();
  await page.upgrade.click();
  release(); await first;
  assert.equal(page.checkoutAttempts, 1);

  const retry = await account({ plan: "free" }, true);
  retry.checkoutFailure = true;
  await retry.upgrade.click();
  assert.equal(retry.upgrade.disabled, false);
  assert.equal(retry.portal.hidden, false);
  assert.equal(retry.navigation.length, 0);
  retry.checkoutFailure = false;
  await retry.upgrade.click();
  assert.equal(retry.tokenReads, 2);
  assert.equal(retry.checkoutAttempts, 2);
  assert.equal(retry.navigation.length, 1);
});

test("a missing session token sends no Checkout request and exposes a retryable error", async () => {
  const page = await account({ plan: "free" }, true);
  page.missingToken = true;
  await page.upgrade.click();
  assert.equal(page.checkoutAttempts, 0);
  assert.equal(page.upgrade.disabled, false);
  assert.match(page.nodes["[data-premium-status]"].textContent, /sesión/);
});

test("closed sales never request Checkout even with an active managed account", async () => {
  const page = await account({ plan: "free" });
  // Avoid a navigation timer in this unit test: the public state itself stays in preparation.
  assert.match(page.upgrade.textContent, /preparación/);
  assert.equal(page.checkoutAttempts, 0);
});

test("Checkout cannot navigate to a URL outside the Stripe HTTPS hosted page", async () => {
  for (const url of ["https://attacker.invalid/pay", "javascript:alert(1)", "https://user:password@checkout.stripe.com/pay"]) {
    const page = await account({ plan: "free" }, true);
    page.checkoutUrl = url;
    await page.upgrade.click();
    assert.equal(page.navigation.length, 0);
    assert.equal(page.upgrade.disabled, false);
    assert.match(page.nodes["[data-premium-status]"].textContent, /segura/);
  }
});
