/**
 * Guide: docs/guides/application-flow/financial-statements-step.md — Financial statements step schema and field mappings
 */

import { z } from "zod";

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
  what_does_company_do: z.string().max(200).optional().default(""),
  main_customers: z.string().max(200).optional().default(""),
  single_customer_over_50_revenue: yesNoBooleanSchema,
});

const whyRaisingFundsSchema = z.object({
  financing_for: z.string().max(200).optional().default(""),
  how_funds_used: z.string().max(200).optional().default(""),
  business_plan: z.string().max(1000).optional().default(""),
  risks_delay_repayment: z.string().max(200).optional().default(""),
  backup_plan: z.string().max(200).optional().default(""),
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

const guarantorIndividualSchema = z.object({
  guarantor_type: z.literal("individual"),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  ic_number: z
    .string()
    .min(1)
    .max(30)
    .refine((s) => s.replace(/\D/g, "").length === 12, {
      message: "IC number must be 12 digits",
    }),
  relationship: z.enum([
    "family_members_of_director",
    "director_shareholder",
    "unrelated_party",
  ]),
});

const guarantorCompanySchema = z.object({
  guarantor_type: z.literal("company"),
  company_name: z.string().min(1).max(200),
  ssm_number: z.string().min(1).max(50),
  relationship: z.enum(["parent_company", "subsidiary", "related_party"]),
});

const guarantorEntrySchema = z.discriminatedUnion("guarantor_type", [
  guarantorIndividualSchema,
  guarantorCompanySchema,
]);

export const businessDetailsDataSchema = z
  .object({
    about_your_business: aboutYourBusinessSchema.optional().default({}),
    why_raising_funds: whyRaisingFundsSchema.optional().default({}),
    declaration_confirmed: z.boolean(),
    guarantors: z.array(guarantorEntrySchema).min(1, "At least one guarantor is required"),
  })
  .superRefine((data, ctx) => {
    const w = data.why_raising_funds;
    if (w?.raising_on_other_p2p === true && w?.same_invoice_used === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "This invoice has already been applied on another P2P platform and cannot be submitted.",
        path: ["why_raising_funds", "same_invoice_used"],
      });
    }
  });

/** Validates stored input fields for financial_statements step. Flat storage; no computed fields. */
const numSchema = z.union([z.string(), z.number()]).optional().default(0);
export const financialStatementsInputSchema = z.object({
  pldd: z.string().optional().default(""),
  bsdd: z.string().optional().default(""),
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
});

export type FinancialStatementsStoredData = z.infer<typeof financialStatementsInputSchema>;

/** Q1–Q3 before per-year grids; Y = latest_financial_year. */
export const financialStatementsQuestionnaireSchema = z.object({
  latest_financial_year: z.number().int(),
  submitted_this_financial_year: z.boolean(),
  has_data_for_next_financial_year: z.boolean(),
});

export const financialStatementsV2Schema = z.object({
  questionnaire: financialStatementsQuestionnaireSchema,
  unaudited_by_year: z.record(z.string(), financialStatementsInputSchema),
});

export type FinancialStatementsV2Stored = z.infer<typeof financialStatementsV2Schema>;

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
export type BusinessDetailsData = z.infer<typeof businessDetailsDataSchema>;
