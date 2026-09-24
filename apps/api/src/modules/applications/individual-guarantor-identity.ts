import { Prisma } from "@prisma/client";
import {
  authorizedRepresentativeReviewItemId,
  isValidSigningIcNumber,
  normalizeSigningEmail,
  normalizeSigningIcNumber,
  type AuthorizedParty,
  type AuthorizedPartyIndividualGuarantor,
} from "@cashsouk/types";

export type IndividualGuarantorIdentity = {
  name: string;
  email: string;
  ic_number: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function patchIndividualGuarantorSourceData(
  sourceData: unknown,
  identity: IndividualGuarantorIdentity
): Record<string, unknown> {
  const src = isPlainObject(sourceData) ? { ...sourceData } : {};
  src.name = identity.name;
  src.email = identity.email;
  src.ic_number = identity.ic_number;
  if ("icNumber" in src) src.icNumber = identity.ic_number;
  return src;
}

export function clearGuarantorAmlScreeningMetadata(metadata: unknown): Record<string, unknown> {
  const meta = isPlainObject(metadata) ? { ...metadata } : {};
  delete meta.aml_screening;
  return meta;
}

export function individualGuarantorNameOrIcChanged(
  current: { name: string | null; ic_number: string | null },
  next: IndividualGuarantorIdentity
): boolean {
  const currentName = String(current.name ?? "").trim();
  const currentIc = normalizeSigningIcNumber(String(current.ic_number ?? ""));
  return currentName !== next.name || currentIc !== next.ic_number;
}

export type IndividualGuarantorIdentityPatch = {
  name: string;
  email: string;
  ic_number: string;
  source_data: Record<string, unknown>;
  resetAml: boolean;
  metadata: Record<string, unknown>;
};

export function buildIndividualGuarantorIdentityPatch(input: {
  current: {
    name: string | null;
    email: string;
    ic_number: string | null;
    source_data: unknown;
    metadata: unknown;
  };
  next: IndividualGuarantorIdentity;
}): IndividualGuarantorIdentityPatch {
  const next = {
    name: input.next.name.trim(),
    email: normalizeSigningEmail(input.next.email),
    ic_number: normalizeSigningIcNumber(input.next.ic_number),
  };
  const resetAml = individualGuarantorNameOrIcChanged(input.current, next);
  return {
    ...next,
    source_data: patchIndividualGuarantorSourceData(input.current.source_data, next),
    resetAml,
    metadata: resetAml
      ? clearGuarantorAmlScreeningMetadata(input.current.metadata)
      : isPlainObject(input.current.metadata)
        ? { ...input.current.metadata }
        : {},
  };
}

export function identityFromIndividualGuarantorParty(
  party: AuthorizedParty
): IndividualGuarantorIdentity | null {
  if (party.entity_kind !== "INDIVIDUAL_GUARANTOR") return null;
  const representative = party.representatives[0];
  if (!representative) return null;
  const name = representative.name.trim();
  const email = normalizeSigningEmail(representative.email);
  const ic_number = normalizeSigningIcNumber(representative.ic_number);
  if (!name || !email || !isValidSigningIcNumber(ic_number)) return null;
  return { name, email, ic_number };
}

export function flaggedIndividualGuarantorParties(
  parties: AuthorizedParty[],
  flaggedItemIds: ReadonlySet<string>
): AuthorizedPartyIndividualGuarantor[] {
  return parties.filter(
    (party): party is AuthorizedPartyIndividualGuarantor =>
      party.entity_kind === "INDIVIDUAL_GUARANTOR" &&
      flaggedItemIds.has(authorizedRepresentativeReviewItemId(party))
  );
}

export function prismaDataForIndividualGuarantorIdentityPatch(
  patch: IndividualGuarantorIdentityPatch
): Prisma.ApplicationGuarantorUpdateInput {
  const data: Prisma.ApplicationGuarantorUpdateInput = {
    name: patch.name,
    email: patch.email,
    ic_number: patch.ic_number,
    source_data: patch.source_data as Prisma.InputJsonValue,
  };
  if (patch.resetAml) {
    data.aml_status = "Pending";
    data.aml_message_status = "PENDING";
    data.last_triggered_at = null;
    data.last_synced_at = null;
    data.metadata = patch.metadata as Prisma.InputJsonValue;
  }
  return data;
}
