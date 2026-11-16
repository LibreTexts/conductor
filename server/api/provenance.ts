import type { Request, Response } from "express";
import { childLogger } from "../logger.js";
import { conductor500Err } from "../util/errorutils.js";
import type {
  GetProvenanceGraphRequest,
  RunProvenanceChangesRequest,
  RunProvenanceNotifyRequest,
  RunProvenanceScanRequest,
} from "./validators/provenance.js";
import {
  DEFAULT_SCAN_BUDGET_MS,
  isProvenanceScanRunning,
  runProvenanceScan,
} from "./services/provenance-scan-service.js";
import {
  DEFAULT_CHANGES_BUDGET_MS,
  isProvenanceChangesRunning,
  runLibraryChanges,
} from "./services/provenance-events-service.js";
import {
  getBookGraph,
  getLibraryReuseStats,
} from "./services/provenance-insights-service.js";
import {
  isProvenanceNotifyRunning,
  runSourceChangeNotifications,
} from "./services/provenance-notify-service.js";

const log = childLogger("provenance-scan");

/**
 * Starts one time-boxed slice of the provenance backfill scanner and answers
 * right away (202): a slice runs for minutes, longer than a load balancer
 * keeps a request open. Triggered externally on a schedule, like the other
 * automation endpoints; each call resumes where the last one stopped.
 *
 * `?library=chem,bio` limits the run, `?minutes=` sets its budget (default 10,
 * at most 55), `?force=true` re-scans libraries that completed recently.
 */
async function runScanJob(req: Request, res: Response) {
  try {
    const { library, book, minutes, force } =
      req.query as unknown as RunProvenanceScanRequest["query"];

    if (isProvenanceScanRunning()) {
      return res.status(202).send({
        err: false,
        started: false,
        msg: "A provenance scan is already running on this instance.",
      });
    }

    const libraries = library ? library.split(",") : undefined;
    const budgetMs = minutes ? minutes * 60 * 1000 : DEFAULT_SCAN_BUDGET_MS;

    const books = book ? book.split(",") : undefined;

    void runProvenanceScan({ libraries, books, budgetMs, force }).catch((err) =>
      log.error({ err }, "Provenance scan run failed"),
    );

    return res.status(202).send({ err: false, started: true });
  } catch (err) {
    log.error({ err }, "runScanJob failed");
    return conductor500Err(res);
  }
}

const notifyLog = childLogger("provenance-notify");

/**
 * Emails each project lead one digest of the reused pages that changed or
 * were deleted since the last run. Triggered externally, daily. Answers 202
 * right away and sends in the background; `?dryRun=true` instead answers with
 * the digests it would send, without sending or changing anything.
 */
async function runNotifyJob(req: Request, res: Response) {
  try {
    const { dryRun } = req.query as unknown as RunProvenanceNotifyRequest["query"];

    if (dryRun) {
      const outcome = await runSourceChangeNotifications({ dryRun: true });
      return res.send({ err: false, ...outcome });
    }

    if (isProvenanceNotifyRunning()) {
      return res.status(202).send({
        err: false,
        started: false,
        msg: "Source-change notifications are already running on this instance.",
      });
    }

    void runSourceChangeNotifications().catch((err) =>
      notifyLog.error({ err }, "Source-change notification run failed"),
    );
    return res.status(202).send({ err: false, started: true });
  } catch (err) {
    notifyLog.error({ err }, "runNotifyJob failed");
    return conductor500Err(res);
  }
}

const insightsLog = childLogger("provenance-insights");

/** Reuse totals and scan progress per library, for LibreTexts staff. */
async function getStats(_req: Request, res: Response) {
  try {
    const libraries = await getLibraryReuseStats();
    return res.send({ err: false, data: { libraries } });
  } catch (err) {
    insightsLog.error({ err }, "getStats failed");
    return conductor500Err(res);
  }
}

/** The book connection graph, for LibreTexts staff. */
async function getGraph(req: Request, res: Response) {
  try {
    const { library, minPages, limit } =
      req.query as unknown as GetProvenanceGraphRequest["query"];
    const data = await getBookGraph({ library, minPages, limit });
    return res.send({ err: false, data });
  } catch (err) {
    insightsLog.error({ err }, "getGraph failed");
    return conductor500Err(res);
  }
}

const changesLog = childLogger("provenance-events");

/**
 * Reads every library's change feed (`events/page-hierarchy`) from where the
 * last run stopped, applies it, and re-reads the books it showed changes in.
 * Triggered externally once or a few times a day, before notify. Answers 202
 * and works in the background; `?dryRun=true` instead answers with the
 * planned actions, writing nothing.
 */
async function runChangesJob(req: Request, res: Response) {
  try {
    const { library, minutes, dryRun } =
      req.query as unknown as RunProvenanceChangesRequest["query"];
    const libraries = library ? library.split(",") : undefined;
    const budgetMs = minutes ? minutes * 60 * 1000 : DEFAULT_CHANGES_BUDGET_MS;

    if (dryRun) {
      const outcome = await runLibraryChanges({ libraries, budgetMs, dryRun: true });
      return res.send({ err: false, ...outcome });
    }
    if (isProvenanceChangesRunning()) {
      return res.status(202).send({
        err: false,
        started: false,
        msg: "The changes job is already running on this instance.",
      });
    }
    void runLibraryChanges({ libraries, budgetMs }).catch((err) =>
      changesLog.error({ err }, "Changes job failed"),
    );
    return res.status(202).send({ err: false, started: true });
  } catch (err) {
    changesLog.error({ err }, "runChangesJob failed");
    return conductor500Err(res);
  }
}

export default {
  runChangesJob,
  runScanJob,
  runNotifyJob,
  getStats,
  getGraph,
};
