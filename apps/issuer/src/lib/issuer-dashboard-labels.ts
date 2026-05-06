import { InvoiceStatus } from "@cashsouk/types";
import type { IssuerDashboardNote } from "@/types/issuer-dashboard";

/** Issuer financing dashboard (cards + contract detail): only these seven user-facing buckets. */
export type IssuerFinancingStatusKind =
  | "draft"
  | "pending_approval"
  | "in_progress"
  | "funded"
  | "active"
  | "completed"
  | "unsuccessful";

export function formatStatus(raw?: string | null) {
  if (!raw) return "";
  const s = String(raw).replace(/_/g, " ").toLowerCase();
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Badge label + classes for issuer financing summary (dashboard + contract detail header). */
export function getIssuerFinancingStatusPresentation(kind: IssuerFinancingStatusKind): {
  label: string;
  className: string;
  variant: "default" | "secondary" | "outline";
} {
  switch (kind) {
    case "draft":
      return { label: "Draft", className: "", variant: "secondary" };
    case "pending_approval":
      return {
        label: "Pending approval",
        className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
        variant: "default",
      };
    case "in_progress":
      return {
        label: "In progress",
        className: "bg-green-100 text-green-700 hover:bg-green-100",
        variant: "default",
      };
    case "funded":
      return {
        label: "Funded",
        className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
        variant: "default",
      };
    case "active":
      return {
        label: "Active",
        className: "bg-green-100 text-green-800 hover:bg-green-100",
        variant: "default",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
        variant: "default",
      };
    case "unsuccessful":
      return {
        label: "Unsuccessful",
        className: "bg-red-100 text-red-600 hover:bg-red-100",
        variant: "default",
      };
  }
}

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toUpperCase();
}

/**
 * Contract card / contract detail: maps `Contract.status` only (no Note).
 */
export function resolveIssuerContractDashboardBadge(contractStatus: string): IssuerFinancingStatusKind {
  const c = norm(contractStatus);
  if (c === "DRAFT") return "draft";
  if (c === "SUBMITTED" || c === "OFFER_SENT" || c === "AMENDMENT_REQUESTED") return "pending_approval";
  if (c === "APPROVED") return "active";
  if (c === "REJECTED" || c === "WITHDRAWN" || c === "CANCELLED" || c === "EXPIRED") return "unsuccessful";
  return "active";
}

function minFundingReached(note: IssuerDashboardNote): boolean {
  const minPct = Number(note.minimumFundingPercent);
  const progress = note.fundingProgressPercent;
  if (!Number.isFinite(minPct) || progress == null) return false;
  return progress + 1e-6 >= minPct;
}

function backendSaysFunded(note: IssuerDashboardNote): boolean {
  return note.fundingStatus === "FUNDED";
}

function parseMoneyRm(value: string | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Invoice card on issuer financing dashboard: no Note → `Invoice.status`; with Note → lifecycle fields on DTO.
 */
export function resolveIssuerInvoiceDashboardBadge(
  note: IssuerDashboardNote | null,
  invoiceStatus: string
): IssuerFinancingStatusKind {
  if (!note) {
    const inv = norm(invoiceStatus);
    if (inv === InvoiceStatus.DRAFT) return "draft";
    if (
      inv === InvoiceStatus.SUBMITTED ||
      inv === InvoiceStatus.OFFER_SENT ||
      inv === InvoiceStatus.AMENDMENT_REQUESTED
    ) {
      return "pending_approval";
    }
    if (inv === InvoiceStatus.APPROVED) return "in_progress";
    if (
      inv === InvoiceStatus.REJECTED ||
      inv === InvoiceStatus.WITHDRAWN ||
      inv === "CANCELLED" ||
      inv === "EXPIRED"
    ) {
      return "unsuccessful";
    }
    return "in_progress";
  }

  const ns = norm(note.noteStatus);
  const fs = norm(note.fundingStatus);
  const ls = note.listingStatus == null ? "" : norm(note.listingStatus);
  const ss = norm(note.servicingStatus);

  if (
    ns === "FAILED_FUNDING" ||
    ns === "CANCELLED" ||
    ns === "DEFAULTED" ||
    ns === "FAILED" ||
    ns === "WITHDRAWN" ||
    fs === "FAILED"
  ) {
    return "unsuccessful";
  }

  if (ns === "REPAID" || ns === "SETTLED" || ns === "COMPLETED" || ss === "SETTLED") {
    return "completed";
  }

  if (
    ns === "ACTIVE" ||
    ns === "ARREARS" ||
    ns === "DISBURSED" ||
    ss === "CURRENT" ||
    ss === "ARREARS" ||
    ss === "LATE" ||
    ss === "PARTIAL" ||
    ss === "ADVANCE_PAID"
  ) {
    return "active";
  }

  if (backendSaysFunded(note) || minFundingReached(note)) {
    return "funded";
  }

  if (ns === "DRAFT" || ls === "NOT_LISTED" || (fs === "NOT_OPEN" && ls === "NOT_LISTED")) {
    return "draft";
  }

  if (
    ns === "PUBLISHED" ||
    ns === "FUNDING" ||
    fs === "OPEN" ||
    fs === "CLOSED" ||
    ls === "PUBLISHED" ||
    (ls === "DRAFT" && (fs === "OPEN" || ns === "FUNDING" || ns === "PUBLISHED"))
  ) {
    return "in_progress";
  }

  return "in_progress";
}

/** @deprecated Use resolveIssuerInvoiceDashboardBadge — kept name so imports stay stable. */
export const resolveInvoiceCardBadge = resolveIssuerInvoiceDashboardBadge;

export type InvoiceCardBadgeKind = IssuerFinancingStatusKind;

export function resolveFundingProgressPercent(note: IssuerDashboardNote | null): number {
  if (!note || note.fundingProgressPercent == null) return 0;
  return note.fundingProgressPercent;
}

export function resolveFundingStatusText(note: IssuerDashboardNote | null): string {
  if (!note) return "Not yet started";

  const fs = norm(note.fundingStatus);
  const pct = note.fundingProgressPercent;
  const fundedRm = parseMoneyRm(note.fundedAmount);
  const minReached = minFundingReached(note);
  const fundedBackend = backendSaysFunded(note);

  const ns = norm(note.noteStatus);
  const ss = norm(note.servicingStatus);
  if (
    ns === "FAILED_FUNDING" ||
    ns === "CANCELLED" ||
    ns === "DEFAULTED" ||
    ns === "FAILED" ||
    ns === "WITHDRAWN" ||
    fs === "FAILED"
  ) {
    return pct != null && pct > 0 ? `${Math.round(pct)}% funded (RM ${fundedRm})` : "Funding did not complete";
  }

  if (ns === "REPAID" || ns === "SETTLED" || ns === "COMPLETED" || ss === "SETTLED") {
    return pct != null && pct > 0 ? `${Math.round(pct)}% funded (RM ${fundedRm})` : "Fully completed";
  }

  if (fs === "NOT_OPEN" && (pct == null || pct <= 0) && !fundedBackend && !minReached) {
    return "Not yet started";
  }

  if (pct != null && pct > 0) {
    return `${Math.round(pct)}% funded (RM ${fundedRm})`;
  }

  return "Not yet started";
}
