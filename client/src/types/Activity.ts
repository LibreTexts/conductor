/**
 * An H5P activity as the public activity page receives it. See
 * `getActivity` in server/api/activities.ts for what is left out and why.
 */
export type CommonsActivity = {
  activityID: string;
  h5pContentID: number;
  title: string;
  description?: string;
  /** H5P machine name and version, e.g. "H5P.InteractiveVideo 1.27". */
  library?: string;
  /** H5P library display title, e.g. "Interactive Video". */
  libraryTitle?: string;
  language?: string;
  /** Credit to display: H5P metadata authors, else the owning user. */
  authors: string[];
  source?: string;
  /** Institution or publisher credited for the activity. */
  publisher?: string;
  subjects?: string[];
  tags?: string[];
  visibility: "public" | "private";
  includeInLibrary?: boolean;
  /** H5P license code, e.g. "CC BY", with a version such as "4.0". */
  license?: {
    name?: string;
    version?: string;
    additionalTerms?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

/** What an activity card shows below its title. Each field is optional. */
export type ActivityCardFields = Partial<
  Pick<CommonsActivity, "description" | "authors" | "license" | "language" | "subjects" | "tags">
>;

/**
 * One row of the public listing. The server sends the stored document minus
 * collaborators and migration bookkeeping, plus `authors`, so only the fields
 * the Interactives page reads are typed here.
 */
export type CommonsActivitySummary = Pick<
  CommonsActivity,
  "activityID" | "title" | "library" | "libraryTitle" | "updatedAt"
> &
  ActivityCardFields;

export type CommonsActivitiesParams = {
  query?: string;
  sort: "updated" | "title" | "created";
  sortDirection: "ascending" | "descending";
  page: number;
  limit: number;
};

/** The three visibility levels the UI shows. See `getMyActivities` on the server. */
export type ActivityVisibilityLevel = "public" | "unlisted" | "private";

/** One card on My H5P. */
export type MyActivity = ActivityCardFields & {
  activityID: string;
  title: string;
  library?: string;
  libraryTitle?: string;
  visibility: ActivityVisibilityLevel;
  role: "owner" | "collaborator";
  createdAt?: string;
  updatedAt?: string;
};

export type MyActivitiesParams = {
  query?: string;
  visibility: "all" | ActivityVisibilityLevel;
  sort: "updated" | "title" | "created";
  page: number;
  limit: number;
};

export type MyActivitiesResult = {
  activities: MyActivity[];
  /** Counts for the current search, per visibility level. */
  counts: Record<"all" | ActivityVisibilityLevel, number>;
  /** Everything the user can see on My H5P, ignoring search and filters. */
  overallTotal: number;
  total_items: number;
};

/** An activity as its create/edit screen loads it. Owners and collaborators only. */
export type EditableActivity = {
  activityID: string;
  h5pContentID: number;
  title: string;
  description?: string;
  library?: string;
  libraryTitle?: string;
  language?: string;
  /** H5P metadata authors, as the JSON text Studio stored. */
  h5pAuthors?: string;
  source?: string;
  publisher?: string;
  subjects?: string[];
  tags?: string[];
  visibilityLevel: ActivityVisibilityLevel;
  license?: CommonsActivity["license"];
  pendingFirstSave?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ActivityPerson = { uuid: string; name: string; role: "owner" | "collaborator" };

/** Metadata the create/edit screen sends. Every field optional on update. */
export type ActivityMetadataInput = {
  title?: string;
  description?: string;
  subjects?: string[];
  tags?: string[];
  language?: string;
  publisher?: string;
  visibility?: ActivityVisibilityLevel;
};

/** What the H5P editor's `saved` message reports, passed on to Conductor. */
export type EditorSavedContent = {
  title: string;
  library: string;
  /** The library.json title, e.g. "Interactive Video". Absent if h5p-service couldn't read it. */
  libraryTitle?: string;
  license?: string;
  licenseVersion?: string;
  authors?: { name: string; role?: string }[];
};

export type EditorToken = { token: string; expiresAt: string; ttlSeconds: number };

/** The four Display options checkboxes. `true` shows the feature. */
export type ActivityDisplayOptions = { frame: boolean; download: boolean; embed: boolean; copyright: boolean };
