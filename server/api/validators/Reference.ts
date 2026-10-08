import { z } from "zod";
import { checkBookIDFormat } from "../../util/bookutils";
import conductorErrors from "../../conductor-errors";
import {
  CITATION_KEY_PATTERN,
  CITATION_KEY_RULE,
  maxLengthFor,
  normalizeDoi,
  normalizeHttpUrl,
  sanitizeReferenceText,
} from "../../util/referenceSanitize.js";
import { REFERENCE_BACKMATTER_TARGET } from "../../models/referenceusage.js";
import {
  ENTRY_TYPES,
  OPTIONAL_REFERENCE_FIELDS,
} from "../../models/reference.js";

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

export const EntryTypeEnum = z.enum(ENTRY_TYPES);

/** Raw input cap before cleaning; cleaned values are capped per field. */
const RAW_FIELD_MAX = 10_000;

/**
 * Each field is stored inert (see util/referenceSanitize): URLs must be
 * http(s), DOIs must look like DOIs, and other fields become plain text.
 * Empty strings stay allowed so a field can be cleared.
 */
const referenceFieldSchema = (field: string) =>
  z
    .string()
    .max(RAW_FIELD_MAX)
    .transform((value, ctx) => {
      if (field === "url") {
        const url = normalizeHttpUrl(value);
        if (url === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "URL must be a full http:// or https:// address",
          });
          return z.NEVER;
        }
        return url;
      }
      if (field === "doi") {
        const doi = normalizeDoi(value);
        if (doi === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "DOI must look like 10.1234/example",
          });
          return z.NEVER;
        }
        return doi;
      }
      return sanitizeReferenceText(value, maxLengthFor(field));
    })
    .optional();

const optionalReferenceFieldSchema = Object.fromEntries(
  OPTIONAL_REFERENCE_FIELDS.map((key) => [key, referenceFieldSchema(key)]),
) as Record<
  (typeof OPTIONAL_REFERENCE_FIELDS)[number],
  ReturnType<typeof referenceFieldSchema>
>;

export const CitationKeySchema = z
  .string()
  .trim()
  .regex(CITATION_KEY_PATTERN, { message: CITATION_KEY_RULE });

export const ReferenceEntrySchema = z.object({
  entryType: EntryTypeEnum,
  referenceID: z.string().length(10).optional(),
  citationKey: CitationKeySchema,
  ...optionalReferenceFieldSchema,
});

/** Title of the back-matter References page: plain text. */
const PageTitleSchema = z
  .string()
  .max(1000)
  .transform((value) => sanitizeReferenceText(value, 200));

/** A library page ID as stored in scope groups and lists. */
const ScopePageIDSchema = z.string().regex(/^\d{1,12}$/);

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
    pageTitle: PageTitleSchema.optional(),
    selectedList: z.array(ScopePageIDSchema).max(2000).optional(),
  }),
});

export const ReferenceScopeModeEnum = z.enum(["PAGE", "CHAPTER", "BACKMATTER"]);

/** Same limits as the glossary scope's groups. */
const ReferenceScopeGroupSchema = z.object({
  groupID: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  pageIds: z.array(ScopePageIDSchema).max(2000),
  // A page ID, or the placeholder for the not-yet-created back-matter page.
  targetPageId: z.union([
    ScopePageIDSchema,
    z.literal(REFERENCE_BACKMATTER_TARGET),
  ]),
});

export const SaveReferenceScopeSchema = ProjectIDParamsSchema.extend({
  body: z.object({
    format: ReferenceFormatTypeEnum,
    /** Title of the shared back-matter References page (BACKMATTER only). */
    pageTitle: PageTitleSchema.optional(),
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
    query: z.string().min(1).max(200),
  }),
});

export const DeleteReferenceEntrySchema = ProjectIDParamsSchema.extend({
  body: z.object({
    referenceID: z.string().length(10),
    deleteFromReferences: z.boolean().optional().default(false),
  }),
});

export const BulkDeleteReferenceEntriesSchema = ProjectIDParamsSchema.extend({
  body: z.object({
    referenceIDs: z
      .array(z.string().length(10))
      .min(1, { message: "Select at least one reference" })
      .max(500),
    /** Applied only to references this project owns; others are just removed. */
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
    bookID: z
      .string()
      .refine(checkBookIDFormat, { message: conductorErrors.err1 })
      .optional(),
  }),
});

/** A library page ID: digits only (it is parsed and sent to the library API). */
const PageIDSchema = z
  .string()
  .regex(/^\d{1,12}$/, { message: conductorErrors.err1 });

/**
 * A library subdomain (e.g. "chem"). These routes are public and the value
 * picks API credentials and a hostname, so only plausible subdomains pass.
 */
const LibrarySchema = z
  .string()
  .regex(/^[a-z0-9-]{2,12}$/, { message: conductorErrors.err1 });

export const BookAsReferenceValidator = ProjectIDParamsSchema.extend({
  body: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
    pageID: PageIDSchema,
  }),
});

export const GetReferencePageByPageIDAndLibrarySchema = z.object({
  params: z.object({
    pageID: PageIDSchema,
    library: LibrarySchema,
  }),
});

export const GetReferenceProjectsSchema = ProjectIDParamsSchema;

export const PopulateReferenceSchema = ProjectIDParamsSchema;
