(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MomentumMarketRoute=factory();})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function href(symbol){return `/mercados?activo=${encodeURIComponent(symbol)}#cotizacion`;}
 function parse(input,known){const url=new URL(input,'https://momentumvelo.invalid'),i=url.hash.indexOf('?'),fragment=new URLSearchParams(i>=0?url.hash.slice(i+1):''),query=url.searchParams,source=query.has('activo')||query.has('tvwidgetsymbol')?query:fragment,requested=source.has('activo')||source.has('tvwidgetsymbol'),raw=source.has('activo')?source.get('activo'):source.get('tvwidgetsymbol'),symbol=typeof raw==='string'?raw.trim().toUpperCase():'',valid=requested&&known.includes(symbol);return {requested,valid,symbol:valid?symbol:null,href:valid?href(symbol):null};}
 return {href,parse};
});
