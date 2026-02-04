import { z } from "zod";

export const documentSchema = z.object({
  s3_key: z.string(),
  file_name: z.string(),
  file_size: z.number(),
});

export const contractDetailsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  number: z.string(),
  value: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  approved_facility: z.number(),
  utilized_facility: z.number(),
  available_facility: z.number(),
  document: documentSchema.optional(),
});

export const customerDetailsSchema = z.object({
  name: z.string(),
  entity_type: z.string(),
  ssm_number: z.string(),
  country: z.string(),
  is_related_party: z.boolean(),
  document: documentSchema.optional(),
});

export const createContractSchema = z.object({
  applicationId: z.string().cuid(),
});

export const updateContractSchema = z.object({
  contract_details: contractDetailsSchema.optional(),
  customer_details: customerDetailsSchema.optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
});

export const contractIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const requestContractUploadUrlSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
  type: z.enum(["contract", "consent"]),
});
