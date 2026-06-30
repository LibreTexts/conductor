import BookService from "../api/services/book-service";
import Restacker from "../models/restacker";
import { libraryKeys } from "./libraries";
import * as cheerio from "cheerio";

const CROSS_TRANSLUDE_SOURCE_RE =
  /template\(\s*['"]CrossTransclude\/Web['"]\s*,\s*\{[\s\S]*?['"]Library['"]\s*:\s*['"]([^'"]+)['"][\s\S]*?['"]PageID['"]\s*:\s*(\d+)/i;
class RestackerService {
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
          const contentLicense = await this.getContentLicense(page.id, library, coverID);
          page.contentLicense = contentLicense.contentLicenses;
          page.quotation = contentLicense.quotationRate;

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

  private async getPagelicense(
    pageID: string,
    library: string,
    coverID: string,
  ): Promise<{ label: string; raw: string; version: string } | undefined> {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });
    const page = await bookService.getPageTags(pageID);
    if (!page) {
      throw new Error("Page not found");
    }
    const licenseTag = page.find((tag) => tag["@value"].startsWith("license:"));
    const licenseVersionTag = page.find((tag) =>
      tag["@value"].startsWith("licenseversion:"),
    );
    if (!licenseTag || !licenseVersionTag) {
      return undefined;
    }
    return {
      label: licenseTag["@value"],
      raw: licenseVersionTag["@value"],
      version: licenseVersionTag["@value"],
    };
  }

  private async isTranscluded(
    pageID: string,
    library: string,
  ): Promise<boolean> {
    try {
      const bookService = new BookService({ bookID: `${library}-${pageID}` });
      const rawContents = await bookService.getPageRawContent(pageID);
      if (!rawContents) {
        return false;
      }
      const match = rawContents.match(CROSS_TRANSLUDE_SOURCE_RE);
      if (!match) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getContentLicense(
    pageID: string,
    library: string,
    coverID: string,
  ): Promise<{ contentLicenses: { label: string; raw: string; version: string }[] | undefined, quotationRate: number }> {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });
    const page = await bookService.getPageContent(pageID, "json");

      if (!page) {
        return { contentLicenses: undefined, quotationRate: -1 };
      }
    if (pageID == "142945") {
      console.log(page);
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
      const license = await this.getPagelicense(refPageID, refLibrary, coverID);
      if (license) {
        licenses.push(license);
      }
    }
    const isTranscluded = await this.isTranscluded(pageID, library);
    const response = {
      contentLicenses: licenses.length > 0 ? licenses : undefined,
      quotationRate: isTranscluded ? 1 : 0,
    };
    return response;
  }
}

export default RestackerService;
