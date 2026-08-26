import { formatContractReference } from "@cashsouk/types";
import { compactLifetimeLine, resolveFacilityDisplayMetrics } from "@/lib/facility-capacity-display";
import { isFacilityAmendmentRequested } from "@/lib/issuer-contract-actionable";
import { asContractForModal, type IssuerDashboardContract } from "@/types/issuer-dashboard";
import { financingOfferHref, OFFER_REVIEW_ON_APPLICATION_HINT } from "@/lib/financing-offer-href";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  shouldShowIssuerReviewOfferCta,
} from "@/lib/offer-utils";

export type FacilityAttentionAction = {
  headline: string;
  href: string;
  label: string;
  hint: string | null;
  buttonVariant: "default" | "outline";
};

export function getFacilityAttentionAction(row: IssuerDashboardContract): FacilityAttentionAction {
  const modal = asContractForModal(row.contractForModal);
  const offerDetails = modal?.offer_details;

  if (shouldShowIssuerReviewOfferCta(modal)) {
    const cta = getIssuerOfferActionCtaFromOfferDetails(offerDetails, { scope: "contract" });
    return {
      headline:
        cta.buttonVariant === "makeAmendments"
          ? "Update requested changes"
          : "Review this offer",
      href: financingOfferHref(row.applicationId),
      label: cta.buttonVariant === "makeAmendments" ? cta.label : "Review offer",
      hint: cta.hint ?? OFFER_REVIEW_ON_APPLICATION_HINT,
      buttonVariant: cta.buttonVariant === "makeAmendments" ? "outline" : "default",
    };
  }

  const ids = row.actionRequiredApplicationIds ?? [];
  if (
    ids.length > 0 &&
    isFacilityAmendmentRequested(row.contractStatus)
  ) {
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
    href: `/financing/contracts/${row.id}`,
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

function contractBusinessNumber(row: IssuerDashboardContract): string | null {
  const number = asContractForModal(row.contractForModal)?.contract_details?.number;
  return typeof number === "string" ? number : null;
}

export function facilityAttentionMeta(row: IssuerDashboardContract): string {
  const reference = formatContractReference({
    displayReference: row.displayReference,
    businessNumber: contractBusinessNumber(row),
    id: row.id,
  });
  const title = displayCell(row.title);
  if (title !== "—" && title !== reference) return `${reference} · ${title}`;
  return reference;
}

export function facilityAttentionDetail(row: IssuerDashboardContract): string | null {
  const metrics = resolveFacilityDisplayMetrics(row);
  const approved = metrics.approved;
  const utilised = metrics.utilized;
  const parts: string[] = [];
  if (approved != null && approved > 0 && utilised != null) {
    parts.push(`${Math.round((utilised / approved) * 100)}% used`);
  }
  const invoiceCount = row.invoiceStats?.total ?? 0;
  if (invoiceCount > 0) {
    parts.push(`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}`);
  }
  const lifetime = compactLifetimeLine(metrics, (value) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-MY") : "—";
  });
  if (lifetime) parts.push(lifetime);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function facilityAttentionAmountValue(row: IssuerDashboardContract): unknown {
  if (row.approvedFacilityAmount != null && String(row.approvedFacilityAmount).trim() !== "") {
    return row.approvedFacilityAmount;
  }
  const offerDetails = asContractForModal(row.contractForModal)?.offer_details as
    | Record<string, unknown>
    | null
    | undefined;
  return offerDetails?.offered_facility ?? offerDetails?.requested_facility ?? null;
}
