(function () {
  "use strict";
  const core = window.MomentumPractice, $ = id => document.getElementById(id);
  const key = "momentumvelo.practice.portfolio.v1", today = () => new Date().toISOString().slice(0, 10);
  const money = value => (value / 100).toLocaleString("es-ES", { style: "currency", currency: current.currency });
  const decimal = value => value.toLocaleString("es-ES", { maximumFractionDigits: 8 });
  let current = null, previous = null, pending = null, baseline = null, importGeneration = 0;
  const element = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
  function message(text, error = false) { $("practice-status").textContent = text; $("practice-status").classList.toggle("error", error); }
  function read(text) {
    if (!text) return { current: null, previous: null };
    if (new TextEncoder().encode(text).length > 2200000) throw new Error("El registro guardado es demasiado grande. Conserva tu copia antes de preparar otra cartera.");
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || !data.current) throw new Error("No se pudo abrir la cartera guardada. Puedes cargar una copia JSON válida.");
    return { current: core.parseBackup(JSON.stringify(data.current)), previous: data.previous ? core.parseBackup(JSON.stringify(data.previous)) : null };
  }
  function clearPending() { pending = null; $("practice-pending").hidden = true; $("practice-import").value = ""; importGeneration++; }
  function commit(next, text) {
    try { core.replay(next); } catch (error) { message(error.message, true); return false; }
    let stored, storageReadable = true;
    try { stored = localStorage.getItem(key); } catch (_) { storageReadable = false; }
    if (storageReadable && stored !== baseline) {
      try {
        const fresh = read(stored); current = fresh.current; previous = fresh.previous; baseline = stored;
        clearPending(); render(); message("La cartera cambió en otra pestaña. Hemos cargado ese estado; revisa la operación antes de volver a registrarla.", true); return false;
      } catch (_) { message("El registro de otra pestaña no es válido. No lo hemos sustituido: conserva tu copia antes de seguir.", true); return false; }
    }
    const old = current;
    current = next; previous = old;
    let saved = true;
    try { const text = JSON.stringify({ version: 1, current, previous }); localStorage.setItem(key, text); baseline = text; } catch (_) { saved = false; }
    clearPending(); render();
    message(saved ? `${text} Guardado en este navegador.` : `${text} El navegador no permite guardar: descarga una copia antes de salir.`, !saved);
    return true;
  }
  function prepare(next, reason) {
    core.replay(next);
    if (!current) { commit(next, "Cartera virtual preparada."); return; }
    pending = next;
    $("pending-summary").textContent = `${reason} · ${next.currency} · capital virtual inicial ${(next.initialCents / 100).toLocaleString("es-ES")} · ${next.trades.length} operaciones.`;
    $("practice-pending").hidden = false;
    message("Cartera preparada para revisar. Pulsa «Usar esta cartera» si quieres aplicarla.");
  }
  function renderAssets() {
    const selected = $("trade-symbol").value;
    $("trade-symbol").replaceChildren();
    core.assets.filter(asset => asset.currency === current.currency).forEach(asset => {
      const option = element("option", `${asset.name} · ${asset.symbol}`); option.value = asset.symbol; $("trade-symbol").append(option);
    });
    if (core.assets.some(asset => asset.symbol === selected && asset.currency === current.currency)) $("trade-symbol").value = selected;
    $("trade-price-label").textContent = `Precio unitario simulado (${current.currency})`;
    $("trade-fee-label").textContent = `Comisión de la simulación (${current.currency})`;
    updateEstimate();
  }
  function updateEstimate() {
    const selected = core.assets.find(asset => asset.symbol === $("trade-symbol").value);
    if (selected) {
      $("trade-market-link").href = `/mercados?activo=${encodeURIComponent(selected.symbol)}#cotizacion`;
      $("trade-market-link").textContent = `Consultar ${selected.name} en Mercados reales ↗`;
    }
    const buying = $("trade-side").value === "buy";
    $("trade-submit").textContent = buying ? "Registrar compra simulada" : "Registrar venta simulada";
    const quantity = Number($("trade-quantity").value), price = Number($("trade-price").value), fee = Number($("trade-fee").value);
    try {
      const { totalCents } = core.estimate({ quantity, price, fee, side: $("trade-side").value });
      $("trade-estimate").textContent = `${buying ? "Coste virtual, con comisión" : "Ingreso virtual, después de comisión"}: ${money(totalCents)}. Se comprobará el saldo y la posición al registrarlo.`;
    } catch (_) { $("trade-estimate").textContent = "Añade unidades y precio válidos para ver el importe con su comisión."; }
  }
  function renderJournal(analysis) {
    const query = $("journal-search").value.trim().toLowerCase(), side = $("journal-filter").value;
    const rows = analysis.journal.slice().reverse().filter(trade => (side === "all" || trade.side === side) && `${trade.symbol} ${trade.note} ${core.assets.find(asset => asset.symbol === trade.symbol).name}`.toLowerCase().includes(query));
    $("journal-count").textContent = `${rows.length} de ${analysis.journal.length} operaciones simuladas.`;
    const list = $("practice-journal"); list.replaceChildren();
    if (!rows.length) list.append(element("p", analysis.journal.length ? "No hay operaciones que coincidan con este filtro." : "Aquí aparecerán tus operaciones y lo que quieras aprender de ellas.", "practice-hint"));
    rows.forEach(trade => {
      const card = element("article", "", "journal-entry"), header = document.createElement("header");
      header.append(element("span", trade.side === "buy" ? "COMPRA SIMULADA" : "VENTA SIMULADA"), element("time", trade.date));
      card.append(header, element("h3", `${core.assets.find(asset => asset.symbol === trade.symbol).name} · ${trade.symbol}`));
      card.append(element("p", `${decimal(trade.quantity)} unidades × ${decimal(trade.price)} ${current.currency} · Importe ${money(trade.grossCents)} · Comisión ${money(Math.round(trade.fee * 100))}.`));
      card.append(element("p", `Saldo virtual después: ${money(trade.cashCents)}.`));
      if (trade.profitCents !== null) card.append(element("p", `Resultado de esta venta al coste medio: ${money(trade.profitCents)}.`, `journal-result ${trade.profitCents < 0 ? "practice-negative" : ""}`));
      card.append(element("p", trade.note || "Sin nota todavía."));
      const details = document.createElement("details"); details.append(element("summary", "Editar mi nota"));
      const note = document.createElement("textarea"); note.rows = 3; note.maxLength = 500; note.value = trade.note;
      note.setAttribute("aria-label", `Nota de ${trade.symbol}, ${trade.date}, registro ${analysis.journal.findIndex(row => row.id === trade.id) + 1}`);
      const save = element("button", "Guardar nota"); save.type = "button";
      save.addEventListener("click", () => {
        const next = JSON.parse(JSON.stringify(current)), row = next.trades.find(row => row.id === trade.id);
        if (!row) { message("El registro ha cambiado. Revisa el diario antes de editarlo.", true); return; }
        row.note = note.value.slice(0, 500); commit(next, "Nota actualizada.");
      });
      details.append(note, save); card.append(details); list.append(card);
    });
  }
  function render() {
    $("practice-workspace").hidden = !current;
    $("practice-export").disabled = !current; $("practice-recover").disabled = !previous;
    $("practice-setup").open = !current;
    if (!current) return;
    const analysis = core.replay(current);
    $("setup-currency").value = current.currency; $("setup-capital").value = current.initialCents / 100;
    $("trade-date").max = today(); if (!$("trade-date").value) $("trade-date").value = today();
    $("trade-date").min = current.trades.at(-1)?.date || "";
    renderAssets();
    const metrics = $("practice-metrics"); metrics.replaceChildren();
    [["Saldo virtual disponible", analysis.cashCents], ["Coste pendiente de posiciones", analysis.investedCents], ["Resultado de ventas simuladas", analysis.realizedCents], ["Comisiones registradas", analysis.feesCents]].forEach(([name, value], i) => {
      const card = document.createElement("article"); card.append(element("span", name), element("strong", money(value), i === 2 ? value < 0 ? "practice-negative" : "practice-positive" : "")); metrics.append(card);
    });
    $("practice-account-note").textContent = `Capital inicial: ${money(current.initialCents)} · ${current.trades.length}/500 operaciones · ${analysis.sales} ventas simuladas. Los resultados corresponden a precios introducidos por ti; no son una valoración actual.`;
    const positions = $("practice-holdings"); positions.replaceChildren();
    if (!analysis.positions.length) positions.append(element("p", "No tienes posiciones abiertas. Registra una compra simulada para empezar.", "practice-hint"));
    analysis.positions.forEach(position => {
      const quantity = position.units / 1000000, asset = core.assets.find(asset => asset.symbol === position.symbol);
      const card = element("article", "", "practice-holding");
      card.append(element("h3", `${asset.name} · ${asset.symbol}`), element("p", `${decimal(quantity)} unidades · coste pendiente ${money(position.costCents)}.`), element("p", `Coste medio por unidad, con comisión: ${decimal(position.costCents / 100 / quantity)} ${current.currency}.`));
      const sell = element("button", `Preparar venta de ${asset.name}`); sell.type = "button";
      sell.addEventListener("click", () => {
        $("trade-side").value = "sell"; $("trade-symbol").value = asset.symbol; $("trade-quantity").value = quantity;
        $("trade-price").value = ""; $("trade-date").value = today(); $("trade-fee").value = "0"; $("trade-note").value = "";
        updateEstimate(); $("trade-price").focus();
        message(`Venta simulada de ${asset.name} preparada. Introduce el precio que quieres comprobar; puedes reducir las unidades para una venta parcial.`);
      });
      card.append(sell); positions.append(card);
    });
    const allocations = [{ name: "Saldo virtual", value: analysis.cashCents }, ...analysis.positions.map(position => ({ name: position.symbol, value: position.costCents }))];
    const colors = ["#77edd7", "#9d8bff", "#f58bd7", "#7ac6ff", "#f0b276", "#c8a5fb", "#b3ed82", "#eb9cb4", "#83d6d9", "#bbd3ff", "#c9b079"];
    let start = 0; const segments = [], allocationList = $("allocation-list"); allocationList.replaceChildren();
    allocations.forEach((allocation, i) => {
      const share = analysis.totalAtCostCents ? allocation.value / analysis.totalAtCostCents * 100 : 0;
      segments.push(`${colors[i]} ${start}% ${start + share}%`); start += share;
      const row = document.createElement("li"), name = element("span", "", "allocation-key"), dot = element("span", "", "allocation-dot"); dot.style.backgroundColor = colors[i];
      name.append(dot, document.createTextNode(allocation.name)); row.append(name, element("span", `${share.toLocaleString("es-ES", { maximumFractionDigits: 1 })} % · ${money(allocation.value)}`)); allocationList.append(row);
    });
    $("allocation-ring").style.background = analysis.totalAtCostCents ? `conic-gradient(${segments.join(",")})` : "#253854";
    renderJournal(analysis);
  }
  $("setup-form").addEventListener("submit", event => { event.preventDefault(); try { prepare(core.create($("setup-currency").value, Number($("setup-capital").value)), "Nueva cartera de práctica"); } catch (error) { message(error.message, true); } });
  $("pending-apply").addEventListener("click", () => { if (pending) commit(pending, "Cartera aplicada. Puedes recuperar el estado anterior."); });
  $("pending-cancel").addEventListener("click", () => { clearPending(); message("Tu cartera actual se conserva."); });
  $("trade-form").addEventListener("submit", event => {
    event.preventDefault(); if (!current) return;
    try {
      const next = core.addTrade(current, { id: crypto.randomUUID(), side: $("trade-side").value, symbol: $("trade-symbol").value, date: $("trade-date").value, quantity: Number($("trade-quantity").value), price: Number($("trade-price").value), fee: Number($("trade-fee").value), note: $("trade-note").value.trim() });
      if (commit(next, "Operación simulada registrada.")) {
        $("trade-quantity").value = ""; $("trade-price").value = ""; $("trade-note").value = ""; $("trade-fee").value = "0"; updateEstimate();
      }
    } catch (error) { message(error.message, true); }
  });
  ["trade-symbol", "trade-side", "trade-quantity", "trade-price", "trade-fee"].forEach(id => $(id).addEventListener("input", updateEstimate));
  ["journal-search", "journal-filter"].forEach(id => $(id).addEventListener("input", () => { if (current) renderJournal(core.replay(current)); }));
  $("practice-recover").addEventListener("click", () => { if (previous) commit(previous, "Estado anterior recuperado. Puedes volver al estado que acabas de dejar con el mismo botón."); });
  $("practice-export").addEventListener("click", () => {
    if (!current) return; let url;
    try {
      url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `momentumvelo-practica-${current.currency}-${today()}.json`;
      document.body.append(link); link.click(); link.remove(); message("Descarga solicitada. La copia incluye capital virtual, operaciones y notas.");
    } catch (_) { message("No se pudo descargar la copia. Vuelve a intentarlo antes de salir.", true); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 30000); }
  });
  $("practice-import").addEventListener("change", async () => {
    const generation = ++importGeneration, file = $("practice-import").files[0];
    pending = null; $("practice-pending").hidden = true;
    if (!file) return;
    if (file.size > 1000000) { message("La copia supera 1 MB. Elige un archivo más pequeño.", true); return; }
    try { const text = await file.text(); if (generation !== importGeneration) return; prepare(core.parseBackup(text), "Copia validada"); }
    catch (error) { if (generation === importGeneration) message(error.message, true); }
  });
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    try { const stored = localStorage.getItem(key), fresh = read(stored); current = fresh.current; previous = fresh.previous; baseline = stored; clearPending(); render(); message("Cartera actualizada desde otra pestaña. Revisa el formulario antes de registrar otra operación."); }
    catch (_) { message("No se pudo leer la actualización de otra pestaña. Conserva tu copia antes de seguir.", true); }
  });
  try {
    baseline = localStorage.getItem(key); const saved = read(baseline); current = saved.current; previous = saved.previous; render();
    if (current) message("Tu cartera de práctica está guardada en este navegador.");
  } catch (error) { render(); message(error.message || "Este navegador no permite guardar. Descarga una copia antes de salir.", true); }
})();
