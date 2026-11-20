import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes rich HTML authored in CKEditor (Insight articles, accessibility
 * statements) before it is stored. Clients re-sanitize on render.
 */
export function sanitizeRichHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ADD_TAGS: ["iframe", "figure", "oembed"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "scrolling",
      "srcdoc",
      "class",
      "url",
    ],
  });
}
