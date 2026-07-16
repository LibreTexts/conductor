import { Response } from "express";
import User, {
  UXAcknowledgmentEntry,
  UXAcknowledgmentStatus,
} from "../models/user.js";
import {
  TypedReqParamsWithUser,
  TypedReqParamsAndBodyWithUser,
} from "../types/Express.js";
import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";

/**
 * Per-user UX record-keeping: stores which one-off UI prompts (dismissible
 * banners, welcome dialogs, tours, hints) a user has seen, dismissed, or
 * completed. Persisted on the User document so state survives across devices
 * and browsers. Route params are validated against the shared key registry, so
 * `key` here is always a registered, dot-free acknowledgment id.
 */

/**
 * GET /user/ux-acknowledgments
 * Returns the current user's full acknowledgment map (keyed by acknowledgment id).
 */
export async function getUserUXAcknowledgments(
  req: TypedReqParamsWithUser<Record<string, never>>,
  res: Response
) {
  try {
    const user = await User.findOne(
      { uuid: { $eq: req.user.decoded.uuid } },
      { uxAcknowledgments: 1 }
    ).lean();

    if (!user) {
      return res.status(400).send({ err: true, errMsg: conductorErrors.err9 });
    }

    // .lean() returns the Mongoose Map as a plain object → JSON-serializable.
    return res.send({
      err: false,
      acknowledgments: user.uxAcknowledgments ?? {},
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

/**
 * POST /user/ux-acknowledgments/:key
 * Records (upserts) a single acknowledgment for the current user. Defaults the
 * status to "seen". Uses a single aggregation-pipeline update so concurrent
 * records from multiple tabs/devices can't lose an increment.
 */
export async function recordUserUXAcknowledgment(
  req: TypedReqParamsAndBodyWithUser<
    { key: string },
    { status?: UXAcknowledgmentStatus; data?: Record<string, unknown> }
  >,
  res: Response
) {
  try {
    const key = req.params.key as string;
    const status: UXAcknowledgmentStatus = req.body.status ?? "seen";
    const reqData = req.body.data ?? null;
    const path = `uxAcknowledgments.${key}`;
    const now = new Date();

    await User.updateOne({ uuid: { $eq: req.user.decoded.uuid } }, [
      {
        $set: {
          [path]: {
            status,
            firstSeenAt: { $ifNull: [`$${path}.firstSeenAt`, now] },
            lastSeenAt: now,
            dismissedAt:
              status === "dismissed"
                ? now
                : { $ifNull: [`$${path}.dismissedAt`, null] },
            completedAt:
              status === "completed"
                ? now
                : { $ifNull: [`$${path}.completedAt`, null] },
            viewCount: {
              $add: [{ $ifNull: [`$${path}.viewCount`, 0] }, 1],
            },
            dismissCount: {
              $add: [
                { $ifNull: [`$${path}.dismissCount`, 0] },
                status === "dismissed" ? 1 : 0,
              ],
            },
            data: { $ifNull: [reqData ?? `$${path}.data`, `$${path}.data`] },
          },
        },
      },
    ]);

    // Return the fresh entry so the client can reconcile its optimistic state.
    const updated = await User.findOne(
      { uuid: { $eq: req.user.decoded.uuid } },
      { [path]: 1 }
    ).lean();

    if (!updated) {
      return res.status(400).send({ err: true, errMsg: conductorErrors.err9 });
    }

    const acknowledgment =
      (updated.uxAcknowledgments as
        | Record<string, UXAcknowledgmentEntry>
        | undefined)?.[key] ?? null;

    return res.send({ err: false, key, acknowledgment });
  } catch (e) {
    debugError(e);
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

/**
 * DELETE /user/ux-acknowledgments/:key
 * Resets (removes) a single acknowledgment for the current user. Intended for
 * QA/testing so a prompt can be re-triggered; disabled in production.
 */
export async function deleteUserUXAcknowledgment(
  req: TypedReqParamsWithUser<{ key: string }>,
  res: Response
) {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).send({ err: true, errMsg: conductorErrors.err66 });
    }

    const key = req.params.key as string;
    await User.updateOne(
      { uuid: { $eq: req.user.decoded.uuid } },
      { $unset: { [`uxAcknowledgments.${key}`]: "" } }
    );

    return res.send({ err: false, key });
  } catch (e) {
    debugError(e);
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}
