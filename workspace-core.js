(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MomentumWorkspace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_BYTES = 128000;
  function normalize(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function filterFavorites(state, assets, query, notesOnly, order) {
    const search = normalize(query).trim();
    const rows = state.favorites.map(symbol => assets.find(a => a.symbol === symbol)).filter(Boolean)
      .filter(a => (!search || normalize(`${a.label} ${a.symbol}`).includes(search)) &&
        (!notesOnly || Boolean((state.notes[a.symbol] || "").trim())));
    if (order === "name") rows.sort((a, b) => a.label.localeCompare(b.label, "es"));
    return rows;
  }
  function parseBackup(text, knownSymbols) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES) {
      throw new Error("La copia supera el límite de 128 KB.");
    }
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error("La copia no contiene JSON válido."); }
    if (!data || data.format !== "momentumvelo-workspace" || data.version !== 1 ||
        !Array.isArray(data.favorites) || !data.notes || typeof data.notes !== "object" || Array.isArray(data.notes)) {
      throw new Error("Este archivo no es una copia de favoritos y notas de MomentumVelo.");
    }
    const known = new Set(knownSymbols);
    if (data.favorites.length > known.size || Object.keys(data.notes).length > known.size ||
        data.favorites.some(s => typeof s !== "string" || !known.has(s)) ||
        Object.keys(data.notes).some(s => !known.has(s) || typeof data.notes[s] !== "string" || data.notes[s].length > 2000)) {
      throw new Error("La copia contiene activos no disponibles o notas inválidas. No se ha importado nada.");
    }
    const notes = {};
    Object.keys(data.notes).forEach(s => { if (data.notes[s].trim()) notes[s] = data.notes[s]; });
    return { version: 1, favorites: [...new Set(data.favorites)], notes };
  }
  function mergeBackup(current, imported) {
    const favorites = [...new Set(current.favorites.concat(imported.favorites))];
    const notes = { ...current.notes };
    let addedNotes = 0, conflicts = 0;
    Object.keys(imported.notes).forEach(symbol => {
      if (!String(notes[symbol] || "").trim()) { notes[symbol] = imported.notes[symbol]; addedNotes++; }
      else if (notes[symbol] !== imported.notes[symbol]) conflicts++;
    });
    return { state: { version: 1, favorites, notes }, addedFavorites: favorites.length - current.favorites.length, addedNotes, conflicts };
  }
  function serializeBackup(state, knownSymbols, date = new Date()) {
    const known = new Set(knownSymbols);
    const favorites = [...new Set(state.favorites.filter(s => known.has(s)))];
    const notes = {};
    known.forEach(s => {
      if (typeof state.notes[s] === "string" && state.notes[s].trim()) notes[s] = state.notes[s].slice(0, 2000);
    });
    return JSON.stringify({ format: "momentumvelo-workspace", version: 1, exportedAt: date.toISOString(), favorites, notes }, null, 2);
  }
  return { MAX_BYTES, filterFavorites, parseBackup, mergeBackup, serializeBackup };
});
