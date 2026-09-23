import { describe, expect, it } from "vitest";
import { getLicenseText, getValidLicenseVersion } from "./LicenseOptions";

describe("getLicenseText", () => {
  it("shows the version for versioned licenses", () => {
    expect(getLicenseText("ccby", "4.0")).toBe("CC BY 4.0");
  });

  it("hides a version tagged on a license that has no versions", () => {
    expect(getLicenseText("publicdomain", "4.0")).toBe("Public Domain");
    expect(getLicenseText("arr", "3.0")).toBe("All Rights Reserved");
  });

  it("omits the trailing space when the version is empty", () => {
    expect(getLicenseText("ccby", "")).toBe("CC BY");
  });
});

describe("legacy license identifiers", () => {
  it("still displays the renamed 'multiple' value", () => {
    expect(getLicenseText("multiple")).toBe("Multiple Licenses");
    expect(getLicenseText("mixed")).toBe("Multiple Licenses");
  });
});

describe("getValidLicenseVersion", () => {
  it("keeps a version the license has", () => {
    expect(getValidLicenseVersion("ccby", "40")).toBe("40");
    expect(getValidLicenseVersion("gnufdl", "13")).toBe("13");
  });

  it("drops a version the license doesn't have", () => {
    expect(getValidLicenseVersion("gnudsl", "40")).toBe("");
    expect(getValidLicenseVersion("gnufdl", "40")).toBe("");
  });

  it("drops any version on a license without versions", () => {
    expect(getValidLicenseVersion("publicdomain", "40")).toBe("");
  });

  it("returns empty for a missing version", () => {
    expect(getValidLicenseVersion("ccby", undefined)).toBe("");
  });
});
