(function () {
  "use strict";
  const groups = [
    ["América", [["NASDAQ:NVDA","Nvidia"],["NASDAQ:AAPL","Apple"],["NASDAQ:MSFT","Microsoft"],["NASDAQ:TSLA","Tesla"],["NASDAQ:ASML","ASML"],["NASDAQ:MELI","MercadoLibre"],["NYSE:KO","Coca-Cola"],["NYSE:JPM","JPMorgan"]]],
    ["Europa", [["BME:SAN","Santander"],["BME:IBE","Iberdrola"],["XETR:SAP","SAP"]]],
    ["Asia", [["SSE:600519","Kweichow Moutai"],["SZSE:000001","Ping An Bank"]]],
    ["África", [["EGX:COMI","Commercial International Bank · Egipto"],["CSEMA:IAM","Maroc Telecom · Marruecos"]]],
    ["Oceanía", [["ASX:BHP","BHP · Australia"]]],
    ["Criptomonedas", [["COINBASE:BTCUSD","Bitcoin / USD"],["COINBASE:ETHUSD","Ethereum / USD"],["COINBASE:SOLUSD","Solana / USD"]]],
    ["Divisas", [["FX_IDC:EURUSD","Euro / dólar"],["FX_IDC:GBPUSD","Libra / dólar"],["FX_IDC:USDJPY","Dólar / yen"],["FX_IDC:AUDUSD","Dólar australiano / dólar"]]],
    ["Índices y CFD de índices", [["FOREXCOM:SPXUSD","S&P 500 · CFD"],["FOREXCOM:NSXUSD","US 100 · CFD"],["FOREXCOM:DJI","Dow Jones · CFD"]]],
    ["ETF", [["AMEX:SPY","SPDR S&P 500 ETF"],["NASDAQ:QQQ","Invesco QQQ ETF"],["AMEX:GLD","SPDR Gold Shares ETF"]]],
    ["Materias primas · CFD", [["OANDA:XAUUSD","Oro / USD · CFD"],["OANDA:XAGUSD","Plata / USD · CFD"]]],
    ["Bonos · futuros", [["EUREX:FGBL1!","Euro Bund · futuro continuo"],["EUREX:FBTP1!","Euro BTP · futuro continuo"]]]
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
      option.dataset.timing = index < 5 || index === 8 || index === 10 ? "delayed" : "realtime";
      group.append(option);
    });
    if (group.children.length) selector.append(group);
  });
  const filter = document.querySelector("#global-group");
  groups.forEach(([label], i) => { const option = document.createElement("option"); option.value = String(i); option.textContent = label; filter.append(option); });
  const search = document.querySelector("#global-search"), list = document.querySelector("#global-assets");
  function renderList() {
    const query = search.value.trim().toLocaleLowerCase("es");
    const pool = query ? groups.flatMap(([, assets]) => assets) : groups[Number(filter.value)][1];
    list.replaceChildren();
    const found = pool.filter(([symbol, label]) => `${symbol} ${label}`.toLocaleLowerCase("es").includes(query));
    found.forEach(([symbol, label]) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label;
      button.addEventListener("click", () => { selector.value = symbol; selector.dispatchEvent(new Event("change")); document.querySelector("#cotizacion").scrollIntoView({ behavior: "smooth" }); });
      list.append(button);
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
    script.textContent = JSON.stringify({ colorTheme: "dark", dateRange: "12M", locale: "es", width: "100%", height: "500", showChart: false, showSymbolLogo: true, isTransparent: false, largeChartUrl: `${location.origin}/mercados#cotizacion`, tabs: [{ title: groups[Number(filter.value)][0], symbols: groups[Number(filter.value)][1].map(([s, d]) => ({ s, d })) }] });
    script.onerror = () => { if (current === generation) status.textContent = "No se pudo cargar la fuente. Reintenta o abre TradingView."; };
    container.append(script); target.replaceChildren(container);
    timer = setTimeout(() => { if (current === generation) status.textContent = target.querySelector("iframe") ? "Tabla del proveedor cargada. Comprueba la hora, moneda y disponibilidad de cada dato; un marco cargado no confirma que todos los símbolos tengan precio." : "La fuente tarda en responder. Puedes reintentar o abrir el activo mediante la lista."; }, 12000);
  }
  filter.addEventListener("change", () => { search.value = ""; renderList(); renderQuotes(); });
  search.addEventListener("input", renderList);
  document.querySelector("#global-retry").addEventListener("click", renderQuotes);
  renderList(); renderQuotes();
})();
