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

test('5 and 15 minute comparisons warm their full selected window', () => {
  for (const windowSeconds of [300,900]) {
    const engine=create(0.5,{windowSeconds});
    for(let i=0;i<windowSeconds;i++)assert.equal(tick(engine,i).warming,true);
    const result=tick(engine,windowSeconds,101);
    assert.equal(result.signal.windowSeconds,windowSeconds);
    assert.equal(result.signal.baselinePrice,100);
    assert.equal(result.warming,false);
  }
});
test('confirmation rejects a brief spike and emits only after sustained observations', () => {
  const engine=create(0.5,{confirmationMs:3000});
  for(let i=0;i<60;i++)tick(engine,i);
  assert.equal(tick(engine,60,101).signal,null);
  assert.equal(tick(engine,61,100).signal,null);
  for(let i=62;i<65;i++)assert.equal(tick(engine,i,101).signal,null);
  const result=tick(engine,65,101);
  assert.equal(result.signal.confirmationMs,3000);
  assert.equal(tick(engine,66,101).signal,null);
});
test('within-second samples use the latest received price as a future baseline', () => {
  const engine=create();tick(engine,0,100);
  const time=start+500;
  engine.ingest({type:'ticker',product_id:'BTC-USD',price:'110',time:new Date(time).toISOString(),sequence:2},time);
  for(let i=1;i<=60;i++)tick(engine,i,110,{sequence:i+2});
  const result=tick(engine,61,110,{sequence:64});
  assert.equal(result.change,0);
  assert.equal(result.signal,null);
});
test('window and confirmation options fail closed for unsupported values', () => {
  assert.throws(()=>create(0.5,{windowSeconds:0}));
  assert.throws(()=>create(0.5,{windowSeconds:NaN}));
  assert.throws(()=>create(0.5,{confirmationMs:500}));
});
