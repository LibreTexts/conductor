import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/*
 * Privacy inquiries must never reach the vector DB or the AI provider. Qdrant calls are
 * recorded instead of sent; any upsert or search for a privacy ticket fails the test.
 */

process.env.ORG_ID = "testorg";
process.env.LOG_LEVEL = "silent";
process.env.OPENAI_API_KEY ??= "test";

let mongod: MongoMemoryServer;
// Imported after env is set: the logger and OpenAI clients read it at load time.
let SupportTicket: typeof import("../../models/supporticket.js").default;
let qdrantService: typeof import("./qdrant.js").qdrantService;
let ticketService: InstanceType<typeof import("./support-ticket-service.js").default>;
let supportTicketAIService: typeof import("./support-ticket-ai-service.js").supportTicketAIService;

const calls: { method: string; arg: unknown }[] = [];

const insertTicket = (uuid: string, extra: Record<string, unknown> = {}) =>
  SupportTicket.collection.insertOne({
    uuid,
    title: `Ticket ${uuid}`,
    description: "Requester details",
    queue_id: "queue1",
    status: "closed",
    timeOpened: new Date().toISOString(),
    timeClosed: new Date().toISOString(),
    feed: [],
    ...extra,
  });

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  SupportTicket = (await import("../../models/supporticket.js")).default;
  ({ qdrantService } = await import("./qdrant.js"));
  const SupportTicketService = (await import("./support-ticket-service.js")).default;
  ticketService = new SupportTicketService();
  ({ supportTicketAIService } = await import("./support-ticket-ai-service.js"));

  const record = (method: string) => async (arg: unknown) => {
    calls.push({ method, arg });
    return method === "searchSupportKnowledge" ? [] : undefined;
  };
  qdrantService.upsertClosedSupportTicket = record("upsertClosedSupportTicket") as any;
  qdrantService.deleteClosedSupportTicket = record("deleteClosedSupportTicket") as any;
  qdrantService.searchSupportKnowledge = record("searchSupportKnowledge") as any;
  qdrantService.initializeClosedSupportTicketsCollection = (async () => {}) as any;
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  calls.length = 0;
  await SupportTicket.deleteMany({});
});

const PRIVACY = { privacy: { requestType: "deletion" } };

describe("privacy tickets stay out of AI features", () => {
  it("deletes instead of upserting the vector for a closed privacy ticket", async () => {
    await insertTicket("priv1", PRIVACY);
    await ticketService.syncClosedTicketVector("priv1");
    assert.deepEqual(calls, [{ method: "deleteClosedSupportTicket", arg: "priv1" }]);
  });

  it("still upserts a closed ordinary ticket", async () => {
    await insertTicket("plain1");
    await ticketService.syncClosedTicketVector("plain1");
    assert.deepEqual(calls.map((c) => c.method), ["upsertClosedSupportTicket"]);
  });

  it("skips privacy tickets in the backfill", async () => {
    await insertTicket("priv1", PRIVACY);
    await insertTicket("plain1");
    const result = await ticketService.syncAllClosedTicketVectors();
    assert.deepEqual(result, { synced: 1, failed: 0 });
    assert.deepEqual(
      calls.map((c) => [c.method, (c.arg as any)?.uuid ?? c.arg]),
      [["upsertClosedSupportTicket", "plain1"]],
    );
  });

  it("refuses Answer with AI before any search or embedding", async () => {
    await insertTicket("priv2", { ...PRIVACY, status: "open" });
    await assert.rejects(
      supportTicketAIService.answerTicket("priv2"),
      /only be generated/,
    );
    assert.deepEqual(calls, []);
  });
});
