import logger from "../logger.js";
import { conductor500Err } from "../util/errorutils.js";
import { z } from "zod";
import Project from "../models/project";
import { ZodReqWithUser } from "../types";
import * as RestackerValidators from "./validators/Restacker";
import projectsAPI from "./projects";
import { Response } from "express";
import BookService from "./services/book-service";
import Restacker from "../models/restacker";
import RestackerService, { type RestackerRefreshMode } from "../util/Restackerutil";
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
 * Mirrors client/src/components/projects/Restacker/util.ts
 */
const CC_COMPATIBILITY_MATRIX: Record<
  CcLicenseKey,
  Record<CcLicenseKey, boolean>
> = {
  publicdomain: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccby: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbysa: {
    publicdomain: true,
    ccby: true,
    ccbysa: true,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbync: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbynd: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbyncsa: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: true,
    ccbyncnd: false,
  },
  ccbyncnd: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
};

const EMPTY_LICENSE: RestackerLicenseLike = { label: "", raw: "" };

/** Strips the "license:" prefix the API adds → "license:ccby" → "ccby" */
function parseLicenseKey(license?: RestackerLicenseLike): string | undefined {
  if (!license?.label) return undefined;
  return license.label.replace(/^license:/, "");
}

function parseLicenseVersion(version?: string): string | undefined {
  if (!version) return undefined;
  const v = version.replace(/^licenseversion:/, "");
  return v.replace(/^(\d)(\d)$/, "$1.$2");
}

function toCcLicenseKey(key: string): CcLicenseKey | undefined {
  return CC_LICENSE_KEYS.find((license) => license === key);
}

/**
 * Returns true/false if compatibility is known, or null if either license is
 * unrecognized. Mirrors client areLicensesCompatible(licenseAdption, licenseOrigin).
 */
function areLicensesCompatible(
  licenseAdption?: RestackerLicenseLike,
  licenseOrigin?: RestackerLicenseLike,
): boolean | null {
  const keyAdption = parseLicenseKey(licenseAdption);
  const keyOrigin = parseLicenseKey(licenseOrigin);
  if (!keyAdption || !keyOrigin) return null;

  const ccKeyAdption = toCcLicenseKey(keyAdption);
  const ccKeyOrigin = toCcLicenseKey(keyOrigin);
  if (!ccKeyAdption || !ccKeyOrigin) return null;

  const compatibility = CC_COMPATIBILITY_MATRIX[ccKeyAdption][ccKeyOrigin];
  if (!compatibility) return false;
  const versionAdption = parseLicenseVersion(licenseAdption?.version);
  const versionOrigin = parseLicenseVersion(licenseOrigin?.version);
  if (versionAdption && versionOrigin) {
    return parseFloat(versionAdption) >= parseFloat(versionOrigin);
  }
  return compatibility;
}

function formatVersionDigits(version?: string): string | undefined {
  if (!version) return undefined;
  if (version.includes(".")) {
    const [major, minor] = version.split(".");
    return `${major}${minor}`;
  }
  return version;
}

/** Same shape as client buildLicenseFromDraft — used for proposed-license checks. */
function buildLicenseFromDraft(
  license: string,
  version?: string,
): RestackerLicenseLike {
  if (!license) return EMPTY_LICENSE;
  const versionDigits = formatVersionDigits(version);
  return {
    label: license,
    raw: versionDigits ?? "",
    version: versionDigits,
  };
}

type LicenseConflict = {
  role: string;
  license: RestackerLicenseLike;
  pageTitle?: string;
};

/**
 * Mirrors client getProposedLicenseCompliance for a page (or book-cover) license change.
 * Returns only definitive incompatibilities (compatible === false).
 */
function findLicenseConflicts(params: {
  field: "book" | "page";
  proposedLicense: RestackerLicenseLike;
  bookLicense?: RestackerLicenseLike;
  sourceLicense?: RestackerLicenseLike;
  contentLicenses?: RestackerLicenseLike[];
  /** Required for book-wide checks: other pages' current page licenses. */
  allPages?: { title: string; pageLicense?: RestackerLicenseLike }[];
}): LicenseConflict[] {
  const {
    field,
    proposedLicense,
    bookLicense,
    sourceLicense,
    contentLicenses,
    allPages,
  } = params;
  const conflicts: LicenseConflict[] = [];

  // Book license applies book-wide: proposed book ↔ each page license
  if (field === "book") {
    for (const page of allPages ?? []) {
      if (
        areLicensesCompatible(
          proposedLicense,
          page.pageLicense ?? EMPTY_LICENSE,
        ) === false
      ) {
        conflicts.push({
          role: "page",
          license: page.pageLicense ?? EMPTY_LICENSE,
          pageTitle: page.title,
        });
      }
    }
    return conflicts;
  }

  const pageLicense = proposedLicense;
  const effectiveBookLicense = bookLicense ?? EMPTY_LICENSE;

  // 1. Book (adapting) ↔ Page (original)
  if (
    areLicensesCompatible(effectiveBookLicense, pageLicense) === false
  ) {
    conflicts.push({ role: "book", license: effectiveBookLicense });
  }

  // 2. Page ↔ Source — exact license+version match (client behavior)
  const pageKey = parseLicenseKey(pageLicense);
  const sourceKey = parseLicenseKey(sourceLicense);
  if (sourceKey) {
    const pageVersion = parseLicenseVersion(pageLicense.version);
    const sourceVersion = parseLicenseVersion(sourceLicense?.version);
    const compatible =
      pageKey?.toLowerCase() === sourceKey.toLowerCase() &&
      (pageVersion ?? "") === (sourceVersion ?? "");
    if (!compatible && sourceLicense) {
      conflicts.push({ role: "source", license: sourceLicense });
    }
  }

  // 3. Page ↔ each Content license
  (contentLicenses ?? []).forEach((license, index) => {
    if (areLicensesCompatible(pageLicense, license) === false) {
      conflicts.push({ role: `content ${index + 1}`, license });
    }
  });

  return conflicts;
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

/**
 * Writes `license` onto only the given pages of the stored restacker, so concurrent
 * edits to other pages (e.g. a parent page and its subpages) can't overwrite each other.
 */
async function setStoredPageLicenses(
  projectID: string,
  pageIDs: string[],
  license: RestackerLicenseLike | undefined,
) {
  if (pageIDs.length === 0) return;
  const path = "restackerCurrentBook.$[page].license";
  await Restacker.updateOne(
    { projectID: { $eq: projectID } },
    license ? { $set: { [path]: license } } : { $unset: { [path]: "" } },
    { arrayFilters: [{ "page.id": { $in: pageIDs } }] },
  );
}

const getRestackerToc = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.GetRestackerPageSchema>
  >,
  res: Response,
) => {
  try {
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

    const restackerService = new RestackerService();
    const restackerStatus = await restackerService.getRestackerStatus(restacker);

    if (restackerStatus.allPending && !restacker.processing) {
      restackerService.runRestacker(
        projectID,
        project.libreLibrary,
        project.libreCoverID,
      ).catch((err) => {
        logger.info(`Error running restacker for project ${projectID}: ${err.message}`)
      })
    }
    return res.send({
      err: false,
      toc: toc,
      status: restackerStatus.statusCode,
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "getRestackerToc failed");
    return conductor500Err(res);
  }
};

type RestackerPageSeed = {
  id: string;
  title: string;
  url: string;
};

/** Flattens the book TOC into restacker page entries, book cover first. */
function flattenTocForRestacker(
  toc: Awaited<ReturnType<BookService["getBookTOCNew"]>>,
): RestackerPageSeed[] {
  const flattenPages = (pages: typeof toc.children): RestackerPageSeed[] =>
    pages?.flatMap((page) => [
      { id: page.id, title: page.title, url: page.url },
      ...flattenPages(page.children ?? []),
    ]) ?? [];
  return [
    { id: toc?.id, title: toc?.title, url: toc?.url },
    ...flattenPages(toc?.children ?? []),
  ];
}

const restackerReload = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.RestackerReloadSchema>
  >,
  res: Response,
) => {
  try {

    const { projectID } = req.params;
    const mode: RestackerRefreshMode = req.body?.mode ?? "content";
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

    if (status.statusCode === "notfound"){
      return res.status(404).send({
        err: true,
        errMsg: "Restacker not found",
      });
    }

    if (status.statusCode === "pending") {
      return res.status(400).send({
        err: true,
        errMsg: "Restacker is already processing",
      });
    }

    const bookService = new BookService({
      bookID: `${project.libreLibrary}-${project.libreCoverID}`,
    });
    const toc = await bookService.getBookTOCNew();
    const tocPages = flattenTocForRestacker(toc);

    if (mode === "page") {
      // Keep each page's content-level data (source/content licenses, quotation) and
      // only re-queue it for a license-tag read. Pages new to the TOC have no content
      // data yet, so the job gives them a full content scan.
      const existing = await Restacker.findOne({ projectID: { $eq: projectID } });
      const existingById = new Map(
        (existing?.toObject().restackerCurrentBook ?? []).map((entry) => [
          entry.id,
          entry,
        ]),
      );
      const restackerCurrentBook = tocPages.map((page) => ({
        ...existingById.get(page.id),
        ...page,
        status: "pending" as const,
      }));
      // Set `processing` in the same write so a concurrent /toc request can't see an
      // all-pending doc and start a second, content-level run.
      await Restacker.updateOne(
        { projectID: { $eq: projectID } },
        {
          $set: {
            restackerCurrentBook,
            processing: true,
            updatedBy: req.user.decoded.uuid,
          },
        },
      );
    } else {
      // Content level: start from scratch so every page is re-scanned.
      await Restacker.deleteOne({ projectID: { $eq: projectID } });
      await Restacker.create({
        projectID: projectID,
        createdBy: req.user.decoded.uuid,
        updatedBy: req.user.decoded.uuid,
        restackerCurrentBook: tocPages.map((page) => ({
          ...page,
          license: undefined,
          contentLicense: undefined,
          quotation: undefined,
        })),
      });
    }

    const restackerStatus = await restackerService.getRestackerStatus(projectID);

    // Kick off the reload job here (fire-and-forget) so the client doesn't have to make a
    // follow-up /toc call to start it; the client polls /restacker/status for progress.
    restackerService.runRestacker(
      projectID,
      project.libreLibrary,
      project.libreCoverID,
      mode,
    ).catch((err) => {
      logger.error({ err, projectID, mode }, "Restacker reload failed");
    });

    // send response
    return res.send({
      err: false,
      toc: toc,
      status: restackerStatus.statusCode,
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "restackerReload failed");
    return conductor500Err(res);
  }
};

const getRestacker = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.GetRestackerPageSchema>
  >,
  res: Response,
) => {
  try {
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
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "getRestacker failed");
    return conductor500Err(res);
  }
};

const updateRestackerLicense = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.UpdateRestackerLicenseSchema>
  >,
  res: Response,
) => {
  try {
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
    // A running refresh periodically rewrites every page, which would undo this edit.
    if (restackerBeforeUpdate?.processing) {
      return res.status(409).send({
        err: true,
        errMsg: "License data is still loading. Try again once it has finished.",
      });
    }
    const pageBeforeUpdate = restackerBeforeUpdate?.restackerCurrentBook.find(
      (entry) => entry.id === pageID,
    );
    const bookCoverId = project.libreCoverID;
    const bookLicense = restackerBeforeUpdate?.restackerCurrentBook.find(
      (entry) => entry.id === bookCoverId,
    )?.license;
    if (!force) {
      const proposedLicense = buildLicenseFromDraft(license, version);
      const field: "book" | "page" =
        pageID === bookCoverId ? "book" : "page";
      const conflicts = parseLicenseKey(proposedLicense)
        ? findLicenseConflicts({
            field,
            proposedLicense,
            bookLicense,
            sourceLicense: pageBeforeUpdate?.sourceLicense,
            // Model field is singular `contentLicense` but stores an array
            // (client maps it to `contentLicenses`).
            contentLicenses: pageBeforeUpdate?.contentLicense,
            allPages:
              field === "book"
                ? (restackerBeforeUpdate?.restackerCurrentBook ?? [])
                    .filter((entry) => entry.id !== bookCoverId)
                    .map((entry) => ({
                      title: entry.title,
                      pageLicense: entry.license,
                    }))
                : undefined,
          })
        : [];
      if (conflicts.length > 0) {
        const conflictSummary = conflicts
          .map((c) => {
            const key = parseLicenseKey(c.license) ?? "unknown";
            return c.pageTitle
              ? `${c.role} "${c.pageTitle}" (${key})`
              : `${c.role} (${key})`;
          })
          .join(", ");
        return res.send({
          err: false,
          warning: true,
          warningMsg:
            field === "book"
              ? `The selected book license may be incompatible with: ${conflictSummary}. Apply anyway?`
              : `The selected license may be incompatible with this page's ${conflictSummary}. Apply anyway?`,
          conflicts,
        });
      }
    }

    const bookService = new BookService({
      bookID: `${project.libreLibrary}-${project.libreCoverID}`,
    });
  
    const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, pageID);
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to update this page",
      });
    }

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

    const updatedLicense = toRestackerLicense(license, version);
    await setStoredPageLicenses(projectID, [pageID], updatedLicense);

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
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "updateRestackerLicense failed");
    return conductor500Err(res);
  }
};

/**
 * URL substrings that identify structural pages which must always be Public Domain.
 * Mirrors PUBLIC_DOMAIN_PAGE_SUFFIXES in client/src/components/projects/Restacker/index.tsx
 */
const PUBLIC_DOMAIN_PAGE_SUFFIXES = [
  "00%3A_Front_Matter/02%3A_InfoPage",
  "00%3A_Front_Matter/03%3A_Table_of_Contents",
  "00%3A_Front_Matter/04%3A_Licensing",
  "zz%3A_Back_Matter/10%3A_Index",
  "zz%3A_Back_Matter/30%3A_Detailed_Licensing",
];

/** Max number of concurrent page-tag updates sent to the library during a bulk change. */
const BULK_LICENSE_CONCURRENCY = 5;

type BulkLicenseSkipReason =
  | "not-found"
  | "book"
  | "structural"
  | "unchanged"
  | "no-access"
  | "conflict";

/**
 * Applies one license to many pages at once. Pages whose Source or Content
 * licenses conflict with the proposed license are skipped (never forced), as are
 * the book cover page and structural pages that must stay Public Domain.
 * The client expands "recursive" selections into explicit page IDs.
 */
const bulkUpdateRestackerLicense = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.BulkUpdateRestackerLicenseSchema>
  >,
  res: Response,
) => {
  try {
    const { projectID } = req.params;
    const { pageIDs, license, version } = req.body;

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

    const restacker = await Restacker.findOne({ projectID: { $eq: projectID } });
    if (!restacker) {
      return res.status(404).send({
        err: true,
        errMsg: "Restacker not found",
      });
    }
    if (restacker.processing) {
      return res.status(409).send({
        err: true,
        errMsg: "License data is still loading. Try again once it has finished.",
      });
    }

    const bookService = new BookService({
      bookID: `${project.libreLibrary}-${project.libreCoverID}`,
    });
    const bookPageIDs = new Set(await bookService.getBookPageIDs(false));
    const bookCoverId = project.libreCoverID;
    const pagesById = new Map(
      restacker.restackerCurrentBook.map((entry) => [entry.id, entry]),
    );
    const proposedLicense = buildLicenseFromDraft(license, version);
    const proposedKey = parseLicenseKey(proposedLicense);
    const proposedVersion = parseLicenseVersion(proposedLicense.version);

    const skipped: {
      pageID: string;
      reason: BulkLicenseSkipReason;
      conflicts?: LicenseConflict[];
    }[] = [];
    const toUpdate: string[] = [];

    for (const pageID of new Set(pageIDs)) {
      const page = pagesById.get(pageID);
      if (!page) {
        skipped.push({ pageID, reason: "not-found" });
        continue;
      }
      if (pageID === bookCoverId) {
        skipped.push({ pageID, reason: "book" });
        continue;
      }
      if (
        PUBLIC_DOMAIN_PAGE_SUFFIXES.some((s) => page.url?.includes(s)) &&
        proposedKey !== "publicdomain"
      ) {
        skipped.push({ pageID, reason: "structural" });
        continue;
      }
      if (
        (parseLicenseKey(page.license) ?? "") === (proposedKey ?? "") &&
        (parseLicenseVersion(page.license?.version) ?? "") ===
          (proposedVersion ?? "")
      ) {
        skipped.push({ pageID, reason: "unchanged" });
        continue;
      }
      if (!bookPageIDs.has(pageID)) {
        skipped.push({ pageID, reason: "no-access" });
        continue;
      }
      // Only Source/Content conflicts block a bulk change; the book license is
      // the adapting license and is reviewed separately.
      const conflicts = proposedKey
        ? findLicenseConflicts({
            field: "page",
            proposedLicense,
            sourceLicense: page.sourceLicense,
            contentLicenses: page.contentLicense,
          }).filter((c) => c.role !== "book")
        : [];
      if (conflicts.length > 0) {
        skipped.push({ pageID, reason: "conflict", conflicts });
        continue;
      }
      toUpdate.push(pageID);
    }

    const licenseTags = buildLicenseTags(license, version);
    const updated: string[] = [];
    const failed: string[] = [];

    const updatePage = async (pageID: string) => {
      try {
        const currentTags = await bookService.getPageTags(pageID);
        const preservedTags = currentTags
          .map((tag) => tag["@value"])
          .filter(
            (tag) =>
              !tag.startsWith("license:") && !tag.startsWith("licenseversion:"),
          );
        const [error, success] = await bookService.updatePageDetails(
          pageID,
          undefined,
          [...preservedTags, ...licenseTags],
        );
        if (error || !success) throw new Error(error ?? "unknown");
        updated.push(pageID);
      } catch (err) {
        logger.warn({ err, projectID, pageID }, "Bulk license update failed for page");
        failed.push(pageID);
      }
    };

    const queue = [...toUpdate];
    await Promise.all(
      Array.from(
        { length: Math.min(BULK_LICENSE_CONCURRENCY, queue.length) },
        async () => {
          for (let next = queue.shift(); next; next = queue.shift()) {
            await updatePage(next);
          }
        },
      ),
    );

    await setStoredPageLicenses(
      projectID,
      updated,
      toRestackerLicense(license, version),
    );

    logger.info(
      {
        projectID,
        requested: pageIDs.length,
        updated: updated.length,
        skipped: skipped.length,
        failed: failed.length,
      },
      "Bulk license update finished",
    );

    return res.send({
      err: false,
      license: proposedKey
        ? {
            label: license,
            raw: formatVersionDigits(version) ?? "",
            version: formatVersionDigits(version),
          }
        : undefined,
      updated,
      skipped,
      failed,
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "bulkUpdateRestackerLicense failed");
    return conductor500Err(res);
  }
};

/**
 * URL substrings that identify structural pages which must always be Public Domain.
 * Mirrors PUBLIC_DOMAIN_PAGE_SUFFIXES in client/src/components/projects/Restacker/index.tsx
 */
const PUBLIC_DOMAIN_PAGE_SUFFIXES = [
  "zz%3A_Back_Matter/10%3A_Index",
  "00%3A_Front_Matter/03%3A_Table_of_Contents",
];

/** Max number of concurrent page-tag updates sent to the library during a bulk change. */
const BULK_LICENSE_CONCURRENCY = 5;

type BulkLicenseSkipReason =
  | "not-found"
  | "book"
  | "structural"
  | "unchanged"
  | "no-access"
  | "conflict";

/**
 * Applies one license to many pages at once. Pages whose Source or Content
 * licenses conflict with the proposed license are skipped (never forced), as are
 * the book cover page and structural pages that must stay Public Domain.
 * The client expands "recursive" selections into explicit page IDs.
 */
const bulkUpdateRestackerLicense = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.BulkUpdateRestackerLicenseSchema>
  >,
  res: Response,
) => {
  const { projectID } = req.params;
  const { pageIDs, license, version } = req.body;

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

  const restacker = await Restacker.findOne({ projectID: { $eq: projectID } });
  if (!restacker) {
    return res.status(404).send({
      err: true,
      errMsg: "Restacker not found",
    });
  }
  if (restacker.processing) {
    return res.status(409).send({
      err: true,
      errMsg: "License data is still loading. Try again once it has finished.",
    });
  }

  const bookService = new BookService({
    bookID: `${project.libreLibrary}-${project.libreCoverID}`,
  });
  const bookPageIDs = new Set(await bookService.getBookPageIDs(false));
  const bookCoverId = project.libreCoverID;
  const pagesById = new Map(
    restacker.restackerCurrentBook.map((entry) => [entry.id, entry]),
  );
  const proposedLicense = buildLicenseFromDraft(license, version);
  const proposedKey = parseLicenseKey(proposedLicense);
  const proposedVersion = parseLicenseVersion(proposedLicense.version);

  const skipped: {
    pageID: string;
    reason: BulkLicenseSkipReason;
    conflicts?: LicenseConflict[];
  }[] = [];
  const toUpdate: string[] = [];

  for (const pageID of new Set(pageIDs)) {
    const page = pagesById.get(pageID);
    if (!page) {
      skipped.push({ pageID, reason: "not-found" });
      continue;
    }
    if (pageID === bookCoverId) {
      skipped.push({ pageID, reason: "book" });
      continue;
    }
    if (
      PUBLIC_DOMAIN_PAGE_SUFFIXES.some((s) => page.url?.includes(s)) &&
      proposedKey !== "publicdomain"
    ) {
      skipped.push({ pageID, reason: "structural" });
      continue;
    }
    if (
      (parseLicenseKey(page.license) ?? "") === (proposedKey ?? "") &&
      (parseLicenseVersion(page.license?.version) ?? "") ===
        (proposedVersion ?? "")
    ) {
      skipped.push({ pageID, reason: "unchanged" });
      continue;
    }
    if (!bookPageIDs.has(pageID)) {
      skipped.push({ pageID, reason: "no-access" });
      continue;
    }
    // Only Source/Content conflicts block a bulk change; the book license is
    // the adapting license and is reviewed separately.
    const conflicts = proposedKey
      ? findLicenseConflicts({
          field: "page",
          proposedLicense,
          sourceLicense: page.sourceLicense,
          contentLicenses: page.contentLicense,
        }).filter((c) => c.role !== "book")
      : [];
    if (conflicts.length > 0) {
      skipped.push({ pageID, reason: "conflict", conflicts });
      continue;
    }
    toUpdate.push(pageID);
  }

  const licenseTags = buildLicenseTags(license, version);
  const updated: string[] = [];
  const failed: string[] = [];

  const updatePage = async (pageID: string) => {
    try {
      const currentTags = await bookService.getPageTags(pageID);
      const preservedTags = currentTags
        .map((tag) => tag["@value"])
        .filter(
          (tag) =>
            !tag.startsWith("license:") && !tag.startsWith("licenseversion:"),
        );
      const [error, success] = await bookService.updatePageDetails(
        pageID,
        undefined,
        [...preservedTags, ...licenseTags],
      );
      if (error || !success) throw new Error(error ?? "unknown");
      updated.push(pageID);
    } catch (err) {
      logger.warn({ err, projectID, pageID }, "Bulk license update failed for page");
      failed.push(pageID);
    }
  };

  const queue = [...toUpdate];
  await Promise.all(
    Array.from(
      { length: Math.min(BULK_LICENSE_CONCURRENCY, queue.length) },
      async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await updatePage(next);
        }
      },
    ),
  );

  if (updated.length > 0) {
    const newLicense = toRestackerLicense(license, version);
    const updatedSet = new Set(updated);
    // Re-read so concurrent single-page edits made while we were writing tags aren't clobbered.
    const latest = await Restacker.findOne({ projectID: { $eq: projectID } });
    if (latest) {
      for (const entry of latest.restackerCurrentBook) {
        if (updatedSet.has(entry.id)) entry.license = newLicense;
      }
      await Restacker.updateOne(
        { projectID: { $eq: projectID } },
        { $set: { restackerCurrentBook: latest.restackerCurrentBook } },
      );
    }
  }

  logger.info(
    {
      projectID,
      requested: pageIDs.length,
      updated: updated.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    "Bulk license update finished",
  );

  return res.send({
    err: false,
    license: proposedKey
      ? {
          label: license,
          raw: formatVersionDigits(version) ?? "",
          version: formatVersionDigits(version),
        }
      : undefined,
    updated,
    skipped,
    failed,
  });
};

/**
 * Lightweight, pollable progress endpoint. Reads only the persisted status counts —
 * it never fetches the book TOC and never triggers a restacker run, so it is safe to poll.
 */
const getRestackerProgress = async (
  req: ZodReqWithUser<
    z.infer<typeof RestackerValidators.GetRestackerPageSchema>
  >,
  res: Response,
) => {
  try {
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

    const restackerService = new RestackerService();
    const status = await restackerService.getRestackerStatus(projectID);

    return res.send({
      err: false,
      status: status.statusCode,
      processing: status.processing ?? false,
      total: status.total ?? 0,
      completed: status.completed ?? 0,
      failed: status.failed ?? 0,
      pending: status.pending ?? 0,
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "getRestackerProgress failed");
    return conductor500Err(res);
  }
};

export default {
  getRestackerToc,
  getRestacker,
  getRestackerProgress,
  restackerReload,
  updateRestackerLicense,
  bulkUpdateRestackerLicense,
};
