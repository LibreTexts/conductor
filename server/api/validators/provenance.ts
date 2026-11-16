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


/** `GET /provenance/graph`: book-to-book reuse links, optionally for one library. */
export const GetProvenanceGraphSchema = z.object({
  query: z.object({
    library: z.string().regex(/^[a-z0-9]+$/i, "Expected a library subdomain.").optional(),
    /** Leave out links sharing fewer pages than this. */
    minPages: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(300),
  }),
});

export type GetProvenanceGraphRequest = z.infer<typeof GetProvenanceGraphSchema>;

/**
 * `PUT /provenance/automation/changes`: read each library's change feed from
 * where the last run stopped and apply it.
 */
export const RunProvenanceChangesSchema = z.object({
  query: z.object({
    /** Comma-separated library subdomains; defaults to every library provenance follows. */
    library: z
      .string()
      .regex(/^[a-z0-9]+(,[a-z0-9]+)*$/i, "Expected comma-separated library subdomains.")
      .optional(),
    /** Minutes this run may work before yielding to the next one. */
    minutes: z.coerce.number().int().min(1).max(55).optional(),
    /** Read the feeds and return the planned actions; write nothing, keep the cursors. */
    dryRun: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  }),
});

export type RunProvenanceChangesRequest = z.infer<typeof RunProvenanceChangesSchema>;
