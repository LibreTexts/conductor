/**
 * @file Handlers for "What's New in Conductor" entries: one read route that
 *  serves the single notice a user should currently see, plus authoring CRUD
 *  restricted to the `developer` role (see the route block in api.js).
 * @author LibreTexts <info@libretexts.org>
 */

import { z } from "zod";
import { Response } from "express";
import { childLogger } from "../logger.js";
import WhatsNew, {
  WhatsNewInterface,
  WHATS_NEW_DEFAULT_STALE_DAYS,
} from "../models/whatsnew.js";
import {
  CreateWhatsNewEntryValidator,
  DeleteWhatsNewEntryValidator,
  GetWhatsNewEntriesValidator,
  UpdateWhatsNewEntryValidator,
} from "./validators/whatsnew.js";
import { ZodReqWithUser } from "../types/Express.js";
import {
  conductor400Err,
  conductor404Err,
  conductor500Err,
} from "../util/errorutils.js";
import { getPaginationOffset } from "../util/helpers.js";

const whatsNewLog = childLogger("whats-new");

const MS_PER_DAY = 86400000;

/** Fields safe to expose on the public read route. */
const PUBLIC_PROJECTION = {
  title: 1,
  body: 1,
  publishedAt: 1,
  ctaLabel: 1,
  ctaUrl: 1,
} as const;

/**
 * GET /whats-new/active
 *
 * Returns the single entry the current user should be offered, or null. Only the
 * newest published entry is ever a candidate, which is what makes a new entry
 * supersede an older one: the old one simply stops being served.
 *
 * Order matters here. The newest published entry is selected FIRST, then tested
 * for expiry and staleness. Those tests are terminal: if the newest entry is not
 * servable the answer is null, never the next entry down. Pushing either test
 * into the query instead would let an expired notice fall through to an older,
 * still-valid one and re-open a modal users already dismissed.
 */
export async function getActiveWhatsNew(
  req: ZodReqWithUser<Record<string, never>>,
  res: Response
) {
  try {
    const now = new Date();
    // A floor on `publishedAt` is the one time filter that IS safe to apply in
    // the query: it is monotone with the sort, so if it excludes the newest entry
    // it excludes every older entry too. `expiresAt` and the staleness window
    // have no such property and are therefore checked after selection, below.
    const widestCutoff = new Date(now.getTime() - 3650 * MS_PER_DAY);

    const candidates = await WhatsNew.find(
      {
        status: "published",
        publishedAt: { $ne: null, $gt: widestCutoff },
      },
      { ...PUBLIC_PROJECTION, staleAfterDays: 1, expiresAt: 1 }
    )
      .sort({ publishedAt: -1 })
      .limit(1)
      .lean();

    const candidate = candidates[0];
    if (!candidate || !candidate.publishedAt) {
      return res.send({ err: false, entry: null });
    }

    // Both checks below are terminal. The newest published entry is the only
    // candidate there will ever be, so if it is not servable the answer is null:
    // falling back to an older entry would resurrect a notice users have already
    // seen and dismissed.
    if (candidate.expiresAt && new Date(candidate.expiresAt) <= now) {
      return res.send({ err: false, entry: null });
    }

    const staleDays = candidate.staleAfterDays ?? WHATS_NEW_DEFAULT_STALE_DAYS;
    const staleCutoff = new Date(now.getTime() - staleDays * MS_PER_DAY);
    if (new Date(candidate.publishedAt) <= staleCutoff) {
      return res.send({ err: false, entry: null });
    }

    const { staleAfterDays, expiresAt, ...entry } = candidate;
    return res.send({ err: false, entry });
  } catch (err) {
    whatsNewLog.error({ err }, "getActiveWhatsNew failed");
    return conductor500Err(res);
  }
}

/**
 * GET /whats-new
 * Paginated list of all entries, in every status, for the authoring UI.
 */
export async function getWhatsNewEntries(
  req: ZodReqWithUser<z.infer<typeof GetWhatsNewEntriesValidator>>,
  res: Response
) {
  try {
    const { page, limit, status } = req.query;
    const filter: { status?: { $eq: string } } = {};
    if (status !== undefined) {
      if (typeof status !== "string") {
        return conductor400Err(res);
      }
      filter.status = { $eq: status };
    }
    const offset = getPaginationOffset(page, limit);

    // Drafts have no publishedAt, so fall back to creation order for them.
    const entries = await WhatsNew.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    const total = await WhatsNew.countDocuments(filter);

    const has_more = offset + limit < total;

    return res.send({
      err: false,
      items: entries,
      meta: {
        has_more,
        next_page: has_more ? page + 1 : null,
        total_count: total,
      },
    });
  } catch (err) {
    whatsNewLog.error({ err }, "getWhatsNewEntries failed");
    return conductor500Err(res);
  }
}

/**
 * POST /whats-new
 * Creates an entry. Defaults to draft; publishing immediately is allowed and
 * stamps `publishedAt` in the same write.
 */
export async function createWhatsNewEntry(
  req: ZodReqWithUser<z.infer<typeof CreateWhatsNewEntryValidator>>,
  res: Response
) {
  try {
    const status = req.body.status ?? "draft";

    const created = await WhatsNew.create({
      ...req.body,
      status,
      publishedAt: status === "published" ? new Date() : undefined,
      author: req.user.decoded.uuid,
    });

    whatsNewLog.info(
      { entryID: created._id.toString(), status },
      "Created What's New entry"
    );

    return res.send({ err: false, entry: created.toObject() });
  } catch (err) {
    whatsNewLog.error({ err }, "createWhatsNewEntry failed");
    return conductor500Err(res);
  }
}

/**
 * PATCH /whats-new/:id
 *
 * Updates an entry. `publishedAt` is stamped only on the first transition into
 * `published` and is never rewritten afterwards — re-publishing an archived
 * entry, or fixing a typo in a live one, must not re-notify users who already
 * dismissed it.
 */
export async function updateWhatsNewEntry(
  req: ZodReqWithUser<z.infer<typeof UpdateWhatsNewEntryValidator>>,
  res: Response
) {
  try {
    const existing = await WhatsNew.findById(req.params.id);
    if (!existing) {
      return conductor404Err(res);
    }

    const updates: Partial<WhatsNewInterface> = { ...req.body } as Partial<WhatsNewInterface>;

    // Only copy known, allowed fields from request body into $set.
    if ("title" in req.body && req.body.title !== null) {
      updates.title = req.body.title;
    }
    if ("body" in req.body && req.body.body !== null) {
      updates.body = req.body.body;
    }
    if ("status" in req.body && req.body.status !== null) {
      updates.status = req.body.status;
    }
    if ("expiresAt" in req.body && req.body.expiresAt !== null) {
      updates.expiresAt = req.body.expiresAt;
    }
    if ("staleAfterDays" in req.body && req.body.staleAfterDays !== null) {
      updates.staleAfterDays = req.body.staleAfterDays;
    }
    if ("ctaLabel" in req.body && req.body.ctaLabel !== null) {
      updates.ctaLabel = req.body.ctaLabel;
    }
    if ("ctaUrl" in req.body && req.body.ctaUrl !== null) {
      updates.ctaUrl = req.body.ctaUrl;
    }

    // `null` from the client means "clear this optional field".
    const unset: Record<string, ""> = {};
    for (const field of ["expiresAt", "staleAfterDays"] as const) {
      if (field in req.body && req.body[field] === null) {
        delete updates[field];
        unset[field] = "";
      }
    }

    if (
      req.body.status === "published" &&
      existing.status !== "published" &&
      !existing.publishedAt
    ) {
      updates.publishedAt = new Date();
    }

    const updated = await WhatsNew.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true }
    ).lean();

    whatsNewLog.info(
      { entryID: req.params.id, status: updated?.status },
      "Updated What's New entry"
    );

    return res.send({ err: false, entry: updated });
  } catch (err) {
    whatsNewLog.error({ err }, "updateWhatsNewEntry failed");
    return conductor500Err(res);
  }
}

/**
 * DELETE /whats-new/:id
 * Hard-deletes an entry. Prefer archiving; this exists for mistakes.
 */
export async function deleteWhatsNewEntry(
  req: ZodReqWithUser<z.infer<typeof DeleteWhatsNewEntryValidator>>,
  res: Response
) {
  try {
    const deleted = await WhatsNew.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return conductor404Err(res);
    }

    whatsNewLog.info({ entryID: req.params.id }, "Deleted What's New entry");

    return res.send({ err: false, deleted: true });
  } catch (err) {
    whatsNewLog.error({ err }, "deleteWhatsNewEntry failed");
    return conductor500Err(res);
  }
}
