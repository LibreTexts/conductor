/**
 * @file Handlers for "What's New in Conductor" entries: one read route that
 *  serves the single notice a user should currently see, plus superadmin CRUD.
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
 * Expiry is two-layered. The query applies the DEFAULT staleness window, then
 * any per-entry `staleAfterDays` override is re-checked in application code —
 * an override can only ever be more permissive in the query than the default,
 * so a widened window needs a second pass and a narrowed one needs a re-check.
 */
export async function getActiveWhatsNew(
  req: ZodReqWithUser<Record<string, never>>,
  res: Response
) {
  try {
    const now = new Date();
    // Widest window any entry could claim, so an entry with a long
    // `staleAfterDays` override is not filtered out before we can read it.
    const widestCutoff = new Date(now.getTime() - 3650 * MS_PER_DAY);

    const candidates = await WhatsNew.find(
      {
        status: "published",
        publishedAt: { $ne: null, $gt: widestCutoff },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      { ...PUBLIC_PROJECTION, staleAfterDays: 1 }
    )
      .sort({ publishedAt: -1 })
      .limit(1)
      .lean();

    const candidate = candidates[0];
    if (!candidate || !candidate.publishedAt) {
      return res.send({ err: false, entry: null });
    }

    const staleDays = candidate.staleAfterDays ?? WHATS_NEW_DEFAULT_STALE_DAYS;
    const staleCutoff = new Date(now.getTime() - staleDays * MS_PER_DAY);
    if (new Date(candidate.publishedAt) <= staleCutoff) {
      // The newest entry is itself stale, so there is nothing to show. An older
      // entry can never be fresher, so there is no reason to look further.
      return res.send({ err: false, entry: null });
    }

    const { staleAfterDays, ...entry } = candidate;
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
    const filter = status ? { status } : {};
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
