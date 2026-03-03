import * as crypto from "crypto";
import { generateBookPathAndURL } from "./librariesclient";
import conductorErrors from "../conductor-errors";

export interface MindTouchConfig {
  hostname: string;
  apiKey: string;
  apiSecret: string;
  user?: string;
  rootPath?: string;
}

export interface PublishOptions {
//   mindtouch: MindTouchConfig;
  auth?: { username: string; password: string };
}

export interface PublishResult {
    err: boolean;
    path: string;
    url: string;
    errMsg?: string;
}

export class PressBookScraper {
  private pbBookURL: string;
  private title?: string;
  private subdomain: string;
  private pbHeaders: Record<string, string>;

  constructor(
    pbBookURL: string,
    subdomain: string,
    title?: string,
  ) {
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

  async publishBook(options: PublishOptions) : Promise<PublishResult> {
    const encodePbURL = this.pbBookURL.replace(/\/+$/, "");
    const uploadImages = true;
    const auth = options.auth;
    const result: PublishResult = {
        err: false,
        path: "",
        url: "",
    };
    let metadata: any;
    try {
      metadata = await this.getJson(this.pbApi(encodePbURL) + "/metadata", auth);
    } catch {
      try {
        metadata = await this.getJson(encodePbURL + "/wp-json/", auth);
      } catch {
        metadata = {};
        throw new Error(conductorErrors.err8);
      }
    }
    console.log("[*] Fetching TOC...");
    let toc: any[];
    try {
      toc = await this.getJson(this.pbApi(encodePbURL) + "/toc", auth);
    } catch {
      toc = [];
      throw new Error(conductorErrors.err8);
    }

    const title =
    this.title ||
    metadata.name ||
    metadata.title?.rendered ||
    new URL(encodePbURL).pathname.replace(/^\/|\/$/g, "") ||
    "pressbooks_book";
    const [bookPath, bookURL] = generateBookPathAndURL(this.subdomain, title);
    console.log("[*] bookPath: ", bookPath);
    console.log("[*] bookURL: ", bookURL);
    result.path = bookPath;
    result.url = bookURL;
    console.log("[*] result info: ", result);
    return result;

  }
}
