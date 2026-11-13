const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../radar-feed');
function fixture() {
  let time = Date.parse('2026-11-13T12:00:00Z'), id = 0;
  const sockets = [], timers = new Map(), intervals = new Map(), states = [], messages = [];
  class Socket {
    constructor() { sockets.push(this); }
    send(value) { this.sent = JSON.parse(value); }
    close() { this.closed = true; if(this.onclose)this.onclose(); }
  }
  const feed = create({ products:['BTC-USD'], Socket, now:()=>time,
    onMessage:message=>{messages.push(message);return message.type==='ticker'&&message.price==='valid';},
    onState:(state,info)=>states.push({state,...info}),
    later:(callback,delay)=>{timers.set(++id,{callback,delay});return id;},cancel:key=>timers.delete(key),
    every:callback=>{intervals.set(++id,callback);return id;},stopEvery:key=>intervals.delete(key)
  });
  return {feed,sockets,timers,intervals,states,messages,
    advance:ms=>{time+=ms;},watch:()=>[...intervals.values()].forEach(callback=>callback()),
    retry:()=>{const [key,entry]=[...timers.entries()][0];timers.delete(key);entry.callback();},
    send:message=>sockets.at(-1).onmessage({data:JSON.stringify(message)}),
    heartbeat:()=>({type:'heartbeat',product_id:'BTC-USD',time:new Date(time).toISOString()})
  };
}
test('reconnects with bounded backoff, ignores the old socket and stops after three retries', () => {
  const f=fixture();f.feed.start();f.feed.start();assert.equal(f.sockets.length,1);
  for(const delay of [2000,4000,8000]) {
    const old=f.sockets.at(-1);old.onerror();old.onclose();
    assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,delay);
    old.onmessage({data:'{"type":"ticker","price":"valid"}'});assert.equal(f.messages.length,0);
    f.retry();
  }
  f.sockets.at(-1).onclose();
  assert.equal(f.states.at(-1).state,'stopped');assert.equal(f.timers.size,0);assert.equal(f.intervals.size,0);
});
test('valid heartbeats keep transport open without being reported as prices', () => {
  const f=fixture();f.feed.start();f.sockets[0].onopen();
  assert.deepEqual(f.sockets[0].sent.channels,['ticker','heartbeat']);
  f.advance(19000);f.send(f.heartbeat());f.advance(5000);f.watch();
  assert.equal(f.states.at(-1).state,'waiting');assert.equal(f.messages.length,0);assert.equal(f.timers.size,0);
  f.send({type:'ticker',price:'valid'});assert.equal(f.states.at(-1).state,'receiving');
});
test('stale or foreign heartbeat messages and rejected quotes cannot mask a silent feed', () => {
  const f=fixture();f.feed.start();const heartbeat=f.heartbeat();f.advance(21000);
  f.send(heartbeat);f.send({...f.heartbeat(),product_id:'UNKNOWN'});f.send({type:'ticker',price:'invalid'});f.watch();
  assert.equal(f.states.at(-1).state,'reconnecting');assert.equal(f.states.at(-1).reason,'timeout');
});
test('pause cancels scheduled reconnection and a new activation starts with a fresh allowance', () => {
  const f=fixture();f.feed.start();f.sockets[0].onclose();f.feed.pause('hidden');
  assert.equal(f.timers.size,0);assert.equal(f.intervals.size,0);assert.equal(f.states.at(-1).reason,'hidden');
  f.feed.start();assert.equal(f.states.at(-1).attempts,0);
});
test('provider refusal stops immediately without repeated subscription attempts', () => {
  const f=fixture();f.feed.start();f.send({type:'error',message:'private vendor details'});
  assert.equal(f.states.at(-1).state,'stopped');assert.equal(f.states.at(-1).reason,'provider');assert.equal(f.timers.size,0);
});
