import { z } from "zod";

/** `PUT /provenance/automation/scan`: run one time-boxed slice of the backfill scanner. */
export const RunProvenanceScanSchema = z.object({
  query: z.object({
    /** Comma-separated library subdomains; defaults to every synced library. */
    library: z
      .string()
      .regex(/^[a-z0-9]+(,[a-z0-9]+)*$/i, "Expected comma-separated library subdomains.")
      .optional(),
    /**
     * Comma-separated bookIDs (`dev-9213`) to scan directly instead of walking
     * libraries; works for libraries that are not sync-enabled.
     */
    book: z
      .string()
      .regex(/^[a-z0-9]+-\d+(,[a-z0-9]+-\d+)*$/i, "Expected comma-separated bookIDs like dev-9213.")
      .optional(),
    /** Minutes this run may work before yielding to the next one. */
    minutes: z.coerce.number().int().min(1).max(55).optional(),
    /**
     * Re-scan libraries that completed recently, and re-read pages whose
     * revision is unchanged (use after classification rules change).
     */
    force: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  }),
});

export type RunProvenanceScanRequest = z.infer<typeof RunProvenanceScanSchema>;

/** `PUT /provenance/automation/notify`: email leads about changed sources. */
export const RunProvenanceNotifySchema = z.object({
  query: z.object({
    /** Return the digests that would be sent; send nothing, change nothing. */
    dryRun: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  }),
});

export type RunProvenanceNotifyRequest = z.infer<typeof RunProvenanceNotifySchema>;
