// Run with: npx tsx --test util/page-tags.test.ts (no extra dependencies: Node's test runner)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeSystemTags } from "./page-tags.js";

const PREFIXES = ["author@", "bookauthor@", "license:", "licenseversion:", "coverpage:"];

describe("mergeSystemTags", () => {
  const current = [
    "author@ann",
    "author@bo",
    "bookauthor@ann",
    "bookauthor@cy",
    "license:ccby",
    "licenseversion:40",
    "coverpage:yes",
    "topic",
  ];

  it("keeps every tag of a repeated prefix (a license edit doesn't drop people)", () => {
    // What the License Restacker sends: everything but the license, plus the new license.
    const incoming = [
      ...current.filter((t) => !t.startsWith("license")),
      "license:ccbysa",
      "licenseversion:40",
    ];
    assert.deepEqual(mergeSystemTags(current, incoming, PREFIXES), [
      "author@ann",
      "author@bo",
      "bookauthor@ann",
      "bookauthor@cy",
      "coverpage:yes",
      "topic",
      "license:ccbysa",
      "licenseversion:40",
    ]);
  });

  it("keeps protected tags the caller didn't send, and lets it replace the ones it did", () => {
    // An editor that only sends ordinary tags (e.g. AI tags) can't remove protected ones.
    assert.deepEqual(mergeSystemTags(current, ["topic", "new-tag"], PREFIXES), [
      "author@ann",
      "author@bo",
      "bookauthor@ann",
      "bookauthor@cy",
      "license:ccby",
      "licenseversion:40",
      "coverpage:yes",
      "topic",
      "new-tag",
    ]);
    // Sending one author@ replaces the page's author@ tags, as before.
    assert.deepEqual(
      mergeSystemTags(["author@ann", "author@bo", "topic"], ["author@cy", "topic"], PREFIXES),
      ["author@cy", "topic"],
    );
  });
});
