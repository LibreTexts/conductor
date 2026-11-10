import { z } from "zod";

/** `PUT /provenance/automation/scan`: run one time-boxed slice of the backfill scanner. */
export const RunProvenanceScanSchema = z.object({
  query: z.object({
    /** Comma-separated library subdomains; defaults to every synced library. */
    library: z
      .string()
      .regex(/^[a-z0-9]+(,[a-z0-9]+)*$/i, "Expected comma-separated library subdomains.")
      .optional(),
    /** Minutes this run may work before yielding to the next one. */
    minutes: z.coerce.number().int().min(1).max(55).optional(),
    /** Re-scan libraries that completed recently. */
    force: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  }),
});

export type RunProvenanceScanRequest = z.infer<typeof RunProvenanceScanSchema>;
