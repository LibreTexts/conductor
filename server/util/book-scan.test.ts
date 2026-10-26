// Run with: npx tsx --test util/book-scan.test.ts (no extra dependencies: Node's test runner)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authorshipFieldsFromScan,
  licenseFromTags,
  restackerFieldsFromScan,
  type PageScan,
} from "./book-scan.js";

const plain: PageScan = {
  tags: ["license:ccby", "licenseversion:40", "author@jane-doe", "editor@ann-lee"],
  content: { transcluded: false, reusesContent: false, refs: [], quotationRate: 0 },
};

const transcluded: PageScan = {
  tags: ["license:ccbysa", "licenseversion:40", "transcluded:yes"],
  content: {
    transcluded: true,
    reusesContent: true,
    sourceTags: ["license:ccby", "licenseversion:30", "author@openstax", "translator@maria"],
    refs: [],
    quotationRate: 1,
  },
};

const withReuse: PageScan = {
  tags: ["author@john-smith"],
  content: {
    transcluded: false,
    reusesContent: false,
    refs: [
      { library: "chem", pageID: "1", tags: ["license:ccby", "licenseversion:40", "author@a"] },
      { library: "chem", pageID: "2", tags: ["license:ccby", "licenseversion:40", "author@a"] },
      { library: "bio", pageID: "3", tags: ["license:ccbync", "licenseversion:40", "illustrator@b"] },
    ],
    quotationRate: 0.5,
  },
};

const bare: PageScan = {
  tags: ["article:topic"],
  content: { transcluded: false, reusesContent: false, refs: [], quotationRate: -1 },
};

describe("licenseFromTags", () => {
  it("keeps the Restacker's stored shape (full tag values)", () => {
    assert.deepEqual(licenseFromTags(["license:ccby", "licenseversion:40"]), {
      label: "license:ccby",
      raw: "licenseversion:40",
      version: "licenseversion:40",
    });
    assert.deepEqual(licenseFromTags(["license:publicdomain"]), {
      label: "license:publicdomain",
      raw: "",
      version: "",
    });
    assert.equal(licenseFromTags(["author@x"]), undefined);
  });
});

describe("restackerFieldsFromScan", () => {
  it("reads a plain page", () => {
    assert.deepEqual(restackerFieldsFromScan(plain), {
      license: { label: "license:ccby", raw: "licenseversion:40", version: "licenseversion:40" },
      content: { contentLicense: undefined, sourceLicense: undefined, quotation: 0 },
    });
  });

  it("takes the source license of a transcluded page", () => {
    const fields = restackerFieldsFromScan(transcluded);
    assert.deepEqual(fields.content?.sourceLicense, {
      label: "license:ccby",
      raw: "licenseversion:30",
      version: "licenseversion:30",
    });
    assert.equal(fields.content?.quotation, 1);
  });

  it("de-duplicates the licenses of reused content", () => {
    assert.deepEqual(
      restackerFieldsFromScan(withReuse).content?.contentLicense?.map((l) => l.label),
      ["license:ccby", "license:ccbync"],
    );
  });

  it("leaves content fields alone on a tags-only scan", () => {
    assert.deepEqual(restackerFieldsFromScan({ tags: plain.tags }), {
      license: { label: "license:ccby", raw: "licenseversion:40", version: "licenseversion:40" },
    });
  });

  it("handles a page with no license and no body", () => {
    assert.deepEqual(restackerFieldsFromScan(bare), {
      license: undefined,
      content: { contentLicense: undefined, sourceLicense: undefined, quotation: -1 },
    });
  });
});

describe("authorshipFieldsFromScan", () => {
  it("reads every role on a plain page", () => {
    const fields = authorshipFieldsFromScan(plain);
    assert.deepEqual(
      fields.pageCredits.map((r) => `${r.role}:${r.value}`),
      ["author:jane-doe", "editor:ann-lee"],
    );
    assert.deepEqual(fields.content, { sourceCredits: [], contentCredits: [] });
  });

  it("takes the source credits of a transcluded page", () => {
    assert.deepEqual(
      authorshipFieldsFromScan(transcluded).content?.sourceCredits.map((r) => `${r.role}:${r.value}`),
      ["author:openstax", "translator:maria"],
    );
  });

  it("de-duplicates the credits of reused content", () => {
    assert.deepEqual(
      authorshipFieldsFromScan(withReuse).content?.contentCredits.map((r) => `${r.role}:${r.value}`),
      ["author:a", "illustrator:b"],
    );
  });

  it("returns only page credits on a tags-only scan", () => {
    assert.equal(authorshipFieldsFromScan({ tags: plain.tags }).content, undefined);
  });

  it("handles a page with no credits", () => {
    assert.deepEqual(authorshipFieldsFromScan(bare), {
      pageCredits: [],
      content: { sourceCredits: [], contentCredits: [] },
    });
  });
});
