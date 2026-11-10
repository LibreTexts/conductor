import type { Request, Response } from "express";
import { childLogger } from "../logger.js";
import { conductor500Err } from "../util/errorutils.js";
import type { RunProvenanceScanRequest } from "./validators/provenance.js";
import {
  DEFAULT_SCAN_BUDGET_MS,
  isProvenanceScanRunning,
  runProvenanceScan,
} from "./services/provenance-scan-service.js";

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
    const { library, minutes, force } =
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

    void runProvenanceScan({ libraries, budgetMs, force }).catch((err) =>
      log.error({ err }, "Provenance scan run failed"),
    );

    return res.status(202).send({ err: false, started: true });
  } catch (err) {
    log.error({ err }, "runScanJob failed");
    return conductor500Err(res);
  }
}

export default {
  runScanJob,
};
