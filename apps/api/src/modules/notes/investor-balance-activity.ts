import {
  pendingDepositActivityId,
  withdrawalIdFromMetadata,
  type InvestorBalanceActivityEntry,
  type InvestorBalanceActivityRelated,
} from "@cashsouk/types";

export type ActivityJoinEntry = {
  id: string;
  source: string;
  investorOrganizationId: string;
  amount: number;
  postedAt: Date | string;
  noteInvestmentId: string | null;
  metadata: Record<string, unknown> | null;
};

export type ActivityJoinInvestment = {
  id: string;
  status: string;
  confirmedAt: Date | string | null;
};

export type ActivityJoinWithdrawal = {
  id: string;
  investorOrganizationId: string;
  amount: number;
  createdAt: Date | string;
  status: string;
  completedAt: Date | string | null;
  displayReference?: string | null;
};

export const IN_FLIGHT_DEPOSIT_STATUSES = [
  "PAID",
  "NAME_CHECK_PENDING",
  "HELD",
  "REFUND_INITIATED",
] as const;

export type InFlightGatewayDeposit = {
  id: string;
  investorOrganizationId: string;
  amount: number;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  nameCheckAt: Date | string | null;
};

/** Matches `creditCompletedDeposit` in payment/deposit-service.ts. */
export function gatewayDepositBalanceIdempotencyKey(gatewayPaymentId: string): string {
  return `gateway-deposit:balance:${gatewayPaymentId}`;
}

const WITHDRAWAL_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

function toTime(value: Date | string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function amountKey(amount: number): string {
  return amount.toFixed(2);
}

function matchKey(organizationId: string, amount: number): string {
  return `${organizationId}:${amountKey(amount)}`;
}

export function matchWithdrawalsToActivityEntries(
  entries: ActivityJoinEntry[],
  withdrawals: ActivityJoinWithdrawal[]
): Map<string, ActivityJoinWithdrawal> {
  const byEntryId = new Map<string, ActivityJoinWithdrawal>();
  const usedWithdrawalIds = new Set<string>();
  const withdrawalsById = new Map(withdrawals.map((withdrawal) => [withdrawal.id, withdrawal]));

  for (const entry of entries) {
    const linkedId = withdrawalIdFromMetadata(entry.metadata);
    const linked = linkedId ? withdrawalsById.get(linkedId) : undefined;
    if (!linked) continue;
    byEntryId.set(entry.id, linked);
    usedWithdrawalIds.add(linked.id);
  }

  const unmatchedEntries = entries.filter((entry) => !byEntryId.has(entry.id));
  const unmatchedByKey = new Map<string, ActivityJoinWithdrawal[]>();
  for (const withdrawal of withdrawals) {
    if (usedWithdrawalIds.has(withdrawal.id)) continue;
    const key = matchKey(withdrawal.investorOrganizationId, withdrawal.amount);
    const list = unmatchedByKey.get(key) ?? [];
    list.push(withdrawal);
    unmatchedByKey.set(key, list);
  }
  for (const list of unmatchedByKey.values()) {
    list.sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt));
  }

  for (const entry of unmatchedEntries) {
    const candidates = unmatchedByKey.get(matchKey(entry.investorOrganizationId, entry.amount));
    if (!candidates || candidates.length === 0) continue;

    const postedAt = toTime(entry.postedAt);
    let bestIndex = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let index = 0; index < candidates.length; index += 1) {
      const delta = Math.abs(toTime(candidates[index]!.createdAt) - postedAt);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    }
    if (bestIndex < 0 || bestDelta > WITHDRAWAL_MATCH_WINDOW_MS) continue;
    const [matched] = candidates.splice(bestIndex, 1);
    if (!matched) continue;
    byEntryId.set(entry.id, matched);
  }

  return byEntryId;
}

export function buildActivityRelatedMap(input: {
  entries: ActivityJoinEntry[];
  investments: ActivityJoinInvestment[];
  withdrawals: ActivityJoinWithdrawal[];
}): Map<string, InvestorBalanceActivityRelated> {
  const relatedByEntryId = new Map<string, InvestorBalanceActivityRelated>();
  const investmentsById = new Map(input.investments.map((investment) => [investment.id, investment]));
  const withdrawalEntries = input.entries.filter(
    (entry) => entry.source === "INVESTOR_WITHDRAWAL_REQUEST"
  );
  const matchedWithdrawals = matchWithdrawalsToActivityEntries(withdrawalEntries, input.withdrawals);

  for (const entry of input.entries) {
    if (entry.source === "NOTE_INVESTMENT_COMMIT") {
      const investment = entry.noteInvestmentId
        ? investmentsById.get(entry.noteInvestmentId)
        : undefined;
      relatedByEntryId.set(entry.id, {
        kind: "investment",
        status: investment?.status ?? "COMMITTED",
        settledAt: isoOrNull(investment?.confirmedAt ?? null),
      });
      continue;
    }

    if (entry.source === "INVESTOR_WITHDRAWAL_REQUEST") {
      const withdrawal = matchedWithdrawals.get(entry.id);
      relatedByEntryId.set(entry.id, {
        kind: "withdrawal",
        status: withdrawal?.status ?? "DRAFT",
        settledAt: isoOrNull(withdrawal?.completedAt ?? null),
        displayReference: withdrawal?.displayReference ?? null,
      });
      continue;
    }

    if (entry.source === "GATEWAY_DEPOSIT") {
      relatedByEntryId.set(entry.id, {
        kind: "deposit",
        status: "COMPLETED",
        settledAt: isoOrNull(entry.postedAt),
      });
    }
  }

  return relatedByEntryId;
}

export function planActivityPageWithPendingOverlay(input: {
  pendingCount: number;
  ledgerTotalCount: number;
  page: number;
  pageSize: number;
}): {
  pendingStart: number;
  pendingTake: number;
  ledgerSkip: number;
  ledgerTake: number;
  totalCount: number;
  totalPages: number;
} {
  const pendingCount = Math.max(0, input.pendingCount);
  const ledgerTotalCount = Math.max(0, input.ledgerTotalCount);
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, input.pageSize);
  const totalCount = pendingCount + ledgerTotalCount;
  const offset = (page - 1) * pageSize;
  const pendingStart = Math.min(pendingCount, Math.max(0, offset));
  const pendingEnd = Math.min(pendingCount, Math.max(0, offset + pageSize));
  const pendingTake = Math.max(0, pendingEnd - pendingStart);
  return {
    pendingStart,
    pendingTake,
    ledgerSkip: Math.max(0, offset - pendingCount),
    ledgerTake: Math.max(0, pageSize - pendingTake),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize) || 1),
  };
}

export function filterUncreditedInFlightDeposits(
  payments: InFlightGatewayDeposit[],
  creditedIdempotencyKeys: Iterable<string>
): InFlightGatewayDeposit[] {
  const credited = creditedIdempotencyKeys instanceof Set
    ? creditedIdempotencyKeys
    : new Set(creditedIdempotencyKeys);
  return payments.filter(
    (payment) => !credited.has(gatewayDepositBalanceIdempotencyKey(payment.id))
  );
}

export function sortInFlightDepositsNewestFirst(
  payments: InFlightGatewayDeposit[]
): InFlightGatewayDeposit[] {
  return [...payments].sort((left, right) => {
    const rightTime = toTime(right.nameCheckAt ?? right.updatedAt ?? right.createdAt);
    const leftTime = toTime(left.nameCheckAt ?? left.updatedAt ?? left.createdAt);
    return rightTime - leftTime;
  });
}

export function buildPendingDepositActivityEntry(
  payment: InFlightGatewayDeposit,
  roundAmount: (amount: number) => number = (amount) => amount
): InvestorBalanceActivityEntry {
  const postedAt =
    isoOrNull(payment.nameCheckAt) ??
    isoOrNull(payment.updatedAt) ??
    isoOrNull(payment.createdAt) ??
    new Date(0).toISOString();
  return {
    id: pendingDepositActivityId(payment.id),
    investorOrganizationId: payment.investorOrganizationId,
    direction: "IN",
    amount: roundAmount(payment.amount),
    source: "GATEWAY_DEPOSIT",
    noteId: null,
    noteInvestmentId: null,
    idempotencyKey: `gateway-deposit:pending:${payment.id}`,
    metadata: { gatewayPaymentId: payment.id },
    postedAt,
    createdAt: isoOrNull(payment.createdAt) ?? postedAt,
    related: {
      kind: "deposit",
      status: payment.status,
      settledAt: null,
    },
    affectsAvailableBalance: false,
  };
}
