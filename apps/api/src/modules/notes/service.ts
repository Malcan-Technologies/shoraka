import PDFDocument from "pdfkit";
import {
  ApplicationStatus,
  InvoiceStatus,
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteLedgerAccountType,
  NoteLedgerDirection,
  NoteListingStatus,
  NotePaymentStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteSettlementType,
  ServiceFeeTrusteeInstructionStatus,
  NoteStatus,
  InvestorBalanceTransactionSource,
  Prisma,
  UserRole,
  WithdrawalStatus,
  WithdrawalType,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import {
  generatePresignedUploadUrl,
  generatePresignedViewUrl,
  getS3ObjectBuffer,
  putS3ObjectBuffer,
} from "../../lib/s3/client";
import { resolveApprovedFacilityForRefresh } from "../../lib/contract-facility";
import { computeProgressiveFacilityFee } from "../../lib/facility-fee";
import {
  resolveOfferedAmount,
  resolveOfferedPlatformFeeRatePercent,
  resolveOfferedProfitRate,
  resolveRequestedInvoiceAmount,
} from "../../lib/invoice-offer";
import {
  buildInvestorPortfolioTotals,
  computeMarketplaceCommitBounds,
  computeNetExpectedReturnRatePercent,
  deriveGrossProfitAndServiceFeeFromNet,
  INVESTOR_RETURN_RATE_DISPLAY_DECIMALS,
  isNoteFullyFunded,
  isSoukscoreRiskRating,
  maxFundedBeforeMarketplaceCommit,
  meetsMinimumFunding,
  normalizeNoteCapacityAmount,
  NOTE_MONEY_TOLERANCE,
  roundNoteMoney,
} from "@cashsouk/types";
import { adminResignInvoiceOfferFromNote } from "../admin/offer-resign-service";
import {
  buildOfferSigningAdminView,
  noteAllowsInvoiceResign,
} from "../signingcloud/offer-signing-admin-view";
import {
  creditInvestorBalance,
  debitInvestorBalanceForCommit,
  debitInvestorBalanceForWithdrawal,
} from "./investor-balance";
import { postLedgerEntry } from "./ledger";
import {
  buildInvestorBalanceStatement,
  buildStatementFilename,
  renderStatementCsv,
  renderStatementPdf,
  type StatementLedgerEntry,
} from "./investor-balance-statement";
import {
  mapLedgerEntry,
  mapMarketplaceNoteDetail,
  mapNoteDetail,
  mapNoteListItem,
  mapWithdrawalInstruction,
  resolveIssuerResidualPayoutListStatus,
  resolveProductNameFromWorkflow,
} from "./mapper";
import { NotificationService } from "../notification/service";
import {
  notifyNoteActivated,
  notifyNoteArrears,
  notifyNoteDefaulted,
  notifyNoteFundingFailed,
  notifyNoteFundingSucceeded,
  notifyNoteIssuerRepaid,
  notifyNotePaymentReceived,
  notifyNotePublished,
  notifyNoteSettlementPosted,
  resolveNoteNotificationTitle,
} from "../notification/note-lifecycle-notifications";
import { noteInclude, noteRepository } from "./repository";
import {
  buildSettlementAllocations,
  calculateLateCharge as calculateLateChargeValues,
  calculateCalendarDayCount,
  calculateSettlementWaterfall,
  capLateFeeSuggestionsByHeadroom,
  computeActualReturnRatePercent,
} from "./calculators";
import type {
  createInvestmentSchema,
  createNoteFromApplicationSchema,
  bucketActivityQuerySchema,
  createWithdrawalSchema,
  getAdminInvestmentsQuerySchema,
  getNotesQuerySchema,
  investorBalanceActivityQuerySchema,
  investorBalanceStatementQuerySchema,
  investorInvestmentsQuerySchema,
  investorPortfolioHistoryQuerySchema,
  investorPortfolioQuerySchema,
  lateChargeSchema,
  overdueLateChargeSchema,
  paymentReviewSchema,
  recordPaymentSchema,
  settlementPreviewSchema,
  updateNoteFeaturedSchema,
  updateNoteDraftSchema,
  updatePlatformFinanceSettingsSchema,
  requestTrusteeSignatureUploadUrlSchema,
  createInvestorWithdrawalSchema,
  getInvestorWithdrawalsQuerySchema,
} from "./schemas";
import { loadTrusteeLetterConfig } from "./trustee-letters/trustee-letter-config.loader";
import {
  buildRepaymentBorrowerEntries,
  mapDisbursementLetterData,
  mapInvestorWithdrawalLetterData,
  mapRepaymentLetterData,
} from "./trustee-letters/trustee-letter-data.mapper";
import { renderTrusteeLetterPdf } from "./trustee-letters/trustee-letter-pdf.renderer";
import type {
  LedgerBucketAccountsConfig,
  PlatformAccountsConfig,
  TrusteeLetterConfig,
} from "@cashsouk/types";
import { randomUUID } from "crypto";
import type { z } from "zod";

type ActorContext = {
  userId: string;
  role?: UserRole | string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveProductCategoryFromWorkflow(
  workflow: Prisma.JsonValue | null | undefined
): string | null {
  if (!Array.isArray(workflow)) return null;
  const financingTypeStep = workflow.find((step) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return false;
    const stepRecord = step as Record<string, unknown>;
    const id = typeof stepRecord.id === "string" ? stepRecord.id : "";
    return id.startsWith("financing_type");
  });
  if (
    !financingTypeStep ||
    typeof financingTypeStep !== "object" ||
    Array.isArray(financingTypeStep)
  ) {
    return null;
  }
  const financingConfig = asRecord((financingTypeStep as Record<string, unknown>).config);
  const category = financingConfig?.category;
  if (typeof category === "string" && category.trim().length > 0) return category.trim();
  return null;
}

function resolveIssuerIndustryFromCorporateData(
  data: Prisma.JsonValue | null | undefined
): string | null {
  const corporateData = asRecord(data);
  const basicInfo = asRecord(corporateData?.basicInfo);
  const industry = basicInfo?.industry;
  if (typeof industry === "string" && industry.trim().length > 0) return industry.trim();
  return null;
}

function toNumber(value: unknown): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function signatureImageExtensionForContentType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/jpg" || normalized === "image/jpeg") return "jpg";
  return "bin";
}

/**
 * Normalises an issuer org's `bank_account_details` (RegTank structured shape:
 * `{ content: [{ fieldName, fieldValue }] }`) into the flat beneficiary snapshot
 * shape that the trustee letter UI expects (`bank_name`, `account_number`, etc.).
 * Falls back gracefully when fields are missing.
 */
function buildBeneficiarySnapshot(
  issuerOrg: {
    id: string;
    name: string | null;
    bank_account_details: Prisma.JsonValue | null;
  } | null
): Record<string, string> {
  const empty: Record<string, string> = {
    bank_name: "",
    account_number: "",
    account_holder: issuerOrg?.name?.trim() ?? "",
    swift_code: "",
    branch: "",
    account_type: "",
    reference_note: "",
  };
  const details = asRecord(issuerOrg?.bank_account_details);
  if (!details) return empty;

  // Already in flat shape (e.g. previously normalised or manually edited)
  if (typeof details.bank_name === "string" || typeof details.account_number === "string") {
    return {
      ...empty,
      bank_name: typeof details.bank_name === "string" ? details.bank_name : empty.bank_name,
      account_number:
        typeof details.account_number === "string" ? details.account_number : empty.account_number,
      account_holder:
        typeof details.account_holder === "string" && details.account_holder.trim() !== ""
          ? details.account_holder
          : empty.account_holder,
      swift_code: typeof details.swift_code === "string" ? details.swift_code : empty.swift_code,
      branch: typeof details.branch === "string" ? details.branch : empty.branch,
      account_type:
        typeof details.account_type === "string" ? details.account_type : empty.account_type,
      reference_note:
        typeof details.reference_note === "string" ? details.reference_note : empty.reference_note,
    };
  }

  const content = Array.isArray(details.content) ? details.content : null;
  if (!content) return empty;

  const findField = (...candidates: string[]): string => {
    for (const entry of content) {
      const record = asRecord(entry);
      const fieldName = typeof record?.fieldName === "string" ? record.fieldName.trim() : "";
      if (!fieldName) continue;
      if (!candidates.some((c) => fieldName.toLowerCase() === c.toLowerCase())) continue;
      const fieldValue = record?.fieldValue;
      if (typeof fieldValue === "string" && fieldValue.trim() !== "") return fieldValue.trim();
    }
    return "";
  };

  return {
    bank_name: findField("Bank", "Bank name"),
    account_number: findField("Bank account number", "Account number"),
    account_holder:
      findField("Account holder", "Account name", "Beneficiary name") ||
      (issuerOrg?.name?.trim() ?? ""),
    swift_code: findField("SWIFT", "SWIFT code", "Swift/BIC", "BIC"),
    branch: findField("Branch", "Branch name"),
    account_type: findField("Account type"),
    reference_note: "",
  };
}

type SettlementAllocation = {
  investmentId: string;
  investorOrganizationId: string;
  principal: number;
  profitNet: number;
  tawidhInvestorShare: number;
};

type NoteWithRelations = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveHistoryStartDate(
  range: "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL",
  latestDate: Date,
  firstDate: Date
) {
  if (range === "ALL") return firstDate;
  if (range === "YTD") return new Date(latestDate.getFullYear(), 0, 1);

  const dayWindowMap: Record<Exclude<typeof range, "YTD" | "ALL">, number> = {
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
  };

  const dayWindow = dayWindowMap[range];
  const startDate = startOfDay(new Date(latestDate));
  startDate.setDate(startDate.getDate() - (dayWindow - 1));
  return startDate;
}

function resolveHistoryGranularity(range: "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL") {
  return range === "YTD" || range === "ALL" ? "month" : "day";
}

type InvestorPortfolioHistoryPoint = {
  date: string;
  availableBalance: number;
  portfolioTotal: number;
};

type InvestorPortfolioHistoryTransaction = {
  posted_at: Date;
  direction: "IN" | "OUT";
  amount: number;
  source: InvestorBalanceTransactionSource;
  metadata: Prisma.JsonValue | null;
};

function collapseHistoryPointsByMonth(points: InvestorPortfolioHistoryPoint[]) {
  if (points.length <= 1) return points;

  const monthlyPoints: InvestorPortfolioHistoryPoint[] = [];
  let currentMonthPoint = points[0];
  let currentMonthKey = currentMonthPoint.date.slice(0, 7);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const pointMonthKey = point.date.slice(0, 7);

    if (pointMonthKey === currentMonthKey) {
      currentMonthPoint = point;
      continue;
    }

    monthlyPoints.push(currentMonthPoint);
    currentMonthPoint = point;
    currentMonthKey = pointMonthKey;
  }

  monthlyPoints.push(currentMonthPoint);
  return monthlyPoints;
}

function finalizeHistoryPoints(
  points: InvestorPortfolioHistoryPoint[],
  granularity: "day" | "month"
) {
  return granularity === "month" ? collapseHistoryPointsByMonth(points) : points;
}

function resolveSignedBalanceDelta(tx: InvestorPortfolioHistoryTransaction) {
  return tx.direction === "IN" ? tx.amount : -tx.amount;
}

function resolvePortfolioDelta(tx: InvestorPortfolioHistoryTransaction) {
  if (tx.source === InvestorBalanceTransactionSource.NOTE_INVESTMENT_COMMIT) return 0;

  if (tx.source === InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE) {
    const metadata = asRecord(tx.metadata);
    return metadata?.releaseReason === "SETTLEMENT_PAYOUT"
      ? toNumber(metadata?.profitNet) + toNumber(metadata?.tawidhInvestorShare)
      : 0;
  }

  return resolveSignedBalanceDelta(tx);
}

function resolveSettlementAllocations(snapshot: unknown): SettlementAllocation[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const allocations = (snapshot as Record<string, unknown>).allocations;
  if (!Array.isArray(allocations)) return [];

  return allocations.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const allocation = entry as Record<string, unknown>;
    if (
      typeof allocation.investmentId !== "string" ||
      typeof allocation.investorOrganizationId !== "string"
    ) {
      return [];
    }
    return [
      {
        investmentId: allocation.investmentId,
        investorOrganizationId: allocation.investorOrganizationId,
        principal: toNumber(allocation.principal),
        profitNet: toNumber(allocation.profitNet),
        tawidhInvestorShare: toNumber(allocation.tawidhInvestorShare),
      },
    ];
  });
}

function resolvePaymentSchedulesBySequence(note: {
  payment_schedules?: Array<{ due_date: Date; sequence?: number | null }>;
}) {
  return [...(note.payment_schedules ?? [])].sort(
    (left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)
  );
}

function resolveFirstPaymentDueDate(note: {
  maturity_date?: Date | null;
  payment_schedules?: Array<{ due_date: Date; sequence?: number | null }>;
}) {
  const schedules = resolvePaymentSchedulesBySequence(note);
  return schedules[0]?.due_date ?? note.maturity_date ?? null;
}

function resolveProfitMaturityDate(note: {
  maturity_date?: Date | null;
  payment_schedules?: Array<{ due_date: Date; sequence?: number | null }>;
}) {
  const schedules = resolvePaymentSchedulesBySequence(note);
  return note.maturity_date ?? schedules.at(-1)?.due_date ?? null;
}

function calculateProfitDays(startDate: Date | null, maturityDate: Date | null) {
  if (!startDate || !maturityDate) return 0;
  return calculateCalendarDayCount(startDate, maturityDate);
}

function resolveAvailableLateFeeHeadroomForNote(
  note: {
    activated_at?: Date | null;
    funded_amount: Prisma.Decimal | number | string;
    profit_rate_percent?: Prisma.Decimal | number | string | null;
    service_fee_rate_percent: Prisma.Decimal | number | string;
    maturity_date?: Date | null;
    payment_schedules?: Array<{ due_date: Date; sequence?: number | null }>;
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
  },
  grossReceiptAmount?: number
): number | null {
  const settlementAmount = grossReceiptAmount ?? resolveNoteSettlementAmount(note);
  if (settlementAmount <= 0 || !note.activated_at) return null;
  const profitMaturityDate = resolveProfitMaturityDate(note);
  if (!profitMaturityDate) return null;
  const profitRatePercent = toNumber(note.profit_rate_percent);
  if (profitRatePercent <= 0) return 0;

  return calculateSettlementWaterfall({
    grossReceiptAmount: settlementAmount,
    fundedPrincipal: toNumber(note.funded_amount),
    profitRatePercent,
    profitStartDate: note.activated_at,
    profitMaturityDate,
    serviceFeeRatePercent: toNumber(note.service_fee_rate_percent),
    tawidhAmount: 0,
    gharamahAmount: 0,
  }).availableLateFeeHeadroomAmount;
}

function buildInvestorRepaymentSummary(
  note: NoteWithRelations,
  investorOrganizationIds: Set<string>
) {
  const investorInvestments = note.investments.filter(
    (investment) =>
      investorOrganizationIds.has(investment.investor_organization_id) &&
      (investment.status === NoteInvestmentStatus.COMMITTED ||
        investment.status === NoteInvestmentStatus.CONFIRMED ||
        investment.status === NoteInvestmentStatus.SETTLED)
  );

  const investedPrincipal = investorInvestments.reduce(
    (sum, investment) => sum + toNumber(investment.amount),
    0
  );
  const grossProfitRatePercent = toNumber(note.profit_rate_percent);
  const netExpectedReturnRatePercent =
    computeNetExpectedReturnRatePercent(
      grossProfitRatePercent,
      toNumber(note.service_fee_rate_percent)
    ) ?? 0;
  const expectedReturnRatePercent = roundNoteMoney(
    netExpectedReturnRatePercent,
    INVESTOR_RETURN_RATE_DISPLAY_DECIMALS
  );
  const profitMaturityDate = resolveProfitMaturityDate(note);
  const expectedProfitDays =
    note.activated_at && profitMaturityDate
      ? calculateProfitDays(note.activated_at, profitMaturityDate)
      : 365;
  const expectedProfitGrossAmount =
    investedPrincipal * (grossProfitRatePercent / 100) * (expectedProfitDays / 365);
  const expectedServiceFeeAmount =
    expectedProfitGrossAmount * (toNumber(note.service_fee_rate_percent) / 100);
  const expectedProfitAmount = Math.max(0, expectedProfitGrossAmount - expectedServiceFeeAmount);
  const expectedPayoutAmount = investedPrincipal + expectedProfitAmount;
  const profitStartDate = note.activated_at?.toISOString() ?? null;
  const profitMaturityDateIso = profitMaturityDate?.toISOString() ?? null;
  const serviceFeeRatePercent = toNumber(note.service_fee_rate_percent);

  const receivedAllocations = note.settlements
    .filter((settlement) => settlement.status === NoteSettlementStatus.POSTED)
    .flatMap((settlement) => resolveSettlementAllocations(settlement.preview_snapshot))
    .filter((allocation) => investorOrganizationIds.has(allocation.investorOrganizationId));
  const receivedProfitNetAmount = receivedAllocations.reduce(
    (sum, allocation) => sum + allocation.profitNet,
    0
  );
  const receivedTawidhCompensationAmount = receivedAllocations.reduce(
    (sum, allocation) => sum + allocation.tawidhInvestorShare,
    0
  );
  const receivedPayoutAmount = receivedAllocations.reduce(
    (sum, allocation) =>
      sum + allocation.principal + allocation.profitNet + allocation.tawidhInvestorShare,
    0
  );
  const receivedProfitGrossDerived = deriveGrossProfitAndServiceFeeFromNet(
    receivedProfitNetAmount,
    serviceFeeRatePercent
  );
  const receivedServiceFeeAmount = receivedProfitGrossDerived.serviceFee;
  const receivedProfitGrossAmount = receivedProfitGrossDerived.profitGross;

  const receivedSettlementEvents = note.settlements
    .filter((settlement) => settlement.status === NoteSettlementStatus.POSTED)
    .flatMap((settlement) => {
      const allocations = resolveSettlementAllocations(settlement.preview_snapshot).filter(
        (allocation) => investorOrganizationIds.has(allocation.investorOrganizationId)
      );
      if (allocations.length === 0) return [];

      const principal = allocations.reduce((sum, allocation) => sum + allocation.principal, 0);
      const profitNet = allocations.reduce((sum, allocation) => sum + allocation.profitNet, 0);
      const tawidhInvestorShare = allocations.reduce(
        (sum, allocation) => sum + allocation.tawidhInvestorShare,
        0
      );
      const postedAt =
        settlement.posted_at?.toISOString() ??
        settlement.approved_at?.toISOString() ??
        settlement.created_at?.toISOString() ??
        new Date().toISOString();

      return [
        {
          settlementId: settlement.id,
          postedAt,
          principal: roundNoteMoney(principal, 2),
          profitNet: roundNoteMoney(profitNet, 2),
          tawidhInvestorShare: roundNoteMoney(tawidhInvestorShare, 2),
        },
      ];
    })
    .sort(
      (left, right) => new Date(left.postedAt).getTime() - new Date(right.postedAt).getTime()
    );

  const actualReturnRatePercent = computeActualReturnRatePercent({
    investedPrincipal,
    receivedProfitNetAmount,
    receivedTawidhCompensationAmount,
  });
  const progressPercent =
    expectedPayoutAmount > 0
      ? clampPercent((receivedPayoutAmount / expectedPayoutAmount) * 100)
      : 0;

  return {
    investedPrincipal: roundNoteMoney(investedPrincipal, 2),
    expectedPayoutAmount: roundNoteMoney(expectedPayoutAmount, 2),
    expectedProfitAmount: roundNoteMoney(expectedProfitAmount, 2),
    expectedProfitGrossAmount: roundNoteMoney(expectedProfitGrossAmount, 2),
    expectedServiceFeeAmount: roundNoteMoney(expectedServiceFeeAmount, 2),
    profitDays: expectedProfitDays,
    profitStartDate,
    profitMaturityDate: profitMaturityDateIso,
    receivedPayoutAmount: roundNoteMoney(receivedPayoutAmount, 2),
    receivedProfitNetAmount: roundNoteMoney(receivedProfitNetAmount, 2),
    receivedProfitGrossAmount: roundNoteMoney(receivedProfitGrossAmount, 2),
    receivedServiceFeeAmount: roundNoteMoney(receivedServiceFeeAmount, 2),
    receivedTawidhCompensationAmount: roundNoteMoney(receivedTawidhCompensationAmount, 2),
    expectedReturnRatePercent,
    actualReturnRatePercent:
      actualReturnRatePercent == null ? null : roundNoteMoney(actualReturnRatePercent, 2),
    progressPercent: roundNoteMoney(progressPercent, 2),
    receivedSettlementEvents,
  };
}

/** When remaining capacity is smaller, min commit equals remainder (see shared helper). */
const DEFAULT_LISTING_DURATION_DAYS = 14;

function toReconciledPortfolioHistoryPoint(
  availableBalance: number,
  portfolioTotal: number,
  date: string
): InvestorPortfolioHistoryPoint {
  const committed = portfolioTotal - availableBalance;
  const totals = buildInvestorPortfolioTotals(availableBalance, committed);
  return {
    date,
    availableBalance: totals.availableBalance,
    portfolioTotal: totals.portfolioTotal,
  };
}

function resolveNoteSettlementAmount(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount?: Prisma.Decimal | number | string | null;
}) {
  const invoiceSnapshot = asRecord(note.invoice_snapshot);
  const details = asRecord(invoiceSnapshot?.details);
  const offerDetails = asRecord(invoiceSnapshot?.offer_details);
  return (
    toNumber(details?.value) ||
    toNumber(details?.invoice_value) ||
    toNumber(details?.invoiceAmount) ||
    toNumber(offerDetails?.invoice_value) ||
    toNumber(note.requested_amount)
  );
}

function resolveIssuerPaymentPurpose(input: { metadata?: Record<string, unknown> | null }) {
  const metadata = asRecord(input.metadata);
  return metadata?.paymentPurpose === "LATE_FEES" ? "LATE_FEES" : "SETTLEMENT";
}

function resolveRiskRating(value: unknown) {
  return isSoukscoreRiskRating(value) ? value : null;
}

function isUniqueConstraintError(error: unknown, target: string): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
  const constraint = meta && "target" in meta ? meta.target : null;
  return Array.isArray(constraint) ? constraint.includes(target) : constraint === target;
}

function assertSettlementAmountComplete(settlement: {
  gross_receipt_amount: Prisma.Decimal | number | string;
  tawidh_amount?: Prisma.Decimal | number | string;
  gharamah_amount?: Prisma.Decimal | number | string;
  note: {
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
  };
}) {
  const settlementAmount = resolveNoteSettlementAmount(settlement.note);
  const grossReceiptAmount = toNumber(settlement.gross_receipt_amount);
  if (settlementAmount > 0 && grossReceiptAmount + 0.005 < settlementAmount) {
    throw new AppError(
      422,
      "INCOMPLETE_SETTLEMENT_AMOUNT",
      "Settlement cannot be approved or posted until the full invoice settlement amount has been received"
    );
  }
  if (settlementAmount > 0 && grossReceiptAmount > settlementAmount + 0.005) {
    throw new AppError(
      422,
      "SETTLEMENT_RECEIPT_LIMIT_EXCEEDED",
      "Settlement receipt cannot exceed the invoice settlement amount. Late fees are allocated from this receipt in the waterfall."
    );
  }
}

function assertSettlementWaterfallBalanced(settlement: {
  gross_receipt_amount: Prisma.Decimal | number | string;
  investor_principal: Prisma.Decimal | number | string;
  investor_profit_gross: Prisma.Decimal | number | string;
  tawidh_amount: Prisma.Decimal | number | string;
  gharamah_amount: Prisma.Decimal | number | string;
  issuer_residual_amount: Prisma.Decimal | number | string;
}) {
  const grossReceiptAmount = toNumber(settlement.gross_receipt_amount);
  const allocatedAmount =
    toNumber(settlement.investor_principal) +
    toNumber(settlement.investor_profit_gross) +
    toNumber(settlement.tawidh_amount) +
    toNumber(settlement.gharamah_amount) +
    toNumber(settlement.issuer_residual_amount);

  if (allocatedAmount > grossReceiptAmount + 0.005) {
    throw new AppError(
      422,
      "SETTLEMENT_WATERFALL_SHORTFALL",
      "Settlement receipt is not enough to cover investor principal, contractual profit, and approved late charges"
    );
  }
}

const OPEN_PAYMENT_STATUSES: NotePaymentStatus[] = [
  NotePaymentStatus.PENDING,
  NotePaymentStatus.PARTIAL,
  NotePaymentStatus.RECEIVED,
  NotePaymentStatus.RECONCILED,
];

function resolveSettlementReceiptLimit(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount?: Prisma.Decimal | number | string | null;
}) {
  return resolveNoteSettlementAmount(note);
}

function assertReceiptAmountWithinSettlementLimit(
  note: {
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
  },
  receiptAmount: number
) {
  const limit = resolveSettlementReceiptLimit(note);
  if (limit > 0 && receiptAmount > limit + 0.005) {
    throw new AppError(
      422,
      "SETTLEMENT_RECEIPT_LIMIT_EXCEEDED",
      "Open receipts cannot exceed the invoice settlement amount. Late fees are taken from this receipt in the settlement waterfall."
    );
  }
}

function resolvePendingReceiptLateFeeAmount(
  note: {
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
    maturity_date?: Date | null;
    grace_period_days: number;
    tawidh_rate_cap_percent: Prisma.Decimal | number | string;
    gharamah_rate_cap_percent: Prisma.Decimal | number | string;
    payment_schedules?: Array<{ due_date: Date; sequence?: number | null }>;
    settlements?: Array<{
      status: NoteSettlementStatus;
      tawidh_amount?: Prisma.Decimal | number | string | null;
      gharamah_amount?: Prisma.Decimal | number | string | null;
    }>;
  },
  input: {
    receiptDate: string;
    pendingTawidhAmount?: number;
    pendingGharamahAmount?: number;
  }
) {
  const pendingTawidhAmount = input.pendingTawidhAmount ?? 0;
  const pendingGharamahAmount = input.pendingGharamahAmount ?? 0;
  const pendingLateFeeAmount = pendingTawidhAmount + pendingGharamahAmount;
  if (pendingLateFeeAmount <= 0) return 0;

  const dueDate = resolveFirstPaymentDueDate(note);
  if (!dueDate) {
    throw new AppError(
      422,
      "LATE_FEE_DUE_DATE_REQUIRED",
      "Late fees cannot be used as a receipt allowance until the note has a maturity or due date"
    );
  }

  const settlementAmount = resolveNoteSettlementAmount(note);
  if (settlementAmount <= 0) {
    throw new AppError(
      409,
      "NOTE_AMOUNT_UNRESOLVED",
      "Late fees cannot be used as a receipt allowance before the invoice amount is resolved"
    );
  }

  const receiptDate = new Date(input.receiptDate);
  const total = calculateLateChargeValues({
    receiptAmount: settlementAmount,
    dueDate,
    receiptDate,
    gracePeriodDays: note.grace_period_days,
    tawidhRateCapPercent: toNumber(note.tawidh_rate_cap_percent),
    gharamahRateCapPercent: toNumber(note.gharamah_rate_cap_percent),
  });
  const appliedSettlements = note.settlements?.filter(
    (settlement) =>
      settlement.status === NoteSettlementStatus.APPROVED ||
      settlement.status === NoteSettlementStatus.POSTED
  );
  const appliedTawidhAmount = (appliedSettlements ?? []).reduce(
    (sum, settlement) => sum + toNumber(settlement.tawidh_amount),
    0
  );
  const appliedGharamahAmount = (appliedSettlements ?? []).reduce(
    (sum, settlement) => sum + toNumber(settlement.gharamah_amount),
    0
  );
  const remainingTawidhAmount = Math.max(0, total.tawidhCap - appliedTawidhAmount);
  const remainingGharamahAmount = Math.max(0, total.gharamahCap - appliedGharamahAmount);

  if (pendingTawidhAmount > remainingTawidhAmount + 0.005) {
    throw new AppError(
      422,
      "TAWIDH_CAP_EXCEEDED",
      "Pending Ta'widh allowance exceeds the remaining allowable cap"
    );
  }
  if (pendingGharamahAmount > remainingGharamahAmount + 0.005) {
    throw new AppError(
      422,
      "GHARAMAH_CAP_EXCEEDED",
      "Pending Gharamah allowance exceeds the remaining allowable cap"
    );
  }

  return pendingLateFeeAmount;
}

function assertOpenReceiptsWithinSettlementLimit(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount?: Prisma.Decimal | number | string | null;
  payments?: Array<{
    id?: string;
    status: NotePaymentStatus;
    receipt_amount: Prisma.Decimal | number | string;
  }>;
}) {
  const openReceiptAmount = (note.payments ?? [])
    .filter((payment) => OPEN_PAYMENT_STATUSES.includes(payment.status))
    .reduce((sum, payment) => sum + toNumber(payment.receipt_amount), 0);
  assertReceiptAmountWithinSettlementLimit(note, openReceiptAmount);
}

function assertNoPendingPaymentsForSettlement(note: {
  payments?: Array<{ status: NotePaymentStatus }>;
}) {
  const pendingCount = (note.payments ?? []).filter(
    (payment) => payment.status === NotePaymentStatus.PENDING
  ).length;
  if (pendingCount > 0) {
    throw new AppError(
      409,
      "PENDING_PAYMENTS_BLOCK_SETTLEMENT",
      "Review or reject all pending payments before previewing, approving, or posting settlement"
    );
  }
}

async function assertRepaymentReceiptLedgerComplete(noteId: string, requiredAmount: number) {
  const receiptEntries = await prisma.noteLedgerEntry.findMany({
    where: {
      note_id: noteId,
      direction: NoteLedgerDirection.CREDIT,
      account: { code: "REPAYMENT_POOL" },
    },
    select: { amount: true },
  });
  const receivedAmount = receiptEntries.reduce((sum, entry) => sum + toNumber(entry.amount), 0);
  if (requiredAmount > 0 && receivedAmount + 0.005 < requiredAmount) {
    throw new AppError(
      422,
      "INCOMPLETE_REPAYMENT_RECEIPT",
      "Settlement cannot be approved or posted until the full settlement amount has been received into the Repayment Pool"
    );
  }
}

function assertNoteReadyForServicing(note: {
  funding_status: NoteFundingStatus;
  servicing_status: NoteServicingStatus;
}) {
  if (
    note.funding_status !== NoteFundingStatus.FUNDED ||
    note.servicing_status === NoteServicingStatus.NOT_STARTED
  ) {
    throw new AppError(
      409,
      "NOTE_SERVICING_NOT_OPEN",
      "Payment and settlement are available only after the note is funded and activated"
    );
  }
  if (note.servicing_status === NoteServicingStatus.SETTLED) {
    throw new AppError(
      409,
      "NOTE_ALREADY_SETTLED",
      "Payment and settlement are closed after settlement is posted"
    );
  }
}

function assertNoPostedSettlement(note: { settlements?: Array<{ status: NoteSettlementStatus }> }) {
  if (note.settlements?.some((settlement) => settlement.status === NoteSettlementStatus.POSTED)) {
    throw new AppError(
      409,
      "NOTE_SETTLEMENT_ALREADY_POSTED",
      "Payment and settlement actions are closed after settlement is posted"
    );
  }
}

function assertNoApprovedOrPostedSettlement(note: {
  settlements?: Array<{ status: NoteSettlementStatus }>;
}) {
  if (
    note.settlements?.some(
      (settlement) =>
        settlement.status === NoteSettlementStatus.APPROVED ||
        settlement.status === NoteSettlementStatus.POSTED
    )
  ) {
    throw new AppError(
      409,
      "SETTLEMENT_LOCKED",
      "Payment actions are locked after settlement is approved or posted"
    );
  }
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return value as Prisma.InputJsonValue;
}

function dateFrom(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveConfirmedSettlementInvestments(
  investments: Array<{
    id: string;
    status: NoteInvestmentStatus;
    amount: Prisma.Decimal | number | string;
    investor_organization_id: string;
  }>
) {
  return investments.filter((investment) => investment.status === NoteInvestmentStatus.CONFIRMED);
}

function assertConfirmedInvestmentPrincipalMatchesWaterfall(
  eligiblePrincipal: number,
  investorPrincipal: number
) {
  if (eligiblePrincipal + 0.005 < investorPrincipal) {
    throw new AppError(
      422,
      "SETTLEMENT_INVESTMENT_PRINCIPAL_MISMATCH",
      "Confirmed investment principal is less than the settlement investor principal"
    );
  }
}

function buildAllocationsForSettlementRecord(
  settlement: {
    investor_principal: Prisma.Decimal | number | string;
    investor_profit_net: Prisma.Decimal | number | string;
    tawidh_investor_amount: Prisma.Decimal | number | string;
  },
  confirmedInvestments: Array<{
    id: string;
    investor_organization_id: string;
    amount: Prisma.Decimal | number | string;
  }>
) {
  return buildSettlementAllocations({
    investments: confirmedInvestments.map((investment) => ({
      id: investment.id,
      investorOrganizationId: investment.investor_organization_id,
      amount: toNumber(investment.amount),
    })),
    investorPrincipal: toNumber(settlement.investor_principal),
    investorProfitNet: toNumber(settlement.investor_profit_net),
    tawidhInvestorAmount: toNumber(settlement.tawidh_investor_amount),
  });
}

function assertSettlementAllocationsFundable(
  settlement: {
    investor_principal: Prisma.Decimal | number | string;
    investor_profit_net: Prisma.Decimal | number | string;
    tawidh_investor_amount: Prisma.Decimal | number | string;
  },
  confirmedInvestments: Array<{
    id: string;
    investor_organization_id: string;
    amount: Prisma.Decimal | number | string;
  }>
) {
  const investorPrincipal = toNumber(settlement.investor_principal);
  const investorProfitNet = toNumber(settlement.investor_profit_net);
  const tawidhInvestorAmount = toNumber(settlement.tawidh_investor_amount);
  const expectedInvestorPool = investorPrincipal + investorProfitNet + tawidhInvestorAmount;

  if (investorPrincipal > 0.005 && confirmedInvestments.length === 0) {
    throw new AppError(
      422,
      "SETTLEMENT_NO_CONFIRMED_INVESTMENTS",
      "Settlement cannot be approved or posted until confirmed investments exist for this note"
    );
  }

  const eligiblePrincipal = confirmedInvestments.reduce(
    (sum, investment) => sum + toNumber(investment.amount),
    0
  );
  assertConfirmedInvestmentPrincipalMatchesWaterfall(eligiblePrincipal, investorPrincipal);

  const allocations = buildAllocationsForSettlementRecord(settlement, confirmedInvestments);
  const allocatedInvestorPool = allocations.reduce(
    (sum, allocation) =>
      sum + allocation.principal + allocation.profitNet + allocation.tawidhInvestorShare,
    0
  );

  if (Math.abs(allocatedInvestorPool - expectedInvestorPool) > 0.05) {
    throw new AppError(
      422,
      "SETTLEMENT_ALLOCATION_MISMATCH",
      "Investor allocations do not match the settlement pool. Void and re-preview settlement after funding is confirmed."
    );
  }
}

function mergeAllocationsIntoPreviewSnapshot(
  snapshot: Prisma.JsonValue | null | undefined,
  allocations: ReturnType<typeof buildSettlementAllocations>
) {
  const base =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? { ...(snapshot as Record<string, unknown>) }
      : {};
  return { ...base, allocations };
}

async function renderPdfBuffer(title: string, rows: Array<[string, string]>): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.fontSize(18).text(title, { underline: true });
  doc.moveDown();
  for (const [label, value] of rows) {
    doc.fontSize(10).fillColor("#666").text(label);
    doc
      .fontSize(12)
      .fillColor("#111")
      .text(value || "-");
    doc.moveDown(0.5);
  }
  doc.end();
  return done;
}

export class NoteService {
  private readonly notificationService = new NotificationService();

  private async listInvestorOrganizationIds(userId: string) {
    const orgs = await prisma.investorOrganization.findMany({
      where: { OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }] },
      select: { id: true },
    });
    return orgs.map((org) => org.id);
  }

  private async resolveInvestorOrgIds(userId: string, investorOrganizationId?: string) {
    const accessibleIds = await this.listInvestorOrganizationIds(userId);
    if (!investorOrganizationId) return accessibleIds;
    if (!accessibleIds.includes(investorOrganizationId)) {
      throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");
    }
    return [investorOrganizationId];
  }

  private async resolveTrusteeSignatureImageBuffer(
    config: TrusteeLetterConfig | null
  ): Promise<Buffer | null> {
    const s3Key = config?.authorisedSignatureImageKey?.trim();
    if (!s3Key) return null;
    try {
      return await getS3ObjectBuffer(s3Key);
    } catch (error) {
      logger.warn(
        { err: error, s3Key },
        "Unable to load trustee authorised signature image; using text-only signature block"
      );
      return null;
    }
  }

  async listAdminNotes(params: z.infer<typeof getNotesQuerySchema>) {
    const { notes, totalCount } = await noteRepository.list(params);
    const productIds = notes
      .map((note) => {
        const productSnapshot = asRecord(note.product_snapshot);
        const productId = productSnapshot?.product_id;
        return typeof productId === "string" && productId.trim().length > 0 ? productId : null;
      })
      .filter((value): value is string => Boolean(value));
    const uniqueProductIds = [...new Set(productIds)];
    const products = uniqueProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: uniqueProductIds } },
          select: { id: true, workflow: true },
        })
      : [];
    const productCategoryById = new Map(
      products.map((product) => [product.id, resolveProductCategoryFromWorkflow(product.workflow)])
    );
    const productNameById = new Map(
      products.map((product) => [product.id, resolveProductNameFromWorkflow(product.workflow)])
    );
    const issuerOrgIds = [...new Set(notes.map((note) => note.issuer_organization_id))];
    const issuerOrgs = issuerOrgIds.length
      ? await prisma.issuerOrganization.findMany({
          where: { id: { in: issuerOrgIds } },
          select: { id: true, corporate_onboarding_data: true },
        })
      : [];
    const issuerIndustryByOrgId = new Map(
      issuerOrgs.map((org) => [
        org.id,
        resolveIssuerIndustryFromCorporateData(org.corporate_onboarding_data),
      ])
    );
    const mappedNotes = notes.map((note) => {
      const mapped = mapNoteListItem(note);
      const productSnapshot = asRecord(note.product_snapshot);
      const productId =
        typeof productSnapshot?.product_id === "string" &&
        productSnapshot.product_id.trim().length > 0
          ? productSnapshot.product_id
          : null;
      return {
        ...mapped,
        productCategory:
          mapped.productCategory ??
          (productId ? (productCategoryById.get(productId) ?? null) : null),
        productName:
          mapped.productName ?? (productId ? (productNameById.get(productId) ?? null) : null),
        issuerIndustry:
          mapped.issuerIndustry ?? issuerIndustryByOrgId.get(note.issuer_organization_id) ?? null,
      };
    });
    return {
      notes: mappedNotes,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / params.pageSize),
      },
    };
  }

  async getAdminNoteDetail(id: string) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const withdrawals = await prisma.withdrawalInstruction.findMany({
      where: { note_id: id },
      orderBy: { created_at: "desc" },
    });
    const mapped = mapNoteDetail(note, { withdrawals });

    let sourceInvoiceOfferSigning = null;
    if (note.source_invoice_id) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: note.source_invoice_id },
        select: {
          offer_signing: true,
          offer_signing_history: true,
          offer_details: true,
        },
      });
      if (invoice) {
        sourceInvoiceOfferSigning = buildOfferSigningAdminView({
          offerSigning: invoice.offer_signing,
          offerSigningHistory: invoice.offer_signing_history,
          offerDetails: (invoice.offer_details as Record<string, unknown> | null) ?? null,
          primaryApplicationId: note.source_application_id,
          canResign: noteAllowsInvoiceResign(note.status),
        });
      }
    }

    return {
      ...mapped,
      sourceInvoiceOfferSigning,
    };
  }

  async resignSourceInvoiceOffer(
    noteId: string,
    adminUserId: string,
    logContext?: {
      ipAddress?: string | null;
      userAgent?: string | null;
      deviceInfo?: string | null;
    }
  ) {
    return adminResignInvoiceOfferFromNote({ noteId, adminUserId, logContext });
  }

  async listSourceInvoicesForNotes() {
    const invoices = await prisma.invoice.findMany({
      where: { status: InvoiceStatus.APPROVED },
      include: {
        application: {
          include: {
            issuer_organization: true,
            contract: true,
          },
        },
        contract: true,
      },
      orderBy: { updated_at: "desc" },
    });
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const notes = await prisma.note.findMany({
      where: { source_invoice_id: { in: invoiceIds } },
      select: {
        id: true,
        source_invoice_id: true,
        note_reference: true,
        status: true,
      },
    });
    const notesByInvoiceId = new Map(notes.map((note) => [note.source_invoice_id, note]));

    return {
      invoices: invoices.map((invoice) => {
        const details = asRecord(invoice.details) ?? {};
        const offer = asRecord(invoice.offer_details) ?? {};
        const sourceContract = invoice.contract ?? invoice.application.contract;
        const paymaster = asRecord(sourceContract?.customer_details);
        const note = notesByInvoiceId.get(invoice.id) ?? null;
        return {
          invoiceId: invoice.id,
          applicationId: invoice.application_id,
          contractId: invoice.contract_id ?? invoice.application.contract_id,
          issuerOrganizationId: invoice.application.issuer_organization_id,
          issuerName: invoice.application.issuer_organization.name,
          paymasterName: this.resolvePaymasterName(paymaster),
          invoiceNumber: typeof details.number === "string" ? details.number : null,
          invoiceAmount: resolveRequestedInvoiceAmount(details),
          offeredAmount: resolveOfferedAmount(offer) || null,
          profitRatePercent: resolveOfferedProfitRate(offer),
          riskRating: resolveRiskRating(offer.risk_rating),
          maturityDate:
            typeof details.maturity_date === "string"
              ? (dateFrom(details.maturity_date)?.toISOString() ?? null)
              : null,
          invoiceStatus: invoice.status,
          applicationStatus: invoice.application.status,
          noteId: note?.id ?? null,
          noteReference: note?.note_reference ?? null,
          noteStatus: note?.status ?? null,
        };
      }),
    };
  }

  async getActionRequiredCount() {
    const approvedInvoices = await prisma.invoice.findMany({
      where: { status: InvoiceStatus.APPROVED },
      select: { id: true },
    });
    const approvedInvoiceIds = approvedInvoices.map((invoice) => invoice.id);
    const notesForApprovedInvoices = approvedInvoiceIds.length
      ? await prisma.note.findMany({
          where: { source_invoice_id: { in: approvedInvoiceIds } },
          select: { source_invoice_id: true },
        })
      : [];
    const notedInvoiceIds = new Set(
      notesForApprovedInvoices.map((note) => note.source_invoice_id).filter(Boolean)
    );
    const readyInvoices = approvedInvoiceIds.filter(
      (invoiceId) => !notedInvoiceIds.has(invoiceId)
    ).length;

    const [draftNotes, fundingCandidates] = await Promise.all([
      prisma.note.count({
        where: {
          status: NoteStatus.DRAFT,
        },
      }),
      prisma.note.findMany({
        where: {
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
        },
        select: {
          funded_amount: true,
          target_amount: true,
          minimum_funding_percent: true,
        },
      }),
    ]);

    const fundingReady = fundingCandidates.filter((note) => {
      const targetAmount = toNumber(note.target_amount);
      if (targetAmount <= 0) return false;
      return meetsMinimumFunding(
        toNumber(note.funded_amount),
        targetAmount,
        toNumber(note.minimum_funding_percent)
      );
    }).length;

    const breakdown = {
      readyInvoices,
      draftNotes,
      fundingReady,
    };

    return {
      count: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
      breakdown,
    };
  }

  async listAdminInvestments(params: z.infer<typeof getAdminInvestmentsQuerySchema>) {
    const { page, pageSize, search, status, noteId, investorOrganizationId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NoteInvestmentWhereInput = {};
    if (status) where.status = status as NoteInvestmentStatus;
    if (noteId) where.note_id = noteId;
    if (investorOrganizationId) where.investor_organization_id = investorOrganizationId;

    if (search && search.trim().length > 0) {
      const term = search.trim();
      const [matchingInvestorOrgs, matchingInvestorUsers] = await Promise.all([
        prisma.investorOrganization.findMany({
          where: { name: { contains: term, mode: "insensitive" } },
          select: { id: true },
          take: 100,
        }),
        prisma.user.findMany({
          where: {
            OR: [
              { first_name: { contains: term, mode: "insensitive" } },
              { last_name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
          select: { user_id: true },
          take: 100,
        }),
      ]);
      const matchingInvestorOrgIds = matchingInvestorOrgs.map((org) => org.id);
      const matchingInvestorUserIds = matchingInvestorUsers.map((user) => user.user_id);
      where.OR = [
        { note: { title: { contains: term, mode: "insensitive" } } },
        { note: { note_reference: { contains: term, mode: "insensitive" } } },
        { investor_user_id: { equals: term } },
        { investor_organization_id: { equals: term } },
        ...(matchingInvestorOrgIds.length > 0
          ? [{ investor_organization_id: { in: matchingInvestorOrgIds } }]
          : []),
        ...(matchingInvestorUserIds.length > 0
          ? [{ investor_user_id: { in: matchingInvestorUserIds } }]
          : []),
      ];
    }

    const [investments, totalCount] = await Promise.all([
      prisma.noteInvestment.findMany({
        where,
        orderBy: [{ committed_at: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.noteInvestment.count({ where }),
    ]);

    if (investments.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        },
      };
    }

    const noteIds = Array.from(new Set(investments.map((i) => i.note_id)));
    const investorOrgIds = Array.from(new Set(investments.map((i) => i.investor_organization_id)));
    const investorUserIds = Array.from(new Set(investments.map((i) => i.investor_user_id)));

    const [notes, investorOrgs, investorUsers] = await Promise.all([
      prisma.note.findMany({
        where: { id: { in: noteIds } },
        select: {
          id: true,
          title: true,
          note_reference: true,
          status: true,
          funding_status: true,
          target_amount: true,
          issuer_organization_id: true,
        },
      }),
      prisma.investorOrganization.findMany({
        where: { id: { in: investorOrgIds } },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { user_id: { in: investorUserIds } },
        select: { user_id: true, first_name: true, last_name: true, email: true },
      }),
    ]);

    const issuerOrgIds = Array.from(
      new Set(notes.map((n) => n.issuer_organization_id).filter(Boolean))
    );
    const issuerOrgs = issuerOrgIds.length
      ? await prisma.issuerOrganization.findMany({
          where: { id: { in: issuerOrgIds } },
          select: { id: true, name: true },
        })
      : [];

    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const investorOrgMap = new Map(investorOrgs.map((o) => [o.id, o]));
    const investorUserMap = new Map(investorUsers.map((u) => [u.user_id, u]));
    const issuerMap = new Map(issuerOrgs.map((o) => [o.id, o]));

    const items = investments.map((inv) => {
      const note = noteMap.get(inv.note_id);
      const investorOrg = investorOrgMap.get(inv.investor_organization_id);
      const investorUser = investorUserMap.get(inv.investor_user_id);
      const issuer = note?.issuer_organization_id
        ? issuerMap.get(note.issuer_organization_id)
        : null;
      const investorUserName = investorUser
        ? [investorUser.first_name, investorUser.last_name].filter(Boolean).join(" ").trim()
        : "";

      return {
        id: inv.id,
        noteId: inv.note_id,
        noteTitle: note?.title ?? null,
        noteReference: note?.note_reference ?? null,
        noteStatus: note?.status ?? null,
        noteFundingStatus: note?.funding_status ?? null,
        noteTargetAmount: note ? toNumber(note.target_amount) : null,
        issuerOrganizationId: issuer?.id ?? null,
        issuerOrganizationName: issuer?.name ?? null,
        investorOrganizationId: inv.investor_organization_id,
        investorOrganizationName: investorOrg?.name ?? null,
        investorUserId: inv.investor_user_id,
        investorUserName: investorUserName || (investorUser?.email ?? null),
        investorUserEmail: investorUser?.email ?? null,
        status: inv.status,
        amount: toNumber(inv.amount),
        allocationPercent: toNumber(inv.allocation_percent),
        currency: "MYR",
        committedAt: inv.committed_at?.toISOString() ?? null,
        confirmedAt: inv.confirmed_at?.toISOString() ?? null,
        releasedAt: inv.released_at?.toISOString() ?? null,
      };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    };
  }

  async listPendingRepayments() {
    const rawPayments = await prisma.notePayment.findMany({
      where: {
        status: {
          in: [
            NotePaymentStatus.PENDING,
            NotePaymentStatus.PARTIAL,
            NotePaymentStatus.RECEIVED,
            NotePaymentStatus.RECONCILED,
          ],
        },
      },
      orderBy: [{ receipt_date: "asc" }, { created_at: "asc" }],
    });

    if (rawPayments.length === 0) return { count: 0, items: [] };

    // Exclude payments whose note already has a POSTED settlement — the repayment
    // has effectively been handled and should not appear as pending. This also
    // self-heals any historical rows that pre-date the post-settlement payment
    // status update.
    const noteIdsWithPayments = Array.from(new Set(rawPayments.map((p) => p.note_id)));
    const postedSettlements = await prisma.noteSettlement.findMany({
      where: {
        note_id: { in: noteIdsWithPayments },
        status: NoteSettlementStatus.POSTED,
      },
      select: { note_id: true },
    });
    const settledNoteIds = new Set(postedSettlements.map((s) => s.note_id));
    const payments = rawPayments.filter((p) => !settledNoteIds.has(p.note_id));
    if (payments.length === 0) return { count: 0, items: [] };

    const noteIds = Array.from(new Set(payments.map((p) => p.note_id)));
    const notes = await prisma.note.findMany({
      where: { id: { in: noteIds } },
      select: { id: true, title: true, status: true, issuer_organization_id: true },
    });
    const issuerIds = Array.from(
      new Set(notes.map((n) => n.issuer_organization_id).filter(Boolean) as string[])
    );
    const issuers = issuerIds.length
      ? await prisma.issuerOrganization.findMany({
          where: { id: { in: issuerIds } },
          select: { id: true, name: true },
        })
      : [];
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const issuerMap = new Map(issuers.map((i) => [i.id, i]));

    const items = payments.map((payment) => {
      const note = noteMap.get(payment.note_id);
      const issuer = note?.issuer_organization_id
        ? issuerMap.get(note.issuer_organization_id)
        : undefined;
      const actionNeeded =
        payment.status === NotePaymentStatus.PENDING
          ? "REVIEW"
          : payment.status === NotePaymentStatus.PARTIAL
            ? "AWAIT_REMAINDER"
            : "POST_SETTLEMENT";
      return {
        paymentId: payment.id,
        noteId: payment.note_id,
        noteTitle: note?.title ?? null,
        noteStatus: note?.status ?? null,
        amount: toNumber(payment.receipt_amount),
        currency: "MYR",
        receivedAt: payment.receipt_date?.toISOString() ?? null,
        reference: payment.reference,
        source: payment.source,
        status: payment.status,
        actionNeeded,
        issuerOrganizationId: issuer?.id ?? null,
        issuerOrganizationName: issuer?.name ?? null,
        createdAt: payment.created_at.toISOString(),
      };
    });

    return {
      count: items.length,
      items,
    };
  }

  async listPendingIssuerPayouts() {
    const withdrawals = await prisma.withdrawalInstruction.findMany({
      where: {
        withdrawal_type: {
          in: [WithdrawalType.ISSUER_DISBURSEMENT, WithdrawalType.ISSUER_RESIDUAL_RETURN],
        },
        status: {
          notIn: [WithdrawalStatus.COMPLETED, WithdrawalStatus.CANCELLED],
        },
      },
      orderBy: [{ created_at: "asc" }],
    });

    if (withdrawals.length === 0) return { count: 0, items: [] };

    const noteIds = Array.from(
      new Set(withdrawals.map((w) => w.note_id).filter(Boolean) as string[])
    );
    const issuerIds = Array.from(
      new Set(withdrawals.map((w) => w.issuer_organization_id).filter(Boolean) as string[])
    );
    const notes = noteIds.length
      ? await prisma.note.findMany({
          where: { id: { in: noteIds } },
          select: { id: true, title: true, status: true },
        })
      : [];
    const issuers = issuerIds.length
      ? await prisma.issuerOrganization.findMany({
          where: { id: { in: issuerIds } },
          select: { id: true, name: true },
        })
      : [];
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const issuerMap = new Map(issuers.map((i) => [i.id, i]));

    const items = withdrawals.map((withdrawal) => {
      const note = withdrawal.note_id ? noteMap.get(withdrawal.note_id) : undefined;
      const issuer = withdrawal.issuer_organization_id
        ? issuerMap.get(withdrawal.issuer_organization_id)
        : undefined;
      return {
        withdrawalId: withdrawal.id,
        noteId: withdrawal.note_id ?? "",
        noteTitle: note?.title ?? null,
        noteStatus: note?.status ?? null,
        issuerOrganizationId: issuer?.id ?? null,
        issuerOrganizationName: issuer?.name ?? null,
        withdrawalType: withdrawal.withdrawal_type,
        amount: toNumber(withdrawal.amount),
        currency: withdrawal.currency,
        status: withdrawal.status,
        generatedAt: withdrawal.generated_at?.toISOString() ?? null,
        submittedToTrusteeAt: withdrawal.submitted_to_trustee_at?.toISOString() ?? null,
        createdAt: withdrawal.created_at.toISOString(),
      };
    });

    return {
      count: items.length,
      items,
    };
  }

  async getPendingInvestorWithdrawalsCount() {
    const count = await prisma.withdrawalInstruction.count({
      where: {
        withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
        status: {
          in: [
            WithdrawalStatus.DRAFT,
            WithdrawalStatus.LETTER_GENERATED,
            WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
          ],
        },
      },
    });
    return { count };
  }

  async listPendingServiceFeeTrusteeLetters() {
    const settlements = await prisma.noteSettlement.findMany({
      where: {
        status: NoteSettlementStatus.POSTED,
        service_fee_amount: { gt: money(0.005) },
        OR: [
          { service_fee_trustee_status: null },
          {
            service_fee_trustee_status: {
              not: ServiceFeeTrusteeInstructionStatus.COMPLETED,
            },
          },
        ],
      },
      orderBy: [{ posted_at: "asc" }],
      select: {
        id: true,
        note_id: true,
        service_fee_amount: true,
        posted_at: true,
        service_fee_trustee_status: true,
        service_fee_trustee_submitted_at: true,
        service_fee_trustee_completed_at: true,
      },
    });
    if (settlements.length === 0) return { count: 0, items: [] };

    const notes = await prisma.note.findMany({
      where: { id: { in: Array.from(new Set(settlements.map((s) => s.note_id))) } },
      select: {
        id: true,
        title: true,
        status: true,
        issuer_organization_id: true,
      },
    });
    const issuerIds = Array.from(new Set(notes.map((n) => n.issuer_organization_id)));
    const issuers = issuerIds.length
      ? await prisma.issuerOrganization.findMany({
          where: { id: { in: issuerIds } },
          select: { id: true, name: true },
        })
      : [];
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    const issuerMap = new Map(issuers.map((i) => [i.id, i]));

    const items = settlements.map((s) => {
      const note = noteMap.get(s.note_id);
      const issuer = note ? issuerMap.get(note.issuer_organization_id) : undefined;
      return {
        settlementId: s.id,
        noteId: s.note_id,
        noteTitle: note?.title ?? null,
        noteStatus: note?.status ?? null,
        issuerOrganizationId: issuer?.id ?? null,
        issuerOrganizationName: issuer?.name ?? null,
        serviceFeeAmount: toNumber(s.service_fee_amount),
        currency: "MYR",
        settlementPostedAt: s.posted_at?.toISOString() ?? null,
        trusteeInstructionStatus: s.service_fee_trustee_status,
        submittedToTrusteeAt: s.service_fee_trustee_submitted_at?.toISOString() ?? null,
        instructionCompletedAt: s.service_fee_trustee_completed_at?.toISOString() ?? null,
      };
    });

    return { count: items.length, items };
  }

  async createFromInvoice(
    invoiceId: string,
    input: z.infer<typeof createNoteFromApplicationSchema>,
    actor: ActorContext
  ) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        application: {
          include: {
            issuer_organization: true,
            contract: true,
          },
        },
        contract: true,
      },
    });
    if (!invoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new AppError(409, "INVOICE_NOT_APPROVED", "Only approved invoices can become notes");
    }

    return this.createFromInvoiceSource({
      application: invoice.application,
      invoice,
      sourceContract: invoice.contract ?? invoice.application.contract,
      title: input.title,
      actor,
    });
  }

  async createFromApplication(
    applicationId: string,
    input: z.infer<typeof createNoteFromApplicationSchema>,
    actor: ActorContext
  ) {
    const source = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        issuer_organization: true,
        contract: true,
        invoices: { orderBy: { created_at: "asc" } },
      },
    });

    if (!source) throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    if (source.status !== ApplicationStatus.COMPLETED) {
      throw new AppError(
        409,
        "APPLICATION_NOT_COMPLETED",
        "Only completed applications can become notes"
      );
    }

    let selectedInvoice = input.sourceInvoiceId
      ? source.invoices.find((invoice) => invoice.id === input.sourceInvoiceId)
      : null;

    if (!input.sourceInvoiceId) {
      const approvedInvoices = source.invoices.filter(
        (invoice) => invoice.status === InvoiceStatus.APPROVED
      );
      const existingNotes = approvedInvoices.length
        ? await prisma.note.findMany({
            where: { source_invoice_id: { in: approvedInvoices.map((invoice) => invoice.id) } },
            select: { source_invoice_id: true },
          })
        : [];
      const notedInvoiceIds = new Set(
        existingNotes.map((note) => note.source_invoice_id).filter(Boolean)
      );
      selectedInvoice =
        approvedInvoices.find((invoice) => !notedInvoiceIds.has(invoice.id)) ??
        approvedInvoices[0] ??
        null;
    }

    if (input.sourceInvoiceId && !selectedInvoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Source invoice not found for application");
    }

    if (!selectedInvoice) {
      throw new AppError(409, "INVOICE_NOT_APPROVED", "Only approved invoices can become notes");
    }

    return this.createFromInvoiceSource({
      application: source,
      invoice: selectedInvoice,
      sourceContract: source.contract,
      title: input.title,
      actor,
    });
  }

  private async createFromInvoiceSource(params: {
    application: {
      id: string;
      issuer_organization_id: string;
      contract_id: string | null;
      financing_type: Prisma.JsonValue | null;
      issuer_organization: {
        id: string;
        name: string | null;
        type: string;
        corporate_onboarding_data: Prisma.JsonValue | null;
      };
    };
    invoice: {
      id: string;
      application_id: string;
      contract_id: string | null;
      details: Prisma.JsonValue;
      offer_details: Prisma.JsonValue | null;
      status: InvoiceStatus;
    };
    sourceContract: {
      id: string;
      status: string;
      contract_details: Prisma.JsonValue | null;
      offer_details: Prisma.JsonValue | null;
      customer_details: Prisma.JsonValue | null;
    } | null;
    title?: string;
    actor: ActorContext;
  }) {
    const { application, invoice, sourceContract, actor } = params;
    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new AppError(409, "INVOICE_NOT_APPROVED", "Only approved invoices can become notes");
    }

    const existing = await noteRepository.findBySource(application.id, invoice.id);
    if (existing) return mapNoteDetail(existing);

    const invoiceDetails = asRecord(invoice.details) ?? {};
    const invoiceOffer = asRecord(invoice.offer_details) ?? {};
    const contractDetails = asRecord(sourceContract?.contract_details) ?? {};
    const financingType = asRecord(application.financing_type);
    const productId =
      typeof financingType?.product_id === "string" ? financingType.product_id : null;
    const product = productId
      ? await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, workflow: true, service_fee_rate_percent: true },
        })
      : null;
    const productCategory = resolveProductCategoryFromWorkflow(product?.workflow);
    const productDisplayName =
      resolveProductNameFromWorkflow(product?.workflow) ??
      (typeof financingType?.product_name === "string" &&
      financingType.product_name.trim().length > 0
        ? financingType.product_name.trim()
        : null);
    const issuerIndustry = resolveIssuerIndustryFromCorporateData(
      application.issuer_organization.corporate_onboarding_data
    );
    const invoiceFaceValue = resolveRequestedInvoiceAmount(invoiceDetails);
    const targetAmount =
      resolveOfferedAmount(invoiceOffer) ||
      invoiceFaceValue ||
      resolveApprovedFacilityForRefresh(sourceContract?.status ?? "", contractDetails) ||
      toNumber(contractDetails.financing) ||
      toNumber(contractDetails.value);

    if (targetAmount <= 0) {
      throw new AppError(422, "NOTE_AMOUNT_UNRESOLVED", "Unable to resolve note target amount");
    }

    const invoiceNumber =
      typeof invoiceDetails.number === "string" ? invoiceDetails.number : invoice.id.slice(-8);
    const reference = `NOTE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${invoice.id
      .slice(-8)
      .toUpperCase()}`;

    const note = await prisma
      .$transaction(async (tx) => {
        const created = await tx.note.create({
          data: {
            source_application_id: application.id,
            source_contract_id: invoice.contract_id ?? application.contract_id,
            source_invoice_id: invoice.id,
            issuer_organization_id: application.issuer_organization_id,
            title:
              params.title ??
              `Note for invoice ${invoiceNumber} - ${application.issuer_organization.name ?? application.issuer_organization.id}`,
            note_reference: reference,
            issuer_snapshot: {
              id: application.issuer_organization.id,
              name: application.issuer_organization.name,
              type: application.issuer_organization.type,
              industry: issuerIndustry,
            },
            paymaster_snapshot: json(sourceContract?.customer_details),
            product_snapshot: json({
              ...(financingType ?? {}),
              product_id: productId,
              category: productCategory,
              ...(productDisplayName ? { product_name: productDisplayName } : {}),
            }),
            contract_snapshot: json(
              sourceContract
                ? {
                    id: sourceContract.id,
                    status: sourceContract.status,
                    contract_details: sourceContract.contract_details,
                    offer_details: sourceContract.offer_details,
                  }
                : null
            ),
            invoice_snapshot: {
              id: invoice.id,
              status: invoice.status,
              details: invoice.details,
              offer_details: invoice.offer_details,
            },
            requested_amount: money(invoiceFaceValue || targetAmount),
            target_amount: money(targetAmount),
            profit_rate_percent:
              resolveOfferedProfitRate(invoiceOffer) != null
                ? money(resolveOfferedProfitRate(invoiceOffer) ?? 0)
                : undefined,
            platform_fee_rate_percent: money(resolveOfferedPlatformFeeRatePercent(invoiceOffer)),
            service_fee_rate_percent: money(
              product?.service_fee_rate_percent ? product.service_fee_rate_percent.toNumber() : 15
            ),
            maturity_date:
              typeof invoiceDetails.maturity_date === "string"
                ? dateFrom(invoiceDetails.maturity_date)
                : null,
            events: {
              create: {
                event_type: "NOTE_CREATED_FROM_INVOICE",
                actor_user_id: actor.userId,
                actor_role: actor.role,
                portal: actor.portal ?? "ADMIN",
                ip_address: actor.ipAddress,
                user_agent: actor.userAgent,
                correlation_id: actor.correlationId,
                metadata: { applicationId: application.id, invoiceId: invoice.id },
              },
            },
            admin_actions: {
              create: {
                action_type: "CREATE_FROM_INVOICE",
                actor_user_id: actor.userId,
                after_state: { status: NoteStatus.DRAFT, invoiceId: invoice.id },
                ip_address: actor.ipAddress,
                user_agent: actor.userAgent,
                correlation_id: actor.correlationId,
              },
            },
          },
          include: noteInclude,
        });

        await tx.notePaymentSchedule.create({
          data: {
            note_id: created.id,
            sequence: 1,
            due_date: created.maturity_date ?? new Date(),
            expected_principal: created.target_amount,
            expected_profit: money(
              created.profit_rate_percent
                ? created.target_amount.toNumber() * (created.profit_rate_percent.toNumber() / 100)
                : 0
            ),
            expected_total: money(
              created.target_amount.toNumber() +
                (created.profit_rate_percent
                  ? created.target_amount.toNumber() *
                    (created.profit_rate_percent.toNumber() / 100)
                  : 0)
            ),
          },
        });

        return tx.note.findUniqueOrThrow({ where: { id: created.id }, include: noteInclude });
      })
      .catch(async (error: unknown) => {
        if (isUniqueConstraintError(error, "source_invoice_id")) {
          const existingAfterRace = await noteRepository.findBySource(application.id, invoice.id);
          if (existingAfterRace) return existingAfterRace;
        }
        throw error;
      });

    return mapNoteDetail(note);
  }

  async updateDraft(id: string, input: z.infer<typeof updateNoteDraftSchema>, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.DRAFT || note.funding_status !== NoteFundingStatus.NOT_OPEN) {
      throw new AppError(409, "NOTE_NOT_EDITABLE", "Only pre-funding draft notes can be edited");
    }
    if (input.platformFeeRatePercent != null) {
      const platformFeeRateCapPercent = await this.resolvePlatformFeeRateCapPercent();
      if (input.platformFeeRatePercent > platformFeeRateCapPercent) {
        throw new AppError(
          422,
          "PLATFORM_FEE_CAP_EXCEEDED",
          `Platform fee rate cannot exceed ${platformFeeRateCapPercent}%`
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.note.update({
        where: { id },
        data: {
          title: input.title,
          target_amount: input.targetAmount != null ? money(input.targetAmount) : undefined,
          maturity_date:
            input.maturityDate !== undefined ? dateFrom(input.maturityDate) : undefined,
          platform_fee_rate_percent:
            input.platformFeeRatePercent != null ? money(input.platformFeeRatePercent) : undefined,
          service_fee_rate_percent:
            input.serviceFeeRatePercent != null ? money(input.serviceFeeRatePercent) : undefined,
          service_fee_customer_scope: input.serviceFeeCustomerScope,
          profit_rate_percent:
            input.profitRatePercent !== undefined && input.profitRatePercent !== null
              ? money(input.profitRatePercent)
              : input.profitRatePercent === null
                ? null
                : undefined,
          listing:
            input.summary !== undefined
              ? {
                  upsert: {
                    create: { summary: input.summary },
                    update: { summary: input.summary },
                  },
                }
              : undefined,
        },
        include: noteInclude,
      });
      await this.logAdminAction(
        tx,
        id,
        "UPDATE_DRAFT",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });

    return mapNoteDetail(updated);
  }

  async updateFeaturedSettings(
    id: string,
    input: z.infer<typeof updateNoteFeaturedSchema>,
    actor: ActorContext
  ) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const featuredFrom = input.featuredFrom ? dateFrom(input.featuredFrom) : null;
    const featuredUntil = input.featuredUntil ? dateFrom(input.featuredUntil) : null;
    if (input.featuredFrom && !featuredFrom) {
      throw new AppError(422, "INVALID_FEATURED_FROM", "Invalid featured start datetime");
    }
    if (input.featuredUntil && !featuredUntil) {
      throw new AppError(422, "INVALID_FEATURED_UNTIL", "Invalid featured end datetime");
    }
    if (featuredFrom && featuredUntil && featuredUntil < featuredFrom) {
      throw new AppError(
        422,
        "INVALID_FEATURED_WINDOW",
        "Featured end datetime must be after start datetime"
      );
    }

    if (input.isFeatured) {
      if (
        note.status !== NoteStatus.PUBLISHED ||
        note.listing_status !== NoteListingStatus.PUBLISHED ||
        note.funding_status !== NoteFundingStatus.OPEN
      ) {
        throw new AppError(
          409,
          "NOTE_NOT_FEATURE_ELIGIBLE",
          "Only notes that are published and open for funding can be featured"
        );
      }
      const activeFeaturedCount = await prisma.note.count({
        where: {
          is_featured: true,
          id: { not: id },
          status: NoteStatus.PUBLISHED,
          listing_status: NoteListingStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          AND: [
            { OR: [{ featured_from: null }, { featured_from: { lte: new Date() } }] },
            { OR: [{ featured_until: null }, { featured_until: { gte: new Date() } }] },
          ],
        },
      });
      if (activeFeaturedCount >= 6) {
        throw new AppError(
          409,
          "FEATURED_CAP_REACHED",
          "Active featured note cap (6) has been reached"
        );
      }
    }

    const featuredRank = input.isFeatured
      ? (input.featuredRank ?? note.featured_rank ?? 9999)
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.note.update({
        where: { id },
        data: {
          is_featured: input.isFeatured,
          featured_rank: featuredRank,
          featured_from: input.isFeatured ? featuredFrom : null,
          featured_until: input.isFeatured ? featuredUntil : null,
        },
        include: noteInclude,
      });
      await this.logAdminAction(
        tx,
        id,
        "UPDATE_FEATURED_SETTINGS",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });

    return mapNoteDetail(updated);
  }

  async publish(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (
      note.status !== NoteStatus.DRAFT ||
      note.funding_status !== NoteFundingStatus.NOT_OPEN ||
      !new Set<NoteListingStatus>([
        NoteListingStatus.NOT_LISTED,
        NoteListingStatus.DRAFT,
        NoteListingStatus.UNPUBLISHED,
      ]).has(note.listing_status)
    ) {
      throw new AppError(
        409,
        "NOTE_NOT_PUBLISHABLE",
        "Only draft or unpublished notes can be published"
      );
    }
    const platformFeeRateCapPercent = await this.resolvePlatformFeeRateCapPercent();
    if (
      toNumber(note.platform_fee_rate_percent) > platformFeeRateCapPercent ||
      toNumber(note.service_fee_rate_percent) > 15
    ) {
      throw new AppError(422, "NOTE_FEE_CAP_EXCEEDED", "Configured fees exceed allowed caps");
    }
    const now = new Date();
    const noteProductSnapshot = asRecord(note.product_snapshot);
    const productId =
      typeof noteProductSnapshot?.product_id === "string" ? noteProductSnapshot.product_id : null;

    const fallbackDurationDays = DEFAULT_LISTING_DURATION_DAYS;
    let durationDays = fallbackDurationDays;

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { marketplace_listing_duration_days: true },
      });
      const configured = product?.marketplace_listing_duration_days;
      if (configured != null) durationDays = configured;
    }

    const closesAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const updated = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.note.updateMany({
        where: {
          id,
          status: NoteStatus.DRAFT,
          funding_status: NoteFundingStatus.NOT_OPEN,
          listing_status: {
            in: [
              NoteListingStatus.NOT_LISTED,
              NoteListingStatus.DRAFT,
              NoteListingStatus.UNPUBLISHED,
            ],
          },
        },
        data: {
          status: NoteStatus.PUBLISHED,
          listing_status: NoteListingStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          published_at: now,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(
          409,
          "NOTE_NOT_PUBLISHABLE",
          "Only draft or unpublished notes can be published"
        );
      }
      const result = await tx.note.update({
        where: { id },
        data: {
          listing: {
            upsert: {
              create: {
                status: NoteListingStatus.PUBLISHED,
                published_at: now,
                opens_at: now,
                closes_at: closesAt,
              },
              update: {
                status: NoteListingStatus.PUBLISHED,
                published_at: now,
                opens_at: now,
                closes_at: closesAt,
                unpublished_at: null,
              },
            },
          },
        },
        include: noteInclude,
      });
      await this.logAdminAction(
        tx,
        id,
        "PUBLISH",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });
    await notifyNotePublished({
      notificationService: this.notificationService,
      noteId: id,
      issuerOrganizationId: updated.issuer_organization_id,
      noteTitle: resolveNoteNotificationTitle(updated),
    });
    return mapNoteDetail(updated);
  }

  async unpublish(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.investments.length > 0) {
      throw new AppError(
        409,
        "NOTE_HAS_COMMITMENTS",
        "Cannot unpublish notes with investor commitments"
      );
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.note.update({
        where: { id },
        data: {
          status: NoteStatus.DRAFT,
          listing_status: NoteListingStatus.UNPUBLISHED,
          funding_status: NoteFundingStatus.NOT_OPEN,
          listing: {
            upsert: {
              create: { status: NoteListingStatus.UNPUBLISHED, unpublished_at: now },
              update: { status: NoteListingStatus.UNPUBLISHED, unpublished_at: now },
            },
          },
        },
        include: noteInclude,
      });
      await this.logAdminAction(
        tx,
        id,
        "UNPUBLISH",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });
    return mapNoteDetail(updated);
  }

  async createInvestment(
    noteId: string,
    input: z.infer<typeof createInvestmentSchema>,
    actor: ActorContext
  ) {
    const investorOrg = await prisma.investorOrganization.findFirst({
      where: {
        id: input.investorOrganizationId,
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    });
    if (!investorOrg)
      throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");
    if (!investorOrg.deposit_received) {
      throw new AppError(
        403,
        "INVESTOR_DEPOSIT_REQUIRED",
        "Minimum investor deposit is required before investing"
      );
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        status: true,
        funding_status: true,
        target_amount: true,
        funded_amount: true,
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.PUBLISHED || note.funding_status !== NoteFundingStatus.OPEN) {
      throw new AppError(409, "NOTE_NOT_OPEN", "Note is not open for investment");
    }

    const target = normalizeNoteCapacityAmount(toNumber(note.target_amount));
    const funded = normalizeNoteCapacityAmount(toNumber(note.funded_amount));
    const bounds = computeMarketplaceCommitBounds(target, funded);
    if (bounds.remainingCapacity <= 0) {
      throw new AppError(
        409,
        "NOTE_FULLY_ALLOCATED",
        "This note has no remaining funding capacity"
      );
    }
    if (input.amount > bounds.maxCommit + NOTE_MONEY_TOLERANCE) {
      throw new AppError(
        422,
        "NOTE_OVERSUBSCRIBED",
        `Investment exceeds remaining note capacity of ${bounds.maxCommit.toFixed(2)}`
      );
    }
    if (input.amount + NOTE_MONEY_TOLERANCE < bounds.minCommit) {
      throw new AppError(
        422,
        "INVESTMENT_BELOW_MINIMUM",
        `Minimum commitment for this note is ${bounds.minCommit.toFixed(2)}`
      );
    }

    const investmentAmount = money(input.amount);
    const remainingCapacityFloor = money(
      maxFundedBeforeMarketplaceCommit(target, input.amount)
    );

    const updated = await prisma.$transaction(async (tx) => {
      const capacityUpdate = await tx.note.updateMany({
        where: {
          id: noteId,
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          funded_amount: { lte: remainingCapacityFloor },
        },
        data: { funded_amount: { increment: investmentAmount } },
      });

      if (capacityUpdate.count !== 1) {
        const current = await tx.note.findUnique({
          where: { id: noteId },
          select: {
            status: true,
            funding_status: true,
            funded_amount: true,
            target_amount: true,
          },
        });
        if (!current) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
        if (
          current.status !== NoteStatus.PUBLISHED ||
          current.funding_status !== NoteFundingStatus.OPEN
        ) {
          throw new AppError(409, "NOTE_NOT_OPEN", "Note is not open for investment");
        }
        const retryBounds = computeMarketplaceCommitBounds(
          normalizeNoteCapacityAmount(toNumber(current.target_amount)),
          normalizeNoteCapacityAmount(toNumber(current.funded_amount))
        );
        throw new AppError(
          422,
          "NOTE_OVERSUBSCRIBED",
          `Investment exceeds remaining note capacity of ${retryBounds.maxCommit.toFixed(2)}`
        );
      }

      const investment = await tx.noteInvestment.create({
        data: {
          note_id: noteId,
          investor_organization_id: input.investorOrganizationId,
          investor_user_id: actor.userId,
          amount: investmentAmount,
          allocation_percent: money(target > 0 ? (input.amount / target) * 100 : 0),
        },
      });
      await debitInvestorBalanceForCommit(tx, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
        noteId,
        noteInvestmentId: investment.id,
        idempotencyKey: `investor-balance:commit:${investment.id}`,
      });
      await this.logEvent(tx, noteId, "INVESTMENT_COMMITTED", actor, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
      });
      return tx.note.findUniqueOrThrow({ where: { id: noteId }, include: noteInclude });
    });

    const updatedFunded = toNumber(updated.funded_amount);
    const updatedTarget = toNumber(updated.target_amount);
    if (
      updatedTarget > 0 &&
      isNoteFullyFunded(updatedFunded, updatedTarget) &&
      updated.status === NoteStatus.PUBLISHED &&
      updated.funding_status === NoteFundingStatus.OPEN
    ) {
      try {
        await this.closeFunding(noteId, {
          userId: "SYS",
          role: "ADMIN",
          portal: "ADMIN",
          correlationId: `auto-close:fully-funded:${noteId}`,
        });
        const closed = await noteRepository.findById(noteId);
        if (closed) return mapMarketplaceNoteDetail(closed);
      } catch (err) {
        logger.warn(
          { err, noteId },
          "Auto-close on full funding failed; will be retried by note-listing-expiry cron"
        );
      }
    }

    return mapMarketplaceNoteDetail(updated);
  }

  async closeFunding(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.PUBLISHED || note.funding_status !== NoteFundingStatus.OPEN) {
      throw new AppError(
        409,
        "NOTE_FUNDING_NOT_OPEN",
        "Only notes with open funding can be closed"
      );
    }
    const targetAmount = toNumber(note.target_amount);
    const fundedAmount = toNumber(note.funded_amount);
    if (
      !meetsMinimumFunding(
        fundedAmount,
        targetAmount,
        toNumber(note.minimum_funding_percent)
      )
    ) {
      throw new AppError(
        409,
        "NOTE_MINIMUM_FUNDING_NOT_MET",
        "Minimum funding threshold has not been met"
      );
    }
    const issuerOrg = await prisma.issuerOrganization.findUnique({
      where: { id: note.issuer_organization_id },
      select: { id: true, name: true, bank_account_details: true },
    });
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.note.updateMany({
        where: { id, status: NoteStatus.PUBLISHED, funding_status: NoteFundingStatus.OPEN },
        data: {
          status: NoteStatus.FUNDING,
          funding_status: NoteFundingStatus.FUNDED,
          listing_status: NoteListingStatus.CLOSED,
          funding_closed_at: now,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(
          409,
          "NOTE_FUNDING_NOT_OPEN",
          "Only notes with open funding can be closed"
        );
      }
      await tx.noteInvestment.updateMany({
        where: { note_id: id, status: NoteInvestmentStatus.COMMITTED },
        data: { status: NoteInvestmentStatus.CONFIRMED, confirmed_at: now },
      });
      const result = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      // Lock and compute facility-fee progress (contract financing only).
      const noteSourceContractId = result.source_contract_id;
      const isContractFinancing =
        typeof noteSourceContractId === "string" && noteSourceContractId.length > 0;

      let contractDetailsRecord: Record<string, unknown> | null = null;
      let facilityFeeCharged = 0;
      let facilityFeeCap = 0;
      let facilityFeePaidBefore = 0;
      let facilityFeeRemainingAfter = 0;
      let facilityFeeRatePercent = 0;

      // Only compute progressive facility fee when a contract is linked to the note.
      // For legacy/missing facility fee rate on the contract, fee rate is treated as 0.
      if (isContractFinancing) {
        const lockedContracts = await tx.$queryRaw<
          { contract_details: Prisma.JsonValue | null }[]
        >`SELECT contract_details FROM contracts WHERE id = ${noteSourceContractId} FOR UPDATE`;

        const lockedContractDetails = lockedContracts[0]?.contract_details ?? null;
        const cd = asRecord(lockedContractDetails) ?? {};
        contractDetailsRecord = cd;

        const approvedFacilityAmount = Number(cd.approved_facility) || 0;
        const facilityFeeRatePercentRaw = cd.facility_fee_rate_percent;
        facilityFeeRatePercent =
          typeof facilityFeeRatePercentRaw === "number" &&
          Number.isFinite(facilityFeeRatePercentRaw)
            ? facilityFeeRatePercentRaw
            : 0;
        facilityFeePaidBefore = Number(cd.facility_fee_paid_amount) || 0;

        const fundedAmount = toNumber(result.funded_amount);
        const progressive = computeProgressiveFacilityFee({
          approvedFacilityAmount,
          facilityFeeRatePercent,
          facilityFeePaidBefore,
          fundedAmountForDisbursement: fundedAmount,
        });
        facilityFeeCap = progressive.facilityFeeCap;
        facilityFeeCharged = progressive.facilityFeeCharged;
        facilityFeeRemainingAfter = progressive.remainingFacilityFee;
      }

      const fundedAmount = toNumber(result.funded_amount);
      const platformFee = fundedAmount * (toNumber(result.platform_fee_rate_percent) / 100);
      const netDisbursement = Math.max(0, fundedAmount - platformFee - facilityFeeCharged);

      // Ledger must use the same computed values as withdrawal metadata.
      await this.postDisbursementLedger(tx, result, actor, {
        fundedAmount,
        platformFee,
        facilityFeeCharged,
        netDisbursement,
      });

      // Create issuer withdrawal (contract financing only affects the computed amount above).
      // For notes where facility-fee is not applicable, facilityFeeCharged stays 0.

      // Facility fee progress is updated whenever we actually charged a facility fee at disbursement time,
      // even if the issuer net disbursement becomes 0.
      if (isContractFinancing && facilityFeeCharged > 0) {
        await tx.contract.update({
          where: { id: noteSourceContractId },
          data: {
            contract_details: {
              ...(contractDetailsRecord ?? {}),
              facility_fee_paid_amount: facilityFeePaidBefore + facilityFeeCharged,
            } as Prisma.InputJsonValue,
          },
        });
      }

      // Always create a withdrawal instruction when there is something to pay (net disbursement)
      // or when we charged a facility fee (so we can persist the full calculation snapshot).
      if (netDisbursement > 0 || facilityFeeCharged > 0) {
        const existingDisbursement = await tx.withdrawalInstruction.findFirst({
          where: {
            note_id: id,
            withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
          },
        });
        if (!existingDisbursement) {
          await tx.withdrawalInstruction.create({
            data: {
              note_id: id,
              issuer_organization_id: result.issuer_organization_id,
              requested_by_user_id: actor.userId,
              withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
              amount: money(netDisbursement),
              beneficiary_snapshot: buildBeneficiarySnapshot(issuerOrg) as Prisma.InputJsonValue,
              metadata: {
                autoCreatedAt: now.toISOString(),
                autoCreatedBy: actor.userId,
                issuerOrganizationName: issuerOrg?.name ?? null,
                source: "CLOSE_FUNDING",
                grossFundedAmount: fundedAmount,
                platformFeeAmount: platformFee,
                facilityFeeRatePercent,
                facilityFeeCap,
                facilityFeePaidBefore,
                facilityFeeCharged,
                facilityFeeRemainingAfter,
                netIssuerDisbursement: netDisbursement,
              } as Prisma.InputJsonValue,
            },
          });
          await this.logEvent(tx, id, "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED", actor, {
            netDisbursement,
            fundedAmount,
            platformFee,
            facilityFeeCharged,
          });
        }
      }

      await this.logAdminAction(
        tx,
        id,
        "CLOSE_FUNDING",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });
    await notifyNoteFundingSucceeded({
      notificationService: this.notificationService,
      noteId: id,
      issuerOrganizationId: updated.issuer_organization_id,
      noteTitle: resolveNoteNotificationTitle(updated),
    });
    return mapNoteDetail(updated);
  }

  async failFunding(id: string, actor: ActorContext) {
    const now = new Date();
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.PUBLISHED || note.funding_status !== NoteFundingStatus.OPEN) {
      throw new AppError(
        409,
        "NOTE_FUNDING_NOT_OPEN",
        "Only notes with open funding can be failed"
      );
    }
    const targetAmount = toNumber(note.target_amount);
    const fundedAmount = toNumber(note.funded_amount);
    if (
      meetsMinimumFunding(
        fundedAmount,
        targetAmount,
        toNumber(note.minimum_funding_percent)
      )
    ) {
      throw new AppError(
        409,
        "NOTE_MINIMUM_FUNDING_MET",
        "Notes that meet the minimum funding threshold should be closed, not failed"
      );
    }
    const minimumFundingPercent = toNumber(note.minimum_funding_percent);
    const minimumFundingAmount =
      targetAmount * (minimumFundingPercent - NOTE_MONEY_TOLERANCE) / 100;
    let failedInvestorOrganizationIds: string[] = [];
    const updated = await prisma.$transaction(async (tx) => {
      const releasedCommitments = await tx.noteInvestment.findMany({
        where: { note_id: id, status: NoteInvestmentStatus.COMMITTED },
        select: { id: true, investor_organization_id: true, amount: true },
      });
      failedInvestorOrganizationIds = [
        ...new Set(releasedCommitments.map((row) => row.investor_organization_id)),
      ];
      const stateUpdate = await tx.note.updateMany({
        where: {
          id,
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          funded_amount: { lt: money(minimumFundingAmount) },
        },
        data: {
          status: NoteStatus.FAILED_FUNDING,
          funding_status: NoteFundingStatus.FAILED,
          listing_status: NoteListingStatus.CLOSED,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(
          409,
          "NOTE_FUNDING_NOT_OPEN",
          "Only notes with open funding can be failed"
        );
      }
      await tx.noteInvestment.updateMany({
        where: { note_id: id, status: NoteInvestmentStatus.COMMITTED },
        data: { status: NoteInvestmentStatus.RELEASED, released_at: now },
      });
      for (const inv of releasedCommitments) {
        await creditInvestorBalance(tx, {
          investorOrganizationId: inv.investor_organization_id,
          amount: toNumber(inv.amount),
          source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE,
          noteId: id,
          noteInvestmentId: inv.id,
          idempotencyKey: `investor-balance:release:fail-funding:${inv.id}`,
        });
      }
      const result = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      await this.logAdminAction(
        tx,
        id,
        "FAIL_FUNDING",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });
    await notifyNoteFundingFailed({
      notificationService: this.notificationService,
      noteId: id,
      issuerOrganizationId: updated.issuer_organization_id,
      noteTitle: resolveNoteNotificationTitle(updated),
      failedInvestorOrganizationIds,
    });
    return mapNoteDetail(updated);
  }

  async activate(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const issuerDisbursement = await prisma.withdrawalInstruction.findFirst({
      where: {
        note_id: id,
        withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
        status: { notIn: [WithdrawalStatus.COMPLETED, WithdrawalStatus.CANCELLED] },
      },
      select: { id: true },
    });
    if (issuerDisbursement) {
      throw new AppError(
        409,
        "ISSUER_DISBURSEMENT_PENDING",
        "Funded notes with issuer disbursement instructions activate only after the trustee payout is marked complete"
      );
    }
    if (note.funding_status !== NoteFundingStatus.FUNDED) {
      throw new AppError(409, "NOTE_NOT_FUNDED", "Only funded notes can be activated");
    }
    if (
      note.status === NoteStatus.ACTIVE ||
      note.servicing_status !== NoteServicingStatus.NOT_STARTED
    ) {
      throw new AppError(409, "NOTE_ALREADY_ACTIVATED", "Note has already been activated");
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.note.updateMany({
        where: {
          id,
          funding_status: NoteFundingStatus.FUNDED,
          servicing_status: NoteServicingStatus.NOT_STARTED,
        },
        data: {
          status: NoteStatus.ACTIVE,
          servicing_status: NoteServicingStatus.CURRENT,
          activated_at: now,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(409, "NOTE_ALREADY_ACTIVATED", "Note has already been activated");
      }
      const result = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      // For legacy safety: facility fee is charged at funding close; activation ledger uses facility fee = 0.
      // closeFunding() already posts the correct disbursement ledger entries.
      await this.postDisbursementLedger(tx, result, actor);
      await this.logAdminAction(
        tx,
        id,
        "ACTIVATE",
        actor,
        mapNoteListItem(note),
        mapNoteListItem(result)
      );
      return result;
    });
    await notifyNoteActivated({
      notificationService: this.notificationService,
      noteId: id,
      issuerOrganizationId: updated.issuer_organization_id,
      noteTitle: resolveNoteNotificationTitle(updated),
    });
    return mapNoteDetail(updated);
  }

  async listMarketplace(params: z.infer<typeof getNotesQuerySchema>) {
    const {
      excludeRepaid: _excludeRepaid,
      excludeFullySettledRegistryNotes: _reg,
      ...marketplaceParams
    } = params;
    return this.listAdminNotes({
      ...marketplaceParams,
      status: NoteStatus.PUBLISHED,
      listingStatus: NoteListingStatus.PUBLISHED,
      fundingStatus: NoteFundingStatus.OPEN,
    });
  }

  async getMarketplaceNoteDetail(id: string) {
    const note = await noteRepository.findById(id);
    if (
      !note ||
      note.status !== NoteStatus.PUBLISHED ||
      note.listing_status !== NoteListingStatus.PUBLISHED ||
      note.funding_status !== NoteFundingStatus.OPEN
    ) {
      throw new AppError(404, "NOTE_NOT_FOUND", "Published marketplace note not found");
    }
    return mapMarketplaceNoteDetail(note);
  }

  async listInvestorInvestments(
    userId: string,
    query: z.infer<typeof investorInvestmentsQuerySchema> = {}
  ) {
    const orgIds = await this.resolveInvestorOrgIds(userId, query.investorOrganizationId);
    if (orgIds.length === 0) {
      return {
        notes: [],
        pagination: { page: 1, pageSize: 1, totalCount: 0, totalPages: 1 },
      };
    }

    const orgIdSet = new Set(orgIds);
    const notes = await prisma.note.findMany({
      where: { investments: { some: { investor_organization_id: { in: orgIds } } } },
      include: noteInclude,
      orderBy: { updated_at: "desc" },
    });
    const enrichedNotes = notes.map((note) => ({
      ...mapNoteListItem(note),
      investorRepaymentSummary: buildInvestorRepaymentSummary(note, orgIdSet),
    }));
    return {
      notes: enrichedNotes,
      pagination: { page: 1, pageSize: notes.length || 1, totalCount: notes.length, totalPages: 1 },
    };
  }

  async getInvestorPortfolio(
    userId: string,
    query: z.infer<typeof investorPortfolioQuerySchema> = {}
  ) {
    const orgIds = await this.resolveInvestorOrgIds(userId, query.investorOrganizationId);
    const investments = await prisma.noteInvestment.findMany({
      where: {
        investor_organization_id: { in: orgIds },
        status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
      },
    });
    const committed = investments.reduce((sum, investment) => sum + toNumber(investment.amount), 0);
    const balanceRows = await prisma.investorBalance.findMany({
      where: { investor_organization_id: { in: orgIds } },
      select: { available_amount: true },
    });
    const availableBalance = balanceRows.reduce(
      (sum, row) => sum + toNumber(row.available_amount),
      0
    );
    const portfolioTotals = buildInvestorPortfolioTotals(availableBalance, committed);
    return {
      ...portfolioTotals,
      investmentCount: investments.length,
    };
  }

  async listInvestorBalanceActivity(
    userId: string,
    query: z.infer<typeof investorBalanceActivityQuerySchema>
  ) {
    const orgIds = await this.resolveInvestorOrgIds(userId, query.investorOrganizationId);
    if (orgIds.length === 0) {
      return {
        entries: [],
        pagination: { page: query.page, pageSize: query.pageSize, totalCount: 0, totalPages: 1 },
        summary: { inTotal: 0, outTotal: 0, netChange: 0, availableBalance: 0 },
        generatedAt: new Date().toISOString(),
      };
    }

    const where = { investor_organization_id: { in: orgIds } };
    const [entries, totalCount, allTransactions, balanceRows] = await Promise.all([
      prisma.investorBalanceTransaction.findMany({
        where,
        orderBy: [{ posted_at: "desc" }, { created_at: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.investorBalanceTransaction.count({ where }),
      prisma.investorBalanceTransaction.findMany({
        where,
        select: { direction: true, amount: true },
      }),
      prisma.investorBalance.findMany({
        where: { investor_organization_id: { in: orgIds } },
        select: { available_amount: true },
      }),
    ]);

    const inTotal = allTransactions
      .filter((row) => row.direction === "IN")
      .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const outTotal = allTransactions
      .filter((row) => row.direction === "OUT")
      .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const availableBalance = balanceRows.reduce(
      (sum, row) => sum + toNumber(row.available_amount),
      0
    );

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        investorOrganizationId: entry.investor_organization_id,
        direction: entry.direction,
        amount: roundNoteMoney(toNumber(entry.amount), 2),
        source: entry.source,
        noteId: entry.note_id,
        noteInvestmentId: entry.note_investment_id,
        idempotencyKey: entry.idempotency_key,
        metadata: asRecord(entry.metadata),
        postedAt: entry.posted_at.toISOString(),
        createdAt: entry.created_at.toISOString(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      },
      summary: {
        inTotal: roundNoteMoney(inTotal, 2),
        outTotal: roundNoteMoney(outTotal, 2),
        netChange: roundNoteMoney(inTotal - outTotal, 2),
        availableBalance: roundNoteMoney(availableBalance, 2),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async exportInvestorBalanceStatement(
    userId: string,
    query: z.infer<typeof investorBalanceStatementQuerySchema>
  ) {
    const orgIds = await this.resolveInvestorOrgIds(userId, query.investorOrganizationId);
    if (orgIds.length === 0) {
      throw new AppError(404, "INVESTOR_ORG_NOT_FOUND", "No investor organization found");
    }

    const organizations = await prisma.investorOrganization.findMany({
      where: { id: { in: orgIds } },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        registration_number: true,
      },
    });

    const accountName =
      organizations.length === 1
        ? organizations[0]?.name?.trim() ||
          [organizations[0]?.first_name, organizations[0]?.last_name].filter(Boolean).join(" ") ||
          "Investor account"
        : "Combined investor accounts";

    const accountId =
      organizations.length === 1
        ? organizations[0]?.registration_number?.trim() || organizations[0]?.id || orgIds[0]!
        : orgIds.join(", ");

    const ledgerRows = await prisma.investorBalanceTransaction.findMany({
      where: { investor_organization_id: { in: orgIds } },
      orderBy: [{ posted_at: "asc" }, { created_at: "asc" }],
    });

    const noteIds = [
      ...new Set(
        ledgerRows
          .map((row) => row.note_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      ),
    ];
    const notes =
      noteIds.length > 0
        ? await prisma.note.findMany({
            where: { id: { in: noteIds } },
            select: { id: true, note_reference: true },
          })
        : [];
    const noteReferenceById = new Map(
      notes.map((note) => [note.id, note.note_reference ?? note.id])
    );

    const entries: StatementLedgerEntry[] = ledgerRows.map((row) => ({
      id: row.id,
      direction: row.direction,
      amount: roundNoteMoney(toNumber(row.amount), 2),
      source: row.source,
      noteId: row.note_id,
      metadata: asRecord(row.metadata),
      postedAt: row.posted_at,
    }));

    const statement = buildInvestorBalanceStatement({
      accountName,
      accountId,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      generatedAt: new Date(),
      entries,
      noteReferenceById,
    });

    const filename = buildStatementFilename(query.startDate, query.endDate, query.format);
    if (query.format === "csv") {
      return {
        buffer: renderStatementCsv(statement),
        contentType: "text/csv; charset=utf-8",
        filename,
      };
    }

    return {
      buffer: await renderStatementPdf(statement),
      contentType: "application/pdf",
      filename,
    };
  }

  async getInvestorPortfolioHistory(
    userId: string,
    query: z.infer<typeof investorPortfolioHistoryQuerySchema>
  ) {
    const granularity = resolveHistoryGranularity(query.range);
    const orgIds = await this.resolveInvestorOrgIds(userId, query.investorOrganizationId);
    if (orgIds.length === 0) {
      return {
        range: query.range,
        granularity,
        points: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const [transactionRows, balanceRows, investments] = await Promise.all([
      prisma.investorBalanceTransaction.findMany({
        where: { investor_organization_id: { in: orgIds } },
        orderBy: { posted_at: "asc" },
        select: { posted_at: true, direction: true, amount: true, source: true, metadata: true },
      }),
      prisma.investorBalance.findMany({
        where: { investor_organization_id: { in: orgIds } },
        select: { available_amount: true },
      }),
      prisma.noteInvestment.findMany({
        where: {
          investor_organization_id: { in: orgIds },
          status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
        },
        select: { amount: true },
      }),
    ]);

    const transactions: InvestorPortfolioHistoryTransaction[] = transactionRows.map((tx) => ({
      posted_at: tx.posted_at,
      direction: tx.direction,
      amount: toNumber(tx.amount),
      source: tx.source,
      metadata: tx.metadata,
    }));
    const availableBalance = balanceRows.reduce(
      (sum, row) => sum + toNumber(row.available_amount),
      0
    );
    const committed = investments.reduce((sum, investment) => sum + toNumber(investment.amount), 0);
    const currentPortfolioTotal = availableBalance + committed;
    if (transactions.length === 0) {
      const points: InvestorPortfolioHistoryPoint[] = [
        toReconciledPortfolioHistoryPoint(
          availableBalance,
          currentPortfolioTotal,
          toDateKey(new Date())
        ),
      ];
      return {
        range: query.range,
        granularity,
        points: finalizeHistoryPoints(points, granularity),
        generatedAt: new Date().toISOString(),
      };
    }

    const signedTransactions = transactions.map(resolveSignedBalanceDelta);
    const netChange = signedTransactions.reduce((sum, amount) => sum + amount, 0);
    const openingBalance = availableBalance - netChange;

    const portfolioDeltaByTransaction = transactions.map(resolvePortfolioDelta);
    const portfolioNetDelta = portfolioDeltaByTransaction.reduce((sum, delta) => sum + delta, 0);
    const openingPortfolioTotal = currentPortfolioTotal - portfolioNetDelta;

    const dailyBalanceNet = new Map<string, number>();
    const dailyPortfolioDelta = new Map<string, number>();
    for (let index = 0; index < transactions.length; index += 1) {
      const key = toDateKey(startOfDay(transactions[index].posted_at));
      dailyBalanceNet.set(key, (dailyBalanceNet.get(key) ?? 0) + signedTransactions[index]);
      dailyPortfolioDelta.set(
        key,
        (dailyPortfolioDelta.get(key) ?? 0) + portfolioDeltaByTransaction[index]
      );
    }

    const firstDate = startOfDay(transactions[0].posted_at);
    const latestDate = startOfDay(transactions[transactions.length - 1].posted_at);
    const today = startOfDay(new Date());
    const displayEndDate = latestDate.getTime() > today.getTime() ? latestDate : today;
    const rangeStartDate = resolveHistoryStartDate(query.range, displayEndDate, firstDate);

    let carryForwardBalance = openingBalance;
    let carryForwardPortfolioTotal = openingPortfolioTotal;
    for (const tx of transactions) {
      if (startOfDay(tx.posted_at).getTime() >= rangeStartDate.getTime()) break;
      carryForwardBalance += resolveSignedBalanceDelta(tx);
      carryForwardPortfolioTotal += resolvePortfolioDelta(tx);
    }

    const points: InvestorPortfolioHistoryPoint[] = [];
    for (
      let cursor = startOfDay(rangeStartDate);
      cursor.getTime() <= displayEndDate.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const key = toDateKey(cursor);
      carryForwardBalance += dailyBalanceNet.get(key) ?? 0;
      carryForwardPortfolioTotal += dailyPortfolioDelta.get(key) ?? 0;
      points.push(
        toReconciledPortfolioHistoryPoint(
          carryForwardBalance,
          carryForwardPortfolioTotal,
          key
        )
      );
    }

    return {
      range: query.range,
      granularity,
      points: finalizeHistoryPoints(points, granularity),
      generatedAt: new Date().toISOString(),
    };
  }

  async testTopUpInvestorBalance(
    actor: ActorContext,
    input: { investorOrganizationId: string; amount: number }
  ) {
    const investorOrg = await prisma.investorOrganization.findFirst({
      where: {
        id: input.investorOrganizationId,
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    });
    if (!investorOrg)
      throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");

    await prisma.$transaction(async (tx) => {
      await tx.investorOrganization.update({
        where: { id: input.investorOrganizationId },
        data: { deposit_received: true },
      });
      const balanceTransaction = await creditInvestorBalance(tx, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
        source: InvestorBalanceTransactionSource.MANUAL_TOPUP,
        idempotencyKey: `investor-balance:topup:${input.investorOrganizationId}:${Date.now()}`,
        metadata: { reason: "test_topup" },
      });
      await postLedgerEntry(tx, {
        accountCode: "INVESTOR_POOL",
        direction: NoteLedgerDirection.CREDIT,
        amount: input.amount,
        description: "Investor test top-up received into investor pool",
        idempotencyKey: `investor-balance-topup:${balanceTransaction.id}`,
        metadata: {
          actorUserId: actor.userId,
          actorPortal: actor.portal ?? "INVESTOR",
          investorOrganizationId: input.investorOrganizationId,
          investorBalanceTransactionId: balanceTransaction.id,
          source: "MANUAL_TOPUP",
        },
      });
    });
    return this.getInvestorPortfolio(actor.userId);
  }

  async listIssuerNotes(userId: string) {
    const orgs = await prisma.issuerOrganization.findMany({
      where: { OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }] },
      select: { id: true },
    });
    const orgIds = orgs.map((org) => org.id);
    const notes = await prisma.note.findMany({
      where: { issuer_organization_id: { in: orgIds } },
      include: noteInclude,
      orderBy: { updated_at: "desc" },
    });
    const noteIds = notes.map((n) => n.id);
    const allWithdrawals =
      noteIds.length === 0
        ? []
        : await prisma.withdrawalInstruction.findMany({
            where: { note_id: { in: noteIds } },
            orderBy: { created_at: "desc" },
          });
    const withdrawalsByNoteId = new Map<string, typeof allWithdrawals>();
    for (const w of allWithdrawals) {
      if (!w.note_id) continue;
      const list = withdrawalsByNoteId.get(w.note_id) ?? [];
      list.push(w);
      withdrawalsByNoteId.set(w.note_id, list);
    }

    return {
      notes: notes.map((note) => ({
        ...mapNoteListItem(note),
        issuerResidualPayout: resolveIssuerResidualPayoutListStatus(
          note,
          withdrawalsByNoteId.get(note.id) ?? []
        ),
      })),
      pagination: { page: 1, pageSize: notes.length || 1, totalCount: notes.length, totalPages: 1 },
    };
  }

  async getIssuerNote(id: string, userId: string) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const allowed = await prisma.issuerOrganization.findFirst({
      where: {
        id: note.issuer_organization_id,
        OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
      },
    });
    if (!allowed) throw new AppError(403, "ISSUER_NOTE_FORBIDDEN", "Issuer note is not accessible");
    const withdrawals = await prisma.withdrawalInstruction.findMany({
      where: { note_id: id },
      orderBy: { created_at: "desc" },
      include: {
        shoraka_trade_order: {
          select: { certificate_s3_key: true },
        },
      },
    });
    return mapNoteDetail(note, { withdrawals, includeEvents: false });
  }

  async getIssuerShorakaCertificateViewUrl(noteId: string, userId: string) {
    const note = await noteRepository.findById(noteId);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const allowed = await prisma.issuerOrganization.findFirst({
      where: {
        id: note.issuer_organization_id,
        OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
      },
    });
    if (!allowed) throw new AppError(403, "ISSUER_NOTE_FORBIDDEN", "Issuer note is not accessible");

    const issuerDisbursementWithdrawal = await prisma.withdrawalInstruction.findFirst({
      where: { note_id: noteId, withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT },
      orderBy: { created_at: "desc" },
      select: { id: true, status: true },
    });

    if (!issuerDisbursementWithdrawal) {
      throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Issuer disbursement withdrawal not found");
    }
    if (issuerDisbursementWithdrawal.status !== WithdrawalStatus.COMPLETED) {
      throw new AppError(
        409,
        "SHORAKA_CERTIFICATE_NOT_READY",
        "Shoraka certificate is not ready yet for this financing"
      );
    }

    const shorakaTradeOrder = await prisma.shorakaTradeOrder.findUnique({
      where: { withdrawal_instruction_id: issuerDisbursementWithdrawal.id },
      select: { certificate_s3_key: true },
    });

    if (!shorakaTradeOrder?.certificate_s3_key) {
      throw new AppError(404, "SHORAKA_CERTIFICATE_NOT_FOUND", "Shoraka certificate not found");
    }

    const { viewUrl, expiresIn } = await generatePresignedViewUrl({ key: shorakaTradeOrder.certificate_s3_key });
    return { viewUrl, expiresIn };
  }

  getPaymentInstructions(id: string) {
    return {
      noteId: id,
      bankName: process.env.REPAYMENT_BANK_NAME ?? "Trustee Bank",
      accountName: process.env.REPAYMENT_ACCOUNT_NAME ?? "CashSouk Repayment Pool",
      accountNumber: process.env.REPAYMENT_ACCOUNT_NUMBER ?? "Pending configuration",
      referenceFormat: `NOTE-${id.slice(-8).toUpperCase()}`,
    };
  }

  async recordPayment(id: string, input: z.infer<typeof recordPaymentSchema>, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);
    assertNoApprovedOrPostedSettlement(note);
    const openReceiptAmount = note.payments
      .filter((payment) => OPEN_PAYMENT_STATUSES.includes(payment.status))
      .reduce((sum, payment) => sum + toNumber(payment.receipt_amount), 0);
    assertReceiptAmountWithinSettlementLimit(note, openReceiptAmount + input.receiptAmount);
    const requiresAdminReview = input.source === "ISSUER_ON_BEHALF" && actor.portal === "ISSUER";
    const paymentPurpose = resolveIssuerPaymentPurpose(input);
    if (requiresAdminReview) {
      if (paymentPurpose === "LATE_FEES") {
        throw new AppError(
          422,
          "ISSUER_LATE_FEE_PAYMENT_NOT_ALLOWED",
          "Late fees are deducted from repayment proceeds and cannot be paid separately by the issuer"
        );
      } else {
        const settlementAmount = resolveNoteSettlementAmount(note);
        if (settlementAmount <= 0) {
          throw new AppError(
            409,
            "NOTE_AMOUNT_UNRESOLVED",
            "Payment cannot be submitted before the invoice amount is resolved"
          );
        }
      }
    }
    const status = requiresAdminReview ? NotePaymentStatus.PENDING : NotePaymentStatus.RECEIVED;
    const eventType = requiresAdminReview ? "ISSUER_PAYMENT_SUBMITTED" : "PAYMENT_RECEIVED";
    const paymentMetadata =
      input.metadata ?? (requiresAdminReview ? { paymentPurpose } : undefined);
    const { updatedNote, paymentId } = await prisma.$transaction(async (tx) => {
      const payment = await tx.notePayment.create({
        data: {
          note_id: id,
          schedule_id: input.scheduleId ?? null,
          source: input.source,
          status,
          receipt_amount: money(input.receiptAmount),
          receipt_date: new Date(input.receiptDate),
          evidence_s3_key: input.evidenceS3Key ?? null,
          reference: input.reference ?? null,
          recorded_by_user_id: actor.userId,
          metadata: json(paymentMetadata),
        },
      });
      if (status === NotePaymentStatus.RECEIVED) {
        await this.postPaymentReceiptLedger(tx, payment, actor);
      }
      await this.logEvent(tx, id, eventType, actor, json({ ...input, metadata: paymentMetadata }));
      const refreshed = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      return { updatedNote: refreshed, paymentId: payment.id };
    });
    if (status === NotePaymentStatus.RECEIVED) {
      await notifyNotePaymentReceived({
        notificationService: this.notificationService,
        noteId: id,
        noteTitle: resolveNoteNotificationTitle(updatedNote),
        paymentId,
      });
    }
    return mapNoteDetail(updatedNote);
  }

  async approvePayment(id: string, paymentId: string, actor: ActorContext) {
    const payment = await prisma.notePayment.findUnique({
      where: { id: paymentId },
      include: {
        note: {
          include: {
            payments: {
              select: { status: true, receipt_amount: true },
            },
            settlements: {
              orderBy: { created_at: "desc" },
              select: { status: true, tawidh_amount: true, gharamah_amount: true },
            },
          },
        },
      },
    });
    if (!payment || payment.note_id !== id) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    assertNoteReadyForServicing(payment.note);
    assertNoApprovedOrPostedSettlement(payment.note);
    assertOpenReceiptsWithinSettlementLimit(payment.note);
    if (payment.status !== NotePaymentStatus.PENDING) {
      throw new AppError(409, "PAYMENT_NOT_PENDING", "Only pending payments can be approved");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.notePayment.update({
        where: { id: paymentId },
        data: {
          status: NotePaymentStatus.RECEIVED,
          reconciled_by_user_id: actor.userId,
          reconciled_at: new Date(),
        },
      });
      await this.postPaymentReceiptLedger(tx, updatedPayment, actor);
      await this.logEvent(tx, id, "PAYMENT_APPROVED", actor, { paymentId });
      return tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
    });
    await notifyNotePaymentReceived({
      notificationService: this.notificationService,
      noteId: id,
      noteTitle: resolveNoteNotificationTitle(updated),
      paymentId,
    });
    return mapNoteDetail(updated);
  }

  async rejectPayment(
    id: string,
    paymentId: string,
    input: z.infer<typeof paymentReviewSchema>,
    actor: ActorContext
  ) {
    const payment = await prisma.notePayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.note_id !== id) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    if (payment.status !== NotePaymentStatus.PENDING) {
      throw new AppError(409, "PAYMENT_NOT_PENDING", "Only pending payments can be rejected");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.notePayment.update({
        where: { id: paymentId },
        data: {
          status: NotePaymentStatus.VOID,
          reconciled_by_user_id: actor.userId,
          reconciled_at: new Date(),
          metadata: {
            ...(asRecord(payment.metadata) ?? {}),
            rejectionReason: input.reason ?? null,
          },
        },
      });
      await this.logEvent(tx, id, "PAYMENT_REJECTED", actor, {
        paymentId,
        reason: input.reason ?? null,
      });
      return tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
    });
    return mapNoteDetail(updated);
  }

  async previewSettlement(
    id: string,
    input: z.infer<typeof settlementPreviewSchema>,
    actor: ActorContext
  ) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);
    assertNoPendingPaymentsForSettlement(note);
    const lockedSettlement = note.settlements.find(
      (settlement) =>
        settlement.status === NoteSettlementStatus.APPROVED ||
        settlement.status === NoteSettlementStatus.POSTED
    );
    if (lockedSettlement) {
      throw new AppError(
        409,
        "SETTLEMENT_LOCKED",
        "Settlement has already been approved or posted and cannot be previewed again"
      );
    }
    const eligiblePayments = note.payments.filter(
      (candidate) =>
        candidate.status === NotePaymentStatus.RECEIVED ||
        candidate.status === NotePaymentStatus.RECONCILED ||
        candidate.status === NotePaymentStatus.PARTIAL
    );
    const aggregateReceiptAmount = eligiblePayments.reduce(
      (sum, payment) => sum + toNumber(payment.receipt_amount),
      0
    );
    const grossReceipt = input.receiptAmount ?? aggregateReceiptAmount;
    if (grossReceipt <= 0)
      throw new AppError(422, "SETTLEMENT_RECEIPT_REQUIRED", "Receipt amount is required");
    assertReceiptAmountWithinSettlementLimit(note, grossReceipt);
    const previewTawidhAmount = input.tawidhAmount ?? 0;
    const previewGharamahAmount = input.gharamahAmount ?? 0;
    if (previewTawidhAmount + previewGharamahAmount > 0.005) {
      resolvePendingReceiptLateFeeAmount(note, {
        receiptDate: input.receiptDate ?? new Date().toISOString(),
        pendingTawidhAmount: previewTawidhAmount,
        pendingGharamahAmount: previewGharamahAmount,
      });
    }
    const includedPaymentIds = eligiblePayments.map((payment) => payment.id);
    const linkedPaymentId =
      input.paymentId && eligiblePayments.some((payment) => payment.id === input.paymentId)
        ? input.paymentId
        : eligiblePayments.length === 1
          ? eligiblePayments[0].id
          : null;

    if (!note.activated_at) {
      throw new AppError(
        409,
        "NOTE_ACTIVATION_DATE_REQUIRED",
        "Settlement profit cannot be calculated before the issuer disbursement has been completed"
      );
    }
    const profitMaturityDate = resolveProfitMaturityDate(note);
    if (!profitMaturityDate) {
      throw new AppError(
        422,
        "NOTE_MATURITY_DATE_REQUIRED",
        "Settlement profit cannot be calculated before the note maturity date is set"
      );
    }
    const profitRatePercent = toNumber(note.profit_rate_percent);
    if (profitRatePercent <= 0) {
      throw new AppError(
        422,
        "NOTE_PROFIT_RATE_REQUIRED",
        "Settlement profit cannot be calculated before a positive note profit rate is set"
      );
    }

    const waterfall = calculateSettlementWaterfall({
      grossReceiptAmount: grossReceipt,
      fundedPrincipal: toNumber(note.funded_amount),
      profitRatePercent,
      profitStartDate: note.activated_at,
      profitMaturityDate,
      serviceFeeRatePercent: toNumber(note.service_fee_rate_percent),
      tawidhAmount: previewTawidhAmount,
      tawidhInvestorSharePercent: input.tawidhInvestorSharePercent ?? 0,
      gharamahAmount: previewGharamahAmount,
    });
    if (
      previewTawidhAmount + previewGharamahAmount >
      waterfall.availableLateFeeHeadroomAmount + 0.005
    ) {
      throw new AppError(
        422,
        "SETTLEMENT_LATE_FEE_HEADROOM_EXCEEDED",
        "Late fees exceed the repayment headroom available after investor principal and contractual profit"
      );
    }
    if (waterfall.settlementShortfallAmount > 0.005) {
      throw new AppError(
        422,
        "SETTLEMENT_WATERFALL_SHORTFALL",
        "Settlement receipt is not enough to cover investor principal, contractual profit, and approved late charges"
      );
    }

    const confirmedInvestments = resolveConfirmedSettlementInvestments(note.investments);
    const eligiblePrincipal = confirmedInvestments.reduce(
      (sum, investment) => sum + toNumber(investment.amount),
      0
    );
    assertConfirmedInvestmentPrincipalMatchesWaterfall(
      eligiblePrincipal,
      waterfall.investorPrincipal
    );
    const allocations = buildSettlementAllocations({
      investments: confirmedInvestments.map((investment) => ({
        id: investment.id,
        investorOrganizationId: investment.investor_organization_id,
        amount: toNumber(investment.amount),
      })),
      investorPrincipal: waterfall.investorPrincipal,
      investorProfitNet: waterfall.investorProfitNet,
      tawidhInvestorAmount: waterfall.tawidhInvestorAmount,
    });

    const snapshot = {
      ...waterfall,
      profitStartDate: waterfall.profitStartDate.toISOString(),
      profitMaturityDate: waterfall.profitMaturityDate.toISOString(),
      includedPaymentIds,
      allocations,
    };

    const settlement = await prisma.$transaction(async (tx) => {
      await tx.noteSettlement.updateMany({
        where: { note_id: id, status: NoteSettlementStatus.PREVIEW },
        data: { status: NoteSettlementStatus.VOID },
      });
      return tx.noteSettlement.create({
        data: {
          note_id: id,
          payment_id: linkedPaymentId,
          gross_receipt_amount: money(waterfall.grossReceiptAmount),
          investor_principal: money(waterfall.investorPrincipal),
          profit_start_date: waterfall.profitStartDate,
          profit_maturity_date: waterfall.profitMaturityDate,
          profit_days: waterfall.profitDays,
          annual_profit_rate_percent: money(waterfall.annualProfitRatePercent),
          investor_profit_gross: money(waterfall.investorProfitGross),
          service_fee_amount: money(waterfall.serviceFeeAmount),
          investor_profit_net: money(waterfall.investorProfitNet),
          tawidh_amount: money(waterfall.tawidhAmount),
          tawidh_investor_share_percent: money(waterfall.tawidhInvestorSharePercent),
          tawidh_investor_amount: money(waterfall.tawidhInvestorAmount),
          tawidh_account_amount: money(waterfall.tawidhAccountAmount),
          gharamah_amount: money(waterfall.gharamahAmount),
          issuer_residual_amount: money(waterfall.issuerResidualAmount),
          unapplied_amount: money(waterfall.unappliedAmount),
          settlement_type:
            waterfall.tawidhAmount > 0 || waterfall.gharamahAmount > 0
              ? NoteSettlementType.LATE
              : NoteSettlementType.STANDARD,
          preview_snapshot: snapshot,
        },
      });
    });
    await prisma.noteEvent.create({
      data: {
        note_id: id,
        event_type: "SETTLEMENT_PREVIEWED",
        actor_user_id: actor.userId,
        actor_role: actor.role,
        portal: actor.portal,
        correlation_id: actor.correlationId,
        metadata: { settlementId: settlement.id, ...snapshot },
      },
    });
    return { settlementId: settlement.id, ...snapshot };
  }

  async approveSettlement(id: string, settlementId: string, actor: ActorContext) {
    const settlement = await prisma.noteSettlement.findUnique({
      where: { id: settlementId },
      include: {
        note: {
          include: {
            payments: {
              select: { status: true, receipt_amount: true },
            },
            settlements: {
              orderBy: { created_at: "desc" },
              select: { status: true, tawidh_amount: true, gharamah_amount: true },
            },
          },
        },
      },
    });
    if (!settlement || settlement.note_id !== id) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    assertNoteReadyForServicing(settlement.note);
    assertNoPendingPaymentsForSettlement(settlement.note);
    assertOpenReceiptsWithinSettlementLimit(settlement.note);
    if (settlement.status !== NoteSettlementStatus.PREVIEW) {
      throw new AppError(409, "SETTLEMENT_NOT_PREVIEW", "Only preview settlements can be approved");
    }
    assertSettlementAmountComplete(settlement);
    assertSettlementWaterfallBalanced(settlement);
    await assertRepaymentReceiptLedgerComplete(
      settlement.note_id,
      toNumber(settlement.gross_receipt_amount)
    );

    const confirmedForApproval = await prisma.noteInvestment.findMany({
      where: { note_id: id, status: NoteInvestmentStatus.CONFIRMED },
      select: { id: true, investor_organization_id: true, amount: true },
    });
    assertSettlementAllocationsFundable(settlement, confirmedForApproval);
    const approvalAllocations = buildAllocationsForSettlementRecord(
      settlement,
      confirmedForApproval
    );
    const approvalSnapshot = mergeAllocationsIntoPreviewSnapshot(
      settlement.preview_snapshot,
      approvalAllocations
    );

    await prisma.noteSettlement.update({
      where: { id: settlementId },
      data: {
        status: NoteSettlementStatus.APPROVED,
        approved_by_user_id: actor.userId,
        approved_at: new Date(),
        preview_snapshot: json(approvalSnapshot),
      },
    });
    await this.logEvent(prisma, id, "SETTLEMENT_APPROVED", actor, { settlementId });
    return this.getAdminNoteDetail(id);
  }

  async postSettlement(id: string, settlementId: string, actor: ActorContext) {
    const settlement = await prisma.noteSettlement.findUnique({
      where: { id: settlementId },
      include: {
        note: {
          include: {
            payments: {
              select: { status: true, receipt_amount: true },
            },
            settlements: {
              orderBy: { created_at: "desc" },
              select: { status: true, tawidh_amount: true, gharamah_amount: true },
            },
          },
        },
      },
    });
    if (!settlement || settlement.note_id !== id) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    assertNoteReadyForServicing(settlement.note);
    assertNoPendingPaymentsForSettlement(settlement.note);
    assertOpenReceiptsWithinSettlementLimit(settlement.note);
    if (settlement.status !== NoteSettlementStatus.APPROVED) {
      throw new AppError(
        409,
        "SETTLEMENT_NOT_APPROVED",
        "Settlement must be approved before posting"
      );
    }
    assertSettlementAmountComplete(settlement);
    assertSettlementWaterfallBalanced(settlement);
    await assertRepaymentReceiptLedgerComplete(
      settlement.note_id,
      toNumber(settlement.gross_receipt_amount)
    );

    const residualAmount = toNumber(settlement.issuer_residual_amount);
    const hasResidual = residualAmount > 0.005;
    const issuerOrg = hasResidual
      ? await prisma.issuerOrganization.findUnique({
          where: { id: settlement.note.issuer_organization_id },
          select: { id: true, name: true, bank_account_details: true },
        })
      : null;

    const repaidInvestorSnapshot = await prisma.noteInvestment.findMany({
      where: { note_id: id, status: NoteInvestmentStatus.CONFIRMED },
      select: { investor_organization_id: true },
      distinct: ["investor_organization_id"],
    });
    const repaidInvestorOrgIds = repaidInvestorSnapshot.map((row) => row.investor_organization_id);

    await prisma.$transaction(async (tx) => {
      const confirmedForPost = await tx.noteInvestment.findMany({
        where: { note_id: id, status: NoteInvestmentStatus.CONFIRMED },
        select: { id: true, investor_organization_id: true, amount: true },
      });
      assertSettlementAllocationsFundable(settlement, confirmedForPost);
      const settlementAllocations = buildAllocationsForSettlementRecord(
        settlement,
        confirmedForPost
      );
      const postedSnapshot = mergeAllocationsIntoPreviewSnapshot(
        settlement.preview_snapshot,
        settlementAllocations
      );

      await this.postSettlementLedger(tx, settlement, actor);
      await tx.noteSettlement.update({
        where: { id: settlementId },
        data: {
          status: NoteSettlementStatus.POSTED,
          posted_at: new Date(),
          idempotency_key: `settlement:${settlementId}`,
          preview_snapshot: json(postedSnapshot),
          ...(toNumber(settlement.service_fee_amount) > 0.005
            ? { service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.PENDING_LETTER }
            : {}),
        },
      });
      for (const allocation of settlementAllocations) {
        const releasedAmount =
          allocation.principal + allocation.profitNet + allocation.tawidhInvestorShare;
        if (releasedAmount <= 0) continue;
        await creditInvestorBalance(tx, {
          investorOrganizationId: allocation.investorOrganizationId,
          amount: releasedAmount,
          source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE,
          noteId: id,
          noteInvestmentId: allocation.investmentId,
          idempotencyKey: `investor-balance:release:settlement:${settlementId}:${allocation.investmentId}`,
          metadata: {
            releaseReason: "SETTLEMENT_PAYOUT",
            settlementId,
            principal: allocation.principal,
            profitNet: allocation.profitNet,
            tawidhInvestorShare: allocation.tawidhInvestorShare,
          },
        });
      }
      await tx.noteInvestment.updateMany({
        where: {
          note_id: id,
          status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
        },
        data: { status: NoteInvestmentStatus.SETTLED },
      });
      await tx.notePayment.updateMany({
        where: {
          note_id: id,
          status: {
            in: [
              NotePaymentStatus.RECEIVED,
              NotePaymentStatus.RECONCILED,
              NotePaymentStatus.PARTIAL,
            ],
          },
        },
        data: { status: NotePaymentStatus.SETTLED },
      });

      if (hasResidual) {
        const existingResidualWithdrawal = await tx.withdrawalInstruction.findFirst({
          where: {
            settlement_id: settlementId,
            withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
          },
        });
        if (!existingResidualWithdrawal) {
          await tx.withdrawalInstruction.create({
            data: {
              note_id: id,
              settlement_id: settlementId,
              issuer_organization_id: settlement.note.issuer_organization_id,
              requested_by_user_id: actor.userId,
              withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
              amount: money(residualAmount),
              beneficiary_snapshot: buildBeneficiarySnapshot(issuerOrg) as Prisma.InputJsonValue,
              metadata: {
                autoCreatedAt: new Date().toISOString(),
                autoCreatedBy: actor.userId,
                issuerOrganizationName: issuerOrg?.name ?? null,
                source: "POST_SETTLEMENT",
              } as Prisma.InputJsonValue,
            },
          });
          await this.logEvent(tx, id, "ISSUER_RESIDUAL_WITHDRAWAL_CREATED", actor, {
            settlementId,
            amount: residualAmount,
          });
        }
        await tx.note.update({
          where: { id },
          data: {
            servicing_status: NoteServicingStatus.CURRENT,
          },
        });
      } else {
        await tx.note.update({
          where: { id },
          data: {
            status: NoteStatus.REPAID,
            servicing_status: NoteServicingStatus.SETTLED,
            repaid_at: new Date(),
          },
        });
      }

      await this.logEvent(tx, id, "SETTLEMENT_POSTED", actor, {
        settlementId,
        investorPayoutCount: settlementAllocations.length,
        residualAmount,
        residualWithdrawalCreated: hasResidual,
      });
    });
    await notifyNoteSettlementPosted({
      notificationService: this.notificationService,
      noteId: id,
      noteTitle: resolveNoteNotificationTitle(settlement.note),
      settlementId,
      investorOrganizationIds: repaidInvestorOrgIds,
    });
    if (!hasResidual) {
      await notifyNoteIssuerRepaid({
        notificationService: this.notificationService,
        noteId: id,
        issuerOrganizationId: settlement.note.issuer_organization_id,
        noteTitle: resolveNoteNotificationTitle(settlement.note),
      });
    }
    return this.getAdminNoteDetail(id);
  }

  async calculateLateCharge(input: z.infer<typeof lateChargeSchema>) {
    const settings = await this.getPlatformFinanceSettings();
    return calculateLateChargeValues({
      receiptAmount: input.receiptAmount,
      dueDate: new Date(input.dueDate),
      receiptDate: new Date(input.receiptDate),
      gracePeriodDays: settings.gracePeriodDays,
      tawidhRateCapPercent: settings.tawidhRateCapPercent,
      gharamahRateCapPercent: settings.gharamahRateCapPercent,
      tawidhAmount: input.tawidhAmount,
      gharamahAmount: input.gharamahAmount,
    });
  }

  async checkOverdueLateCharge(id: string, input: z.infer<typeof overdueLateChargeSchema>) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);
    assertNoPostedSettlement(note);

    const dueDate = resolveFirstPaymentDueDate(note);
    const checkDate = input.receiptDate ? new Date(input.receiptDate) : new Date();
    const invoiceSettlementAmount = resolveNoteSettlementAmount(note);
    const receiptAmount = input.receiptAmount ?? invoiceSettlementAmount;

    if (!dueDate) {
      return {
        overdue: false,
        dueDate: null,
        checkDate: checkDate.toISOString(),
        gracePeriodDays: note.grace_period_days,
        daysLate: 0,
        receiptAmount,
        totalTawidhCap: 0,
        totalGharamahCap: 0,
        appliedTawidhAmount: 0,
        appliedGharamahAmount: 0,
        remainingTawidhAmount: 0,
        remainingGharamahAmount: 0,
        availableLateFeeHeadroomAmount: null,
        suggestedTawidhAmount: 0,
        suggestedGharamahAmount: 0,
        message: "No due date is available for this note.",
      };
    }

    const total = calculateLateChargeValues({
      receiptAmount: invoiceSettlementAmount,
      dueDate,
      receiptDate: checkDate,
      gracePeriodDays: note.grace_period_days,
      tawidhRateCapPercent: toNumber(note.tawidh_rate_cap_percent),
      gharamahRateCapPercent: toNumber(note.gharamah_rate_cap_percent),
    });

    const appliedSettlements = note.settlements.filter(
      (settlement) =>
        settlement.status === NoteSettlementStatus.APPROVED ||
        settlement.status === NoteSettlementStatus.POSTED
    );
    const appliedTawidhAmount = appliedSettlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.tawidh_amount),
      0
    );
    const appliedGharamahAmount = appliedSettlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.gharamah_amount),
      0
    );
    const remainingTawidhAmount = Math.max(0, total.tawidhCap - appliedTawidhAmount);
    const remainingGharamahAmount = Math.max(0, total.gharamahCap - appliedGharamahAmount);
    const overdue = total.daysLate > 0;
    const availableLateFeeHeadroomAmount = resolveAvailableLateFeeHeadroomForNote(
      note,
      invoiceSettlementAmount
    );
    const cappedSuggestions = capLateFeeSuggestionsByHeadroom({
      remainingTawidhAmount: overdue ? remainingTawidhAmount : 0,
      remainingGharamahAmount: overdue ? remainingGharamahAmount : 0,
      availableLateFeeHeadroomAmount,
    });
    const suggestedTawidhAmount = overdue ? cappedSuggestions.suggestedTawidhAmount : 0;
    const suggestedGharamahAmount = overdue ? cappedSuggestions.suggestedGharamahAmount : 0;
    const headroomLimitedSuggestions =
      overdue &&
      availableLateFeeHeadroomAmount != null &&
      suggestedTawidhAmount + suggestedGharamahAmount + 0.005 <
        remainingTawidhAmount + remainingGharamahAmount;

    return {
      overdue,
      dueDate: dueDate.toISOString(),
      checkDate: checkDate.toISOString(),
      gracePeriodDays: note.grace_period_days,
      daysLate: total.daysLate,
      receiptAmount,
      totalTawidhCap: total.tawidhCap,
      totalGharamahCap: total.gharamahCap,
      appliedTawidhAmount,
      appliedGharamahAmount,
      remainingTawidhAmount,
      remainingGharamahAmount,
      availableLateFeeHeadroomAmount,
      suggestedTawidhAmount,
      suggestedGharamahAmount,
      message: !overdue
        ? "Payment is not overdue after the grace period."
        : remainingTawidhAmount <= 0 && remainingGharamahAmount <= 0
          ? "This payment is overdue, but all allowable late fees have already been applied."
          : availableLateFeeHeadroomAmount != null && availableLateFeeHeadroomAmount <= 0.005
            ? "This payment is overdue, but no late fees can be charged because the invoice settlement pool has no headroom after investor principal and contractual profit."
            : headroomLimitedSuggestions
              ? "Payment is overdue. Suggested late fees are capped by settlement headroom after investor principal and contractual profit."
              : "Payment is overdue. Suggested late fees exclude previously approved or posted late fees.",
    };
  }

  async applyOverdueLateCharge(
    id: string,
    input: z.infer<typeof overdueLateChargeSchema>,
    actor: ActorContext
  ) {
    const result = await this.checkOverdueLateCharge(id, input);
    let enteredArrears = false;
    if (result.overdue && result.dueDate) {
      const note = await noteRepository.findById(id);
      if (note) {
        const dueDate = new Date(result.dueDate);
        const checkDate = new Date(result.checkDate);
        const daysPastDue = Math.max(0, calculateCalendarDayCount(dueDate, checkDate));
        const daysAfterGrace = Math.max(0, daysPastDue - note.grace_period_days);
        const isArrears = daysAfterGrace >= note.arrears_threshold_days;
        const nextServicingStatus = isArrears
          ? NoteServicingStatus.ARREARS
          : NoteServicingStatus.LATE;
        if (note.servicing_status !== nextServicingStatus) {
          await noteRepository.updateState(id, {
            status: isArrears ? NoteStatus.ARREARS : note.status,
            servicing_status: nextServicingStatus,
            arrears_started_at: isArrears && !note.arrears_started_at ? new Date() : undefined,
          });
          enteredArrears = isArrears;
        }
      }
    }
    await this.logEvent(prisma, id, "OVERDUE_LATE_CHARGE_CHECKED", actor, result);
    if (enteredArrears) {
      const refreshed = await noteRepository.findById(id);
      if (refreshed) {
        await notifyNoteArrears({
          notificationService: this.notificationService,
          noteId: id,
          issuerOrganizationId: refreshed.issuer_organization_id,
          noteTitle: resolveNoteNotificationTitle(refreshed),
        });
      }
    }
    return result;
  }

  async approveLateCharge(
    id: string,
    input: z.infer<typeof lateChargeSchema>,
    actor: ActorContext
  ) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);
    assertNoPostedSettlement(note);
    const result = await this.calculateLateCharge(input);
    await this.logEvent(prisma, id, "LATE_CHARGE_APPROVED", actor, result);
    return result;
  }

  async generateNoteLetter(id: string, type: "arrears" | "default", actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const title = type === "arrears" ? "Arrears Warning Letter" : "Default Notice Letter";
    const buffer = await renderPdfBuffer(title, [
      ["Note reference", note.note_reference],
      ["Issuer", mapNoteListItem(note).issuerName ?? "-"],
      ["Paymaster", mapNoteListItem(note).paymasterName ?? "-"],
      ["Outstanding funded amount", toNumber(note.funded_amount).toFixed(2)],
      ["Generated at", new Date().toISOString()],
    ]);
    const key = `note-letters/${id}/${type}-${Date.now()}.pdf`;
    await putS3ObjectBuffer({ key, body: buffer, contentType: "application/pdf" });
    await this.logEvent(prisma, id, `${type.toUpperCase()}_LETTER_GENERATED`, actor, {
      s3Key: key,
    });
    return { s3Key: key };
  }

  async generateServiceFeeTrusteeLetter(
    noteId: string,
    settlementId: string,
    actor: ActorContext
  ): Promise<{ s3Key: string }> {
    const settlement = await prisma.noteSettlement.findFirst({
      where: { id: settlementId, note_id: noteId },
    });
    if (!settlement) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    if (settlement.status !== NoteSettlementStatus.POSTED) {
      throw new AppError(
        409,
        "SETTLEMENT_NOT_POSTED",
        "Service fee trustee letter can only be generated after settlement is posted."
      );
    }

    const investorRepayment =
      toNumber(settlement.investor_principal) + toNumber(settlement.investor_profit_net);
    const feeAmount = toNumber(settlement.service_fee_amount);
    const tawidhAmount = toNumber(settlement.tawidh_account_amount);
    const gharamahAmount = toNumber(settlement.gharamah_amount);
    const issuerResidual = toNumber(settlement.issuer_residual_amount);
    const hasTrusteeContent =
      investorRepayment > 0.005 ||
      feeAmount > 0.005 ||
      tawidhAmount > 0.005 ||
      gharamahAmount > 0.005 ||
      issuerResidual > 0.005;

    if (!hasTrusteeContent) {
      throw new AppError(
        409,
        "NO_SETTLEMENT_TRUSTEE_CONTENT",
        "This settlement has no trustee instruction amounts to document."
      );
    }

    const wfStatus = settlement.service_fee_trustee_status;
    if (
      wfStatus === ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE ||
      wfStatus === ServiceFeeTrusteeInstructionStatus.COMPLETED
    ) {
      throw new AppError(
        409,
        "SERVICE_FEE_TRUSTEE_LETTER_LOCKED",
        "The instruction has already been submitted to the trustee and cannot be regenerated."
      );
    }
    const note = await noteRepository.findById(noteId);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const listItem = mapNoteListItem(note);

    const payment = settlement.payment_id
      ? await prisma.notePayment.findFirst({
          where: { id: settlement.payment_id, note_id: noteId },
        })
      : null;

    const payerName =
      listItem.paymasterName ??
      listItem.issuerName ??
      (typeof payment?.reference === "string" ? payment.reference : null);

    const receiptAmount = payment ? toNumber(payment.receipt_amount) : toNumber(settlement.gross_receipt_amount);
    const receiptDate = payment?.receipt_date ?? settlement.posted_at ?? new Date();

    const issuerOrg = note.issuer_organization_id
      ? await prisma.issuerOrganization.findUnique({
          where: { id: note.issuer_organization_id },
          select: { id: true, name: true, bank_account_details: true },
        })
      : null;

    let borrowerEntries = buildRepaymentBorrowerEntries({
      payerName,
      receiptAmount,
      receiptDate,
    });
    if (borrowerEntries.length === 0 && listItem.issuerName) {
      borrowerEntries = buildRepaymentBorrowerEntries({
        payerName: listItem.issuerName,
        receiptAmount,
        receiptDate,
      });
    }

    const settings = await this.getPlatformFinanceSettings();
    const trusteeConfig = loadTrusteeLetterConfig(settings);
    const signatureImage = await this.resolveTrusteeSignatureImageBuffer(
      trusteeConfig.letterConfig
    );
    const repaymentAccountName =
      payment?.received_into_account_code?.replace(/_/g, " ") ?? "Repayment Pool";

    const letterData = {
      ...mapRepaymentLetterData({
        settlementId: settlement.id,
        investorPrincipal: toNumber(settlement.investor_principal),
        investorProfitNet: toNumber(settlement.investor_profit_net),
        serviceFeeAmount: feeAmount,
        tawidhAccountAmount: tawidhAmount,
        gharamahAmount,
        issuerResidualAmount: issuerResidual,
        issuerBeneficiarySnapshot: issuerOrg ? buildBeneficiarySnapshot(issuerOrg) : null,
        issuerOrganizationName: issuerOrg?.name ?? null,
        borrowerEntries,
        repaymentAccountName,
        config: trusteeConfig,
        referenceDate: settlement.posted_at ?? new Date(),
      }),
      authorisedSignatureImage: signatureImage ?? undefined,
    };

    const buffer = await renderTrusteeLetterPdf(letterData);
    const key = `note-letters/${noteId}/service-fee-trustee/${settlementId}-${Date.now()}.pdf`;
    await putS3ObjectBuffer({ key, body: buffer, contentType: "application/pdf" });
    await prisma.$transaction(async (tx) => {
      const row = await tx.noteSettlement.updateMany({
        where: {
          id: settlementId,
          note_id: noteId,
          OR: [
            { service_fee_trustee_status: null },
            {
              service_fee_trustee_status: {
                notIn: [
                  ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
                  ServiceFeeTrusteeInstructionStatus.COMPLETED,
                ],
              },
            },
          ],
        },
        data: { service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED },
      });
      if (row.count !== 1) {
        throw new AppError(
          409,
          "SERVICE_FEE_TRUSTEE_LETTER_LOCKED",
          "The instruction has already been submitted to the trustee and cannot be regenerated."
        );
      }
      await this.logEvent(tx, noteId, "SERVICE_FEE_TRUSTEE_LETTER_GENERATED", actor, {
        s3Key: key,
        settlementId: settlement.id,
      });
    });
    return { s3Key: key };
  }

  async markServiceFeeTrusteeLetterSubmitted(
    noteId: string,
    settlementId: string,
    actor: ActorContext
  ) {
    const settlement = await prisma.noteSettlement.findFirst({
      where: { id: settlementId, note_id: noteId },
    });
    if (!settlement) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    if (settlement.status !== NoteSettlementStatus.POSTED) {
      throw new AppError(
        409,
        "SETTLEMENT_NOT_POSTED",
        "Only posted settlements can move the service fee trustee workflow forward."
      );
    }
    const investorRepayment =
      toNumber(settlement.investor_principal) + toNumber(settlement.investor_profit_net);
    const hasTrusteeContent =
      investorRepayment > 0.005 ||
      toNumber(settlement.service_fee_amount) > 0.005 ||
      toNumber(settlement.tawidh_account_amount) > 0.005 ||
      toNumber(settlement.gharamah_amount) > 0.005 ||
      toNumber(settlement.issuer_residual_amount) > 0.005;
    if (!hasTrusteeContent) {
      throw new AppError(
        409,
        "NO_SETTLEMENT_TRUSTEE_CONTENT",
        "This settlement has no trustee instruction to submit."
      );
    }
    const st = settlement.service_fee_trustee_status;
    if (st !== ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED) {
      throw new AppError(
        409,
        "SERVICE_FEE_TRUSTEE_LETTER_REQUIRED",
        "Generate the trustee instruction PDF before marking it submitted."
      );
    }

    // TODO: future enhancement — send trustee instruction email with generated PDF attachment before marking as submitted.

    await prisma.$transaction(async (tx) => {
      const row = await tx.noteSettlement.updateMany({
        where: {
          id: settlementId,
          note_id: noteId,
          service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED,
        },
        data: {
          service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
          service_fee_trustee_submitted_at: new Date(),
        },
      });
      if (row.count !== 1) {
        throw new AppError(
          409,
          "SERVICE_FEE_TRUSTEE_LETTER_REQUIRED",
          "Generate the trustee instruction PDF before marking it submitted."
        );
      }
      await this.logEvent(tx, noteId, "SERVICE_FEE_TRUSTEE_LETTER_SUBMITTED", actor, {
        settlementId,
      });
    });

    return this.getAdminNoteDetail(noteId);
  }

  async markServiceFeeTrusteeInstructionCompleted(
    noteId: string,
    settlementId: string,
    actor: ActorContext
  ) {
    const settlement = await prisma.noteSettlement.findFirst({
      where: { id: settlementId, note_id: noteId },
    });
    if (!settlement) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    if (settlement.status !== NoteSettlementStatus.POSTED) {
      throw new AppError(
        409,
        "SETTLEMENT_NOT_POSTED",
        "Only posted settlements can complete the service fee trustee workflow."
      );
    }
    const investorRepaymentComplete =
      toNumber(settlement.investor_principal) + toNumber(settlement.investor_profit_net);
    const hasTrusteeContentComplete =
      investorRepaymentComplete > 0.005 ||
      toNumber(settlement.service_fee_amount) > 0.005 ||
      toNumber(settlement.tawidh_account_amount) > 0.005 ||
      toNumber(settlement.gharamah_amount) > 0.005 ||
      toNumber(settlement.issuer_residual_amount) > 0.005;
    if (!hasTrusteeContentComplete) {
      throw new AppError(
        409,
        "NO_SETTLEMENT_TRUSTEE_CONTENT",
        "This settlement has no trustee instruction to complete."
      );
    }
    if (
      settlement.service_fee_trustee_status !==
      ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE
    ) {
      throw new AppError(
        409,
        "SERVICE_FEE_TRUSTEE_NOT_SUBMITTED",
        "Mark the instruction submitted to the trustee before completing it."
      );
    }

    const completedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const row = await tx.noteSettlement.updateMany({
        where: {
          id: settlementId,
          note_id: noteId,
          service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
        },
        data: {
          service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.COMPLETED,
          service_fee_trustee_completed_at: completedAt,
        },
      });
      if (row.count !== 1) {
        throw new AppError(
          409,
          "SERVICE_FEE_TRUSTEE_NOT_SUBMITTED",
          "Mark the instruction submitted to the trustee before completing it."
        );
      }
      await this.logEvent(tx, noteId, "SERVICE_FEE_TRUSTEE_INSTRUCTION_COMPLETED", actor, {
        settlementId,
        completedAt: completedAt.toISOString(),
      });
    });

    return this.getAdminNoteDetail(noteId);
  }

  async markDefault(id: string, reason: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.servicing_status !== NoteServicingStatus.ARREARS) {
      throw new AppError(
        409,
        "NOTE_NOT_IN_ARREARS",
        "Default can only be marked while note is in arrears"
      );
    }
    const updated = await noteRepository.updateState(id, {
      status: NoteStatus.DEFAULTED,
      servicing_status: NoteServicingStatus.DEFAULTED,
      default_marked_at: new Date(),
      default_marked_by_admin_user_id: actor.userId,
      default_reason: reason,
    });
    await this.logEvent(prisma, id, "NOTE_DEFAULT_MARKED", actor, { reason });
    await notifyNoteDefaulted({
      notificationService: this.notificationService,
      noteId: id,
      issuerOrganizationId: updated.issuer_organization_id,
      noteTitle: resolveNoteNotificationTitle(updated),
    });
    return mapNoteDetail(updated);
  }

  async getPlatformFinanceSettings() {
    const settings = await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {},
      create: { key: "DEFAULT" },
    });
    return {
      id: settings.id,
      key: settings.key,
      gracePeriodDays: settings.grace_period_days,
      arrearsThresholdDays: settings.arrears_threshold_days,
      tawidhRateCapPercent: toNumber(settings.tawidh_rate_cap_percent),
      gharamahRateCapPercent: toNumber(settings.gharamah_rate_cap_percent),
      platformFeeRateCapPercent: toNumber(settings.platform_fee_rate_cap_percent),
      defaultTawidhRatePercent: toNumber(settings.default_tawidh_rate_percent),
      defaultGharamahRatePercent: toNumber(settings.default_gharamah_rate_percent),
      withdrawalLetterTemplate: settings.withdrawal_letter_template,
      arrearsLetterTemplate: settings.arrears_letter_template,
      defaultLetterTemplate: settings.default_letter_template,
      trusteeLetterConfig:
        (settings.trustee_letter_config as TrusteeLetterConfig | null) ?? null,
      platformAccountsConfig:
        (settings.platform_accounts_config as PlatformAccountsConfig | null) ?? null,
      ledgerBucketAccountsConfig:
        (settings.ledger_bucket_accounts_config as LedgerBucketAccountsConfig | null) ?? null,
      updatedByUserId: settings.updated_by_user_id,
      updatedAt: settings.updated_at.toISOString(),
    };
  }

  async updatePlatformFinanceSettings(
    input: z.infer<typeof updatePlatformFinanceSettingsSchema>,
    actor: ActorContext
  ) {
    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      create: {
        key: "DEFAULT",
        grace_period_days: input.gracePeriodDays,
        arrears_threshold_days: input.arrearsThresholdDays,
        tawidh_rate_cap_percent:
          input.tawidhRateCapPercent != null ? money(input.tawidhRateCapPercent) : undefined,
        gharamah_rate_cap_percent:
          input.gharamahRateCapPercent != null ? money(input.gharamahRateCapPercent) : undefined,
        platform_fee_rate_cap_percent:
          input.platformFeeRateCapPercent != null
            ? money(input.platformFeeRateCapPercent)
            : undefined,
        default_tawidh_rate_percent:
          input.defaultTawidhRatePercent != null
            ? money(input.defaultTawidhRatePercent)
            : undefined,
        default_gharamah_rate_percent:
          input.defaultGharamahRatePercent != null
            ? money(input.defaultGharamahRatePercent)
            : undefined,
        withdrawal_letter_template: input.withdrawalLetterTemplate,
        arrears_letter_template: input.arrearsLetterTemplate,
        default_letter_template: input.defaultLetterTemplate,
        trustee_letter_config:
          input.trusteeLetterConfig != null
            ? (input.trusteeLetterConfig as Prisma.InputJsonValue)
            : undefined,
        platform_accounts_config:
          input.platformAccountsConfig != null
            ? (input.platformAccountsConfig as Prisma.InputJsonValue)
            : undefined,
        ledger_bucket_accounts_config:
          input.ledgerBucketAccountsConfig != null
            ? (input.ledgerBucketAccountsConfig as Prisma.InputJsonValue)
            : undefined,
        updated_by_user_id: actor.userId,
      },
      update: {
        grace_period_days: input.gracePeriodDays,
        arrears_threshold_days: input.arrearsThresholdDays,
        tawidh_rate_cap_percent:
          input.tawidhRateCapPercent != null ? money(input.tawidhRateCapPercent) : undefined,
        gharamah_rate_cap_percent:
          input.gharamahRateCapPercent != null ? money(input.gharamahRateCapPercent) : undefined,
        platform_fee_rate_cap_percent:
          input.platformFeeRateCapPercent != null
            ? money(input.platformFeeRateCapPercent)
            : undefined,
        default_tawidh_rate_percent:
          input.defaultTawidhRatePercent != null
            ? money(input.defaultTawidhRatePercent)
            : undefined,
        default_gharamah_rate_percent:
          input.defaultGharamahRatePercent != null
            ? money(input.defaultGharamahRatePercent)
            : undefined,
        withdrawal_letter_template: input.withdrawalLetterTemplate,
        arrears_letter_template: input.arrearsLetterTemplate,
        default_letter_template: input.defaultLetterTemplate,
        trustee_letter_config:
          input.trusteeLetterConfig != null
            ? (input.trusteeLetterConfig as Prisma.InputJsonValue)
            : undefined,
        platform_accounts_config:
          input.platformAccountsConfig != null
            ? (input.platformAccountsConfig as Prisma.InputJsonValue)
            : undefined,
        ledger_bucket_accounts_config:
          input.ledgerBucketAccountsConfig != null
            ? (input.ledgerBucketAccountsConfig as Prisma.InputJsonValue)
            : undefined,
        updated_by_user_id: actor.userId,
      },
    });
    return this.getPlatformFinanceSettings();
  }

  async requestTrusteeSignatureUploadUrl(
    input: z.infer<typeof requestTrusteeSignatureUploadUrlSchema>
  ) {
    const extension = signatureImageExtensionForContentType(input.contentType);
    const date = new Date().toISOString().split("T")[0];
    const key = `platform-finance/trustee-signatures/v1-${date}-${randomUUID()}.${extension}`;
    const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
      key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });
    return { uploadUrl, s3Key, expiresIn };
  }

  async createWithdrawal(input: z.infer<typeof createWithdrawalSchema>, actor: ActorContext) {
    const withdrawal = await prisma.withdrawalInstruction.create({
      data: {
        note_id: input.noteId ?? null,
        investor_organization_id: input.investorOrganizationId ?? null,
        issuer_organization_id: input.issuerOrganizationId ?? null,
        requested_by_user_id: actor.userId,
        withdrawal_type: input.withdrawalType,
        amount: money(input.amount),
        beneficiary_snapshot: input.beneficiarySnapshot as Prisma.InputJsonValue,
      },
    });
    return this.mapWithdrawal(withdrawal);
  }

  async listInvestorWithdrawals(query: z.infer<typeof getInvestorWithdrawalsQuerySchema>) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.WithdrawalInstructionWhereInput = {
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
    };
    if (query.status) where.status = query.status as WithdrawalStatus;
    if (query.investorOrganizationId) {
      where.investor_organization_id = query.investorOrganizationId;
    }
    if (query.dateFrom || query.dateTo) {
      where.created_at = {};
      if (query.dateFrom) where.created_at.gte = new Date(query.dateFrom);
      if (query.dateTo) where.created_at.lte = new Date(query.dateTo);
    }

    const [withdrawals, count] = await Promise.all([
      prisma.withdrawalInstruction.findMany({
        where,
        orderBy: [{ created_at: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.withdrawalInstruction.count({ where }),
    ]);

    const orgIds = Array.from(
      new Set(withdrawals.map((w) => w.investor_organization_id).filter(Boolean) as string[])
    );
    const orgs = orgIds.length
      ? await prisma.investorOrganization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [];
    const orgMap = new Map(orgs.map((org) => [org.id, org]));

    const items = withdrawals.map((withdrawal) => {
      const org = withdrawal.investor_organization_id
        ? orgMap.get(withdrawal.investor_organization_id)
        : undefined;
      return {
        withdrawalId: withdrawal.id,
        investorOrganizationId: withdrawal.investor_organization_id,
        investorOrganizationName: org?.name ?? null,
        requestedByUserId: withdrawal.requested_by_user_id,
        amount: toNumber(withdrawal.amount),
        currency: withdrawal.currency,
        status: withdrawal.status,
        beneficiarySnapshot: asRecord(withdrawal.beneficiary_snapshot) ?? {},
        letterS3Key: withdrawal.letter_s3_key,
        generatedAt: withdrawal.generated_at?.toISOString() ?? null,
        submittedToTrusteeAt: withdrawal.submitted_to_trustee_at?.toISOString() ?? null,
        completedAt: withdrawal.completed_at?.toISOString() ?? null,
        createdAt: withdrawal.created_at.toISOString(),
      };
    });

    return { count, items };
  }

  async getInvestorWithdrawal(id: string) {
    const withdrawal = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!withdrawal || withdrawal.withdrawal_type !== WithdrawalType.INVESTOR_WITHDRAWAL) {
      throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal instruction not found");
    }
    return this.mapWithdrawal(withdrawal);
  }

  async createInvestorWithdrawal(
    input: z.infer<typeof createInvestorWithdrawalSchema>,
    actor: ActorContext
  ) {
    await this.resolveInvestorOrgIds(actor.userId, input.investorOrganizationId);

    const investorOrg = await prisma.investorOrganization.findUnique({
      where: { id: input.investorOrganizationId },
      select: { id: true, name: true, bank_account_details: true },
    });
    if (!investorOrg) {
      throw new AppError(404, "INVESTOR_ORG_NOT_FOUND", "Investor organization not found");
    }

    const beneficiarySnapshot = buildBeneficiarySnapshot({
      id: investorOrg.id,
      name: investorOrg.name,
      bank_account_details: investorOrg.bank_account_details,
    });

    const hasBankDetails =
      beneficiarySnapshot.bank_name.trim() !== "" &&
      beneficiarySnapshot.account_number.trim() !== "";
    if (!hasBankDetails) {
      throw new AppError(
        422,
        "BENEFICIARY_DETAILS_MISSING",
        "Bank account details must be set before requesting a withdrawal."
      );
    }

    const idempotencyKey = `investor-withdrawal:${input.investorOrganizationId}:${randomUUID()}`;

    const withdrawal = await prisma.$transaction(async (tx) => {
      await debitInvestorBalanceForWithdrawal(tx, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
        idempotencyKey,
        metadata: { requestedByUserId: actor.userId } as Prisma.InputJsonValue,
      });

      return tx.withdrawalInstruction.create({
        data: {
          investor_organization_id: input.investorOrganizationId,
          requested_by_user_id: actor.userId,
          withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
          status: WithdrawalStatus.DRAFT,
          amount: money(input.amount),
          beneficiary_snapshot: beneficiarySnapshot as Prisma.InputJsonValue,
          metadata: {
            source: "INVESTOR_PORTAL",
            requestedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.mapWithdrawal(withdrawal);
  }

  async generateWithdrawalLetter(id: string, actor: ActorContext) {
    const withdrawal = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!withdrawal)
      throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal instruction not found");

    // Issuer disbursement trustee letter must only be generated after Tawarruq Certificate is fetched/stored.
    if (withdrawal.withdrawal_type === WithdrawalType.ISSUER_DISBURSEMENT) {
      const shorakaTradeOrder = await prisma.shorakaTradeOrder.findUnique({
        where: { withdrawal_instruction_id: id },
        select: { certificate_s3_key: true },
      });

      if (!shorakaTradeOrder?.certificate_s3_key) {
        throw new AppError(
          400,
          "TAWARRUQ_CERTIFICATE_REQUIRED_FOR_TRUSTEE_LETTER",
          "Tawarruq Certificate must be fetched before generating the trustee letter."
        );
      }
    }

    const settings = await this.getPlatformFinanceSettings();
    const trusteeConfig = loadTrusteeLetterConfig(settings);
    const signatureImage = await this.resolveTrusteeSignatureImageBuffer(
      trusteeConfig.letterConfig
    );
    const beneficiarySnapshot = asRecord(withdrawal.beneficiary_snapshot) ?? {};
    const metadata = asRecord(withdrawal.metadata);

    let letterData;
    if (withdrawal.withdrawal_type === WithdrawalType.INVESTOR_WITHDRAWAL) {
      const investorOrg = withdrawal.investor_organization_id
        ? await prisma.investorOrganization.findUnique({
            where: { id: withdrawal.investor_organization_id },
            select: { name: true },
          })
        : null;
      letterData = {
        ...mapInvestorWithdrawalLetterData({
          withdrawalId: withdrawal.id,
          amount: toNumber(withdrawal.amount),
          beneficiarySnapshot,
          investorOrganizationName: investorOrg?.name ?? null,
          config: trusteeConfig,
        }),
        authorisedSignatureImage: signatureImage ?? undefined,
      };
    } else {
      letterData = {
        ...mapDisbursementLetterData({
          withdrawalId: withdrawal.id,
          withdrawalAmount: toNumber(withdrawal.amount),
          beneficiarySnapshot,
          metadata,
          config: trusteeConfig,
        }),
        authorisedSignatureImage: signatureImage ?? undefined,
      };
    }

    const buffer = await renderTrusteeLetterPdf(letterData);
    const key = `withdrawal-letters/${id}/${Date.now()}.pdf`;
    await putS3ObjectBuffer({ key, body: buffer, contentType: "application/pdf" });
    const updated = await prisma.withdrawalInstruction.update({
      where: { id },
      data: {
        status: WithdrawalStatus.LETTER_GENERATED,
        letter_s3_key: key,
        generated_at: new Date(),
      },
    });
    if (withdrawal.note_id) {
      await this.logEvent(prisma, withdrawal.note_id, "WITHDRAWAL_LETTER_GENERATED", actor, {
        withdrawalId: id,
        s3Key: key,
      });
    }
    return this.mapWithdrawal(updated);
  }

  async markWithdrawalSubmitted(id: string, actor: ActorContext) {
    const existing = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    if (existing.status !== WithdrawalStatus.LETTER_GENERATED) {
      throw new AppError(
        409,
        "WITHDRAWAL_LETTER_REQUIRED",
        "Withdrawal can be submitted to trustee only after its instruction letter is generated"
      );
    }
    if (!existing.letter_s3_key) {
      throw new AppError(
        409,
        "WITHDRAWAL_LETTER_REQUIRED",
        "Withdrawal can be submitted to trustee only after its instruction letter is generated"
      );
    }

    // TODO: future enhancement — send trustee instruction email with generated PDF attachment before marking as submitted.

    const withdrawal = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.withdrawalInstruction.updateMany({
        where: { id, status: WithdrawalStatus.LETTER_GENERATED },
        data: {
          status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
          submitted_by_user_id: actor.userId,
          submitted_to_trustee_at: new Date(),
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(
          409,
          "WITHDRAWAL_LETTER_REQUIRED",
          "Withdrawal can be submitted to trustee only after its instruction letter is generated"
        );
      }
      return tx.withdrawalInstruction.findUniqueOrThrow({ where: { id } });
    });
    if (withdrawal.note_id) {
      await this.logEvent(prisma, withdrawal.note_id, "WITHDRAWAL_SUBMITTED_TO_TRUSTEE", actor, {
        withdrawalId: id,
      });
    }
    return this.mapWithdrawal(withdrawal);
  }

  async updateWithdrawalBeneficiary(
    id: string,
    beneficiarySnapshot: Record<string, unknown>,
    actor: ActorContext
  ) {
    const existing = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    if (existing.status !== WithdrawalStatus.DRAFT) {
      throw new AppError(
        409,
        "WITHDRAWAL_NOT_EDITABLE",
        "Beneficiary details can only be edited while the withdrawal is in draft"
      );
    }
    const updated = await prisma.withdrawalInstruction.update({
      where: { id },
      data: {
        beneficiary_snapshot: beneficiarySnapshot as Prisma.InputJsonValue,
      },
    });
    if (updated.note_id) {
      await this.logEvent(prisma, updated.note_id, "WITHDRAWAL_BENEFICIARY_UPDATED", actor, {
        withdrawalId: id,
      });
    }
    return this.mapWithdrawal(updated);
  }

  async markWithdrawalCompleted(id: string, actor: ActorContext) {
    const existing = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    if (existing.status !== WithdrawalStatus.SUBMITTED_TO_TRUSTEE) {
      throw new AppError(
        409,
        "WITHDRAWAL_NOT_SUBMITTED",
        "Withdrawal can be marked complete only after it is submitted to trustee"
      );
    }

    const completedAt = new Date();
    const withdrawal = await prisma.$transaction(async (tx) => {
      if (existing.withdrawal_type === WithdrawalType.ISSUER_DISBURSEMENT) {
        const shorakaTradeOrder = await tx.shorakaTradeOrder.findUnique({
          where: { withdrawal_instruction_id: id },
          select: { certificate_s3_key: true },
        });

        if (!shorakaTradeOrder?.certificate_s3_key) {
          throw new AppError(
            400,
            "SHORAKA_CERTIFICATE_REQUIRED",
            "Shoraka certificate must be fetched before marking issuer disbursement as completed."
          );
        }
      }

      const stateUpdate = await tx.withdrawalInstruction.updateMany({
        where: { id, status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE },
        data: {
          status: WithdrawalStatus.COMPLETED,
          completed_at: completedAt,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(
          409,
          "WITHDRAWAL_NOT_SUBMITTED",
          "Withdrawal can be marked complete only after it is submitted to trustee"
        );
      }

      const isIssuerPayout =
        existing.withdrawal_type === WithdrawalType.ISSUER_RESIDUAL_RETURN ||
        existing.withdrawal_type === WithdrawalType.ISSUER_DISBURSEMENT;

      if (isIssuerPayout && existing.note_id && toNumber(existing.amount) > 0) {
        const issuerPayableId = await this.getLedgerAccountId(tx, "ISSUER_PAYABLE");
        const isDisbursement = existing.withdrawal_type === WithdrawalType.ISSUER_DISBURSEMENT;
        await tx.noteLedgerEntry.create({
          data: {
            note_id: existing.note_id,
            account_id: issuerPayableId,
            settlement_id: existing.settlement_id,
            direction: NoteLedgerDirection.DEBIT,
            amount: existing.amount,
            description: isDisbursement
              ? "Issuer disbursement paid out via trustee withdrawal"
              : "Issuer residual disbursed via trustee withdrawal",
            idempotency_key: isDisbursement
              ? `withdrawal:${id}:issuer-disbursement`
              : `withdrawal:${id}:issuer-residual-disbursement`,
            metadata: {
              actorUserId: actor.userId,
              withdrawalId: id,
              settlementId: existing.settlement_id,
              withdrawalType: existing.withdrawal_type,
            } as Prisma.InputJsonValue,
          },
        });

        if (existing.withdrawal_type === WithdrawalType.ISSUER_DISBURSEMENT) {
          await tx.note.updateMany({
            where: {
              id: existing.note_id,
              status: NoteStatus.FUNDING,
            },
            data: {
              status: NoteStatus.ACTIVE,
              servicing_status: NoteServicingStatus.CURRENT,
              activated_at: completedAt,
            },
          });
        } else {
          const postedResidualSettlement = existing.settlement_id
            ? await tx.noteSettlement.findFirst({
                where: {
                  id: existing.settlement_id,
                  note_id: existing.note_id,
                  status: NoteSettlementStatus.POSTED,
                },
                select: { id: true },
              })
            : null;
          const pendingResidual = await tx.withdrawalInstruction.count({
            where: {
              note_id: existing.note_id,
              withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
              status: { notIn: [WithdrawalStatus.COMPLETED, WithdrawalStatus.CANCELLED] },
            },
          });

          if (postedResidualSettlement && pendingResidual === 0) {
            await tx.note.updateMany({
              where: {
                id: existing.note_id,
                status: { in: [NoteStatus.ACTIVE, NoteStatus.ARREARS, NoteStatus.DEFAULTED] },
              },
              data: {
                status: NoteStatus.REPAID,
                servicing_status: NoteServicingStatus.SETTLED,
                repaid_at: completedAt,
              },
            });
          }
        }
      }

      return tx.withdrawalInstruction.findUniqueOrThrow({ where: { id } });
    });

    if (withdrawal.note_id) {
      await this.logEvent(prisma, withdrawal.note_id, "WITHDRAWAL_COMPLETED", actor, {
        withdrawalId: id,
        amount: toNumber(withdrawal.amount),
      });
    }
    return this.mapWithdrawal(withdrawal);
  }

  async listLedger(id: string) {
    const entries = await prisma.noteLedgerEntry.findMany({
      where: { note_id: id },
      include: { account: true },
      orderBy: { posted_at: "desc" },
    });
    return entries.map(mapLedgerEntry);
  }

  async listLedgerBucketBalances() {
    const accounts = await prisma.noteLedgerAccount.findMany({
      include: { ledger_entries: true },
      orderBy: { name: "asc" },
    });
    const bucketOrder = [
      "INVESTOR_POOL",
      "REPAYMENT_POOL",
      "OPERATING_ACCOUNT",
      "TAWIDH_ACCOUNT",
      "GHARAMAH_ACCOUNT",
      "ISSUER_PAYABLE",
    ];
    const buckets = accounts
      .filter((account) => bucketOrder.includes(account.code))
      .sort((a, b) => bucketOrder.indexOf(a.code) - bucketOrder.indexOf(b.code))
      .map((account) => {
        const debitTotal = account.ledger_entries
          .filter((entry) => entry.direction === NoteLedgerDirection.DEBIT)
          .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
        const creditTotal = account.ledger_entries
          .filter((entry) => entry.direction === NoteLedgerDirection.CREDIT)
          .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
        const lastPostedAt = account.ledger_entries.reduce<Date | null>((latest, entry) => {
          if (!latest || entry.posted_at > latest) return entry.posted_at;
          return latest;
        }, null);

        return {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          currency: account.currency,
          debitTotal,
          creditTotal,
          balance: creditTotal - debitTotal,
          entryCount: account.ledger_entries.length,
          lastPostedAt: lastPostedAt?.toISOString() ?? null,
        };
      });

    return {
      buckets,
      totals: {
        debitTotal: buckets.reduce((sum, bucket) => sum + bucket.debitTotal, 0),
        creditTotal: buckets.reduce((sum, bucket) => sum + bucket.creditTotal, 0),
        balance: buckets.reduce((sum, bucket) => sum + bucket.balance, 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listLedgerBucketActivity(
    accountCode: NoteLedgerAccountType,
    query: z.infer<typeof bucketActivityQuerySchema>
  ) {
    const account = await prisma.noteLedgerAccount.findUnique({
      where: { code: accountCode },
      include: { ledger_entries: true },
    });
    if (!account) throw new AppError(404, "LEDGER_ACCOUNT_NOT_FOUND", "Ledger bucket not found");

    const debitTotal = account.ledger_entries
      .filter((entry) => entry.direction === NoteLedgerDirection.DEBIT)
      .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const creditTotal = account.ledger_entries
      .filter((entry) => entry.direction === NoteLedgerDirection.CREDIT)
      .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const lastPostedAt = account.ledger_entries.reduce<Date | null>((latest, entry) => {
      if (!latest || entry.posted_at > latest) return entry.posted_at;
      return latest;
    }, null);
    const where = { account: { code: accountCode } };
    const [entries, totalCount] = await Promise.all([
      prisma.noteLedgerEntry.findMany({
        where,
        include: {
          account: true,
          note: { select: { note_reference: true, title: true } },
        },
        orderBy: { posted_at: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.noteLedgerEntry.count({ where }),
    ]);

    return {
      bucket: {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        currency: account.currency,
        debitTotal,
        creditTotal,
        balance: creditTotal - debitTotal,
        entryCount: account.ledger_entries.length,
        lastPostedAt: lastPostedAt?.toISOString() ?? null,
      },
      entries: entries.map((entry) => ({
        ...mapLedgerEntry(entry),
        noteReference: entry.note?.note_reference ?? null,
        noteTitle: entry.note?.title ?? null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listEvents(id: string) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    return mapNoteDetail(note).events;
  }

  private mapWithdrawal(
    withdrawal: Prisma.WithdrawalInstructionGetPayload<Prisma.WithdrawalInstructionDefaultArgs>
  ) {
    return mapWithdrawalInstruction(withdrawal);
  }

  private resolvePaymasterName(paymaster: Record<string, unknown> | null): string | null {
    const name = paymaster?.name ?? paymaster?.company_name ?? paymaster?.business_name;
    return typeof name === "string" ? name : null;
  }

  private async resolvePlatformFeeRateCapPercent(): Promise<number> {
    const settings = await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {},
      create: { key: "DEFAULT" },
      select: { platform_fee_rate_cap_percent: true },
    });
    return toNumber(settings.platform_fee_rate_cap_percent);
  }

  private async logEvent(
    tx: Prisma.TransactionClient | typeof prisma,
    noteId: string,
    eventType: string,
    actor: ActorContext,
    metadata?: Prisma.InputJsonValue
  ) {
    await tx.noteEvent.create({
      data: {
        note_id: noteId,
        event_type: eventType,
        actor_user_id: actor.userId,
        actor_role: actor.role,
        portal: actor.portal,
        ip_address: actor.ipAddress,
        user_agent: actor.userAgent,
        correlation_id: actor.correlationId,
        metadata,
      },
    });
  }

  private async logAdminAction(
    tx: Prisma.TransactionClient,
    noteId: string,
    actionType: string,
    actor: ActorContext,
    beforeState?: Prisma.InputJsonValue,
    afterState?: Prisma.InputJsonValue
  ) {
    await tx.noteAdminAction.create({
      data: {
        note_id: noteId,
        action_type: actionType,
        actor_user_id: actor.userId,
        before_state: beforeState,
        after_state: afterState,
        ip_address: actor.ipAddress,
        user_agent: actor.userAgent,
        correlation_id: actor.correlationId,
      },
    });
    await this.logEvent(tx, noteId, actionType, actor, { beforeState, afterState });
  }

  private async getLedgerAccountId(tx: Prisma.TransactionClient, code: string) {
    const account = await tx.noteLedgerAccount.findUnique({ where: { code } });
    if (!account)
      throw new AppError(500, "LEDGER_ACCOUNT_MISSING", `Missing ledger account ${code}`);
    return account.id;
  }

  private async postDisbursementLedger(
    tx: Prisma.TransactionClient,
    note: Awaited<ReturnType<typeof prisma.note.findUniqueOrThrow>>,
    actor: ActorContext,
    params?: {
      fundedAmount?: number;
      platformFee?: number;
      facilityFeeCharged?: number;
      netDisbursement?: number;
    }
  ) {
    const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
    const operatingId = await this.getLedgerAccountId(tx, "OPERATING_ACCOUNT");
    const issuerPayableId = await this.getLedgerAccountId(tx, "ISSUER_PAYABLE");
    const fundedAmount = params?.fundedAmount ?? toNumber(note.funded_amount);
    const platformFee =
      params?.platformFee ?? fundedAmount * (toNumber(note.platform_fee_rate_percent) / 100);
    const facilityFeeCharged = params?.facilityFeeCharged ?? 0;
    const netDisbursement = params?.netDisbursement ?? Math.max(0, fundedAmount - platformFee);
    const entries = [
      {
        account_id: investorPoolId,
        direction: NoteLedgerDirection.DEBIT,
        amount: money(fundedAmount),
        description: "Funded note disbursement from investor pool",
      },
      {
        account_id: operatingId,
        direction: NoteLedgerDirection.CREDIT,
        amount: money(platformFee),
        description: "Platform fee deducted at disbursement",
      },
      ...(facilityFeeCharged > 0
        ? [
            {
              account_id: operatingId,
              direction: NoteLedgerDirection.CREDIT,
              amount: money(facilityFeeCharged),
              description: "Facility fee deducted at disbursement",
            },
          ]
        : []),
      {
        account_id: issuerPayableId,
        direction: NoteLedgerDirection.CREDIT,
        amount: money(netDisbursement),
        description: "Net disbursement obligation to issuer (pending trustee payout)",
      },
    ].filter((entry) => toNumber(entry.amount) > 0);

    for (const [index, entry] of entries.entries()) {
      await tx.noteLedgerEntry.create({
        data: {
          note_id: note.id,
          ...entry,
          idempotency_key: `note:${note.id}:disbursement:${index}`,
          metadata: { actorUserId: actor.userId },
        },
      });
    }
  }

  private async postPaymentReceiptLedger(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      note_id: string;
      receipt_amount: unknown;
      source: string;
      reference: string | null;
    },
    actor: ActorContext
  ) {
    const repaymentPoolId = await this.getLedgerAccountId(tx, "REPAYMENT_POOL");
    const amount = toNumber(payment.receipt_amount);
    if (amount <= 0) return;

    await tx.noteLedgerEntry.upsert({
      where: { idempotency_key: `payment:${payment.id}:receipt` },
      update: { amount: money(amount) },
      create: {
        note_id: payment.note_id,
        account_id: repaymentPoolId,
        payment_id: payment.id,
        direction: NoteLedgerDirection.CREDIT,
        amount: money(amount),
        description: "Repayment receipt recorded",
        idempotency_key: `payment:${payment.id}:receipt`,
        metadata: {
          actorUserId: actor.userId,
          source: payment.source,
          reference: payment.reference,
        },
      },
    });
  }

  private async postSettlementLedger(
    tx: Prisma.TransactionClient,
    settlement: Awaited<ReturnType<typeof prisma.noteSettlement.findUnique>>,
    actor: ActorContext
  ) {
    if (!settlement) return;
    const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
    const repaymentPoolId = await this.getLedgerAccountId(tx, "REPAYMENT_POOL");
    const operatingId = await this.getLedgerAccountId(tx, "OPERATING_ACCOUNT");
    const tawidhId = await this.getLedgerAccountId(tx, "TAWIDH_ACCOUNT");
    const gharamahId = await this.getLedgerAccountId(tx, "GHARAMAH_ACCOUNT");
    const issuerPayableId = await this.getLedgerAccountId(tx, "ISSUER_PAYABLE");
    const existingReceiptEntries = await tx.noteLedgerEntry.findMany({
      where: {
        note_id: settlement.note_id,
        account_id: repaymentPoolId,
        direction: NoteLedgerDirection.CREDIT,
      },
      select: { amount: true },
    });
    const existingReceiptTotal = existingReceiptEntries.reduce(
      (sum, entry) => sum + toNumber(entry.amount),
      0
    );
    const grossReceiptValue = toNumber(settlement.gross_receipt_amount);
    const receiptShortfall = Math.max(0, grossReceiptValue - existingReceiptTotal);
    const receiptExcess = Math.max(0, existingReceiptTotal - grossReceiptValue);
    const tawidhAmount = toNumber(settlement.tawidh_amount);
    const tawidhInvestorAmount = toNumber(settlement.tawidh_investor_amount);
    const tawidhAccountAmount =
      toNumber(settlement.tawidh_account_amount) ||
      Math.max(0, tawidhAmount - tawidhInvestorAmount);
    const entries: Array<
      [string, string, NoteLedgerDirection, Prisma.Decimal | number | string, string]
    > = [];
    if (receiptShortfall > 0.005) {
      entries.push([
        "repayment-receipt",
        repaymentPoolId,
        NoteLedgerDirection.CREDIT,
        money(receiptShortfall),
        "Repayment receipt shortfall",
      ]);
    }
    if (receiptExcess > 0.005) {
      entries.push([
        "repayment-receipt-excess-adjustment",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        money(receiptExcess),
        "Repayment pool excess corrected before settlement",
      ]);
    }
    entries.push(
      [
        "repayment-to-investor-principal",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        settlement.investor_principal,
        "Investor principal paid from repayment pool",
      ],
      [
        "repayment-to-investor-profit",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        settlement.investor_profit_net,
        "Investor net profit paid from repayment pool",
      ],
      [
        "repayment-to-service-fee",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        settlement.service_fee_amount,
        "Service fee paid from repayment pool",
      ],
      [
        "repayment-to-tawidh",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        settlement.tawidh_amount,
        "Total Ta'widh paid from repayment pool",
      ],
      [
        "repayment-to-gharamah",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        settlement.gharamah_amount,
        "Gharamah paid from repayment pool",
      ],
      [
        "repayment-to-issuer-residual",
        repaymentPoolId,
        NoteLedgerDirection.DEBIT,
        settlement.issuer_residual_amount,
        "Issuer residual paid from repayment pool",
      ],
      [
        "investor-principal",
        investorPoolId,
        NoteLedgerDirection.CREDIT,
        settlement.investor_principal,
        "Investor principal returned",
      ],
      [
        "investor-profit",
        investorPoolId,
        NoteLedgerDirection.CREDIT,
        settlement.investor_profit_net,
        "Investor net profit returned",
      ],
      [
        "investor-tawidh",
        investorPoolId,
        NoteLedgerDirection.CREDIT,
        money(tawidhInvestorAmount),
        "Investor Ta'widh compensation returned",
      ],
      [
        "service-fee",
        operatingId,
        NoteLedgerDirection.CREDIT,
        settlement.service_fee_amount,
        "Service fee from investor profit",
      ],
      [
        "tawidh",
        tawidhId,
        NoteLedgerDirection.CREDIT,
        money(tawidhAccountAmount),
        "Ta'widh late charge retained in Ta'widh account",
      ],
      [
        "gharamah",
        gharamahId,
        NoteLedgerDirection.CREDIT,
        settlement.gharamah_amount,
        "Gharamah late charge",
      ],
      [
        "issuer-payable",
        issuerPayableId,
        NoteLedgerDirection.CREDIT,
        settlement.issuer_residual_amount,
        "Issuer residual recognised as payable to issuer",
      ]
    );

    for (const [key, accountId, direction, amount, description] of entries) {
      if (toNumber(amount) <= 0) continue;
      await tx.noteLedgerEntry.create({
        data: {
          note_id: settlement.note_id,
          account_id: accountId,
          settlement_id: settlement.id,
          payment_id: settlement.payment_id,
          direction,
          amount,
          description,
          idempotency_key: `settlement:${settlement.id}:${key}`,
          metadata: { actorUserId: actor.userId },
        },
      });
    }
  }
}

export const noteService = new NoteService();
