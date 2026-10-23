// Run with: npx tsx --test util/author-tags.test.ts (no extra dependencies: Node's test runner)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distinctCreditRefs,
  readAllCreditTags,
  readRoleTags,
  replaceRoleTag,
} from "./author-tags.js";

const TAGS = [
  "license:ccby",
  "authorname:jane-doe",
  "author@Jane Doe",
  "author@John Smith",
  "editor@ann-lee",
  "article:topic",
];

describe("readRoleTags", () => {
  it("returns every tag of the role in order", () => {
    assert.deepEqual(readRoleTags(TAGS, "author"), [
      { role: "author", tag: "author@", value: "Jane Doe" },
      { role: "author", tag: "author@", value: "John Smith" },
    ]);
    assert.deepEqual(readRoleTags(TAGS, "editor"), [
      { role: "editor", tag: "editor@", value: "ann-lee" },
    ]);
  });

  it("falls back to authorname: for the author role only", () => {
    const tags = ["license:ccby", "authorname:jane-doe"];
    assert.deepEqual(readRoleTags(tags, "author"), [
      { role: "author", tag: "authorname:", value: "jane-doe" },
    ]);
    assert.deepEqual(readRoleTags(tags, "editor"), []);
  });

  it("ignores empty values and pages without the role", () => {
    assert.deepEqual(readRoleTags(["author@", "authorname:  ", "license:ccby"], "author"), []);
    assert.deepEqual(readRoleTags([], "remixer"), []);
  });
});

describe("readAllCreditTags", () => {
  it("collects every role", () => {
    assert.deepEqual(
      readAllCreditTags(["remixer@k1", "editor@e1", "translator@t1"]).map((r) => r.role),
      ["editor", "remixer", "translator"],
    );
  });
});

describe("replaceRoleTag", () => {
  it("replaces only that role's tags and keeps every other tag", () => {
    assert.deepEqual(replaceRoleTag(TAGS, "author", "k3x9q2m7ab"), [
      "license:ccby",
      "authorname:jane-doe",
      "editor@ann-lee",
      "article:topic",
      "author@k3x9q2m7ab",
    ]);
  });

  it("leaves other roles alone", () => {
    assert.deepEqual(replaceRoleTag(TAGS, "editor", null), [
      "license:ccby",
      "authorname:jane-doe",
      "author@Jane Doe",
      "author@John Smith",
      "article:topic",
    ]);
  });

  it("removes the role's tags when clearing, leaving authorname: alone", () => {
    assert.deepEqual(replaceRoleTag(TAGS, "author", null), [
      "license:ccby",
      "authorname:jane-doe",
      "editor@ann-lee",
      "article:topic",
    ]);
  });

  it("does not add a duplicate when the page already has that person", () => {
    assert.deepEqual(replaceRoleTag(["editor@jane-doe"], "editor", "jane-doe"), [
      "editor@jane-doe",
    ]);
  });
});

describe("distinctCreditRefs", () => {
  it("drops repeats but keeps the same value under another role or tag", () => {
    assert.deepEqual(
      distinctCreditRefs([
        { role: "author", tag: "author@", value: "a" },
        { role: "author", tag: "author@", value: "a" },
        { role: "author", tag: "authorname:", value: "a" },
        { role: "editor", tag: "editor@", value: "a" },
      ]),
      [
        { role: "author", tag: "author@", value: "a" },
        { role: "author", tag: "authorname:", value: "a" },
        { role: "editor", tag: "editor@", value: "a" },
      ],
    );
  });
});
