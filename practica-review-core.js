(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./practica-core"));
  else root.MomentumPracticeReview = factory(root.MomentumPractice);
})(typeof window === "object" ? window : globalThis, function (core) {
  "use strict";
  function review(state, today) {
    const ledger = core.replay(state, today);
    let realized = 0, fees = 0;
    const points = [{ index: 0, date: null, label: "Capital inicial", cashCents: state.initialCents, investedCents: 0, realizedCents: 0, feesCents: 0, totalAtCostCents: state.initialCents }];
    ledger.journal.forEach((trade, i) => {
      realized += trade.profitCents || 0; fees += Math.round(trade.fee * 100);
      points.push({ ...trade, index: i + 1, label: `${i + 1} · ${trade.date}`, realizedCents: realized, feesCents: fees, investedCents: state.initialCents + realized - trade.cashCents, totalAtCostCents: state.initialCents + realized });
    });
    const sales = ledger.journal.filter(trade => trade.side === "sell");
    return { currency: state.currency, initialCents: state.initialCents, points,
      sales: sales.length, positiveSales: sales.filter(t => t.profitCents > 0).length,
      negativeSales: sales.filter(t => t.profitCents < 0).length, flatSales: sales.filter(t => t.profitCents === 0).length,
      gainsCents: sales.reduce((sum, t) => sum + Math.max(0, t.profitCents), 0),
      lossesCents: sales.reduce((sum, t) => sum + Math.min(0, t.profitCents), 0),
      realizedCents: ledger.realizedCents, feesCents: ledger.feesCents };
  }
  function view(data, count = "all", metric = "totalAtCostCents") {
    if (!["all", 30, 90].includes(count) || !["totalAtCostCents", "cashCents"].includes(metric)) throw new Error("Elige un recorrido y una medida válidos.");
    // Include the preceding balance, so the first operation in the range has context.
    const rows = count === "all" ? data.points : data.points.slice(-(count + 1));
    const values = rows.map(row => row[metric]), high = Math.max(...values), low = Math.min(...values);
    const points = rows.map((row, i) => ({ x: rows.length === 1 ? 500 : 70 + i / (rows.length - 1) * 880, y: high === low ? 140 : 240 - (row[metric] - low) / (high - low) * 200 }));
    return { rows, points, high, low, metric, path: points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ") };
  }
  function csvText(value) {
    let text = String(value);
    // Quotes alone do not prevent spreadsheet formula evaluation of user notes.
    if (/^[=+\-@]/.test(text.trimStart()) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }
  const csvNumber = value => `"${String(value).replace(".", ",")}"`;
  const csvMoney = value => `"${(value / 100).toFixed(2).replace(".", ",")}"`;
  function toCSV(state, today) {
    const data = review(state, today);
    const headings = ["Registro", "Fecha", "Operación simulada", "Activo", "Moneda", "Unidades", "Precio simulado", "Importe", "Comisión", "Resultado de la venta", "Saldo virtual después", "Coste pendiente después", "Total al coste después", "Resultado acumulado", "Mi nota"];
    const rows = [headings.map(csvText).join(";")];
    // Initial capital is exported even when there are no trades.
    rows.push([csvNumber(0), csvText(""), csvText("Capital inicial virtual"), csvText(""), csvText(data.currency), csvText(""), csvText(""), csvMoney(data.initialCents), csvMoney(0), csvText(""), csvMoney(data.initialCents), csvMoney(0), csvMoney(data.initialCents), csvMoney(0), csvText("")].join(";"));
    data.points.slice(1).forEach(row => rows.push([
      csvNumber(row.index), csvText(row.date), csvText(row.side === "buy" ? "Compra simulada" : "Venta simulada"), csvText(row.symbol), csvText(data.currency),
      csvNumber(row.quantity), csvNumber(row.price), csvMoney(row.grossCents), csvMoney(Math.round(row.fee * 100)), row.profitCents === null ? csvText("") : csvMoney(row.profitCents),
      csvMoney(row.cashCents), csvMoney(row.investedCents), csvMoney(row.totalAtCostCents), csvMoney(row.realizedCents), csvText(row.note)
    ].join(";")));
    return `\uFEFF${rows.join("\r\n")}\r\n`;
  }
  return { review, view, toCSV };
});
