import { AssetTag } from "./AssetTagging";
import { Author } from "./Author";
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

export interface ProjectFileLicense {
  name?: string;
  url?: string;
  version?: string;
  sourceURL?: string;
  modifiedFromSource?: boolean;
  additionalTerms?: string;
}

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
  parent: string;
  createdBy: string;
  uploader?: User;
  downloadCount: number;
  tags?: AssetTag[];
  createdDate?: Date;
  license?: ProjectFileLicense;
  authors?: ProjectFileAuthor[];
  publisher?: ProjectFilePublisher;
  mimeType?: string;
};

/**
 * A ProjectFile with the given Project data included, where K is the key of the Project data to include.
 */
export type ProjectFileWProjectData<K extends keyof Project> = ProjectFile & {
  projectInfo: {
    [P in K]: Project[P];
  }
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
  license: string;
  resourceURL: string;
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
  allowAnonPR: boolean;
  preferredPRRubric: String;
  cidDescriptors: CIDDescriptor[];
  associatedOrgs: string[];
  defaultFileLicense?: ProjectFileLicense;
  didCreateWorkbench?: boolean;
  thumbnail?: string;
  createdAt: string;
  updatedAt?: string;
};
