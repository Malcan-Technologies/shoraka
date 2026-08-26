import { z } from "zod";
import {
  FINANCING_TENURE_MAX_DAYS,
  FINANCING_TENURE_MIN_DAYS,
  FINANCING_TENURE_STEP_DAYS,
  MAX_INVOICE_FINANCING_RATIO_PERCENT,
  isValidFinancingTenureDays,
  validateFinancingTenureAgainstDueDate,
} from "@cashsouk/types";
import { documentSchema } from "../contracts/schemas";

const financingTenureDaysSchema = z
  .number({
    required_error: "Financing tenure is required.",
    invalid_type_error: "Financing tenure must be a whole number of days.",
  })
  .int("Financing tenure must be a whole number of days.")
  .refine(isValidFinancingTenureDays, {
    message: `Financing tenure must be between ${FINANCING_TENURE_MIN_DAYS} and ${FINANCING_TENURE_MAX_DAYS} days in ${FINANCING_TENURE_STEP_DAYS}-day steps.`,
  });

export const invoiceDetailsFieldsSchema = z.object({
  number: z.string(),
  value: z.number(),
  maturity_date: z.string(),
  financing_ratio_percent: z
    .number()
    .min(1)
    .max(MAX_INVOICE_FINANCING_RATIO_PERCENT)
    .optional()
    .default(60),
  financing_tenure_days: financingTenureDaysSchema,
  document: documentSchema.nullable().optional(),
});

export const invoiceDetailsSchema = invoiceDetailsFieldsSchema.superRefine((data, ctx) => {
  const result = validateFinancingTenureAgainstDueDate({
    tenureDays: data.financing_tenure_days,
    maturityDate: data.maturity_date,
  });
  if (!result.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["financing_tenure_days"],
      message: result.message,
    });
  }
});

export const createInvoiceSchema = z.object({
  applicationId: z.string().cuid(),
  contractId: z.string().cuid().optional(),
  details: invoiceDetailsSchema,
});

export const updateInvoiceSchema = z.object({
  details: invoiceDetailsFieldsSchema.partial().optional(),
  document: documentSchema.nullable().optional(),
  contractId: z.string().cuid().nullable().optional(),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const requestInvoiceUploadUrlSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
  existingS3Key: z.string().optional(),
});

export const withdrawInvoiceSchema = z.object({
  reason: z.enum(["USER_CANCELLED"]).optional(),
});
