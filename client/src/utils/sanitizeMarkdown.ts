import DOMPurify from "dompurify";
import { marked } from "marked";

// Registered once at module load. Registering inside a component adds a duplicate
// global hook on every mount.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if ("target" in node) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Renders user-authored Markdown to sanitized HTML. Links open in a new tab.
 */
export function sanitizeMarkdown(markdown: string, options?: { breaks?: boolean }): string {
  return DOMPurify.sanitize(marked(markdown, { breaks: options?.breaks ?? false }));
}
