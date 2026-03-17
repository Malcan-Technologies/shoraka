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
});

export const businessDetailsDataSchema = z.object({
  about_your_business: aboutYourBusinessSchema.optional().default({}),
  why_raising_funds: whyRaisingFundsSchema.optional().default({}),
  declaration_confirmed: z.boolean(),
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
  plminin: numSchema,
  plnetdiv: numSchema,
  plyear: numSchema,
});

export type FinancialStatementsStoredData = z.infer<typeof financialStatementsInputSchema>;

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
export type BusinessDetailsData = z.infer<typeof businessDetailsDataSchema>;
