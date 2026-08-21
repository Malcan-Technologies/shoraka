import { InvoiceStatus } from "@cashsouk/types";
import type { UserPortalStatusToken } from "@cashsouk/config";
import type { IssuerDashboardNote } from "@/types/issuer-dashboard";

/**
 * Issuer financing dashboard groups. Colors via StatusBadge tokens (viewer-centric):
 * action_required → yellow · pending_approval / pending_listing / in_progress / funded → blue ·
 * active → violet · arrears / unsuccessful → red · completed → green · draft → grey.
 */
export type IssuerFinancingStatusKind =
  | "draft"
  | "action_required"
  | "pending_approval"
  | "pending_listing"
  | "in_progress"
  | "funded"
  | "active"
  | "arrears"
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

/** Labels for issuer financing status groups (styling comes from StatusBadge tokens). */
export function getIssuerFinancingStatusPresentation(kind: IssuerFinancingStatusKind): {
  label: string;
  className: string;
  variant: "default" | "secondary" | "outline";
} {
  switch (kind) {
    case "draft":
      return {
        label: "Draft",
        className: "bg-status-neutral-bg text-status-neutral-text hover:bg-status-neutral-bg",
        variant: "default",
      };
    case "action_required":
      return {
        label: "Action required",
        className: "bg-status-action-bg text-status-action-text hover:bg-status-action-bg",
        variant: "default",
      };
    case "pending_approval":
      return {
        label: "Pending approval",
        className: "bg-status-submitted-bg text-status-submitted-text hover:bg-status-submitted-bg",
        variant: "default",
      };
    case "pending_listing":
      return {
        label: "Pending listing",
        className: "bg-status-submitted-bg text-status-submitted-text hover:bg-status-submitted-bg",
        variant: "default",
      };
    case "in_progress":
      return {
        label: "In progress",
        className:
          "bg-status-submitted-bg text-status-submitted-text hover:bg-status-submitted-bg",
        variant: "default",
      };
    case "funded":
      return {
        label: "Funded",
        className: "bg-status-submitted-bg text-status-submitted-text hover:bg-status-submitted-bg",
        variant: "default",
      };
    case "active":
      return {
        label: "Active",
        className: "bg-status-active-bg text-status-active-text hover:bg-status-active-bg",
        variant: "default",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-status-success-bg text-status-success-text hover:bg-status-success-bg",
        variant: "default",
      };
    case "arrears":
      return {
        label: "Arrears",
        className: "bg-status-rejected-bg text-status-rejected-text hover:bg-status-rejected-bg",
        variant: "default",
      };
    case "unsuccessful":
      return {
        label: "Unsuccessful",
        className: "bg-status-rejected-bg text-status-rejected-text hover:bg-status-rejected-bg",
        variant: "default",
      };
  }
}

export function financingKindToStatusToken(kind: IssuerFinancingStatusKind): UserPortalStatusToken {
  switch (kind) {
    case "action_required":
      return "action";
    case "pending_approval":
    case "pending_listing":
    case "in_progress":
    case "funded":
      return "submitted";
    case "active":
      return "active";
    case "completed":
      return "success";
    case "unsuccessful":
    case "arrears":
      return "rejected";
    case "draft":
    default:
      return "neutral";
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
  if (c === "OFFER_SENT" || c === "AMENDMENT_REQUESTED") return "action_required";
  if (c === "SUBMITTED") return "pending_approval";
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
    if (inv === InvoiceStatus.OFFER_SENT || inv === InvoiceStatus.AMENDMENT_REQUESTED) {
      return "action_required";
    }
    if (inv === InvoiceStatus.SUBMITTED) return "pending_approval";
    if (inv === InvoiceStatus.APPROVED) return "pending_listing";
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
    ns === "ARREARS" ||
    ss === "ARREARS"
  ) {
    return "arrears";
  }

  if (ss === "LATE") {
    return "action_required";
  }

  if (
    ns === "ACTIVE" ||
    ns === "DISBURSED" ||
    ss === "CURRENT" ||
    ss === "PARTIAL" ||
    ss === "ADVANCE_PAID"
  ) {
    return "active";
  }

  if (backendSaysFunded(note) || minFundingReached(note)) {
    return "funded";
  }

  if (ns === "DRAFT" || ls === "NOT_LISTED" || (fs === "NOT_OPEN" && ls === "NOT_LISTED")) {
    return "pending_listing";
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
  if (!note) return "Funding status (Not yet started)";

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
    return pct != null && pct > 0
      ? `Funding status ${Math.round(pct)}% funded (RM ${fundedRm})`
      : "Funding did not complete";
  }

  if (ns === "REPAID" || ns === "SETTLED" || ns === "COMPLETED" || ss === "SETTLED") {
    return pct != null && pct > 0
      ? `Funding status ${Math.round(pct)}% funded (RM ${fundedRm})`
      : "Fully completed";
  }

  if (fs === "NOT_OPEN" && (pct == null || pct <= 0) && !fundedBackend && !minReached) {
    return "Funding status (Not yet started)";
  }

  if (pct != null && pct > 0) {
    return `Funding status ${Math.round(pct)}% funded (RM ${fundedRm})`;
  }

  return "Funding status (Not yet started)";
}
