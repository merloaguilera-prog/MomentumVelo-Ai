const test = require('node:test');
const assert = require('node:assert/strict');
const { view, toCSV } = require('../detector-chart-core');
const { parseCSV } = require('../detector-core');
const row = (date, close, volume = null) => ({ date, close, volume });
test('chart uses actual calendar gaps and dates for extrema', () => {
  const data = view([row('2025-01-01', 100), row('2025-01-02', 105), row('2025-01-11', 90)]);
  assert.equal(data.points[1].x, 158);
  assert.equal(data.points[0].x, 70); assert.equal(data.points[2].x, 950);
  assert.equal(data.high.date, '2025-01-02'); assert.equal(data.low.date, '2025-01-11');
  assert.ok(Math.abs(data.change + 10) < 1e-9);
  assert.equal(data.points[1].y, 40); assert.equal(data.points[2].y, 240);
});
test('visible range excludes earlier extremes and uses its first close as the baseline', () => {
  const rows = Array.from({ length: 40 }, (_, i) => row(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), i ? 100 + i : 999));
  const data = view(rows, 30);
  assert.equal(data.rows.length, 30); assert.equal(data.first.close, 110); assert.equal(data.high.close, 139);
  assert.ok(Math.abs(data.change - (139 / 110 - 1) * 100) < 1e-9);
  assert.equal(view(rows).high.close, 999); assert.equal(rows.length, 40);
});
test('flat or very large prices yield finite chart coordinates', () => {
  for (const closes of [[100, 100], [Number.MAX_VALUE / 2, Number.MAX_VALUE]]) {
    const data = view([row('2025-01-01', closes[0]), row('2025-01-02', closes[1])]);
    assert.ok(data.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.doesNotMatch(data.path, /NaN|Infinity/);
  }
  assert.equal(view([row('2025-01-01', 100), row('2025-01-02', 100)]).points[0].y, 140);
});
test('CSV export round trips sorted closes and optional volumes without rounding', () => {
  const rows = [row('2025-01-01', 100.123456789), row('2025-01-02', 103.123456789, 0), row('2025-01-03', 99.987654321, 14500)];
  assert.deepEqual(parseCSV(toCSV(rows)).rows, rows);
  assert.match(toCSV(rows), /^fecha,cierre,volumen\r\n/);
});
test('very small and large valid decimals export without scientific notation', () => {
  for (const closes of [[1e-7, 2.01e-7], [1e21, 1.001e21]]) {
    const rows = [row('2025-01-01', closes[0], 1e22), row('2025-01-02', closes[1], 0)];
    assert.deepEqual(parseCSV(toCSV(rows)).rows, rows);
    assert.doesNotMatch(toCSV(rows), /\d[eE][+-]?\d/);
  }
});
test('invalid dates, ranges, numeric scales and volumes cannot be exported or plotted', () => {
  assert.throws(() => view([row('2025-02-30', 100), row('2025-03-01', 101)]));
  assert.throws(() => view([row('2025-01-01', 100), row('2025-01-01', 101)]));
  assert.throws(() => view([row('2025-01-01', 100), row('2025-01-02', 101)], 1));
  assert.throws(() => view([row('2025-01-01', Number.MIN_VALUE), row('2025-01-02', 100)]));
  assert.throws(() => toCSV([row('2025-01-01', 100), row('2025-01-02', 101, -1)]));
});
