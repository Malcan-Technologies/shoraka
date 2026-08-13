"use client";

import AdminActivityTimeline from "@/components/admin-activity-timeline";

export interface RecentActivityCardProps {
  /** Same shape as main review tabs — drives status dots in resubmit comparison modal. */
  reviewTabSections?: { section: string; status: string }[];
  applicationId: string;
  /** Product id for resubmit comparison modal workflow tabs. */
  productKey?: string | null;
  /** Override section labels for timeline display (e.g. contract_details → "Customer" for invoice_only). */
  sectionLabelOverrides?: Record<string, string>;
  /** Same as application `visible_review_sections` — resubmit comparison tabs match main review. */
  visibleReviewSections?: unknown;
}

export function RecentActivityCard({
  reviewTabSections,
  applicationId,
  productKey,
  sectionLabelOverrides,
  visibleReviewSections,
}: RecentActivityCardProps) {
  return (
    <AdminActivityTimeline
      applicationId={applicationId}
      productKey={productKey}
      reviewTabSections={reviewTabSections}
      sectionLabelOverrides={sectionLabelOverrides}
      visibleReviewSections={visibleReviewSections}
    />
  );
}
