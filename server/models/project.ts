import { model, Schema, Document } from "mongoose";
import { projectClassifications } from "../util/projectutils.js";
import { a11ySectionReviewSchema } from "../util/a11yreviewutils.js";
import { AuthorInterface } from "./author.js";
import { License } from "../types/Misc.js";

export type ProjectModuleConfig = {
  enabled: boolean;
  order: number;
};

export type ProjectModuleSettings = {
  discussion: ProjectModuleConfig;
  files: ProjectModuleConfig;
  tasks: ProjectModuleConfig;
};

export type ISBNFormat = {
  medium: string;
  format: string;
  isbn: string;
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
  generateResources?: {
    summaries?: {
      generate: boolean;
      overwrite: boolean;
    };
    tags?: {
      generate: boolean;
      overwrite: boolean;
    };
    alttext?: {
      generate: boolean;
      overwrite: boolean;
    };
  };
  imageResults?: {
    [key: string]: any;
  };
  metaResults?: {
    [key: string]: any;
  };
};

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
    | "miscellaneous"
    | "minirepo"
  leads?: string[];
  liaisons?: string[];
  members?: string[];
  auditors?: string[];
  libreLibrary?: string;
  libreCoverID: string;
  libreShelf: string;
  libreCampus: string;
  didCreateWorkbench?: boolean;
  didMigrateWorkbench?: boolean; // migrated from sandbox
  didRequestPublish?: boolean;
  author: string;
  authorEmail: string;
  license: License;
  projectURL: string;
  adaptURL: string;
  adaptCourseID: string;
  tags: string[];
  notes: string;
  rating: number;
  rdmpReqRemix: boolean;
  rdmpCurrentStep: string;
  a11yReview: (typeof a11ySectionReviewSchema)[];
  harvestReqID?: string;
  flag?: "libretexts" | "campusadmin" | "lead" | "liaison";
  flagDescrip?: string;
  defaultChatNotification?: string;
  allowAnonPR: boolean;
  preferredPRRubric?: string;
  cidDescriptors?: string[];
  associatedOrgs?: string[];
  defaultFileLicense?: License;
  thumbnail?: string;
  // thumbnailVersion?: number;
  projectModules?: ProjectModuleSettings;
  defaultPrimaryAuthorID?: string;
  defaultSecondaryAuthorIDs?: string[];
  defaultCorrespondingAuthorID?: string;
  principalInvestigatorIDs?: string[];
  coPrincipalInvestigatorIDs?: string[];
  description?: string;
  contentArea: string;
  isbns?: ISBNFormat[];
  doi?: string;
  sourceOriginalPublicationDate?: Date;
  sourceHarvestDate?: Date;
  sourceLastModifiedDate?: Date;
  sourceLanguage?: string;
  batchUpdateJobs?: ProjectBookBatchUpdateJob[];
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
      unique: true,
      index: true,
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
      index: true,
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
     * Whether the Project has a corresponding Workbench.
     */
    didCreateWorkbench: {
      type: Boolean,
      default: false,
    },
    /**
     * Whether the Project was migrated from a Sandbox.
     */
    didMigrateWorkbench: {
      type: Boolean,
      default: false,
    },
    /**
     * Whether a request to publish the Project has been made.
     */
    didRequestPublish: {
      type: Boolean,
      default: false,
    },
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
    license: {
      name: String,
      url: String,
      version: String,
      sourceURL: String,
      modifiedFromSource: Boolean,
      additionalTerms: String,
    },
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
     * Default chat notification setting.
     */
    defaultChatNotification: String,
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
     * Associated Organization names.
     */
    associatedOrgs: [String],
    /**
     * Default license for Project Files.
     */
    defaultFileLicense: {
      name: String,
      url: String,
      version: String,
      sourceURL: String,
      modifiedFromSource: Boolean,
      additionalTerms: String,
    },
    /**
     * URL of the Project's thumbnail image.
     */
    thumbnail: String,
    /**
     * Version number of the Project's thumbnail.
     */
    // thumbnailVersion: Number
    /**
     * Project module settings.
     */
    projectModules: {
      type: {
        discussion: {
          type: {
            enabled: Boolean,
            order: Number,
          },
        },
        files: {
          type: {
            enabled: Boolean,
            order: Number,
          },
        },
        tasks: {
          type: {
            enabled: Boolean,
            order: Number,
          },
        },
      },
    },
    /**
     * Default primary author.
     */
    defaultPrimaryAuthorID: {
      type: {
        ref: "Author",
        type: Schema.Types.ObjectId,
      },
    },
    /**
     * Default secondary authors.
     */
    defaultSecondaryAuthorIDs: {
      type: [
        {
          ref: "Author",
          type: Schema.Types.ObjectId,
        },
      ],
    },
    /**
     * Default corresponding author.
     */
    defaultCorrespondingAuthorID: {
      type: {
        ref: "Author",
        type: Schema.Types.ObjectId,
      },
    },
    /**
     * Principal Investigators.
     */
    principalInvestigatorIDs: {
      type: {
        ref: "Author",
        type: Schema.Types.ObjectId,
      },
    },
    /**
     * Co-Principal Investigators.
     */
    coPrincipalInvestigatorIDs: {
      type: {
        ref: "Author",
        type: Schema.Types.ObjectId,
      },
    },
    /**
     * Project description.
     */
    description: String,
    /**
     * Content area.
     */
    contentArea: String,
    /**
     * ISBN of the associated Book/resource.
     */
    isbns: [
      {
        medium: { type: String },
        format: { type: String },
        isbn: { type: String },
      }
    ],
    /**
     * DOI of the associated Book/resource.
     */
    doi: String,
    /**
     * Original publication date of the source material.
     */
    sourceOriginalPublicationDate: Date,
    /**
     * Date the source material was harvested.
     */
    sourceHarvestDate: Date,
    /**
     * Date the source material was last modified.
     */
    sourceLastModifiedDate: Date,
    /**
     * Language of the source material.
     */
    sourceLanguage: String,
    /**
     * Batch Update Jobs (can be user-defined content or AI generated).
     */
    batchUpdateJobs: [
      {
        jobID: String,
        type: {
          type: [String],
          enum: ["summaries", "tags", "alttext"],
        },
        status: {
          type: String,
          enum: ["pending", "running", "completed", "failed"],
        },
        successfulMetaPages: Number,
        failedMetaPages: Number,
        successfulImagePages: Number,
        failedImagePages: Number,
        dataSource: {
          type: String,
          enum: ["user", "generated"],
        },
        ranBy: String,
        startTimestamp: Date,
        endTimestamp: Date,
        error: String,
        generateResources: {
          summaries: {
            generate: Boolean,
            overwrite: Boolean,
          },
          tags: {
            generate: Boolean,
            overwrite: Boolean,
          },
          alttext: {
            generate: Boolean,
            overwrite: Boolean,
          },
        },
        metaResults: {
          type: Schema.Types.Mixed,
        },
        imageResults: {
          type: Schema.Types.Mixed,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

ProjectSchema.index({ title: "text" });
ProjectSchema.index({
  members: 1,
  updatedAt: -1,
  title: -1,
  status: 1,
  projectID: 1,
});
ProjectSchema.index({
  leads: 1,
  updatedAt: -1,
  title: -1,
  status: 1,
  projectID: 1,
});
ProjectSchema.index({
  liaisons: 1,
  updatedAt: -1,
  title: -1,
  status: 1,
  projectID: 1,
});
ProjectSchema.index({
  auditors: 1,
  updatedAt: -1,
  title: -1,
  status: 1,
  projectID: 1,
});
ProjectSchema.index({ libreCoverID: 1, libreLibrary: 1, visibility: 1 });
ProjectSchema.index({ principalInvestigatorIDs: 1 });
ProjectSchema.index({ coPrincipalInvestigatorIDs: 1 });

ProjectSchema.virtual("defaultPrimaryAuthor", {
  ref: "Author",
  localField: "defaultPrimaryAuthor",
  foreignField: "_id",
  justOne: true,
});

ProjectSchema.virtual("defaultSecondaryAuthors", {
  ref: "Author",
  localField: "defaultSecondaryAuthors",
  foreignField: "_id",
});

const Project = model<ProjectInterface>("Project", ProjectSchema);

export default Project;
