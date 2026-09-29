const { test } = require('node:test');
const assert = require('node:assert/strict');

const checkout = require('../api/checkout');
const subscription = require('../api/subscription');
const portal = require('../api/portal');
const { isPremiumPrice, isPremiumSubscription } = require('../api/_premium');

function response() {
  return {
    code: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function withEnvironment(values, run) {
  const names = Object.keys(values);
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) {
    if (values[name] === null) delete process.env[name];
    else process.env[name] = values[name];
  }
  return Promise.resolve().then(run).finally(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}

test('checkout remains closed by default even with a payment link configured', async () => {
  await withEnvironment({ PREMIUM_SALES_ENABLED: null, STRIPE_PAYMENT_LINK_URL: 'https://buy.stripe.com/example' }, async () => {
    const res = response();
    await checkout({ method: 'POST', body: {} }, res);
    assert.equal(res.code, 503);
    assert.equal(res.body.helpUrl, '/ayuda?tema=premium#contacto');
    assert.equal(res.body.url, undefined);
  });
});

test('opening sales without managed identity and billing configuration does not issue a payment URL', async () => {
  await withEnvironment({ PREMIUM_SALES_ENABLED: 'true', CLERK_SECRET_KEY: null, STRIPE_SECRET_KEY: null, STRIPE_PREMIUM_PRICE_ID: null, STRIPE_WEBHOOK_SECRET: null }, async () => {
    const res = response();
    await checkout({ method: 'POST', body: {} }, res);
    assert.equal(res.code, 503);
    assert.equal(res.body.url, undefined);
  });
});

test('subscription verification and billing portal reject missing managed identity', async () => {
  await withEnvironment({ CLERK_SECRET_KEY: null, STRIPE_SECRET_KEY: 'sk_test_dummy' }, async () => {
    const verification = response();
    await subscription({ method: 'GET', query: { session_id: 'cs_test_dummy' } }, verification);
    assert.equal(verification.code, 503);
    const management = response();
    await portal({ method: 'POST', body: { sessionId: 'cs_test_dummy' } }, management);
    assert.equal(management.code, 503);
  });
});

test('Premium entitlement requires the configured active 49 EUR monthly price', () => {
  const validPrice = {
    id: 'price_premium', active: true, currency: 'eur', unit_amount: 4900,
    recurring: { interval: 'month', interval_count: 1 }
  };
  assert.equal(isPremiumPrice(validPrice, 'price_premium'), true);
  assert.equal(isPremiumPrice({ ...validPrice, id: 'price_other' }, 'price_premium'), false);
  assert.equal(isPremiumPrice({ ...validPrice, unit_amount: 5900 }, 'price_premium'), false);
  assert.equal(isPremiumPrice({ ...validPrice, active: false }, 'price_premium'), false);
});

test('Premium entitlement rejects a subscription for another product or an unpaid status', () => {
  const price = {
    id: 'price_premium', active: true, currency: 'eur', unit_amount: 4900,
    recurring: { interval: 'month', interval_count: 1 }
  };
  const subscription = { status: 'active', items: { data: [{ price }] } };
  assert.equal(isPremiumSubscription(subscription, 'price_premium'), true);
  assert.equal(isPremiumSubscription(subscription, 'price_other'), false);
  assert.equal(isPremiumSubscription({ ...subscription, status: 'unpaid' }, 'price_premium'), false);
  assert.equal(isPremiumSubscription({ ...subscription, items: { data: [{ price: { ...price, active: false } }] } }, 'price_premium'), true);
  assert.equal(isPremiumPrice({ ...price, active: false }, 'price_premium'), false);
});
