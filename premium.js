const assets=[
{symbol:"AAPL",name:"Apple",region:"Norteamérica",move:1.8,price:"—",momentum:78,volume:"alto",vol:"media"},
{symbol:"ASML",name:"ASML Holding",region:"Europa",move:2.6,price:"—",momentum:84,volume:"muy alto",vol:"alta"},
{symbol:"7203",name:"Toyota",region:"Asia",move:-1.4,price:"—",momentum:39,volume:"alto",vol:"media"},
{symbol:"MELI",name:"MercadoLibre",region:"Latinoamérica",move:3.1,price:"—",momentum:88,volume:"muy alto",vol:"alta"},
{symbol:"NPN",name:"Naspers",region:"África",move:-2.2,price:"—",momentum:31,volume:"alto",vol:"alta"},
{symbol:"BHP",name:"BHP Group",region:"Oceanía",move:1.2,price:"—",momentum:67,volume:"medio",vol:"media"}];
const alerts=[
{symbol:"ASML",dir:"up",label:"Posible aceleración alcista",score:84,reason:"Momentum y volumen aumentan simultáneamente en esta demostración."},
{symbol:"NPN",dir:"down",label:"Debilitamiento relevante",score:79,reason:"La simulación combina pérdida de momentum y volatilidad elevada."},
{symbol:"MELI",dir:"up",label:"Salto de volumen",score:88,reason:"Volumen anómalo y aceleración del movimiento en el escenario demo."},
{symbol:"7203",dir:"down",label:"Presión bajista",score:65,reason:"Momentum bajo y persistencia negativa en la simulación."}];
let selected=assets[1],important=false;
const $=s=>document.querySelector(s);
function renderWatch(filter=""){
 const reg=$("#region").value, q=filter.trim().toLowerCase();
 const list=assets.filter(a=>(reg==="all"||a.region===reg)&&(!q||a.symbol.toLowerCase().includes(q)||a.name.toLowerCase().includes(q)));
 $("#watchlist").innerHTML=list.map(a=>`<div class="watchRow" data-symbol="${a.symbol}"><div><b>${a.symbol} · ${a.name}</b><small>${a.region}</small></div><span class="move ${a.move<0?"down":""}">${a.move>0?"+":""}${a.move.toFixed(1)}% DEMO</span></div>`).join("")||"<p class='note'>No hay activos demo con ese filtro.</p>";
 $("#watchCount").textContent=list.length+" activos";
 document.querySelectorAll(".watchRow").forEach(el=>el.onclick=()=>selectAsset(el.dataset.symbol));
}
function chart(score,down=false){
 let pts=[],y=150; for(let x=0;x<=700;x+=35){y+=((x*13+score*7)%31-15)+(down?3:-3);y=Math.max(35,Math.min(215,y));pts.push(x+","+y)}
 $("#chart").innerHTML=`<svg viewBox="0 0 700 250" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${down?"#ff4f78":"#35ff9a"}" stop-opacity=".25"/><stop offset="1" stop-color="#050a0f" stop-opacity="0"/></linearGradient></defs><path d="M${pts.join(" L")} L700 250 L0 250Z" fill="url(#g)"/><polyline points="${pts.join(" ")}" fill="none" stroke="${down?"#ff4f78":"#35ff9a"}" stroke-width="3"/></svg>`;
}
function selectAsset(symbol){
 selected=assets.find(a=>a.symbol===symbol)||selected; const al=alerts.find(a=>a.symbol===selected.symbol);
 $("#pulseScore").textContent=al?.score||selected.momentum; $("#mPrice").textContent=selected.price+" (sin feed)";$("#mMomentum").textContent=selected.momentum+"/100 demo";$("#mVolume").textContent=selected.volume;$("#mVolatility").textContent=selected.vol;
 chart(selected.momentum,selected.move<0);
 $("#explanation").innerHTML=`<h3>${selected.symbol} · ${al?.label||"En vigilancia"}</h3><p>${al?.reason||"Este activo está en la lista de vigilancia demo. El análisis real se activará al conectar un proveedor autorizado."}</p><p><b>Importante:</b> esta pantalla no usa todavía cotización en vivo y no constituye una recomendación de inversión.</p>`;
}
function renderAlerts(){
 const mode=$("#alertMode").value;
 const list=alerts.filter(a=>(!important||a.score>=80)&&(mode==="all"||mode===a.dir||(mode==="volume"&&a.label.toLowerCase().includes("volumen"))));
 $("#alertsList").innerHTML=list.map(a=>`<div class="alertRow" data-symbol="${a.symbol}"><b>${a.symbol}</b><span class="alertDir ${a.dir}">${a.dir==="up"?"▲ ALCISTA":"▼ BAJISTA"}</span><span>${a.label} · <small>DEMO</small></span><div class="strength" title="Intensidad demo ${a.score}/100"><i style="width:${a.score}%"></i></div></div>`).join("")||"<p class='note'>No hay alertas con este filtro.</p>";
 document.querySelectorAll(".alertRow").forEach(el=>el.onclick=()=>selectAsset(el.dataset.symbol));
}
$("#assetSearch").addEventListener("input",e=>renderWatch(e.target.value));
$("#region").addEventListener("change",()=>renderWatch($("#assetSearch").value));
$("#alertMode").addEventListener("change",renderAlerts);
document.querySelectorAll("[data-region]").forEach(b=>b.onclick=()=>{$("#region").value=b.dataset.region;renderWatch($("#assetSearch").value);document.querySelectorAll(".markets button").forEach(x=>x.classList.toggle("active",x.dataset.region===b.dataset.region))});
$("#importantOnly").onclick=e=>{important=!important;e.currentTarget.setAttribute("aria-pressed",important);renderAlerts()};
$("#scanBtn").onclick=()=>{renderWatch($("#assetSearch").value);renderAlerts();$("#dataStatus").textContent="ESCANEO DEMO COMPLETADO · feed real pendiente";setTimeout(()=>$("#dataStatus").textContent="MODO DEMO · proveedor pendiente",2500)};
$("#addDemo").onclick=()=>$("#assetSearch").focus();
document.querySelectorAll(".ask button").forEach(b=>b.onclick=()=>{const map={why:"La alerta se explica por los factores cuantitativos que la activan. En esta versión son datos demostrativos.",change:"La versión real comparará ventanas temporales para señalar qué variables cambiaron y cuándo.",against:"La IA también mostrará factores que contradigan la hipótesis para evitar una lectura unilateral.",compare:"La versión conectada comparará el patrón actual con históricos y situaciones semejantes."};$("#explanation").innerHTML=`<h3>${b.textContent}</h3><p>${map[b.dataset.q]}</p>`});
renderWatch();renderAlerts();selectAsset("ASML");