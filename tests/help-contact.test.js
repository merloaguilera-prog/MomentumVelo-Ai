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
    await run(async (changes = {}) => {
      const response = { setHeader() {}, status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; } };
      await handler({ method: "POST", body: { name: "Test User", email: "test@example.com",
        topic: "Premium y pagos", message: `${"Consulta compartida. ".repeat(20)}Final A`,
        acceptedPrivacy: true, ...changes } }, response);
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
    assert.equal(unavailable.body.contactEmail, "support@example.com");
  });
});
