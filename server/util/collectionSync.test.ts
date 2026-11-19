import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySyncOverrides } from "./collectionSync.js";

describe("applySyncOverrides", () => {
  it("passes rule matches through when there are no overrides", () => {
    assert.deepEqual(applySyncOverrides(["a", "b"], [], []), ["a", "b"]);
  });

  it("appends includes after rule matches", () => {
    assert.deepEqual(applySyncOverrides(["a"], ["x"], []), ["a", "x"]);
  });

  it("removes excluded rule matches", () => {
    assert.deepEqual(applySyncOverrides(["a", "b"], [], ["a"]), ["b"]);
  });

  it("lets an exclude win over an include", () => {
    assert.deepEqual(applySyncOverrides(["a"], ["x"], ["x"]), ["a"]);
  });

  it("collapses an include the rule also matches", () => {
    assert.deepEqual(applySyncOverrides(["a", "b"], ["b", "b"], []), ["a", "b"]);
  });

  it("returns nothing when everything is excluded", () => {
    assert.deepEqual(applySyncOverrides(["a"], ["x"], ["a", "x"]), []);
  });
});
