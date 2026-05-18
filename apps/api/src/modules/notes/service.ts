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
import { putS3ObjectBuffer } from "../../lib/s3/client";
import { resolveApprovedFacilityForRefresh } from "../../lib/contract-facility";
import {
  resolveOfferedAmount,
  resolveOfferedPlatformFeeRatePercent,
  resolveOfferedProfitRate,
  resolveRequestedInvoiceAmount,
} from "../../lib/invoice-offer";
import { isSoukscoreRiskRating } from "@cashsouk/types";
import { creditInvestorBalance, debitInvestorBalanceForCommit } from "./investor-balance";
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
  calculateLateCharge as calculateLateChargeValues,
  calculateSettlementWaterfall,
} from "./calculators";
import type {
  createInvestmentSchema,
  createNoteFromApplicationSchema,
  bucketActivityQuerySchema,
  createWithdrawalSchema,
  getAdminInvestmentsQuerySchema,
  getNotesQuerySchema,
  investorBalanceActivityQuerySchema,
  investorPortfolioHistoryQuerySchema,
  lateChargeSchema,
  overdueLateChargeSchema,
  paymentReviewSchema,
  recordPaymentSchema,
  settlementPreviewSchema,
  updateNoteFeaturedSchema,
  updateNoteDraftSchema,
  updatePlatformFinanceSettingsSchema,
} from "./schemas";
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
};

type NoteWithRelations = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

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
    return metadata?.releaseReason === "SETTLEMENT_PAYOUT" ? toNumber(metadata?.profitNet) : 0;
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
      },
    ];
  });
}

function buildInvestorRepaymentSummary(
  note: NoteWithRelations,
  investorOrganizationIds: Set<string>
) {
  const investorInvestments = note.investments.filter(
    (investment) =>
      investorOrganizationIds.has(investment.investor_organization_id) &&
      investment.status !== NoteInvestmentStatus.CANCELLED
  );

  const investedPrincipal = investorInvestments.reduce(
    (sum, investment) => sum + toNumber(investment.amount),
    0
  );
  const expectedReturnRatePercent = toNumber(note.profit_rate_percent);
  const expectedPayoutAmount =
    investedPrincipal + investedPrincipal * (expectedReturnRatePercent / 100);

  const receivedPayoutAmount = note.settlements
    .filter((settlement) => settlement.status === NoteSettlementStatus.POSTED)
    .flatMap((settlement) => resolveSettlementAllocations(settlement.preview_snapshot))
    .filter((allocation) => investorOrganizationIds.has(allocation.investorOrganizationId))
    .reduce((sum, allocation) => sum + allocation.principal + allocation.profitNet, 0);

  const actualReturnRatePercent =
    investedPrincipal > 0 && receivedPayoutAmount > 0
      ? ((receivedPayoutAmount - investedPrincipal) / investedPrincipal) * 100
      : null;
  const progressPercent =
    expectedPayoutAmount > 0
      ? clampPercent((receivedPayoutAmount / expectedPayoutAmount) * 100)
      : 0;

  return {
    investedPrincipal: roundTo(investedPrincipal, 2),
    expectedPayoutAmount: roundTo(expectedPayoutAmount, 2),
    receivedPayoutAmount: roundTo(receivedPayoutAmount, 2),
    expectedReturnRatePercent: roundTo(expectedReturnRatePercent, 2),
    actualReturnRatePercent:
      actualReturnRatePercent == null ? null : roundTo(actualReturnRatePercent, 2),
    progressPercent: roundTo(progressPercent, 2),
  };
}

/** Standard marketplace ticket floor (MYR). When remaining capacity is smaller, min commit equals remainder. */
const MARKETPLACE_MIN_COMMIT_MYR = 100;
const DEFAULT_LISTING_DURATION_DAYS = 14;

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
  const requiredReceiptAmount =
    settlementAmount + toNumber(settlement.tawidh_amount) + toNumber(settlement.gharamah_amount);
  if (settlementAmount > 0 && grossReceiptAmount + 0.005 < settlementAmount) {
    throw new AppError(
      422,
      "INCOMPLETE_SETTLEMENT_AMOUNT",
      "Settlement cannot be approved or posted until the full invoice settlement amount has been received"
    );
  }
  if (requiredReceiptAmount > 0 && grossReceiptAmount > requiredReceiptAmount + 0.005) {
    throw new AppError(
      422,
      "SETTLEMENT_RECEIPT_LIMIT_EXCEEDED",
      "Settlement receipt cannot exceed the invoice settlement amount plus approved late fees"
    );
  }
}

const OPEN_PAYMENT_STATUSES: NotePaymentStatus[] = [
  NotePaymentStatus.PENDING,
  NotePaymentStatus.PARTIAL,
  NotePaymentStatus.RECEIVED,
  NotePaymentStatus.RECONCILED,
];

function resolveActiveSettlementLateFeeAmount(note: {
  settlements?: Array<{
    status: NoteSettlementStatus;
    tawidh_amount?: Prisma.Decimal | number | string | null;
    gharamah_amount?: Prisma.Decimal | number | string | null;
  }>;
}) {
  const settlement = note.settlements?.find(
    (item) =>
      item.status === NoteSettlementStatus.POSTED ||
      item.status === NoteSettlementStatus.APPROVED ||
      item.status === NoteSettlementStatus.PREVIEW
  );
  if (!settlement) return 0;
  return toNumber(settlement.tawidh_amount) + toNumber(settlement.gharamah_amount);
}

function resolveSettlementReceiptLimit(
  note: {
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
    settlements?: Array<{
      status: NoteSettlementStatus;
      tawidh_amount?: Prisma.Decimal | number | string | null;
      gharamah_amount?: Prisma.Decimal | number | string | null;
    }>;
  },
  pendingLateFeeAmount = 0
) {
  return (
    resolveNoteSettlementAmount(note) +
    Math.max(resolveActiveSettlementLateFeeAmount(note), pendingLateFeeAmount)
  );
}

function assertReceiptAmountWithinSettlementLimit(
  note: {
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
    settlements?: Array<{
      status: NoteSettlementStatus;
      tawidh_amount?: Prisma.Decimal | number | string | null;
      gharamah_amount?: Prisma.Decimal | number | string | null;
    }>;
  },
  receiptAmount: number,
  pendingLateFeeAmount = 0
) {
  const limit = resolveSettlementReceiptLimit(note, pendingLateFeeAmount);
  if (limit > 0 && receiptAmount > limit + 0.005) {
    throw new AppError(
      422,
      "SETTLEMENT_RECEIPT_LIMIT_EXCEEDED",
      "Open receipts cannot exceed the invoice settlement amount plus late fees"
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
    payment_schedules?: Array<{ due_date: Date }>;
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

  const dueDate = note.payment_schedules?.[0]?.due_date ?? note.maturity_date;
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

function assertOpenReceiptsWithinSettlementLimit(
  note: {
    invoice_snapshot?: Prisma.JsonValue | null;
    requested_amount?: Prisma.Decimal | number | string | null;
    payments?: Array<{
      id?: string;
      status: NotePaymentStatus;
      receipt_amount: Prisma.Decimal | number | string;
    }>;
    settlements?: Array<{
      status: NoteSettlementStatus;
      tawidh_amount?: Prisma.Decimal | number | string | null;
      gharamah_amount?: Prisma.Decimal | number | string | null;
    }>;
  },
  pendingLateFeeAmount = 0
) {
  const openReceiptAmount = (note.payments ?? [])
    .filter((payment) => OPEN_PAYMENT_STATUSES.includes(payment.status))
    .reduce((sum, payment) => sum + toNumber(payment.receipt_amount), 0);
  assertReceiptAmountWithinSettlementLimit(note, openReceiptAmount, pendingLateFeeAmount);
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

function daysBetweenCalendarDates(from: Date, to: Date) {
  const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toStart = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toStart.getTime() - fromStart.getTime()) / 86_400_000);
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
    return mapNoteDetail(note, { withdrawals });
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
      const fundingPercent = (toNumber(note.funded_amount) / targetAmount) * 100;
      return fundingPercent + 0.005 >= toNumber(note.minimum_funding_percent);
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
          select: { id: true, workflow: true },
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
            service_fee_rate_percent: money(15),
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
    const closesAt = new Date(now.getTime() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
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

    const target = toNumber(note.target_amount);
    const funded = toNumber(note.funded_amount);
    const remainingCapacity = Math.max(target - funded, 0);
    if (remainingCapacity <= 0) {
      throw new AppError(
        409,
        "NOTE_FULLY_ALLOCATED",
        "This note has no remaining funding capacity"
      );
    }
    if (input.amount > remainingCapacity) {
      throw new AppError(
        422,
        "NOTE_OVERSUBSCRIBED",
        `Investment exceeds remaining note capacity of ${remainingCapacity.toFixed(2)}`
      );
    }
    const minCommit = Math.min(MARKETPLACE_MIN_COMMIT_MYR, remainingCapacity);
    if (input.amount + 1e-9 < minCommit) {
      throw new AppError(
        422,
        "INVESTMENT_BELOW_MINIMUM",
        `Minimum commitment for this note is ${minCommit.toFixed(2)}`
      );
    }

    const investmentAmount = money(input.amount);
    const remainingCapacityFloor = money(target - input.amount);

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
        const remainingCapacity = Math.max(
          toNumber(current.target_amount) - toNumber(current.funded_amount),
          0
        );
        throw new AppError(
          422,
          "NOTE_OVERSUBSCRIBED",
          `Investment exceeds remaining note capacity of ${remainingCapacity.toFixed(2)}`
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
      updatedFunded + 0.005 >= updatedTarget &&
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
    const fundingPercent =
      toNumber(note.target_amount) > 0
        ? (toNumber(note.funded_amount) / toNumber(note.target_amount)) * 100
        : 0;
    if (fundingPercent < toNumber(note.minimum_funding_percent)) {
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
      await this.postDisbursementLedger(tx, result, actor);

      const fundedAmount = toNumber(result.funded_amount);
      const platformFee = fundedAmount * (toNumber(result.platform_fee_rate_percent) / 100);
      const netDisbursement = Math.max(0, fundedAmount - platformFee);

      if (netDisbursement > 0) {
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
                fundedAmount,
                platformFee,
              } as Prisma.InputJsonValue,
            },
          });
          await this.logEvent(tx, id, "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED", actor, {
            netDisbursement,
            fundedAmount,
            platformFee,
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
    const minimumFundingAmount = targetAmount * (toNumber(note.minimum_funding_percent) / 100);
    const fundingPercent =
      targetAmount > 0 ? (toNumber(note.funded_amount) / targetAmount) * 100 : 0;
    if (fundingPercent + 0.005 >= toNumber(note.minimum_funding_percent)) {
      throw new AppError(
        409,
        "NOTE_MINIMUM_FUNDING_MET",
        "Notes that meet the minimum funding threshold should be closed, not failed"
      );
    }
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

  async listInvestorInvestments(userId: string) {
    const orgIds = await this.listInvestorOrganizationIds(userId);
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

  async getInvestorPortfolio(userId: string) {
    const orgIds = await this.listInvestorOrganizationIds(userId);
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
    const portfolioTotal = availableBalance + committed;
    return {
      totalInvestment: committed,
      portfolioTotal,
      availableBalance,
      investmentCount: investments.length,
    };
  }

  async listInvestorBalanceActivity(
    userId: string,
    query: z.infer<typeof investorBalanceActivityQuerySchema>
  ) {
    const orgIds = await this.listInvestorOrganizationIds(userId);
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
        amount: toNumber(entry.amount),
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
        inTotal: roundTo(inTotal, 2),
        outTotal: roundTo(outTotal, 2),
        netChange: roundTo(inTotal - outTotal, 2),
        availableBalance: roundTo(availableBalance, 2),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getInvestorPortfolioHistory(
    userId: string,
    query: z.infer<typeof investorPortfolioHistoryQuerySchema>
  ) {
    const granularity = resolveHistoryGranularity(query.range);
    const orgIds = await this.listInvestorOrganizationIds(userId);
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
        {
          date: toDateKey(new Date()),
          availableBalance: roundTo(availableBalance, 2),
          portfolioTotal: roundTo(currentPortfolioTotal, 2),
        },
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
      points.push({
        date: key,
        availableBalance: roundTo(carryForwardBalance, 2),
        portfolioTotal: roundTo(carryForwardPortfolioTotal, 2),
      });
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
      const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
      await tx.noteLedgerEntry.create({
        data: {
          account_id: investorPoolId,
          direction: NoteLedgerDirection.CREDIT,
          amount: money(input.amount),
          description: "Investor test top-up received into investor pool",
          idempotency_key: `investor-balance-topup:${balanceTransaction.id}`,
          metadata: {
            actorUserId: actor.userId,
            actorPortal: actor.portal ?? "INVESTOR",
            investorOrganizationId: input.investorOrganizationId,
            investorBalanceTransactionId: balanceTransaction.id,
            source: "MANUAL_TOPUP",
          },
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
    });
    return mapNoteDetail(note, { withdrawals });
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
    if (actor.portal === "ISSUER") {
      const issuerPendingFees =
        (input.pendingTawidhAmount ?? 0) + (input.pendingGharamahAmount ?? 0);
      if (issuerPendingFees > 0.005) {
        throw new AppError(
          422,
          "ISSUER_PENDING_FEES_NOT_ALLOWED",
          "Late fee allowances on a receipt can only be set by an administrator"
        );
      }
    }
    const pendingLateFeeAmount = resolvePendingReceiptLateFeeAmount(note, input);
    assertReceiptAmountWithinSettlementLimit(
      note,
      openReceiptAmount + input.receiptAmount,
      pendingLateFeeAmount
    );
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
    assertReceiptAmountWithinSettlementLimit(
      note,
      grossReceipt,
      (input.tawidhAmount ?? 0) + (input.gharamahAmount ?? 0)
    );
    const includedPaymentIds = eligiblePayments.map((payment) => payment.id);
    const linkedPaymentId =
      input.paymentId && eligiblePayments.some((payment) => payment.id === input.paymentId)
        ? input.paymentId
        : eligiblePayments.length === 1
          ? eligiblePayments[0].id
          : null;

    const waterfall = calculateSettlementWaterfall({
      grossReceiptAmount: grossReceipt,
      fundedPrincipal: toNumber(note.funded_amount),
      profitRatePercent: toNumber(note.profit_rate_percent),
      serviceFeeRatePercent: toNumber(note.service_fee_rate_percent),
      tawidhAmount: input.tawidhAmount ?? 0,
      gharamahAmount: input.gharamahAmount ?? 0,
    });

    const snapshot = {
      ...waterfall,
      includedPaymentIds,
      allocations: note.investments.map((investment) => {
        const ratio =
          waterfall.investorPrincipal > 0
            ? toNumber(investment.amount) / waterfall.investorPrincipal
            : 0;
        return {
          investmentId: investment.id,
          investorOrganizationId: investment.investor_organization_id,
          principal: toNumber(investment.amount),
          profitNet: waterfall.investorProfitNet * ratio,
        };
      }),
    };

    const settlement = await prisma.noteSettlement.create({
      data: {
        note_id: id,
        payment_id: linkedPaymentId,
        gross_receipt_amount: money(grossReceipt),
        investor_principal: money(waterfall.investorPrincipal),
        investor_profit_gross: money(waterfall.investorProfitGross),
        service_fee_amount: money(waterfall.serviceFeeAmount),
        investor_profit_net: money(waterfall.investorProfitNet),
        tawidh_amount: money(waterfall.tawidhAmount),
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
    assertOpenReceiptsWithinSettlementLimit(
      settlement.note,
      toNumber(settlement.tawidh_amount) + toNumber(settlement.gharamah_amount)
    );
    if (settlement.status !== NoteSettlementStatus.PREVIEW) {
      throw new AppError(409, "SETTLEMENT_NOT_PREVIEW", "Only preview settlements can be approved");
    }
    assertSettlementAmountComplete(settlement);
    await assertRepaymentReceiptLedgerComplete(
      settlement.note_id,
      toNumber(settlement.gross_receipt_amount)
    );

    await prisma.noteSettlement.update({
      where: { id: settlementId },
      data: {
        status: NoteSettlementStatus.APPROVED,
        approved_by_user_id: actor.userId,
        approved_at: new Date(),
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
    assertOpenReceiptsWithinSettlementLimit(
      settlement.note,
      toNumber(settlement.tawidh_amount) + toNumber(settlement.gharamah_amount)
    );
    if (settlement.status !== NoteSettlementStatus.APPROVED) {
      throw new AppError(
        409,
        "SETTLEMENT_NOT_APPROVED",
        "Settlement must be approved before posting"
      );
    }
    assertSettlementAmountComplete(settlement);
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
      const settlementAllocations = resolveSettlementAllocations(settlement.preview_snapshot);
      await this.postSettlementLedger(tx, settlement, actor);
      await tx.noteSettlement.update({
        where: { id: settlementId },
        data: {
          status: NoteSettlementStatus.POSTED,
          posted_at: new Date(),
          idempotency_key: `settlement:${settlementId}`,
          ...(toNumber(settlement.service_fee_amount) > 0.005
            ? { service_fee_trustee_status: ServiceFeeTrusteeInstructionStatus.PENDING_LETTER }
            : {}),
        },
      });
      for (const allocation of settlementAllocations) {
        const releasedAmount = allocation.principal + allocation.profitNet;
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

    const schedule = note.payment_schedules[0] ?? null;
    const dueDate = schedule?.due_date ?? note.maturity_date;
    const checkDate = input.receiptDate ? new Date(input.receiptDate) : new Date();
    const receiptAmount = input.receiptAmount ?? resolveNoteSettlementAmount(note);

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
        suggestedTawidhAmount: 0,
        suggestedGharamahAmount: 0,
        message: "No due date is available for this note.",
      };
    }

    const total = calculateLateChargeValues({
      receiptAmount,
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
      suggestedTawidhAmount: overdue ? remainingTawidhAmount : 0,
      suggestedGharamahAmount: overdue ? remainingGharamahAmount : 0,
      message: !overdue
        ? "Payment is not overdue after the grace period."
        : remainingTawidhAmount <= 0 && remainingGharamahAmount <= 0
          ? "This payment is overdue, but all allowable late fees have already been applied."
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
        const daysPastDue = Math.max(0, daysBetweenCalendarDates(dueDate, checkDate));
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
    const feeAmount = toNumber(settlement.service_fee_amount);
    if (feeAmount <= 0.005) {
      throw new AppError(
        409,
        "NO_SERVICE_FEE",
        "This settlement has no service fee amount to document."
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
    const currency = "MYR";
    const postedAtLabel = settlement.posted_at
      ? settlement.posted_at.toISOString()
      : new Date().toISOString();
    const title = "Trustee Instruction — Service Fee (Internal Pool Transfer)";
    const buffer = await renderPdfBuffer(title, [
      ["Note reference", note.note_reference],
      ["Settlement ID", settlement.id],
      ["Issuer", listItem.issuerName ?? "—"],
      ["Paymaster", listItem.paymasterName ?? "—"],
      [
        "Movement",
        `Debit Repayment Pool → Credit Operating Account (service fee allocation for posted settlement)`,
      ],
      ["Amount", `${currency} ${feeAmount.toFixed(2)}`],
      ["Settlement posted at", postedAtLabel],
      ["Generated at", new Date().toISOString()],
    ]);
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
    if (toNumber(settlement.service_fee_amount) <= 0.005) {
      throw new AppError(409, "NO_SERVICE_FEE", "This settlement has no service fee instruction.");
    }
    const st = settlement.service_fee_trustee_status;
    if (st !== ServiceFeeTrusteeInstructionStatus.LETTER_GENERATED) {
      throw new AppError(
        409,
        "SERVICE_FEE_TRUSTEE_LETTER_REQUIRED",
        "Generate the trustee instruction PDF before marking it submitted."
      );
    }

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
    if (toNumber(settlement.service_fee_amount) <= 0.005) {
      throw new AppError(409, "NO_SERVICE_FEE", "This settlement has no service fee instruction.");
    }
    if (settlement.service_fee_trustee_status !== ServiceFeeTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE) {
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
          input.platformFeeRateCapPercent != null ? money(input.platformFeeRateCapPercent) : undefined,
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
          input.platformFeeRateCapPercent != null ? money(input.platformFeeRateCapPercent) : undefined,
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
        updated_by_user_id: actor.userId,
      },
    });
    return this.getPlatformFinanceSettings();
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

  async generateWithdrawalLetter(id: string, actor: ActorContext) {
    const withdrawal = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!withdrawal)
      throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal instruction not found");
    const buffer = await renderPdfBuffer("Trustee Withdrawal Instruction", [
      ["Withdrawal ID", withdrawal.id],
      ["Type", withdrawal.withdrawal_type],
      ["Amount", `${withdrawal.currency} ${toNumber(withdrawal.amount).toFixed(2)}`],
      ["Requested by", withdrawal.requested_by_user_id],
      ["Generated at", new Date().toISOString()],
    ]);
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
    actor: ActorContext
  ) {
    const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
    const operatingId = await this.getLedgerAccountId(tx, "OPERATING_ACCOUNT");
    const issuerPayableId = await this.getLedgerAccountId(tx, "ISSUER_PAYABLE");
    const fundedAmount = toNumber(note.funded_amount);
    const platformFee = fundedAmount * (toNumber(note.platform_fee_rate_percent) / 100);
    const netDisbursement = Math.max(0, fundedAmount - platformFee);
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
      update: {},
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
        "Ta'widh paid from repayment pool",
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
        settlement.tawidh_amount,
        "Ta'widh late charge",
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
