import { describe, expect, it } from "vitest";
import {
  expandWithDescendants,
  getBulkLicenseSkip,
  getLicenseCompliance,
  isLicenseNonCompliant,
} from "./util";

const lic = (label: string, version?: string) => ({
  label,
  raw: version ? `licenseversion:${version}` : "",
  version: version ? `licenseversion:${version}` : undefined,
});

describe("expandWithDescendants", () => {
  const rows = [
    { id: "1", depth: 0 },
    { id: "1.1", depth: 1 },
    { id: "1.1.1", depth: 2 },
    { id: "1.2", depth: 1 },
    { id: "2", depth: 0 },
    { id: "2.1", depth: 1 },
  ];

  it("includes every level below a selected page", () => {
    expect([...expandWithDescendants(rows, new Set(["1"]))]).toEqual([
      "1",
      "1.1",
      "1.1.1",
      "1.2",
    ]);
  });

  it("stops at the next sibling and handles nested selections", () => {
    expect([...expandWithDescendants(rows, new Set(["1.1", "2"]))]).toEqual([
      "1.1",
      "1.1.1",
      "2",
      "2.1",
    ]);
  });
});

describe("getBulkLicenseSkip", () => {
  it("skips pages whose source license differs", () => {
    const skip = getBulkLicenseSkip(
      { pageLicense: lic("ccby", "40"), sourceLicense: lic("ccbysa", "40") },
      "ccby",
      "30",
    );
    expect(skip?.reason).toBe("conflict");
  });

  it("allows a change that matches the source license", () => {
    expect(
      getBulkLicenseSkip(
        { pageLicense: lic("ccby", "30"), sourceLicense: lic("ccbysa", "40") },
        "ccbysa",
        "40",
      ),
    ).toBeNull();
  });

  it("skips pages whose content licenses are incompatible", () => {
    const skip = getBulkLicenseSkip(
      { pageLicense: lic("ccbysa", "40"), contentLicenses: [lic("ccbysa", "40")] },
      "ccby",
      "40",
    );
    expect(skip?.reason).toBe("conflict");
  });

  it("skips structural pages unless the license is public domain", () => {
    const url = "https://x/00%3A_Front_Matter/03%3A_Table_of_Contents";
    expect(getBulkLicenseSkip({ url }, "ccby", "40")?.reason).toBe("structural");
    expect(getBulkLicenseSkip({ url }, "publicdomain")).toBeNull();
  });

  it("skips pages that already have the license", () => {
    expect(
      getBulkLicenseSkip({ pageLicense: lic("ccby", "40") }, "ccby", "40")?.reason,
    ).toBe("unchanged");
  });
});

describe("missing license versions", () => {
  it("flags a versioned license without a version", () => {
    const result = getLicenseCompliance(
      lic("ccby", "40"),
      lic("ccby"),
      { label: "", raw: "" },
      [lic("ccbysa")],
    );
    expect(result.missingVersions.map((m) => m.role)).toEqual([
      "page",
      "content:0",
    ]);
    expect(result.compliant).toBe(false);
  });

  it("does not flag licenses that have no versions", () => {
    expect(
      isLicenseNonCompliant(lic("publicdomain"), lic("publicdomain")),
    ).toBe(false);
  });
});
