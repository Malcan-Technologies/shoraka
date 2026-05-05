import { InvoiceStatus } from "@cashsouk/types";
import type { IssuerDashboardNote } from "@/types/issuer-dashboard";

export function formatStatus(raw?: string | null) {
  if (!raw) return "";
  const s = String(raw).replace(/_/g, " ").toLowerCase();
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type InvoiceCardBadgeKind =
  | "draft"
  | "pending_approval"
  | "amendment"
  | "approved"
  | "in_progress"
  | "minimum_funding"
  | "funded"
  | "active"
  | "completed"
  | "unsuccessful"
  | "unknown";

function minFundingReached(note: IssuerDashboardNote): boolean {
  const minPct = Number(note.minimumFundingPercent);
  const progress = note.fundingProgressPercent;
  if (!Number.isFinite(minPct) || progress == null) return false;
  return progress + 1e-6 >= minPct;
}

function backendSaysFunded(note: IssuerDashboardNote): boolean {
  return note.fundingStatus === "FUNDED";
}

export function resolveInvoiceCardBadge(note: IssuerDashboardNote | null, invoiceStatus: string): InvoiceCardBadgeKind {
  if (!note) {
    if (invoiceStatus === InvoiceStatus.DRAFT) return "draft";
    if (invoiceStatus === InvoiceStatus.SUBMITTED || invoiceStatus === InvoiceStatus.OFFER_SENT) return "pending_approval";
    if (invoiceStatus === InvoiceStatus.AMENDMENT_REQUESTED) return "amendment";
    if (invoiceStatus === InvoiceStatus.APPROVED) return "approved";
    if (invoiceStatus === InvoiceStatus.REJECTED || invoiceStatus === InvoiceStatus.WITHDRAWN) return "unsuccessful";
    return "unknown";
  }

  if (note.noteStatus === "FAILED_FUNDING" || note.fundingStatus === "FAILED" || note.noteStatus === "CANCELLED") {
    return "unsuccessful";
  }
  if (note.noteStatus === "REPAID") return "completed";
  if (note.noteStatus === "ACTIVE") return "active";
  if (backendSaysFunded(note)) return "funded";
  if (minFundingReached(note) && !backendSaysFunded(note)) return "minimum_funding";
  if (note.fundingStatus === "OPEN" || note.noteStatus === "FUNDING" || note.noteStatus === "PUBLISHED") {
    return "in_progress";
  }
  if (note.noteStatus === "DRAFT") return "draft";
  return "in_progress";
}

export function resolveFundingProgressPercent(note: IssuerDashboardNote | null): number {
  if (!note || note.fundingProgressPercent == null) return 0;
  return note.fundingProgressPercent;
}

export function resolveFundingStatusText(note: IssuerDashboardNote | null): string {
  if (!note) return "Funding status (Not yet started)";
  const pct = note.fundingProgressPercent;
  if (pct == null || pct <= 0) return "Funding status (Not yet started)";
  if (backendSaysFunded(note)) {
    return `Funding status: Funded (${pct}% — RM ${note.fundedAmount})`;
  }
  if (resolveInvoiceCardBadge(note, "") === "minimum_funding") {
    return "Funding status: Minimum funding reached";
  }
  return `Funding status: (${pct}%)`;
}
