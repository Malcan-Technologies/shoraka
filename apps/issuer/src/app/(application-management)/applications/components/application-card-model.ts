import { formatCurrency } from "@cashsouk/config";
import { getIssuerOfferActionCta } from "@/lib/offer-utils";
import { issuerApplicationActionHref } from "@/lib/issuer-pending-actions";
import type { NormalizedApplication } from "../status";
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

export function applicationHeadlineAmount(app: NormalizedApplication): string {
  if (app.facilityApplied != null) return formatCurrency(app.facilityApplied);
  if (app.contractValue != null) return formatCurrency(app.contractValue);
  const invoiceSum = app.invoices.reduce(
    (sum, inv) => sum + (inv.appliedFinancing ?? inv.value ?? 0),
    0
  );
  if (invoiceSum > 0) return formatCurrency(invoiceSum);
  return "—";
}

export function applicationCardSubStatus(app: NormalizedApplication): string {
  if (app.status === "draft") return "Continue when you are ready";
  const invoiceCount = app.invoices.length;
  const invoicesNeedingAction = countInvoicesNeedingAction(app.invoices);
  return `${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}${
    invoicesNeedingAction > 0
      ? ` · ${invoicesNeedingAction} need${invoicesNeedingAction === 1 ? "s" : ""} action`
      : ""
  }`;
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
      if (action.buttonVariant === "outline") return "Update your documents";
      return "Review this offer";
    default:
      return "This needs your response";
  }
}
