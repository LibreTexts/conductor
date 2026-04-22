import {
  addPageProperty,
  CXOneFetch,
  generateBookPathAndURL,
  getPageID,
} from "./librariesclient";
import conductorErrors from "../conductor-errors";
import MindTouch from "./CXOne/index.js";
import { License } from "../types";

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

export interface MindTouchConfig {
  hostname: string;
  apiKey: string;
  apiSecret: string;
  user?: string;
  rootPath?: string;
}

export interface PublishOptions {
  auth?: { username: string; password: string };
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
  private getAuthorsName(metadata: any): string {
    return metadata.authors.map((author: any) => author.name).join(", ");
  }

  async publishBook(options: PublishOptions): Promise<PublishResult> {
    const encodePbURL = this.pbBookURL.replace(/\/+$/, "");
    const auth = options.auth;
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
    try {
      const license: License = {
        name: metadata.license.name,
        url: metadata.license.url,
      };
      result.license = license;
    } catch {
      result.license = undefined;
    }
    // ── 3.4 Resource URL ───────────────────────────────────────────────────────
    result.resourceURL = this.pbBookURL;
    // ── 3.5 Thumbnail ────────────────────────────────────────────────────────────
    try {
      result.thumbnail = metadata.image;
    } catch {
      result.thumbnail = `${defaultImagesURL}/default.png`;
    }

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

    for (let i = 0; i < sortedFrontMatter.length; i++) {
      const node = sortedFrontMatter[i];
      const seq = String(i + 1).padStart(2, "0");
      const pagePath = `${frontMatterContainerPath}/${seq}:_${this.slugifyNode(node)}`;
      log(`  [FM ${seq}] ${node.title}`);

      const content = node.has_post_content
        ? await this.fetchNodeContent(
            encodePbURL,
            "front-matter",
            node.id,
            auth,
          )
        : "";

      // isContainer: false — Front Matter items are leaf content pages
      await this.upsertCXOnePage(pagePath, node.title, content, false);
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
      const partPath = `${bookPath}/${partSeq}:${this.slugifyNode(part)}`;
      log(
        `\n  [Part ${partSeq}] ${part.title} (${part.chapters.length} chapters)`,
      );

      const partContent = part.has_post_content
        ? await this.fetchNodeContent(encodePbURL, "parts", part.id, auth)
        : "";

      // isContainer: true — Parts hold chapters under them
      await this.upsertCXOnePage(
        partPath,
        `${partSeq}: ${part.title}`,
        partContent,
        true,
      );

      const sortedChapters = [...part.chapters].sort(
        (a, b) => a.menu_order - b.menu_order,
      );

      for (let ci = 0; ci < sortedChapters.length; ci++) {
        const chapter = sortedChapters[ci];
        const chapterSeq = String(ci + 1).padStart(2, "0");
        const chapterPath = `${partPath}/${chapterSeq}:_${this.slugifyNode(chapter)}`;
        log(`    [Ch ${chapterSeq}] ${chapter.title}`);

        const content = chapter.has_post_content
          ? await this.fetchNodeContent(
              encodePbURL,
              "chapters",
              chapter.id,
              auth,
            )
          : "";

        // isContainer: false — Chapters are leaf content pages
        await this.upsertCXOnePage(chapterPath, chapter.title, content, false);
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
    const backMatterSeq = String(sortedParts.length + 1).padStart(2, "0");
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

    for (let i = 0; i < sortedBackMatter.length; i++) {
      const node = sortedBackMatter[i];
      const seq = String(i + 1).padStart(2, "0");
      const pagePath = `${backMatterContainerPath}/${seq}:_${this.slugifyNode(node)}`;
      log(
        `  [BM ${seq}] ${node.title}, ${node.has_post_content}, id: ${node.id}`,
      );
      const content =
        (await this.fetchNodeContent(
          encodePbURL,
          "back-matter",
          node.id,
          auth,
        )) || "";

      // isContainer: false — Back Matter items are leaf content pages
      await this.upsertCXOnePage(pagePath, node.title, content, false);
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

    // ── 8. Trigger MindMap TOC update ─────────────────────────────────────────
    // log("[*] Triggering MindMap TOC update...");
    // fetch(`https://batch.libretexts.org/print/Libretext=${bookURL}`, {
    //   headers: { origin: "commons.libretexts.org" },
    // }).catch((e) => {
    //   console.warn(
    //     "[PressBookScraper] MindMap trigger failed (non-fatal):",
    //     (e as Error).message,
    //   );
    // });
    // await sleep(1500);

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
   * Fetch the rendered HTML content for a single node by hitting its
   * individual REST endpoint.
   */
  private async fetchNodeContent(
    bookUrl: string,
    postType: string,
    id: number,
    auth?: { username: string; password: string },
  ): Promise<string> {
    try {
      console.log(`[*] id: ${id}`);
      const url = `${this.pbApi(bookUrl)}/${postType}/${id}?_embed=1`;
      const item = await this.getJson(url, auth);
      const html: string = item.content?.rendered ?? "";
      return this.convertLatexShortcodes(html);
    } catch (err) {
      console.warn(
        `[PressBookScraper] Failed to fetch content for ${postType}/${id}:`,
        (err as Error).message,
      );
      return "";
    }
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
        body: `${!isContainer ? MindTouch.Templates.POST_CreateBookChapter : MindTouch.Templates.POST_CreateBookSection}\n${contentHtml || ""}`,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    });

    if (!res.ok) {
      throw new Error(
        `Error updating CXOne content for "${pagePath}": ${res.statusText}`,
      );
    }

    // Set page properties — all pages get these three+
    const pageProps: Promise<any>[] = [];

    // Container pages additionally need SubPageListing to show child pages
    if (!isContainer) {
      pageProps.push(
        addPageProperty(this.subdomain, pagePath, "WelcomeHidden", true),
        addPageProperty(this.subdomain, pagePath, "ArticleType", "Topic"),
        addPageProperty(this.subdomain, pagePath, "GuideDisplay", "single"),
        addPageProperty(
          this.subdomain,
          pagePath,
          "GuideTabs",
          MindTouch.Templates.PROP_GuideTabs, 
          "PUT"
        ),
      );
    }

    await Promise.all(pageProps);
  }
}
