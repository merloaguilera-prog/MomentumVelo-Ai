(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const timers = new Map();
  const initialized = new Set();
  function embed(id, widget, config, attribution, statusId) {
    const target = $(id);
    clearTimeout(timers.get(id));
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    const host = document.createElement("div");
    host.className = "tradingview-widget-container__widget";
    const source = document.createElement("a");
    source.className = "mv-source";
    source.href = attribution;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "Datos y gráfico por TradingView ↗";
    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    script.async = true;
    script.textContent = JSON.stringify(config);
    function failed() {
      if (!target.contains(container)) return;
      if (statusId) { $(statusId).textContent = "No se pudo cargar la fuente. Reintenta el gráfico o abre Mercados."; $(statusId).classList.add("error"); }
      else if (id === "mv-ticker-widget") { target.hidden = true; }
      else {
        const fallback = document.createElement("a");
        fallback.href = "/mercados"; fallback.className = "mv-source";
        fallback.textContent = "No se pudo cargar la fuente. Consultar en Mercados →";
        const retry = document.createElement("button");
        retry.type = "button"; retry.className = "mv-neon-button"; retry.textContent = "Reintentar fuente";
        retry.addEventListener("click", () => embed(id, widget, config, attribution, statusId));
        container.replaceChildren(fallback, retry);
      }
    }
    script.addEventListener("error", failed);
    container.append(host, source, script);
    target.replaceChildren(container);
    timers.set(id, setTimeout(() => { if (!container.querySelector("iframe")) failed(); }, 15000));
    return container;
  }
  const periods = { "1D": ["1D", "5"], "5D": ["5D", "30"], "1M": ["1M", "60"], "3M": ["3M", "D"], "6M": ["6M", "D"], "1A": ["12M", "D"], "2A": ["24M", "W"] };
  let selectedPeriod = "1M";
  function chart(period) {
    if (!periods[period]) return;
    selectedPeriod = period;
    $("mv-chart-status").textContent = "Gráfico de TradingView · consulta fecha, moneda y retraso en la fuente.";
    $("mv-chart-status").classList.remove("error");
    document.querySelectorAll("[data-period]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.period === period)));
    embed("mv-chart-widget", "advanced-chart", {
      autosize: true, symbol: "NASDAQ:AAPL", interval: periods[period][1], range: periods[period][0],
      timezone: "Europe/Madrid", theme: "dark", style: "1", locale: "es", backgroundColor: "rgba(3,10,24,1)",
      gridColor: "rgba(25,68,120,0.25)", hide_top_toolbar: true, hide_legend: false,
      allow_symbol_change: false, save_image: false, calendar: false, support_host: "https://www.tradingview.com",
      overrides: { "mainSeriesProperties.candleStyle.upColor": "#1eeaff", "mainSeriesProperties.candleStyle.downColor": "#e530ed",
        "mainSeriesProperties.candleStyle.borderUpColor": "#1eeaff", "mainSeriesProperties.candleStyle.borderDownColor": "#e530ed",
        "mainSeriesProperties.candleStyle.wickUpColor": "#1eeaff", "mainSeriesProperties.candleStyle.wickDownColor": "#e530ed" }
    }, "https://www.tradingview.com/symbols/NASDAQ-AAPL/", "mv-chart-status");
  }
  document.querySelectorAll("[data-period]").forEach(button => button.addEventListener("click", () => chart(button.dataset.period)));
  $("mv-chart-retry").addEventListener("click", () => chart(selectedPeriod));
  const dialogConfigs = {
    "mv-news": ["mv-news-widget", "timeline", { feedMode: "all_symbols", isTransparent: true, displayMode: "regular", width: "100%", height: "100%", colorTheme: "dark", locale: "es" }, "https://www.tradingview.com/news/"],
    "mv-calendar": ["mv-calendar-widget", "events", { colorTheme: "dark", isTransparent: true, width: "100%", height: "100%", locale: "es", importanceFilter: "-1,0,1", countryFilter: "us,eu,es,gb,jp,cn" }, "https://www.tradingview.com/economic-calendar/"]
  };
  document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => {
    const dialog = $(button.dataset.open);
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const config = dialogConfigs[dialog.id];
    if (config && !initialized.has(dialog.id)) { embed(...config); initialized.add(dialog.id); }
    if (dialog.id === "mv-search") $("mv-search-input").focus();
  }));
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
  const symbols = new Map([
    ["apple", "NASDAQ:AAPL"], ["aapl", "NASDAQ:AAPL"], ["nvidia", "NASDAQ:NVDA"], ["nvda", "NASDAQ:NVDA"],
    ["microsoft", "NASDAQ:MSFT"], ["msft", "NASDAQ:MSFT"], ["bitcoin", "COINBASE:BTCUSD"], ["btc", "COINBASE:BTCUSD"],
    ["ethereum", "COINBASE:ETHUSD"], ["eth", "COINBASE:ETHUSD"], ["solana", "COINBASE:SOLUSD"], ["sol", "COINBASE:SOLUSD"],
    ["tesla", "NASDAQ:TSLA"], ["tsla", "NASDAQ:TSLA"], ["santander", "BME:SAN"], ["iberdrola", "BME:IBE"]
  ]);
  $("mv-search-form").addEventListener("submit", event => {
    event.preventDefault();
    const query = $("mv-search-input").value.trim().toLocaleLowerCase("es");
    const symbol = symbols.get(query) || [...symbols.values()].find(value => value.toLowerCase() === query);
    if (!symbol) { $("mv-search-status").textContent = "Escribe Apple, Nvidia, Microsoft, Bitcoin, Ethereum, Solana, Tesla, Santander o Iberdrola. Para más activos, abre Mercados."; return; }
    window.location.href = `/mercados?activo=${encodeURIComponent(symbol)}#cotizacion`;
  });
  embed("mv-ticker-widget", "ticker-tape", {
    symbols: [{ proName: "FOREXCOM:SPXUSD", title: "S&P 500 · CFD" }, { proName: "FOREXCOM:NSXUSD", title: "NASDAQ · CFD" },
      { proName: "XETR:DAX", title: "DAX" }, { proName: "BME:IBC", title: "IBEX 35" }, { proName: "COINBASE:BTCUSD", title: "BTC/USD" }],
    showSymbolLogo: true, colorTheme: "dark", isTransparent: true, displayMode: "adaptive", locale: "es"
  }, "https://www.tradingview.com/markets/");
  chart(selectedPeriod);
  window.addEventListener("pagehide", () => { timers.forEach(timer => clearTimeout(timer)); });
})();
