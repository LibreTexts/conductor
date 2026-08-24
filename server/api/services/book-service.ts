import { getLibraryAndPageFromBookID } from "../../util/bookutils";
import { CXOneFetch } from "../../util/librariesclient";
import MindTouch from "../../util/CXOne";
import {
  BookMatterType,
  GetPageSubPagesResponse,
  PageBase,
  PageDetailsResponse,
  PageImagesRes,
  PageSimpleWOverview,
  PageSimpleWTags,
  PageTag,
  TableOfContents,
} from "../../types";
import { RemixerSubPage } from "../../types/Remixer";
import * as cheerio from "cheerio";
import Book, { BookInterface } from "../../models/book";
import { encodeXML } from "entities";
import Project from "../../models/project";
import projectsAPI from "../projects";
import NodeCache from "node-cache";
import User from "../../models/user";
import { assembleUrl } from "../../util/helpers";
import axios, { AxiosError } from "axios";
import CXOne from "../../util/CXOne";
import ExpertWithSSM from "../../util/ExpertWithSSM";
import Expert, {
  ExpertError,
  GetPageResponse,
} from "@libretexts/cxone-expert-node";
import LibraryService from "./library-service";

export interface BookServiceParams {
  bookID: string;
}

/**
 * Raised when a page could not be created because the path is already taken.
 *
 * This is a recoverable, user-fixable condition (usually a duplicate book title),
 * not an internal failure, so callers that create pages on a user's behalf can
 * distinguish it from a genuine error and say so in the response.
 */
export class BookPageConflictError extends Error {
  constructor(
    public readonly path: string,
    public readonly label: string,
  ) {
    super(`A page already exists at "${path}" (${label}).`);
    this.name = "BookPageConflictError";
  }
}

type HierarchyPage = (GetPageSubPagesResponse["page"] | PageBase) & {
  id?: number;
  url?: string;
  parentID?: number;
  subpages?: HierarchyPage[];
};

export default class BookService {
  private _bookID: string = "";
  private _library: string = "";
  private _coverID: string = "";

  // Mild caching of books' TOC to reduce the number of calls to CXOne.
  // node-cache TTL/checkperiod are in seconds.
  private static readonly TOC_CACHE_TTL_SECONDS = 120;
  private static readonly TOC_CACHE_CHECKPERIOD_SECONDS = 120;
  private static _tocCacheByBookID = new NodeCache({
    stdTTL: BookService.TOC_CACHE_TTL_SECONDS,
    checkperiod: BookService.TOC_CACHE_CHECKPERIOD_SECONDS,
    useClones: false,
  });
  private static _tocInFlightByBookID = new Map<string, Promise<TableOfContents>>();

  private static readonly MATTER_ROOT_PATHS = {
    Front: "00%3A_Front_Matter",
    Back: "zz%3A_Back_Matter",
  }

  private static readonly DEFAULT_THUMBNAILS = {
    BACK_MATTER: 'https://cdn.libretexts.net/DefaultImages/Back%20matter.jpg',
    DEFAULT: 'https://cdn.libretexts.net/DefaultImages/default.png',
    FRONT_MATTER: 'https://cdn.libretexts.net/DefaultImages/Front%20Matter.jpg',
  };

  /** Guide tab template key used for the "Single (Topic hierarchy)" guide display. */
  private static readonly GUIDE_TAB_TEMPLATE_KEY = 'Topic_hierarchy';

  /**
   * Deki stores a page's thumbnail as an attached file with this reserved name.
   * Pass it raw: the SDK double-encodes filenames internally.
   */
  private static readonly THUMBNAIL_FILE_NAME = 'mindtouch.page#thumbnail';

  /** Deki expects property values as plain text, not JSON. */
  private static readonly PROPERTY_HEADERS = {
    headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
  };

  constructor(params: BookServiceParams) {
    if (!params.bookID) {
      throw new Error("Missing bookID");
    }
    this._bookID = params.bookID;

    const [library, coverID] = getLibraryAndPageFromBookID(params.bookID);
    if (!library || !coverID) {
      throw new Error("Invalid bookID");
    }

    this._library = library;
    this._coverID = coverID;
  }

  get bookID(): string {
    return this._bookID;
  }

  get library(): string {
    return this._library;
  }

  get coverID(): string {
    return this._coverID;
  }

  /**
   * Page tag prefixes that should be disabled/ignored for UI display
   */
  public DISABLED_PAGE_TAG_PREFIXES = [
    "article:",
    "authorname:",
    "license:",
    "licenseversion:",
    "source@",
    "stage:",
    "lulu@",
    "author@",
    "printoptions:",
    "showtoc:",
    "coverpage:",
    "columns:",
    "transclude:",
    "transcluded:",
    "field:",
    "printoptions:",
  ];

  /**
  * Helper to check if an error is a 409 Conflict (page already exists when using abort='exists').
  * This is actually a success case when we're trying to create pages only if they don't exist.
  */
  private static is409Conflict(error: unknown): boolean {
    return BookService._httpStatusOf(error) === 409;
  }

  /**
   * Extracts the HTTP status from an error thrown by the CXOne SDK, axios, or
   * anything else that carries one. Returns `null` when no status is present.
   */
  private static _httpStatusOf(error: unknown): number | null {
    // The CXOne SDK wraps every axios failure in an ExpertError before rejecting,
    // so this is the shape we see in practice.
    if (ExpertError.isExpertError(error)) {
      return error.status ?? null;
    }
    if (error instanceof AxiosError) {
      return error.response?.status ?? error.status ?? null;
    }
    // Fallback for anything else that carries an HTTP status
    const err = error as any;
    return err?.status ?? err?.response?.status ?? null;
  }

  /**
   * Reports whether a page already exists at `path` on `library`.
   *
   * Deliberately **throws** on anything other than a clean hit or a clean 404.
   * A caller uses this to decide whether it is safe to write, so an unreachable
   * library must not be reported as "available" — that is how you end up
   * writing into somebody else's book.
   *
   * @throws If the library could not be reached or answered with anything other
   * than a success or a 404.
   */
  public static async pageExists(library: string, path: string): Promise<boolean> {
    const expert = await ExpertWithSSM.getInstance().forLibrary(library);
    if (!expert) {
      throw new Error(`Unable to reach library "${library}".`);
    }

    try {
      const res = await expert.pages.getPage(path);
      // A body without an id isn't a real page. Reading that as "taken" would
      // block creation outright, whereas reading it as "free" is caught by the
      // conflict guard on the create itself, so err toward free.
      return !!res?.["@id"];
    } catch (error) {
      if (BookService._httpStatusOf(error) === 404) {
        return false;
      }
      throw error;
    }
  }


  async canAccessPage(userID: string, pageID: string | number): Promise<boolean> {
    try {
      const project = await Project.findOne({
        libreLibrary: this._library,
        libreCoverID: this._coverID,
      });

      if (!project) {
        return false;
      }

      // Todo: move the user lookup and permission check into a single function in projectsAPI for cleanliness.
      const user = await User.findOne({ uuid: { $eq: userID } });
      if (!user) {
        return false;
      }
      const canAccessProject = projectsAPI.checkProjectMemberPermission(project, user);

      // If the user can't access the project in general, they can't access the page. Fail-fast.
      if (!canAccessProject) {
        return false;
      }

      // Load all page ID's from the book's TOC and check if the requested pageID is in that list
      const toc = await this.getBookPageIDs();
      return toc.includes(pageID.toString());
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async getBookRecord(): Promise<BookInterface | undefined> {
    try {
      return (await Book.findOne({ bookID: this._bookID })) ?? undefined;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  async getBookSummary(): Promise<string | undefined> {
    try {
      const book = await Book.findOne({ bookID: this._bookID });
      if (!book) {
        return undefined;
      }
      return book?.summary || "";
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  private _buildHierarchy(
    page: GetPageSubPagesResponse["page"] | PageBase,
    parentID?: number,
  ): HierarchyPage {
    const pageID = Number.parseInt(page["@id"], 10);
    const subpages: HierarchyPage[] = [];

    if ("subpages" in page) {
      const nested = page.subpages?.page;
      if (Array.isArray(nested)) {
        nested.forEach((p) => subpages.push(this._buildHierarchy(p, pageID)));
      } else if (typeof nested === "object" && nested) {
        subpages.push(this._buildHierarchy(nested, pageID));
      }
    }

    return {
      ...page,
      id: pageID,
      url: page["uri.ui"],
      ...(parentID ? { parentID } : {}),
      ...(subpages.length ? { subpages } : {}),
    } as HierarchyPage;
  }

  private _toRemixerSubPage(page: HierarchyPage): RemixerSubPage {
    const children = Array.isArray(page.subpages) ? page.subpages : [];
    return {
      "@id": String(page["@id"] ?? page.id ?? ""),
      "@title": page.title ?? "",
      "@href": page["uri.ui"] ?? page.url ?? page["@href"] ?? "",
      "@subpages": children.length > 0,
      article: "article" in page && page.article ? String(page.article) : "",
      namespace: page.namespace ?? this._library,
      title: page.title ?? "",
      "uri.ui": page["uri.ui"] ?? page.url ?? "",
      parentID: page.parentID != null ? String(page.parentID) : "-1",
    };
  }

  /** Breadth-first flatten of a hierarchy tree into RemixerSubPage rows. */
  private _flattenHierarchyBfs(root: HierarchyPage): RemixerSubPage[] {
    const result: RemixerSubPage[] = [];
    const queue: HierarchyPage[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(this._toRemixerSubPage(node));
      if (Array.isArray(node.subpages) && node.subpages.length > 0) {
        queue.push(...node.subpages);
      }
    }
    return result;
  }

  async getBookTOCNew(): Promise<TableOfContents> {
    const cached = BookService._tocCacheByBookID.get<TableOfContents>(this._bookID);
    if (cached) {
      return cached;
    }

    const inFlight = BookService._tocInFlightByBookID.get(this._bookID);
    if (inFlight) {
      return inFlight;
    }

    const tocPromise = (async () => {
      const res = await CXOneFetch({
        scope: "page",
        path: parseInt(this._coverID),
        api: MindTouch.API.Page.GET_Page_Tree,
        subdomain: this._library,
        options: {
          method: "GET",
        },
      });
      const rawTree = (await res.json()) as GetPageSubPagesResponse;
      const structured = this._buildHierarchy(rawTree?.page);
      const buildStructure = (
        page: GetPageSubPagesResponse["page"] | PageBase
      ): TableOfContents => ({
        children:
          "subpages" in page && Array.isArray(page.subpages)
            ? page.subpages.map((s) => buildStructure(s))
            : [],
        id: page["@id"],
        title: page.title,
        url: page["uri.ui"],
      });

      const toc = buildStructure(structured);
      BookService._tocCacheByBookID.set(this._bookID, toc);
      return toc;
    })();

    BookService._tocInFlightByBookID.set(this._bookID, tocPromise);

    try {
      return await tocPromise;
    } finally {
      BookService._tocInFlightByBookID.delete(this._bookID);
    }
  }

  async getBookTreeFull(
    { flatten = false }: { flatten?: boolean } = {},
  ): Promise<HierarchyPage | RemixerSubPage[] | undefined> {
    const res = await CXOneFetch({
      scope: "page",
      path: parseInt(this._coverID),
      api: MindTouch.API.Page.GET_Page_Tree + "?include=uri.ui",
      subdomain: this._library,
      options: {
        method: "GET",
      },
    });

    if (!res.ok) {
      throw new Error(`Error fetching tree: ${res.statusText}`);
    }

    const rawTree = (await res.json()) as GetPageSubPagesResponse;
    if (!rawTree?.page) {
      throw new Error("No page data found in tree response");
    }

    const structured = this._buildHierarchy(rawTree?.page);

    if (flatten) {
      return this._flattenHierarchyBfs(structured);
    }

    return structured;
  }

  /**
   * Retrieves a flat array of all pages in the book's table of contents
   * Calls getBookTOCNew() to get the structured TOC, then flattens it into an array of pages
   * @returns {Promise<{ id: string; title: string; url: string }[]>} - An array of pages with their ID, title, and URL
   */
  async getBookTOCFlat(): Promise<{ id: string; title: string; url: string }[]> {
    const structured = await this.getBookTOCNew();

    const flattenTOC = (toc: TableOfContents): { id: string; title: string; url: string }[] => {
      const result = [{ id: toc.id, title: toc.title, url: toc.url }];
      if (toc.children && toc.children.length > 0) {
        toc.children.forEach((child) => {
          result.push(...flattenTOC(child));
        });
      }
      return result;
    };

    return flattenTOC(structured);
  }

  /**
   * Convenience method to get an array of all page IDs in the book's table of contents
   * Calls getBookTOCFlat() to get the flat array of pages, then maps it to an array of page IDs
   * @returns {Promise<string[]>} - An array of page IDs
   */
  async getBookPageIDs(): Promise<string[]> {
    const toc = await this.getBookTOCFlat();
    return toc.map((page) => page.id);
  }

  async getAllPageOverviews(
    toc?: TableOfContents
  ): Promise<PageSimpleWOverview[]> {
    if (!toc) {
      toc = await this.getBookTOCNew();
    }

    // Recursive function to collect all page IDs
    const collectPageData = (
      toc: TableOfContents
    ): { id: string; title: string; url: string }[] => {
      return [
        { id: toc.id, title: toc.title, url: toc.url },
        ...toc.children.flatMap(collectPageData),
      ];
    };

    const flattenedPageData = collectPageData(toc);

    const overviewPromises: Promise<{ overview: string }>[] = [];
    for (const page of flattenedPageData) {
      // Add a 1s delay between each fetch to avoid rate limiting
      const _promise = new Promise<{ overview: string }>((resolve) => {
        setTimeout(async () => {
          resolve(this.getPageOverview(page.id));
        }, 1000);
      });
      overviewPromises.push(_promise);
    }

    // Create an array of objects with the page ID, title, url, and its overview property
    const results = await Promise.allSettled(overviewPromises);
    const pageOverviews: PageSimpleWOverview[] = [];
    for (let i = 0; i < results.length; i++) {
      const _page = flattenedPageData[i];
      const _result = results[i];
      if (_result.status === "fulfilled") {
        pageOverviews.push({
          id: _page.id,
          title: _page.title,
          url: _page.url,
          overview: _result.value.overview,
        });
      }
    }

    return pageOverviews;
  }

  async getAllPageTags(toc?: TableOfContents): Promise<PageSimpleWTags[]> {
    if (!toc) {
      toc = await this.getBookTOCNew();
    }

    // Recursive function to collect all page IDs
    const collectPageData = (
      toc: TableOfContents
    ): { id: string; title: string; url: string }[] => {
      return [
        { id: toc.id, title: toc.title, url: toc.url },
        ...toc.children.flatMap(collectPageData),
      ];
    };

    const flattenedPageData = collectPageData(toc);

    const tagsPromises: Promise<PageTag[]>[] = [];
    for (const page of flattenedPageData) {
      // Add a 1s delay between each fetch to avoid rate limiting
      const _promise = new Promise<PageTag[]>((resolve) => {
        setTimeout(async () => {
          resolve(this.getPageTags(page.id));
        }, 1000);
      });
      tagsPromises.push(_promise);
    }

    // Create an array of objects with the page ID, title, url, and its tags
    const results = await Promise.allSettled(tagsPromises);
    const pageTags: PageSimpleWTags[] = [];
    for (let i = 0; i < results.length; i++) {
      const _page = flattenedPageData[i];
      const _result = results[i];
      if (_result.status === "fulfilled") {
        const tags = _result.value;
        const valueOnly = tags.map((t) => t["@value"]);
        pageTags.push({
          id: _page.id,
          title: _page.title,
          url: _page.url,
          tags: valueOnly,
        });
        continue;
      } else {
        const tags: PageTag[] = [];
        pageTags.push({
          id: _page.id,
          title: _page.title,
          url: _page.url,
          tags: [],
        });
      }
    }

    return pageTags;
  }

  async getCoverPage(): Promise<GetPageResponse | null> {
    try {
      const expert = await (ExpertWithSSM.getInstance()).forLibrary(this._library);
      if (!expert) {
        throw new Error("internal");
      }

      const pageIntID = parseInt(this._coverID);
      if (isNaN(pageIntID)) {
        throw new Error("Invalid cover ID");
      }

      const coverPageRes = await expert.pages.getPage(pageIntID);
      if (!coverPageRes) {
        throw new Error("Cover page not found");
      }

      return coverPageRes;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  /**
   * Retrieves a base64 encoded string of a file from a page
   * @param pageID - The ID of the page to fetch the file from
   * @param fileName - The name of the file to fetch (should include the file extension)
   * @param size - The size of the file to fetch (original, thumb, webview, bestfit)
   * @returns {string} - The base64 encoded string of the file
   */
  async getFileContent(
    pageID: string,
    fileID: string,
    size: "original" | "thumb" | "webview" | "bestfit" = "thumb"
  ) {
    const fileContentRes = await CXOneFetch({
      scope: "files",
      path: parseInt(fileID.toString()),
      api: MindTouch.API.File.GET_File(size),
      subdomain: this._library,
      query: {
        size,
      },
    }).catch((err) => {
      console.error(err);
      throw new Error(`Error fetching file content: ${err}`);
    });

    if (!fileContentRes.ok) {
      throw new Error(
        `Error fetching file content: ${fileContentRes.statusText}`
      );
    }

    // Get the file stream and convert it to a base64 string
    const fileStream = await fileContentRes.blob();
    const arrayBuffer = await fileStream.arrayBuffer();
    const fileData = Buffer.from(arrayBuffer).toString("base64");

    return fileData;
  }

  /**
   * Retrieves the content of a page as a string with unicode escape sequences
   * @param pageID - The ID of the page to fetch content from
   * @param format - The format of the content to fetch (html or json)
   * @param mode - The MindTouch content mode. Defaults to MindTouch's own default (`view`), which is
   * *rendered* output. Callers that intend to write the content back must pass `edit` so authored
   * DekiScript/template/transclusion source is preserved.
   * @returns {string} - The raw content of the page
   */
  async getPageContent(
    pageID: string,
    format: "html" | "json",
    mode?: "edit" | "view" | "raw"
  ): Promise<string> {
    try {
      const pageContentsRes = await CXOneFetch({
        scope: "page",
        path: parseInt(pageID),
        api: MindTouch.API.Page.GET_Page_Contents(format, mode),
        subdomain: this._library,
      }).catch((err) => {
        console.error(err);
        throw new Error(`Error fetching page details: ${err}`);
      });

      if (!pageContentsRes.ok) {
        throw new Error(
          `Page content retrieval failed with status: ${pageContentsRes.statusText}`
        );
      }

      if (format === "html") {
        const rawText = await pageContentsRes.text();
        return rawText?.toString();
      }

      const rawContent = await pageContentsRes.json();
      // MindTouch returns `body` as a bare string, an array whose first entry is the main body
      // (later entries are section objects), or "" for an empty page. Indexing a string would yield
      // a single character, so discriminate before extracting.
      const rawBody = rawContent?.body;
      if (typeof rawBody === "string") {
        return rawBody;
      }
      if (Array.isArray(rawBody) && typeof rawBody[0] === "string") {
        return rawBody[0];
      }
      return "";
    } catch (err) {
      console.error(err);
      return "";
    }
  }

  async getPageRawContent(
    pageID: string
  ): Promise<string> {
    const pageRawContentRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID),
      api: MindTouch.API.Page.GET_page_RawContents,
      subdomain: this._library,
    });

    if (!pageRawContentRes.ok) {
      throw new Error(
        `Error fetching page raw content: ${pageRawContentRes.statusText}`
      );
    }
    return await pageRawContentRes.text();
  }

  async getPageDetails(
    pageID: string
  ): Promise<PageDetailsResponse | undefined> {
    if (!pageID) {
      throw new Error("Missing pageID");
    }

    const { overview } = await this.getPageOverview(pageID);
    const tags = await this.getPageTags(pageID);

    return {
      overview,
      tags,
    };
  }

  async getPageOverview(
    pageID: string
  ): Promise<{ overview: string; etag?: string }> {
    if (!pageID) {
      throw new Error("Missing page ID");
    }

    const pagePropertiesRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID),
      api: MindTouch.API.Page.GET_Page_Properties,
      subdomain: this._library,
      options: {
        headers: {
          "Cache-Control": "no-cache",
        },
      },
    }).catch((err) => {
      console.error(err);
      throw new Error(`Error fetching page details: ${err}`);
    });

    if (!pagePropertiesRes.ok) {
      throw new Error(
        `Error fetching page details: ${pagePropertiesRes.statusText}`
      );
    }

    const pagePropertiesRaw = await pagePropertiesRes.json();
    const pageProperties = Array.isArray(pagePropertiesRaw?.property)
      ? pagePropertiesRaw.property
      : [pagePropertiesRaw?.property];
    const overviewProperty = pageProperties
      .filter((p: any) => !!p)
      .find((prop: any) => prop["@name"] === MindTouch.PageProps.PageOverview);
    const overviewText = overviewProperty?.contents?.["#text"] || "";

    return {
      overview: overviewText,
      etag: overviewProperty?.["@etag"],
    };
  }

  async getPageTags(pageID: string): Promise<PageTag[]> {
    if (!pageID) {
      throw new Error("Missing page ID");
    }
    const path = !isNaN(Number(pageID)) ? parseInt(pageID) : pageID;
    const pageTagsRes = await CXOneFetch({
      scope: "page",
      path,
      api: MindTouch.API.Page.GET_Page_Tags,
      subdomain: this._library,
      options: {
        headers: {
          "Cache-Control": "no-cache",
        },
      },
    }).catch((err) => {
      console.error(err);
      throw new Error(`Error fetching page tags: ${err}`);
    });

    if (!pageTagsRes.ok) {
      throw new Error(`Error fetching page tags: ${pageTagsRes.statusText}`);
    }

    const pageTagsData = await pageTagsRes.json();
    const pageTags = [];
    if (Array.isArray(pageTagsData.tag)) {
      pageTags.push(...pageTagsData.tag);
    } else if (pageTagsData.tag) {
      pageTags.push(pageTagsData.tag);
    }

    return pageTags;
  }

  /**
   * Retrieves the pure text content of a page, excluding HTML tags
   * @param pageID
   * @returns {string} - The text content of the page
   */
  async getPageTextContent(pageID: string): Promise<string> {
    try {
      const pageRawBody = await this.getPageContent(pageID, "json");
      if (!pageRawBody) {
        return "";
      }
      const cheerioObj = cheerio.load(pageRawBody);
      const pageText = cheerioObj.text(); // Extract text from HTML

      return pageText;
    } catch (err) {
      console.error(err);
      return "";
    }
  }

  async getPageImages(pageID: string): Promise<PageImagesRes | undefined> {
    const pageImagesRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID),
      api: MindTouch.API.Page.GET_Page_Images,
      subdomain: this._library,
    }).catch((err) => {
      console.error(err);
      throw new Error(`Error fetching page images: ${err}`);
    });

    if (!pageImagesRes.ok) {
      throw new Error(
        `Error fetching page images: ${pageImagesRes.statusText}`
      );
    }

    const parsed = await pageImagesRes.json();
    if (!parsed.file) {
      return undefined;
    }

    return parsed;
  }

  async getPageVisibility(pageID: string): Promise<string> {
    try {
      if (!pageID) {
        throw new Error("Missing page ID");
      }

      const pageSecurityRes = await CXOneFetch({
        scope: "page",
        path: parseInt(pageID),
        api: MindTouch.API.Page.GET_Page_Security,
        subdomain: this._library,
        options: {
          headers: {
            "Cache-Control": "no-cache",
          }
        }
      }).catch((err) => {
        console.error(err);
        throw new Error(`Error fetching page security: ${err}`);
      });

      if (!pageSecurityRes.ok) {
        throw new Error(
          `Error fetching page details: ${pageSecurityRes.statusText}`
        );
      }

      const pageSecurityRaw = await pageSecurityRes.json();
      const visibility = pageSecurityRaw?.["permissions.page"]?.restriction?.["#text"]?.toString() ?? "Semi-Private";

      return visibility;
    } catch (err) {
      console.error(err);
      throw new Error("internal");
    }
  }

  /**
   * @param opts.allowEmpty - Permit writing an empty body. Only for callers whose intended result
   * genuinely is a blank page (e.g. stripping a page whose entire body was a template). By default
   * an empty payload is rejected, since for every other caller it means the content was lost.
   */
  async updatePageContent(
    pageID: string,
    xmlEncodedContent: string,
    opts?: { allowEmpty?: boolean }
  ): Promise<boolean> {
    try {
      if (!opts?.allowEmpty && !xmlEncodedContent?.trim()) {
        throw new Error(`Refusing to write empty content to page ${pageID}`);
      }

      const expert = await (ExpertWithSSM.getInstance()).forLibrary(this._library);
      if (!expert) {
        throw new Error("internal");
      }

      const updatedContentRes = await expert.pages.postPageContents(
        parseInt(pageID),
        `<content><body>${xmlEncodedContent}</body></content>`,
        {
          edittime: "now",
          comment: "Updated by LibreBot",
        },
        {
          headers: {
            "Content-Type": "application/xml",
          }
        }
      )

      if (updatedContentRes?.["@status"] !== "success") {
        throw new Error("internal");
      }

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async updatePageDetails(
    pageID: string,
    summary?: string,
    tags?: string[]
  ): Promise<["location" | "internal" | null, boolean]> {
    let error = null;
    let success = false;
    try {
      if (!pageID) {
        throw new Error("location");
      }

      if (summary) {
        // Ensure new summary is XML encoded and newlines/whitespace is removed
        const newLinesRemoved = summary.replace(/\n/g, "").trim();
        const encodedSummary = encodeXML(newLinesRemoved);
        const _body = `<overview>${encodedSummary}</overview>`;

        // Update or set page overview property
        const updatedOverviewRes = await CXOneFetch({
          scope: "page",
          path: parseInt(pageID),
          api: MindTouch.API.Page.PUT_Page_Overview,
          subdomain: this._library,
          options: {
            method: "PUT",
            headers: {
              "Content-Type": "application/xml",
            },
            body: _body,
          },
        });

        if (!updatedOverviewRes.ok) {
          throw new Error("internal");
        }
      }

      if (tags && tags.length) {
        const currentPageTags = await this.getPageTags(pageID.toString());

        // Book functionality tags that should not be removed
        const systemTags = currentPageTags.filter((tag) =>
          this.DISABLED_PAGE_TAG_PREFIXES.some((prefix) =>
            tag["@value"].startsWith(prefix)
          )
        );
        const systemTagValues = Array.from(
          new Set<string>([...systemTags.map((tag) => tag["@value"])])
        );

        const withNewTags = [...systemTagValues, ...tags];

        // Prefer new system tags over old ones
        // For each item in this.DISABLED_PAGE_TAG_PREFIXES, check if there are multiple tags with the same prefix
        // If so, keep the one from the new tags, and remove the old one (from toKeepValues)
        // If not, keep the old one
        const withNewSystemTagsPreferred = withNewTags.reduce((acc, tag) => {
          // If it's not a system tag, keep it
          if (
            !this.DISABLED_PAGE_TAG_PREFIXES.some((prefix) =>
              tag.startsWith(prefix)
            )
          ) {
            return [...acc, tag];
          }

          const prefix = this.DISABLED_PAGE_TAG_PREFIXES.find((prefix) =>
            tag.startsWith(prefix)
          );
          if (!prefix) {
            return [...acc, tag];
          }

          const oldTag = systemTagValues.find((t) => t.startsWith(prefix));
          const newTag = tags.find((t) => t.startsWith(prefix));
          if (oldTag && newTag) {
            return [...acc, newTag];
          }
          return [...acc, tag];
        }, [] as string[]);

        // Ensure no duplicates
        const newTagsSet = new Set<string>([...withNewSystemTagsPreferred]);

        // Update the page tags
        const updatedTagsRes = await CXOneFetch({
          scope: "page",
          path: parseInt(pageID),
          api: MindTouch.API.Page.PUT_Page_Tags,
          subdomain: this._library,
          options: {
            method: "PUT",
            headers: {
              "Content-Type": "application/xml",
            },
            body: MindTouch.Templates.PUT_PageTags(Array.from(newTagsSet)),
          },
        });

        if (!updatedTagsRes.ok) {
          throw new Error("internal");
        }
      }

      success = true;
    } catch (err: any) {
      error = err.message ?? "internal";
      success = false;
    }

    return [error, success];
  }

  /**
   * Add or remove ShowOrg from a page body.
   * Handles both `{{template.ShowOrg()}}` and `<span class="script">template.ShowOrg()</span>`.
   * @returns true if the page was updated (or already in the desired state)
   */
  async activateShowOrg(pageID: string, active: boolean): Promise<boolean> {
    if (!pageID) {
      throw new Error("Missing pageID");
    }

    const SHOW_ORG_TOKEN = "{{template.ShowOrg()}}";
    /** Curly-brace form, optionally wrapped in <p>. */
    const SHOW_ORG_TEMPLATE_RE =
      /(?:<p>\s*)?\{\{template\.ShowOrg\(\)\}\}(?:\s*<\/p>)?/gi;
    /** Raw/script span form, optionally wrapped in <p>. */
    const SHOW_ORG_SCRIPT_RE =
      /(?:<p>\s*)?<span\s+class=["']script["']\s*>\s*template\.ShowOrg\(\)\s*<\/span>(?:\s*<\/p>)?/gi;

    const stripShowOrg = (body: string): string =>
      body
        .replace(SHOW_ORG_TEMPLATE_RE, "")
        .replace(SHOW_ORG_SCRIPT_RE, "")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd();

    const hasShowOrg = (body: string): boolean =>
      /\{\{template\.ShowOrg\(\)\}\}/i.test(body) ||
      /<span\s+class=["']script["']\s*>\s*template\.ShowOrg\(\)\s*<\/span>/i.test(
        body,
      );

    const rawContents = await this.getPageRawContent(pageID);
    let content = rawContents ?? "";
    try {
      const parsed = JSON.parse(rawContents);
      if (typeof parsed?.body === "string") {
        content = parsed.body;
      } else if (Array.isArray(parsed?.body) && parsed.body[0] != null) {
        content = String(parsed.body[0]);
      }
    } catch {
      // rawContents is already HTML/text
    }

    let nextContent = content;
    if (active) {
      // Strip any existing form(s), then append the canonical template at the end.
      const stripped = stripShowOrg(content);
      nextContent = `${stripped}\n<p>${SHOW_ORG_TOKEN}</p>`;
    } else {
      if (!hasShowOrg(content)) {
        return true;
      }
      nextContent = stripShowOrg(content);
    }

    // Stripping ShowOrg from a page whose body was only the template legitimately empties it.
    return this.updatePageContent(pageID, nextContent, { allowEmpty: true });
  }

  public getMatterRootPagePath(basePath: string, matterType: BookMatterType): string {
    const rootPage = matterType === 'Front' ? BookService.MATTER_ROOT_PATHS.Front : BookService.MATTER_ROOT_PATHS.Back;
    return assembleUrl([basePath, rootPage]);
  }

  async _setMatterRootPageProperties(basePath: string, matterType: BookMatterType): Promise<void> {
    try {
      const expert = await ExpertWithSSM.getInstance().forLibrary(this._library);
      if (!expert) {
        throw new Error("internal");
      }

      const path = assembleUrl([basePath]);
      const label = `${matterType} matter root page`;

      const thumbnailURL = matterType === 'Front'
        ? BookService.DEFAULT_THUMBNAILS.FRONT_MATTER
        : BookService.DEFAULT_THUMBNAILS.BACK_MATTER;
      const thumbnail = await BookService._fetchThumbnail(thumbnailURL);
      if (thumbnail) {
        await BookService._setPageThumbnail(expert, path, thumbnail, label);
      }

      await BookService._setGuidePageProperties(expert, this._library, path, label);
    } catch (err) {
      console.error(`Error setting ${matterType} matter root page properties:`, err);
    }
  }

  /**
   * Creates a single matter page, treating "page already exists" as a non-fatal outcome
   * when `overwriteExisting` is false.
   *
   * Deki reports an existing page two different ways under `abort=exists`: an HTTP 409,
   * or a 200 whose body carries `edit["@status"] === "conflict"`. Both mean "the author
   * already has a page here, leave it alone"; anything else is a real failure and is
   * re-thrown so the caller can abort.
   *
   * @param label - Human-readable page name used in log output (e.g. `'TitlePage'`).
   * @returns The page ID when this call created or overwrote the page, or `null` on conflict.
   */
  private static async _createPage({
    expert,
    path,
    contents,
    title,
    label,
    overwriteExisting,
    conflictBehavior = 'skip',
  }: {
    expert: Expert;
    path: string;
    contents: string;
    title: string;
    label: string;
    overwriteExisting: boolean;
    conflictBehavior?: 'skip' | 'throw';
  }): Promise<number | null> {
    const onConflict = (): null => {
      if (conflictBehavior === 'throw') {
        throw new BookPageConflictError(path, label);
      }
      console.warn(`${label} already exists, skipping creation.`);
      return null;
    };

    try {
      const res = await expert.pages.postPageContents(path, contents, {
        title,
        edittime: 'now',
        abort: overwriteExisting ? 'never' : 'exists',
      })

      const status = res?.['@status'];
      if (status === 'conflict') {
        return onConflict();
      }
      if (status !== 'success') {
        throw new Error(
          `Failed to create ${label}: unexpected response status "${status ?? 'none'}".`,
        );
      }

      const pageID = Number(res.page?.['@id']);
      return Number.isFinite(pageID) ? pageID : null;
    } catch (error) {
      if (error instanceof BookPageConflictError) {
        throw error;
      }
      if (!BookService.is409Conflict(error)) {
        throw error; // Re-throw anything that isn't "page already exists"
      }
      return onConflict();
    }
  }

  /**
   * Fetches a thumbnail image so it can be attached to a page.
   *
   * @returns The image bytes, or `null` if the fetch failed (never throws; a missing
   * thumbnail must not fail page creation).
   */
  private static async _fetchThumbnail(url: string): Promise<Buffer | null> {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(res.data);
    } catch (error) {
      console.warn(`Error fetching thumbnail "${url}":`, error);
      return null;
    }
  }

  /**
   * Attaches a thumbnail to a page. Best-effort: failures are logged, never thrown.
   *
   * @param label - Human-readable page name used in log output.
   */
  private static async _setPageThumbnail(
    expert: Expert,
    path: string,
    thumbnail: Buffer,
    label: string,
  ): Promise<void> {
    try {
      await expert.pages.putPageFileName(path, BookService.THUMBNAIL_FILE_NAME, thumbnail);
    } catch (error) {
      console.error('Error setting thumbnail for %s:', label, error);
    }
  }

  /**
   * Writes page properties, skipping any whose value is missing.
   *
   * Property names must be the full Deki `namespace#key` form, so always pass values from
   * {@link CXOne.PageProps} rather than string literals; a name Deki does not recognise is
   * stored without complaint and then silently ignored by the renderer.
   *
   * Best-effort: failures are logged, never thrown.
   *
   * @param properties - `[propertyName, value]` pairs; entries with a nullish value are skipped.
   * @param label - Human-readable page name used in log output.
   */
  private static async _setPageProperties(
    expert: Expert,
    path: string,
    properties: Array<[string, string | undefined]>,
    label: string,
  ): Promise<void> {
    try {
      await Promise.all(
        properties
          .filter((entry): entry is [string, string] => entry[1] != null)
          .map(([name, value]) =>
            expert.pages.postPageProperties(
              path,
              name,
              value,
              { abort: 'never' },
              BookService.PROPERTY_HEADERS,
            ),
          ),
      );
    } catch (error) {
      console.error('Error setting properties for %s:', label, error);
    }
  }

  /**
   * Looks up the library's configured "Topic hierarchy" guide tab template.
   *
   * The template carries a library-specific `guid`, so it must be read from the Library
   * record rather than hardcoded.
   *
   * @returns The template JSON, or `undefined` if the library has none configured.
   */
  private static async _getGuideTabTemplate(library: string): Promise<string | undefined> {
    const libraryService = new LibraryService();
    const template = await libraryService
      .getGuideTabTemplate(library, BookService.GUIDE_TAB_TEMPLATE_KEY)
      .catch((err) => {
        console.error('Error fetching guide tab template:', err);
        return undefined;
      });

    if (!template) {
      console.warn(
        `No "${BookService.GUIDE_TAB_TEMPLATE_KEY}" guide tab template configured for library "${library}"; ${CXOne.PageProps.GuideTabs} will not be set.`,
      );
    }
    return template;
  }

  /**
   * Applies the properties that make a page render as a "Single (Topic hierarchy)" guide:
   * a hidden welcome block, `guideDisplay=single`, and the library's guide tab template.
   *
   * Best-effort: failures are logged, never thrown.
   *
   * @param label - Human-readable page name used in log output.
   */
  private static async _setGuidePageProperties(
    expert: Expert,
    library: string,
    path: string,
    label: string,
  ): Promise<void> {
    const guideTabTemplate = await BookService._getGuideTabTemplate(library);
    await BookService._setPageProperties(
      expert,
      path,
      [
        [CXOne.PageProps.WelcomeHidden, 'true'],
        [CXOne.PageProps.GuideDisplay, 'single'],
        [CXOne.PageProps.GuideTabs, guideTabTemplate],
      ],
      label,
    );
  }

  /**
   * Creates a book's cover page and applies its default properties and thumbnail.
   *
   * Static because the cover page is what a book's ID is derived from, so callers cannot
   * construct a {@link BookService} until after this resolves.
   *
   * @param library - Library subdomain (e.g. `chem`).
   * @param coverPagePath - CXOne path of the cover page to create.
   * @param overwriteExisting - When false (default), an existing cover page is left untouched.
   * @throws If the cover page could not be created. Property and thumbnail failures are
   * logged but do not throw, since the book is usable without them.
   */
  public static async createBookCoverPage({
    library,
    coverPagePath,
    title,
    overwriteExisting = false,
    throwOnConflict = false,
  }: {
    library: string;
    coverPagePath: string;
    title: string;
    overwriteExisting?: boolean;
    throwOnConflict?: boolean;
  }): Promise<number | null> {
    const expert = await ExpertWithSSM.getInstance().forLibrary(library);

    const pageID = await BookService._createPage({
      expert,
      path: coverPagePath,
      contents: CXOne.Templates.POST_CreateBook,
      title,
      label: `book cover page "${title}"`,
      overwriteExisting,
      conflictBehavior: throwOnConflict ? 'throw' : 'skip',
    });

    // The page was already there and we didn't create it. Applying our properties
    // and thumbnail here would overwrite whatever the existing book has set, so
    // leave it untouched.
    if (pageID === null) {
      return null;
    }

    await BookService._setPageProperties(
      expert,
      coverPagePath,
      [
        [CXOne.PageProps.WelcomeHidden, 'true'],
        [CXOne.PageProps.SubPageListing, 'simple'],
      ],
      `book cover page "${title}"`,
    );

    const thumbnail = await BookService._fetchThumbnail(BookService.DEFAULT_THUMBNAILS.DEFAULT);
    if (thumbnail) {
      await BookService._setPageThumbnail(expert, coverPagePath, thumbnail, `book cover page "${title}"`);
    }

    return pageID;
  }

  /**
   * Creates a book's first chapter and applies the guide properties and default thumbnail.
   *
   * Static for the same reason as {@link BookService.createBookCoverPage}: it runs before
   * the book's ID is known.
   *
   * @param library - Library subdomain (e.g. `chem`).
   * @param chapterPath - CXOne path of the chapter to create.
   * @param overwriteExisting - When false (default), an existing chapter is left untouched.
   * @throws If the chapter page could not be created. Property and thumbnail failures are
   * logged but do not throw.
   */
  public static async createFirstChapter({
    library,
    chapterPath,
    title = '1: First Chapter',
    overwriteExisting = false,
  }: {
    library: string;
    chapterPath: string;
    title?: string;
    overwriteExisting?: boolean;
  }): Promise<number | null> {
    const expert = await ExpertWithSSM.getInstance().forLibrary(library);

    const pageID = await BookService._createPage({
      expert,
      path: chapterPath,
      contents: CXOne.Templates.POST_CreateBookChapter,
      title,
      label: `first chapter "${title}"`,
      overwriteExisting,
    });

    // Pre-existing page: don't overwrite its properties or thumbnail.
    if (pageID === null) {
      return null;
    }

    await BookService._setGuidePageProperties(expert, library, chapterPath, `first chapter "${title}"`);

    const thumbnail = await BookService._fetchThumbnail(BookService.DEFAULT_THUMBNAILS.DEFAULT);
    if (thumbnail) {
      await BookService._setPageThumbnail(expert, chapterPath, thumbnail, `first chapter "${title}"`);
    }

    return pageID;
  }

  /**
 * Creates the default LibreTexts front matter pages (Title Page, Info Page, Table of Contents, Licensing, etc.)
 * as subpages of the given cover page. Provides an overwriteExisting option to control whether to only create pages if they don't already exist, or to overwrite existing pages,
 * which is useful for ensuring the correct structure and content for PDF generation, but should be used with caution as some authors have customized their front matter pages.
 * @param param0
 */
  public async createDefaultFrontMatter({
    coverPagePath,
    coverPageFullURL,
    titlePageInfo,
    overwriteExisting = false,
  }: {
    coverPagePath: string;
    coverPageFullURL: string;
    titlePageInfo: { title: string; author: string; summary: string; };
    overwriteExisting?: boolean;
  }) {
    try {
      const expert = await ExpertWithSSM.getInstance().forLibrary(this._library);
      const basePath = this.getMatterRootPagePath(coverPagePath, 'Front');

      const QRoptions = { errorCorrectionLevel: 'L', margin: 2, scale: 2 };

      // Root page first, then its children. A conflict on any of them is expected when
      // overwriteExisting is false and must not stop the remaining pages from being created.
      const frontMatterRootPageId = await BookService._createPage({
        expert,
        path: assembleUrl([basePath]),
        contents: CXOne.Templates.POST_MatterRootPage,
        title: 'Front Matter',
        label: 'Front Matter root page',
        overwriteExisting,
      });

      const frontMatterPages = [
        {
          path: assembleUrl([basePath, '01%3A_TitlePage']),
          contents: CXOne.Templates.POST_TitlePage(titlePageInfo.title, titlePageInfo.author, titlePageInfo.summary, coverPageFullURL, QRoptions),
          title: 'TitlePage',
          label: 'TitlePage',
        },
        {
          path: assembleUrl([basePath, '02%3A_InfoPage']),
          contents: CXOne.Templates.POST_InfoPage,
          title: 'InfoPage',
          label: 'InfoPage',
        },
        {
          path: assembleUrl([basePath, '03%3A_Table_of_Contents']),
          contents: CXOne.Templates.POST_DynamicTOCLayout,
          title: 'Table of Contents',
          label: 'Table of Contents',
        },
        {
          path: assembleUrl([basePath, '04%3A_Licensing']),
          contents: CXOne.Templates.POST_DynamicLicensingLayout,
          title: 'Licensing',
          label: 'Licensing page',
        },
      ];

      // Sequential: Deki serialises writes under the same parent anyway, and ordering keeps log output readable.
      for (const page of frontMatterPages) {
        await BookService._createPage({ expert, overwriteExisting, ...page });
      }

      // If we have the front matter root page ID, try to order it to the front of the book
      // if (frontMatterRootPageId) {
      //   try {
      //     await expert.pages.putPageOrder(frontMatterRootPageId, { afterid: 0 }); // afterId 0 means it will be the first page in the book
      //   }
      //   catch (error) {
      //     console.error('Error ordering Front Matter root page to the front of the book:', error);
      //   }
      // }

      // Set thumbnail and misc properties
      await this._setMatterRootPageProperties(basePath, 'Front');
    } catch (err) {
      console.error('Fatal error creating default front matter pages:', err);
      throw err;
    }
  }

  /**
 * Creates the default LibreTexts back matter pages (Index, Glossary, Detailed Licensing, etc.) as subpages of the given cover page.
 * Provides an overwriteExisting option to control whether to only create pages if they don't already exist, or to overwrite existing pages,
 * which is useful for ensuring the correct structure and content for PDF generation, but should be used with caution as some authors have customized their back matter pages.
 * @param param0
 */
  public async createDefaultBackMatter({
    coverPagePath,
    overwriteExisting = false,
  }: {
    coverPagePath: string;
    overwriteExisting?: boolean;
  }) {
    try {
      const expert = await ExpertWithSSM.getInstance().forLibrary(this._library);
      const basePath = this.getMatterRootPagePath(coverPagePath, 'Back');

      // Root page first, then its children. A conflict on any of them is expected when
      // overwriteExisting is false and must not stop the remaining pages from being created.
      const backMatterRootPageId = await BookService._createPage({
        expert,
        path: assembleUrl([basePath]),
        contents: CXOne.Templates.POST_MatterRootPage,
        title: 'Back Matter',
        label: 'Back Matter root page',
        overwriteExisting,
      });

      const backMatterPages = [
        {
          path: assembleUrl([basePath, '10%3A_Index']),
          contents: CXOne.Templates.POST_DynamicIndexLayout,
          title: 'Index',
          label: 'Index page',
        },
        {
          path: assembleUrl([basePath, '20%3A_Glossary']),
          contents: `
        ${CXOne.Templates.POST_DynamicGlossaryLayout}
        \n<p class="template:tag-insert"><em>Tags recommended by the template: </em><a href="#">article:topic</a><a href="#">showtoc:no</a><a href="#">printoptions:no-header</a><a href="#">columns:three</a></p>
        `,
          title: 'Glossary',
          label: 'Glossary page',
        },
        {
          path: assembleUrl([basePath, '30%3A_Detailed_Licensing']),
          contents: CXOne.Templates.POST_DynamicDetailedLicensingLayout,
          title: 'Detailed Licensing',
          label: 'Detailed Licensing page',
        },
      ];

      // Sequential: Deki serialises writes under the same parent anyway, and ordering keeps log output readable.
      for (const page of backMatterPages) {
        await BookService._createPage({ expert, overwriteExisting, ...page });
      }

      // If we have the back matter root page ID, try to order it to the back of the book
      // if (backMatterRootPageId) {
      //   try {
      //     // We first have to get the last page ID in the book to use as afterid. Call the expert tree method directly to avoid caching issues with getBookTOCNew() and getBookTOCFlat().
      //     const treeRes = await expert.pages.getPageTree(coverPagePath);
      //     if (!treeRes || !treeRes.page || !treeRes.page.subpages) {
      //       throw new Error('Failed to fetch book tree for ordering Back Matter root page');
      //     }

      //     const rootPages = treeRes.page.subpages;
      //     const pagesArr = rootPages.page ? Array.isArray(rootPages.page) ? rootPages.page : [rootPages.page] : [];

      //     const lastPage = pagesArr?.[pagesArr.length - 1];
      //     if (!lastPage || !lastPage["@id"]) {
      //       throw new Error('Could not determine last page in book for ordering Back Matter root page');
      //     }

      //     const afterid = lastPage?.["@id"] ? parseInt(lastPage["@id"]) : undefined;

      //     if (afterid === undefined || isNaN(afterid)) {
      //       console.warn('Could not determine last page ID for ordering Back Matter root page; skipping ordering.');
      //     } else if (afterid === backMatterRootPageId) {
      //       console.warn('Back Matter root page is already the last page; skipping ordering.');
      //     } else {
      //       await expert.pages.putPageOrder(backMatterRootPageId, { afterid });
      //     }
      //   } catch (error) {
      //     console.error('Error ordering Back Matter root page to the back of the book:', error);
      //   }
      // }

      // Set thumbnail and misc properties
      await this._setMatterRootPageProperties(basePath, 'Back');
    } catch (err) {
      console.error('Fatal error creating default back matter pages:', err);
      throw err;
    }
  }
}
