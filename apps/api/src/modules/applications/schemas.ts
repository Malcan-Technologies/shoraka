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
  platform_name: z.string().optional().default(""),
  amount_raised: z.union([z.string(), z.number()]).optional().default(0),
  same_invoice_used: yesNoBooleanSchema,
});

export const businessDetailsDataSchema = z.object({
  about_your_business: aboutYourBusinessSchema.optional().default({}),
  why_raising_funds: whyRaisingFundsSchema.optional().default({}),
  declaration_confirmed: z.boolean(),
});

/** Validates only INPUT fields for financial_statements step. Computed fields are derived by backend. */
export const financialStatementsInputSchema = z.object({
  financing_year_end: z.string().optional().default(""),
  balance_sheet_financial_year: z.string().optional().default(""),
  fixed_assets: z.union([z.string(), z.number()]).optional().default(0),
  other_assets: z.union([z.string(), z.number()]).optional().default(0),
  current_assets: z.union([z.string(), z.number()]).optional().default(0),
  non_current_assets: z.union([z.string(), z.number()]).optional().default(0),
  current_liability: z.union([z.string(), z.number()]).optional().default(0),
  long_term_liability: z.union([z.string(), z.number()]).optional().default(0),
  non_current_liability: z.union([z.string(), z.number()]).optional().default(0),
  paid_up: z.union([z.string(), z.number()]).optional().default(0),
  turnover: z.union([z.string(), z.number()]).optional().default(0),
  profit_before_tax: z.union([z.string(), z.number()]).optional().default(0),
  profit_after_tax: z.union([z.string(), z.number()]).optional().default(0),
  minority_interest: z.union([z.string(), z.number()]).optional().default(0),
  net_dividend: z.union([z.string(), z.number()]).optional().default(0),
  profit_and_loss_year: z.union([z.string(), z.number()]).optional().default(0),
});

export type FinancialStatementsInput = z.infer<typeof financialStatementsInputSchema>;

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
export type BusinessDetailsData = z.infer<typeof businessDetailsDataSchema>;
