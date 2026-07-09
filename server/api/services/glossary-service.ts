import base62 from "base62-random";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import Glossary from "../../models/glossary";
import GlossaryUsage from "../../models/glossaryusage";
import { CXOneFetch } from "../../util/librariesclient";
import CXOnePageAPIEndpoints from "../../util/CXOne/CXOnePageAPIEndpoints";
import Project from "../../models/project";
import { escapeRegEx } from "../../util/helpers";

export interface AddGlossaryParams {
  glossaryID?: string;
  term: string;
  definition: string;
  pageId?: number;
  bookId?: string;
  library: string;
  aliases?: string[];
  author?: string;
  coverID: string;
  addedBy: string;
  imageFile?: Express.Multer.File;
  altText?: string;
  caption?: string;
  link?: string;
  source?: string;
  imageSource?: string;
  imageAuthor?: string;
  imageLicense?: string;
  removeImage?: boolean;
}

export interface GlossaryTableEntry {
  term: string;
  definition: string;
  image: string;
  caption: string;
  link: string;
  source: string;
}

export interface GlossaryPageResponse {
  term: string;
  definition: string;
  aliases?: string[];
  author?: string;
  link?: string;
  source?: string;
  pages: string[];
  imageUrl?: string;
  imageSource?: string;
  imageAuthor?: string;
  imageLicense?: string;
  altText?: string;
  caption?: string;
}
export interface GlossaryDetails {
  coverID: number;
  latestUpdatedAt: Date;
}

export interface GlossayResponse {
  coverID: number;
  glossaryID: string;
  library: string;
  items: GlossaryPageResponse[];
  lastUpdatedAt: Date;
}

export interface AddGlossaryUsageParams extends AddGlossaryParams {
  termID: string;
}

export interface GetGlossaryParams {
  coverID: string;
  library: string;
}

interface pageUsage {
  pageID: string;
  addedBy: string;
  createdAt: Date;
}

export interface GetGlossaryResponse {
  usageID: string;
  term: string;
  termID: string;
  definition: string;
  pages: pageUsage[];
  imageUrl?: string;
  aliases?: string[];
  author?: string;
  link?: string;
  source?: string;
  imageSource?: string;
  imageAuthor?: string;
  imageLicense?: string;
  altText?: string;
  caption?: string;
}

export interface DeleteGlossaryParams {
  coverID: string;
  library: string;
}

interface ProjectQuery {
  coverID: string;
  library: string;
}

export default class GlossaryService {
  async getProject(params: ProjectQuery): Promise<any> {
    try {
      const { coverID, library } = params;
      const project = await Project.findOne({
        libreCoverID: coverID,
        libreLibrary: library,
      });
      return project;
    } catch (error) {
      throw error;
    }
  }
  async getProjectByUsageID(usageID: string): Promise<any> {
    try {
      const glossary = await GlossaryUsage.findOne({
        usageID,
      });
      if (!glossary) {
        throw new Error("Glossary not found");
      }
      const project = await Project.findOne({
        libreCoverID: glossary.coverID.toString(),
        libreLibrary: glossary.library,
      });
      return project;
    } catch (error) {
      throw error;
    }
  }
  async getGlossary(params: GetGlossaryParams): Promise<GetGlossaryResponse[]> {
    try {
      const { coverID, library } = params;
      const glossary = await GlossaryUsage.find({
        coverID: parseInt(coverID),
        library,
      });
      return glossary.map(
        (c): GetGlossaryResponse => ({
          usageID: c.usageID,
          term: c.term,
          termID: c.termID,
          definition: c.definition,
          pages: c.pages,
          aliases: c.aliases?.map((a) => a.term) || [],
          author: c.author,
          link: c.link,
          source: c.source,
          imageSource: c.imageSource,
          imageAuthor: c.imageAuthor,
          imageLicense: c.imageLicense,
          altText: c.altText,
          caption: c.caption,
          imageUrl: c.imageFile
            ? `/api/v1/commons/glossary/usage/${c.usageID}/image`
            : undefined,
        }),
      );
    } catch (error) {
      throw error;
    }
  }

  async addExternalGlossaryToGlossaryUsage(
    glossaryID: string,
    coverID: string,
    library: string,
    addedBy: string,
  ): Promise<GlossaryTableEntry[]> {
    try {
      const pageContentsRes = await CXOneFetch({
        scope: "page",
        path: parseInt(glossaryID),
        api: CXOnePageAPIEndpoints.GET_Page_Contents("json"),
        subdomain: library,
      }).catch((err) => {
        console.error(err);
        throw new Error(`Error fetching page details: ${err}`);
      });
      if (!pageContentsRes.ok) {
        throw new Error(
          `Error fetching page details: ${pageContentsRes.statusText}`,
        );
      }

      const rawContent = await pageContentsRes.json();
      const html: string = rawContent.body?.[0]?.toString() ?? "";
      if (!html) {
        throw new Error("No page content found");
      }

      const $ = cheerio.load(html);

      const tables = $("table.mt-responsive-table");
      // The first table is the example/directions template; the data table is captioned "Glossary Entries"
      const targetTable =
        tables
          .filter(
            (_i, el) =>
              $(el).find("caption").text().trim() === "Glossary Entries",
          )
          .first() || (tables.length >= 2 ? tables.eq(1) : tables.eq(0));

      const entries: GlossaryTableEntry[] = [];

      targetTable.find("tbody tr").each((_i, row) => {
        const cells = $(row).find("td");

        const getText = (index: number) =>
          $(cells[index])
            .text()
            .replace(/\u00a0/g, "")
            .trim();

        entries.push({
          term: getText(0),
          definition: getText(1),
          image: getText(2),
          caption: getText(3),
          link: getText(4),
          source: getText(5),
        });
      });
      await Promise.all(
        entries
          .filter((e) => e.term && e.definition)
          .map(async (entry) => {
            const { termID } = await this._addGlossaryToDatabase(
              entry.term,
              entry.definition,
            );
            await this._addGlossaryUsageToDatabase({
              termID,
              term: entry.term,
              definition: entry.definition,
              coverID,
              library,
              addedBy,
              glossaryID,
              caption: entry.caption || undefined,
              link: entry.link || undefined,
              source: entry.source || undefined,
            });
          }),
      );

      return entries;
    } catch (error) {
      throw error;
    }
  }

  async addGlossary(params: AddGlossaryParams): Promise<string> {
    try {
      const { term, definition } = params;
      const { termID } = await this._addGlossaryToDatabase(term, definition);

      const usageID = await this._addGlossaryUsageToDatabase({
        termID,
        ...params,
      });
      return usageID;
    } catch (error) {
      throw error;
    }
  }

  async updateGlossaryUsage(
    usageID: string,
    params: AddGlossaryParams,
  ): Promise<void> {
    try {
      const {
        imageFile,
        removeImage,
        aliases: aliasesArray,
        altText,
        caption,
        link,
        source,
        imageSource,
        imageAuthor,
        imageLicense,
        author,
        bookId,
        coverID,
        library,
        ...rest
      } = params;
      const aliases = [] as { termID: string; term: string }[];
      if (aliasesArray && aliasesArray.length > 0) {
        // add aliases to glossary and make a list of [{termID, term}] using _addGlossaryToDatabase
        for (const alias of aliasesArray) {
          if (alias.trim() === "") {
            continue;
          }
          const { termID } = await this._addGlossaryToDatabase(
            alias.trim(),
            "",
          );
          aliases.push({ termID, term: alias.trim() });
        }
      }

      const optionalFields: Record<string, string | undefined> = {
        altText,
        caption,
        link,
        source,
        imageSource,
        imageAuthor,
        imageLicense,
        author,
        bookID: bookId,
      };
      const toUnset: Record<string, ""> = {};
      for (const [key, value] of Object.entries(optionalFields)) {
        if (value === undefined) {
          toUnset[key] = "";
        }
      }
      if (removeImage) {
        toUnset.imageFile = "";
      }

      const result = await GlossaryUsage.updateOne(
        { usageID: String(usageID), coverID: parseInt(coverID), library },
        {
          $set: {
            ...rest,
            ...Object.fromEntries(
              Object.entries(optionalFields).filter(([, v]) => v !== undefined),
            ),
            aliases: aliases,
            updatedAt: new Date(),
            ...(imageFile && !removeImage && {
              imageFile: {
                data: imageFile.buffer,
                contentType: imageFile.mimetype,
                originalname: imageFile.originalname,
              },
            }),
          },
          ...(Object.keys(toUnset).length > 0 && { $unset: toUnset }),
        },
      );

      if (result.matchedCount === 0) {
        throw new Error("Glossary usage not found for usageID: " + usageID);
      }
    } catch (error) {
      throw error;
    }
  }

  async deleteBookGlossary(params: DeleteGlossaryParams): Promise<void> {
    try {
      const { coverID, library } = params;
      await GlossaryUsage.deleteOne({
        coverID: parseInt(coverID),
        library,
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteGlossaryUsage(usageID: string, pageID?: string): Promise<void> {
    try {
      if (pageID) {
        const glossaryusage = await GlossaryUsage.findOne({
          usageID,
        });
        if (glossaryusage) {
          glossaryusage.pages = glossaryusage.pages.filter(
            (page) => page.pageID !== pageID,
          );
          await glossaryusage.save();
        }
      } else {
        await GlossaryUsage.deleteOne({
          usageID,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async addPageToGlossaryUsage(
    pageIds: number[],
    usageIds: string[],
    coverID: string,
    library: string,
  ): Promise<void> {
    try {
      const glossaryUsage = await GlossaryUsage.find({
        usageID: { $in: usageIds },
        coverID: parseInt(coverID),
        library,
      });
      if (!glossaryUsage.length) {
        throw new Error("Glossary usage not found");
      }
      const pageIdStrings = pageIds.map((id) => id.toString());
      await Promise.all(
        glossaryUsage.map((usage) => {
          const existingPageIds = new Set(usage.pages.map((p) => p.pageID));
          const newPages = pageIdStrings
            .filter((pageId) => !existingPageIds.has(pageId))
            .map((pageId) => ({
              pageID: pageId,
              addedBy: "system",
              createdAt: new Date(),
            }));
          usage.pages = usage.pages.concat(newPages);
          usage.updatedAt = new Date();
          return usage.save();
        }),
      );
    } catch (error) {
      throw error;
    }
  }

  async getGlossaryPage(
    pageID: number,
    library: string,
  ): Promise<GlossayResponse> {
    try {
      const {
        coverID,
        glossaryID,
        library: glossaryLibrary,
      } = await this.getCoverIDByPageID(pageID, library);

      if (!coverID) {
        throw new Error("No glossary found");
      }

      const glossary = await GlossaryUsage.find({ coverID, library });
      const response: GlossayResponse = {
        coverID,
        glossaryID,
        library: glossaryLibrary,
        items: [],
        lastUpdatedAt:
          glossary.length > 0
            ? glossary.reduce(
                (max, g) => (g.updatedAt > max ? g.updatedAt : max),
                glossary[0].updatedAt,
              )
            : new Date(),
      };
      if (glossary.length > 0) {
        const items: GlossaryPageResponse[] = glossary.map(
          (c): GlossaryPageResponse => ({
            term: c.term,
            definition: c.definition,
            aliases: c.aliases?.map((a) => a.term),
            author: c.author,
            link: c.link,
            source: c.source,
            pages: c.pages.map((p: pageUsage) => p.pageID),
            imageUrl: c.imageFile
              ? `/api/v1/commons/glossary/usage/${c.usageID}/image`
              : undefined,
            altText: c.altText,
            caption: c.caption,
            imageSource: c.imageSource,
            imageAuthor: c.imageAuthor,
            imageLicense: c.imageLicense,
          }),
        );
        if (items.length === 0) {
          throw new Error("No glossary found");
        }
        response.items = items;
        return response;
      } else {
        throw new Error("No glossary found");
      }
    } catch (error) {
      throw error;
    }
  }

  async getGlossaryDetails(
    pageID: number,
    library: string,
  ): Promise<GlossaryDetails> {
    const pipeline = [
      {
        $match: {
          library: library,
          $or: [
            {
              "pages.pageID": pageID.toString(),
            },
            {
              glossaryID: pageID.toString(),
            },
            {
              coverID: pageID,
            },
          ],
        },
      },
      {
        $group: {
          _id: "$coverID",
          latestUpdatedAt: {
            $max: "$updatedAt",
          },
        },
      },
    ];

    const [result] = await GlossaryUsage.aggregate<{
      _id: number;
      latestUpdatedAt: Date;
    }>(pipeline).exec();
    if (!result) {
      throw new Error("No glossary found");
    }
    return { coverID: result._id, latestUpdatedAt: result.latestUpdatedAt };
  }

  private async getCoverIDByPageID(
    pageID: number,
    library: string,
  ): Promise<{
    coverID: number;
    glossaryID: string;
    library: string;
  }> {
    try {
      const pageIDStr = pageID.toString();
      const glossary = await GlossaryUsage.findOne(
        {
          library,
          $or: [{ "pages.pageID": pageIDStr }, { glossaryID: pageIDStr }],
        },
        { coverID: 1, glossaryID: 1, library: 1, _id: 0 },
      );
      if (!glossary) {
        throw new Error("No glossary found");
      }
      return {
        coverID: glossary.coverID,
        glossaryID: glossary.glossaryID || "",
        library: glossary.library || "",
      };
    } catch (error) {
      throw error;
    }
  }

  async getGlossaryUsageImage(
    usageID: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    try {
      const glossaryUsage = await GlossaryUsage.findOne({ usageID });
      if (!glossaryUsage?.imageFile) {
        throw new Error("No image found");
      }
      return {
        data: glossaryUsage.imageFile.data,
        contentType: glossaryUsage.imageFile.contentType,
      };
    } catch (error) {
      throw error;
    }
  }
  private _generateSlug(term: string): string {
    return term.toLowerCase().replace(/ /g, "-");
  }

  private async _addGlossaryToDatabase(
    term: string,
    definition: string,
  ): Promise<{ termID: string }> {
    try {
      // if term already exists, return the termID
      const existingGlossary = await Glossary.findOne({
        term: {
          $regex: `^${escapeRegEx(term)}$`,
          $options: "i",
        },
      });
      if (existingGlossary) {
        return { termID: existingGlossary.termID };
      }
      // generate a new termID
      const termID = base62(10);
      // generate a new slug
      const slug = this._generateSlug(term);
      const glossary = await Glossary.create({
        term,
        slug,
        termID,
        definition,
      });
      return { termID: glossary.termID };
    } catch (error) {
      throw error;
    }
  }

  private async _addGlossaryUsageToDatabase(
    params: AddGlossaryUsageParams,
  ): Promise<string> {
    /**
     * conditions: termId+coverID+library is unique
     * if not unique, return the usageID check in pages array if the pageID is already in the pages array update definition and addedBy
     * if not in pages array, add the pageID to the pages array
     * if not unique, not return usageID and add the pageID to the pages array create a new usage record
     * return the usageID
     */
    try {
      const existingGlossaryUsage = await GlossaryUsage.findOne({
        termID: params.termID,
        coverID: parseInt(params.coverID),
        library: params.library,
      });
      var aliases = [] as { termID: string; term: string }[];

      if (params?.aliases && params.aliases.length > 0) {
        // add aliases to glossary and make a list of [{termID, term}] using _addGlossaryToDatabase
        for (const alias of params.aliases) {
          if (alias.trim() === "") {
            continue;
          }
          const { termID } = await this._addGlossaryToDatabase(
            alias.trim(),
            "",
          );
          aliases.push({ termID, term: alias.trim() });
        }
      }
      if (existingGlossaryUsage) {
        const pageID = params.pageId?.toString();
        if (params.imageFile) {
          existingGlossaryUsage.imageFile = {
            data: params.imageFile.buffer,
            contentType: params.imageFile.mimetype,
            originalname: params.imageFile.originalname,
          };
        }
        if (pageID) {
          const pageIndex = existingGlossaryUsage.pages.findIndex(
            (page) => page.pageID === pageID,
          );
          if (pageIndex !== -1) {
            existingGlossaryUsage.pages[pageIndex].addedBy = params.addedBy;
          } else {
            existingGlossaryUsage.pages.push({
              pageID,
              addedBy: params.addedBy,
              createdAt: new Date(),
            });
          }
          existingGlossaryUsage.updatedAt = new Date();
          await existingGlossaryUsage.save();
          return existingGlossaryUsage.usageID;
        } else {
          existingGlossaryUsage.definition = params.definition;
          existingGlossaryUsage.updatedAt = new Date();
          await existingGlossaryUsage.save();
          return existingGlossaryUsage.usageID;
        }
      }
      const usageID = base62(10);
      const glossaryUsage = await GlossaryUsage.create({
        usageID,
        term: params.term,
        definition: params.definition,
        termID: params.termID,
        bookID: params.bookId,
        updatedAt: new Date(),
        coverID: parseInt(params.coverID),
        library: params.library,
        glossaryID: params.glossaryID,
        pages: params.pageId
          ? [
              {
                pageID: params.pageId.toString(),
                addedBy: params.addedBy,
                createdAt: new Date(),
              },
            ]
          : [],
        imageFile: params.imageFile
          ? {
              data: params.imageFile.buffer,
              contentType: params.imageFile.mimetype,
              originalname: params.imageFile.originalname,
            }
          : undefined,
        altText: params.altText,
        caption: params.caption,
        link: params.link,
        source: params.source,
        imageSource: params.imageSource,
        imageAuthor: params.imageAuthor,
        imageLicense: params.imageLicense,
        aliases: aliases,
        author: params.author,
      });
      return glossaryUsage.usageID;
    } catch (error) {
      throw error;
    }
  }
}
