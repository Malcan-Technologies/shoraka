export function signingProviderReferenceMetadata(envelope: {
  provider_ref?: unknown;
  documents?: Array<{ provider_contract_ref?: string | null }>;
}): Record<string, unknown> {
  const contractRefs = (envelope.documents ?? [])
    .map((document) => document.provider_contract_ref?.trim())
    .filter((value): value is string => Boolean(value));
  const envelopeRef =
    typeof envelope.provider_ref === "string"
      ? envelope.provider_ref.trim()
      : envelope.provider_ref &&
          typeof envelope.provider_ref === "object" &&
          !Array.isArray(envelope.provider_ref) &&
          typeof (envelope.provider_ref as { id?: unknown }).id === "string"
        ? String((envelope.provider_ref as { id: string }).id)
        : "";
  const metadata: Record<string, unknown> = {};
  if (contractRefs.length > 0) metadata.providerContractRefs = contractRefs;
  const providerEnvelopeId = envelopeRef || (contractRefs.length === 1 ? contractRefs[0] : "");
  if (providerEnvelopeId) metadata.providerEnvelopeId = providerEnvelopeId;
  return metadata;
}
