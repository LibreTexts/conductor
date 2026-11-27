import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GetProvenanceGraphSchema,
  RunProvenanceChangesSchema,
  RunProvenanceScanSchema,
} from "./provenance.js";

const parseGraphQuery = (query: Record<string, string>) =>
  GetProvenanceGraphSchema.safeParse({ query });

describe("GetProvenanceGraphSchema", () => {
  it("accepts one library or several, lowercased to match the summaries", () => {
    const one = parseGraphQuery({ library: "CHEM" });
    assert.ok(one.success);
    assert.equal(one.data.query.library, "chem");

    const several = parseGraphQuery({ library: "Chem,BIO,math" });
    assert.ok(several.success);
    assert.equal(several.data.query.library, "chem,bio,math");
  });

  it("leaves the library out when none is given", () => {
    const res = parseGraphQuery({});
    assert.ok(res.success);
    assert.equal(res.data.query.library, undefined);
  });

  it("rejects anything that isn't a list of subdomains", () => {
    for (const library of ["chem,", ",chem", "chem bio", "chem;bio", "../chem"]) {
      assert.equal(parseGraphQuery({ library }).success, false, library);
    }
  });
});

describe("scan and changes job parameters", () => {
  it("lowercase libraries and books, so mixed case can't create duplicate records", () => {
    const scan = RunProvenanceScanSchema.safeParse({ query: { library: "CHEM,Bio", book: "DEV-9213,Chem-1" } });
    assert.ok(scan.success);
    assert.equal(scan.data.query.library, "chem,bio");
    assert.equal(scan.data.query.book, "dev-9213,chem-1");

    const changes = RunProvenanceChangesSchema.safeParse({ query: { library: "MATH" } });
    assert.ok(changes.success);
    assert.equal(changes.data.query.library, "math");
  });

  it("still reject malformed values", () => {
    assert.equal(RunProvenanceScanSchema.safeParse({ query: { book: "dev-abc" } }).success, false);
    assert.equal(RunProvenanceChangesSchema.safeParse({ query: { library: "chem," } }).success, false);
  });
});
