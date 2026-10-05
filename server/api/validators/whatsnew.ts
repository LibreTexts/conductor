import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";
import { WHATS_NEW_STATUSES } from "../../models/whatsnew.js";

/** Generous enough for a real release notice, small enough to bound the document. */
const MAX_BODY_LENGTH = 8000;

const WhatsNewIDParams = z.object({
  params: z.object({
    id: z.string().refine((val: string) => isMongoIDValidator(val)),
  }),
});

/**
 * A CTA is both fields or neither. Half of one renders a button with no target
 * or a target with no label, so reject it at the edge rather than guessing.
 */
const ctaPairing = (data: { ctaLabel?: string; ctaUrl?: string }) =>
  (!!data.ctaLabel && !!data.ctaUrl) || (!data.ctaLabel && !data.ctaUrl);

const CTA_PAIRING_MESSAGE =
  "A call-to-action needs both a label and a URL, or neither.";

const _WhatsNewFields = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH),
  status: z.enum(WHATS_NEW_STATUSES).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  staleAfterDays: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.httpUrl().optional(),
});

export const GetActiveWhatsNewValidator = z.object({});

export const GetWhatsNewEntriesValidator = z.object({
  query: z
    .object({
      status: z.enum(WHATS_NEW_STATUSES).optional(),
    })
    .merge(PaginationSchema)
    .optional()
    .default({ page: 1, limit: 25 }),
});

export const CreateWhatsNewEntryValidator = z.object({
  body: _WhatsNewFields.refine(ctaPairing, { message: CTA_PAIRING_MESSAGE }),
});

export const UpdateWhatsNewEntryValidator = WhatsNewIDParams.extend({
  body: _WhatsNewFields
    .partial()
    .refine(ctaPairing, { message: CTA_PAIRING_MESSAGE }),
});

export const DeleteWhatsNewEntryValidator = WhatsNewIDParams;
