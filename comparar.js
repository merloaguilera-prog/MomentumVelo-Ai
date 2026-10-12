(function () {
  "use strict";
  const $ = id => document.getElementById(id), core = window.MomentumCompare;
  const host = $("compare-result"), generation = { a: 0, b: 0 };
  let loaded = null;
  const percent = value => `${value > 0 ? "+" : ""}${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
  const number = value => value.toLocaleString("es-ES", { maximumSignificantDigits: 8 });
  const element = (tag, text, cls) => { const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node; };
  function svgElement(tag, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); if (text) node.textContent = text; return node;
  }
  function message(text, error = false) { $("compare-status").textContent = text; $("compare-status").classList.toggle("error", error); }
  function invalidate(text) { loaded = null; host.hidden = true; host.replaceChildren(); message(text || "Los datos han cambiado. Pulsa «Comparar mis históricos» para recalcular."); }
  function metadata(side) { return { asset: $(`compare-asset-${side}`).value, source: $(`compare-source-${side}`).value, currency: $(`compare-currency-${side}`).value, adjustment: $(`compare-adjustment-${side}`).value }; }
  function render() {
    host.replaceChildren();
    const title = element("h2", "El recorrido, en la misma escala"); title.id = "comparison-result-title";
    host.setAttribute("aria-labelledby", title.id);
    const source = element("p", `A: ${loaded.a.asset} · ${loaded.a.currency} · fuente declarada: ${loaded.a.source}. B: ${loaded.b.asset} · ${loaded.b.currency} · fuente declarada: ${loaded.b.source}.`, "practice-hint");
    const note = element("p", "Las dos líneas parten del 0 % en la primera fecha común del tramo. Solo se usan fechas presentes en ambos históricos: no interpolamos ni rellenamos huecos. La separación horizontal respeta los días del calendario; los puntos son cierres, no precios intradía.", "comparison-note");
    const extra = element("p", `${loaded.a.currency !== loaded.b.currency ? "Cada variación está medida en la moneda de su activo. No convertimos divisas ni calculamos el efecto del cambio. " : ""}${loaded.a.adjustment === "unknown" ? "El ajuste de los cierres no está declarado: confirma cómo trata tu proveedor los dividendos y desdoblamientos. " : ""}La comparación no incluye comisiones ni impuestos y no representa el rendimiento de una cartera ni predice el siguiente movimiento.`, "practice-hint");
    const label = element("label", "Ver tramo de la comparación"), period = document.createElement("select"); period.id = "comparison-period";
    [["all", "Todas las fechas comunes"], ["30", "Últimas 30 fechas comunes"], ["90", "Últimas 90 fechas comunes"], ["180", "Últimas 180 fechas comunes"]].forEach(([value, text]) => { const option = element("option", text); option.value = value; period.append(option); }); label.append(period);
    const controls = element("div", "", "practice-form"); controls.append(label);
    const metrics = element("div", "", "practice-metrics"), rangeNote = element("p", "", "practice-hint"), drawdowns = element("p", "", "practice-hint");
    const legend = element("div", "", "comparison-legend");
    [[loaded.a.asset, ""], [loaded.b.asset, "b"]].forEach(([name, cls]) => { const text = element("span"); const dot = element("i", "", `comparison-dot ${cls}`); dot.setAttribute("aria-hidden", "true"); text.append(dot, document.createTextNode(`${cls ? "B" : "A"}: ${name}`)); legend.append(text); });
    const plot = element("div", "", "review-plot"), graph = svgElement("svg", { viewBox: "0 0 1000 300", preserveAspectRatio: "none", role: "img", "aria-labelledby": "comparison-svg-title comparison-svg-desc" });
    const graphTitle = svgElement("title", { id: "comparison-svg-title" }, "Comparación porcentual de dos históricos importados"), desc = svgElement("desc", { id: "comparison-svg-desc" });
    const high = element("span", "", "review-scale high"), low = element("span", "", "review-scale low"); high.setAttribute("aria-hidden", "true"); low.setAttribute("aria-hidden", "true"); plot.append(graph, high, low);
    const dates = element("div", "", "review-labels"); dates.setAttribute("aria-hidden", "true");
    const cursorLabel = element("label", "Desliza para comparar una fecha", "review-cursor-label"), cursor = document.createElement("input"); cursor.id = "comparison-cursor"; cursor.type = "range"; cursor.min = "0"; cursor.step = "1"; cursor.className = "comparison-cursor"; cursorLabel.htmlFor = cursor.id;
    const selected = element("p", "", "review-selected comparison-selected"); selected.id = "comparison-selected"; cursor.setAttribute("aria-describedby", selected.id);
    const navigation = element("div", "", "practice-actions"), previous = element("button", "← Fecha anterior"), next = element("button", "Fecha siguiente →"); previous.type = next.type = "button"; navigation.append(previous, next);
    const details = document.createElement("details"); details.className = "review-table-details"; const toggle = element("summary", "Ver las fechas comunes en una tabla"), wrap = element("div", "", "review-table-wrap"), table = document.createElement("table"); wrap.append(table); details.append(toggle, wrap);
    const downloadBox = element("div", "", "practice-actions"), download = element("button", "Descargar este tramo CSV"); download.type = "button"; downloadBox.append(download);
    const downloadStatus = element("p", "Exporta las fechas comunes del tramo visible, los cierres A/B y sus variaciones desde la primera fecha de ese tramo. Usa coma como separador y punto decimal; no incluye nombres ni fuentes. Es un informe comparativo, no un CSV para el detector.", "practice-hint"); downloadStatus.setAttribute("role", "status");
    const count = () => period.value === "all" ? "all" : Number(period.value);
    let view, markerA, markerB, guide;
    function select() {
      const i = Number(cursor.value), row = view.rows[i], point = view.points[i];
      selected.textContent = `${row.date} · A (${loaded.a.asset}): ${number(row.closeA)} ${loaded.a.currency}, ${percent(row.changeA)} · B (${loaded.b.asset}): ${number(row.closeB)} ${loaded.b.currency}, ${percent(row.changeB)}. Variaciones desde ${view.rows[0].date}.`;
      cursor.setAttribute("aria-valuetext", `${row.date}, A ${percent(row.changeA)}, B ${percent(row.changeB)}`);
      markerA.setAttribute("cx", point.x); markerA.setAttribute("cy", point.yA); markerB.setAttribute("cx", point.x); markerB.setAttribute("cy", point.yB); guide.setAttribute("x1", point.x); guide.setAttribute("x2", point.x);
      previous.disabled = i === 0; next.disabled = i === view.rows.length - 1;
    }
    function renderChart() {
      view = core.compare(loaded.a, loaded.b, count()); const first = view.rows[0], last = view.rows.at(-1);
      metrics.replaceChildren();
      [[`A: ${loaded.a.asset}`, percent(view.changeA)], [`B: ${loaded.b.asset}`, percent(view.changeB)], ["Diferencia A − B (puntos porcentuales)", view.difference.toLocaleString("es-ES", { maximumFractionDigits: 2 })], ["Fechas comunes en el tramo", view.rows.length]].forEach(([name, value]) => { const card = document.createElement("article"); card.append(element("span", name), element("strong", value)); metrics.append(card); });
      rangeNote.textContent = `${first.date} → ${last.date}. ${view.commonCount} fechas comunes en los archivos completos; ${view.omittedA} ${view.omittedA === 1 ? "fecha" : "fechas"} de A y ${view.omittedB} de B quedan fuera por no tener pareja. Al cambiar el tramo, el 0 % se recalcula en su primera fecha. La escala vertical se ajusta al tramo.`;
      const drop = (name, item) => `${name}: ${percent(item.percent)}${item.percent < 0 ? `, desde ${item.peakDate} hasta ${item.date}` : ", sin caída desde máximos en estas fechas"}`;
      drawdowns.textContent = `Mayor caída desde un máximo entre las fechas comunes del tramo · ${drop("A", view.drawdownA)} · ${drop("B", view.drawdownB)}. Los días excluidos podrían contener otros máximos o caídas.`;
      desc.textContent = `${source.textContent} ${rangeNote.textContent} A termina en ${percent(view.changeA)} y B en ${percent(view.changeB)}. Consulta cada fecha con el control o la tabla.`;
      graph.replaceChildren(graphTitle, desc);
      [40, 140, 240].forEach(y => graph.append(svgElement("line", { x1: 70, x2: 950, y1: y, y2: y, class: "review-grid" })));
      if (view.high !== view.low) { const y = 240 - (0 - view.low) / (view.high - view.low) * 200; graph.append(svgElement("line", { x1: 70, x2: 950, y1: y, y2: y, class: "review-guide" })); }
      high.textContent = percent(view.high); high.classList.toggle("flat", view.high === view.low); low.textContent = percent(view.low); low.hidden = view.high === view.low;
      guide = svgElement("line", { y1: 40, y2: 240, class: "review-guide" });
      markerA = svgElement("circle", { r: 6, fill: "#88ffdf", stroke: "#142037", "stroke-width": 2 }); markerB = svgElement("circle", { r: 6, fill: "#ff9ee6", stroke: "#142037", "stroke-width": 2 });
      graph.append(svgElement("path", { d: view.pathA, class: "review-line comparison-line-a" }), svgElement("path", { d: view.pathB, class: "review-line comparison-line-b" }), guide, markerA, markerB);
      dates.replaceChildren(element("span", first.date), element("span", last.date)); cursor.max = view.rows.length - 1; cursor.value = cursor.max;
      table.replaceChildren(element("caption", "Cierres y variaciones de las fechas comunes del tramo visible")); const head = document.createElement("thead"), header = document.createElement("tr");
      ["Fecha", `A · cierre (${loaded.a.currency})`, "A · variación", `B · cierre (${loaded.b.currency})`, "B · variación"].forEach(text => { const th = element("th", text); th.scope = "col"; header.append(th); }); head.append(header);
      const body = document.createElement("tbody"); view.rows.forEach(row => { const tr = document.createElement("tr"); [row.date, number(row.closeA), percent(row.changeA), number(row.closeB), percent(row.changeB)].forEach(text => tr.append(element("td", text))); body.append(tr); }); table.append(head, body); select();
    }
    download.addEventListener("click", () => {
      let url;
      try { url = URL.createObjectURL(new Blob([core.toCSV(loaded.a, loaded.b, count())], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `momentumvelo-comparacion-${view.rows[0].date}-${view.rows.at(-1).date}.csv`; host.append(link); link.click(); link.remove(); downloadStatus.textContent = `Descarga solicitada: ${view.rows.length} fechas comunes del tramo visible, con A/B y sus variaciones. Conserva los archivos originales para volver a comparar.`; }
      catch (_) { downloadStatus.textContent = "No se pudo descargar. Conserva tus archivos originales y vuelve a intentarlo."; }
      finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 30000); }
    });
    period.addEventListener("change", renderChart); cursor.addEventListener("input", select);
    previous.addEventListener("click", () => { cursor.value = Math.max(0, Number(cursor.value) - 1); select(); }); next.addEventListener("click", () => { cursor.value = Math.min(view.rows.length - 1, Number(cursor.value) + 1); select(); });
    host.append(title, source, note, extra, controls, metrics, rangeNote, drawdowns, legend, plot, dates, cursorLabel, cursor, selected, navigation, details, downloadBox, downloadStatus);
    renderChart(); host.hidden = false;
  }
  $("compare-form").addEventListener("submit", event => {
    event.preventDefault(); host.hidden = true;
    try {
      const a = core.parse($("compare-csv-a").value, metadata("a")), b = core.parse($("compare-csv-b").value, metadata("b"));
      core.compare(a, b); loaded = { a, b }; render(); message("Comparación calculada sobre tus archivos. Los datos se conservan solo durante esta visita."); $("comparison-period").focus();
    } catch (error) { loaded = null; host.replaceChildren(); message(error.message, true); }
  });
  ["a", "b"].forEach(side => {
    ["asset", "source", "currency", "adjustment", "csv"].forEach(field => $(`compare-${field}-${side}`).addEventListener("input", () => { generation[side]++; invalidate(); }));
    $(`compare-file-${side}`).addEventListener("change", async () => {
      const token = ++generation[side], file = $(`compare-file-${side}`).files[0]; $(`compare-csv-${side}`).value = ""; invalidate(`Cargando el archivo ${side.toUpperCase()}…`);
      if (!file) { message("Sin archivo seleccionado. Puedes pegar el CSV."); return; }
      if (file.size > 256000) { message("El archivo supera 256 KB.", true); return; }
      try { const text = await file.text(); if (token !== generation[side]) return; $(`compare-csv-${side}`).value = text; message(`Archivo ${side.toUpperCase()} cargado. Completa su activo y fuente y pulsa «Comparar mis históricos».`); }
      catch (_) { if (token === generation[side]) message("No se pudo leer el archivo. Reintenta o pega el CSV.", true); }
    });
  });
  $("compare-clear").addEventListener("click", () => { generation.a++; generation.b++; $("compare-form").reset(); invalidate("Comparador vacío. Puedes cargar dos nuevos históricos."); });
  if (new URL(window.location.href).searchParams.get("desde") === "detector") {
    try {
      const text = sessionStorage.getItem("momentumvelo.compare.transfer.v1");
      if (!text || text.length > 512000) throw new Error("No hay un histórico preparado. Carga el CSV A aquí.");
      const a = core.validate({ ...JSON.parse(text), adjustment: "unknown" });
      const csv = window.MomentumHistory.toCSV(a.rows);
      if (csv.length > 256000) throw new Error("El histórico preparado supera el tamaño admitido. Carga un CSV A más pequeño.");
      $("compare-asset-a").value = a.asset; $("compare-source-a").value = a.source; $("compare-currency-a").value = a.currency; $("compare-csv-a").value = csv;
      sessionStorage.removeItem("momentumvelo.compare.transfer.v1"); message("Tu histórico del detector está preparado como A. Comprueba el tipo de cierre y añade el histórico B.");
    } catch (error) { message(error.message || "No se pudo recuperar el histórico del detector. Puedes cargarlo aquí.", true); }
  }
})();
