import { z } from "zod";
import logger from "../logger.js";
import {
  UpdateReferenceFormatSchema,
  GetReferencePageSchema,
  UpdateReferenceEntrySchema,
  ReferenceEntrySchema,
  SearchReferencesValidator,
  DeleteReferenceEntrySchema,
  BulkDeleteReferenceEntriesSchema,
  AddReferenceEntrySchema,
  tocValidator,
  BookAsReferenceValidator,
  GetReferencePageByPageIDAndLibrarySchema,
  GetReferenceProjectsSchema,
  PopulateReferenceSchema,
  SaveReferenceScopeSchema,
  DeleteReferenceScopeSchema,
} from "./validators/Reference.js";
import { Response } from "express";
import Project from "../models/project.js";
import {
  TableOfContents,
  ZodReqWithOptionalUser,
  ZodReqWithUser,
} from "../types";
import {
  getReferencesUsage,
  upsertReferenceFormat,
  upsertReferenceEntry,
  searchReferences as searchReferencesService,
  deleteReferenceEntry as deleteReferenceEntryService,
  deleteReferenceEntries as deleteReferenceEntriesService,
  ReferenceServiceError,
  addReferencesToUsage,
  createReferenceFromBookPage,
  getReferenceItemsService,
  createReferencePopulateJob,
  saveReferenceScope as saveReferenceScopeService,
  resetReferenceScope as resetReferenceScopeService,
  getScopeGroupsDisplayedOnPage,
  getActivePopulateJob,
  isInCommonsCatalog,
} from "./services/references-service.js";
import BookService from "./services/book-service.js";
import GlossaryService from "./services/glossary-service.js";
import {
  ProjectContext,
  ProjectError,
  returnProjectError,
  type ProjectPermissionShape,
} from "./services/project-context.js";
import { PageReferences } from "../models/referenceusage.js";
import { ReferencePopulateJob } from "../models/referencepopulatejob.js";
import { collectCitations } from "../util/referenceCitations.js";
import { isValidCitationKey } from "../util/referenceSanitize.js";

/**
 * Get the reference permissions for a user within a project context.
 * Determines if the user can reference pages and view restricted pages.
 * Slightly more verbose at each call site, but provides a single,
 * consistent place to determine reference permissions.
 * @param projectID The ID of the project context.
 * @param bookID The ID of the book to check permissions for, or null (will effectively fail closed if null is passed and useProjectOwnBookID falsey).
 * @param user The user whose permissions are being checked.
 * @param opts Options for determining reference permissions, including whether to use the project's linked book ID and whether membership is required.
 * @returns An object containing the project context, reference permissions, and membership status.
 */
async function getReferencePermissions(
  projectID: string,
  bookID: string | null,
  user: unknown,
  opts: { useProjectOwnBookID?: boolean; requireMember?: boolean } = {},
) {
  const ctx = await ProjectContext.load(projectID, { select: [] });
  const isMember = ctx.canMember(user);
  if (opts.requireMember && !isMember) throw new ProjectError("unauthorized");

  const linkedBook = ctx.getLinkedBook();
  const resolvedBookID = opts.useProjectOwnBookID ? linkedBook : bookID;
  const isLinkedBook = !!linkedBook && resolvedBookID === linkedBook;

  const isInCommons = !isLinkedBook && !!resolvedBookID
    ? await isInCommonsCatalog(resolvedBookID)
    : false;

  return {
    /**
     * The project context for the current request. If the project doesn't
     * exist, ProjectContext.load will throw an error, so a nullish value will technically
     * never be returned.
     */
    ctx,
    /**
     * Whether the current user is a member of the project.
     */
    isMember,
    /**
     * The book linked to the project, if any.
     */
    linkedBook,
    /**
     * If the user is a member and the requested book is the one linked to
     * to the project, they can reference it. Otherwise, the user can only
     * reference the requested book if it is in the public Commons catalog.
    */
    canReference: (isMember && isLinkedBook) || isInCommons,
    /**
     * To view restricted pages, the user must be a member and the requested
     * book must be the one linked to the project.
     */
    canViewRestricted: isMember && isLinkedBook,
  };
}

/** Shared error answer for reference handlers. */
function sendReferenceError(res: Response, err: unknown, context: string) {
  if (err instanceof ProjectError) return returnProjectError(res, err);
  if (err instanceof ReferenceServiceError) {
    return res.status(err.statusCode).send({
      err: true,
      errMsg: err.message,
    });
  }
  logger.error({ err }, `${context} failed`);
  return res.status(500).send({
    err: true,
    errMsg: "Internal server error",
  });
}

async function updateReferenceFormat(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceFormatSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { format, displayLocation, pageTitle, selectedList } = req.body;
    const actorUUID = req.user?.decoded?.uuid ?? "";

    const { linkedBook } = await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    if (!linkedBook) {
      return res.status(400).send({
        err: true,
        errMsg: "Project does not have a cover or library",
      });
    }

    const referenceUsage = await upsertReferenceFormat(
      projectID,
      format,
      actorUUID,
      {
        ...(displayLocation !== undefined ? { displayLocation } : {}),
        ...(pageTitle !== undefined ? { pageTitle } : {}),
        ...(displayLocation === "endOfChapter" &&
          selectedList !== undefined &&
          selectedList?.length > 0
          ? { selectedList }
          : {}),
      },
    );

    return res.send({
      err: false,
      data: {
        format: referenceUsage.format,
        displayLocation: referenceUsage.displayLocation,
        pageTitle: referenceUsage.pageTitle,
        selectedList: referenceUsage.selectedList,
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "updateReferenceFormat");
  }
}

/**
 * Saves the reference format and scope (mode + groups), mirroring the
 * glossary scope. The legacy display fields are derived from the scope.
 */
async function saveReferenceScope(
  req: ZodReqWithUser<z.infer<typeof SaveReferenceScopeSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const referenceUsage = await saveReferenceScopeService(
      projectID,
      req.user?.decoded?.uuid ?? "",
      req.body,
    );
    return res.send({
      err: false,
      data: {
        format: referenceUsage.format,
        displayLocation: referenceUsage.displayLocation,
        pageTitle: referenceUsage.pageTitle,
        selectedList: referenceUsage.selectedList ?? [],
        scopeMode: referenceUsage.scopeMode,
        scopeGroups: referenceUsage.scopeGroups ?? [],
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "saveReferenceScope");
  }
}

/** Forgets the saved reference scope; the editor falls back to its defaults. */
async function deleteReferenceScope(
  req: ZodReqWithUser<z.infer<typeof DeleteReferenceScopeSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    await resetReferenceScopeService(projectID, req.user?.decoded?.uuid ?? "");
    return res.send({ err: false });
  } catch (err) {
    return sendReferenceError(res, err, "deleteReferenceScope");
  }
}

async function getReferenceDetails(
  req: ZodReqWithUser<z.infer<typeof GetReferencePageSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const referenceUsage = await getReferencesUsage({
      projectID,
      showPageRefs: true,
    });
    if (!referenceUsage) {
      // Nothing set up yet: choosing a format creates the record.
      return res.send({
        err: false,
        data: { entries: [] },
      });
    }

    // Stored citations come only from completed scans (a scan writes them
    // once, on success), so they're meaningful once one has completed. The
    // client compares them with its current references, which keeps the
    // check right as references are added or removed.
    const lastScan = await ReferencePopulateJob.findOne(
      { projectID: { $eq: projectID }, status: { $eq: "completed" } },
      { updatedAt: 1 },
    )
      .sort({ updatedAt: -1 })
      .lean();
    const { pageReferences, ...usage } = referenceUsage;
    const citationCheck = lastScan
      ? {
        checkedAt: lastScan.updatedAt,
        citations: collectCitations(pageReferences ?? []),
      }
      : null;

    return res.send({
      err: false,
      data: { ...usage, citationCheck },
    });
  } catch (err) {
    return sendReferenceError(res, err, "getReferenceDetails");
  }
}

async function updateReferenceEntry(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceEntrySchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { entry } = req.body;
    const actorUUID = req.user?.decoded?.uuid ?? "";

    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const validEntry = ReferenceEntrySchema.safeParse(entry);
    if (!validEntry.success) {
      return res.status(400).send({
        err: true,
        errMsg: "Invalid entry",
      });
    }

    const reference = await upsertReferenceEntry(
      projectID,
      validEntry.data,
      actorUUID,
    );

    return res.send({
      err: false,
      data: {
        referenceID: reference.referenceID,
        citationKey: reference.citationKey,
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "updateReferenceEntry");
  }
}

async function searchReferences(
  req: ZodReqWithUser<z.infer<typeof SearchReferencesValidator>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { query } = req.query;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const references = await searchReferencesService(projectID, query);
    return res.send({
      err: false,
      data: { references },
    });
  } catch (err) {
    return sendReferenceError(res, err, "searchReferences");
  }
}

async function deleteReferenceEntry(
  req: ZodReqWithUser<z.infer<typeof DeleteReferenceEntrySchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { referenceID, deleteFromReferences } = req.body;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const reference = await deleteReferenceEntryService(
      projectID,
      referenceID,
      deleteFromReferences,
    );
    return res.send({
      err: false,
      data: {
        referenceID: reference.referenceID,
        citationKey: reference.citationKey,
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "deleteReferenceEntry");
  }
}

/** Removes the selected references; reports any that couldn't be removed. */
async function deleteReferenceEntries(
  req: ZodReqWithUser<z.infer<typeof BulkDeleteReferenceEntriesSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { referenceIDs, deleteFromReferences } = req.body;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const { removed, failed } = await deleteReferenceEntriesService(
      projectID,
      referenceIDs,
      deleteFromReferences,
    );
    return res.send({ err: false, data: { removed, failed } });
  } catch (err) {
    return sendReferenceError(res, err, "deleteReferenceEntries");
  }
}

async function addReferenceEntry(
  req: ZodReqWithUser<z.infer<typeof AddReferenceEntrySchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { referenceIDs } = req.body;
    await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    const { added, skipped } = await addReferencesToUsage(
      projectID,
      referenceIDs,
    );
    return res.send({
      err: false,
      data: { added, skipped },
    });
  } catch (err) {
    return sendReferenceError(res, err, "addReferenceEntry");
  }
}

/**
 * The requested bookID does NOT necessarily need to be linked to the
 * project for this request (i.e. for adding references from other books),
 * however, this endpoint allows the project members to retrieve data from
 * private pages in the requested book if that is in fact the one they are requesting.
 */
async function getBookToc(
  req: ZodReqWithUser<z.infer<typeof tocValidator>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { toc, bookID } = req.query;

    if (!toc || !bookID) {
      return res.status(400).send({
        err: true,
        errMsg: "Invalid request",
      });
    }

    const { canReference, canViewRestricted } = await getReferencePermissions(
      projectID,
      bookID,
      req.user,
      { requireMember: true }
    );

    // If the user cannot at least reference this book, return unauthorized
    if (!canReference) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    const bookService = new BookService({ bookID });
    return res.send({
      err: false,
      toc: await bookService.getBookTOCNew({
        includeRestricted: canViewRestricted,
      }),
    });
  } catch (err) {
    return sendReferenceError(res, err, "getBookToc");
  }
}

async function addBookPageAsReference(
  req: ZodReqWithUser<z.infer<typeof BookAsReferenceValidator>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { bookID, pageID } = req.body;
    const actorUUID = req.user?.decoded?.uuid ?? "";

    const { canReference } = await getReferencePermissions(
      projectID,
      bookID,
      req.user,
      { requireMember: true }
    );

    if (!canReference) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    const reference = await createReferenceFromBookPage(
      projectID,
      bookID,
      pageID,
      actorUUID,
    );

    return res.send({
      err: false,
      data: {
        referenceID: reference.referenceID,
        citationKey: reference.citationKey,
        entryType: reference.entryType,
        title: reference.title,
        author: reference.author,
        url: reference.url,
        year: reference.year,
        urldate: reference.urldate,
        note: reference.note,
        publisher: reference.publisher,
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "addBookPageAsReference");
  }
}

/** 404 shared by the public routes, so an unlisted book looks like a missing one. */
const sendPublicNotFound = (res: Response) =>
  res.status(404).send({
    err: true,
    errMsg: "Project not found",
  });

/**
 * Public (library script). Only books listed in the Commons catalog are
 * served; editing stays member-only on the `/projects/...` routes.
 */
async function getReferencePageDetails(
  req: ZodReqWithOptionalUser<
    z.infer<typeof GetReferencePageByPageIDAndLibrarySchema>
  >,
  res: Response,
) {
  try {
    const { pageID, library } = req.params;

    // discover cover id
    const candidateCoverIDs = (
      await GlossaryService.getCandidateCoverIDs(parseInt(pageID, 10), library)
    ).map((id) => id.toString());

    // find project by cover id
    const project = await Project.findOne({
      libreCoverID: { $in: candidateCoverIDs },
      libreLibrary: { $eq: library },
    });
    if (
      !project ||
      !(await isInCommonsCatalog(`${library}-${project.libreCoverID}`))
    ) {
      return sendPublicNotFound(res);
    }

    // find reference usage by project id
    // return projectID and reference last UpdatedAt
    const referenceUsage = await getReferencesUsage({
      projectID: project.projectID,
      showPageRefs: true,
    });
    // The library script caches reference items and the citation map until
    // this changes, so it must move on any change: an edited reference, or
    // the book's setup (populate, scope, sharing or removing references).
    const lastUpdatedAt =
      [
        ...(referenceUsage?.entries ?? []).map((entry) => entry.updatedAt),
        referenceUsage?.updatedAt,
      ]
        .filter((date): date is Date => !!date)
        .map((date) => new Date(date))
        .reduce<Date | null>(
          (max, date) => (!max || date > max ? date : max),
          null,
        );

    return res.send({
      err: false,
      data: {
        projectID: project.projectID,
        lastUpdatedAt,
        format: referenceUsage?.format ?? null,
        displayLocation: referenceUsage?.displayLocation ?? null,
        pageTitle: referenceUsage?.pageTitle ?? null,
        backmatterPageID: referenceUsage?.backmatterPageID ?? null,
        backmatterReferenceList: (
          referenceUsage?.backmatterReferenceList ?? []
        ).filter(isValidCitationKey),
        selectedList: referenceUsage?.selectedList ?? [],
        // Scope model (same as the glossary scope). `displayGroups` are the
        // groups whose combined reference list belongs on this page; the
        // legacy fields above are kept, derived from the scope, for the
        // current ReferenceBib template.
        scope: referenceUsage?.scopeMode
          ? {
            mode: referenceUsage.scopeMode,
            groups: referenceUsage.scopeGroups ?? [],
          }
          : null,
        displayGroups: getScopeGroupsDisplayedOnPage(
          referenceUsage?.scopeGroups,
          pageID,
          referenceUsage?.backmatterPageID,
        ),
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "getReferencePageDetails");
  }
}

/** Public (library script); same Commons-catalog gate as getReferencePageDetails. */
async function getReferenceItems(
  req: ZodReqWithOptionalUser<z.infer<typeof GetReferenceProjectsSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;

    type TocIdTree = {
      id: string;
      title: string;
      children: TocIdTree[];
      refs: string[];
    };


    const { linkedBook } = await getReferencePermissions(projectID, null, req.user, { useProjectOwnBookID: true });
    if (!linkedBook || !(await isInCommonsCatalog(linkedBook))) {
      return sendPublicNotFound(res);
    }

    const [referenceItems, usage, bookToc] = await Promise.all([
      getReferenceItemsService(projectID),
      getReferencesUsage({ projectID, showPageRefs: true }),
      new BookService({ bookID: linkedBook }).getBookTOCNew({ includeRestricted: false }), // for public reference endpoint, assume no restricted content should be visible
    ]);

    // One pass over the scan results; a later entry for the same page wins
    // (a re-scanned page is appended after its older entry).
    const refsByPage = new Map<string, string[]>();
    for (const pageRef of (usage?.pageReferences ?? []) as PageReferences[]) {
      refsByPage.set(pageRef.pageID, [
        ...new Set(
          pageRef.references
            .map((entry) => entry.key)
            .filter(isValidCitationKey),
        ),
      ]);
    }

    const mapToc = (node: TableOfContents): TocIdTree => ({
      id: node.id,
      title: node.title,
      refs: refsByPage.get(node.id) ?? [],
      children: node.children.map(mapToc),
    });

    return res.send({
      err: false,
      data: { referenceItems, toc: mapToc(bookToc) },
    });
  } catch (err) {
    // An unknown project is a plain 404 here, like an unlisted book.
    if (err instanceof ProjectError) return sendPublicNotFound(res);
    return sendReferenceError(res, err, "getReferenceItems");
  }
}

async function populateReferenceDetails(
  req: ZodReqWithUser<z.infer<typeof PopulateReferenceSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    await getReferencePermissions(projectID, null, req.user, { useProjectOwnBookID: true, requireMember: true });

    // The running scan if there is one (stalled ones are failed first),
    // otherwise the latest finished scan, so a client watching a scan can
    // tell whether it completed or failed.
    const latestReferencePopulateJob =
      (await getActivePopulateJob(projectID)) ??
      (await ReferencePopulateJob.findOne({ projectID: { $eq: projectID } })
        .sort({ createdAt: -1 })
        .lean());
    if (!latestReferencePopulateJob) {
      return res.status(200).send({
        err: false,
        data: {},
      });
    }
    return res.send({
      err: false,
      data: {
        jobID: latestReferencePopulateJob.jobID,
        status: latestReferencePopulateJob.status,
        message: latestReferencePopulateJob.message,
        totalPages: latestReferencePopulateJob.totalPages,
        completedPages: latestReferencePopulateJob.completedPages,
      },
    });
  } catch (err) {
    return sendReferenceError(res, err, "populateReferenceDetails");
  }
}

async function startReferencePopulateJob(
  req: ZodReqWithUser<z.infer<typeof PopulateReferenceSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;

    const { ctx, linkedBook, canViewRestricted } = await getReferencePermissions(
      projectID,
      null,
      req.user,
      { useProjectOwnBookID: true, requireMember: true }
    );

    if (!linkedBook) {
      return sendReferenceError(res, new Error("No linked book found"), "startReferencePopulateJob");
    }

    // Rejects with 409 when a job is already running for this book.
    const referencePopulateJob = await createReferencePopulateJob(
      projectID,
      req.user?.decoded?.uuid ?? "",
      linkedBook,
      ctx.doc,
      canViewRestricted,
    );

    if (!referencePopulateJob) {
      return res.status(500).send({
        err: true,
        errMsg: "Failed to create reference populate job",
      });
    }
    return res.send({
      err: false,
      success: true,
    });
  } catch (err) {
    return sendReferenceError(res, err, "startReferencePopulateJob");
  }
}

export default {
  saveReferenceScope,
  deleteReferenceScope,
  getReferenceDetails,
  updateReferenceFormat,
  updateReferenceEntry,
  searchReferences,
  deleteReferenceEntry,
  deleteReferenceEntries,
  addReferenceEntry,
  getBookToc,
  addBookPageAsReference,
  getReferencePageDetails,
  getReferenceItems,
  populateReferenceDetails,
  startReferencePopulateJob,
};
