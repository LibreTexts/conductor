import { Document, model, Schema } from "mongoose";

interface pageUsage {
  pageID: string;
  addedBy: string;
  createdAt: Date;
}

const pageUsageSchema = new Schema<pageUsage>(
  {
    pageID: { type: String, required: true },
    addedBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

export interface GlossaryImageFile {
  data: Buffer;
  contentType: string;
  originalname: string;
}

export interface GlossaryUsageInterface extends Document {
  usageID: string;
  termID: string;
  term: string;
  definition: string;
  updatedAt: Date;
  bookID?: string;
  coverID: number;
  pages: pageUsage[];
  library: string;
  glossaryID?: string;
  imageFile?: GlossaryImageFile;
  altText?: string;
  caption?: string;
  link?: string;
  source?: string;
}

const GlossaryUsageSchema = new Schema<GlossaryUsageInterface>({
  usageID: {
    type: String,
    required: true,
  },
  termID: {
    type: String,
    required: true,
  },
  term: {
    type: String,
    required: true,
  },
  definition: { type: String, required: true },

  bookID: {
    type: String,
    required: false,
  },
  coverID: {
    type: Number,
    required: true,
  },
  pages: {
    type: [pageUsageSchema],
    required: true,
  },
  library: {
    type: String,
    required: true,
  },
  updatedAt: { type: Date, required: true, default: Date.now },
  glossaryID: {type: String, required: false, default: ""},
  imageFile: {
    type: new Schema<GlossaryImageFile>(
      {
        data: { type: Buffer, required: true },
        contentType: { type: String, required: true },
        originalname: { type: String, required: true },
      },
      { _id: false },
    ),
    required: false,
  },
  altText: { type: String, required: false },
  caption: { type: String, required: false },
  link: { type: String, required: false },
  source: { type: String, required: false },
});

const GlossaryUsage = model<GlossaryUsageInterface>(
  "GlossaryUsage",
  GlossaryUsageSchema,
);

export default GlossaryUsage;
