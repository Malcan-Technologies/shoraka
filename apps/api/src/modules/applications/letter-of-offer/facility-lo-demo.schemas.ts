import { z } from "zod";
import { CONTRACT_FACILITY_LO_MERGE_KEYS } from "./facility-lo-merge.types";

const shape = Object.fromEntries(
  (CONTRACT_FACILITY_LO_MERGE_KEYS as readonly string[]).map((key) => [
    key,
    z.string().optional().default(""),
  ])
) as Record<(typeof CONTRACT_FACILITY_LO_MERGE_KEYS)[number], z.ZodDefault<z.ZodOptional<z.ZodString>>>;

const guarantorSchema = z.object({
  name: z.string().optional().default(""),
  nric: z.string().optional().default(""),
  line: z.string().optional().default(""),
});

const corporateSignatorySchema = z.object({
  name: z.string().optional().default(""),
});

const corporateGuarantorSchema = z.object({
  name: z.string().optional().default(""),
  ssm: z.string().optional().default(""),
  signatories: z.array(corporateSignatorySchema).optional().default([]),
});

export const facilityLoMergeBodySchema = z.object({
  ...shape,
  guarantors_individual: z.array(guarantorSchema).optional(),
  guarantors_corporate: z.array(corporateGuarantorSchema).optional(),
});

export const facilityLoPrefillQuerySchema = z.object({
  contractId: z.string().min(1, "contractId is required"),
});

export const facilityLoGenerateQuerySchema = z.object({
  format: z.enum(["docx", "pdf"]).default("docx"),
});
