import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultPrivacyFields,
  getPrivacyCloseErrors,
  getPrivacyDueDate,
  getPrivacyReminderState,
  shouldRedactOnClose,
} from "./privacyTickets.js";

describe("getPrivacyDueDate", () => {
  const received = new Date("2026-01-01T00:00:00.000Z");

  it("is 30 days out for a request", () => {
    assert.equal(
      getPrivacyDueDate(received, "access").toISOString(),
      "2026-01-31T00:00:00.000Z",
    );
  });

  it("is 45 days out for an appeal", () => {
    assert.equal(
      getPrivacyDueDate(received, "appeal").toISOString(),
      "2026-02-15T00:00:00.000Z",
    );
  });
});

describe("getDefaultPrivacyFields", () => {
  it("dates the request from when the ticket opened", () => {
    const fields = getDefaultPrivacyFields("2026-01-01T00:00:00.000Z", false);
    assert.equal(fields.requestType, "general");
    assert.equal(fields.intakeChannel, "support_form");
    assert.equal(fields.dateReceived.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(fields.dueDate.toISOString(), "2026-01-31T00:00:00.000Z");
    assert.equal(fields.identityVerification, undefined);
  });

  it("marks signed-in requesters as verified by session", () => {
    assert.equal(
      getDefaultPrivacyFields("2026-01-01T00:00:00.000Z", true).identityVerification?.method,
      "signed_in_session",
    );
  });

  it("can't close until the response is recorded", () => {
    assert.equal(getPrivacyCloseErrors(getDefaultPrivacyFields("2026-01-01T00:00:00.000Z", false)).length, 3);
  });
});

describe("getPrivacyCloseErrors", () => {
  const complete = {
    responseDate: new Date(),
    responseOutcome: "fulfilled" as const,
    responseSummary: "Sent export",
  };

  it("passes non-privacy tickets", () => {
    assert.deepEqual(getPrivacyCloseErrors(undefined), []);
  });

  it("requires the response fields", () => {
    assert.deepEqual(getPrivacyCloseErrors({ requestType: "access" }), [
      "Response date",
      "Response outcome",
      "Response summary",
    ]);
  });

  it("treats a blank summary as missing", () => {
    assert.deepEqual(
      getPrivacyCloseErrors({ ...complete, responseSummary: "  " }),
      ["Response summary"],
    );
  });

  it("passes a fulfilled request without a denial basis", () => {
    assert.deepEqual(getPrivacyCloseErrors(complete), []);
  });

  for (const outcome of ["denied", "partly_fulfilled", "could_not_verify"] as const) {
    it(`requires a denial basis when ${outcome}`, () => {
      assert.deepEqual(
        getPrivacyCloseErrors({ ...complete, responseOutcome: outcome }),
        ["Denial basis"],
      );
    });
  }

  it("requires a note when the basis is other", () => {
    assert.deepEqual(
      getPrivacyCloseErrors({
        ...complete,
        responseOutcome: "denied",
        denialBasis: { reason: "other" },
      }),
      ["Denial basis explanation"],
    );
  });
});

describe("shouldRedactOnClose", () => {
  it("redacts fulfilled and partly fulfilled deletions only", () => {
    assert.equal(shouldRedactOnClose({ requestType: "deletion", responseOutcome: "fulfilled" }), true);
    assert.equal(shouldRedactOnClose({ requestType: "deletion", responseOutcome: "partly_fulfilled" }), true);
    assert.equal(shouldRedactOnClose({ requestType: "deletion", responseOutcome: "denied" }), false);
    assert.equal(shouldRedactOnClose({ requestType: "access", responseOutcome: "fulfilled" }), false);
  });
});

describe("getPrivacyReminderState", () => {
  const due = new Date("2026-01-31T00:00:00.000Z");

  it("sends nothing before day 20", () => {
    assert.deepEqual(getPrivacyReminderState(due, [], new Date("2026-01-20T00:00:00.000Z")), {
      reached: [],
      shouldSend: false,
    });
  });

  it("sends the day-20 reminder once", () => {
    const now = new Date("2026-01-21T00:00:00.000Z");
    assert.deepEqual(getPrivacyReminderState(due, [], now), { reached: [10], shouldSend: true });
    assert.deepEqual(getPrivacyReminderState(due, [10], now), { reached: [10], shouldSend: false });
  });

  it("collapses missed runs into one reminder", () => {
    assert.deepEqual(getPrivacyReminderState(due, [], new Date("2026-01-29T00:00:00.000Z")), {
      reached: [10, 3],
      shouldSend: true,
    });
  });
});
