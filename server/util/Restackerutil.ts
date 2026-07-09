import BookService from "../api/services/book-service";
import Restacker, { RestackerStatus } from "../models/restacker";
import { PageTag } from "../types/Book";
import { libraryKeys } from "./libraries";
import * as cheerio from "cheerio";

const CROSS_TRANSLUDE_SOURCE_RE =
  /template\(\s*['"]CrossTransclude\/Web['"]\s*,\s*\{[\s\S]*?['"]Library['"]\s*:\s*['"]([^'"]+)['"][\s\S]*?['"]PageID['"]\s*:\s*(\d+)/i;
// Matches rendered HTML form of content-reuse widget
const CONTENT_REUSE_WIDGET_RE =
  /<div[^>]+class=["'][^"']*mt-contentreuse-widget[^"']*["'][^>]+data-page=["'][^"']+["']/i;
// Matches raw wikitext form: wiki.page("...", NULL) stored inside <pre class="script">
const WIKI_PAGE_REUSE_RE = /wiki\.page\s*\(\s*["'&quot;]/i;
class RestackerService {
  private pageTags: Map<string, PageTag[]>;

  constructor() {
    this.pageTags = new Map<string, PageTag[]>();
  }

  ltRegex = new RegExp(`\\blt-(${libraryKeys})-\\d+\\b`, "g");
  async runRestacker(projectID: string, library: string, coverID: string) {
    const restacker = await Restacker.findOne({
      projectID: { $eq: projectID },
    });
    if (!restacker) {
      throw new Error("Restacker not found");
    }

    const pages = restacker.restackerCurrentBook;

    for (const page of pages) {
      console.log(`Processing page ${page.id}`);

      try {
        if (page.status === "pending") {
          const license = await this.getPagelicense(page.id, library, coverID);
          page.license = license;
          const contentLicense = await this.getContentLicense(
            page.id,
            library,
            coverID,
          );
          page.contentLicense = contentLicense.contentLicenses;
          page.quotation = contentLicense.quotationRate;
          page.sourceLicense = contentLicense.sourceLicense;
          page.status = "completed";
        }
      } catch (error) {
        page.status = "failed";
      }
      // const contentLicense = await this.getContentLicense(page.id, library, coverID);
      // page.contentLicense = contentLicense;
    }
    await Restacker.updateOne(
      { projectID: { $eq: projectID } },
      { $set: { restackerCurrentBook: pages } },
    );
  }

  async getRestackerStatus(projectID:string): Promise<RestackerStatus | "notfound"> {
    const restacker = await Restacker.findOne({ projectID:{$eq: projectID} });
    if (!restacker) {
      return "notfound";
    }
    if (restacker.restackerCurrentBook.some((page) => page.status === "pending")) return "pending";
    if (restacker.restackerCurrentBook.some((page) => page.status === "failed")) return "failed";
    return "completed";
  }



  private pageTagsKey(library: string, pageID: string): string {
    return `${library}:${pageID}`;
  }

  private async getCachedPageTags(
    library: string,
    pageID: string,
    bookID: string,
  ): Promise<PageTag[]> {
    const key = this.pageTagsKey(library, pageID);
    const cached = this.pageTags.get(key);
    if (cached) {
      return cached;
    }

    const bookService = new BookService({ bookID });
    const tags = await bookService.getPageTags(pageID);
    this.pageTags.set(key, tags);
    return tags;
  }

  private async getPagelicense(
    pageID: string,
    library: string,
    coverID: string,
    isContentLicense:boolean = false,
  ): Promise<{ label: string; raw: string; version: string } | undefined> {
    const page = await this.getCachedPageTags(
      library,
      pageID,
      `${library}-${coverID}`,
    );
    if (!page) {
      throw new Error("Page not found");
    }
    const licenseTag = page.find((tag) => tag["@value"].startsWith("license:"));
    const licenseVersionTag = page.find((tag) =>
      tag["@value"].startsWith("licenseversion:"),
    );
    if (!isContentLicense) {
      // Cache tags for later use (e.g. transclusion tagging) using the same key shape as getCachedPageTags().
      this.pageTags.set(this.pageTagsKey(library, pageID), page);
    }
    if (!licenseTag) {
      return undefined;
    }
    return {
      label: licenseTag["@value"],
      raw: licenseVersionTag?.["@value"] ?? "",
      version: licenseVersionTag?.["@value"] ?? "",
    };
  }

  private async isTranscluded(
    pageID: string,
    library: string,
  ): Promise<{isTranscluded: boolean, sourceLicense: { label: string; raw: string; version: string } | undefined}> {
    try {
      const bookService = new BookService({ bookID: `${library}-${pageID}` });
      const rawContents = await bookService.getPageRawContent(pageID);
      if (!rawContents) {
        return {isTranscluded: false, sourceLicense: undefined};
      }
      // The API returns a JSON envelope; extract the HTML body for all further matching
      let content = rawContents;
      try {
        const parsed = JSON.parse(rawContents);
        if (typeof parsed?.body === "string") content = parsed.body;
      } catch {}

      const isCrossTranscluded =
        CROSS_TRANSLUDE_SOURCE_RE.test(content);
      const isContentReused =
        CONTENT_REUSE_WIDGET_RE.test(content) ||
        WIKI_PAGE_REUSE_RE.test(content);

        if(isContentReused||isCrossTranscluded){
          const tags = this.pageTags.get(pageID);
          // check if transcluded tag is set
          const transcludedTag = tags?.find((tag) => tag["@value"].startsWith("transcluded:"));
          if(!transcludedTag){
          // if not add it to the page on cxone
            const existingTags = tags?.map((tag) => tag["@value"]) ?? [];
            const newTags = existingTags.includes("transcluded:yes")
              ? existingTags
              : existingTags.concat("transcluded:yes");
            await bookService.updatePageDetails(pageID, undefined, newTags);
          }
        }

      if (isContentReused) {
        // Extract source page path — try data-page attribute first (rendered HTML),
        // then fall back to wiki.page() argument (&quot; is the HTML-entity form of " in the body)
        const dataPageMatch = content.match(/data-page=["']([^"']+)["']/i);
        const wikiPageMatch = content.match(/wiki\.page\s*\(\s*(?:["']|&quot;)([^"'&]+)/i);
        const rawSourcePath = dataPageMatch?.[1] ?? wikiPageMatch?.[1];

        if (rawSourcePath) {
          const sourcePath = decodeURIComponent(rawSourcePath);
          const tags = await this.getCachedPageTags(
            library,
            sourcePath,
            `${library}-${pageID}`,
          );
          const licenseTag = tags?.find((tag) => tag["@value"].startsWith("license:"));
          const licenseVersionTag = tags?.find((tag) =>
            tag["@value"].startsWith("licenseversion:"),
          );
          if (licenseTag) {
            return {
              isTranscluded: true,
              sourceLicense: {
                label: licenseTag["@value"],
                raw: licenseVersionTag?.["@value"] ?? "",
                version: licenseVersionTag?.["@value"] ?? "",
              },
            };
          }
        }
      }
      if(isCrossTranscluded){
        
          // extract the library and pageID
          const crossLibrary = content.match(/Library':['"]([^'"]+)['"]/i)?.[1];
          const crossPageID = content.match(/PageID':(\d+)/i)?.[1];
          if (crossLibrary && crossPageID) {
            const tags = await this.getCachedPageTags(
              crossLibrary,
              crossPageID,
              `${crossLibrary}-${crossPageID}`,
            );
            const licenseTag = tags?.find((tag) => tag["@value"].startsWith("license:"));
            const licenseVersionTag = tags?.find((tag) =>
              tag["@value"].startsWith("licenseversion:"),
            );
            if(licenseTag ){
              return {isTranscluded: true, sourceLicense: {label: licenseTag["@value"], raw: licenseVersionTag?.["@value"] || "", version: licenseVersionTag?.["@value"] || ""}};
            }
          }
        }
   
      return {isTranscluded: isCrossTranscluded || isContentReused, sourceLicense: undefined};
    } catch (error) {
      return {isTranscluded: false, sourceLicense: undefined};
    }
  }

  private getQuotationRate(content: string): number {
    try {
      const $ = cheerio.load(content);
      const ltRegex = new RegExp(this.ltRegex.source, this.ltRegex.flags);

      const textTags = $("p, h1, h2, h3, h4, h5, h6");
      const total = textTags.length;
      if (total === 0) {
        return 0;
      }

      let quotedCount = 0;
      textTags.each((_, el) => {
        const classes = $(el).attr("class") ?? "";
        ltRegex.lastIndex = 0;
        if (ltRegex.test(classes)) {
          quotedCount++;
        }
      });

      return quotedCount / total;
    } catch (error) {
      return -1;
    }
  }

  private async getContentLicense(
    pageID: string,
    library: string,
    coverID: string,
  ): Promise<{
    contentLicenses:
      | { label: string; raw: string; version: string }[]
      | undefined;
    quotationRate: number;
    sourceLicense: { label: string; raw: string; version: string } | undefined;
  }> {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });
    const page = await bookService.getPageContent(pageID, "json");

    if (!page) {
      return { contentLicenses: undefined, quotationRate: -1, sourceLicense: undefined };
    }
 
    const $ = cheerio.load(page);
    const html = $.html();

    const ltRegex = new RegExp(this.ltRegex.source, this.ltRegex.flags);
    const uniqueClassnames = new Set(
      [...html.matchAll(ltRegex)].map((m) => m[0]),
    );

    const licenses: { label: string; raw: string; version: string }[] = [];

    for (const classname of uniqueClassnames) {
      const parts = classname.split("-");
      const refLibrary = parts[1];
      const refPageID = parts[2];
      const license = await this.getPagelicense(refPageID, refLibrary, coverID,true);
      if (license) {
        licenses.push(license);
      }
    }
    const transcludedInfo = await this.isTranscluded(pageID, library);
    const quotationRate = transcludedInfo.isTranscluded?1:this.getQuotationRate(page);

    const licenseMap = new Map<string, { label: string; raw: string; version: string }>();
    for (const license of licenses) {
      licenseMap.set(`${license.label}::${license.version}`, license);
    }
    const response = {
      contentLicenses: licenseMap.size > 0 ? Array.from(licenseMap.values()) : undefined,
      sourceLicense: transcludedInfo.sourceLicense,
      quotationRate,
    };
    return response;
  }
}

export default RestackerService;
