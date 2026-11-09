(function(){
 'use strict';
 const $=id=>document.getElementById(id), catalog=window.MomentumMarketCatalog, workspaceCore=window.MomentumWorkspace;
 const assets=catalog.assets;
 let store, workspace={version:1,favorites:[],notes:{}}, storageFailed=false;
 function read(){
  try{if(!store)store=workspaceCore.createStore(localStorage,catalog);workspace=store.read();}
  catch(_){storageFailed=true;$('pulse-watch-status').textContent='No se puede acceder a los datos guardados. Los cambios duran esta visita.';}
  return new Set(workspace.favorites);
 }
 let watched=read(),region='all',kind='all',period='1M';const timers=new Map();
 const regionNames={all:'Todo el mundo',america:'América',europa:'Europa',asia:'Asia',africa:'África',oceania:'Oceanía'};
 const regionRoutes={america:'america',europa:'europa',asia:'asia',africa:'africa',oceania:'oceania'};
 const assetHref=market=>`/mercados?activo=${encodeURIComponent(market)}#cotizacion`;
 const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 function toggle(market){
  if(!storageFailed)watched=read();
  watched.has(market)?watched.delete(market):watched.add(market);
  workspace.favorites=[...watched];
  try{if(!store)store=workspaceCore.createStore(localStorage,catalog);store.write(workspace);storageFailed=false;$('pulse-watch-status').textContent='Lista y favoritos guardados en este navegador.';}
  catch(_){storageFailed=true;$('pulse-watch-status').textContent='No se pudo guardar. La selección se conserva solo durante esta visita.';}
 }

 function render(){
  const q=$('assetSearch').value.trim().toLocaleLowerCase('es');
  const visible=assets.filter(a=>watched.has(a.market)&&(region==='all'||a.region===region)&&(kind==='all'||a.kind===kind)&&(!q||`${a.name} ${a.symbol}`.toLocaleLowerCase('es').includes(q)));
  const list=$('watchlist');list.replaceChildren();
  visible.forEach(asset=>{const row=create('div','pulse-watch-entry'),link=create('a'),mark=create('span','pulse-watch-mark',asset.symbol==='BTC'?'₿':asset.symbol.slice(0,1)),symbol=create('strong','',asset.symbol),name=create('small','',asset.name),remove=create('button','pulse-watch-remove','×');link.href=assetHref(asset.market);link.setAttribute('aria-label',`Abrir solo ${asset.name}, ${asset.symbol}`);mark.setAttribute('aria-hidden','true');link.append(mark,symbol,name);remove.type='button';remove.setAttribute('aria-label',`Quitar ${asset.symbol} de mi lista`);remove.addEventListener('click',()=>{toggle(asset.market);render();});row.append(link,remove);list.append(row);});
  if(!visible.length)list.append(create('p','pulse-watch-empty','No hay activos en tu lista con este filtro. Cambia la región, borra la búsqueda o añade un activo.'));
  $('pulse-watch-count').textContent=`${watched.size} activos`;
  $('pulse-region-status').textContent=`${regionNames[region]} · ${visible.length} visibles en tu lista`;
  $('pulse-region-link').href=region==='all'?'/mercados#global':`/mercados?region=${regionRoutes[region]}#global`;
  document.querySelectorAll('[data-region]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.region===region)));
  document.querySelectorAll('[data-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.kind===kind)));
  $('pulse-watch-selected').textContent=watched.has('NASDAQ:NVDA')?'★ NVIDIA en mi lista':'☆ Vigilar NVIDIA';$('pulse-watch-selected').setAttribute('aria-pressed',String(watched.has('NASDAQ:NVDA')));
 }
 document.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{region=button.dataset.region;render();}));
 document.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{kind=button.dataset.kind;render();}));
 $('assetSearch').addEventListener('input',render);
 $('pulse-watch-selected').addEventListener('click',()=>{toggle('NASDAQ:NVDA');render();});
 function choices(){
  const target=$('pulse-add-options'),active=document.activeElement?.dataset.market;
  const q=$('pulse-add-search').value.trim().toLocaleLowerCase('es');
  target.replaceChildren();
  assets.filter(asset=>`${asset.name} ${asset.symbol} ${asset.market}`.toLocaleLowerCase('es').includes(q)).forEach(asset=>{
   const button=create('button','',`${watched.has(asset.market)?'✓':'＋'} ${asset.symbol} · ${asset.name}`);
   button.type='button';button.dataset.market=asset.market;button.setAttribute('aria-pressed',String(watched.has(asset.market)));
   button.append(create('small','',asset.market));
   button.addEventListener('click',()=>{toggle(asset.market);render();choices();});target.append(button);
  });
  if(!target.children.length)target.append(create('p','pulse-help','No hay coincidencias. Prueba con otro nombre o símbolo.'));
  if(active)[...target.querySelectorAll('button')].find(button=>button.dataset.market===active)?.focus();
 }
 $('pulse-add-search').addEventListener('input',choices);
 $('pulse-add').addEventListener('click',()=>{$('pulse-add-search').value='';choices();$('pulse-add-dialog').showModal();$('pulse-add-search').focus();});
 document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
 const helps={change:['¿Qué ha cambiado?','El gráfico del proveedor muestra el recorrido del precio del activo seleccionado. Para comparar movimientos observados durante un minuto, abre el radar de criptomonedas.','/radar','Abrir radar de criptomonedas →'],data:['¿De dónde sale el dato?','Las cotizaciones y el gráfico proceden de TradingView y pueden tener retraso. El radar de criptomonedas recibe datos de Coinbase Exchange cuando lo activas. Las cifras dibujadas en el mapa son ejemplos del diseño.','/legal#datos-mercado','Ver fuentes y alcance →'],compare:['Compara dos activos','El comparador utiliza los archivos históricos CSV que cargas. Muestra la evolución de los dos activos sobre sus fechas comunes.','/comparar','Abrir comparador →'],scope:['¿Qué hace Pulse?','Este terminal conecta mercados, seguimiento local, gráficos y herramientas disponibles. El índice global y la explicación automática con IA están en desarrollo; no se ha calculado una señal de IA para NVIDIA en esta pantalla.','/centro-operaciones','Ver herramientas disponibles →']};
 document.querySelectorAll('[data-help]').forEach(button=>button.addEventListener('click',()=>{const info=helps[button.dataset.help],target=$('pulse-help-content');target.replaceChildren(create('h3','',info[0]),create('p','',info[1]));const link=create('a','',info[3]);link.href=info[2];target.append(link);$('pulse-help-dialog').showModal();}));
 function embed(id,widget,config,sourceUrl,statusId){
  const target=$(id);clearTimeout(timers.get(id));const container=create('div','tradingview-widget-container'),host=create('div','tradingview-widget-container__widget'),source=create('a','pulse-source','Datos por TradingView ↗');source.href=sourceUrl;source.target='_blank';source.rel='noopener noreferrer';
  const script=create('script');script.src=`https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;script.async=true;script.textContent=JSON.stringify(config);
  function failed(){if(!target.contains(container))return;if(statusId){$(statusId).textContent='No se pudo cargar el proveedor. Reintenta o abre la ficha del activo.';$(statusId).classList.add('error');}else{const fallback=create('a','pulse-source','Consultar las cotizaciones en Mercados →');fallback.href='/mercados';container.replaceChildren(create('p','pulse-placeholder','La fuente no está disponible ahora.'),fallback);}}
  script.addEventListener('error',failed);container.append(host,source,script);target.replaceChildren(container);timers.set(id,setTimeout(()=>{if(!container.querySelector('iframe'))failed();},15000));
 }
 const periods={'1D':['1D','5'],'5D':['5D','30'],'1M':['1M','60'],'3M':['3M','D'],'1A':['12M','D'],'2A':['24M','W']};
 function chart(next){if(!periods[next])return;period=next;document.querySelectorAll('[data-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period===period)));$('pulse-chart-status').classList.remove('error');$('pulse-chart-status').textContent='Precio, moneda y fecha se muestran en el gráfico del proveedor.';embed('pulse-chart-widget','advanced-chart',{autosize:true,symbol:'NASDAQ:NVDA',interval:periods[period][1],range:periods[period][0],timezone:'Europe/Madrid',theme:'dark',style:'1',locale:'es',backgroundColor:'rgba(3,16,24,1)',gridColor:'rgba(11,71,78,.3)',hide_top_toolbar:true,hide_legend:false,allow_symbol_change:false,save_image:false,support_host:'https://www.tradingview.com'},'https://www.tradingview.com/symbols/NASDAQ-NVDA/','pulse-chart-status');}
 document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>chart(button.dataset.period)));$('pulse-chart-retry').addEventListener('click',()=>chart(period));
 embed('pulse-index-widget','market-overview',{colorTheme:'dark',dateRange:'12M',locale:'es',width:'100%',height:'100%',showChart:false,showSymbolLogo:true,isTransparent:false,largeChartUrl:`${location.origin}/mercados`,tabs:[{title:'Índices',symbols:[{s:'FOREXCOM:SPXUSD',d:'S&P 500 · CFD'},{s:'FOREXCOM:NSXUSD',d:'NASDAQ · CFD'},{s:'FOREXCOM:DJI',d:'Dow Jones · CFD'},{s:'XETR:DAX',d:'DAX'},{s:'BME:IBC',d:'IBEX 35'}]}]},'https://www.tradingview.com/markets/');
 window.addEventListener('pagehide',()=>timers.forEach(timer=>clearTimeout(timer)));
 window.addEventListener('storage',event=>{if(event.key!==workspaceCore.STORAGE_KEY&&event.key!==null)return;watched=read();render();if($('pulse-add-dialog').open)choices();});
 render();chart(period);
})();
