const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const providerSource = fs.readFileSync(path.join(__dirname, '../auth-provider.js'), 'utf8');
const localAuthSource = fs.readFileSync(path.join(__dirname, '../auth.js'), 'utf8');
const headerSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const authConfig = require('../api/auth-config');
const publishableKey = `pk_live_${Buffer.from('clerk.example.com$').toString('base64')}`;

function element(hidden = false) {
  return {
    hidden, textContent: '', attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener(name, callback) { this.listeners[name] = callback; }
  };
}

function browser({ config = { enabled: true, publishableKey }, responseOk = true, fetchFailure = false, scriptFailure = false, loadFailure = false, pendingConfig = false } = {}) {
  const nodes = {
    '[data-auth-view]': element(true), '[data-managed-auth]': element(true),
    '[data-account-view]': element(true), '[data-auth-connection]': element(),
    '[data-auth-connection-message]': element(), '[data-auth-retry]': element(true)
  };
  const mount = element();
  nodes['[data-managed-auth]'].querySelector = () => mount;
  const tab = element();
  tab.disabled = true;
  tab.dataset = { authMode: 'login' };
  tab.classList = { toggle() {} };
  const scripts = [], requests = [], timers = new Map();
  let timerId = 0, reloads = 0, storageReads = 0, storageWrites = 0, mounted = '';
  const window = {
    location: { origin: 'https://momentumvelo.app', href: 'https://momentumvelo.app/login?mode=login', search: '?mode=login', reload() { reloads++; } },
    atob: (value) => Buffer.from(value, 'base64').toString('utf8'),
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    localStorage: { getItem() { storageReads++; return null; }, setItem() { storageWrites++; } },
    __internal_ClerkUICtor: {}
  };
  const document = {
    querySelector: (selector) => nodes[selector] || null,
    querySelectorAll(selector) {
      if (selector === '[data-auth-mode]') return [tab];
      if (selector === '[data-auth-view], [data-managed-auth], [data-account-view]') return [nodes['[data-auth-view]'], nodes['[data-managed-auth]'], nodes['[data-account-view]']];
      return [];
    },
    getElementById: () => null,
    createElement: () => element(),
    head: { appendChild(script) {
      scripts.push(script);
      queueMicrotask(() => {
        if (scriptFailure) { script.listeners.error(); return; }
        if (script.src.includes('clerk.browser.js')) {
          // Model the vendor contract: proxyUrl is read when the script runs,
          // before load(), whose UI options cannot change this constructor value.
          const proxyUrl = script.getAttribute('data-clerk-proxy-url');
          window.Clerk = {
            isSignedIn: false,
            async load() {
              requests.push(`${proxyUrl || 'https://clerk.example.com'}/v1/client`);
              if (loadFailure) throw new Error('host_invalid');
            },
            mountSignIn() { mounted = 'login'; },
            mountSignUp() { mounted = 'signup'; }
          };
        }
        script.listeners.load();
      });
    } }
  };
  const context = vm.createContext({
    window, document, URL, URLSearchParams, console: { warn() {} },
    async fetch(url) {
      requests.push(url);
      if (fetchFailure) throw new Error('offline');
      if (pendingConfig) return new Promise(() => {});
      return { ok: responseOk, json: async () => config };
    }
  });
  vm.runInContext(providerSource, context);
  return {
    window, nodes, tab, scripts, requests, timers, context,
    get mounted() { return mounted; }, get reloads() { return reloads; },
    get storageReads() { return storageReads; }, get storageWrites() { return storageWrites; }
  };
}

test('Clerk session requests use the current origin proxy from SDK construction', async () => {
  const page = browser();
  assert.equal(await page.window.MomentumVeloAuthReady, 'managed');
  assert.ok(page.requests.includes('https://momentumvelo.app/__clerk/v1/client'));
  assert.ok(page.scripts.every(script => script.src.startsWith('https://momentumvelo.app/__clerk/')));
  assert.equal(page.mounted, 'login');
  assert.equal(page.nodes['[data-auth-view]'].hidden, true);
  assert.equal(page.nodes['[data-managed-auth]'].hidden, false);
  assert.equal(page.nodes['[data-auth-connection]'].hidden, true);
  assert.equal(page.tab.disabled, false);
  assert.equal(page.timers.size, 0);
  await vm.runInContext(localAuthSource, page.context);
  vm.runInContext(headerSource, page.context);
  await Promise.resolve();
  assert.equal(page.storageReads, 0);
  assert.equal(page.storageWrites, 0);
});

for (const [name, options] of Object.entries({
  'configuration outage': { responseOk: false },
  'network outage': { fetchFailure: true },
  'script failure': { scriptFailure: true },
  'Clerk host rejection': { loadFailure: true },
  'partial configuration': { config: { enabled: false, publishableKey } },
  'invalid configuration': { config: {} }
})) {
  test(`${name} blocks local signup and offers retry and help`, async () => {
    const page = browser(options);
    assert.equal(await page.window.MomentumVeloAuthReady, 'unavailable');
    await vm.runInContext(localAuthSource, page.context);
    vm.runInContext(headerSource, page.context);
    await Promise.resolve();
    assert.equal(page.nodes['[data-auth-view]'].hidden, true);
    assert.equal(page.nodes['[data-managed-auth]'].hidden, true);
    assert.equal(page.nodes['[data-account-view]'].hidden, true);
    assert.equal(page.nodes['[data-auth-connection]'].hidden, false);
    assert.match(page.nodes['[data-auth-connection-message]'].textContent, /No hemos podido conectar/);
    assert.equal(page.nodes['[data-auth-retry]'].hidden, false);
    assert.equal(page.tab.disabled, true);
    assert.equal(page.storageReads, 0);
    assert.equal(page.storageWrites, 0);
    page.nodes['[data-auth-retry]'].listeners.click();
    assert.equal(page.reloads, 1);
    assert.equal(page.timers.size, 0);
  });
}

test('a stalled connection reaches an actionable error instead of waiting forever', async () => {
  const page = browser({ pendingConfig: true });
  assert.equal(page.nodes['[data-auth-view]'].hidden, true);
  for (const callback of page.timers.values()) callback();
  assert.equal(await page.window.MomentumVeloAuthReady, 'unavailable');
  assert.equal(page.nodes['[data-auth-retry]'].hidden, false);
  assert.equal(page.timers.size, 0);
});

test('only explicitly disabled Clerk allows the local demo', async () => {
  const page = browser({ config: { enabled: false, publishableKey: null } });
  assert.equal(await page.window.MomentumVeloAuthReady, 'demo');
  assert.equal(page.nodes['[data-auth-view]'].hidden, false);
  assert.equal(page.nodes['[data-auth-connection]'].hidden, true);
  assert.equal(page.scripts.length, 0);
});

test('a missing auth provider cannot enable local signup', async () => {
  let queries = 0;
  const context = vm.createContext({ window: {}, document: { getElementById() { queries++; } } });
  await vm.runInContext(localAuthSource, context);
  assert.equal(queries, 0);
});

test('auth config rejects either missing key and never returns the secret', async () => {
  const previous = [process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, process.env.CLERK_SECRET_KEY];
  try {
    for (const [publicKey, secretKey, expectedCode] of [[publishableKey, '', 503], ['', 'sk_test_secret', 503], [publishableKey, 'sk_test_secret', 200], ['', '', 200]]) {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publicKey;
      process.env.CLERK_SECRET_KEY = secretKey;
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; }, setHeader() {} };
      await authConfig({ method: 'GET' }, res);
      assert.equal(res.code, expectedCode);
      assert.equal(JSON.stringify(res.body).includes('sk_test_secret'), false);
      if (expectedCode === 200) assert.equal(res.body.enabled, Boolean(publicKey && secretKey));
    }
  } finally {
    const names = ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'];
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});
