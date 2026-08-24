import {
  formatInvoiceReference,
  getActivityStatusLabel,
  getActivityStatusToken,
  InvoiceStatus,
  parseInvoiceFeeSchedule,
  computeAdditionalFeeAmount,
  parseFacilityFeeCollectionWaiver,
  type ActivityStatusToken,
} from "@cashsouk/types";
import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import {
  asContractForModal,
  asInvoiceForModal,
  type IssuerDashboardContract,
  type IssuerDashboardInvoice,
} from "@/types/issuer-dashboard";

export type FacilityTransactionNoteInput = {
  id: string;
  noteReference: string;
  sourceInvoiceId: string | null;
  sourceContractId: string | null;
  publishedAt: string | null;
  fundingClosedAt: string | null;
  activatedAt: string | null;
  repaidAt: string | null;
  fundingStatus: string;
  fundedAmount: number | string | null;
};

export type FacilityTransactionRow = {
  id: string;
  at: string | null;
  label: string;
  description: string | null;
  amount: number | null;
  referenceLabel: string | null;
  href: string | null;
  statusToken: ActivityStatusToken;
  statusLabel: string;
};

const LOG_LABELS: Record<string, string> = {
  APPLICATION_CREATED: "Facility application started",
  APPLICATION_SUBMITTED: "Facility application submitted",
  APPLICATION_RESUBMITTED: "Facility application resubmitted",
  APPLICATION_APPROVED: "Facility application approved",
  APPLICATION_REJECTED: "Facility application was not approved",
  APPLICATION_WITHDRAWN: "Facility application withdrawn",
  APPLICATION_COMPLETED: "Facility application completed",
  AMENDMENTS_SUBMITTED: "Changes requested",
  CONTRACT_OFFER_SENT: "Facility offer sent",
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "Facility acceptance submitted",
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "Facility acceptance resubmitted",
  CONTRACT_OFFER_ACCEPTED: "Facility offer signed",
  CONTRACT_OFFER_REJECTED: "Facility offer declined",
  CONTRACT_OFFER_RETRACTED: "Facility offer withdrawn by CashSouk",
  CONTRACT_OFFER_EXPIRED: "Facility offer expired",
  CONTRACT_WITHDRAWN: "Facility offer declined",
  INVOICE_OFFER_SENT: "Invoice offer sent",
  INVOICE_OFFER_ACCEPTANCE_SUBMITTED: "Invoice acceptance submitted",
  INVOICE_OFFER_ACCEPTANCE_RESUBMITTED: "Invoice acceptance resubmitted",
  INVOICE_OFFER_ACCEPTED: "Invoice offer signed",
  INVOICE_OFFER_REJECTED: "Invoice offer declined",
  INVOICE_OFFER_RETRACTED: "Invoice offer withdrawn by CashSouk",
  INVOICE_OFFER_EXPIRED: "Invoice offer expired",
  INVOICE_WITHDRAWN: "Invoice withdrawn",
  OFFER_EXPIRED: "An offer expired",
  SIGNING_PACKAGE_SENT: "Signing package sent",
  SIGNING_PACKAGE_COMPLETED: "Signing package completed",
};

const INVOICE_LOG_TYPES = new Set([
  "INVOICE_OFFER_SENT",
  "INVOICE_OFFER_ACCEPTANCE_SUBMITTED",
  "INVOICE_OFFER_ACCEPTANCE_RESUBMITTED",
  "INVOICE_OFFER_ACCEPTED",
  "INVOICE_OFFER_REJECTED",
  "INVOICE_OFFER_RETRACTED",
  "INVOICE_OFFER_EXPIRED",
  "INVOICE_WITHDRAWN",
]);

function parseAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/^RM\s*/i, "")
    .replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function invoiceReference(invoice: IssuerDashboardInvoice): string {
  return formatInvoiceReference({
    displayReference: invoice.displayReference,
    businessNumber: invoice.invoiceNumber,
    id: invoice.id,
  });
}

function logEntityId(log: ApplicationLogEntry): string | null {
  return log.entityId ?? log.entity_id ?? null;
}

function logInvoiceId(
  log: ApplicationLogEntry,
  invoices: readonly IssuerDashboardInvoice[]
): string | null {
  const entity = logEntityId(log);
  if (entity && invoices.some((invoice) => invoice.id === entity)) return entity;
  const metadata = log.metadata;
  const fromMeta =
    typeof metadata?.invoiceId === "string"
      ? metadata.invoiceId
      : typeof metadata?.invoice_id === "string"
        ? metadata.invoice_id
        : null;
  if (fromMeta && invoices.some((invoice) => invoice.id === fromMeta)) return fromMeta;
  return null;
}

function logHasEvent(
  logs: readonly ApplicationLogEntry[],
  invoices: readonly IssuerDashboardInvoice[],
  eventType: string,
  invoiceId?: string
): boolean {
  return logs.some((log) => {
    if (log.event_type !== eventType) return false;
    if (!invoiceId) return true;
    const matched = logInvoiceId(log, invoices);
    return matched == null || matched === invoiceId;
  });
}

function sortNewestFirst(rows: FacilityTransactionRow[]): FacilityTransactionRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : 0;
    const tb = b.at ? Date.parse(b.at) : 0;
    if (tb !== ta) return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    return a.id.localeCompare(b.id);
  });
}

function rowFromKind(input: {
  id: string;
  at: string | null;
  label: string;
  description?: string | null;
  amount?: number | null;
  referenceLabel?: string | null;
  href?: string | null;
  eventType: string;
  statusToken: ActivityStatusToken;
}): FacilityTransactionRow {
  return {
    id: input.id,
    at: input.at,
    label: input.label,
    description: input.description ?? null,
    amount: input.amount ?? null,
    referenceLabel: input.referenceLabel ?? null,
    href: input.href ?? null,
    statusToken: input.statusToken,
    statusLabel: getActivityStatusLabel(input.eventType),
  };
}

function pushDerived(
  rows: FacilityTransactionRow[],
  input: {
    id: string;
    at: string | null | undefined;
    label: string;
    description?: string | null;
    amount?: number | null;
    referenceLabel?: string | null;
    href?: string | null;
    eventType: string;
    statusToken: ActivityStatusToken;
  }
) {
  if (!input.at) return;
  rows.push(
    rowFromKind({
      id: input.id,
      at: input.at,
      label: input.label,
      description: input.description,
      amount: input.amount,
      referenceLabel: input.referenceLabel,
      href: input.href,
      eventType: input.eventType,
      statusToken: input.statusToken,
    })
  );
}

function derivedFromContract(
  contract: IssuerDashboardContract,
  logs: readonly ApplicationLogEntry[],
  invoices: readonly IssuerDashboardInvoice[]
): FacilityTransactionRow[] {
  const rows: FacilityTransactionRow[] = [];
  const modal = asContractForModal(contract.contractForModal);
  const offer = modal.offer_details;
  const status = String(contract.contractStatus ?? modal.status ?? "").toUpperCase();

  if (!logHasEvent(logs, invoices, "CONTRACT_OFFER_SENT") && offer?.sent_at) {
    pushDerived(rows, {
      id: `derived:facility-offer-sent:${contract.id}`,
      at: offer.sent_at,
      label: "Facility offer sent",
      amount: parseAmount(offer.offered_facility ?? contract.approvedFacilityAmount),
      eventType: "CONTRACT_OFFER_SENT",
      statusToken: "action",
    });
  }

  if (
    !logHasEvent(logs, invoices, "CONTRACT_OFFER_ACCEPTED") &&
    offer?.responded_at &&
    status === "APPROVED"
  ) {
    pushDerived(rows, {
      id: `derived:facility-offer-signed:${contract.id}`,
      at: offer.responded_at,
      label: "Facility offer signed",
      amount: parseAmount(offer.offered_facility ?? contract.approvedFacilityAmount),
      eventType: "CONTRACT_OFFER_ACCEPTED",
      statusToken: "success",
    });
  }

  return rows;
}

function derivedFromInvoice(
  invoice: IssuerDashboardInvoice,
  logs: readonly ApplicationLogEntry[],
  invoices: readonly IssuerDashboardInvoice[],
  notes: readonly FacilityTransactionNoteInput[]
): FacilityTransactionRow[] {
  const rows: FacilityTransactionRow[] = [];
  const modal = asInvoiceForModal(invoice.invoiceForModal);
  const offer = modal.offer_details;
  const status = String(invoice.invoiceStatus ?? modal.status ?? "").toUpperCase();
  const referenceLabel = invoiceReference(invoice);
  const href = `/financing/invoices/${invoice.id}`;
  const financingAmount = parseAmount(invoice.financingAmount ?? offer?.offered_amount);

  pushDerived(rows, {
    id: `derived:funding-requested:${invoice.id}`,
    at: invoice.submissionDate ?? modal.created_at,
    label: "Funding requested",
    amount: financingAmount,
    referenceLabel,
    href,
    eventType: "APPLICATION_SUBMITTED",
    statusToken: "submitted",
  });

  if (!logHasEvent(logs, invoices, "INVOICE_OFFER_SENT", invoice.id) && offer?.sent_at) {
    pushDerived(rows, {
      id: `derived:invoice-offer-sent:${invoice.id}`,
      at: offer.sent_at,
      label: "Invoice offer sent",
      amount: parseAmount(offer.offered_amount) ?? financingAmount,
      referenceLabel,
      href,
      eventType: "INVOICE_OFFER_SENT",
      statusToken: "action",
    });
  }

  if (
    !logHasEvent(logs, invoices, "INVOICE_OFFER_ACCEPTED", invoice.id) &&
    offer?.responded_at &&
    status === InvoiceStatus.APPROVED
  ) {
    pushDerived(rows, {
      id: `derived:invoice-offer-signed:${invoice.id}`,
      at: offer.responded_at,
      label: "Invoice offer signed",
      amount: parseAmount(offer.offered_amount) ?? financingAmount,
      referenceLabel,
      href,
      eventType: "INVOICE_OFFER_ACCEPTED",
      statusToken: "success",
    });
  }

  if (status === InvoiceStatus.APPROVED) {
    pushDerived(rows, {
      id: `derived:funding-approved:${invoice.id}`,
      at: offer?.responded_at ?? modal.updated_at ?? invoice.submissionDate,
      label: "Funding approved",
      amount: financingAmount,
      referenceLabel,
      href,
      eventType: "APPLICATION_APPROVED",
      statusToken: "success",
    });
  }

  if (status === InvoiceStatus.REJECTED) {
    pushDerived(rows, {
      id: `derived:funding-declined:${invoice.id}`,
      at: modal.updated_at ?? invoice.submissionDate,
      label: "Funding declined",
      amount: financingAmount,
      referenceLabel,
      href,
      eventType: "APPLICATION_REJECTED",
      statusToken: "rejected",
    });
  }

  if (
    status === InvoiceStatus.WITHDRAWN &&
    !logHasEvent(logs, invoices, "INVOICE_WITHDRAWN", invoice.id)
  ) {
    pushDerived(rows, {
      id: `derived:invoice-withdrawn:${invoice.id}`,
      at: modal.updated_at ?? invoice.submissionDate,
      label: "Invoice withdrawn",
      amount: financingAmount,
      referenceLabel,
      href,
      eventType: "INVOICE_WITHDRAWN",
      statusToken: "neutral",
    });
  }

  const matchingNote = notes.find((note) => note.sourceInvoiceId === invoice.id) ?? null;
  const breakdown = invoice.note?.disbursementBreakdown;
  const netDisbursed = parseAmount(breakdown?.netIssuerDisbursement);
  const facilityFee = parseAmount(breakdown?.facilityFeeCharged);
  const drawdownFee = parseAmount(breakdown?.platformFeeAmount);
  const disbursedAt = matchingNote?.activatedAt ?? matchingNote?.fundingClosedAt ?? null;
  const waiver = parseFacilityFeeCollectionWaiver(modal);
  const actualExtra = breakdown?.additionalFees ?? [];
  const schedule = parseInvoiceFeeSchedule(offer);
  const fundedAmount = parseAmount(breakdown?.grossFundedAmount);
  const extraCharges =
    actualExtra.length > 0
      ? actualExtra
      : schedule && fundedAmount != null
        ? schedule.additionalFees.map((line) => ({
            ...line,
            chargedAmount: computeAdditionalFeeAmount(line, fundedAmount),
          }))
        : [];
  if (netDisbursed != null && netDisbursed > 0) {
    pushDerived(rows, {
      id: `derived:disbursed:${invoice.id}`,
      at: disbursedAt,
      label: "Disbursed",
      amount: netDisbursed,
      referenceLabel,
      href,
      eventType: "WITHDRAWAL_COMPLETED",
      statusToken: "active",
    });
  }
  if (drawdownFee != null && drawdownFee > 0) {
    pushDerived(rows, {
      id: `derived:drawdown-fee:${invoice.id}`,
      at: disbursedAt,
      label: "Drawdown fee charged",
      amount: drawdownFee,
      referenceLabel,
      href,
      eventType: "SETTLEMENT_POSTED",
      statusToken: "success",
    });
  }
  if (facilityFee != null && facilityFee > 0) {
    pushDerived(rows, {
      id: `derived:facility-fee:${invoice.id}`,
      at: disbursedAt,
      label: "Facility fee charged",
      amount: facilityFee,
      referenceLabel,
      href,
      eventType: "SETTLEMENT_POSTED",
      statusToken: "success",
    });
  } else if (
    waiver?.facilityFeeCollectionWaived === true ||
    breakdown?.facilityFeeCollectionWaived === true
  ) {
    pushDerived(rows, {
      id: `derived:facility-fee-waived:${invoice.id}`,
      at: disbursedAt,
      label: "Facility fee collection waived",
      amount: 0,
      referenceLabel,
      href,
      eventType: "SETTLEMENT_POSTED",
      statusToken: "neutral",
    });
  }
  for (const [index, line] of extraCharges.entries()) {
    if (line.chargedAmount <= 0) continue;
    pushDerived(rows, {
      id: `derived:extra-fee:${invoice.id}:${index}`,
      at: disbursedAt,
      label: `${line.name} charged`,
      amount: line.chargedAmount,
      referenceLabel,
      href,
      eventType: "SETTLEMENT_POSTED",
      statusToken: "success",
    });
  }

  return rows;
}

function derivedFromNote(
  note: FacilityTransactionNoteInput,
  invoices: readonly IssuerDashboardInvoice[]
): FacilityTransactionRow[] {
  const rows: FacilityTransactionRow[] = [];
  const invoice = invoices.find((row) => row.id === note.sourceInvoiceId) ?? null;
  const referenceLabel = invoice ? invoiceReference(invoice) : note.noteReference;
  const href = invoice
    ? `/financing/invoices/${invoice.id}`
    : `/financing/notes/${note.id}`;
  const fundedAmount = parseAmount(note.fundedAmount);
  const hasInvoiceDisbursement =
    invoice != null &&
    parseAmount(invoice.note?.disbursementBreakdown?.netIssuerDisbursement) != null;

  if (note.publishedAt) {
    pushDerived(rows, {
      id: `derived:funding-opened:${note.id}`,
      at: note.publishedAt,
      label: "Funding opened",
      amount: fundedAmount,
      referenceLabel,
      href,
      eventType: "PUBLISH",
      statusToken: "submitted",
    });
  }

  if (note.fundingClosedAt) {
    const failed = String(note.fundingStatus).toUpperCase() === "FAILED";
    pushDerived(rows, {
      id: `derived:funding-closed:${note.id}`,
      at: note.fundingClosedAt,
      label: failed ? "Funding unsuccessful" : "Funding closed",
      amount: fundedAmount,
      referenceLabel,
      href,
      eventType: failed ? "FAIL_FUNDING" : "CLOSE_FUNDING",
      statusToken: failed ? "rejected" : "submitted",
    });
  }

  if (note.activatedAt && !hasInvoiceDisbursement) {
    pushDerived(rows, {
      id: `derived:disbursed-note:${note.id}`,
      at: note.activatedAt,
      label: "Disbursed",
      amount: fundedAmount,
      referenceLabel,
      href,
      eventType: "ACTIVATE",
      statusToken: "active",
    });
  }

  if (note.repaidAt) {
    pushDerived(rows, {
      id: `derived:repaid:${note.id}`,
      at: note.repaidAt,
      label: "Repaid",
      amount: fundedAmount,
      referenceLabel,
      href,
      eventType: "SETTLEMENT_POSTED",
      statusToken: "success",
    });
  }

  return rows;
}

function rowsFromLogs(
  logs: readonly ApplicationLogEntry[],
  invoices: readonly IssuerDashboardInvoice[]
): FacilityTransactionRow[] {
  return logs
    .filter((log) => Boolean(LOG_LABELS[log.event_type]))
    .map((log) => {
      const invoiceId = INVOICE_LOG_TYPES.has(log.event_type)
        ? logInvoiceId(log, invoices)
        : null;
      const invoice = invoiceId
        ? invoices.find((row) => row.id === invoiceId) ?? null
        : null;
      const activity =
        typeof log.activity === "string" && log.activity.trim() ? log.activity.trim() : null;
      const remark = log.remark?.trim() || null;
      return rowFromKind({
        id: `log:${log.id}`,
        at: log.created_at || null,
        label: LOG_LABELS[log.event_type] ?? log.event_type,
        description: activity ?? remark,
        amount: invoice ? parseAmount(invoice.financingAmount) : null,
        referenceLabel: invoice ? invoiceReference(invoice) : null,
        href: invoice ? `/financing/invoices/${invoice.id}` : null,
        eventType: log.event_type,
        statusToken: getActivityStatusToken(log.event_type),
      });
    });
}

export function buildFacilityTransactions(input: {
  contract: IssuerDashboardContract;
  invoices: readonly IssuerDashboardInvoice[];
  notes?: readonly FacilityTransactionNoteInput[];
  logs?: readonly ApplicationLogEntry[];
}): FacilityTransactionRow[] {
  const logs = input.logs ?? [];
  const notes = (input.notes ?? []).filter(
    (note) => !note.sourceContractId || note.sourceContractId === input.contract.id
  );
  const rows: FacilityTransactionRow[] = [
    ...rowsFromLogs(logs, input.invoices),
    ...derivedFromContract(input.contract, logs, input.invoices),
    ...input.invoices.flatMap((invoice) =>
      derivedFromInvoice(invoice, logs, input.invoices, notes)
    ),
    ...notes.flatMap((note) => derivedFromNote(note, input.invoices)),
  ];
  return sortNewestFirst(rows);
}

export function uniqueFacilityApplicationIds(
  contract: IssuerDashboardContract,
  invoices: readonly IssuerDashboardInvoice[]
): string[] {
  const ids = new Set<string>();
  if (contract.applicationId) ids.add(contract.applicationId);
  for (const invoice of invoices) {
    if (invoice.applicationId) ids.add(invoice.applicationId);
  }
  return [...ids].sort();
}
