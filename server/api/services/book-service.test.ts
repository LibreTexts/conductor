import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

process.env.ORG_ID = "testorg";
process.env.LOG_LEVEL = "silent";

// Imported after env is set: the logger reads it at load time.
const { default: BookService } = await import("./book-service.js");
const { default: ExpertWithSSM } = await import("../../util/ExpertWithSSM.js");
const { CXOneUnavailableError } = await import("../../util/CXOne/gate.js");

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
