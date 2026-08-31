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
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccby: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
    ccbynd: false,
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbysa: {
    publicdomain: true,
    ccby: true,
    ccbysa: true,
    ccbync: true,
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
    ccbyncsa: false,
    ccbyncnd: false,
  },
  ccbynd: {
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
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
    publicdomain: true,
    ccby: true,
    ccbysa: false,
    ccbync: true,
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
  licenseAdption: { role: LicenseRole; key: string; version?: string };
  licenseOrigin: {
    role: LicenseRole;
    key: string;
    version?: string;
    /** Present when the origin is a specific page (e.g. book↔page book-wide check). */
    pageTitle?: string;
  };
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
  licenseAdption?: RestackerTocLicense,
  licenseOrigin?: RestackerTocLicense,
): boolean | null {
  const keyAdption = parseLicenseKey(licenseAdption);
  const keyOrigin = parseLicenseKey(licenseOrigin);

  if (!keyAdption || !keyOrigin) return null;

  const ccKeyAdption = toCcLicenseKey(keyAdption);
  const ccKeyOrigin = toCcLicenseKey(keyOrigin);

  if (!ccKeyAdption || !ccKeyOrigin) return null;

  // Rows = original/source, columns = adapting/destination
  const compatible = CC_COMPATIBILITY_MATRIX[ccKeyAdption][ccKeyOrigin];
  if (!compatible) return false;

  const versionAdption = parseLicenseVersion(licenseAdption?.version);
  const versionOrigin = parseLicenseVersion(licenseOrigin?.version);
  if (versionAdption && versionOrigin) {
    return parseFloat(versionAdption) >= parseFloat(versionOrigin);
  }

  return true;
}


function makePair(
  roleAdption: LicenseRole,
  licenseAdption: RestackerTocLicense,
  roleOrigin  : LicenseRole,
  licenseOrigin: RestackerTocLicense,
): LicensePairCompliance | null {
  const keyAdption = parseLicenseKey(licenseAdption);
  const keyOrigin = parseLicenseKey(licenseOrigin);
  if (!keyAdption || !keyOrigin) return null;
  return {
    licenseAdption: {
      role: roleAdption,
      key: keyAdption,
      version: parseLicenseVersion(licenseAdption.version) ?? licenseAdption.version,
    },
    licenseOrigin: {
      role: roleOrigin,
      key: keyOrigin,
      version: parseLicenseVersion(licenseOrigin.version) ?? licenseOrigin.version,
    },
    compatible: areLicensesCompatible(licenseAdption, licenseOrigin),
  };
}

export const getLicenseCompliance = (
  bookLicense: RestackerTocLicense,
  pageLicense: RestackerTocLicense,
  sourceLicense: RestackerTocLicense,
  contentLicenses: RestackerTocLicense[],
): LicenseComplianceResult => {
  const pairs: LicensePairCompliance[] = [];

  // 1. Book (adapting) ↔ Page (original)
  const bookPage = makePair("book", bookLicense, "page", pageLicense);
  if (bookPage) pairs.push(bookPage);

  // 2. Page ↔ Source — must be an exact license+version match
  const pageKey = parseLicenseKey(pageLicense);
  const sourceKey = parseLicenseKey(sourceLicense);
  const pageVersion = parseLicenseVersion(pageLicense.version);
  const sourceVersion = parseLicenseVersion(sourceLicense.version);
  if (sourceKey) {
    const compatible =
      pageKey?.toLowerCase() === sourceKey?.toLowerCase() &&
      (pageVersion ?? "") === (sourceVersion ?? "");
    pairs.push({
      licenseAdption: {
        role: "page",
        key: pageKey ?? "",
        version: pageVersion,
      },
      licenseOrigin: {
        role: "source",
        key: sourceKey,
        version: sourceVersion,
      },
      compatible,
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
    title?: string;
    pageLicense?: RestackerTocLicense;
    sourceLicense?: RestackerTocLicense;
    contentLicenses?: RestackerTocLicense[];
  },
  bookLicense: RestackerTocLicense | undefined,
  proposedLicense: string,
  proposedVersion?: string,
  /** When changing the book license, pass all TOC rows to check every page. */
  allRows?: {
    title: string;
    pageLicense?: RestackerTocLicense;
    sourceLicense?: RestackerTocLicense;
    contentLicenses?: RestackerTocLicense[];
  }[],
): LicenseComplianceResult {
  const proposed = buildLicenseFromDraft(proposedLicense, proposedVersion);

  // Book license applies book-wide: page is original, book is adapting
  if (field === "book" && allRows?.length) {
    const pairs: LicensePairCompliance[] = [];
    for (const r of allRows) {
      const pair = makePair(
        "book",
        proposed,
        "page",
        r.pageLicense ?? EMPTY_LICENSE,
      );
      if (!pair) continue;
      pairs.push({
        ...pair,
        licenseOrigin: {
          ...pair.licenseOrigin,
          pageTitle: r.title,
        },
      });
    }

    const incompatiblePairs = pairs.filter((pair) => pair.compatible === false);
    const unknownPairs = pairs.filter((pair) => pair.compatible === null);

    return {
      compliant: incompatiblePairs.length === 0,
      pairs,
      incompatiblePairs,
      unknownPairs,
    };
  }

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