import { formatInvoiceReference, formatNoteReference, type NoteListItem } from "@cashsouk/types";
import type { IssuerDashboardInvoice, IssuerDashboardNote } from "@/types/issuer-dashboard";
import { resolveIssuerInvoiceDashboardBadge } from "@/lib/issuer-dashboard-labels";
import {
  matchesInvoiceSubmissionPreset,
  type InvoiceFinancingListFiltersState,
} from "./filters";

export type FinancingInvoiceRow =
  | { kind: "invoice"; id: string; invoice: IssuerDashboardInvoice }
  | { kind: "note"; id: string; note: NoteListItem };

/**
 * One row per receivable: keep the invoice card while the issuer still needs to act
 * on the application/offer; otherwise show the note once it exists. Facility-linked
 * notes (hidden from the standalone invoice list) still appear here.
 */
export function buildFinancingInvoiceRows(
  invoices: readonly IssuerDashboardInvoice[],
  notes: readonly NoteListItem[],
  keepInvoiceCard: (invoice: IssuerDashboardInvoice) => boolean
): FinancingInvoiceRow[] {
  const notesByInvoiceId = new Map<string, NoteListItem>();
  for (const note of notes) {
    if (note.sourceInvoiceId) notesByInvoiceId.set(note.sourceInvoiceId, note);
  }

  const usedNoteIds = new Set<string>();
  const rows: FinancingInvoiceRow[] = [];

  for (const invoice of invoices) {
    const note = notesByInvoiceId.get(invoice.id) ?? null;
    if (note && !keepInvoiceCard(invoice)) {
      rows.push({ kind: "note", id: `note:${note.id}`, note });
      usedNoteIds.add(note.id);
      continue;
    }
    rows.push({ kind: "invoice", id: `invoice:${invoice.id}`, invoice });
    if (note) usedNoteIds.add(note.id);
  }

  for (const note of notes) {
    if (usedNoteIds.has(note.id)) continue;
    rows.push({ kind: "note", id: `note:${note.id}`, note });
  }

  return rows;
}

export function financingInvoiceRowSearchHaystack(
  row: FinancingInvoiceRow,
  productName: string
): string {
  if (row.kind === "invoice") {
    const invoice = row.invoice;
    return [
      invoice.invoiceNumber,
      invoice.customerName,
      invoice.note?.noteReference ?? "",
      productName,
      invoice.displayReference ?? "",
      formatInvoiceReference({
        displayReference: invoice.displayReference,
        businessNumber: invoice.invoiceNumber,
        id: invoice.id,
      }),
      invoice.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }
  const note = row.note;
  return [
    note.noteReference,
    formatNoteReference({ noteReference: note.noteReference, id: note.id }),
    note.title,
    note.purposeOfFinancing ?? "",
    note.paymasterName ?? "",
    note.productName ?? "",
    note.productCategory ?? "",
    note.sourceApplicationDisplayReference ?? "",
    note.sourceInvoiceDisplayReference ?? "",
    note.sourceContractDisplayReference ?? "",
    note.sourceApplicationId,
    note.sourceInvoiceId ?? "",
    note.sourceContractId ?? "",
    productName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function dashboardNoteFromListItem(note: NoteListItem): IssuerDashboardNote {
  return {
    id: note.id,
    noteReference: note.noteReference,
    noteStatus: String(note.status),
    listingStatus: String(note.listingStatus),
    noteListingStatus: null,
    fundingStatus: String(note.fundingStatus),
    servicingStatus: String(note.servicingStatus),
    targetAmount: String(note.targetAmount),
    fundedAmount: String(note.fundedAmount),
    fundingProgressPercent: note.fundingPercent,
    minimumFundingPercent: String(note.minimumFundingPercent),
    fundingDeadline: note.listingClosesAt,
    maturityDate: note.maturityDate,
    tenureDays: note.tenureDays ?? null,
    marketplaceStatusLabel: null,
    investorCount: note.investorCount ?? 0,
    disbursementBreakdown: null,
  };
}

export function financingInvoiceRowMatchesFilters(
  row: FinancingInvoiceRow,
  filters: InvoiceFinancingListFiltersState
): boolean {
  if (row.kind === "invoice") {
    const invoice = row.invoice;
    if (filters.statusKind !== "all") {
      if (resolveIssuerInvoiceDashboardBadge(invoice.note, invoice.invoiceStatus) !== filters.statusKind) {
        return false;
      }
    }
    if (filters.customer) {
      if ((invoice.customerName ?? "").trim() !== filters.customer) return false;
    }
    if (filters.productId && (invoice.productId ?? "") !== filters.productId) return false;
    if (!matchesInvoiceSubmissionPreset(invoice, filters.submissionPreset)) return false;
    return true;
  }

  const note = row.note;
  const badge = resolveIssuerInvoiceDashboardBadge(dashboardNoteFromListItem(note), "");
  if (filters.statusKind !== "all" && badge !== filters.statusKind) return false;
  if (filters.customer) {
    if ((note.paymasterName ?? "").trim() !== filters.customer) return false;
  }
  if (filters.productId) return false;
  if (filters.submissionPreset !== "all") {
    const ms = Date.parse(note.createdAt);
    if (Number.isNaN(ms)) return false;
    const now = Date.now();
    if (filters.submissionPreset === "7d") return ms >= now - 7 * 86400000;
    if (filters.submissionPreset === "30d") return ms >= now - 30 * 86400000;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return ms >= cutoff.getTime();
  }
  return true;
}
