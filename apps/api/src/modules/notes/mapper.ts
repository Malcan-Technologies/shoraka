import { isSoukscoreRiskRating, roundNoteMoney, type IssuerResidualPayoutListStatus } from "@cashsouk/types";
import { NoteSettlementStatus, Prisma, WithdrawalStatus, WithdrawalType } from "@prisma/client";
import { sortAdminNoteEvents } from "./admin-note-events-sorting";

type NoteWithRelations = Prisma.NoteGetPayload<{
  include: {
    listing: true;
    investments: true;
    payment_schedules: true;
    payments: true;
    settlements: true;
    events: { orderBy: { created_at: "desc" } };
  };
}>;

type WithdrawalRecord =
  Prisma.WithdrawalInstructionGetPayload<Prisma.WithdrawalInstructionDefaultArgs>;

/**
 * Flattens legacy RegTank-shaped issuer bank details (`{ content: [{ fieldName, fieldValue }] }`)
 * onto the flat shape (`bank_name`, `account_number`, …) the trustee letter UI expects, while
 * preserving any already-flat keys. This lets historical DRAFT withdrawals display correctly
 * even though they were originally stored with the raw RegTank payload.
 */
function normaliseBeneficiarySnapshot(raw: Prisma.JsonValue | null): Record<string, unknown> {
  const record = asRecord(raw);
  if (!record) return {};
  const result: Record<string, unknown> = { ...record };
  const content = Array.isArray(record.content) ? record.content : null;
  if (!content) return result;

  const findField = (...candidates: string[]): string => {
    for (const entry of content) {
      const inner = asRecord(entry);
      const fieldName = typeof inner?.fieldName === "string" ? inner.fieldName.trim() : "";
      if (!fieldName) continue;
      if (!candidates.some((c) => fieldName.toLowerCase() === c.toLowerCase())) continue;
      const fieldValue = inner?.fieldValue;
      if (typeof fieldValue === "string" && fieldValue.trim() !== "") return fieldValue.trim();
    }
    return "";
  };

  const fillIfMissing = (key: string, value: string) => {
    if (!value) return;
    const existing = result[key];
    if (typeof existing !== "string" || existing.trim() === "") result[key] = value;
  };

  fillIfMissing("bank_name", findField("Bank", "Bank name"));
  fillIfMissing("account_number", findField("Bank account number", "Account number"));
  fillIfMissing("account_holder", findField("Account holder", "Account name", "Beneficiary name"));
  fillIfMissing("swift_code", findField("SWIFT", "SWIFT code", "Swift/BIC", "BIC"));
  fillIfMissing("branch", findField("Branch", "Branch name"));
  fillIfMissing("account_type", findField("Account type"));
  return result;
}

export function mapWithdrawalInstruction(withdrawal: WithdrawalRecord) {
  const hasShorakaCertificate = Boolean((withdrawal as WithdrawalRecordWithOptionalShorakaTradeOrder).shoraka_trade_order?.certificate_s3_key);
  const metadata = asRecord(withdrawal.metadata);
  const grossFundedAmount = metadata
    ? numberFromUnknownOrUndefined(metadata.grossFundedAmount)
    : undefined;
  const platformFeeAmount = metadata
    ? numberFromUnknownOrUndefined(metadata.platformFeeAmount)
    : undefined;
  const facilityFeeRatePercent = metadata
    ? numberFromUnknownOrUndefined(metadata.facilityFeeRatePercent)
    : undefined;
  const facilityFeeCap = metadata
    ? numberFromUnknownOrUndefined(metadata.facilityFeeCap)
    : undefined;
  const facilityFeePaidBefore = metadata
    ? numberFromUnknownOrUndefined(metadata.facilityFeePaidBefore)
    : undefined;
  const facilityFeeCharged = metadata
    ? numberFromUnknownOrUndefined(metadata.facilityFeeCharged)
    : undefined;
  const facilityFeeRemainingAfter = metadata
    ? numberFromUnknownOrUndefined(metadata.facilityFeeRemainingAfter)
    : undefined;
  const netIssuerDisbursement = metadata
    ? numberFromUnknownOrUndefined(metadata.netIssuerDisbursement)
    : undefined;

  return {
    id: withdrawal.id,
    noteId: withdrawal.note_id,
    settlementId: withdrawal.settlement_id,
    investorOrganizationId: withdrawal.investor_organization_id,
    issuerOrganizationId: withdrawal.issuer_organization_id,
    requestedByUserId: withdrawal.requested_by_user_id,
    submittedByUserId: withdrawal.submitted_by_user_id,
    status: withdrawal.status,
    withdrawalType: withdrawal.withdrawal_type,
    amount: moneyToNumber(withdrawal.amount),
    grossFundedAmount,
    platformFeeAmount,
    facilityFeeRatePercent,
    facilityFeeCap,
    facilityFeePaidBefore,
    facilityFeeCharged,
    facilityFeeRemainingAfter,
    netIssuerDisbursement,
    currency: withdrawal.currency,
    beneficiarySnapshot: normaliseBeneficiarySnapshot(withdrawal.beneficiary_snapshot),
    letterS3Key: withdrawal.letter_s3_key,
    generatedAt: iso(withdrawal.generated_at),
    submittedToTrusteeAt: iso(withdrawal.submitted_to_trustee_at),
    completedAt: iso(withdrawal.completed_at),
    createdAt: withdrawal.created_at.toISOString(),
    hasShorakaCertificate,
  };
}

type WithdrawalRecordWithOptionalShorakaTradeOrder = WithdrawalRecord & {
  shoraka_trade_order?: { certificate_s3_key: string | null } | null;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

/** Investor-visible money fields are rounded to 2dp at the API boundary. */
function moneyToNumber(value: Prisma.Decimal | number | null | undefined): number {
  return roundNoteMoney(decimalToNumber(value), 2);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asPaymentEvidenceFiles(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return null;
  const files = value
    .map((item) => {
      const entry = asRecord(item as Prisma.JsonValue);
      if (!entry) return null;
      const s3Key = typeof entry.s3Key === "string" ? entry.s3Key : "";
      const fileName = typeof entry.fileName === "string" ? entry.fileName : "";
      const contentType = typeof entry.contentType === "string" ? entry.contentType : "";
      const fileSize = numberFromUnknownOrUndefined(entry.fileSize);
      const uploadedAt = typeof entry.uploadedAt === "string" ? entry.uploadedAt : "";
      if (!s3Key || !fileName || !contentType || !fileSize || !uploadedAt) return null;
      return { s3Key, fileName, contentType, fileSize, uploadedAt };
    })
    .filter((item): item is {
      s3Key: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      uploadedAt: string;
    } => item !== null);
  return files.length > 0 ? files : null;
}

function numberFromUnknown(value: unknown): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function numberFromUnknownOrUndefined(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function resolveInvoiceAmount(note: NoteWithRelations): number {
  const invoiceSnapshot = asRecord(note.invoice_snapshot);
  const details = asRecord(invoiceSnapshot?.details as Prisma.JsonValue | null | undefined);
  const offerDetails = asRecord(
    invoiceSnapshot?.offer_details as Prisma.JsonValue | null | undefined
  );
  const amount =
    numberFromUnknown(details?.value) ||
    numberFromUnknown(details?.invoice_value) ||
    numberFromUnknown(details?.invoiceAmount) ||
    numberFromUnknown(offerDetails?.invoice_value) ||
    decimalToNumber(note.requested_amount);
  return roundNoteMoney(amount, 2);
}

function resolveRiskRating(note: NoteWithRelations) {
  const invoiceSnapshot = asRecord(note.invoice_snapshot);
  const offerDetails = asRecord(
    invoiceSnapshot?.offer_details as Prisma.JsonValue | null | undefined
  );
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : null;
}

function resolveIssuerName(note: NoteWithRelations): string | null {
  const issuer = asRecord(note.issuer_snapshot);
  const name = issuer?.name;
  return typeof name === "string" ? name : null;
}

function resolveIssuerIndustry(note: NoteWithRelations): string | null {
  const issuer = asRecord(note.issuer_snapshot);
  const industry = issuer?.industry;
  return typeof industry === "string" && industry.trim().length > 0 ? industry : null;
}

function resolvePaymasterName(note: NoteWithRelations): string | null {
  const paymaster = asRecord(note.paymaster_snapshot);
  const name = paymaster?.name ?? paymaster?.company_name ?? paymaster?.business_name;
  return typeof name === "string" ? name : null;
}

function resolveProductCategory(note: NoteWithRelations): string | null {
  const product = asRecord(note.product_snapshot);
  const category =
    product?.category ??
    product?.productCategory ??
    product?.financing_category ??
    product?.financingCategory;
  return typeof category === "string" && category.trim().length > 0 ? category.trim() : null;
}

/** Same rule as admin `productName`: first workflow step `config.name` or `config.type.name`. */
export function resolveProductNameFromWorkflow(
  workflow: Prisma.JsonValue | null | undefined
): string | null {
  if (!Array.isArray(workflow) || workflow.length === 0) return null;
  const first = workflow[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const config = asRecord((first as Record<string, unknown>).config as Prisma.JsonValue);
  if (!config) return null;
  const direct = config.name;
  if (typeof direct === "string" && direct.trim().length > 0) return direct.trim();
  const type = asRecord(config.type as Prisma.JsonValue);
  const typeName = type?.name;
  if (typeof typeName === "string" && typeName.trim().length > 0) return typeName.trim();
  return null;
}

function resolveProductName(note: NoteWithRelations): string | null {
  const product = asRecord(note.product_snapshot);
  if (product) {
    const candidates = [
      product.product_name,
      product.name,
      product.productName,
      product.productLabel,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
    }
  }
  return null;
}

function resolveSettlementSummary(note: NoteWithRelations) {
  const settlement = note.settlements.find((item) => item.status === "POSTED") ?? null;
  if (!settlement) return null;

  const operatingAccountAmount = moneyToNumber(settlement.service_fee_amount);
  const investorPoolAmount = roundNoteMoney(
    decimalToNumber(settlement.investor_principal) +
      decimalToNumber(settlement.investor_profit_net) +
      decimalToNumber(settlement.tawidh_investor_amount),
    2
  );
  const hasSettlementTrusteeMovement =
    investorPoolAmount > 0.005 ||
    operatingAccountAmount > 0.005 ||
    moneyToNumber(settlement.tawidh_account_amount) > 0.005 ||
    moneyToNumber(settlement.gharamah_amount) > 0.005 ||
    moneyToNumber(settlement.issuer_residual_amount) > 0.005;

  return {
    settlementId: settlement.id,
    status: settlement.status,
    grossReceiptAmount: moneyToNumber(settlement.gross_receipt_amount),
    investorPoolAmount,
    operatingAccountAmount,
    totalTawidhAmount: moneyToNumber(settlement.tawidh_amount),
    tawidhInvestorSharePercent: decimalToNumber(settlement.tawidh_investor_share_percent),
    tawidhInvestorAmount: moneyToNumber(settlement.tawidh_investor_amount),
    tawidhAccountAmount: moneyToNumber(settlement.tawidh_account_amount),
    gharamahAccountAmount: moneyToNumber(settlement.gharamah_amount),
    issuerResidualAmount: moneyToNumber(settlement.issuer_residual_amount),
    unappliedAmount: moneyToNumber(settlement.unapplied_amount),
    profitStartDate: iso(settlement.profit_start_date),
    profitMaturityDate: iso(settlement.profit_maturity_date),
    profitDays: settlement.profit_days,
    annualProfitRatePercent: decimalToNumber(settlement.annual_profit_rate_percent),
    postedAt: iso(settlement.posted_at),
    serviceFeeTrusteeStatus: hasSettlementTrusteeMovement
      ? (settlement.service_fee_trustee_status ?? null)
      : null,
    serviceFeeTrusteeCreatedAt: hasSettlementTrusteeMovement
      ? iso(settlement.service_fee_trustee_created_at)
      : null,
    serviceFeeTrusteeLetterGeneratedAt: hasSettlementTrusteeMovement
      ? iso(settlement.service_fee_trustee_letter_generated_at)
      : null,
    serviceFeeTrusteeSubmittedAt: hasSettlementTrusteeMovement
      ? iso(settlement.service_fee_trustee_submitted_at)
      : null,
    serviceFeeTrusteeCompletedAt: hasSettlementTrusteeMovement
      ? iso(settlement.service_fee_trustee_completed_at)
      : null,
  };
}

const ISSUER_RESIDUAL_AMOUNT_TOLERANCE = 0.005;

export function resolveIssuerResidualPayoutListStatus(
  note: NoteWithRelations,
  withdrawals: WithdrawalRecord[]
): IssuerResidualPayoutListStatus | undefined {
  const settlementSummary = resolveSettlementSummary(note);
  if (!settlementSummary) return undefined;
  if (settlementSummary.status !== NoteSettlementStatus.POSTED) return undefined;

  const { settlementId, issuerResidualAmount: residualAmount } = settlementSummary;
  if (residualAmount <= ISSUER_RESIDUAL_AMOUNT_TOLERANCE) {
    return { kind: "none" };
  }

  const strictRows = withdrawals.filter(
    (w) =>
      w.withdrawal_type === WithdrawalType.ISSUER_RESIDUAL_RETURN &&
      w.settlement_id === settlementId &&
      w.status !== WithdrawalStatus.CANCELLED
  );
  const rows =
    strictRows.length > 0
      ? strictRows
      : withdrawals.filter(
          (w) =>
            w.withdrawal_type === WithdrawalType.ISSUER_RESIDUAL_RETURN &&
            w.note_id === note.id &&
            w.status !== WithdrawalStatus.CANCELLED
        );

  const completed = rows.filter((w) => w.status === WithdrawalStatus.COMPLETED);
  const completedTotal = completed.reduce((sum, w) => sum + decimalToNumber(w.amount), 0);
  if (
    completed.length > 0 &&
    Math.abs(completedTotal - residualAmount) <= ISSUER_RESIDUAL_AMOUNT_TOLERANCE
  ) {
    return { kind: "paid" };
  }

  const inFlight = rows.find((w) => w.status !== WithdrawalStatus.COMPLETED);
  if (inFlight) {
    return {
      kind: "pending",
      withTrustee: inFlight.status === WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
    };
  }

  return { kind: "awaiting" };
}

function resolveFeaturedActive(note: NoteWithRelations) {
  if (!note.is_featured) return false;
  const now = new Date();
  const startsOk = !note.featured_from || note.featured_from <= now;
  const endsOk = !note.featured_until || note.featured_until >= now;
  return startsOk && endsOk;
}

export function mapNoteListItem(note: NoteWithRelations) {
  const targetAmount = moneyToNumber(note.target_amount);
  const fundedAmount = moneyToNumber(note.funded_amount);
  const invoiceAmount = resolveInvoiceAmount(note);
  const fundingPercent =
    targetAmount > 0 ? roundNoteMoney((fundedAmount / targetAmount) * 100, 1) : 0;

  return {
    id: note.id,
    noteReference: note.note_reference,
    title: note.title,
    productCategory: resolveProductCategory(note),
    productName: resolveProductName(note),
    issuerIndustry: resolveIssuerIndustry(note),
    sourceApplicationId: note.source_application_id,
    sourceContractId: note.source_contract_id,
    sourceInvoiceId: note.source_invoice_id,
    issuerOrganizationId: note.issuer_organization_id,
    issuerName: resolveIssuerName(note),
    paymasterName: resolvePaymasterName(note),
    riskRating: resolveRiskRating(note),
    status: note.status,
    listingStatus: note.listing_status,
    fundingStatus: note.funding_status,
    servicingStatus: note.servicing_status,
    requestedAmount: moneyToNumber(note.requested_amount),
    invoiceAmount,
    settlementAmount: invoiceAmount,
    targetAmount,
    fundedAmount,
    fundingPercent,
    minimumFundingPercent: decimalToNumber(note.minimum_funding_percent),
    profitRatePercent: note.profit_rate_percent ? decimalToNumber(note.profit_rate_percent) : null,
    platformFeeRatePercent: decimalToNumber(note.platform_fee_rate_percent),
    serviceFeeRatePercent: decimalToNumber(note.service_fee_rate_percent),
    isFeatured: note.is_featured,
    featuredRank: note.featured_rank,
    featuredFrom: iso(note.featured_from),
    featuredUntil: iso(note.featured_until),
    featuredActive: resolveFeaturedActive(note),
    maturityDate: iso(note.maturity_date),
    listingClosesAt: note.listing ? iso(note.listing.closes_at) : null,
    activatedAt: iso(note.activated_at),
    publishedAt: iso(note.published_at),
    settlementSummary: resolveSettlementSummary(note),
    createdAt: note.created_at.toISOString(),
    updatedAt: note.updated_at.toISOString(),
  };
}

export function mapNoteDetail(
  note: NoteWithRelations,
  options: { withdrawals?: WithdrawalRecord[]; includeEvents?: boolean } = {}
) {
  const withdrawals = options.withdrawals ?? [];
  const includeEvents = options.includeEvents ?? true;

  const sortedEvents = includeEvents
    ? sortAdminNoteEvents(
        note.events.map((event) => ({
          id: event.id,
          eventType: event.event_type,
          createdAt: event.created_at,
        })),
        "newest-first"
      )
    : [];

  return {
    ...mapNoteListItem(note),
    issuerResidualPayout: resolveIssuerResidualPayoutListStatus(note, withdrawals),
    productSnapshot: asRecord(note.product_snapshot),
    issuerSnapshot: asRecord(note.issuer_snapshot) ?? {},
    paymasterSnapshot: asRecord(note.paymaster_snapshot),
    contractSnapshot: asRecord(note.contract_snapshot),
    invoiceSnapshot: asRecord(note.invoice_snapshot),
    serviceFeeCustomerScope: note.service_fee_customer_scope,
    gracePeriodDays: note.grace_period_days,
    arrearsThresholdDays: note.arrears_threshold_days,
    tawidhRateCapPercent: decimalToNumber(note.tawidh_rate_cap_percent),
    gharamahRateCapPercent: decimalToNumber(note.gharamah_rate_cap_percent),
    defaultMarkedAt: iso(note.default_marked_at),
    defaultReason: note.default_reason,
    listing: note.listing
      ? {
          id: note.listing.id,
          noteId: note.listing.note_id,
          status: note.listing.status,
          opensAt: iso(note.listing.opens_at),
          closesAt: iso(note.listing.closes_at),
          publishedAt: iso(note.listing.published_at),
          unpublishedAt: iso(note.listing.unpublished_at),
          visibility: note.listing.visibility,
          summary: note.listing.summary,
          riskDisclosure: asRecord(note.listing.risk_disclosure),
        }
      : null,
    investments: note.investments.map((investment) => ({
      id: investment.id,
      noteId: investment.note_id,
      investorOrganizationId: investment.investor_organization_id,
      investorUserId: investment.investor_user_id,
      status: investment.status,
      amount: moneyToNumber(investment.amount),
      allocationPercent: decimalToNumber(investment.allocation_percent),
      committedAt: investment.committed_at.toISOString(),
      confirmedAt: iso(investment.confirmed_at),
      releasedAt: iso(investment.released_at),
    })),
    paymentSchedules: note.payment_schedules.map((schedule) => ({
      id: schedule.id,
      noteId: schedule.note_id,
      status: schedule.status,
      sequence: schedule.sequence,
      dueDate: schedule.due_date.toISOString(),
      expectedPrincipal: moneyToNumber(schedule.expected_principal),
      expectedProfit: moneyToNumber(schedule.expected_profit),
      expectedTotal: moneyToNumber(schedule.expected_total),
      paidPrincipal: moneyToNumber(schedule.paid_principal),
      paidProfit: moneyToNumber(schedule.paid_profit),
      paidTotal: moneyToNumber(schedule.paid_total),
    })),
    payments: note.payments.map((payment) => ({
      id: payment.id,
      noteId: payment.note_id,
      scheduleId: payment.schedule_id,
      source: payment.source,
      status: payment.status,
      receiptAmount: moneyToNumber(payment.receipt_amount),
      receiptDate: payment.receipt_date.toISOString(),
      receivedIntoAccountCode: payment.received_into_account_code,
      evidenceS3Key: payment.evidence_s3_key,
      evidenceFiles: asPaymentEvidenceFiles(payment.evidence_files),
      reference: payment.reference,
      recordedByUserId: payment.recorded_by_user_id,
      reconciledByUserId: payment.reconciled_by_user_id,
      reconciledAt: iso(payment.reconciled_at),
      metadata: asRecord(payment.metadata),
    })),
    settlements: note.settlements.map((settlement) => ({
      id: settlement.id,
      noteId: settlement.note_id,
      paymentId: settlement.payment_id,
      status: settlement.status,
      settlementType: settlement.settlement_type,
      grossReceiptAmount: moneyToNumber(settlement.gross_receipt_amount),
      investorPrincipal: moneyToNumber(settlement.investor_principal),
      profitStartDate: iso(settlement.profit_start_date),
      profitMaturityDate: iso(settlement.profit_maturity_date),
      profitDays: settlement.profit_days,
      annualProfitRatePercent: decimalToNumber(settlement.annual_profit_rate_percent),
      investorProfitGross: moneyToNumber(settlement.investor_profit_gross),
      serviceFeeAmount: moneyToNumber(settlement.service_fee_amount),
      investorProfitNet: moneyToNumber(settlement.investor_profit_net),
      tawidhAmount: moneyToNumber(settlement.tawidh_amount),
      tawidhInvestorSharePercent: decimalToNumber(settlement.tawidh_investor_share_percent),
      tawidhInvestorAmount: moneyToNumber(settlement.tawidh_investor_amount),
      tawidhAccountAmount: moneyToNumber(settlement.tawidh_account_amount),
      gharamahAmount: moneyToNumber(settlement.gharamah_amount),
      issuerResidualAmount: moneyToNumber(settlement.issuer_residual_amount),
      unappliedAmount: moneyToNumber(settlement.unapplied_amount),
      previewSnapshot: asRecord(settlement.preview_snapshot) ?? {},
      approvedAt: iso(settlement.approved_at),
      postedAt: iso(settlement.posted_at),
      serviceFeeTrusteeStatus: settlement.service_fee_trustee_status ?? null,
      serviceFeeTrusteeCreatedAt: iso(settlement.service_fee_trustee_created_at),
      serviceFeeTrusteeLetterGeneratedAt: iso(settlement.service_fee_trustee_letter_generated_at),
      serviceFeeTrusteeSubmittedAt: iso(settlement.service_fee_trustee_submitted_at),
      serviceFeeTrusteeCompletedAt: iso(settlement.service_fee_trustee_completed_at),
    })),
    events: includeEvents
      ? sortedEvents.map((sortedEvent) => {
          const event = note.events.find((e) => e.id === sortedEvent.id);
          if (!event) {
            // Defensive fallback for unexpected missing events.
            return {
              id: sortedEvent.id,
              noteId: note.id,
              eventType: sortedEvent.eventType,
              actorUserId: null,
              actorRole: null,
              portal: null,
              correlationId: null,
              metadata: null,
              createdAt: new Date(sortedEvent.createdAt).toISOString(),
            };
          }

          return {
            id: event.id,
            noteId: event.note_id,
            eventType: event.event_type,
            actorUserId: event.actor_user_id,
            actorRole: event.actor_role,
            portal: event.portal,
            correlationId: event.correlation_id,
            metadata: asRecord(event.metadata),
            createdAt: event.created_at.toISOString(),
          };
        })
      : [],
    withdrawals: withdrawals.map(mapWithdrawalInstruction),
  };
}

export function mapMarketplaceNoteDetail(note: NoteWithRelations) {
  return {
    ...mapNoteListItem(note),
    listing: note.listing
      ? {
          id: note.listing.id,
          noteId: note.listing.note_id,
          status: note.listing.status,
          opensAt: iso(note.listing.opens_at),
          closesAt: iso(note.listing.closes_at),
          publishedAt: iso(note.listing.published_at),
          visibility: note.listing.visibility,
          summary: note.listing.summary,
          riskDisclosure: asRecord(note.listing.risk_disclosure),
        }
      : null,
  };
}

export function mapLedgerEntry(
  entry: Prisma.NoteLedgerEntryGetPayload<{
    include: { account: true };
  }>
) {
  return {
    id: entry.id,
    noteId: entry.note_id,
    accountCode: entry.account.code,
    accountName: entry.account.name,
    direction: entry.direction,
    amount: moneyToNumber(entry.amount),
    currency: entry.currency,
    description: entry.description,
    idempotencyKey: entry.idempotency_key,
    postedAt: entry.posted_at.toISOString(),
    metadata: asRecord(entry.metadata),
  };
}
