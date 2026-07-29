import { z } from "zod";
import {
  UpdateReferenceFormatSchema,
  GetReferencePageSchema,
  UpdateReferenceEntrySchema,
  ReferenceEntrySchema,
} from "./validators/Reference.js";
import { Response } from "express";
import Project from "../models/project.js";
import { Reference } from "../models/reference.js";
import { ZodReqWithUser } from "../types";
import projectsAPI from "./projects.js";

async function updateReferenceFormat(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceFormatSchema>>,
  res: Response,
) {
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

  const canAccess = projectsAPI.checkProjectMemberPermission(project, req.user);
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

  // Upsert: one reference-format record per project
  const reference = await Reference.findOneAndUpdate(
    { projectID: { $eq: projectID } },
    {
      $set: {
        format: format,
        updatedBy: actorUUID,
      },
      $setOnInsert: {
        projectID,
        createdBy: actorUUID,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  return res.send({
    err: false,
    data: { format: reference.format },
  });
}

async function getReferenceFormat(
  req: ZodReqWithUser<z.infer<typeof GetReferencePageSchema>>,
  res: Response,
) {
  const { projectID } = req.params;
  const project = await Project.findOne({ projectID: { $eq: projectID } });
  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }

  const canAccess = projectsAPI.checkProjectMemberPermission(project, req.user);
  if (!canAccess) {
    return res.status(403).send({
      err: true,
      errMsg: "You do not have permission to access this project",
    });
  }

  const reference = await Reference.findOne({ projectID: { $eq: projectID } });
  if (!reference) {
    return res.status(404).send({
      err: true,
      errMsg: "Reference not found",
    });
  }
  return res.send({
    err: false,
    data: { format: reference.format },
  });
}

async function updateReferenceEntry(
  req: ZodReqWithUser<z.infer<typeof UpdateReferenceEntrySchema>>,
  res: Response,
) {
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
  const canAccess = projectsAPI.checkProjectMemberPermission(project, req.user);
  if (!canAccess) {
    return res.status(403).send({
      err: true,
      errMsg: "You do not have permission to access this project",
    });
  }
  const reference = await Reference.findOne({ projectID: { $eq: projectID } });
  if (!reference) {
    return res.status(404).send({
      err: true,
      errMsg: "Reference not found",
    });
  }
  // Make sure the entry is valid and citationKey is not already in the reference
  const validEntry = ReferenceEntrySchema.safeParse(entry);
  if (!validEntry.success) {
    return res.status(400).send({
      err: true,
      errMsg: "Invalid entry",
    });
  }
  if (reference.entries.some((e) => e.citationKey === entry.citationKey)) {
    return res.status(400).send({
      err: true,
      errMsg: "Citation key already exists",
    });
  }
  reference.entries.push(validEntry.data);
  await reference.save();

  return res.send({
    err: false,
  });
}

export default {
  getReferenceFormat,
  updateReferenceFormat,
  updateReferenceEntry,
};
