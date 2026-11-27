import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AffectedBook } from "./provenance-graph.js";
import {
  buildLeadDigests,
  describeDigestLine,
  type DigestEvent,
  type DigestLine,
  type DigestProject,
} from "./provenance-digest.js";

const book = (bookID: string, extra: Partial<AffectedBook> = {}): AffectedBook => ({
  bookID,
  pages: 1,
  minHops: 1,
  via: [],
  frozen: false,
  excerptOnly: false,
  examples: [`${bookID}-page`],
  ...extra,
});

let seq = 0;
const event = (sourcePage: string, affected: AffectedBook[], extra: Partial<DigestEvent> = {}): DigestEvent => {
  seq += 1;
  return {
    eventID: `e${seq}`,
    sourcePage,
    fromRev: 1,
    toRev: 2,
    deleted: false,
    changedAt: new Date(2026, 0, seq),
    affected,
    ...extra,
  };
};

const projects = (entries: [string, DigestProject[]][]) => new Map(entries);

describe("buildLeadDigests", () => {
  it("sends each lead one digest, sectioned by project", () => {
    const e1 = event("src-1", [book("chem-1"), book("bio-2")]);
    const digests = buildLeadDigests(
      [e1],
      projects([
        ["chem-1", [{ projectID: "P1", title: "Chemistry", leads: ["alice", "bob"] }]],
        ["bio-2", [{ projectID: "P2", title: "Biology", leads: ["alice"] }]],
      ]),
    );
    assert.deepEqual(
      digests.map((d) => ({ to: d.recipient, projects: d.sections.map((s) => s.title), events: d.eventIDs })),
      [
        { to: "alice", projects: ["Biology", "Chemistry"], events: [e1.eventID] },
        { to: "bob", projects: ["Chemistry"], events: [e1.eventID] },
      ],
    );
  });

  it("merges several revisions of one source into one line", () => {
    const first = event("src-1", [book("chem-1")], { fromRev: 3, toRev: 4 });
    const second = event("src-1", [book("chem-1", { pages: 2, examples: ["x", "y"] })], { fromRev: 4, toRev: 6 });
    const [digest] = buildLeadDigests(
      [second, first],
      projects([["chem-1", [{ projectID: "P1", title: "Chem", leads: ["alice"] }]]]),
    );
    const [line] = digest.sections[0].lines;
    assert.equal(digest.sections[0].lines.length, 1);
    assert.equal(line.fromRev, 3);
    assert.equal(line.toRev, 6);
    assert.equal(line.pages, 2);
    assert.deepEqual(line.examples, ["chem-1-page", "x", "y"]);
    assert.deepEqual(digest.eventIDs, [first.eventID, second.eventID].sort());
  });

  it("lets a deletion win over an earlier edit", () => {
    const edit = event("src-1", [book("chem-1")]);
    const gone = event("src-1", [book("chem-1")], { deleted: true, toRev: undefined });
    const [digest] = buildLeadDigests(
      [edit, gone],
      projects([["chem-1", [{ projectID: "P1", title: "Chem", leads: ["alice"] }]]]),
    );
    assert.equal(digest.sections[0].lines[0].status, "deleted");
  });

  it("puts deletions first, then edits, then out-of-date copies", () => {
    const digests = buildLeadDigests(
      [
        event("copy-src", [book("chem-1", { frozen: true })]),
        event("live-src", [book("chem-1")]),
        event("gone-src", [book("chem-1")], { deleted: true }),
      ],
      projects([["chem-1", [{ projectID: "P1", title: "Chem", leads: ["alice"] }]]]),
    );
    assert.deepEqual(
      digests[0].sections[0].lines.map((l) => [l.sourcePage, l.status]),
      [
        ["gone-src", "deleted"],
        ["live-src", "changed"],
        ["copy-src", "out-of-date"],
      ],
    );
  });

  it("caps lines per project but still covers every event", () => {
    const events = ["a", "b", "c"].map((s) => event(s, [book("chem-1")]));
    const [digest] = buildLeadDigests(
      events,
      projects([["chem-1", [{ projectID: "P1", title: "Chem", leads: ["alice"] }]]]),
      { maxLinesPerProject: 2 },
    );
    assert.equal(digest.sections[0].lines.length, 2);
    assert.equal(digest.sections[0].more, 1);
    assert.equal(digest.eventIDs.length, 3);
  });

  it("sends nothing for books without a project", () => {
    assert.deepEqual(buildLeadDigests([event("src", [book("chem-9")])], projects([])), []);
  });
});

describe("describeDigestLine", () => {
  const resolve = (id: string) => ({ title: `T:${id}`, url: `u/${id}` });
  const line = (extra: Partial<DigestLine>): DigestLine => ({
    sourcePage: "src",
    bookID: "chem-1",
    status: "changed",
    frozen: false,
    excerptOnly: false,
    fromRev: 7,
    toRev: 8,
    pages: 3,
    minHops: 1,
    via: [],
    examples: ["p1", "p2"],
    changedAt: new Date(),
    ...extra,
  });

  it("treats a deleted live source as urgent", () => {
    const item = describeDigestLine(line({ status: "deleted" }), resolve);
    assert.equal(item.urgent, true);
    assert.match(item.summary, /show nothing/);
  });

  it("does not treat a deleted source of copies as urgent", () => {
    const item = describeDigestLine(line({ status: "deleted", frozen: true }), resolve);
    assert.equal(item.urgent, false);
    assert.match(item.summary, /are copied from it and keep their content/);
  });

  it("names the revisions and says a copy does not update", () => {
    const item = describeDigestLine(line({ status: "out-of-date" }), resolve);
    assert.match(item.summary, /revision 7 → 8/);
    assert.match(item.summary, /do not update/);
  });

  it("says copied text, not copies, when the book only holds excerpts", () => {
    const item = describeDigestLine(line({ status: "out-of-date", frozen: true, excerptOnly: true, pages: 2 }), resolve);
    assert.match(item.summary, /2 pages in your book contain text copied from it/);
    assert.equal(item.label, "Copy may be out of date");
  });

  it("shows the chain only when the book is reached indirectly", () => {
    assert.deepEqual(describeDigestLine(line({ via: ["mid"] }), resolve).through, []);
    assert.deepEqual(
      describeDigestLine(line({ minHops: 2, via: ["mid"] }), resolve).through,
      [{ title: "T:mid", url: "u/mid" }],
    );
  });

  it("words a single page in the singular", () => {
    assert.match(
      describeDigestLine(line({ pages: 1, examples: ["p1"] }), resolve).summary,
      /1 page in your book reuses it and already shows the new content\. Review it\./,
    );
    assert.match(
      describeDigestLine(line({ status: "out-of-date", pages: 1 }), resolve).summary,
      /1 page in your book is a copy of it and does not update on its own/,
    );
  });

  it("lists example pages and counts the rest", () => {
    const item = describeDigestLine(line({}), resolve);
    assert.deepEqual(item.pages.map((p) => p.title), ["T:p1", "T:p2"]);
    assert.equal(item.morePages, 1);
  });
});
