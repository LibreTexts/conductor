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

export type EntryInterface = {
  type: EntryType;
  citationKey: string;
} & Partial<Record<ReferenceFieldKey, string>>;

export interface ReferenceInterface extends Document {
  projectID: string;
  createdBy: string;
  updatedBy: string;
  format: string;
  entries: EntryInterface[];
}

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

const EntrySchema = new Schema<EntryInterface>(
  {
    type: { type: String, required: true },
    citationKey: { type: String, required: true },
    ...Object.fromEntries(
      OPTIONAL_REFERENCE_FIELDS.map((key) => [key, { type: String }]),
    ),
  },
  { _id: false },
);

const ReferenceSchema = new Schema<ReferenceInterface>({
  projectID: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  format: { type: String, required: true },
  entries: { type: [EntrySchema], default: () => [] },
});

ReferenceSchema.index({ projectID: 1 }, { unique: true });
export const Reference = model<ReferenceInterface>(
  "Reference",
  ReferenceSchema,
);
export { EntrySchema };
