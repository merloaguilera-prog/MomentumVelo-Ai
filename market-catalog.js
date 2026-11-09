(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MomentumMarketCatalog = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
  const regions = ["america", "europa", "asia", "africa", "oceania"];
  const kinds = ["stock", "stock", "stock", "stock", "stock", "crypto", "forex", "index", "etf", "commodity", "bond"];
  const unique = new Map();
  groups.forEach(([, rows], index) => rows.forEach(([market, name]) => {
    if (unique.has(market)) return;
    unique.set(market, { market, name, symbol: index === 5 ? market.split(":")[1].replace(/USD$/, "") : market.split(":")[1],
      region: market === "NASDAQ:ASML" ? "europa" : regions[index] || "all", kind: kinds[index] || "stock" });
  }));
  const assets = [...unique.values()];
  const legacy = Object.fromEntries(assets.map(asset => [asset.symbol, asset.market]));
  const defaults = ["AAPL", "ASML", "7203", "MELI", "NPN"].map(symbol => legacy[symbol]);
  return { groups, assets, legacy, defaults };
});
