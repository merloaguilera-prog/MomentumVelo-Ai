(function () {
  "use strict";
  const $ = id => document.getElementById(id), core = window.MomentumLiveRadar;
  const quotes = new Map(), products = core.PRODUCTS;
  const names = { "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana" };
  let socket = null, engine = null, watchdog = null, startTime = 0, lastMessage = 0;
  const money = value => value.toLocaleString("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const stamp = time => new Date(time).toLocaleTimeString("es-ES", { hour12: false });
  function draw() {
    $("radar-quotes").replaceChildren();
    products.forEach(product => {
      const card = document.createElement("div"); card.className = "detector-metric";
      const label = document.createElement("strong"); label.textContent = `${names[product]} · ${product}`;
      const value = quotes.get(product), detail = document.createElement("p");
      const stale = value && Date.now() - value.time > 15000;
      detail.textContent = !value ? "Esperando datos" : `${money(value.price)} · ${stamp(value.time)} · ${stale ? "Dato antiguo; sin señal actual" : value.warming ? "Reuniendo 60 segundos de datos" : `${value.change.toFixed(2)} % en ≈60 s`}`;
      const link = document.createElement("a"); link.href = `/mercados?activo=${encodeURIComponent("COINBASE:" + product.replace("-", ""))}#cotizacion`; link.textContent = "Abrir gráfico ↗";
      card.append(label, detail, link); $("radar-quotes").append(card);
    });
  }
  function stop(text = "Vigilancia pausada. Actívala para iniciar una nueva ventana de datos.") {
    const old = socket; socket = null;
    if (old) old.close();
    clearInterval(watchdog); watchdog = null;
    if (engine) engine.reset();
    $("radar-start").disabled = false; $("radar-stop").disabled = true; $("radar-threshold").disabled = false;
    quotes.clear(); draw(); $("radar-status").textContent = text;
  }
  function alert(signal) {
    const text = `${names[signal.product]} · ${signal.direction === "up" ? "Subida" : "Caída"} ${signal.change.toFixed(2)} % · ${stamp(signal.time)} · ${money(signal.price)} · comparación desde ${stamp(signal.baselineTime)}`;
    const row = document.createElement("li"); row.className = `detector-signal ${signal.direction}`;
    const label = document.createElement("p"); label.textContent = text;
    const link = document.createElement("a"); link.href = `/mercados?activo=${encodeURIComponent("COINBASE:" + signal.product.replace("-", ""))}#cotizacion`; link.textContent = "Revisar activo →";
    row.append(label, link); $("radar-signals").prepend(row);
    while ($("radar-signals").children.length > 20) $("radar-signals").lastElementChild.remove();
    $("radar-empty").hidden = true; $("radar-alert").textContent = text;
  }
  $("radar-start").addEventListener("click", () => {
    if (socket || document.hidden) return;
    try { engine = core.create(Number($("radar-threshold").value)); } catch (error) { $("radar-status").textContent = error.message; return; }
    quotes.clear(); draw(); startTime = Date.now(); lastMessage = 0;
    let current;
    try { current = new WebSocket("wss://ws-feed.exchange.coinbase.com"); } catch (_) { stop("No se pudo iniciar la conexión. Reintenta."); return; }
    socket = current; $("radar-start").disabled = true; $("radar-stop").disabled = false; $("radar-threshold").disabled = true;
    $("radar-status").textContent = "Conectando a Coinbase…";
    current.onopen = () => { if (socket !== current) return; current.send(JSON.stringify({ type: "subscribe", product_ids: products, channels: ["ticker", "heartbeat"] })); $("radar-status").textContent = "Conexión abierta; esperando precios válidos. Las señales necesitan 60 segundos de datos."; };
    current.onmessage = event => {
      if (socket !== current || document.hidden) return;
      let message; try { message = JSON.parse(event.data); } catch (_) { return; }
      if (message.type === "error") { stop("El proveedor rechazó la suscripción. Reintenta más tarde."); return; }
      const result = engine.ingest(message, Date.now());
      if (!result) return;
      lastMessage = Date.now(); quotes.set(result.product, result);
      $("radar-status").textContent = `Recibiendo precios · último dato válido ${stamp(result.time)}. Vigilancia únicamente mientras esta página permanece visible.`;
      if (result.signal) alert(result.signal);
    };
    current.onerror = () => { if (socket === current) stop("Error de conexión. Vigilancia detenida; pulsa Activar para reintentar."); };
    current.onclose = () => { if (socket === current) stop("La conexión se cerró. Vigilancia detenida; vuelve a activarla."); };
    watchdog = setInterval(() => { draw(); if (Date.now() - (lastMessage || startTime) > 20000) stop("No llegan precios válidos desde hace 20 segundos. Vigilancia detenida; reintenta."); }, 1000);
  });
  $("radar-stop").addEventListener("click", () => stop());
  document.addEventListener("visibilitychange", () => { if (document.hidden && socket) stop("La página está oculta: vigilancia pausada. Vuelve y pulsa Activar."); });
  window.addEventListener("pagehide", () => stop());
  draw();
})();
