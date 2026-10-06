import base62 from "base62-random";
import { PipelineStage } from "mongoose";
import {
  EntryType,
  OPTIONAL_REFERENCE_FIELDS,
  Reference,
  ReferenceInterface,
} from "../../models/reference.js";
import {
  PageReferences,
  REFERENCE_BACKMATTER_TARGET,
  ReferenceDisplayLocation,
  ReferenceScopeGroup,
  ReferenceScopeMode,
  ReferenceUsage,
  ReferenceUsageInterface,
} from "../../models/referenceusage.js";
import { ReferenceEntrySchema } from "../validators/Reference.js";
import { z } from "zod";
import BookService from "./book-service.js";
import AuthorService from "./author-service.js";
import Author from "../../models/author.js";
import {
  CXOneFetch,
  generateAPIRequestHeaders,
  getPage,
} from "../../util/librariesclient.js";
import { escapeRegEx } from "../../util/helpers.js";
import { ReferencePopulateJob } from "../../models/referencepopulatejob.js";
import Project, { ProjectInterface } from "../../models/project.js";
import GlossaryService from "./glossary-service.js";
import MindTouch from "../../util/CXOne/index.js";
import RemixerTemplates from "../../util/CXOne/CXOneRemixerTemplates.js";
import { titleToRemixerPathSegment } from "../../util/remixerutils.js";
import { childLogger } from "../../logger.js";
import {
  isValidCitationKey,
  sanitizeReferenceField,
} from "../../util/referenceSanitize.js";
import {
  extractCitationKeys,
  workIdentity,
} from "../../util/referenceCitations.js";

const populateLog = childLogger("reference-populate");

export class ReferenceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "ReferenceServiceError";
  }
}

type ReferenceEntryInput = z.infer<typeof ReferenceEntrySchema>;

/** MongoDB's duplicate key error, raised when a write breaks a unique index. */
const isDuplicateKeyError = (err: unknown): boolean =>
  (err as { code?: number })?.code === 11000;

export const getReferencesUsage = async ({
  projectID,
  showPageRefs = false,
}: {
  projectID: string;
  showPageRefs?: boolean;
}): Promise<{
  format: string;
  displayLocation?: ReferenceDisplayLocation;
  pageTitle?: string;
  entries: ReferenceInterface[];
  backmatterPageID?: string;
  backmatterReferenceList: string[];
  pageReferences: PageReferences[] | undefined;
  selectedList?: string[];
  scopeMode?: ReferenceScopeMode;
  scopeGroups?: ReferenceScopeGroup[];
  updatedAt?: Date;
} | null> => {
  const referenceUsage = await ReferenceUsage.findOne({
    projectID: { $eq: projectID },
  });
  // No record until a citation format is first saved; callers treat that as
  // "no references yet", not an error.
  if (!referenceUsage) return null;

  const entries = await Reference.find({
    referenceID: { $in: referenceUsage.entries },
  });

  return {
    format: referenceUsage.format,
    displayLocation: referenceUsage.displayLocation ?? undefined,
    pageTitle: referenceUsage.pageTitle,
    entries: entries.map((entry) => entry.toObject()),
    backmatterPageID: referenceUsage.backmatterPageID ?? undefined,
    backmatterReferenceList: referenceUsage.backmatterReferenceList ?? [],
    pageReferences: showPageRefs
      ? (referenceUsage.pageReferences ?? [])
      : undefined,
    selectedList: referenceUsage.selectedList ?? [],
    scopeMode: referenceUsage.scopeMode ?? undefined,
    updatedAt: referenceUsage.updatedAt ?? undefined,
    scopeGroups: referenceUsage.scopeGroups
      ? referenceUsage.scopeGroups.map(({ groupID, pageIds, targetPageId }) => ({
          groupID,
          pageIds: [...pageIds],
          targetPageId,
        }))
      : undefined,
  };
};

/** The legacy `displayLocation` each scope mode stands for. */
const DISPLAY_LOCATION_BY_SCOPE_MODE: Record<
  ReferenceScopeMode,
  ReferenceDisplayLocation
> = {
  PAGE: "endOfPage",
  CHAPTER: "endOfChapter",
  BACKMATTER: "backmatter",
};

/**
 * Saves the reference format and scope for a project in one write. The
 * legacy fields the populate job and the library's `ReferenceBib` template
 * read (`displayLocation`, `selectedList`) are derived from the scope here,
 * so they can never disagree with it.
 */
export const saveReferenceScope = async (
  projectID: string,
  actorUUID: string,
  {
    format,
    pageTitle,
    mode,
    groups,
  }: {
    format: string;
    pageTitle?: string;
    mode: ReferenceScopeMode;
    groups: ReferenceScopeGroup[];
  },
): Promise<ReferenceUsageInterface> => {
  const selectedList =
    mode === "CHAPTER"
      ? [...new Set(groups.map((group) => group.targetPageId))]
      : [];
  const referenceUsage = await ReferenceUsage.findOneAndUpdate(
    { projectID: { $eq: projectID } },
    {
      $set: {
        format,
        updatedBy: actorUUID,
        displayLocation: DISPLAY_LOCATION_BY_SCOPE_MODE[mode],
        ...(pageTitle !== undefined ? { pageTitle } : {}),
        selectedList,
        scopeMode: mode,
        scopeGroups: groups,
      },
      $setOnInsert: {
        projectID,
        createdBy: actorUUID,
        entries: [],
      },
    },
    { new: true, upsert: true },
  );
  return referenceUsage;
};

/**
 * Forgets the saved scope so the editor falls back to its defaults. The
 * legacy display fields are left as they are: they still describe what the
 * book currently shows until a new scope is saved.
 */
export const resetReferenceScope = async (
  projectID: string,
  actorUUID: string,
): Promise<void> => {
  await ReferenceUsage.updateOne(
    { projectID: { $eq: projectID } },
    {
      $unset: { scopeMode: 1, scopeGroups: 1 },
      $set: { updatedBy: actorUUID },
    },
  );
};

/**
 * The saved scope groups whose reference list is displayed on `pageID`.
 * The BACKMATTER group's placeholder target resolves to the shared
 * back-matter References page once it exists.
 */
export const getScopeGroupsDisplayedOnPage = (
  scopeGroups: ReferenceScopeGroup[] | undefined,
  pageID: string,
  backmatterPageID?: string,
): ReferenceScopeGroup[] =>
  (scopeGroups ?? []).filter(
    (group) =>
      group.targetPageId === pageID ||
      (group.targetPageId === REFERENCE_BACKMATTER_TARGET &&
        !!backmatterPageID &&
        backmatterPageID === pageID),
  );

/** Upsert the citation format for a project (one ReferenceUsage doc per project). */
export const upsertReferenceFormat = async (
  projectID: string,
  format: string,
  actorUUID: string,
  options?: {
    displayLocation?: "endOfPage" | "endOfChapter" | "backmatter";
    pageTitle?: string;
    selectedList?: string[];
  },
): Promise<ReferenceUsageInterface> => {
  const optionalSet: {
    displayLocation?: "endOfPage" | "endOfChapter" | "backmatter";
    pageTitle?: string;
    selectedList?: string[];
  } = {};
  if (options?.displayLocation !== undefined) {
    optionalSet.displayLocation = options.displayLocation;
  }
  if (options?.pageTitle !== undefined) {
    optionalSet.pageTitle = options.pageTitle;
  }
  if (options?.selectedList !== undefined) {
    optionalSet.selectedList = options.selectedList;
  }

  const referenceUsage = await ReferenceUsage.findOneAndUpdate(
    { projectID: { $eq: projectID } },
    {
      $set: {
        format,
        updatedBy: actorUUID,
        ...optionalSet,
      },
      $setOnInsert: {
        projectID,
        createdBy: actorUUID,
        entries: [],
      },
    },
    {
      new: true,
      upsert: true,
    },
  );
  return referenceUsage;
};

const pickOptionalFields = (
  entry: ReferenceEntryInput,
): Partial<Record<(typeof OPTIONAL_REFERENCE_FIELDS)[number], string>> => {
  const fields: Partial<
    Record<(typeof OPTIONAL_REFERENCE_FIELDS)[number], string>
  > = {};
  // Every write goes through here, including copies of existing references,
  // so stored values are always inert even if they arrived some other way.
  for (const key of OPTIONAL_REFERENCE_FIELDS) {
    const value = entry[key];
    if (typeof value === "string") {
      fields[key] = sanitizeReferenceField(key, value);
    }
  }
  return fields;
};

const assertCitationKeyAvailable = async (
  projectID: string,
  citationKey: string,
  excludeReferenceID?: string,
): Promise<void> => {
  const conflict = await Reference.findOne({
    projectID: { $eq: projectID },
    citationKey: { $eq: citationKey },
    ...(excludeReferenceID ? { referenceID: { $ne: excludeReferenceID } } : {}),
  });
  if (conflict) {
    throw citationKeyTakenError(citationKey);
  }
};

const citationKeyTakenError = (citationKey: string) =>
  new ReferenceServiceError(
    `Citation key "${citationKey}" is already used in this project. Choose a different key.`,
    409,
  );

/**
 * `base`, or `base` plus the first free letter suffix (Smith2024, Smith2024a,
 * Smith2024b…), the usual BibTeX convention for same-author, same-year keys.
 */
export const nextAvailableCitationKey = async (
  projectID: string,
  base: string,
): Promise<string> => {
  const taken = new Set(
    (
      await Reference.find(
        {
          projectID: { $eq: projectID },
          citationKey: { $regex: `^${escapeRegEx(base)}` },
        },
        { citationKey: 1 },
      ).lean()
    ).map((reference) => reference.citationKey),
  );
  if (!taken.has(base)) return base;
  for (let code = 97; code <= 122; code += 1) {
    const candidate = `${base}${String.fromCharCode(code)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${base62(4)}`;
};

const addEntryToUsage = async (
  projectID: string,
  referenceID: string,
  actorUUID: string,
): Promise<void> => {
  await ReferenceUsage.updateOne(
    { projectID: { $eq: projectID } },
    {
      $addToSet: { entries: referenceID },
      $set: { updatedBy: actorUUID },
    },
  );
};

/**
 * Upsert a bibliographic reference for a project:
 * - Existing referenceID owned by this project → update in place
 * - Existing referenceID from another project → create a forked copy
 * - Otherwise → create a new reference. A citation key that's already used
 *   in the project is rejected (409), never treated as an update: that would
 *   silently overwrite a different reference.
 * Then ensure the referenceID is listed on the project's ReferenceUsage.
 */
export const upsertReferenceEntry = async (
  projectID: string,
  entry: ReferenceEntryInput,
  actorUUID: string,
): Promise<ReferenceInterface> => {
  const usage = await getReferencesUsage({ projectID, showPageRefs: false });
  if (!usage) {
    throw new ReferenceServiceError(
      "ReferenceUsage not found — set a citation format first",
      404,
    );
  }

  const now = new Date();
  const optionalFields = pickOptionalFields(entry);
  const { citationKey, entryType, referenceID: incomingReferenceID } = entry;

  // ── Lookup by referenceID (if provided) ──────────────────────────────────
  if (incomingReferenceID) {
    const byId = await Reference.findOne({
      referenceID: { $eq: incomingReferenceID },
    });

    if (byId) {
      if (byId.projectID === projectID) {
        // Same project → update in place
        await assertCitationKeyAvailable(
          projectID,
          citationKey,
          byId.referenceID,
        );
        byId.entryType = entryType;
        byId.citationKey = citationKey;
        byId.updatedBy = actorUUID;
        byId.updatedAt = now;
        Object.assign(byId, optionalFields);
        await byId.save();
        await addEntryToUsage(projectID, byId.referenceID, actorUUID);
        return byId.toObject();
      }

      // Different project → fork into this project, replacing the original
      // in this project's list so it doesn't show both versions.
      await assertCitationKeyAvailable(projectID, citationKey);
      const forkedID = base62(10);
      const forked = await Reference.create({
        projectID,
        referenceID: forkedID,
        createdBy: actorUUID,
        updatedBy: actorUUID,
        isFork: true,
        forkedFrom: byId.referenceID,
        createdAt: now,
        updatedAt: now,
        entryType,
        citationKey,
        ...optionalFields,
      });
      await addEntryToUsage(projectID, forkedID, actorUUID);
      await ReferenceUsage.updateOne(
        { projectID: { $eq: projectID } },
        { $pull: { entries: byId.referenceID } },
      );
      return forked.toObject();
    }
  }

  // ── Create new ───────────────────────────────────────────────────────────
  await assertCitationKeyAvailable(projectID, citationKey);
  const newID = base62(10);
  const toCreate = new Reference({
    projectID,
    referenceID: newID,
    createdBy: actorUUID,
    updatedBy: actorUUID,
    isFork: false,
    createdAt: now,
    updatedAt: now,
    entryType: entryType as EntryType,
    citationKey,
    ...optionalFields,
  });
  const validationError = toCreate.validateSync();
  if (validationError) {
    throw new ReferenceServiceError(validationError.message, 400);
  }
  let created;
  try {
    created = await toCreate.save();
  } catch (err) {
    // The (projectID, citationKey) unique index: the same key was added
    // concurrently after the check above.
    if (isDuplicateKeyError(err)) throw citationKeyTakenError(citationKey);
    throw err;
  }
  await addEntryToUsage(projectID, newID, actorUUID);
  return created.toObject();
};

export const searchReferences = async (
  projectID: string,
  query: string,
): Promise<ReferenceInterface[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const referenceUsage = await ReferenceUsage.findOne(
    { projectID: { $eq: projectID } },
    { entries: 1 },
  );
  if (!referenceUsage) {
    throw new ReferenceServiceError("ReferenceUsage not found", 404);
  }

  const searchpipeline: PipelineStage[] = [
    { $match: { $text: { $search: trimmed } } },
    { $match: { referenceID: { $nin: [...referenceUsage.entries] } } },
    {
      $addFields: {
        score: { $meta: "textScore" },
        isCurrentProject: {
          $cond: [{ $eq: ["$projectID", projectID] }, 1, 0],
        },
      },
    },
    { $sort: { isCurrentProject: -1, score: -1 } },
    { $limit: 20 },
    { $project: { score: 0, isCurrentProject: 0, __v: 0, _id: 0 } },
  ];
  const references =
    await Reference.aggregate<ReferenceInterface>(searchpipeline);

  return references;
};

/**
 * Removes several references from a project with the same rules as a single
 * removal, using a few bulk reads and writes instead of a round of queries
 * per reference. A permanent delete applies only to references this project
 * owns: one no other book uses is deleted; one another book still uses is
 * handed over to it, or refused if its key clashes there. Everything is
 * decided before anything is written, so a refused reference stays listed.
 */
export const deleteReferenceEntries = async (
  projectID: string,
  referenceIDs: string[],
  deleteFromReferences: boolean,
): Promise<{
  removed: string[];
  failed: { referenceID: string; message: string }[];
}> => {
  const usage = await ReferenceUsage.findOne(
    { projectID: { $eq: projectID } },
    { entries: 1 },
  ).lean();
  if (!usage) {
    throw new ReferenceServiceError("ReferenceUsage not found", 404);
  }

  const failed: { referenceID: string; message: string }[] = [];
  const listed = new Set(usage.entries);
  const ids = [...new Set(referenceIDs)].filter((referenceID) => {
    if (listed.has(referenceID)) return true;
    failed.push({
      referenceID,
      message: "Reference not found in this project's usage",
    });
    return false;
  });

  // Owned references being permanently deleted, and other books using them.
  const owned = deleteFromReferences
    ? await Reference.find(
        { projectID: { $eq: projectID }, referenceID: { $in: ids } },
        { referenceID: 1, citationKey: 1 },
      ).lean()
    : [];
  const otherUsages = owned.length
    ? await ReferenceUsage.find(
        {
          projectID: { $ne: projectID },
          entries: { $in: owned.map((ref) => ref.referenceID) },
        },
        { projectID: 1, entries: 1 },
      ).lean()
    : [];

  const toDelete: string[] = [];
  const handovers: { referenceID: string; toProjectID: string }[] = [];
  const refused = new Set<string>();
  for (const reference of owned) {
    const users = otherUsages.filter((other) =>
      other.entries.includes(reference.referenceID),
    );
    if (users.length === 0) {
      toDelete.push(reference.referenceID);
      continue;
    }
    let target: string | undefined;
    for (const other of users) {
      const clash = await Reference.exists({
        projectID: { $eq: other.projectID },
        citationKey: { $eq: reference.citationKey },
        referenceID: { $ne: reference.referenceID },
      });
      if (!clash) {
        target = other.projectID;
        break;
      }
    }
    if (target) {
      handovers.push({ referenceID: reference.referenceID, toProjectID: target });
    } else {
      refused.add(reference.referenceID);
      failed.push({
        referenceID: reference.referenceID,
        message:
          "This reference is still used by another project, and its citation key clashes there, so it can't be permanently deleted. Remove it from this project instead.",
      });
    }
  }

  const removed = ids.filter((referenceID) => !refused.has(referenceID));
  if (removed.length > 0) {
    await ReferenceUsage.updateOne(
      { projectID: { $eq: projectID } },
      { $pull: { entries: { $in: removed } } },
    );
  }
  if (toDelete.length > 0) {
    await Reference.deleteMany({
      projectID: { $eq: projectID },
      referenceID: { $in: toDelete },
    });
  }
  const now = new Date();
  for (const { referenceID, toProjectID } of handovers) {
    await Reference.updateOne(
      { projectID: { $eq: projectID }, referenceID: { $eq: referenceID } },
      { $set: { projectID: toProjectID, updatedAt: now } },
    );
  }
  return { removed, failed };
};

/**
 * Remove a reference from a project's usage list.
 * When `deleteFromReferences` is true and this project owns the Reference:
 * - If another project still lists it in usage → transfer ownership (`projectID`)
 * - Otherwise → permanently delete the Reference document
 */
export const deleteReferenceEntry = async (
  projectID: string,
  referenceID: string,
  deleteFromReferences: boolean = false,
): Promise<{ referenceID: string; citationKey: string }> => {
  const referenceUsage = await ReferenceUsage.findOne({
    projectID: { $eq: projectID },
  });
  if (!referenceUsage) {
    throw new ReferenceServiceError("ReferenceUsage not found", 404);
  }

  if (!referenceUsage.entries.includes(referenceID)) {
    throw new ReferenceServiceError(
      "Reference not found in this project's usage",
      404,
    );
  }

  const ownedReference = await Reference.findOne({
    projectID: { $eq: projectID },
    referenceID: { $eq: referenceID },
  });
  const anyReference =
    ownedReference ??
    (await Reference.findOne({ referenceID: { $eq: referenceID } }));

  if (!anyReference) {
    throw new ReferenceServiceError("Reference not found", 404);
  }

  if (deleteFromReferences && !ownedReference) {
    throw new ReferenceServiceError(
      "Only references owned by this project can be permanently deleted",
      400,
    );
  }

  // Decide everything a permanent delete needs before changing any data, so a
  // refused delete leaves the project exactly as it was.
  let transferToProjectID: string | undefined;
  if (deleteFromReferences && ownedReference) {
    const otherUsages = await ReferenceUsage.find({
      projectID: { $ne: projectID },
      entries: referenceID,
    });
    for (const usage of otherUsages) {
      const citationConflict = await Reference.exists({
        projectID: { $eq: usage.projectID },
        citationKey: { $eq: ownedReference.citationKey },
        referenceID: { $ne: referenceID },
      });
      if (!citationConflict) {
        transferToProjectID = usage.projectID;
        break;
      }
    }
    if (!transferToProjectID && otherUsages.length > 0) {
      throw new ReferenceServiceError(
        "This reference is still used by another project, and its citation key clashes there, so it can't be permanently deleted. Remove it from this project instead.",
        409,
      );
    }
  }

  await ReferenceUsage.updateOne(
    { projectID: { $eq: projectID } },
    { $pull: { entries: referenceID } },
  );

  if (deleteFromReferences && ownedReference) {
    if (transferToProjectID) {
      // Still used elsewhere: hand ownership over instead of deleting it.
      ownedReference.projectID = transferToProjectID;
      ownedReference.updatedAt = new Date();
      await ownedReference.save();
    } else {
      await Reference.deleteOne({
        projectID: { $eq: projectID },
        referenceID: { $eq: referenceID },
      });
    }
  }

  return {
    referenceID: anyReference.referenceID,
    citationKey: anyReference.citationKey,
  };
};

export type AddReferencesSkipReason = "not-found" | "key-in-use";

/**
 * Adds existing references (usually another project's) to this book's list.
 * Inside one book a citation key must mean one reference, so a reference
 * whose key the book already uses for a different reference is skipped, as
 * is an ID that doesn't exist. Already-listed references are left as they are.
 */
export const addReferencesToUsage = async (
  projectID: string,
  referenceIDs: string[],
): Promise<{
  added: string[];
  skipped: { referenceID: string; reason: AddReferencesSkipReason }[];
}> => {
  const referenceUsage = await ReferenceUsage.findOne({
    projectID: { $eq: projectID },
  });
  if (!referenceUsage) {
    throw new ReferenceServiceError("ReferenceUsage not found", 404);
  }
  if (referenceIDs.length === 0) {
    throw new ReferenceServiceError("No referenceIDs provided", 400);
  }

  const listed = new Set(referenceUsage.entries);
  const requestedIDs = [...new Set(referenceIDs)].filter((id) => !listed.has(id));
  const [requested, current] = await Promise.all([
    Reference.find(
      { referenceID: { $in: requestedIDs } },
      { referenceID: 1, citationKey: 1 },
    ).lean(),
    Reference.find(
      { referenceID: { $in: referenceUsage.entries } },
      { citationKey: 1 },
    ).lean(),
  ]);
  const requestedByID = new Map(requested.map((ref) => [ref.referenceID, ref]));
  const keysInUse = new Set(current.map((ref) => ref.citationKey));

  const added: string[] = [];
  const skipped: { referenceID: string; reason: AddReferencesSkipReason }[] = [];
  for (const referenceID of requestedIDs) {
    const reference = requestedByID.get(referenceID);
    if (!reference) {
      skipped.push({ referenceID, reason: "not-found" });
      continue;
    }
    if (keysInUse.has(reference.citationKey)) {
      skipped.push({ referenceID, reason: "key-in-use" });
      continue;
    }
    keysInUse.add(reference.citationKey);
    added.push(referenceID);
  }

  if (added.length > 0) {
    await ReferenceUsage.updateOne(
      { projectID: { $eq: projectID } },
      { $addToSet: { entries: { $each: added } } },
    );
  }
  return { added, skipped };
};

const buildCitationKey = (
  title: string,
  pageID: string,
  publishingyear?: string,
): string => {
  const year = publishingyear || new Date().getFullYear().toString();
  const slug = title.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 32);
  return `${year}${slug || `page${pageID}`}`;
};

/**
 * Create a misc/website reference from a LibreTexts book page and attach it
 * to the project's reference usage.
 */
export const createReferenceFromBookPage = async (
  projectID: string,
  bookID: string,
  pageID: string,
  actorUUID: string,
): Promise<ReferenceInterface> => {
  const bookService = new BookService({ bookID });
  const subdomain = bookService.library;

  const page = await getPage(Number(pageID), subdomain);
  if (!page) {
    throw new ReferenceServiceError("Book page not found", 404);
  }

  const title = String(page.title ?? "").trim() || `Page ${pageID}`;
  const url = `https://${subdomain}.libretexts.org/@go/page/${pageID}`;

  const existingByUrl = await Reference.findOne({
    projectID: { $eq: projectID },
    url: { $eq: url },
  });

  const tags = await bookService.getPageTags(pageID);
  const authorService = new AuthorService();

  const authorNames: string[] = [];
  const publisher: string[] = [];
  for (const tag of tags) {
    const value = String(tag["@value"] ?? "").trim();
    if (value.toLowerCase().startsWith("authorname:")) {
      const nameKey = value.slice("authorname:".length).trim();
      if (!nameKey) continue;
      const author = await authorService.getAuthorByNameKey(nameKey);
      authorNames.push(author?.name?.trim() || nameKey);
      if (author?.campusName) publisher.push(author?.campusName || "");
      continue;
    }
    if (value.toLowerCase().startsWith("author@")) {
      const name = value.slice("author@".length).trim();
      if (!name) continue;
      const author = await Author.findOne({
        orgID: process.env.ORG_ID,
        name: { $regex: new RegExp(`^${escapeRegEx(name)}$`, "i") },
      }).lean();
      authorNames.push(author?.name?.trim() || name);
    }
  }

  const uniqueAuthors = [...new Set(authorNames.filter(Boolean))];
  const createdYear = page["date.created"]
    ? new Date(page["date.created"]).getFullYear().toString()
    : new Date().getFullYear().toString();
  const urldate = new Date().toISOString().slice(0, 10);

  return upsertReferenceEntry(
    projectID,
    {
      entryType: "misc",
      citationKey:
        existingByUrl?.citationKey ??
        (await nextAvailableCitationKey(
          projectID,
          buildCitationKey(title, pageID, createdYear || undefined),
        )),
      ...(existingByUrl ? { referenceID: existingByUrl.referenceID } : {}),
      title,
      url,
      ...(uniqueAuthors.length ? { author: uniqueAuthors.join(" and ") } : {}),
      year: createdYear,
      urldate,
      note: `[Online; accessed ${urldate}]`,
      publisher: publisher.join(", "),
    },
    actorUUID,
  );
};

export const getReferenceItemsService = async (
  projectID: string,
  showReferenceID: boolean = false,
): Promise<ReferenceInterface[]> => {
  try {
    const usage = await ReferenceUsage.findOne(
      { projectID: { $eq: projectID } },
      { entries: 1 },
    ).lean();
    if (!usage?.entries?.length) return [];
    // Uses the referenceID index; internal fields and the embedding vector
    // never leave the server.
    const items = await Reference.find(
      { referenceID: { $in: usage.entries } },
      {
        _id: 0,
        __v: 0,
        projectID: 0,
        createdBy: 0,
        updatedBy: 0,
        isFork: 0,
        forkedFrom: 0,
        createdAt: 0,
        updatedAt: 0,
        ...(!showReferenceID ? { referenceID: 0 } : {}),
      },
    ).lean<ReferenceInterface[]>();
    // Served to public library pages: clean every field on the way out too,
    // so references stored before input sanitization can't carry markup.
    return items
      .filter((item) => isValidCitationKey(item.citationKey ?? ""))
      .map((item) => {
        const cleaned: ReferenceInterface = { ...item };
        for (const key of OPTIONAL_REFERENCE_FIELDS) {
          const value = item[key];
          if (typeof value === "string") {
            cleaned[key] = sanitizeReferenceField(key, value);
          }
        }
        return cleaned;
      });
  } catch (error) {
    throw new ReferenceServiceError("Internal server error", 500);
  }
};

/** Normalize MindTouch contents JSON body (string or string[]). */
const normalizePageBody = (rawOrBody: unknown): string => {
  if (typeof rawOrBody === "string") {
    const trimmed = rawOrBody.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return normalizePageBody(JSON.parse(trimmed));
      } catch {
        return rawOrBody;
      }
    }
    return rawOrBody;
  }
  if (rawOrBody && typeof rawOrBody === "object") {
    const body = (rawOrBody as { body?: unknown }).body;
    if (typeof body === "string") return body;
    if (Array.isArray(body) && body[0] != null) return String(body[0]);
  }
  if (Array.isArray(rawOrBody) && rawOrBody[0] != null) {
    return String(rawOrBody[0]);
  }
  return "";
};

/** Matches LibreTexts Back Matter references slot: `/zz:_Back_Matter/31:...`. */
const BACKMATTER_REFS_URL_RE = /\/zz(?:%3A|:)[_]?Back_Matter\/31(?:%3A|:)/i;

const resolveMindTouchPath = (pageInfo: unknown): string | null => {
  if (!pageInfo || typeof pageInfo !== "object") return null;
  const path = (pageInfo as { path?: unknown }).path;
  if (typeof path === "string" && path.length > 0) return path;
  if (
    path &&
    typeof path === "object" &&
    typeof (path as { "#text"?: unknown })["#text"] === "string"
  ) {
    return (path as { "#text": string })["#text"];
  }
  return null;
};

const renamePageTitle = async (
  library: string,
  pageID: string,
  title: string,
): Promise<void> => {
  const dekiHeaders = await generateAPIRequestHeaders(library);
  if (!dekiHeaders) {
    throw new Error("Error generating library API headers for page rename.");
  }
  const url = `https://${library}.libretexts.org/@api/deki/pages/${encodeURIComponent(
    pageID,
  )}/move?title=${encodeURIComponent(title)}&allow=deleteredirects&dream.out.format=json`;
  const response = await fetch(url, {
    method: "POST",
    body: "",
    headers: {
      "Content-Type": "text/plain",
      ...dekiHeaders,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to rename backmatter page ${pageID} to "${title}" (${response.status})`,
    );
  }
};

/**
 * Ensure the backmatter References page exists at
 * `{book}/zz:_Back_Matter/31:_…`, rename if title differs, and persist
 * `backmatterPageID` on ReferenceUsage.
 */
const ensureBackmatterReferencesPage = async ({
  projectID,
  toc,
  bookService,
  coverID,
  pageTitle,
}: {
  projectID: string;
  toc: { id: string; title: string; url: string }[];
  bookService: BookService;
  coverID: string;
  pageTitle?: string;
}): Promise<string> => {
  const library = bookService.library;
  const desiredTitle = pageTitle?.trim() || "References";

  const existing = toc.find((page) => BACKMATTER_REFS_URL_RE.test(page.url));
  if (existing) {
    if (existing.title.trim() !== desiredTitle) {
      await renamePageTitle(library, existing.id, desiredTitle);
    }
    await ReferenceUsage.updateOne(
      { projectID: { $eq: projectID } },
      { $set: { backmatterPageID: existing.id } },
    );
    return existing.id;
  }

  const coverInfo = await getPage(Number(coverID), library);
  const bookPath = resolveMindTouchPath(coverInfo);
  if (!bookPath) {
    throw new Error("Could not resolve book path for backmatter page creation");
  }

  const backMatterContainerPath = `${bookPath}/zz:_Back_Matter`;
  const containerInfo = await getPage(backMatterContainerPath, library);
  if (!containerInfo?.["@id"]) {
    const createContainerRes = await CXOneFetch({
      scope: "page",
      path: backMatterContainerPath,
      api: MindTouch.API.Page.POST_Contents_Title("Back Matter"),
      subdomain: library,
      options: {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: RemixerTemplates.POST_CreateBlankTopicGuide,
      },
    });
    if (!createContainerRes.ok) {
      throw new Error(
        `Failed to create Back Matter container (${createContainerRes.status})`,
      );
    }
  }

  const refsPath = `${backMatterContainerPath}/31:_${titleToRemixerPathSegment(desiredTitle)}`;
  const createRes = await CXOneFetch({
    scope: "page",
    path: refsPath,
    api: MindTouch.API.Page.POST_Contents_Title(desiredTitle),
    subdomain: library,
    options: {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: RemixerTemplates.POST_CreateBlankPage("topic"),
    },
  });
  if (!createRes.ok) {
    throw new Error(
      `Failed to create backmatter references page (${createRes.status})`,
    );
  }

  const created = await getPage(refsPath, library);
  const pageID = created?.["@id"]?.toString();
  if (!pageID) {
    throw new Error("Created backmatter page but could not resolve page ID");
  }

  await ReferenceUsage.updateOne(
    { projectID: { $eq: projectID } },
    { $set: { backmatterPageID: pageID } },
  );
  return pageID;
};

const runJob = async ({
  jobID,
  toc,
  bookService,
  coverID,
  projectID,
}: {
  jobID: string;
  toc: { id: string; title: string; url: string }[];
  bookService: BookService;
  coverID: string;
  library?: string;
  projectID: string;
}): Promise<void> => {
  try {
    const [references, referenceUsage] = await Promise.all([
      getReferenceItemsService(projectID, true),
      ReferenceUsage.findOne(
        { projectID: { $eq: projectID } },
        { displayLocation: 1, pageTitle: 1, selectedList: 1 },
      ),
    ]);
    if (!referenceUsage) {
      throw new ReferenceServiceError("ReferenceUsage not found", 404);
    }

    const isBackmatter = referenceUsage.displayLocation === "backmatter";
    let backmatterPageID: string | undefined;
    if (isBackmatter) {
      // Ensure backmatter References page before processing every content page.
      backmatterPageID = await ensureBackmatterReferencesPage({
        projectID,
        toc,
        bookService,
        coverID,
        pageTitle: referenceUsage.pageTitle,
      });
    }

    // Results are collected here and stored once, after every page succeeds.
    // Until then library pages keep reading the previous scan's data, and a
    // failed scan leaves it untouched.
    const backmatterReferenceList: Set<string> = new Set();
    const pageReferences: PageReferences[] = [];
    const referenceIDByKey = new Map(
      references.map((reference) => [
        reference.citationKey,
        reference.referenceID,
      ]),
    );

    for (let index = 0; index < toc.length; index++) {
      const page = toc[index];
      if (page.id === coverID) continue;
      if (backmatterPageID && page.id === backmatterPageID) continue;

      const content = await bookService.getPageContent(page.id, "json");
      // extract \librecite{*} from content
      const referenceKeys = extractCitationKeys(content);
      for (const key of referenceKeys) {
        backmatterReferenceList.add(key);
      }

      await ReferencePopulateJob.updateOne(
        { jobID: { $eq: jobID } },
        {
          $push: {
            message: `Processed ${page.title}${
              referenceKeys.length
                ? ` (${referenceKeys.length} cite${referenceKeys.length === 1 ? "" : "s"})`
                : ""
            }`,
          },
          $set: { completedPages: index + 1 },
        },
      );
      pageReferences.push({
        pageID: page.id,
        title: page.title,
        references: referenceKeys.map((key) => ({
          key,
          refID: referenceIDByKey.get(key) ?? "",
        })),
      });
    }

    // One write replaces the previous scan's data with this one's.
    await ReferenceUsage.updateOne(
      { projectID: { $eq: projectID } },
      {
        $set: {
          pageReferences,
          backmatterReferenceList: [...backmatterReferenceList],
        },
      },
    );

    if (isBackmatter && backmatterPageID) {
      await ReferencePopulateJob.updateOne(
        { jobID: { $eq: jobID } },
        {
          $push: {
            message: `Backmatter references page ready (${backmatterReferenceList.size} unique cite${backmatterReferenceList.size === 1 ? "" : "s"})`,
          },
        },
      );
    }

    await ReferencePopulateJob.updateOne(
      { jobID: { $eq: jobID } },
      { $set: { status: "completed" } },
    );
  } catch (err) {
    populateLog.error({ err, jobID, projectID }, "Reference populate job failed");
    try {
      await ReferencePopulateJob.updateOne(
        { jobID: { $eq: jobID } },
        {
          $set: { status: "failed" },
          $push: { message: "Failed. Run Scan Citations again to retry." },
        },
      );
    } catch (updateErr) {
      // The stale-job check marks it failed later if this write is lost.
      populateLog.error(
        { err: updateErr, jobID },
        "Could not mark reference populate job as failed",
      );
    }
  }
};

/**
 * A job that hasn't written progress for this long is no longer running: the
 * job runs inside the web process, so a restart or deploy stops it silently.
 */
const POPULATE_JOB_STALE_MS = 10 * 60 * 1000;

/**
 * The project's running populate job, or null. Pending jobs that stopped
 * reporting progress are marked failed first, so a lost job can't block new
 * ones or keep the client polling forever.
 */
export const getActivePopulateJob = async (projectID: string) => {
  const findPending = () =>
    ReferencePopulateJob.findOne({
      projectID: { $eq: projectID },
      status: { $eq: "pending" },
    }).sort({ createdAt: -1 });

  // The client polls this while a scan runs, so the usual case is a read.
  const staleBefore = new Date(Date.now() - POPULATE_JOB_STALE_MS);
  const pending = await findPending();
  if (!pending) return null;
  if (pending.updatedAt && pending.updatedAt >= staleBefore) return pending;

  await ReferencePopulateJob.updateMany(
    {
      projectID: { $eq: projectID },
      status: { $eq: "pending" },
      // Jobs created before timestamps were added have no updatedAt.
      $or: [
        { updatedAt: { $lt: staleBefore } },
        { updatedAt: { $exists: false } },
      ],
    },
    {
      $set: { status: "failed" },
      $push: {
        message:
          "Stopped: no progress for 10 minutes (the server may have restarted). Run Scan Citations again.",
      },
    },
  );
  return findPending();
};

export const createReferencePopulateJob = async (
  projectID: string,
  actorUUID: string,
  project: ProjectInterface,
): Promise<any> => {
  if (await getActivePopulateJob(projectID)) {
    throw new ReferenceServiceError(
      "A citation scan is already running for this book",
      409,
    );
  }

  const bookService = new BookService({
    bookID: `${project.libreLibrary}-${project.libreCoverID}`,
  });
  const toc: { id: string; title: string; url: string }[] =
    await bookService.getBookTOCFlat();

  let populateJob;
  try {
    populateJob = await ReferencePopulateJob.create({
      jobID: base62(10),
      projectID,
      createdBy: actorUUID,
      status: "pending",
      totalPages: toc.length,
      completedPages: 0,
      message: ["Citation scan started"],
    });
  } catch (err) {
    // Another request started a job between the check above and this insert.
    if (isDuplicateKeyError(err)) {
      throw new ReferenceServiceError(
        "A citation scan is already running for this book",
        409,
      );
    }
    throw err;
  }

  // Runs in the background; it records its own success or failure on the job.
  void runJob({
    jobID: populateJob.jobID,
    toc,
    bookService,
    coverID: project.libreCoverID,
    library: project.libreLibrary,
    projectID,
  });

  return populateJob;
};

// ── Remixer: bring imported pages' references into the remixed book ────────

/** The project that owns the book a library page belongs to, if any. */
const findProjectForPage = async (pageID: string, library: string) => {
  const candidateCoverIDs = (
    await GlossaryService.getCandidateCoverIDs(parseInt(pageID, 10), library)
  ).map(String);
  return Project.findOne({
    libreCoverID: { $in: candidateCoverIDs },
    libreLibrary: { $eq: library },
  });
};

/**
 * A key free in the book both among the references it cites (borrowed ones
 * included) and among those it owns, which the unique index also covers.
 */
const freeCitationKeyIn = async (
  projectID: string,
  base: string,
  citedKeys: Map<string, unknown>,
): Promise<string> => {
  const candidates = [
    base,
    ...Array.from({ length: 26 }, (_, i) => `${base}${String.fromCharCode(97 + i)}`),
  ];
  for (const candidate of candidates) {
    if (citedKeys.has(candidate)) continue;
    const owned = await Reference.exists({
      projectID: { $eq: projectID },
      citationKey: { $eq: candidate },
    });
    if (!owned) return candidate;
  }
  return `${base}-${base62(4)}`;
};

export type ImportedPageReferences = {
  /** References added to the remixed book. */
  imported: number;
  /** Old key → new key; apply to a copied page with `rewriteCitationKeys`. */
  keyRenames: Record<string, string>;
  /** Keys whose meaning in the remixed book differs and couldn't be fixed. */
  conflicts: string[];
  /** Cited keys the source book has no reference for. */
  unresolved: number;
};

const NO_IMPORT: ImportedPageReferences = {
  imported: 0,
  keyRenames: {},
  conflicts: [],
  unresolved: 0,
};

/**
 * Carries the references an imported page cites into the remixed book.
 *
 * The cited keys are read from the page content, not from the source book's
 * last Populate, so this works even if the source never ran it and never
 * writes to the source book. Each cited reference is shared by ID, so it
 * stays the same reference in both books. A key the remixed book already
 * uses for a different work is the only exception:
 * - `canRewriteContent` (copied pages): the reference is copied under a free
 *   key and `keyRenames` says how to rewrite the page's citations;
 * - otherwise (transcluded pages, whose content stays the source's): the key
 *   is reported in `conflicts`.
 */
export const importPageReferences = async ({
  sourcePageID,
  sourceLibrary,
  sourceContent,
  targetCoverID,
  targetLibrary,
  actorUUID,
  canRewriteContent,
}: {
  sourcePageID: string;
  sourceLibrary: string;
  /** The source page's HTML when the caller already has it. */
  sourceContent?: string;
  targetCoverID: string;
  targetLibrary: string;
  actorUUID: string;
  canRewriteContent: boolean;
}): Promise<ImportedPageReferences> => {
  const [sourceProject, targetProject] = await Promise.all([
    findProjectForPage(sourcePageID, sourceLibrary),
    Project.findOne({
      libreCoverID: { $eq: targetCoverID },
      libreLibrary: { $eq: targetLibrary },
    }),
  ]);
  if (!sourceProject || !targetProject) return NO_IMPORT;
  if (sourceProject.projectID === targetProject.projectID) return NO_IMPORT;

  const sourceUsage = await ReferenceUsage.findOne(
    { projectID: { $eq: sourceProject.projectID } },
    { entries: 1, format: 1 },
  ).lean();
  if (!sourceUsage?.entries?.length) return NO_IMPORT;

  const content =
    sourceContent ??
    normalizePageBody(
      await new BookService({
        bookID: `${sourceLibrary}-${sourceProject.libreCoverID}`,
      }).getPageContent(sourcePageID, "json"),
    );
  const citedKeys = extractCitationKeys(content);
  if (citedKeys.length === 0) return NO_IMPORT;

  const sourceByKey = new Map(
    (
      await Reference.find({
        referenceID: { $in: sourceUsage.entries },
        citationKey: { $in: citedKeys },
      }).lean()
    ).map((reference) => [reference.citationKey, reference]),
  );
  const unresolved = citedKeys.filter((key) => !sourceByKey.has(key)).length;
  if (sourceByKey.size === 0) return { ...NO_IMPORT, unresolved };

  // A remix into a book with no references yet starts from the source's format.
  const targetUsage =
    (await ReferenceUsage.findOne({
      projectID: { $eq: targetProject.projectID },
    })) ??
    (await upsertReferenceFormat(
      targetProject.projectID,
      sourceUsage.format,
      actorUUID,
    ));

  const targetRefs = await Reference.find(
    { referenceID: { $in: targetUsage.entries } },
    { referenceID: 1, citationKey: 1, doi: 1, url: 1 },
  ).lean();
  const targetIDs = new Set(targetRefs.map((ref) => ref.referenceID));
  const targetByKey = new Map(targetRefs.map((ref) => [ref.citationKey, ref]));
  const targetKeyByWork = new Map<string, string>();
  for (const ref of targetRefs) {
    const work = workIdentity(ref);
    if (work) targetKeyByWork.set(work, ref.citationKey);
  }

  const result: ImportedPageReferences = {
    imported: 0,
    keyRenames: {},
    conflicts: [],
    unresolved,
  };
  const toShare: string[] = [];

  for (const [key, source] of sourceByKey) {
    if (targetIDs.has(source.referenceID)) continue;

    const work = workIdentity(source);
    const sameWorkKey = work ? targetKeyByWork.get(work) : undefined;
    const holder = targetByKey.get(key);

    // The remixed book already has this work: cite its existing reference.
    if (sameWorkKey === key) continue;
    if (sameWorkKey && canRewriteContent) {
      result.keyRenames[key] = sameWorkKey;
      continue;
    }
    // A transcluded page keeps its key, so it needs a reference under that
    // key below, even though the book has the same work under another one.

    if (!holder) {
      toShare.push(source.referenceID);
      targetIDs.add(source.referenceID);
      targetByKey.set(key, source);
      if (work && !targetKeyByWork.has(work)) targetKeyByWork.set(work, key);
      continue;
    }

    // The key means a different work in the remixed book.
    if (!canRewriteContent) {
      result.conflicts.push(key);
      continue;
    }
    const freeKey = await freeCitationKeyIn(
      targetProject.projectID,
      key,
      targetByKey,
    );
    const now = new Date();
    const forked = await Reference.create({
      ...pickOptionalFields(source as ReferenceEntryInput),
      projectID: targetProject.projectID,
      referenceID: base62(10),
      createdBy: actorUUID,
      updatedBy: actorUUID,
      isFork: true,
      forkedFrom: source.referenceID,
      createdAt: now,
      updatedAt: now,
      entryType: source.entryType,
      citationKey: freeKey,
    });
    toShare.push(forked.referenceID);
    targetIDs.add(forked.referenceID);
    targetByKey.set(freeKey, forked);
    if (work) targetKeyByWork.set(work, freeKey);
    result.keyRenames[key] = freeKey;
  }

  if (toShare.length > 0) {
    await ReferenceUsage.updateOne(
      { projectID: { $eq: targetProject.projectID } },
      {
        $addToSet: { entries: { $each: toShare } },
        $set: { updatedBy: actorUUID },
      },
    );
  }
  result.imported = toShare.length;
  return result;
};
