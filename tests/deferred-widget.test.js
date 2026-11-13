const test = require('node:test');
const assert = require('node:assert/strict');
const { defer } = require('../deferred-widget');
function observer() {
  let notify, disconnected = 0, observed;
  return { scope: { IntersectionObserver: class {
    constructor(callback) { notify = callback; }
    observe(target) { observed = target; }
    disconnect() { disconnected++; }
  } }, notify: entries => notify(entries), get disconnected() { return disconnected; }, get observed() { return observed; } };
}
test('offscreen widgets wait and initialize once as they approach the viewport', () => {
  const io = observer(), target = {}, calls = [];
  const task = defer(target, () => calls.push('loaded'), io.scope);
  assert.equal(io.observed, target);assert.deepEqual(calls, []);
  io.notify([{isIntersecting:false}]);assert.deepEqual(calls, []);
  io.notify([{isIntersecting:true}]);io.notify([{isIntersecting:true}]);task.run();
  assert.deepEqual(calls, ['loaded']);assert.equal(io.disconnected, 1);
});
test('manual requests run immediately and disposal prevents later observer reloads', () => {
  for (const manual of [false,true]) {
    const io=observer();let calls=0;const task=defer({},()=>calls++,io.scope);
    if(manual)task.run();task.dispose();io.notify([{isIntersecting:true}]);
    assert.equal(calls,manual?1:0);
  }
});
test('browsers without an observer retain immediate loading', () => {
  let calls=0;const task=defer({},()=>calls++,{});task.run();assert.equal(calls,1);
});
