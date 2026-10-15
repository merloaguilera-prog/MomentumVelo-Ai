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

function browser({ config = { enabled: true, publishableKey }, responseOk = true, fetchFailure = false, scriptFailure = false, loadFailure = false, pendingConfig = false, signedIn = false, origin = 'https://momentumvelo.app', search = '?mode=login', tabMode = 'login' } = {}) {
  const nodes = {
    '[data-auth-view]': element(true), '[data-managed-auth]': element(true),
    '[data-account-view]': element(true), '[data-auth-connection]': element(),
    '[data-auth-connection-message]': element(), '[data-auth-retry]': element(true),
    '[data-auth-temporary]': element(true), '[data-auth-temporary-link]': element()
  };
  const mount = element();
  nodes['[data-managed-auth]'].querySelector = () => mount;
  const tab = element();
  tab.disabled = true;
  tab.dataset = { authMode: tabMode };
  tab.classList = { toggle() {} };
  const scripts = [], requests = [], redirects = [], timers = new Map();
  let timerId = 0, reloads = 0, storageReads = 0, storageWrites = 0, mounted = '', mountOptions;
  const window = {
    location: { origin, href: `${origin}/login${search}`, search, reload() { reloads++; }, assign(url) { redirects.push(url); } },
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
            isSignedIn: signedIn,
            async load() {
              requests.push(`${proxyUrl || 'https://clerk.example.com'}/v1/client`);
              if (loadFailure) throw new Error('host_invalid');
            },
            mountSignIn(_target, options) { mounted = 'login'; mountOptions = options; },
            mountSignUp(_target, options) { mounted = 'signup'; mountOptions = options; }
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
    window, nodes, tab, scripts, requests, redirects, timers, context,
    get mounted() { return mounted; }, get mountOptions() { return mountOptions; }, get reloads() { return reloads; },
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

test('deletion login returns only to the fixed deletion page and cannot accept an arbitrary redirect', async () => {
  for (const mode of ['login', 'signup']) {
    const page = browser({ search: `?mode=${mode}&returnTo=delete-account&redirect=https://attacker.example` });
    assert.equal(await page.window.MomentumVeloAuthReady, 'managed');
    assert.equal(page.mountOptions.forceRedirectUrl, '/eliminar-cuenta');
  }
  const other = browser({ search: '?mode=login&returnTo=https://attacker.example' });
  assert.equal(await other.window.MomentumVeloAuthReady, 'managed');
  assert.equal(other.mountOptions.forceRedirectUrl, undefined);
  const signedIn = browser({ signedIn: true, search: '?mode=login&returnTo=delete-account' });
  assert.equal(await signedIn.window.MomentumVeloAuthReady, 'managed');
  assert.deepEqual(signedIn.redirects, ['/eliminar-cuenta']);
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
    assert.equal(page.tab.disabled, false);
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

test('a canonical-domain failure offers the same application signup without redirecting or forwarding URL data', async () => {
  const page = browser({ loadFailure: true, search: '?mode=signup&redirect=https://other.example&token=private&plan=premium' });
  assert.equal(await page.window.MomentumVeloAuthReady, 'unavailable');
  assert.equal(page.nodes['[data-auth-temporary]'].hidden, false);
  assert.equal(page.nodes['[data-auth-temporary-link]'].href, 'https://momentum-velo.vercel.app/login?mode=signup');
  assert.match(page.nodes['[data-auth-temporary-link]'].textContent, /Crear cuenta/);
  assert.match(page.window.location.href, /^https:\/\/momentumvelo.app\//);
  assert.equal(page.storageWrites, 0);
  assert.deepEqual(page.redirects, []);
  page.tab.listeners.click();
  assert.deepEqual(page.redirects, ['https://momentum-velo.vercel.app/login?mode=login']);
  assert.equal(page.mounted, '');
});

test('account and unrecognized modes use only the fixed temporary sign-in URL', async () => {
  for (const search of ['?mode=account', '?mode=https://other.example', '']) {
    const page = browser({ loadFailure: true, search });
    assert.equal(await page.window.MomentumVeloAuthReady, 'unavailable');
    assert.equal(page.nodes['[data-auth-temporary-link]'].href, 'https://momentum-velo.vercel.app/login?mode=login');
  }
});

test('both error-page tabs open only the fixed corresponding temporary mode on explicit click', async () => {
  for (const mode of ['login', 'signup']) {
    const page = browser({ loadFailure: true, tabMode: mode, search: '?mode=signup&email=private&session_id=secret&redirect=https://other.example' });
    assert.equal(await page.window.MomentumVeloAuthReady, 'unavailable');
    assert.deepEqual(page.redirects, []);
    assert.equal(page.tab.disabled, false);
    page.tab.listeners.click();
    assert.deepEqual(page.redirects, [`https://momentum-velo.vercel.app/login?mode=${mode}`]);
    assert.equal(page.storageWrites, 0);
    assert.equal(page.nodes['[data-auth-view]'].hidden, true);
  }
});

test('a working canonical connection hides the temporary route', async () => {
  const page = browser();
  assert.equal(await page.window.MomentumVeloAuthReady, 'managed');
  assert.equal(page.nodes['[data-auth-temporary]'].hidden, true);
});

test('the temporary origin and preview failures never offer a self-loop or production transfer', async () => {
  for (const origin of ['https://momentum-velo.vercel.app', 'https://preview.vercel.app', 'https://momentumvelo.app.other.example']) {
    const page = browser({ loadFailure: true, origin });
    assert.equal(await page.window.MomentumVeloAuthReady, 'unavailable');
    assert.equal(page.nodes['[data-auth-temporary]'].hidden, true);
    assert.equal(page.nodes['[data-auth-temporary-link]'].href, undefined);
    assert.equal(page.tab.disabled, true);
    assert.deepEqual(page.redirects, []);
  }
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
