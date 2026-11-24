(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MomentumLiveRadar = factory();
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD"];
  function create(threshold = 0.5, { windowSeconds = 60, confirmationMs = 0 } = {}) {
    if (!Number.isFinite(threshold) || threshold < 0.1 || threshold > 10) throw Error("Umbral entre 0,1 y 10 %.");
    if (![60, 300, 900].includes(windowSeconds) || ![0, 1000, 3000].includes(confirmationMs)) throw Error("Elige un periodo y una confirmación disponibles.");
    const windowMs = windowSeconds * 1000;
    const states = new Map();
    function reset() { states.clear(); }
    function ingest(message, now) {
      if (!message || message.type !== "ticker" || !PRODUCTS.includes(message.product_id)) return null;
      const price = Number(message.price), time = Date.parse(message.time), sequence = message.sequence;
      if (!Number.isFinite(now) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(time) || now - time > 15000 || time - now > 5000 || !Number.isSafeInteger(sequence) || sequence < 0) return null;
      let state = states.get(message.product_id);
      if (state && (sequence <= state.sequence || time <= state.time)) return null;
      if (!state || time - state.time > 15000) state = { samples: [], lastAlert: -Infinity, side: 0, pendingSide: 0, pendingSince: time };
      state.sequence = sequence; state.time = time; state.price = price;
      // Keep the latest observed price per second in a bounded selected window.
      state.samples = state.samples.filter(row => time - row.time <= windowMs + 2000);
      const last = state.samples.at(-1);
      if (!last || Math.floor(last.time / 1000) !== Math.floor(time / 1000)) state.samples.push({ time, price });
      else state.samples[state.samples.length - 1] = { time, price };
      const base = state.samples.find(row => time - row.time >= windowMs);
      const change = base ? (price / base.price - 1) * 100 : null;
      if (change !== null && !Number.isFinite(change)) return null;
      const side = change === null ? 0 : change >= threshold ? 1 : change <= -threshold ? -1 : 0;
      if (side !== state.pendingSide) { state.pendingSide = side; state.pendingSince = time; }
      const confirmedSide = side && time - state.pendingSince >= confirmationMs ? side : 0;
      let signal = null;
      if (confirmedSide && confirmedSide !== state.side && time - state.lastAlert >= 60000) {
        signal = { product: message.product_id, time, price, change, direction: side > 0 ? "up" : "down", baselineTime: base.time, baselinePrice: base.price, threshold, windowSeconds, confirmationMs };
        state.lastAlert = time;
      }
      state.side = confirmedSide;
      states.set(message.product_id, state);
      return { product: message.product_id, time, price, change, signal, warming: !base, windowSeconds, confirmationMs };
    }
    return { ingest, reset };
  }
  return { create, PRODUCTS };
});
