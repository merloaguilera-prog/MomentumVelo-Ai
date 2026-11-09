(function () {
  "use strict";
  const $ = id => document.getElementById(id), core = window.MomentumLiveRadar;
  const quotes = new Map(), series = new Map(), cards = new Map(), products = core.PRODUCTS;
  const names = { "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana" };
  let socket = null, engine = null, watchdog = null, startTime = 0, lastMessage = 0, receiving = false;
  const money = value => value.toLocaleString("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const stamp = time => new Date(time).toLocaleTimeString("es-ES", { hour12: false });
  function draw() {
    products.forEach(product => {
      let view=cards.get(product);
      if(!view){
        const card=document.createElement("article");card.className="radar-quote-card";
        const title=document.createElement("strong");title.textContent=`${names[product]} · ${product}`;
        const state=document.createElement("small");state.className="radar-quote-state";
        const price=document.createElement("p");price.className="radar-quote-price";
        const change=document.createElement("p");change.className="radar-quote-change";
        const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 300 90");svg.setAttribute("preserveAspectRatio","none");svg.setAttribute("class","radar-mini-chart");svg.setAttribute("role","img");svg.setAttribute("aria-label",`Evolución de precios recibidos de ${names[product]} durante esta visita`);
        const line=document.createElementNS("http://www.w3.org/2000/svg","path");svg.append(line);
        const phase=document.createElement("p");phase.className="radar-quote-phase";
        const progress=document.createElement("progress");progress.max=60;progress.value=0;progress.setAttribute("aria-label",`Segundos de datos reunidos para ${names[product]}`);
        const time=document.createElement("time");
        const link=document.createElement("a");link.href=`/mercados?activo=${encodeURIComponent("COINBASE:"+product.replace("-",""))}#cotizacion`;link.textContent="Abrir gráfico ↗";link.setAttribute("aria-label",`Abrir gráfico de ${names[product]}`);
        card.append(title,state,price,change,svg,phase,progress,time,link);$("radar-quotes").append(card);view={card,state,price,change,line,phase,progress,time};cards.set(product,view);
      }
      const value=quotes.get(product),stale=value&&Date.now()-value.time>15000,paused=!socket;
      view.card.dataset.state=!value?"waiting":paused?"paused":stale?"stale":"live";
      view.state.textContent=!value?"Esperando":paused?"Pausado · dato conservado":stale?"Dato antiguo":"Recibiendo precios";
      view.price.textContent=value?money(value.price):"—";
      view.change.textContent=!value?"Sin datos todavía":value.warming?"Preparando la comparación":`${value.change.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:"exceptZero"})} % en ≈60 s`;
      const history=series.get(product)||[],elapsed=history.length?Math.min(60,Math.max(0,(history.at(-1).time-history[0].time)/1000)):0;
      view.progress.hidden=!value||!value.warming||paused||stale;view.progress.value=elapsed;
      view.phase.textContent=!value?"Activa la vigilancia para recibir datos.":paused?"Último dato conservado; no es una señal actual.":stale?"Sin precio nuevo en más de 15 s.":value.warming?`Reuniendo datos: ${Math.floor(elapsed)} de 60 s.`:"Cambio observado sobre una ventana de aproximadamente un minuto.";
      view.time.textContent=value?`Recibido ${stamp(value.time)}`:"Sin precio recibido";if(value)view.time.dateTime=new Date(value.time).toISOString();
      if(history.length<2){view.line.setAttribute("d","");return;}
      const low=Math.min(...history.map(row=>row.price)),high=Math.max(...history.map(row=>row.price)),duration=history.at(-1).time-history[0].time;
      const d=history.map((row,index)=>`${index?"L":"M"}${((row.time-history[0].time)/duration*300).toFixed(2)},${(high===low?45:12+(high-row.price)/(high-low)*66).toFixed(2)}`).join(" ");view.line.setAttribute("d",d);
    });
  }
  function stop(text = "Vigilancia pausada. Los últimos precios se conservan como datos anteriores; activa para iniciar una ventana nueva.") {
    const old = socket; socket = null;
    if (old) old.close();
    clearInterval(watchdog); watchdog = null;
    if (engine) engine.reset();
    $("radar-start").disabled = false; $("radar-stop").disabled = true; $("radar-threshold").disabled = false;
    receiving=false; draw(); $("radar-status").textContent = text;
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
    quotes.clear(); series.clear(); receiving=false; draw(); startTime = Date.now(); lastMessage = 0;
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
      let history=series.get(result.product)||[];if(history.length&&result.time-history.at(-1).time>15000)history=[];
      history=history.filter(row=>result.time-row.time<=62000);const sample={time:result.time,price:result.price};
      if(history.length&&Math.floor(history.at(-1).time/1000)===Math.floor(result.time/1000))history[history.length-1]=sample;else history.push(sample);series.set(result.product,history);
      if(!receiving){receiving=true;$("radar-status").textContent="Recibiendo precios de Coinbase. La vigilancia se pausa al ocultar esta página.";}
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
