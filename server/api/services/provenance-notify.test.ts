import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/*
 * Source-change emails against a real mongod, with the mail sender replaced
 * in-process (nothing is sent, nothing leaves the machine). Guards the queue
 * against a lead whose sends always fail: those events must eventually
 * complete instead of blocking every later email.
 */

process.env.ORG_ID = "testorg";
process.env.LOG_LEVEL = "silent";

let mongod: MongoMemoryServer;
// Imported after env is set: the logger reads it at load time.
let SourceChangeEvent: typeof import("../../models/sourcechangeevent.js").default;
let ProvenanceNotificationLog: typeof import("../../models/provenancenotificationlog.js").default;
let User: typeof import("../../models/user.js").default;
let Project: typeof import("../../models/project.js").default;
let mailAPI: { sendSourceChangeDigest: (...args: unknown[]) => Promise<unknown> };
let runSourceChangeNotifications: typeof import("./provenance-notify-service.js").runSourceChangeNotifications;
let originalSend: (...args: unknown[]) => Promise<unknown>;

let sends = 0;
const sendFails = () => {
  mailAPI.sendSourceChangeDigest = async () => {
    sends += 1;
    throw new Error("mailbox rejected");
  };
};
const sendWorks = () => {
  mailAPI.sendSourceChangeDigest = async () => {
    sends += 1;
    return {};
  };
};

const addEvent = (sourcePage: string, changedAt: Date) =>
  SourceChangeEvent.create({
    sourcePage,
    fromRev: 1,
    toRev: 2,
    changedAt,
    affected: [{ bookID: "bio-2", pages: 1, minHops: 1 }],
    affectedPageCount: 1,
  });

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  SourceChangeEvent = (await import("../../models/sourcechangeevent.js")).default;
  ProvenanceNotificationLog = (await import("../../models/provenancenotificationlog.js")).default;
  User = (await import("../../models/user.js")).default;
  Project = (await import("../../models/project.js")).default;
  mailAPI = (await import("../mail.js")).default as unknown as typeof mailAPI;
  originalSend = mailAPI.sendSourceChangeDigest;
  ({ runSourceChangeNotifications } = await import("./provenance-notify-service.js"));
});

after(async () => {
  mailAPI.sendSourceChangeDigest = originalSend;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  sends = 0;
  await Promise.all([
    SourceChangeEvent.deleteMany({}),
    ProvenanceNotificationLog.deleteMany({}),
    User.collection.deleteMany({}),
    Project.collection.deleteMany({}),
  ]);
  // Raw inserts: only the fields the notify job reads.
  await User.collection.insertOne({ uuid: "lead-1", email: "lead@example.org", firstName: "Lee" });
  await Project.collection.insertOne({
    projectID: "P1",
    title: "Biology",
    leads: ["lead-1"],
    libreLibrary: "bio",
    libreCoverID: "2",
  });
});

afterEach(() => {
  mailAPI.sendSourceChangeDigest = originalSend;
});

describe("source-change notifications", () => {
  it("send a digest and complete the event", async () => {
    sendWorks();
    await addEvent("chem-11", new Date("2026-11-01"));
    const outcome = await runSourceChangeNotifications();
    assert.equal(outcome.sent, 1);
    assert.equal(outcome.eventsCompleted, 1);
    assert.equal(sends, 1);
    assert.equal(await SourceChangeEvent.countDocuments({ notifiedAt: null }), 0);
  });

  it("retry a failed send, then give up on that lead so the event completes", async () => {
    sendFails();
    await addEvent("chem-11", new Date("2026-11-01"));

    for (let run = 1; run <= 2; run += 1) {
      const outcome = await runSourceChangeNotifications();
      assert.equal(outcome.failed, 1, `run ${run}`);
      assert.equal(outcome.gaveUp, 0, `run ${run}`);
      assert.equal(outcome.eventsCompleted, 0, `run ${run}`);
    }
    const log = await ProvenanceNotificationLog.findOne({ recipient: "lead-1" }).lean();
    assert.equal(log?.failures, 2);
    assert.ok(log?.failedAt, "a failed claim is left free for the next run");

    const third = await runSourceChangeNotifications();
    assert.equal(third.gaveUp, 1);
    assert.equal(third.eventsCompleted, 1);
    assert.equal(sends, 3);
    assert.equal(await SourceChangeEvent.countDocuments({ notifiedAt: null }), 0);

    // Given up means done: no further attempts.
    await runSourceChangeNotifications();
    assert.equal(sends, 3);
  });

  it("don't let events that can't be sent hold up newer ones", async () => {
    sendFails();
    await addEvent("chem-11", new Date("2026-11-01"));
    for (let run = 0; run < 3; run += 1) await runSourceChangeNotifications({ maxEvents: 1 });

    // The stuck event completed by giving up, so the next run reaches the newer one.
    sendWorks();
    await addEvent("chem-12", new Date("2026-11-05"));
    const outcome = await runSourceChangeNotifications({ maxEvents: 1 });
    assert.equal(outcome.sent, 1);
    assert.equal(outcome.eventsCompleted, 1);
    assert.equal(await SourceChangeEvent.countDocuments({ notifiedAt: null }), 0);
  });
});
