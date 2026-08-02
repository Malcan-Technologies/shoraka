import { z } from "zod";

export const legalDocumentTypes = [
  "PDPA_NOTICE_AND_CONSENT",
  "TERMS_OF_USE",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
  "INVESTOR_AGREEMENT",
] as const;

export type LegalDocumentTypeValue = (typeof legalDocumentTypes)[number];

export const legalDocumentAudiences = ["PUBLIC", "ISSUER", "INVESTOR", "BOTH"] as const;
export const legalAcceptanceAudiences = ["ISSUER", "INVESTOR"] as const;
export const legalDocumentVersionStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const createLegalDocumentSchema = z.object({
  type: z.enum(legalDocumentTypes),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  audience: z.enum(legalDocumentAudiences).default("BOTH"),
  requiredForOnboarding: z.boolean().optional().default(true),
  publicVisibility: z.boolean().optional().default(false),
});

export type CreateLegalDocumentInput = z.infer<typeof createLegalDocumentSchema>;

export const updateLegalDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  audience: z.enum(legalDocumentAudiences).optional(),
  requiredForOnboarding: z.boolean().optional(),
  publicVisibility: z.boolean().optional(),
});

export type UpdateLegalDocumentInput = z.infer<typeof updateLegalDocumentSchema>;

export const listLegalDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(legalDocumentTypes).optional(),
  audience: z.enum(legalDocumentAudiences).optional(),
  search: z.string().optional(),
});

export type ListLegalDocumentsQuery = z.infer<typeof listLegalDocumentsQuerySchema>;

export const requestVersionUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export type RequestVersionUploadUrlInput = z.infer<typeof requestVersionUploadUrlSchema>;

export const createVersionSchema = z.object({
  s3Key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive(),
  fileHash: z.string().min(1).max(128).optional(),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const updateVersionSchema = z.object({
  fileHash: z.string().min(1).max(128).nullable().optional(),
});

export type UpdateVersionInput = z.infer<typeof updateVersionSchema>;

export const publishVersionSchema = z.object({
  reacceptanceRequired: z.boolean().optional().default(false),
});

export type PublishVersionInput = z.infer<typeof publishVersionSchema>;

export const requiredLegalDocumentsQuerySchema = z.object({
  audience: z.enum(legalAcceptanceAudiences),
  organizationId: z.string().min(1),
});

export type RequiredLegalDocumentsQuery = z.infer<typeof requiredLegalDocumentsQuerySchema>;

export const openLegalDocumentSchema = z.object({
  organizationId: z.string().min(1),
  audience: z.enum(legalAcceptanceAudiences),
});

export type OpenLegalDocumentInput = z.infer<typeof openLegalDocumentSchema>;

export const acceptLegalDocumentSchema = openLegalDocumentSchema;

export type AcceptLegalDocumentInput = z.infer<typeof acceptLegalDocumentSchema>;

export const legalDocumentEventTypes = [
  "LEGAL_DOCUMENT_CREATED",
  "LEGAL_DOCUMENT_UPDATED",
  "LEGAL_VERSION_UPLOADED",
  "LEGAL_VERSION_UPDATED",
  "LEGAL_VERSION_PUBLISHED",
  "LEGAL_VERSION_ARCHIVED",
  "LEGAL_DOCUMENT_OPENED",
  "LEGAL_DOCUMENT_ACCEPTED",
] as const;

export type LegalDocumentEventType = (typeof legalDocumentEventTypes)[number];
