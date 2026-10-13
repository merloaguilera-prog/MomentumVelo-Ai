(function () {
  "use strict";
  const selector = document.querySelector("#market-symbol");
  const chart = document.querySelector("#market-chart");
  const status = document.querySelector("#market-status");
  const source = document.querySelector("#market-source");
  const options = Array.from(selector.options);
  const workspaceKey = "momentumvelo.markets.workspace.v1";
  const favorites = document.querySelector("#market-favorites");
  const favoriteButton = document.querySelector("#market-favorite");
  const note = document.querySelector("#market-note");
  const workspaceStatus = document.querySelector("#workspace-status");
  const workspaceCore = window.MomentumWorkspace;
  const assets = options.map(option => ({ symbol: option.value, label: option.textContent }));
  const knownSymbols = assets.map(a => a.symbol);
  const searchFavorites = document.querySelector("#favorites-search");
  const orderFavorites = document.querySelector("#favorites-order");
  const notesOnly = document.querySelector("#favorites-notes-only");
  const transferStatus = document.querySelector("#workspace-transfer-status");
  const backupText = document.querySelector("#workspace-json");
  const importButton = document.querySelector("#workspace-import");
  let pendingBackup = null;
  let fileGeneration = 0;
  let workspace = { version: 1, favorites: [], notes: {} };
  let storageFailed = false;
  let generation = 0;
  let timer;

  function readWorkspace() {
    const data = JSON.parse(window.localStorage.getItem(workspaceKey) || "null");
    if (!data || data.version !== 1) return { version: 1, favorites: [], notes: {} };
    const known = value => options.some(option => option.value === value);
    const saved = Array.isArray(data.favorites) ? [...new Set(data.favorites.filter(known))] : [];
    const notes = {};
    if (data.notes && typeof data.notes === "object") {
      options.forEach(option => {
        const text = data.notes[option.value];
        if (typeof text === "string") notes[option.value] = text.slice(0, 2000);
      });
    }
    return { version: 1, favorites: saved, notes };
  }

  function storageError() {
    storageFailed = true;
    workspaceStatus.classList.add("error");
    workspaceStatus.textContent = "Este navegador no permite guardar ahora. Los cambios quedan solo durante esta visita; copia tu nota antes de salir.";
  }

  function saveWorkspace(change) {
    let next = workspace;
    if (!storageFailed) {
      try { next = readWorkspace(); } catch (_) { /* Preserve this visit's state when storage is blocked. */ }
    }
    change(next);
    workspace = next;
    try {
      window.localStorage.setItem(workspaceKey, JSON.stringify(workspace));
      storageFailed = false;
      workspaceStatus.classList.remove("error");
      workspaceStatus.textContent = "Cambios guardados en este navegador.";
    } catch (_) { storageError(); }
  }

  function renderWorkspace(loadNote) {
    const current = selector.value;
    const saved = workspace.favorites.includes(current);
    favoriteButton.textContent = saved ? "★ Quitar favorito" : "☆ Guardar favorito";
    favoriteButton.setAttribute("aria-pressed", String(saved));
    document.querySelector("#market-favorite-count").textContent = `${workspace.favorites.length} favoritos`;
    document.querySelector("#market-favorites-empty").hidden = workspace.favorites.length > 0;
    favorites.replaceChildren();
    const visible = workspaceCore.filterFavorites(workspace, assets, searchFavorites.value, notesOnly.checked, orderFavorites.value);
    document.querySelector("#favorites-results").textContent = workspace.favorites.length
      ? `${visible.length} de ${workspace.favorites.length} favoritos${visible.length ? "" : ": cambia la búsqueda o el filtro para verlos"}.`
      : "";
    visible.forEach(({ symbol }) => {
      const option = options.find(item => item.value === symbol);
      const row = document.createElement("li");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "favorite-open";
      open.textContent = option.textContent;
      open.setAttribute("aria-label", `Ver ${option.textContent}`);
      open.setAttribute("aria-pressed", String(symbol === current));
      open.addEventListener("click", () => { selector.value = symbol; render(); });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "favorite-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Quitar ${option.textContent} de favoritos`);
      remove.addEventListener("click", () => {
        saveWorkspace(state => { state.favorites = state.favorites.filter(item => item !== symbol); });
        renderWorkspace(false);
      });
      row.append(open, remove);
      if ((workspace.notes[symbol] || "").trim()) {
        const badge = document.createElement("span");
        badge.className = "favorite-note-badge";
        badge.textContent = "✎ Nota";
        row.insertBefore(badge, remove);
      }
      favorites.appendChild(row);
    });
    document.querySelector("#market-note-name").textContent = options.find(item => item.value === current).textContent.split(" · ")[0];
    if (loadNote) note.value = workspace.notes[current] || "";
    const notesList = document.querySelector("#workspace-all-notes");
    const savedNotes = workspaceCore.listNotes(workspace, assets);
    notesList.replaceChildren();
    document.querySelector("#workspace-notes-empty").hidden = savedNotes.length > 0;
    savedNotes.forEach(item => {
      const row = document.createElement("li");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "favorite-open saved-note-open";
      open.setAttribute("aria-label", `Abrir nota de ${item.label}`);
      const label = document.createElement("strong");
      label.textContent = item.label;
      const preview = document.createElement("span");
      preview.textContent = item.text.slice(0, 120) + (item.text.length > 120 ? "…" : "");
      open.append(label, preview);
      open.addEventListener("click", () => { selector.value = item.symbol; render(); note.focus(); });
      row.appendChild(open);
      notesList.appendChild(row);
    });
  }

  function render() {
    const option = options.find(item => item.value === selector.value) || options[0];
    selector.value = option.value;
    renderWorkspace(true);
    const name = option.textContent.split(" · ")[0];
    const current = ++generation;
    window.clearTimeout(timer);
    status.classList.remove("error");
    status.textContent = "Cargando el gráfico del proveedor…";
    document.querySelector("#quote-title").textContent = option.textContent;
    document.querySelector("#market-timing").textContent = option.dataset.timing === "delayed"
      ? "Acción · cotización con retraso. El estado del mercado y la moneda aparecen en el gráfico."
      : "Datos de la fuente seleccionada · consulta el estado y el periodo del dato en el gráfico.";
    source.href = `https://www.tradingview.com/symbols/${option.value.replace(":", "-")}/`;
    source.textContent = `consulta ${name} en TradingView ↗`;

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright";
    const attribution = document.createElement("a");
    attribution.href = source.href;
    attribution.target = "_blank";
    attribution.rel = "noopener nofollow";
    attribution.textContent = `${name} por TradingView`;
    copyright.appendChild(attribution);
    container.append(widget, copyright);
    chart.replaceChildren(container);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: [[name, `${option.value}|12M`]],
      chartOnly: false, width: "100%", height: "100%", autosize: true,
      locale: "es", colorTheme: "dark", isTransparent: false,
      showVolume: true, hideDateRanges: false, hideMarketStatus: false,
      hideSymbolLogo: false, scalePosition: "right", scaleMode: "Normal",
      fontFamily: "Arial, sans-serif", fontSize: "12", noTimeScale: false,
      valuesTracking: "3", changeMode: "price-and-percent", chartType: "area",
      lineWidth: 2, lineType: 0,
      dateRanges: ["1d|1", "1m|30", "6m|120", "12m|1D", "60m|1W", "all|1M"]
    });
    script.addEventListener("load", () => {
      if (current !== generation) return;
      status.textContent = "Consulta el precio, el estado del mercado y el periodo del dato en el gráfico. Si no aparece, puedes reintentar o abrir la fuente.";
    });
    script.addEventListener("error", () => {
      if (current !== generation) return;
      status.classList.add("error");
      status.textContent = "No se ha podido cargar el proveedor. Reintenta el gráfico o consulta el enlace a TradingView.";
    });
    timer = window.setTimeout(() => {
      if (current !== generation || chart.querySelector("iframe")) return;
      status.classList.add("error");
      status.textContent = "El gráfico no está disponible. Reintenta o abre la fuente; no hay una cotización confirmada aquí.";
    }, 12000);
    container.appendChild(script);
  }

  const requestedSymbol = new URLSearchParams(window.location.search).get("activo");
  if (options.some(option => option.value === requestedSymbol)) selector.value = requestedSymbol;
  selector.addEventListener("change", render);
  document.querySelector("#market-retry").addEventListener("click", render);
  favoriteButton.addEventListener("click", () => {
    saveWorkspace(state => {
      state.favorites = state.favorites.includes(selector.value)
        ? state.favorites.filter(symbol => symbol !== selector.value)
        : [...state.favorites, selector.value];
    });
    renderWorkspace(false);
  });
  note.addEventListener("input", () => {
    saveWorkspace(state => {
      if (note.value) state.notes[selector.value] = note.value.slice(0, 2000);
      else delete state.notes[selector.value];
    });
    renderWorkspace(false);
  });
  [searchFavorites, orderFavorites, notesOnly].forEach(control => {
    control.addEventListener(control === searchFavorites ? "input" : "change", () => renderWorkspace(false));
  });
  function resetPreview() {
    pendingBackup = null;
    importButton.hidden = true;
    transferStatus.classList.remove("error");
    transferStatus.textContent = "Pulsa Revisar copia antes de importar. Tus datos actuales se conservan.";
  }
  backupText.addEventListener("input", () => { fileGeneration++; resetPreview(); });
  document.querySelector("#workspace-file").addEventListener("change", async event => {
    const token = ++fileGeneration;
    resetPreview();
    backupText.value = "";
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > workspaceCore.MAX_BYTES) throw new Error("La copia supera el límite de 256 KB.");
      const text = await file.text();
      if (token !== fileGeneration) return;
      backupText.value = text;
      transferStatus.textContent = "Copia cargada. Pulsa Revisar copia; todavía no se ha importado nada.";
    } catch (error) {
      if (token !== fileGeneration) return;
      transferStatus.classList.add("error");
      transferStatus.textContent = error.message || "No se pudo leer la copia.";
    }
  });
  document.querySelector("#workspace-preview").addEventListener("click", () => {
    resetPreview();
    try {
      pendingBackup = workspaceCore.parseBackup(backupText.value, knownSymbols);
      const preview = workspaceCore.mergeBackup(workspace, pendingBackup);
      transferStatus.textContent = `Se añadirían ${preview.addedFavorites} favoritos y ${preview.addedNotes} notas. ${preview.conflicts} notas distintas conservarán la versión que ya tienes. No se borra ningún dato.`;
      importButton.hidden = false;
    } catch (error) {
      transferStatus.classList.add("error");
      transferStatus.textContent = error.message;
    }
  });
  importButton.addEventListener("click", () => {
    if (!pendingBackup) return;
    let result;
    saveWorkspace(state => {
      result = workspaceCore.mergeBackup(state, pendingBackup);
      state.favorites = result.state.favorites;
      state.notes = result.state.notes;
    });
    renderWorkspace(true);
    pendingBackup = null;
    importButton.hidden = true;
    transferStatus.textContent = `Añadidos ${result.addedFavorites} favoritos y ${result.addedNotes} notas. ${result.conflicts} notas distintas se han conservado sin sobrescribir.${storageFailed ? " El navegador no ha podido guardarlos; descarga una copia antes de salir." : ""}`;
  });
  document.querySelector("#workspace-export").addEventListener("click", () => {
    try {
      const body = workspaceCore.serializeBackup(workspace, knownSymbols);
      const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `momentumvelo-favoritos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      transferStatus.classList.remove("error");
      transferStatus.textContent = "Copia preparada para descargar. Comprueba que el archivo se ha guardado en tu dispositivo.";
    } catch (_) {
      transferStatus.classList.add("error");
      transferStatus.textContent = "No se pudo preparar la descarga. Tus favoritos y notas siguen en esta página.";
    }
  });
  window.addEventListener("storage", event => {
    if (event.key !== workspaceKey && event.key !== null) return;
    try { workspace = readWorkspace(); renderWorkspace(true); } catch (_) { storageError(); }
  });
  try { workspace = readWorkspace(); } catch (_) { storageError(); }
  render();
})();
