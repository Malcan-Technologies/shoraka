import { z } from "zod";
import { SiteDocumentType } from "@prisma/client";

// Enum values for validation
const siteDocumentTypes = Object.values(SiteDocumentType) as [string, ...string[]];

// Request presigned upload URL
export const requestUploadUrlSchema = z.object({
  type: z.enum(siteDocumentTypes as [SiteDocumentType, ...SiteDocumentType[]]),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  fileName: z.string().min(1).max(255),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // Max 10MB
  showInAccount: z.boolean().optional().default(false),
});

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;

// Create document record after upload
export const createDocumentSchema = z.object({
  type: z.enum(siteDocumentTypes as [SiteDocumentType, ...SiteDocumentType[]]),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  fileName: z.string().min(1).max(255),
  s3Key: z.string().min(1),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive(),
  showInAccount: z.boolean().optional().default(false),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

// Update document metadata
export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  showInAccount: z.boolean().optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

// Request replace upload URL
export const requestReplaceUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export type RequestReplaceUploadUrlInput = z.infer<typeof requestReplaceUploadUrlSchema>;

// Confirm file replacement
export const confirmReplaceSchema = z.object({
  s3Key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
});

export type ConfirmReplaceInput = z.infer<typeof confirmReplaceSchema>;

// Query params for listing documents (admin)
export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(siteDocumentTypes as [SiteDocumentType, ...SiteDocumentType[]]).optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
  search: z.string().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

// Document log event types
export const documentEventTypes = [
  "DOCUMENT_CREATED",
  "DOCUMENT_UPDATED",
  "DOCUMENT_REPLACED",
  "DOCUMENT_DELETED",
  "DOCUMENT_RESTORED",
] as const;

export type DocumentEventType = (typeof documentEventTypes)[number];

// Query params for document logs
export const getDocumentLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(15),
  search: z.string().optional(),
  eventType: z.enum(documentEventTypes).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
});

export type GetDocumentLogsQuery = z.infer<typeof getDocumentLogsQuerySchema>;

// Export query params for document logs
export const exportDocumentLogsQuerySchema = z.object({
  search: z.string().optional(),
  eventType: z.enum(documentEventTypes).optional(),
  eventTypes: z.array(z.enum(documentEventTypes)).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportDocumentLogsQuery = z.infer<typeof exportDocumentLogsQuerySchema>;

