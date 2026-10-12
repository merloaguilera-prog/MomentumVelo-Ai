const test = require('node:test');
const assert = require('node:assert/strict');
const ledger = require('../practica-core');
const { review, view, toCSV } = require('../practica-review-core');
function add(state, id, side, quantity, price, fee = 0, note = '') {
  return ledger.addTrade(state, { id, side, quantity, price, fee, note, symbol: 'BME:SAN', date: '2025-01-01' });
}
function parseCSV(csv) {
  const rows = []; let row = [], field = '', quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ';') { row.push(field); field = ''; }
    else if (!quoted && char === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += char;
  }
  assert.equal(quoted, false); return rows;
}
test('empty and flat portfolios have a finite centered chart and export their initial capital', () => {
  const state = ledger.create('EUR', 1000), data = review(state), chart = view(data);
  assert.equal(data.sales, 0); assert.equal(data.points.length, 1); assert.equal(chart.path, 'M500.00,140.00');
  const rows = parseCSV(toCSV(state)); assert.equal(rows.length, 2); assert.equal(rows[1][12], '1000,00');
  const buy = review(add(state, 'b', 'buy', 2, 10, 1)); assert.equal(view(buy).high, 100000); assert.equal(view(buy).low, 100000);
  assert.equal(buy.points[1].cashCents, 97900); assert.equal(buy.points[1].investedCents, 2100);
});
test('every review point reconciles against its ledger prefix, including fees and partial exits', () => {
  let state = ledger.create('EUR', 1000);
  state = add(state, 'a', 'buy', 10, 10, 1); state = add(state, 'b', 'buy', 10, 20, 1);
  state = add(state, 'c', 'sell', 5, 30, 1); state = add(state, 'd', 'sell', 5, 10, 1);
  state = add(state, 'e', 'sell', 10, 15.1);
  const data = review(state);
  for (const point of data.points) {
    const replayed = ledger.replay({ ...state, trades: state.trades.slice(0, point.index) });
    for (const key of ['cashCents', 'investedCents', 'realizedCents', 'feesCents', 'totalAtCostCents']) assert.equal(point[key], replayed[key]);
  }
  assert.equal(data.sales, 3); assert.equal(data.positiveSales, 1); assert.equal(data.negativeSales, 1); assert.equal(data.flatSales, 1);
  assert.equal(data.gainsCents, 7350); assert.equal(data.lossesCents, -2650); assert.equal(data.realizedCents, 4700);
  assert.equal(data.gainsCents + data.lossesCents, data.realizedCents); assert.equal(data.feesCents, 400);
});
test('30-operation view includes its preceding balance and leaves the whole report intact', () => {
  let state = ledger.create('EUR', 1000);
  for (let i = 1; i <= 100; i++) state = add(state, `b${i}`, 'buy', 1, 1);
  const data = review(state), chart = view(data, 30, 'cashCents');
  assert.equal(chart.rows.length, 31); assert.equal(chart.rows[0].index, 70); assert.equal(chart.rows.at(-1).index, 100);
  assert.equal(chart.high, 93000); assert.equal(chart.low, 90000); assert.equal(chart.points[0].y, 40); assert.equal(chart.points.at(-1).y, 240);
  assert.equal(parseCSV(toCSV(state)).length, 102); assert.equal(data.points.length, 101);
  assert.equal(view(data, 90).rows[0].index, 10); assert.throws(() => view(data, 7)); assert.throws(() => view(data, 'all', 'live'));
});
test('CSV preserves multiline notes and quotes, has stable columns and does not export private identifiers', () => {
  let state = add(ledger.create('EUR', 1000), 'private_id', 'buy', .5, 1.005, .01, 'Texto; "comillas"\nSegunda línea 😀');
  state = add(state, 'sale', 'sell', .5, 1, .01);
  const csv = toCSV(state), rows = parseCSV(csv);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(rows.every(row => row.length === 15));
  assert.equal(rows[2][14], 'Texto; "comillas"\nSegunda línea 😀'); assert.equal(rows[2][6], '1,005'); assert.equal(rows[2][7], '0,50');
  assert.equal(rows[2][9], ''); assert.equal(rows[3][9], '-0,02'); assert.equal(rows[3][13], '-0,02');
  assert.ok(!csv.includes('private_id')); assert.ok(!csv.includes('sale'));
});
test('spreadsheet formula-like notes are exported as text, while stored notes stay unchanged', () => {
  const notes = ['=1+1', '+cmd', '-1+2', '@SUM(A1)', '  =HYPERLINK("x")', '\t=1', '\r=1', '\n=1', '\uFEFF=1'];
  for (const note of notes) {
    const state = add(ledger.create('EUR', 1000), 'a', 'buy', 1, 1, 0, note);
    const rows = parseCSV(toCSV(state)); assert.equal(rows[2][14], `'${note}`); assert.equal(state.trades[0].note, note);
  }
});
test('review and CSV refuse corrupt and future operations instead of presenting invented results', () => {
  const state = ledger.create('EUR', 1000);
  const invalid = { ...state, trades: [{ id: 'a', side: 'sell', quantity: 1, price: 10, fee: 0, note: '', symbol: 'BME:SAN', date: '2025-01-01' }] };
  assert.throws(() => review(invalid)); assert.throws(() => toCSV(invalid));
  const future = add(state, 'b', 'buy', 1, 1); assert.throws(() => review(future, '2024-12-31')); assert.throws(() => toCSV(future, '2024-12-31'));
});
