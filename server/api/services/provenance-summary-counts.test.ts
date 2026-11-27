import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/*
 * The per-book counts the library views read off the summaries — reuse from
 * unscanned libraries and pages needing attention — against a real mongod.
 * They're kept by aggregation pipelines and by hooks on every path that
 * changes a reuse link's status, so a mocked model wouldn't exercise them.
 *
 * Fixture: bio-2 reuses chem-11 (a live transclusion, from scanned chem-1)
 * and math-91 (a fork, from an unscanned math book). math-9 has a page
 * node but no summary, i.e. was never scanned.
 */

process.env.ORG_ID = "testorg";
process.env.LOG_LEVEL = "silent";

let mongod: MongoMemoryServer;
// Imported after env is set: the logger reads it at load time.
let PageNode: typeof import("../../models/pagenode.js").default;
let PageReuseEdge: typeof import("../../models/pagereuseedge.js").default;
let BookReuseSummary: typeof import("../../models/bookreusesummary.js").default;
let SourceChangeEvent: typeof import("../../models/sourcechangeevent.js").default;
let provenance: typeof import("./page-provenance-service.js");
let markSourceChangeReviewed: typeof import("./content-sources-service.js").markSourceChangeReviewed;
let getBookGraph: typeof import("./provenance-insights-service.js").getBookGraph;

const node = (lib: string, pageID: number, bookID: string | null) => ({
  nodeID: `${lib}-${pageID}`,
  lib,
  pageID,
  bookID,
  kind: "original",
  deletedAt: null,
});

const edge = (
  target: string,
  source: string,
  targetBook: string,
  sourceBook: string | null,
  type: string,
) => ({ target, source, targetBook, sourceBook, type, origin: "scan", createdAt: new Date() });

const summary = (bookID: string) => BookReuseSummary.findOne({ bookID }).lean();

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  PageNode = (await import("../../models/pagenode.js")).default;
  PageReuseEdge = (await import("../../models/pagereuseedge.js")).default;
  BookReuseSummary = (await import("../../models/bookreusesummary.js")).default;
  SourceChangeEvent = (await import("../../models/sourcechangeevent.js")).default;
  provenance = await import("./page-provenance-service.js");
  ({ markSourceChangeReviewed } = await import("./content-sources-service.js"));
  ({ getBookGraph } = await import("./provenance-insights-service.js"));
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    PageNode.deleteMany({}),
    PageReuseEdge.deleteMany({}),
    BookReuseSummary.deleteMany({}),
    SourceChangeEvent.deleteMany({}),
  ]);
  await PageNode.insertMany([
    node("chem", 11, "chem-1"),
    node("chem", 12, "chem-1"),
    { ...node("bio", 21, "bio-2"), kind: "transclude" },
    { ...node("bio", 22, "bio-2"), kind: "fork" },
    node("math", 91, null),
    node("math", 92, "math-9"),
  ]);
  await PageReuseEdge.insertMany([
    edge("bio-21", "chem-11", "bio-2", "chem-1", "transclude-cross"),
    edge("bio-22", "math-91", "bio-2", null, "fork"),
  ]);
  await provenance.rebuildBookSummary("chem-1");
  await provenance.rebuildBookSummary("bio-2");
});

describe("counts kept on book summaries", () => {
  it("are written by a summary rebuild", async () => {
    const bio = await summary("bio-2");
    assert.deepEqual(bio?.unscannedSources, [{ lib: "math", pages: 1, types: ["fork"] }]);
    assert.deepEqual(bio?.attention, { sourceChanged: 0, broken: 0 });
    assert.deepEqual((await summary("chem-1"))?.unscannedSources, []);
  });

  it("follow a source change and its review without a rebuild", async () => {
    const { recorded } = await provenance.recordSourceChange({ sourceId: "chem-11", fromRev: 1, toRev: 2 });
    assert.ok(recorded);
    assert.deepEqual((await summary("bio-2"))?.attention, { sourceChanged: 1, broken: 0 });

    const event = await SourceChangeEvent.findOne({ sourcePage: "chem-11" }).lean();
    assert.ok(event);
    const reviewed = await markSourceChangeReviewed("bio-2", String(event._id), "lead@example.org");
    assert.equal(reviewed?.edgesReset, 1);
    assert.deepEqual((await summary("bio-2"))?.attention, { sourceChanged: 0, broken: 0 });
  });

  it("mark the reusing book broken and rebuild the deleted page's own book", async () => {
    assert.equal((await summary("chem-1"))?.totals.pages, 2);
    await provenance.markPageDeleted("chem-11");

    assert.deepEqual((await summary("bio-2"))?.attention, { sourceChanged: 0, broken: 1 });
    // chem-11 no longer counts toward its own book.
    const chem = await summary("chem-1");
    assert.equal(chem?.totals.pages, 1);
    assert.deepEqual(chem?.downstream, []);
  });

  it("leave the own book's rebuild to the caller when asked, and say which book it was", async () => {
    const result = await provenance.deletePageWithNotice("chem-11", new Date(), { rebuildOwnBook: false });
    assert.equal(result.bookID, "chem-1");
    // The reusing book is still refreshed; the page's own book waits for the caller.
    assert.deepEqual((await summary("bio-2"))?.attention, { sourceChanged: 0, broken: 1 });
    assert.equal((await summary("chem-1"))?.totals.pages, 2);

    await provenance.rebuildSummaryIfScanned("chem-1");
    assert.equal((await summary("chem-1"))?.totals.pages, 1);
  });

  it("hold every refresh in a batch until it's flushed, then run each book once", async () => {
    const batch = new provenance.SummaryRefreshBatch();
    // Two deletions from the same book, at the same time, as the source check does.
    await Promise.all([
      provenance.deletePageWithNotice("chem-11", new Date(), { batch }),
      provenance.deletePageWithNotice("chem-12", new Date(), { batch }),
    ]);
    assert.deepEqual([...batch.rebuild], ["chem-1"]);
    assert.deepEqual([...batch.attention], ["bio-2"]);
    // Nothing refreshed yet.
    assert.equal((await summary("chem-1"))?.totals.pages, 2);
    assert.deepEqual((await summary("bio-2"))?.attention, { sourceChanged: 0, broken: 0 });

    await batch.flush();
    assert.equal((await summary("chem-1"))?.totals.pages, 0);
    assert.deepEqual((await summary("bio-2"))?.attention, { sourceChanged: 0, broken: 1 });
    assert.equal(batch.rebuild.size + batch.attention.size, 0);
  });

  it("never give an unscanned book a summary", async () => {
    await provenance.markPageDeleted("math-92");
    assert.equal(await BookReuseSummary.exists({ bookID: "math-9" }), null);

    await provenance.refreshBookAttention(["math-9", null, undefined]);
    assert.equal(await BookReuseSummary.exists({ bookID: "math-9" }), null);
  });
});

describe("getBookGraph by library", () => {
  const edgeKeys = (graph: Awaited<ReturnType<typeof getBookGraph>>) =>
    graph.edges.map((e) => `${e.source}>${e.target}`).sort();

  it("shows every link with no library given", async () => {
    assert.deepEqual(edgeKeys(await getBookGraph()), ["chem-1>bio-2", "library:math>bio-2"]);
  });

  it("shows the links touching any of the given libraries' books", async () => {
    // chem's summary lists bio-2 downstream; the unscanned math link belongs to bio-2.
    assert.deepEqual(edgeKeys(await getBookGraph({ libraries: ["chem"] })), ["chem-1>bio-2"]);
    assert.deepEqual(edgeKeys(await getBookGraph({ libraries: ["bio"] })), [
      "chem-1>bio-2",
      "library:math>bio-2",
    ]);
    assert.deepEqual(edgeKeys(await getBookGraph({ libraries: ["chem", "bio"] })), [
      "chem-1>bio-2",
      "library:math>bio-2",
    ]);
    assert.deepEqual(edgeKeys(await getBookGraph({ libraries: ["math"] })), []);
  });
});

describe("scan reconcile", () => {
  it("keeps broken and changed links when the page has references it couldn't resolve", async () => {
    await PageReuseEdge.updateOne({ target: "bio-21" }, { $set: { status: "broken" } });
    await PageReuseEdge.updateOne({ target: "bio-22" }, { $set: { status: "source-changed" } });
    const status = async (target: string) => (await PageReuseEdge.findOne({ target }).lean())?.status;

    // A rescan that resolved neither source, with a reference left unresolved: both kept.
    await provenance.reconcileTargetEdgesBulk([
      { target: "bio-21", presentSources: [], origins: ["scan"], keepStatuses: ["broken", "source-changed"] },
      { target: "bio-22", presentSources: [], origins: ["scan"], keepStatuses: ["broken", "source-changed"] },
    ]);
    assert.equal(await status("bio-21"), "broken");
    assert.equal(await status("bio-22"), "source-changed");

    // Everything resolved and the references are gone: removed, as before.
    await provenance.reconcileTargetEdgesBulk([{ target: "bio-21", presentSources: [], origins: ["scan"] }]);
    assert.equal(await status("bio-21"), "removed");
  });
});
