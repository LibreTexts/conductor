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
