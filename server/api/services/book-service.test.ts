import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

process.env.ORG_ID = "testorg";
process.env.LOG_LEVEL = "silent";

// Imported after env is set: the logger reads it at load time.
const { default: BookService } = await import("./book-service.js");
const { default: ExpertWithSSM } = await import("../../util/ExpertWithSSM.js");
const { CXOneUnavailableError } = await import("../../util/CXOne/gate.js");
const { BookTOC } = await import("../../models/booktoc.js");

describe("BookService public TOC build cap", () => {
  it("rejects a third concurrent cold build and frees the slot when one finishes", async () => {
    const proto = BookService.prototype as any;
    const pending: (() => void)[] = [];
    mock.method(ExpertWithSSM.getInstance(), "forLibrary", async () => ({}));
    mock.method(proto, "_storePublicTOC", async () => {});
    mock.method(proto, "_buildFilteredTOC", () =>
      new Promise((resolve) => pending.push(() => resolve({ id: "1", children: [] }))),
    );
    try {
      const build = (bookID: string) =>
        new BookService({ bookID }).getBookTOCNew({ includeRestricted: false, cache: false });

      const first = build("chem-1");
      const second = build("chem-2");
      await assert.rejects(build("chem-3"), CXOneUnavailableError);

      while (pending.length < 1) await new Promise((r) => setImmediate(r));
      pending.shift()!();
      await first;

      const fourth = build("chem-4");
      while (pending.length < 2) await new Promise((r) => setImmediate(r));
      pending.splice(0).forEach((resolve) => resolve());
      await Promise.all([second, fourth]);
    } finally {
      mock.restoreAll();
    }
  });
});

describe("BookService stored public TOC", () => {

  it("serves a stored copy of any age without building, refreshing only past the backstop", async () => {
    const proto = BookService.prototype as any;
    const build = mock.method(proto, "_buildFilteredTOC", async () => ({ id: "x", children: [] }));
    const refresh = mock.method(proto, "_refreshPublicTOC", async () => {});
    const toc = { id: "1", title: "Book", url: "", children: [] };
    const builtAt = new Date(Date.now() - 40 * 60_000); // past the old 30-min hard TTL
    let invalidatedAt: Date | undefined;
    mock.method(BookTOC, "findOne", () => ({ lean: async () => ({ toc, builtAt, invalidatedAt }) }));
    try {
      const read = (bookID: string) =>
        new BookService({ bookID }).getBookTOCNew({ includeRestricted: false });

      assert.deepEqual(await read("chem-101"), toc);
      assert.equal(refresh.mock.callCount(), 0);

      invalidatedAt = new Date(); // a Conductor write after the build
      assert.deepEqual(await read("chem-102"), toc);
      assert.equal(refresh.mock.callCount(), 1);
      assert.equal(build.mock.callCount(), 0);
    } finally {
      mock.restoreAll();
    }
  });

  it("invalidatePublicTOC marks the copy stale and starts one refresh", async () => {
    const update = mock.method(BookTOC, "updateOne", async () => ({}));
    const refresh = mock.method(BookService.prototype as any, "_refreshPublicTOC", async () => {});
    try {
      await BookService.invalidatePublicTOC("chem-103");
      const [filter, change] = update.mock.calls[0].arguments as any[];
      assert.deepEqual(filter, { bookID: { $eq: "chem-103" } });
      assert.ok(change.$set.invalidatedAt instanceof Date);
      assert.equal(refresh.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });

  it("a build that started before an invalidation still reads as stale once stored", async () => {
    const proto = BookService.prototype as any;
    let finishBuild!: () => void;
    const oldTree = { id: "1", title: "Before", url: "", children: [] };
    mock.method(ExpertWithSSM.getInstance(), "forLibrary", async () => ({}));
    mock.method(proto, "_buildFilteredTOC", () =>
      new Promise((resolve) => (finishBuild = () => resolve(oldTree))),
    );
    const refresh = mock.method(proto, "_refreshPublicTOC", async () => {});
    const writes: any[] = [];
    mock.method(BookTOC, "updateOne", async (_filter: unknown, change: any) => {
      writes.push(change.$set);
      return {};
    });
    try {
      const build = new BookService({ bookID: "chem-105" }).getBookTOCNew({
        includeRestricted: false,
        cache: false,
      });
      while (!finishBuild) await new Promise((r) => setImmediate(r));

      await new Promise((r) => setTimeout(r, 5)); // the write lands mid-walk
      await BookService.invalidatePublicTOC("chem-105");
      finishBuild();
      await build;

      const { invalidatedAt } = writes.find((w) => w.invalidatedAt);
      const { builtAt, toc } = writes.find((w) => w.toc);
      mock.method(BookTOC, "findOne", () => ({ lean: async () => ({ toc, builtAt, invalidatedAt }) }));
      refresh.mock.resetCalls();
      // The old build also refilled this container's 120 s in-process copy; expire it.
      (BookService as any)._tocCacheByBookID.flushAll();

      await new BookService({ bookID: "chem-105" }).getBookTOCNew({ includeRestricted: false });
      assert.equal(refresh.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });

  it("invalidatePublicTOC never throws", async () => {
    mock.method(BookTOC, "updateOne", async () => {
      throw new Error("mongo down");
    });
    try {
      await BookService.invalidatePublicTOC("chem-104");
    } finally {
      mock.restoreAll();
    }
  });
});
