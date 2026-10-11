(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MomentumPractice = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const assets = [
    { symbol: "BME:SAN", name: "Santander", currency: "EUR" },
    { symbol: "BME:IBE", name: "Iberdrola", currency: "EUR" },
    { symbol: "NASDAQ:NVDA", name: "Nvidia", currency: "USD" },
    { symbol: "NASDAQ:AAPL", name: "Apple", currency: "USD" },
    { symbol: "NASDAQ:MSFT", name: "Microsoft", currency: "USD" },
    { symbol: "NASDAQ:TSLA", name: "Tesla", currency: "USD" },
    { symbol: "NASDAQ:ASML", name: "ASML", currency: "USD" },
    { symbol: "NASDAQ:MELI", name: "MercadoLibre", currency: "USD" },
    { symbol: "COINBASE:BTCUSD", name: "Bitcoin / dólar", currency: "USD" },
    { symbol: "COINBASE:ETHUSD", name: "Ethereum / dólar", currency: "USD" }
  ];
  const fail = text => { throw new Error(text); };
  function cents(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1000000 || Number(value.toFixed(2)) !== value) fail("Usa un importe entre 0 y 1.000.000, con hasta dos decimales.");
    return Math.round(value * 100);
  }
  function units(value) {
    if (!Number.isFinite(value) || value <= 0 || value > 1000000 || Number(value.toFixed(6)) !== value) fail("La cantidad debe ser positiva, con hasta seis decimales y un máximo de 1.000.000.");
    return Math.round(value * 1000000);
  }
  function validDate(value, today) {
    const time = typeof value === "string" ? Date.parse(`${value}T00:00:00Z`) : NaN;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value <= today;
  }
  function integer(value) { if (!Number.isSafeInteger(value) || value < 0) fail("El importe calculado está fuera de los límites de la cartera."); return value; }
  const roundRatio = (numerator, denominator) => Number((2n * numerator + denominator) / (2n * denominator));
  function estimate(trade) {
    const quantity = units(trade.quantity), feeCents = cents(trade.fee), price = trade.price;
    if (!Number.isFinite(price) || price <= 0 || price > 1000000 || Number(price.toFixed(8)) !== price || !["buy", "sell"].includes(trade.side)) fail("Revisa el precio simulado: hasta ocho decimales y un máximo de 1.000.000.");
    // Round the exact product of decimal price and fractional units to cents.
    const grossCents = integer(roundRatio(BigInt(Math.round(price * 100000000)) * BigInt(quantity), 1000000000000n));
    if (!grossCents) fail("El importe de la operación debe alcanzar al menos 0,01.");
    return { quantity, feeCents, grossCents, totalCents: grossCents + (trade.side === "buy" ? feeCents : -feeCents) };
  }
  function create(currency, capital) {
    if (!["EUR", "USD"].includes(currency) || capital < 100) fail("Elige EUR o USD y un capital virtual de al menos 100.");
    return { version: 1, mode: "practice", currency, initialCents: cents(capital), trades: [] };
  }
  function replay(state, today = new Date().toISOString().slice(0, 10)) {
    if (!state || state.version !== 1 || state.mode !== "practice" || !["EUR", "USD"].includes(state.currency) || !Number.isSafeInteger(state.initialCents) || state.initialCents < 10000 || state.initialCents > 100000000 || !Array.isArray(state.trades) || state.trades.length > 500) fail("La copia no es una cartera de práctica válida (máximo 500 operaciones).");
    let cashCents = state.initialCents, realizedCents = 0, feesCents = 0, lastDate = "";
    const positions = new Map(), ids = new Set(), journal = [];
    for (const trade of state.trades) {
      if (!trade || typeof trade !== "object") fail("Hay una operación inválida en la copia.");
      const asset = assets.find(item => item.symbol === trade.symbol);
      if (!trade || typeof trade.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(trade.id) || ids.has(trade.id) || !asset || asset.currency !== state.currency || !["buy", "sell"].includes(trade.side) || !validDate(trade.date, today) || trade.date < lastDate || typeof trade.note !== "string" || trade.note.length > 500 || !Number.isFinite(trade.price) || trade.price <= 0 || trade.price > 1000000 || Number(trade.price.toFixed(8)) !== trade.price) fail("Revisa activo, moneda, fechas, precio y nota. Las fechas deben seguir el orden del diario.");
      ids.add(trade.id); lastDate = trade.date;
      const estimated = estimate(trade), quantity = estimated.quantity, fee = estimated.feeCents, gross = estimated.grossCents;
      let position = positions.get(trade.symbol) || { symbol: trade.symbol, units: 0, costCents: 0 };
      let profitCents = null;
      if (trade.side === "buy") {
        const cost = integer(gross + fee);
        if (cost > cashCents) fail("No hay saldo virtual suficiente para esta compra y su comisión.");
        cashCents -= cost;
        position = { ...position, units: integer(position.units + quantity), costCents: integer(position.costCents + cost) };
      } else {
        if (quantity > position.units) fail("No puedes vender más unidades de las que tienes en esta cartera.");
        const allocatedCost = quantity === position.units ? position.costCents : roundRatio(BigInt(position.costCents) * BigInt(quantity), BigInt(position.units));
        cashCents = integer(cashCents + gross - fee);
        profitCents = gross - fee - allocatedCost;
        realizedCents += profitCents;
        if (!Number.isSafeInteger(realizedCents)) fail("El resultado está fuera de los límites de la cartera.");
        position = { ...position, units: position.units - quantity, costCents: position.costCents - allocatedCost };
      }
      feesCents = integer(feesCents + fee); positions.set(trade.symbol, position);
      journal.push({ ...trade, grossCents: gross, profitCents, cashCents });
    }
    const open = [...positions.values()].filter(position => position.units > 0);
    const investedCents = integer(open.reduce((sum, position) => sum + position.costCents, 0));
    // This is bookkeeping at cost, never a current market valuation.
    const totalAtCostCents = integer(cashCents + investedCents);
    if (totalAtCostCents !== state.initialCents + realizedCents) fail("Los saldos de la cartera no cuadran.");
    const sales = journal.filter(trade => trade.side === "sell");
    return { cashCents, investedCents, realizedCents, feesCents, totalAtCostCents, positions: open, journal, sales: sales.length, profitableSales: sales.filter(trade => trade.profitCents > 0).length };
  }
  function clean(state) {
    return { version: 1, mode: "practice", currency: state.currency, initialCents: state.initialCents, trades: state.trades.map(trade => ({ id: trade.id, symbol: trade.symbol, side: trade.side, date: trade.date, quantity: trade.quantity, price: trade.price, fee: trade.fee, note: trade.note })) };
  }
  function addTrade(state, trade, today) {
    const next = clean(state); next.trades.push(trade); replay(next, today); return clean(next);
  }
  function parseBackup(text, today) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > 1000000) fail("La copia supera 1 MB.");
    let state;
    try { state = JSON.parse(text); } catch (_) { fail("No se pudo leer el JSON. Elige una copia de MomentumVelo."); }
    replay(state, today); return clean(state);
  }
  return { assets, create, replay, addTrade, parseBackup, estimate };
});
