import type { RestackerTocLicense } from "../../../types/Book";

/** CC license keys supported by the compatibility chart (row/column order). */
const CC_LICENSE_KEYS = [
  "publicdomain",
  "ccby",
  "ccbysa",
  "ccbync",
  "ccbynd",
  "ccbyncsa",
  "ccbyncnd",
] as const;

type CcLicenseKey = (typeof CC_LICENSE_KEYS)[number];

/**
 * Creative Commons license compatibility matrix.
 * Rows = source license, columns = page/destination license.
 * @see CC License Compatibility Chart
 */
const CC_COMPATIBILITY_MATRIX: Record<CcLicenseKey, Record<CcLicenseKey, boolean>> = {
  publicdomain: {
    publicdomain: true,
    ccby: true,
    ccbysa: true,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: true,
    ccbyncnd: false,
  },
  ccby: {
    publicdomain: true,
    ccby: true,
    ccbysa: true,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: true,
    ccbyncnd: false,
  },
  ccbysa: {
    publicdomain: true,
    ccby: true,
    ccbysa: true,
    ccbync: false,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbync: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: true,
    ccbyncnd: false,
  },
  ccbynd: {
    publicdomain: false,
    ccby: false,
    ccbysa: false,
    ccbync: false,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbyncsa: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: true,
    ccbyncnd: false,
  },
  ccbyncnd: {
    publicdomain: false,
    ccby: false,
    ccbysa: false,
    ccbync: false,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
};

export type LicenseRole =
  | "book"
  | "page"
  | "source"
  | `content:${number}`;

export type LicensePairCompliance = {
  licenseA: { role: LicenseRole; key: string };
  licenseB: { role: LicenseRole; key: string };
  compatible: boolean | null;
};

export type LicenseComplianceResult = {
  compliant: boolean;
  pairs: LicensePairCompliance[];
  incompatiblePairs: LicensePairCompliance[];
  unknownPairs: LicensePairCompliance[];
};

/** Strips the "license:" prefix the API adds → "license:ccby" → "ccby" */
export function parseLicenseKey(license?: RestackerTocLicense): string | undefined {
  if (!license?.label) return undefined;
  return license.label.replace(/^license:/, "");
}

function toCcLicenseKey(key: string): CcLicenseKey | undefined {
  return CC_LICENSE_KEYS.find((license) => license === key);
}

export function areLicensesCompatible(
  licenseA?: RestackerTocLicense,
  licenseB?: RestackerTocLicense,
): boolean | null {
  const keyA = parseLicenseKey(licenseA);
  const keyB = parseLicenseKey(licenseB);

  if (!keyA || !keyB) return null;

  const ccKeyA = toCcLicenseKey(keyA);
  const ccKeyB = toCcLicenseKey(keyB);

  if (!ccKeyA || !ccKeyB) return null;

  return CC_COMPATIBILITY_MATRIX[ccKeyA][ccKeyB];
}

function collectLicensedEntries(
  bookLicense: RestackerTocLicense,
  pageLicense: RestackerTocLicense,
  sourceLicense: RestackerTocLicense,
  contentLicenses: RestackerTocLicense[],
): { role: LicenseRole; license: RestackerTocLicense }[] {
  const entries: { role: LicenseRole; license: RestackerTocLicense }[] = [];

  if (parseLicenseKey(bookLicense)) {
    entries.push({ role: "book", license: bookLicense });
  }
  if (parseLicenseKey(pageLicense)) {
    entries.push({ role: "page", license: pageLicense });
  }
  if (parseLicenseKey(sourceLicense)) {
    entries.push({ role: "source", license: sourceLicense });
  }
  contentLicenses.forEach((license, index) => {
    if (parseLicenseKey(license)) {
      entries.push({ role: `content:${index}`, license });
    }
  });

  return entries;
}

export const getLicenseCompliance = (
  bookLicense: RestackerTocLicense,
  pageLicense: RestackerTocLicense,
  sourceLicense: RestackerTocLicense,
  contentLicenses: RestackerTocLicense[],
): LicenseComplianceResult => {
  const entries = collectLicensedEntries(
    bookLicense,
    pageLicense,
    sourceLicense,
    contentLicenses,
  );

  const pairs: LicensePairCompliance[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const entryA = entries[i];
      const entryB = entries[j];
      const keyA = parseLicenseKey(entryA.license)!;
      const keyB = parseLicenseKey(entryB.license)!;

      pairs.push({
        licenseA: { role: entryA.role, key: keyA },
        licenseB: { role: entryB.role, key: keyB },
        compatible: areLicensesCompatible(entryA.license, entryB.license),
      });
    }
  }

  const incompatiblePairs = pairs.filter((pair) => pair.compatible === false);
  const unknownPairs = pairs.filter((pair) => pair.compatible === null);

  return {
    compliant: incompatiblePairs.length === 0,
    pairs,
    incompatiblePairs,
    unknownPairs,
  };
};

const EMPTY_LICENSE: RestackerTocLicense = { label: "", raw: "" };

export function isLicenseNonCompliant(
  bookLicense?: RestackerTocLicense,
  pageLicense?: RestackerTocLicense,
  sourceLicense?: RestackerTocLicense,
  contentLicenses?: RestackerTocLicense[],
): boolean {
  const result = getLicenseCompliance(
    bookLicense ?? EMPTY_LICENSE,
    pageLicense ?? EMPTY_LICENSE,
    sourceLicense ?? EMPTY_LICENSE,
    contentLicenses ?? [],
  );
  return result.incompatiblePairs.length > 0;
}

export function formatLicenseRole(role: LicenseRole): string {
  if (role === "book") return "Book";
  if (role === "page") return "Page";
  if (role === "source") return "Source";
  if (role.startsWith("content:")) {
    return `Content ${Number(role.split(":")[1]) + 1}`;
  }
  return role;
}

export function getLicenseByRole(
  role: LicenseRole,
  licenses: {
    bookLicense?: RestackerTocLicense;
    pageLicense?: RestackerTocLicense;
    sourceLicense?: RestackerTocLicense;
    contentLicenses?: RestackerTocLicense[];
  },
): RestackerTocLicense | undefined {
  if (role === "book") return licenses.bookLicense;
  if (role === "page") return licenses.pageLicense;
  if (role === "source") return licenses.sourceLicense;
  if (role.startsWith("content:")) {
    return licenses.contentLicenses?.[Number(role.split(":")[1])];
  }
  return undefined;
}


export function buildLicenseFromDraft(
  license: string,
  version?: string,
): RestackerTocLicense {
  if (!license) return { label: "", raw: "" };
  const versionDigits = formatVersionDigits(version);
  return {
    label: license,
    raw: versionDigits ?? "",
    version: versionDigits,
  };
}

export function getProposedLicenseCompliance(
  field: "book" | "page",
  row: {
    pageLicense?: RestackerTocLicense;
    sourceLicense?: RestackerTocLicense;
    contentLicenses?: RestackerTocLicense[];
  },
  bookLicense: RestackerTocLicense | undefined,
  proposedLicense: string,
  proposedVersion?: string,
): LicenseComplianceResult {
  const proposed = buildLicenseFromDraft(proposedLicense, proposedVersion);
  return getLicenseCompliance(
    field === "book" ? proposed : (bookLicense ?? EMPTY_LICENSE),
    field === "page" ? proposed : (row.pageLicense ?? EMPTY_LICENSE),
    row.sourceLicense ?? EMPTY_LICENSE,
    row.contentLicenses ?? [],
  );
}

export const LICENSE_VERSION_OPTIONS = [
  { value: "10", label: "1.0" },
  { value: "20", label: "2.0" },
  { value: "25", label: "2.5" },
  { value: "30", label: "3.0" },
  { value: "40", label: "4.0" },
] as const;

const LICENSES_WITHOUT_VERSION = new Set(["publicdomain", "arr", "ck12"]);

export function licenseNeedsVersion(licenseKey?: string): boolean {
  if (!licenseKey) return false;
  return !LICENSES_WITHOUT_VERSION.has(licenseKey);
}

export function formatVersionDigits(version?: string): string | undefined {
  if (!version) return undefined;
  if (version.includes(".")) {
    const [major, minor] = version.split(".");
    return `${major}${minor}`;
  }
  return version;
}

export const  parseLicenseVersion =(version?: string): string | undefined=> {
    if (!version) return undefined;
    const v = version.replace(/^licenseversion:/, "");
    return v.replace(/^(\d)(\d)$/, "$1.$2");
  }