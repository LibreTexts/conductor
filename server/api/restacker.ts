import logger from "../logger.js";
import { conductor500Err } from "../util/errorutils.js";
import { z } from "zod";
import Project from "../models/project";
import { ZodReqWithUser } from "../types";
import * as RestackerValidators from "./validators/Restacker";
import projectsAPI from "./projects";
import { Response } from "express";
import { randomUUID } from "node:crypto";
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

/** 409 message while a refresh or bulk update holds the restacker lock. */
const LICENSE_BUSY_MSG =
  "License data is being refreshed or updated. Try again once it has finished.";

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

    // Start a fresh doc, or resume one whose run died mid-way (pending pages, stale
    // lock). runRestacker takes the lock atomically, so concurrent calls can't double-run.
    if (restackerStatus.statusCode === "pending" && !restackerStatus.processing) {
      restackerService.runRestacker(
        projectID,
        project.libreLibrary,
        project.libreCoverID,
      ).catch((err) => {
        logger.error({ err, projectID }, "Restacker run failed");
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

    // Pending pages alone don't block a reload: if their run died, the lock is stale
    // and reloading is how the user recovers.
    if (status.processing) {
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

    // Take the lock before resetting pages, so a concurrent /toc request can't see an
    // all-pending doc and start a second run.
    const lockID = await RestackerService.acquireLock(projectID);
    if (!lockID) {
      return res.status(400).send({
        err: true,
        errMsg: "Restacker is already processing",
      });
    }

    try {
      let restackerCurrentBook;
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
        restackerCurrentBook = tocPages.map((page) => ({
          ...existingById.get(page.id),
          ...page,
          status: "pending" as const,
        }));
      } else {
        // Content level: drop all stored license data so every page is re-scanned.
        restackerCurrentBook = tocPages.map((page) => ({
          ...page,
          status: "pending" as const,
        }));
      }
      await Restacker.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
        {
          $set: {
            restackerCurrentBook,
            updatedBy: req.user.decoded.uuid,
            ...(mode === "content" ? { message: [] } : {}),
          },
        },
      );
    } catch (err) {
      await RestackerService.releaseLock(projectID, lockID);
      throw err;
    }

    // Kick off the reload job here (fire-and-forget) so the client doesn't have to make a
    // follow-up /toc call to start it; the client polls /restacker/status for progress.
    // Started right after the reset so nothing between them can strand the lock.
    restackerService.runRestacker(
      projectID,
      project.libreLibrary,
      project.libreCoverID,
      mode,
      lockID,
    ).catch((err) => {
      logger.error({ err, projectID, mode }, "Restacker reload failed");
    });

    // Every page was just reset to pending.
    return res.send({
      err: false,
      toc: toc,
      status: "pending",
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
    if (RestackerService.isLockActive(restackerBeforeUpdate)) {
      return res.status(409).send({
        err: true,
        errMsg: LICENSE_BUSY_MSG,
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
    if (RestackerService.isLockActive(restacker)) {
      return res.status(409).send({
        err: true,
        errMsg: LICENSE_BUSY_MSG,
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

    const responseLicense = proposedKey
      ? {
          label: license,
          raw: formatVersionDigits(version) ?? "",
          version: formatVersionDigits(version),
        }
      : undefined;

    if (toUpdate.length === 0) {
      return res.send({ err: false, license: responseLicense, queued: 0, skipped });
    }

    // Hold the restacker lock for the whole job: a refresh flushes the entire page
    // list and would otherwise overwrite licenses written here.
    const lockID = await RestackerService.acquireLock(projectID);
    if (!lockID) {
      return res.status(409).send({
        err: true,
        errMsg: LICENSE_BUSY_MSG,
      });
    }

    const jobID = randomUUID();
    try {
      await Restacker.updateOne(
        { projectID: { $eq: projectID } },
        {
          $set: {
            bulkLicenseJob: {
              jobID,
              status: "running",
              total: toUpdate.length,
              processed: 0,
              updated: 0,
              failed: 0,
              skipped: skipped.length,
            },
          },
        },
      );
    } catch (err) {
      await RestackerService.releaseLock(projectID, lockID);
      throw err;
    }

    // Updating hundreds of pages takes minutes (two library calls per page), well past
    // proxy timeouts, so the work runs in the background and the client polls
    // /restacker/status for `bulkJob`.
    RestackerService.withLock(projectID, lockID, () =>
      runBulkLicenseJob({
        projectID,
        jobID,
        bookService,
        pageIDs: toUpdate,
        licenseTags: buildLicenseTags(license, version),
        storedLicense: toRestackerLicense(license, version),
        requested: pageIDs.length,
        skipped: skipped.length,
      }),
    ).catch(async (err) => {
      logger.error({ err, projectID, jobID }, "Bulk license update job failed");
      await Restacker.updateOne(
        { projectID: { $eq: projectID }, "bulkLicenseJob.jobID": { $eq: jobID } },
        { $set: { "bulkLicenseJob.status": "failed" } },
      ).catch((updateErr) => {
        logger.error({ err: updateErr, projectID, jobID }, "Failed to mark bulk license job failed");
      });
    });

    return res.send({
      err: false,
      license: responseLicense,
      jobID,
      queued: toUpdate.length,
      skipped,
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "bulkUpdateRestackerLicense failed");
    return conductor500Err(res);
  }
};

/**
 * Writes one license to each page on the library, recording progress and each
 * page's stored license as it goes so an interrupted job leaves consistent data.
 */
async function runBulkLicenseJob(params: {
  projectID: string;
  jobID: string;
  bookService: BookService;
  pageIDs: string[];
  licenseTags: string[];
  storedLicense: RestackerLicenseLike | undefined;
  requested: number;
  skipped: number;
}) {
  const { projectID, jobID, bookService, pageIDs, licenseTags, storedLicense } = params;
  const jobFilter = {
    projectID: { $eq: projectID },
    "bulkLicenseJob.jobID": { $eq: jobID },
  };
  let updated = 0;
  let failed = 0;

  const updatePage = async (pageID: string) => {
    let ok = false;
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
      ok = true;
      await setStoredPageLicenses(projectID, [pageID], storedLicense);
    } catch (err) {
      logger.warn({ err, projectID, pageID }, "Bulk license update failed for page");
    }
    if (ok) updated += 1;
    else failed += 1;
    await Restacker.updateOne(jobFilter, {
      $inc: {
        "bulkLicenseJob.processed": 1,
        [ok ? "bulkLicenseJob.updated" : "bulkLicenseJob.failed"]: 1,
      },
    }).catch((err) => {
      logger.warn({ err, projectID, jobID }, "Failed to record bulk license progress");
    });
  };

  const queue = [...pageIDs];
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

  // Counters are set outright at the end in case a progress write was lost.
  await Restacker.updateOne(jobFilter, {
    $set: {
      "bulkLicenseJob.status": "completed",
      "bulkLicenseJob.processed": pageIDs.length,
      "bulkLicenseJob.updated": updated,
      "bulkLicenseJob.failed": failed,
    },
  });

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

    const restacker = await Restacker.findOne({ projectID: { $eq: projectID } });
    const restackerService = new RestackerService();
    const status = restacker
      ? await restackerService.getRestackerStatus(restacker)
      : { statusCode: "notfound" as const };

    // A job still "running" after its lock went stale died with the server.
    const bulkJob = restacker?.bulkLicenseJob
      ? {
          jobID: restacker.bulkLicenseJob.jobID,
          status:
            restacker.bulkLicenseJob.status === "running" &&
            !RestackerService.isLockActive(restacker)
              ? ("failed" as const)
              : restacker.bulkLicenseJob.status,
          total: restacker.bulkLicenseJob.total,
          processed: restacker.bulkLicenseJob.processed,
          updated: restacker.bulkLicenseJob.updated,
          failed: restacker.bulkLicenseJob.failed,
          skipped: restacker.bulkLicenseJob.skipped,
        }
      : undefined;

    return res.send({
      err: false,
      status: status.statusCode,
      processing: status.processing ?? false,
      bulkJob,
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
