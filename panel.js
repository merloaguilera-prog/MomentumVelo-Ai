(function(){
  "use strict";
  const assets=[
    {symbol:"AAPL",name:"Apple",kind:"acciones",price:"229,87",change:"+1,42 %"},
    {symbol:"NVDA",name:"Nvidia",kind:"acciones",price:"138,05",change:"+3,11 %"},
    {symbol:"TSLA",name:"Tesla",kind:"acciones",price:"412,60",change:"−0,86 %"},
    {symbol:"MSFT",name:"Microsoft",kind:"acciones",price:"441,19",change:"+0,74 %"},
    {symbol:"SPX",name:"S&P 500",kind:"indices",price:"5.432,18",change:"+1,24 %"},
    {symbol:"BTC",name:"Bitcoin",kind:"cripto",price:"65.431,20",change:"+2,31 %"}
  ];
  const key="momentumvelo.demo.watchlist.v1";
  let saved=[];
  try{const value=JSON.parse(localStorage.getItem(key)||"[]");if(Array.isArray(value))saved=value.filter(x=>assets.some(a=>a.symbol===x));}catch(_error){}
  let category="todos",selected=null,chartPeriod="6m";
  const chartLabels={"1d":"1 día","1m":"1 mes","6m":"6 meses","1y":"1 año","2y":"2 años"};
  const chart=document.getElementById("asset-chart"),chartSvg=document.getElementById("chart-svg"),chartArea=document.getElementById("chart-area"),chartLine=document.getElementById("chart-line"),chartCaption=document.getElementById("chart-caption");
  const list=document.getElementById("asset-list"),query=document.getElementById("asset-filter"),empty=document.getElementById("asset-empty"),savedList=document.getElementById("saved-list"),count=document.getElementById("saved-count"),analysisSymbol=document.getElementById("analysis-symbol"),analysisName=document.getElementById("analysis-name"),analysisPrice=document.getElementById("analysis-price"),analysisChange=document.getElementById("analysis-change"),analysisKind=document.getElementById("analysis-kind"),analysisSave=document.getElementById("analysis-save"),savedEmpty=document.getElementById("saved-empty"),clearList=document.getElementById("clear-list"),navCount=document.getElementById("nav-saved-count"),analysisBack=document.getElementById("analysis-back"),signalOpen=document.getElementById("signal-open"),resetMarket=document.getElementById("reset-market"),emptyReset=document.getElementById("empty-reset"),marketResults=document.getElementById("market-results");
  function renderChart(){
    if(!selected)return;
    const a=assets.find(item=>item.symbol===selected);
    const seed=Array.from(selected).reduce((sum,letter)=>sum+letter.charCodeAt(0),0)+Object.keys(chartLabels).indexOf(chartPeriod)*17;
    const points=Array.from({length:44},(_,index)=>{
      const t=index/43;
      const level=.49+.18*Math.sin((t*2.8+seed*.13)*Math.PI)+.09*Math.sin((t*10+seed*.31)*Math.PI)+.13*(t-.5)*((seed%5)-2);
      return [+(t*600).toFixed(1),+(120-level*155).toFixed(1)];
    });
    const line=points.map(([x,y],index)=>`${index?"L":"M"}${x} ${y}`).join(" ");
    chartLine.setAttribute("d",line);
    chartArea.setAttribute("d",`${line} L600 220 L0 220 Z`);
    chartSvg.setAttribute("aria-label",`Curva simulada para ${a.name}, periodo ${chartLabels[chartPeriod]}. No representa precios reales.`);
    chartCaption.textContent=`${a.name} · ${chartLabels[chartPeriod]}: curva ilustrativa generada para esta demo. No representa cotizaciones ni fechas reales.`;
    chart.hidden=false;
  }
  function selectAsset(a){selected=a.symbol;analysisSymbol.textContent=a.symbol;analysisName.textContent=a.name;analysisPrice.textContent=a.price;analysisChange.textContent=a.change;analysisChange.className=a.change.startsWith("+")?"positive":"negative";analysisKind.textContent=a.kind.charAt(0).toUpperCase()+a.kind.slice(1);analysisSave.disabled=false;analysisBack.disabled=false;analysisSave.textContent=saved.includes(a.symbol)?"★ Quitar de Mi lista":"☆ Guardar en Mi lista";renderChart();document.getElementById("analisis").scrollIntoView({behavior:"smooth",block:"start"});}
  function draw(){
    const text=query.value.trim().toLocaleLowerCase("es");
    const visible=assets.filter(a=>(category==="todos"||a.kind===category)&&`${a.symbol} ${a.name}`.toLocaleLowerCase("es").includes(text));
    list.replaceChildren(...visible.map(a=>{const row=document.createElement("tr"),name=document.createElement("td"),price=document.createElement("td"),change=document.createElement("td"),cell=document.createElement("td"),button=document.createElement("button"),strong=document.createElement("strong"),span=document.createElement("span");strong.textContent=a.symbol;span.textContent=a.name;name.append(strong,span);price.textContent=a.price;change.textContent=a.change;change.className=a.change.startsWith("+")?"positive":"negative";row.tabIndex=0;row.className="asset-row";row.setAttribute("aria-label",`Abrir análisis de ${a.name}`);row.addEventListener("click",event=>{if(!event.target.closest(".save-btn"))selectAsset(a);});row.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&!event.target.closest(".save-btn")){event.preventDefault();selectAsset(a);}});button.className="save-btn";button.type="button";button.textContent=saved.includes(a.symbol)?"★":"☆";button.setAttribute("aria-label",`${saved.includes(a.symbol)?"Quitar":"Guardar"} ${a.name} de mi lista`);button.setAttribute("aria-pressed",String(saved.includes(a.symbol)));button.addEventListener("click",()=>{saved=saved.includes(a.symbol)?saved.filter(x=>x!==a.symbol):[...saved,a.symbol];try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();if(selected===a.symbol)selectAsset(a);});cell.append(button);row.append(name,price,change,cell);return row;}));
    empty.hidden=visible.length>0;marketResults.textContent=`${visible.length} ${visible.length===1?"activo visible":"activos visibles"} · datos DEMO`;resetMarket.hidden=!text&&category==="todos";count.textContent=`${saved.length} ${saved.length===1?"activo":"activos"}`;navCount.textContent=String(saved.length);savedEmpty.hidden=saved.length>0;clearList.hidden=saved.length===0;
    savedList.replaceChildren(...saved.map(symbol=>{const a=assets.find(item=>item.symbol===symbol),li=document.createElement("li"),open=document.createElement("button"),label=document.createElement("span"),strong=document.createElement("strong"),name=document.createElement("span"),remove=document.createElement("button");open.type="button";open.className="saved-open";open.setAttribute("aria-label",`Abrir análisis de ${a.name}`);strong.textContent=a.symbol;name.textContent=a.name;label.append(strong,name);open.append(label);open.addEventListener("click",()=>selectAsset(a));remove.type="button";remove.className="saved-remove";remove.textContent="×";remove.setAttribute("aria-label",`Quitar ${a.name} de Mi lista`);remove.addEventListener("click",()=>{saved=saved.filter(x=>x!==a.symbol);try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();if(selected===a.symbol)selectAsset(a);});li.append(open,remove);return li;}));
  }
  function resetMarketView(){query.value="";category="todos";document.querySelectorAll("[data-filter]").forEach(item=>item.setAttribute("aria-pressed",String(item.dataset.filter==="todos")));draw();query.focus();}
  query.addEventListener("input",draw);
  resetMarket.addEventListener("click",resetMarketView);
  emptyReset.addEventListener("click",resetMarketView);
  document.querySelectorAll("[data-filter]").forEach(button=>button.addEventListener("click",()=>{category=button.dataset.filter;document.querySelectorAll("[data-filter]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));draw();}));
  document.querySelectorAll("[data-chart-period]").forEach(button=>button.addEventListener("click",()=>{chartPeriod=button.dataset.chartPeriod;document.querySelectorAll("[data-chart-period]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));renderChart();}));
  clearList.addEventListener("click",()=>{saved=[];try{localStorage.setItem(key,"[]");}catch(_error){}draw();if(selected){const a=assets.find(item=>item.symbol===selected);if(a)selectAsset(a);}});
  signalOpen.addEventListener("click",()=>{const a=assets.find(item=>item.symbol==="NVDA");if(a)selectAsset(a);});
  analysisBack.addEventListener("click",()=>{document.getElementById("mercados").scrollIntoView({behavior:"smooth",block:"start"});if(selected){window.setTimeout(()=>{const row=Array.from(document.querySelectorAll(".asset-row")).find(item=>item.textContent.includes(selected));if(row)row.focus();},450);}});
  analysisSave.addEventListener("click",()=>{const a=assets.find(item=>item.symbol===selected);if(!a)return;saved=saved.includes(a.symbol)?saved.filter(x=>x!==a.symbol):[...saved,a.symbol];try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();selectAsset(a);});
  draw();
})();
