import { AssetTag } from "./AssetTagging";
import { User } from "./User";
import { a11ySectionReviewSchema } from "./a11y";

export type ProjectFile = {
  fileID: string;
  name: string;
  access: "public" | "users" | "instructors" | "team" | "mixed";
  storageType: "file" | "folder";
  size: number;
  description: string;
  parent: string;
  createdBy: string;
  uploader?: User;
  downloadCount: number;
  tags?: AssetTag[];
  createdDate?: Date;
};

export type ProjectFileWProjectID = ProjectFile & { projectID: string };

export enum ProjectStatus {
    AVAILABLE = 'available',
    OPEN='open',
    COMPLETED='completed',
    FLAGGED='flagged'
}

export enum ProjectClassification {
    HARVESTING = 'harvesting',
    CURATION = 'curation',
    CONSTRUCTION = 'construction',
    TECHNOLOGY = 'technology',
    LIBREFEST = 'librefest',
    COURSE_REPORT = 'coursereport',
    ADOPTION_REQUEST = 'adoptionrequest',
    MISCELLANEOUS = 'miscellaneous'
}

export type Project = {
  orgID: string;
  projectID: string;
  title: string;
  status: ProjectStatus;
  visibility: ["public", "private"];
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
  tags: string[];
  notes: string;
  rating: number;
  rdmpReqRemix: Boolean;
  rdmpCurrentStep: string;
  a11yReview: [a11ySectionReviewSchema];
  harvestReqID: string;
  flag: ["libretexts", "campusadmin", "lead", "liaison"];
  flagDescrip: string;
  allowAnonPR: boolean;
  preferredPRRubric: String;
  cidDescriptors: string[];
  files: ProjectFile[];
  createdAt: string;
  updatedAt?: string;
};
