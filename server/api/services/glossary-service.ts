import base62 from "base62-random";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import Glossary from "../../models/glossary";
import GlossaryUsage, {
  GlossaryUsageInterface,
} from "../../models/glossaryusage";
import GlossaryConfig, {
  GlossaryConfigInterface,
  GlossaryConfigMode,
  GlossaryConfigGroup,
} from "../../models/glossaryconfig";
import { CXOneFetch } from "../../util/librariesclient";
import CXOnePageAPIEndpoints from "../../util/CXOne/CXOnePageAPIEndpoints";
import Project from "../../models/project";
import { escapeRegEx } from "../../util/helpers";
import {
  sanitizeLibraryText,
  sanitizeOptionalLibraryText,
} from "../../util/sanitize-text.js";
import BookService from "./book-service";
import { childLogger } from "../../logger.js";
import { TableOfContents } from "../../types";

const glossaryLog = childLogger("glossary");

/**
 * Sort key for a glossary term that ignores punctuation/symbols (quotes,
 * commas, hyphens, etc.) and a leading English direct/indirect article
 * ("the", "a", "an") — e.g. `"The Apple,"` sorts under "A", not `"` or "T".
 * Letters/marks outside a-z (accented characters, etc.) are left intact —
 * only punctuation and symbol characters are stripped.
 */
function alphabetizationKey(term: string): string {
  const normalized = term
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.replace(/^(the|an?)\s+/, "");
}

/**
 * True for a MongoDB/Mongoose duplicate-key error (E11000) — the signal that
 * a unique-index write lost a create-vs-create race, as opposed to any other
 * failure. Used to recover from the term/usage races described on
 * `_addGlossaryToDatabase` and `_addGlossaryUsageToDatabase`.
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Depth-first collection of a TOC node's id plus every descendant's id.
 * Mirrors the client's identically-named helper in glossaryConfigDefaults.ts.
 */
function collectSubtreeIds(node: TableOfContents): string[] {
  const ids: string[] = [node.id];
  for (const child of node.children) {
    ids.push(...collectSubtreeIds(child));
  }
  return ids;
}

/**
 * Finds the book's auto-generated back-matter "Glossary" page, if it has
 * one yet. Mirrors the client-side lookup used to seed the Glossary config
 * screen (client/src/screens/commons/Glossary/index.tsx). Exported so the
 * `BackfillGlossaryConfigPageId` migration can recompute it for existing
 * GlossaryConfig documents without duplicating this logic.
 */
export function findBackmatterGlossaryPageId(
  toc: TableOfContents,
): string | undefined {
  if (
    toc.title === "Glossary" &&
    toc.url.endsWith("zz%3A_Back_Matter/20%3A_Glossary")
  ) {
    return toc.id;
  }
  for (const child of toc.children) {
    const found = findBackmatterGlossaryPageId(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * Signals that a page simply has no glossary. This is the common case for most
 * library pages, not a failure — handlers map it to 404 so healthy traffic
 * does not register as a 5xx.
 */
export class GlossaryNotFoundError extends Error {
  constructor(message = "No glossary found") {
    super(message);
    this.name = "GlossaryNotFoundError";
  }
}

/**
 * Signals a semantically-invalid GlossaryConfig payload (e.g. a duplicate
 * groupID, or a page assigned to more than one group) that passed Zod's
 * shape check but violates a cross-field rule — handlers map it to 400.
 */
export class GlossaryConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlossaryConfigValidationError";
  }
}

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
  /** Render the term itself in italics (e.g. species names, foreign words). */
  italic?: boolean;
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
  italic?: boolean;
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
  mode: GlossaryConfigMode;
  groups: GlossaryConfigGroup[];
  showTermOnly: boolean;
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
  italic?: boolean;
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
        libreLibrary: { $eq: glossary.library },
      });
      return project;
    } catch (error) {
      throw error;
    }
  }
  async getGlossary(params: GetGlossaryParams): Promise<GetGlossaryResponse[]> {
    try {
      const { coverID, library } = params;
      const glossaryUnsorted = await GlossaryUsage.find({
        coverID: parseInt(coverID),
        library,
      });
      // Mongo has no query-level sort here (see getGlossaryPage for why) —
      // apply the same punctuation/article-aware ordering as the reader-facing
      // list, so the management table isn't stuck in raw insertion order.
      const glossary = [...glossaryUnsorted].sort((a, b) =>
        alphabetizationKey(a.term).localeCompare(alphabetizationKey(b.term)),
      );
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
          italic: c.italic,
          imageUrl: c.imageFile
            ? `/api/v1/commons/glossary/usage/${c.usageID}/image`
            : undefined,
        }),
      );
    } catch (error) {
      throw error;
    }
  }

  async _extractTermsFromCxOneGlossary(
    pageID: number,
    library: string,
  ): Promise<GlossaryTableEntry[]> {
    try {
      const pageContentsRes = await CXOneFetch({
        scope: "page",
        path: pageID,
        api: CXOnePageAPIEndpoints.GET_Page_Contents("json"),
        subdomain: library,
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

      const expectedDataThs = [
        "Word(s)",
        "Definition",
        "Image",
        "Caption",
        "Link",
        "Source",
      ];
      const isGlossaryRow = ($row: ReturnType<typeof $>) => {
        const cells = $row.find("td");
        if (cells.length < expectedDataThs.length) return false;
        return expectedDataThs.every(
          (th, i) => $(cells[i]).attr("data-th") === th,
        );
      };

      // Prefer tbody#glossaryTable (class on <table> is optional), then caption, then first-row shape
      let targetTable = $("tbody#glossaryTable").closest("table");
      if (!targetTable.length) {
        targetTable = $("table")
          .filter(
            (_i, el) =>
              $(el).find("caption").first().text().trim() ===
              "Glossary Entries",
          )
          .first();
      }
      if (!targetTable.length) {
        targetTable = $("table")
          .filter((_i, el) => {
            const firstRow = $(el).find("tbody tr").first();
            return isGlossaryRow(firstRow);
          })
          .first();
      }

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
      return entries;
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
      const entries = await this._extractTermsFromCxOneGlossary(
        parseInt(glossaryID),
        library,
      );

      // Sequential, not Promise.all: concurrent entries for the same term
      // (a real possibility in an imported table) would race the
      // check-then-create in _addGlossaryToDatabase/_addGlossaryUsageToDatabase.
      for (const entry of entries) {
        if (!entry.term || !entry.definition) continue;
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
      }

      return entries;
    } catch (error) {
      throw error;
    }
  }

  async addExternalAuxGlossaryToGlossaryUsage(
    glossaryID: string,
    coverID: string,
    library: string,
    addedBy: string,
    auxGlossaryID: string,
    auxGlossaryParentID?: string,
  ): Promise<GlossaryTableEntry[]> {
    try {
      const entries = await this._extractTermsFromCxOneGlossary(
        parseInt(auxGlossaryID),
        library,
      );
      // Sequential, not Promise.all — see addExternalGlossaryToGlossaryUsage.
      for (const entry of entries) {
        if (!entry.term || !entry.definition) continue;
        const { termID } = await this._addGlossaryToDatabase(
          entry.term,
          entry.definition,
        );
        const usageID = await this._addGlossaryUsageToDatabase({
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
        if (auxGlossaryID || auxGlossaryParentID) {
          const pages = [];
          if (auxGlossaryID) {
            pages.push(parseInt(auxGlossaryID));
          }
          if (auxGlossaryParentID) {
            pages.push(parseInt(auxGlossaryParentID));
          }
          // ADD PAGE TO USAGE
          await this.addPageToGlossaryUsage(pages, [usageID], coverID, library);
        }
      }
      return entries;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Given a list of candidate terms, returns the subset (case-insensitive,
   * original CSV casing preserved) that already exist as GlossaryUsage
   * entries for the given book, so callers can warn before overwriting them.
   */
  async findExistingUsageTerms(
    terms: string[],
    coverID: string,
    library: string,
  ): Promise<string[]> {
    if (terms.length === 0) return [];
    const existing = await GlossaryUsage.find({
      coverID: parseInt(coverID),
      library,
      term: {
        $in: terms.map((t) => new RegExp(`^${escapeRegEx(t)}$`, "i")),
      },
    })
      .select("term")
      .lean();
    const existingLower = new Set(existing.map((e) => e.term.toLowerCase()));
    return terms.filter((t) => existingLower.has(t.toLowerCase()));
  }

  /**
   * Bulk-import glossary term/definition pairs (e.g. from a Pressbooks
   * `/glossary` REST response, or an uploaded CSV) into Glossary +
   * GlossaryUsage for a book. Skips entries missing a term or definition.
   * Non-unique term+cover+library rows are upserted via
   * `_addGlossaryUsageToDatabase`.
   *
   * Entries within a batch are processed sequentially, not concurrently —
   * two entries for the same term (a duplicate row, or the same term
   * differing only by case) would otherwise race the check-then-create in
   * `_addGlossaryToDatabase`/`_addGlossaryUsageToDatabase` and could produce
   * two GlossaryUsage records for one term. `onProgress` (if given) is still
   * called after each batch of `BATCH_SIZE` so a long-running import can
   * report how far along it is.
   */
  async addGlossaryEntries(
    entries: {
      term: string;
      definition: string;
      author?: string;
      source?: string;
      link?: string;
    }[],
    coverID: string,
    library: string,
    addedBy: string,
    glossaryID?: string,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<number> {
    const valid = entries.filter(
      (e) => e.term?.trim() && e.definition?.trim(),
    );
    if (valid.length > 0) {
      await this.ensureDefaultGlossaryConfig(coverID, library);
    }
    const BATCH_SIZE = 20;
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE);
      for (const entry of batch) {
        const term = entry.term.trim();
        const definition = entry.definition.trim();
        const { termID } = await this._addGlossaryToDatabase(
          term,
          definition,
        );
        await this._addGlossaryUsageToDatabase({
          termID,
          term,
          definition,
          coverID,
          library,
          addedBy,
          glossaryID,
          author: entry.author,
          source: entry.source,
          link: entry.link,
        });
      }
      onProgress?.(Math.min(i + BATCH_SIZE, valid.length), valid.length);
    }
    return valid.length;
  }

  async addGlossary(params: AddGlossaryParams): Promise<string> {
    try {
      const { term, definition } = params;
      const { termID } = await this._addGlossaryToDatabase(term, definition);

      const usageID = await this._addGlossaryUsageToDatabase({
        termID,
        ...params,
      });
      await this.ensureDefaultGlossaryConfig(params.coverID, params.library);
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
        term,
        definition,
        ...rest
      } = params;
      const aliases = [] as { termID: string; term: string }[];
      if (aliasesArray && aliasesArray.length > 0) {
        // add aliases to glossary and make a list of [{termID, term}] using _addGlossaryToDatabase
        for (const alias of aliasesArray) {
          const cleanAlias = sanitizeLibraryText(alias);
          if (cleanAlias === "") {
            continue;
          }
          const { termID } = await this._addGlossaryToDatabase(
            cleanAlias,
            "",
          );
          aliases.push({ termID, term: cleanAlias });
        }
      }

      // Terms/definitions here can originate from a CSV upload, a Pressbooks
      // or CXOne import, or the manual add/edit form — see the sanitization
      // note on `_addGlossaryToDatabase`. This is the one write path that
      // does not funnel through those private helpers, so it sanitizes here.
      const optionalFields: Record<string, string | undefined> = {
        altText: sanitizeOptionalLibraryText(altText),
        caption: sanitizeOptionalLibraryText(caption),
        link: sanitizeOptionalLibraryText(link),
        source: sanitizeOptionalLibraryText(source),
        imageSource: sanitizeOptionalLibraryText(imageSource),
        imageAuthor: sanitizeOptionalLibraryText(imageAuthor),
        imageLicense: sanitizeOptionalLibraryText(imageLicense),
        author: sanitizeOptionalLibraryText(author),
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
            term: sanitizeLibraryText(term),
            definition: sanitizeLibraryText(definition),
            ...Object.fromEntries(
              Object.entries(optionalFields).filter(([, v]) => v !== undefined),
            ),
            aliases: aliases,
            updatedAt: new Date(),
            ...(imageFile &&
              !removeImage && {
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

  /** Deletes multiple GlossaryUsage records at once, scoped to a single book. */
  async bulkDeleteGlossaryUsage(
    usageIDs: string[],
    coverID: string,
    library: string,
  ): Promise<number> {
    const result = await GlossaryUsage.deleteMany({
      usageID: { $in: usageIDs },
      coverID: parseInt(coverID),
      library,
    });
    return result.deletedCount ?? 0;
  }

  /**
   * Applies the given attribution fields to multiple GlossaryUsage records
   * at once, scoped to a single book. Fields left undefined are not touched,
   * so callers only need to pass the fields they want to overwrite.
   */
  async bulkUpdateAttribution(
    usageIDs: string[],
    coverID: string,
    library: string,
    attribution: { author?: string; link?: string; source?: string },
  ): Promise<number> {
    const setFields: Record<string, string> = {};
    if (attribution.author !== undefined) {
      setFields.author = sanitizeLibraryText(attribution.author);
    }
    if (attribution.link !== undefined) {
      setFields.link = sanitizeLibraryText(attribution.link);
    }
    if (attribution.source !== undefined) {
      setFields.source = sanitizeLibraryText(attribution.source);
    }
    if (Object.keys(setFields).length === 0) return 0;

    const result = await GlossaryUsage.updateMany(
      {
        usageID: { $in: usageIDs },
        coverID: parseInt(coverID),
        library,
      },
      { $set: { ...setFields, updatedAt: new Date() } },
    );
    return result.modifiedCount;
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
  

  /**
   * Copies every GlossaryUsage attached to `sourcePageID` in `sourceLibrary`
   * onto `targetPageID` in the target book. Reuses the existing term/usage
   * upsert helpers, so a term already present in the target book just gains
   * the new page instead of duplicating the usage record. Used by the
   * Remixer publish flow to carry glossary terms over from imported pages
   * when the user opts in; callers should treat this as best-effort.
   */
  async copyPageGlossaryUsages(params: {
    sourcePageID: string;
    sourceLibrary: string;
    targetPageID: string;
    targetCoverID: string;
    targetLibrary: string;
    addedBy: string;
  }): Promise<number> {
    const {
      sourcePageID,
      sourceLibrary,
      targetPageID,
      targetCoverID,
      targetLibrary,
      addedBy,
    } = params;

    const sourceUsages = await GlossaryUsage.find({
      library: sourceLibrary,
      "pages.pageID": sourcePageID,
    });
    if (sourceUsages.length === 0) return 0;

    for (const usage of sourceUsages) {
      const { termID } = await this._addGlossaryToDatabase(
        usage.term,
        usage.definition,
      );
      await this._addGlossaryUsageToDatabase({
        termID,
        term: usage.term,
        definition: usage.definition,
        coverID: targetCoverID,
        library: targetLibrary,
        addedBy,
        pageId: parseInt(targetPageID, 10),
        aliases: usage.aliases?.map((a) => a.term),
        author: usage.author,
        link: usage.link,
        source: usage.source,
        imageSource: usage.imageSource,
        imageAuthor: usage.imageAuthor,
        imageLicense: usage.imageLicense,
        altText: usage.altText,
        caption: usage.caption,
        imageFile: usage.imageFile
          ? ({
              buffer: usage.imageFile.data,
              mimetype: usage.imageFile.contentType,
              originalname: usage.imageFile.originalname,
            } as Express.Multer.File)
          : undefined,
      });
    }

    await this.ensureDefaultGlossaryConfig(targetCoverID, targetLibrary);
    return sourceUsages.length;
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
        throw new GlossaryNotFoundError();
      }
      const candidateCoverIDs = await this.getCandidateCoverIDs(pageID, library);

      const [glossaryUnsorted, config] = await Promise.all([
        GlossaryUsage.find({ coverID: { $in: candidateCoverIDs }, library }),
        this.getGlossaryConfig(String(coverID), glossaryLibrary),
      ]);
      // Mongo can only sort on the raw `term` field, which would alphabetize
      // "The Apple" under "T" — sort here instead, ignoring a leading article.
      const glossary = [...glossaryUnsorted].sort((a, b) =>
        alphabetizationKey(a.term).localeCompare(alphabetizationKey(b.term)),
      );
      const response: GlossayResponse = {
        coverID,
        // `glossaryID` here is the book's back-matter Glossary page id.
        // GlossaryConfig.glossaryPageId is the authoritative source (kept up
        // to date by the Configure Glossary screen); the id derived from a
        // GlossaryUsage record is only a fallback for books that predate
        // GlossaryConfig or whose config is missing it — most usages never
        // have their own `glossaryID` populated (it's only set by the CXOne/
        // CSV import flows), so relying on it alone left this blank.
        glossaryID: config?.glossaryPageId || glossaryID,
        library: glossaryLibrary,
        items: [],
        lastUpdatedAt:
          glossary.length > 0
            ? glossary.reduce(
                (max, g) => (g.updatedAt > max ? g.updatedAt : max),
                glossary[0].updatedAt,
              )
            : new Date(),
        mode: config?.mode ?? "PAGE",
        groups: config?.groups ?? [],
        showTermOnly: config?.showTermOnly ?? false,
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
            italic: c.italic,
          }),
        );
        if (items.length === 0) {
          throw new GlossaryNotFoundError();
        }
        response.items = items;
        return response;
      } else {
        throw new GlossaryNotFoundError();
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetches the page from MindTouch and returns numeric IDs for the page itself
   * and every ancestor in the `parent` chain. Falls back to `[pageID]` on error.
   * Used by both getGlossaryPage and getGlossaryDetails to widen their DB match.
   */
  private async getCandidateCoverIDs(
    pageID: number,
    library: string,
  ): Promise<number[]> {
    try {
      const res = await CXOneFetch({
        scope: "page",
        path: pageID,
        api: CXOnePageAPIEndpoints.GET_Page,
        subdomain: library,
      });
      if (!res.ok) return [pageID];
      const info = await res.json();
      const ids: number[] = [];
      const selfId = parseInt(info?.["@id"], 10);
      if (!Number.isNaN(selfId)) ids.push(selfId);
      let cursor = info?.["page.parent"];
      while (cursor) {
        const pid = parseInt(cursor["@id"], 10);
        if (!Number.isNaN(pid)) ids.push(pid);
        cursor = cursor?.["page.parent"];
      }
      return ids.length > 0 ? ids : [pageID];
    } catch {
      return [pageID];
    }
  }

  async getGlossaryDetails(
    pageID: number,
    library: string,
  ): Promise<GlossaryDetails> {
    const candidateIds = await this.getCandidateCoverIDs(pageID, library);
    const candidateStrs = candidateIds.map(String);

    const pipeline = [
      {
        $match: {
          library,
          $or: [
            { "pages.pageID": { $in: candidateStrs } },
            { glossaryID: { $in: candidateStrs } },
            { coverID: { $in: candidateIds } },
          ],
        },
      },
      {
        $group: {
          _id: "$coverID",
          latestUpdatedAt: { $max: "$updatedAt" },
        },
      },
    ];

    const [[result], config] = await Promise.all([
      GlossaryUsage.aggregate<{
        _id: number;
        latestUpdatedAt: Date;
      }>(pipeline).exec(),
      GlossaryConfig.findOne({ coverID: { $in: candidateIds }, library }),
    ]);
    if (!result) {
      throw new GlossaryNotFoundError();
    }

    const latestUpdatedAt =
      config && config.updatedAt > result.latestUpdatedAt
        ? config.updatedAt
        : result.latestUpdatedAt;

    return { coverID: result._id, latestUpdatedAt };
  }

  private async getCoverIDByPageID(
    pageID: number,
    library: string,
  ): Promise<{
    coverID: number;
    glossaryID: string;
    library: string;
  }> {
    const candidateIds = await this.getCandidateCoverIDs(pageID, library);
    const candidateStrs = candidateIds.map(String);

    const glossary = await GlossaryUsage.findOne(
      {
        library,
        $or: [
          { "pages.pageID": { $in: candidateStrs } },
          { glossaryID: { $in: candidateStrs } },
          { coverID: { $in: candidateIds } },
        ],
      },
      { coverID: 1, glossaryID: 1, library: 1, _id: 0 },
    );
    if (!glossary) {
      throw new GlossaryNotFoundError();
    }
    return {
      coverID: glossary.coverID,
      glossaryID: glossary.glossaryID || "",
      library: glossary.library || "",
    };
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

  /**
   * Terms/definitions here can originate from a CSV upload, a Pressbooks or
   * CXOne import, or the manual add/edit form — none of it is trustworthy,
   * and the Commons glossary renders term/definition through `innerHTML`
   * (see GlossaryDefinitionPreview), so a stored value must be safe in that
   * sink. Sanitizing at this single write path covers every caller.
   */
  private async _addGlossaryToDatabase(
    term: string,
    definition: string,
  ): Promise<{ termID: string }> {
    const cleanTerm = sanitizeLibraryText(term);
    const cleanDefinition = sanitizeLibraryText(definition);
    const termID = base62(10);
    const slug = this._generateSlug(cleanTerm);
    // Matches the unique index's collation (glossary.ts) so this query and
    // that index treat casing the same way.
    const collation = { locale: "en", strength: 2 } as const;

    try {
      // Atomic get-or-create: two concurrent calls for the same brand-new
      // term both used to see "nothing yet" from a plain findOne and both
      // create() a row — same term text, two different termIDs, and
      // downstream two separate GlossaryUsage entries for one term. The
      // unique index makes the loser's insert fail instead; recovered below.
      const glossary = await Glossary.findOneAndUpdate(
        { term: cleanTerm },
        {
          $setOnInsert: {
            term: cleanTerm,
            slug,
            termID,
            definition: cleanDefinition,
          },
        },
        { upsert: true, new: true, collation },
      );
      return { termID: glossary.termID };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await Glossary.findOne({ term: cleanTerm }).collation(
          collation,
        );
        if (existing) return { termID: existing.termID };
      }
      throw error;
    }
  }

  /**
   * Applies an add/update onto an already-existing GlossaryUsage — shared by
   * the normal "found by findOne" path and the duplicate-key recovery path in
   * `_addGlossaryUsageToDatabase` below, so both apply the exact same update.
   */
  private async _applyToExistingGlossaryUsage(
    existingGlossaryUsage: GlossaryUsageInterface,
    params: AddGlossaryUsageParams,
    definition: string,
  ): Promise<string> {
    const pageID = params.pageId?.toString();
    if (params.imageFile) {
      existingGlossaryUsage.imageFile = {
        data: params.imageFile.buffer,
        contentType: params.imageFile.mimetype,
        originalname: params.imageFile.originalname,
      };
    }
    // A term-level display attribute, not page-specific, so it applies
    // regardless of the pageID branch below — but only when the caller
    // actually passed it, so import flows that attach a page and never
    // mention `italic` can't accidentally clear a previously-set value.
    if (params.italic !== undefined) {
      existingGlossaryUsage.italic = params.italic;
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
    } else {
      existingGlossaryUsage.definition = definition;
    }
    existingGlossaryUsage.updatedAt = new Date();
    await existingGlossaryUsage.save();
    return existingGlossaryUsage.usageID;
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
    const term = sanitizeLibraryText(params.term);
    const definition = sanitizeLibraryText(params.definition);
    const author = sanitizeOptionalLibraryText(params.author);
    const link = sanitizeOptionalLibraryText(params.link);
    const source = sanitizeOptionalLibraryText(params.source);
    const imageSource = sanitizeOptionalLibraryText(params.imageSource);
    const imageAuthor = sanitizeOptionalLibraryText(params.imageAuthor);
    const imageLicense = sanitizeOptionalLibraryText(params.imageLicense);
    const altText = sanitizeOptionalLibraryText(params.altText);
    const caption = sanitizeOptionalLibraryText(params.caption);

    const existingGlossaryUsage = await GlossaryUsage.findOne({
      termID: params.termID,
      coverID: parseInt(params.coverID),
      library: params.library,
    });
    const aliases: { termID: string; term: string }[] = [];

    if (params?.aliases && params.aliases.length > 0) {
      // add aliases to glossary and make a list of [{termID, term}] using _addGlossaryToDatabase
      for (const alias of params.aliases) {
        const cleanAlias = sanitizeLibraryText(alias);
        if (cleanAlias === "") {
          continue;
        }
        const { termID } = await this._addGlossaryToDatabase(cleanAlias, "");
        aliases.push({ termID, term: cleanAlias });
      }
    }
    if (existingGlossaryUsage) {
      return this._applyToExistingGlossaryUsage(
        existingGlossaryUsage,
        params,
        definition,
      );
    }

    try {
      const usageID = base62(10);
      const glossaryUsage = await GlossaryUsage.create({
        usageID,
        term,
        definition,
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
        altText,
        caption,
        link,
        source,
        imageSource,
        imageAuthor,
        imageLicense,
        aliases: aliases,
        author,
        italic: params.italic,
      });
      return glossaryUsage.usageID;
    } catch (error) {
      // Two concurrent calls for the same new (termID, coverID, library) can
      // both miss the findOne above before either create() commits. The
      // unique index on GlossaryUsage turns the loser's insert into a
      // duplicate-key error instead of a second usage row for the same term
      // in the same book — recover by re-reading the winner's document and
      // applying the same update it would have gotten as "existing".
      if (isDuplicateKeyError(error)) {
        const winner = await GlossaryUsage.findOne({
          termID: params.termID,
          coverID: parseInt(params.coverID),
          library: params.library,
        });
        if (winner) {
          return this._applyToExistingGlossaryUsage(
            winner,
            params,
            definition,
          );
        }
      }
      throw error;
    }
  }

  async getGlossaryConfig(
    coverID: string,
    library: string,
  ): Promise<GlossaryConfigInterface | null> {
    return GlossaryConfig.findOne({
      coverID: parseInt(coverID),
      library,
    });
  }

  /**
   * Backfills a default GlossaryConfig for books that don't have one yet —
   * called when a term is added, so the book's very first term creates one
   * instead of leaving it unset until someone visits the config screen.
   * Defaults to BACKMATTER mode (a single group spanning the whole book)
   * targeting the book's back-matter "Glossary" page, mirroring the
   * client's own BACKMATTER default (glossaryConfigDefaults.ts). Best-effort:
   * a failure here must not block the term add that triggered it.
   */
  private async ensureDefaultGlossaryConfig(
    coverID: string,
    library: string,
  ): Promise<void> {
    try {
      const existing = await GlossaryConfig.findOne({
        coverID: parseInt(coverID),
        library,
      });
      if (existing) return;

      const toc = await new BookService({
        bookID: `${library}-${coverID}`,
      }).getBookTOCNew();
      const glossaryPageId = findBackmatterGlossaryPageId(toc);

      await this.saveGlossaryConfig(coverID, library, {
        mode: "BACKMATTER",
        glossaryPageId,
        groups: [
          {
            groupID: randomUUID(),
            pageIds: toc.children.flatMap(collectSubtreeIds),
            targetPageId: glossaryPageId ?? toc.children[0]?.id ?? toc.id,
          },
        ],
      });
    } catch (error) {
      glossaryLog.warn(
        { err: error, coverID, library },
        "Failed to create default glossary config",
      );
    }
  }

  async saveGlossaryConfig(
    coverID: string,
    library: string,
    data: {
      mode: GlossaryConfigMode;
      glossaryPageId?: string;
      groups: GlossaryConfigGroup[];
      showTermOnly?: boolean;
    },
  ): Promise<GlossaryConfigInterface> {
    const groupIDs = new Set<string>();
    const pageOwner = new Map<string, string>();
    const groups: GlossaryConfigGroup[] = data.groups.map((group) => {
      if (groupIDs.has(group.groupID)) {
        throw new GlossaryConfigValidationError(
          `Duplicate group ID: ${group.groupID}`,
        );
      }
      groupIDs.add(group.groupID);

      const pageIds = [...new Set(group.pageIds)];
      for (const pageId of pageIds) {
        const owner = pageOwner.get(pageId);
        if (owner && owner !== group.groupID) {
          throw new GlossaryConfigValidationError(
            `Page ${pageId} is assigned to more than one group.`,
          );
        }
        pageOwner.set(pageId, group.groupID);
      }

      return {
        groupID: group.groupID,
        pageIds,
        targetPageId: group.targetPageId,
      };
    });

    const project = await this.getProject({ coverID, library });

    const config = await GlossaryConfig.findOneAndUpdate(
      { coverID: parseInt(coverID), library },
      {
        $set: {
          projectId: project?.projectID,
          coverID: parseInt(coverID),
          library,
          glossaryPageId: data.glossaryPageId,
          mode: data.mode,
          groups,
          showTermOnly: data.showTermOnly ?? false,
        },
      },
      { upsert: true, new: true },
    );
    return config;
  }

  async deleteGlossaryConfig(coverID: string, library: string): Promise<void> {
    await GlossaryConfig.deleteOne({
      coverID: parseInt(coverID),
      library,
    });
  }
}
