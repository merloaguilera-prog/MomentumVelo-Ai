(function () {
  "use strict";
  const svgNS = "http://www.w3.org/2000/svg";
  const number = value => value.toLocaleString("es-ES", { maximumSignificantDigits: 7 });
  const percent = value => `${value > 0 ? "+" : ""}${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
  function element(tag, text, className) {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className; return node;
  }
  function svgElement(tag, attributes, text) {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text; return node;
  }
  window.MomentumHistoryChart = function (loaded) {
    const section = element("section", "", "history-chart");
    section.setAttribute("aria-labelledby", "history-chart-title");
    const heading = element("h4", "Tus cierres, en un gráfico"); heading.id = "history-chart-title";
    const help = element("p", "La línea une los cierres importados y respeta la distancia entre fechas. La escala vertical se ajusta al tramo; el recorrido no representa precios intradía.", "workspace-hint");
    const controls = element("div", "", "market-controls history-controls");
    const label = element("label", "Ver tramo"); label.htmlFor = "history-period";
    const period = document.createElement("select"); period.id = "history-period";
    [["all", "Todo el archivo"], [30, "Últimos 30 cierres"], [90, "Últimos 90 cierres"], [180, "Últimos 180 cierres"]].forEach(([value, text]) => {
      const option = element("option", text); option.value = value;
      option.disabled = value !== "all" && loaded.rows.length <= value; period.append(option);
    });
    label.append(period);
    const download = element("button", "Descargar histórico CSV"); download.type = "button";
    const downloadStatus = element("p", "Se descarga todo el histórico validado, sin el nombre del activo ni la fuente. Puedes volver a importarlo.", "workspace-hint");
    downloadStatus.setAttribute("role", "status");
    download.addEventListener("click", () => {
      let url;
      try {
        url = URL.createObjectURL(new Blob([window.MomentumHistory.toCSV(loaded.rows)], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url;
        link.download = `momentumvelo-historico-${loaded.rows[0].date}-${loaded.rows.at(-1).date}.csv`;
        section.append(link); link.click(); link.remove();
        downloadStatus.textContent = "Descarga solicitada. El CSV contiene todos los cierres importados, sin filtrar por el tramo visible.";
      } catch (_) { downloadStatus.textContent = "No se pudo descargar. Conserva el CSV del formulario e inténtalo de nuevo."; }
      finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 30000); }
    });
    controls.append(label, download);
    const summary = element("div", "", "detector-metrics");
    const rangeNote = element("p", "", "workspace-hint");
    const graph = svgElement("svg", { viewBox: "0 0 1000 300", role: "img", "aria-labelledby": "history-svg-title history-svg-desc", preserveAspectRatio: "none" });
    graph.classList.add("history-svg");
    const graphTitle = svgElement("title", { id: "history-svg-title" }, "Histórico de cierres importados");
    const graphDescription = svgElement("desc", { id: "history-svg-desc" });
    const plot = element("div", "", "history-plot");
    const highLabel = element("span", "", "history-scale high"), lowLabel = element("span", "", "history-scale low");
    highLabel.setAttribute("aria-hidden", "true"); lowLabel.setAttribute("aria-hidden", "true");
    plot.append(graph, highLabel, lowLabel);
    const dates = element("div", "", "history-dates"); dates.setAttribute("aria-hidden", "true");
    const selectedNote = element("p", "", "history-selected"); selectedNote.id = "history-selected";
    const cursorLabel = element("label", "Desliza para consultar un cierre"); cursorLabel.htmlFor = "history-cursor";
    const cursor = document.createElement("input"); cursor.type = "range"; cursor.id = "history-cursor"; cursor.min = "0"; cursor.step = "1";
    cursor.setAttribute("aria-describedby", "history-selected");
    const navigation = element("div", "", "market-controls history-navigation");
    const previous = element("button", "← Cierre anterior"), next = element("button", "Cierre siguiente →"); previous.type = next.type = "button";
    navigation.append(previous, next);
    const tableDetails = document.createElement("details"); tableDetails.className = "history-table-details";
    const tableToggle = element("summary", "Ver los datos del tramo en una tabla");
    const tableWrap = element("div", "", "history-table-wrap"), table = document.createElement("table");
    tableWrap.append(table); tableDetails.append(tableToggle, tableWrap);
    let data, marker, guide;
    function selectClose() {
      const index = Number(cursor.value), row = data.rows[index], point = data.points[index];
      selectedNote.textContent = `${row.date} · Cierre: ${number(row.close)} ${loaded.currency} · Volumen: ${row.volume === null ? "no disponible" : number(row.volume)}`;
      cursor.setAttribute("aria-valuetext", `${row.date}, cierre ${number(row.close)} ${loaded.currency}`);
      marker.setAttribute("cx", point.x); marker.setAttribute("cy", point.y);
      guide.setAttribute("x1", point.x); guide.setAttribute("x2", point.x);
      previous.disabled = index === 0; next.disabled = index === data.rows.length - 1;
    }
    function render() {
      data = window.MomentumHistory.view(loaded.rows, period.value === "all" ? "all" : Number(period.value));
      summary.replaceChildren();
      [["Variación en el tramo", percent(data.change)], ["Mayor cierre del tramo", `${number(data.high.close)} ${loaded.currency} · ${data.high.date}`], ["Menor cierre del tramo", `${number(data.low.close)} ${loaded.currency} · ${data.low.date}`]].forEach(([name, value]) => {
        const card = element("div", "", "detector-metric"); card.append(element("span", name), element("strong", value)); summary.append(card);
      });
      rangeNote.textContent = `${data.first.date} → ${data.last.date} · ${data.rows.length} cierres. La variación compara el primer y el último cierre de este tramo. Tus reglas siguen usando todo el archivo.`;
      graphDescription.textContent = `${loaded.asset}. Fuente declarada: ${loaded.source}. ${rangeNote.textContent} Mínimo ${number(data.low.close)}, máximo ${number(data.high.close)} ${loaded.currency}. Consulta cada valor con el control de fecha o la tabla.`;
      graph.replaceChildren(graphTitle, graphDescription);
      [40, 140, 240].forEach(y => graph.append(svgElement("line", { x1: 70, x2: 950, y1: y, y2: y, class: "history-grid" })));
      highLabel.textContent = `${number(data.high.close)} ${loaded.currency}`;
      lowLabel.textContent = `${number(data.low.close)} ${loaded.currency}`;
      highLabel.classList.toggle("flat", data.high.close === data.low.close);
      lowLabel.hidden = data.high.close === data.low.close;
      dates.replaceChildren(element("span", data.first.date), element("span", data.last.date));
      guide = svgElement("line", { y1: 40, y2: 240, class: "history-guide" });
      marker = svgElement("circle", { r: 5, class: "history-marker" });
      graph.append(guide, svgElement("path", { d: data.path, class: "history-line" }), marker);
      cursor.max = data.rows.length - 1; cursor.value = cursor.max;
      table.replaceChildren(element("caption", `${loaded.asset} · cierres del tramo visible · ${loaded.currency}`));
      const head = document.createElement("thead"), headRow = document.createElement("tr");
      ["Fecha", `Cierre (${loaded.currency})`, "Volumen"].forEach(text => { const cell = element("th", text); cell.scope = "col"; headRow.append(cell); }); head.append(headRow);
      const body = document.createElement("tbody");
      data.rows.forEach(row => { const tr = document.createElement("tr"); tr.append(element("td", row.date), element("td", number(row.close)), element("td", row.volume === null ? "No disponible" : number(row.volume))); body.append(tr); });
      table.append(head, body); selectClose();
    }
    cursor.addEventListener("input", selectClose);
    previous.addEventListener("click", () => { cursor.value = Math.max(0, Number(cursor.value) - 1); selectClose(); });
    next.addEventListener("click", () => { cursor.value = Math.min(data.rows.length - 1, Number(cursor.value) + 1); selectClose(); });
    period.addEventListener("change", render);
    section.append(heading, help, controls, summary, rangeNote, plot, dates, cursorLabel, cursor, selectedNote, navigation, tableDetails, downloadStatus);
    render(); return section;
  };
})();
