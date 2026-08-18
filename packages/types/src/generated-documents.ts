/**
 * Git-versioned catalog of document types the platform can generate on download.
 * Product workflow rows reference catalog keys via `generated_document_type`.
 */

export const GENERATED_DOCUMENT_CONTEXTS = [
  "acceptance_documents",
  "supporting_documents",
  "guarantor_agreement",
] as const;

export type GeneratedDocumentContext = (typeof GENERATED_DOCUMENT_CONTEXTS)[number];

export const GENERATED_DOCUMENT_REQUIRES = ["contract_offer_sent"] as const;

export type GeneratedDocumentRequires = (typeof GENERATED_DOCUMENT_REQUIRES)[number];

export type GeneratedDocumentTypeKey = "arf_contract_facility_loo";

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
  arf_contract_facility_loo: {
    key: "arf_contract_facility_loo",
    version: 1,
    label: "ARF contract facility Letter of Offer",
    description:
      "Contract facility letter of offer filled from application, contract, and offer data.",
    allowedContexts: ["acceptance_documents"],
    requires: ["contract_offer_sent"],
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
  return isGeneratedDocumentTypeKey(key) ? GENERATED_DOCUMENT_TYPES[key] : undefined;
}

export function listGeneratedDocumentTypes(): GeneratedDocumentTypeDefinition[] {
  return Object.values(GENERATED_DOCUMENT_TYPES);
}

export function listGeneratedDocumentTypesForContext(
  context: GeneratedDocumentContext
): GeneratedDocumentTypeDefinition[] {
  return listGeneratedDocumentTypes().filter((type) => type.allowedContexts.includes(context));
}
