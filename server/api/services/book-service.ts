import { getLibraryAndPageFromBookID } from "../../util/bookutils";
import { CXOneFetch } from "../../util/librariesclient";
import MindTouch from "../../util/CXOne";
import {
  GetPageSubPagesResponse,
  PageBase,
  PageDetailsResponse,
  PageImagesRes,
  PageSimpleWOverview,
  PageSimpleWTags,
  PageTag,
  TableOfContents,
} from "../../types";
import * as cheerio from "cheerio";
import Book from "../../models/book";

export interface BookServiceParams {
  bookID: string;
}

export default class BookService {
  private _bookID: string = "";
  private _library: string = "";
  private _coverID: string = "";
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

  async getBookSummary(): Promise<string | undefined> {
    const book = await Book.findOne({ bookID: this._bookID });
    if (!book) {
      return undefined;
    }
    return book?.summary || "";
  }

  async getBookTOCNew(): Promise<TableOfContents> {
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

    function _buildHierarchy(
      page: GetPageSubPagesResponse["page"] | PageBase,
      parentID?: number
    ): (GetPageSubPagesResponse["page"] | PageBase) & {
      parentID?: number;
      subpages?: TableOfContents[];
    } {
      const pageID = Number.parseInt(page["@id"], 10);
      const subpages = [];

      // @ts-ignore
      const processPage = (p) => ({
        ...p,
        id: pageID,
        url: p["uri.ui"],
      });

      if ("subpages" in page) {
        if (Array.isArray(page?.subpages?.page)) {
          page.subpages.page.forEach((p) =>
            subpages.push(_buildHierarchy(p, pageID))
          );
        } else if (typeof page?.subpages?.page === "object") {
          // single page
          subpages.push(_buildHierarchy(page.subpages.page, pageID));
        }
      }

      return processPage({
        ...page,
        ...(parentID && { parentID }),
        ...(subpages.length && { subpages }),
      });
    }

    const structured = _buildHierarchy(rawTree?.page);
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

    return buildStructure(structured);
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

    const overviewPromises: Promise<string>[] = [];
    for (const page of flattenedPageData) {
      // Add a 1s delay between each fetch to avoid rate limiting
      const _promise = new Promise<string>((resolve) => {
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
          overview: _result.value,
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

  /**
   * Retrieves a base64 encoded string of a file from a page
   * @param pageID - The ID of the page to fetch the file from
   * @param fileName - The name of the file to fetch (should include the file extension)
   * @param size - The size of the file to fetch (original, thumb, webview, bestfit)
   * @returns {string} - The base64 encoded string of the file
   */
  async getFileContent(
    pageID: string,
    fileName: string,
    size: "original" | "thumb" | "webview" | "bestfit" = "thumb"
  ) {
    const fileContentRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID.toString()),
      api: MindTouch.API.Page.GET_Page_File(fileName),
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
   * @returns {string} - The raw content of the page
   */
  async getPageContent(pageID: string): Promise<string> {
    const pageContentsRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID),
      api: MindTouch.API.Page.GET_Page_Contents,
      subdomain: this._library,
    }).catch((err) => {
      console.error(err);
      throw new Error(`Error fetching page details: ${err}`);
    });

    if (!pageContentsRes.ok) {
      throw new Error(
        `Error fetching page details: ${pageContentsRes.statusText}`
      );
    }

    const pageContent = await pageContentsRes.json();
    const pageRawBody = pageContent.body?.[0];
    if (!pageRawBody) {
      return "";
    }

    return pageRawBody.toString();
  }

  async getPageDetails(
    pageID: string
  ): Promise<PageDetailsResponse | undefined> {
    if (!pageID) {
      throw new Error("Missing pageID");
    }

    const overview = await this.getPageOverview(pageID);
    const tags = await this.getPageTags(pageID);

    return {
      overview,
      tags,
    };
  }

  async getPageOverview(pageID: string): Promise<string> {
    if (!pageID) {
      throw new Error("Missing page ID");
    }

    const pagePropertiesRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID),
      api: MindTouch.API.Page.GET_Page_Properties,
      subdomain: this._library,
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

    return overviewText;
  }

  async getPageTags(pageID: string): Promise<PageTag[]> {
    if (!pageID) {
      throw new Error("Missing page ID");
    }

    const pageTagsRes = await CXOneFetch({
      scope: "page",
      path: parseInt(pageID),
      api: MindTouch.API.Page.GET_Page_Tags,
      subdomain: this._library,
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
    const pageRawBody = await this.getPageContent(pageID);
    const cheerioObj = cheerio.load(pageRawBody);
    const pageText = cheerioObj.text(); // Extract text from HTML

    return pageText;
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

  async updatePageContent(pageID: string, content: string): Promise<boolean> {
    try {
      const updatedContentRes = await CXOneFetch({
        scope: "page",
        path: parseInt(pageID),
        api: MindTouch.API.Page.POST_Contents,
        subdomain: this._library,
        query: {
          edittime: "now",
        },
        options: {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: content,
        },
      });

      if (!updatedContentRes.ok) {
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
      // Get current page properties and find the overview property
      const pagePropertiesRes = await CXOneFetch({
        scope: "page",
        path: parseInt(pageID),
        api: MindTouch.API.Page.GET_Page_Properties,
        subdomain: this._library,
      }).catch((err) => {
        console.error(err);
        throw new Error("internal");
      });

      if (!pagePropertiesRes.ok) {
        throw new Error("internal");
      }

      const pagePropertiesRaw = await pagePropertiesRes.json();
      const pageProperties = Array.isArray(pagePropertiesRaw?.property)
        ? pagePropertiesRaw.property
        : [pagePropertiesRaw?.property];

      // Check if there is an existing overview property
      const overviewProperty = pageProperties
        .filter((p: any) => !!p)
        .find(
          (prop: any) => prop["@name"] === MindTouch.PageProps.PageOverview
        );

      if (summary) {
        // Update or set page overview property
        const updatedOverviewRes = await CXOneFetch({
          scope: "page",
          path: parseInt(pageID),
          api: MindTouch.API.Page.PUT_Page_Property(
            MindTouch.PageProps.PageOverview
          ),
          subdomain: this._library,
          options: {
            method: "PUT",
            headers: {
              "Content-Type": "text/plain",
              ...(overviewProperty &&
                overviewProperty["@etag"] && {
                  Etag: overviewProperty["@etag"],
                }),
            },
            body: summary,
          },
        });

        if (!updatedOverviewRes.ok) {
          throw new Error("internal");
        }
      }

      if (tags) {
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
            body: MindTouch.Templates.PUT_PageTags(tags),
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
}
