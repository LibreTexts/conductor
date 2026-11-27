import { describe, expect, it } from "vitest";
import { ALL_OPTION, applyListChange, describeSelection, listValue } from "./libraryGroups";

const available = ["bio", "chem", "human", "med"];
const STEM = "group:stem";

describe("library list with group options", () => {
  it("marks All when nothing is selected, and a group when it matches exactly", () => {
    expect(listValue([], available)).toEqual([ALL_OPTION]);
    expect(listValue(["bio", "chem"], available)).toEqual(["bio", "chem", STEM]);
    expect(listValue(["bio"], available)).toEqual(["bio"]);
  });

  it("replaces the selection when a group or All is chosen", () => {
    expect(applyListChange(["human"], ["human", STEM], available)).toEqual(["bio", "chem"]);
    expect(applyListChange(["bio", "chem", STEM], ["bio", "chem", STEM, ALL_OPTION], available)).toEqual([]);
  });

  it("goes back to every library when the checked group is unchecked", () => {
    expect(applyListChange(["bio", "chem", STEM], ["bio", "chem"], available)).toEqual([]);
  });

  it("toggles single libraries, leaving All behind", () => {
    expect(applyListChange([ALL_OPTION], [ALL_OPTION, "med"], available)).toEqual(["med"]);
    expect(applyListChange(["bio", "chem", STEM], ["chem", STEM], available)).toEqual(["chem"]);
    // Unchecking All with nothing else selected keeps every library.
    expect(applyListChange([ALL_OPTION], [], available)).toEqual([]);
  });

  it("describes the selection", () => {
    expect(describeSelection([], available)).toBe("All libraries");
    expect(describeSelection(["chem", "bio"], available)).toBe("STEM");
    expect(describeSelection(["bio", "med"], available)).toBe("bio, med");
  });
});
