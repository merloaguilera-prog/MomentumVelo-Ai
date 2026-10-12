const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../comparador-core');
function series(asset, entries, currency = 'USD', adjustment = 'raw') {
  return { asset, source: 'Archivo ficticio de prueba', currency, adjustment, rows: entries.map(([date, close]) => ({ date, close, volume: null })) };
}
const a = series('A', [['2025-01-01',100], ['2025-01-02',110], ['2025-01-03',500], ['2025-01-05',90]]);
const b = series('B', [['2025-01-01',50], ['2025-01-02',45], ['2025-01-04',40], ['2025-01-05',60]]);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
test('comparison aligns exact dates and starts both curves at zero without filling gaps', () => {
  const data = core.compare(a,b);
  assert.deepEqual(data.rows.map(row => row.date), ['2025-01-01','2025-01-02','2025-01-05']);
  assert.equal(data.rows[0].changeA,0); assert.equal(data.rows[0].changeB,0);
  close(data.changeA,-10); close(data.changeB,20); close(data.difference,-30);
  assert.equal(data.omittedA,1); assert.equal(data.omittedB,1); assert.equal(data.commonCount,3);
  close(data.points[1].x,290); assert.equal(data.points[2].x,950);
  assert.ok(!data.pathA.includes('NaN')); assert.ok(!data.pathB.includes('Infinity'));
});
test('drawdowns use peaks before troughs and only the shared closing dates', () => {
  const data=core.compare(a,b);
  close(data.drawdownA.percent,(90/110-1)*100); assert.equal(data.drawdownA.peakDate,'2025-01-02'); assert.equal(data.drawdownA.date,'2025-01-05');
  close(data.drawdownB.percent,-10); assert.equal(data.drawdownB.date,'2025-01-02');
  // The excluded 500 close is deliberately not treated as a shared peak.
  assert.ok(data.drawdownA.percent>-20);
});
test('flat and differently priced series share a finite chart, and currencies remain separate', () => {
  const one=series('A',[['2025-01-01',100],['2025-01-02',100]],'EUR');
  const two=series('B',[['2025-01-01',500],['2025-01-02',500]]);
  const data=core.compare(one,two); assert.equal(data.high,0); assert.equal(data.low,0);
  assert.equal(data.pathA,'M70.00,140.00 L950.00,140.00'); assert.equal(data.pathA,data.pathB);
  assert.equal(data.a.currency,'EUR'); assert.equal(data.b.currency,'USD'); assert.equal(data.rows[0].closeB,500);
});
test('changing the range recalculates its baseline after aligning all dates', () => {
  const entries=Array.from({length:100},(_,i)=>[new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),100+i]);
  const one=series('A',entries),two=series('B',entries.map(([date])=>[date,100]));
  const all=core.compare(one,two),short=core.compare(one,two,30);
  close(all.changeA,99); close(short.changeA,(199/170-1)*100); assert.equal(short.rows[0].changeA,0);
  assert.equal(short.rows.length,30); assert.equal(short.commonCount,100); assert.equal(short.rows[0].date,entries[70][0]);
  assert.throws(()=>core.compare(one,two,7)); assert.equal(core.compare(one,two,180).rows.length,100);
});
test('comparison rejects insufficient overlap, mixed adjustment bases and corrupt metadata', () => {
  assert.throws(()=>core.compare(a,series('B',[['2025-02-01',1],['2025-02-02',2]])),/fechas comunes/);
  assert.throws(()=>core.compare(a,series('B',[['2025-01-01',1],['2025-02-02',2]])),/fechas comunes/);
  assert.throws(()=>core.compare(a,{...b,adjustment:'adjusted'}),/mismo tipo/);
  for(const patch of [{asset:''},{asset:'x'.repeat(81)},{source:''},{currency:'GBP'},{adjustment:'unknown-mode'}])assert.throws(()=>core.compare({...a,...patch},b));
});
test('CSV parsing retains symbol validation, sorts dates and refuses future, duplicate or broken records', () => {
  const metadata={asset:'ABC',source:'Prueba',currency:'USD',adjustment:'raw'};
  const parsed=core.parse('Date;Close;Symbol\n2025-01-02;1,2;ABC\n2025-01-01;1;ABC',metadata);
  assert.equal(parsed.rows[0].date,'2025-01-01'); assert.equal(parsed.rows[1].close,1.2);
  assert.throws(()=>core.parse('date,close,symbol\n2025-01-01,1,OTHER\n2025-01-02,2,OTHER',metadata),/símbolo/);
  assert.throws(()=>core.parse('fecha,cierre\n2025-01-01,1\n2025-01-01,2',metadata),/repetida/);
  assert.throws(()=>core.validate(a,'2024-12-31'),/futura/);
  assert.throws(()=>core.validate({...a,rows:[{date:'2025-02-30',close:1},{date:'2025-03-01',close:2}]}));
  assert.throws(()=>core.validate({...a,rows:[{date:'2025-01-01',close:0},{date:'2025-01-02',close:2}]}));
});
test('CSV report exports only shared rows with stable numeric columns and excludes formula-like labels', () => {
  const one={...a,asset:'=FORMULA()',source:'+CMD'};
  const csv=core.toCSV(one,b), lines=csv.replace(/^\uFEFF/,'').trim().split('\r\n');
  assert.equal(lines.length,4); assert.equal(lines[0],'fecha,cierre_a,cierre_b,variacion_a_pct,variacion_b_pct');
  assert.ok(lines.every(line=>line.split(',').length===5)); assert.ok(!csv.includes('FORMULA')); assert.ok(!csv.includes('CMD'));
  close(Number(lines.at(-1).split(',')[3]),-10); close(Number(lines.at(-1).split(',')[4]),20);
});
test('extreme scales and unsorted direct transfers never produce a nonfinite chart', () => {
  assert.throws(()=>core.compare(series('A',[['2025-01-01',1e-308],['2025-01-02',1e308]]),b));
  assert.throws(()=>core.validate({...a,rows:a.rows.slice().reverse()}));
  const copy=JSON.stringify(a);core.compare(a,b);assert.equal(JSON.stringify(a),copy);
});
