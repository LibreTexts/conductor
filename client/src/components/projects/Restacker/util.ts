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


function makePair(
  roleA: LicenseRole,
  licenseA: RestackerTocLicense,
  roleB: LicenseRole,
  licenseB: RestackerTocLicense,
): LicensePairCompliance | null {
  const keyA = parseLicenseKey(licenseA);
  const keyB = parseLicenseKey(licenseB);
  if (!keyA || !keyB) return null;
  return {
    licenseA: { role: roleA, key: keyA },
    licenseB: { role: roleB, key: keyB },
    compatible: areLicensesCompatible(licenseA, licenseB),
  };
}

export const getLicenseCompliance = (
  bookLicense: RestackerTocLicense,
  pageLicense: RestackerTocLicense,
  sourceLicense: RestackerTocLicense,
  contentLicenses: RestackerTocLicense[],
): LicenseComplianceResult => {
  const pairs: LicensePairCompliance[] = [];

  // 1. Book ↔ Page
  const bookPage = makePair("book", bookLicense, "page", pageLicense);
  if (bookPage) pairs.push(bookPage);

  // 2. Page ↔ Source — must be an exact license+version match
  const pageKey = parseLicenseKey(pageLicense);
  const sourceKey = parseLicenseKey(sourceLicense);
  const pageVersion = parseLicenseVersion(pageLicense.version);
  const sourceVersion = parseLicenseVersion(sourceLicense.version);
  if (sourceKey) {
    const compatible = pageKey?.toLowerCase() === sourceKey?.toLowerCase() && (pageVersion ?? "") === (sourceVersion ?? "")
    pairs.push({
      licenseA: { role: "page", key: pageKey ?? "" },
      licenseB: { role: "source", key: sourceKey },
      compatible
      
    });
  }

  // 3. Page ↔ each Content license
  contentLicenses.forEach((contentLicense, index) => {
    const pageContent = makePair("page", pageLicense, `content:${index}`, contentLicense);
    if (pageContent) pairs.push(pageContent);
  });

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