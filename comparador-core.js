(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./detector-core"), require("./detector-chart-core"));
  else root.MomentumCompare = factory(root.MomentumDetector, root.MomentumHistory);
})(typeof window === "object" ? window : globalThis, function (parser, history) {
  "use strict";
  function validate(series, today = new Date().toISOString().slice(0, 10)) {
    if (!series || typeof series.asset !== "string" || !series.asset.trim() || series.asset.trim().length > 80 || typeof series.source !== "string" || !series.source.trim() || series.source.trim().length > 160 || !["USD", "EUR"].includes(series.currency) || !["raw", "adjusted", "unknown"].includes(series.adjustment)) throw new Error("Indica activo, fuente, moneda y tipo de cierre de cada histórico.");
    try { history.view(series.rows); }
    catch (error) { throw new Error(error instanceof TypeError ? "Revisa las fechas y los cierres del histórico." : error.message); }
    if (series.rows.some(row => row.date > today)) throw new Error("El histórico contiene una fecha futura.");
    return { asset: series.asset.trim(), source: series.source.trim(), currency: series.currency, adjustment: series.adjustment, rows: series.rows.map(row => ({ date: row.date, close: row.close, volume: null })) };
  }
  function parse(text, metadata, today) {
    const parsed = parser.parseCSV(text, today);
    if (parsed.symbol && parsed.symbol !== metadata.asset.trim().toUpperCase()) throw new Error(`El símbolo del archivo es ${parsed.symbol}. Usa ese mismo símbolo como activo.`);
    return validate({ ...metadata, rows: parsed.rows }, today);
  }
  function compare(first, second, count = "all", today) {
    const a = validate(first, today), b = validate(second, today);
    if (a.adjustment !== b.adjustment) throw new Error("Usa el mismo tipo de cierre en ambos históricos: ajustado, sin ajustar o no declarado.");
    if (count !== "all" && ![30, 90, 180].includes(count)) throw new Error("Elige un tramo válido.");
    const byDate = new Map(b.rows.map(row => [row.date, row.close]));
    const aligned = a.rows.filter(row => byDate.has(row.date)).map(row => ({ date: row.date, closeA: row.close, closeB: byDate.get(row.date) }));
    if (aligned.length < 2) throw new Error("Los históricos necesitan al menos dos fechas comunes. No rellenamos los días sin datos.");
    const selected = count === "all" ? aligned : aligned.slice(-count);
    const base = selected[0];
    const rows = selected.map(row => ({ ...row, changeA: (row.closeA / base.closeA - 1) * 100, changeB: (row.closeB / base.closeB - 1) * 100 }));
    const last = rows.at(-1), difference = last.changeA - last.changeB;
    if (rows.some(row => !Number.isFinite(row.changeA) || !Number.isFinite(row.changeB)) || !Number.isFinite(difference)) throw new Error("La escala de los precios no permite comparar porcentajes válidos.");
    const values = rows.flatMap(row => [row.changeA, row.changeB]), high = Math.max(...values), low = Math.min(...values);
    const start = Date.parse(`${base.date}T00:00:00Z`), duration = Date.parse(`${last.date}T00:00:00Z`) - start;
    const points = rows.map(row => ({ x: 70 + (Date.parse(`${row.date}T00:00:00Z`) - start) / duration * 880, yA: high === low ? 140 : 240 - (row.changeA - low) / (high - low) * 200, yB: high === low ? 140 : 240 - (row.changeB - low) / (high - low) * 200 }));
    const path = key => points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p[key].toFixed(2)}`).join(" ");
    function drawdown(key) {
      let peak = rows[0], worst = { percent: 0, peakDate: rows[0].date, date: rows[0].date };
      for (const row of rows) {
        if (row[key] > peak[key]) peak = row;
        const percent = (row[key] / peak[key] - 1) * 100;
        if (percent < worst.percent) worst = { percent, peakDate: peak.date, date: row.date };
      }
      return worst;
    }
    return { a, b, rows, points, high, low, pathA: path("yA"), pathB: path("yB"), difference, changeA: last.changeA, changeB: last.changeB, drawdownA: drawdown("closeA"), drawdownB: drawdown("closeB"), commonCount: aligned.length, omittedA: a.rows.length - aligned.length, omittedB: b.rows.length - aligned.length };
  }
  function toCSV(first, second, count, today) {
    const data = compare(first, second, count, today);
    // Only validated dates and calculated numbers; labels never become formulas.
    return "\uFEFFfecha,cierre_a,cierre_b,variacion_a_pct,variacion_b_pct\r\n" + data.rows.map(row => [row.date, row.closeA, row.closeB, row.changeA, row.changeB].join(",")).join("\r\n") + "\r\n";
  }
  return { validate, parse, compare, toCSV };
});
