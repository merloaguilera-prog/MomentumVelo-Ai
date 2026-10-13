(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const settingsKey = "momentumvelo.detector.rules.v1";
  const form = $("detector-form"), result = $("detector-result"), status = $("detector-status");
  let loaded = null, fileGeneration = 0;
  const percent = n => `${n > 0 ? "+" : ""}${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
  const number = n => n === null ? "Sin datos suficientes" : n.toLocaleString("es-ES", { maximumFractionDigits: 4 });
  const rules = () => ({ move: Number($("detector-move").value), drawdown: Number($("detector-drawdown").value), lookback: Number($("detector-lookback").value), confirmation: Number($("detector-confirmation").value), requireVolume: $("detector-volume").checked });
  const element = (tag, text, className) => {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className; return node;
  };
  function message(text, error = false) { status.textContent = text; status.classList.toggle("error", error); }
  function invalidate(text = "Los datos han cambiado. Pulsa «Analizar mis datos» para calcular el resultado.") {
    loaded = null; result.hidden = true; result.replaceChildren(); message(text);
  }
  function renderAnalysis() {
    result.hidden = true; result.replaceChildren();
    try {
      const settings = rules(), analysis = window.MomentumDetector.analyze(loaded.rows, settings);
      const title = element("h3", `${loaded.asset} · histórico hasta ${analysis.date}`);
      const origin = element("p", `Fuente declarada: ${loaded.source}. ${analysis.count} cierres diarios. Moneda: ${loaded.currency}.`, "workspace-hint");
      const today = new Date().toISOString().slice(0, 10);
      const dateNote = element("p", analysis.date === today
        ? "El archivo incluye la fecha de hoy: confirma que el último dato es un cierre diario completo. Este análisis no es una cotización en directo."
        : "Resultado histórico: describe la última fecha del archivo, no el precio actual. No se actualiza solo.", "detector-date-note");
      const cards = element("div", "", "detector-metrics");
      const metrics = [
        ["Último cierre", `${number(analysis.close)} ${loaded.currency}`],
        ["Cambio entre los 2 últimos cierres", percent(analysis.change)],
        [`Desde el mayor cierre de ${analysis.peakCount} datos`, percent(analysis.peakDrop)],
        ["Media de los últimos 20 cierres", analysis.sma20 === null ? "Necesita 20 cierres" : `${number(analysis.sma20)} ${loaded.currency}`],
        ["Volumen / media de 20 cierres previos", analysis.volumeRatio === null ? "Sin 20 volúmenes previos válidos" : `${number(analysis.volumeRatio)} veces`]
      ];
      metrics.forEach(([label, value]) => { const card = element("div", "", "detector-metric"); card.append(element("span", label), element("strong", value)); cards.append(card); });
      const signals = element("div", "", "detector-signals");
      if (settings.requireVolume && !analysis.volumePass) signals.append(element("p", analysis.volumeRatio === null
        ? "Reglas sin confirmar: faltan volúmenes suficientes para aplicar el filtro."
        : "Reglas sin confirmar: el volumen no alcanza 1,5 veces la media de los 20 cierres anteriores.", "detector-signal neutral"));
      else if (!analysis.signals.length) signals.append(element("p", "Ninguna de tus reglas se cumple en el último cierre. Esto no indica ausencia de riesgo.", "detector-signal neutral"));
      analysis.signals.forEach(signal => {
        const card = element("div", "", `detector-signal ${signal.kind}`);
        card.append(element("strong", signal.title), element("p", signal.detail)); signals.append(card);
      });
      if (analysis.peakCount < settings.lookback) signals.append(element("p", `La regla desde máximos necesita ${settings.lookback} cierres; el archivo aporta ${analysis.peakCount}.`, "workspace-hint"));
      if (analysis.count < settings.confirmation + 1) signals.append(element("p", `La confirmación elegida necesita al menos ${settings.confirmation + 1} cierres.`, "workspace-hint"));
      if (analysis.crossing) signals.append(element("p", `Dato adicional: el último cierre cruza ${analysis.crossing === "up" ? "por encima" : "por debajo"} de su media de 20 cierres. Es un cruce observado, no una predicción.`, "workspace-hint"));
      const history = document.createElement("details");
      history.append(element("summary", `Cambios que alcanzan tu umbral en los últimos 30 cambios (${analysis.history.length})`));
      history.append(element("p", "Esta lista muestra cambios individuales entre cierres; no aplica la confirmación consecutiva ni el filtro de volumen. No representa alertas enviadas.", "workspace-hint"));
      const list = document.createElement("ul"); list.className = "detector-history";
      analysis.history.slice().reverse().forEach(row => list.append(element("li", `${row.date} · ${percent(row.percent)}`)));
      if (!analysis.history.length) list.append(element("li", "Ningún cambio individual alcanza el umbral en este tramo."));
      history.append(list);
      const chart = window.MomentumHistoryChart(loaded);
      const compare = element("a", "Comparar este histórico con otro ↗"); compare.href = "/comparar?desde=detector";
      compare.addEventListener("click", event => {
        try { sessionStorage.setItem("momentumvelo.compare.transfer.v1", JSON.stringify(loaded)); }
        catch (_) { event.preventDefault(); message("No se pudo preparar el histórico en esta pestaña. Abre Comparar históricos y carga allí tu CSV.", true); }
      });
      const comparisonActions = element("div", "", "market-controls"); comparisonActions.append(compare);
      const catalog = Array.from($("market-symbol").options);
      const key = loaded.asset.trim().toUpperCase();
      const matches = catalog.filter(option => option.value.toUpperCase() === key || option.value.split(":")[1].toUpperCase() === key || option.textContent.split(" · ")[0].toUpperCase() === key);
      if (matches.length === 1) {
        const openQuote = element("a", "Consultar cotización y gráfico actuales ↗");
        openQuote.href = `/mercados?activo=${encodeURIComponent(matches[0].value)}#cotizacion`;
        comparisonActions.append(openQuote);
      }
      const practice = element("a", "Probar mi decisión con capital virtual ↗"); practice.href = "/practica";
      comparisonActions.append(practice);

      result.append(title, origin, dateNote, cards, signals, chart, history, comparisonActions); result.hidden = false;
      let saved = true;
      try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch (_) { saved = false; }
      message(saved ? "Análisis calculado. Reglas guardadas en este navegador; histórico solo durante esta visita." : "Análisis calculado. El navegador no permite guardar las reglas: se perderán al salir.");
    } catch (error) { message(error.message, true); }
  }
  form.addEventListener("submit", event => {
    event.preventDefault(); result.hidden = true;
    try {
      const parsed = window.MomentumDetector.parseCSV($("detector-csv").value);
      const asset = $("detector-asset").value.trim(), source = $("detector-source").value.trim();
      if (!asset || !source) throw new Error("Indica el activo y la fuente de los datos.");
      if (parsed.symbol && parsed.symbol !== asset.toUpperCase()) throw new Error(`El símbolo del archivo es ${parsed.symbol}. Usa ese mismo símbolo como activo.`);
      loaded = { rows: parsed.rows, asset, source, currency: $("detector-currency").value };
      renderAnalysis();
    } catch (error) { loaded = null; result.replaceChildren(); message(error.message, true); }
  });
  ["detector-csv", "detector-asset", "detector-source", "detector-currency"].forEach(id => $(id).addEventListener("input", () => { fileGeneration++; invalidate(); }));
  ["detector-move", "detector-drawdown", "detector-lookback", "detector-confirmation", "detector-volume"].forEach(id => $(id).addEventListener("input", () => {
    if (loaded) renderAnalysis(); else { result.hidden = true; message("Reglas cambiadas. Carga un histórico para analizarlas."); }
  }));
  document.querySelectorAll("[data-detector-preset]").forEach(button => button.addEventListener("click", () => {
    const filtered = button.dataset.detectorPreset === "filtered";
    $("detector-move").value = filtered ? "3" : "2";
    $("detector-drawdown").value = filtered ? "8" : "5";
    $("detector-lookback").value = "20"; $("detector-confirmation").value = filtered ? "2" : "1";
    if (loaded) renderAnalysis(); else message("Ajuste aplicado. Carga tus cierres diarios para calcular el resultado.");
  }));
  $("detector-file").addEventListener("change", async () => {
    const current = ++fileGeneration, file = $("detector-file").files[0];
    $("detector-csv").value = ""; invalidate("Cargando archivo…");
    if (!file) { invalidate("Sin archivo seleccionado."); return; }
    if (file.size > 256000) { message("El archivo supera 256 KB. Elige uno más pequeño.", true); return; }
    try {
      const text = await file.text(); if (current !== fileGeneration) return;
      $("detector-csv").value = text; message(`Archivo «${file.name}» cargado. Indica el activo y la fuente y pulsa «Analizar mis datos».`);
    } catch (_) { if (current === fileGeneration) message("No se pudo leer el archivo. Reintenta o pega el CSV.", true); }
  });
  $("detector-clear").addEventListener("click", () => { fileGeneration++; $("detector-csv").value = ""; $("detector-file").value = ""; $("detector-asset").value = ""; $("detector-source").value = ""; invalidate("Datos y resultado borrados. Las reglas se conservan."); });
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || "null");
    if (saved) {
      window.MomentumDetector.analyze([{ date: "2020-01-01", close: 1, volume: null }, { date: "2020-01-02", close: 1, volume: null }], saved);
      $("detector-move").value = saved.move; $("detector-drawdown").value = saved.drawdown;
      $("detector-lookback").value = saved.lookback; $("detector-confirmation").value = saved.confirmation;
      $("detector-volume").checked = saved.requireVolume === true;
    }
  } catch (_) { /* Invalid settings are ignored; defaults remain visible. */ }

  function mountWidget(id, statusId, scriptName, config, href, label) {
    const host = $(id), state = $(statusId);
    const generation = String(Number(host.dataset.generation || 0) + 1); host.dataset.generation = generation;
    if (host.widgetTimer) clearTimeout(host.widgetTimer);
    host.hidden = false; state.classList.remove("error"); state.textContent = "Cargando el proveedor…";
    const container = element("div", "", "tradingview-widget-container");
    const widget = element("div", "", "tradingview-widget-container__widget");
    const copyright = element("div", "", "tradingview-widget-copyright"), link = element("a", label);
    link.href = href; link.target = "_blank"; link.rel = "noopener nofollow"; copyright.append(link);
    container.append(widget, copyright); host.replaceChildren(container);
    const script = document.createElement("script"); script.src = `https://s3.tradingview.com/external-embedding/${scriptName}.js`;
    script.async = true; script.textContent = JSON.stringify(config);
    script.addEventListener("load", () => {
      if (host.dataset.generation !== generation) return;
      state.textContent = "Consulta los datos y las indicaciones de retraso del proveedor. Si no aparecen, reintenta o abre la fuente.";
    });
    script.addEventListener("error", () => {
      if (host.dataset.generation !== generation) return;
      state.classList.add("error"); state.textContent = "No se pudo cargar el proveedor. Reintenta o abre el enlace a la fuente.";
    });
    host.widgetTimer = setTimeout(() => {
      if (host.dataset.generation !== generation || host.querySelector("iframe")) return;
      state.classList.add("error"); state.textContent = "El panel no está disponible. Reintenta o abre la fuente; no hay datos confirmados aquí.";
    }, 12000);
    container.append(script);
  }
  $("movers-load").addEventListener("click", () => {
    $("movers-load").textContent = "Reintentar subidas y caídas";
    mountWidget("movers-widget", "movers-status", "embed-widget-hotlists", {
      colorTheme: "dark", dateRange: "1D", exchange: "US", showChart: false,
      locale: "es", width: "100%", height: "100%", isTransparent: false, showSymbolLogo: true, showFloatingTooltip: true
    }, "https://www.tradingview.com/markets/stocks-usa/", "Movimientos de bolsa por TradingView");
  });
  function loadHeatmap() {
    mountWidget("heatmap-widget", "heatmap-status", "embed-widget-stock-heatmap", {
      dataSource: "SPX500", blockSize: "market_cap_basic", blockColor: "change", grouping: "sector",
      locale: "es", symbolUrl: "", colorTheme: "dark", exchanges: [], hasTopBar: true,
      isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, width: "100%", height: "100%"
    }, "https://www.tradingview.com/heatmap/stock/", "Mapa de acciones por TradingView");
  }
  $("heatmap-load").addEventListener("click", loadHeatmap);
  $("mapa").addEventListener("toggle", () => { if ($("mapa").open && !$("heatmap-widget").dataset.generation) loadHeatmap(); });
})();
