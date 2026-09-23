import { z } from "zod";
import licenseVersions from "../../../shared/license-versions.json";

/**
 * Licenses that must carry a version, with the versions each allows. Read
 * from the table the client's LicenseOptions.js also uses, so both sides
 * enforce the same versions.
 */
const LICENSE_VERSIONS: Record<string, string[]> = Object.fromEntries(
  licenseVersions
    .filter((entry) => entry.versions.length > 0)
    .map((entry) => [entry.license, entry.versions.map((v) => v.key)]),
);

/** A versioned license without a valid version is flagged non-compliant, so reject it up front. */
const hasRequiredLicenseVersion = (body: { license: string; version?: string }) => {
  const allowed = LICENSE_VERSIONS[body.license];
  return !allowed || (!!body.version && allowed.includes(body.version));
};

const licenseVersionError = {
  message: "This license requires a valid version.",
  path: ["version"],
};


export const GetRestackerPageSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
});

export const UpdateRestackerLicenseSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    pageID: z.string().min(1),
    license: z.string(),
    version: z.string().optional(),
    force: z.boolean().optional(),
  }).refine(hasRequiredLicenseVersion, licenseVersionError),
});

export const BulkUpdateRestackerLicenseSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    pageIDs: z.array(z.string().min(1)).min(1).max(5000),
    license: z.string(),
    version: z.string().optional(),
  }).refine(hasRequiredLicenseVersion, licenseVersionError),
});

export const RestackerReloadSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z
    .object({
      mode: z.enum(["content", "page"]).optional(),
    })
    .optional(),
});
