import { Prisma } from "@prisma/client";

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

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function resolveInvoiceAmount(note: NoteWithRelations): number {
  const invoiceSnapshot = asRecord(note.invoice_snapshot);
  const details = asRecord(invoiceSnapshot?.details as Prisma.JsonValue | null | undefined);
  const offerDetails = asRecord(invoiceSnapshot?.offer_details as Prisma.JsonValue | null | undefined);
  return (
    numberFromUnknown(details?.value) ||
    numberFromUnknown(details?.invoice_value) ||
    numberFromUnknown(details?.invoiceAmount) ||
    numberFromUnknown(offerDetails?.invoice_value) ||
    numberFromUnknown(note.requested_amount)
  );
}

function resolveRiskRating(note: NoteWithRelations) {
  const invoiceSnapshot = asRecord(note.invoice_snapshot);
  const offerDetails = asRecord(invoiceSnapshot?.offer_details as Prisma.JsonValue | null | undefined);
  const riskRating = offerDetails?.risk_rating;
  return riskRating === "A" || riskRating === "B" || riskRating === "C" ? riskRating : null;
}

function resolveIssuerName(note: NoteWithRelations): string | null {
  const issuer = asRecord(note.issuer_snapshot);
  const name = issuer?.name;
  return typeof name === "string" ? name : null;
}

function resolvePaymasterName(note: NoteWithRelations): string | null {
  const paymaster = asRecord(note.paymaster_snapshot);
  const name = paymaster?.name ?? paymaster?.company_name ?? paymaster?.business_name;
  return typeof name === "string" ? name : null;
}

function resolveSettlementSummary(note: NoteWithRelations) {
  const settlement =
    note.settlements.find((item) => item.status === "POSTED") ??
    note.settlements.find((item) => item.status === "APPROVED") ??
    null;
  if (!settlement) return null;

  return {
    settlementId: settlement.id,
    status: settlement.status,
    grossReceiptAmount: decimalToNumber(settlement.gross_receipt_amount),
    investorPoolAmount:
      decimalToNumber(settlement.investor_principal) + decimalToNumber(settlement.investor_profit_net),
    operatingAccountAmount: decimalToNumber(settlement.service_fee_amount),
    tawidhAccountAmount: decimalToNumber(settlement.tawidh_amount),
    gharamahAccountAmount: decimalToNumber(settlement.gharamah_amount),
    issuerResidualAmount: decimalToNumber(settlement.issuer_residual_amount),
    unappliedAmount: decimalToNumber(settlement.unapplied_amount),
    postedAt: iso(settlement.posted_at),
  };
}

export function mapNoteListItem(note: NoteWithRelations) {
  const targetAmount = decimalToNumber(note.target_amount);
  const fundedAmount = decimalToNumber(note.funded_amount);
  const invoiceAmount = resolveInvoiceAmount(note);
  const fundingPercent = targetAmount > 0 ? (fundedAmount / targetAmount) * 100 : 0;

  return {
    id: note.id,
    noteReference: note.note_reference,
    title: note.title,
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
    requestedAmount: decimalToNumber(note.requested_amount),
    invoiceAmount,
    settlementAmount: invoiceAmount,
    targetAmount,
    fundedAmount,
    fundingPercent,
    minimumFundingPercent: decimalToNumber(note.minimum_funding_percent),
    profitRatePercent: note.profit_rate_percent ? decimalToNumber(note.profit_rate_percent) : null,
    platformFeeRatePercent: decimalToNumber(note.platform_fee_rate_percent),
    serviceFeeRatePercent: decimalToNumber(note.service_fee_rate_percent),
    maturityDate: iso(note.maturity_date),
    publishedAt: iso(note.published_at),
    settlementSummary: resolveSettlementSummary(note),
    createdAt: note.created_at.toISOString(),
    updatedAt: note.updated_at.toISOString(),
  };
}

export function mapNoteDetail(note: NoteWithRelations) {
  return {
    ...mapNoteListItem(note),
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
      amount: decimalToNumber(investment.amount),
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
      expectedPrincipal: decimalToNumber(schedule.expected_principal),
      expectedProfit: decimalToNumber(schedule.expected_profit),
      expectedTotal: decimalToNumber(schedule.expected_total),
      paidPrincipal: decimalToNumber(schedule.paid_principal),
      paidProfit: decimalToNumber(schedule.paid_profit),
      paidTotal: decimalToNumber(schedule.paid_total),
    })),
    payments: note.payments.map((payment) => ({
      id: payment.id,
      noteId: payment.note_id,
      scheduleId: payment.schedule_id,
      source: payment.source,
      status: payment.status,
      receiptAmount: decimalToNumber(payment.receipt_amount),
      receiptDate: payment.receipt_date.toISOString(),
      receivedIntoAccountCode: payment.received_into_account_code,
      evidenceS3Key: payment.evidence_s3_key,
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
      grossReceiptAmount: decimalToNumber(settlement.gross_receipt_amount),
      investorPrincipal: decimalToNumber(settlement.investor_principal),
      investorProfitGross: decimalToNumber(settlement.investor_profit_gross),
      serviceFeeAmount: decimalToNumber(settlement.service_fee_amount),
      investorProfitNet: decimalToNumber(settlement.investor_profit_net),
      tawidhAmount: decimalToNumber(settlement.tawidh_amount),
      gharamahAmount: decimalToNumber(settlement.gharamah_amount),
      issuerResidualAmount: decimalToNumber(settlement.issuer_residual_amount),
      unappliedAmount: decimalToNumber(settlement.unapplied_amount),
      previewSnapshot: asRecord(settlement.preview_snapshot) ?? {},
      approvedAt: iso(settlement.approved_at),
      postedAt: iso(settlement.posted_at),
    })),
    events: note.events.map((event) => ({
      id: event.id,
      noteId: event.note_id,
      eventType: event.event_type,
      actorUserId: event.actor_user_id,
      actorRole: event.actor_role,
      portal: event.portal,
      correlationId: event.correlation_id,
      metadata: asRecord(event.metadata),
      createdAt: event.created_at.toISOString(),
    })),
  };
}

export function mapLedgerEntry(entry: Prisma.NoteLedgerEntryGetPayload<{
  include: { account: true };
}>) {
  return {
    id: entry.id,
    noteId: entry.note_id,
    accountCode: entry.account.code,
    accountName: entry.account.name,
    direction: entry.direction,
    amount: decimalToNumber(entry.amount),
    currency: entry.currency,
    description: entry.description,
    idempotencyKey: entry.idempotency_key,
    postedAt: entry.posted_at.toISOString(),
    metadata: asRecord(entry.metadata),
  };
}

