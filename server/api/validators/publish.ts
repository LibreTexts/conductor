import { z } from "zod";

/**
 * Longest destination path accepted. MindTouch paths nest a few levels deep
 * (`Courses/<campus>/<course>/<title>`); the cap exists so a hostile payload
 * cannot push an unbounded string into a library-mutating call.
 */
const MAX_PATH_LENGTH = 512;

/**
 * A destination path relative to the library root.
 *
 * The value reaches MindTouch's `move?to=`, so it is constrained rather than
 * trusted: no scheme (it must not become an absolute URL), no leading slash,
 * and no `..` segment that could climb out of the intended subtree.
 */
export const DestinationPath = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PATH_LENGTH)
  .refine((v) => !/^[a-z][a-z0-9+.-]*:/i.test(v), {
    message: "Destination must be a path, not a URL.",
  })
  .refine((v) => !v.startsWith("/"), {
    message: "Destination must be relative to the library root.",
  })
  .refine((v) => !v.split("/").includes(".."), {
    message: 'Destination must not contain a ".." segment.',
  });

const ProjectScopedParams = z.object({
  projectID: z.string().length(10),
});

export const PublishStatusValidator = z.object({
  params: ProjectScopedParams,
});

export const PublishStepValidator = z.object({
  params: ProjectScopedParams,
});

export const ListDestinationsValidator = z.object({
  params: ProjectScopedParams,
  query: z.object({
    path: DestinationPath.optional(),
  }),
});

export const MoveBookValidator = z.object({
  params: ProjectScopedParams,
  body: z.object({
    to: DestinationPath,
  }),
});

/**
 * Longest Lulu printing tag accepted. Same reasoning as the path cap above: the
 * value reaches a library-mutating call, so it is bounded. Generous, because
 * the tag packs four human-readable fields into one string.
 */
const MAX_LULU_TAG_LENGTH = 512;

/**
 * A book's Lulu print-fulfillment tag, as stored on the CXOne coverpage.
 *
 * The shape is `lulu@<cover_title>@<author_name>@<institution>@<spine_title>`,
 * so the segments are prose: spaces, commas, and periods all belong there
 * ("lulu@Introductory Chemistry@Delmar Larsen, PhD@UC Davis@Intro Chem"), and a
 * single space is how a segment says "use the cover page's own value". Only the
 * `lulu@` prefix is enforced; past it the content is Lulu's business.
 *
 * Control characters are the one exclusion — they do not survive a MindTouch
 * tag value intact. Surrounding whitespace is trimmed, so an empty string is
 * the removal signal.
 */
export const LuluPrintingTag = z
  .string()
  .trim()
  .max(MAX_LULU_TAG_LENGTH)
  .refine((v) => v === "" || /^lulu@/i.test(v), {
    message: 'Tag must start with "lulu@".',
  })
  // Covers tabs and line breaks too, which are themselves below 0x20.
  .refine((v) => ![...v].some((c) => c.charCodeAt(0) < 0x20), {
    message: "Tag must not contain line breaks, tabs, or control characters.",
  });

export const LuluTagValidator = z.object({
  params: ProjectScopedParams,
  body: z.object({
    tag: LuluPrintingTag,
  }),
});
