import { createHash } from "crypto";
import {
  NoteInvestmentCertificateStatus,
  NoteSettlementStatus,
  type Prisma,
} from "@prisma/client";
import {
  formatUtcCalendarDateEnMy,
  NOTE_MONEY_DECIMALS,
  NOTE_MONEY_TOLERANCE,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
  roundNoteMoney,
} from "@cashsouk/types";
import { prisma } from "../../../lib/prisma";
import { latestIncludedReceiptDate } from "../tenure-settlement";
import {
  CERTIFICATE_FIRST_VERSION,
  investorScheduleReferenceFor,
} from "../investment-note-certificate/types";
import { parseCertificateSnapshot } from "../investment-note-certificate/snapshot";
import { isNoteFullySettledForHibahReceipt, isTenureNote } from "./eligibility";
import {
  HIBAH_ACTING_THROUGH,
  HIBAH_GRANTOR,
  RECEIPT_FIRST_VERSION,
  RECEIPT_TEMPLATE_ID,
  ReceiptGenerationError,
  SETTLEMENT_CONFIRMATION_COPY,
  SETTLEMENT_STATUS_LABEL,
  formatPaymentReferences,
  type ClearedValueDateSource,
  type ReceiptGenerationSource,
  type SettlementHibahReceiptSnapshot,
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

function displayUtcDate(value: Date | string | null | undefined): string {
  return formatUtcCalendarDateEnMy(value) ?? "—";
}

function formatReceiptDateMy(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(value);
}

function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function includedPaymentIdsFromSnapshot(previewSnapshot: unknown): string[] {
  const record = asRecord(previewSnapshot);
  const raw = record?.includedPaymentIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string" && value.trim() !== "");
}

export function reconcileHibahReceiptAmounts(input: {
  grossReceiptAmount: number;
  investorPrincipal: number;
  investorProfitGross: number;
  tawidhAmount: number;
  gharamahAmount: number;
  unpaidContractualFees: number;
  priorPaymentsCredits: number;
  hibahAmount: number;
  unallocatedBalance: number;
}): {
  totalApplied: number;
  totalAllocated: number;
} {
  const totalApplied = roundNoteMoney(
    input.investorPrincipal +
      input.investorProfitGross +
      input.unpaidContractualFees +
      input.tawidhAmount +
      input.gharamahAmount -
      input.priorPaymentsCredits,
    NOTE_MONEY_DECIMALS
  );
  const expectedApplied = roundNoteMoney(
    input.grossReceiptAmount - input.hibahAmount,
    NOTE_MONEY_DECIMALS
  );
  if (Math.abs(totalApplied - expectedApplied) > NOTE_MONEY_TOLERANCE) {
    throw new ReceiptGenerationError(
      "Settlement receipt amounts do not reconcile (applied vs gross minus Hibah)",
      "RECONCILIATION_FAILED"
    );
  }
  const expectedHibah = roundNoteMoney(
    input.grossReceiptAmount -
      input.investorPrincipal -
      input.investorProfitGross -
      input.tawidhAmount -
      input.gharamahAmount -
      input.unpaidContractualFees +
      input.priorPaymentsCredits,
    NOTE_MONEY_DECIMALS
  );
  if (Math.abs(expectedHibah - input.hibahAmount) > NOTE_MONEY_TOLERANCE) {
    throw new ReceiptGenerationError(
      "Settlement receipt Hibah does not match posted issuer residual",
      "RECONCILIATION_FAILED"
    );
  }
  const totalAllocated = roundNoteMoney(totalApplied + input.hibahAmount, NOTE_MONEY_DECIMALS);
  if (Math.abs(totalAllocated - input.grossReceiptAmount) > NOTE_MONEY_TOLERANCE) {
    throw new ReceiptGenerationError(
      "Settlement receipt total allocated does not equal gross collection",
      "RECONCILIATION_FAILED"
    );
  }
  return { totalApplied, totalAllocated };
}

function isValidPersistedSnapshot(value: unknown): value is SettlementHibahReceiptSnapshot {
  const record = asRecord(value);
  return Boolean(
    nonEmpty(record?.receiptNumber) &&
      nonEmpty(record?.settlementId) &&
      typeof record?.grossReceiptAmount === "number" &&
      typeof record?.hibahAmount === "number" &&
      nonEmpty(record?.clearedValueDate)
  );
}

export function parseHibahReceiptSnapshot(
  value: unknown
): SettlementHibahReceiptSnapshot | null {
  return isValidPersistedSnapshot(value) ? (value as SettlementHibahReceiptSnapshot) : null;
}

function resolveInvoiceFaceValue(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount?: Prisma.Decimal | number | string | null;
}): number {
  const invoice = asRecord(note.invoice_snapshot);
  const details = asRecord(invoice?.details);
  const offerDetails = asRecord(invoice?.offer_details);
  return money2(
    toNumber(details?.value) ||
      toNumber(details?.invoice_value) ||
      toNumber(details?.invoiceAmount) ||
      toNumber(offerDetails?.invoice_value) ||
      toNumber(note.requested_amount)
  );
}

function resolveInvoiceReference(invoiceSnapshot: unknown): string {
  const invoice = asRecord(invoiceSnapshot);
  const details = asRecord(invoice?.details);
  return (
    nonEmpty(details?.number) ??
    nonEmpty(details?.invoice_number) ??
    nonEmpty(details?.invoiceNumber) ??
    "—"
  );
}

function resolvePaymasterName(paymasterSnapshot: unknown): string {
  const snap = asRecord(paymasterSnapshot);
  return nonEmpty(snap?.name) ?? nonEmpty(snap?.legal_name) ?? "—";
}

/**
 * Build the immutable issuer receipt snapshot from the POSTED settlement row.
 * Does not recalculate the waterfall.
 */
export async function buildSettlementHibahReceiptSnapshot(
  noteId: string,
  source: ReceiptGenerationSource,
  generatedAt = new Date()
): Promise<SettlementHibahReceiptSnapshot> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      note_reference: true,
      status: true,
      servicing_status: true,
      tenure_days: true,
      issuer_organization_id: true,
      source_contract_id: true,
      issuer_snapshot: true,
      paymaster_snapshot: true,
      invoice_snapshot: true,
      requested_amount: true,
      maturity_date: true,
    },
  });
  if (!note) {
    throw new ReceiptGenerationError("Note not found", "INCOMPLETE_DATA");
  }
  if (!isNoteFullySettledForHibahReceipt(note)) {
    throw new ReceiptGenerationError(
      "Settlement & Hibah Receipt is only issued after the financing is fully settled",
      "NOT_ELIGIBLE"
    );
  }

  const settlement = await prisma.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
  });
  if (!settlement) {
    throw new ReceiptGenerationError("Posted settlement not found", "NOT_ELIGIBLE");
  }

  const receiptNumber = nonEmpty(settlement.display_reference);
  if (!receiptNumber) {
    throw new ReceiptGenerationError(
      "Settlement display reference is missing; cannot issue the receipt number",
      "INCOMPLETE_DATA"
    );
  }

  const includedPaymentIds = includedPaymentIdsFromSnapshot(settlement.preview_snapshot);
  const paymentWhere =
    includedPaymentIds.length > 0
      ? { note_id: noteId, id: { in: includedPaymentIds } }
      : settlement.payment_id
        ? { note_id: noteId, id: settlement.payment_id }
        : null;
  const payments = paymentWhere
    ? await prisma.notePayment.findMany({
        where: paymentWhere,
        select: { id: true, reference: true, receipt_date: true },
        orderBy: [{ receipt_date: "asc" }, { id: "asc" }],
      })
    : [];

  const tenure = isTenureNote(note.tenure_days);
  let clearedDate: Date | null = settlement.actual_settlement_date;
  let clearedValueDateSource: ClearedValueDateSource = "ACTUAL_SETTLEMENT_DATE";
  if (!clearedDate) {
    if (tenure) {
      throw new ReceiptGenerationError(
        "Tenure notes require actual_settlement_date before the Settlement & Hibah Receipt can be issued",
        "INCOMPLETE_DATA"
      );
    }
    const fallback = latestIncludedReceiptDate(payments);
    if (!fallback) {
      throw new ReceiptGenerationError(
        "No defensible cleared value date is available for this legacy settlement",
        "INCOMPLETE_DATA"
      );
    }
    clearedDate = fallback;
    clearedValueDateSource = "INCLUDED_PAYMENT_RECEIPT_DATE";
  }

  const grossReceiptAmount = money2(settlement.gross_receipt_amount);
  const investorPrincipal = money2(settlement.investor_principal);
  const investorProfitGross = money2(settlement.investor_profit_gross);
  const tawidhAmount = money2(settlement.tawidh_amount);
  const gharamahAmount = money2(settlement.gharamah_amount);
  const hibahAmount = money2(settlement.issuer_residual_amount);
  const unallocatedBalance = money2(settlement.unapplied_amount);
  const unpaidContractualFees = 0;
  const priorPaymentsCredits = 0;
  const { totalApplied, totalAllocated } = reconcileHibahReceiptAmounts({
    grossReceiptAmount,
    investorPrincipal,
    investorProfitGross,
    tawidhAmount,
    gharamahAmount,
    unpaidContractualFees,
    priorPaymentsCredits,
    hibahAmount,
    unallocatedBalance,
  });

  const [issuerOrg, facility, readyCertificate] = await Promise.all([
    prisma.issuerOrganization.findUnique({
      where: { id: note.issuer_organization_id },
      select: { display_reference: true },
    }),
    note.source_contract_id
      ? prisma.contract.findUnique({
          where: { id: note.source_contract_id },
          select: { display_reference: true },
        })
      : Promise.resolve(null),
    prisma.noteInvestmentCertificate.findFirst({
      where: {
        note_id: noteId,
        version: CERTIFICATE_FIRST_VERSION,
        status: NoteInvestmentCertificateStatus.READY,
      },
      orderBy: { created_at: "asc" },
      select: { snapshot: true, version: true },
    }),
  ]);

  let investorScheduleReference = investorScheduleReferenceFor(
    note.note_reference,
    CERTIFICATE_FIRST_VERSION
  );
  if (readyCertificate?.version === CERTIFICATE_FIRST_VERSION) {
    const certificateSnapshot = parseCertificateSnapshot(readyCertificate.snapshot);
    const fromCertificate = nonEmpty(certificateSnapshot?.investorSchedule.scheduleReference);
    if (fromCertificate) investorScheduleReference = fromCertificate;
  }

  const issuerSnapshot = asRecord(note.issuer_snapshot);
  const issuerLegalName = nonEmpty(issuerSnapshot?.name) ?? "—";
  const issuerCompanyNumber = nonEmpty(issuerSnapshot?.registration_number) ?? "—";
  const clearedIso = isoDate(clearedDate);
  if (!clearedIso) {
    throw new ReceiptGenerationError(
      "No defensible cleared value date is available",
      "INCOMPLETE_DATA"
    );
  }
  const clearedDisplay = displayUtcDate(clearedDate);
  const maturityIso = isoDate(note.maturity_date);

  const withoutHash = {
    templateId: RECEIPT_TEMPLATE_ID,
    templateVersion: RECEIPT_FIRST_VERSION,
    snapshotGeneratedAt: generatedAt.toISOString(),
    snapshotSha256: "",
    source,
    receiptNumber,
    version: RECEIPT_FIRST_VERSION,
    receiptDate: generatedAt.toISOString(),
    receiptDateDisplay: formatReceiptDateMy(generatedAt),
    settlementId: settlement.id,
    settlementReference: receiptNumber,
    noteId: note.id,
    noteReference: note.note_reference,
    facilityReference: nonEmpty(facility?.display_reference),
    issuerReference: nonEmpty(issuerOrg?.display_reference) ?? note.issuer_organization_id,
    issuerLegalName,
    issuerCompanyNumber,
    paymasterName: resolvePaymasterName(note.paymaster_snapshot),
    invoiceNumber: resolveInvoiceReference(note.invoice_snapshot),
    invoiceFaceValue: resolveInvoiceFaceValue(note),
    maturityDate: maturityIso,
    maturityDateDisplay: displayUtcDate(note.maturity_date),
    clearedValueDate: clearedIso,
    clearedValueDateDisplay: clearedDisplay,
    clearedValueDateSource,
    paymentDate: clearedIso,
    paymentDateDisplay: clearedDisplay,
    paymentReference: formatPaymentReferences(payments.map((row) => row.reference ?? "")),
    settlementStatus: SETTLEMENT_STATUS_LABEL,
    grossReceiptAmount,
    investorPrincipal,
    investorProfitGross,
    unpaidContractualFees,
    tawidhAmount,
    gharamahAmount,
    priorPaymentsCredits,
    totalApplied,
    hibahAmount,
    totalAllocated,
    unallocatedBalance,
    investorScheduleReference,
    hibahGrantor: HIBAH_GRANTOR,
    hibahRecipient: issuerLegalName,
    actingThrough: HIBAH_ACTING_THROUGH,
    shariahStructure: PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
    confirmationCopy: SETTLEMENT_CONFIRMATION_COPY,
  };

  return {
    ...withoutHash,
    snapshotSha256: canonicalJsonSha256(withoutHash),
  };
}
