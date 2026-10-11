const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, analyze } = require('../detector-core');
const rules = { move: 3, drawdown: 8, lookback: 20, confirmation: 1, requireVolume: false };
function series(prices, volumes = []) {
  return prices.map((close, i) => ({ date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), close, volume: volumes[i] ?? null }));
}
test('CSV parses Spanish decimals and descending export dates without changing values', () => {
  const parsed = parseCSV('\uFEFFfecha;cierre;volumen\r\n2025-01-02;104,5;200\r\n2025-01-01;100;100');
  assert.deepEqual(parsed.rows, series([100, 104.5], [100, 200]));
  const exported = parseCSV('Date,Open,High,Low,Close,Volume,Symbol\n2025-01-01,1,2,1,"100",100,NVDA\n2025-01-02,1,2,1,104.5,200,NVDA');
  assert.equal(exported.symbol, 'NVDA'); assert.equal(exported.rows[1].close, 104.5);
});
test('CSV rejects invalid, duplicate, future and mixed-asset data', () => {
  for (const csv of [
    'fecha,cierre\n2025-02-30,10\n2025-03-01,11',
    'fecha,cierre\n2025-01-01,10\n2025-01-01,11',
    'fecha,cierre\n2025-01-01,10\n2099-01-01,11',
    'fecha,cierre\n2025-01-01,0\n2025-01-02,11',
    'fecha,cierre\n2025-01-01,10\n2025-01-02,NaN',
    'fecha,cierre,volumen\n2025-01-01,10,100\n2025-01-02,11,-1',
    'Date,Close,Symbol\n2025-01-01,10,NVDA\n2025-01-02,11,AAPL',
    'Date,Close\n2025-01-01,10\n2025-01-02,11,extra'
  ]) assert.throws(() => parseCSV(csv));
  assert.throws(() => parseCSV('x'.repeat(256001)));
  assert.throws(() => parseCSV('Date,Close\n' + '2025-01-01,10\n'.repeat(1001)));
});
test('detects inclusive percent thresholds in each direction without inventing insufficient confirmation', () => {
  assert.equal(analyze(series([100, 103]), rules).signals[0].kind, 'up');
  const down = analyze(series([100, 97]), rules);
  assert.equal(down.signals[0].kind, 'down'); assert.ok(Math.abs(down.change + 3) < 1e-9);
  assert.equal(analyze(series([100, 103, 106.09]), { ...rules, confirmation: 2 }).signals[0].kind, 'up');
  assert.equal(analyze(series([100, 103, 104]), { ...rules, confirmation: 2 }).signals.length, 0);
  assert.equal(analyze(series([100, 103]), { ...rules, confirmation: 3 }).signals.length, 0);
});
test('drawdown uses the full requested window of closing prices and no earlier all-time peak', () => {
  const r = { ...rules, lookback: 3 };
  const analysis = analyze(series([300, 100, 110, 100]), r);
  assert.equal(analysis.peak, 110);
  assert.ok(Math.abs(analysis.peakDrop + 9.0909090909) < 1e-8);
  assert.ok(analysis.signals.some(s => s.kind === 'drawdown'));
  assert.ok(!analyze(series([110, 100]), r).signals.some(s => s.kind === 'drawdown'));
});
test('volume confirmation excludes the current close from its 20-session baseline', () => {
  const prices = [...Array(20).fill(100), 104], volumes = [...Array(20).fill(100), 150];
  const analysis = analyze(series(prices, volumes), { ...rules, requireVolume: true });
  assert.equal(analysis.volumeRatio, 1.5); assert.equal(analysis.signals[0].kind, 'up');
  assert.equal(analyze(series(prices, [...Array(20).fill(100), 149]), { ...rules, requireVolume: true }).signals.length, 0);
  assert.equal(analyze(series(prices), { ...rules, requireVolume: true }).signals.length, 0);
  assert.equal(analyze(series(prices, Array(21).fill(0)), { ...rules, requireVolume: true }).volumeRatio, null);
});
test('SMA20 crossing uses each close against its own moving average', () => {
  const up = analyze(series([...Array(20).fill(100), 110]), rules);
  assert.equal(up.sma20, 100.5); assert.equal(up.crossing, 'up');
  const down = analyze(series([...Array(20).fill(100), 90]), rules);
  assert.equal(down.sma20, 99.5); assert.equal(down.crossing, 'down');
  assert.equal(analyze(series([100, 110]), rules).sma20, null);
});
test('history stays limited to 30 changes and retains only dates in the imported series', () => {
  const rows = series(Array.from({ length: 50 }, (_, i) => 100 * 1.04 ** i));
  const analysis = analyze(rows, rules);
  assert.equal(analysis.history.length, 30);
  assert.equal(analysis.history.at(-1).date, rows.at(-1).date);
  assert.equal(analysis.history[0].date, rows[20].date);
});
test('bad rule settings and unordered data do not produce signals', () => {
  for (const invalid of [{ move: 0 }, { drawdown: NaN }, { lookback: 1.5 }, { confirmation: 4 }])
    assert.throws(() => analyze(series([100, 110]), { ...rules, ...invalid }));
  assert.throws(() => analyze(series([100, 110]).reverse(), rules));
  assert.throws(() => analyze(series([Number.MIN_VALUE, 100]), rules), /escala/);
});
