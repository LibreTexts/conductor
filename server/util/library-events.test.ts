import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseEventSummaries,
  planFeedActions,
  readFeed,
  type FeedEvent,
  type TrackedPage,
} from "./library-events.js";

// Trimmed from the real dev feed.
const feedPage = {
  "@count": "3",
  "@since": "c671ff43-dd42-11f1-833f-a50e702a0000",
  summary: [
    {
      "@count": "2",
      "@uri.detail": "https://dev.libretexts.org/@api/deki/events/page-hierarchy/=x/b65667f2",
      event: {
        "@mt-epoch": "1161024584780",
        "@datetime": "Wed, 11 Nov 2026 18:49:44 GMT",
        "@type": "page.content:update",
        "change-comment": "[BOT Forker] Successfully forked https://dev.libretexts.org/...",
        revision: "3",
        page: { "@id": "10454", path: { "#text": "Workbench/remixer_book_test/1.3.02:_Hydraulics_Math" }, title: "Hydraulics Math" },
      },
    },
    { "@count": "1", event: { "@mt-epoch": "1161024584000", "@type": "page.tag:update", page: { "@id": "10454" } } },
    {
      "@count": "6",
      "@uri.detail": "https://dev.libretexts.org/@api/deki/events/page-hierarchy/=y/d1",
      event: { "@mt-epoch": "1161000000000", "@type": "page:delete", "@cascading": "true", page: { "@id": "11052" }, "root.page": { "@id": "11049" } },
    },
  ],
};

describe("parseEventSummaries", () => {
  it("normalizes events, keeps grouping, and drops noise", () => {
    const summaries = parseEventSummaries(feedPage);
    assert.equal(summaries.length, 3);
    assert.deepEqual(summaries[0].event, {
      epoch: 1161024584780,
      at: new Date("2026-11-11T18:49:44.000Z"),
      type: "page.content:update",
      pageID: 10454,
      path: "Workbench/remixer_book_test/1.3.02:_Hydraulics_Math",
      title: "Hydraulics Math",
      revision: 3,
      comment: "[BOT Forker] Successfully forked https://dev.libretexts.org/...",
    });
    assert.equal(summaries[0].count, 2);
    assert.equal(summaries[1].event, null);
    assert.equal(summaries[1].type, "page.tag:update");
    assert.equal(summaries[2].event?.rootPageID, 11049);
  });

  it("accepts a single summary object", () => {
    assert.equal(parseEventSummaries({ summary: feedPage.summary[0] }).length, 1);
  });
});

const ev = (type: string, pageID: number, epoch: number, extra: Partial<FeedEvent> = {}): FeedEvent => ({ type, pageID, epoch, ...extra });
const tracked = (entries: [string, Partial<TrackedPage>][]) =>
  new Map<string, TrackedPage>(entries.map(([id, t]) => [id, { isSource: false, bookID: null, deleted: false, ...t }]));

describe("planFeedActions", () => {
  it("records a revision change for a reused page outside any scanned book", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page.content:update", 8998, 1, { revision: 9 }), ev("page.content:update", 8998, 2, { revision: 10 })],
      tracked([["dev-8998", { isSource: true, revision: 8 }]]),
    );
    assert.deepEqual(plan.sourceRevisions.map(({ nodeID, fromRev, toRev }) => ({ nodeID, fromRev, toRev })), [
      { nodeID: "dev-8998", fromRev: 8, toRev: 10 },
    ]);
    assert.equal(plan.newestEpoch, 2);
  });

  it("ignores a revision the graph already has", () => {
    const plan = planFeedActions("dev", [ev("page.content:update", 8998, 1, { revision: 10 })], tracked([["dev-8998", { isSource: true, revision: 10 }]]));
    assert.deepEqual(plan.sourceRevisions, []);
  });

  it("queues the book of an edited page in a scanned book (a fork in place)", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page.content:update", 10454, 1, { revision: 3, comment: "[BOT Forker] ..." })],
      tracked([["dev-10454", { bookID: "dev-9213", revision: 2 }]]),
    );
    assert.deepEqual(plan.booksToRescan, ["dev-9213"]);
    assert.deepEqual(plan.sourceRevisions, [], "re-reading the book records its source changes");
  });

  it("deletes tracked pages only, and a later restore cancels the delete", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page:delete", 1, 1), ev("page:delete", 2, 2), ev("page:delete", 99, 3), ev("page:restore", 2, 4)],
      tracked([["dev-1", {}], ["dev-2", { bookID: "dev-9213" }]]),
    );
    assert.deepEqual(plan.deletions, ["dev-1"]);
    assert.deepEqual(plan.booksToRescan, ["dev-9213"]);
  });

  it("updates paths on moves and titles on renames", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page:move", 8980, 1, { path: "Workbench/New_Path" }), ev("page.displayname:update", 8980, 2, { title: "New title" })],
      tracked([["dev-8980", {}]]),
    );
    assert.deepEqual(plan.updates, [{ nodeID: "dev-8980", path: "Workbench/New_Path", title: "New title" }]);
  });

  it("queues the book a new page was added to, through its parent", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page:create", 11096, 1)],
      tracked([["dev-10583", { bookID: "dev-9213" }]]),
      { parentOf: new Map([[11096, 10583]]) },
    );
    assert.deepEqual(plan.booksToRescan, ["dev-9213"]);
  });

  it("never queues books of an excluded library, but still watches its reused pages", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page.content:update", 10454, 1, { revision: 3 }), ev("page.content:update", 8998, 2, { revision: 11 })],
      tracked([["dev-10454", { bookID: "dev-9213" }], ["dev-8998", { isSource: true, revision: 10 }]]),
      { queueBooks: false },
    );
    assert.deepEqual(plan.booksToRescan, []);
    assert.equal(plan.sourceRevisions.length, 1);
  });

  it("applies events oldest first whatever order they arrive in", () => {
    const plan = planFeedActions(
      "dev",
      [ev("page:restore", 1, 2), ev("page:delete", 1, 1)],
      tracked([["dev-1", {}]]),
    );
    assert.deepEqual(plan.deletions, []);
  });
});

describe("readFeed", () => {
  const raw = (epoch: number, type: string, pageID: number) => ({
    "@mt-epoch": String(epoch),
    "@type": type,
    page: { "@id": String(pageID) },
  });
  const summary = (event: object, count = 1, detail?: string) => ({
    "@count": String(count),
    ...(detail ? { "@uri.detail": detail } : {}),
    event,
  });
  const H = 60 * 60 * 1000;
  const DAY = 24 * H;
  const allowed = (url: string) => url.startsWith("https://dev.libretexts.org/");

  it("finds an event hidden in a group whose headline is older than the cursor", async () => {
    const since = 10 * DAY;
    const pages = [{
      "@since": "p2",
      summary: [
        summary(raw(since + H, "page:delete", 1)),
        // Headline before the cursor, but the group holds a newer edit.
        summary(raw(since - H, "page.content:update", 2), 2, "https://dev.libretexts.org/d/1"),
      ],
    }, {
      summary: [summary(raw(since - 2 * DAY, "page:delete", 3))],
    }];
    const result = await readFeed({
      sinceEpoch: since,
      fetchPage: async (upto) => (upto === "p2" ? pages[1] : pages[0]),
      fetchDetail: async () => ({ summary: [{ event: raw(since + 2 * H, "page.content:update", 2) }, { event: raw(since - H, "page.content:update", 2) }] }),
      isAllowedDetailUrl: allowed,
      maxPages: 5,
    });
    assert.deepEqual(result.events.map((e) => [e.type, e.pageID]).sort(), [["page.content:update", 2], ["page:delete", 1]]);
    assert.equal(result.newestEpoch, since + 2 * H, "the cursor comes from the newest event, inside groups too");
    assert.equal(result.gap, false);
  });

  it("never sends the token to a detail URL on another host", async () => {
    const urls: string[] = [];
    await readFeed({
      sinceEpoch: 0,
      fetchPage: async () => ({ summary: [summary(raw(5, "page:delete", 1), 3, "https://evil.example/steal")] }),
      fetchDetail: async (url) => (urls.push(url), null),
      isAllowedDetailUrl: allowed,
      maxPages: 1,
    });
    assert.deepEqual(urls, []);
  });

  it("fails, keeping the cursor, when a later page can't be read before the cursor", async () => {
    const since = 10 * DAY;
    const result = await readFeed({
      sinceEpoch: since,
      fetchPage: async (upto) => (upto ? null : { "@since": "p2", summary: [summary(raw(since + 3 * DAY, "page:delete", 1))] }),
      fetchDetail: async () => null,
      isAllowedDetailUrl: allowed,
      maxPages: 5,
    });
    assert.equal(result.failed, true);
    assert.deepEqual(result.events, [], "nothing is applied from a partial read");
  });

  it("succeeds when only the overlap margin past the cursor is unread", async () => {
    const since = 10 * DAY;
    const result = await readFeed({
      sinceEpoch: since,
      fetchPage: async (upto) => (upto ? null : {
        "@since": "p2",
        summary: [summary(raw(since + H, "page:delete", 1)), summary(raw(since - H, "page:delete", 2))],
      }),
      fetchDetail: async () => null,
      isAllowedDetailUrl: allowed,
      maxPages: 5,
    });
    assert.equal(result.failed, false);
    assert.deepEqual(result.events.map((e) => e.pageID), [1]);
  });

  it("fails rather than keep only a group's headline when its detail can't be read", async () => {
    const since = 10 * DAY;
    const result = await readFeed({
      sinceEpoch: since,
      fetchPage: async () => ({
        summary: [
          summary(raw(since + H, "page:delete", 2), 6, "https://dev.libretexts.org/d/1"),
          summary(raw(since - 2 * DAY, "page:delete", 3)),
        ],
      }),
      fetchDetail: async () => null,
      isAllowedDetailUrl: allowed,
      maxPages: 5,
    });
    assert.equal(result.failed, true);
  });

  it("counts groups whose detail link is off the library's host", async () => {
    const result = await readFeed({
      sinceEpoch: 0,
      fetchPage: async () => ({ summary: [summary(raw(5, "page:delete", 1), 3, "https://evil.example/x")] }),
      fetchDetail: async () => null,
      isAllowedDetailUrl: allowed,
      maxPages: 1,
    });
    assert.equal(result.failed, false);
    assert.equal(result.skippedDetails, 1);
    assert.deepEqual(result.events.map((e) => e.pageID), [1], "the headline is still applied");
  });

  it("reports a gap only when the page limit stops it before the cursor", async () => {
    const page = (n: number) => ({ "@since": `p${n + 1}`, summary: [summary(raw(100 * DAY - n * DAY, "page:delete", n))] });
    const gap = await readFeed({ sinceEpoch: 0, fetchPage: async (u) => page(u ? Number(u.slice(1)) : 0), fetchDetail: async () => null, isAllowedDetailUrl: allowed, maxPages: 2 });
    assert.equal(gap.gap, true);
    const noGap = await readFeed({ sinceEpoch: 99 * DAY + H, fetchPage: async (u) => page(u ? Number(u.slice(1)) : 0), fetchDetail: async () => null, isAllowedDetailUrl: allowed, maxPages: 2 });
    assert.equal(noGap.gap, false, "passed the cursor; still inside the overlap margin");
  });

  it("with no cursor, reads one page to learn the newest epoch", async () => {
    let calls = 0;
    const result = await readFeed({
      sinceEpoch: null,
      fetchPage: async () => (calls++, { "@since": "x", summary: [summary(raw(42, "page:reorder", 1))] }),
      fetchDetail: async () => null,
      isAllowedDetailUrl: allowed,
      maxPages: 5,
    });
    assert.equal(calls, 1);
    assert.equal(result.newestEpoch, 42);
    assert.deepEqual(result.events, []);
  });
});
