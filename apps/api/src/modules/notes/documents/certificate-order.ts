import { WithdrawalType } from "@prisma/client";

export type ShorakaCertificateOrderInput = {
  id: string;
  created_at: Date;
  certificate_s3_key: string | null;
  certificate_file_sha256: string | null;
  withdrawalInstruction: {
    withdrawal_type: string;
    created_at: Date;
  };
};

const WITHDRAWAL_TYPE_ORDER: Record<string, number> = {
  [WithdrawalType.ISSUER_DISBURSEMENT]: 0,
  [WithdrawalType.ISSUER_RESIDUAL_RETURN]: 1,
  [WithdrawalType.ADMIN_ADJUSTMENT]: 2,
  [WithdrawalType.INVESTOR_WITHDRAWAL]: 3,
};

function typeRank(withdrawalType: string): number {
  return WITHDRAWAL_TYPE_ORDER[withdrawalType] ?? 50;
}

/** Lifecycle type first (issuer disbursement today), then creation time, then id. */
export function sortShorakaCertificates<T extends ShorakaCertificateOrderInput>(
  rows: readonly T[]
): T[] {
  return [...rows].sort((a, b) => {
    const typeDelta =
      typeRank(a.withdrawalInstruction.withdrawal_type) -
      typeRank(b.withdrawalInstruction.withdrawal_type);
    if (typeDelta !== 0) return typeDelta;
    const createdDelta =
      a.withdrawalInstruction.created_at.getTime() - b.withdrawalInstruction.created_at.getTime();
    if (createdDelta !== 0) return createdDelta;
    const orderCreated = a.created_at.getTime() - b.created_at.getTime();
    if (orderCreated !== 0) return orderCreated;
    return a.id.localeCompare(b.id);
  });
}

export function shorakaCertificateIsAvailable(row: ShorakaCertificateOrderInput): boolean {
  return Boolean(row.certificate_s3_key?.trim());
}
