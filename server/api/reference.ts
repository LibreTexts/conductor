import { z } from "zod";
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
} from "./validators/Reference.js";
import { Response } from "express";
import Project from "../models/project.js";
import { TableOfContents, ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
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
} from "./services/references-service.js";
import BookService from "./services/book-service.js";
import GlossaryService from "./services/glossary-service.js";
import { ReferencePopulateJob } from "../models/referencepopulatejosb.js";
import { PageReferences } from "../models/referenceusage.js";

async function updateReferenceFormat(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceFormatSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { format, displayLocation, pageTitle } = req.body;
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
      },
    );

    return res.send({
      err: false,
      data: {
        format: referenceUsage.format,
        displayLocation: referenceUsage.displayLocation,
        pageTitle: referenceUsage.pageTitle,
      },
    });
  } catch (error) {
    return res.status(500).send({
      err: true,
      errMsg: "Internal server error",
    });
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

    const referenceUsage = await getReferencesUsage(projectID);
    if (!referenceUsage) {
      return res.status(404).send({
        err: true,
        errMsg: "ReferenceUsage not found",
      });
    }
    return res.send({
      err: false,
      data: { ...referenceUsage },
    });
  } catch (error) {
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
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
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
  } catch (error) {
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
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
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
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
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
  } catch (error) {
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
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
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
    const referenceUsage = await getReferencesUsage({projectID: project.projectID, showPageRefs: false});
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
      },
    });
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
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

    type TocIdTree = { id: string; children: TocIdTree[] , refs:string[] };
    const mapToc = async (toc: TableOfContents, pageRefs: PageReferences[]): Promise<TocIdTree> => ({
      id: toc.id,
      refs: [
        ...new Set(
          [...pageRefs]
            .reverse()
            .find((pageRef) => pageRef.pageID === toc.id)
            ?.refrences.map((entry) => entry.key) ?? [],
        ),
      ],
      children: await Promise.all(toc.children.map((child) => mapToc(child, pageRefs))),
    });
 

    const referenceItems = await getReferenceItemsService(projectID);
    const usage = await getReferencesUsage({projectID, showPageRefs: true});
    const toc = await mapToc(await bookService.getBookTOCNew(), usage?.pageRefrences ?? []);
    return res.send({
      err: false,
      data: { referenceItems, toc },
    });
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
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
    // get Latest ReferencePopulateJob
    const latestReferencePopulateJob = await ReferencePopulateJob.findOne({
      projectID: { $eq: projectID }, status: { $eq: "pending" }
    })
      .sort({ createdAt: -1 })
      .limit(1);
    if (!latestReferencePopulateJob) {
      return res.status(404).send({
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
  } catch (error) {
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
    try {
      // check if there is a pending reference populate job
      const pendingReferencePopulateJob = await ReferencePopulateJob.findOne({
        projectID: { $eq: projectID, status: { $eq: "pending" } },
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (pendingReferencePopulateJob) {
        return res.status(400).send({
          err: true,
          errMsg: "A reference populate job is already pending",
        });
      }
    } catch (error) {}

    // create a new reference populate job
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
  } catch (error) {
    if (error instanceof ReferenceServiceError) {
      return res.status(error.statusCode).send({
        err: true,
        errMsg: error.message,
      });
    }
  }
}

export default {
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
