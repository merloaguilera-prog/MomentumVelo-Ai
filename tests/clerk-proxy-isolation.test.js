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

test("legacy proxy returns unavailable when its credentials are missing", async () => {
  const keys = ["CLERK_USE_PROXY", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.CLERK_USE_PROXY = "true";
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const response = {
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await handler({ headers: {}, method: "GET" }, response);
    assert.equal(response.statusCode, 503);
    assert.match(response.body.error, /not configured/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
