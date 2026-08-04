import { Document, model, Schema } from "mongoose";

type EntryType =
  | "article"
  | "inproceedings"
  | "book"
  | "incollection"
  | "mastersthesis"
  | "phdthesis"
  | "misc";

export type ReferenceFieldKey =
  | "author"
  | "title"
  | "journal"
  | "booktitle"
  | "year"
  | "volume"
  | "number"
  | "pages"
  | "doi"
  | "url"
  | "month"
  | "note"
  | "publisher"
  | "address"
  | "edition"
  | "isbn"
  | "editor"
  | "chapter"
  | "school"
  | "urldate";

const OPTIONAL_REFERENCE_FIELDS: ReferenceFieldKey[] = [
  "author",
  "title",
  "journal",
  "booktitle",
  "year",
  "volume",
  "number",
  "pages",
  "doi",
  "url",
  "month",
  "note",
  "publisher",
  "address",
  "edition",
  "isbn",
  "editor",
  "chapter",
  "school",
  "urldate",
];

export type ReferenceInterface = {
  projectID: string;
  referenceID: string;
  createdBy: string;
  updatedBy: string;
  isFork: boolean;
  forkedFrom?: string;
  createdAt: Date;
  updatedAt: Date;
  entryType: EntryType;
  citationKey: string;
  /** OpenAI text-embedding-3-small vector over bibliographic text fields. */
  embeddings?: number[];
  embeddingsUpdatedAt?: Date;
} & Partial<Record<ReferenceFieldKey, string>>;

export const ReferenceSchema = new Schema<ReferenceInterface>({
  projectID: { type: String, required: true },
  referenceID: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  isFork: { type: Boolean, required: true, default: false },
  forkedFrom: { type: String, required: false },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  entryType: { type: String, required: true },
  citationKey: { type: String, required: true },
  embeddings: { type: [Number] },
  embeddingsUpdatedAt: { type: Date },
  ...Object.fromEntries(
    OPTIONAL_REFERENCE_FIELDS.map((key) => [key, { type: String }]),
  ),
});

ReferenceSchema.index({ projectID: 1, referenceID: 1 }, { unique: true });
ReferenceSchema.index({ projectID: 1, citationKey: 1 }, { unique: true });
ReferenceSchema.index(
  {
    citationKey: "text",
    author: "text",
    title: "text",
    journal: "text",
    booktitle: "text",
    year: "text",
    volume: "text",
    number: "text",
    pages: "text",
    doi: "text",
    url: "text",
    month: "text",
    note: "text",
    publisher: "text",
    address: "text",
    edition: "text",
    isbn: "text",
    editor: "text",
    chapter: "text",
    school: "text",
    urldate: "text",
  },
  { name: "ref_text" },
);

/** Atlas Vector Search — embed citationKey + bibliographic fields into `embeddings`. */
ReferenceSchema.searchIndex({
  name: "ref_vec",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "embeddings",
        numDimensions: 256, // more accurate alternative: 1536 and slower
        similarity: "dotProduct", // alternative: cosine (slower)
      },
      {
        type: "filter",
        path: "projectID",
      },
    ],
  },
});

export const Reference = model<ReferenceInterface>(
  "Reference",
  ReferenceSchema,
  "reference",
);

export type { EntryType };
export { OPTIONAL_REFERENCE_FIELDS };
