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

/** Diffs and page versions past this length are cut. */
export const MAX_DIFF_CHARS = 200_000;

export const sanitizeRevisionDiff = (html: string): string =>
  sanitizeHtml(html.slice(0, MAX_DIFF_CHARS), REVISION_DIFF_OPTIONS);

/**
 * A URL from the page's own content made absolute against its library, so a
 * relative image or link points at the library, not at Conductor. Null for
 * anything that isn't http(s) once resolved.
 */
const absoluteUrl = (value: string | undefined, origin: string, schemes: string[]): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    return schemes.includes(url.protocol.replace(":", "")) ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * A page as it was at one revision, for reading in Conductor: the diff's text
 * allowlist plus images, figures and rules. Images and links are resolved
 * against the page's library (`origin`, e.g. `https://chem.libretexts.org`);
 * images load over https only. No scripts, styles, classes or embeds.
 */
export const sanitizeRevisionContent = (html: string, origin: string): string =>
  sanitizeHtml(html.slice(0, MAX_DIFF_CHARS), {
    ...REVISION_DIFF_OPTIONS,
    allowedTags: [...(REVISION_DIFF_OPTIONS.allowedTags as string[]), "img", "figure", "figcaption", "hr", "caption"],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"] },
    transformTags: {
      a: (tagName, attribs) => {
        const href = absoluteUrl(attribs.href, origin, ["http", "https"]);
        return {
          tagName,
          attribs: { ...(href ? { href } : {}), target: "_blank", rel: "noopener noreferrer" },
        };
      },
      img: (tagName, attribs) => {
        const src = absoluteUrl(attribs.src, origin, ["https"]);
        return {
          tagName,
          attribs: {
            ...(src ? { src } : {}),
            alt: attribs.alt ?? "",
            ...(attribs.width ? { width: attribs.width } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
          },
        };
      },
    },
    // An image whose source didn't survive is dropped, not left empty.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });

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
  /** The revision's message, e.g. "5 words added". */
  summary: string;
  /** Part of the change under review: after `fromRev`, up to `toRev`. */
  inChange: boolean;
};

/** Revisions listed per source, newest first; the change's own are always kept. */
export const MAX_REVISIONS = 50;

const revisionNumber = (r: RawRevision) => Number(r["@revision"]);

/** Whether a revision belongs to a change; without `fromRev` (a first sighting), only `toRev`. */
const inChange = (revision: number, fromRev: number | undefined, toRev: number | undefined) =>
  toRev === undefined
    ? false
    : fromRev === undefined
      ? revision === toRev
      : revision > fromRev && revision <= toRev;

/**
 * A source page's revisions, newest first, each marked if it belongs to the
 * change under review. The newest `limit` are listed, plus the change's own
 * if they are older than that.
 */
export const revisionHistory = (
  raw: RawRevision[],
  fromRev: number | undefined,
  toRev: number | undefined,
  limit = MAX_REVISIONS,
): RevisionView[] =>
  raw
    .filter((r) => Number.isFinite(revisionNumber(r)))
    .sort((a, b) => revisionNumber(b) - revisionNumber(a))
    .map((r) => {
      const revision = revisionNumber(r);
      const author = r["user.author"];
      return {
        revision,
        editedAt: r["date.edited"] ? new Date(r["date.edited"]).toISOString() : null,
        author: author?.fullname || author?.username || author?.nick || null,
        summary: r.description ?? "",
        inChange: inChange(revision, fromRev, toRev),
      };
    })
    .filter((view, i) => i < limit || view.inChange);

/** The revision just before `revision` in a page's history, or null for its first. */
export const previousRevision = (raw: RawRevision[], revision: number): number | null => {
  const older = raw.map(revisionNumber).filter((n) => Number.isFinite(n) && n < revision);
  return older.length ? Math.max(...older) : null;
};
