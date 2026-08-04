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
} from "./validators/Reference.js";
import { Response } from "express";
import Project from "../models/project.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
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
} from "./services/references-service.js";
import BookService from "./services/book-service.js";
import GlossaryService from "./services/glossary-service.js";

async function updateReferenceFormat(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceFormatSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const { format } = req.body;
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
    );

    return res.send({
      err: false,
      data: { format: referenceUsage.format },
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
  req: ZodReqWithOptionalUser<z.infer<typeof GetReferencePageByPageIDAndLibrarySchema>>,
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
    const referenceUsage = await getReferencesUsage(project.projectID);
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
  req: ZodReqWithUser<z.infer<typeof GetReferenceProjectsSchema>>,
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
    const referenceItems = await getReferenceItemsService(projectID);
    return res.send({
      err: false,
      data: { referenceItems },
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
  getReferenceItems
};
