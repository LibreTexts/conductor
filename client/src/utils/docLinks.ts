/**
 * Doc keys the app links to. Each must match the `docKey` set on an Insight
 * page (KB editor, superadmin only). A key missing from the server's map hides
 * its link instead of rendering a broken one.
 */
export const DOC_LINK_KEYS = [
  "AI_CO_AUTHOR_TOOLS",
  "BOOKS_MANAGER",
  "REFERENCE_MANAGER",
  "REMIXER",
  "REMIXER_LOAD_STATE",
] as const;

export type DocLinkKey = (typeof DOC_LINK_KEYS)[number];

export type DocLinks = Partial<Record<DocLinkKey, string>>;

/** Absolute, because campus instances don't host Insight. */
export const buildInsightURL = (slug: string) =>
  `https://commons.libretexts.org/insight/${slug}`;
