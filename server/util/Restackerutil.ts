import BookService from "../api/services/book-service";
import Restacker from "../models/restacker";

class RestackerService {
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
          page.contentLicense = await this.getContentLicense(page.id, library, coverID);
          page.status = "completed";
        }
      } catch (error) {
        page.status = "failed";
      }
      // const contentLicense = await this.getContentLicense(page.id, library, coverID);
      // page.contentLicense = contentLicense;
    }
    restacker.restackerCurrentBook = pages;
    restacker.markModified("restackerCurrentBook");
    await restacker.save();
  }

  private async getPagelicense(
    pageID: string,
    library: string,
    coverID: string,
  ) {
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

  private async getContentLicense(
    pageID: string,
    library: string,
    coverID: string,
  ) {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });
    const page = await bookService.getPageContent(pageID, "json");
    if (!page) {
      return undefined;
    }
    console.log(page);
    return undefined;
  }
}

export default RestackerService;
