import { z } from "zod";

export const isUUID = (value: string) => z.string().uuid().safeParse(value).success;
