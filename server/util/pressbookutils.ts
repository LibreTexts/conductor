import {
  addPageProperty,
  CXOneFetch,
  generateBookPathAndURL,
  getPageID,
} from "./librariesclient";
import conductorErrors from "../conductor-errors";
import MindTouch from "./CXOne/index.js";
import { License } from "../types";
import Author, { AuthorInterface } from "../models/author";

const defaultImagesURL = "https://cdn.libretexts.net/DefaultImages";

interface TocNode {
  id: number;
  title: string;
  slug: string;
  menu_order: number;
  has_post_content: boolean;
  status: string;
}

interface TocPart extends TocNode {
  chapters: TocNode[];
  link: string;
}

interface TocShape {
  "front-matter": TocNode[];
  parts: TocPart[];
  "back-matter": TocNode[];
}

/**
 * Shape of the `license` object as it appears on Pressbooks REST resources
 * (`/metadata`, `/parts/{id}`, `/chapters/{id}`, `/front-matter/{id}`,
 * `/back-matter/{id}`). All fields are optional because Pressbooks publishers
 * may configure the license incompletely.
 *
 *   { "@type": "CreativeWork", "code": "cc-by",
 *     "name": "Attribution 4.0 International (CC BY 4.0)",
 *     "url":  "https://creativecommons.org/licenses/by/4.0/" }
 */
interface PressbooksLicense {
  code?: string;
  name?: string;
  url?: string;
}

/**
 * Normalized contributor entry derived from Pressbooks'
 * `/wp-json/wp/v2/contributor` taxonomy. Pressbooks stores contributors as a
 * custom WP taxonomy where each term carries the displayable identity in
 * `name` / `description` and richer attributes (first name, last name,
 * institution, URL, picture, etc.) in `meta.contributor_*`.
 */
interface PressbooksContributor {
  id: number;
  slug: string;
  name: string;
  firstName?: string;
  lastName?: string;
  institution?: string;
  description?: string;
  url?: string;
  picture?: string;
}

export interface PublishOptions {
  /**
   * Optional logging callback used to stream progress messages.
   * Intended for background jobs (e.g., Pressbooks imports).
   */
  log?: (message: string) => void | Promise<void>;
}

export interface PublishResult {
  err: boolean;
  path: string;
  url: string;
  bookID: string;
  errMsg?: string;
  authorsName?: string;
  resourceURL?: string;
  sourcePublicationDate?: Date;
  license?: License;
  thumbnail?: string;
  isbn?: string;
}

export interface Author {
  name: string;
  description: string;
  url: string;
  avatar: string;
}

export interface FeaturedImage {
  url: string;
  alt: string;
  caption: string;
  width?: number;
  height?: number;
  thumbnail: string;
  medium: string;
  full: string;
}

export interface EnrichedItem {
  id: number | null;
  slug: string;
  order: number;
  link: string;
  status: string;
  date: string;
  modified: string;
  title: string;
  content_html: string;
  excerpt: string;
  author: Author | Record<string, never>;
  featured_image: FeaturedImage | Record<string, never>;
  terms: string[];
  comments: Reply[];
}

export interface Reply {
  author_name: string;
  date: string;
  content: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class PressBookScraper {
  private pbBookURL: string;
  private title?: string;
  private subdomain: string;
  private pbHeaders: Record<string, string>;

  /**
   * Cache of the book's license taxonomy, fetched once from
   * `/wp-json/wp/v2/license`. WordPress exposes licenses as a taxonomy where
   * each term has an `id` and a `slug` (e.g. `cc-by`); posts reference these
   * terms either by ID array (`license: [25]`) or — in the Pressbooks v2 REST
   * shape — by an inline JSON-LD object. We index both ways so either form
   * resolves to the same canonical `PressbooksLicense`.
   */
  private licenseTermsById: Map<number, PressbooksLicense> = new Map();
  private licenseTermsBySlug: Map<string, PressbooksLicense> = new Map();

  /**
   * Cache of the book's contributor taxonomy, fetched once from
   * `/wp-json/wp/v2/contributor`. Indexed by both the WP term ID and slug so
   * posts that reference contributors by either shape resolve through the
   * same map.
   */
  private contributorsById: Map<number, PressbooksContributor> = new Map();
  private contributorsBySlug: Map<string, PressbooksContributor> = new Map();

  constructor(pbBookURL: string, subdomain: string, title?: string) {
    this.pbBookURL = pbBookURL;
    this.title = title;
    this.subdomain = subdomain;
    this.pbHeaders = {
      "User-Agent": "Scraper/1.0 (educational research)",
      Accept: "application/json",
    };
  }

  private async getJson(
    url: string,
    auth?: { username: string; password: string },
  ): Promise<any> {
    const headers: Record<string, string> = { ...this.pbHeaders };
    if (auth) {
      headers["Authorization"] =
        "Basic " +
        Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
    }
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  private pbApi(bookUrl: string): string {
    return bookUrl.replace(/\/+$/, "") + "/wp-json/pressbooks/v2";
  }

  private convertLatexShortcodes(html: string): string {
    return html.replace(/\[latex](.*?)\[\/latex]/g, "\\($1\\)");
  }

  /**
   * Flatten every responsive image construct Pressbooks emits down to a
   * single `<img src="<largest>"/>`, removing `srcset` / `sizes` from any
   * element they appear on.
   *
   * Pressbooks emits responsive images in two shapes depending on theme:
   *
   *   1. Bare `<img>` with `srcset` / `sizes`:
   *      <img src="cover-300w.jpg"
   *           srcset="cover-300w.jpg 300w, cover-768w.jpg 768w, …"
   *           sizes="(max-width: 300px) 100vw, 300px" />
   *
   *   2. `<picture>` wrapper with multiple `<source srcset>` per format
   *      and an `<img>` fallback:
   *      <picture>
   *        <source srcset="cover-1536.webp 1536w" type="image/webp">
   *        <source srcset="cover-1536.jpg 1536w"  type="image/jpeg">
   *        <img src="cover-300.jpg" alt="…" />
   *      </picture>
   *
   * Downstream consumers (MindTouch's CXOne renderer, the print/PDF
   * pipeline, the reader exports) don't all honor `srcset`/`sizes`, so the
   * tiny default thumbnail in `src` leaks through as the actual rendered
   * image. By promoting the largest variant to `src` we get the high-res
   * asset everywhere, and by dropping `srcset`/`sizes` (including from
   * `<source>` elements) we prevent any downstream that *does* honor them
   * from re-selecting a smaller size on narrow viewports.
   *
   * The transform runs in three passes:
   *
   *   1. Picture-unwrap: each `<picture>…</picture>` block collapses to a
   *      single `<img>` whose `src` is the largest URL across every
   *      nested `<source srcset>` and the fallback `<img srcset>`. The
   *      fallback `<img>`'s other attributes (alt, class, width/height,
   *      …) are preserved so accessibility and layout info survive.
   *
   *   2. Img-srcset rewrite: any standalone `<img>` with a `srcset` is
   *      promoted to its largest variant.
   *
   *   3. Belt-and-braces strip: any `srcset` / `sizes` attribute still
   *      anywhere in the document (e.g. on an unusual custom element)
   *      is removed, guaranteeing no responsive-image hint can leak past
   *      this function regardless of source shape.
   *
   * Descriptor handling (in `parseLargestSrcsetURL`):
   *   - `Nw` (width descriptor)         → numeric pixel width, max wins
   *   - `Nx` (pixel-density descriptor) → numeric density, max wins
   *   - missing/malformed                → size 0, only wins when nothing
   *                                        else has a parseable descriptor
   *
   * Regex-based (no DOM parser dependency) because the existing
   * Pressbooks-import pipeline is already string-based (see
   * `convertLatexShortcodes`). Attribute values are matched with both
   * quote styles to be robust against publisher templates that use either.
   */
  private pickLargestSrcsetImage(html: string): string {
    // ── 1. Unwrap <picture> → <img src="<largest>"> ──────────────────────
    let result = html.replace(
      /<picture\b[^>]*>([\s\S]*?)<\/picture>/gi,
      (_full, inner: string) => this.flattenPicture(inner),
    );

    // ── 2. Rewrite standalone <img srcset=…> ─────────────────────────────
    result = result.replace(/<img\b[^>]*>/gi, (imgTag) => {
      const srcsetMatch = imgTag.match(
        /\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
      );
      if (!srcsetMatch) return imgTag;
      const srcsetValue = srcsetMatch[1] ?? srcsetMatch[2] ?? "";
      const largest = this.parseLargestSrcsetURL(srcsetValue);
      if (!largest) return imgTag;
      return this.applySrcAndStripResponsive(imgTag, largest);
    });

    // ── 3. Belt-and-braces: remove any lingering srcset / sizes ──────────
    // Picks up `srcset` on custom elements, `<source>` elements outside
    // a `<picture>` (legal HTML inside `<video>` / `<audio>`, which won't
    // host raster images for us but we strip uniformly for safety), and
    // any future container we haven't enumerated above.
    result = result.replace(
      /\ssrcset\s*=\s*(?:"[^"]*"|'[^']*')/gi,
      "",
    );
    result = result.replace(/\ssizes\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");

    return result;
  }

  /**
   * Collapse the inner HTML of a `<picture>` element to a single `<img>`
   * tag whose `src` is the largest variant found across every nested
   * `<source srcset>` and the fallback `<img>`.
   *
   * The fallback `<img>`'s other attributes are preserved verbatim — only
   * its `src` is rewritten and its `srcset` / `sizes` are stripped — so
   * `alt`, `class`, dimension hints, and any data-attributes the theme
   * relies on survive the rewrite. If there is no `<img>` fallback we
   * synthesize a minimal one rather than dropping the image entirely.
   */
  private flattenPicture(pictureInner: string): string {
    const srcsetValues: string[] = [];

    // <source srcset="…"> contributions (one or many per <picture>)
    const sourceRe =
      /<source\b[^>]*\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*\/?>/gi;
    for (let m: RegExpExecArray | null; (m = sourceRe.exec(pictureInner)); ) {
      srcsetValues.push(m[1] ?? m[2] ?? "");
    }

    // Fallback <img> — keep its outer shape so we preserve alt/class/etc.
    const imgMatch = pictureInner.match(/<img\b[^>]*>/i);
    let imgTag = imgMatch ? imgMatch[0] : '<img alt="" />';

    const imgSrcsetMatch = imgTag.match(
      /\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
    );
    if (imgSrcsetMatch) {
      srcsetValues.push(imgSrcsetMatch[1] ?? imgSrcsetMatch[2] ?? "");
    }

    // Pick the global maximum across every contribution. We concatenate
    // first so `parseLargestSrcsetURL` only walks the comma-separated
    // entry list once and stays the single source of truth for the
    // descriptor-comparison rules.
    const concatenated = srcsetValues.filter(Boolean).join(", ");
    const largest = concatenated
      ? this.parseLargestSrcsetURL(concatenated)
      : undefined;

    if (largest) {
      imgTag = this.applySrcAndStripResponsive(imgTag, largest);
    } else {
      // No usable srcset anywhere — still strip responsive attrs so the
      // returned tag is clean.
      imgTag = imgTag.replace(
        /\ssrcset\s*=\s*(?:"[^"]*"|'[^']*')/gi,
        "",
      );
      imgTag = imgTag.replace(/\ssizes\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
    }
    return imgTag;
  }

  /**
   * Apply the largest URL as the `src` of an `<img>` tag and strip
   * `srcset` / `sizes` from it. Used by both the standalone-`<img>` pass
   * and the `<picture>` unwrapper so they share identical semantics.
   */
  private applySrcAndStripResponsive(
    imgTag: string,
    largestSrc: string,
  ): string {
    let result = imgTag;
    const srcRegex = /(\ssrc\s*=\s*)(?:"[^"]*"|'[^']*')/i;
    if (srcRegex.test(result)) {
      result = result.replace(
        srcRegex,
        (_m, prefix: string) => `${prefix}"${largestSrc}"`,
      );
    } else {
      // No existing src — inject one so the tag stays usable after the
      // srcset strip below.
      result = result.replace(/<img\b/i, `<img src="${largestSrc}"`);
    }
    result = result.replace(
      /\ssrcset\s*=\s*(?:"[^"]*"|'[^']*')/gi,
      "",
    );
    result = result.replace(/\ssizes\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
    return result;
  }

  /**
   * Pick the URL with the largest descriptor from a `srcset` value.
   *
   * Per the HTML spec, each comma-separated entry is `URL [DESCRIPTOR]`
   * where DESCRIPTOR is either `<number>w` (width in pixels) or `<number>x`
   * (pixel-density ratio). We do not mix the two scales — both happen to be
   * "bigger number = bigger image" so a flat max across the numeric values
   * yields the largest variant regardless of which descriptor was used.
   * Entries with a missing or unparseable descriptor get size 0 so they
   * only win when everything else lacks a descriptor too.
   *
   * Returns `undefined` for an empty / malformed srcset so the caller can
   * leave the original `<img>` tag untouched.
   */
  private parseLargestSrcsetURL(srcset: string): string | undefined {
    const entries = srcset
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (entries.length === 0) return undefined;

    let bestURL: string | undefined;
    let bestSize = -Infinity;
    for (const entry of entries) {
      const parts = entry.split(/\s+/);
      const url = parts[0];
      if (!url) continue;
      let size = 0;
      if (parts.length > 1) {
        const m = parts[1].match(/^(\d+(?:\.\d+)?)(w|x)$/i);
        if (m) size = parseFloat(m[1]);
      }
      if (size > bestSize) {
        bestSize = size;
        bestURL = url;
      }
    }
    return bestURL;
  }
  private getAuthorsName(metadata: any): string {
    return metadata.authors.map((author: any) => author.name).join(", ");
  }

  async publishBook(options: PublishOptions): Promise<PublishResult> {
    const encodePbURL = this.pbBookURL.replace(/\/+$/, "");
    const auth = undefined;
    const result: PublishResult = {
      err: false,
      path: "",
      url: "",
      bookID: "",
      authorsName: undefined,
      resourceURL: undefined,
      sourcePublicationDate: undefined,
      license: undefined,
    };
    const log = (message: string) => {
      // Always log to server console
      // eslint-disable-next-line no-console
      console.log(message);
      // Optionally forward to external logger (e.g., job status)
      if (typeof options.log === "function") {
        try {
          const maybePromise = options.log(message);
          if (
            maybePromise &&
            typeof (maybePromise as any).then === "function"
          ) {
            (maybePromise as Promise<void>).catch((e) => {
              // eslint-disable-next-line no-console
              console.error(
                "[PressBookScraper] Error in external log callback:",
                e,
              );
            });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(
            "[PressBookScraper] Error invoking external log callback:",
            e,
          );
        }
      }
    };

    // ── 1. Metadata ──────────────────────────────────────────────────────────
    let metadata: any = {};
    try {
      metadata = await this.getJson(
        this.pbApi(encodePbURL) + "/metadata",
        auth,
      );
    } catch {
      try {
        metadata = await this.getJson(encodePbURL + "/wp-json/", auth);
      } catch {
        throw new Error(conductorErrors.err8);
      }
    }

    // ── 2. TOC — single source of truth for structure AND order ──────────────
    log("[*] Fetching TOC...");
    let toc: TocShape;
    try {
      toc = (await this.getJson(
        this.pbApi(encodePbURL) + "/toc",
        auth,
      )) as TocShape;
    } catch {
      throw new Error(conductorErrors.err8);
    }

    // ── 3. Book path / URL ────────────────────────────────────────────────────
    const title =
      this.title ||
      metadata.name ||
      metadata.title?.rendered ||
      new URL(encodePbURL).pathname.replace(/^\/|\/$/g, "") ||
      "pressbooks_book";

    const [bookPath, bookURL] = generateBookPathAndURL(this.subdomain, title);
    result.path = bookPath;
    result.url = bookURL;
    log(`[*] bookPath: ${bookPath}`);
    log(`[*] bookURL: ${bookURL}`);
    // ── 3.1 Authors Name ──────────────────────────────────────────────────────
    try {
      result.authorsName = this.getAuthorsName(metadata);
    } catch {
      result.authorsName = undefined;
    }
    // ── 3.2 Source Publication Date ────────────────────────────────────────────
    try {
      // "datePublished": "2024-01-18",
      result.sourcePublicationDate = new Date(metadata.datePublished);
      log(`[*] result.sourcePublicationDate: ${result.sourcePublicationDate}`);
    } catch {
      result.sourcePublicationDate = undefined;
    }
    // ── 3.3 License ────────────────────────────────────────────────────────────
    // In Pressbooks, license is a WordPress taxonomy exposed at
    // `/wp-json/wp/v2/license`. Each term has an `id` and a `slug` (e.g.
    // `cc-by`); posts reference licenses either by term-ID array (WP REST shape)
    // or by an inline JSON-LD object (Pressbooks v2 REST shape). We hydrate the
    // taxonomy cache up-front so any later reference — by ID, slug, or inline
    // object — resolves through the same canonical map.
    //
    // `/metadata` itself returns the book-level license as JSON-LD:
    //   { "@type": "CreativeWork", "code": "cc-by",
    //     "name": "Attribution 4.0 …", "url": "https://…/by/4.0/" }
    // Individual parts/chapters/front-matter/back-matter may override with
    // their own license; otherwise they inherit the book license.
    await this.fetchLicenseTaxonomy(encodePbURL, auth);
    const bookLicense = this.resolveLicense(metadata?.license);
    console.log("bookLicense", bookLicense);
    try {
      result.license = bookLicense
        ? { name: bookLicense.name, url: bookLicense.url }
        : undefined;
    } catch {
      result.license = undefined;
    }
    const bookLicenseTags = this.parseLicenseTags(bookLicense);
    log(
      `[*] bookLicenseTags: ${bookLicenseTags.length ? bookLicenseTags.join(", ") : "(none)"}`,
    );
    // ── 3.4 Resource URL ───────────────────────────────────────────────────────
    result.resourceURL = this.pbBookURL;
    // ── 3.5 Thumbnail ────────────────────────────────────────────────────────────
    try {
      result.thumbnail = metadata.image;
    } catch {
      result.thumbnail = `${defaultImagesURL}/default.png`;
    }
    // ── 3.6 Contributors ───────────────────────────────────────────────────────
    // Pressbooks exposes contributors as a WP taxonomy at
    // `/wp-json/wp/v2/contributor`. Hydrate the cache up front so any later
    // per-post contributor reference (by ID or slug) can be resolved without
    // an extra round-trip. Each contributor is also emitted as an
    // `author@<clean name>` tag (academic / honorific titles stripped) so the
    // book root carries attribution alongside the license/source tags below.
    const contributors = await this.fetchContributors(encodePbURL, auth);
    const contributorAuthorTags = this.buildContributorAuthorTags(contributors);
    log(
      `[*] Contributors: ${contributors.length}` +
        (contributors.length > 0
          ? ` (${contributors.map((c) => c.name).join(", ")})`
          : ""),
    );
    if (contributorAuthorTags.length > 0) {
      log(`[*] contributorAuthorTags: ${contributorAuthorTags.join(", ")}`);
    }

    await this.createAuthors(contributors);

    // ── 4. Create the CXOne book root ─────────────────────────────────────────
    const createBookRes = await CXOneFetch({
      scope: "page",
      path: bookPath,
      api: MindTouch.API.Page.POST_Contents_Title(title),
      subdomain: this.subdomain,
      options: { method: "POST", body: MindTouch.Templates.POST_CreateBook },
      query: { abort: "exists" },
    }).catch(() => {
      throw Object.assign(new Error(conductorErrors.err86), {
        name: "CreateBookError",
      });
    });

    if (!createBookRes.ok) {
      throw new Error(`Error creating Workbench book: "${title}"`);
    }

    await Promise.all([
      addPageProperty(this.subdomain, bookPath, "WelcomeHidden", true),
      addPageProperty(this.subdomain, bookPath, "SubPageListing", "simple"),
    ]);

    const imageRes = await fetch(
      result.thumbnail || `${defaultImagesURL}/default.png`,
    );
    await CXOneFetch({
      scope: "page",
      path: bookPath,
      api: MindTouch.API.Page.PUT_File_Default_Thumbnail,
      subdomain: this.subdomain,
      options: { method: "PUT", body: await imageRes.blob() },
    });

    // Tag the book root (cover page) with the book-level license + source so
    // the CXOne page-content footer can render attribution on the landing
    // page itself, not just on chapters. Child pages override this via their
    // own per-item license; the root keeps the book-wide license from
    // `/metadata` (resolved through the WP license taxonomy in section 3.3).
    const bookRootID = await getPageID(bookPath, this.subdomain);
    if (bookRootID) {
      await this.applyPageTags(bookRootID, [
        ...bookLicenseTags,
        ...contributorAuthorTags,
      ]);
    } else {
      log("[!] Could not resolve book root page ID for tagging (non-fatal).");
    }

    // ── 5. Front Matter container + items ─────────────────────────────────────
    log(`\n[*] Front Matter: ${toc["front-matter"].length} items`);
    const frontMatterContainerPath = `${bookPath}/00:_Front_Matter`;

    // isContainer: true — Front_Matter holds child pages
    await this.upsertCXOnePage(
      frontMatterContainerPath,
      "Front Matter",
      "",
      true,
    );

    const sortedFrontMatter = [...toc["front-matter"]].sort(
      (a, b) => a.menu_order - b.menu_order,
    );

    // Front-matter (and back-matter) child pages are numbered from `10`,
    // matching MindTouch's convention for sub-pages of the matter containers.
    // The corresponding Pressbooks items live on `menu_order` 10, 11, 12, …
    // (Pressbooks reserves single digits for re-ordering inserts), so we use
    // the post-sort array index — not `menu_order` — to produce a dense
    // 00-based MindTouch sequence regardless of gaps on the Pressbooks side.
    for (let i = 0; i < sortedFrontMatter.length; i++) {
      const node = sortedFrontMatter[i];
      const seq = String(i + 10).padStart(2, "0");
      const pagePath = `${frontMatterContainerPath}/${seq}:_${this.slugifyNode(node)}`;
      log(`  [FM ${seq}] ${node.title}`);

      // Content and per-page contributor metadata live at sibling REST
      // endpoints; fetch them in parallel so the per-page network cost
      // doesn't double.
      const [contentRes, fmContribTags] = await Promise.all([
        node.has_post_content
          ? this.fetchNodeContent(encodePbURL, "front-matter", node.id, auth)
          : Promise.resolve({ html: "", license: undefined }),
        this.fetchNodeContributorTags(
          encodePbURL,
          "front-matter",
          node.id,
          auth,
        ),
      ]);
      const { html: content = "", license: fmLicense } = contentRes;

      // isContainer: false — Front Matter items are leaf content pages
      await this.upsertCXOnePage(pagePath, node.title, content, false, [
        ...this.resolveLicenseTags(fmLicense, bookLicenseTags),
        ...fmContribTags,
      ]);
    }

    // Also import any front-matter posts that exist in Pressbooks but are not
    // listed in the TOC (e.g. web-only pages, items excluded from exports).
    const allFrontMatter = await this.fetchAllPostsOfType(
      encodePbURL,
      "front-matter",
      auth,
    );
    const tocFrontMatterIds = new Set(sortedFrontMatter.map((n) => n.id));
    const extraFrontMatter = allFrontMatter
      .filter((n) => !tocFrontMatterIds.has(n.id))
      .sort((a, b) => a.menu_order - b.menu_order);

    if (extraFrontMatter.length > 0) {
      log(
        `  [FM extra] ${extraFrontMatter.length} non-TOC front-matter post(s)`,
      );
    }
    for (let i = 0; i < extraFrontMatter.length; i++) {
      const node = extraFrontMatter[i];
      // Continue the 00-based sequence after the TOC items so non-TOC posts
      // get a gap-free MindTouch ordering.
      const seq = String(i + 10 + sortedFrontMatter.length).padStart(2, "0");
      const pagePath = `${frontMatterContainerPath}/${seq}:_${this.slugifyNode(node)}`;
      log(`  [FM ${seq}] ${node.title} (non-TOC)`);
      const [contentRes, fmExtraContribTags] = await Promise.all([
        node.has_post_content
          ? this.fetchNodeContent(encodePbURL, "front-matter", node.id, auth)
          : Promise.resolve({ html: "", license: undefined }),
        this.fetchNodeContributorTags(
          encodePbURL,
          "front-matter",
          node.id,
          auth,
        ),
      ]);
      const { html: content = "", license: fmExtraLicense } = contentRes;
      await this.upsertCXOnePage(pagePath, node.title, content, false, [
        ...this.resolveLicenseTags(fmExtraLicense, bookLicenseTags),
        ...fmExtraContribTags,
      ]);
    }

    await Promise.all([
      addPageProperty(
        this.subdomain,
        frontMatterContainerPath,
        "SubPageListing",
        "simple",
      ),
      addPageProperty(
        this.subdomain,
        frontMatterContainerPath,
        "WelcomeHidden",
        true,
      ),
    ]);

    // ── 6. Parts → Chapters ───────────────────────────────────────────────────
    log(`\n[*] Parts: ${toc.parts.length}`);
    const sortedParts = [...toc.parts].sort(
      (a, b) => a.menu_order - b.menu_order,
    );

    for (let pi = 0; pi < sortedParts.length; pi++) {
      const part = sortedParts[pi];
      const partSeq = String(pi + 1).padStart(2, "0");
      // Strip any author-baked numbering from the Pressbooks title so the
      // importer's own sequence ("1:", "1.1:") is the only number that appears
      // in the URL and the rendered title (no "1: 1. Introduction").
      const partTitle = this.stripLeadingNumbering(part.title);
      // Path follows the LibreTexts URL convention:
      //   ${bookPath}/${seq}:_${Title_With_Underscores}
      // - `seq` is the part's 2-digit zero-padded ordinal, so the segments
      //   sort lexicographically the same way they would numerically
      //   (01, 02, …, 09, 10, …).
      // - `:_` is the MindTouch separator already used by the front- and
      //   back-matter containers.
      // - The title segment preserves capitalization and substitutes
      //   underscores for whitespace; punctuation that isn't URL-safe is
      //   stripped by `titleToPathSegment`. Example for "Gases" → `09:_Gases`,
      //   matching `https://chem.libretexts.org/.../09%3A_Gases`.
      const partPath = `${bookPath}/${partSeq}:_${this.titleToPathSegment(partTitle)}`;
      log(
        `\n  [Part ${partSeq}] ${partTitle} (${part.chapters.length} chapters)`,
      );

      const [partContentRes, partContribTags] = await Promise.all([
        part.has_post_content
          ? this.fetchNodeContent(encodePbURL, "parts", part.id, auth)
          : Promise.resolve({ html: "", license: undefined }),
        this.fetchNodeContributorTags(encodePbURL, "parts", part.id, auth),
      ]);
      const { html: partContent = "", license: partLicense } = partContentRes;

      // isContainer: true — Parts hold chapters under them
      await this.upsertCXOnePage(
        partPath,
        `${String(pi + 1)}: ${partTitle}`,
        partContent,
        true,
        [
          ...this.resolveLicenseTags(partLicense, bookLicenseTags),
          ...partContribTags,
        ],
      );

      const sortedChapters = [...part.chapters].sort(
        (a, b) => a.menu_order - b.menu_order,
      );

      for (let ci = 0; ci < sortedChapters.length; ci++) {
        const chapter = sortedChapters[ci];
        const chapterSeq = String(ci + 1).padStart(2, "0");
        const chapterTitle = this.stripLeadingNumbering(chapter.title);
        // LibreTexts chapter URL shape:
        //   ${partPath}/${partNum}.${chapterSeq}:_${Title_With_Underscores}
        // - `partNum` is the part's ordinal *unpadded* (1, 2, …, 9, 10)
        //   so the human-readable "9.02" prefix matches the printed
        //   "9.2" section number rather than producing "09.02".
        // - `chapterSeq` is 2-digit zero-padded so chapters within a part
        //   still sort lexicographically (9.01, …, 9.10, 9.11).
        // Example: chapter 2 of part 9 titled "Relating Pressure…" →
        //   `9.02:_Relating_Pressure_Volume_Amount_and_Temperature_-_The_Ideal_Gas_Law`.
        const chapterPath = `${partPath}/${pi + 1}.${chapterSeq}:_${this.titleToPathSegment(chapterTitle)}`;
        log(`    [Ch ${String(pi + 1)}.${String(ci + 1)}: ${chapterTitle}`);

        const [chapterContentRes, chapterContribTags] = await Promise.all([
          chapter.has_post_content
            ? this.fetchNodeContent(encodePbURL, "chapters", chapter.id, auth)
            : Promise.resolve({ html: "", license: undefined }),
          this.fetchNodeContributorTags(
            encodePbURL,
            "chapters",
            chapter.id,
            auth,
          ),
        ]);
        const { html: content = "", license: chapterLicense } =
          chapterContentRes;

        // isContainer: false — Chapters are leaf content pages
        await this.upsertCXOnePage(
          chapterPath,
          `${String(pi + 1)}.${String(ci + 1)}: ${chapterTitle}`,
          content,
          false,
          [
            ...this.resolveLicenseTags(chapterLicense, bookLicenseTags),
            ...chapterContribTags,
          ],
        );
      }

      await Promise.all([
        addPageProperty(this.subdomain, partPath, "SubPageListing", "simple"),
        addPageProperty(this.subdomain, partPath, "WelcomeHidden", true),
        // addPageProperty(this.subdomain, partPath, "ArticleType", "Guide"),
        // addPageProperty(this.subdomain, partPath, "GuideTabs", MindTouch.Templates.PROP_GuideTabs),
        // addPageProperty(this.subdomain, partPath, "GuideDisplay", "single"),
      ]);
    }

    // ── 7. Back Matter container + items ──────────────────────────────────────
    log(`\n[*] Back Matter: ${toc["back-matter"].length} items`);
    const backMatterSeq = "zz";
    const backMatterContainerPath = `${bookPath}/${backMatterSeq}:_Back_Matter`;
    // isContainer: true — Back_Matter holds child pages
    await this.upsertCXOnePage(
      backMatterContainerPath,
      "Back Matter",
      "",
      true,
    );

    const sortedBackMatter = [...toc["back-matter"]].sort(
      (a, b) => a.menu_order - b.menu_order,
    );

    // Back-matter children follow the same 00-based MindTouch convention as
    // front-matter children. See the front-matter loop above for why we use
    // the array index instead of Pressbooks' 10-based `menu_order`.
    for (let i = 0; i < sortedBackMatter.length; i++) {
      const node = sortedBackMatter[i];
      const seq = String(i + 10).padStart(2, "0");
      const pagePath = `${backMatterContainerPath}/${seq}:_${this.slugifyNode(node)}`;
      log(
        `  [BM ${seq}] ${node.title}, ${node.has_post_content}, id: ${node.id}`,
      );
      const [bmContentRes, bmContribTags] = await Promise.all([
        this.fetchNodeContent(encodePbURL, "back-matter", node.id, auth),
        this.fetchNodeContributorTags(
          encodePbURL,
          "back-matter",
          node.id,
          auth,
        ),
      ]);
      const { html: content = "", license: bmLicense } = bmContentRes;

      // isContainer: false — Back Matter items are leaf content pages
      await this.upsertCXOnePage(pagePath, node.title, content, false, [
        ...this.resolveLicenseTags(bmLicense, bookLicenseTags),
        ...bmContribTags,
      ]);
    }

    // Also import any back-matter posts that exist in Pressbooks but are not
    // listed in the TOC (e.g. web-only pages, items excluded from exports).
    const allBackMatter = await this.fetchAllPostsOfType(
      encodePbURL,
      "back-matter",
      auth,
    );
    const tocBackMatterIds = new Set(sortedBackMatter.map((n) => n.id));
    const extraBackMatter = allBackMatter
      .filter((n) => !tocBackMatterIds.has(n.id))
      .sort((a, b) => a.menu_order - b.menu_order);

    if (extraBackMatter.length > 0) {
      log(`  [BM extra] ${extraBackMatter.length} non-TOC back-matter post(s)`);
    }
    for (let i = 0; i < extraBackMatter.length; i++) {
      const node = extraBackMatter[i];
      // Continue the 00-based sequence after the TOC items.
      const seq = String(i).padStart(2, "0");
      const pagePath = `${backMatterContainerPath}/${seq}:_${this.slugifyNode(node)}`;
      log(`  [BM ${seq}] ${node.title} (non-TOC)`);
      const [bmExtraContentRes, bmExtraContribTags] = await Promise.all([
        node.has_post_content
          ? this.fetchNodeContent(encodePbURL, "back-matter", node.id, auth)
          : Promise.resolve({ html: "", license: undefined }),
        this.fetchNodeContributorTags(
          encodePbURL,
          "back-matter",
          node.id,
          auth,
        ),
      ]);
      const { html: content = "", license: bmExtraLicense } = bmExtraContentRes;
      await this.upsertCXOnePage(pagePath, node.title, content, false, [
        ...this.resolveLicenseTags(bmExtraLicense, bookLicenseTags),
        ...bmExtraContribTags,
      ]);
    }

    await Promise.all([
      addPageProperty(
        this.subdomain,
        backMatterContainerPath,
        "SubPageListing",
        "simple",
      ),
      addPageProperty(
        this.subdomain,
        backMatterContainerPath,
        "WelcomeHidden",
        true,
      ),
    ]);

    // ── 8. Create default Front / Back Matter + trigger MindMap TOC update ───
    // The `batch.libretexts.org/print` endpoint is dual-purpose: with
    // `?createMatterOnly=true` it generates the standard LibreTexts matter
    // pages (TitlePage, InfoPage, TableOfContents, Index, …) into the
    // matter containers we built in sections 5 and 7, and it also runs the
    // TOC re-index as a side-effect. Without that query flag the endpoint
    // *only* re-indexes the TOC and the default matter pages never appear,
    // which is the behavior we hit before (see `api/books.ts` for the
    // canonical use of this endpoint at book-creation time).
    //
    // Fire-and-forget: the batch service responds asynchronously, so we
    // don't await the fetch itself. The trailing `sleep(1500)` is *not*
    // for HTTP correctness — it's a deliberate gap that lets the Node
    // event loop flush the request socket before the function returns
    // and the import job potentially exits. Matches the pattern in
    // `api/books.ts` exactly.
    log("[*] Triggering default matter creation + MindMap TOC update...");
    fetch(
      `https://batch.libretexts.org/print/Libretext=${bookURL}?createMatterOnly=true`,
      {
        headers: { origin: "commons.libretexts.org" },
      },
    ).catch((e) => {
      console.warn(
        "[PressBookScraper] Matter / MindMap trigger failed (non-fatal):",
        (e as Error).message,
      );
    });
    await sleep(1500);

    // ── 9. Verify book ID ─────────────────────────────────────────────────────
    const newBookID = await getPageID(bookPath, this.subdomain);
    if (!newBookID) {
      throw new Error(
        `Error locating Workbench book ID after import: "${title}"`,
      );
    }

    // const res = await CXOneFetch({
    //   scope: "users",
    //   subdomain: this.subdomain,
    //   query: {
    //     verbose: "false",
    //     seatfilter: "seated",
    //     limit: "all",
    //   },
    // });
    // const raw = await res.json();
    // console.log(raw);
    result.bookID = newBookID;
    return result;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Fetch the rendered HTML content and license for a single node by hitting
   * its individual REST endpoint.
   */
  private async fetchNodeContent(
    bookUrl: string,
    postType: string,
    id: number,
    auth?: { username: string; password: string },
  ): Promise<{ html: string; license?: PressbooksLicense }> {
    try {
      console.log(`[*] id: ${id}`);
      const url = `${this.pbApi(bookUrl)}/${postType}/${id}?_embed=1`;
      const item = await this.getJson(url, auth);
      const html: string = this.pickLargestSrcsetImage(
        this.convertLatexShortcodes(item.content?.rendered ?? ""),
      );

      // `item.license` may be:
      //  - the JSON-LD object  (Pressbooks v2 REST)         → use directly
      //  - an array of term IDs (WP REST core shape)        → look up in cache
      //  - a single term ID                                  → look up in cache
      //  - a slug string                                     → look up in cache
      // Anything we can't resolve falls back to the book-level license at the
      // call site in `resolveLicenseTags`.
      const license = this.resolveLicense(item.license);
      return { html, license };
    } catch (err) {
      console.warn(
        `[PressBookScraper] Failed to fetch content for ${postType}/${id}:`,
        (err as Error).message,
      );
      return { html: "" };
    }
  }

  /**
   * Pre-fetch every license term defined for this book from the WordPress
   * taxonomy endpoint `/wp-json/wp/v2/license`. The result is cached on the
   * scraper instance and indexed both by term ID (number) and by slug (string)
   * so later license references — in any of the shapes Pressbooks emits — can
   * be resolved through a single map.
   *
   * Term shape returned by WP:
   *   { id: 25, slug: "cc-by",
   *     name: "Attribution 4.0 International (CC BY 4.0)",
   *     link: "…", meta: { pb_license_code?: "cc-by", pb_license_url?: "…" } }
   *
   * Failure is non-fatal: callers fall back to the inline JSON-LD license on
   * individual posts and to the book-level license from `/metadata`.
   */
  private async fetchLicenseTaxonomy(
    bookUrl: string,
    auth?: { username: string; password: string },
  ): Promise<void> {
    const url = `${bookUrl.replace(/\/+$/, "")}/wp-json/wp/v2/license?per_page=100`;
    let terms: any[];
    try {
      terms = await this.getJson(url, auth);
    } catch (err) {
      console.warn(
        `[PressBookScraper] Failed to fetch license taxonomy: ${(err as Error).message}`,
      );
      return;
    }
    if (!Array.isArray(terms)) return;

    for (const term of terms) {
      const slug: string | undefined =
        typeof term?.slug === "string" && term.slug.trim() !== ""
          ? term.slug
          : typeof term?.meta?.pb_license_code === "string"
            ? term.meta.pb_license_code
            : undefined;
      const license: PressbooksLicense = {
        code: slug,
        name: typeof term?.name === "string" ? term.name : undefined,
        url:
          typeof term?.meta?.pb_license_url === "string" &&
          term.meta.pb_license_url.trim() !== ""
            ? term.meta.pb_license_url
            : typeof term?.link === "string"
              ? term.link
              : undefined,
      };
      if (typeof term?.id === "number")
        this.licenseTermsById.set(term.id, license);
      if (slug) this.licenseTermsBySlug.set(slug.toLowerCase(), license);
    }
  }

  /**
   * Fetch every contributor term defined for this book from the WP taxonomy
   * endpoint `/wp-json/wp/v2/contributor`. Pages through the endpoint with
   * `per_page=100` and stops on the first short page (or error response,
   * which WP returns when paging past the last page).
   *
   * Result is cached on the scraper instance (indexed by ID and slug) and
   * returned for convenience. Failure is non-fatal: callers should fall
   * back to book-level `metadata.authors` when no contributors resolve.
   *
   * Each WP term has the shape:
   *   { id: 7, slug: "jane-doe", name: "Jane Doe",
   *     description: "Bio paragraph",
   *     meta: {
   *       contributor_first_name: "Jane",
   *       contributor_last_name:  "Doe",
   *       contributor_institution: "Acme U.",
   *       contributor_description: "Bio paragraph",
   *       contributor_user_url:    "https://…",
   *       contributor_picture:     "https://…/avatar.jpg",
   *       …
   *     } }
   */
  private async fetchContributors(
    bookUrl: string,
    auth?: { username: string; password: string },
    perPage = 100,
  ): Promise<PressbooksContributor[]> {
    const base = `${bookUrl.replace(/\/+$/, "")}/wp-json/wp/v2/contributor`;
    const collected: PressbooksContributor[] = [];
    let page = 1;
    while (true) {
      const url = `${base}?per_page=${perPage}&page=${page}`;
      let terms: any[];
      try {
        terms = await this.getJson(url, auth);
      } catch (err) {
        if (page === 1) {
          console.warn(
            `[PressBookScraper] Failed to fetch contributors: ${(err as Error).message}`,
          );
        }
        break;
      }
      if (!Array.isArray(terms) || terms.length === 0) break;
      for (const term of terms) {
        if (typeof term?.id !== "number") continue;
        const meta = (term.meta ?? {}) as Record<string, unknown>;
        const pick = (k: string): string | undefined => {
          const v = meta[k];
          return typeof v === "string" && v.trim() !== "" ? v : undefined;
        };
        const firstName = pick("contributor_first_name");
        const lastName = pick("contributor_last_name");
        const composedName = [firstName, lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        const name =
          (typeof term.name === "string" && term.name.trim() !== ""
            ? term.name
            : composedName) || (typeof term.slug === "string" ? term.slug : "");
        const contributor: PressbooksContributor = {
          id: term.id,
          slug: typeof term.slug === "string" ? term.slug : "",
          name,
          firstName,
          lastName,
          institution: pick("contributor_institution"),
          description:
            pick("contributor_description") ??
            (typeof term.description === "string" &&
            term.description.trim() !== ""
              ? term.description
              : undefined),
          url: pick("contributor_user_url"),
          picture: pick("contributor_picture"),
        };
        collected.push(contributor);
        this.contributorsById.set(contributor.id, contributor);
        if (contributor.slug) {
          this.contributorsBySlug.set(
            contributor.slug.toLowerCase(),
            contributor,
          );
        }
      }
      if (terms.length < perPage) break;
      page++;
    }
    return collected;
  }

  /**
   * Normalize any shape Pressbooks uses to express a license into a single
   * `PressbooksLicense` object, consulting the cached taxonomy when needed.
   *
   * Accepts:
   *   - `undefined` / `null`           → undefined
   *   - `number`                        → taxonomy lookup by term ID
   *   - `string`                        → taxonomy lookup by slug
   *   - `number[]`                      → first non-empty term ID (Pressbooks
   *                                       allows only one license per post)
   *   - `PressbooksLicense` object      → merged with the taxonomy entry whose
   *                                       slug matches `code`/`name`, so e.g.
   *                                       a sparse inline `{ code: "cc-by" }`
   *                                       gets enriched with the full URL.
   */
  private resolveLicense(input: unknown): PressbooksLicense | undefined {
    if (input == null) return undefined;

    if (typeof input === "number") {
      return this.licenseTermsById.get(input);
    }
    if (typeof input === "string") {
      return this.licenseTermsBySlug.get(input.trim().toLowerCase());
    }
    if (Array.isArray(input)) {
      for (const entry of input) {
        const resolved = this.resolveLicense(entry);
        if (resolved) return resolved;
      }
      return undefined;
    }
    if (typeof input === "object") {
      const obj = input as PressbooksLicense;
      const taxonomyMatch = [obj.code, obj.name]
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .map((v) => this.licenseTermsBySlug.get(v.trim().toLowerCase()))
        .find((v): v is PressbooksLicense => v != null);
      if (taxonomyMatch) {
        return {
          code: obj.code ?? taxonomyMatch.code,
          name: obj.name ?? taxonomyMatch.name,
          url: obj.url ?? taxonomyMatch.url,
        };
      }
      return obj;
    }
    return undefined;
  }

  /**
   * Pressbooks license slug → LibreTexts license code expected by the CXOne
   * page-content footer (see `util/cxone-page-content-footer.html`).
   * The footer switches on values like `ccby`, `ccbyncsa`, `gnufdl`, `publicdomain`, …
   * (no dashes, no version suffix). Any input that doesn't match here is dropped
   * rather than emitted as an unmatchable tag.
   */
  private static readonly LICENSE_CODE_MAP: Record<string, string> = {
    "cc-by": "ccby",
    "cc-by-sa": "ccbysa",
    "cc-by-nc": "ccbync",
    "cc-by-nc-sa": "ccbyncsa",
    "cc-by-nd": "ccbynd",
    "cc-by-nc-nd": "ccbyncnd",
    "cc-zero": "publicdomain",
    cc0: "publicdomain",
    "public-domain": "publicdomain",
    publicdomain: "publicdomain",
    gpl: "gnu",
    "gpl-3.0": "gnu",
    "gnu-gpl": "gnu",
    gnu: "gnu",
    "gnu-fdl": "gnufdl",
    gnufdl: "gnufdl",
    fdl: "gnufdl",
    "all-rights-reserved": "arr",
    arr: "arr",
    ck12: "ck12",
    ccby: "ccby",
    ccbysa: "ccbysa",
    ccbync: "ccbync",
    ccbyncsa: "ccbyncsa",
    ccbynd: "ccbynd",
    ccbyncnd: "ccbyncnd",
  };

  /**
   * Convert a Pressbooks license object into MindTouch tag strings consumable
   * by the CXOne page-content footer.
   *
   *   { code: "cc-by", url: "https://creativecommons.org/licenses/by/4.0/" }
   *     → ["license:ccby", "licenseversion:40"]
   *
   * The footer's switch statements expect `license:<code>` with no dashes and
   * `licenseversion:<digits>` with no decimal point (it converts `40` → "4.0").
   *
   * Resolution order:
   *   1. `license.code`  (preferred — Pressbooks' machine-readable slug)
   *   2. `license.name`  (slugified)
   *   3. `license.url`   (CC URL path fragment)
   *
   * Version is parsed from `license.url` first (most reliable), then from
   * `license.name`. GNU licenses get an implicit version per the footer's
   * special cases (GPL→3.0, FDL→1.3).
   */
  private parseLicenseTags(license?: PressbooksLicense | null): string[] {
    if (!license) return [];

    const normalize = (s: string): string =>
      s.trim().toLowerCase().replace(/\s+/g, "-");

    let code: string | undefined;

    // 1) explicit code or name
    for (const candidate of [license.code, license.name].filter(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    )) {
      const slug = normalize(candidate);
      if (PressBookScraper.LICENSE_CODE_MAP[slug]) {
        code = PressBookScraper.LICENSE_CODE_MAP[slug];
        break;
      }
      const stripped = slug.replace(/[^a-z0-9]/g, "");
      if (PressBookScraper.LICENSE_CODE_MAP[stripped]) {
        code = PressBookScraper.LICENSE_CODE_MAP[stripped];
        break;
      }
    }

    // 2) URL fallback (matches the path portion the footer itself uses)
    if (!code && license.url) {
      const u = license.url.toLowerCase();
      if (u.includes("/by-nc-sa/")) code = "ccbyncsa";
      else if (u.includes("/by-nc-nd/")) code = "ccbyncnd";
      else if (u.includes("/by-nc/")) code = "ccbync";
      else if (u.includes("/by-sa/")) code = "ccbysa";
      else if (u.includes("/by-nd/")) code = "ccbynd";
      else if (u.includes("/by/")) code = "ccby";
      else if (u.includes("/publicdomain/") || u.includes("/zero/"))
        code = "publicdomain";
      else if (u.includes("gnu.org/licenses/fdl")) code = "gnufdl";
      else if (u.includes("gnu.org/licenses/gpl")) code = "gnu";
      else if (u.includes("ck12")) code = "ck12";
    }

    // 3) version digits (e.g. "4.0" → "40"); the footer's switch expects no dot
    let versionDigits: string | undefined;
    if (license.url) {
      const m = license.url.match(/\/(\d+)\.(\d+)\/?(?:[?#].*)?$/);
      if (m) versionDigits = `${m[1]}${m[2]}`;
    }
    if (!versionDigits && license.name) {
      const m = license.name.match(/(\d+)\.(\d+)/);
      if (m) versionDigits = `${m[1]}${m[2]}`;
    }
    // Footer-defined defaults for GNU variants (see footer lines 277-284).
    if (!versionDigits && code === "gnu") versionDigits = "30";
    if (!versionDigits && code === "gnufdl") versionDigits = "13";

    const tags: string[] = [];
    if (code) tags.push(`license:${code}`);
    // Public domain / ARR / CK-12 have no version per the footer.
    if (
      versionDigits &&
      code !== "publicdomain" &&
      code !== "arr" &&
      code !== "ck12"
    ) {
      tags.push(`licenseversion:${versionDigits}`);
    }
    return tags;
  }

  /**
   * Per-item license resolver: prefer the item's own license tags, but fall
   * back to the book-level tags when the item doesn't declare a license (or
   * declares one we can't map). This mirrors Pressbooks' own inheritance:
   * chapters/parts/pages without an explicit license inherit the book license.
   */
  private resolveLicenseTags(
    itemLicense: PressbooksLicense | undefined,
    bookLicenseTags: string[],
  ): string[] {
    const itemTags = this.parseLicenseTags(itemLicense);
    return itemTags.length > 0 ? itemTags : bookLicenseTags;
  }

  /**
   * Honorific prefixes ("Dr. Jane Doe", "Prof Smith") — stripped from the
   * front of a contributor's display name before it is emitted as an
   * `author@<name>` tag. Matched case-insensitively against the leading
   * word, with or without a trailing dot.
   */
  private static readonly HONORIFIC_PREFIXES: ReadonlySet<string> = new Set([
    "dr",
    "drs",
    "mr",
    "mrs",
    "ms",
    "miss",
    "mx",
    "prof",
    "professor",
    "sir",
    "madam",
    "ma'am",
    "dame",
    "lord",
    "lady",
    "rev",
    "reverend",
    "fr",
    "father",
    "br",
    "brother",
    "sr",
    "sister",
    "hon",
    "honorable",
    "msgr",
    "monsignor",
    "rabbi",
    "imam",
    "pastor",
  ]);

  /**
   * Academic / professional credential suffixes ("Jane Doe, PhD", "John Smith MD",
   * "Alice, Ph.D., FACP") — stripped from the end of a contributor's display name.
   * Comparison is done after lowercasing and removing internal dots so "Ph.D.",
   * "ph.d", and "PhD" all collapse to "phd".
   *
   * Generational suffixes (Jr, Sr, II, III, IV) are intentionally *not* in this
   * set: they are part of the legal name, not a credential.
   */
  private static readonly CREDENTIAL_SUFFIXES: ReadonlySet<string> = new Set([
    // Medical
    "md",
    "do",
    "dds",
    "dmd",
    "dvm",
    "od",
    "pharmd",
    "rn",
    "lpn",
    "np",
    "pa",
    "dpt",
    "pt",
    "ot",
    "rrt",
    "atc",
    "cnm",
    "lcsw",
    "lmft",
    "mft",
    "msw",
    "psyd",
    "audd",
    "aud",
    // Doctorates / academic
    "phd",
    "edd",
    "scd",
    "thd",
    "dphil",
    "dba",
    "dsc",
    // Master's / bachelor's
    "mba",
    "mph",
    "ms",
    "msc",
    "ma",
    "med",
    "mfa",
    "mst",
    "meng",
    "ba",
    "bs",
    "bsc",
    "bsn",
    "beng",
    "bfa",
    // Law
    "jd",
    "llb",
    "llm",
    "lld",
    "esq",
    // Accounting / finance / engineering
    "cpa",
    "cfa",
    "cma",
    "cfp",
    "pe",
    "eit",
    // Fellowships / society designations (commonly appear after names)
    "facp",
    "facs",
    "faan",
    "fache",
    "frcp",
    "frcs",
    "frsa",
    "fda",
    // Misc
    "rd",
    "ld",
    "chse",
    "cic",
    "cphq",
  ]);

  /**
   * Build the list of `author@<name>` tags emitted for the book root.
   *
   * - Names are cleaned via `stripAcademicTitles` so honorifics ("Dr.",
   *   "Prof.") and credentials ("MD", "Ph.D.", "Esq.") are removed before
   *   the @-value is built.
   * - XML-reserved characters in the cleaned name are escaped so the tag
   *   survives MindTouch's `<tag value="..."/>` serialization (see
   *   `MindTouch.Templates.PUT_PageTags`).
   * - The list is deduped on the cleaned value so two contributor records
   *   that resolve to the same legal name (e.g. one with "PhD" and one
   *   without) only emit a single tag.
   */
  private buildContributorAuthorTags(
    contributors: PressbooksContributor[],
  ): string[] {
    const names = contributors.map((c) => this.resolveContributorCleanName(c));
    // `buildAuthorTagsFromNames` re-runs `stripAcademicTitles` on its input.
    // That's a no-op for an already-cleaned name, so passing cleaned names
    // through doesn't change the result — but it does keep the DB-persisted
    // value and the tag value derived from the *same* source string, so
    // they cannot drift apart.
    return this.buildAuthorTagsFromNames(names);
  }

  /**
   * Canonical "display name" for a Pressbooks contributor, used by both
   * the `author@…` tag pipeline and the persisted `Author.name` field.
   *
   * Resolution order — mirrors what the tag pipeline already did, so the
   * two pipelines stay in lockstep:
   *
   *   1. Composed `firstName + lastName` if either side is present — this
   *      is the most reliable carrier of the legal name because Pressbooks
   *      stores those fields as discrete inputs in the contributor admin,
   *      whereas `term.name` is a free-form display string that often
   *      bakes in honorifics ("Dr. Jane Doe") or credentials ("Jane Doe,
   *      MD").
   *   2. `term.name` otherwise.
   *   3. Empty string if neither is usable (the caller drops the row).
   *
   * The result is then run through `stripAcademicTitles` so honorifics
   * ("Dr.", "Prof."), comma-trailed credential blocks ("…, MD, FACP"),
   * and trailing credential tokens ("…  Ph.D.") are removed. The output
   * is the exact same string that ends up after the `author@` prefix in
   * the page tag (modulo the XML-escape step the tag pipeline applies on
   * top, which is purely a serialization concern and isn't appropriate
   * for a stored DB value).
   */
  private resolveContributorCleanName(c: PressbooksContributor): string {
    const composed = [c.firstName, c.lastName]
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .join(" ")
      .trim();
    const source = composed || c.name || "";
    return this.stripAcademicTitles(source);
  }

  /**
   * Convert a list of raw person names into a deduped list of MindTouch
   * `author@<clean name>` tags. Each name is cleaned by `stripAcademicTitles`
   * and XML-escaped for safe `<tag value="..."/>` serialization. Names that
   * collapse to the same lowercase value after cleaning produce one tag.
   *
   * Used by both the book-root contributor pipeline (taxonomy-driven, full
   * `PressbooksContributor` records) and the per-chapter pipeline
   * (schema.org Person objects pulled from `/metadata`).
   */
  private buildAuthorTagsFromNames(names: Array<string | undefined>): string[] {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const raw of names) {
      if (typeof raw !== "string" || raw.trim() === "") continue;
      const cleaned = this.stripAcademicTitles(raw);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(`author@${this.escapeXmlAttr(cleaned)}`);
    }
    return tags;
  }

  /**
   * Fetch a chapter / front-matter / back-matter / part's schema.org-style
   * Pressbooks metadata document at
   *   `/wp-json/pressbooks/v2/{postType}/{id}/metadata`
   * and return ready-to-apply `author@<clean name>` tags drawn from every
   * person-bearing role on the page (author, editor, contributor, translator,
   * illustrator, reviewedBy).
   *
   * Pressbooks emits per-page roles as arrays of schema.org `Person` objects:
   *   { "@type": "Person",
   *     "name": "Jane Doe",
   *     "givenName": "Jane",
   *     "familyName": "Doe" }
   * Where both `givenName` and `familyName` are present we prefer the
   * composed form because it is the most reliable carrier of the legal name;
   * otherwise we fall back to `name`. A bare string (some publishers store
   * roles as plain strings) is also accepted.
   *
   * Failure — including 401/404 on the sub-endpoint, which Pressbooks returns
   * when the post type doesn't expose a per-item metadata document — is
   * non-fatal and yields an empty tag list; the caller already has the
   * book-level contributor tags as a fallback at the book-root level, and a
   * page without its own attribution simply inherits visually from the book.
   */
  private async fetchNodeContributorTags(
    bookUrl: string,
    postType: string,
    id: number,
    auth?: { username: string; password: string },
  ): Promise<string[]> {
    const url = `${this.pbApi(bookUrl)}/${postType}/${id}/metadata`;
    let metadata: any;
    try {
      metadata = await this.getJson(url, auth);
    } catch {
      return [];
    }
    return this.extractAuthorTagsFromNodeMetadata(metadata);
  }

  /**
   * Pull display names out of every schema.org person role we know Pressbooks
   * uses on a per-post basis and convert them to `author@<clean name>` tags.
   *
   * The shape returned by `/wp-json/pressbooks/v2/{type}/{id}/metadata` is the
   * schema.org JSON-LD subset Pressbooks emits, e.g.:
   *   { "@type": "Chapter",
   *     "author":      [ Person, … ],
   *     "editor":      [ Person, … ],
   *     "contributor": [ Person, … ],
   *     "translator":  [ Person, … ],
   *     "illustrator": [ Person, … ],
   *     "reviewedBy":  [ Person, … ] }
   * Any role may also be a single Person rather than an array; we normalize
   * both shapes to a flat name list before tagging.
   */
  private extractAuthorTagsFromNodeMetadata(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== "object") return [];
    const PERSON_ROLES = [
      "author",
      "editor",
      "contributor",
      "translator",
      "illustrator",
      "reviewedBy",
    ] as const;
    const names: string[] = [];
    for (const role of PERSON_ROLES) {
      const value = (metadata as Record<string, unknown>)[role];
      if (value == null) continue;
      const entries = Array.isArray(value) ? value : [value];
      for (const entry of entries) {
        const name = this.extractPersonName(entry);
        if (name) names.push(name);
      }
    }
    return this.buildAuthorTagsFromNames(names);
  }

  /**
   * Extract a display name from one schema.org Person-like value.
   *
   *   { "@type": "Person", "name": "Jane Doe",
   *     "givenName": "Jane", "familyName": "Doe" }    → "Jane Doe"
   *   { "name": "John Smith" }                          → "John Smith"
   *   "Alice Brown"                                     → "Alice Brown"
   *
   * Prefers `givenName + familyName` because that pair is the most reliable
   * carrier of the legal name; `name` can be a free-form display string that
   * already includes credentials (which `stripAcademicTitles` then trims).
   */
  private extractPersonName(person: unknown): string | undefined {
    if (typeof person === "string") {
      const trimmed = person.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    if (!person || typeof person !== "object") return undefined;
    const obj = person as Record<string, unknown>;
    const givenName =
      typeof obj.givenName === "string" ? obj.givenName.trim() : "";
    const familyName =
      typeof obj.familyName === "string" ? obj.familyName.trim() : "";
    const composed = [givenName, familyName].filter(Boolean).join(" ").trim();
    if (composed) return composed;
    if (typeof obj.name === "string" && obj.name.trim() !== "") {
      return obj.name.trim();
    }
    return undefined;
  }

  /**
   * Remove honorific prefixes and credential suffixes from a personal name so
   * what remains is just the legal first/last name. Conservative: only known
   * tokens (see `HONORIFIC_PREFIXES` / `CREDENTIAL_SUFFIXES`) are stripped, so
   * legitimate words like "Mark" or "Major" are never clipped.
   *
   * Examples:
   *   "Dr. Jane Doe, MD"            → "Jane Doe"
   *   "Prof. John A. Smith, Ph.D."  → "John A. Smith"
   *   "Alice Brown MD, FACP"        → "Alice Brown"
   *   "Bob Jones Jr."               → "Bob Jones Jr."  (Jr is preserved)
   *
   * If stripping would yield an empty string, the original name is returned
   * so the contributor still produces a tag rather than being silently dropped.
   */
  private stripAcademicTitles(name: string): string {
    if (!name || typeof name !== "string") return "";
    let s = name.replace(/\s+/g, " ").trim();
    if (!s) return "";

    // 1) Everything after the first comma is conventionally a credential
    //    block ("Jane Doe, MD, FACP"). Drop it wholesale.
    const firstComma = s.indexOf(",");
    if (firstComma >= 0) s = s.slice(0, firstComma).trim();

    // 2) Strip one or more leading honorific tokens, with or without a
    //    trailing dot: "Dr. Prof Jane" → "Jane".
    while (true) {
      const m = s.match(/^([A-Za-z'']+)\.?\s+(?=\S)/);
      if (!m) break;
      const tok = m[1].toLowerCase();
      if (!PressBookScraper.HONORIFIC_PREFIXES.has(tok)) break;
      s = s.slice(m[0].length).trim();
    }

    // 3) Strip one or more trailing credential tokens, with optional dots
    //    inside (e.g. "Ph.D.") and an optional trailing dot. Stops at the
    //    first token that isn't a known credential, so "John A. Smith"
    //    (where "Smith" isn't a credential) is preserved.
    while (true) {
      const m = s.match(/\s+([A-Za-z][A-Za-z.]{0,8})\.?$/);
      if (!m) break;
      const normalized = m[1].replace(/\./g, "").toLowerCase();
      if (!PressBookScraper.CREDENTIAL_SUFFIXES.has(normalized)) break;
      s = s.slice(0, s.length - m[0].length).trim();
    }

    return s.length > 0 ? s : name.trim();
  }

  /**
   * Minimal XML attribute-value escaper. `MindTouch.Templates.PUT_PageTags`
   * interpolates tag values into a `<tag value="..."/>` attribute without
   * escaping, so names that include `&`, `<`, `>`, `"`, or `'` would
   * otherwise produce invalid XML and be rejected by MindTouch.
   */
  private escapeXmlAttr(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Strip structural numbering from a Pressbooks part/chapter title.
   *
   * Authors frequently bake the chapter number directly into the title
   * ("1. Introduction", "Chapter 3: Foo", "Part II — Bar", "Section 2.4: Baz").
   * Because the importer prepends its own sequence (e.g. `1:` for parts,
   * `1.1:` for chapters) those inline numbers produce ugly double numbering
   * on the resulting CXOne page ("1.1: 1. Introduction"). This helper removes
   * them.
   *
   * Stripping rules — conservative to avoid clipping legitimate titles like
   * "5 Ways to …":
   *
   *   1. Leading structural marker ("Chapter|Part|Section|Unit|Appendix")
   *      followed by a numeral (digits, Roman, or single letter) is always
   *      stripped — those tokens are unambiguous.
   *   2. A bare leading numeral is only stripped when followed by an explicit
   *      punctuation separator (`.`, `:`, `-`, `–`, `—`). "5 Ways" stays
   *      intact; "5. Ways" or "5: Ways" → "Ways".
   *
   * If stripping would yield an empty string we return the original title
   * untouched so the page never renders nameless.
   */
  private stripLeadingNumbering(title: string | undefined | null): string {
    if (!title || typeof title !== "string") return "";
    let cleaned = title.trim();

    // 1) "Chapter 1 …", "Part II: …", "Section 1.2 …", "Appendix A — …"
    cleaned = cleaned.replace(
      /^(?:chapter|part|section|unit|appendix)\s+(?:\d+(?:\.\d+)*|[ivxlcdm]+|[a-z])\s*[:.\-—–]?\s*/i,
      "",
    );

    // 2) Bare leading numeral with explicit separator: "1.", "1.2:", "1 -"
    cleaned = cleaned.replace(/^\d+(?:\.\d+)*\s*[:.\-—–]\s*/, "");

    cleaned = cleaned.trim();
    return cleaned.length > 0 ? cleaned : title;
  }

  /** Clean a TOC node's slug/title into a safe CXOne path segment */
  private slugifyNode(node: { slug?: string; title?: string }): string {
    const base = node.slug?.trim().length
      ? node.slug
      : node.title?.trim().length
        ? node.title
        : "section";
    const cleaned = base
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "");
    return cleaned.length > 0 ? cleaned : "Section";
  }

  /**
   * Convert a free-form page title into a MindTouch path segment matching
   * the LibreTexts URL convention seen at
   * `https://chem.libretexts.org/.../09%3A_Gases/9.02%3A_Relating_…`:
   *
   *   - capitalization preserved
   *   - whitespace runs collapsed and replaced with a single underscore
   *   - characters outside `[A-Za-z0-9_\-()]` dropped (commas, colons,
   *     question marks, etc.); hyphens and parentheses are kept because
   *     LibreTexts pages use them visibly in their URLs
   *   - resulting runs of underscores collapsed back to a single one and
   *     leading/trailing underscores trimmed so we don't emit segments
   *     like "_Title_" or "Title_-_-Subtitle"
   *
   * Used by parts and chapters where we want a readable, LibreTexts-style
   * URL segment built from the *title* rather than the Pressbooks slug
   * (which tends to be lowercase and hyphen-separated). Front- and
   * back-matter children continue to use `slugifyNode` (slug-first) since
   * their slugs are typically the canonical reference Pressbooks itself
   * uses for those well-known matter pages.
   *
   * If sanitization leaves an empty string, returns "Section" so callers
   * never produce a path ending with the bare separator (`01:_`).
   */
  private titleToPathSegment(title: string | undefined | null): string {
    if (!title || typeof title !== "string") return "Section";
    const cleaned = title
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-()]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    return cleaned.length > 0 ? cleaned : "Section";
  }

  /**
   * Fetch every published post of a given Pressbooks post type by paging through
   * the REST API (`/front-matter`, `/back-matter`, etc.).  Returns results in the
   * same `TocNode` shape used by the TOC endpoint so callers can treat them
   * uniformly.  Pagination stops when fewer than `perPage` items are returned or
   * when the endpoint responds with an error (e.g. 400 "page out of bounds").
   */
  private async fetchAllPostsOfType(
    bookUrl: string,
    postType: string,
    auth?: { username: string; password: string },
    perPage = 100,
  ): Promise<TocNode[]> {
    const nodes: TocNode[] = [];
    let page = 1;
    while (true) {
      const url =
        `${this.pbApi(bookUrl)}/${postType}` +
        `?per_page=${perPage}&page=${page}` +
        `&_fields=id,slug,title,menu_order,status,content`;
      let items: any[];
      try {
        items = await this.getJson(url, auth);
      } catch {
        // A 400 / 404 ("page out of bounds") means we have everything.
        break;
      }
      if (!Array.isArray(items) || items.length === 0) break;
      for (const item of items) {
        nodes.push({
          id: item.id as number,
          title:
            (item.title?.rendered as string) ?? item.slug ?? String(item.id),
          slug: (item.slug as string) ?? "",
          menu_order: (item.menu_order as number) ?? 0,
          has_post_content: !!(item.content?.rendered as string)?.trim(),
          status: (item.status as string) ?? "publish",
        });
      }
      if (items.length < perPage) break;
      page++;
    }
    return nodes;
  }

  /**
   * Create the CXOne page (idempotent) then POST its HTML content and properties.
   *
   * @param pagePath   - Full CXOne path for the page
   * @param title      - Display title for the page
   * @param contentHtml - Raw HTML content to push (empty string for containers)
   * @param isContainer - true  → page holds children, needs SubPageListing
   *                      false → leaf content page
   */
  private async upsertCXOnePage(
    pagePath: string,
    title: string,
    contentHtml: string,
    isContainer = false,
    extraTags: string[] = [],
  ): Promise<void> {
    // Create the page (no-op if it already exists)
    await CXOneFetch({
      scope: "page",
      path: pagePath,
      api: MindTouch.API.Page.POST_Contents_Title(title || pagePath),
      subdomain: this.subdomain,
      options: {
        method: "POST",
        body: MindTouch.Templates.POST_CreateBookChapter,
      },
      query: { abort: "exists" },
    });

    const pageID = await getPageID(pagePath, this.subdomain);
    if (!pageID)
      throw new Error(`Error locating CXOne page ID for "${pagePath}"`);

    // POST the HTML content as plain text so MindTouch renders it
    const res = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID, 10),
      api: MindTouch.API.Page.POST_Contents,
      subdomain: this.subdomain,
      query: { edittime: "now", comment: "Imported from Pressbooks" },
      options: {
        method: "POST",
        body: `${contentHtml || ""}\n${isContainer ? MindTouch.Templates.POST_CreateBookChapter : MindTouch.Templates.POST_CreateBookTopic}`,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    });

    if (!res.ok) {
      throw new Error(
        `Error updating CXOne content for "${pagePath}": ${res.statusText}`,
      );
    }

    // Set page properties — all pages get these three+

    // Container pages additionally need SubPageListing to show child pages

    await addPageProperty(
      this.subdomain,
      pageID,
      "GuideTabs",
      MindTouch.Templates.PROP_GuideTabs,
      "PUT",
    );
    await addPageProperty(
      this.subdomain,
      pageID,
      "GuideDisplay",
      "single",
      "PUT",
    );
    await addPageProperty(this.subdomain, pageID, "WelcomeHidden", true);

    await this.applyPageTags(pageID, extraTags);
  }

  /**
   * Read a page's existing tags and PUT a merged set back. Always re-stamps
   * the Pressbooks `source@<url>` tag. License-type tags follow a singularity
   * contract: any incoming `license:*` / `licenseversion:*` replaces the
   * matching tag on the page (preventing duplicates on re-import); when the
   * caller supplies none, we leave existing license tags untouched so that
   * editor-curated values aren't erased.
   *
   * Used by both `upsertCXOnePage` (per-page tagging) and the book-root
   * tagging step in `publishBook` so the cover page also carries the book's
   * license tags for the CXOne footer to render attribution.
   */
  private async applyPageTags(
    pageId: string | number,
    extraTags: string[],
  ): Promise<void> {
    const numericId =
      typeof pageId === "number" ? pageId : parseInt(pageId, 10);

    const existingTagsRes = await CXOneFetch({
      scope: "page",
      path: numericId,
      api: MindTouch.API.Page.GET_Page_Tags,
      subdomain: this.subdomain,
    });
    let existingTagValues: string[] = [];
    if (existingTagsRes.ok) {
      const data = await existingTagsRes.json();
      // MindTouch returns a single object when there is exactly one tag,
      // and an array when there are multiple.
      const raw: { "@value": string } | { "@value": string }[] = data.tag ?? [];
      existingTagValues = (Array.isArray(raw) ? raw : [raw]).map(
        (t) => t["@value"],
      );
    }

    const incomingHasLicense = extraTags.some((t) => t.startsWith("license:"));
    const incomingHasLicenseVersion = extraTags.some((t) =>
      t.startsWith("licenseversion:"),
    );
    const incomingHasAuthor = extraTags.some((t) => t.startsWith("author@"));
    const filteredExisting = existingTagValues.filter((t) => {
      if (incomingHasLicense && t.startsWith("license:")) return false;
      if (incomingHasLicenseVersion && t.startsWith("licenseversion:"))
        return false;
      if (incomingHasAuthor && t.startsWith("author@")) return false;
      return true;
    });

    const mergedTags = Array.from(
      new Set([...filteredExisting, `source@${this.pbBookURL}`, ...extraTags]),
    );
    await CXOneFetch({
      scope: "page",
      path: numericId,
      api: MindTouch.API.Page.PUT_Page_Tags,
      subdomain: this.subdomain,
      options: {
        method: "PUT",
        headers: { "Content-Type": "application/xml" },
        body: MindTouch.Templates.PUT_PageTags(mergedTags),
      },
    });
  }

  /**
   * Persist contributors as `Author` documents in a single bulk insert.
   *
   * The `Author` collection has a unique compound index on
   * `(orgID, nameKey)`, so naive batching breaks the moment two different
   * Pressbooks contributors happen to share a slug. The flow here:
   *
   *   1. Dedupe the incoming batch on `(orgID, nameKey)` so an in-batch
   *      duplicate (same contributor recorded under multiple roles, e.g.
   *      both author and editor on a chapter) is collapsed to one record
   *      before we even touch the DB.
   *
   *   2. Single round-trip lookup of every conflicting `nameKey` already
   *      in the DB for this `orgID`.
   *
   *   3. Per-conflict resolution:
   *        - If the existing record's `name` matches our contributor
   *          (case-insensitive, whitespace-normalized) it's the same
   *          person already in the DB → skip.
   *        - Otherwise it's a genuine slug collision (different person
   *          with the same slug) → claim the next free `<slug>-N`
   *          suffix via `findFreeNameKey`.
   *
   *   4. Bulk insert the survivors with `insertMany({ ordered: false })`.
   *      `ordered: false` is a backstop for the rare race in which a
   *      parallel import grabs one of our chosen suffixes between the
   *      conflict scan in step 2 and the insert here; the driver still
   *      throws on duplicate-key (code 11000), and we swallow only those.
   */
  private async createAuthors(
    contributors: PressbooksContributor[]
  ): Promise<void> {
    if (contributors.length === 0) return;

    // const orgID = "libretexts";
    const PLACEHOLDER_PICTURE =
      "https://biz.libretexts.org/@api/deki/files/5084/girl-160172__340.png";

    // Whitespace-collapsed, lower-cased name comparison so trivial
    // formatting differences ("Jane Doe" vs "jane  doe") don't get
    // mistakenly classified as two different people.
    const normalizeName = (s: string): string =>
      s.trim().toLowerCase().replace(/\s+/g, " ");

    // ── 1. Dedupe the incoming batch on (orgID, nameKey) ─────────────────
    // The persisted `name` is resolved via `resolveContributorCleanName`
    // — the same helper the `author@…` tag pipeline uses — so the Author
    // record and the page tag for a given contributor are guaranteed to
    // carry the same string. Practically this means:
    //   - We prefer composed `firstName + lastName` over the free-form
    //     `term.name` (the discrete fields are the more reliable carrier
    //     of the legal name).
    //   - Honorifics ("Dr.") and credentials ("MD", "Ph.D.", "Esq.") are
    //     stripped via `stripAcademicTitles`.
    //   - The same canonicalization is applied to existing DB rows in
    //     the collision check below so legacy records stored before
    //     these rules existed still match a re-imported clean name.
    type Candidate = { nameKey: string; name: string };
    const seenKeys = new Set<string>();
    const candidates: Candidate[] = [];
    for (const c of contributors) {
      const nameKey = c.slug?.trim();
      if (!nameKey) continue;
      const cleanName = this.resolveContributorCleanName(c);
      if (!cleanName) continue;
      const dedupeKey = nameKey.toLowerCase();
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      candidates.push({ nameKey, name: cleanName });
    }
    if (candidates.length === 0) return;

    // ── 2. One-shot lookup of every conflicting nameKey ──────────────────
    const existing = await Author.find(
      {  nameKey: { $in: candidates.map((c) => c.nameKey) } },
      { nameKey: 1, name: 1 },
    ).lean();
    const existingByKey = new Map<string, string>(
      existing.map((a) => [String(a.nameKey ?? ""), String(a.name ?? "")]),
    );

    // ── 3. Resolve each candidate ────────────────────────────────────────
    const docs: Array<
      Pick<AuthorInterface,  "nameKey" | "name" | "pictureURL">
    > = [];
    for (const c of candidates) {
      const existingName = existingByKey.get(c.nameKey);
      if (existingName !== undefined) {
        // Strip titles from the existing record's name too, so a legacy
        // row stored as "Dr. Jane Doe, MD" still matches a newly cleaned
        // "Jane Doe" as the same person.
        const existingClean = this.stripAcademicTitles(existingName);
        if (normalizeName(existingClean) === normalizeName(c.name)) {
          // Same person, already in the DB — nothing to do.
          continue;
        }
        // Different person, same slug — pick the next free suffix.
        const freeKey = await this.findFreeNameKey( c.nameKey);
        console.log(
          `[PressBookScraper] Author nameKey collision: "${c.nameKey}" already used by "${existingName}"; ` +
            `inserting "${c.name}" as "${freeKey}".`,
        );
        docs.push({
          nameKey: freeKey,
          name: c.name,
          pictureURL: PLACEHOLDER_PICTURE,
        });
      } else {
        docs.push({
          nameKey: c.nameKey,
          name: c.name,
          pictureURL: PLACEHOLDER_PICTURE,
        });
      }
    }
    if (docs.length === 0) return;

    // ── 4. Bulk insert ────────────────────────────────────────────────────
    try {
      await Author.insertMany(docs, { ordered: false });
    } catch (err) {
      const writeErrors: Array<{ code?: number }> =
        (err as { writeErrors?: Array<{ code?: number }> })?.writeErrors ?? [];
      const nonDupErrors = writeErrors.filter((e) => e?.code !== 11000);
      if (writeErrors.length === 0 || nonDupErrors.length > 0) {
        throw err;
      }
    }
  }

  /**
   * Find the lowest unused `<baseKey>-N` slug for a given `orgID`.
   *
   * Done in a single round-trip: pull every existing slug matching
   * `^<baseKey>(?:-\d+)?$`, parse out the numeric suffixes, and return
   * the smallest positive integer N (starting from 2) whose `<baseKey>-N`
   * variant isn't already taken. The bare `baseKey` itself is treated as
   * occupying suffix=1, so the first generated variant is `baseKey-2`.
   */
  private async findFreeNameKey(
    baseKey: string,
  ): Promise<string> {
    // Slug values may legally contain characters that mean something to
    // regex (Pressbooks doesn't strictly enforce `[a-z0-9-]+`).
    const escaped = baseKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${escaped}(?:-(\\d+))?$`);
    const existing = await Author.find(
      { nameKey: re },
      { nameKey: 1 },
    ).lean();

    const taken = new Set<number>();
    for (const row of existing) {
      const m = String(row.nameKey ?? "").match(re);
      if (!m) continue;
      taken.add(m[1] ? parseInt(m[1], 10) : 1);
    }
    for (let n = 2; n < 10_000; n++) {
      if (!taken.has(n)) return `${baseKey}-${n}`;
    }
    // Absurd fallback: 10k collisions on the same slug isn't realistic,
    // but if it happens we still produce a unique key rather than throw.
    return `${baseKey}-${Date.now()}`;
  }
}
