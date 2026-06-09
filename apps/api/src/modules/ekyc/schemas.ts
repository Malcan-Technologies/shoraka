import { z } from "zod";

export const EKYC_DOC_TYPES = ["mykad", "passport"] as const;

export const sessionBodySchema = z.object({
  docType: z.enum(EKYC_DOC_TYPES).default("mykad"),
});

export const statusQuerySchema = z.object({
  token: z.string().min(1),
});

export const completeBodySchema = z.object({
  token: z.string().min(1),
  result: z.unknown(),
});
