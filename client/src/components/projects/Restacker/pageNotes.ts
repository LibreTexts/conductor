import type { RestackerTocLicense } from "../../../types";
import { parseLicenseKey } from "./util";

/**
 * Explanatory notes shown in a page's Compliance Details. Each note has a stable
 * `id` so its text can later be supplied from a Control Panel setting instead of
 * these defaults.
 */
export type PageNoteId = "transcluded" | "generated-list";

export type PageNote = { id: PageNoteId; title: string; text: string };

type PageNoteTarget = {
  url?: string;
  sourceLicense?: RestackerTocLicense;
};

/** URL substrings of computer-generated list pages (Table of Contents, Index). */
const GENERATED_LIST_PAGE_SUFFIXES = [
  "00%3A_Front_Matter/03%3A_Table_of_Contents",
  "zz%3A_Back_Matter/10%3A_Index",
];

const PAGE_NOTE_RULES: (PageNote & {
  appliesTo: (page: PageNoteTarget) => boolean;
})[] = [
  {
    id: "transcluded",
    title: "Transcluded page",
    text: "The content on this page has been set by the intellectual property (IP) owner and since this page is used without adaptation it cannot have its license changed - technically cannot be used in an adaptation under a new license. Only the IP owner can change the license of that IP.",
    appliesTo: (page) => !!parseLicenseKey(page.sourceLicense),
  },
  {
    id: "generated-list",
    title: "Public Domain page",
    text: "This page is set as public domain since this page is a computer generated list and such basic tables are not copyrightable because facts and simple lists of titles lack the creative expression required for copyright protection. Therefore, we have set it as public domain, which is remixable freely.",
    appliesTo: (page) =>
      GENERATED_LIST_PAGE_SUFFIXES.some((s) => page.url?.includes(s)),
  },
];

export function getPageNotes(page: PageNoteTarget): PageNote[] {
  return PAGE_NOTE_RULES.filter((rule) => rule.appliesTo(page)).map(
    ({ id, title, text }) => ({ id, title, text }),
  );
}
