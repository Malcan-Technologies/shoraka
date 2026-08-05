/**
 * Zod request schemas for the signing envelope endpoints.
 */
import { z } from "zod";
import { validateSigningRedirectUrl } from "../../lib/signing/redirect-url";

const recipientBindingSchema = z.object({
  role_key: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  application_guarantor_id: z.string().nullish(),
  /** Required for issuer directors; omitted for third-party roles (self-declare on the link). */
  ic_number: z.string().nullish(),
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

export const startExternalSigningSchema = z.object({
  documentId: z.string().min(1),
  redirectUrl: z
    .string()
    .url()
    .refine((url) => validateSigningRedirectUrl(url) != null, {
      message: "redirectUrl must match ISSUER_URL origin",
    })
    .nullish(),
});

/** Signer returned from SigningCloud via backUrl — mark their assignment signed. */
export const confirmExternalSignedSchema = z.object({
  documentId: z.string().min(1),
});

export const verifyExternalAccessCodeSchema = z.object({
  ic_number: z.string().min(1),
});

export const recipientEkycSessionSchema = z.object({
  confirmedName: z.string().min(1).max(200).nullish(),
  force: z.boolean().optional(),
});

export type CreateIssuerEnvelopeBody = z.infer<typeof createIssuerEnvelopeSchema>;
