(function () {
  "use strict";
  const core = window.MomentumPracticeReview, svgNS = "http://www.w3.org/2000/svg";
  const element = (tag, text, cls) => { const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node; };
  function svgElement(tag, attrs, text) {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    if (text) node.textContent = text; return node;
  }
  window.renderPracticeReview = function (host, state) {
    const previousPeriod = host.querySelector("#review-period")?.value || "all";
    const previousMetric = host.querySelector("#review-metric")?.value || "totalAtCostCents";
    const tableWasOpen = host.querySelector("details")?.open || false;
    const data = core.review(state);
    const money = value => (value / 100).toLocaleString("es-ES", { style: "currency", currency: state.currency });
    host.replaceChildren();
    const metrics = element("div", "", "practice-review-metrics");
    [["Ventas con resultado positivo", data.positiveSales], ["Ventas con resultado negativo", data.negativeSales], ["Ventas sin ganancia ni pérdida", data.flatSales], ["Resultado acumulado", money(data.realizedCents)]].forEach(([name, value]) => {
      const card = element("article"); card.append(element("span", name), element("strong", value)); metrics.append(card);
    });
    const outcome = element("p", `${data.sales} ventas simuladas registradas · suma de resultados positivos: ${money(data.gainsCents)} · suma de resultados negativos: ${money(data.lossesCents)}.`, "practice-hint");
    const scope = element("p", "Se cuentan ventas, incluidas las parciales; no son estrategias completas. Las comisiones de compra y venta ya forman parte del resultado. Las posiciones abiertas siguen a su coste, sin ganancias o pérdidas de mercado calculadas.", "practice-hint");
    const controls = element("div", "", "practice-form review-controls");
    const periodLabel = element("label", "Ver recorrido"), period = document.createElement("select"); period.id = "review-period";
    [["all", "Todas las operaciones"], ["30", "Últimas 30 operaciones"], ["90", "Últimas 90 operaciones"]].forEach(([value, name]) => { const option = element("option", name); option.value = value; period.append(option); });
    period.value = previousPeriod; periodLabel.append(period);
    const metricLabel = element("label", "Medida del gráfico"), metric = document.createElement("select"); metric.id = "review-metric";
    [["totalAtCostCents", "Total al coste"], ["cashCents", "Saldo virtual disponible"]].forEach(([value, name]) => { const option = element("option", name); option.value = value; metric.append(option); });
    metric.value = previousMetric; metricLabel.append(metric); controls.append(periodLabel, metricLabel);
    const rangeNote = element("p", "", "practice-hint");
    const plot = element("div", "", "review-plot"), graph = svgElement("svg", { viewBox: "0 0 1000 300", preserveAspectRatio: "none", role: "img", "aria-labelledby": "review-svg-title review-svg-desc" });
    const graphTitle = svgElement("title", { id: "review-svg-title" }, "Recorrido de mi cartera virtual por operación");
    const graphDesc = svgElement("desc", { id: "review-svg-desc" });
    const highLabel = element("span", "", "review-scale high"), lowLabel = element("span", "", "review-scale low"); highLabel.setAttribute("aria-hidden", "true"); lowLabel.setAttribute("aria-hidden", "true");
    plot.append(graph, highLabel, lowLabel);
    const labels = element("div", "", "review-labels"); labels.setAttribute("aria-hidden", "true");
    const cursorLabel = element("label", "Desliza para revisar un registro", "review-cursor-label"), cursor = document.createElement("input"); cursor.type = "range"; cursor.min = "0"; cursor.step = "1"; cursor.id = "review-cursor"; cursorLabel.htmlFor = cursor.id;
    const selected = element("p", "", "review-selected"); selected.id = "review-selected"; cursor.setAttribute("aria-describedby", selected.id);
    const navigation = element("div", "", "practice-actions");
    const previous = element("button", "← Registro anterior"), next = element("button", "Registro siguiente →"); previous.type = next.type = "button"; navigation.append(previous, next);
    const details = document.createElement("details"); details.open = tableWasOpen; details.className = "review-table-details";
    const toggle = element("summary", "Ver el recorrido en una tabla"), wrap = element("div", "", "review-table-wrap"), table = document.createElement("table"); wrap.append(table); details.append(toggle, wrap);
    const downloadBox = element("div", "", "practice-actions"), download = element("button", "Descargar informe CSV"); download.type = "button"; downloadBox.append(download);
    const downloadStatus = element("p", "Incluye el capital inicial y todas las operaciones, saldos, comisiones y notas. Usa punto y coma y coma decimal para Excel. El CSV es un informe; para restaurar la cartera, usa la copia JSON.", "practice-hint"); downloadStatus.setAttribute("role", "status");
    download.addEventListener("click", () => {
      let url;
      try {
        url = URL.createObjectURL(new Blob([core.toCSV(state)], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = `momentumvelo-practica-${state.currency}-${new Date().toISOString().slice(0, 10)}.csv`; host.append(link); link.click(); link.remove();
        downloadStatus.textContent = "Descarga solicitada: se incluyen todas las operaciones, aunque el gráfico muestre un tramo. Las notas que podrían interpretarse como fórmulas se exportan como texto protegido.";
      } catch (_) { downloadStatus.textContent = "No se pudo descargar el informe. Vuelve a intentarlo o conserva tu copia JSON."; }
      finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 30000); }
    });
    let view, marker, guide;
    function select() {
      const i = Number(cursor.value), row = view.rows[i], point = view.points[i];
      const name = row.index ? `Registro ${row.index} · ${row.date} · ${row.side === "buy" ? "Compra" : "Venta"} simulada de ${row.symbol}` : "Capital inicial virtual";
      selected.textContent = `${name}. Saldo disponible: ${money(row.cashCents)} · coste pendiente: ${money(row.investedCents)} · total al coste: ${money(row.totalAtCostCents)} · resultado acumulado: ${money(row.realizedCents)}.`;
      cursor.setAttribute("aria-valuetext", `${name}, ${metric.options[metric.selectedIndex].text}: ${money(row[view.metric])}`);
      marker.setAttribute("cx", point.x); marker.setAttribute("cy", point.y); guide.setAttribute("x1", point.x); guide.setAttribute("x2", point.x);
      previous.disabled = i === 0; next.disabled = i === view.rows.length - 1;
    }
    function renderChart() {
      view = core.view(data, period.value === "all" ? "all" : Number(period.value), metric.value);
      const first = view.rows[0], last = view.rows.at(-1), measure = metric.options[metric.selectedIndex].text;
      rangeNote.textContent = `${measure} · ${last.index - first.index} operaciones, desde ${first.index ? `el saldo tras el registro ${first.index}` : "el capital inicial"}. Cada paso horizontal representa un registro, no un día. La escala vertical se ajusta al tramo. El resumen de ventas usa toda la cartera.`;
      graphDesc.textContent = `${rangeNote.textContent} Mínimo: ${money(view.low)}; máximo: ${money(view.high)}. Puedes consultar los valores con el control y la tabla.`;
      graph.replaceChildren(graphTitle, graphDesc);
      [40, 140, 240].forEach(y => graph.append(svgElement("line", { x1: 70, x2: 950, y1: y, y2: y, class: "review-grid" })));
      highLabel.textContent = money(view.high); highLabel.classList.toggle("flat", view.high === view.low); lowLabel.textContent = money(view.low); lowLabel.hidden = view.high === view.low;
      guide = svgElement("line", { y1: 40, y2: 240, class: "review-guide" }); marker = svgElement("circle", { r: 6, class: "review-marker" });
      graph.append(svgElement("path", { d: view.path, class: "review-line" }), guide, marker);
      labels.replaceChildren(element("span", first.label), element("span", last.label));
      cursor.max = view.rows.length - 1; cursor.value = cursor.max; cursor.disabled = view.rows.length === 1;
      table.replaceChildren(element("caption", `Recorrido visible · ${state.currency} · precios simulados, posiciones al coste`));
      const head = document.createElement("thead"), headRow = document.createElement("tr");
      ["Registro", "Fecha", "Saldo virtual", "Coste pendiente", "Total al coste", "Resultado acumulado"].forEach(text => { const th = element("th", text); th.scope = "col"; headRow.append(th); }); head.append(headRow);
      const body = document.createElement("tbody"); view.rows.forEach(row => { const tr = document.createElement("tr"); [row.index || "Inicial", row.date || "Sin fecha", money(row.cashCents), money(row.investedCents), money(row.totalAtCostCents), money(row.realizedCents)].forEach(value => tr.append(element("td", value))); body.append(tr); }); table.append(head, body); select();
    }
    period.addEventListener("change", renderChart); metric.addEventListener("change", renderChart); cursor.addEventListener("input", select);
    previous.addEventListener("click", () => { cursor.value = Math.max(0, Number(cursor.value) - 1); select(); });
    next.addEventListener("click", () => { cursor.value = Math.min(view.rows.length - 1, Number(cursor.value) + 1); select(); });
    host.append(metrics, outcome, scope, controls, rangeNote, plot, labels, cursorLabel, cursor, selected, navigation, details, downloadBox, downloadStatus);
    renderChart();
  };
})();
