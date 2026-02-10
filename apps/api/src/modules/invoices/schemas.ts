import { z } from "zod";
import { documentSchema } from "../contracts/schemas";

export const invoiceDetailsSchema = z.object({
  number: z.string(),
  value: z.number(),
  maturity_date: z.string(),
  financing_ratio_percent: z.number().min(60).max(80).optional().default(60),
  document: documentSchema.nullable().optional(),
});

export const createInvoiceSchema = z.object({
  applicationId: z.string().cuid(),
  contractId: z.string().cuid().optional(),
  details: invoiceDetailsSchema,
});

export const updateInvoiceSchema = z.object({
  details: invoiceDetailsSchema.partial().optional(),
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

