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
  whatDoesCompanyDo: z.string().max(200).optional().default(""),
  mainCustomers: z.string().max(200).optional().default(""),
  singleCustomerOver50Revenue: yesNoOrEmptySchema.optional().default(""),
});

const whyRaisingFundsSchema = z.object({
  financingFor: z.string().max(200).optional().default(""),
  howFundsUsed: z.string().max(200).optional().default(""),
  businessPlan: z.string().max(1000).optional().default(""),
  risksDelayRepayment: z.string().max(200).optional().default(""),
  backupPlan: z.string().max(200).optional().default(""),
  raisingOnOtherP2P: yesNoOrEmptySchema.optional().default(""),
  platformName: z.string().optional().default(""),
  amountRaised: z.string().optional().default(""),
  sameInvoiceUsed: yesNoOrEmptySchema.optional().default(""),
});

export const businessDetailsDataSchema = z.object({
  aboutYourBusiness: aboutYourBusinessSchema.optional().default({}),
  whyRaisingFunds: whyRaisingFundsSchema.optional().default({}),
  declarationConfirmed: z.boolean(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
export type BusinessDetailsData = z.infer<typeof businessDetailsDataSchema>;
