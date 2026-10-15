const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function node() {
  return { hidden: true, disabled: false, textContent: "", attributes: {}, events: {},
    classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { this.events[name] = fn; } };
}
async function page(options = {}) {
  const selectors = ["[data-deletion-form]", "[data-deletion-status]", "[data-deletion-reauth]", "[data-local-delete-form]",
    "[data-local-delete-status]", "[data-deletion-access]", "[data-deletion-temporary]", "[data-deletion-email]"];
  const nodes = Object.fromEntries(selectors.map(selector => [selector, node()]));
  const f = { nodes, requests: [], cleanupCalls: 0, signouts: [], tokenCalls: [], response: { ok: true, status: 200, body: { deleted: true } } };
  const form = nodes["[data-deletion-form]"];
  const button = node(); button.hidden = false;
  form.elements = { email: { value: "alice@example.com" }, confirmation: { value: "ELIMINAR" }, acceptConsequences: { checked: true } };
  form.checkValidity = () => f.valid !== false;
  form.reportValidity = () => { f.validityReported = true; };
  form.querySelector = () => button;
  const localForm = nodes["[data-local-delete-form]"];
  localForm.elements = { confirmLocal: { checked: true } };
  localForm.checkValidity = () => localForm.elements.confirmLocal.checked;
  localForm.reportValidity = () => { f.localValidityReported = true; };
  localForm.reset = () => { localForm.elements.confirmLocal.checked = false; };
  const clerk = { isSignedIn: options.signedIn !== false, user: { primaryEmailAddress: { emailAddress: "alice@example.com" } },
    session: { getToken: async args => { f.tokenCalls.push(args); if (f.waitToken) await f.waitToken; return f.token === null ? null : "fixture-token"; } },
    signOut: async args => { f.signouts.push(args); if (f.signoutFailure) throw new Error("fixture-signout-failure"); }
  };
  const window = { Clerk: clerk, MomentumVeloAuthReady: Promise.resolve(options.mode || "managed"),
    location: { origin: options.origin || "https://momentumvelo.app" }, localStorage: {}, sessionStorage: {},
    MomentumVeloAccountData: { clearLocalData: () => { f.cleanupCalls++; return { failed: f.cleanupFailure === true }; } },
    setTimeout: (...args) => setTimeout(...args), clearTimeout
  };
  const code = fs.readFileSync(require.resolve("../eliminar-cuenta.js"), "utf8");
  await vm.runInNewContext(code, { window, document: { querySelector: selector => nodes[selector] },
    fetch: async (url, args) => {
      f.requests.push({ url, args });
      if (f.waitResponse) await f.waitResponse;
      return { ok: f.response.ok, status: f.response.status, json: async () => f.response.body };
    }, Promise, Error, JSON });
  f.window = window; f.clerk = clerk; f.button = button; f.form = form; f.localForm = localForm;
  f.submit = () => form.events.submit({ preventDefault() {} });
  f.localSubmit = () => localForm.events.submit({ preventDefault() {} });
  return f;
}

test("the public page does not submit deletion or clear data on load and explains unavailable authentication", async () => {
  for (const options of [{ mode: "managed", signedIn: false }, { mode: "unavailable" }, { mode: "demo" }]) {
    const f = await page(options);
    assert.equal(f.form.hidden, true);
    assert.equal(f.nodes["[data-deletion-access]"].hidden, false);
    assert.equal(f.requests.length, 0);
    assert.equal(f.cleanupCalls, 0);
    assert.equal(f.signouts.length, 0);
  }
  const f = await page({ mode: "unavailable" });
  assert.equal(f.nodes["[data-deletion-temporary]"].hidden, false);
  assert.match(f.nodes["[data-deletion-status]"].textContent, /no se ha iniciado/);
  const otherOrigin = await page({ mode: "unavailable", origin: "https://momentum-velo.vercel.app" });
  assert.equal(otherOrigin.nodes["[data-deletion-temporary]"].hidden, true);
});

test("invalid forms never request a token, call deletion or erase local data", async () => {
  const f = await page();
  for (const change of [() => { f.valid = false; }, () => { f.valid = true; f.form.elements.confirmation.value = "delete"; },
    () => { f.form.elements.confirmation.value = "ELIMINAR"; f.form.elements.acceptConsequences.checked = false; }]) {
    change(); await f.submit();
  }
  assert.equal(f.tokenCalls.length, 0);
  assert.equal(f.requests.length, 0);
  assert.equal(f.cleanupCalls, 0);
});

test("an explicit confirmed deletion sends only the confirmation fields and refreshes the signed token", async () => {
  const f = await page();
  assert.equal(f.form.hidden, false);
  await f.submit();
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.url, "/api/delete-account");
  assert.equal(request.args.method, "POST");
  assert.equal(request.args.cache, "no-store");
  assert.equal(request.args.headers.Authorization, "Bearer fixture-token");
  assert.deepEqual(JSON.parse(request.args.body), { email: "alice@example.com", confirmation: "ELIMINAR", acceptConsequences: true });
  assert.equal(f.tokenCalls[0].skipCache, true);
  assert.equal(f.cleanupCalls, 1);
  assert.equal(f.form.hidden, true);
  assert.equal(f.button.disabled, true);
  assert.match(f.nodes["[data-deletion-status]"].textContent, /cuenta se ha eliminado/);
  await f.submit();
  assert.equal(f.requests.length, 1);
});

test("an unavailable or expired session never causes deletion or local cleanup", async () => {
  const f = await page(); f.token = null;
  await f.submit();
  assert.equal(f.requests.length, 0);
  assert.equal(f.cleanupCalls, 0);
  assert.equal(f.button.disabled, false);
  assert.match(f.nodes["[data-deletion-status]"].textContent, /sesión ha caducado/);
});

test("reverification and partial billing failures show an error and retain local data until a confirmed success", async () => {
  const f = await page();
  for (const response of [
    { ok: false, status: 403, body: { code: "REAUTHENTICATION_REQUIRED", error: "Vuelve a identificarte." } },
    { ok: false, status: 503, body: { error: "Eliminación no completada." } },
    { ok: true, status: 200, body: { received: true } }
  ]) {
    f.response = response; await f.submit();
    assert.equal(f.form.hidden, false);
    assert.equal(f.button.disabled, false);
    assert.equal(f.cleanupCalls, 0);
    assert.equal(f.signouts.length, 0);
    assert.doesNotMatch(f.nodes["[data-deletion-status]"].textContent, /cuenta se ha eliminado/);
  }
  assert.equal(f.nodes["[data-deletion-reauth]"].hidden, false);
});

test("concurrent clicks keep one destructive request in flight", async () => {
  const f = await page(); let release;
  f.waitResponse = new Promise(resolve => { release = resolve; });
  const pending = f.submit();
  await new Promise(resolve => setImmediate(resolve));
  await f.submit();
  assert.equal(f.requests.length, 1);
  assert.equal(f.button.disabled, true);
  release(); await pending;
  assert.equal(f.cleanupCalls, 1);
});

test("a timeout does not claim deletion or clear local data and leaves an explicit retry available", async () => {
  const f = await page(); let release;
  f.waitToken = new Promise(resolve => { release = resolve; });
  f.window.setTimeout = fn => setTimeout(fn, 5);
  try {
    await f.submit();
    assert.equal(f.requests.length, 0);
    assert.equal(f.cleanupCalls, 0);
    assert.equal(f.button.disabled, false);
    assert.match(f.nodes["[data-deletion-status]"].textContent, /podría seguir en curso/);
  } finally { release(); }
});

test("a failed sign-out after confirmed deletion cannot misreport the completed operation", async () => {
  const f = await page(); f.signoutFailure = true; f.cleanupFailure = true;
  await f.submit();
  assert.match(f.nodes["[data-deletion-status]"].textContent, /cuenta se ha eliminado/);
  assert.match(f.nodes["[data-deletion-status]"].textContent, /No se han podido borrar todos/);
  assert.equal(f.form.hidden, true);
});

test("local data removal is independent of account access, requires its own consent and never calls billing or Clerk", async () => {
  const f = await page({ mode: "unavailable" });
  f.localForm.elements.confirmLocal.checked = false;
  f.localSubmit(); assert.equal(f.cleanupCalls, 0);
  f.localForm.elements.confirmLocal.checked = true;
  f.localSubmit(); assert.equal(f.cleanupCalls, 1);
  assert.equal(f.localForm.elements.confirmLocal.checked, false);
  assert.equal(f.requests.length, 0);
  assert.equal(f.signouts.length, 0);
});

test("reidentification uses a fixed return destination and never deletes the account", async () => {
  const f = await page();
  await f.nodes["[data-deletion-reauth]"].events.click();
  assert.equal(f.signouts[0].redirectUrl, "/login?mode=login&returnTo=delete-account");
  assert.equal(f.requests.length, 0);
  assert.equal(f.cleanupCalls, 0);
});
