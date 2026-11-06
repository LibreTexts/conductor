import licenseVersions from "../../shared/license-versions.json";

/**
 * The license/version table shared with the client (see
 * `client/src/components/util/LicenseOptions.js`). Both sides read the same
 * JSON, so a license the picker offers and a version it lists are the only
 * values the API accepts.
 *
 * This is deliberately separate from `isValidLicense` in `bookutils.js`, which
 * predates the table and is missing newer entries such as `mixed`.
 */

/** Every license identifier the picker offers, in table order. */
export const LICENSE_KEYS: string[] = licenseVersions.map(
  (entry) => entry.license,
);

/** Licenses issued in versions, mapped to the version keys each allows. */
export const LICENSE_VERSIONS: Record<string, string[]> = Object.fromEntries(
  licenseVersions
    .filter((entry) => entry.versions.length > 0)
    .map((entry) => [entry.license, entry.versions.map((v) => v.key)]),
);

/** Every version key in the table, e.g. "40" for 4.0. */
const VERSION_KEYS = new Set(Object.values(LICENSE_VERSIONS).flat());

/** True for a license identifier the picker offers. */
export function isKnownLicense(license: string): boolean {
  return LICENSE_KEYS.includes(license);
}

/** True for a version key the table lists for any license. */
export function isKnownLicenseVersionKey(version: string): boolean {
  return VERSION_KEYS.has(version);
}

/**
 * True when `version` is one of the versions `license` is issued in. A license
 * that has no versions, an unknown license, and a missing version are all
 * false, so a stray version can never be stored next to the wrong license.
 */
export function licenseHasVersion(
  license: string | undefined,
  version: string,
): boolean {
  return !!license && !!LICENSE_VERSIONS[license]?.includes(version);
}
