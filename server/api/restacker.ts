import z from "zod";
import Project from "../models/project";
import { ZodReqWithUser } from "../types";
import * as RestackerValidators from "./validators/Restacker";
import projectsAPI from "./projects";
import { Response } from "express";
import BookService from "./services/book-service";
import Restacker from "../models/restacker";
import RestackerService from "../util/Restackerutil";

const getRestackerToc = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.GetRestackerPageSchema>
  >,
  res: Response,
) => {
  const { projectID } = req.params;
  const project = await Project.findOne({ projectID: { $eq: projectID } });
  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }
  if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
    return res.status(403).send({
      err: true,
      errMsg: "You do not have permission to access this project",
    });
  }
  if (!project.libreLibrary || !project.libreCoverID) {
    return res.status(400).send({
      err: true,
      errMsg: "Project does not have access to a LibreTexts book",
    });
  }
  const bookService = new BookService({
    bookID: `${project.libreLibrary}-${project.libreCoverID}`,
  });
  const toc = await bookService.getBookTOCNew();
  var restacker = await Restacker.findOne({ projectID: { $eq: projectID } });
  if (!restacker) {
    type RestackerPage = {
      id: string;
      title: string;
      url: string;
      license: undefined;
      contentLicense: undefined;
      quotation: undefined;
    };
    const flattenPages = (pages: typeof toc.children): RestackerPage[] => {
      return (
        pages?.flatMap((page) => [
          {
            id: page.id,
            title: page.title,
            url: page.url,
            license: undefined,
            contentLicense: undefined,
            quotation: undefined,
          },
          ...flattenPages(page.children ?? []),
        ]) ?? []
      );
    };
    const restackerCurrentBook = flattenPages(toc?.children ?? []);
    const bookpage = {
      id: toc?.id,
      title: toc?.title,
      url: toc?.url,
      license: undefined,
      contentLicense: undefined,
      quotation: undefined,
    };
    restackerCurrentBook.unshift(bookpage);
    restacker = await Restacker.create({
      projectID: projectID,
      createdBy: req.user.decoded.uuid,
      updatedBy: req.user.decoded.uuid,
      restackerCurrentBook: restackerCurrentBook,
    });
  }
  const restackerStatus = restacker.restackerCurrentBook.some(
    (page) => page.status === "pending",
  )
    ? "pending"
    : restacker.restackerCurrentBook.some((page) => page.status === "pending")
      ? "pending"
      : "completed";

  const allPending = restacker.restackerCurrentBook.every(
    (page) => page.status === "pending",
  );
  if (allPending) {
    const restackerService = new RestackerService();
    restackerService.runRestacker(
      projectID,
      project.libreLibrary,
      project.libreCoverID,
    );
  }
  return res.send({
    err: false,
    toc: toc,
    status: restackerStatus,
  });
};

const getRestacker = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.GetRestackerPageSchema>
  >,
  res: Response,
) => {
  const { projectID } = req.params;
  const project = await Project.findOne({ projectID: { $eq: projectID } });
  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }
  if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
    return res.status(403).send({
      err: true,
      errMsg: "You do not have permission to access this project",
    });
  }
  const restacker = await Restacker.findOne({ projectID: { $eq: projectID } });
  if (!restacker) {
    return res.status(404).send({
      err: true,
      errMsg: "Restacker not found",
    });
  }
  return res.send({
    err: false,
    restacker: restacker.restackerCurrentBook.map((page) => ({
      id: page.id,
      license: {
        label: page.license?.label.split(":")[1],
        raw: page.license?.raw.split(":")[1],
        version: page.license?.version?.split(":")[1],
      },
      contentLicense: page.contentLicense,
      quotation: page.quotation,
      status: page.status,
    })),
  });
};

export default {
  getRestackerToc,
  getRestacker,
};
