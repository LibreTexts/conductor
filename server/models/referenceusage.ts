import { Document, model, Schema } from "mongoose";

export type ReferenceDisplayLocation =
  | "endOfPage"
  | "endOfChapter"
  | "backmatter";

/**
 * How a book's reference lists are scoped — the same model as the glossary
 * scope (see GlossaryConfig): pages are grouped, and each group's combined
 * reference list is shown on its target page.
 */
export type ReferenceScopeMode = "PAGE" | "CHAPTER" | "BACKMATTER";

/**
 * `targetPageId` for the BACKMATTER group before the shared back-matter
 * References page exists; the populate job creates that page, and its id is
 * then `backmatterPageID`.
 */
export const REFERENCE_BACKMATTER_TARGET = "backmatter";

export type ReferenceScopeGroup = {
  groupID: string;
  pageIds: string[];
  /** The page this group's combined reference list is displayed on. */
  targetPageId: string;
};

export type PageReferences = {
  pageID: string;
  refrences: {
    key: string;
    refID: string;
  }[];
};

export interface ReferenceUsageInterface extends Document {
  projectID: string;
  createdBy: string;
  updatedBy: string;
  /**
   * Bumped by every change to the book's reference setup (populate, scope,
   * sharing, removal), so the library script knows its cache is stale.
   */
  updatedAt?: Date;
  format: string;
  displayLocation?: ReferenceDisplayLocation;
  pageTitle?: string;
  /** Reference document IDs (`referenceID`) belonging to this project. */
  entries: string[];
  pageRefrences: PageReferences[];
  backmatterReferenceList: string[];
  backmatterPageID?: string;
  /**
   * Legacy: the pages that show a reference list in `endOfChapter` mode.
   * Derived from `scopeGroups` targets when a scope is saved, so the populate
   * job and the library template keep working unchanged.
   */
  selectedList?: string[];
  /** Saved reference scope; absent until one is saved (or after a reset). */
  scopeMode?: ReferenceScopeMode;
  scopeGroups?: ReferenceScopeGroup[];
}

const pageRefrencesSchema = new Schema<PageReferences>(
  {
    pageID: { type: String, required: true },
    refrences: {
      type: [
        {
          key: { type: String, required: true },
          refID: { type: String, required: true },
        },
        { _id: false },
      ],
      default: () => [],
    },
  },
  { _id: false },
);

const referenceScopeGroupSchema = new Schema<ReferenceScopeGroup>(
  {
    groupID: { type: String, required: true },
    pageIds: { type: [String], required: true, default: () => [] },
    targetPageId: { type: String, required: true },
  },
  { _id: false },
);

const ReferenceUsageSchema = new Schema<ReferenceUsageInterface>({
  projectID: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  format: { type: String, required: true },
  displayLocation: {
    type: String,
    enum: ["endOfPage", "endOfChapter", "backmatter"],
    required: false,
  },
  pageTitle: { type: String, required: false },
  entries: { type: [String], default: () => [] },
  pageRefrences: { type: [pageRefrencesSchema], default: () => [] },
  backmatterReferenceList: { type: [String], default: () => [] },
  backmatterPageID: { type: String, required: false },
  selectedList: { type: [String], default: () => [] },
  scopeMode: {
    type: String,
    enum: ["PAGE", "CHAPTER", "BACKMATTER"],
    required: false,
  },
  // No default: an absent array is how "no saved scope" is told apart from
  // a saved scope with zero groups.
  scopeGroups: { type: [referenceScopeGroupSchema], default: undefined },
}, { timestamps: true });

ReferenceUsageSchema.index({ projectID: 1 }, { unique: true });
export const ReferenceUsage = model<ReferenceUsageInterface>(
  "ReferenceUsage",
  ReferenceUsageSchema,
  "referenceusage",
);
