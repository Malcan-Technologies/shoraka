import type { Prisma } from "@prisma/client";

export type PaymasterSnapshotJson = {
  name: string;
  entity_type: string;
  ssm_number: string;
  country: string;
  is_related_party: boolean;
  is_large_private_company?: boolean;
  paymaster_id?: string;
  document?: unknown;
};

export function buildPaymasterSnapshot(input: {
  paymaster: {
    id: string;
    legal_name: string;
    registration_number: string;
    registration_country: string;
    entity_type: string;
  };
  isRelatedParty: boolean;
  isLargePrivateCompany?: boolean;
  document?: unknown;
}): PaymasterSnapshotJson {
  return buildSubmittedCustomerDetails({
    submitted: {
      legalName: input.paymaster.legal_name,
      registrationNumber: input.paymaster.registration_number,
      registrationCountry: input.paymaster.registration_country,
      entityType: input.paymaster.entity_type,
    },
    isRelatedParty: input.isRelatedParty,
    isLargePrivateCompany: input.isLargePrivateCompany,
    document: input.document,
    paymasterId: input.paymaster.id,
  });
}

/** Application JSON: issuer-submitted identity. Do not copy master legal fields here. */
export function buildSubmittedCustomerDetails(input: {
  submitted: {
    legalName: string;
    registrationNumber: string;
    registrationCountry: string;
    entityType: string;
  };
  isRelatedParty: boolean;
  isLargePrivateCompany?: boolean;
  document?: unknown;
  paymasterId?: string | null;
}): PaymasterSnapshotJson {
  return {
    name: input.submitted.legalName,
    entity_type: input.submitted.entityType,
    ssm_number: input.submitted.registrationNumber,
    country: input.submitted.registrationCountry,
    is_related_party: input.isRelatedParty,
    ...(input.isLargePrivateCompany !== undefined
      ? { is_large_private_company: input.isLargePrivateCompany }
      : {}),
    ...(input.paymasterId ? { paymaster_id: input.paymasterId } : {}),
    ...(input.document != null ? { document: input.document } : {}),
  };
}

export function snapshotAsJson(snapshot: PaymasterSnapshotJson): Prisma.InputJsonValue {
  return snapshot as Prisma.InputJsonValue;
}
