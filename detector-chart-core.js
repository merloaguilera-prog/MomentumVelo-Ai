(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MomentumHistory = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  function view(rows, count = "all") {
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > 1000) throw new Error("Se necesitan de 2 a 1.000 cierres para dibujar el histórico.");
    if (count !== "all" && ![30, 90, 180].includes(count)) throw new Error("Tramo de histórico incorrecto.");
    rows.forEach((row, i) => {
      const time = Date.parse(`${row.date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== row.date || !Number.isFinite(row.close) || row.close <= 0 || (i && row.date <= rows[i - 1].date)) throw new Error("Revisa las fechas y los cierres del histórico.");
    });
    const selected = count === "all" ? rows.slice() : rows.slice(-count);
    let high = selected[0], low = selected[0];
    selected.forEach(row => { if (row.close > high.close) high = row; if (row.close < low.close) low = row; });
    const first = selected[0], last = selected.at(-1);
    const change = (last.close / first.close - 1) * 100;
    if (!Number.isFinite(change)) throw new Error("La escala de precios no permite dibujar el tramo.");
    // Calendar spacing preserves weekends and gaps in the imported series.
    const start = Date.parse(`${first.date}T00:00:00Z`), duration = Date.parse(`${last.date}T00:00:00Z`) - start;
    // Divide by the largest price first to keep extreme but finite prices drawable.
    const floor = low.close / high.close, span = 1 - floor;
    const points = selected.map(row => ({
      x: 70 + (Date.parse(`${row.date}T00:00:00Z`) - start) / duration * 880,
      y: span === 0 ? 140 : 240 - (row.close / high.close - floor) / span * 200
    }));
    return { rows: selected, first, last, high, low, change, points, path: points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") };
  }
  function toCSV(rows) {
    view(rows);
    if (rows.some(row => row.volume !== null && (!Number.isFinite(row.volume) || row.volume < 0))) throw new Error("Revisa los volúmenes del histórico.");
    // Numeric data and ISO dates only: user-entered labels never become CSV formulas.
    function decimal(value) {
      const text = String(value);
      if (!text.includes("e")) return text;
      const [coefficient, exponent] = text.split("e"), parts = coefficient.split(".");
      const digits = parts.join(""), position = parts[0].length + Number(exponent);
      return position <= 0 ? `0.${"0".repeat(-position)}${digits}`
        : position >= digits.length ? digits + "0".repeat(position - digits.length)
          : `${digits.slice(0, position)}.${digits.slice(position)}`;
    }
    return "fecha,cierre,volumen\r\n" + rows.map(row => `${row.date},${decimal(row.close)},${row.volume === null ? "" : decimal(row.volume)}`).join("\r\n") + "\r\n";
  }
  return { view, toCSV };
});
