const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function helpPage(query) {
  const select = { value: "Ayuda general" };
  const chips = ["cuenta", "premium", "empresas", "seguridad"].map(category => {
    const chip = { dataset: { helpCategory: category }, classList: { toggle() {} },
      addEventListener(event, fn) { if (event === "click") this.click = fn; } };
    return chip;
  });
  vm.runInNewContext(fs.readFileSync(require.resolve("../ayuda.js"), "utf8"), {
    window: { location: { search: query } }, URLSearchParams,
    document: {
      querySelector: selector => selector === "[data-contact-topic]" ? select : null,
      querySelectorAll: selector => selector === "[data-help-category]" ? chips : []
    }
  });
  return select.value;
}

test("help links preserve the requested subject in the contact form", () => {
  for (const [topic, label] of Object.entries({
    cuenta: "Cuenta y acceso", premium: "Premium y pagos",
    empresas: "Plan Fondo / empresas", seguridad: "Privacidad y seguridad",
    cancelacion: "Cancelación de Premium"
  })) assert.equal(helpPage(`?tema=${topic}`), label);
  assert.equal(helpPage("?tema=desconocido"), "Ayuda general");
  assert.equal(helpPage("?tema=toString"), "Ayuda general");
});

async function withContact(send, run) {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  process.env.RESEND_API_KEY = "fixture-no-network";
  process.env.SUPPORT_EMAIL_TO = "support@example.com";
  process.env.SUPPORT_EMAIL_FROM = "Support <sender@example.com>";
  global.fetch = send;
  delete require.cache[require.resolve("../api/contact")];
  const handler = require("../api/contact");
  try {
    await run(async (changes = {}, requestChanges = {}) => {
      const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; } };
      await handler({ method: "POST", headers: { origin: "https://momentumvelo.app", "content-type": "application/json" }, body: { name: "Test User", email: "test@example.com",
        topic: "Premium y pagos", message: `${"Consulta compartida. ".repeat(20)}Final A`,
        acceptedPrivacy: true, ...changes }, ...requestChanges }, response);
      return response;
    });
  } finally {
    global.fetch = originalFetch;
    for (const key of ["RESEND_API_KEY", "SUPPORT_EMAIL_TO", "SUPPORT_EMAIL_FROM"]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    delete require.cache[require.resolve("../api/contact")];
  }
}

test("distinct long help messages and sender names cannot share an email idempotency key", async () => {
  const sends = [];
  await withContact(async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    sends.push(options);
    return { ok: true, json: async () => ({ id: "fake-email-id" }) };
  }, async contact => {
    assert.equal((await contact()).code, 200);
    assert.equal((await contact()).code, 200);
    await contact({ message: `${"Consulta compartida. ".repeat(20)}Final B` });
    await contact({ name: "Another User" });
  });
  const keys = sends.map(send => send.headers["Idempotency-Key"]);
  assert.equal(keys[0], keys[1], "retrying an identical payload is idempotent");
  assert.notEqual(keys[0], keys[2], "a different ending must not be discarded as a retry");
  assert.notEqual(keys[0], keys[3], "a different sender name changes the email payload");
});

test("invalid and unconfigured help requests do not send email", async () => {
  await withContact(() => { throw new Error("Unexpected email send"); }, async contact => {
    assert.equal((await contact({ acceptedPrivacy: false })).code, 400);
    delete process.env.RESEND_API_KEY;
    const unavailable = await contact();
    assert.equal(unavailable.code, 503);
    assert.equal(unavailable.body.received, undefined);
    assert.equal(unavailable.body.available, false);
    assert.equal(unavailable.body.contactEmail, undefined);
  });
});

test("public availability never contacts the provider or reveals sender, recipient or credential",async()=>{
    await withContact(()=>{throw new Error("Unexpected email send");},async contact=>{
      const ready=await contact({},{method:"GET"});
      assert.deepEqual(ready.body,{available:true});assert.equal(ready.headers["Cache-Control"],"no-store");
      for(const key of ["RESEND_API_KEY","SUPPORT_EMAIL_TO","SUPPORT_EMAIL_FROM"]){
        const saved=process.env[key];delete process.env[key];
        assert.deepEqual((await contact({},{method:"GET"})).body,{available:false});process.env[key]=saved;
      }
      process.env.SUPPORT_EMAIL_FROM="invalid";
      assert.equal((await contact({},{method:"GET"})).body.available,false);
    });
  });
  test("cross-site, non-JSON, unconfirmed and oversized queries never send mail",async()=>{
    await withContact(()=>{throw new Error("Unexpected email send");},async contact=>{
      assert.equal((await contact({},{headers:{origin:"https://attacker.invalid","content-type":"application/json"}})).code,403);
      assert.equal((await contact({},{headers:{origin:"https://momentumvelo.app","content-type":"text/plain"}})).code,415);
      for(const body of [{name:"a".repeat(81)},{message:"a".repeat(3001)},{email:"a\n@example.com"},{topic:"a".repeat(81)},{acceptedPrivacy:"true"}]){
        assert.equal((await contact(body)).code,400);
      }
      const ignored=await contact({website:"spam.example"});
      assert.equal(ignored.body.received,false);assert.equal(ignored.body.id,undefined);
    });
  });
  test("an HTTP success without a valid acceptance reference never confirms sending",async()=>{
    for(const reply of [{},{id:null},{id:"<script>unsafe</script>"}]){
      await withContact(async()=>({ok:true,status:200,json:async()=>reply}),async contact=>{
        const result=await contact();assert.equal(result.code,502);assert.equal(result.body.received,undefined);assert.equal(result.body.contactEmail,undefined);
      });
    }
  });
  test("a valid provider reference acknowledges acceptance without exposing the private recipient",async()=>{
    await withContact(async()=>({ok:true,status:200,json:async()=>({id:"fixture-email-id"})}),async contact=>{
      assert.deepEqual((await contact()).body,{received:true,status:"accepted",id:"fixture-email-id"});
    });
  });
  test("provider rejection never exposes vendor text or confirms a message",async()=>{
    await withContact(async()=>({ok:false,status:403,json:async()=>({message:"private-sender-and-key-fixture"})}),async contact=>{
      const result=await contact();assert.equal(result.code,502);assert.equal(result.body.received,undefined);
      assert.equal(JSON.stringify(result.body).includes("private-sender-and-key-fixture"),false);
    });
  });
  test("a stalled provider request has an abort deadline without a false success",async()=>{
    const realTimeout=AbortSignal.timeout;let guard;
    try{
      AbortSignal.timeout=()=>realTimeout(5);
      await withContact(async(_url,options)=>new Promise((_,reject)=>{
        options.signal.addEventListener("abort",()=>reject(new Error("fixture-timeout")),{once:true});
      }),async contact=>{
        const result=await Promise.race([contact(),new Promise((_,reject)=>{guard=setTimeout(()=>reject(new Error("No deadline")),200);})]);
        assert.equal(result.code,502);assert.equal(result.body.received,undefined);
      });
    }finally{AbortSignal.timeout=realTimeout;clearTimeout(guard);}
  });
