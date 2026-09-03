/**
 * Guide: docs/guides/application-flow/financial-statements-step.md — Financial statements step schema and field mappings
 */

import { z } from "zod";
import {
  GUARANTOR_COMPANY_RELATIONSHIPS,
  GUARANTOR_INDIVIDUAL_RELATIONSHIPS,
  UTILISATION_OFFER_CONSENT_IDS,
  areUtilisationOfferConsentsComplete,
  isRegtankIso3166Code,
  type GuarantorCompanyRelationship,
  type GuarantorIndividualRelationship,
} from "@cashsouk/types";

/**
 * Schema for creating a new application
 */
export const createApplicationSchema = z.object({
  productId: z.string().cuid(),
  issuerOrganizationId: z.string().cuid(),
});

/**
 * Schema for updating an application step
 */
export const updateApplicationStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  stepId: z.string(),
  data: z.record(z.unknown()),
  forceRewindToStep: z.number().int().min(1).optional(),
});


/**
 * Schema for application ID parameter
 */
export const applicationIdParamSchema = z.object({
  id: z.string().cuid(),
});

/** Accepts boolean or legacy "yes"/"no" string; outputs boolean. */
const yesNoBooleanSchema = z
  .union([z.boolean(), z.enum(["yes", "no"])])
  .transform((v) => v === true || v === "yes")
  .optional();

const aboutYourBusinessSchema = z.object({
  what_does_company_do: z.string().max(1000).optional().default(""),
  main_customers: z.string().max(400).optional().default(""),
  single_customer_over_50_revenue: yesNoBooleanSchema,
});

const whyRaisingFundsSchema = z.object({
  financing_for: z.string().max(400).optional().default(""),
  how_funds_used: z.string().max(400).optional().default(""),
  business_plan: z.string().max(1000).optional().default(""),
  risks_delay_repayment: z.string().max(400).optional().default(""),
  backup_plan: z.string().max(400).optional().default(""),
  raising_on_other_p2p: yesNoBooleanSchema,
  platform_name: z.string().max(200).nullable().optional(),
  amount_raised: z.union([z.string(), z.number()]).nullable().optional(),
  same_invoice_used: z.boolean().nullable().optional(),
  accounting_software: z.string().max(200).optional().default(""),
  supporting_documents: z
    .array(
      z.object({
        file_name: z.string().min(1),
        file_size: z.number().int().nonnegative(),
        s3_key: z.string().min(1),
        uploaded_at: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

const guarantorAgreementSchema = z
  .object({
    file_name: z.string().min(1),
    file_size: z.number().int().nonnegative(),
    s3_key: z.string().min(1),
    uploaded_at: z.string().optional(),
  })
  .strict();

const guarantorAgreementFieldSchema = z.union([
  guarantorAgreementSchema,
  z.array(guarantorAgreementSchema).min(1),
]);

const guarantorIndividualSchema = z.object({
  guarantor_type: z.literal("individual"),
  reference_id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  relationship: z.enum([...GUARANTOR_INDIVIDUAL_RELATIONSHIPS] as [GuarantorIndividualRelationship, ...GuarantorIndividualRelationship[]]),
  relationship_other: z.string().max(500).optional().nullable(),
  ic_number: z
    .string()
    .min(1)
    .max(30)
    .refine((s) => s.replace(/\D/g, "").length === 12, {
      message: "IC number must be 12 digits",
    }),
  /** RegTank appendix A: ISO 3166 alpha-2 (e.g. MY). */
  nationality: z
    .string()
    .min(1, "Nationality is required")
    .transform((s) => s.trim().toUpperCase())
    .refine((c) => c.length === 2 && isRegtankIso3166Code(c), {
      message: "Nationality must be a valid RegTank ISO 3166 country code",
    }),
  guarantor_agreement: guarantorAgreementFieldSchema.optional(),
});

const guarantorCompanySchema = z.object({
  guarantor_type: z.literal("company"),
  reference_id: z.string().min(1),
  email: z.string().email(),
  business_name: z.string().min(1).max(200),
  ssm_number: z.string().min(1).max(50),
  relationship: z.enum([...GUARANTOR_COMPANY_RELATIONSHIPS] as [GuarantorCompanyRelationship, ...GuarantorCompanyRelationship[]]),
  guarantor_agreement: guarantorAgreementFieldSchema.optional(),
});

const guarantorEntrySchema = z.discriminatedUnion("guarantor_type", [
  guarantorIndividualSchema,
  guarantorCompanySchema,
]);

function refineBusinessDetailsPayload(
  data: {
    why_raising_funds?: {
      raising_on_other_p2p?: boolean;
      same_invoice_used?: boolean | null;
    };
    guarantors: Array<{
      guarantor_type: "individual" | "company";
      relationship?: string;
      relationship_other?: string | null;
    }>;
  },
  ctx: z.RefinementCtx,
  options: { requireGuarantors: boolean }
) {
  const w = data.why_raising_funds;
  if (w?.raising_on_other_p2p === true && w?.same_invoice_used === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "This invoice has already been applied on another P2P platform and cannot be submitted.",
      path: ["why_raising_funds", "same_invoice_used"],
    });
  }

  if (options.requireGuarantors && data.guarantors.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one guarantor is required",
      path: ["guarantors"],
    });
  }

  for (let i = 0; i < data.guarantors.length; i++) {
    const g = data.guarantors[i];
    if (g.guarantor_type === "individual") {
      const relationship = g.relationship;
      if (relationship === "others") {
        const other = typeof g.relationship_other === "string" ? g.relationship_other : "";
        if (!other.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please specify how this guarantor is related",
            path: ["guarantors", i, "relationship_other"],
          });
        }
      }
    }
  }
}

const businessDetailsObjectSchema = z.object({
  about_your_business: aboutYourBusinessSchema.optional().default({}),
  why_raising_funds: whyRaisingFundsSchema.optional().default({}),
  declaration_confirmed: z.boolean(),
  guarantors: z.array(guarantorEntrySchema).optional().default([]),
});

export const businessDetailsDataSchema = businessDetailsObjectSchema.superRefine((data, ctx) =>
  refineBusinessDetailsPayload(data, ctx, { requireGuarantors: true })
);

/** Drawdowns inherit facility guarantors; fundraising fields are still collected. */
export const businessDetailsInheritedGuarantorsDataSchema = businessDetailsObjectSchema.superRefine(
  (data, ctx) => refineBusinessDetailsPayload(data, ctx, { requireGuarantors: false })
);

const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar day: ISO YYYY-MM-DD must be strictly after today (next FY end). */
function isoCalendarDateStrictlyAfterToday(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const chosen = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(chosen.getTime())) return false;
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const c = new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate());
  return c.getTime() > today.getTime();
}

/** Validates stored input fields for financial_statements step. Per-year block; no bsdd. */
const numSchema = z.union([z.string(), z.number()]).optional().default(0);
export const financialStatementsInputSchema = z.object({
  pldd: z.union([z.literal(""), z.string().regex(isoDateOnly, "Must be YYYY-MM-DD")]),
  bsfatot: numSchema,
  othass: numSchema,
  bscatot: numSchema,
  bsclbank: numSchema,
  curlib: numSchema,
  bsslltd: numSchema,
  bsclstd: numSchema,
  bsqpuc: numSchema,
  turnover: numSchema,
  plnpbt: numSchema,
  plnpat: numSchema,
  plnetdiv: numSchema,
  plyear: numSchema,
  curlib_borrowing: z.union([z.string(), z.number()]).optional(),
  curlib_non_borrowing: z.union([z.string(), z.number()]).optional(),
  ncl_loan: z.union([z.string(), z.number()]).optional(),
  ncl_non_loan: z.union([z.string(), z.number()]).optional(),
  equity_share_application: z.union([z.string(), z.number()]).optional(),
  equity_share_premium: z.union([z.string(), z.number()]).optional(),
  equity_accumulated_profit: z.union([z.string(), z.number()]).optional(),
  equity_minority: z.union([z.string(), z.number()]).optional(),
  operating_cost: z.union([z.string(), z.number()]).optional(),
  admin_cost: z.union([z.string(), z.number()]).optional(),
  interest_cost: z.union([z.string(), z.number()]).optional(),
  other_cost: z.union([z.string(), z.number()]).optional(),
  pl_minority: z.union([z.string(), z.number()]).optional(),
});

export type FinancialStatementsStoredData = z.infer<typeof financialStatementsInputSchema>;

export const financialStatementsQuestionnaireSchema = z.object({
  financial_year_end: z
    .string()
    .regex(isoDateOnly, "Must be YYYY-MM-DD")
    .refine(isoCalendarDateStrictlyAfterToday, "Please select a future financial year end date."),
});

export const financialStatementsV2Schema = z.object({
  questionnaire: financialStatementsQuestionnaireSchema,
  unaudited_by_year: z.record(z.string(), financialStatementsInputSchema),
});

export type FinancialStatementsV2Stored = z.infer<typeof financialStatementsV2Schema>;

export const invoiceOfferParamsSchema = z.object({
  id: z.string().cuid(),
  invoiceId: z.string().cuid(),
});

export const requestInvoiceOfferAcceptOtpBodySchema = z.object({
  signatory_email: z.string().email(),
});

export const acceptInvoiceOfferBodySchema = z.object({
  challenge_id: z.string().cuid(),
  otp_code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  consent_ids: z
    .array(z.enum(UTILISATION_OFFER_CONSENT_IDS))
    .refine((ids) => areUtilisationOfferConsentsComplete(ids), {
      message: "Tick both confirmations and confirm the full authorisation before accepting.",
    }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
export type BusinessDetailsData = z.infer<typeof businessDetailsDataSchema>;

const signingEmailSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Valid email required");

const signingIcSchema = z
  .string()
  .min(1)
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 12, "IC must be 12 digits");

const optionalSigningIcSchema = z
  .string()
  .optional()
  .transform((value) => (typeof value === "string" ? value.replace(/\D/g, "") : ""))
  .refine((value) => value.length === 0 || value.length === 12, "IC must be 12 digits");

const issuerAuthorizedRepresentativeSchema = z.object({
  name: z.string().trim().min(1),
  email: signingEmailSchema,
  ic_number: signingIcSchema,
  capacity: z.literal("director"),
  person_match_key: z.string().trim().min(1),
});

const issuerAuthorizedPartySchema = z.object({
  key: z.literal("issuer"),
  entity_kind: z.literal("ISSUER"),
  representatives: z.array(issuerAuthorizedRepresentativeSchema).min(1),
});

const corporateGuarantorAuthorizedRepresentativeSchema = z.object({
  name: z.string().trim().min(1),
  email: signingEmailSchema,
  ic_number: signingIcSchema,
  capacity: z.enum(["director", "authorised_signatory"]),
});

const individualGuarantorAuthorizedRepresentativeSchema = z.object({
  name: z.string().trim().min(1),
  email: signingEmailSchema,
  ic_number: optionalSigningIcSchema,
  capacity: z.enum(["director", "authorised_signatory"]),
});

const corporateGuarantorAuthorizedPartySchema = z.object({
  key: z.string().trim().min(1),
  entity_kind: z.literal("CORPORATE_GUARANTOR"),
  application_guarantor_id: z.string().trim().min(1),
  client_guarantor_id: z.string().trim().min(1).optional(),
  representatives: z.array(corporateGuarantorAuthorizedRepresentativeSchema).min(1),
});

const individualGuarantorAuthorizedPartySchema = z.object({
  key: z.string().trim().min(1),
  entity_kind: z.literal("INDIVIDUAL_GUARANTOR"),
  application_guarantor_id: z.string().trim().min(1),
  client_guarantor_id: z.string().trim().min(1).optional(),
  representatives: z.array(individualGuarantorAuthorizedRepresentativeSchema).min(1).max(1),
});

const authorizedPartySchema = z.discriminatedUnion("entity_kind", [
  issuerAuthorizedPartySchema,
  corporateGuarantorAuthorizedPartySchema,
  individualGuarantorAuthorizedPartySchema,
]);

const authorizedPartiesSubmitSchema = z.object({
  parties: z
    .array(authorizedPartySchema)
    .min(1)
    .superRefine((parties, ctx) => {
      const issuerCount = parties.filter((party) => party.entity_kind === "ISSUER").length;
      if (issuerCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Exactly one issuer party is required",
        });
      }
      const keys = parties.map((party) => party.key);
      if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Party keys must be unique",
        });
      }
      const guarantorIds = parties
        .filter((party) => party.entity_kind !== "ISSUER")
        .map((party) => party.application_guarantor_id);
      if (new Set(guarantorIds).size !== guarantorIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each guarantor may appear only once",
        });
      }
    }),
});

/** Step 1 acceptance POST — issuer plus one party per application guarantor. */
export const submitOfferAcceptanceBodySchema = z.object({
  authorized_parties: authorizedPartiesSubmitSchema,
});

export type SubmitOfferAcceptanceBody = z.infer<typeof submitOfferAcceptanceBodySchema>;
