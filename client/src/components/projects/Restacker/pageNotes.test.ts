import { describe, expect, it } from "vitest";
import { getPageNotes } from "./pageNotes";

describe("getPageNotes", () => {
  it("adds the transcluded note when the page has a source license", () => {
    const notes = getPageNotes({
      url: "https://x/01%3A_Chapter/1.1%3A_Page",
      sourceLicense: { label: "license:ccby", raw: "" },
    });
    expect(notes.map((n) => n.id)).toEqual(["transcluded"]);
  });

  it("adds the generated-list note for the TOC and Index only", () => {
    expect(
      getPageNotes({ url: "https://x/00%3A_Front_Matter/03%3A_Table_of_Contents" })
        .map((n) => n.id),
    ).toEqual(["generated-list"]);
    expect(
      getPageNotes({ url: "https://x/zz%3A_Back_Matter/10%3A_Index" }).map((n) => n.id),
    ).toEqual(["generated-list"]);
    expect(getPageNotes({ url: "https://x/00%3A_Front_Matter/04%3A_Licensing" })).toEqual([]);
  });
});
