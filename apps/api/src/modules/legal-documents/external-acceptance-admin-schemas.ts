import { z } from "zod";
import { legalDocumentTypes } from "./schemas";

export const listLegalExternalAcceptancesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  documentType: z.enum(legalDocumentTypes).optional(),
  status: z.enum(["OPENED", "ACCEPTED"]).optional(),
  applicationId: z.string().optional(),
  envelopeId: z.string().optional(),
  organizationId: z.string().optional(),
  dateFrom: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined)),
  dateTo: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined)),
  sortBy: z.enum(["accepted_at", "created_at"]).optional().default("accepted_at"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ListLegalExternalAcceptancesQuery = z.infer<
  typeof listLegalExternalAcceptancesQuerySchema
>;

export const exportLegalExternalAcceptancesQuerySchema = listLegalExternalAcceptancesQuerySchema
  .omit({ page: true, pageSize: true })
  .extend({
    format: z.enum(["csv", "json"]).default("csv"),
  });

export type ExportLegalExternalAcceptancesQuery = z.infer<
  typeof exportLegalExternalAcceptancesQuerySchema
>;
