import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GetProvenanceGraphSchema } from "./provenance.js";

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
