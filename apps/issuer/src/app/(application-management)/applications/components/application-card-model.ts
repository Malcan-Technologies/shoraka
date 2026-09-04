import { formatCurrency, resolveOfferedAmount } from "@cashsouk/config";
import { getIssuerOfferActionCta } from "@/lib/offer-utils";
import { issuerApplicationActionHref } from "@/lib/issuer-pending-actions";
import type { NormalizedApplication, NormalizedInvoice } from "../status";
import { countInvoicesNeedingAction } from "./issuer-status-display";

/** Soft card wash (≈45% of badge fill) so attention reads without overpowering content. */
export const ATTENTION_SURFACE: Record<string, string> = {
  action: "border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)]",
  submitted: "border-status-submitted-text/15 bg-[hsl(var(--status-submitted-bg)/0.45)]",
  "in-progress":
    "border-status-in-progress-text/15 bg-[hsl(var(--status-in-progress-bg)/0.45)]",
  success: "border-status-success-text/15 bg-[hsl(var(--status-success-bg)/0.45)]",
  active: "border-status-active-text/15 bg-[hsl(var(--status-active-bg)/0.45)]",
  completed: "border-status-completed-text/15 bg-[hsl(var(--status-completed-bg)/0.45)]",
  rejected: "border-status-rejected-text/15 bg-[hsl(var(--status-rejected-bg)/0.45)]",
  neutral: "border-status-neutral-text/15 bg-[hsl(var(--status-neutral-bg)/0.45)]",
};

function parseFormattedAmount(value: string | null | undefined): number | null {
  if (value == null || value === "—" || value === "N/A") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function invoiceOfferedAmount(inv: NormalizedInvoice): number {
  if (inv.offeredAmount != null && inv.offeredAmount > 0) return inv.offeredAmount;
  const fromDetails = resolveOfferedAmount(inv.offer_details);
  if (fromDetails > 0) return fromDetails;
  return parseFormattedAmount(inv.financingOffered) ?? 0;
}

function invoiceOfferedTotal(
  app: NormalizedApplication,
  statuses?: ReadonlySet<string>
): number {
  return app.invoices.reduce((sum, inv) => {
    if (statuses && !statuses.has(invoiceStatus(inv))) return sum;
    return sum + invoiceOfferedAmount(inv);
  }, 0);
}

const OUTSTANDING_INVOICE_OFFER_STATUSES = new Set(["OFFER_SENT", "OFFER_EXPIRED"]);
const AMENDMENT_INVOICE_STATUSES = new Set(["AMENDMENT_REQUESTED"]);

function invoiceRequestedTotal(
  app: NormalizedApplication,
  statuses?: ReadonlySet<string>
): number {
  return app.invoices.reduce((sum, inv) => {
    if (statuses && !statuses.has(invoiceStatus(inv))) return sum;
    return sum + (inv.appliedFinancing ?? 0);
  }, 0);
}

function invoiceStatus(inv: NormalizedInvoice): string {
  return String(inv.status ?? "").toUpperCase();
}

function hasActiveInvoiceOffer(app: NormalizedApplication): boolean {
  return app.invoices.some((inv) => {
    const status = invoiceStatus(inv);
    return status === "OFFER_SENT" || status === "OFFER_EXPIRED";
  });
}

function isFacilityOfferActive(app: NormalizedApplication): boolean {
  const status = String(app.contractStatus ?? "").toUpperCase();
  return status === "OFFER_SENT" || status === "OFFER_EXPIRED";
}

function hasInvoiceAmendment(app: NormalizedApplication): boolean {
  return app.invoices.some((inv) => invoiceStatus(inv) === "AMENDMENT_REQUESTED");
}

/**
 * Amount the issuer should see on the application card.
 * Offer and approved financing beat requested amounts; contract value is never used.
 * Amendments show the invoice being changed, not the approved facility.
 */
export function resolveApplicationHeadlineAmount(app: NormalizedApplication): number | null {
  if (!isFacilityOfferActive(app) && hasActiveInvoiceOffer(app)) {
    const offered = invoiceOfferedTotal(app, OUTSTANDING_INVOICE_OFFER_STATUSES);
    if (offered > 0) return offered;
  }

  if (isFacilityOfferActive(app) && app.offeredFacilityAmount != null && app.offeredFacilityAmount > 0) {
    return app.offeredFacilityAmount;
  }

  if (hasInvoiceAmendment(app)) {
    const amending = invoiceRequestedTotal(app, AMENDMENT_INVOICE_STATUSES);
    if (amending > 0) return amending;
  }

  if (app.approvedFacilityAmount != null && app.approvedFacilityAmount > 0) {
    return app.approvedFacilityAmount;
  }

  if (app.type !== "Facility financing") {
    const offered = invoiceOfferedTotal(app);
    if (offered > 0) return offered;
  }

  if (app.facilityApplied != null && app.facilityApplied > 0) return app.facilityApplied;

  const requestedInvoices = invoiceRequestedTotal(app);
  if (requestedInvoices > 0) return requestedInvoices;

  return null;
}

export function applicationHeadlineAmount(app: NormalizedApplication): string {
  const amount = resolveApplicationHeadlineAmount(app);
  return amount != null ? formatCurrency(amount) : "—";
}

export function applicationCardSubStatus(app: NormalizedApplication): string {
  if (app.status === "draft") return "Continue when you are ready";
  const invoiceCount = app.invoices.length;
  const invoicesNeedingAction = countInvoicesNeedingAction(app.invoices);

  if (invoiceCount > 1) {
    return `${invoiceCount} invoices${
      invoicesNeedingAction > 0
        ? ` · ${invoicesNeedingAction} need${invoicesNeedingAction === 1 ? "s" : ""} action`
        : ""
    }`;
  }

  if (invoiceCount === 1) {
    const inv = app.invoices[0]!;
    const label = inv.displayReference?.trim() || inv.number?.trim() || "Invoice";
    return invoicesNeedingAction > 0 ? `${label} · Needs action` : label;
  }

  return "No invoice yet";
}

export type ApplicationCardActionKind =
  | "continue"
  | "reviewOffer"
  | "makeAmendments"
  | "view";

export type ApplicationCardPrimaryAction = {
  kind: ApplicationCardActionKind;
  href: string;
  label: string;
  hint: string | null;
  deadlineSummary: string | null;
  buttonVariant: "default" | "outline";
  /** Which offer the CTA opens — facility first while the contract is still OFFER_SENT. */
  offerScope?: "contract" | "invoice";
};

export function applicationOfferReviewScope(
  app: NormalizedApplication
): "contract" | "invoice" {
  if (app.type !== "Facility financing") return "invoice";
  return app.contractStatus === "OFFER_SENT" ? "contract" : "invoice";
}

export function getApplicationCardPrimaryAction(
  app: NormalizedApplication
): ApplicationCardPrimaryAction {
  const href = issuerApplicationActionHref(app);
  const deadlineSummary = app.offerPhaseDeadline?.summary ?? null;

  if (app.status === "draft") {
    return {
      kind: "continue",
      href,
      label: "Continue editing",
      hint: null,
      deadlineSummary: null,
      buttonVariant: "default",
    };
  }

  if (app.cardStatus.showMakeAmendments) {
    return {
      kind: "makeAmendments",
      href,
      label: "Make amendments",
      hint: null,
      deadlineSummary: null,
      buttonVariant: "default",
    };
  }

  if (app.cardStatus.showReviewOffer) {
    const offerScope = applicationOfferReviewScope(app);
    const offerActionCta = getIssuerOfferActionCta(app.offerAcceptanceStatus, {
      scope: offerScope,
    });
    return {
      kind: "reviewOffer",
      href,
      label: offerActionCta.label,
      hint: offerActionCta.hint,
      deadlineSummary,
      buttonVariant: offerActionCta.buttonVariant === "makeAmendments" ? "outline" : "default",
      offerScope,
    };
  }

  return {
    kind: "view",
    href,
    label: "View application",
    hint: null,
    deadlineSummary,
    buttonVariant: "outline",
  };
}

export function applicationAttentionHeadline(action: ApplicationCardPrimaryAction): string {
  switch (action.kind) {
    case "continue":
      return "Finish this application";
    case "makeAmendments":
      return "Make the requested changes";
    case "reviewOffer":
      if (action.buttonVariant === "outline") return "Update requested changes";
      return "Review this offer";
    default:
      return "This needs your response";
  }
}
