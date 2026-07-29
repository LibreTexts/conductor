import { z } from "zod";

export const ReferenceFormatTypeEnum         = z.enum([
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
    format: ReferenceFormatTypeEnum
  }),
});
