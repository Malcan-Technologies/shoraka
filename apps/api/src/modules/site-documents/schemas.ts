import { z } from "zod";
import {
  LEGAL_DOCUMENT_DEFAULT_AUDIENCE,
  isOnboardingLegalDocumentType,
  type LegalDocumentAudience,
} from "@cashsouk/types";

export type SiteDocumentType =
  | "TERMS_AND_CONDITIONS"
  | "PRIVACY_POLICY"
  | "RISK_DISCLOSURE"
  | "PRODUCT_TERMS"
  | "PLATFORM_AGREEMENT"
  | "INVESTOR_GUIDE"
  | "ISSUER_GUIDE"
  | "OTHER"
  | "PDPA_NOTICE"
  | "RISK_STATEMENT"
  | "ISSUER_WARNING_STATEMENT"
  | "ISSUER_AGREEMENT"
  | "INVESTOR_WARNING_STATEMENT"
  | "INVESTOR_AGREEMENT";

export const siteDocumentTypes: SiteDocumentType[] = [
  "TERMS_AND_CONDITIONS",
  "PRIVACY_POLICY",
  "RISK_DISCLOSURE",
  "PRODUCT_TERMS",
  "PLATFORM_AGREEMENT",
  "INVESTOR_GUIDE",
  "ISSUER_GUIDE",
  "OTHER",
  "PDPA_NOTICE",
  "RISK_STATEMENT",
  "ISSUER_WARNING_STATEMENT",
  "ISSUER_AGREEMENT",
  "INVESTOR_WARNING_STATEMENT",
  "INVESTOR_AGREEMENT",
];

const siteDocumentTypeEnum = z.enum(siteDocumentTypes as [SiteDocumentType, ...SiteDocumentType[]]);

export const legalDocumentAudiences = ["PUBLIC", "ISSUER", "INVESTOR", "BOTH"] as const;
export const legalDocumentStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const legalAcceptanceAudiences = ["ISSUER", "INVESTOR"] as const;

function defaultAudienceForType(type: SiteDocumentType): LegalDocumentAudience {
  if (isOnboardingLegalDocumentType(type)) {
    return LEGAL_DOCUMENT_DEFAULT_AUDIENCE[type];
  }
  return "PUBLIC";
}

export const requestUploadUrlSchema = z
  .object({
    type: siteDocumentTypeEnum,
    title: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    fileName: z.string().min(1).max(255),
    contentType: z.literal("application/pdf"),
    fileSize: z.number().int().positive().max(10 * 1024 * 1024),
    showInAccount: z.boolean().optional().default(false),
    audience: z.enum(legalDocumentAudiences).optional(),
    acceptanceRequired: z.boolean().optional(),
    openBeforeAcceptRequired: z.boolean().optional(),
    reacceptanceRequired: z.boolean().optional(),
    effectiveDate: z.string().datetime().optional(),
    fileHash: z.string().min(8).max(128).optional(),
  })
  .transform((data) => ({
    ...data,
    audience: data.audience ?? defaultAudienceForType(data.type),
    acceptanceRequired:
      data.acceptanceRequired ?? isOnboardingLegalDocumentType(data.type),
    openBeforeAcceptRequired:
      data.openBeforeAcceptRequired ?? isOnboardingLegalDocumentType(data.type),
    reacceptanceRequired: data.reacceptanceRequired ?? false,
  }));

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;

export const createDocumentSchema = z
  .object({
    type: siteDocumentTypeEnum,
    title: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    fileName: z.string().min(1).max(255),
    s3Key: z.string().min(1),
    contentType: z.literal("application/pdf"),
    fileSize: z.number().int().positive(),
    showInAccount: z.boolean().optional().default(false),
    audience: z.enum(legalDocumentAudiences).optional(),
    acceptanceRequired: z.boolean().optional(),
    openBeforeAcceptRequired: z.boolean().optional(),
    reacceptanceRequired: z.boolean().optional(),
    effectiveDate: z.string().datetime().nullable().optional(),
    fileHash: z.string().min(8).max(128).nullable().optional(),
  })
  .transform((data) => ({
    ...data,
    audience: data.audience ?? defaultAudienceForType(data.type),
    acceptanceRequired:
      data.acceptanceRequired ?? isOnboardingLegalDocumentType(data.type),
    openBeforeAcceptRequired:
      data.openBeforeAcceptRequired ?? isOnboardingLegalDocumentType(data.type),
    reacceptanceRequired: data.reacceptanceRequired ?? false,
  }));

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  showInAccount: z.boolean().optional(),
  audience: z.enum(legalDocumentAudiences).optional(),
  acceptanceRequired: z.boolean().optional(),
  openBeforeAcceptRequired: z.boolean().optional(),
  reacceptanceRequired: z.boolean().optional(),
  effectiveDate: z.string().datetime().nullable().optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const requestReplaceUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  fileHash: z.string().min(8).max(128).optional(),
});

export type RequestReplaceUploadUrlInput = z.infer<typeof requestReplaceUploadUrlSchema>;

export const confirmReplaceSchema = z.object({
  s3Key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  fileHash: z.string().min(8).max(128).nullable().optional(),
});

export type ConfirmReplaceInput = z.infer<typeof confirmReplaceSchema>;

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: siteDocumentTypeEnum.optional(),
  status: z.enum(legalDocumentStatuses).optional(),
  audience: z.enum(legalDocumentAudiences).optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
  search: z.string().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

export const documentEventTypes = [
  "DOCUMENT_CREATED",
  "DOCUMENT_UPDATED",
  "DOCUMENT_REPLACED",
  "DOCUMENT_DELETED",
  "DOCUMENT_RESTORED",
  "DOCUMENT_PUBLISHED",
  "DOCUMENT_ARCHIVED",
  "DOCUMENT_OPENED",
  "DOCUMENT_ACCEPTED",
] as const;

export type DocumentEventType = (typeof documentEventTypes)[number];

export const getDocumentLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(15),
  search: z.string().optional(),
  eventType: z.enum(documentEventTypes).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
});

export type GetDocumentLogsQuery = z.infer<typeof getDocumentLogsQuerySchema>;

export const exportDocumentLogsQuerySchema = z.object({
  search: z.string().optional(),
  eventType: z.enum(documentEventTypes).optional(),
  eventTypes: z.array(z.enum(documentEventTypes)).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportDocumentLogsQuery = z.infer<typeof exportDocumentLogsQuerySchema>;

export const publishDocumentSchema = z.object({
  reacceptanceRequired: z.boolean().default(false),
});

export type PublishDocumentInput = z.infer<typeof publishDocumentSchema>;

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

export const acceptLegalDocumentSchema = z.object({
  organizationId: z.string().min(1),
  audience: z.enum(legalAcceptanceAudiences),
});

export type AcceptLegalDocumentInput = z.infer<typeof acceptLegalDocumentSchema>;
