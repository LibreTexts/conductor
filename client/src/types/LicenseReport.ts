export type LicenseReport = {
    coverID: string;
    id: string;
    library: string;
    timestamp: string;
    runtime: string;
    meta: LicenseReportMeta;
    text: LicenseReportText;
}

export type LicenseReportText = {
    license: LicenseReportLicense;
    id: string;
    url: string;
    title: string;
    children: LicenseReportText[]
    totalPages: number;
}

export type LicenseReportMeta = {
    mostRestrictiveLicense: Omit<LicenseReportLicense, 'count' | 'percent'>;
    specialRestrictions: string[];
    licenses: LicenseReportLicense[]
}

/**
 * @deprecated
 * Should be used for LicenseReport purposes only
 * @see License in types/Misc.ts
*/
export type LicenseReportLicense = {
    label: string;
    link: string;
    raw: string;
    version: string;
    count?: number;
    percent?: number;
}