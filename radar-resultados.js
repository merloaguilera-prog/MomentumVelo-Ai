(function () {
  "use strict";
  const key = "momentumvelo.earnings-watchlist.v1";
  const form = document.getElementById("add");
  const field = document.getElementById("symbol");
  const items = document.getElementById("items");
  const status = document.getElementById("status");
  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data.filter(v => typeof v === "string" && /^[A-Z0-9.\-]{1,20}$/.test(v)).slice(0, 50) : [];
    } catch (_) { return []; }
  }
  let symbols = read();
  function save() {
    try { localStorage.setItem(key, JSON.stringify(symbols)); return true; }
    catch (_) { status.textContent = "El navegador no permite guardar favoritos. Puedes consultarlos hasta cerrar la página."; return false; }
  }
  function render() {
    items.replaceChildren();
    if (!symbols.length) {
      const p = document.createElement("p"); p.className = "muted"; p.textContent = "Todavía no tienes empresas favoritas."; items.appendChild(p);
    }
    symbols.forEach(symbol => {
      const row = document.createElement("div"); row.className = "entry";
      const label = document.createElement("strong"); label.textContent = symbol;
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Quitar " + symbol;
      remove.addEventListener("click", () => { symbols = symbols.filter(v => v !== symbol); save(); render(); });
      row.append(label, remove); items.appendChild(row);
    });
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const symbol = field.value.trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,20}$/.test(symbol)) { status.textContent = "Introduce un símbolo válido."; return; }
    if (symbols.includes(symbol)) { status.textContent = "Ya está en tus favoritos."; return; }
    if (symbols.length >= 50) { status.textContent = "Puedes guardar hasta 50 símbolos."; return; }
    symbols.push(symbol); save(); render(); field.value = ""; status.textContent = symbol + " añadido.";
  });
  render();
})();