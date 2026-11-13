const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const core=require('../radar-core');
function page(){
 class Element{
  constructor(){this.children=[];this.dataset={};this.listeners={};this.attributes={};this.textContent='';}
  append(...nodes){nodes.forEach(node=>{node.parent=this;this.children.push(node);});}
  prepend(node){node.parent=this;this.children.unshift(node);}
  remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
  get lastElementChild(){return this.children.at(-1);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(key,fn){this.listeners[key]=fn;}
 }
 const nodes=Object.fromEntries(['radar-start','radar-stop','radar-window','radar-confirmation','radar-threshold','radar-quotes','radar-status','radar-signals','radar-empty','radar-alert'].map(id=>[id,new Element()]));
 nodes['radar-window'].value='300';nodes['radar-confirmation'].value='1000';nodes['radar-threshold'].value='0.5';
 let callbacks,clock=Date.parse('2026-11-13T12:00:00Z');const intervals=new Map();let id=0;
 class ClockDate extends Date{static now(){return clock;}}
 const document={hidden:false,listeners:{},getElementById:id=>nodes[id],createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(key,fn){this.listeners[key]=fn;}};
 const window={
   MomentumLiveRadar:core,
   MomentumRadarFeed:{create(config){
     callbacks=config;
     return {
       start(){config.onState('connecting',{attempts:0});config.onState('waiting',{attempts:0});},
       pause(reason){config.onState('paused',{reason});}
     };
   }},
   addEventListener(){}
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../radar.js'),'utf8'),{window,document,Date:ClockDate,setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:key=>intervals.delete(key)});
 return{nodes,document,intervals,get callbacks(){return callbacks;},tick(second,price=100){clock=Date.parse('2026-11-13T12:00:00Z')+second*1000;const accepted=callbacks.onMessage({type:'ticker',product_id:'BTC-USD',price:String(price),sequence:second+1,time:new Date(clock).toISOString()},clock);if(accepted)callbacks.onState('receiving',{});},paint(){intervals.forEach(fn=>fn());}};
}
test('selected window reaches UI, signals show their rules and pause retains the last price',()=>{
 const p=page(),cards=p.nodes['radar-quotes'].children;
 assert.equal(cards.length,3);const first=cards[0];
 p.nodes['radar-start'].listeners.click();assert.equal(p.nodes['radar-window'].disabled,true);
 for(let i=0;i<=300;i++)p.tick(i,i===300?101:100);
 p.paint();assert.equal(p.nodes['radar-signals'].children.length,0);
 p.tick(301,101);p.paint();
 assert.equal(p.nodes['radar-quotes'].children[0],first);
 assert.match(p.nodes['radar-signals'].children[0].children[0].textContent,/5 min.*umbral 0.5 %.*confirmación 1 s/);
 assert.match(first.children[3].textContent,/≈5 min/);
 const price=first.children[2].textContent;
 p.nodes['radar-stop'].listeners.click();
 assert.equal(first.children[2].textContent,price);assert.equal(first.dataset.state,'paused');assert.equal(p.intervals.size,0);
 assert.equal(p.nodes['radar-window'].disabled,false);
});
test('hiding the page pauses and reactivation starts a clean selected window',()=>{
 const p=page();p.nodes['radar-start'].listeners.click();p.tick(0);p.paint();
 p.document.hidden=true;p.document.listeners.visibilitychange();assert.match(p.nodes['radar-status'].textContent,/oculta/);
 p.document.hidden=false;p.nodes['radar-window'].value='900';p.nodes['radar-start'].listeners.click();
 assert.equal(p.nodes['radar-quotes'].children[0].children[2].textContent,'—');
 p.tick(1);p.paint();assert.match(p.nodes['radar-quotes'].children[0].children[5].textContent,/900 s/);
});
