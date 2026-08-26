import {
  countIssuerApplicationsNeedingAction,
  countPendingIssuerOfferReviewItems,
  isIssuerApplicationActionable,
  type NormalizedApplication,
} from "@/app/(application-management)/applications/status";
import { actionsRequiredLabel, joinBannerSentences } from "./issuer-action-required";

export { actionsRequiredLabel, joinBannerSentences } from "./issuer-action-required";

/** Deep link for a single actionable application (offer tab, amend flow, or detail). */
export function issuerApplicationActionHref(app: NormalizedApplication): string {
  const key = (app.cardStatus.badgeKey ?? "").toLowerCase();
  const needsAmendments =
    app.cardStatus.showMakeAmendments ||
    key === "amendment_requested" ||
    app.invoices.some((inv) => String(inv.status ?? "").toUpperCase() === "AMENDMENT_REQUESTED");

  if (app.status === "draft" || needsAmendments) {
    return `/applications/${app.id}/edit`;
  }

  const invoiceOffer = app.invoices.find((inv) => inv.canReviewOffer);
  const needsOfferReview =
    app.cardStatus.showReviewOffer ||
    key === "offer_sent" ||
    countPendingIssuerOfferReviewItems(app) > 0 ||
    !!invoiceOffer;

  if (needsOfferReview) {
    const params = new URLSearchParams({ tab: "offer" });
    if (app.contractStatus !== "OFFER_SENT" && invoiceOffer) {
      params.set("invoiceId", invoiceOffer.id);
    }
    return `/applications/${app.id}?${params.toString()}`;
  }

  return `/applications/${app.id}`;
}

export type IssuerApplicationsPendingAction = {
  count: number;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

/**
 * Dashboard next-action payload for applications — same count as Recent applications
 * and the Applications sidebar badge (`isIssuerApplicationActionable`).
 */
export function buildIssuerApplicationsPendingAction(
  applications: readonly NormalizedApplication[]
): IssuerApplicationsPendingAction | null {
  const actionable = applications.filter(isIssuerApplicationActionable);
  const count = countIssuerApplicationsNeedingAction(applications);
  if (count === 0 || actionable.length === 0) return null;

  const hasOffer = actionable.some(
    (app) =>
      countPendingIssuerOfferReviewItems(app) > 0 ||
      app.cardStatus.showReviewOffer ||
      (app.cardStatus.badgeKey ?? "").toLowerCase() === "offer_sent"
  );
  const hasAmendment = actionable.some((app) => {
    const key = (app.cardStatus.badgeKey ?? "").toLowerCase();
    return (
      app.cardStatus.showMakeAmendments ||
      key === "amendment_requested" ||
      app.invoices.some((inv) => String(inv.status ?? "").toUpperCase() === "AMENDMENT_REQUESTED")
    );
  });

  let description = "Open Applications to clear items that need your response.";
  if (hasOffer && hasAmendment) {
    description = "Review offers and requested changes so your applications can move forward.";
  } else if (hasOffer) {
    description = "Review terms and accept or decline before they expire.";
  } else if (hasAmendment) {
    description = "Update the requested sections and resubmit for review.";
  }

  if (actionable.length === 1) {
    const app = actionable[0];
    const href = issuerApplicationActionHref(app);
    const ctaLabel = hasAmendment && !hasOffer ? "Make changes" : hasOffer ? "Review offer" : "View application";
    return {
      count,
      title: actionsRequiredLabel(count),
      description,
      href,
      ctaLabel,
    };
  }

  return {
    count,
    title: actionsRequiredLabel(count),
    description,
    href: "/applications",
    ctaLabel: "View applications",
  };
}

export type IssuerDashboardPendingAction = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  tone: "action";
  source: "applications" | "financing";
  count: number;
};

export type IssuerFinancingBannerInput = {
  count: number;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  /** Financing work not already counted as an application offer or amendment. */
  uniqueCount: number;
  uniqueDescription: string | null;
};

/**
 * Combine application and financing attention into one dashboard banner.
 * Offer/amendment work that already appears under applications is not counted again;
 * unpaid fees and other financing-only items are added to the same card.
 */
export function pickIssuerDashboardPendingAction(input: {
  applications: IssuerApplicationsPendingAction | null;
  financing: IssuerFinancingBannerInput | null;
}): IssuerDashboardPendingAction | null {
  const applications = input.applications;
  const financing = input.financing;
  const uniqueFinancingCount = financing?.uniqueCount ?? 0;
  const uniqueFinancingDescription = financing?.uniqueDescription ?? null;

  if (applications && uniqueFinancingCount > 0) {
    const count = applications.count + uniqueFinancingCount;
    return {
      title: actionsRequiredLabel(count),
      description: joinBannerSentences(applications.description, uniqueFinancingDescription),
      href: applications.href,
      ctaLabel: "Review now",
      tone: "action",
      source: "applications",
      count,
    };
  }

  if (applications) {
    return {
      title: applications.title,
      description: applications.description,
      href: applications.href,
      ctaLabel: applications.ctaLabel,
      tone: "action",
      source: "applications",
      count: applications.count,
    };
  }

  if (financing) {
    return {
      title: financing.title,
      description: financing.description,
      href: financing.href,
      ctaLabel: financing.ctaLabel,
      tone: "action",
      source: "financing",
      count: financing.count,
    };
  }

  return null;
}
