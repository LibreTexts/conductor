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
    license: License;
    id: string;
    url: string;
    title: string;
    children: LicenseReportText[]
    totalPages: number;
}

export type LicenseReportMeta = {
    mostRestrictiveLicense: Omit<License, 'count' | 'percent'>;
    specialRestrictions: string[];
    licenses: License[]
}

export type License = {
    label: string;
    link: string;
    raw: string;
    version: string;
    count?: number;
    percent?: number;
}