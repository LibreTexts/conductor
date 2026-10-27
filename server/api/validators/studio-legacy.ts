import { z } from "zod";
import conductorErrors from "../../conductor-errors.js";

/**
 * An old Studio page URL, split by the edge redirect into its first path
 * segment and the rest. Only the three shapes the edge sends are accepted.
 * `value` is one path segment: Studio's aliases never nest below these.
 */
export const resolveStudioLegacyPathSchema = z.object({
  params: z.object({
    kind: z.enum(["h5p", "node", "collection"]),
    value: z
      .string()
      .min(1, { message: conductorErrors.err1 })
      .max(200, { message: conductorErrors.err1 }),
  }),
});
