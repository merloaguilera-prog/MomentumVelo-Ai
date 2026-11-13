(function () {
  "use strict";
  const $ = id => document.getElementById(id), core = window.MomentumLiveRadar;
  const quotes = new Map(), series = new Map(), cards = new Map(), products = core.PRODUCTS;
  const names = { "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana" };
  let engine = null, feedState = 'paused', paintTimer = null, windowSeconds = 60, confirmationMs = 0;
  const periodLabel = () => windowSeconds === 60 ? '1 min' : `${windowSeconds / 60} min`;
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
        const progress=document.createElement("progress");progress.max=windowSeconds;progress.value=0;progress.setAttribute("aria-label",`Segundos de datos reunidos para ${names[product]}`);
        const time=document.createElement("time");
        const link=document.createElement("a");link.href=`/mercados?activo=${encodeURIComponent("COINBASE:"+product.replace("-",""))}#cotizacion`;link.textContent="Abrir gráfico ↗";link.setAttribute("aria-label",`Abrir gráfico de ${names[product]}`);
        card.append(title,state,price,change,svg,phase,progress,time,link);$("radar-quotes").append(card);view={card,state,price,change,line,phase,progress,time};cards.set(product,view);
      }
      const value=quotes.get(product),stale=value&&Date.now()-value.time>15000,paused=!['receiving','waiting'].includes(feedState);
      view.card.dataset.state=!value?"waiting":paused?"paused":stale?"stale":"live";
      view.state.textContent=!value?"Esperando":paused?"Pausado · dato conservado":stale?"Dato antiguo":"Recibiendo precios";
      view.price.textContent=value?money(value.price):"—";
      view.change.textContent=!value?"Sin datos todavía":value.warming?"Preparando la comparación":`${value.change.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:"exceptZero"})} % en ≈${periodLabel()}`;
      const history=series.get(product)||[],elapsed=history.length?Math.min(windowSeconds,Math.max(0,(history.at(-1).time-history[0].time)/1000)):0;
      view.progress.hidden=!value||!value.warming||paused||stale;view.progress.max=windowSeconds;view.progress.value=elapsed;
      view.phase.textContent=!value?(['waiting','connecting','receiving'].includes(feedState)?"Esperando los primeros precios válidos de Coinbase…":"Activa la vigilancia para recibir datos."):paused?"Último dato conservado; no es una señal actual.":stale?"Sin precio nuevo en más de 15 s.":value.warming?`Reuniendo datos: ${Math.floor(elapsed)} de ${windowSeconds} s.`:`Cambio observado sobre una ventana de aproximadamente ${periodLabel()}.`;
      view.time.textContent=value?`Recibido ${stamp(value.time)}`:"Sin precio recibido";if(value)view.time.dateTime=new Date(value.time).toISOString();
      if(history.length<2){view.line.setAttribute("d","");return;}
      const low=Math.min(...history.map(row=>row.price)),high=Math.max(...history.map(row=>row.price)),duration=history.at(-1).time-history[0].time;
      const d=history.map((row,index)=>`${index?"L":"M"}${((row.time-history[0].time)/duration*300).toFixed(2)},${(high===low?45:12+(high-row.price)/(high-low)*66).toFixed(2)}`).join(" ");view.line.setAttribute("d",d);
    });
  }
  function connectionState(state, info) {
    feedState = state;
    const active = !['paused', 'stopped'].includes(state);
    $('radar-start').disabled = active; $('radar-stop').disabled = !active;
    ['radar-threshold', 'radar-window', 'radar-confirmation'].forEach(id => $(id).disabled = active);
    if (state === 'connecting') { engine.reset(); quotes.clear(); series.clear(); }
    if (!active) { clearInterval(paintTimer); paintTimer = null; if (engine) engine.reset(); }
    else if (!paintTimer) paintTimer = setInterval(draw, 250);
    const messages = {
      connecting: 'Conectando a Coinbase…',
      waiting: `Conexión abierta; esperando precios válidos. Comparación: ${periodLabel()}.`,
      receiving: `Recibiendo precios de Coinbase. Comparación: ${periodLabel()}. Se pausa al ocultar la página.`,
      reconnecting: `Se ha interrumpido la conexión. Reintento ${info.attempts} de 3 en ${info.delay / 1000} s; se iniciará una ventana nueva.`,
      stopped: info.reason === 'provider' ? 'El proveedor rechazó la suscripción. Reintenta más tarde.' : 'No se pudo recuperar la conexión tras 3 intentos. Pulsa Activar para reintentar.',
      paused: info.reason === 'hidden' ? 'La página está oculta: vigilancia pausada. Vuelve y pulsa Activar.' : 'Vigilancia pausada. Los últimos precios se conservan como datos anteriores; activa para iniciar una ventana nueva.'
    };
    $('radar-status').textContent = messages[state];
    draw();
  }
  function receive(message, now) {
    if (document.hidden) return false;
    const result = engine.ingest(message, now);
    if (!result) return false;
    quotes.set(result.product, result);
    let history = series.get(result.product) || [];
    if (history.length && result.time - history.at(-1).time > 15000) history = [];
    history = history.filter(row => result.time - row.time <= windowSeconds * 1000 + 2000);
    const sample = { time: result.time, price: result.price };
    if (history.length && Math.floor(history.at(-1).time / 1000) === Math.floor(result.time / 1000)) history[history.length - 1] = sample;
    else history.push(sample);
    series.set(result.product, history);
    if (result.signal) alert(result.signal);
    return true;
  }
  const feed = window.MomentumRadarFeed.create({ products, onMessage: receive, onState: connectionState });
  function alert(signal) {
    const text = `${names[signal.product]} · ${signal.direction === "up" ? "Subida" : "Caída"} ${signal.change.toFixed(2)} % · ${stamp(signal.time)} · ${money(signal.price)} · comparación de ${signal.windowSeconds / 60} min desde ${stamp(signal.baselineTime)} · umbral ${signal.threshold} % · confirmación ${signal.confirmationMs / 1000} s`;
    const row = document.createElement("li"); row.className = `detector-signal ${signal.direction}`;
    const label = document.createElement("p"); label.textContent = text;
    const link = document.createElement("a"); link.href = `/mercados?activo=${encodeURIComponent("COINBASE:" + signal.product.replace("-", ""))}#cotizacion`; link.textContent = "Revisar activo →";
    row.append(label, link); $("radar-signals").prepend(row);
    while ($("radar-signals").children.length > 20) $("radar-signals").lastElementChild.remove();
    $("radar-empty").hidden = true; $("radar-alert").textContent = text;
  }
  $('radar-start').addEventListener('click', () => {
    if (document.hidden || $('radar-start').disabled) return;
    windowSeconds = Number($('radar-window').value);
    confirmationMs = Number($('radar-confirmation').value);
    try { engine = core.create(Number($('radar-threshold').value), { windowSeconds, confirmationMs }); }
    catch (error) { $('radar-status').textContent = error.message; return; }
    quotes.clear(); series.clear(); feed.start();
  });
  $('radar-stop').addEventListener('click', () => feed.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) feed.pause('hidden'); });
  window.addEventListener('pagehide', () => feed.pause('hidden'));
  draw();
})();
