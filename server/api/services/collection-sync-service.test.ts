import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/*
 * Drives the real add/remove handlers and the real nightly sync against a real
 * mongod, across several sync runs. The failure modes this guards are in Mongo
 * operator semantics ($all on libraryTags, $addToSet/$pull on the override
 * lists, the shelf regex) and in state carried between runs, neither of which a
 * mocked model would exercise.
 */

const ORG_ID = "testorg";
const COLL_ID = "coll0001";
const BOOK_TAGS = ["coverpage:yes", "article:topic-category"];

process.env.ORG_ID = ORG_ID;
process.env.LOG_LEVEL = "silent";

let mongod: MongoMemoryServer;
// Imported after env is set: the logger and handlers read it at load time.
let Book: typeof import("../../models/book.js").default;
let Collection: typeof import("../../models/collection.js").default;
let collectionsAPI: typeof import("../collections.js").default;
let syncAutoManagedCollections: typeof import("./collection-sync-service.js").syncAutoManagedCollections;

const book = (
  bookID: string,
  shelfPath: string,
  extra: Record<string, unknown> = {},
) => ({
  bookID,
  title: bookID,
  library: bookID.split("-")[0],
  shelfPath,
  libraryTags: BOOK_TAGS,
  ...extra,
});

const fakeRes = () => {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.send = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
};

const addBooks = async (books: string[]) => {
  const res = fakeRes();
  await collectionsAPI.addResourcesToCollection(
    { params: { collID: COLL_ID }, body: { books } } as any,
    res,
  );
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
};

const removeBook = async (resourceID: string) => {
  const res = fakeRes();
  await collectionsAPI.removeResourceFromCollection(
    { params: { collID: COLL_ID, resourceID } } as any,
    res,
  );
  return res;
};

const sync = async () => {
  const changed = await syncAutoManagedCollections({ dryRun: false });
  assert.notEqual(changed, false, "sync pass failed");
  return changed as number;
};

const state = async () => {
  const coll = await Collection.findOne({ collID: COLL_ID }).lean();
  assert.ok(coll);
  const resources = coll.resources ?? [];
  return {
    books: resources
      .filter((r) => r.resourceType === "resource")
      .map((r) => r.resourceID)
      .sort(),
    nested: resources
      .filter((r) => r.resourceType === "collection")
      .map((r) => r.resourceID),
    includes: [...(coll.syncIncludes ?? [])].sort(),
    excludes: [...(coll.syncExcludes ?? [])].sort(),
  };
};

const setShelves = (paths: { library: string; path: string }[]) =>
  Collection.updateOne({ collID: COLL_ID }, { $set: { syncShelves: paths } });

const ORGANIC = { library: "chem", path: "Bookshelves/Organic" };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Book = (await import("../../models/book.js")).default;
  Collection = (await import("../../models/collection.js")).default;
  collectionsAPI = (await import("../collections.js")).default;
  ({ syncAutoManagedCollections } = await import("./collection-sync-service.js"));
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Book.deleteMany({});
  await Collection.deleteMany({});
  await Book.insertMany([
    book("chem-1", "Bookshelves/Organic/Book_A"),
    book("chem-2", "Bookshelves/Organic/Book_B"),
    // Sibling shelf sharing the prefix: must not match `Bookshelves/Organic`.
    book("chem-3", "Bookshelves/Organic_Lab/Book_C"),
    // Section page from the retired import: right shelf, right program, not a book.
    book("chem-4", "Bookshelves/Organic/Book_A/01_Intro", {
      libraryTags: ["coverpage:yes", "program:oeri"],
    }),
    book("chem-5", "Bookshelves/Inorganic/Book_E"),
    book("bio-9", "Bookshelves/Botany/Book_X"),
  ]);
  await Collection.create({
    orgID: ORG_ID,
    collID: COLL_ID,
    title: "Test Collection",
    autoManage: true,
    syncMode: "shelves",
    syncShelves: [ORGANIC],
  });
});

describe("auto-managed collection sync with manual overrides", () => {
  it("fills from the rule, skipping prefix-sibling shelves and section pages", async () => {
    await sync();
    assert.deepEqual((await state()).books, ["chem-1", "chem-2"]);
  });

  it("keeps a book added from another library through repeated syncs", async () => {
    await sync();
    await addBooks(["bio-9"]);
    assert.deepEqual((await state()).includes, ["bio-9"]);

    await sync();
    assert.deepEqual((await state()).books, ["bio-9", "chem-1", "chem-2"]);
    // A settled collection must not be rewritten every night.
    assert.equal(await sync(), 0);
    assert.deepEqual((await state()).books, ["bio-9", "chem-1", "chem-2"]);
  });

  it("keeps a removed rule book out through repeated syncs", async () => {
    await sync();
    const res = await removeBook("chem-1");
    assert.equal(res.statusCode, 200);
    assert.deepEqual((await state()).excludes, ["chem-1"]);

    await sync();
    await sync();
    assert.deepEqual((await state()).books, ["chem-2"]);
  });

  it("does not record an exclude when removing a manually added book", async () => {
    await sync();
    await addBooks(["bio-9"]);
    await removeBook("bio-9");

    const s = await state();
    assert.deepEqual(s.includes, []);
    // An exclude here would silently block bio-9 if its shelf were ever added.
    assert.deepEqual(s.excludes, []);

    await sync();
    assert.deepEqual((await state()).books, ["chem-1", "chem-2"]);
  });

  it("restores an excluded rule book without marking it manually added", async () => {
    await sync();
    await removeBook("chem-1");
    await addBooks(["chem-1"]);

    const s = await state();
    assert.deepEqual(s.excludes, []);
    // It came back because the rule matches; a stored include would show a false badge.
    assert.deepEqual(s.includes, []);

    await sync();
    assert.deepEqual((await state()).books, ["chem-1", "chem-2"]);
  });

  it("keeps overrides when the shelf rule changes, and re-applies them when it changes back", async () => {
    await sync();
    await addBooks(["bio-9"]);
    await removeBook("chem-1");

    await setShelves([{ library: "chem", path: "Bookshelves/Inorganic" }]);
    await sync();
    assert.deepEqual((await state()).books, ["bio-9", "chem-5"]);

    await setShelves([ORGANIC]);
    await sync();
    // chem-1 matches again, but the admin's removal still wins.
    assert.deepEqual((await state()).books, ["bio-9", "chem-2"]);
  });

  it("drops a manual include that vanishes from its library and restores it when it returns", async () => {
    await sync();
    await addBooks(["bio-9"]);
    await sync();

    await Book.updateOne({ bookID: "bio-9" }, { $set: { syncMissingSince: new Date() } });
    await sync();
    let s = await state();
    assert.deepEqual(s.books, ["chem-1", "chem-2"]);
    assert.deepEqual(s.includes, ["bio-9"]);

    await Book.updateOne({ bookID: "bio-9" }, { $unset: { syncMissingSince: "" } });
    await sync();
    s = await state();
    assert.deepEqual(s.books, ["bio-9", "chem-1", "chem-2"]);
  });

  it("never keeps a manually included section page past the next sync", async () => {
    await sync();
    await addBooks(["chem-4"]);
    await sync();
    assert.deepEqual((await state()).books, ["chem-1", "chem-2"]);
  });

  it("corrects a stale write that put an excluded book back", async () => {
    await sync();
    await removeBook("chem-1");
    // What a sync that planned before the removal and wrote after it leaves behind.
    await Collection.updateOne(
      { collID: COLL_ID },
      { $push: { resources: { resourceType: "resource", resourceID: "chem-1" } } },
    );

    await sync();
    assert.deepEqual((await state()).books, ["chem-2"]);
  });

  it("does not duplicate a manual include once the rule also matches it, and excludes it on removal", async () => {
    await sync();
    await addBooks(["bio-9"]);
    await setShelves([ORGANIC, { library: "bio", path: "Bookshelves/Botany" }]);
    await sync();

    const coll = await Collection.findOne({ collID: COLL_ID }).lean();
    const bio9 = (coll?.resources ?? []).filter((r) => r.resourceID === "bio-9");
    assert.equal(bio9.length, 1);

    // The rule matches now, so removal has to be recorded as an exclude to stick.
    await removeBook("bio-9");
    let s = await state();
    assert.deepEqual(s.includes, []);
    assert.deepEqual(s.excludes, ["bio-9"]);

    await sync();
    s = await state();
    assert.deepEqual(s.books, ["chem-1", "chem-2"]);
  });

  it("preserves nested collections through syncs that apply overrides", async () => {
    await Collection.updateOne(
      { collID: COLL_ID },
      { $push: { resources: { resourceType: "collection", resourceID: "child001" } } },
    );
    await sync();
    await addBooks(["bio-9"]);
    await removeBook("chem-2");
    await sync();

    const s = await state();
    assert.deepEqual(s.nested, ["child001"]);
    assert.deepEqual(s.books, ["bio-9", "chem-1"]);
  });

  it("does not write override lists for a collection that is not auto-managed", async () => {
    await Collection.updateOne({ collID: COLL_ID }, { $set: { autoManage: false } });
    await addBooks(["bio-9"]);
    await removeBook("bio-9");

    const s = await state();
    assert.deepEqual(s.includes, []);
    assert.deepEqual(s.excludes, []);
  });
});
