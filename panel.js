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
  let category="todos";
  const list=document.getElementById("asset-list"),query=document.getElementById("asset-filter"),empty=document.getElementById("asset-empty"),savedList=document.getElementById("saved-list"),count=document.getElementById("saved-count");
  function draw(){
    const text=query.value.trim().toLocaleLowerCase("es");
    const visible=assets.filter(a=>(category==="todos"||a.kind===category)&&`${a.symbol} ${a.name}`.toLocaleLowerCase("es").includes(text));
    list.replaceChildren(...visible.map(a=>{const row=document.createElement("tr"),name=document.createElement("td"),price=document.createElement("td"),change=document.createElement("td"),cell=document.createElement("td"),button=document.createElement("button"),strong=document.createElement("strong"),span=document.createElement("span");strong.textContent=a.symbol;span.textContent=a.name;name.append(strong,span);price.textContent=a.price;change.textContent=a.change;change.className=a.change.startsWith("+")?"positive":"negative";button.className="save-btn";button.type="button";button.textContent=saved.includes(a.symbol)?"★":"☆";button.setAttribute("aria-label",`${saved.includes(a.symbol)?"Quitar":"Guardar"} ${a.name} de mi lista`);button.setAttribute("aria-pressed",String(saved.includes(a.symbol)));button.addEventListener("click",()=>{saved=saved.includes(a.symbol)?saved.filter(x=>x!==a.symbol):[...saved,a.symbol];try{localStorage.setItem(key,JSON.stringify(saved));}catch(_error){}draw();});cell.append(button);row.append(name,price,change,cell);return row;}));
    empty.hidden=visible.length>0;count.textContent=`${saved.length} ${saved.length===1?"activo":"activos"}`;
    savedList.replaceChildren(...saved.map(symbol=>{const a=assets.find(item=>item.symbol===symbol),li=document.createElement("li"),strong=document.createElement("strong"),span=document.createElement("span");strong.textContent=a.symbol;span.textContent=a.name;li.append(strong,span);return li;}));
  }
  query.addEventListener("input",draw);
  document.querySelectorAll("[data-filter]").forEach(button=>button.addEventListener("click",()=>{category=button.dataset.filter;document.querySelectorAll("[data-filter]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));draw();}));
  draw();
})();
