import { z } from "zod";
import { CONTRACT_LOO_MERGE_KEYS } from "./contract-loo-merge.types";

const shape = Object.fromEntries(
  (CONTRACT_LOO_MERGE_KEYS as readonly string[]).map((key) => [
    key,
    z.string().optional().default(""),
  ])
) as Record<(typeof CONTRACT_LOO_MERGE_KEYS)[number], z.ZodDefault<z.ZodOptional<z.ZodString>>>;

export const contractLooMergeBodySchema = z.object(shape);

export const contractLooPrefillQuerySchema = z.object({
  contractId: z.string().min(1, "contractId is required"),
});

export const contractLooGenerateQuerySchema = z.object({
  format: z.enum(["docx", "pdf"]).default("docx"),
});
