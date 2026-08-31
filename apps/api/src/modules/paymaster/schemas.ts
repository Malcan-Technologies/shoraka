import { z } from "zod";

export const paymasterIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listPaymastersQuerySchema = z.object({
  q: z.string().trim().optional(),
  verificationStatus: z.enum(["UNVERIFIED", "VERIFIED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const issuerPaymastersQuerySchema = z.object({
  organizationId: z.string().min(1),
});

export const issuerPaymasterLookupQuerySchema = z.object({
  organizationId: z.string().min(1),
  registrationNumber: z.string().min(1),
});

export const verifyPaymasterBodySchema = z.object({
  applicationId: z.string().min(1).optional(),
});

export const marcAssessmentSchema = z.object({
  creditGrade: z.string().optional(),
  creditScore: z.unknown().optional(),
  probabilityOfDefault: z.unknown().optional(),
  reportDate: z.string().nullable().optional(),
  reportS3Key: z.string().nullable().optional(),
  reportFileName: z.string().nullable().optional(),
});

export const marcUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
});

export const assignmentNoticeUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  kind: z.enum(["notice", "acknowledgement"]),
});
