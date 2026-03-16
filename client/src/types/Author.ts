
export type Author = {
    _id?: string;
    orgID: string;
    nameKey: string; // Unique identifier for the author within an org
    name: string;
    nameTitle?: string;
    nameURL?: string;
    note?: string;
    noteURL?: string;
    companyName?: string;
    companyURL?: string;
    pictureCircle?: string; // i.e. "yes" or "no"
    pictureURL?: string;
    programName?: string;
    programURL?: string;
    attributionPrefix?: string;
    userUUID?: string;
}
