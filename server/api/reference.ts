import { z } from "zod";
import logger from "../logger.js";
import {
  UpdateReferenceFormatSchema,
  GetReferencePageSchema,
  UpdateReferenceEntrySchema,
  ReferenceEntrySchema,
  SearchReferencesValidator,
  DeleteReferenceEntrySchema,
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
import projectsAPI from "./projects.js";
import {
  getReferencesUsage,
  upsertReferenceFormat,
  upsertReferenceEntry,
  searchReferences as searchReferencesService,
  deleteReferenceEntry as deleteReferenceEntryService,
  ReferenceServiceError,
  addReferencesToUsage,
  createReferenceFromBookPage,
  getReferenceItemsService,
  createReferencePopulateJob,
  saveReferenceScope as saveReferenceScopeService,
  resetReferenceScope as resetReferenceScopeService,
  getScopeGroupsDisplayedOnPage,
  getActivePopulateJob,
} from "./services/references-service.js";
import BookService from "./services/book-service.js";
import GlossaryService from "./services/glossary-service.js";
import { PageReferences } from "../models/referenceusage.js";

async function updateReferenceFormat(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceFormatSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { format, displayLocation, pageTitle, selectedList } = req.body;
    const actorUUID = req.user?.decoded?.uuid ?? "";

    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }

    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }

    const coverID = project.libreCoverID;
    const library = project.libreLibrary;
    if (!coverID || !library) {
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
    logger.error({ err }, "updateReferenceFormat failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

/**
 * Loads a project for a reference-settings write, answering 404/403 itself.
 * @returns The project, or null when a response has already been sent.
 */
async function loadProjectForMember(
  projectID: string,
  user: Parameters<typeof projectsAPI.checkProjectMemberPermission>[1],
  res: Response,
) {
  const project = await Project.findOne({ projectID: { $eq: projectID } });
  if (!project) {
    res.status(404).send({ err: true, errMsg: "Project not found" });
    return null;
  }
  if (!projectsAPI.checkProjectMemberPermission(project, user)) {
    res.status(403).send({
      err: true,
      errMsg: "You do not have permission to access this project",
    });
    return null;
  }
  return project;
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
    const project = await loadProjectForMember(projectID, req.user, res);
    if (!project) return;

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
    logger.error({ err }, "Failed to save reference scope");
    return res.status(500).send({ err: true, errMsg: "Internal server error" });
  }
}

/** Forgets the saved reference scope; the editor falls back to its defaults. */
async function deleteReferenceScope(
  req: ZodReqWithUser<z.infer<typeof DeleteReferenceScopeSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const project = await loadProjectForMember(projectID, req.user, res);
    if (!project) return;

    await resetReferenceScopeService(projectID, req.user?.decoded?.uuid ?? "");
    return res.send({ err: false });
  } catch (err) {
    logger.error({ err }, "Failed to reset reference scope");
    return res.status(500).send({ err: true, errMsg: "Internal server error" });
  }
}

async function getReferenceDetails(
  req: ZodReqWithUser<z.infer<typeof GetReferencePageSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }

    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }

    const referenceUsage = await getReferencesUsage({
      projectID,
      showPageRefs: false,
    });
    if (!referenceUsage) {
      // Nothing set up yet: choosing a format creates the record.
      return res.send({
        err: false,
        data: { entries: [] },
      });
    }
    return res.send({
      err: false,
      data: { ...referenceUsage },
    });
  } catch (err) {
    logger.error({ err }, "getReferenceDetails failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
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

    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }

    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }

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
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "updateReferenceEntry failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function searchReferences(
  req: ZodReqWithUser<z.infer<typeof SearchReferencesValidator>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { query } = req.query;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }
    const references = await searchReferencesService(projectID, query);
    return res.send({
      err: false,
      data: { references },
    });
  } catch (err) {
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "searchReferences failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function deleteReferenceEntry(
  req: ZodReqWithUser<z.infer<typeof DeleteReferenceEntrySchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { referenceID, deleteFromReferences } = req.body;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }
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
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "deleteReferenceEntry failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function addReferenceEntry(
  req: ZodReqWithUser<z.infer<typeof AddReferenceEntrySchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { referenceIDs } = req.body;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }

    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );

    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }
    const statusCode = await addReferencesToUsage(projectID, referenceIDs);
    return res.send({
      err: false,
      data: { status: statusCode.status },
    });
  } catch (err) {
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "addReferenceEntry failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function getBookToc(
  req: ZodReqWithUser<z.infer<typeof tocValidator>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { toc, bookID } = req.query;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }

    if (toc && bookID) {
      const bookService = new BookService({
        bookID: bookID,
      });
      const toc = await bookService.getBookTOCNew();
      return res.send({
        err: false,
        toc,
      });
    }
    return res.status(400).send({
      err: true,
      errMsg: "Invalid request",
    });
  } catch (err) {
    logger.error({ err }, "getBookToc failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
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

    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
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
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "addBookPageAsReference failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function getReferancePageDetails(
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
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }

    // find reference usage by project id
    // return projectID and reference last UpdatedAt
    const referenceUsage = await getReferencesUsage({
      projectID: project.projectID,
      showPageRefs: true,
    });
    const lastUpdatedAt =
      referenceUsage?.entries?.reduce<Date | null>((max, entry) => {
        const updated = entry.updatedAt ? new Date(entry.updatedAt) : null;
        if (!updated) return max;
        if (!max || updated > max) return updated;
        return max;
      }, null) ?? null;

    return res.send({
      err: false,
      data: {
        projectID: project.projectID,
        lastUpdatedAt,
        format: referenceUsage?.format ?? null,
        displayLocation: referenceUsage?.displayLocation ?? null,
        pageTitle: referenceUsage?.pageTitle ?? null,
        backmatterPageID: referenceUsage?.backmatterPageID ?? null,
        backmatterReferenceList: referenceUsage?.backmatterReferenceList ?? [],
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
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "getReferancePageDetails failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function getReferenceItems(
  req: ZodReqWithOptionalUser<z.infer<typeof GetReferenceProjectsSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    const bookService = new BookService({
      bookID: `${project.libreLibrary}-${project.libreCoverID}`,
    });

    type TocIdTree = { id: string; title: string; children: TocIdTree[]; refs: string[] };
    const mapToc = async (
      toc: TableOfContents,
      pageRefs: PageReferences[],
    ): Promise<TocIdTree> => ({
      id: toc.id,
      title: toc.title,
      refs: [
        ...new Set(
          [...pageRefs]
            .reverse()
            .find((pageRef) => pageRef.pageID === toc.id)
            ?.refrences.map((entry) => entry.key) ?? [],
        ),
      ],
      children: await Promise.all(
        toc.children.map((child) => mapToc(child, pageRefs)),
      ),
    });

    const referenceItems = await getReferenceItemsService(projectID);
    const usage = await getReferencesUsage({ projectID, showPageRefs: true });
    const toc = await mapToc(
      await bookService.getBookTOCNew(),
      usage?.pageRefrences ?? [],
    );
    return res.send({
      err: false,
      data: { referenceItems, toc },
    });
  } catch (err) {
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "getReferenceItems failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function populateReferenceDetails(
  req: ZodReqWithUser<z.infer<typeof PopulateReferenceSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    // check canaccess
    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }
    const latestReferencePopulateJob = await getActivePopulateJob(projectID);
    if (!latestReferencePopulateJob) {
      return res.status(200).send({
        err: false,
        data: {},
      });
    }
    return res.send({
      err: false,
      data: {
        status: latestReferencePopulateJob.status,
        message: latestReferencePopulateJob.message,
        totalPages: latestReferencePopulateJob.totalPages,
        completedPages: latestReferencePopulateJob.completedPages,
      },
    });
    //
  } catch (err) {
    logger.error({ err }, "populateReferenceDetails failed");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
  }
}

async function startReferencePopulateJob(
  req: ZodReqWithUser<z.infer<typeof PopulateReferenceSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    // check canaccess
    const project = await Project.findOne({ projectID: { $eq: projectID } });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: "Project not found",
      });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(
      project,
      req.user,
    );
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to access this project",
      });
    }
    // Rejects with 409 when a job is already running for this book.
    const referencePopulateJob = await createReferencePopulateJob(
      projectID,
      req.user?.decoded?.uuid ?? "",
      project,
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
    if (err instanceof ReferenceServiceError) {
      return res.status(err.statusCode).send({
        err: true,
        errMsg: err.message,
      });
    }
    logger.error({ err }, "Failed to start reference populate job");
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
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
  addReferenceEntry,
  getBookToc,
  addBookPageAsReference,
  getReferancePageDetails,
  getReferenceItems,
  populateReferenceDetails,
  startReferencePopulateJob,
};
