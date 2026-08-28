import { formatInvoiceReference } from "@cashsouk/types";
import { asInvoiceForModal, type IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { financingOfferHref, OFFER_REVIEW_ON_APPLICATION_HINT } from "@/lib/financing-offer-href";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  shouldShowIssuerReviewOfferCta,
} from "@/lib/offer-utils";

export type InvoiceAttentionAction = {
  headline: string;
  href: string;
  label: string;
  hint: string | null;
  buttonVariant: "default" | "outline";
};

export function getInvoiceAttentionAction(row: IssuerDashboardInvoice): InvoiceAttentionAction {
  const modal = asInvoiceForModal(row.invoiceForModal);
  const offerDetails = modal?.offer_details;

  if (shouldShowIssuerReviewOfferCta(modal)) {
    const cta = getIssuerOfferActionCtaFromOfferDetails(offerDetails, { scope: "invoice" });
    return {
      headline:
        cta.buttonVariant === "makeAmendments"
          ? "Update requested changes"
          : "Review this offer",
      href: financingOfferHref(row.applicationId, row.id),
      label: cta.buttonVariant === "makeAmendments" ? cta.label : "Review offer",
      hint: cta.hint ?? OFFER_REVIEW_ON_APPLICATION_HINT,
      buttonVariant: cta.buttonVariant === "makeAmendments" ? "outline" : "default",
    };
  }

  const ids = row.actionRequiredApplicationIds ?? [];
  if (ids.length > 0) {
    return {
      headline: "Make the requested changes",
      href:
        ids.length === 1
          ? `/applications/${ids[0]}/edit`
          : `/applications?applicationIds=${encodeURIComponent(ids.join(","))}`,
      label: ids.length === 1 ? "Make amendments" : `Review ${ids.length} applications`,
      hint: null,
      buttonVariant: "default",
    };
  }

  return {
    headline: "This needs your response",
    href: `/financing/invoices/${row.id}`,
    label: "View details",
    hint: null,
    buttonVariant: "outline",
  };
}

function displayCell(value: unknown): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s || s === "-" || s === "NA" || s.toUpperCase() === "N/A") return "—";
  return s;
}

export function invoiceAttentionMeta(row: IssuerDashboardInvoice): string {
  const reference = formatInvoiceReference({
    displayReference: row.displayReference,
    businessNumber: row.invoiceNumber,
    id: row.id,
  });
  const number = displayCell(row.invoiceNumber);
  if (number !== "—" && number !== reference) return `${reference} · ${number}`;
  return reference;
}

export function invoiceAttentionDetail(
  row: IssuerDashboardInvoice,
  financedPercent: number | null
): string {
  const scope = row.contractId ? "Part of a facility" : "On its own";
  if (row.note?.fundingProgressPercent != null) {
    return `${scope} · ${Math.round(row.note.fundingProgressPercent)}% funded`;
  }
  if (financedPercent != null) {
    return `${scope} · ${Math.round(financedPercent)}% financed`;
  }
  return scope;
}

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

export function resolveInvoiceAttentionFinancedPercent(
  row: IssuerDashboardInvoice
): number | null {
  const invoiceModal = asInvoiceForModal(row.invoiceForModal);
  const invDetails = invoiceModal?.details;
  const offerDetails = invoiceModal?.offer_details as Record<string, unknown> | null | undefined;
  const fromDetails = Number(invDetails?.financing_ratio_percent);
  if (Number.isFinite(fromDetails) && fromDetails > 0) return fromDetails;
  const offered = Number(offerDetails?.offered_ratio_percent);
  if (Number.isFinite(offered) && offered > 0) return offered;
  const requested = Number(offerDetails?.requested_ratio_percent);
  if (Number.isFinite(requested) && requested > 0) return requested;
  const invoice = parseAmount(row.invoiceValue);
  const financing = parseAmount(row.financingAmount);
  if (invoice != null && invoice > 0 && financing != null) {
    return (financing / invoice) * 100;
  }
  return null;
}
