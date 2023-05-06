import { model, Schema, Document } from "mongoose";
import {
  projectClassifications,
  PROJECT_FILES_ACCESS_SETTINGS,
} from "../util/projectutils.js";
import { a11ySectionReviewSchema } from "../util/a11yreviewutils.js";

export interface FilesInterface extends Document {
  fileID: string;
  name?: string;
  access?: "public" | "users" | "instructors" | "team" | "mixed";
  storageType: "file" | "folder";
  size: number;
  description?: string;
  parent?: string;
  createdBy?: string;
  downloadCount?: number;
}

const FilesSchema = new Schema<FilesInterface>();
FilesSchema.add({
  /**
   * Unique identifier of the file entry.
   */
  fileID: {
    type: String,
    required: true,
  },
  /**
   * UI-name of the file entry.
   */
  name: String,
  /**
   * Indicates which users can download the file on Commons.
   */
  access: {
    type: String,
    enum: PROJECT_FILES_ACCESS_SETTINGS,
  },
  /**
   * Indicates whether the entry is a "file" or "folder".
   */
  storageType: {
    type: String,
    enum: ["file", "folder"],
    default: "file",
  },
  /**
   * Entry size in bytes, set to 0 if entry is a "folder".
   */
  size: {
    type: Number,
    default: 0,
  },
  /**
   * UI text describing the entry and its contents.
   */
  description: String,
  /**
   * Identifier of the immediate parent in the hierarchy. Empty string if the
   * entry is at the top-level of the hierarchy.
   */
  parent: String,
  /**
   * UUID of the user that uploaded or created the entry.
   */
  createdBy: String,
  /**
   * Number of times the entry has been downloaded on Commons, if entry is a "file".
   */
  downloadCount: Number,
});

export interface ProjectInterface extends Document {
  orgID: string;
  projectID: string;
  title: string;
  status: "available" | "open" | "completed" | "flagged";
  visibility: "public" | "private";
  currentProgress?: number;
  peerProgress?: number;
  a11yProgress?: number;
  classification?:
    | "harvesting"
    | "curation"
    | "construction"
    | "technology"
    | "librefest"
    | "coursereport"
    | "adoptionrequest"
    | "miscellaneous";
  leads?: string[];
  liaisons?: string[];
  members?: string[];
  auditors?: string[];
  libreLibrary?: String;
  libreCoverID: String;
  libreShelf: String;
  libreCampus: String;
  author: String;
  authorEmail: String;
  license: String;
  resourceURL: String;
  projectURL: String;
  adaptURL: String;
  adaptCourseID: String;
  tags: [String];
  notes: String;
  rating: {
    type: Number;
    min: 0;
    max: 5;
  };
  rdmpReqRemix: Boolean;
  rdmpCurrentStep: String;
  a11yReview: (typeof a11ySectionReviewSchema)[];
  harvestReqID?: string;
  flag?: "libretexts" | "campusadmin" | "lead" | "liaison";
  flagDescrip?: string;
  allowAnonPR: boolean;
  preferredPRRubric?: string;
  cidDescriptors?: string[];
  files?: (typeof FilesSchema)[];
}

const ProjectSchema = new Schema<ProjectInterface>(
  {
    /**
     * Organization identifier string.
     */
    orgID: {
      type: String,
      required: true,
    },
    /**
     * Base62 10-digit unique identifier.
     */
    projectID: {
      type: String,
      required: true,
    },
    /**
     * Project's title.
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * The Project's "status" for team members and in the system.
     */
    status: {
      type: String,
      default: "available",
      enum: ["available", "open", "completed", "flagged"],
    },
    /**
     * Project's privacy setting.
     */
    visibility: {
      type: String,
      default: "private",
      enum: ["public", "private"],
    },
    /**
     * Estimated Project progress (%).
     */
    currentProgress: {
      type: Number,
      default: 0,
    },
    /**
     * Estimated Project Peer Review progress (%).
     */
    peerProgress: {
      type: Number,
      default: 0,
    },
    /**
     * Estimated Project Accessibility score (%).
     */
    a11yProgress: {
      type: Number,
      default: 0,
    },
    /**
     * Project's internal classification/type.
     */
    classification: {
      type: String,
      enum: ["", ...projectClassifications],
    },
    /**
     * Project Leads (privileged) (UUIDs).
     */
    leads: [String],
    /**
     * Project Liaisons (campus admins, privileged) (UUIDs).
     */
    liaisons: [String],
    /**
     * Project team members (semi-privileged) (UUIDs).
     */
    members: [String],
    /**
     * Users with access to view (low-privileged) (UUIDs).
     */
    auditors: [String],
    /**
     * Corresponding LibreTexts library, if the Project pertains to a Book
     * or other ancillary resource/tool.
     */
    libreLibrary: String,
    /**
     * Corresponding LibreText Coverpage ID.
     */
    libreCoverID: String,
    /**
     * The "Bookshelf" the associated Book is located in, if not a campus text.
     */
    libreShelf: String,
    /**
     * The "Campus" the associated Book belongs to.
     */
    libreCampus: String,
    /**
     * Name of the associated Book/resource's author.
     */
    author: String,
    /**
     * Email of the associated Book/resource's author.
     */
    authorEmail: String,
    /**
     * Content licensing of the associated Book/resource.
     */
    license: String,
    /**
     * Original URL of the resource, if applicable.
     */
    resourceURL: String,
    /**
     * URL where the resource currently exists, typically a LibreTexts library link.
     */
    projectURL: String,
    /**
     * URL of the Project's associated ADAPT homework system resources.
     */
    adaptURL: String,
    /**
     * Project's corresponding ADAPT Course ID, extracted from the adaptURL.
     */
    adaptCourseID: String,
    /**
     * Project tags as tagIDs.
     */
    tags: [String],
    /**
     * Project notes/description text.
     */
    notes: String,
    /**
     * Overall quality rating (scale 0-5) of the Project's associated Book.
     * Updated via aggregation of Peer Reviews.
     */
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    /**
     * Whether the Project's Construction Roadmap indicates remixing is required.
     */
    rdmpReqRemix: Boolean,
    /**
     * Project's current step in the Contruction Roadmap.
     */
    rdmpCurrentStep: String,
    /**
     * Text section accessibility reviews.
     */
    a11yReview: [a11ySectionReviewSchema],
    /**
     * The original _id of the Harvesting Request the Project was generated
     * from, if applicable.
     */
    harvestReqID: String,
    /**
     * User group identifier to flag.
     */
    flag: {
      type: String,
      enum: ["libretexts", "campusadmin", "lead", "liaison"],
    },
    /**
     * A description of the reason for flagging.
     */
    flagDescrip: String,
    /**
     * Allow 'anonymous' Peer Reviews (if Project is public and has associated Book).
     */
    allowAnonPR: {
      type: Boolean,
      default: true,
    },
    /**
     * The rubricID of the team's preferred Peer Review rubric.
     */
    preferredPRRubric: String,
    /**
     * The C-ID Descriptor(s) applicable to this Project.
     */
    cidDescriptors: [String],
    /**
     * Project Files associated with the Book.
     */
    files: [FilesSchema],
  },
  {
    timestamps: true,
  }
);

const Project = model<ProjectInterface>("Project", ProjectSchema);

export default Project;
