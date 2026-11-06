import { Document, model, Schema } from "mongoose";

/** BibTeX entry types; the validators build their enum from this list. */
export const ENTRY_TYPES = [
  "article",
  "inproceedings",
  "book",
  "incollection",
  "mastersthesis",
  "phdthesis",
  "misc",
] as const;

type EntryType = (typeof ENTRY_TYPES)[number];

/** Optional BibTeX fields; the validators build their schema from this list. */
const OPTIONAL_REFERENCE_FIELDS = [
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
] as const;

export type ReferenceFieldKey = (typeof OPTIONAL_REFERENCE_FIELDS)[number];

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
  ...Object.fromEntries(
    OPTIONAL_REFERENCE_FIELDS.map((key) => [key, { type: String }]),
  ),
});

ReferenceSchema.index({ projectID: 1, referenceID: 1 }, { unique: true });
// Books list references by ID, including ones owned by other projects.
ReferenceSchema.index({ referenceID: 1 });
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

export const Reference = model<ReferenceInterface>(
  "Reference",
  ReferenceSchema,
  "reference",
);

export type { EntryType };
export { OPTIONAL_REFERENCE_FIELDS };
