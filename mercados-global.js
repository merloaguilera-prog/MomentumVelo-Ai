(function () {
  "use strict";
  const groups = [
    ["América", [["NASDAQ:NVDA","Nvidia"],["NASDAQ:AAPL","Apple"],["NASDAQ:MSFT","Microsoft"],["NASDAQ:TSLA","Tesla"],["NASDAQ:ASML","ASML"],["NASDAQ:MELI","MercadoLibre"],["NYSE:KO","Coca-Cola"],["NYSE:JPM","JPMorgan"]]],
    ["Europa", [["BME:SAN","Santander"],["BME:IBE","Iberdrola"],["XETR:SAP","SAP"]]],
    ["Asia", [["SSE:600519","Kweichow Moutai"],["SZSE:000001","Ping An Bank"],["TSE:7203","Toyota"]]],
    ["África", [["EGX:COMI","Commercial International Bank · Egipto"],["CSEMA:IAM","Maroc Telecom · Marruecos"],["JSE:NPN","Naspers"]]],
    ["Oceanía", [["ASX:BHP","BHP · Australia"]]],
    ["Criptomonedas", [["COINBASE:BTCUSD","Bitcoin / USD"],["COINBASE:ETHUSD","Ethereum / USD"],["COINBASE:SOLUSD","Solana / USD"]]],
    ["Divisas", [["FX_IDC:EURUSD","Euro / dólar"],["FX_IDC:GBPUSD","Libra / dólar"],["FX_IDC:USDJPY","Dólar / yen"],["FX_IDC:AUDUSD","Dólar australiano / dólar"]]],
    ["Índices y CFD de índices", [["FOREXCOM:SPXUSD","S&P 500 · CFD"],["FOREXCOM:NSXUSD","US 100 · CFD"],["FOREXCOM:DJI","Dow Jones · CFD"],["XETR:DAX","DAX"],["BME:IBC","IBEX 35"]]],
    ["ETF", [["AMEX:SPY","SPDR S&P 500 ETF"],["NASDAQ:QQQ","Invesco QQQ ETF"],["AMEX:GLD","SPDR Gold Shares ETF"]]],
    ["Materias primas · CFD", [["OANDA:XAUUSD","Oro / USD · CFD"],["OANDA:XAGUSD","Plata / USD · CFD"]]],
    ["Bonos · futuros", [["EUREX:FGBL1!","Euro Bund · futuro continuo"],["EUREX:FBTP1!","Euro BTP · futuro continuo"]]],
    ["Latinoamérica", [["NASDAQ:MELI","MercadoLibre"]]]
  ];
  const selector = document.querySelector("#market-symbol");
  const existing = new Set(Array.from(selector.options, o => o.value));
  groups.forEach(([name, assets], index) => {
    const group = document.createElement("optgroup"); group.label = name;
    assets.forEach(([symbol, label]) => {
      if (existing.has(symbol)) return;
      existing.add(symbol);
      const option = document.createElement("option"); option.value = symbol;
      option.textContent = `${label} · ${symbol}`;
      option.dataset.timing = ["América", "Europa", "Asia", "África", "Oceanía", "ETF", "Bonos · futuros", "Latinoamérica"].includes(name) || ["XETR:DAX", "BME:IBC"].includes(symbol) ? "delayed" : "realtime";
      group.append(option);
    });
    if (group.children.length) selector.append(group);
  });
  const filter = document.querySelector("#global-group");
  groups.forEach(([label], i) => { const option = document.createElement("option"); option.value = String(i); option.textContent = label; filter.append(option); });
  const requestedRegion = new URLSearchParams(window.location.search).get("region");
  if (requestedRegion) {
    const normalize = value => value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const requestedIndex = groups.findIndex(([name]) => normalize(name) === normalize(requestedRegion));
    if (requestedIndex >= 0) filter.value = String(requestedIndex);
  }
  const search = document.querySelector("#global-search"), list = document.querySelector("#global-assets");
  function renderList() {
    const query = search.value.trim().toLocaleLowerCase("es");
    const pool = query ? groups.flatMap(([, assets]) => assets) : groups[Number(filter.value)][1];
    list.replaceChildren();
    const found = [...new Map(pool.filter(([symbol, label]) => `${symbol} ${label}`.toLocaleLowerCase("es").includes(query)).map(asset => [asset[0], asset])).values()];
    found.forEach(([symbol, label]) => {
      const link = document.createElement("a"); link.href = window.MomentumMarketRoute.href(symbol); link.textContent = label;
      list.append(link);
    });
    if (!found.length) list.textContent = "No hay coincidencias en esta selección. Explora más mercados en la fuente.";
  }
  let generation = 0, timer;
  function renderQuotes() {
    const current = ++generation; clearTimeout(timer);
    const status = document.querySelector("#global-status"), target = document.querySelector("#global-widget");
    status.textContent = "Cargando la tabla del proveedor…";
    const container = document.createElement("div"); container.className = "tradingview-widget-container";
    const host = document.createElement("div"); host.className = "tradingview-widget-container__widget"; container.append(host);
    const attribution = document.createElement("a"); attribution.href = "https://www.tradingview.com/markets/"; attribution.target = "_blank"; attribution.rel = "noopener noreferrer"; attribution.textContent = "Cotizaciones por TradingView ↗"; container.append(attribution);
    const script = document.createElement("script"); script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"; script.async = true;
    script.textContent = JSON.stringify({ colorTheme: "dark", dateRange: "12M", locale: "es", width: "100%", height: "500", showChart: false, showSymbolLogo: true, isTransparent: false, largeChartUrl: `${location.origin}/mercados`, tabs: [{ title: groups[Number(filter.value)][0], symbols: groups[Number(filter.value)][1].map(([s, d]) => ({ s, d })) }] });
    script.onerror = () => { if (current === generation) status.textContent = "No se pudo cargar la fuente. Reintenta o abre TradingView."; };
    container.append(script); target.replaceChildren(container);
    timer = setTimeout(() => { if (current === generation) status.textContent = target.querySelector("iframe") ? "Tabla del proveedor cargada. Comprueba la hora, moneda y disponibilidad de cada dato; un marco cargado no confirma que todos los símbolos tengan precio." : "La fuente tarda en responder. Puedes reintentar o abrir el activo mediante la lista."; }, 12000);
  }
  filter.addEventListener("change", () => { search.value = ""; renderList(); renderQuotes(); });
  search.addEventListener("input", renderList);
  document.querySelector("#global-retry").addEventListener("click", renderQuotes);
  renderList();
  if (!window.MomentumMarketRoute.parse(location.href, Array.from(selector.options, option => option.value)).requested) renderQuotes();
})();
