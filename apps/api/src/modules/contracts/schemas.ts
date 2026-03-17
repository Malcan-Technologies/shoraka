import { z } from "zod";

/** Canonical file structure for all application flow uploads. */
export const documentSchema = z.object({
  s3_key: z.string(),
  file_name: z.string(),
  file_size: z.number().optional(),
  uploaded_at: z.string().optional(),
});

export const contractDetailsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  number: z.string(),
  value: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  approved_facility: z.union([z.number(), z.null()]).optional(),
  utilized_facility: z.union([z.number(), z.null()]).optional(),
  available_facility: z.union([z.number(), z.null()]).optional(),
  // Financing amount requested by issuer (RM). Optional.
  financing: z.number(),
  document: documentSchema.nullable().optional(),
});

export const customerDetailsSchema = z.object({
  name: z.string(),
  entity_type: z.string(),
  ssm_number: z.string(),
  country: z.string(),
  is_related_party: z.boolean(),
  document: documentSchema.nullable().optional(),
});

export const createContractSchema = z.object({
  applicationId: z.string().cuid(),
});

export const updateContractSchema = z.object({
  contract_details: contractDetailsSchema.nullable().optional(),
  customer_details: customerDetailsSchema.optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "AMENDMENT_REQUESTED"]).optional(),
});

export const contractIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const requestContractUploadUrlSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
  type: z.enum(["contract", "consent"]),
  existingS3Key: z.string().optional(),
});
