import { createHash } from "crypto";
import {
  InvestorBalanceTransactionSource,
  NoteInvestmentStatus,
  type Prisma,
} from "@prisma/client";
import {
  deriveGrossProfitAndServiceFeeFromNet,
  formatNoteDateEnMy,
  formatNoteReferenceDisplay,
  formatServiceFeeRateLabel,
  NOTE_MONEY_DECIMALS,
  NOTE_MONEY_TOLERANCE,
  roundNoteMoney,
} from "@cashsouk/types";
import { prisma } from "../../../lib/prisma";
import { isMaterialPayout, isMaterialTawidh, isPostedSettlementStatus } from "./eligibility";
import {
  CONFIRMATION_FIRST_VERSION,
  CONFIRMATION_INTRO,
  CONFIRMATION_PROCESSING_NOTICE,
  CONFIRMATION_STATUS_LABEL,
  CONFIRMATION_TEMPLATE_ID,
  ConfirmationGenerationError,
  type ConfirmationDateSource,
  type ConfirmationGenerationSource,
  type InvestmentSettlementConfirmationSnapshot,
  type SettlementAllocationRow,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function money2(value: unknown): number {
  return roundNoteMoney(toNumber(value), NOTE_MONEY_DECIMALS);
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseSettlementAllocations(snapshot: unknown): SettlementAllocationRow[] {
  const record = asRecord(snapshot);
  const allocations = record?.allocations;
  if (!Array.isArray(allocations)) return [];
  return allocations.flatMap((entry) => {
    const allocation = asRecord(entry);
    if (!allocation) return [];
    const investmentId = nonEmpty(allocation.investmentId);
    const investorOrganizationId = nonEmpty(allocation.investorOrganizationId);
    if (!investmentId || !investorOrganizationId) return [];
    return [
      {
        investmentId,
        investorOrganizationId,
        principal: money2(allocation.principal),
        profitNet: money2(allocation.profitNet),
        tawidhInvestorShare: money2(allocation.tawidhInvestorShare),
      },
    ];
  });
}

export function groupAllocationsByInvestorOrg(
  allocations: SettlementAllocationRow[]
): Map<string, SettlementAllocationRow[]> {
  const grouped = new Map<string, SettlementAllocationRow[]>();
  for (const allocation of allocations) {
    const existing = grouped.get(allocation.investorOrganizationId) ?? [];
    existing.push(allocation);
    grouped.set(allocation.investorOrganizationId, existing);
  }
  return grouped;
}

export function sumAllocationAmounts(rows: SettlementAllocationRow[]): {
  principalReturned: number;
  netProfitCredited: number;
  tawidhCompensation: number;
  investmentIds: string[];
  totalCreditedToWallet: number;
} {
  const principalReturned = money2(
    rows.reduce((sum, row) => sum + row.principal, 0)
  );
  const netProfitCredited = money2(
    rows.reduce((sum, row) => sum + row.profitNet, 0)
  );
  const tawidhCompensation = money2(
    rows.reduce((sum, row) => sum + row.tawidhInvestorShare, 0)
  );
  const investmentIds = [...new Set(rows.map((row) => row.investmentId))].sort();
  const totalCreditedToWallet = money2(
    principalReturned + netProfitCredited + tawidhCompensation
  );
  return {
    principalReturned,
    netProfitCredited,
    tawidhCompensation,
    investmentIds,
    totalCreditedToWallet,
  };
}

export function deriveInvestorGrossAndServiceFee(input: {
  netProfitCredited: number;
  serviceFeeRatePercent: number;
}): { grossProfitEarned: number; serviceFeeAmount: number } {
  const derived = deriveGrossProfitAndServiceFeeFromNet(
    input.netProfitCredited,
    input.serviceFeeRatePercent
  );
  return {
    grossProfitEarned: money2(derived.profitGross),
    serviceFeeAmount: money2(derived.serviceFee),
  };
}

export function reconcileInvestorConfirmationAmounts(input: {
  grossProfitEarned: number;
  serviceFeeAmount: number;
  netProfitCredited: number;
  principalReturned: number;
  tawidhCompensation: number;
  totalCreditedToWallet: number;
  walletCreditAmount: number;
}): void {
  const impliedNet = money2(input.grossProfitEarned - input.serviceFeeAmount);
  if (Math.abs(impliedNet - input.netProfitCredited) > NOTE_MONEY_TOLERANCE) {
    throw new ConfirmationGenerationError(
      "Investor confirmation gross profit minus service fee does not equal net profit",
      "RECONCILIATION_FAILED"
    );
  }
  const impliedTotal = money2(
    input.principalReturned + input.netProfitCredited + input.tawidhCompensation
  );
  if (Math.abs(impliedTotal - input.totalCreditedToWallet) > NOTE_MONEY_TOLERANCE) {
    throw new ConfirmationGenerationError(
      "Investor confirmation principal + net profit + Ta’widh does not equal total credited",
      "RECONCILIATION_FAILED"
    );
  }
  if (Math.abs(input.totalCreditedToWallet - input.walletCreditAmount) > NOTE_MONEY_TOLERANCE) {
    throw new ConfirmationGenerationError(
      "Investor confirmation total does not match the wallet settlement payout",
      "RECONCILIATION_FAILED"
    );
  }
}

export function resolveConfirmationSettlementDate(input: {
  actualSettlementDate?: Date | string | null;
  postedAt?: Date | string | null;
  repaidAt?: Date | string | null;
}): {
  settlementDate: string;
  settlementDateDisplay: string;
  settlementDateSource: ConfirmationDateSource;
} {
  if (input.actualSettlementDate) {
    const iso = isoDate(input.actualSettlementDate);
    const display = formatNoteDateEnMy(input.actualSettlementDate);
    if (iso && display) {
      return {
        settlementDate: iso,
        settlementDateDisplay: display,
        settlementDateSource: "ACTUAL_SETTLEMENT_DATE",
      };
    }
  }
  if (input.postedAt) {
    const iso = isoDate(input.postedAt);
    const display = formatNoteDateEnMy(input.postedAt);
    if (iso && display) {
      return {
        settlementDate: iso,
        settlementDateDisplay: display,
        settlementDateSource: "POSTED_AT",
      };
    }
  }
  if (input.repaidAt) {
    const iso = isoDate(input.repaidAt);
    const display = formatNoteDateEnMy(input.repaidAt);
    if (iso && display) {
      return {
        settlementDate: iso,
        settlementDateDisplay: display,
        settlementDateSource: "REPAID_AT",
      };
    }
  }
  throw new ConfirmationGenerationError(
    "Settlement confirmation is missing a settlement date",
    "INCOMPLETE_DATA"
  );
}

function isValidPersistedSnapshot(
  value: unknown
): value is InvestmentSettlementConfirmationSnapshot {
  const record = asRecord(value);
  return Boolean(
    nonEmpty(record?.noteId) &&
      nonEmpty(record?.settlementId) &&
      nonEmpty(record?.investorOrganizationId) &&
      nonEmpty(record?.noteReference) &&
      typeof record?.principalReturned === "number" &&
      typeof record?.totalCreditedToWallet === "number" &&
      Array.isArray(record?.investmentIds)
  );
}

export function parseConfirmationSnapshot(
  value: unknown
): InvestmentSettlementConfirmationSnapshot | null {
  return isValidPersistedSnapshot(value)
    ? (value as InvestmentSettlementConfirmationSnapshot)
    : null;
}

function isSettlementPayoutTransaction(tx: {
  source: InvestorBalanceTransactionSource | string;
  metadata?: Prisma.JsonValue | null;
  settlementId: string;
}): boolean {
  if (tx.source !== InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE) return false;
  const metadata = asRecord(tx.metadata);
  return (
    metadata?.releaseReason === "SETTLEMENT_PAYOUT" &&
    nonEmpty(metadata?.settlementId) === tx.settlementId
  );
}

export async function buildInvestmentSettlementConfirmationSnapshot(input: {
  settlementId: string;
  investorOrganizationId: string;
  source: ConfirmationGenerationSource;
}): Promise<InvestmentSettlementConfirmationSnapshot> {
  const settlement = await prisma.noteSettlement.findUnique({
    where: { id: input.settlementId },
    include: {
      note: {
        select: {
          id: true,
          note_reference: true,
          issuer_organization_id: true,
          service_fee_rate_percent: true,
          repaid_at: true,
        },
      },
    },
  });
  if (!settlement || !isPostedSettlementStatus(settlement.status)) {
    throw new ConfirmationGenerationError(
      "Investment settlement confirmation requires a POSTED settlement",
      "NOT_ELIGIBLE"
    );
  }

  const grouped = groupAllocationsByInvestorOrg(
    parseSettlementAllocations(settlement.preview_snapshot)
  );
  const orgAllocations = grouped.get(input.investorOrganizationId) ?? [];
  if (orgAllocations.length === 0) {
    throw new ConfirmationGenerationError(
      "No posted settlement allocation exists for this investor",
      "NOT_ELIGIBLE"
    );
  }

  const sums = sumAllocationAmounts(orgAllocations);
  if (!isMaterialPayout(sums.totalCreditedToWallet)) {
    throw new ConfirmationGenerationError(
      "Investor settlement payout is zero",
      "NOT_ELIGIBLE"
    );
  }

  const investments = await prisma.noteInvestment.findMany({
    where: { id: { in: sums.investmentIds } },
    select: { id: true, status: true, investor_organization_id: true },
  });
  if (investments.length !== sums.investmentIds.length) {
    throw new ConfirmationGenerationError(
      "Settlement allocation investment rows are missing",
      "INCOMPLETE_DATA"
    );
  }
  if (
    investments.some(
      (row) =>
        row.investor_organization_id !== input.investorOrganizationId ||
        row.status !== NoteInvestmentStatus.SETTLED
    )
  ) {
    throw new ConfirmationGenerationError(
      "Investor investment rows are not SETTLED for this confirmation",
      "NOT_ELIGIBLE"
    );
  }

  const walletRows = await prisma.investorBalanceTransaction.findMany({
    where: {
      investor_organization_id: input.investorOrganizationId,
      source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE,
      note_id: settlement.note_id,
      note_investment_id: { in: sums.investmentIds },
    },
    select: { id: true, amount: true, source: true, metadata: true },
  });
  const matchingWallet = walletRows.filter((row) =>
    isSettlementPayoutTransaction({
      source: row.source,
      metadata: row.metadata,
      settlementId: settlement.id,
    })
  );
  const walletCreditAmount = money2(
    matchingWallet.reduce((sum, row) => sum + toNumber(row.amount), 0)
  );
  const walletTransactionIds = matchingWallet.map((row) => row.id).sort();

  const serviceFeeRatePercent = money2(settlement.note.service_fee_rate_percent);
  const { grossProfitEarned, serviceFeeAmount } = deriveInvestorGrossAndServiceFee({
    netProfitCredited: sums.netProfitCredited,
    serviceFeeRatePercent,
  });

  reconcileInvestorConfirmationAmounts({
    grossProfitEarned,
    serviceFeeAmount,
    netProfitCredited: sums.netProfitCredited,
    principalReturned: sums.principalReturned,
    tawidhCompensation: sums.tawidhCompensation,
    totalCreditedToWallet: sums.totalCreditedToWallet,
    walletCreditAmount,
  });

  const [issuerOrg, investorOrg] = await Promise.all([
    prisma.issuerOrganization.findUnique({
      where: { id: settlement.note.issuer_organization_id },
      select: { display_reference: true },
    }),
    prisma.investorOrganization.findUnique({
      where: { id: input.investorOrganizationId },
      select: { display_reference: true },
    }),
  ]);

  const noteReference =
    nonEmpty(settlement.note.note_reference) ??
    formatNoteReferenceDisplay(settlement.note.note_reference);
  if (!noteReference) {
    throw new ConfirmationGenerationError(
      "Note reference is missing for the settlement confirmation",
      "INCOMPLETE_DATA"
    );
  }
  const issuerReference =
    nonEmpty(issuerOrg?.display_reference) ?? settlement.note.issuer_organization_id;
  const investorReference =
    nonEmpty(investorOrg?.display_reference) ?? input.investorOrganizationId;
  const settlementReference = nonEmpty(settlement.display_reference) ?? settlement.id;
  const dates = resolveConfirmationSettlementDate({
    actualSettlementDate: settlement.actual_settlement_date,
    postedAt: settlement.posted_at,
    repaidAt: settlement.note.repaid_at,
  });

  const withoutHash: Omit<InvestmentSettlementConfirmationSnapshot, "snapshotSha256"> = {
    templateId: CONFIRMATION_TEMPLATE_ID,
    templateVersion: CONFIRMATION_FIRST_VERSION,
    snapshotGeneratedAt: new Date().toISOString(),
    source: input.source,
    version: CONFIRMATION_FIRST_VERSION,
    noteId: settlement.note_id,
    noteReference,
    settlementId: settlement.id,
    settlementReference,
    investorOrganizationId: input.investorOrganizationId,
    investorReference,
    investmentIds: sums.investmentIds,
    issuerReference,
    settlementDate: dates.settlementDate,
    settlementDateDisplay: dates.settlementDateDisplay,
    settlementDateSource: dates.settlementDateSource,
    principalReturned: sums.principalReturned,
    grossProfitEarned,
    serviceFeeRatePercent,
    serviceFeeLabel: `Service fee (${formatServiceFeeRateLabel(serviceFeeRatePercent)} of profit)`,
    serviceFeeAmount,
    netProfitCredited: sums.netProfitCredited,
    tawidhCompensation: sums.tawidhCompensation,
    showTawidh: isMaterialTawidh(sums.tawidhCompensation),
    totalCreditedToWallet: sums.totalCreditedToWallet,
    walletTransactionIds,
    statusLabel: CONFIRMATION_STATUS_LABEL,
    introCopy: CONFIRMATION_INTRO,
    processingNotice: CONFIRMATION_PROCESSING_NOTICE,
  };

  return {
    ...withoutHash,
    snapshotSha256: canonicalJsonSha256(withoutHash),
  };
}

export function expectedInvestorOrganizationIds(
  allocations: SettlementAllocationRow[]
): string[] {
  const grouped = groupAllocationsByInvestorOrg(allocations);
  const orgIds: string[] = [];
  for (const [orgId, rows] of grouped) {
    if (isMaterialPayout(sumAllocationAmounts(rows).totalCreditedToWallet)) {
      orgIds.push(orgId);
    }
  }
  return orgIds.sort();
}
