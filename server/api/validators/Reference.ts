import { z } from "zod";
import { checkBookIDFormat } from "../../util/bookutils";
import conductorErrors from "../../conductor-errors";
import { isNumber } from "es-toolkit";

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
  entryType: EntryTypeEnum,
  referenceID: z.string().length(10).optional(),
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

export const SearchReferencesValidator = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  query: z.object({
    query: z.string().min(1),
  }),
});

export const DeleteReferenceEntrySchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    referenceID: z.string().length(10),
    deleteFromReferences: z.boolean().optional().default(false),
  }),
});

export const AddReferenceEntrySchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    referenceIDs: z
      .array(z.string().length(10))
      .min(1, { message: "At least one referenceID is required" }),
  }),
});

export const tocValidator = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  query: z.object({
    toc: z.coerce.boolean().optional(),
    bookID: z.string().optional(),
  }),
});

export const BookAsReferenceValidator = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
    pageID: z.string().refine((pageID) => !isNumber(pageID), {
      message: conductorErrors.err1,
    }),
  }),
});

export const GetReferencePageByPageIDAndLibrarySchema = z.object({
  params: z.object({
    pageID: z.string().refine((pageID) => !isNumber(pageID), {
      message: conductorErrors.err1,
    }),
    library: z.string()
  }),
});

export const GetReferenceProjectsSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
});