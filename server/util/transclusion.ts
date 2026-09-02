import * as cheerio from "cheerio";

/**
 * Detection for MindTouch transclusion "stub" pages — pages whose entire body is
 * a pointer at another page, as produced by `RemixerTemplates.POST_Transclude*`.
 *
 * The distinction that matters: a page may *contain* content-reuse blocks
 * (an authored page pulling in a shared definition, a prerequisites list, etc.)
 * without *being* a transclusion of anything. Treating the two the same makes a
 * copy of the page resolve to whatever its first embedded block happened to
 * point at, discarding the page's real content.
 */

/** Matches CrossTransclude/Web — captures Library (group 1) and PageID (group 2). */
export const CROSS_TRANSCLUDE_SOURCE_RE =
  /template\(\s*['"]CrossTransclude\/Web['"]\s*,\s*\{[\s\S]*?['"]Library['"]\s*:\s*['"]([^'"]+)['"][\s\S]*?['"]PageID['"]\s*:\s*(\d+)/i;

/** Matches the rendered content-reuse widget — captures the data-page value (group 1). */
export const CONTENT_REUSE_WIDGET_RE =
  /<div[^>]+class=["'][^"']*mt-contentreuse-widget[^"']*["'][^>]+data-page=["']([^"']+)["']/i;

/** Matches a raw wikitext `wiki.page("path", ...)` call — captures the path (group 1). */
export const WIKI_PAGE_REUSE_RE =
  /wiki\.page\s*\(\s*(?:["']|&quot;)([^"'&]+)/i;

/**
 * Whole-page form only: the second argument is NULL. A string second argument
 * names a section, which means the call pulls a fragment into a larger page.
 */
const WIKI_PAGE_WHOLE_RE =
  /wiki\.page\s*\(\s*(?:["']|&quot;)([^"'&]+)(?:["']|&quot;)\s*,\s*NULL\s*\)?/i;

/**
 * MindTouch stores page paths only partially encoded — the fixtures carry raw
 * `:` in `data-page` — so a title containing a bare `%` reaches us as an
 * invalid escape and `decodeURIComponent` throws. A path we cannot decode is
 * still usable as-is, and is far better than an exception unwinding into the
 * remixer publish job.
 */
const safeDecodePath = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export type TranscludeStub =
  | { kind: "cross-library"; subdomain: string; pageID: number }
  | { kind: "same-library"; path: string };

/**
 * The page-contents API sometimes hands back a JSON envelope rather than bare
 * HTML. Both callers need the HTML body, so unwrap once here.
 */
export const unwrapPageBody = (rawContents: string): string => {
  try {
    const parsed = JSON.parse(rawContents);
    const body = parsed?.body;
    if (typeof body === "string") return body;
    if (Array.isArray(body) && typeof body[0] === "string") return body[0];
  } catch {
    // Not JSON — already raw HTML.
  }
  return rawContents;
};

/**
 * True when the body carries any transclusion or content-reuse markup at all,
 * whether the page is a stub or an authored page embedding reused blocks.
 */
export const containsReuseMarkup = (rawContents: string): boolean => {
  const html = unwrapPageBody(rawContents);
  return (
    CROSS_TRANSCLUDE_SOURCE_RE.test(html) ||
    CONTENT_REUSE_WIDGET_RE.test(html) ||
    WIKI_PAGE_REUSE_RE.test(html)
  );
};

const countOccurrences = (haystack: string, needle: string): number => {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
};

/** Scaffolding a generated stub is allowed to carry alongside its pointer. */
const STUB_SCAFFOLD_SELECTORS = [
  // Attribute form, not an escaped-colon class selector — css-select rejects
  // `.template\:tag-insert`.
  'p[class~="template:tag-insert"]',
  "p.mt-script-comment",
  "div.comment",
  "script",
  "style",
];

/**
 * Layout wrappers a WYSIWYG editor leaves behind. Only ignorable when
 * completely empty \u2014 no text, no attributes, no children. Anything else,
 * including an `<hr>` or a `<p class="foo">`, is authored content.
 */
const EMPTY_LAYOUT_TAGS = new Set(["p", "div", "span", "br"]);

/**
 * True when anything survives after the pointer and its scaffolding are
 * removed. Enumerating "content" element types is a losing game \u2014 `<svg>`,
 * `<canvas>`, `<hr>`, and form controls are all real, text-free content \u2014 so
 * the rule is inverted: every remaining element counts unless it is a provably
 * empty layout wrapper. Over-counting only costs a chain collapse; under-
 * counting publishes a pointer in place of a real page.
 */
const hasMeaningfulRemainder = ($: cheerio.CheerioAPI): boolean => {
  const text = ($.root().text() ?? "").replace(/[\s\u00a0]+/g, "");
  if (text.length > 0) return true;

  return (
    $.root()
      .find("*")
      .toArray()
      .some((el) => {
        const node = $(el);
        const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
        if (!EMPTY_LAYOUT_TAGS.has(tag)) return true;
        if (Object.keys(node.attr() ?? {}).length > 0) return true;
        return node.children().length > 0;
      })
  );
};

/**
 * Returns a stub descriptor iff the body is *nothing but* transclusion
 * machinery. Any authored content alongside the pointer, or a reuse widget that
 * names a section, means the page owns its content and is its own source.
 */
export const detectTranscludeStub = (
  rawContents: string,
): TranscludeStub | null => {
  const html = unwrapPageBody(rawContents);
  if (!html.trim()) return null;

  // An unterminated `<!--` makes the parser consume the rest of the body as a
  // single comment node, so stripping comments would erase authored content and
  // leave what looks like a bare pointer. We cannot tell markup from commentary
  // in that state, so refuse to classify: the page becomes its own source.
  if (countOccurrences(html, "<!--") > countOccurrences(html, "-->")) {
    return null;
  }

  // Fragment parse so the body is not wrapped in <html><head><body>.
  const $ = cheerio.load(html, null, false);

  // Drop comments through the DOM rather than by regex on the source. A regex
  // mis-handles `<!--` inside an attribute or a <pre>, and an unterminated
  // comment would leave a dangling `<!--` for the parser to swallow the rest
  // of the body into — which reads as an empty page, i.e. a false stub.
  $.root()
    .find("*")
    .addBack()
    .contents()
    .filter((_, node) => node.type === "comment")
    .remove();

  $(STUB_SCAFFOLD_SELECTORS.join(",")).remove();

  // Boxed in an object so assignments inside the cheerio callbacks below are
  // not narrowed away by control-flow analysis.
  const found: { stub: TranscludeStub | null; candidates: number } = {
    stub: null,
    candidates: 0,
  };

  const claim = (next: TranscludeStub) => {
    found.candidates += 1;
    found.stub = next;
  };

  // Whole-page content-reuse widget: data-section absent or empty.
  $("div.mt-contentreuse-widget").each((_, el) => {
    const node = $(el);
    const section = (node.attr("data-section") ?? "").trim();
    const page = (node.attr("data-page") ?? "").trim();
    if (section.length > 0 || page.length === 0) {
      // Sectional reuse: embedded content, never a stub marker. Leave the node
      // in place so it counts against `hasMeaningfulRemainder`.
      found.candidates += 1;
      return;
    }
    claim({ kind: "same-library", path: safeDecodePath(page) });
    node.remove();
  });

  // Cross-library transclusion and bare wiki.page() wikitext both live in a
  // <pre class="script"> that the widget pass above has already stripped when
  // it belonged to a widget.
  $("pre.script").each((_, el) => {
    const node = $(el);
    const script = node.text() ?? "";

    const cross = script.match(CROSS_TRANSCLUDE_SOURCE_RE);
    if (cross) {
      const pageID = parseInt(cross[2], 10);
      if (cross[1] && !Number.isNaN(pageID)) {
        claim({ kind: "cross-library", subdomain: cross[1], pageID });
        node.remove();
      }
      return;
    }

    const whole = script.match(WIKI_PAGE_WHOLE_RE);
    if (whole?.[1]) {
      claim({ kind: "same-library", path: safeDecodePath(whole[1]) });
      node.remove();
      return;
    }

    // A wiki.page() naming a section, or any other script, is page content.
    if (WIKI_PAGE_REUSE_RE.test(script)) {
      found.candidates += 1;
    }
  });

  if (found.candidates !== 1 || !found.stub) return null;
  if (hasMeaningfulRemainder($)) return null;

  return found.stub;
};
