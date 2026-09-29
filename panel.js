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
  let category="todos",selected=null;
  const list=document.getElementById("asset-list"),query=document.getElementById("asset-filter"),empty=document.getElementById("asset-empty"),savedList=document.getElementById("saved-list"),count=document.getElementById("saved-count"),analysisSymbol=document.getElementById("analysis-symbol"),analysisName=document.getElementById("analysis-name"),analysisPrice=document.getElementById("analysis-price"),analysisChange=document.getElementById("analysis-change"),analysisKind=document.getElementById("analysis-kind"),analysisSave=document.getElementById("analysis-save"),savedEmpty=document.getElementById("saved-empty"),clearList=document.getElementById("clear-list"),navCount=document.getElementById("nav-saved-count");
  function selectAsset(a){selected=a.symbol;analysisSymbol.textContent=a.symbol;analysisName.textContent=a.name;analysisPrice.textContent=a.price;analysisChange.textContent=a.change;analysisChange.className=a.change.startsWith("+")?"positive":"negative";analysisKind.textContent=a.kind.charAt(0).toUpperCase()+a.kind.slice(1);analysisSave.disabled=false;analysisSave.textContent=saved.includes(a.symbol)?"★ Quitar de Mi lista":"☆ Guardar en Mi lista";document.getElementById("analisis").scrollIntoView({behavior:"smooth",block:"start"});}
  function draw(){
    const text=query.value.trim().toLocaleLowerCase("es");
    const visible=assets.filter(a=>(category==="todos"||a.kind===category)&&`${a.symbol} ${a.name}`.toLocaleLowerCase("es").includes(text));
    list.replaceChildren(...visible.map(a=>{const row=document.createElement("tr"),name=document.createElement("td"),price=document.createElement("td"),change=document.createElement("td"),cell=document.createElement("td"),button=document.createElement("button"),strong=document.createElement("strong"),span=document.createElement("span");strong.textContent=a.symbol;span.textContent=a.name;name.append(strong,span);price.textContent=a.price;change.textContent=a.change;change.className=a.change.startsWith("+")?"positive":"negative";row.tabIndex=0;row.className="asset-row";row.setAttribute("aria-label",`Abrir análisis de ${a.name}`);row.addEventListener("click",event=>{if(!event.target.closest(".save-btn"))selectAsset(a);});row.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&!event.target.closest(".save-btn")){event.preventDefault();selectAsset(a);}});button.className="save-btn";button.type="button";button.textContent=saved.includes(a.symbol)?"★":"☆";button.setAttribute("aria-label",`${saved.includes(a.symbol)?"Quitar":"Guardar"} ${a.name} de mi lista`);button.setAttribute("aria-pressed",String(saved.includes(a.symbol)));button.addEventListener("click",()=>{saved=saved.includes(a.symbol)?saved.filter(x=>x!==a.symbol):[...saved,a.symbol];try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();if(selected===a.symbol)selectAsset(a);});cell.append(button);row.append(name,price,change,cell);return row;}));
    empty.hidden=visible.length>0;count.textContent=`${saved.length} ${saved.length===1?"activo":"activos"}`;navCount.textContent=String(saved.length);savedEmpty.hidden=saved.length>0;clearList.hidden=saved.length===0;
    savedList.replaceChildren(...saved.map(symbol=>{const a=assets.find(item=>item.symbol===symbol),li=document.createElement("li"),open=document.createElement("button"),label=document.createElement("span"),strong=document.createElement("strong"),name=document.createElement("span"),remove=document.createElement("button");open.type="button";open.className="saved-open";open.setAttribute("aria-label",`Abrir análisis de ${a.name}`);strong.textContent=a.symbol;name.textContent=a.name;label.append(strong,name);open.append(label);open.addEventListener("click",()=>selectAsset(a));remove.type="button";remove.className="saved-remove";remove.textContent="×";remove.setAttribute("aria-label",`Quitar ${a.name} de Mi lista`);remove.addEventListener("click",()=>{saved=saved.filter(x=>x!==a.symbol);try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();if(selected===a.symbol)selectAsset(a);});li.append(open,remove);return li;}));
  }
  query.addEventListener("input",draw);
  document.querySelectorAll("[data-filter]").forEach(button=>button.addEventListener("click",()=>{category=button.dataset.filter;document.querySelectorAll("[data-filter]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));draw();}));
  clearList.addEventListener("click",()=>{saved=[];try{localStorage.setItem(key,"[]");}catch(_error){}draw();if(selected){const a=assets.find(item=>item.symbol===selected);if(a)selectAsset(a);}});
  analysisSave.addEventListener("click",()=>{const a=assets.find(item=>item.symbol===selected);if(!a)return;saved=saved.includes(a.symbol)?saved.filter(x=>x!==a.symbol):[...saved,a.symbol];try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();selectAsset(a);});
  draw();
})();
