const test = require('node:test');
const assert = require('node:assert/strict');
const { create, replay, addTrade, parseBackup, estimate } = require('../practica-core');
const trade = (id, side, quantity, price, fee = 0, symbol = 'BME:SAN', date = '2025-01-01') => ({ id, side, quantity, price, fee, symbol, date, note: 'Prueba ficticia' });
test('buy fees, weighted average cost, partial sells and full closes reconcile every cent', () => {
  let state = create('EUR', 1000);
  state = addTrade(state, trade('a', 'buy', 10, 10, 1));
  state = addTrade(state, trade('b', 'buy', 10, 20, 1));
  state = addTrade(state, trade('c', 'sell', 5, 30, 1));
  let result = replay(state);
  assert.equal(result.cashCents, 84700); assert.equal(result.investedCents, 22650); assert.equal(result.realizedCents, 7350);
  assert.equal(result.positions[0].units, 15000000); assert.equal(result.feesCents, 300);
  state = addTrade(state, trade('d', 'sell', 15, 12, 2)); result = replay(state);
  assert.equal(result.positions.length, 0); assert.equal(result.cashCents, 102500); assert.equal(result.realizedCents, 2500);
  assert.equal(result.feesCents, 500); assert.equal(result.sales, 2); assert.equal(result.profitableSales, 1);
});
test('fractional units and cent rounding leave no phantom holding after full sale', () => {
  let state = create('USD', 100);
  state = addTrade(state, trade('a', 'buy', .000123, 10000.12345678, .01, 'COINBASE:BTCUSD'));
  state = addTrade(state, trade('b', 'sell', .000023, 11000, 0, 'COINBASE:BTCUSD'));
  state = addTrade(state, trade('c', 'sell', .0001, 12000, .01, 'COINBASE:BTCUSD'));
  const result = replay(state);
  assert.equal(result.positions.length, 0); assert.equal(result.cashCents, 10020);
  assert.equal(result.realizedCents, 20); assert.equal(result.investedCents, 0);
});
test('insufficient cash, overselling and currency mixing never mutate the prior state', () => {
  const state = create('EUR', 100);
  for (const invalid of [trade('a', 'buy', 10, 10, .01), trade('a', 'sell', 1, 10), trade('a', 'buy', 1, 10, 0, 'NASDAQ:NVDA')]) assert.throws(() => addTrade(state, invalid));
  assert.equal(state.trades.length, 0); assert.equal(replay(state).cashCents, 10000);
});
test('nonfinite values, invalid precision, future or unordered dates and duplicate IDs fail', () => {
  let state = create('EUR', 1000); state = addTrade(state, trade('a', 'buy', 1, 10, 0, 'BME:SAN', '2025-02-01'));
  for (const invalid of [trade('b', 'buy', -1, 10), trade('b', 'buy', .0000001, 10), trade('b', 'buy', 1, Infinity), trade('b', 'buy', 1, 10, .001), trade('b', 'buy', 1, 10, 0, 'BME:SAN', '2099-01-01'), trade('b', 'buy', 1, 10, 0, 'BME:SAN', '2025-01-01'), trade('a', 'buy', 1, 10, 0, 'BME:SAN', '2025-02-01')]) assert.throws(() => addTrade(state, invalid));
  assert.throws(() => create('EUR', NaN)); assert.throws(() => create('GBP', 100));
});
test('backup import replays transactions and rejects corrupt or unsupported records', () => {
  const state = addTrade(create('EUR', 1000), trade('a', 'buy', 5, 12, 1));
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
  assert.throws(() => parseBackup(JSON.stringify({ ...state, mode: 'live' })));
  assert.throws(() => parseBackup(JSON.stringify({ ...state, trades: [null] })));
  assert.throws(() => parseBackup(JSON.stringify({ ...state, trades: [trade('a', 'sell', 5, 12)] })));
  assert.throws(() => parseBackup('x'.repeat(1000001))); assert.throws(() => parseBackup('not JSON'));
  const polluted = JSON.parse(JSON.stringify(state)); polluted.trades[0].unexpectedField = 'unused';
  assert.equal(parseBackup(JSON.stringify(polluted)).trades[0].unexpectedField, undefined);
});
test('many partial sells preserve the capital plus realized-result identity', () => {
  let state = addTrade(create('EUR', 1000), trade('a', 'buy', 1, 33.33, .07));
  for (let i = 0; i < 10; i++) state = addTrade(state, trade(`s${i}`, 'sell', .1, 40, .01));
  const result = replay(state);
  assert.equal(result.positions.length, 0); assert.equal(result.cashCents, 100650); assert.equal(result.realizedCents, 650);
});
test('decimal half cents round upward before fees and partial cost allocation', () => {
  assert.equal(estimate(trade('a', 'buy', 1, 1.005, .01)).totalCents, 102);
  let state = addTrade(create('EUR', 100), trade('a', 'buy', 2, .505));
  state = addTrade(state, trade('b', 'sell', 1, .6));
  const result = replay(state);
  assert.equal(result.investedCents, 50); assert.equal(result.realizedCents, 9);
  assert.equal(result.journal[0].grossCents, 101); assert.equal(result.journal[1].grossCents, 60);
});
