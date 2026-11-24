const{test}=require('node:test'),assert=require('node:assert/strict'),route=require('../market-route-core');const known=['NASDAQ:MELI','NASDAQ:AAPL','COINBASE:BTCUSD'];
test('provider query and old fragment query select exactly MercadoLibre',()=>{for(const url of ['/mercados?tvwidgetsymbol=NASDAQ%3AMELI','/mercados#cotizacion?tvwidgetsymbol=NASDAQ%3AMELI'])assert.deepEqual(route.parse(url,known),{requested:true,valid:true,symbol:'NASDAQ:MELI',href:'/mercados?activo=NASDAQ%3AMELI#cotizacion'});});
test('native asset links round trip without affecting region navigation',()=>{for(const s of known)assert.equal(route.parse(route.href(s),known).symbol,s);assert.equal(route.parse('/mercados?region=europa#global',known).requested,false);});
test('unknown, empty and malformed choices do not select a different asset',()=>{for(const url of ['/mercados?activo=','/mercados?activo=BAD:UNKNOWN','/mercados#cotizacion?tvwidgetsymbol=%3Cscript%3E']){const r=route.parse(url,known);assert.equal(r.requested,true);assert.equal(r.valid,false);assert.equal(r.symbol,null);}});

test('provider index aliases resolve only to the same known instrument',()=>{
 const pairs=[['FOREXCOM:SPX500','FOREXCOM:SPXUSD'],['SPXUSD','FOREXCOM:SPXUSD'],['FOREXCOM:NAS100','FOREXCOM:NSXUSD'],['NSXUSD','FOREXCOM:NSXUSD'],['FOREXCOM:US30','FOREXCOM:DJI'],['DJI','FOREXCOM:DJI'],['DAX','XETR:DAX'],['IBC','BME:IBC']];
 const indexes=pairs.map(pair=>pair[1]);
 for(const [alias,symbol] of pairs){assert.equal(route.parse('/mercados?tvwidgetsymbol='+encodeURIComponent(alias),indexes).symbol,symbol);assert.equal(route.parse('/mercados?tvwidgetsymbol='+encodeURIComponent(alias),known).valid,false);}
});
