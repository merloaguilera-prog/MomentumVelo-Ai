const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/clerk-proxy");

test("direct auth rejects legacy GET and POST before using credentials or contacting Clerk", async () => {
  const flag = process.env.CLERK_USE_PROXY, originalFetch = global.fetch;
  process.env.CLERK_USE_PROXY = "false";
  global.fetch = () => { throw new Error("Legacy identity must not be contacted"); };
  try {
    for (const method of ["GET", "POST"]) {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
      await handler({ method, headers: {} }, res);
      assert.equal(res.code, 410);
      assert.equal(res.headers["Cache-Control"], "no-store");
      assert.match(res.body.error, /disabled/);
    }
  } finally {
    global.fetch = originalFetch;
    if (flag === undefined) delete process.env.CLERK_USE_PROXY;
    else process.env.CLERK_USE_PROXY = flag;
  }
});

test("legacy mode still requires its own complete credential pair", async () => {
  const keys = ["CLERK_USE_PROXY", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const previous = keys.map(key => process.env[key]);
  try {
    process.env.CLERK_USE_PROXY = "true";
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.code, 503);
  } finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
    });
  }
});
