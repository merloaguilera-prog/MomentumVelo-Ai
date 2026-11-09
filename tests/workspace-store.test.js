const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../workspace-core');
const catalog = require('../market-catalog');
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const saved = state => ({ [core.STORAGE_KEY]: JSON.stringify({version:1,favorites:[],notes:{},...state}) });
test('legacy Pulse list and market favorites merge once, preserving notes and valid instruments', () => {
  const local = storage({...saved({favorites:['XETR:SAP'],notes:{'NASDAQ:AAPL':'Mi nota'}}),
    [core.LEGACY_KEY]: JSON.stringify(['AAPL','SOL','AAPL','unknown'])});
  const store = core.createStore(local,catalog), state = store.read();
  assert.deepEqual(state.favorites,['XETR:SAP','NASDAQ:AAPL','COINBASE:SOLUSD']);
  assert.equal(state.notes['NASDAQ:AAPL'],'Mi nota');
  state.favorites = ['XETR:SAP'];store.write(state);
  assert.deepEqual(core.createStore(local,catalog).read().favorites,['XETR:SAP']);
  assert.equal(local.getItem(core.LEGACY_KEY),'["AAPL","SOL","AAPL","unknown"]');
});
test('empty lists stay empty and existing market favorites do not receive demo defaults', () => {
  for (const initial of [saved({}),{[core.LEGACY_KEY]:'[]'}]) {
    assert.deepEqual(core.createStore(storage(initial),catalog).read().favorites,[]);
  }
  const local = storage(); const store = core.createStore(local,catalog);
  assert.deepEqual(store.read().favorites,catalog.defaults);
  store.write({version:1,favorites:[],notes:{}});
  assert.deepEqual(store.read().favorites,[]);
});
test('all catalog assets survive saving, reload, backup export and import', () => {
  const symbols = catalog.assets.map(asset=>asset.market);
  assert.equal(new Set(symbols).size,symbols.length);
  const store = core.createStore(storage(),catalog);
  const state = {version:1,favorites:symbols,notes:{'BME:IBC':'Revisar índice'}};
  store.write(state);
  assert.deepEqual(store.read().favorites,symbols);
  assert.deepEqual(core.parseBackup(core.serializeBackup(store.read(),symbols),symbols),state);
});
test('malformed or foreign stored entries are ignored without mixing up symbols', () => {
  const local=storage({...saved({favorites:['BAD:ASSET','NASDAQ:AAPL','NASDAQ:AAPL'],notes:{'BAD:ASSET':'bad','NASDAQ:AAPL':'x'.repeat(2100)}}),[core.LEGACY_KEY]:'{"not":"an array"}'});
  const state=core.createStore(local,catalog).read();
  assert.deepEqual(state.favorites,['NASDAQ:AAPL']);
  assert.deepEqual(Object.keys(state.notes),['NASDAQ:AAPL']);
  assert.equal(state.notes['NASDAQ:AAPL'].length,2000);
  assert.deepEqual(core.createStore(storage({[core.STORAGE_KEY]:'{',[core.LEGACY_KEY]:'["BTC"]'}),catalog).read().favorites,['COINBASE:BTCUSD']);
});
test('writes report blocked storage and reload sees other tab changes', () => {
  const local = storage(saved({pulseMigrated:true}));
  const first = core.createStore(local,catalog), second = core.createStore(local,catalog);
  const updated=first.read();updated.favorites.push('NASDAQ:MSFT');first.write(updated);
  const next=second.read();next.notes['NASDAQ:MSFT']='Otra pestaña';second.write(next);
  assert.equal(first.read().notes['NASDAQ:MSFT'],'Otra pestaña');
  assert.deepEqual(first.read().favorites,['NASDAQ:MSFT']);
  assert.throws(()=>core.createStore({setItem(){throw Error('blocked');}},catalog).write(next),/blocked/);
});
