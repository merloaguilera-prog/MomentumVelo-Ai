const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../workspace-core");
const symbols = ["NASDAQ:NVDA", "BME:IBE", "NASDAQ:AAPL"];
const assets = [{symbol:symbols[0],label:"Nvidia"},{symbol:symbols[1],label:"Iberdróla"},{symbol:symbols[2],label:"Apple"}];
const wrap = data => JSON.stringify({format:"momentumvelo-workspace",version:1,...data});
test("all notes include non-favorite assets, ignore whitespace and retain literal text", () => {
  const state={favorites:[],notes:{[symbols[0]]:" ",[symbols[1]]:"original",[symbols[2]]:"<b>sin HTML</b>","OTHER:X":"unknown"}};
  const before=JSON.stringify(state);
  assert.deepEqual(core.listNotes(state,assets).map(a=>[a.symbol,a.text]),[[symbols[2],"<b>sin HTML</b>"],[symbols[1],"original"]]);
  assert.equal(JSON.stringify(state),before);
});
test("favorite filters preserve saved order, match accented names/tickers and identify actual notes", () => {
  const state={favorites:symbols,notes:{[symbols[0]]:"   ",[symbols[1]]:"revisar"}};
  assert.deepEqual(core.filterFavorites(state,assets,"",false,"added").map(a=>a.symbol),symbols);
  assert.equal(core.filterFavorites(state,assets,"iberdrola",false,"added")[0].symbol,symbols[1]);
  assert.equal(core.filterFavorites(state,assets,"AAPL",false,"added")[0].label,"Apple");
  assert.deepEqual(core.filterFavorites(state,assets,"",true,"added").map(a=>a.symbol),[symbols[1]]);
  assert.deepEqual(core.filterFavorites(state,assets,"",false,"name").map(a=>a.label),["Apple","Iberdróla","Nvidia"]);
});
test("backup round trip includes notes on non-favorites, Unicode and literal markup", () => {
  const state={favorites:[symbols[0]],notes:{[symbols[2]]:"✎ <script>alert(1)</script>",[symbols[1]]:"Á".repeat(2000)}};
  const text=core.serializeBackup(state,symbols,new Date("2026-10-13T00:00:00Z"));
  assert.deepEqual(core.parseBackup(text,symbols),{version:1,...state});
  const all=Array.from({length:11},(_,i)=>`X:${i}`);
  const worst={favorites:all,notes:Object.fromEntries(all.map(s=>[s,"\u0000".repeat(2000)]))};
  assert.deepEqual(core.parseBackup(core.serializeBackup(worst,all),all),{version:1,...worst});
});
test("imports reject malformed, oversized, foreign-symbol and dangerous-key backups atomically", () => {
  const valid={favorites:[],notes:{}};
  for(const text of ["{",wrap({...valid,version:2}),wrap({...valid,favorites:["OTHER:X"]}),wrap({...valid,notes:{[symbols[0]]:9}}),wrap({...valid,notes:{[symbols[0]]:"a".repeat(2001)}}),'{"format":"momentumvelo-workspace","version":1,"favorites":[],"notes":{"__proto__":"bad"}}']) {
    assert.throws(()=>core.parseBackup(text,symbols));
  }
  assert.throws(()=>core.parseBackup("á".repeat(128001),symbols),/256 KB/);
  assert.equal({}.bad,undefined);
});
test("merge is non-destructive, counts conflicts and is idempotent", () => {
  const current={version:1,favorites:[symbols[0]],notes:{[symbols[0]]:"original"}};
  const imported={version:1,favorites:[symbols[1],symbols[0]],notes:{[symbols[0]]:"diferente",[symbols[2]]:"nuevo"}};
  const before=JSON.stringify(current);
  const result=core.mergeBackup(current,imported);
  assert.equal(result.addedFavorites,1); assert.equal(result.addedNotes,1);assert.equal(result.conflicts,1);
  assert.equal(result.state.notes[symbols[0]],"original");assert.equal(result.state.notes[symbols[2]],"nuevo");
  assert.equal(JSON.stringify(current),before);
  const twice=core.mergeBackup(result.state,imported);
  assert.equal(twice.addedFavorites,0);assert.equal(twice.addedNotes,0);assert.deepEqual(twice.state,result.state);
});
