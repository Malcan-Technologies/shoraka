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
  return {
    name: input.paymaster.legal_name,
    entity_type: input.paymaster.entity_type,
    ssm_number: input.paymaster.registration_number,
    country: input.paymaster.registration_country,
    is_related_party: input.isRelatedParty,
    ...(input.isLargePrivateCompany !== undefined
      ? { is_large_private_company: input.isLargePrivateCompany }
      : {}),
    paymaster_id: input.paymaster.id,
    ...(input.document != null ? { document: input.document } : {}),
  };
}

export function snapshotAsJson(snapshot: PaymasterSnapshotJson): Prisma.InputJsonValue {
  return snapshot as Prisma.InputJsonValue;
}
