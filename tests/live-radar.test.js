const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../radar-core.js');
const start = Date.parse('2026-10-13T12:00:00Z');
function tick(engine, second, price = 100, extra = {}) { const now = start + second * 1000; return engine.ingest({ type: 'ticker', product_id: 'BTC-USD', price: String(price), time: new Date(now).toISOString(), sequence: second + 1, ...extra }, now); }
test('warms a full minute, then observes a move and limits repeated alerts', () => {
  const engine = create(0.5);
  for (let i = 0; i < 60; i++) assert.equal(tick(engine, i).signal, null);
  const result = tick(engine, 60, 101);
  assert.equal(result.warming, false); assert.equal(result.signal.direction, 'up'); assert.equal(result.signal.change, 1.0000000000000009);
  assert.equal(tick(engine, 61, 102).signal, null);
});
test('gap and explicit reset discard the old baseline', () => {
  const engine = create(); for (let i = 0; i <= 60; i++) tick(engine, i);
  assert.equal(tick(engine, 80, 120).warming, true);
  engine.reset(); assert.equal(tick(engine, 81, 150).signal, null);
});
test('rejects stale, future, invalid and out-of-order prices', () => {
  const engine = create(); tick(engine, 0);
  assert.equal(tick(engine, 1, 0), null);
  assert.equal(tick(engine, 1, 100, { sequence: 1 }), null);
  assert.equal(tick(engine, 1, 100, { price: 'NaN' }), null);
  assert.equal(tick(engine, 1, 100, { product_id: 'UNKNOWN' }), null);
  assert.equal(tick(engine, 1, 100, { time: new Date(start - 20000).toISOString() }), null);
  assert.equal(tick(engine, 1, 100, { time: new Date(start + 10000).toISOString() }), null);
});
test('assets use separate windows and signal downward movements', () => {
  const engine = create(); for (let i = 0; i < 60; i++) tick(engine, i);
  assert.equal(tick(engine, 60, 98).signal.direction, 'down');
  assert.equal(tick(engine, 60, 500, { product_id: 'ETH-USD' }).warming, true);
  assert.throws(() => create(0)); assert.throws(() => create(NaN));
});
