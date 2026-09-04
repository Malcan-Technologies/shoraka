/**
 * Git-versioned catalog of document types the platform can generate on download.
 * Product workflow rows reference catalog keys via `generated_document_type`.
 */

export const GENERATED_DOCUMENT_CONTEXTS = [
  "acceptance_documents",
  "supporting_documents",
  "guarantor_agreement",
  "signing_packages",
] as const;

export type GeneratedDocumentContext = (typeof GENERATED_DOCUMENT_CONTEXTS)[number];

export const GENERATED_DOCUMENT_REQUIRES = ["contract_offer_sent", "offer_sent"] as const;

export type GeneratedDocumentRequires = (typeof GENERATED_DOCUMENT_REQUIRES)[number];

/** Canonical catalog keys — never rename after first release. */
export type GeneratedDocumentTypeKey =
  | "arf_contract_facility_lo"
  | "arf_joint_several_guarantee"
  | "arf_deed_of_assignment"
  | "arf_facility_agreement";

/** Signing-package document key for the CA-signed Facility Agreement. */
export const FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY = "facility_agreement";

export type GeneratedDocumentTypeDefinition = {
  /** Stable identifier — never rename after first release. */
  key: GeneratedDocumentTypeKey;
  /** Bump in the same change as template / merge map updates. */
  version: number;
  label: string;
  description: string;
  allowedContexts: GeneratedDocumentContext[];
  requires: GeneratedDocumentRequires[];
};

export const GENERATED_DOCUMENT_TYPES: Record<
  GeneratedDocumentTypeKey,
  GeneratedDocumentTypeDefinition
> = {
  arf_contract_facility_lo: {
    key: "arf_contract_facility_lo",
    version: 12,
    label: "ARF contract facility Letter of Offer (LO)",
    description:
      "Contract facility Letter of Offer filled from application, contract, and offer data.",
    allowedContexts: ["acceptance_documents"],
    requires: ["contract_offer_sent"],
  },
  arf_joint_several_guarantee: {
    key: "arf_joint_several_guarantee",
    version: 1,
    label: "ARF Joint and Several Guarantee (JSG)",
    description:
      "CA-signed joint and several guarantee for the signing-package Guarantor Agreement.",
    allowedContexts: ["signing_packages"],
    requires: ["contract_offer_sent"],
  },
  arf_deed_of_assignment: {
    key: "arf_deed_of_assignment",
    version: 1,
    label: "ARF Deed of Assignment",
    description:
      "CA-signed deed of assignment for the signing-package Deed of Assignment.",
    allowedContexts: ["signing_packages"],
    requires: ["contract_offer_sent"],
  },
  arf_facility_agreement: {
    key: "arf_facility_agreement",
    version: 6,
    label: "ARF Facility Agreement",
    description:
      "CA-signed facility agreement that replaces the signing-package Offer Letter.",
    allowedContexts: ["signing_packages"],
    requires: ["offer_sent"],
  },
};

export function isGeneratedDocumentTypeKey(key: string): key is GeneratedDocumentTypeKey {
  return key in GENERATED_DOCUMENT_TYPES;
}

export function parseGeneratedDocumentTypeKey(raw: unknown): GeneratedDocumentTypeKey | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return isGeneratedDocumentTypeKey(raw) ? raw : undefined;
}

export function getGeneratedDocumentType(key: string): GeneratedDocumentTypeDefinition | undefined {
  const canonical = parseGeneratedDocumentTypeKey(key);
  return canonical ? GENERATED_DOCUMENT_TYPES[canonical] : undefined;
}

export function listGeneratedDocumentTypes(): GeneratedDocumentTypeDefinition[] {
  return Object.values(GENERATED_DOCUMENT_TYPES);
}

export function listGeneratedDocumentTypesForContext(
  context: GeneratedDocumentContext
): GeneratedDocumentTypeDefinition[] {
  return listGeneratedDocumentTypes().filter((type) => type.allowedContexts.includes(context));
}

/**
 * Signing-package document `key` → catalog type used when that document is generated
 * for CA signing (Guarantor Agreement → JSG, Deed of Assignment → DOA).
 */
export const SIGNING_PACKAGE_GENERATED_DOCUMENT_TYPES: Partial<
  Record<string, GeneratedDocumentTypeKey>
> = {
  guarantor_agreement: "arf_joint_several_guarantee",
  deed_of_assignment: "arf_deed_of_assignment",
  [FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY]: "arf_facility_agreement",
};

/** True when a completed envelope document is the primary signed offer artefact. */
export function isPrimarySignedOfferDocument(input: {
  source: string;
  template_ref?: string | null;
  has_signed_pdf?: boolean;
}): boolean {
  if (input.has_signed_pdf === false) return false;
  if (input.source === "GENERATED_OFFER_LETTER") return true;
  return input.template_ref === FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY;
}

type SignedOfferDocumentLike = {
  source: string;
  template_ref?: string | null;
  signed_s3_key?: string | null;
  has_signed_pdf?: boolean;
};

function offerDocumentHasSignedPdf(input: SignedOfferDocumentLike): boolean {
  if (input.has_signed_pdf === false) return false;
  if (typeof input.signed_s3_key === "string") return Boolean(input.signed_s3_key.trim());
  return input.has_signed_pdf === true;
}

/** Prefer the Facility Agreement signed PDF, then a legacy Offer Letter, then any signed row. */
export function pickPrimarySignedOfferDocument<T extends SignedOfferDocumentLike>(
  documents: readonly T[]
): T | undefined {
  const signed = documents.filter((document) => offerDocumentHasSignedPdf(document));
  return (
    signed.find((document) => document.template_ref === FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY) ??
    signed.find((document) => document.source === "GENERATED_OFFER_LETTER") ??
    signed[0]
  );
}

/** True when a signing-package document can be previewed as a merged unsigned PDF. */
export function isSigningPackagePreviewDocument(input: {
  key: string;
  source: string;
}): boolean {
  if (input.source === "GENERATED_OFFER_LETTER") return true;
  return Boolean(SIGNING_PACKAGE_GENERATED_DOCUMENT_TYPES[input.key]);
}
