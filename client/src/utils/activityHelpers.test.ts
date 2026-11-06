import { describe, it, expect } from "vitest";
import { IconBox, IconPlayerPlay } from "@tabler/icons-react";
import {
  buildActivityAttribution,
  buildActivityEmbedCode,
  getActivityEmbedURL,
  getActivityLicense,
  getContentTypeIcon,
  getContentTypeName,
} from "./activityHelpers";

describe("getActivityLicense", () => {
  it("builds a Creative Commons deed link from H5P's code and version", () => {
    expect(getActivityLicense({ name: "CC BY-NC-SA", version: "4.0" })).toEqual({
      text: "CC BY-NC-SA 4.0",
      url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    });
  });

  it("shows nothing for undisclosed or missing licenses", () => {
    expect(getActivityLicense({ name: "U" })).toBeUndefined();
    expect(getActivityLicense(undefined)).toBeUndefined();
    expect(getActivityLicense({ name: "  " })).toBeUndefined();
  });

  it("marks public domain codes", () => {
    expect(getActivityLicense({ name: "PD" })?.publicDomain).toBe(true);
    expect(getActivityLicense({ name: "CC0 1.0" })?.url).toContain("publicdomain/zero");
  });
});

describe("buildActivityAttribution", () => {
  const base = { title: "Regulations on Fintech", authors: ["Sophie K"], publisher: "WWU" };

  it("reads as the designed sentence", () => {
    expect(
      buildActivityAttribution({ ...base, license: { name: "CC BY", version: "4.0" } })
    ).toBe(
      "Regulations on Fintech by Sophie K, WWU, is shared under a CC BY 4.0 license, except where otherwise noted."
    );
  });

  it("drops the clauses it has no data for", () => {
    expect(buildActivityAttribution({ title: "Quiz", authors: [] })).toBe("Quiz.");
    expect(
      buildActivityAttribution({ title: "Quiz", authors: [], license: { name: "PD" } })
    ).toBe("Quiz, is in the public domain (Public Domain).");
  });
});

describe("content types", () => {
  it("maps by machine name and falls back to the generic icon", () => {
    expect(getContentTypeIcon("H5P.InteractiveVideo 1.27")).toBe(IconPlayerPlay);
    expect(getContentTypeIcon("H5P.SomethingNew 1.0")).toBe(IconBox);
    expect(getContentTypeIcon(undefined)).toBe(IconBox);
  });

  it("prefers Studio's library title, else humanises the machine name", () => {
    expect(getContentTypeName({ libraryTitle: "Interactive Video", library: "H5P.InteractiveVideo 1.27" })).toBe(
      "Interactive Video"
    );
    expect(getContentTypeName({ library: "H5P.DragQuestion 1.14" })).toBe("Drag Question");
    expect(getContentTypeName({})).toBeUndefined();
  });
});

describe("embed code", () => {
  it("uses the public embed URL contract and the canonical resizer path", () => {
    expect(getActivityEmbedURL("https://studio.libretexts.org/", 31483)).toBe(
      "https://studio.libretexts.org/h5p/31483/embed"
    );
    const code = buildActivityEmbedCode("https://studio.libretexts.org", 31483, 'Say "hi" & <go>');
    expect(code).toContain('src="https://studio.libretexts.org/h5p/31483/embed"');
    expect(code).toContain('title="Say &quot;hi&quot; &amp; &lt;go>"');
    expect(code).toContain('src="https://studio.libretexts.org/h5p/core/js/h5p-resizer.js"');
  });
});
