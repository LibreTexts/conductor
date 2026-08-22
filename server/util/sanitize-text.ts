import sanitizeHtml from "sanitize-html";
import { decodeHTML } from "entities";

/**
 * Sanitizers for free-text values that originate outside Conductor — library
 * page titles, author names, overviews, and the labels derived from library
 * paths and tags.
 *
 * These fields are authored by thousands of library users and end up rendered
 * across Commons, so they are treated as untrusted plain text: anything that
 * carries meaning to an HTML parser is removed at ingest rather than escaped
 * at each render site. Ordinary punctuation (`.,$#()&%`, quotes, dashes) is
 * preserved — the goal is text that is safe in any context, not text stripped
 * down to alphanumerics.
 *
 * Markup removal is delegated to `sanitize-html`, which tokenizes with a real
 * HTML parser. This mirrors `PressbooksUtils.sanitizeToText`, with one
 * difference: `sanitize-html` emits *escaped* HTML text, so `A & B` comes back
 * as `A &amp; B`. Book fields are rendered as React text nodes rather than
 * through `dangerouslySetInnerHTML`, where that would display literally, so
 * the output is decoded back to plain text here.
 */
const STRIP_ALL_MARKUP: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

/**
 * A `<` that an HTML parser would treat as opening a tag. Per the tokenizer
 * spec a `<` is only special when followed by a letter, `/`, `!`, or `?`;
 * anything else — `a < b`, `5 < 10` — is literal text and stays. `>` is never
 * special on its own, so it is left alone entirely.
 */
const TAG_OPENER = /<(?=[a-zA-Z/!?])/g;

/**
 * C0/C1 control characters — which covers carriage return, line feed, and tab —
 * plus the Unicode line and paragraph separators. Replaced with a space rather
 * than deleted, so a title broken across two lines does not have its words run
 * together.
 */
const BREAKING_CHARS = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

/**
 * Invisible characters that survive a tag strip: format controls (zero-width
 * joiners, bidi overrides, soft hyphens), lone surrogates, and private-use code
 * points.
 *
 * Deliberately excludes `\p{Cn}`. "Unassigned" is relative to whichever Unicode
 * table the running Node happens to ship, so a title using a character newer
 * than that table would be silently gutted on one deploy and pass on the next.
 * The permanently-unassignable half of `Cn` — the noncharacters — is stripped by
 * {@link NONCHARACTERS} instead, which cannot drift.
 */
const INVISIBLE_CHARS = /[\p{Cf}\p{Cs}\p{Co}]/gu;

/**
 * The Unicode noncharacters (`U+FDD0..U+FDEF` and the last two code points of
 * every plane). Guaranteed never to be assigned, so this property carries none
 * of the version drift that `\p{Cn}` does.
 */
const NONCHARACTERS = /\p{Noncharacter_Code_Point}/gu;

/**
 * Exotic spaces (non-breaking, hair, ideographic), normalized to a plain space
 * so titles compare and collapse predictably.
 */
const EXOTIC_SPACES = /\p{Zs}/gu;

/**
 * How many strip/decode rounds to run. One round is not enough: decoding is
 * what makes a double-encoded payload (`&amp;lt;script&amp;gt;`) look like
 * markup, so the parser has to see the decoded form on a later pass. Four is
 * well past anything observed in the libraries; the loop exits as soon as a
 * round changes nothing.
 */
const MAX_ROUNDS = 4;

/**
 * Reduces an untrusted library string to plain text.
 *
 * Each round strips markup with a real parser, then decodes the entities it
 * emits. Repeating until the value stops changing closes the double-encoding
 * hole, where a single pass would leave `&lt;script&gt;` in storage for a
 * later decode to revive. Control and format characters are then removed and
 * whitespace is collapsed.
 *
 * Nullish input yields an empty string.
 */
export function sanitizeLibraryText(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0) return "";

  let text = value;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const next = decodeHTML(sanitizeHtml(text, STRIP_ALL_MARKUP));
    if (next === text) break;
    text = next;
  }

  return text
    .replace(TAG_OPENER, "")
    .replace(BREAKING_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(NONCHARACTERS, "")
    .replace(EXOTIC_SPACES, " ")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * {@link sanitizeLibraryText} for optional fields: a value that is absent, or
 * that sanitizes down to nothing, yields `undefined` rather than an empty
 * string, so the field is left off the record instead of stored blank.
 */
export function sanitizeOptionalLibraryText(
  value: string | null | undefined
): string | undefined {
  return sanitizeLibraryText(value) || undefined;
}
