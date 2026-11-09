(function(){
 'use strict';
 const $=id=>document.getElementById(id),KEY='momentumvelo.premium.watchlist.v1';
 const assets=[
  {symbol:'NVDA',market:'NASDAQ:NVDA',name:'NVIDIA',region:'america',kind:'stock'},
  {symbol:'AAPL',market:'NASDAQ:AAPL',name:'Apple Inc.',region:'america',kind:'stock'},
  {symbol:'MSFT',market:'NASDAQ:MSFT',name:'Microsoft',region:'america',kind:'stock'},
  {symbol:'TSLA',market:'NASDAQ:TSLA',name:'Tesla',region:'america',kind:'stock'},
  {symbol:'ASML',market:'NASDAQ:ASML',name:'ASML Holding',region:'europa',kind:'stock'},
  {symbol:'MELI',market:'NASDAQ:MELI',name:'MercadoLibre',region:'america',kind:'stock'},
  {symbol:'7203',market:'TSE:7203',name:'Toyota',region:'asia',kind:'stock'},
  {symbol:'NPN',market:'JSE:NPN',name:'Naspers',region:'africa',kind:'stock'},
  {symbol:'BHP',market:'ASX:BHP',name:'BHP Group',region:'oceania',kind:'stock'},
  {symbol:'SAN',market:'BME:SAN',name:'Santander',region:'europa',kind:'stock'},
  {symbol:'IBE',market:'BME:IBE',name:'Iberdrola',region:'europa',kind:'stock'},
  {symbol:'BTC',market:'COINBASE:BTCUSD',name:'Bitcoin / USD',region:'all',kind:'crypto'},
  {symbol:'ETH',market:'COINBASE:ETHUSD',name:'Ethereum / USD',region:'all',kind:'crypto'},
  {symbol:'SOL',market:'COINBASE:SOLUSD',name:'Solana / USD',region:'all',kind:'crypto'}
 ];
 const defaults=['AAPL','ASML','7203','MELI','NPN'];
 function read(){try{const raw=localStorage.getItem(KEY);if(raw===null)return defaults;const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(symbol=>assets.some(asset=>asset.symbol===symbol)):defaults;}catch(_){return defaults;}}
 const watched=new Set(read());let region='all',kind='all',period='1M';const timers=new Map();
 const regionNames={all:'Todo el mundo',america:'América',europa:'Europa',asia:'Asia',africa:'África',oceania:'Oceanía'};
 const regionRoutes={america:'america',europa:'europa',asia:'asia',africa:'africa',oceania:'oceania'};
 const assetHref=market=>`/mercados?activo=${encodeURIComponent(market)}#cotizacion`;
 const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 function save(){try{localStorage.setItem(KEY,JSON.stringify([...watched]));$('pulse-watch-status').textContent='Lista guardada en este navegador.';}catch(_){$('pulse-watch-status').textContent='No se pudo guardar. La selección se conserva solo durante esta visita.';}}
 function render(){
  const q=$('assetSearch').value.trim().toLocaleLowerCase('es');
  const visible=assets.filter(a=>watched.has(a.symbol)&&(region==='all'||a.region===region)&&(kind==='all'||a.kind===kind)&&(!q||`${a.name} ${a.symbol}`.toLocaleLowerCase('es').includes(q)));
  const list=$('watchlist');list.replaceChildren();
  visible.forEach(asset=>{const row=create('div','pulse-watch-entry'),link=create('a'),mark=create('span','pulse-watch-mark',asset.symbol==='BTC'?'₿':asset.symbol.slice(0,1)),symbol=create('strong','',asset.symbol),name=create('small','',asset.name),remove=create('button','pulse-watch-remove','×');link.href=assetHref(asset.market);link.setAttribute('aria-label',`Abrir solo ${asset.name}, ${asset.symbol}`);mark.setAttribute('aria-hidden','true');link.append(mark,symbol,name);remove.type='button';remove.setAttribute('aria-label',`Quitar ${asset.symbol} de mi lista`);remove.addEventListener('click',()=>{watched.delete(asset.symbol);save();render();});row.append(link,remove);list.append(row);});
  if(!visible.length)list.append(create('p','pulse-watch-empty','No hay activos en tu lista con este filtro. Cambia la región, borra la búsqueda o añade un activo.'));
  $('pulse-watch-count').textContent=`${watched.size} activos`;
  $('pulse-region-status').textContent=`${regionNames[region]} · ${visible.length} visibles en tu lista`;
  $('pulse-region-link').href=region==='all'?'/mercados#global':`/mercados?region=${regionRoutes[region]}#global`;
  document.querySelectorAll('[data-region]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.region===region)));
  document.querySelectorAll('[data-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.kind===kind)));
  $('pulse-watch-selected').textContent=watched.has('NVDA')?'★ NVIDIA en mi lista':'☆ Vigilar NVIDIA';$('pulse-watch-selected').setAttribute('aria-pressed',String(watched.has('NVDA')));
 }
 document.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{region=button.dataset.region;render();}));
 document.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{kind=button.dataset.kind;render();}));
 $('assetSearch').addEventListener('input',render);
 $('pulse-watch-selected').addEventListener('click',()=>{watched.has('NVDA')?watched.delete('NVDA'):watched.add('NVDA');save();render();});
 function choices(){const target=$('pulse-add-options');target.replaceChildren();assets.forEach(asset=>{const button=create('button','',`${watched.has(asset.symbol)?'✓':'＋'} ${asset.symbol} · ${asset.name}`);button.type='button';button.setAttribute('aria-pressed',String(watched.has(asset.symbol)));button.append(create('small','',asset.market));button.addEventListener('click',()=>{watched.has(asset.symbol)?watched.delete(asset.symbol):watched.add(asset.symbol);save();render();choices();const replacement=[...target.querySelectorAll('button')].find(x=>x.textContent.includes(asset.market));if(replacement)replacement.focus();});target.append(button);});}
 $('pulse-add').addEventListener('click',()=>{choices();$('pulse-add-dialog').showModal();});
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
 render();chart(period);
})();
