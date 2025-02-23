import { AssetTag } from "./AssetTagging";
import { Author } from "./Author";
import { License } from "./Misc";
import { User } from "./User";
import { a11ySectionReviewSchema } from "./a11y";

export type ProjectTag = {
  orgID?: string;
  tagID?: string;
  title?: string;
};

export type CIDDescriptor = {
  descriptor: string;
  title: string;
  description?: string;
  approved?: Date;
  expires?: Date;
};

export type ProjectFileAuthor = Omit<Author, "userUUID">;

export interface ProjectFilePublisher {
  name?: string;
  url?: string;
}

export type ProjectFile = {
  fileID: string;
  projectID: string;
  name: string;
  access: "public" | "users" | "instructors" | "team" | "mixed";
  storageType: "file" | "folder";
  size: number;
  description: string;
  isURL?: boolean;
  url?: string;
  isVideo?: boolean;
  videoStorageID?: string;
  parent: string;
  createdBy: string;
  uploader?: User;
  downloadCount: number;
  tags?: AssetTag[];
  createdDate?: Date;
  license?: License;
  primaryAuthor?: ProjectFileAuthor;
  authors?: ProjectFileAuthor[];
  correspondingAuthor?: ProjectFileAuthor;
  publisher?: ProjectFilePublisher;
  mimeType?: string;
};

/**
 * A ProjectFile with the given Project data included, where K is the key of the Project data to include.
 */
export type ProjectFileWProjectData<K extends keyof Project> = ProjectFile & {
  projectInfo: {
    [P in K]: Project[P];
  };
};

/**
 * A ProjectFile with the given custom data included, where K is the key of the custom data to include,
 * and T (optional) is the key of the Project data to include.
 */
export type ProjectFileWCustomData<
  K extends string,
  T extends keyof Project = never
> = ProjectFile & {
  projectInfo: Record<K, string> &
    (T extends never ? {} : ProjectFileWProjectData<T>);
};

export enum ProjectStatus {
  AVAILABLE = "available",
  OPEN = "open",
  COMPLETED = "completed",
  FLAGGED = "flagged",
}

export enum ProjectClassification {
  HARVESTING = "harvesting",
  CURATION = "curation",
  CONSTRUCTION = "construction",
  TECHNOLOGY = "technology",
  LIBREFEST = "librefest",
  COURSE_REPORT = "coursereport",
  ADOPTION_REQUEST = "adoptionrequest",
  MISCELLANEOUS = "miscellaneous",
}

export type ProjectModule = "discussion" | "files" | "tasks";

export type ProjectModuleConfig = {
  enabled: boolean;
  order: number;
};

export type ProjectModuleSettings = {
  discussion: ProjectModuleConfig;
  files: ProjectModuleConfig;
  tasks: ProjectModuleConfig;
};

export type ProjectBookBatchUpdateJob = {
  jobID: string;
  type: ("summaries" | "tags" | "alttext")[];
  status: "pending" | "running" | "completed" | "failed";
  successfulMetaPages?: number; // number of pages whose summaries and/or tags were updated
  failedMetaPages?: number;
  successfulImagePages?: number; // number of pages whose image(s) alt text was updated
  failedImagePages?: number;
  dataSource: "user" | "generated";
  ranBy: string; // User UUID
  startTimestamp?: Date;
  endTimestamp?: Date;
  error?: string; // root-level error message, not for individual pages
  imageResults?: {
    [key: string]: any;
  };
  metaResults?: {
    [key: string]: any;
  };
}

export type Project = {
  orgID: string;
  projectID: string;
  title: string;
  status: ProjectStatus;
  visibility: "public" | "private";
  currentProgress: number;
  peerProgress: number;
  a11yProgress: number;
  classification: ProjectClassification;
  leads: User[];
  liaisons: User[];
  members: User[];
  auditors: User[];
  libreLibrary: string;
  libreCoverID: string;
  libreShelf: string;
  libreCampus: string;
  author: string;
  authorEmail: string;
  license: License;
  projectURL: string;
  adaptURL: string;
  adaptCourseID: string;
  tags: ProjectTag[];
  notes: string;
  rating: number;
  rdmpReqRemix: Boolean;
  rdmpCurrentStep: string;
  a11yReview: a11ySectionReviewSchema[];
  harvestReqID: string;
  flag: "libretexts" | "campusadmin" | "lead" | "liaison";
  flagDescrip: string;
  defaultChatNotification?: string;
  allowAnonPR: boolean;
  preferredPRRubric: String;
  cidDescriptors: CIDDescriptor[];
  associatedOrgs: string[];
  defaultFileLicense?: License;
  didCreateWorkbench?: boolean;
  didRequestPublish?: boolean;
  thumbnail?: string;
  projectModules?: ProjectModuleSettings;
  createdAt: string;
  updatedAt?: string;
  defaultPrimaryAuthorID?: string;
  defaultSecondaryAuthorIDs?: string[];
  defaultCorrespondingAuthorID?: string;
  defaultPrimaryAuthor?: ProjectFileAuthor;
  defaultSecondaryAuthors?: ProjectFileAuthor[];
  defaultCorrespondingAuthor?: ProjectFileAuthor;
  principalInvestigatorIDs?: string[];
  coPrincipalInvestigatorIDs?: string[];
  principalInvestigators?: ProjectFileAuthor[];
  coPrincipalInvestigators?: ProjectFileAuthor[];
  description?: string;
  contentArea?: string;
  isbn?: string;
  doi?: string;
  sourceOriginalPublicationDate?: Date;
  sourceHarvestDate?: Date;
  sourceLastModifiedDate?: Date;
  sourceLanguage?: string;
  batchUpdateJobs?: ProjectBookBatchUpdateJob[];
};

export type AddableProjectTeamMember = Pick<
  User,
  "uuid" | "firstName" | "lastName" | "avatar"
> & {
  orgs: { name: string }[];
};
