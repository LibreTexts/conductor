import z from "zod";
import Project from "../models/project";
import { ZodReqWithUser } from "../types";
import * as RestackerValidators from "./validators/Restacker";
import projectsAPI from "./projects";
import { Response } from "express";
import BookService from "./services/book-service";
import Restacker from "../models/restacker";
import RestackerService from "../util/Restackerutil";

const LICENSES_WITHOUT_VERSION = new Set(["publicdomain", "arr", "ck12"]);

type RestackerLicenseLike = { label: string; raw: string; version?: string };

/** CC license keys supported by the compatibility chart (row/column order). */
const CC_LICENSE_KEYS = [
  "publicdomain",
  "ccby",
  "ccbysa",
  "ccbync",
  "ccbynd",
  "ccbyncsa",
  "ccbyncnd",
] as const;

type CcLicenseKey = (typeof CC_LICENSE_KEYS)[number];

/**
 * Creative Commons license compatibility matrix.
 * Rows = source license, columns = destination (new) license.
 * Mirrors client/src/components/projects/Restacker/util.ts
 */
const CC_COMPATIBILITY_MATRIX: Record<CcLicenseKey, Record<CcLicenseKey, boolean>> = {
  publicdomain: { publicdomain: true, ccby: true, ccbysa: true, ccbync: true, ccbynd: false, ccbyncsa: true, ccbyncnd: false },
  ccby: { publicdomain: true, ccby: true, ccbysa: true, ccbync: true, ccbynd: false, ccbyncsa: true, ccbyncnd: false },
  ccbysa: { publicdomain: true, ccby: true, ccbysa: true, ccbync: false, ccbynd: false, ccbyncsa: false, ccbyncnd: false },
  ccbync: { publicdomain: true, ccby: true, ccbysa: false, ccbync: true, ccbynd: false, ccbyncsa: true, ccbyncnd: false },
  ccbynd: { publicdomain: false, ccby: false, ccbysa: false, ccbync: false, ccbynd: false, ccbyncsa: false, ccbyncnd: false },
  ccbyncsa: { publicdomain: true, ccby: true, ccbysa: false, ccbync: true, ccbynd: false, ccbyncsa: true, ccbyncnd: false },
  ccbyncnd: { publicdomain: false, ccby: false, ccbysa: false, ccbync: false, ccbynd: false, ccbyncsa: false, ccbyncnd: false },
};

/** Strips the "license:" prefix the API adds → "license:ccby" → "ccby" */
function parseLicenseKey(license?: RestackerLicenseLike): string | undefined {
  if (!license?.label) return undefined;
  return license.label.replace(/^license:/, "");
}

function toCcLicenseKey(key: string): CcLicenseKey | undefined {
  return CC_LICENSE_KEYS.find((license) => license === key);
}

/** Returns true/false if compatibility is known, or null if either license is unrecognized. */
function areLicensesCompatible(
  licenseA?: RestackerLicenseLike,
  licenseB?: RestackerLicenseLike,
): boolean | null {
  const keyA = parseLicenseKey(licenseA);
  const keyB = parseLicenseKey(licenseB);
  if (!keyA || !keyB) return null;

  const ccKeyA = toCcLicenseKey(keyA);
  const ccKeyB = toCcLicenseKey(keyB);
  if (!ccKeyA || !ccKeyB) return null;

  return CC_COMPATIBILITY_MATRIX[ccKeyA][ccKeyB];
}

/**
 * Checks a proposed license against a page's known source/content licenses
 * and returns the roles it is definitively incompatible with.
 */
function findLicenseConflicts(
  proposedLicense: RestackerLicenseLike,
  sourceLicense?: RestackerLicenseLike,
  contentLicenses?: RestackerLicenseLike[],
): { role: string; license: RestackerLicenseLike }[] {
  const conflicts: { role: string; license: RestackerLicenseLike }[] = [];

  if (sourceLicense && areLicensesCompatible(proposedLicense, sourceLicense) === false) {
    conflicts.push({ role: "source", license: sourceLicense });
  }
  (contentLicenses ?? []).forEach((license, index) => {
    if (areLicensesCompatible(proposedLicense, license) === false) {
      conflicts.push({ role: `content ${index + 1}`, license });
    }
  });

  return conflicts;
}

function formatVersionDigits(version?: string): string | undefined {
  if (!version) return undefined;
  if (version.includes(".")) {
    const [major, minor] = version.split(".");
    return `${major}${minor}`;
  }
  return version;
}

function buildLicenseTags(
  license: string,
  version?: string,
): string[] {
  if (!license) return [];
  const tags = [`license:${license}`];
  const versionDigits = formatVersionDigits(version);
  if (
    versionDigits &&
    !LICENSES_WITHOUT_VERSION.has(license)
  ) {
    tags.push(`licenseversion:${versionDigits}`);
  }
  return tags;
}

function toRestackerLicense(
  license: string,
  version?: string,
): { label: string; raw: string; version?: string } | undefined {
  if (!license) return undefined;
  const versionDigits = formatVersionDigits(version);
  const versionTag = versionDigits
    ? `licenseversion:${versionDigits}`
    : "";
  return {
    label: `license:${license}`,
    raw: versionTag,
    version: versionTag || undefined,
  };
}

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

const restackerReload = async (
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
  const restackerService = new RestackerService();
  const status = await restackerService.getRestackerStatus(projectID);
 
  if (status === "pending" || status === "processing") {
    return res.status(400).send({
      err: true,
      errMsg: "Restacker is already processing",
    });
  }
  // delete current restacker
  await Restacker.deleteOne({ projectID: { $eq: projectID } });
  // add new restacker same as getRestackerToc function
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
  
  const restackerStatus = await restackerService.getRestackerStatus(projectID);
  // send response 
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
    restacker: restacker.restackerCurrentBook.map((page) => {
      const licenseMap = new Map<string, { label: string; raw: string; version?: string }>();
      for (const license of page.contentLicense ?? []) {
        licenseMap.set(`${license.label}::${license.version}`, license);
      }

      return {
      id: page.id,
      license: {
        label: page.license?.label.split(":")[1],
        raw: page.license?.raw.split(":")[1],
        version: page.license?.version?.split(":")[1],
      },
      contentLicense: licenseMap.size > 0 ? Array.from(licenseMap.values()) : undefined,
      sourceLicense: page.sourceLicense,
      quotation: page.quotation,
      status: page.status,
    }}),
  });
};

const updateRestackerLicense = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.UpdateRestackerLicenseSchema>
  >,
  res: Response,
) => {
  const { projectID } = req.params;
  const { pageID, license, version, force } = req.body;

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

  const restackerBeforeUpdate = await Restacker.findOne({
    projectID: { $eq: projectID },
  });
  const pageBeforeUpdate = restackerBeforeUpdate?.restackerCurrentBook.find(
    (entry) => entry.id === pageID,
  );
  if (!force) {
    const proposedLicense = toRestackerLicense(license, version);
    const conflicts = proposedLicense
      ? findLicenseConflicts(
          proposedLicense,
          pageBeforeUpdate?.sourceLicense,
          pageBeforeUpdate?.contentLicense,
        )
      : [];
    if (conflicts.length > 0) {
      const conflictSummary = conflicts
        .map((c) => `${c.role} (${parseLicenseKey(c.license)})`)
        .join(", ");
      return res.send({
        err: false,
        warning: true,
        warningMsg: `The selected license may be incompatible with this page's ${conflictSummary}. Apply anyway?`,
        conflicts,
      });
    }
  }

  const bookService = new BookService({
    bookID: `${project.libreLibrary}-${project.libreCoverID}`,
  });
  // const canAccess = await bookService.canAccessPage(req.user.decoded.uuid);
  // if (!canAccess) {
  //   return res.status(403).send({
  //     err: true,
  //     errMsg: "You do not have permission to update this page",
  //   });
  // }

  const currentTags = await bookService.getPageTags(pageID);
  const preservedTags = currentTags
    .map((tag) => tag["@value"])
    .filter(
      (tag) =>
        !tag.startsWith("license:") && !tag.startsWith("licenseversion:"),
    );
  const licenseTags = buildLicenseTags(license, version);
  const tags = [...preservedTags, ...licenseTags];

  const [error, success] = await bookService.updatePageDetails(
    pageID,
    undefined,
    tags,
  );

  if (error || !success) {
    return res.status(500).send({
      err: true,
      errMsg: "Failed to update page license",
    });
  }

  const restacker = await Restacker.findOne({ projectID: { $eq: projectID } });
  if (restacker) {
    const page = restacker.restackerCurrentBook.find((entry) => entry.id === pageID);
    if (page) {
      page.license = toRestackerLicense(license, version);
      await Restacker.updateOne(
        { projectID: { $eq: projectID } },
        { $set: { restackerCurrentBook: restacker.restackerCurrentBook } },
      );
    }
  }

  const updatedLicense = toRestackerLicense(license, version);

  return res.send({
    err: false,
    license: updatedLicense
      ? {
          label: license,
          raw: formatVersionDigits(version) ?? "",
          version: formatVersionDigits(version),
        }
      : undefined,
  });
};

export default {
  getRestackerToc,
  getRestacker,
  restackerReload,
  updateRestackerLicense,
};
