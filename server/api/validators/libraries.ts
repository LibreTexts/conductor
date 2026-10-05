import { z } from "zod";

export const GetLibraryFromSubdomainSchema = z.object({
  params: z.object({
    subdomain: z.string(),
  }),
  query: z.object({
    includeHidden: z.coerce.boolean().optional(),
  }),
});

/**
 * Lists the shelves beneath `path` on a library.
 *
 * `path` is library-relative (`Bookshelves/Organic_Chemistry`); omitting it asks
 * for the library's sync roots. A leading slash or a `..` segment is rejected
 * rather than normalized — both mean the caller built the path from something
 * other than a previous response from this endpoint.
 */
export const GetLibraryShelvesSchema = z.object({
  params: z.object({
    subdomain: z.string().min(1).max(50),
  }),
  query: z.object({
    path: z
      .string()
      .max(500)
      .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), {
        message: "Path must be library-relative.",
      })
      .optional(),
  }),
});

/**
 * Finds which libraries carry a given shelf path.
 *
 * Same path rules as {@link GetLibraryShelvesSchema}, except the path is the
 * whole point of the request and so required.
 */
export const FindShelfAcrossLibrariesSchema = z.object({
  query: z.object({
    path: z
      .string()
      .min(1)
      .max(500)
      .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), {
        message: "Path must be library-relative.",
      }),
  }),
});
