const { test } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/clerk-proxy");

test("direct Clerk mode disables legacy proxy without contacting legacy instance", async () => {
  const prior = process.env.CLERK_USE_PROXY;
  process.env.CLERK_USE_PROXY = "false";
  try {
    const response = {
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; }
    };
    await handler({ headers: {}, method: "GET" }, response);
    assert.equal(response.statusCode, 410);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.match(response.body.error, /disabled/);
  } finally {
    if (prior === undefined) delete process.env.CLERK_USE_PROXY;
    else process.env.CLERK_USE_PROXY = prior;
  }
});
