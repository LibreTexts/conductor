import { describe, expect, it } from "vitest";
import { getLicenseText } from "./LicenseOptions";

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
