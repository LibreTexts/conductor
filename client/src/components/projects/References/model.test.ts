import { describe, expect, it } from "vitest";
import {
  CITATION_KEY_PATTERN,
  formatCitationPreview,
  generateCitationKey,
  parseBibtexToForm,
  toValidCitationKey,
  type ReferenceFormData,
} from "./model";

describe("parseBibtexToForm", () => {
  it("reads braced, quoted and bare-number fields", () => {
    expect(
      parseBibtexToForm(
        '@ARTICLE{key1, title = {A {Nested} Title}, author = "Doe, J.", year = 2021,}',
      ),
    ).toEqual({
      entryType: "article",
      citationKey: "key1",
      title: "A Nested Title",
      author: "Doe, J.",
      year: "2021",
    });
  });

  it("maps unsupported entry types to misc", () => {
    expect(parseBibtexToForm("@online{web1, title = {Site}}")?.entryType).toBe(
      "misc",
    );
  });

  it("cleans a citation key the server wouldn't accept", () => {
    expect(
      parseBibtexToForm("@book{Smith&Jones#2020, title = {T}}")?.citationKey,
    ).toBe("SmithJones2020");
  });

  it("returns null when there is no entry", () => {
    expect(parseBibtexToForm("not bibtex")).toBeNull();
  });

  it("handles a large body without slowing down", () => {
    const fields = Array.from(
      { length: 2000 },
      (_, i) => `note${i} = {value ${i}}`,
    ).join(",\n");
    const started = performance.now();
    const parsed = parseBibtexToForm(`@misc{big, ${fields}}`);
    expect(parsed?.citationKey).toBe("big");
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("toValidCitationKey", () => {
  it("keeps valid keys", () => {
    expect(toValidCitationKey("Smith:2020-a")).toBe("Smith:2020-a");
  });

  it("drops characters outside the key rule", () => {
    expect(toValidCitationKey("  Doe <2020> {x} ")).toBe("Doe2020x");
  });

  it("returns an empty key when nothing usable is left", () => {
    expect(toValidCitationKey("<>{}")).toBe("");
    expect(toValidCitationKey("__")).toBe("");
  });
});

describe("generateCitationKey", () => {
  const form: ReferenceFormData = {
    entryType: "article",
    citationKey: "",
    author: "José Núñez and A. Other",
    year: "c. 2019",
    title: "The Art of War",
  };

  it("builds AuthorYearTitle without accents or stop words", () => {
    expect(generateCitationKey(form)).toBe("Nunez2019Art");
  });

  it("adds a letter until the key is free", () => {
    expect(generateCitationKey(form, ["Nunez2019Art"])).toBe("Nunez2019Arta");
    expect(
      generateCitationKey(form, ["Nunez2019Art", "Nunez2019Arta"]),
    ).toBe("Nunez2019Artb");
  });

  it("falls back to 'untitled' and always matches the key rule", () => {
    const key = generateCitationKey({ entryType: "misc", citationKey: "" });
    expect(key).toBe("untitled");
    expect(CITATION_KEY_PATTERN.test(key)).toBe(true);
  });
});

describe("formatCitationPreview", () => {
  const form: ReferenceFormData = {
    entryType: "article",
    citationKey: "k",
    author: "Jane Smith and Bob Lee",
    title: "Cell Biology Today",
    journal: "Bio J",
    year: "2020",
    volume: "3",
    pages: "1-10",
  };

  it("formats APA by default", () => {
    expect(formatCitationPreview(form, undefined)).toBe(
      formatCitationPreview(form, "APA"),
    );
    expect(formatCitationPreview(form, "APA")).toContain(
      "Smith, J., & Lee, B. (2020).",
    );
  });

  it("quotes the title in MLA", () => {
    expect(formatCitationPreview(form, "MLA")).toContain(
      "“Cell Biology Today.”",
    );
  });

  it("is empty when there is nothing to show", () => {
    expect(
      formatCitationPreview({ entryType: "article", citationKey: "" }, "APA"),
    ).toBe("");
  });
});
