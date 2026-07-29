import { z } from "zod";

export const ReferenceFormatTypeEnum = z.enum([
  "APA",
  "MLA",
  "Chicago",
  "Harvard",
  "Vancouver",
  "AMA",
  "IEEE",
  "CSM",
  "ASN",
  "ANSI",
]);

export const EntryTypeEnum = z.enum([
  "article",
  "inproceedings",
  "book",
  "incollection",
  "mastersthesis",
  "phdthesis",
  "misc",
]);

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

const optionalReferenceFieldSchema = Object.fromEntries(
  OPTIONAL_REFERENCE_FIELDS.map((key) => [key, z.string().optional()]),
) as Record<(typeof OPTIONAL_REFERENCE_FIELDS)[number], z.ZodOptional<z.ZodString>>;

export const ReferenceEntrySchema = z.object({
  type: EntryTypeEnum,
  citationKey: z.string().min(1),
  ...optionalReferenceFieldSchema,
});

export const GetReferencePageSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
});

export const UpdateReferenceFormatSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    format: ReferenceFormatTypeEnum,
  }),
});

export const UpdateReferenceEntrySchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    entry: ReferenceEntrySchema,
  }),
});
