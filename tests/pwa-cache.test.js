const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");

function worker() {
  const listeners = {}, writes = [], reads = [];
  const cache = {
    addAll: async paths => { reads.push(...paths); },
    put: async (...args) => { writes.push(args); },
    match: async key => ({ saved: key })
  };
  const state = { offline: false, cache, listeners, writes, reads };
  vm.runInNewContext(source, { URL,
    self: { location: { origin: "https://momentumvelo.app" }, clients: { claim: async () => {} },
      addEventListener: (name, listener) => { listeners[name] = listener; } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => {} },
    fetch: async () => {
      if (state.offline) throw new Error("offline");
      return { ok: true, type: "basic", clone: () => ({ copied: true }) };
    }
  });
  state.request = (url, method = "GET") => {
    let result;
    listeners.fetch({ request: { url, method, mode: "navigate" }, respondWith: value => { result = value; } });
    return result;
  };
  return state;
}

test("offline installation only stores existing public pages and their assets", async () => {
  const state = worker();
  let installation;
  state.listeners.install({ waitUntil: operation => { installation = operation; } });
  await installation;
  for (const url of state.reads) {
    const local = path.join(__dirname, "..", url);
    assert.ok(fs.existsSync(local) || fs.existsSync(local + ".html"), url);
    assert.doesNotMatch(url, /\/api\/|login|checkout|success|auth-provider/);
  }
  for (const name of ["mercados", "radar", "practica", "comparar"]) {
    const html = fs.readFileSync(path.join(__dirname, `../${name}.html`), "utf8");
    for (const asset of html.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css))[^"\s]*"/g)) {
      assert.ok(state.reads.includes(asset[1]), `${name}: ${asset[1]}`);
    }
  }
});

test("identity, payment, API and third-party requests never use the public offline cache", () => {
  const state = worker();
  for (const url of ["/api/auth-config", "/api/subscription?session_id=private", "/api/checkout",
    "/__clerk/v1/client", "/login", "/success?session_id=private", "/auth-provider.js"]) {
    assert.equal(state.request("https://momentumvelo.app" + url), undefined, url);
  }
  assert.equal(state.request("https://www.tradingview-widget.com/mercados"), undefined);
  assert.equal(state.request("https://momentumvelo.app/mercados", "POST"), undefined);
  assert.equal(state.writes.length, 0);
});

test("an offline public page can reopen without reusing a quote or account response", async () => {
  const state = worker();
  await state.request("https://momentumvelo.app/mercados?source=android");
  assert.equal(state.writes[0][0], "/mercados");
  state.offline = true;
  const response = await state.request("https://momentumvelo.app/mercados?source=android");
  assert.equal(response.saved, "/mercados");
  assert.equal(state.request("https://momentumvelo.app/api/subscription"), undefined);
});
