(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MomentumMarketRoute=factory();})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const aliases = new Map([['FOREXCOM:SPX500','FOREXCOM:SPXUSD'],['SPXUSD','FOREXCOM:SPXUSD'],['FOREXCOM:NAS100','FOREXCOM:NSXUSD'],['NSXUSD','FOREXCOM:NSXUSD'],['FOREXCOM:US30','FOREXCOM:DJI'],['DJI','FOREXCOM:DJI'],['DAX','XETR:DAX'],['IBC','BME:IBC']]);
 function href(symbol){return `/mercados?activo=${encodeURIComponent(symbol)}#cotizacion`;}
 function parse(input,known){const url=new URL(input,'https://momentumvelo.invalid'),i=url.hash.indexOf('?'),fragment=new URLSearchParams(i>=0?url.hash.slice(i+1):''),query=url.searchParams,source=query.has('activo')||query.has('tvwidgetsymbol')?query:fragment,requested=source.has('activo')||source.has('tvwidgetsymbol'),raw=source.has('activo')?source.get('activo'):source.get('tvwidgetsymbol'),normalized=typeof raw==='string'?raw.trim().toUpperCase():'',symbol=known.includes(normalized)?normalized:aliases.get(normalized),valid=requested&&known.includes(symbol);return {requested,valid,symbol:valid?symbol:null,href:valid?href(symbol):null};}
 return {href,parse};
});
