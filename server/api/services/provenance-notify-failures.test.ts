import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.ORG_ID = "testorg";
process.env.LOG_LEVEL = "silent";
// Imported after env is set: the logger reads it at load time.
const { isRecipientFailure } = await import("./provenance-notify-service.js");

const withStatus = (status: number) => Object.assign(new Error("send failed"), { status });

describe("isRecipientFailure", () => {
  it("counts the provider rejecting this recipient's message", () => {
    assert.equal(isRecipientFailure(withStatus(400)), true);
    assert.equal(isRecipientFailure(withStatus(422)), true);
    assert.equal(isRecipientFailure({ statusCode: 400 }), true);
  });

  it("never counts the provider's own failures", () => {
    for (const status of [500, 502, 503, 504]) assert.equal(isRecipientFailure(withStatus(status)), false, String(status));
    // Bad or expired credentials, timeouts and rate limits are ours, not the lead's.
    for (const status of [401, 403, 408, 429]) assert.equal(isRecipientFailure(withStatus(status)), false, String(status));
    // An unknown sending domain is a configuration mistake, never one recipient's.
    assert.equal(isRecipientFailure(withStatus(404)), false);
  });

  it("treats an error without a status (network failure) as the provider's", () => {
    assert.equal(isRecipientFailure(new Error("ECONNRESET")), false);
    assert.equal(isRecipientFailure(null), false);
    assert.equal(isRecipientFailure(undefined), false);
  });
});
