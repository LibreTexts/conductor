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
) as Record<
  (typeof OPTIONAL_REFERENCE_FIELDS)[number],
  z.ZodOptional<z.ZodString>
>;

export const ReferenceEntrySchema = z.object({
  entryType: EntryTypeEnum,
  referenceID: z.string().length(10).optional(),
  citationKey: z.string().min(1),
  ...optionalReferenceFieldSchema,
});

/** Shared route params for project-scoped reference endpoints. */
const ProjectIDParamsSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
});

export const GetReferencePageSchema = ProjectIDParamsSchema;

export const UpdateReferenceFormatSchema = ProjectIDParamsSchema.extend({
  body: z.object({
    format: ReferenceFormatTypeEnum,
    displayLocation: z
      .enum(["endOfPage", "endOfChapter", "backmatter"])
      .optional(),
    pageTitle: z.string().optional(),
    selectedList: z.array(z.string()).optional(),
  }),
});

export const ReferenceScopeModeEnum = z.enum(["PAGE", "CHAPTER", "BACKMATTER"]);

/** Same limits as the glossary scope's groups. */
const ReferenceScopeGroupSchema = z.object({
  groupID: z.string().min(1).max(64),
  pageIds: z.array(z.string().min(1).max(100)).max(2000),
  targetPageId: z.string().min(1).max(100),
});

export const SaveReferenceScopeSchema = ProjectIDParamsSchema.extend({
  body: z.object({
    format: ReferenceFormatTypeEnum,
    /** Title of the shared back-matter References page (BACKMATTER only). */
    pageTitle: z.string().max(200).optional(),
    mode: ReferenceScopeModeEnum,
    groups: z.array(ReferenceScopeGroupSchema).max(500),
  }),
});

export const DeleteReferenceScopeSchema = ProjectIDParamsSchema;

export const UpdateReferenceEntrySchema = ProjectIDParamsSchema.extend({
  body: z.object({
    entry: ReferenceEntrySchema,
  }),
});

export const SearchReferencesValidator = ProjectIDParamsSchema.extend({
  query: z.object({
    query: z.string().min(1),
  }),
});

export const DeleteReferenceEntrySchema = ProjectIDParamsSchema.extend({
  body: z.object({
    referenceID: z.string().length(10),
    deleteFromReferences: z.boolean().optional().default(false),
  }),
});

export const AddReferenceEntrySchema = ProjectIDParamsSchema.extend({
  body: z.object({
    referenceIDs: z
      .array(z.string().length(10))
      .min(1, { message: "At least one referenceID is required" }),
  }),
});

export const tocValidator = ProjectIDParamsSchema.extend({
  query: z.object({
    toc: z.coerce.boolean().optional(),
    bookID: z.string().optional(),
  }),
});

export const BookAsReferenceValidator = ProjectIDParamsSchema.extend({
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
    library: z.string(),
  }),
});

export const GetReferenceProjectsSchema = ProjectIDParamsSchema;

export const PopulateReferenceSchema = ProjectIDParamsSchema;
