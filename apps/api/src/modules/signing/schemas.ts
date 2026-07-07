/**
 * Zod request schemas for the signing envelope endpoints.
 */
import { z } from "zod";

const recipientBindingSchema = z.object({
  role_key: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  user_id: z.string().nullish(),
  application_guarantor_id: z.string().nullish(),
  ic_number: z.string().nullish(),
});

export const createEnvelopeSchema = z.object({
  applicationId: z.string().min(1),
  title: z.string().min(1),
  contractId: z.string().nullish(),
  invoiceId: z.string().nullish(),
  productVersion: z.number().int().nullish(),
  /** Raw product signing_template config (validated in the service). */
  templateConfig: z.unknown(),
  bindings: z.array(recipientBindingSchema).min(1),
  expiresAt: z.string().datetime().nullish(),
});

export const createIssuerEnvelopeSchema = z.object({
  title: z.string().min(1).max(200).nullish(),
  contractId: z.string().min(1).nullish(),
  invoiceId: z.string().min(1).nullish(),
  bindings: z.array(recipientBindingSchema).min(1),
  expiresAt: z.string().datetime().nullish(),
});

export const voidEnvelopeSchema = z.object({
  reason: z.string().max(500).nullish(),
});

export const startSigningSchema = z.object({
  recipientId: z.string().min(1),
  documentId: z.string().min(1),
  redirectUrl: z.string().url().nullish(),
});

export const startExternalSigningSchema = z.object({
  documentId: z.string().min(1),
  redirectUrl: z.string().url().nullish(),
});

export type CreateEnvelopeBody = z.infer<typeof createEnvelopeSchema>;
export type CreateIssuerEnvelopeBody = z.infer<typeof createIssuerEnvelopeSchema>;
export type StartSigningBody = z.infer<typeof startSigningSchema>;
