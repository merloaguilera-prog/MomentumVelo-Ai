const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
  function element(){
    return {disabled:false,hidden:false,textContent:"",events:{},attributes:{},classList:{toggle(){},remove(){}},
      addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this.attributes[name]=value;}};
  }
  async function page(options={}){
    const form=element(),send=element(),retry=element(),draft=element(),status=element(),availability=element();
    const f={form,send,retry,draft,status,availability,requests:[],downloads:[],revoked:[],resetCount:0,
      values:{name:"Test User",email:"test@example.com",topic:"Ayuda general",message:"Consulta de prueba completa.",website:"",privacy:"on"},
      reply:{ok:true,status:200,body:{received:true,status:"accepted",id:"fixture-email-id"}}};
    form.elements={};form.reportValidity=()=>f.valid!==false;form.querySelector=()=>send;
    form.reset=()=>{f.resetCount++;f.values.message="";};
    const nodes={"[data-contact-form]":form,"[data-contact-status]":status,"[data-contact-availability]":availability,
      "[data-contact-retry]":retry,"[data-contact-draft]":draft};
    function FakeData(){this.get=name=>f.values[name];}
    class FakeBlob{constructor(parts){this.content=parts.join("");}}
    const safeURL={createObjectURL:blob=>{f.downloads.push(blob.content);return "blob:fixture-local";},revokeObjectURL:url=>f.revoked.push(url)};
    const window={location:{search:""},setTimeout:(...args)=>setTimeout(...args),clearTimeout};f.window=window;
    vm.runInNewContext(fs.readFileSync(require.resolve("../ayuda.js"),"utf8"),{
      window,URLSearchParams,URL:safeURL,Blob:FakeBlob,FormData:FakeData,AbortController,Promise,Error,JSON,
      document:{querySelector:selector=>nodes[selector]||null,querySelectorAll:()=>[],body:{appendChild(){}},createElement:()=>({click(){},remove(){}})},
      fetch:async(_url,args)=>{
        f.requests.push(args);
        if(args.method==="GET"){
          if(options.availabilityFailure)throw new Error("fixture-offline");
          return {ok:true,json:async()=>({available:options.available!==false})};
        }
        if(f.waitRequest)await f.waitRequest;
        return {ok:f.reply.ok,status:f.reply.status,json:async()=>{if(f.waitBody)await f.waitBody;return f.reply.body;}};
      }
    });
    await new Promise(resolve=>setImmediate(resolve));
    f.submit=()=>form.events.submit({preventDefault(){}});return f;
  }
  test("unavailable contact keeps sending disabled and preserves the draft",async()=>{
    for(const options of [{available:false},{availabilityFailure:true}]){
      const f=await page(options);assert.equal(f.send.disabled,true);assert.equal(f.retry.hidden,false);await f.submit();
      assert.equal(f.requests.filter(r=>r.method==="POST").length,0);assert.equal(f.resetCount,0);assert.equal(f.values.message,"Consulta de prueba completa.");
    }
  });
  test("a valid reference clears an unchanged query and displays acceptance",async()=>{
    const f=await page();await f.submit();
    const sent=f.requests.find(r=>r.method==="POST");
    assert.equal(sent.cache,"no-store");assert.equal(JSON.parse(sent.body).acceptedPrivacy,true);
    assert.equal(f.resetCount,1);assert.match(f.status.textContent,/Referencia: fixture-email-id/);assert.equal(f.send.disabled,false);
  });
  test("malformed success and literal HTML errors retain the message without injecting markup",async()=>{
    for(const reply of [{ok:true,status:200,body:{}},{ok:true,status:200,body:{received:true,id:"fixture-email-id"}},
      {ok:false,status:502,body:{error:'<img src=x onerror="attack()">',contactEmail:"attacker@example.com"}}]){
      const f=await page();f.reply=reply;await f.submit();
      assert.equal(f.resetCount,0);assert.equal(f.status.innerHTML,undefined);assert.equal(f.send.disabled,false);
      assert.doesNotMatch(f.status.textContent,/aceptada para envío/);
    }
  });
  test("concurrent submits send once and edits during the request remain as an unsent draft",async()=>{
    const f=await page();let release;f.waitRequest=new Promise(resolve=>{release=resolve;});
    const pending=f.submit();await new Promise(resolve=>setImmediate(resolve));await f.submit();
    assert.equal(f.requests.filter(r=>r.method==="POST").length,1);
    f.values.message="Texto nuevo que todavía no se ha enviado.";release();await pending;
    assert.equal(f.resetCount,0);assert.equal(f.values.message,"Texto nuevo que todavía no se ha enviado.");assert.match(f.status.textContent,/cambios.*borrador/);
  });
  test("request and response-body deadlines keep the query retryable",async()=>{
    for(const stage of ["waitRequest","waitBody"]){
      const f=await page();let release;f[stage]=new Promise(resolve=>{release=resolve;});f.window.setTimeout=fn=>setTimeout(fn,5);
      try{await f.submit();assert.equal(f.resetCount,0);assert.equal(f.send.disabled,false);assert.match(f.status.textContent,/no se ha confirmado a tiempo/);}
      finally{release();}
    }
  });
  test("a disabled channel after page load enables an availability recheck without clearing text",async()=>{
    const f=await page();f.reply={ok:false,status:503,body:{available:false,error:"Envío no disponible."}};
    await f.submit();assert.equal(f.send.disabled,true);assert.equal(f.retry.hidden,false);assert.equal(f.resetCount,0);
    await f.retry.events.click();assert.equal(f.send.disabled,false);
  });
  test("a downloaded draft is local, literal, and does not send or reset the query",async()=>{
    const f=await page({available:false});f.values.message="Texto literal <b>sin interpretar</b>.";f.window.setTimeout=fn=>{fn();return 0;};
    f.draft.events.click();assert.equal(f.downloads.length,1);assert.match(f.downloads[0],/BORRADOR/);
    assert.match(f.downloads[0],/<b>sin interpretar<\/b>/);assert.equal(f.requests.filter(r=>r.method==="POST").length,0);
    assert.equal(f.resetCount,0);assert.match(f.status.textContent,/sigue sin enviarse/);
  });
  test("invalid queries and empty drafts produce no transmission or download",async()=>{
    const f=await page();f.valid=false;await f.submit();assert.equal(f.requests.filter(r=>r.method==="POST").length,0);
    f.values.message=" ";f.draft.events.click();assert.equal(f.downloads.length,0);
  });
