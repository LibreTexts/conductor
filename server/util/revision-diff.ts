import sanitizeHtml from "sanitize-html";

/**
 * Library page revisions and diffs, shaped for display in Conductor. The
 * diff HTML comes from the library (authored by any library user), so it is
 * rendered only after this allowlist: text structure and the `<ins>`/`<del>`
 * change marks, no scripts, styles, event handlers, images or embeds.
 */

const REVISION_DIFF_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "span", "div", "ins", "del",
    "b", "strong", "i", "em", "u", "s", "sub", "sup", "code", "pre", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tr", "th", "td",
    "a",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https"],
  // Drop the content of these too, not just the tags.
  nonTextTags: ["script", "style", "textarea", "noscript", "iframe", "object"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

/** Diffs past this length are cut; the full history is on the library page. */
export const MAX_DIFF_CHARS = 200_000;

export const sanitizeRevisionDiff = (html: string): string =>
  sanitizeHtml(html.slice(0, MAX_DIFF_CHARS), REVISION_DIFF_OPTIONS);

/** One page revision as the library's revisions API returns it. */
export type RawRevision = {
  "@revision"?: string | number;
  "date.edited"?: string;
  description?: string;
  "uri.ui"?: string;
  "user.author"?: { fullname?: string; username?: string; nick?: string } | null;
};

export type RevisionView = {
  revision: number;
  editedAt: string | null;
  author: string | null;
  /** The library's edit summary, e.g. "5 words added". */
  summary: string;
  /** The page as it was at this revision. */
  url: string | null;
};

/**
 * The revisions a change spans: after `fromRev` up to and including `toRev`,
 * newest first. Without a known `fromRev` (a first sighting), only `toRev`.
 */
export const revisionsBetween = (
  raw: RawRevision[],
  fromRev: number | undefined,
  toRev: number | undefined,
): RevisionView[] =>
  raw
    .map((r) => ({ r, revision: Number(r["@revision"]) }))
    .filter(({ revision }) => Number.isFinite(revision))
    .filter(({ revision }) =>
      toRev === undefined
        ? false
        : fromRev === undefined
          ? revision === toRev
          : revision > fromRev && revision <= toRev,
    )
    .sort((a, b) => b.revision - a.revision)
    .map(({ r, revision }) => {
      const author = r["user.author"];
      const base = r["uri.ui"];
      return {
        revision,
        editedAt: r["date.edited"] ? new Date(r["date.edited"]).toISOString() : null,
        author: author?.fullname || author?.username || author?.nick || null,
        summary: r.description ?? "",
        url: base ? `${base}${base.includes("?") ? "&" : "?"}revision=${revision}` : null,
      };
    });
