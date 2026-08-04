import base62 from "base62-random";
import { PipelineStage } from "mongoose";
import {
  EntryType,
  OPTIONAL_REFERENCE_FIELDS,
  Reference,
  ReferenceInterface,
} from "../../models/reference.js";
import {
  ReferenceUsage,
  ReferenceUsageInterface,
} from "../../models/referenceusage.js";
import { ReferenceEntrySchema } from "../validators/Reference.js";
import { z } from "zod";
import BookService from "./book-service.js";
import AuthorService from "./author-service.js";
import Author from "../../models/author.js";
import { getPage } from "../../util/librariesclient.js";
import { escapeRegEx } from "../../util/helpers.js";

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

export const getReferencesUsage = async (
  projectID: string,
): Promise<{ format: string; entries: ReferenceInterface[] } | null> => {
  const referenceUsage = await ReferenceUsage.findOne({
    projectID: { $eq: projectID },
  });
  if (!referenceUsage) {
    throw new ReferenceServiceError("ReferenceUsage not found", 404);
  }

  const entries = await Reference.find({
    referenceID: { $in: referenceUsage.entries },
  });

  return {
    format: referenceUsage.format,
    entries: entries.map((entry) => entry.toObject()),
  };
};

/** Upsert the citation format for a project (one ReferenceUsage doc per project). */
export const upsertReferenceFormat = async (
  projectID: string,
  format: string,
  actorUUID: string,
): Promise<ReferenceUsageInterface> => {
  const referenceUsage = await ReferenceUsage.findOneAndUpdate(
    { projectID: { $eq: projectID } },
    {
      $set: {
        format,
        updatedBy: actorUUID,
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
  for (const key of OPTIONAL_REFERENCE_FIELDS) {
    const value = entry[key];
    if (typeof value === "string") {
      fields[key] = value;
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
    throw new ReferenceServiceError(
      "Citation key already exists in this project",
      400,
    );
  }
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
 * - Same project + existing referenceID or citationKey → update in place
 * - Existing referenceID from another project → create a forked copy
 * - Otherwise → create a new reference
 * Then ensure the referenceID is listed on the project's ReferenceUsage.
 */
export const upsertReferenceEntry = async (
  projectID: string,
  entry: ReferenceEntryInput,
  actorUUID: string,
): Promise<ReferenceInterface> => {
  const usage = await getReferencesUsage(projectID);
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

      // Different project → fork into this project
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
      return forked.toObject();
    }
  }

  // ── Lookup by citationKey within this project ────────────────────────────
  const byKey = await Reference.findOne({
    projectID: { $eq: projectID },
    citationKey: { $eq: citationKey },
  });

  if (byKey) {
    byKey.entryType = entryType;
    byKey.updatedBy = actorUUID;
    byKey.updatedAt = now;
    Object.assign(byKey, optionalFields);
    await byKey.save();
    await addEntryToUsage(projectID, byKey.referenceID, actorUUID);
    return byKey.toObject();
  }

  // ── Create new ───────────────────────────────────────────────────────────
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
  const created = await toCreate.save();
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

  await ReferenceUsage.updateOne(
    { projectID: { $eq: projectID } },
    { $pull: { entries: referenceID } },
  );

  if (deleteFromReferences && ownedReference) {
    const otherUsages = await ReferenceUsage.find({
      projectID: { $ne: projectID },
      entries: referenceID,
    });

    let transferred = false;
    for (const usage of otherUsages) {
      const citationConflict = await Reference.findOne({
        projectID: { $eq: usage.projectID },
        citationKey: { $eq: ownedReference.citationKey },
        referenceID: { $ne: referenceID },
      });
      if (citationConflict) {
        continue;
      }

      ownedReference.projectID = usage.projectID;
      ownedReference.updatedAt = new Date();
      await ownedReference.save();
      transferred = true;
      break;
    }

    if (!transferred) {
      if (otherUsages.length > 0) {
        throw new ReferenceServiceError(
          "Reference is still used by another project, but citation key conflicts prevent ownership transfer",
          400,
        );
      }
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

export const addReferencesToUsage = async (
  projectID: string,
  referenceIDs: string[],
): Promise<{ status: boolean }> => {
  const referenceUsage = await ReferenceUsage.findOne({
    projectID: { $eq: projectID },
  });
  if (!referenceUsage) {
    throw new ReferenceServiceError("ReferenceUsage not found", 404);
  }
  if (referenceIDs.length === 0) {
    throw new ReferenceServiceError("No referenceIDs provided", 400);
  }
  const filteredReferenceIDs = referenceIDs.filter(
    (referenceID) => !referenceUsage.entries.includes(referenceID),
  );

  referenceUsage.entries.push(...filteredReferenceIDs);

  await referenceUsage.save();
  return {
    status: true,
  };
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
        buildCitationKey(title, pageID, createdYear || undefined),
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
): Promise<ReferenceInterface[]> => {
  try {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          projectID: {
            $eq: projectID,
          },
        },
      },
      {
        $lookup: {
          from: "reference",
          let: {
            entryIds: "$entries",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    {
                      $toString: "$referenceID",
                    },
                    "$$entryIds",
                  ],
                },
              },
            },
          ],
          as: "output",
        },
      },
      {
        $project: {
          output: 1,
          _id: 0,
        },
      },
      {
        $unwind: "$output",
      },
      {
        $project: {
          "output._id": 0,
          "output.projectID": 0,
          "output.createdBy": 0,
          "output.isFork": 0,
          "output.createdAt": 0,
          "output.updatedAt": 0,
          "output.referenceID": 0,
          "output.updatedBy": 0,
          "output.__v": 0,
        },
      },
    ];
    const referenceItems = await ReferenceUsage.aggregate<{
      output: ReferenceInterface;
    }>(pipeline);
    return referenceItems.map((e) => ({ ...e.output }));
  } catch (error) {
    throw new ReferenceServiceError("Internal server error", 500);
  }
};
