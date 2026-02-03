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
});

/**
 * Schema for application ID parameter
 */
export const applicationIdParamSchema = z.object({
  id: z.string().cuid(),
});

const yesNoOrEmptySchema = z.union([z.enum(["yes", "no"]), z.literal("")]);

const aboutYourBusinessSchema = z.object({
  what_does_company_do: z.string().max(200).optional().default(""),
  main_customers: z.string().max(200).optional().default(""),
  single_customer_over_50_revenue: yesNoOrEmptySchema.optional().default(""),
});

const whyRaisingFundsSchema = z.object({
  financing_for: z.string().max(200).optional().default(""),
  how_funds_used: z.string().max(200).optional().default(""),
  business_plan: z.string().max(1000).optional().default(""),
  risks_delay_repayment: z.string().max(200).optional().default(""),
  backup_plan: z.string().max(200).optional().default(""),
  raising_on_other_p2p: yesNoOrEmptySchema.optional().default(""),
  platform_name: z.string().optional().default(""),
  amount_raised: z.string().optional().default(""),
  same_invoice_used: yesNoOrEmptySchema.optional().default(""),
});

export const businessDetailsDataSchema = z.object({
  about_your_business: aboutYourBusinessSchema.optional().default({}),
  why_raising_funds: whyRaisingFundsSchema.optional().default({}),
  declaration_confirmed: z.boolean(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
export type BusinessDetailsData = z.infer<typeof businessDetailsDataSchema>;
