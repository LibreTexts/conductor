import { z } from "zod";

const LIBRETEXTS_HOSTNAME = /^[a-z0-9-]+\.libretexts\.org$/i;

export function isValidLibretextsURL(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return LIBRETEXTS_HOSTNAME.test(parsed.hostname);
}

export const SubmitEditorPreprocessValidator = z.object({
  body: z.object({
    url: z.string().refine(isValidLibretextsURL, {
      message: "URL must be a valid HTTPS *.libretexts.org URL",
    }),
  }),
});

export const GetBookBotRunValidator = z.object({
  params: z.object({
    jobID: z.uuid(),
  }),
});

export const ListBookBotRunsValidator = z.object({
  query: z.object({
    botType: z.enum(["editor-preprocess"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }),
});

export const RunnerCallbackValidator = z.object({
  params: z.object({
    jobID: z.uuid(),
  }),
  body: z.object({
    jobId: z.string(),
    state: z.enum([
      "starting",
      "getSubpages",
      "processing",
      "done",
      "error",
    ]),
    percentage: z.number().int().min(0).max(100).optional(),
    pages: z
      .array(
        z.object({
          path: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    message: z.string().optional(),
    messages: z.array(z.string()).optional(),
  }),
});
