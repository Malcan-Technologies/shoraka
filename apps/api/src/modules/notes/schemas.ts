import { z } from "zod";
import { isNoteMoneyAmount } from "@cashsouk/types";
import {
  NoteFundingStatus,
  NoteLedgerAccountType,
  NoteListingStatus,
  NotePaymentSource,
  NoteServicingStatus,
  NoteStatus,
} from "@prisma/client";

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const noteSettlementParamsSchema = z.object({
  id: z.string().min(1),
  settlementId: z.string().min(1),
});

export const applicationIdParamSchema = z.object({
  applicationId: z.string().min(1),
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.string().min(1),
});

export const bucketAccountParamSchema = z.object({
  accountCode: z.nativeEnum(NoteLedgerAccountType),
});

export const bucketActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const investorOrganizationScopeSchema = z.object({
  investorOrganizationId: z.string().min(1).optional(),
});

export const investorPortfolioQuerySchema = investorOrganizationScopeSchema;

export const investorInvestmentsQuerySchema = investorOrganizationScopeSchema;

export const investorBalanceActivityQuerySchema = investorOrganizationScopeSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const statementDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format");

export const investorBalanceStatementQuerySchema = investorOrganizationScopeSchema
  .extend({
    startDate: statementDateSchema,
    endDate: statementDateSchema,
    format: z.enum(["csv", "pdf"]).default("csv"),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "Start date must be on or before end date",
    path: ["startDate"],
  });

export const investorPortfolioHistoryQuerySchema = investorOrganizationScopeSchema.extend({
  range: z.enum(["1W", "1M", "3M", "6M", "YTD", "ALL"]).default("6M"),
});

export const getNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(NoteStatus).optional(),
  listingStatus: z.nativeEnum(NoteListingStatus).optional(),
  fundingStatus: z.nativeEnum(NoteFundingStatus).optional(),
  servicingStatus: z.nativeEnum(NoteServicingStatus).optional(),
  issuerOrganizationId: z.string().optional(),
  paymaster: z.string().optional(),
  featuredOnly: z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .optional(),
  excludeRepaid: z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .optional(),
  /**
   * Admin registry: hide notes only when status is settled (repaid or servicing SETTLED),
   * settlement is posted, and service-fee trustee work is finished (no fee or COMPLETED).
   */
  excludeFullySettledRegistryNotes: z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .optional(),
});

export const createNoteFromApplicationSchema = z.object({
  sourceInvoiceId: z.string().nullable().optional(),
  title: z.string().min(1).max(180).optional(),
});

export const getAdminInvestmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["COMMITTED", "CONFIRMED", "RELEASED", "CANCELLED", "SETTLED"]).optional(),
  noteId: z.string().optional(),
  investorOrganizationId: z.string().optional(),
});

export const updateNoteDraftSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  targetAmount: z.number().positive().optional(),
  maturityDate: z.string().datetime().nullable().optional(),
  platformFeeRatePercent: z.number().min(0).max(100).optional(),
  serviceFeeRatePercent: z
    .number()
    .min(0)
    .max(15)
    .refine((v) => {
      if (!Number.isFinite(v)) return false;
      const scaled = v * 100;
      const rounded = Math.round(scaled);
      return Math.abs(scaled - rounded) < 1e-9;
    }, { message: "Service fee rate can have up to 2 decimal places" })
    .optional(),
  serviceFeeCustomerScope: z.string().max(120).nullable().optional(),
  profitRatePercent: z.number().min(0).nullable().optional(),
  summary: z.string().max(1000).nullable().optional(),
});

export const updateNoteFeaturedSchema = z.object({
  isFeatured: z.boolean(),
  featuredRank: z.number().int().min(1).max(9999).nullable().optional(),
  featuredFrom: z.string().datetime().nullable().optional(),
  featuredUntil: z.string().datetime().nullable().optional(),
});

export const createInvestmentSchema = z.object({
  amount: z
    .number()
    .positive()
    .refine((value) => isNoteMoneyAmount(value), {
      message: "Investment amount must have at most 2 decimal places",
    }),
  investorOrganizationId: z.string().min(1),
});

export const testInvestorBalanceTopupSchema = z.object({
  investorOrganizationId: z.string().min(1),
  amount: z.number().positive(),
});

export const recordPaymentSchema = z.object({
  source: z.nativeEnum(NotePaymentSource),
  receiptAmount: z.number().positive(),
  receiptDate: z.string().datetime(),
  reference: z.string().max(120).nullable().optional(),
  evidenceS3Key: z.string().max(500).nullable().optional(),
  scheduleId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const paymentReviewSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
});

export const settlementPreviewSchema = z.object({
  paymentId: z.string().nullable().optional(),
  receiptAmount: z.number().positive().optional(),
  receiptDate: z.string().datetime().optional(),
  tawidhAmount: z.number().min(0).optional(),
  tawidhInvestorSharePercent: z.number().min(0).max(100).optional(),
  gharamahAmount: z.number().min(0).optional(),
});

export const settlementActionSchema = z.object({
  settlementId: z.string().min(1),
});

export const lateChargeSchema = z.object({
  receiptAmount: z.number().positive(),
  receiptDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  tawidhAmount: z.number().min(0).optional(),
  gharamahAmount: z.number().min(0).optional(),
});

export const overdueLateChargeSchema = z.object({
  receiptAmount: z.number().positive().optional(),
  receiptDate: z.string().datetime().optional(),
});

export const defaultMarkSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const updatePlatformFinanceSettingsSchema = z.object({
  gracePeriodDays: z.number().int().min(0).max(60).optional(),
  arrearsThresholdDays: z.number().int().min(0).max(120).optional(),
  tawidhRateCapPercent: z.number().min(0).max(1).optional(),
  gharamahRateCapPercent: z.number().min(0).max(9).optional(),
  platformFeeRateCapPercent: z.number().min(0).max(100).optional(),
  defaultTawidhRatePercent: z.number().min(0).max(1).optional(),
  defaultGharamahRatePercent: z.number().min(0).max(9).optional(),
  withdrawalLetterTemplate: z.string().min(1).optional(),
  arrearsLetterTemplate: z.string().min(1).optional(),
  defaultLetterTemplate: z.string().min(1).optional(),
});

export const createWithdrawalSchema = z.object({
  noteId: z.string().nullable().optional(),
  investorOrganizationId: z.string().nullable().optional(),
  issuerOrganizationId: z.string().nullable().optional(),
  withdrawalType: z.enum(["INVESTOR_WITHDRAWAL", "ISSUER_RESIDUAL_RETURN", "ADMIN_ADJUSTMENT"]),
  amount: z.number().positive(),
  beneficiarySnapshot: z.record(z.unknown()),
});

export const updateWithdrawalBeneficiarySchema = z.object({
  beneficiarySnapshot: z.record(z.unknown()),
});

export type GetNotesQuery = z.infer<typeof getNotesQuerySchema>;
