import { describe, expect, it } from "vitest";
import {
  getRemixerPageUriUi,
  hasFormattedPathChanged,
  stripReservedPathChars,
  syncRenamedItemFromAutonumberTitle,
  toCanonicalPageUrl,
  withDerivedStatusFlags,
} from "./services";
import type { RemixerSubPage } from "./model";

// The server runs the same cases against the originals in
// server/util/remixerutils.test.ts. The UI and the publish job must follow one
// rule for page paths, so change both together.

describe("path rule: & : ? are kept, the rest of the reserved set is dropped", () => {
  it("stripReservedPathChars", () => {
    expect(stripReservedPathChars("A&B: why?")).toBe("A&B: why?");
    expect(
      stripReservedPathChars("a/b\\c#d%e+f\"g'h<i>j|k{l}m^n[o]p`q"),
    ).toBe("abcdefghijklmnopq");
  });
});

describe("toCanonicalPageUrl", () => {
  it("turns the ?title= form into a %-encoded pathname", () => {
    expect(
      toCanonicalPageUrl(
        "https://human.libretexts.org/?title=Workbench/esl_reading_%26_writing/00%3A_Front_Matter",
      ),
    ).toBe(
      "https://human.libretexts.org/Workbench/esl_reading_%26_writing/00%3A_Front_Matter",
    );
    expect(toCanonicalPageUrl("https://dev.libretexts.org/?title=Book/Why%3F")).toBe(
      "https://dev.libretexts.org/Book/Why%3F",
    );
  });

  it("keeps % and + as written in the library path", () => {
    expect(
      toCanonicalPageUrl("https://chem.libretexts.org/?title=Book/50%25_Off"),
    ).toBe("https://chem.libretexts.org/Book/50%25_Off");
    // A raw "+" is a plus sign in a page path, never a space.
    expect(
      toCanonicalPageUrl("https://eng.libretexts.org/?title=Book/C++_Programming"),
    ).toBe("https://eng.libretexts.org/Book/C%2B%2B_Programming");
    // A bare "%" that is not an escape is kept, not thrown on.
    expect(
      toCanonicalPageUrl("https://chem.libretexts.org/?title=Book/50%_Off"),
    ).toBe("https://chem.libretexts.org/Book/50%25_Off");
  });

  it("does not flag a page whose URL holds % as moved or renamed", () => {
    // hasFormattedPathChanged only reads the leading ordinal of the URL's last
    // segment, so an encoded % later in the segment must not trip it.
    const page = {
      "@id": "101",
      "@title": "1.3: 50% Off",
      title: "1.3: 50% Off",
      parentID: "100",
      pathNumber: ["1", "3"],
      originalPathNumber: ["1", "3"],
      "uri.ui": "https://chem.libretexts.org/?title=Book/01%3A_Ch/1.03%3A_50%25_Off",
    } as unknown as RemixerSubPage;
    expect(hasFormattedPathChanged(page)).toBe(false);
    expect(withDerivedStatusFlags([page])[0]).toMatchObject({
      movedItem: false,
      isPlacementChanged: false,
    });
  });

  describe("a page titled 'Read & Write' (URL …/01%3A_Read_%26_Write)", () => {
    // MindTouch can hand the same page back in three shapes: a pathname, the
    // `?title=` query form, and the query form with `/` escaped as %2F.
    const urls = [
      "https://human.libretexts.org/Workbench/Book/01%3A_Read_%26_Write",
      "https://human.libretexts.org/?title=Workbench/Book/01%3A_Read_%26_Write",
      "https://human.libretexts.org/?title=Workbench%2FBook%2F01%3A_Read_%26_Write",
    ];
    const bookWith = (uri: string): RemixerSubPage[] =>
      [
        {
          "@id": "100",
          "@title": "Book",
          title: "Book",
          parentID: "-1",
          pathNumber: [],
          originalPathNumber: [],
          "uri.ui": "https://human.libretexts.org/Workbench/Book",
        },
        {
          "@id": "101",
          "@title": "1: Read & Write",
          title: "1: Read & Write",
          parentID: "100",
          pathNumber: ["1"],
          originalPathNumber: ["1"],
          "uri.ui": uri,
        },
      ] as unknown as RemixerSubPage[];

    it.each(urls)("is not flagged as moved or renamed: %s", (uri) => {
      const book = bookWith(uri);
      expect(getRemixerPageUriUi(book[1])).toBe(urls[0]);
      expect(hasFormattedPathChanged(book[1])).toBe(false);
      const [, page] = withDerivedStatusFlags(
        syncRenamedItemFromAutonumberTitle(book, true, []),
      );
      expect(page).toMatchObject({
        renamedItem: false,
        isRenamed: false,
        movedItem: false,
        isPlacementChanged: false,
      });
    });
  });

  it("leaves pathname, API and placeholder URLs alone", () => {
    const pathname = "https://chem.libretexts.org/Bookshelves/Book/01%3A_Intro";
    expect(toCanonicalPageUrl(pathname)).toBe(pathname);
    const api = "https://chem.libretexts.org/@api/deki/pages/12?redirects=0";
    expect(toCanonicalPageUrl(api)).toBe(api);
    expect(toCanonicalPageUrl("#")).toBe("#");
    expect(toCanonicalPageUrl("")).toBe("");
  });

  it("is what getRemixerPageUriUi returns for a stored ?title= URL", () => {
    const page = {
      "uri.ui": "https://human.libretexts.org/?title=Workbench/a_%26_b",
    } as unknown as RemixerSubPage;
    expect(getRemixerPageUriUi(page)).toBe(
      "https://human.libretexts.org/Workbench/a_%26_b",
    );
  });
});
