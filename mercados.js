(function () {
  "use strict";
  const selector = document.querySelector("#market-symbol");
  const chart = document.querySelector("#market-chart");
  const status = document.querySelector("#market-status");
  const source = document.querySelector("#market-source");
  const options = Array.from(selector.options);
  let generation = 0;
  let timer;

  function render() {
    const option = options.find(item => item.value === selector.value) || options[0];
    selector.value = option.value;
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
      locale: "es", colorTheme: "dark", isTransparent: true,
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
  render();
})();
