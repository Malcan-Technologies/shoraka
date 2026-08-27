import { z } from "zod";

export const paymasterIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const listPaymastersQuerySchema = z.object({
  q: z.string().trim().optional(),
  mismatchPending: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const issuerPaymastersQuerySchema = z.object({
  organizationId: z.string().cuid(),
});

export const resolveMismatchSchema = z.object({
  keepExisting: z.boolean().default(true),
});

export const marcAssessmentSchema = z.object({
  creditGrade: z.string().min(1),
  creditScore: z.number().min(0).max(100).nullable().optional(),
  probabilityOfDefault: z.number().min(0).max(100).nullable().optional(),
  reportDate: z.string().datetime().nullable().optional(),
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
