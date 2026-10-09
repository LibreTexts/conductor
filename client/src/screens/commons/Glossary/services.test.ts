import { describe, expect, it } from "vitest";
import {
  glossaryEntriesToCsv,
  neutralizeCsvFormula,
  stripHtml,
} from "./services";
import { GlossaryEntry } from "./model";

const entry = (term: string, definition: string): GlossaryEntry =>
  ({
    term,
    definition,
    aliases: [],
    pages: [],
  }) as unknown as GlossaryEntry;

describe("stripHtml", () => {
  it("keeps inline LaTeX containing < and > verbatim", () => {
    expect(stripHtml("If \\(a<b\\) and \\(c>d\\) then")).toBe(
      "If \\(a<b\\) and \\(c>d\\) then",
    );
  });

  it("keeps display math and environments verbatim", () => {
    expect(stripHtml("See $$x<y$$ or \\[p>q\\]")).toBe("See $$x<y$$ or \\[p>q\\]");
    expect(
      stripHtml("\\begin{align} a &<& b \\end{align}"),
    ).toBe("\\begin{align} a &<& b \\end{align}");
  });

  it("still strips HTML outside math", () => {
    expect(stripHtml("<p>Area is \\(\\pi r^2\\)</p>")).toBe(
      "Area is \\(\\pi r^2\\)",
    );
  });
});

describe("neutralizeCsvFormula", () => {
  it("prefixes cells a spreadsheet would run as a formula", () => {
    expect(neutralizeCsvFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(neutralizeCsvFormula("+1")).toBe("'+1");
    expect(neutralizeCsvFormula("-x")).toBe("'-x");
    expect(neutralizeCsvFormula("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("leaves LaTeX and ordinary text alone", () => {
    expect(neutralizeCsvFormula("\\(x=1\\)")).toBe("\\(x=1\\)");
    expect(neutralizeCsvFormula("$$x$$")).toBe("$$x$$");
    expect(neutralizeCsvFormula("Cell")).toBe("Cell");
  });
});

describe("glossaryEntriesToCsv", () => {
  it("exports LaTeX as written and neutralizes formula cells", () => {
    const csv = glossaryEntriesToCsv([
      entry("Inequality", "\\(a<b\\)"),
      entry("=cmd", "-1 is negative"),
    ]);
    const [, row1, row2] = csv.split("\r\n");
    expect(row1).toBe("Inequality,\\(a<b\\),,,,,,,");
    expect(row2).toBe("'=cmd,'-1 is negative,,,,,,,");
  });

  it("adds the license version and page titles (from the TOC)", () => {
    const toc = {
      id: "1",
      title: "Book",
      url: "",
      children: [
        { id: "10", title: "Chapter 1", url: "", children: [] },
      ],
    } as unknown as Parameters<typeof glossaryEntriesToCsv>[1];
    const csv = glossaryEntriesToCsv(
      [
        {
          ...entry("Cell", "Basic unit"),
          source: "ccby",
          sourceVersion: "40",
          pages: [
            { pageID: "10", addedBy: "u", createdAt: "" },
            { pageID: "99", addedBy: "u", createdAt: "" },
          ],
        },
      ],
      toc,
    );
    const [header, row] = csv.split("\r\n");
    expect(header).toBe(
      "Term,Definition,Aliases,Author,Source,License Version,Link,Page IDs,Page Titles",
    );
    expect(row).toBe("Cell,Basic unit,,,ccby,40,,10; 99,Chapter 1; Removed Page");
  });
});
