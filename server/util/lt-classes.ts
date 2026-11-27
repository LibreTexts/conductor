import * as cheerio from "cheerio";
import { librariesOptions } from "./libraries.js";
import { unwrapPageBody } from "./transclusion.js";

/**
 * `lt-{library}-{pageID}` classes: LibreTexts' attribution of a block of
 * content to the page it came from.
 *
 * - In a page's **raw** content they mark blocks *copied* from another page
 *   (copy/paste keeps the class). Live transclusions never put them in raw
 *   content, so they are the one marker of copied excerpts.
 * - In **rendered** content MindTouch also stamps live transclusions and
 *   embedded sections with their source's class.
 *
 * Either way a page's *own* class is not reuse: content of `dev-1000` carrying
 * `lt-dev-1000` is that page's own content.
 */

const LIBRARIES = new Set(librariesOptions);
const LT_CLASS_RE = /^lt-([a-z0-9]+)-(\d+)$/i;

/** Blocks counted for the quotation rate: the text-bearing elements. */
const TEXT_BLOCKS = "p, h1, h2, h3, h4, h5, h6";

export type LtSource = { lib: string; pageID: number };

/** The `lt-` source a single class names, or null (unknown library, malformed). */
export const parseLtClass = (cls: string): LtSource | null => {
  const match = LT_CLASS_RE.exec(cls.trim());
  if (!match) return null;
  const lib = match[1].toLowerCase();
  const pageID = parseInt(match[2], 10);
  if (!LIBRARIES.has(lib) || !Number.isFinite(pageID) || pageID <= 0) return null;
  return { lib, pageID };
};

const isOwn = (source: LtSource, own?: LtSource | null) =>
  !!own && source.lib === own.lib.toLowerCase() && source.pageID === Number(own.pageID);

/**
 * The `lt-` sources an element's class list names, other than the page's own.
 */
const foreignSourcesOf = (classAttr: string | undefined, own?: LtSource | null): LtSource[] => {
  const out: LtSource[] = [];
  for (const cls of (classAttr ?? "").split(/\s+/)) {
    if (!cls) continue;
    const source = parseLtClass(cls);
    if (source && !isOwn(source, own)) out.push(source);
  }
  return out;
};

/** True when a class list attributes the block to another page (not `own`). */
export const isQuotedClass = (classAttr: string | undefined, own?: LtSource | null): boolean =>
  foreignSourcesOf(classAttr, own).length > 0;

export type LtExcerpt = LtSource & {
  /** Elements attributed to this source. */
  blocks: number;
};

/**
 * Every other page a body attributes content to, with how many elements carry
 * each, in document order. The page's `own` class is excluded, and only real
 * library keys count. Reads class attributes, so prose that merely mentions
 * `lt-chem-1` doesn't count. Accepts the contents API's JSON envelope.
 */
export const parseLtClasses = (
  rawContents: string,
  { own }: { own?: LtSource | null } = {},
): LtExcerpt[] => {
  const html = unwrapPageBody(rawContents);
  if (!html.trim()) return [];
  const $ = cheerio.load(html, null, false);
  const bySource = new Map<string, LtExcerpt>();
  $("[class]").each((_, el) => {
    for (const source of foreignSourcesOf($(el).attr("class"), own)) {
      const key = `${source.lib}-${source.pageID}`;
      const existing = bySource.get(key);
      if (existing) existing.blocks += 1;
      else bySource.set(key, { ...source, blocks: 1 });
    }
  });
  return [...bySource.values()];
};

/**
 * Share of a page's text blocks that come from other pages: blocks carrying
 * another page's `lt-` class ÷ all text blocks. Blocks with no `lt-` class,
 * or with the page's own, are the page's own content. 0 for a page with no
 * text blocks.
 */
export const quotationRate = (html: string, own?: LtSource | null): number => {
  const $ = cheerio.load(unwrapPageBody(html));
  const blocks = $(TEXT_BLOCKS);
  if (blocks.length === 0) return 0;
  let quoted = 0;
  blocks.each((_, el) => {
    if (isQuotedClass($(el).attr("class"), own)) quoted += 1;
  });
  return quoted / blocks.length;
};
