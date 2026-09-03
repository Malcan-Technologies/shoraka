/**
 * Zod request schemas for the signing envelope endpoints.
 */
import { z } from "zod";
import { validateSigningRedirectUrl } from "../../lib/signing/redirect-url";

export const sendAdminSigningPackageSchema = z.object({
  contractId: z.string().min(1).nullish(),
  invoiceId: z.string().min(1).nullish(),
});

export const previewSigningDocumentParamsSchema = z.object({
  applicationId: z.string().min(1),
  documentKey: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "documentKey must be a signing-package document key"),
});

export const previewSigningDocumentQuerySchema = z.object({
  disposition: z.enum(["inline", "attachment"]).default("inline"),
  contractId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
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

export type SendAdminSigningPackageBody = z.infer<typeof sendAdminSigningPackageSchema>;
